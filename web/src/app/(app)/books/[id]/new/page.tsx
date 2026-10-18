import { notFound, redirect } from 'next/navigation';
import type { HeatChapter } from '@/components/ContentHeatmap';
import type { CoverSpec } from '@/db/schema';
import { getModelChoices } from '@/lib/ai';
import { getEdition, getReadyAnalysis, listSectionAnalyses } from '@/lib/analysis';
import { editionSettingsSchema } from '@/lib/editions';
import { getBook, getSeries, listSections } from '@/lib/library';
import { requireAccount } from '@/lib/session';
import Wizard from './Wizard';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

const FALLBACK: CoverSpec = { from: '#4b2e83', to: '#2e1b55', emblem: 'feather', ink: '#F6E3AE' };

export default async function NewEditionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; edit?: string }> }) {
  const { userId } = await requireAccount();
  const { id } = await params;
  const { from, edit } = await searchParams;
  const book = await getBook(userId, id);
  if (!book) notFound();
  if (book.status !== 'ready') redirect(`/books/${book.id}/review`);

  const sourceId = edit ?? from;
  const [sections, ready, series, models, source] = await Promise.all([
    listSections(userId, book.id),
    getReadyAnalysis(userId, book.id),
    book.seriesId ? getSeries(userId, book.seriesId) : null,
    getModelChoices(userId),
    sourceId ? getEdition(userId, sourceId) : null,
  ]);
  const chapters = sections.filter((s) => s.include);
  const rows = ready ? await listSectionAnalyses(userId, ready.id) : [];
  const byId = new Map(rows.map((r) => [r.sectionId, r]));
  const heat: HeatChapter[] = chapters.flatMap((c, i) => {
    const r = byId.get(c.id);
    return r ? [{ number: i + 1, title: c.title, intensities: r.intensities, notes: r.notes }] : [];
  });

  const parsed = source && source.bookId === book.id ? editionSettingsSchema.safeParse(source.settings) : null;
  const start = parsed?.success ? { settings: parsed.data, name: source!.name, cap: Number(source!.costCap) } : null;
  // Only drafts can be changed in place; anything further along is copied into a new edition.
  const editing = edit && source?.status === 'draft' && start ? source.id : undefined;

  return (
    <Wizard
      // A fresh wizard for each starting point; otherwise state carries over between ?from= links.
      key={`${editing ? 'edit' : 'from'}:${start ? sourceId : 'new'}`}
      book={{
        id: book.id, title: book.title, words: book.words, chapters: chapters.length,
        cover: book.coverFallback ?? FALLBACK,
        coverUrl: book.coverPath ? `/api/books/${book.id}/cover?v=${encodeURIComponent(book.coverPath.split('/').pop() ?? '')}` : undefined,
      }}
      heat={heat}
      analysed={heat.length === chapters.length && heat.length > 0}
      seriesName={series?.name}
      models={models}
      start={start}
      editingId={editing}
    />
  );
}
