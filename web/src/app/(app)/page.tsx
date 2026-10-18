import { redirect } from 'next/navigation';
import { getAccountSettings } from '@/lib/account';
import { listNotices } from '@/lib/analysis';
import { bookTarget, getLibraryPrefs, listBooks, listProgress, listSeries } from '@/lib/library';
import { requireAccount } from '@/lib/session';
import LibraryView, { type LibraryBook } from './LibraryView';
import Notices from './Notices';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export default async function LibraryPage() {
  const account = await requireAccount();
  const settings = await getAccountSettings(account.userId);
  if (!settings?.welcomedAt) redirect('/welcome');

  const [books, series, progress, prefs, notices] = await Promise.all([
    listBooks(account.userId),
    listSeries(account.userId),
    listProgress(account.userId),
    getLibraryPrefs(account.userId),
    listNotices(account.userId),
  ]);
  const titles = new Map(books.map((b) => [b.id, b.title]));
  const progressByTarget = new Map(progress.map((p) => [p.target, p]));

  const view: LibraryBook[] = books.map((b) => {
    const p = progressByTarget.get(bookTarget(b.id));
    return {
      id: b.id,
      title: b.title,
      author: b.author,
      status: b.status,
      seriesId: b.seriesId,
      seriesOrder: b.seriesOrder,
      seriesLabel: b.seriesLabel,
      genres: b.genres,
      coverUrl: b.coverPath ? `/api/books/${b.id}/cover?v=${encodeURIComponent(b.coverPath.split('/').pop() ?? '')}` : null,
      coverFallback: b.coverFallback,
      addedAt: b.addedAt.toISOString(),
      lastReadAt: p?.updatedAt.toISOString() ?? null,
      percent: p?.percent ?? null,
    };
  });

  return (
    <LibraryView
      books={view}
      series={series.map((s) => ({ id: s.id, name: s.name, author: s.author }))}
      initialPrefs={prefs}
      notices={<Notices items={notices.flatMap((n) => (n.notice ? [{ id: n.id, name: n.name, notice: n.notice, bookTitle: titles.get(n.bookId) ?? 'your book' }] : []))} />}
    />
  );
}
