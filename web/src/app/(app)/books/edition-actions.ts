'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { start } from 'workflow/api';
import { getDb } from '@/db';
import { bookAnalyses, editions } from '@/db/schema';
import { NoKeyError, getModelChoices, getTextModel } from '@/lib/ai';
import { getLatestAnalysis } from '@/lib/analysis';
import { editionName, editionSettingsSchema, type EditionSettings } from '@/lib/editions';
import { estimateEdition } from '@/lib/estimate';
import { getBook } from '@/lib/library';
import { requireAccount } from '@/lib/session';
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

/** Save the wizard's settings as a draft edition. Samples and the full run come in later phases. */
export async function saveDraftEdition(bookId: string, input: { settings: EditionSettings; costCap: number; editionId?: string }) {
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

  if (input.editionId) {
    await getDb()
      .update(editions)
      .set(values)
      .where(and(eq(editions.userId, userId), eq(editions.id, input.editionId), eq(editions.status, 'draft')));
  } else {
    await getDb().insert(editions).values({ userId, bookId, ...values });
  }
  revalidatePath(`/books/${bookId}`);
  redirect(`/books/${bookId}?tab=editions`);
}

export async function deleteEdition(bookId: string, editionId: string) {
  const { userId } = await requireAccount();
  await getDb().delete(editions).where(and(eq(editions.userId, userId), eq(editions.id, editionId), eq(editions.bookId, bookId)));
  revalidatePath(`/books/${bookId}`);
}
