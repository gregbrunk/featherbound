import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { accountSettings, bookSections, bookmarks, books, readingProgress, series } from '@/db/schema';

// Account-scoped data access for the library. Every query filters by userId, so no screen or
// route can read another account's books even with a guessed ID.

export type BookRow = typeof books.$inferSelect;
export type SeriesRow = typeof series.$inferSelect;
export type SectionRow = typeof bookSections.$inferSelect;

export async function listBooks(userId: string) {
  return getDb().select().from(books).where(eq(books.userId, userId)).orderBy(desc(books.addedAt));
}

export async function listSeries(userId: string) {
  return getDb().select().from(series).where(eq(series.userId, userId)).orderBy(asc(series.name));
}

export async function getBook(userId: string, bookId: string) {
  if (!isUuid(bookId)) return null;
  const [row] = await getDb().select().from(books).where(and(eq(books.userId, userId), eq(books.id, bookId))).limit(1);
  return row ?? null;
}

export async function getSeries(userId: string, seriesId: string) {
  if (!isUuid(seriesId)) return null;
  const [row] = await getDb().select().from(series).where(and(eq(series.userId, userId), eq(series.id, seriesId))).limit(1);
  return row ?? null;
}

export async function listSections(userId: string, bookId: string) {
  return getDb()
    .select()
    .from(bookSections)
    .where(and(eq(bookSections.userId, userId), eq(bookSections.bookId, bookId)))
    .orderBy(asc(bookSections.position));
}

/** Every section of the given books, in reading order. */
export async function listSectionsForBooks(userId: string, bookIds: string[]) {
  if (!bookIds.length) return [];
  return getDb()
    .select({ id: bookSections.id, bookId: bookSections.bookId, title: bookSections.title, kind: bookSections.kind, include: bookSections.include })
    .from(bookSections)
    .where(and(eq(bookSections.userId, userId), inArray(bookSections.bookId, bookIds)))
    .orderBy(asc(bookSections.position));
}

export async function getSection(userId: string, bookId: string, sectionId: string) {
  if (!isUuid(sectionId)) return null;
  const [row] = await getDb()
    .select()
    .from(bookSections)
    .where(and(eq(bookSections.userId, userId), eq(bookSections.bookId, bookId), eq(bookSections.id, sectionId)))
    .limit(1);
  return row ?? null;
}

export async function updateBook(userId: string, bookId: string, patch: Partial<typeof books.$inferInsert>) {
  await getDb().update(books).set({ ...patch, updatedAt: new Date() }).where(and(eq(books.userId, userId), eq(books.id, bookId)));
}

export async function createSeries(userId: string, name: string, author?: string) {
  const [row] = await getDb().insert(series).values({ userId, name, author }).returning();
  return row;
}

/** Remove series that no longer hold any books. */
export async function pruneEmptySeries(userId: string) {
  const all = await listSeries(userId);
  const used = new Set((await listBooks(userId)).map((b) => b.seriesId).filter(Boolean));
  const empty = all.filter((s) => !used.has(s.id)).map((s) => s.id);
  if (empty.length) await getDb().delete(series).where(and(eq(series.userId, userId), inArray(series.id, empty)));
}

export const bookTarget = (bookId: string) => `book:${bookId}`;

export async function getProgress(userId: string, target: string) {
  const [row] = await getDb().select().from(readingProgress).where(and(eq(readingProgress.userId, userId), eq(readingProgress.target, target))).limit(1);
  return row ?? null;
}

export async function listProgress(userId: string) {
  return getDb().select().from(readingProgress).where(eq(readingProgress.userId, userId)).orderBy(desc(readingProgress.updatedAt));
}

export async function listBookmarks(userId: string, target: string) {
  return getDb().select().from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.target, target))).orderBy(asc(bookmarks.createdAt));
}

export async function getLibraryPrefs(userId: string) {
  const [row] = await getDb().select({ prefs: accountSettings.libraryPrefs }).from(accountSettings).where(eq(accountSettings.userId, userId)).limit(1);
  return (row?.prefs ?? null) as Record<string, unknown> | null;
}

export function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
