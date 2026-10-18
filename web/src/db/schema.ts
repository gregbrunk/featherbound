import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

// Better Auth's tables (user, session, account, verification). A Better Auth `user` is a
// Featherbound account: it owns one private library. Every table below except the allow list
// carries user_id and is only read or written through the account-scoped helpers in src/lib.
export * from './auth-schema';

/** Emails allowed to sign in. The admin manages this list; it is the only cross-account table. */
export const allowedEmails = pgTable('allowed_emails', {
  email: text('email').primaryKey(),
  isAdmin: boolean('is_admin').notNull().default(false),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Per-account settings that aren't part of sign-in. */
export const accountSettings = pgTable('account_settings', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  handoffPinHash: text('handoff_pin_hash'),
  welcomedAt: timestamp('welcomed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type KeyProvider = 'gateway' | 'anthropic' | 'openai' | 'google' | 'xai';

/** AI keys, encrypted with AES-256-GCM (see src/lib/crypto.ts). Never sent to the browser. */
export const apiKeys = pgTable(
  'api_keys',
  {
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').$type<KeyProvider>().notNull(),
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    keyVersion: integer('key_version').notNull().default(1),
    last4: text('last4').notNull(),
    status: text('status').$type<'ok' | 'invalid'>().notNull(),
    statusDetail: text('status_detail'),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
);

/** Which models this account writes and draws with. Images are tried in order. */
export const modelSettings = pgTable('model_settings', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  textModel: text('text_model').notNull(),
  imageModels: jsonb('image_models').$type<[string, string, string]>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Every AI call, for the usage dashboard, estimates and cost caps. */
export const aiCalls = pgTable(
  'ai_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    runId: uuid('run_id'),
    kind: text('kind').notNull(),
    model: text('model').notNull(),
    keySource: text('key_source').$type<KeyProvider>().notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    images: integer('images').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    ms: integer('ms').notNull().default(0),
    refused: boolean('refused').notNull().default(false),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_calls_user_created_idx').on(t.userId, t.createdAt)],
);
