import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
  libraryPrefs: jsonb('library_prefs'),
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

// ── Library ──────────────────────────────────────────────────────────────────────────

export type CoverSpec = { from: string; to: string; emblem: string; ink?: string };

export const series = pgTable(
  'series',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    author: text('author'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('series_user_idx').on(t.userId)],
);

export type BookStatus = 'importing' | 'review' | 'ready' | 'failed';

export type ImportSuggestions = {
  series?: { seriesId?: string; name: string; position?: number; reason: string };
  genres?: string[];
  covers?: { source: 'file' | 'openlibrary'; url: string; label: string }[];
};

export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').$type<BookStatus>().notNull().default('importing'),
    title: text('title').notNull(),
    author: text('author').notNull().default(''),
    seriesId: uuid('series_id').references(() => series.id, { onDelete: 'set null' }),
    seriesOrder: real('series_order'),
    seriesLabel: text('series_label'),
    genres: jsonb('genres').$type<string[]>().notNull().default([]),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    description: text('description'),
    language: text('language'),
    isbn: text('isbn'),
    format: text('format').$type<'EPUB' | 'PDF'>(),
    fileName: text('file_name').notNull(),
    sourcePath: text('source_path').notNull(),
    sourceSize: integer('source_size').notNull().default(0),
    coverPath: text('cover_path'),
    coverFallback: jsonb('cover_fallback').$type<CoverSpec>(),
    words: integer('words').notNull().default(0),
    chapterCount: integer('chapter_count').notNull().default(0),
    warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
    suggestions: jsonb('suggestions').$type<ImportSuggestions>(),
    importError: text('import_error'),
    workflowRunId: text('workflow_run_id'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('books_user_idx').on(t.userId), index('books_series_idx').on(t.seriesId)],
);

/** A section of the original book. Its text is stored in Blob, content-addressed by hash. */
export const bookSections = pgTable(
  'book_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    title: text('title').notNull(),
    kind: text('kind').$type<'chapter' | 'front' | 'back'>().notNull(),
    include: boolean('include').notNull(),
    words: integer('words').notNull().default(0),
    textPath: text('text_path').notNull(),
  },
  (t) => [index('book_sections_book_idx').on(t.bookId, t.position)],
);

/** Where the reader is, per book or (later) edition. `target` is "book:<id>" or "edition:<id>". */
export const readingProgress = pgTable(
  'reading_progress',
  {
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    target: text('target').notNull(),
    sectionId: uuid('section_id').notNull(),
    fraction: real('fraction').notNull().default(0),
    percent: real('percent').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.target] })],
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    target: text('target').notNull(),
    sectionId: uuid('section_id').notNull(),
    fraction: real('fraction').notNull().default(0),
    label: text('label').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('bookmarks_user_target_idx').on(t.userId, t.target)],
);
