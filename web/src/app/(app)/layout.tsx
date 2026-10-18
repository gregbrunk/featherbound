import { Suspense } from 'react';
import AccountMenu from '@/components/AccountMenu';
import AppShell from '@/components/AppShell';
import PageLoading from '@/components/PageLoading';

// Pages under (app) read the session (requireAccount), so they stream in behind Suspense
// while the shell prerenders.
// Signed-in pages read the session on every request. They wait for the server on navigation
// (with Tuft's loading screen) instead of aiming for Next's prerendered instant navigation.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell account={<Suspense fallback={<div className="avatar" aria-hidden="true" />}><AccountMenu /></Suspense>}>
      <Suspense fallback={<PageLoading />}>{children}</Suspense>
    </AppShell>
  );
}
