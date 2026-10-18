import { redirect } from 'next/navigation';
import Tuft from '@/components/Tuft';
import { getAccountSettings } from '@/lib/account';
import { requireAccount } from '@/lib/session';


// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

// The library arrives in Phase 2. Until then, new accounts go to the welcome screen first.
export default async function LibraryPage() {
  const account = await requireAccount();
  const settings = await getAccountSettings(account.userId);
  if (!settings?.welcomedAt) redirect('/welcome');
  return (
    <main className="page">
      <h1>My Library</h1>
      <section className="shelf-section">
        <div className="shelf empty-shelf">
          <div className="row" style={{ gap: 14 }}>
            <Tuft pose="read" size={70} />
            <span className="muted small">Your shelves are empty… for now. Adding books comes next.</span>
          </div>
        </div>
        <div className="shelf-board" />
      </section>
    </main>
  );
}
