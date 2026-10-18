import { notFound, redirect } from 'next/navigation';
import { bookTarget, getBook, getProgress, getSeries, listBookmarks, listSections } from '@/lib/library';
import { requireAccount } from '@/lib/session';
import Reader from './Reader';

// Reads the session on every request.
export const instant = false;

export default async function ReadBookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string }> }) {
  const { userId } = await requireAccount();
  const [{ id }, { section }] = await Promise.all([params, searchParams]);
  const book = await getBook(userId, id);
  if (!book) notFound();
  if (book.status !== 'ready') redirect(`/books/${book.id}/review`);

  const target = bookTarget(book.id);
  const [sections, progress, marks, series] = await Promise.all([
    listSections(userId, book.id),
    getProgress(userId, target),
    listBookmarks(userId, target),
    book.seriesId ? getSeries(userId, book.seriesId) : null,
  ]);
  const chapters = sections.filter((s) => s.include).map((s) => ({ id: s.id, title: s.title }));
  if (!chapters.length) redirect(`/books/${book.id}`);
  const start = section && chapters.some((c) => c.id === section)
    ? { sectionId: section, fraction: 0 }
    : progress && chapters.some((c) => c.id === progress.sectionId)
      ? { sectionId: progress.sectionId, fraction: progress.fraction }
      : { sectionId: chapters[0].id, fraction: 0 };

  return (
    <Reader
      bookId={book.id}
      title={book.title}
      subtitle={`Original${series ? ` · ${series.name}` : ''}`}
      backHref={`/books/${book.id}`}
      target={target}
      sections={chapters}
      start={start}
      bookmarks={marks.map((m) => ({ id: m.id, sectionId: m.sectionId, fraction: m.fraction, label: m.label }))}
    />
  );
}
