import { generateText, Output, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { ArtDirection, StoryBible } from '@/db/schema';
import type { CallUsage } from './adapt';
import type { EditionSettings } from './editions';
import { sniffImage } from './export/xhtml';
import { NO_LETTERING } from './images';

// Picture Book mode's words: researching a book's look, and the prompts every drawing uses.

const TRUE_TO_BOOK = 'True to the book’s world';

const STYLE_TEXT: Record<string, string> = {
  'Watercolor storybook': 'a soft modern watercolor storybook illustration: loose washes, warm light, gentle textures, light pencil underdrawing',
  'Ink & wash': 'classic pen-and-ink line drawing with muted watercolor washes',
  'Cozy gouache': 'a cozy gouache painting: thick, warm, matte colors and soft shapes',
  'Bright cartoon': 'a bright modern cartoon: bold shapes, clean outlines, big friendly expressions',
  Woodcut: 'a woodcut print: carved black lines with two or three flat colors',
};

const researchSchema = z.object({
  look: z.string().describe('The look to use, e.g. "W. W. Denslow’s 1900 originals" or "Classic paperback cover art"'),
  options: z.array(z.object({ name: z.string(), note: z.string().describe('One sentence for the parent') })).describe('Other recognised looks for this book, if any; at most 4'),
  style: z.string().describe('Drawing instructions in visual terms (line, color, shading, composition, era) that an illustrator could follow. Name the artist only if their work is in the public domain.'),
  palette: z.string().describe('A few named colors'),
  characters: z.array(z.object({
    name: z.string(),
    description: z.string().describe('Concrete, consistent visual description for a character sheet: age, build, hair, face, clothes, colors, props. Suitable for the target age.'),
  })).describe('The main characters to draw reference sheets for, most important first; at most 5. Animals count.'),
});

export type ResearchResult = { art: Omit<ArtDirection, 'references' | 'researchedAt'>; characters: { name: string; description: string }[] };

/** Work out how this book should look, from what the model knows, the Story Bible and the book's own pictures. */
export async function researchLook(model: LanguageModel, input: {
  title: string; author: string; settings: EditionSettings; bible: StoryBible; series?: ArtDirection | null; images: Uint8Array[];
}): Promise<{ result: ResearchResult; usage: CallUsage }> {
  const s = input.settings;
  const t0 = Date.now();
  const res = await generateText({
    model,
    reasoning: 'medium',
    output: Output.object({ schema: researchSchema }),
    messages: [{
      role: 'user',
      content: [
        ...input.images.slice(0, 4).map((data) => ({ type: 'file' as const, mediaType: sniffImage(data)?.type ?? 'image/png', data })),
        {
          type: 'text' as const,
          text: `You are the art director for an illustrated edition of "${input.title}" by ${input.author || 'an unknown author'}, made for a ${s.targetAge}-year-old.
${input.images.length ? 'The attached images are from the book itself (its cover and any original illustrations).' : ''}

Find the book's official or best-known look: the original illustrations, the classic edition art or the well-known covers. Pick the look that best suits a ${s.targetAge}-year-old.
${s.picture.look ? `The parent asked for: "${s.picture.look}". Use that unless it's impossible.` : ''}
${input.series ? `Earlier books in this series used this look; start from it so the series matches:\n${input.series.look}: ${input.series.style}` : ''}
${s.picture.style !== TRUE_TO_BOOK ? `The pictures will be drawn as ${STYLE_TEXT[s.picture.style] ?? s.picture.style}, but characters should still look the way readers know them.` : ''}

Characters from the Story Bible (with what the book says they look like):
${input.bible.characters.slice(0, 12).map((c) => `- ${c.name} (${c.role}): ${c.look || 'no description'}`).join('\n')}

Describe the characters as they appear in the chosen look, consistent with the book's text.`,
        },
      ],
    }],
  });
  const o = res.output;
  return {
    usage: { inputTokens: res.usage.inputTokens ?? 0, outputTokens: res.usage.outputTokens ?? 0, ms: Date.now() - t0 },
    result: { art: { look: o.look, options: o.options.slice(0, 4), style: o.style, palette: o.palette }, characters: o.characters.slice(0, 5) },
  };
}

/** The drawing style line: the researched look, or the art style the parent chose. */
export function styleLine(settings: EditionSettings, art: Pick<ArtDirection, 'style' | 'palette'>) {
  if (settings.picture.style === TRUE_TO_BOOK || !STYLE_TEXT[settings.picture.style]) return `Drawn ${art.style} Palette: ${art.palette}.`;
  return `Drawn as ${STYLE_TEXT[settings.picture.style]}. Keep the characters’ designs from the reference sheets.`;
}

/** What every picture must avoid, from the edition's age and content filters. */
export function kidSafeLine(settings: EditionSettings) {
  const f = settings.filters;
  const rules = [`A gentle picture-book illustration for a ${settings.targetAge}-year-old.`];
  if (f.violence !== 'keep') rules.push('No injuries, blood or weapons used on anyone; conflict looks harmless or comic.');
  if (f.scariness !== 'keep') rules.push('Nothing frightening: danger looks more silly than scary, and faces stay friendly or comic.');
  if (f.death !== 'keep') rules.push('No death, bodies or grave imagery.');
  if (f.romance !== 'keep') rules.push('No kissing or romance.');
  if (f.substances !== 'keep') rules.push('No drinking, smoking or drugs.');
  return rules.join(' ');
}

export function sheetPrompt(settings: EditionSettings, art: Pick<ArtDirection, 'style' | 'palette'>, c: { name: string; description: string }, note?: string | null) {
  return `A character reference sheet for an illustrated children's book: ${c.name}, shown full body twice, from the front and from the side, standing on a plain white background.
${c.description}
${styleLine(settings, art)}
${kidSafeLine(settings)}
${note ? `The parent asked: ${note}` : ''}
Match the attached reference images' linework and colors. ${NO_LETTERING}`.trim();
}

export function scenePrompt(settings: EditionSettings, art: Pick<ArtDirection, 'style' | 'palette'>, scene: string, cast: { name: string; description: string }[], note?: string | null) {
  return `${scene}
${cast.length ? `Characters (use the attached character sheets so each looks exactly the same):\n${cast.map((c) => `- ${c.name}: ${c.description}`).join('\n')}` : ''}
${styleLine(settings, art)}
${kidSafeLine(settings)}
${note ? `The parent asked: ${note}` : ''}
${NO_LETTERING}`.trim();
}

const checkSchema = z.object({
  verdict: z.enum(['keep', 'redraw', 'remove']).describe('keep if it suits the settings; redraw if the moment is worth showing but this picture is too intense; remove if it should not be shown at all'),
  reason: z.string(),
  scene: z.string().describe('For redraw: the same moment described as a gentle scene for an illustrator. Otherwise empty.'),
});

/** Is one of the book's own pictures fine for this edition? (Denslow's wolves are not, for a 5-year-old.) */
export async function checkOriginalPicture(model: LanguageModel, settings: EditionSettings, image: Uint8Array, alt: string) {
  const f = settings.filters;
  const t0 = Date.now();
  const res = await generateText({
    model,
    reasoning: 'low',
    output: Output.object({ schema: checkSchema }),
    messages: [{
      role: 'user',
      content: [
        { type: 'file', mediaType: sniffImage(image)?.type ?? 'image/png', data: image },
        {
          type: 'text',
          text: `This illustration is from a book being softened for a ${settings.targetAge}-year-old (${settings.readingMode}). ${alt ? `Its caption: "${alt}".` : ''}
Content filters: ${Object.entries(f).map(([k, v]) => `${k}: ${v}`).join(', ')}. "remove" means not shown at all; "soften" means gentler.
Decide whether to keep it, redraw the moment gently, or remove it.`,
        },
      ],
    }],
  });
  return { check: res.output, usage: { inputTokens: res.usage.inputTokens ?? 0, outputTokens: res.usage.outputTokens ?? 0, ms: Date.now() - t0 } };
}
