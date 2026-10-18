import Link from 'next/link';
import { asc } from 'drizzle-orm';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import { getDb } from '@/db';
import { allowedEmails } from '@/db/schema';
import { getAccountSettings } from '@/lib/account';
import { getModelChoices } from '@/lib/ai';
import { listKeys } from '@/lib/keys';
import { IMAGE_MODELS, PROVIDERS, TEXT_MODELS, keyFor } from '@/lib/models';
import { requireAccount } from '@/lib/session';
import { AddEmailForm, KeyRow, ModelsForm, PinForm, RemoveEmailButton } from './forms';


// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export const metadata = { title: 'Settings · Featherbound' };

type Tab = 'models' | 'access' | 'handoff' | 'about';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const account = await requireAccount();
  const { tab: raw } = await searchParams;
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'models', label: 'AI models & keys', icon: 'key' },
    ...(account.isAdmin ? [{ id: 'access' as Tab, label: 'Sign-in access', icon: 'users' }] : []),
    { id: 'handoff', label: 'Hand-off PIN', icon: 'lock' },
    { id: 'about', label: 'About', icon: 'feather' },
  ];
  const tab = (tabs.find((t) => t.id === raw)?.id ?? 'models') as Tab;

  return (
    <main className="page">
      <h1 style={{ marginBottom: 18 }}>Settings</h1>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map((t) => (
            <Link key={t.id} href={`/settings?tab=${t.id}`} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={18} /> {t.label}
            </Link>
          ))}
        </nav>
        <section style={{ minWidth: 0 }}>
          {tab === 'models' && <ModelsTab userId={account.userId} />}
          {tab === 'access' && account.isAdmin && <AccessTab adminEmail={account.email} />}
          {tab === 'handoff' && <HandoffTab userId={account.userId} />}
          {tab === 'about' && <AboutTab />}
        </section>
      </div>
    </main>
  );
}

async function ModelsTab({ userId }: { userId: string }) {
  const [keys, choices] = await Promise.all([listKeys(userId), getModelChoices(userId)]);
  const byProvider = Object.fromEntries(keys.map((k) => [k.provider, k]));
  const working = Object.fromEntries(keys.filter((k) => k.status === 'ok').map((k) => [k.provider, true]));
  const reachable = Object.fromEntries([...TEXT_MODELS, ...IMAGE_MODELS].map((m) => [m.id, keyFor(m.provider, working) !== null]));
  return (
    <div className="stack-lg">
      <div className="guide">
        <Tuft pose="think" size={64} />
        <div className="bubble">I write with one model and draw with up to three. Your keys pay only for what you run. Other accounts set up their own.</div>
      </div>
      <div className="card stack">
        <div>
          <h3>Your API keys</h3>
          <p className="small muted">Keys are checked when you save them, encrypted, and never shown again (only the last four characters). One Vercel AI Gateway key covers every model at the providers’ list prices.</p>
        </div>
        {PROVIDERS.map((p) => (
          <KeyRow key={p.id} provider={p.id} name={p.name} hint={p.hint} recommended={p.recommended}
            saved={byProvider[p.id] ? { provider: p.id, last4: byProvider[p.id].last4, status: byProvider[p.id].status, statusDetail: byProvider[p.id].statusDetail } : undefined} />
        ))}
      </div>
      <ModelsForm text={choices.text} images={choices.images} reachable={reachable} />
    </div>
  );
}

async function AccessTab({ adminEmail }: { adminEmail: string }) {
  const rows = await getDb().select().from(allowedEmails).orderBy(asc(allowedEmails.addedAt));
  return (
    <div className="stack-lg">
      <div className="guide">
        <Tuft pose="guard" size={64} />
        <div className="bubble">Only emails on this list can sign in with Google. Each account gets its own private library, keys and settings. Nothing is shared between accounts.</div>
      </div>
      <div className="card stack">
        <h3>Approved accounts</h3>
        <ul className="people">
          {rows.map((r) => (
            <li key={r.email}>
              <div className="avatar">{r.email[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong className="ellipsis" style={{ display: 'block' }}>{r.email}</strong>
                <span className="tiny faint">Added {r.addedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              {r.isAdmin ? <span className="chip chip-gold">Admin{r.email === adminEmail.toLowerCase() ? ' · you' : ''}</span> : <RemoveEmailButton email={r.email} />}
            </li>
          ))}
        </ul>
        <AddEmailForm />
        <p className="small muted">They sign in with their own Google account and start fresh: an empty library, their own AI keys and their own settings. Nothing is sent to them, so let them know yourself.</p>
      </div>
    </div>
  );
}

async function HandoffTab({ userId }: { userId: string }) {
  const settings = await getAccountSettings(userId);
  return (
    <div className="stack-lg">
      <div className="guide">
        <Tuft pose="guard" size={64} />
        <div className="bubble">When you hand a device to a kid, you’ll lock it to one book from the reader. To unlock, press and hold me, then enter this PIN.</div>
      </div>
      <div className="card stack">
        <h3>Parent PIN</h3>
        <PinForm hasPin={Boolean(settings?.handoffPinHash)} />
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="card card-lg row" style={{ gap: 24, flexWrap: 'wrap' }}>
      <Tuft pose="read" size={120} />
      <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
        <h2>Featherbound</h2>
        <p className="muted">Books we love, made softer than 2-ply. A private library: a 10 Ply project.</p>
      </div>
    </div>
  );
}
