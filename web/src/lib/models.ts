// Model catalog. GPT Image 2's price is from the first illustrated Oz run (with character-sheet
// references attached, about $0.08 a picture); other prices and speeds come from the Oct 2026 illustration bake-off
// (spikes/illustration-bakeoff) and the Vercel AI Gateway price list. Gateway IDs were checked
// against https://ai-gateway.vercel.sh/v1/models. `directId` is the provider's own model ID,
// used when an account has that provider's key instead of a gateway key. Claude IDs are
// confirmed; the direct image-model IDs get checked against each provider in Phase 6.

import type { KeyProvider } from '@/db/schema';

export type ModelProvider = Exclude<KeyProvider, 'gateway'> | 'bfl' | 'bytedance';

export const PROVIDERS: { id: KeyProvider; name: string; hint: string; recommended?: boolean }[] = [
  { id: 'gateway', name: 'Vercel AI Gateway', hint: 'One key for every model below, at the providers’ list prices (no markup).', recommended: true },
  { id: 'anthropic', name: 'Anthropic', hint: 'Claude writing models.' },
  { id: 'openai', name: 'OpenAI', hint: 'GPT Image and GPT writing models.' },
  { id: 'google', name: 'Google AI', hint: 'Nano Banana picture models.' },
  { id: 'xai', name: 'xAI', hint: 'Grok Imagine.' },
];

export type Strictness = 'strict' | 'medium' | 'loose';

export type TextModel = {
  id: string; directId: string; name: string; provider: ModelProvider;
  inPerM: number; outPerM: number; speed: number; note: string; recommended?: boolean;
};
export type ImageModel = {
  id: string; directId: string; name: string; provider: ModelProvider;
  perImage: number; seconds: number; bookArt: number; consistency: number; strictness: Strictness; note: string;
  /** How the model is called: generateImage, or generateText returning image files (Nano Banana). */
  api: 'image' | 'text';
};

export const TEXT_MODELS: TextModel[] = [
  { id: 'anthropic/claude-opus-5.5', directId: 'claude-opus-5-5', name: 'Claude Opus 5.5', provider: 'anthropic', inPerM: 4, outPerM: 20, speed: 1, recommended: true, note: 'Best at writing in the author’s voice. Recommended.' },
  { id: 'anthropic/claude-sonnet-5.5', directId: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', provider: 'anthropic', inPerM: 2, outPerM: 10, speed: 1.6, note: 'Half the price and faster. Slightly flatter prose.' },
  { id: 'anthropic/claude-fable-5.1', directId: 'claude-fable-5-1', name: 'Claude Fable 5.1', provider: 'anthropic', inPerM: 10, outPerM: 50, speed: 0.7, note: 'Most capable, 2.5× the price of Opus.' },
  { id: 'openai/gpt-5.6-sol', directId: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', provider: 'openai', inPerM: 4, outPerM: 20, speed: 1.1, note: 'Alternative if you’d rather use OpenAI.' },
];

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'openai/gpt-image-2', api: 'image', directId: 'gpt-image-2', name: 'GPT Image 2', provider: 'openai', perImage: 0.075, seconds: 30, bookArt: 5, consistency: 5, strictness: 'strict', note: 'Best match to a book’s art and most consistent characters. Refuses well-known copyrighted characters.' },
  { id: 'google/gemini-3.1-flash-image', api: 'text', directId: 'gemini-3.1-flash-image', name: 'Nano Banana 2', provider: 'google', perImage: 0.068, seconds: 16, bookArt: 4, consistency: 4, strictness: 'medium', note: 'Close second and fast. Draws copyrighted characters. Can copy an artist’s signature.' },
  { id: 'spacexai/grok-imagine-image-2.0', api: 'image', directId: 'grok-imagine-image-2.0', name: 'Grok Imagine 2.0', provider: 'xai', perImage: 0.08, seconds: 13, bookArt: 3, consistency: 4, strictness: 'loose', note: 'Loosest filters tested: drew every scene and both Harry Potter tests. Clean ink style, less true to the book’s art.' },
  { id: 'google/gemini-3-pro-image', api: 'text', directId: 'gemini-3-pro-image', name: 'Nano Banana Pro', provider: 'google', perImage: 0.141, seconds: 26, bookArt: 3, consistency: 2, strictness: 'medium', note: 'Characters drift between pictures. Not recommended.' },
  { id: 'bfl/flux-2-klein-9b', api: 'image', directId: 'flux-2-klein-9b', name: 'FLUX.2 klein 9B (open weights)', provider: 'bfl', perImage: 0.029, seconds: 5, bookArt: 2, consistency: 2, strictness: 'strict', note: 'Cheap, but the hosted version’s filter blocks many children’s-book scenes. Gateway only.' },
  { id: 'bytedance/seedream-5.0-pro', api: 'image', directId: 'seedream-5.0-pro', name: 'Seedream 5.0 Pro', provider: 'bytedance', perImage: 0.035, seconds: 128, bookArt: 2, consistency: 4, strictness: 'strict', note: 'Cheapest, but slow, over-polished and watermarked. Gateway only.' },
];

export const DEFAULT_MODELS = {
  text: 'anthropic/claude-opus-5.5',
  images: ['openai/gpt-image-2', 'google/gemini-3.1-flash-image', 'spacexai/grok-imagine-image-2.0'] as [string, string, string],
};

export const textModel = (id: string) => TEXT_MODELS.find((m) => m.id === id) ?? TEXT_MODELS[0];
export const imageModel = (id: string) => IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS[0];
export const isTextModel = (id: string) => TEXT_MODELS.some((m) => m.id === id);
export const isImageModel = (id: string) => IMAGE_MODELS.some((m) => m.id === id);

/**
 * Which key a model would run on. With `preferDirect` (the default), a provider's own key wins
 * for that provider's models and the gateway key covers the rest; otherwise the gateway key
 * wins whenever there is one.
 */
export function keyFor(provider: ModelProvider, keys: Partial<Record<KeyProvider, unknown>>, preferDirect = true): KeyProvider | null {
  const direct = provider !== 'bfl' && provider !== 'bytedance' && keys[provider] ? provider : null;
  if (preferDirect && direct) return direct;
  if (keys.gateway) return 'gateway';
  return direct;
}

export function textCostUsd(modelId: string, inputTokens: number, outputTokens: number) {
  const m = textModel(modelId);
  return (inputTokens * m.inPerM + outputTokens * m.outPerM) / 1e6;
}

export function imageCostUsd(modelId: string, images: number) {
  return imageModel(modelId).perImage * images;
}
