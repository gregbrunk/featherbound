import { generateText, Output } from 'ai';
import { and, asc, eq, sql } from 'drizzle-orm';
import { createHook, FatalError } from 'workflow';
import { z } from 'zod';
import { getDb } from '@/db';
import { editionChapters, editionRuns, editions, editionVersions, type ChangeNote } from '@/db/schema';
import { AlignmentError, adaptPart, assemble, bibleText, chunkIndexes, tailOf, type ChapterJob, type PartResult } from '@/lib/adapt';
import { NoKeyError, getTextModel, recordAiCall } from '@/lib/ai';
import { getReadyAnalysis, getStoryBible, listSectionAnalyses } from '@/lib/analysis';
import { editionSettingsSchema } from '@/lib/editions';
import type { Block } from '@/lib/import/types';
import { getBook, listSections } from '@/lib/library';
import { textCostUsd } from '@/lib/models';
import { readJson, writeContentAddressed } from '@/lib/storage';

// Writes an edition: a round of sample chapters, or the whole book. Chapters run a few at a
// time; each ~2,000-word part of a chapter is its own durable step, so a long chapter never
// hits a function time limit and a retry only repeats one part. Before each batch the run
// checks its cost cap and, if the next chapters would go over, pauses on a hook until the
// parent raises the cap or stops. A rerun of the same run skips chapters already written.

const BATCH = 3;
const MAX_FIXES = 3;

export type CapDecision = { action: 'continue'; cap: number } | { action: 'stop' };

export async function adaptEdition(userId: string, editionId: string, runId: string, reuseFromRunId: string | null) {
  'use workflow';
  try {
    const plan = await planRun(userId, editionId, runId, reuseFromRunId);
    let i = 0;
    while (i < plan.todo.length) {
      const batch = plan.todo.slice(i, i + BATCH);
      if (plan.kind === 'full') {
        const gate = await checkCap(runId, batch.reduce((n, c) => n + c.words, 0), plan.ratePerWord);
        if (!gate.ok) {
          const decision = await waitForParent(userId, editionId, runId, gate.needed);
          if (decision.action === 'stop') {
            await stopRun(editionId, runId);
            return { ok: false as const, stopped: true };
          }
          continue;
        }
      }
      await Promise.all(batch.map((c) => writeChapter(userId, editionId, runId, c.sectionId, null)));
      i += BATCH;
    }

    if (plan.kind === 'samples') {
      await finishSamples(editionId, runId);
      return { ok: true as const };
    }

    const flagged = await checkConsistency(userId, editionId, runId);
    for (const f of flagged) {
      const gate = await checkCap(runId, f.words, plan.ratePerWord);
      if (!gate.ok) break;
      await writeChapter(userId, editionId, runId, f.sectionId, f.reason);
    }
    await publishFirstVersion(userId, editionId, runId);
    return { ok: true as const };
  } catch (e) {
    await failRun(editionId, runId, e instanceof Error ? e.message : String(e));
    return { ok: false as const };
  }
}

async function waitForParent(userId: string, editionId: string, runId: string, needed: number): Promise<CapDecision> {
  using hook = createHook<CapDecision>();
  await hook.getConflict(); // commit the hook before telling the parent how to resume it
  await markPaused(editionId, runId, hook.token, needed);
  const decision = await hook;
  if (decision.action === 'continue') await markResumed(editionId, runId, decision.cap);
  return decision;
}

/** Write one chapter part by part, then save it. Runs at the workflow level; each call inside is a step. */
async function writeChapter(userId: string, editionId: string, runId: string, sectionId: string, fix: string | null) {
  const prep = await prepareChapter(userId, editionId, runId, sectionId, fix);
  if (!prep) return;
  const parts: (PartResult & { cost: number })[] = [];
  for (let ci = 0; ci < prep.chunks.length; ci++) {
    parts.push(await writePart(userId, runId, prep.job, prep.chunks, ci, ci ? tailOf(parts[ci - 1]) : []));
  }
  await saveChapter(userId, editionId, runId, sectionId, prep.job, prep.chunks, parts, prep.position, fix);
}

// ── Steps ──────────────────────────────────────────────────────────────────────────

type TodoChapter = { sectionId: string; words: number };

async function planRun(userId: string, editionId: string, runId: string, reuseFromRunId: string | null) {
  'use step';
  const db = getDb();
  const [run] = await db.select().from(editionRuns).where(eq(editionRuns.id, runId)).limit(1);
  const [ed] = await db.select().from(editions).where(eq(editions.id, editionId)).limit(1);
  if (!run || !ed) throw new FatalError('Run not found');
  const book = await getBook(userId, ed.bookId);
  if (!book) throw new FatalError('Book not found');

  // Approved sample chapters carry straight into the full book when no new notes came with the approval.
  if (reuseFromRunId) {
    const [have, reuse] = await Promise.all([
      db.select({ sectionId: editionChapters.sectionId }).from(editionChapters).where(eq(editionChapters.runId, runId)),
      db.select().from(editionChapters).where(eq(editionChapters.runId, reuseFromRunId)),
    ]);
    const done = new Set(have.map((h) => h.sectionId));
    const copies = reuse
      .filter((c) => c.sectionId && run.sectionIds.includes(c.sectionId) && !done.has(c.sectionId))
      .map((c) => ({
        userId: c.userId, editionId: c.editionId, runId, sectionId: c.sectionId, position: c.position, title: c.title, kidTitle: c.kidTitle,
        recap: c.recap, textPath: c.textPath, words: c.words, originalWords: c.originalWords, changeNotes: c.changeNotes,
        summary: c.summary, names: c.names, fixNote: c.fixNote, costUsd: c.costUsd,
      }));
    if (copies.length) await db.insert(editionChapters).values(copies);
  }

  const [sections, existing] = await Promise.all([
    listSections(userId, ed.bookId),
    db.select({ sectionId: editionChapters.sectionId }).from(editionChapters).where(eq(editionChapters.runId, runId)),
  ]);
  const done = new Set(existing.map((e) => e.sectionId));
  const words = new Map(sections.map((s) => [s.id, s.words]));
  const todo: TodoChapter[] = run.sectionIds.filter((id) => !done.has(id) && words.has(id)).map((id) => ({ sectionId: id, words: words.get(id)! }));

  await db.update(editionRuns).set({ status: 'running', error: null, stage: 'writing', chaptersDone: done.size }).where(eq(editionRuns.id, runId));
  await db
    .update(editions)
    .set({ status: run.kind === 'samples' ? 'making-samples' : 'running', notice: null, updatedAt: new Date() })
    .where(eq(editions.id, editionId));

  const totalWords = run.sectionIds.reduce((n, id) => n + (words.get(id) ?? 0), 0);
  return { kind: run.kind, todo, ratePerWord: Number(run.estimateUsd) / Math.max(1, totalWords) };
}

/** Will the next chapters fit under the cap? Uses this run's actual cost per word once it has one. */
async function checkCap(runId: string, nextWords: number, estimatedRate: number) {
  'use step';
  const db = getDb();
  const [run] = await db.select().from(editionRuns).where(eq(editionRuns.id, runId)).limit(1);
  // Only chapters written in this run count; approved samples carried over cost nothing here.
  const [{ words, cost }] = await db
    .select({
      words: sql<number>`coalesce(sum(${editionChapters.originalWords}) filter (where ${editionChapters.costUsd} > 0), 0)::int`,
      cost: sql<number>`coalesce(sum(${editionChapters.costUsd}), 0)::float`,
    })
    .from(editionChapters)
    .where(eq(editionChapters.runId, runId));
  const spent = Number(run.spentUsd);
  const rate = words > 2000 && cost > 0 ? cost / words : estimatedRate;
  const projected = nextWords * rate * 1.1;
  const cap = Number(run.capUsd);
  return { ok: spent + projected <= cap, needed: spent + projected - cap };
}

async function markPaused(editionId: string, runId: string, token: string, needed: number) {
  'use step';
  await getDb().update(editionRuns).set({ status: 'paused-cap', hookToken: token, stage: `needs ${needed.toFixed(2)} more` }).where(eq(editionRuns.id, runId));
  await getDb().update(editions).set({ status: 'paused-cap', notice: 'paused-cap', noticeAt: new Date() }).where(eq(editions.id, editionId));
}

async function markResumed(editionId: string, runId: string, cap: number) {
  'use step';
  await getDb().update(editionRuns).set({ status: 'running', hookToken: null, capUsd: cap.toFixed(2), stage: 'writing' }).where(eq(editionRuns.id, runId));
  await getDb().update(editions).set({ status: 'running', costCap: cap.toFixed(2), notice: null }).where(eq(editions.id, editionId));
}

async function stopRun(editionId: string, runId: string) {
  'use step';
  await getDb().update(editionRuns).set({ status: 'stopped', hookToken: null, finishedAt: new Date() }).where(eq(editionRuns.id, runId));
  await getDb().update(editions).set({ status: 'paused-cap', notice: null }).where(eq(editions.id, editionId));
}

async function prepareChapter(userId: string, editionId: string, runId: string, sectionId: string, fix: string | null) {
  'use step';
  const db = getDb();
  if (!fix) {
    const [have] = await db.select({ id: editionChapters.id }).from(editionChapters).where(and(eq(editionChapters.runId, runId), eq(editionChapters.sectionId, sectionId))).limit(1);
    if (have) return null;
  }
  const [ed] = await db.select().from(editions).where(eq(editions.id, editionId)).limit(1);
  const settings = editionSettingsSchema.parse(ed.settings);
  const [sections, bible, analysis] = await Promise.all([listSections(userId, ed.bookId), getStoryBible(userId, ed.bookId), getReadyAnalysis(userId, ed.bookId)]);
  if (!bible || !analysis) throw new FatalError('Read the book through first, so I have its Story Bible.');
  const summaries = new Map((await listSectionAnalyses(userId, analysis.id)).map((r) => [r.sectionId, r.summary]));
  const chapters = sections.filter((s) => s.include);
  const position = chapters.findIndex((s) => s.id === sectionId);
  if (position < 0) throw new FatalError('That chapter is no longer in the book.');
  const section = chapters[position];
  const { blocks } = await readJson<{ blocks: Block[] }>(section.textPath);

  const job: ChapterJob = {
    settings,
    bible: bibleText(bible.data),
    guidance: ed.sampleGuidance,
    storySoFar: chapters.slice(0, position).map((c) => summaries.get(c.id) ?? c.title),
    chapterNumber: position + 1,
    title: section.title,
    chapterSummary: summaries.get(section.id) ?? '',
    blocks,
    fix: fix ?? undefined,
  };
  return { job, chunks: chunkIndexes(blocks), position: section.position };
}

async function writePart(userId: string, runId: string, job: ChapterJob, chunks: number[][], ci: number, prevTail: string[]) {
  'use step';
  let model;
  try {
    model = await getTextModel(userId);
  } catch (e) {
    if (e instanceof NoKeyError) throw new FatalError(e.message);
    throw e;
  }
  const record = async (u: { inputTokens: number; outputTokens: number; ms: number }, error?: string) => {
    const cost = textCostUsd(model.modelId, u.inputTokens, u.outputTokens);
    await recordAiCall({ userId, runId, kind: 'adapt', model: model.modelId, keySource: model.keySource, inputTokens: u.inputTokens, outputTokens: u.outputTokens, costUsd: cost, ms: u.ms, error });
    await getDb().update(editionRuns).set({ spentUsd: sql`${editionRuns.spentUsd} + ${cost.toFixed(6)}` }).where(eq(editionRuns.id, runId));
    return cost;
  };
  try {
    const { part, usage } = await adaptPart(model.model, job, chunks, ci, prevTail);
    const cost = await record(usage);
    return { ...part, cost };
  } catch (e) {
    const usage = (e as { usage?: { inputTokens: number; outputTokens: number; ms: number } }).usage;
    await record(usage ?? { inputTokens: 0, outputTokens: 0, ms: 0 }, String(e).slice(0, 500));
    if (e instanceof AlignmentError) throw new Error(e.message); // retried
    throw e;
  }
}
writePart.maxRetries = 2;

async function saveChapter(userId: string, editionId: string, runId: string, sectionId: string, job: ChapterJob, chunks: number[][], parts: (PartResult & { cost: number })[], position: number, fix: string | null) {
  'use step';
  const r = assemble(job, chunks, parts);
  const textPath = await writeContentAddressed(userId, { title: job.title, blocks: r.blocks });
  const db = getDb();
  const values = {
    userId, editionId, runId, sectionId, position,
    title: job.title, kidTitle: r.kidTitle, recap: r.recap, textPath,
    words: r.words, originalWords: r.originalWords,
    changeNotes: r.changeNotes as ChangeNote[], summary: r.summary, names: r.names, fixNote: fix,
    costUsd: parts.reduce((n, p) => n + p.cost, 0).toFixed(6),
  };
  const [have] = await db.select({ id: editionChapters.id }).from(editionChapters).where(and(eq(editionChapters.runId, runId), eq(editionChapters.sectionId, sectionId))).limit(1);
  if (have) await db.update(editionChapters).set(values).where(eq(editionChapters.id, have.id));
  else await db.insert(editionChapters).values(values);
  await db
    .update(editionRuns)
    .set({ chaptersDone: sql`(select count(*) from ${editionChapters} where ${editionChapters.runId} = ${runId})` })
    .where(eq(editionRuns.id, runId));
}

async function finishSamples(editionId: string, runId: string) {
  'use step';
  await getDb().update(editionRuns).set({ status: 'ready', stage: null, finishedAt: new Date() }).where(eq(editionRuns.id, runId));
  await getDb().update(editions).set({ status: 'samples-ready', notice: 'samples-ready', noticeAt: new Date(), updatedAt: new Date() }).where(eq(editions.id, editionId));
}

const consistencySchema = z.object({
  problems: z.array(z.object({
    chapter: z.number().int().describe('Chapter number from the list'),
    reason: z.string().describe('What is inconsistent and what it should be, in one or two sentences, written as an instruction for the rewrite'),
  })).describe('Only real problems a reader would notice. Empty if the edition is consistent.'),
});

/** Look across the whole edition for renamed characters, contradicted details and dropped threads. */
async function checkConsistency(userId: string, editionId: string, runId: string) {
  'use step';
  const db = getDb();
  await db.update(editionRuns).set({ stage: 'checking' }).where(eq(editionRuns.id, runId));
  const [ed] = await db.select().from(editions).where(eq(editions.id, editionId)).limit(1);
  const bible = await getStoryBible(userId, ed.bookId);
  const chapters = await db.select().from(editionChapters).where(eq(editionChapters.runId, runId)).orderBy(asc(editionChapters.position));
  const flagged = new Map<string, { sectionId: string; reason: string; words: number }>();

  // Full length is checked by counting: a chapter that lost a third of its words was cut.
  for (const c of chapters) {
    if (c.sectionId && c.originalWords > 200 && c.words < c.originalWords * 0.65) {
      flagged.set(c.sectionId, { sectionId: c.sectionId, words: c.originalWords, reason: `The adapted chapter came out at ${c.words} words from ${c.originalWords}. Adapt every paragraph at full length; do not summarize.` });
    }
  }

  const model = await getTextModel(userId).catch((e) => { throw e instanceof NoKeyError ? new FatalError(e.message) : e; });
  const t0 = Date.now();
  try {
    const res = await generateText({
      model: model.model,
      reasoning: 'medium',
      output: Output.object({ schema: consistencySchema }),
      prompt: `You are checking a gentler children's edition of a book for consistency before it is published. Compare each adapted chapter's summary and names against the Story Bible and against each other.

Flag only: a character or place renamed or misspelled, a detail that contradicts an earlier chapter, or a plot thread from the Story Bible that disappears or changes outcome. Softened or off-page events are intended, not problems.

<story_bible>
${bible ? bibleText(bible.data) : 'None.'}
</story_bible>

<chapters>
${chapters.map((c, i) => `Chapter ${i + 1}: ${c.title}\nNames used: ${c.names.join(', ')}\nWhat happens: ${c.summary}`).join('\n\n')}
</chapters>`,
    });
    const u = res.usage;
    const cost = textCostUsd(model.modelId, u.inputTokens ?? 0, u.outputTokens ?? 0);
    await recordAiCall({ userId, runId, kind: 'consistency', model: model.modelId, keySource: model.keySource, inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0, costUsd: cost, ms: Date.now() - t0 });
    await db.update(editionRuns).set({ spentUsd: sql`${editionRuns.spentUsd} + ${cost.toFixed(6)}` }).where(eq(editionRuns.id, runId));
    for (const p of res.output.problems) {
      const c = chapters[p.chapter - 1];
      if (c?.sectionId && !flagged.has(c.sectionId)) flagged.set(c.sectionId, { sectionId: c.sectionId, words: c.originalWords, reason: p.reason });
    }
  } catch (e) {
    // The check is a safety net; a failure here shouldn't sink a finished book.
    await recordAiCall({ userId, runId, kind: 'consistency', model: model.modelId, keySource: model.keySource, costUsd: 0, ms: Date.now() - t0, error: String(e).slice(0, 500) });
  }
  await db.update(editionRuns).set({ stage: flagged.size ? 'fixing' : 'finishing' }).where(eq(editionRuns.id, runId));
  return [...flagged.values()].slice(0, MAX_FIXES);
}

const versionSchema = z.object({
  name: z.string().describe('A warm, whimsical two- or three-word name for this version, like "First Light" or "Gentle Winds"'),
  description: z.string().describe('One sentence for the parent on what this edition is'),
});

async function publishFirstVersion(userId: string, editionId: string, runId: string) {
  'use step';
  const db = getDb();
  const [ed] = await db.select().from(editions).where(eq(editions.id, editionId)).limit(1);
  const [run] = await db.select().from(editionRuns).where(eq(editionRuns.id, runId)).limit(1);
  const book = await getBook(userId, ed.bookId);
  const chapters = await db.select().from(editionChapters).where(eq(editionChapters.runId, runId)).orderBy(asc(editionChapters.position));

  let name = 'First Light';
  let description = `The first full softened edition of ${book?.title ?? 'this book'}, ${ed.name.toLowerCase()}.`;
  try {
    const model = await getTextModel(userId);
    const t0 = Date.now();
    const notes = chapters.flatMap((c) => c.changeNotes).slice(0, 60).map((n) => `${n.level} · ${n.category}: ${n.note}`).join('\n');
    const res = await generateText({
      model: model.model,
      reasoning: 'low',
      output: Output.object({ schema: versionSchema }),
      prompt: `Name version 1.0.0 of a gentler children's edition of "${book?.title}" (${ed.name}). Here are some of the changes made:\n${notes}`,
    });
    const u = res.usage;
    const cost = textCostUsd(model.modelId, u.inputTokens ?? 0, u.outputTokens ?? 0);
    await recordAiCall({ userId, runId, kind: 'version-name', model: model.modelId, keySource: model.keySource, inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0, costUsd: cost, ms: Date.now() - t0 });
    await db.update(editionRuns).set({ spentUsd: sql`${editionRuns.spentUsd} + ${cost.toFixed(6)}` }).where(eq(editionRuns.id, runId));
    name = res.output.name.slice(0, 60);
    description = res.output.description.slice(0, 400);
  } catch {
    // Keep the friendly defaults.
  }

  const [fresh] = await db.select({ spent: editionRuns.spentUsd }).from(editionRuns).where(eq(editionRuns.id, runId)).limit(1);
  await db.insert(editionVersions).values({
    userId, editionId, number: '1.0.0', name, description, level: 'initial', runId,
    manifest: chapters.filter((c) => c.sectionId).map((c) => ({ sectionId: c.sectionId!, chapterId: c.id })),
    costUsd: fresh?.spent ?? run.spentUsd,
  });
  await db.update(editionRuns).set({ status: 'ready', stage: null, finishedAt: new Date() }).where(eq(editionRuns.id, runId));
  await db.update(editions).set({ status: 'ready', currentVersion: '1.0.0', notice: 'ready', noticeAt: new Date(), updatedAt: new Date() }).where(eq(editions.id, editionId));
}

async function failRun(editionId: string, runId: string, error: string) {
  'use step';
  await getDb().update(editionRuns).set({ status: 'failed', error: error.slice(0, 500), finishedAt: new Date() }).where(eq(editionRuns.id, runId));
  await getDb().update(editions).set({ status: 'failed', notice: 'failed', noticeAt: new Date() }).where(eq(editions.id, editionId));
}
