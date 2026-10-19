import { generateText, Output, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { ChangeNote } from '@/db/schema';
import { SYSTEM_PROMPT, cleanInline, type CallUsage } from './adapt';
import { gradeLevelFor, type EditionSettings } from './editions';
import type { Block } from './import/types';

// Refinement: revise an existing adapted chapter to follow one request from the parent,
// leaving everything else exactly as it was. The model sees the original and the current
// adaptation side by side, paragraph for paragraph.

export type RefineJob = {
  settings: EditionSettings;
  bible: string;
  /** Standing guidance from sample review. */
  guidance: string[];
  /** What the parent asked for this time. */
  request: string;
  chapterNumber: number;
  title: string;
  original: Block[];
  current: Block[];
};

export type RefinePartResult = { paragraphs: string[]; changeNotes: ChangeNote[] };

const REFINE_RULES = `

You are now revising a chapter you already adapted. The parent read it and asked for a change.
- Change only what the request needs. Every paragraph the request doesn't touch comes back exactly as it is in the current adaptation, word for word.
- The rules above still apply: full length, same story, same voice, same names, paragraph for paragraph.
- The original is there so you can restore the author's words where the request asks for it.`;

const schema = z.object({
  paragraphs: z.array(z.string()).describe('The revised adaptation, one paragraph per paragraph, same order. Unchanged paragraphs copied exactly.'),
  changeNotes: z.array(z.object({ note: z.string().describe('Short and specific, e.g. "¶4: the Lion roars bravely before the Kalidahs."') })),
});

const html = (b: Block) => ('html' in b ? b.html : '');

/**
 * Revise part of a chapter. `idx` are the text-block indexes in this part; when `only` is given,
 * just those paragraphs may change and the rest is kept as is, whatever the model returns.
 */
export async function refinePart(model: LanguageModel, job: RefineJob, idx: number[], only?: number[]): Promise<{ part: RefinePartResult; usage: CallUsage }> {
  const s = job.settings;
  const lock = only ? new Set(idx.filter((i) => !only.includes(i))) : null;
  const prompt = `<edition_settings>
Target age: ${s.targetAge}, ${s.readingMode === 'read-aloud' ? 'read aloud by a grown-up' : 'read alone'}, about ${gradeLevelFor(s.targetAge, s.readingMode, s.readingLevelShift)}.
${job.guidance.length ? `Standing notes from the parent:\n${job.guidance.map((g) => `- ${g}`).join('\n')}` : ''}
</edition_settings>

<story_bible>
${job.bible}
</story_bible>

<chapter number="${job.chapterNumber}" title="${job.title.replace(/"/g, '“')}">
${idx.map((i, k) => `<pair n="${k + 1}"${lock?.has(i) ? ' locked="true"' : ''}>\n<original>${html(job.original[i])}</original>\n<current>${html(job.current[i])}</current>\n</pair>`).join('\n')}
</chapter>

<request>
${job.request}
</request>
${lock ? '\nOnly the pairs without locked="true" may change. Copy locked paragraphs exactly; they are context.\n' : ''}
Return exactly ${idx.length} paragraphs: the revised current adaptation.`;

  const t0 = Date.now();
  const res = await generateText({
    model,
    system: SYSTEM_PROMPT + REFINE_RULES,
    prompt,
    output: Output.object({ schema }),
    reasoning: 'high',
    maxOutputTokens: 32000,
  });
  const usage = { inputTokens: res.usage.inputTokens ?? 0, outputTokens: res.usage.outputTokens ?? 0, ms: Date.now() - t0 };
  if (res.output.paragraphs.length !== idx.length) {
    throw Object.assign(new Error(`The revision came back with ${res.output.paragraphs.length} paragraphs instead of ${idx.length}.`), { usage });
  }
  const paragraphs = idx.map((i, k) => (lock?.has(i) ? html(job.current[i]) : cleanInline(res.output.paragraphs[k]) || html(job.current[i])));
  return { usage, part: { paragraphs, changeNotes: res.output.changeNotes.map((n) => ({ category: 'Your request', level: 'Refine' as const, note: n.note })) } };
}

/**
 * The original's paragraphs, lined up with the adaptation's block indexes. Pictures added to
 * (or removed from) the adaptation shift its indexes, so paragraphs pair up in reading order.
 * Null when the paragraph counts differ: the book changed since this chapter was adapted.
 */
export function alignOriginal(original: Block[], current: Block[]): Block[] | null {
  const text = original.filter((b) => 'html' in b);
  if (text.length !== current.filter((b) => 'html' in b).length) return null;
  let k = 0;
  return current.map((b) => ('html' in b ? text[k++] : b));
}

/** Paragraph indexes a passage refinement shows the model: the chosen one with a little context. */
export function passageWindow(blocks: Block[], index: number, around = 3) {
  const text = blocks.map((b, i) => ('html' in b ? i : -1)).filter((i) => i >= 0);
  const at = text.indexOf(index);
  if (at < 0) return [];
  return text.slice(Math.max(0, at - around), at + around + 1);
}

export { looksLikeNewEdition, nextFreeVersion, nextVersion, suggestedLevel } from './versions';
