import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { editionChapters, editionRuns, editionVersions } from '@/db/schema';

// Account-scoped reads for adaptation runs, adapted chapters and versions.

export type RunRow = typeof editionRuns.$inferSelect;
export type EditionChapterRow = typeof editionChapters.$inferSelect;
export type VersionRow = typeof editionVersions.$inferSelect;

export async function getRun(userId: string, runId: string) {
  const [row] = await getDb().select().from(editionRuns).where(and(eq(editionRuns.userId, userId), eq(editionRuns.id, runId))).limit(1);
  return row ?? null;
}

export async function latestRun(userId: string, editionId: string, kind?: 'samples' | 'full') {
  const [row] = await getDb()
    .select()
    .from(editionRuns)
    .where(and(eq(editionRuns.userId, userId), eq(editionRuns.editionId, editionId), ...(kind ? [eq(editionRuns.kind, kind)] : [])))
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
