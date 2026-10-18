'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { start } from 'workflow/api';
import { getDb } from '@/db';
import { accountSettings, bookSections, bookmarks, books, readingProgress } from '@/db/schema';
import { downloadImage } from '@/lib/covers';
import { bookTarget, createSeries, getBook, getSeries, listSections, pruneEmptySeries, updateBook } from '@/lib/library';
import { requireAccount } from '@/lib/session';
import { deletePaths, ownsPath, paths, writeFile } from '@/lib/storage';
import { importBook } from '@/workflows/import-book';

export async function startImport(input: { pathname: string; fileName: string; size: number }) {
  const { userId } = await requireAccount();
  if (!ownsPath(userId, input.pathname)) throw new Error('Not your file');
  const [book] = await getDb()
    .insert(books)
    .values({ userId, title: input.fileName.replace(/\.[a-z0-9]+$/i, ''), fileName: input.fileName, sourcePath: input.pathname, sourceSize: input.size })
    .returning({ id: books.id });
  const run = await start(importBook, [userId, book.id]);
  await updateBook(userId, book.id, { workflowRunId: run.runId });
  return { bookId: book.id };
}

export async function retryImport(bookId: string) {
  const { userId } = await requireAccount();
  const book = await getBook(userId, bookId);
  if (!book) return;
  await updateBook(userId, bookId, { status: 'importing', importError: null });
  const run = await start(importBook, [userId, bookId]);
  await updateBook(userId, bookId, { workflowRunId: run.runId });
  revalidatePath(`/books/${bookId}/review`);
}

/** Read the original file again (e.g. after the importer improves) and review the result. */
export async function reimportBook(bookId: string) {
  await retryImport(bookId);
  redirect(`/books/${bookId}/review`);
}

export type ReviewInput = {
  title: string;
  author: string;
  description: string;
  genres: string[];
  series: { mode: 'none' } | { mode: 'existing'; seriesId: string; position: string } | { mode: 'new'; name: string; position: string };
  coverUrl: string | null;
  sections: { id: string; title: string; include: boolean; mergeWithNext: boolean }[];
};

/** Save the import review: metadata, series, cover choice and chapter edits. */
export async function saveReview(bookId: string, input: ReviewInput) {
  const { userId } = await requireAccount();
  const book = await getBook(userId, bookId);
  if (!book) throw new Error('Book not found');

  let seriesId: string | null = null;
  let seriesOrder: number | null = null;
  let seriesLabel: string | null = null;
  if (input.series.mode !== 'none') {
    const pos = parseFloat(input.series.position);
    seriesOrder = Number.isFinite(pos) ? pos : null;
    seriesLabel = seriesOrder !== null ? `Book ${input.series.position.trim()}` : null;
    if (input.series.mode === 'existing') {
      const s = await getSeries(userId, input.series.seriesId);
      seriesId = s?.id ?? null;
    } else if (input.series.name.trim()) {
      seriesId = (await createSeries(userId, input.series.name.trim(), input.author.trim() || undefined)).id;
    }
  }

  // Cover: a chosen catalog image replaces the current one.
  let coverPath = book.coverPath;
  if (input.coverUrl && /^https:\/\/covers\.openlibrary\.org\//.test(input.coverUrl)) {
    const img = await downloadImage(input.coverUrl);
    if (img) {
      coverPath = paths.bookFile(userId, bookId, `cover-${Date.now()}`);
      await writeFile(coverPath, img.bytes, img.contentType);
    }
  }

  // Chapters: rename, include/exclude, and merge a section into the one after it.
  const existing = await listSections(userId, bookId);
  const byId = new Map(existing.map((s) => [s.id, s]));
  const { readJson, writeContentAddressed } = await import('@/lib/storage');
  type Stored = { title: string; blocks: unknown[] };
  const merged: { id: string; title: string; include: boolean; blocks: unknown[] | null; words: number }[] = [];
  let carry: { blocks: unknown[]; words: number } | null = null;
  for (const s of input.sections) {
    const row = byId.get(s.id);
    if (!row) continue;
    let blocks: unknown[] | null = null;
    let words = row.words;
    if (carry) {
      const own = await readJson<Stored>(row.textPath);
      blocks = [...carry.blocks, ...own.blocks];
      words += carry.words;
      carry = null;
    }
    if (s.mergeWithNext) {
      const own: { blocks: unknown[] } = blocks ? { blocks } : await readJson<Stored>(row.textPath);
      carry = { blocks: own.blocks, words };
      continue;
    }
    merged.push({ id: row.id, title: s.title.trim() || row.title, include: s.include, blocks, words });
  }
  const keep = new Set(merged.map((m) => m.id));
  const removed = existing.filter((s) => !keep.has(s.id)).map((s) => s.id);
  for (const [position, m] of merged.entries()) {
    const patch: Partial<typeof bookSections.$inferInsert> = { position, title: m.title, include: m.include, words: m.words };
    if (m.blocks) patch.textPath = await writeContentAddressed(userId, { title: m.title, blocks: m.blocks });
    await getDb().update(bookSections).set(patch).where(and(eq(bookSections.userId, userId), eq(bookSections.id, m.id)));
  }
  if (removed.length) await getDb().delete(bookSections).where(and(eq(bookSections.userId, userId), inArray(bookSections.id, removed)));

  const included = merged.filter((m) => m.include);
  await updateBook(userId, bookId, {
    title: input.title.trim() || book.title,
    author: input.author.trim(),
    description: input.description.trim() || null,
    genres: input.genres,
    seriesId,
    seriesOrder,
    seriesLabel,
    coverPath,
    chapterCount: included.length,
    words: included.reduce((n, m) => n + m.words, 0),
    status: 'ready',
  });
  await pruneEmptySeries(userId);
  revalidatePath('/');
  redirect(`/books/${bookId}`);
}

export type DetailsInput = { title: string; author: string; description: string; genres: string[]; tags: string[]; seriesId: string | null; seriesPosition: string };

export async function saveDetails(bookId: string, input: DetailsInput) {
  const { userId } = await requireAccount();
  const book = await getBook(userId, bookId);
  if (!book) return { ok: false, message: 'Book not found.' };
  const s = input.seriesId ? await getSeries(userId, input.seriesId) : null;
  const pos = parseFloat(input.seriesPosition);
  await updateBook(userId, bookId, {
    title: input.title.trim() || book.title,
    author: input.author.trim(),
    description: input.description.trim() || null,
    genres: input.genres,
    tags: input.tags,
    seriesId: s?.id ?? null,
    seriesOrder: s && Number.isFinite(pos) ? pos : null,
    seriesLabel: s && Number.isFinite(pos) ? `Book ${input.seriesPosition.trim()}` : null,
  });
  await pruneEmptySeries(userId);
  revalidatePath(`/books/${bookId}`);
  revalidatePath('/');
  return { ok: true, message: 'Saved.' };
}

export async function deleteBook(bookId: string) {
  const { userId } = await requireAccount();
  const book = await getBook(userId, bookId);
  if (!book) return;
  await getDb().delete(books).where(and(eq(books.userId, userId), eq(books.id, bookId)));
  // Shared chapter text (content-addressed) is left for a later cleanup job; book files go now.
  const { list } = await import('@vercel/blob');
  const files = await list({ prefix: paths.bookFile(userId, bookId, '') });
  await deletePaths([book.sourcePath, ...files.blobs.map((b) => b.pathname)]);
  await getDb().delete(readingProgress).where(and(eq(readingProgress.userId, userId), eq(readingProgress.target, bookTarget(bookId))));
  await getDb().delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.target, bookTarget(bookId))));
  await pruneEmptySeries(userId);
  revalidatePath('/');
  redirect('/');
}

export async function saveLibraryPrefs(prefs: Record<string, unknown>) {
  const { userId } = await requireAccount();
  await getDb()
    .insert(accountSettings)
    .values({ userId, libraryPrefs: prefs })
    .onConflictDoUpdate({ target: accountSettings.userId, set: { libraryPrefs: prefs, updatedAt: new Date() } });
}

export async function saveProgress(target: string, sectionId: string, fraction: number, percent: number) {
  const { userId } = await requireAccount();
  const values = { userId, target, sectionId, fraction: clamp(fraction), percent: Math.max(0, Math.min(100, percent)), updatedAt: new Date() };
  await getDb()
    .insert(readingProgress)
    .values(values)
    .onConflictDoUpdate({ target: [readingProgress.userId, readingProgress.target], set: values });
}

export async function addBookmark(target: string, sectionId: string, fraction: number, label: string) {
  const { userId } = await requireAccount();
  const [row] = await getDb().insert(bookmarks).values({ userId, target, sectionId, fraction: clamp(fraction), label: label.slice(0, 140) }).returning();
  return row;
}

export async function removeBookmark(id: string) {
  const { userId } = await requireAccount();
  await getDb().delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.id, id)));
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
