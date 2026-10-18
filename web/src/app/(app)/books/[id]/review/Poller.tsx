'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import Icon from '@/components/Icon';
import { retryImport } from '../../actions';

/** Refreshes the page every couple of seconds while the import runs. */
export function Poller() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

export function RetryButton({ bookId }: { bookId: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn btn-secondary" disabled={pending} onClick={() => start(() => retryImport(bookId))}>
      <Icon name="refresh" size={16} /> Try again
    </button>
  );
}
