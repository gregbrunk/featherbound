import { getDb } from '../src/db';
import { allowedEmails } from '../src/db/schema';

// Seeds the admin onto the allow list. Safe to run repeatedly.
async function main() {
  await getDb()
    .insert(allowedEmails)
    .values({ email: 'parent@example.com', isAdmin: true })
    .onConflictDoNothing();
  console.log('Allow list seeded.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
