import { z } from 'zod';

// Edition settings: what the Kid-ify wizard collects, and the reference data behind it
// (content categories, age bands, age-based filter defaults, art styles). Ported from the
// prototype (prototype/src/data/library.ts).

export const FILTER_CATEGORIES = ['language', 'violence', 'scariness', 'death', 'romance', 'substances', 'mature', 'meanness', 'crude'] as const;
export type FilterCategory = (typeof FILTER_CATEGORIES)[number];
export type FilterLevel = 'keep' | 'soften' | 'remove';
export type ReadingMode = 'read-aloud' | 'independent';
export const PICTURE_DENSITIES = ['page1', 'page2', 'page3', 'chapter3', 'page5', 'chapter2', 'page8', 'chapter1'] as const;
export type PictureDensity = (typeof PICTURE_DENSITIES)[number];

export const editionSettingsSchema = z.object({
  targetAge: z.number().int().min(3).max(17),
  readingMode: z.enum(['read-aloud', 'independent']),
  filters: z.object(Object.fromEntries(FILTER_CATEGORIES.map((c) => [c, z.enum(['keep', 'soften', 'remove'])])) as Record<FilterCategory, z.ZodEnum<{ keep: 'keep'; soften: 'soften'; remove: 'remove' }>>),
  faithfulness: z.number().min(0).max(100),
  readingLevelShift: z.number().int().min(-2).max(2),
  keepNames: z.boolean(),
  extras: z.object({ kidTitles: z.boolean(), recaps: z.boolean(), glossary: z.boolean() }),
  picture: z.object({ on: z.boolean(), density: z.enum(PICTURE_DENSITIES), style: z.string().max(80), look: z.string().max(160) }),
  notes: z.string().max(4000),
});
export type EditionSettings = z.infer<typeof editionSettingsSchema>;

export const CATEGORIES: { id: FilterCategory; name: string; examples: string; icon: string }[] = [
  { id: 'language', name: 'Language', examples: 'Profanity, slurs, crude insults', icon: '💬' },
  { id: 'violence', name: 'Violence & gore', examples: 'Battles, injury detail, blood, cruelty', icon: '⚔️' },
  { id: 'scariness', name: 'Scariness & peril', examples: 'Monsters, dread, nightmares, horror imagery', icon: '👻' },
  { id: 'death', name: 'Death & grief', examples: 'Character deaths, loss, mourning', icon: '🕯️' },
  { id: 'romance', name: 'Romance & sexuality', examples: 'Kissing, innuendo, sexual content', icon: '💌' },
  { id: 'substances', name: 'Substances', examples: 'Drinking, smoking, drugs', icon: '🍺' },
  { id: 'mature', name: 'Mature themes', examples: 'War, abuse, despair, moral horror', icon: '🌑' },
  { id: 'meanness', name: 'Meanness & bullying', examples: 'Cruelty between characters, humiliation', icon: '😠' },
  { id: 'crude', name: 'Crude humor', examples: 'Toilet and gross-out humor', icon: '💨' },
];

export const LEVEL_LABEL: Record<FilterLevel, string> = { keep: 'Keep', soften: 'Soften', remove: 'Remove' };

export const AGE_BANDS = [
  { name: 'Picture book', min: 3, max: 6, feel: 'Read aloud, simple, gentle, lots of pictures' },
  { name: 'Early reader', min: 5, max: 7, feel: 'Short sentences, simple vocabulary' },
  { name: 'Chapter book', min: 6, max: 9, feel: 'Short chapters, a picture every few pages' },
  { name: 'Middle grade', min: 8, max: 12, feel: 'Full novels, mild peril, light romance at most' },
  { name: 'Upper middle grade', min: 10, max: 14, feel: 'More complex themes, moderate peril' },
  { name: 'Young adult', min: 12, max: 17, feel: 'Mature themes handled carefully' },
];

export function bandFor(age: number) {
  if (age <= 4) return AGE_BANDS[0];
  if (age === 5) return AGE_BANDS[1];
  if (age <= 7) return AGE_BANDS[2];
  if (age <= 10) return AGE_BANDS[3];
  if (age <= 12) return AGE_BANDS[4];
  return AGE_BANDS[5];
}

export function gradeLevelFor(age: number, mode: ReadingMode, shift = 0) {
  // Read-aloud editions can run about two grades above what a child reads alone.
  const base = Math.max(0, age - 5) + (mode === 'read-aloud' ? 2 : 0) + shift;
  if (base <= 0) return 'Pre-K';
  if (base === 1) return 'Kindergarten';
  const g = Math.min(base - 1, 12);
  return `Grade ${g}`;
}

export function defaultFilters(age: number): Record<FilterCategory, FilterLevel> {
  if (age <= 5)
    return { language: 'remove', violence: 'remove', scariness: 'soften', death: 'remove', romance: 'remove', substances: 'remove', mature: 'remove', meanness: 'soften', crude: 'keep' };
  if (age <= 8)
    return { language: 'remove', violence: 'soften', scariness: 'soften', death: 'soften', romance: 'soften', substances: 'remove', mature: 'soften', meanness: 'soften', crude: 'keep' };
  if (age <= 11)
    return { language: 'soften', violence: 'soften', scariness: 'keep', death: 'soften', romance: 'soften', substances: 'soften', mature: 'soften', meanness: 'keep', crude: 'keep' };
  if (age <= 14)
    return { language: 'soften', violence: 'keep', scariness: 'keep', death: 'keep', romance: 'soften', substances: 'soften', mature: 'keep', meanness: 'keep', crude: 'keep' };
  return { language: 'soften', violence: 'keep', scariness: 'keep', death: 'keep', romance: 'keep', substances: 'keep', mature: 'keep', meanness: 'keep', crude: 'keep' };
}

export function defaultSettings(age = 7, mode: ReadingMode = 'read-aloud'): EditionSettings {
  return {
    targetAge: age,
    readingMode: mode,
    filters: defaultFilters(age),
    faithfulness: 30,
    readingLevelShift: 0,
    keepNames: true,
    extras: { kidTitles: false, recaps: age <= 8, glossary: false },
    picture: { on: false, density: 'page3', style: 'True to the book’s world', look: '' },
    notes: '',
  };
}

export function editionName(s: EditionSettings) {
  return [`Age ${s.targetAge}`, s.readingMode === 'read-aloud' ? 'Read-aloud' : 'Independent', s.picture.on ? 'Illustrated' : null]
    .filter(Boolean)
    .join(' · ');
}

export const ART_STYLES = [
  { name: 'True to the book’s world', desc: 'Matches the official look, as closely as possible', swatch: ['#4B2E83', '#D4A23A', '#2F7D62'] },
  { name: 'Watercolor storybook', desc: 'Soft washes, gentle edges, lots of light', swatch: ['#9CC7EE', '#F6B8C6', '#F6E3AE'] },
  { name: 'Ink & wash', desc: 'Classic pen lines with muted color', swatch: ['#2B2140', '#B07D55', '#EAD9B4'] },
  { name: 'Cozy gouache', desc: 'Thick, warm, matte colors', swatch: ['#B23A52', '#D4A23A', '#3462A8'] },
  { name: 'Bright cartoon', desc: 'Bold shapes, big expressions', swatch: ['#FF8A3D', '#3DB2FF', '#7ED957'] },
  { name: 'Woodcut', desc: 'Carved lines, two or three colors', swatch: ['#1F1A17', '#C0392B', '#F4E8CD'] },
];
