import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { bookAnalyses, editions, sectionAnalyses, storyBibles } from '@/db/schema';
import type { Block } from './import/types';

// Account-scoped reads for the Content Report, the Story Bible and editions.

export type AnalysisRow = typeof bookAnalyses.$inferSelect;
export type SectionAnalysisRow = typeof sectionAnalyses.$inferSelect;
export type EditionRow = typeof editions.$inferSelect;

export async function getLatestAnalysis(userId: string, bookId: string) {
  const [row] = await getDb()
    .select()
    .from(bookAnalyses)
    .where(and(eq(bookAnalyses.userId, userId), eq(bookAnalyses.bookId, bookId)))
    .orderBy(desc(bookAnalyses.startedAt))
    .limit(1);
  return row ?? null;
}

/** The newest finished analysis, which is what the book page shows while a new one runs. */
export async function getReadyAnalysis(userId: string, bookId: string) {
  const [row] = await getDb()
    .select()
    .from(bookAnalyses)
    .where(and(eq(bookAnalyses.userId, userId), eq(bookAnalyses.bookId, bookId), eq(bookAnalyses.status, 'ready')))
    .orderBy(desc(bookAnalyses.startedAt))
    .limit(1);
  return row ?? null;
}

export async function listSectionAnalyses(userId: string, analysisId: string) {
  return getDb()
    .select()
    .from(sectionAnalyses)
    .where(and(eq(sectionAnalyses.userId, userId), eq(sectionAnalyses.analysisId, analysisId)))
    .orderBy(asc(sectionAnalyses.position));
}

export async function getStoryBible(userId: string, bookId: string) {
  const [row] = await getDb()
    .select()
    .from(storyBibles)
    .where(and(eq(storyBibles.userId, userId), eq(storyBibles.bookId, bookId)))
    .limit(1);
  return row ?? null;
}

export async function listEditions(userId: string, bookId: string) {
  return getDb()
    .select()
    .from(editions)
    .where(and(eq(editions.userId, userId), eq(editions.bookId, bookId)))
    .orderBy(desc(editions.createdAt));
}

export async function getEdition(userId: string, editionId: string) {
  const [row] = await getDb().select().from(editions).where(and(eq(editions.userId, userId), eq(editions.id, editionId))).limit(1);
  return row ?? null;
}

/** Chapter blocks as plain paragraphs, for prompts. */
export function blocksToText(blocks: Block[]) {
  return blocks
    .map((b) => {
      if (b.type === 'hr') return '* * *';
      if (b.type === 'img') return b.alt ? `[Picture: ${b.alt}]` : '';
      return b.html.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, '’');
    })
    .filter(Boolean)
    .join('\n\n');
}
