import { redirect } from 'next/navigation';
import { getAccountSettings } from '@/lib/account';
import { listKeys } from '@/lib/keys';
import { requireAccount } from '@/lib/session';
import Onboarding from './Onboarding';


// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export const metadata = { title: 'Welcome · Featherbound' };

export default async function WelcomePage() {
  const account = await requireAccount();
  const [settings, keys] = await Promise.all([getAccountSettings(account.userId), listKeys(account.userId)]);
  // Key setup runs once. After that, /welcome just replays the tour.
  if (settings?.welcomedAt) redirect('/tour');
  const ok = Object.fromEntries(keys.filter((k) => k.status === 'ok').map((k) => [k.provider, k.last4]));
  return <Onboarding first={account.name?.split(' ')[0]} saved={{ gateway: ok.gateway, anthropic: ok.anthropic }} />;
}
