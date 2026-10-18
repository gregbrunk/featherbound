import { generateText, Output } from 'ai';
import { and, eq } from 'drizzle-orm';
import { FatalError } from 'workflow';
import { z } from 'zod';
import { getDb } from '@/db';
import { bookSections, books, type ImportSuggestions } from '@/db/schema';
import { NoKeyError, getTextModel, recordAiCall } from '@/lib/ai';
import { downloadImage, fallbackCover, findCovers } from '@/lib/covers';
import { GENRES } from '@/lib/genres';
import { parseBook } from '@/lib/import/parse';
import { getBook, listSeries } from '@/lib/library';
import { textCostUsd } from '@/lib/models';
import { paths, readBlob, writeContentAddressed, writeFile } from '@/lib/storage';

// Imports one uploaded book: parse → store chapters → find covers → suggest series & genres.
// Each step is durable and retried on transient errors; the review screen polls books.status.

export async function importBook(userId: string, bookId: string) {
  'use workflow';
  const parsed = await parseAndStore(userId, bookId);
  if (!parsed.ok) return parsed;
  const covers = await lookUpCovers(userId, bookId, parsed.title, parsed.author, parsed.isbn, parsed.hasCover);
  const suggestions = await suggestSeriesAndGenres(userId, bookId, parsed);
  await finish(userId, bookId, { ...suggestions, covers });
  return { ok: true as const };
}

type ParsedSummary = {
  ok: true;
  title: string;
  author: string;
  isbn?: string;
  hasCover: boolean;
  metaSeries?: { name: string; position?: number };
  subjects: string[];
  description?: string;
};

const FRIENDLY: Record<string, string> = {
  drm: 'This book is locked with DRM, so its pages can’t be opened. Featherbound only works with DRM-free files.',
  scanned: 'This PDF is made of scanned page images, so there’s no text to read yet. Scanned books will be supported later.',
  unsupported: 'Featherbound can’t read this kind of file yet. EPUB and PDF work today.',
  corrupt: 'This file looks damaged, so it couldn’t be opened.',
};

async function parseAndStore(userId: string, bookId: string): Promise<ParsedSummary | { ok: false; reason: string }> {
  'use step';
  const book = await getBook(userId, bookId);
  if (!book) throw new FatalError('Book not found');
  const bytes = await readBlob(book.sourcePath);
  const result = await parseBook(bytes, book.fileName);
  if (!result.ok) {
    await getDb()
      .update(books)
      .set({ status: 'failed', importError: `${result.reason}: ${FRIENDLY[result.reason] ?? result.detail}`, updatedAt: new Date() })
      .where(and(eq(books.userId, userId), eq(books.id, bookId)));
    return { ok: false, reason: result.reason };
  }
  const pb = result.book;

  // Images first, so chapter blocks can point at them.
  for (const img of pb.images) {
    await writeFile(paths.bookFile(userId, bookId, `images/${img.id}`), img.bytes, img.mediaType);
  }
  let coverPath: string | null = null;
  if (pb.cover) {
    coverPath = paths.bookFile(userId, bookId, 'cover');
    await writeFile(coverPath, pb.cover.bytes, pb.cover.mediaType);
  }

  // Re-imports replace earlier sections.
  await getDb().delete(bookSections).where(and(eq(bookSections.userId, userId), eq(bookSections.bookId, bookId)));
  const rows = [];
  for (const [position, s] of pb.sections.entries()) {
    const textPath = await writeContentAddressed(userId, { title: s.title, blocks: s.blocks });
    rows.push({ userId, bookId, position, title: s.title, kind: s.kind, include: s.include, words: s.words, textPath });
  }
  if (rows.length) await getDb().insert(bookSections).values(rows);

  const included = pb.sections.filter((s) => s.include);
  const title = pb.metadata.title || book.fileName.replace(/\.[a-z0-9]+$/i, '');
  const author = pb.metadata.authors.join(', ');
  await getDb()
    .update(books)
    .set({
      title,
      author,
      description: pb.metadata.description ?? null,
      language: pb.metadata.language ?? null,
      isbn: pb.metadata.isbn ?? null,
      format: pb.format,
      coverPath,
      coverFallback: fallbackCover(title),
      words: included.reduce((n, s) => n + s.words, 0),
      chapterCount: included.length,
      warnings: pb.warnings,
      updatedAt: new Date(),
    })
    .where(and(eq(books.userId, userId), eq(books.id, bookId)));

  return {
    ok: true,
    title,
    author,
    isbn: pb.metadata.isbn,
    hasCover: Boolean(pb.cover),
    metaSeries: pb.metadata.series,
    subjects: pb.metadata.subjects.slice(0, 12),
    description: pb.metadata.description?.slice(0, 1200),
  };
}

async function lookUpCovers(userId: string, bookId: string, title: string, author: string, isbn: string | undefined, hasCover: boolean) {
  'use step';
  const candidates = await findCovers(title, author, isbn);
  if (!hasCover) {
    for (const c of candidates) {
      const img = await downloadImage(c.url);
      if (img) {
        const coverPath = paths.bookFile(userId, bookId, 'cover');
        await writeFile(coverPath, img.bytes, img.contentType);
        await getDb().update(books).set({ coverPath }).where(and(eq(books.userId, userId), eq(books.id, bookId)));
        break;
      }
    }
  }
  return candidates;
}

const suggestionSchema = z.object({
  series: z
    .object({
      existingSeriesId: z.string().nullable().describe('ID of the matching series from the list, or null for a new series'),
      name: z.string(),
      position: z.number().nullable().describe('Book number within the series, if known'),
      reason: z.string().describe('One short sentence for the parent, e.g. "Same author, and the file says #3."'),
    })
    .nullable()
    .describe('null if this is a standalone book'),
  genres: z.array(z.string()).max(4),
});

async function suggestSeriesAndGenres(userId: string, bookId: string, p: ParsedSummary): Promise<Omit<ImportSuggestions, 'covers'>> {
  'use step';
  const existing = await listSeries(userId);
  const fromMeta = p.metaSeries
    ? { name: p.metaSeries.name, position: p.metaSeries.position, reason: 'The book file names this series.', seriesId: existing.find((s) => s.name.toLowerCase() === p.metaSeries!.name.toLowerCase())?.id }
    : undefined;

  let model;
  try {
    model = await getTextModel(userId);
  } catch (e) {
    if (e instanceof NoKeyError) return { series: fromMeta, genres: [] };
    throw e;
  }

  const t0 = Date.now();
  try {
    const res = await generateText({
      model: model.model,
      reasoning: 'low',
      output: Output.object({ schema: suggestionSchema }),
      prompt: `A parent is adding a book to their family's library. Suggest which series it belongs to (if any) and up to four genres.

Book: "${p.title}" by ${p.author || 'unknown author'}
${p.metaSeries ? `The file's metadata says series: "${p.metaSeries.name}"${p.metaSeries.position ? ` #${p.metaSeries.position}` : ''}.` : ''}
Subjects in the file: ${p.subjects.join(', ') || 'none'}
Description: ${p.description ?? 'none'}

Series already on their shelf (id: name — author):
${existing.map((s) => `${s.id}: ${s.name} — ${s.author ?? ''}`).join('\n') || '(none yet)'}

Rules: prefer matching an existing series by ID when it's clearly the same series. Use the book's well-known series and number if you know it. Pick genres from this list when they fit: ${GENRES.join(', ')}.`,
    });
    const u = res.usage;
    await recordAiCall({
      userId, kind: 'import-suggest', model: model.modelId, keySource: model.keySource,
      inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0,
      costUsd: textCostUsd(model.modelId, u.inputTokens ?? 0, u.outputTokens ?? 0), ms: Date.now() - t0,
    });
    const s = res.output.series;
    return {
      series: s
        ? { seriesId: existing.some((x) => x.id === s.existingSeriesId) ? s.existingSeriesId! : undefined, name: s.name, position: s.position ?? undefined, reason: s.reason }
        : fromMeta,
      genres: res.output.genres,
    };
  } catch (e) {
    await recordAiCall({ userId, kind: 'import-suggest', model: model.modelId, keySource: model.keySource, costUsd: 0, ms: Date.now() - t0, error: String(e).slice(0, 500) });
    return { series: fromMeta, genres: [] };
  }
}

async function finish(userId: string, bookId: string, suggestions: ImportSuggestions) {
  'use step';
  await getDb()
    .update(books)
    .set({ status: 'review', suggestions, genres: suggestions.genres ?? [], updatedAt: new Date() })
    .where(and(eq(books.userId, userId), eq(books.id, bookId)));
}
