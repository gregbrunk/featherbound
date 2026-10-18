'use client';

import ErrorState from '@/components/ErrorState';

// Shown when a page in the app throws. The error is logged on the server; the digest helps find it.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="Something went wrong"
      message={`I tripped over something while loading this page. Trying again usually works.${error.digest ? ` (Reference ${error.digest})` : ''}`}
      action={<button className="btn btn-primary" onClick={reset}>Try again</button>}
    />
  );
}
