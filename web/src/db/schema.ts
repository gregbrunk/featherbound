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
  monthlyBudget: numeric('monthly_budget', { precision: 10, scale: 2 }),
  /** Email when samples are ready, an edition is done, or a run pauses or fails. */
  emailNotices: boolean('email_notices').notNull().default(true),
  /** Use a provider's own key (e.g. Anthropic) for its models instead of the AI Gateway key. */
  preferDirectKeys: boolean('prefer_direct_keys').notNull().default(true),
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
    /** The look researched for an earlier book in the series; later books start from it. */
    visualDirection: jsonb('visual_direction').$type<ArtDirection>(),
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

// ── Analysis & editions ──────────────────────────────────────────────────────────────

/** One read-through of a book that produces the Content Report and the Story Bible. */
export const bookAnalyses = pgTable(
  'book_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    status: text('status').$type<'running' | 'ready' | 'failed'>().notNull().default('running'),
    chaptersDone: integer('chapters_done').notNull().default(0),
    chaptersTotal: integer('chapters_total').notNull().default(0),
    model: text('model').notNull(),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    error: text('error'),
    workflowRunId: text('workflow_run_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('book_analyses_book_idx').on(t.bookId, t.startedAt)],
);

export type Intensities = Partial<Record<'language' | 'violence' | 'scariness' | 'death' | 'romance' | 'substances' | 'mature' | 'meanness' | 'crude', 0 | 1 | 2 | 3>>;

/** What the analysis found in one chapter. */
export const sectionAnalyses = pgTable(
  'section_analyses',
  {
    analysisId: uuid('analysis_id').notNull().references(() => bookAnalyses.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').notNull().references(() => bookSections.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    intensities: jsonb('intensities').$type<Intensities>().notNull(),
    notes: jsonb('notes').$type<Partial<Record<string, string>>>().notNull(),
    summary: text('summary').notNull(),
    characters: jsonb('characters').$type<{ name: string; look: string }[]>().notNull().default([]),
    places: jsonb('places').$type<{ name: string; look: string }[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.analysisId, t.sectionId] })],
);

export type StoryBible = {
  characters: { name: string; role: string; look: string; note: string }[];
  places: { name: string; look: string }[];
  threads: string[];
  themes: string[];
  keyScenes: { chapter: number; scene: string }[];
};

export const storyBibles = pgTable('story_bibles', {
  bookId: uuid('book_id').primaryKey().references(() => books.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  analysisId: uuid('analysis_id').notNull().references(() => bookAnalyses.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<StoryBible>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** The visual direction for an illustrated edition, from the research step. */
export type ArtDirection = {
  /** e.g. "W. W. Denslow's 1900 originals". */
  look: string;
  /** Other looks the research found, for the parent to pick from later. */
  options: { name: string; note: string }[];
  /** Drawing instructions in visual terms; goes into every picture prompt. */
  style: string;
  palette: string;
  /** Image ids (in the book's images folder) used as style references. */
  references: string[];
  researchedAt: string;
  error?: string;
};

export type EditionStatus = 'draft' | 'making-samples' | 'samples-ready' | 'running' | 'paused-cap' | 'ready' | 'failed';

export const editions = pgTable(
  'editions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    settings: jsonb('settings').notNull(),
    status: text('status').$type<EditionStatus>().notNull().default('draft'),
    costCap: numeric('cost_cap', { precision: 10, scale: 2 }).notNull(),
    estimate: jsonb('estimate').$type<{ total: number; samples: number; minutes: number }>(),
    sampleGuidance: jsonb('sample_guidance').$type<string[]>().notNull().default([]),
    currentVersion: text('current_version'),
    /** Picture Book mode: the researched look every picture follows. */
    art: jsonb('art').$type<ArtDirection>(),
    /** Shown on the library until the parent opens the edition. */
    notice: text('notice').$type<'samples-ready' | 'paused-cap' | 'ready' | 'failed'>(),
    noticeAt: timestamp('notice_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('editions_book_idx').on(t.userId, t.bookId)],
);

// ── Adaptation ─────────────────────────────────────────────────────────────────────

export type SampleComment = { sectionId: string; quote: string; text: string };
export type VersionLevel = 'major' | 'minor' | 'patch';
/** What a refinement run was asked to do. */
export type PictureOp = { sectionId: string; imageId: string; action: 'redraw' | 'remove' | 'replace'; note?: string; uploadPath?: string };
export type RefineSpec = {
  scope: 'whole' | 'chapters' | 'passage' | 'pictures';
  /** For pictures: what to do to each one. */
  pictures?: PictureOp[];
  guidance: string;
  level: VersionLevel;
  /** The version the run started from; the new version is built on its manifest. */
  baseVersion: string;
  /** For a passage: which paragraph (block index) of which chapter. */
  passage?: { sectionId: string; index: number };
};
export type RunStatus = 'running' | 'paused-cap' | 'ready' | 'failed' | 'stopped';

/** One background run on an edition: a round of samples, or the full book. */
export const editionRuns = pgTable(
  'edition_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    editionId: uuid('edition_id').notNull().references(() => editions.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<'samples' | 'full' | 'refine'>().notNull(),
    refine: jsonb('refine').$type<RefineSpec>(),
    round: integer('round').notNull().default(1),
    status: text('status').$type<RunStatus>().notNull().default('running'),
    sectionIds: jsonb('section_ids').$type<string[]>().notNull(),
    chaptersDone: integer('chapters_done').notNull().default(0),
    estimateUsd: numeric('estimate_usd', { precision: 10, scale: 4 }).notNull().default('0'),
    capUsd: numeric('cap_usd', { precision: 10, scale: 2 }).notNull(),
    spentUsd: numeric('spent_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    /** Feedback the parent left on this round of samples. */
    comments: jsonb('comments').$type<SampleComment[]>().notNull().default([]),
    overall: text('overall').notNull().default(''),
    stage: text('stage'),
    /** Set while paused at the cost cap: the workflow hook that resumes it. */
    hookToken: text('hook_token'),
    error: text('error'),
    workflowRunId: text('workflow_run_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('edition_runs_edition_idx').on(t.editionId, t.startedAt)],
);

export type ChangeNote = { category: string; level: 'Soften' | 'Remove' | 'Reading level' | 'Refine'; note: string };

/** One adapted chapter. Chapters are never edited in place; versions point at them. */
export const editionChapters = pgTable(
  'edition_chapters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    editionId: uuid('edition_id').notNull().references(() => editions.id, { onDelete: 'cascade' }),
    runId: uuid('run_id').notNull().references(() => editionRuns.id, { onDelete: 'cascade' }),
    // Kept when the book is re-imported: an adapted chapter carries its own text and title.
    sectionId: uuid('section_id').references(() => bookSections.id, { onDelete: 'set null' }),
    position: integer('position').notNull(),
    title: text('title').notNull(),
    kidTitle: text('kid_title'),
    recap: text('recap'),
    textPath: text('text_path').notNull(),
    words: integer('words').notNull(),
    originalWords: integer('original_words').notNull(),
    changeNotes: jsonb('change_notes').$type<ChangeNote[]>().notNull().default([]),
    summary: text('summary').notNull().default(''),
    names: jsonb('names').$type<string[]>().notNull().default([]),
    /** Set when the consistency check rewrote this chapter. */
    fixNote: text('fix_note'),
    /** Picture Book mode: the moments chosen for pictures (block index + scene), drawn after the text. */
    moments: jsonb('moments').$type<{ index: number; scene: string; characters: string[]; alt: string }[]>().notNull().default([]),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('edition_chapters_run_idx').on(t.runId, t.position)],
);

/** A published state of an edition: which adapted chapter to show for each section. */
export const editionVersions = pgTable(
  'edition_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    editionId: uuid('edition_id').notNull().references(() => editions.id, { onDelete: 'cascade' }),
    number: text('number').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    level: text('level').$type<'initial' | 'major' | 'minor' | 'patch'>().notNull(),
    guidance: text('guidance').notNull().default(''),
    /** sectionId → edition_chapters.id, in reading order. */
    manifest: jsonb('manifest').$type<{ sectionId: string; chapterId: string }[]>().notNull(),
    runId: uuid('run_id').references(() => editionRuns.id, { onDelete: 'set null' }),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('edition_versions_edition_idx').on(t.editionId, t.createdAt)],
);

// ── Pictures ───────────────────────────────────────────────────────────────────────

export type SheetStatus = 'drawing' | 'ready' | 'approved' | 'failed';

/** One main character's reference drawing. Every scene with them uses it, once approved. */
export const characterSheets = pgTable(
  'character_sheets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    editionId: uuid('edition_id').notNull().references(() => editions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** What they look like, in drawing terms; reused in every scene prompt. */
    description: text('description').notNull(),
    position: integer('position').notNull().default(0),
    status: text('status').$type<SheetStatus>().notNull().default('drawing'),
    imageId: text('image_id'),
    model: text('model'),
    /** After a refusal, this character's pictures stay on the model that drew them. */
    stickyModel: text('sticky_model'),
    note: text('note'),
    error: text('error'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('character_sheets_edition_idx').on(t.editionId, t.position)],
);

/** Every picture drawn (or uploaded) for an edition, with what it was drawn from. */
export const illustrations = pgTable(
  'illustrations',
  {
    /** Also the image id in chapter blocks and in the book's images folder. */
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    editionId: uuid('edition_id').notNull().references(() => editions.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id'),
    runId: uuid('run_id'),
    source: text('source').$type<'drawn' | 'uploaded' | 'redrawn-original'>().notNull(),
    scene: text('scene').notNull().default(''),
    alt: text('alt').notNull().default(''),
    characters: jsonb('characters').$type<string[]>().notNull().default([]),
    model: text('model'),
    /** Models that refused before one drew it. */
    refusedBy: jsonb('refused_by').$type<string[]>().notNull().default([]),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('illustrations_edition_idx').on(t.editionId)],
);
