import Tuft from '@/components/Tuft';
import { SignOutButton } from '@/components/AuthButtons';

export const metadata = { title: 'Private · Featherbound' };

export default function PrivatePage() {
  return (
    <main className="gate">
      <div className="gate-card">
        <Tuft pose="guard" size={140} />
        <h1 className="gate-title" style={{ fontSize: 34 }}>This library is private</h1>
        <p className="muted">That Google account hasn’t been invited. Featherbound is in a closed beta, and we aren’t taking invite requests right now.</p>
        <SignOutButton />
      </div>
    </main>
  );
}
