import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { aiCalls, bookAnalyses, books, editionRuns, editions } from '@/db/schema';
import { estimateAnalysis } from './estimate';

// Usage dashboard figures, all from recorded AI calls (src/lib/ai.ts recordAiCall).

export type UsageMonth = { key: string; label: string; text: number; images: number };
export type UsageRun = {
  id: string; date: string; bookId: string | null; bookTitle: string; kind: string;
  tokensIn: number; tokensOut: number; images: number; estimate: number | null; actual: number; running: boolean;
};

const KIND_LABEL: Record<string, string> = {
  'analysis-chapter': 'Reading books',
  'analysis-bible': 'Reading books',
  'import-suggest': 'Import help',
  consistency: 'Checks & naming',
  'version-name': 'Checks & naming',
};

export async function getUsage(userId: string, now = new Date()) {
  const db = getDb();
  const calls = await db.select().from(aiCalls).where(eq(aiCalls.userId, userId)).orderBy(desc(aiCalls.createdAt));
  const runIds = [...new Set(calls.map((c) => c.runId).filter((x): x is string => Boolean(x)))];

  const [analyses, runs] = runIds.length
    ? await Promise.all([
        db.select().from(bookAnalyses).where(inArray(bookAnalyses.id, runIds)),
        db.select({ run: editionRuns, bookId: editions.bookId }).from(editionRuns).innerJoin(editions, eq(editions.id, editionRuns.editionId)).where(inArray(editionRuns.id, runIds)),
      ])
    : [[], []];
  const bookIds = [...new Set([...analyses.map((a) => a.bookId), ...runs.map((r) => r.bookId)])];
  const bookRows = bookIds.length ? await db.select({ id: books.id, title: books.title, words: books.words, chapters: books.chapterCount }).from(books).where(inArray(books.id, bookIds)) : [];
  const bookById = new Map(bookRows.map((b) => [b.id, b]));

  const runInfo = new Map<string, { bookId: string; kind: string }>();
  for (const a of analyses) runInfo.set(a.id, { bookId: a.bookId, kind: 'Reading books' });
  for (const r of runs) runInfo.set(r.run.id, { bookId: r.bookId, kind: r.run.kind === 'samples' ? 'Sample chapters' : 'Full adaptation' });

  const cost = (c: (typeof calls)[number]) => Number(c.costUsd);
  const kindOf = (c: (typeof calls)[number]) => KIND_LABEL[c.kind] ?? (c.runId ? runInfo.get(c.runId)?.kind : undefined) ?? 'Other';

  // Months: the last six, oldest first.
  const months: UsageMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }), text: 0, images: 0 });
  }
  const monthByKey = new Map(months.map((m) => [m.key, m]));
  for (const c of calls) {
    const m = monthByKey.get(`${c.createdAt.getFullYear()}-${c.createdAt.getMonth()}`);
    if (!m) continue;
    if (c.images > 0) m.images += cost(c); else m.text += cost(c);
  }
  const thisMonth = months[months.length - 1];
  const monthCalls = calls.filter((c) => c.createdAt.getFullYear() === now.getFullYear() && c.createdAt.getMonth() === now.getMonth());
  const monthTotal = thisMonth.text + thisMonth.images;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = (monthTotal / Math.max(1, now.getDate())) * daysInMonth;

  const byBook = new Map<string, { id: string; title: string; cost: number; runs: Set<string> }>();
  const byKind = new Map<string, number>();
  for (const c of calls) {
    byKind.set(kindOf(c), (byKind.get(kindOf(c)) ?? 0) + cost(c));
    const info = c.runId ? runInfo.get(c.runId) : undefined;
    if (!info) continue;
    const b = byBook.get(info.bookId) ?? { id: info.bookId, title: bookById.get(info.bookId)?.title ?? 'Deleted book', cost: 0, runs: new Set<string>() };
    b.cost += cost(c);
    b.runs.add(c.runId!);
    byBook.set(info.bookId, b);
  }

  // Runs: estimate vs actual. Analyses didn't store their estimate, so it's recomputed from the book.
  const recent: UsageRun[] = [];
  for (const a of analyses) {
    const b = bookById.get(a.bookId);
    const mine = calls.filter((c) => c.runId === a.id);
    recent.push({
      id: a.id, date: a.startedAt.toISOString(), bookId: a.bookId, bookTitle: b?.title ?? 'Deleted book', kind: 'Reading the book',
      tokensIn: mine.reduce((n, c) => n + c.inputTokens, 0), tokensOut: mine.reduce((n, c) => n + c.outputTokens, 0), images: 0,
      estimate: b ? estimateAnalysis({ words: b.words, chapters: b.chapters }, a.model).cost : null,
      actual: Number(a.costUsd), running: a.status === 'running',
    });
  }
  for (const { run, bookId } of runs) {
    const mine = calls.filter((c) => c.runId === run.id);
    recent.push({
      id: run.id, date: run.startedAt.toISOString(), bookId, bookTitle: bookById.get(bookId)?.title ?? 'Deleted book',
      kind: run.kind === 'samples' ? `Samples${run.round > 1 ? `, round ${run.round}` : ''}` : 'Full adaptation',
      tokensIn: mine.reduce((n, c) => n + c.inputTokens, 0), tokensOut: mine.reduce((n, c) => n + c.outputTokens, 0),
      images: mine.reduce((n, c) => n + c.images, 0),
      estimate: Number(run.estimateUsd) || null, actual: Number(run.spentUsd), running: run.status === 'running' || run.status === 'paused-cap',
    });
  }
  recent.sort((a, b) => b.date.localeCompare(a.date));
  const finished = recent.filter((r) => !r.running && r.estimate && r.actual > 0);
  const accuracy = finished.length ? finished.reduce((n, r) => n + Math.abs(r.actual - r.estimate!) / r.estimate!, 0) / finished.length : null;

  return {
    months,
    monthTotal,
    projected,
    monthRuns: new Set(monthCalls.map((c) => c.runId).filter(Boolean)).size,
    monthTokens: monthCalls.reduce((n, c) => n + c.inputTokens + c.outputTokens, 0),
    allTime: calls.reduce((n, c) => n + cost(c), 0),
    since: calls.length ? calls[calls.length - 1].createdAt.toISOString() : null,
    byBook: [...byBook.values()].map((b) => ({ id: b.id, title: b.title, cost: b.cost, runs: b.runs.size })).sort((a, b) => b.cost - a.cost),
    byKind: [...byKind.entries()].sort((a, b) => b[1] - a[1]),
    recent: recent.slice(0, 20),
    accuracy,
  };
}

export type Usage = Awaited<ReturnType<typeof getUsage>>;
