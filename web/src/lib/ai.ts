import 'server-only';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGateway, type LanguageModel } from 'ai';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { aiCalls, modelSettings, type KeyProvider } from '@/db/schema';
import { getSecretKeys } from './keys';
import { DEFAULT_MODELS, keyFor, textModel } from './models';

// Every AI call runs on the signed-in account's own keys. Never use the global `gateway`
// provider or bare "provider/model" strings in app code: on Vercel those fall back to the
// deployment's OIDC token and would bill the host account instead of the reader's.

export class NoKeyError extends Error {
  constructor(public modelName: string) {
    super(`Add an AI key in Settings to use ${modelName}.`);
  }
}

export async function getModelChoices(userId: string) {
  const [row] = await getDb().select().from(modelSettings).where(eq(modelSettings.userId, userId)).limit(1);
  return row ? { text: row.textModel, images: row.imageModels } : DEFAULT_MODELS;
}

/** The account's writing model, wired to the key it should bill. */
export async function getTextModel(userId: string): Promise<{ model: LanguageModel; modelId: string; keySource: KeyProvider }> {
  const choices = await getModelChoices(userId);
  const m = textModel(choices.text);
  const keys = await getSecretKeys(userId);
  const source = keyFor(m.provider, keys);
  if (!source) throw new NoKeyError(m.name);
  const key = keys[source]!;
  switch (source) {
    case 'gateway':
      return { model: createGateway({ apiKey: key })(m.id), modelId: m.id, keySource: source };
    case 'anthropic':
      return { model: createAnthropic({ apiKey: key })(m.directId), modelId: m.id, keySource: source };
    case 'openai':
      return { model: createOpenAI({ apiKey: key })(m.directId), modelId: m.id, keySource: source };
    default:
      throw new NoKeyError(m.name);
  }
}

export type AiCallRecord = {
  userId: string;
  runId?: string;
  kind: string;
  model: string;
  keySource: KeyProvider;
  inputTokens?: number;
  outputTokens?: number;
  images?: number;
  costUsd: number;
  ms: number;
  refused?: boolean;
  error?: string;
};

/** Record one AI call for the usage dashboard, estimates and cost caps. */
export async function recordAiCall(r: AiCallRecord) {
  await getDb().insert(aiCalls).values({
    userId: r.userId,
    runId: r.runId,
    kind: r.kind,
    model: r.model,
    keySource: r.keySource,
    inputTokens: r.inputTokens ?? 0,
    outputTokens: r.outputTokens ?? 0,
    images: r.images ?? 0,
    costUsd: r.costUsd.toFixed(6),
    ms: Math.round(r.ms),
    refused: r.refused ?? false,
    error: r.error,
  });
}
