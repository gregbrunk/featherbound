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
        <p className="tiny faint">Private · approved accounts only</p>
      </div>
    </main>
  );
}
