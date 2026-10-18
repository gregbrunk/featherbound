import type { EditionSettings, PictureDensity } from './editions';
import { imageModel, textModel } from './models';

// Cost and time estimates, priced from the account's chosen models (src/lib/models.ts).
// Adaptation is calibrated on the first full Oz run (Oct 2026, Claude Opus 5.5, reasoning high):
// 25 calls for 34.5k words took 222k input and 98k output tokens, about 20 s per call with three
// chapters at a time. Each call carries a fixed load (instructions, settings, Story Bible, story
// so far) on top of its share of the chapter, so short chapters cost more per word.

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

/** Pictures for one chapter at this density: by length for page densities, fixed for per-chapter ones. */
export function picturesForChapter(words: number, density: PictureDensity) {
  const d = DENSITIES.find((x) => x.id === density) ?? DENSITIES[2];
  return d.perPages ? Math.max(1, Math.round(words / WORDS_PER_PAGE / d.perPages)) : d.perChapter!;
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

/** About how many words go into one model call (parts are capped at 2,000 words). */
const WORDS_PER_CALL = 1700;
const CALL_OVERHEAD_IN = 6000;
const CALL_OVERHEAD_OUT = 2100;
const SECONDS_PER_CALL = 20;
/** The consistency check and naming the version, after the chapters. */
const FINISHING_USD = 0.08;

/** Tokens to adapt `words` across `chapters` chapters of a book that has `bookChapters` chapters. */
export function adaptTokens(words: number, chapters: number, bookChapters: number) {
  const calls = Math.max(chapters, Math.ceil(words / WORDS_PER_CALL));
  return {
    calls,
    tokensIn: Math.round(words * TOKENS_PER_WORD + calls * (CALL_OVERHEAD_IN + bookChapters * 40)),
    tokensOut: Math.round(words * TOKENS_PER_WORD * 1.05 + calls * CALL_OVERHEAD_OUT),
  };
}

const PARALLEL_IMAGES = 4;
const RETRY_BUFFER = 1.08;
const CHARACTER_SHEETS = 5;
// Research is one text call that looks at the cover; measured at about $0.05 with Claude Opus 5.5.
const RESEARCH = { cost: 0.08, minutes: 1 };

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
  const { calls, tokensIn, tokensOut } = adaptTokens(book.words, book.chapters, book.chapters);
  const text = (tokensIn * tm.inPerM + tokensOut * tm.outPerM) / 1e6 + FINISHING_USD;
  const textMinutes = (calls * SECONDS_PER_CALL) / 60 / tm.speed + 1;

  const on = s.picture.on;
  const images = on ? picturesFor(book, s.picture.density) : 0;
  const sheets = on ? imageCost(CHARACTER_SHEETS, models) : { cost: 0, worst: 0, minutes: 0 };
  const pics = imageCost(images, models);
  const imageTotal = on ? RESEARCH.cost + sheets.cost + pics.cost : 0;
  const imageWorst = on ? RESEARCH.cost + sheets.worst + pics.worst : 0;
  const imageMinutes = on ? RESEARCH.minutes + sheets.minutes + pics.minutes : 0;
  // Pictures are drawn as chapters finish, so they mostly overlap with the writing.
  const minutes = Math.round(Math.max(textMinutes, imageMinutes) + Math.min(textMinutes, imageMinutes) * 0.25);

  // Samples: chapter 1 plus one more, at this book's average chapter length.
  const sampleText = estimateSamples(book, (book.words / Math.max(1, book.chapters)) * 2, models, 2);
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

/** Writing a few chosen chapters as samples. */
export function estimateSamples(book: BookSize, sampleWords: number, models: ModelChoice, sampleChapters = 2) {
  const tm = textModel(models.text);
  const t = adaptTokens(Math.max(1, sampleWords), sampleChapters, book.chapters);
  return (t.tokensIn * tm.inPerM + t.tokensOut * tm.outPerM) / 1e6;
}

/**
 * Refining chapters: like adapting them, but each call carries the original and the current
 * adaptation side by side. A passage sends a short window around one paragraph.
 */
export function estimateRefine(book: BookSize, words: number, chapters: number, models: ModelChoice) {
  const tm = textModel(models.text);
  const t = adaptTokens(Math.max(1, words), Math.max(1, chapters), book.chapters);
  const cost = ((t.tokensIn + words * TOKENS_PER_WORD) * tm.inPerM + t.tokensOut * tm.outPerM) / 1e6 + 0.02;
  return { cost, minutes: Math.max(1, Math.round((t.calls * SECONDS_PER_CALL) / 60 / tm.speed + 1)) };
}

/** Words a passage refinement shows the model: about seven paragraphs. */
export const PASSAGE_WORDS = 450;

/** Researching the look and drawing the character sheets, once per illustrated edition. */
export function estimateArt(models: ModelChoice) {
  return RESEARCH.cost + imageCost(CHARACTER_SHEETS, models).cost;
}

/** Redrawing some pictures with the main picture model (plus the usual retry margin). */
export function estimatePictures(count: number, models: ModelChoice) {
  return count ? imageCost(count, models).cost : 0.01;
}
