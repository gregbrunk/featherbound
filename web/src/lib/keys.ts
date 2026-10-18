import Anthropic from '@anthropic-ai/sdk';
import { createGateway } from 'ai';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { apiKeys, type KeyProvider } from '@/db/schema';
import { decryptSecret, encryptSecret } from './crypto';

export type KeyCheck = { ok: true; detail?: string } | { ok: false; detail: string };

const TIMEOUT_MS = 10_000;

async function checkBearer(url: string, headers: Record<string, string>): Promise<KeyCheck> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.ok) return { ok: true };
  if (res.status === 401 || res.status === 403) return { ok: false, detail: 'The provider rejected this key.' };
  return { ok: false, detail: `The provider returned an error (${res.status}). Try again in a moment.` };
}

/** One cheap, free call per provider to confirm a key works before we store it. */
export async function validateKey(provider: KeyProvider, key: string): Promise<KeyCheck> {
  try {
    switch (provider) {
      case 'gateway': {
        // Always pass the key explicitly so Vercel's OIDC token for this deployment is never used.
        const credits = await createGateway({ apiKey: key }).getCredits();
        return { ok: true, detail: `Balance: $${Number(credits.balance).toFixed(2)}` };
      }
      case 'anthropic': {
        try {
          await new Anthropic({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 0 }).models.list({ limit: 1 });
          return { ok: true };
        } catch (e) {
          if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
            return { ok: false, detail: 'Anthropic rejected this key.' };
          }
          throw e;
        }
      }
      case 'openai':
        return await checkBearer('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
      case 'google':
        return await checkBearer('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { 'x-goog-api-key': key });
      case 'xai':
        return await checkBearer('https://api.x.ai/v1/models', { Authorization: `Bearer ${key}` });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/401|403|unauthori[sz]ed|invalid.*key|authentication/i.test(message)) {
      return { ok: false, detail: 'The provider rejected this key.' };
    }
    return { ok: false, detail: 'Couldn’t reach the provider to check this key. Try again in a moment.' };
  }
}

/** Saved keys for an account, without the secret: safe to send to the browser. */
export async function listKeys(userId: string) {
  const rows = await getDb()
    .select({ provider: apiKeys.provider, last4: apiKeys.last4, status: apiKeys.status, statusDetail: apiKeys.statusDetail, checkedAt: apiKeys.checkedAt })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
  return rows;
}

export async function saveKey(userId: string, provider: KeyProvider, key: string, check: KeyCheck) {
  const enc = encryptSecret(key);
  const values = {
    userId, provider, ...enc,
    last4: key.slice(-4),
    status: check.ok ? ('ok' as const) : ('invalid' as const),
    statusDetail: check.detail ?? null,
    checkedAt: new Date(),
  };
  await getDb()
    .insert(apiKeys)
    .values(values)
    .onConflictDoUpdate({ target: [apiKeys.userId, apiKeys.provider], set: { ...values, addedAt: new Date() } });
}

export async function deleteKey(userId: string, provider: KeyProvider) {
  await getDb().delete(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)));
}

/** Decrypted keys for server-side AI calls only. Never return this to a client component. */
export async function getSecretKeys(userId: string): Promise<Partial<Record<KeyProvider, string>>> {
  const rows = await getDb().select().from(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.status, 'ok')));
  return Object.fromEntries(rows.map((r) => [r.provider, decryptSecret(r)]));
}
