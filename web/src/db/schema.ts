import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Phase 0 baseline. Every table added later (books, editions, runs, …) carries an account_id,
// and is read and written only through the account-scoped data layer (see docs/BUILD_PLAN.md).

/** Emails allowed to sign in. The admin manages this list; it is the only cross-account table. */
export const allowedEmails = pgTable('allowed_emails', {
  email: text('email').primaryKey(),
  isAdmin: boolean('is_admin').notNull().default(false),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One account per signed-in person. Each account owns its own private library. */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: text('auth_user_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  handoffPinHash: text('handoff_pin_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
