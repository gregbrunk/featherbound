import { generateText, Output, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { ChangeNote, StoryBible } from '@/db/schema';
import { CATEGORIES, gradeLevelFor, type EditionSettings, type FilterLevel } from './editions';
import type { Block } from './import/types';

// The adaptation engine. The prompt started from the October 2026 quality spike
// (spikes/adaptation-quality/prompt.mjs), which held plot, voice and paragraph alignment at
// ages 5, 8 and 11. Chapters are split into chunks of about 2,000 words so each model call
// stays well inside a function's time limit; each chunk sees the end of the one before it.

const CHUNK_WORDS = 2000;

const LEVELS: Record<FilterLevel, string> = {
  keep: 'Keep: leave it as the author wrote it.',
  soften: 'Soften: keep it in the story but make it gentler and less intense for this age.',
  remove: 'Remove: move it off-page. The event still happens if the plot needs it, but it is not shown or described.',
};

const CATEGORY_LABEL: Record<string, string> = {
  language: 'Language (profanity, slurs, crude insults)',
  violence: 'Violence & gore (battles, injuries, blood, cruelty)',
  scariness: 'Scariness & peril (monsters, dread, nightmares)',
  death: 'Death & grief (deaths, loss, mourning)',
  romance: 'Romance & sexuality',
  substances: 'Substances (drinking, smoking, drugs)',
  mature: 'Mature themes (war, abuse, slavery, despair)',
  meanness: 'Meanness & bullying',
  crude: 'Crude humor',
};

export const SYSTEM_PROMPT = `You adapt chapters of books that a family owns into gentler editions for their children. The family loves these books and wants their kids to experience the real story. The edition must feel like the same book, just softer.

Rules that never bend:
1. Full length. Adapt every paragraph. Never summarize, skip, merge or shorten scenes.
2. Same story. Plot events, outcomes, character choices and arcs stay the same. You may soften how an event is shown, or move it off-page, but you never change what happens. (The one exception: where the content filter says Remove for a death or act of violence that the later plot does not depend on, the creature or character may simply flee or be driven off instead.)
3. Same voice. Keep the author's tone, humor, rhythm and turns of phrase wherever the filters and reading level allow. Prefer the author's own words; change only what needs changing.
4. Same names and invented words, unless told otherwise.
5. Paragraph for paragraph. Return exactly one adapted paragraph for each original paragraph, in the same order, so they can be read side by side. A paragraph may be a heading or a single line; adapt it as one paragraph all the same.
6. Formatting. Paragraphs may contain <em>, <strong> and <br> tags. Keep them where they still fit. Use no other markup.

Then report what you changed: one short note per meaningful change, naming the filter category (or "Reading level") and whether you softened or removed it.`;

export function bibleText(b: StoryBible) {
  return [
    'Characters:',
    ...b.characters.map((c) => `- ${c.name} (${c.role})${c.look ? `. Looks: ${c.look}` : ''}. ${c.note}`),
    'Places:',
    ...b.places.map((p) => `- ${p.name}${p.look ? `: ${p.look}` : ''}`),
    'Plot threads that must survive:',
    ...b.threads.map((t) => `- ${t}`),
    `Themes: ${b.themes.join('; ')}`,
  ].join('\n');
}

function settingsText(s: EditionSettings, guidance: string[]) {
  const filters = CATEGORIES.map((c) => `- ${CATEGORY_LABEL[c.id]}: ${LEVELS[s.filters[c.id]]}`).join('\n');
  const mode = s.readingMode === 'read-aloud'
    ? `Read aloud by a grown-up to a ${s.targetAge}-year-old. Language can stay fairly rich, since an adult is there to help, but swap words a child this age would not follow even when hearing them.`
    : `Read alone by a ${s.targetAge}-year-old. Use vocabulary and sentence lengths they can read on their own, while keeping the story's flavor.`;
  const shift = s.readingLevelShift < 0 ? ' Lean a little simpler than usual for this age.' : s.readingLevelShift > 0 ? ' Lean a little richer than usual for this age.' : '';
  return `Target age: ${s.targetAge}
Reading mode: ${mode}
Reading level: about ${gradeLevelFor(s.targetAge, s.readingMode, s.readingLevelShift)}.${shift}
Faithfulness: ${s.faithfulness < 34 ? 'Stay close to the author’s words.' : s.faithfulness < 67 ? 'Balance the author’s words with kid-friendly language.' : 'Retell freely in kid-friendly language.'}
Names: ${s.keepNames ? 'Keep every original name and invented word.' : 'Keep names, but you may swap invented words that are very hard to say for simpler ones, consistently.'}
Content filters:
${filters}
Parent's notes: ${s.notes || 'None.'}
${guidance.length ? `What the parent said after reading sample chapters (follow this everywhere):\n${guidance.map((g) => `- ${g}`).join('\n')}` : ''}`.trim();
}

const chunkSchema = z.object({
  paragraphs: z.array(z.string()).describe('Adapted paragraphs, one per original paragraph, same order.'),
  changeNotes: z.array(z.object({
    category: z.string().describe('A filter category name, or "Reading level"'),
    level: z.enum(['Soften', 'Remove', 'Reading level']),
    note: z.string().describe('Short and specific, e.g. "¶12: the wolves flee instead of being killed."'),
  })),
  names: z.array(z.string()).describe('Every character and place name used in your adapted paragraphs'),
  summary: z.string().describe('Two sentences on what happens in this part, as adapted'),
  kidTitle: z.string().nullable().describe('Only when asked: a playful chapter title for a child. Otherwise null.'),
  recap: z.string().nullable().describe('Only when asked: the "story so far" recap. Otherwise null.'),
  moments: z.array(z.object({
    paragraph: z.number().int().describe('The picture goes after this paragraph number'),
    scene: z.string().describe('What to draw, for an illustrator: who is where doing what, setting, mood. As adapted, gentle for this age.'),
    characters: z.array(z.string()).describe('Named characters in the picture, spelled as in the Story Bible even if the text spells them differently'),
    alt: z.string().describe('A one-sentence caption for screen readers'),
  })).describe('Only when asked for picture moments; otherwise an empty list.'),
});

export type ChapterJob = {
  settings: EditionSettings;
  bible: string;
  guidance: string[];
  /** Summaries of the chapters before this one, in order. */
  storySoFar: string[];
  chapterNumber: number;
  title: string;
  /** What happens in this chapter (from the analysis), so chunks know where it's going. */
  chapterSummary: string;
  blocks: Block[];
  /** Extra instruction when re-writing a chapter, e.g. from the consistency check. */
  fix?: string;
  /** Picture Book mode: how many picture moments to pick in this chapter. */
  pictures?: number;
};

/** A spot for a picture: after block `index`, showing `scene`. */
export type Moment = { index: number; scene: string; characters: string[]; alt: string };

export type ChapterResult = {
  moments: Moment[];
  blocks: Block[];
  changeNotes: ChangeNote[];
  names: string[];
  summary: string;
  kidTitle: string | null;
  recap: string | null;
  words: number;
  originalWords: number;
};

export type CallUsage = { inputTokens: number; outputTokens: number; ms: number };

const isText = (b: Block): b is Extract<Block, { html: string }> => b.type === 'p' || b.type === 'h' || b.type === 'quote';
export const wordsIn = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
export const blockWords = (blocks: Block[]) => blocks.reduce((n, b) => n + (isText(b) ? wordsIn(b.html) : 0), 0);

/** Group the chapter's text blocks into runs of about CHUNK_WORDS, never splitting a paragraph. */
export function chunkIndexes(blocks: Block[], limit = CHUNK_WORDS) {
  const chunks: number[][] = [];
  let cur: number[] = [];
  let words = 0;
  blocks.forEach((b, i) => {
    if (!isText(b)) return;
    const w = wordsIn(b.html);
    if (cur.length && words + w > limit) { chunks.push(cur); cur = []; words = 0; }
    cur.push(i);
    words += w;
  });
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Only the inline tags the reader renders survive. */
export function cleanInline(html: string) {
  return html.replace(/<(?!\/?(em|strong)>|br\s*\/?>)[^>]*>/gi, '').trim();
}

export class AlignmentError extends Error {}

export type PartResult = {
  moments: Moment[];
  paragraphs: string[];
  changeNotes: ChangeNote[];
  names: string[];
  summary: string;
  kidTitle: string | null;
  recap: string | null;
};

/**
 * Adapt one part (chunk) of a chapter. `prevTail` is the end of the previous part, already
 * adapted. Throws AlignmentError if the paragraph count comes back wrong, so the step retries.
 */
export async function adaptPart(model: LanguageModel, job: ChapterJob, chunks: number[][], ci: number, prevTail: string[]): Promise<{ part: PartResult; usage: CallUsage }> {
  const s = job.settings;
  const idx = chunks[ci];
  const first = ci === 0;
  const paragraphs = idx.map((i) => (job.blocks[i] as { html: string }).html);
  const wanted = picturesForPart(job, chunks, ci);
  const asks = [
    first && s.extras.kidTitles ? 'Also write kidTitle: a playful, spoiler-free chapter title a child would love (the original title stays underneath it).' : '',
    first && s.extras.recaps && job.chapterNumber > 1 ? 'Also write recap: "The story so far…" in two or three warm sentences for a child, from the earlier chapters listed above. No spoilers for this chapter.' : '',
    wanted ? `Also choose ${wanted} picture moment${wanted > 1 ? 's' : ''} in this part: memorable, spread out, and showing what you wrote (gentle for this age). Prefer moments with the main characters.` : '',
  ].filter(Boolean).join('\n');

  const prompt = `<edition_settings>
${settingsText(s, job.guidance)}
</edition_settings>

<story_bible>
${job.bible}
</story_bible>

<story_so_far>
${job.storySoFar.length ? job.storySoFar.map((x, i) => `Chapter ${i + 1}: ${x}`).join('\n') : 'This is the first chapter.'}
</story_so_far>

<this_chapter number="${job.chapterNumber}" title="${job.title.replace(/"/g, '“')}">
What happens: ${job.chapterSummary || 'See the text.'}
${chunks.length > 1 ? `This is part ${ci + 1} of ${chunks.length} of the chapter.` : ''}
</this_chapter>
${prevTail.length ? `\n<previous_part_ending note="already adapted; continue smoothly from here">\n${prevTail.join('\n\n')}\n</previous_part_ending>\n` : ''}
<chapter_text>
${paragraphs.map((p, i) => `<p n="${i + 1}">${p}</p>`).join('\n')}
</chapter_text>
${job.fix ? `\nThis chapter is being rewritten to fix a problem found in a review of the whole edition: ${job.fix}\n` : ''}
Adapt this text. Return exactly ${paragraphs.length} paragraphs.${asks ? `\n${asks}` : ''}`;

  const t0 = Date.now();
  const res = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt,
    output: Output.object({ schema: chunkSchema }),
    reasoning: 'high',
    maxOutputTokens: 32000,
  });
  const usage = { inputTokens: res.usage.inputTokens ?? 0, outputTokens: res.usage.outputTokens ?? 0, ms: Date.now() - t0 };
  const o = res.output;
  if (o.paragraphs.length !== paragraphs.length) {
    throw Object.assign(new AlignmentError(`Part ${ci + 1} came back with ${o.paragraphs.length} paragraphs instead of ${paragraphs.length}.`), { usage });
  }
  return {
    usage,
    part: {
      moments: o.moments
        .filter((m) => m.paragraph >= 1 && m.paragraph <= idx.length)
        .slice(0, wanted)
        .map((m) => ({ index: idx[m.paragraph - 1], scene: m.scene, characters: m.characters, alt: m.alt })),
      paragraphs: o.paragraphs.map((p, k) => cleanInline(p) || paragraphs[k]),
      changeNotes: o.changeNotes,
      names: o.names,
      summary: o.summary,
      kidTitle: first ? o.kidTitle : null,
      recap: first ? o.recap : null,
    },
  };
}

/** Share a chapter's picture count across its parts by length, so pictures spread through the chapter. */
export function picturesForPart(job: ChapterJob, chunks: number[][], ci: number) {
  const total = job.pictures ?? 0;
  if (!total) return 0;
  const words = chunks.map((idx) => idx.reduce((n, i) => n + wordsIn((job.blocks[i] as { html: string }).html), 0));
  const all = words.reduce((a, b) => a + b, 0) || 1;
  // Largest-remainder split, so the parts add up to exactly `total`.
  const raw = words.map((w) => (w / all) * total);
  const base = raw.map(Math.floor);
  let left = total - base.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ i, rem: r - base[i] })).sort((a, b) => b.rem - a.rem).forEach(({ i }) => { if (left > 0) { base[i]++; left--; } });
  return base[ci];
}

/** The last two adapted paragraphs of a part, for the next part's context. */
export const tailOf = (part: PartResult) => part.paragraphs.slice(-2);

/** Put adapted parts back into the chapter's blocks. Pictures and scene breaks stay where they were. */
export function assemble(job: ChapterJob, chunks: number[][], parts: PartResult[]): ChapterResult {
  const out = job.blocks.map((b) => ({ ...b }));
  chunks.forEach((idx, ci) => idx.forEach((bi, k) => { (out[bi] as { html: string }).html = parts[ci].paragraphs[k]; }));
  const s = job.settings;
  return {
    moments: parts.flatMap((p) => p.moments ?? []),
    blocks: out,
    changeNotes: parts.flatMap((p) => p.changeNotes),
    names: [...new Set(parts.flatMap((p) => p.names))],
    summary: parts.map((p) => p.summary).join(' '),
    kidTitle: s.extras.kidTitles ? parts[0]?.kidTitle ?? null : null,
    recap: s.extras.recaps && job.chapterNumber > 1 && parts[0]?.recap ? stripRecapLead(parts[0].recap) : null,
    words: blockWords(out),
    originalWords: blockWords(job.blocks),
  };
}

/** The reader adds its own "The story so far…" heading, so drop one the model wrote. */
export const stripRecapLead = (r: string) => r.replace(/^\s*(<em>)?\s*the story so far\s*[.…:,!—-]*\s*(<\/em>)?\s*/i, '').trim();

/** Adapt a whole chapter in one go (used by the quality suite). */
export async function adaptChapter(model: LanguageModel, job: ChapterJob, onCall: (u: CallUsage) => Promise<void> = async () => {}): Promise<ChapterResult> {
  const chunks = chunkIndexes(job.blocks);
  const parts: PartResult[] = [];
  for (let ci = 0; ci < chunks.length; ci++) {
    const { part, usage } = await adaptPart(model, job, chunks, ci, ci ? tailOf(parts[ci - 1]) : []);
    await onCall(usage);
    parts.push(part);
  }
  return assemble(job, chunks, parts);
}

/** Feedback from a round of samples, as lines for the prompt. */
export function guidanceFrom(comments: { quote: string; text: string; chapter: string }[], overall: string) {
  return [
    ...comments.map((c) => `In “${c.chapter}”, about “${c.quote}”: ${c.text}`),
    ...(overall.trim() ? [overall.trim()] : []),
  ];
}
