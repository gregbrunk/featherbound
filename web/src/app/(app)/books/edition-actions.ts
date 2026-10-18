'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { resumeHook, start } from 'workflow/api';
import { getDb } from '@/db';
import { bookAnalyses, editionRuns, editions, type SampleComment, type VersionLevel } from '@/db/schema';
import { guidanceFrom } from '@/lib/adapt';
import { NoKeyError, getModelChoices, getTextModel } from '@/lib/ai';
import { getEdition, getLatestAnalysis, getReadyAnalysis, getStoryBible, hardestSectionId, listSectionAnalyses } from '@/lib/analysis';
import { editionName, editionSettingsSchema, type EditionSettings } from '@/lib/editions';
import { PASSAGE_WORDS, estimateEdition, estimateRefine, estimateSamples } from '@/lib/estimate';
import { getBook, listSections } from '@/lib/library';
import { getRun, getVersion, latestRun } from '@/lib/runs';
import { requireAccount } from '@/lib/session';
import { adaptEdition, type CapDecision } from '@/workflows/adapt-edition';
import { analyzeBook } from '@/workflows/analyze-book';

/** Start reading the book for its Content Report and Story Bible. The parent has seen the estimate. */
export async function startAnalysis(bookId: string): Promise<{ ok: boolean; message?: string }> {
  const { userId } = await requireAccount();
  const book = await getBook(userId, bookId);
  if (!book || book.status !== 'ready') return { ok: false, message: 'This book isn’t ready yet.' };
  const latest = await getLatestAnalysis(userId, bookId);
  if (latest?.status === 'running') return { ok: true };

  let modelId;
  try {
    modelId = (await getTextModel(userId)).modelId;
  } catch (e) {
    if (e instanceof NoKeyError) return { ok: false, message: e.message };
    throw e;
  }

  const [row] = await getDb()
    .insert(bookAnalyses)
    .values({ userId, bookId, model: modelId, chaptersTotal: book.chapterCount })
    .returning({ id: bookAnalyses.id });
  const run = await start(analyzeBook, [userId, bookId, row.id]);
  await getDb().update(bookAnalyses).set({ workflowRunId: run.runId }).where(eq(bookAnalyses.id, row.id));
  revalidatePath(`/books/${bookId}`);
  return { ok: true };
}

/** Save the wizard's settings as a draft edition, and optionally start its sample chapters. */
export async function saveDraftEdition(bookId: string, input: { settings: EditionSettings; costCap: number; editionId?: string; makeSamples?: boolean }) {
  const { userId } = await requireAccount();
  const book = await getBook(userId, bookId);
  if (!book) throw new Error('Book not found');
  const settings = editionSettingsSchema.parse(input.settings);
  const cap = Math.round(Number(input.costCap) * 100) / 100;
  if (!Number.isFinite(cap) || cap < 0.5 || cap > 10_000) throw new Error('Pick a cost cap between $0.50 and $10,000.');

  const est = estimateEdition({ words: book.words, chapters: book.chapterCount }, settings, await getModelChoices(userId));
  const values = {
    name: editionName(settings),
    settings,
    costCap: cap.toFixed(2),
    estimate: { total: est.total, samples: est.samples, minutes: est.minutes },
    updatedAt: new Date(),
  };

  let editionId = input.editionId;
  if (editionId) {
    await getDb()
      .update(editions)
      .set(values)
      .where(and(eq(editions.userId, userId), eq(editions.id, editionId), eq(editions.status, 'draft')));
  } else {
    const [row] = await getDb().insert(editions).values({ userId, bookId, ...values }).returning({ id: editions.id });
    editionId = row.id;
  }
  revalidatePath(`/books/${bookId}`);
  if (input.makeSamples) {
    const r = await startSamples(editionId);
    if (!r.ok) throw new Error(r.message);
    redirect(`/editions/${editionId}/samples`);
  }
  redirect(`/books/${bookId}?tab=editions`);
}

type Result = { ok: true } | { ok: false; message: string };

async function ready(userId: string, bookId: string): Promise<Result> {
  const [bible, analysis] = await Promise.all([getStoryBible(userId, bookId), getReadyAnalysis(userId, bookId)]);
  if (!bible || !analysis) return { ok: false, message: 'I need to read the book through first. Start that from the book’s page.' };
  try {
    await getTextModel(userId);
  } catch (e) {
    if (e instanceof NoKeyError) return { ok: false, message: e.message };
    throw e;
  }
  return { ok: true };
}

/** Write a round of sample chapters: chapter 1 and the most intense chapter, unless others are picked. */
export async function startSamples(editionId: string, pick?: string[]): Promise<Result> {
  const { userId } = await requireAccount();
  const ed = await getEdition(userId, editionId);
  if (!ed) return { ok: false, message: 'Edition not found.' };
  const book = await getBook(userId, ed.bookId);
  if (!book) return { ok: false, message: 'Book not found.' };
  const check = await ready(userId, ed.bookId);
  if (!check.ok) return check;
  const running = await latestRun(userId, editionId);
  if (running?.status === 'running') return { ok: true };

  const chapters = (await listSections(userId, ed.bookId)).filter((s) => s.include);
  let sectionIds: string[];
  if (pick?.length) {
    sectionIds = chapters.filter((c) => pick.includes(c.id)).slice(0, 3).map((c) => c.id);
  } else {
    const analysis = await getReadyAnalysis(userId, ed.bookId);
    const hardest = analysis ? hardestSectionId(await listSectionAnalyses(userId, analysis.id)) : null;
    sectionIds = [...new Set([chapters[0]?.id, hardest].filter((x): x is string => Boolean(x)))];
  }
  if (!sectionIds.length) return { ok: false, message: 'This book has no chapters to sample.' };

  const words = chapters.filter((c) => sectionIds.includes(c.id)).reduce((n, c) => n + c.words, 0);
  const estimate = estimateSamples({ words: book.words, chapters: chapters.length }, words, await getModelChoices(userId), sectionIds.length);
  const round = running?.kind === 'samples' ? running.round + 1 : 1;
  const [run] = await getDb()
    .insert(editionRuns)
    .values({ userId, editionId, kind: 'samples', round, sectionIds, estimateUsd: estimate.toFixed(4), capUsd: Math.max(1, Math.ceil(estimate * 3)).toFixed(2) })
    .returning({ id: editionRuns.id });
  await getDb().update(editions).set({ status: 'making-samples', notice: null }).where(eq(editions.id, editionId));
  const wf = await start(adaptEdition, [userId, editionId, run.id, null]);
  await getDb().update(editionRuns).set({ workflowRunId: wf.runId }).where(eq(editionRuns.id, run.id));
  revalidatePath(`/books/${ed.bookId}`);
  return { ok: true };
}

export type Feedback = { comments: SampleComment[]; overall: string };

/** Keep this round's notes, both on the run (for the record) and on the edition (for every later prompt). */
async function keepFeedback(userId: string, runId: string, editionId: string, fb: Feedback) {
  const run = await getRun(userId, runId);
  const ed = await getEdition(userId, editionId);
  if (!run || !ed || run.editionId !== editionId) throw new Error('Samples not found');
  const sections = await listSections(userId, ed.bookId);
  const titles = new Map(sections.map((s) => [s.id, s.title]));
  const comments = fb.comments.slice(0, 50).map((c) => ({ sectionId: c.sectionId, quote: c.quote.slice(0, 300), text: c.text.slice(0, 1000) }));
  const overall = fb.overall.slice(0, 2000);
  const lines = guidanceFrom(comments.map((c) => ({ ...c, chapter: titles.get(c.sectionId) ?? 'a chapter' })), overall);
  await getDb().update(editionRuns).set({ comments, overall }).where(eq(editionRuns.id, runId));
  if (lines.length) await getDb().update(editions).set({ sampleGuidance: [...ed.sampleGuidance, ...lines] }).where(eq(editions.id, editionId));
  return { run, ed, added: lines.length };
}

export async function rewriteSamples(editionId: string, runId: string, fb: Feedback): Promise<Result> {
  const { userId } = await requireAccount();
  const { run } = await keepFeedback(userId, runId, editionId, fb);
  return startSamples(editionId, run.sectionIds);
}

/** "Looks great: write the whole book." Unchanged samples are reused instead of written again. */
export async function approveSamples(editionId: string, runId: string, fb: Feedback, capUsd: number): Promise<Result> {
  const { userId } = await requireAccount();
  const { ed, added } = await keepFeedback(userId, runId, editionId, fb);
  const book = await getBook(userId, ed.bookId);
  if (!book) return { ok: false, message: 'Book not found.' };
  const check = await ready(userId, ed.bookId);
  if (!check.ok) return check;
  const cap = Math.round(Number(capUsd) * 100) / 100;
  if (!Number.isFinite(cap) || cap < 0.5 || cap > 10_000) return { ok: false, message: 'Pick a cost cap between $0.50 and $10,000.' };

  const settings = editionSettingsSchema.parse(ed.settings);
  const chapters = (await listSections(userId, ed.bookId)).filter((s) => s.include);
  const est = estimateEdition({ words: book.words, chapters: chapters.length }, { ...settings, picture: { ...settings.picture, on: false } }, await getModelChoices(userId));
  const [run] = await getDb()
    .insert(editionRuns)
    .values({ userId, editionId, kind: 'full', sectionIds: chapters.map((c) => c.id), estimateUsd: est.total.toFixed(4), capUsd: cap.toFixed(2) })
    .returning({ id: editionRuns.id });
  await getDb().update(editions).set({ status: 'running', costCap: cap.toFixed(2), notice: null }).where(eq(editions.id, editionId));
  const wf = await start(adaptEdition, [userId, editionId, run.id, added ? null : runId]);
  await getDb().update(editionRuns).set({ workflowRunId: wf.runId }).where(eq(editionRuns.id, run.id));
  redirect(`/editions/${editionId}/progress`);
}

/** Answer a run paused at its cost cap. */
export async function answerCap(runId: string, decision: CapDecision): Promise<Result> {
  const { userId } = await requireAccount();
  const run = await getRun(userId, runId);
  if (!run || run.status !== 'paused-cap' || !run.hookToken) return { ok: false, message: 'This run isn’t waiting on you any more.' };
  if (decision.action === 'continue' && (!Number.isFinite(decision.cap) || decision.cap <= Number(run.spentUsd) || decision.cap > 10_000)) {
    return { ok: false, message: 'The new cap needs to be above what’s been spent so far.' };
  }
  await resumeHook(run.hookToken, decision.action === 'continue' ? { action: 'continue', cap: Math.round(decision.cap * 100) / 100 } : { action: 'stop' });
  revalidatePath(`/editions/${run.editionId}/progress`);
  return { ok: true };
}

/** Pick a failed or stopped run back up from its last finished chapter. */
export async function resumeRun(runId: string, capUsd?: number): Promise<Result> {
  const { userId } = await requireAccount();
  const run = await getRun(userId, runId);
  if (!run || (run.status !== 'failed' && run.status !== 'stopped')) return { ok: false, message: 'This run can’t be resumed.' };
  const ed = await getEdition(userId, run.editionId);
  if (!ed) return { ok: false, message: 'Edition not found.' };
  const check = await ready(userId, ed.bookId);
  if (!check.ok) return check;
  const set: Partial<typeof editionRuns.$inferInsert> = { status: 'running', error: null, finishedAt: null, hookToken: null };
  if (capUsd !== undefined) {
    if (!Number.isFinite(capUsd) || capUsd <= Number(run.spentUsd)) return { ok: false, message: 'The new cap needs to be above what’s been spent so far.' };
    set.capUsd = capUsd.toFixed(2);
  }
  await getDb().update(editionRuns).set(set).where(eq(editionRuns.id, runId));
  const wf = await start(adaptEdition, [userId, run.editionId, run.id, null]);
  await getDb().update(editionRuns).set({ workflowRunId: wf.runId }).where(eq(editionRuns.id, runId));
  revalidatePath(`/editions/${run.editionId}/progress`);
  return { ok: true };
}

export async function clearNotice(editionId: string) {
  const { userId } = await requireAccount();
  await getDb().update(editions).set({ notice: null }).where(and(eq(editions.userId, userId), eq(editions.id, editionId)));
}

export async function deleteEdition(bookId: string, editionId: string) {
  const { userId } = await requireAccount();
  await getDb().delete(editions).where(and(eq(editions.userId, userId), eq(editions.id, editionId), eq(editions.bookId, bookId)));
  revalidatePath(`/books/${bookId}`);
}

export type RefineInput = {
  scope: 'whole' | 'chapters' | 'passage';
  sectionIds: string[];
  passage?: { sectionId: string; index: number };
  guidance: string;
  level: VersionLevel;
  capUsd: number;
};

/** Make a new version of a ready edition that follows one request. Only the chosen chapters are rewritten. */
export async function startRefine(editionId: string, input: RefineInput): Promise<Result> {
  const { userId } = await requireAccount();
  const ed = await getEdition(userId, editionId);
  if (!ed || !ed.currentVersion) return { ok: false, message: 'This edition has no finished version to refine yet.' };
  const book = await getBook(userId, ed.bookId);
  if (!book) return { ok: false, message: 'Book not found.' };
  const check = await ready(userId, ed.bookId);
  if (!check.ok) return check;
  const busy = await latestRun(userId, editionId);
  if (busy && (busy.status === 'running' || busy.status === 'paused-cap')) return { ok: false, message: 'This edition is already being worked on. Wait for that to finish first.' };

  const guidance = input.guidance.trim().slice(0, 2000);
  if (guidance.length < 5) return { ok: false, message: 'Tell me what to change.' };
  if (!['major', 'minor', 'patch'].includes(input.level)) return { ok: false, message: 'Pick a version level.' };
  const version = await getVersion(userId, editionId, ed.currentVersion);
  if (!version) return { ok: false, message: 'The current version is missing.' };
  const inVersion = new Set(version.manifest.map((m) => m.sectionId));

  let sectionIds: string[];
  if (input.scope === 'whole') sectionIds = version.manifest.map((m) => m.sectionId);
  else if (input.scope === 'chapters') sectionIds = input.sectionIds.filter((id) => inVersion.has(id));
  else sectionIds = input.passage && inVersion.has(input.passage.sectionId) ? [input.passage.sectionId] : [];
  if (!sectionIds.length) return { ok: false, message: input.scope === 'passage' ? 'Pick the paragraph to change.' : 'Pick at least one chapter.' };

  const sections = await listSections(userId, ed.bookId);
  const words = input.scope === 'passage' ? PASSAGE_WORDS : sections.filter((s) => sectionIds.includes(s.id)).reduce((n, s) => n + s.words, 0);
  const est = estimateRefine({ words: book.words, chapters: book.chapterCount }, words, sectionIds.length, await getModelChoices(userId));
  const cap = Math.round(Number(input.capUsd) * 100) / 100;
  if (!Number.isFinite(cap) || cap < 0.5 || cap > 10_000) return { ok: false, message: 'Pick a cost cap between $0.50 and $10,000.' };

  const [run] = await getDb()
    .insert(editionRuns)
    .values({
      userId, editionId, kind: 'refine', sectionIds, estimateUsd: est.cost.toFixed(4), capUsd: cap.toFixed(2),
      refine: { scope: input.scope, guidance, level: input.level, baseVersion: ed.currentVersion, passage: input.scope === 'passage' ? input.passage : undefined },
    })
    .returning({ id: editionRuns.id });
  const wf = await start(adaptEdition, [userId, editionId, run.id, null]);
  await getDb().update(editionRuns).set({ workflowRunId: wf.runId }).where(eq(editionRuns.id, run.id));
  redirect(`/editions/${editionId}/progress`);
}

/** Roll back (or forward): make another version the one people read and download. Nothing is deleted. */
export async function makeVersionCurrent(editionId: string, number: string): Promise<Result> {
  const { userId } = await requireAccount();
  const ed = await getEdition(userId, editionId);
  const version = ed && (await getVersion(userId, editionId, number));
  if (!ed || !version) return { ok: false, message: 'Version not found.' };
  await getDb().update(editions).set({ currentVersion: number, updatedAt: new Date() }).where(and(eq(editions.userId, userId), eq(editions.id, editionId)));
  revalidatePath(`/editions/${editionId}/history`);
  revalidatePath(`/books/${ed.bookId}`);
  return { ok: true };
}
