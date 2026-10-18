import Tuft from './Tuft';

export default function PageLoading() {
  return (
    <main className="page center stack" style={{ alignItems: 'center', paddingTop: 60 }}>
      <Tuft pose="read" size={90} />
      <p className="muted small">Opening…</p>
    </main>
  );
}
