import { generateText, Output } from 'ai';
import { and, asc, eq, sql } from 'drizzle-orm';
import { FatalError } from 'workflow';
import { z } from 'zod';
import { getDb } from '@/db';
import { bookAnalyses, bookSections, sectionAnalyses, storyBibles, type Intensities, type StoryBible } from '@/db/schema';
import { NoKeyError, getTextModel, recordAiCall } from '@/lib/ai';
import { blocksToText, listSectionAnalyses } from '@/lib/analysis';
import { FILTER_CATEGORIES } from '@/lib/editions';
import type { Block } from '@/lib/import/types';
import { getBook } from '@/lib/library';
import { textCostUsd } from '@/lib/models';
import { readJson } from '@/lib/storage';

// Reads a whole book once: each chapter is rated for the nine content categories and
// summarised, then one pass over those summaries writes the Story Bible. Chapters run
// in small parallel batches; progress lives on book_analyses so the book page can poll it.

const BATCH = 5;

export async function analyzeBook(userId: string, bookId: string, analysisId: string) {
  'use workflow';
  try {
    const chapters = await listChapters(userId, bookId, analysisId);
    for (let i = 0; i < chapters.length; i += BATCH) {
      await Promise.all(chapters.slice(i, i + BATCH).map((c) => analyzeChapter(userId, bookId, analysisId, c)));
    }
    await writeStoryBible(userId, bookId, analysisId);
    await finish(analysisId, null);
    return { ok: true as const };
  } catch (e) {
    await finish(analysisId, e instanceof Error ? e.message : String(e));
    return { ok: false as const };
  }
}

type ChapterRef = { sectionId: string; position: number; number: number; title: string; textPath: string };

async function listChapters(userId: string, bookId: string, analysisId: string): Promise<ChapterRef[]> {
  'use step';
  const rows = await getDb()
    .select()
    .from(bookSections)
    .where(and(eq(bookSections.userId, userId), eq(bookSections.bookId, bookId), eq(bookSections.include, true)))
    .orderBy(asc(bookSections.position));
  await getDb().update(bookAnalyses).set({ chaptersTotal: rows.length }).where(eq(bookAnalyses.id, analysisId));
  return rows.map((r, i) => ({ sectionId: r.id, position: r.position, number: i + 1, title: r.title, textPath: r.textPath }));
}

const level = z.number().int().min(0).max(3);
const chapterSchema = z.object({
  intensities: z.object(Object.fromEntries(FILTER_CATEGORIES.map((c) => [c, level])) as Record<(typeof FILTER_CATEGORIES)[number], typeof level>),
  notes: z
    .array(z.object({ category: z.enum(FILTER_CATEGORIES), note: z.string() }))
    .describe('One short note for each category rated 1 or higher. Say what happens, plainly and without graphic detail.'),
  summary: z.string().describe('Two or three sentences on what happens in this chapter.'),
  characters: z
    .array(z.object({ name: z.string(), look: z.string().describe('Physical details this chapter states about them, or an empty string') }))
    .describe('Named characters who appear or speak in this chapter'),
  places: z.array(z.object({ name: z.string(), look: z.string().describe('What this chapter says the place looks like, or an empty string') })),
});

async function analyzeChapter(userId: string, bookId: string, analysisId: string, c: ChapterRef) {
  'use step';
  const book = await getBook(userId, bookId);
  if (!book) throw new FatalError('Book not found');
  const { blocks } = await readJson<{ title: string; blocks: Block[] }>(c.textPath);
  const text = blocksToText(blocks);
  const model = await textModelOrStop(userId);

  const t0 = Date.now();
  let res;
  try {
    res = await generateText({
      model: model.model,
      reasoning: 'low',
      output: Output.object({ schema: chapterSchema }),
      prompt: `A parent wants to know what's in a book before making a gentler edition for their child. Read chapter ${c.number} ("${c.title}") of "${book.title}" by ${book.author || 'an unknown author'} and report on it.

Rate each category from 0 to 3:
0 = none, 1 = mild or brief, 2 = moderate or on-page, 3 = strong, graphic or central to the chapter.

Categories:
- language: profanity, slurs, crude insults
- violence: battles, injury detail, blood, cruelty
- scariness: monsters, dread, nightmares, horror imagery, peril
- death: character deaths, loss, mourning
- romance: kissing, innuendo, sexual content
- substances: drinking, smoking, drugs
- mature: war, abuse, despair, moral horror
- meanness: cruelty between characters, bullying, humiliation
- crude: toilet and gross-out humour

Rate what is on the page, not what a reader might infer. Keep notes short (under 20 words) and calm.

<chapter>
${text}
</chapter>`,
    });
  } catch (e) {
    await recordAiCall({ userId, runId: analysisId, kind: 'analysis-chapter', model: model.modelId, keySource: model.keySource, costUsd: 0, ms: Date.now() - t0, error: String(e).slice(0, 500) });
    throw e;
  }
  const u = res.usage;
  const cost = textCostUsd(model.modelId, u.inputTokens ?? 0, u.outputTokens ?? 0);
  await recordAiCall({
    userId, runId: analysisId, kind: 'analysis-chapter', model: model.modelId, keySource: model.keySource,
    inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0, costUsd: cost, ms: Date.now() - t0,
  });

  const o = res.output;
  const notes: Record<string, string> = {};
  for (const n of o.notes) if (o.intensities[n.category] > 0) notes[n.category] = n.note;
  await getDb()
    .insert(sectionAnalyses)
    .values({ analysisId, sectionId: c.sectionId, userId, position: c.position, intensities: o.intensities as Intensities, notes, summary: o.summary, characters: o.characters, places: o.places })
    .onConflictDoNothing();
  await getDb()
    .update(bookAnalyses)
    // Counted rather than incremented, so a retried step can't count a chapter twice.
    .set({ chaptersDone: sql`(select count(*) from ${sectionAnalyses} where ${sectionAnalyses.analysisId} = ${analysisId})`, costUsd: sql`${bookAnalyses.costUsd} + ${cost.toFixed(6)}` })
    .where(eq(bookAnalyses.id, analysisId));
}

const bibleSchema = z.object({
  characters: z.array(z.object({
    name: z.string(),
    role: z.string().describe('A few words, e.g. "hero, 11", "best friend", "villain"'),
    look: z.string().describe('Appearance as the book describes it, for an illustrator. Empty if the book says nothing.'),
    note: z.string().describe('One sentence on who they are in the story'),
  })).describe('Main and recurring characters, most important first. At most 20.'),
  places: z.array(z.object({ name: z.string(), look: z.string() })).describe('Important places, at most 12'),
  threads: z.array(z.string()).describe('Plot threads that must survive any adaptation, one sentence each'),
  themes: z.array(z.string()).describe('A few words each'),
  keyScenes: z.array(z.object({ chapter: z.number().int(), scene: z.string() })).describe('Scenes a reader would remember, at most 15'),
});

async function writeStoryBible(userId: string, bookId: string, analysisId: string) {
  'use step';
  const book = await getBook(userId, bookId);
  if (!book) throw new FatalError('Book not found');
  const rows = await listSectionAnalyses(userId, analysisId);
  const model = await textModelOrStop(userId);
  const digest = rows
    .map((r, i) => {
      const who = r.characters.map((c) => (c.look ? `${c.name} (${c.look})` : c.name)).join('; ');
      const where = r.places.map((p) => (p.look ? `${p.name} (${p.look})` : p.name)).join('; ');
      return `Chapter ${i + 1}: ${r.summary}\nCharacters: ${who || 'none named'}\nPlaces: ${where || 'none named'}`;
    })
    .join('\n\n');

  const t0 = Date.now();
  let res;
  try {
    res = await generateText({
      model: model.model,
      reasoning: 'low',
      output: Output.object({ schema: bibleSchema }),
      prompt: `Write a Story Bible for "${book.title}" by ${book.author || 'an unknown author'}. It keeps a gentler adaptation of the book consistent: who everyone is, what they look like, where things happen, and which plot threads must stay intact.

Use only what the chapter notes below say. Merge different spellings or nicknames of the same character. Chapter numbers in key scenes refer to the numbering below.

${digest}`,
    });
  } catch (e) {
    await recordAiCall({ userId, runId: analysisId, kind: 'analysis-bible', model: model.modelId, keySource: model.keySource, costUsd: 0, ms: Date.now() - t0, error: String(e).slice(0, 500) });
    throw e;
  }
  const u = res.usage;
  const cost = textCostUsd(model.modelId, u.inputTokens ?? 0, u.outputTokens ?? 0);
  await recordAiCall({
    userId, runId: analysisId, kind: 'analysis-bible', model: model.modelId, keySource: model.keySource,
    inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0, costUsd: cost, ms: Date.now() - t0,
  });
  const data: StoryBible = res.output;
  await getDb()
    .insert(storyBibles)
    .values({ bookId, userId, analysisId, data })
    .onConflictDoUpdate({ target: storyBibles.bookId, set: { analysisId, data, updatedAt: new Date() } });
  await getDb().update(bookAnalyses).set({ costUsd: sql`${bookAnalyses.costUsd} + ${cost.toFixed(6)}` }).where(eq(bookAnalyses.id, analysisId));
}

/** A missing key won't fix itself on retry, so stop the run straight away. */
async function textModelOrStop(userId: string) {
  try {
    return await getTextModel(userId);
  } catch (e) {
    if (e instanceof NoKeyError) throw new FatalError(e.message);
    throw e;
  }
}

async function finish(analysisId: string, error: string | null) {
  'use step';
  await getDb()
    .update(bookAnalyses)
    .set({ status: error ? 'failed' : 'ready', error: error?.slice(0, 500) ?? null, finishedAt: new Date() })
    .where(eq(bookAnalyses.id, analysisId));
}
