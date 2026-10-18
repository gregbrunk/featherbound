import { createGateway, generateText, Output } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { adaptChapter, type ChapterJob } from '../src/lib/adapt';
import { defaultSettings, type EditionSettings } from '../src/lib/editions';
import oz from './fixtures/oz.json';

// Quality suite: adapts golden public-domain chapters with the real prompt, then has a judge
// model grade the result against a rubric. It spends real money (about $0.40 a run), so it
// only runs when AI_GATEWAY_API_KEY is set: `npm run quality`, or the manual GitHub workflow.

const key = process.env.AI_GATEWAY_API_KEY;
const gateway = key ? createGateway({ apiKey: key }) : null;
const WRITER = 'anthropic/claude-opus-5.5';
const JUDGE = 'anthropic/claude-sonnet-5.5';

const BIBLE = `Characters:
- Dorothy (heroine, little girl). A brave, practical Kansas farm girl who wants to go home.
- Toto (Dorothy's dog). Little black dog, in nearly every scene.
- Scarecrow (seeks brains). Has the best ideas.
- Tin Woodman (seeks a heart). The most tender; carries an axe.
- Cowardly Lion (seeks courage). Brave when it counts.
- Wicked Witch of the West (villain). One far-seeing eye, a silver whistle, the Golden Cap.
- Aunt Em and Uncle Henry (Dorothy's aunt and uncle).
Plot threads that must survive:
- Dorothy wants to go home; each friend seeks what they already have; Oz sent them to defeat the Witch.`;

const p = (paragraphs: string[]) => paragraphs.map((html) => ({ type: 'p' as const, html }));

type Case = { name: string; chapter: '1' | '12'; settings: EditionSettings; mustSoften: string[] };
const age5 = defaultSettings(5, 'read-aloud');
const age8 = defaultSettings(8, 'independent');
const CASES: Case[] = [
  { name: 'age 5 read-aloud, chapter 12 (the hardest)', chapter: '12', settings: age5, mustSoften: ['the wolves, crows and bees are not shown being killed', 'no beheading or neck-wringing'] },
  { name: 'age 8 independent, chapter 1 (voice check)', chapter: '1', settings: age8, mustSoften: [] },
];

const judgeSchema = z.object({
  plotPreserved: z.boolean().describe('Every plot event and outcome of the original still happens, in the same order (it may be softened or off-page)'),
  missingEvents: z.array(z.string()),
  filtersRespected: z.boolean().describe('Each Remove category is off-page, each Soften category is gentler, Keep categories are not needlessly changed'),
  filterProblems: z.array(z.string()),
  readingLevelOnTarget: z.boolean().describe('Vocabulary and sentences suit the target age and reading mode'),
  charactersAllPresent: z.boolean().describe('No character from the original is dropped or renamed'),
  feelsLikeTheBook: z.number().int().min(1).max(5).describe('5 = unmistakably the author’s voice'),
  notes: z.string(),
});

describe.skipIf(!gateway)('adaptation quality (golden fixtures)', () => {
  for (const c of CASES) {
    it(c.name, { timeout: 600_000 }, async () => {
      const ch = oz.chapters[c.chapter];
      const job: ChapterJob = {
        settings: c.settings, bible: BIBLE, guidance: [], storySoFar: [], chapterNumber: Number(c.chapter),
        title: ch.title, chapterSummary: '', blocks: p(ch.paragraphs),
      };
      const out = await adaptChapter(gateway!(WRITER), job);

      // Mechanical checks: paragraph for paragraph, and full length.
      expect(out.blocks.length).toBe(ch.paragraphs.length);
      expect(out.words / out.originalWords).toBeGreaterThan(0.75);

      const filters = Object.entries(c.settings.filters).map(([k, v]) => `${k}: ${v}`).join(', ');
      const { output: j } = await generateText({
        model: gateway!(JUDGE),
        output: Output.object({ schema: judgeSchema }),
        prompt: `Grade a children's adaptation of a book chapter against the original.

Target: age ${c.settings.targetAge}, ${c.settings.readingMode}. Filters: ${filters}.
${c.mustSoften.length ? `It must also: ${c.mustSoften.join('; ')}.` : ''}
Softening or moving events off-page is intended. So is one exception the adapter is allowed: where a filter says Remove for a death or act of violence that the later plot does not depend on, the creature or character may flee or be driven off instead. Other changed outcomes, and dropped events or characters, are not allowed.

<original>
${ch.paragraphs.join('\n\n')}
</original>

<adaptation>
${out.blocks.map((b) => ('html' in b ? b.html : '')).join('\n\n')}
</adaptation>`,
      });
      console.log(`${c.name}: ${JSON.stringify(j, null, 1)}`);
      expect(j.plotPreserved, j.missingEvents.join('; ')).toBe(true);
      expect(j.filtersRespected, j.filterProblems.join('; ')).toBe(true);
      expect(j.readingLevelOnTarget, j.notes).toBe(true);
      expect(j.charactersAllPresent, j.notes).toBe(true);
      expect(j.feelsLikeTheBook).toBeGreaterThanOrEqual(4);
    });
  }
});
