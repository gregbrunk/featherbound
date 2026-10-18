'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { accountSettings, allowedEmails, type KeyProvider } from '@/db/schema';
import { saveModelChoices, setHandoffPin } from '@/lib/account';
import { normalizeEmail } from '@/lib/allowlist';
import { deleteKey, saveKey, validateKey } from '@/lib/keys';
import { isImageModel, isTextModel, PROVIDERS } from '@/lib/models';
import { requireAccount, requireAdmin } from '@/lib/session';

export type FormState = { ok?: boolean; message?: string } | null;

const isProvider = (p: string): p is KeyProvider => PROVIDERS.some((x) => x.id === p);

export async function saveKeyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { userId } = await requireAccount();
  const provider = String(form.get('provider'));
  const key = String(form.get('key') ?? '').trim();
  if (!isProvider(provider)) return { ok: false, message: 'Unknown provider.' };
  if (key.length < 8) return { ok: false, message: 'That doesn’t look like a full key.' };
  const check = await validateKey(provider, key);
  if (!check.ok) return { ok: false, message: check.detail };
  await saveKey(userId, provider, key, check);
  revalidatePath('/settings');
  revalidatePath('/welcome');
  return { ok: true, message: check.detail ? `Saved and working. ${check.detail}` : 'Saved and working.' };
}

export async function removeKeyAction(form: FormData) {
  const { userId } = await requireAccount();
  const provider = String(form.get('provider'));
  if (isProvider(provider)) await deleteKey(userId, provider);
  revalidatePath('/settings');
}

export async function saveModelsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { userId } = await requireAccount();
  const text = String(form.get('text'));
  const images = [form.get('image0'), form.get('image1'), form.get('image2')].map(String) as [string, string, string];
  if (!isTextModel(text) || !images.every(isImageModel)) return { ok: false, message: 'Pick a model from the list.' };
  await saveModelChoices(userId, text, images);
  revalidatePath('/settings');
  return { ok: true, message: 'Saved.' };
}

export async function setPinAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { userId } = await requireAccount();
  const pin = String(form.get('pin') ?? '');
  const again = String(form.get('again') ?? '');
  if (!/^\d{4}$/.test(pin)) return { ok: false, message: 'Use exactly 4 digits.' };
  if (pin !== again) return { ok: false, message: 'The two PINs don’t match.' };
  await setHandoffPin(userId, pin);
  revalidatePath('/settings');
  return { ok: true, message: 'PIN saved.' };
}

export async function addEmailAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const email = normalizeEmail(String(form.get('email') ?? ''));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Enter a full email address.' };
  await getDb().insert(allowedEmails).values({ email }).onConflictDoNothing();
  revalidatePath('/settings');
  return { ok: true, message: `${email} can now sign in. They’ll start with their own empty library.` };
}

export async function removeEmailAction(form: FormData) {
  const admin = await requireAdmin();
  const email = normalizeEmail(String(form.get('email') ?? ''));
  if (email === normalizeEmail(admin.email)) return; // the admin can't lock themselves out
  const [row] = await getDb().select().from(allowedEmails).where(eq(allowedEmails.email, email)).limit(1);
  if (row && !row.isAdmin) await getDb().delete(allowedEmails).where(eq(allowedEmails.email, email));
  revalidatePath('/settings');
}

/** Monthly budget for the usage dashboard. Empty turns it off. */
export async function saveBudgetAction(budget: number | null): Promise<FormState> {
  const { userId } = await requireAccount();
  if (budget !== null && (!Number.isFinite(budget) || budget < 1 || budget > 100_000)) return { ok: false, message: 'Pick a budget between $1 and $100,000.' };
  await getDb()
    .insert(accountSettings)
    .values({ userId, monthlyBudget: budget === null ? null : budget.toFixed(2) })
    .onConflictDoUpdate({ target: accountSettings.userId, set: { monthlyBudget: budget === null ? null : budget.toFixed(2), updatedAt: new Date() } });
  revalidatePath('/settings');
  return { ok: true };
}

/** Use a provider's own key for its models instead of the AI Gateway key. */
export async function setPreferDirectKeysAction(prefer: boolean): Promise<FormState> {
  const { userId } = await requireAccount();
  await getDb()
    .insert(accountSettings)
    .values({ userId, preferDirectKeys: prefer })
    .onConflictDoUpdate({ target: accountSettings.userId, set: { preferDirectKeys: prefer, updatedAt: new Date() } });
  revalidatePath('/settings');
  return { ok: true };
}
