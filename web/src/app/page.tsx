import Tuft from '@/components/Tuft';

// Phase 0 placeholder: sign-in and the library arrive in Phase 1 and 2.
export default function Home() {
  return (
    <main className="gate">
      <div className="gate-card">
        <Tuft pose="wave" size={150} />
        <h1 className="gate-title">Featherbound</h1>
        <p className="muted">Your private library, where every book is a little softer.</p>
        <p className="tiny faint">Coming soon · Phase 0</p>
      </div>
    </main>
  );
}
