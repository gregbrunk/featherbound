import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { accountSettings, modelSettings } from '@/db/schema';
import { hashPin } from './crypto';

export async function getAccountSettings(userId: string) {
  const [row] = await getDb().select().from(accountSettings).where(eq(accountSettings.userId, userId)).limit(1);
  return row ?? null;
}

export async function markWelcomed(userId: string) {
  await getDb()
    .insert(accountSettings)
    .values({ userId, welcomedAt: new Date() })
    .onConflictDoUpdate({ target: accountSettings.userId, set: { welcomedAt: new Date(), updatedAt: new Date() } });
}

export async function setHandoffPin(userId: string, pin: string) {
  const handoffPinHash = hashPin(pin);
  await getDb()
    .insert(accountSettings)
    .values({ userId, handoffPinHash })
    .onConflictDoUpdate({ target: accountSettings.userId, set: { handoffPinHash, updatedAt: new Date() } });
}

export async function saveModelChoices(userId: string, text: string, images: [string, string, string]) {
  await getDb()
    .insert(modelSettings)
    .values({ userId, textModel: text, imageModels: images })
    .onConflictDoUpdate({ target: modelSettings.userId, set: { textModel: text, imageModels: images, updatedAt: new Date() } });
}
