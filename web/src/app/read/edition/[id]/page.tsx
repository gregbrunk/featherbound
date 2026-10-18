import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { HANDOFF_COOKIE, decodeLock } from '@/lib/handoff';
import { getEdition } from '@/lib/analysis';
import { getBook, getProgress, listBookmarks } from '@/lib/library';
import { editionTarget, getVersion, listVersionChapters } from '@/lib/runs';
import { requireAccount } from '@/lib/session';
import { clearNotice } from '../../../(app)/books/edition-actions';
import Reader from '../../book/[id]/Reader';

// Reads the session on every request.
export const instant = false;

export default async function ReadEditionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string; v?: string }> }) {
  const { userId } = await requireAccount();
  const [{ id }, { section, v }] = await Promise.all([params, searchParams]);
  const ed = await getEdition(userId, id);
  if (!ed) notFound();
  const number = v ?? ed.currentVersion;
  if (!number) redirect(`/books/${ed.bookId}?tab=editions`);
  const [book, version] = await Promise.all([getBook(userId, ed.bookId), getVersion(userId, ed.id, number)]);
  if (!book || !version) notFound();
  if (ed.notice === 'ready') await clearNotice(ed.id);

  // A refined version mixes chapters from several runs, so look them up by the manifest.
  const written = await listVersionChapters(userId, version.manifest);
  const byId = new Map(written.map((c) => [c.id, c]));
  const chapters = version.manifest.map((m) => {
    const c = byId.get(m.chapterId);
    return { id: m.sectionId, title: c?.kidTitle ?? c?.title ?? 'Chapter', subtitle: c?.kidTitle ? c.title : undefined };
  });
  if (!chapters.length) redirect(`/books/${book.id}?tab=editions`);

  const target = editionTarget(ed.id);
  const [progress, marks] = await Promise.all([getProgress(userId, target), listBookmarks(userId, target)]);
  const start = section && chapters.some((c) => c.id === section)
    ? { sectionId: section, fraction: 0 }
    : progress && chapters.some((c) => c.id === progress.sectionId)
      ? { sectionId: progress.sectionId, fraction: progress.fraction }
      : { sectionId: chapters[0].id, fraction: 0 };

  const lock = decodeLock((await cookies()).get(HANDOFF_COOKIE)?.value);
  return (
    <Reader
      handoff={{ editionId: ed.id, locked: lock?.editionId === ed.id }}
      compareBase={`/api/books/${book.id}/sections`}
      bookId={book.id}
      textBase={`/api/editions/${ed.id}/sections`}
      textQuery={`?v=${encodeURIComponent(version.number)}`}
      title={book.title}
      subtitle={`${ed.name} · v${version.number}`}
      backHref={`/books/${book.id}`}
      target={target}
      sections={chapters}
      start={start}
      bookmarks={marks.map((m) => ({ id: m.id, sectionId: m.sectionId, fraction: m.fraction, label: m.label }))}
    />
  );
}
