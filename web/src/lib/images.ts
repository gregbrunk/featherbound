import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { createGateway, generateImage, generateText, type ImageModel as SdkImageModel, type LanguageModel } from 'ai';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { accountSettings, type KeyProvider } from '@/db/schema';
import { recordAiCall } from './ai';
import { getSecretKeys } from './keys';
import { imageCostUsd, imageModel, keyFor } from './models';
import { sniffImage } from './export/xhtml';

// Drawing pictures on the account's own keys, with a fallback chain. Models differ in how
// they're called (the bake-off, spikes/illustration-bakeoff): GPT Image, Grok, FLUX and
// Seedream use generateImage; Nano Banana answers through generateText with image files.
// Like text, image calls never use the global gateway or bare model strings.

type Handle =
  | { kind: 'image'; model: SdkImageModel; modelId: string; keySource: KeyProvider }
  | { kind: 'text'; model: LanguageModel; modelId: string; keySource: KeyProvider };

export class NoImageKeyError extends Error {}

async function handleFor(userId: string, modelId: string): Promise<Handle> {
  const m = imageModel(modelId);
  const [keys, prefs] = await Promise.all([
    getSecretKeys(userId),
    getDb().select({ preferDirect: accountSettings.preferDirectKeys }).from(accountSettings).where(eq(accountSettings.userId, userId)).limit(1),
  ]);
  const source = keyFor(m.provider, keys, prefs[0]?.preferDirect ?? true);
  if (!source) throw new NoImageKeyError(`No key reaches ${m.name}.`);
  const key = keys[source]!;
  const textApi = m.api === 'text';
  switch (source) {
    case 'gateway': {
      const gw = createGateway({ apiKey: key });
      return textApi ? { kind: 'text', model: gw(m.id), modelId: m.id, keySource: source } : { kind: 'image', model: gw.imageModel(m.id), modelId: m.id, keySource: source };
    }
    case 'openai':
      return { kind: 'image', model: createOpenAI({ apiKey: key }).image(m.directId), modelId: m.id, keySource: source };
    case 'google':
      return { kind: 'text', model: createGoogleGenerativeAI({ apiKey: key })(m.directId), modelId: m.id, keySource: source };
    case 'xai':
      return { kind: 'image', model: createXai({ apiKey: key }).image(m.directId), modelId: m.id, keySource: source };
    default:
      throw new NoImageKeyError(`No key reaches ${m.name}.`);
  }
}

export type DrawRequest = {
  prompt: string;
  /** Reference images: character sheets first, then style references. */
  references: Uint8Array[];
  aspect: '4:3' | '3:2' | '1:1' | '2:3';
};

export type Drawn = { bytes: Uint8Array; mediaType: string; model: string; cost: number; ms: number };

const SEEDREAM_SIZES: Record<DrawRequest['aspect'], string> = { '4:3': '2304x1728', '3:2': '2496x1664', '1:1': '2048x2048', '2:3': '1664x2496' };

async function drawOnce(h: Handle, req: DrawRequest): Promise<Drawn> {
  const t0 = Date.now();
  const refs = req.references.slice(0, 6);
  if (h.kind === 'image') {
    const r = await generateImage({
      model: h.model,
      prompt: refs.length ? { text: req.prompt, images: refs } : req.prompt,
      ...(h.modelId.startsWith('bytedance/') ? { size: SEEDREAM_SIZES[req.aspect] as `${number}x${number}` } : { aspectRatio: req.aspect }),
      maxRetries: 1,
    });
    const cost = Number((r.providerMetadata as { gateway?: { cost?: string | number } } | undefined)?.gateway?.cost) || imageCostUsd(h.modelId, 1);
    return { bytes: r.image.uint8Array, mediaType: r.image.mediaType, model: h.modelId, cost, ms: Date.now() - t0 };
  }
  const r = await generateText({
    model: h.model,
    maxRetries: 1,
    providerOptions: { google: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: req.aspect } } },
    messages: [{
      role: 'user',
      content: [
        ...refs.map((data) => ({ type: 'file' as const, mediaType: sniffImage(data)?.type ?? 'image/png', data })),
        { type: 'text' as const, text: req.prompt },
      ],
    }],
  });
  const img = r.files.find((f) => f.mediaType.startsWith('image/'));
  if (!img) throw new Refusal(`No picture came back${r.text ? `: ${r.text.slice(0, 200)}` : ''}.`);
  const cost = Number((r.providerMetadata as { gateway?: { cost?: string | number } } | undefined)?.gateway?.cost) || imageCostUsd(h.modelId, 1);
  return { bytes: img.uint8Array, mediaType: img.mediaType, model: h.modelId, cost, ms: Date.now() - t0 };
}

/** A model declined or returned nothing; the next model in the chain gets a turn. */
export class Refusal extends Error {}

/** All models in the chain refused or failed. */
export class AllRefused extends Error {
  constructor(public refusedBy: string[], public reasons: string[]) {
    super(`No model would draw this picture (${refusedBy.map((m) => imageModel(m).name).join(', ')}).`);
  }
}

/**
 * Try each model in order, starting at `startAt`. Every attempt is recorded for the usage
 * dashboard; refusals are flagged. Returns the first picture that comes back.
 */
export async function drawWithChain(userId: string, runId: string | undefined, chain: string[], startAt: number, req: DrawRequest, kind = 'picture') {
  const refusedBy: string[] = [];
  const reasons: string[] = [];
  for (const modelId of chain.slice(Math.max(0, startAt))) {
    let h: Handle;
    try {
      h = await handleFor(userId, modelId);
    } catch (e) {
      refusedBy.push(modelId);
      reasons.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    const t0 = Date.now();
    try {
      const d = await drawOnce(h, req);
      await recordAiCall({ userId, runId, kind, model: modelId, keySource: h.keySource, images: 1, costUsd: d.cost, ms: d.ms });
      return { ...d, refusedBy };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await recordAiCall({ userId, runId, kind, model: modelId, keySource: h.keySource, costUsd: 0, ms: Date.now() - t0, refused: true, error: msg.slice(0, 500) });
      refusedBy.push(modelId);
      reasons.push(msg);
    }
  }
  throw new AllRefused(refusedBy, reasons);
}

/** Never let a model add text, signatures or watermarks (Nano Banana forged Denslow's). */
export const NO_LETTERING = 'No text, captions, labels, signatures, monograms or watermarks anywhere in the picture.';
