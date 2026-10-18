import { notFound, redirect } from 'next/navigation';
import { getEdition } from '@/lib/analysis';
import { getBook, listSections } from '@/lib/library';
import { getVersion, latestRun, listRunChapters } from '@/lib/runs';
import { requireAccount } from '@/lib/session';
import { clearNotice } from '../../../books/edition-actions';
import RunProgress from './RunProgress';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireAccount();
  const { id } = await params;
  const ed = await getEdition(userId, id);
  if (!ed) notFound();
  const book = await getBook(userId, ed.bookId);
  if (!book) notFound();
  const run = await latestRun(userId, ed.id, 'writing');
  if (!run) redirect(`/editions/${ed.id}/samples`);
  if (ed.notice && ed.notice !== 'samples-ready') await clearNotice(ed.id);

  const words = new Map((await listSections(userId, book.id)).map((s) => [s.id, s.words]));
  const total = run.sectionIds.reduce((n, sid) => n + (words.get(sid) ?? 0), 0);
  // Pace from chapters written in this run; approved samples carried over cost nothing here.
  const written = await listRunChapters(userId, run.id);
  const paid = written.filter((c) => Number(c.costUsd) > 0);
  const paidWords = paid.reduce((n, c) => n + c.originalWords, 0);
  const doneWords = written.reduce((n, c) => n + c.originalWords, 0);
  const rate = paidWords > 1000 ? paid.reduce((n, c) => n + Number(c.costUsd), 0) / paidWords : null;
  const estRate = Number(run.estimateUsd) / Math.max(1, total);
  const pace = rate ? { needMore: rate * Math.max(0, total - doneWords) * 1.1, vsEstimate: rate / estRate - 1 } : null;
  const version = run.status === 'ready' && ed.currentVersion ? await getVersion(userId, ed.id, ed.currentVersion) : null;

  return (
    <RunProgress
      book={{ id: book.id, title: book.title }}
      edition={{ id: ed.id, name: ed.name }}
      refine={run.kind === 'refine' ? run.refine : null}
      run={{
        id: run.id, status: run.status, stage: run.stage, error: run.error,
        done: run.chaptersDone, of: run.sectionIds.length,
        spent: Number(run.spentUsd), cap: Number(run.capUsd), estimate: Number(run.estimateUsd),
        totalWords: total, minutes: ed.estimate?.minutes ?? null,
      }}
      pace={pace}
      version={version && { number: version.number, name: version.name, description: version.description, cost: Number(version.costUsd) }}
    />
  );
}
