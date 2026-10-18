# Featherbound operations

How Featherbound is kept safe and how to put things back. Last reviewed 18 Oct 2026.

## Where everything lives

| What | Where | Notes |
|---|---|---|
| Accounts, books, editions, runs, usage | Neon Postgres (`featherbound-db`, Vercel Marketplace) | Shared by production and local development. |
| Book files, chapter text, pictures, exports | Vercel Blob, private store `featherbound-files` | Under `accounts/<userId>/…`. Chapter text is content-addressed, so versions share unchanged chapters. |
| Nightly database backups | Same Blob store, `backups/YYYY-MM-DD.json.gz` | Not under `accounts/`, so no app route can serve them. |
| API keys | `api_keys` table | AES-256-GCM with `KEY_ENCRYPTION_KEY` (Vercel env). Without that key the backups' copies are useless. |

## Backups

There are two layers:

1. **Neon point-in-time restore** covers recent mistakes. The window depends on the Neon plan: a few hours on the free plan, and days on paid plans. Check it in the Neon console (Vercel → Storage → featherbound-db → Open in Neon → Settings → History retention).
2. **Nightly backup:** at 09:00 UTC, Vercel Cron calls `/api/cron/backup`. The route writes every table to `backups/YYYY-MM-DD.json.gz` and keeps 30 days.
   - Sign-in sessions and Google's OAuth tokens are left out. Google issues new ones at the next sign-in.
   - The route only runs when the `CRON_SECRET` environment variable is set in Vercel:
     ```bash
     npx vercel@latest env add CRON_SECRET production
     ```
     Paste a long random string when asked. One way to make one is `openssl rand -base64 32`. Vercel sends it to the cron route automatically.

Book files don't need a separate backup: Blob stores them durably, and nothing deletes them except deleting a book.

## Restoring

### A whole database (bad migration, mass mistake)

Use Neon's point-in-time restore to roll the branch back to a time before the problem. Neon console → Branches → Restore. Anything after that time is lost, so prefer the account restore below when only one account is affected.

### One account (deleted by mistake, or bad data)

```bash
cd web
# Dry run: lists what the backup holds for that account
npx dotenv -e .env.local -- npx tsx scripts/restore-account.mts backups/2026-10-18.json.gz someone@example.com
# Restore: inserts that account's rows, skipping any that still exist
npx dotenv -e .env.local -- npx tsx scripts/restore-account.mts backups/2026-10-18.json.gz someone@example.com --apply
```

- The script never overwrites rows that still exist, so it's safe to run again.
- To undo a bad change to one book, delete the affected rows first (or the whole book in the app), then restore.
- After a restore the person signs in with Google as usual. Their keys work again only if `KEY_ENCRYPTION_KEY` hasn't changed.

Pick the backup by date: list them with `npx vercel@latest blob list --prefix backups/`.

## Security checks

- **Every route and action checks the account.** `src/lib/security.test.ts` reads the source and fails CI if an API route doesn't check the account, a server action doesn't call `requireAccount()` or `requireAdmin()`, or a client component imports the key, crypto, AI or storage modules.
- **Account isolation:** `quality/isolation.quality.ts` checks, read-only and against the real database, that another account sees none of an account's books, editions, versions, runs, sheets or usage. Run it with:
  ```bash
  npx dotenv -e .env.local -- npx vitest run --config vitest.quality.config.ts quality/isolation.quality.ts
  ```
- **File routes:** every file is read from `accounts/<signed-in user>/…` after the book or edition is confirmed to belong to them. Uploads are only signed for the user's own `uploads/` folder.
- **Hand-off lock:** a signed, HTTP-only cookie (HMAC with `BETTER_AUTH_SECRET`). The proxy redirects every other page to the locked reader and refuses other API calls. The PIN is checked on the server (scrypt), with a one-minute wait after five wrong tries.
- **Keys:** never sent to the browser; Settings shows only the last four characters. AI calls always pass the account's own key explicitly (`src/lib/ai.ts`, `src/lib/images.ts`), so nothing is billed to the deployment's own credentials.

## Paid checks

- `npm run quality` adapts two public-domain Oz chapters and has a judge model grade them (about $0.40). It needs `AI_GATEWAY_API_KEY`.
- The GitHub workflow "Adaptation quality" runs it by hand, or when the prompt changes, if that repository secret is set.
