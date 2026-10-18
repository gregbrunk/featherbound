// Restore one account from a nightly backup (src/lib/backup.ts).
//
//   npx dotenv -e .env.local -- npx tsx scripts/restore-account.mts <backup pathname> <email> [--apply]
//
// Without --apply it only reports what it would restore. With --apply it inserts that account's
// rows table by table, skipping any that still exist (so it's safe to re-run, and it never
// overwrites newer data). Files (chapter text, pictures) live in Blob and aren't touched.
import { gunzipSync } from 'node:zlib';
import { neon } from '@neondatabase/serverless';
import { get } from '@vercel/blob';
import { BACKUP_TABLES } from '../src/lib/backup';

const [pathname, email] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const apply = process.argv.includes('--apply');
if (!pathname || !email) {
  console.error('Usage: restore-account.mts <backups/YYYY-MM-DD.json.gz> <email> [--apply]');
  process.exit(1);
}

const res = await get(pathname, { access: 'private' });
if (!res || res.statusCode !== 200) throw new Error(`Backup not found: ${pathname}`);
const backup = JSON.parse(gunzipSync(Buffer.from(await new Response(res.stream).arrayBuffer())).toString()) as {
  takenAt: string; tables: Record<string, Record<string, unknown>[]>;
};
const user = backup.tables.user.find((u) => String(u.email).toLowerCase() === email.toLowerCase());
if (!user) throw new Error(`No account for ${email} in ${pathname}`);
const userId = String(user.id);
console.log(`Backup from ${backup.takenAt}; account ${email} (${userId})${apply ? '' : ' (dry run: add --apply to restore)'}`);

const sql = neon(process.env.DATABASE_URL!);
for (const table of BACKUP_TABLES) {
  const rows = (backup.tables[table] ?? []).filter((r) =>
    table === 'user' ? r.id === userId : table === 'allowed_emails' ? String(r.email).toLowerCase() === email.toLowerCase() : r.user_id === userId);
  if (!rows.length) continue;
  let inserted = 0;
  if (apply) {
    for (const r of rows) {
      const cols = Object.keys(r);
      const values = cols.map((c) => (r[c] !== null && typeof r[c] === 'object' && !(r[c] instanceof Date) ? JSON.stringify(r[c]) : r[c]));
      const out = await sql.query(
        `insert into "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) on conflict do nothing returning 1`,
        values,
      );
      inserted += out.length;
    }
  }
  console.log(`${table.padEnd(18)} ${rows.length} rows${apply ? `, ${inserted} restored` : ''}`);
}
