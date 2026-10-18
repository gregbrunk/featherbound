import { gzipSync } from 'node:zlib';
import { neon } from '@neondatabase/serverless';
import { del, list, put } from '@vercel/blob';

// Nightly logical backup of the database to the private Blob store, alongside the files
// (which already live there). Neon's point-in-time restore covers recent mistakes; this
// covers everything older, for 30 days. Restore one account with scripts/restore-account.mts.

/** Tables in dependency order, so a restore can insert them front to back. */
export const BACKUP_TABLES = [
  'user', 'account', 'allowed_emails', 'account_settings', 'api_keys', 'model_settings',
  'series', 'books', 'book_sections', 'reading_progress', 'bookmarks',
  'book_analyses', 'section_analyses', 'story_bibles',
  'editions', 'edition_runs', 'edition_chapters', 'edition_versions', 'character_sheets', 'illustrations',
  'ai_calls',
] as const;

/** Never copied: sign-in tokens (Google issues new ones) and live sessions. */
const DROP_COLUMNS: Record<string, string[]> = { account: ['access_token', 'refresh_token', 'id_token', 'password'] };

export const BACKUP_PREFIX = 'backups/';
const KEEP_DAYS = 30;

export async function takeBackup(now = new Date()) {
  const sql = neon(process.env.DATABASE_URL!);
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    const rows = (await sql.query(`select * from "${t}"`)) as Record<string, unknown>[];
    const drop = DROP_COLUMNS[t] ?? [];
    tables[t] = drop.length ? rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !drop.includes(k)))) : rows;
  }
  const [migration] = (await sql.query('select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1')) as { hash: string; created_at: string }[];
  const body = gzipSync(JSON.stringify({ takenAt: now.toISOString(), migration, tables }));
  const pathname = `${BACKUP_PREFIX}${now.toISOString().slice(0, 10)}.json.gz`;
  await put(pathname, body, { access: 'private', contentType: 'application/gzip', addRandomSuffix: false, allowOverwrite: true });

  // Keep the last 30 days.
  const cutoff = now.getTime() - KEEP_DAYS * 86_400_000;
  const { blobs } = await list({ prefix: BACKUP_PREFIX });
  const old = blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff).map((b) => b.pathname);
  if (old.length) await del(old);
  return { pathname, bytes: body.length, rows: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])) };
}
