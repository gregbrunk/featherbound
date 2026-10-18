'use server';

import { redirect } from 'next/navigation';
import { markWelcomed } from '@/lib/account';
import { requireAccount } from '@/lib/session';

/**
 * Ends first-run setup, with or without keys. Once welcomedAt is set the key setup never shows
 * again (the tour stays replayable at /tour).
 */
export async function finishWelcomeAction(form: FormData) {
  const { userId } = await requireAccount();
  await markWelcomed(userId);
  redirect(form.get('next') === '/add' ? '/add' : '/');
}
