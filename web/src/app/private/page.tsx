import Tuft from '@/components/Tuft';
import { SignOutButton } from '@/components/AuthButtons';

export const metadata = { title: 'Private · Featherbound' };

export default function PrivatePage() {
  return (
    <main className="gate">
      <div className="gate-card">
        <Tuft pose="guard" size={140} />
        <h1 className="gate-title" style={{ fontSize: 34 }}>This library is private</h1>
        <p className="muted">That Google account isn’t on Featherbound’s approved list. If you think it should be, ask the admin to add you.</p>
        <SignOutButton />
      </div>
    </main>
  );
}
