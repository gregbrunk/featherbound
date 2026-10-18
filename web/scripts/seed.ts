import { getDb } from '../src/db';
import { allowedEmails } from '../src/db/schema';

// Seeds the admin onto the allow list: ADMIN_EMAIL=you@example.com npm run db:seed
// Safe to run repeatedly.
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Set ADMIN_EMAIL to the Google account that should be the admin.');
  await getDb()
    .insert(allowedEmails)
    .values({ email, isAdmin: true })
    .onConflictDoNothing();
  console.log(`Allow list seeded with ${email} as admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
