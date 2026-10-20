import Tuft from '@/components/Tuft';
import { GoogleSignInButton } from '@/components/AuthButtons';

export const metadata = { title: 'Sign in · Featherbound' };

export default function SignInPage() {
  return (
    <main className="gate">
      <div className="gate-card">
        <Tuft pose="wave" size={150} />
        <h1 className="gate-title">Featherbound</h1>
        <p className="muted gate-tagline">Your private family library, where every book is a little softer.</p>
        <GoogleSignInButton />
        <p className="gate-note small">
          Featherbound is in a closed beta. Google sign-in only works for accounts that have been invited, and
          we aren’t taking invite requests right now.
        </p>
        {/* A full page load on purpose: signed out, / is the static marketing page, not an app route. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="tiny" href="/">What is Featherbound?</a>
      </div>
    </main>
  );
}
