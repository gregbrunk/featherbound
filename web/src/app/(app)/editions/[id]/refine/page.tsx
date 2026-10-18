import { notFound, redirect } from 'next/navigation';
import { getModelChoices } from '@/lib/ai';
import { getEdition } from '@/lib/analysis';
import { defaultCap, estimateRefine, PASSAGE_WORDS } from '@/lib/estimate';
import { getBook, listSections } from '@/lib/library';
import { getVersion, listVersionChapters, listVersions } from '@/lib/runs';
import { requireAccount } from '@/lib/session';
import Refine from './Refine';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export default async function RefinePage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireAccount();
  const { id } = await params;
  const ed = await getEdition(userId, id);
  if (!ed) notFound();
  if (!ed.currentVersion) redirect(`/books/${ed.bookId}?tab=editions`);
  const [book, version, versions, sections, models] = await Promise.all([
    getBook(userId, ed.bookId), getVersion(userId, ed.id, ed.currentVersion), listVersions(userId, ed.id), listSections(userId, ed.bookId), getModelChoices(userId),
  ]);
  if (!book || !version) notFound();
  const chapters = await listVersionChapters(userId, version.manifest);
  const words = new Map(sections.map((s) => [s.id, s.words]));
  const size = { words: book.words, chapters: book.chapterCount };

  // Prices for every choice the screen offers, worked out here so the client needs no model catalog.
  const list = version.manifest.map((m, i) => {
    const c = chapters.find((x) => x.id === m.chapterId);
    const w = words.get(m.sectionId) ?? c?.originalWords ?? 0;
    return { sectionId: m.sectionId, number: i + 1, title: c?.kidTitle ?? c?.title ?? `Chapter ${i + 1}`, words: w, cost: estimateRefine(size, w, 1, models).cost };
  });
  const whole = estimateRefine(size, list.reduce((n, c) => n + c.words, 0), list.length, models);
  const passage = estimateRefine(size, PASSAGE_WORDS, 1, models);

  return (
    <Refine
      book={{ id: book.id, title: book.title }}
      edition={{ id: ed.id, name: ed.name, version: version.number, versionName: version.name, existing: versions.map((v) => v.number) }}
      chapters={list}
      prices={{ whole: whole.cost, wholeMinutes: whole.minutes, passage: passage.cost, perChapterOverhead: 0.02 }}
      capFor={{ whole: defaultCap(whole.cost * 1.3), passage: defaultCap(passage.cost * 1.5) }}
    />
  );
}
