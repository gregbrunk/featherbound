'use client';

// Last resort when even the root layout fails: plain HTML, no app styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#fbf4e4', color: '#2b2140', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1>Featherbound hit a snag</h1>
          <p>Something went wrong loading the app. Trying again usually works.</p>
          <button onClick={reset} style={{ padding: '10px 18px', borderRadius: 999, border: 0, background: '#4b2e83', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
