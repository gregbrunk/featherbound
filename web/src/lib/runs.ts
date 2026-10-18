import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { getDb } from '@/db';
import { characterSheets, editionChapters, editionRuns, editionVersions } from '@/db/schema';

// Account-scoped reads for adaptation runs, adapted chapters and versions.

export type RunRow = typeof editionRuns.$inferSelect;
export type EditionChapterRow = typeof editionChapters.$inferSelect;
export type VersionRow = typeof editionVersions.$inferSelect;

export async function getRun(userId: string, runId: string) {
  const [row] = await getDb().select().from(editionRuns).where(and(eq(editionRuns.userId, userId), eq(editionRuns.id, runId))).limit(1);
  return row ?? null;
}

/** Newest run of an edition; 'writing' means a full run or a refinement (anything but samples). */
export async function latestRun(userId: string, editionId: string, kind?: 'samples' | 'full' | 'refine' | 'writing') {
  const filter = !kind ? [] : kind === 'writing' ? [ne(editionRuns.kind, 'samples')] : [eq(editionRuns.kind, kind)];
  const [row] = await getDb()
    .select()
    .from(editionRuns)
    .where(and(eq(editionRuns.userId, userId), eq(editionRuns.editionId, editionId), ...filter))
    .orderBy(desc(editionRuns.startedAt))
    .limit(1);
  return row ?? null;
}

export async function listRuns(userId: string) {
  return getDb().select().from(editionRuns).where(eq(editionRuns.userId, userId)).orderBy(desc(editionRuns.startedAt));
}

export async function listRunChapters(userId: string, runId: string) {
  return getDb()
    .select()
    .from(editionChapters)
    .where(and(eq(editionChapters.userId, userId), eq(editionChapters.runId, runId)))
    .orderBy(asc(editionChapters.position));
}

/** The chapters a version's manifest points at, in manifest order. */
export async function listVersionChapters(userId: string, manifest: { sectionId: string; chapterId: string }[]) {
  if (!manifest.length) return [];
  const rows = await getDb()
    .select()
    .from(editionChapters)
    .where(and(eq(editionChapters.userId, userId), inArray(editionChapters.id, manifest.map((m) => m.chapterId))));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return manifest.flatMap((m) => byId.get(m.chapterId) ?? []);
}

export async function getEditionChapter(userId: string, chapterId: string) {
  const [row] = await getDb().select().from(editionChapters).where(and(eq(editionChapters.userId, userId), eq(editionChapters.id, chapterId))).limit(1);
  return row ?? null;
}

export async function listVersions(userId: string, editionId: string) {
  return getDb()
    .select()
    .from(editionVersions)
    .where(and(eq(editionVersions.userId, userId), eq(editionVersions.editionId, editionId)))
    .orderBy(desc(editionVersions.createdAt));
}

export async function getVersion(userId: string, editionId: string, number: string) {
  const [row] = await getDb()
    .select()
    .from(editionVersions)
    .where(and(eq(editionVersions.userId, userId), eq(editionVersions.editionId, editionId), eq(editionVersions.number, number)))
    .limit(1);
  return row ?? null;
}

export const editionTarget = (editionId: string) => `edition:${editionId}`;

export type SheetRow = typeof characterSheets.$inferSelect;

export async function listSheets(userId: string, editionId: string) {
  return getDb()
    .select()
    .from(characterSheets)
    .where(and(eq(characterSheets.userId, userId), eq(characterSheets.editionId, editionId)))
    .orderBy(asc(characterSheets.position));
}

export async function getSheet(userId: string, sheetId: string) {
  const [row] = await getDb().select().from(characterSheets).where(and(eq(characterSheets.userId, userId), eq(characterSheets.id, sheetId))).limit(1);
  return row ?? null;
}
