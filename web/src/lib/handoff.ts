import { createHmac, timingSafeEqual } from 'node:crypto';

// Hand-off mode: a signed cookie that pins this device to one edition until a parent enters
// the PIN. The proxy enforces it on every request, so it survives closing the app, reloading
// or typing another address. Signed so it can't be edited to point at something else.

export const HANDOFF_COOKIE = 'fb_handoff';
export const TRIES_COOKIE = 'fb_handoff_tries';
export const HANDOFF_MAX_AGE = 60 * 60 * 24 * 365;

export type HandoffLock = { userId: string; editionId: string; bookId: string };

const key = () => {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set');
  return secret;
};
const sign = (payload: string) => createHmac('sha256', key()).update(`handoff:${payload}`).digest('base64url');

export function encodeLock(lock: HandoffLock) {
  const payload = Buffer.from(JSON.stringify(lock)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeLock(value: string | undefined | null): HandoffLock | null {
  if (!value) return null;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const v = JSON.parse(Buffer.from(payload, 'base64url').toString()) as HandoffLock;
    return v.userId && v.editionId && v.bookId ? v : null;
  } catch {
    return null;
  }
}

/** Paths a locked device may still use: the edition's reader and what it loads. */
export function allowedWhileLocked(pathname: string, lock: HandoffLock) {
  return (
    pathname === `/read/edition/${lock.editionId}` ||
    pathname.startsWith(`/api/editions/${lock.editionId}/sections/`) ||
    pathname.startsWith(`/api/books/${lock.bookId}/images/`)
  );
}

/** After five wrong PINs in a row, wait a minute. Kept in a signed cookie: "count.until.sig". */
export function readTries(value: string | undefined | null) {
  if (!value) return { count: 0, until: 0 };
  const [count, until, sig] = value.split('.');
  if (sig !== sign(`${count}.${until}`)) return { count: 0, until: 0 };
  return { count: Number(count) || 0, until: Number(until) || 0 };
}

export const writeTries = (count: number, until: number) => `${count}.${until}.${sign(`${count}.${until}`)}`;
