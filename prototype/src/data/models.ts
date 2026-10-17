import type { Book, EditionSettings, PictureDensity } from './types';

// Model catalog and cost/time math. Prices and speeds come from the illustration bake-off
// (spikes/illustration-bakeoff, Oct 2026) and the Vercel AI Gateway price list.

export type Provider = 'gateway' | 'anthropic' | 'openai' | 'google' | 'xai' | 'bfl' | 'bytedance';

export const PROVIDERS: { id: Provider; name: string; keyLabel: string; hint: string; recommended?: boolean }[] = [
  { id: 'gateway', name: 'Vercel AI Gateway', keyLabel: 'AI Gateway key', hint: 'One key for every model below, at the providers’ list prices (no markup).', recommended: true },
  { id: 'anthropic', name: 'Anthropic', keyLabel: 'Anthropic API key', hint: 'Claude text models.' },
  { id: 'openai', name: 'OpenAI', keyLabel: 'OpenAI API key', hint: 'GPT Image and GPT text models.' },
  { id: 'google', name: 'Google AI', keyLabel: 'Gemini API key', hint: 'Nano Banana image models.' },
  { id: 'xai', name: 'xAI', keyLabel: 'xAI API key', hint: 'Grok Imagine.' },
];

export type Strictness = 'strict' | 'medium' | 'loose';

export type TextModel = {
  id: string; name: string; provider: Provider; inPerM: number; outPerM: number; speed: number; note: string; recommended?: boolean;
};
export type ImageModel = {
  id: string; name: string; provider: Provider; perImage: number; seconds: number;
  denslow: number; consistency: number; strictness: Strictness; note: string;
};

export const TEXT_MODELS: TextModel[] = [
  { id: 'anthropic/claude-opus-5.5', name: 'Claude Opus 5.5', provider: 'anthropic', inPerM: 4, outPerM: 20, speed: 1, recommended: true, note: 'Best at writing in the author’s voice. Recommended.' },
  { id: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', provider: 'anthropic', inPerM: 2, outPerM: 10, speed: 1.6, note: 'Half the price and faster. Slightly flatter prose.' },
  { id: 'anthropic/claude-fable-5.1', name: 'Claude Fable 5.1', provider: 'anthropic', inPerM: 10, outPerM: 50, speed: 0.7, note: 'Most capable, 2.5× the price of Opus.' },
  { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'openai', inPerM: 4, outPerM: 20, speed: 1.1, note: 'Alternative if you’d rather use OpenAI.' },
];

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'openai/gpt-image-2', name: 'GPT Image 2', provider: 'openai', perImage: 0.054, seconds: 30, denslow: 5, consistency: 5, strictness: 'strict', note: 'Best match to a book’s art and most consistent characters. Refuses well-known copyrighted characters.' },
  { id: 'google/gemini-3.1-flash-image', name: 'Nano Banana 2', provider: 'google', perImage: 0.068, seconds: 16, denslow: 4, consistency: 4, strictness: 'medium', note: 'Close second and fast. Draws copyrighted characters. Can copy an artist’s signature.' },
  { id: 'spacexai/grok-imagine-image-2.0', name: 'Grok Imagine 2.0', provider: 'xai', perImage: 0.08, seconds: 13, denslow: 3, consistency: 4, strictness: 'loose', note: 'Loosest filters tested: drew every scene and both Harry Potter tests. Clean ink style, less true to the book’s art.' },
  { id: 'google/gemini-3-pro-image', name: 'Nano Banana Pro', provider: 'google', perImage: 0.141, seconds: 26, denslow: 3, consistency: 2, strictness: 'medium', note: 'Characters drift between pictures. Not recommended.' },
  { id: 'bfl/flux-2-klein-9b', name: 'FLUX.2 klein 9B (open weights)', provider: 'bfl', perImage: 0.029, seconds: 5, denslow: 2, consistency: 2, strictness: 'strict', note: 'Cheap and open weights, but the hosted version’s filter blocks many children’s-book scenes.' },
  { id: 'bytedance/seedream-5.0-pro', name: 'Seedream 5.0 Pro', provider: 'bytedance', perImage: 0.035, seconds: 128, denslow: 2, consistency: 4, strictness: 'strict', note: 'Cheapest, but slow, over-polished and watermarked.' },
];

export const DEFAULT_AI = {
  text: 'anthropic/claude-opus-5.5',
  images: ['openai/gpt-image-2', 'google/gemini-3.1-flash-image', 'spacexai/grok-imagine-image-2.0'] as [string, string, string],
};

export const textModel = (id: string) => TEXT_MODELS.find((m) => m.id === id) ?? TEXT_MODELS[0];
export const imageModel = (id: string) => IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS[0];

/** A model can run if the user has the gateway key or the model's own provider key. */
export function reachable(provider: Provider, keys: Partial<Record<Provider, unknown>>) {
  return Boolean(keys.gateway || keys[provider]);
}

// ── Picture density ────────────────────────────────────────────────────────────────

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

export const pagesOf = (book: Book) => Math.max(1, Math.round(book.words / WORDS_PER_PAGE));

export function picturesFor(book: Book, density: PictureDensity) {
  const d = DENSITIES.find((x) => x.id === density) ?? DENSITIES[2];
  return d.perPages ? Math.max(book.chapters, Math.round(pagesOf(book) / d.perPages)) : book.chapters * d.perChapter!;
}

/** Tiers for this book, from most to fewest pictures, ending at once per chapter. Tiers that
 *  give the same count as a neighbour are dropped so every slider step changes something. */
export function densityTiers(book: Book) {
  const once = book.chapters;
  const tiers = DENSITIES.map((d) => ({ ...d, count: picturesFor(book, d.id) }))
    .filter((t) => t.id === 'chapter1' || t.count > once)
    .sort((a, b) => b.count - a.count);
  return tiers.filter((t, i) => i === 0 || t.count !== tiers[i - 1].count);
}

export function densityLabel(book: Book | undefined, density: PictureDensity) {
  const d = DENSITIES.find((x) => x.id === density);
  if (!d) return '';
  return book ? `${d.label} · ~${picturesFor(book, density)} pictures` : d.label;
}

// ── Estimates ──────────────────────────────────────────────────────────────────────

export type AiChoice = { text: string; images: [string, string, string] };

const PARALLEL_IMAGES = 4; // pictures drawn at the same time
const RETRY_BUFFER = 1.08; // redraws after a failed consistency check
const CHARACTER_SHEETS = 5; // main characters, drawn once per edition
const RESEARCH = { cost: 0.35, minutes: 3 }; // visual research step (text model + web search)

export function imageCost(count: number, ai: AiChoice) {
  const primary = imageModel(ai.images[0]);
  const worst = Math.max(...ai.images.map((id) => imageModel(id).perImage));
  return {
    cost: count * primary.perImage * RETRY_BUFFER,
    worst: count * worst * RETRY_BUFFER,
    minutes: (count * primary.seconds * RETRY_BUFFER) / PARALLEL_IMAGES / 60,
  };
}

export function estimate(book: Book, s: EditionSettings, ai: AiChoice) {
  const tm = textModel(ai.text);
  const tokensIn = Math.round(book.words * 1.33 * 3.2);
  const tokensOut = Math.round(book.words * 1.33 * 1.15);
  const text = (tokensIn * tm.inPerM + tokensOut * tm.outPerM) / 1e6;
  const textMinutes = book.words / 2400 / tm.speed;

  const on = s.picture.on;
  const images = on ? picturesFor(book, s.picture.density) : 0;
  const sheets = on ? imageCost(CHARACTER_SHEETS, ai) : { cost: 0, worst: 0, minutes: 0 };
  const pics = imageCost(images, ai);
  const imageTotal = on ? RESEARCH.cost + sheets.cost + pics.cost : 0;
  const imageWorst = on ? RESEARCH.cost + sheets.worst + pics.worst : 0;
  // Pictures are drawn as each chapter finishes, so they mostly overlap with the writing.
  const imageMinutes = on ? RESEARCH.minutes + sheets.minutes + pics.minutes : 0;
  const minutes = Math.round(Math.max(textMinutes, imageMinutes) + Math.min(textMinutes, imageMinutes) * 0.25);

  // Samples: two chapters of text, plus character sheets and ~2 chapters of pictures.
  const sampleText = (text / book.chapters) * 2 + 0.1;
  const samplePics = on ? RESEARCH.cost + sheets.cost + imageCost(Math.ceil((images / book.chapters) * 2), ai).cost : 0;

  return {
    tokensIn, tokensOut, text, textMinutes: Math.round(textMinutes),
    images, imageCost: imageTotal, imageWorst, imageMinutes: Math.round(imageMinutes),
    total: text + imageTotal, totalWorst: text + imageWorst, minutes,
    samples: sampleText + samplePics,
  };
}

export function fmtMinutes(min: number) {
  if (min < 1) return 'under a minute';
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  return `${h < 10 ? h.toFixed(1) : Math.round(h)} hr`;
}
