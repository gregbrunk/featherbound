import { redirect } from 'next/navigation';
import { getAccountSettings } from '@/lib/account';
import { listAccountEditions, listNotices } from '@/lib/analysis';
import { bookTarget, getLibraryPrefs, listBooks, listProgress, listSectionsForBooks, listSeries } from '@/lib/library';
import { listRuns } from '@/lib/runs';
import { requireAccount } from '@/lib/session';
import LibraryView, { type LibraryBook, type ResumeItem, type WorkItem } from './LibraryView';
import Notices from './Notices';
import { budgetStatus } from '@/lib/usage';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export default async function LibraryPage() {
  const account = await requireAccount();
  const settings = await getAccountSettings(account.userId);
  if (!settings?.welcomedAt) redirect('/welcome');

  const [books, series, progress, prefs, notices, editions, runs, budget] = await Promise.all([
    listBooks(account.userId),
    listSeries(account.userId),
    listProgress(account.userId),
    getLibraryPrefs(account.userId),
    listNotices(account.userId),
    listAccountEditions(account.userId),
    listRuns(account.userId),
    budgetStatus(account.userId),
  ]);
  const titles = new Map(books.map((b) => [b.id, b.title]));
  const progressByTarget = new Map(progress.map((p) => [p.target, p]));
  const booksById = new Map(books.map((b) => [b.id, b]));
  const editionsById = new Map(editions.map((e) => [e.id, e]));

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

  // Keep reading: the newest unfinished originals and editions (progress is already newest first).
  type Unfinished = { p: (typeof progress)[number]; book: (typeof books)[number]; edition: (typeof editions)[number] | null };
  const unfinished = progress
    .filter((p) => p.percent < 100)
    .flatMap((p): Unfinished[] => {
      const [kind, id] = p.target.split(':');
      if (kind === 'book') {
        const b = booksById.get(id);
        return b?.status === 'ready' ? [{ p, book: b, edition: null }] : [];
      }
      const e = editionsById.get(id);
      const b = e && booksById.get(e.bookId);
      return e && b ? [{ p, book: b, edition: e }] : [];
    })
    .slice(0, 4);

  const sections = await listSectionsForBooks(account.userId, [...new Set(unfinished.map((u) => u.book.id))]);
  const resume: ResumeItem[] = unfinished.map(({ p, book, edition }) => {
    const chapters = sections.filter((s) => s.bookId === book.id && s.kind === 'chapter' && s.include);
    const here = sections.find((s) => s.id === p.sectionId);
    const n = chapters.findIndex((s) => s.id === p.sectionId);
    return {
      key: p.target,
      bookId: book.id,
      href: edition ? `/read/edition/${edition.id}` : `/read/book/${book.id}`,
      edition: edition?.name ?? 'Original',
      percent: p.percent,
      chapter: here ? { title: here.title, number: n >= 0 ? n + 1 : null, total: chapters.length } : null,
      lastRead: lastReadLabel(p.updatedAt),
    };
  });

  // Adaptations being written now: the newest run of each edition, if it hasn't finished.
  const seen = new Set<string>();
  const working: WorkItem[] = runs.flatMap((r) => {
    if (seen.has(r.editionId)) return [];
    seen.add(r.editionId);
    const e = editionsById.get(r.editionId);
    if (!e || (r.status !== 'running' && r.status !== 'paused-cap')) return [];
    return [{
      key: r.id,
      bookId: e.bookId,
      href: r.kind === 'samples' ? `/editions/${e.id}/samples` : `/editions/${e.id}/progress`,
      edition: e.name,
      kind: r.kind,
      done: r.chaptersDone,
      total: r.sectionIds.length,
      paused: r.status === 'paused-cap',
    }];
  });

  return (
    <LibraryView
      books={view}
      series={series.map((s) => ({ id: s.id, name: s.name, author: s.author }))}
      resume={resume}
      working={working}
      initialPrefs={prefs}
      notices={<Notices budget={budget} items={notices.flatMap((n) => (n.notice ? [{ id: n.id, name: n.name, notice: n.notice, bookTitle: titles.get(n.bookId) ?? 'your book' }] : []))} />}
    />
  );
}

// Worked out on the server so the label can't differ between server and browser render.
function lastReadLabel(at: Date) {
  const h = (Date.now() - at.getTime()) / 3_600_000;
  if (h < 1) return 'Read just now';
  if (h < 20) return 'Read today';
  if (h < 44) return 'Read yesterday';
  const days = Math.round(h / 24);
  if (days < 14) return `Read ${days} days ago`;
  return `Read ${at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
