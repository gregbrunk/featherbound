'use server';

import { cookies } from 'next/headers';
import { getAccountSettings } from '@/lib/account';
import { getEdition } from '@/lib/analysis';
import { verifyPin } from '@/lib/crypto';
import { HANDOFF_COOKIE, HANDOFF_MAX_AGE, TRIES_COOKIE, decodeLock, encodeLock, readTries, writeTries } from '@/lib/handoff';
import { requireAccount } from '@/lib/session';

const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: HANDOFF_MAX_AGE };

/** Lock this device to one edition. Needs a parent PIN first, or there'd be no way back. */
export async function lockHandoff(editionId: string): Promise<{ ok: true } | { ok: false; message: string; needsPin?: boolean }> {
  const { userId } = await requireAccount();
  const [ed, settings] = await Promise.all([getEdition(userId, editionId), getAccountSettings(userId)]);
  if (!ed || !ed.currentVersion) return { ok: false, message: 'This edition isn’t ready to read yet.' };
  if (!settings?.handoffPinHash) return { ok: false, needsPin: true, message: 'Set a parent PIN in Settings first, so you can unlock it again.' };
  (await cookies()).set(HANDOFF_COOKIE, encodeLock({ userId, editionId: ed.id, bookId: ed.bookId }), cookieOptions);
  return { ok: true };
}

const MAX_TRIES = 5;
const WAIT_MS = 60_000;

/** Check the parent PIN and unlock. Five wrong tries in a row means a one-minute wait. */
export async function unlockHandoff(pin: string): Promise<{ ok: true; bookId: string } | { ok: false; message: string; waitSeconds?: number }> {
  const { userId } = await requireAccount();
  const jar = await cookies();
  const lock = decodeLock(jar.get(HANDOFF_COOKIE)?.value);
  if (!lock) return { ok: true, bookId: '' };
  const tries = readTries(jar.get(TRIES_COOKIE)?.value);
  const now = Date.now();
  if (tries.until > now) return { ok: false, message: 'Too many tries. Wait a moment.', waitSeconds: Math.ceil((tries.until - now) / 1000) };

  const settings = await getAccountSettings(userId);
  const good = /^\d{4}$/.test(pin) && Boolean(settings?.handoffPinHash) && lock.userId === userId && verifyPin(pin, settings!.handoffPinHash!);
  if (!good) {
    const count = tries.count + 1;
    const until = count >= MAX_TRIES ? now + WAIT_MS : 0;
    jar.set(TRIES_COOKIE, writeTries(count >= MAX_TRIES ? 0 : count, until), { ...cookieOptions, maxAge: 60 * 60 });
    return { ok: false, message: until ? 'Too many tries. Wait a minute.' : 'That’s not the PIN.', waitSeconds: until ? WAIT_MS / 1000 : undefined };
  }
  jar.delete(HANDOFF_COOKIE);
  jar.delete(TRIES_COOKIE);
  return { ok: true, bookId: lock.bookId };
}
