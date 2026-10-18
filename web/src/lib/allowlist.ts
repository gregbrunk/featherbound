import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { allowedEmails } from '@/db/schema';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function getAllowEntry(email: string) {
  const [row] = await getDb().select().from(allowedEmails).where(eq(allowedEmails.email, normalizeEmail(email))).limit(1);
  return row ?? null;
}

export async function isAllowedEmail(email: string) {
  return (await getAllowEntry(email)) !== null;
}
