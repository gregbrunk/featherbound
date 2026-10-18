import Link from 'next/link';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import { markWelcomed } from '@/lib/account';
import { listKeys } from '@/lib/keys';
import { requireAccount } from '@/lib/session';


// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export const metadata = { title: 'Welcome · Featherbound' };

export default async function WelcomePage() {
  const account = await requireAccount();
  const keys = await listKeys(account.userId);
  const hasKey = keys.some((k) => k.status === 'ok');
  await markWelcomed(account.userId);
  const first = account.name?.split(' ')[0];

  return (
    <main className="page page-narrow">
      <section className="card card-lg center stack" style={{ alignItems: 'center', marginTop: 20 }}>
        <Tuft pose="wave" size={140} />
        <h1>Welcome{first ? `, ${first}` : ''}!</h1>
        <p className="muted" style={{ maxWidth: 520 }}>
          I’m Tuft. This library is all yours: your books, your softened editions and your settings. Two quick steps and we can start reading.
        </p>
      </section>
      <ol className="welcome-steps">
        <li className="card">
          <span className="welcome-num">{hasKey ? <Icon name="check" size={20} stroke={3} /> : 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>Add your AI key</h3>
            <p className="small muted">I need a key to write and draw. One Vercel AI Gateway key covers every model at list price. Your key pays only for what you run.</p>
          </div>
          {hasKey ? <span className="chip chip-emerald">Done</span> : <Link href="/settings?tab=models" className="btn btn-primary btn-sm"><Icon name="key" size={16} /> Add key</Link>}
        </li>
        <li className="card">
          <span className="welcome-num">2</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>Add your first book</h3>
            <p className="small muted">Upload a DRM-free EPUB or PDF you own. I’ll read it, find its cover and series, and help you make a softer edition. (Coming next.)</p>
          </div>
          <Link href="/" className="btn btn-secondary btn-sm"><Icon name="book" size={16} /> Go to my library</Link>
        </li>
      </ol>
    </main>
  );
}
