import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from './auth';
import { getAllowEntry } from './allowlist';

export type Account = { userId: string; email: string; name: string; image: string | null; isAdmin: boolean };

/**
 * The signed-in account, checked against the allow list on every request.
 * Every page and server action that touches account data starts here.
 */
export const requireAccount = cache(async (): Promise<Account> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const entry = await getAllowEntry(session.user.email);
  if (!entry) redirect('/private');
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? null,
    isAdmin: entry.isAdmin,
  };
});

/** For route handlers: the signed-in, still-allowed account, or null (respond 401/404). */
export async function getAccount(): Promise<Account | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const entry = await getAllowEntry(session.user.email);
  if (!entry) return null;
  return { userId: session.user.id, email: session.user.email, name: session.user.name, image: session.user.image ?? null, isAdmin: entry.isAdmin };
}

export async function requireAdmin() {
  const account = await requireAccount();
  if (!account.isAdmin) redirect('/settings');
  return account;
}
