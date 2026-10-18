import type { EditionSettings, PictureDensity } from './editions';
import { imageModel, textModel } from './models';

// Cost and time estimates, priced from the account's chosen models (src/lib/models.ts).
// Ported from the prototype; the per-word token ratios were checked against the Oct 2026
// adaptation spike (≈$0.035 per 1,000 words with Claude Opus 5.5). Phase 4 calibrates these
// against recorded ai_calls.

export type BookSize = { words: number; chapters: number };
export type ModelChoice = { text: string; images: [string, string, string] };

const TOKENS_PER_WORD = 1.33;
const WORDS_PER_PAGE = 250;

export const DENSITIES: { id: PictureDensity; label: string; perPages?: number; perChapter?: number }[] = [
  { id: 'page1', label: 'Every page', perPages: 1 },
  { id: 'page2', label: 'Every 2 pages', perPages: 2 },
  { id: 'page3', label: 'Every 3 pages', perPages: 3 },
  { id: 'chapter3', label: '3 per chapter', perChapter: 3 },
  { id: 'page5', label: 'Every 5 pages', perPages: 5 },
  { id: 'chapter2', label: '2 per chapter', perChapter: 2 },
  { id: 'page8', label: 'Every 8 pages', perPages: 8 },
  { id: 'chapter1', label: 'Once per chapter', perChapter: 1 },
];

export const pagesOf = (book: BookSize) => Math.max(1, Math.round(book.words / WORDS_PER_PAGE));

export function picturesFor(book: BookSize, density: PictureDensity) {
  const d = DENSITIES.find((x) => x.id === density) ?? DENSITIES[2];
  return d.perPages ? Math.max(book.chapters, Math.round(pagesOf(book) / d.perPages)) : book.chapters * d.perChapter!;
}

/** Density steps for this book, most to fewest pictures; steps that don't change the count are dropped. */
export function densityTiers(book: BookSize) {
  const once = book.chapters;
  const tiers = DENSITIES.map((d) => ({ ...d, count: picturesFor(book, d.id) }))
    .filter((t) => t.id === 'chapter1' || t.count > once)
    .sort((a, b) => b.count - a.count);
  return tiers.filter((t, i) => i === 0 || t.count !== tiers[i - 1].count);
}

export function densityLabel(book: BookSize, density: PictureDensity) {
  const d = DENSITIES.find((x) => x.id === density);
  return d ? `${d.label} · ~${picturesFor(book, density)} pictures` : '';
}

/** Reading the whole book once for the Content Report and Story Bible. */
export function estimateAnalysis(book: BookSize, text: string) {
  const tm = textModel(text);
  const tokensIn = Math.round(book.words * TOKENS_PER_WORD + book.chapters * 900);
  // Per chapter: notes and summary plus some reasoning; then one Story Bible pass.
  const tokensOut = book.chapters * 1100 + 6000;
  const cost = (tokensIn * tm.inPerM + tokensOut * tm.outPerM) / 1e6;
  const minutes = Math.max(1, Math.round((book.chapters / 6) * 0.6 / tm.speed + 1));
  return { tokensIn, tokensOut, cost, minutes };
}

const PARALLEL_IMAGES = 4;
const RETRY_BUFFER = 1.08;
const CHARACTER_SHEETS = 5;
const RESEARCH = { cost: 0.35, minutes: 3 };

function imageCost(count: number, models: ModelChoice) {
  const primary = imageModel(models.images[0]);
  const worst = Math.max(...models.images.map((id) => imageModel(id).perImage));
  return {
    cost: count * primary.perImage * RETRY_BUFFER,
    worst: count * worst * RETRY_BUFFER,
    minutes: (count * primary.seconds * RETRY_BUFFER) / PARALLEL_IMAGES / 60,
  };
}

/** A full edition: text adaptation, plus pictures when Picture Book mode is on. */
export function estimateEdition(book: BookSize, s: EditionSettings, models: ModelChoice) {
  const tm = textModel(models.text);
  const tokensIn = Math.round(book.words * TOKENS_PER_WORD * 3.2);
  const tokensOut = Math.round(book.words * TOKENS_PER_WORD * 1.15);
  const text = (tokensIn * tm.inPerM + tokensOut * tm.outPerM) / 1e6;
  const textMinutes = book.words / 2400 / tm.speed;

  const on = s.picture.on;
  const images = on ? picturesFor(book, s.picture.density) : 0;
  const sheets = on ? imageCost(CHARACTER_SHEETS, models) : { cost: 0, worst: 0, minutes: 0 };
  const pics = imageCost(images, models);
  const imageTotal = on ? RESEARCH.cost + sheets.cost + pics.cost : 0;
  const imageWorst = on ? RESEARCH.cost + sheets.worst + pics.worst : 0;
  const imageMinutes = on ? RESEARCH.minutes + sheets.minutes + pics.minutes : 0;
  // Pictures are drawn as chapters finish, so they mostly overlap with the writing.
  const minutes = Math.round(Math.max(textMinutes, imageMinutes) + Math.min(textMinutes, imageMinutes) * 0.25);

  const sampleText = (text / Math.max(1, book.chapters)) * 2 + 0.1;
  const samplePics = on ? RESEARCH.cost + sheets.cost + imageCost(Math.ceil((images / Math.max(1, book.chapters)) * 2), models).cost : 0;

  return {
    tokensIn, tokensOut, text, textMinutes: Math.round(textMinutes),
    images, imageCost: imageTotal, imageWorst, imageMinutes: Math.round(imageMinutes),
    total: text + imageTotal, totalWorst: text + imageWorst, minutes,
    samples: sampleText + samplePics,
  };
}

/** Default cap: comfortably above the estimate, rounded to whole dollars. */
export const defaultCap = (total: number) => Math.max(1, Math.ceil(total * 1.3));

export function fmtMinutes(min: number) {
  if (min < 1) return 'under a minute';
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  return `${h < 10 ? h.toFixed(1) : Math.round(h)} hr`;
}

export const money = (n: number) => `$${n < 10 ? n.toFixed(2) : n.toFixed(0)}`;
