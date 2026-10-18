'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import { Modal, ModalHead } from '@/components/ui';
import { deleteEdition, startAnalysis } from '../edition-actions';

/** Asks before reading the book with the account's AI key, showing what it will cost. */
export function StartAnalysisButton({ bookId, title, cost, minutes, model, hasKey, again = false }: {
  bookId: string; title: string; cost: string; minutes: string; model: string; hasKey: boolean; again?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!hasKey) {
    return <Link href="/settings?tab=models" className="btn btn-primary"><Icon name="key" size={18} /> Add an AI key first</Link>;
  }
  return (
    <>
      <button className={again ? 'btn btn-ghost btn-sm' : 'btn btn-primary'} onClick={() => setOpen(true)}>
        <Icon name={again ? 'refresh' : 'book'} size={again ? 16 : 18} /> {again ? 'Read it again' : 'Read it through'}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} label="Read the book">
          <ModalHead title={`Read ${title}?`} pose="read" onClose={() => setOpen(false)} />
          <div className="stack">
            <p>I’ll read every chapter and note what’s in it, then write a Story Bible of the characters, places and plot threads. Every edition uses both.</p>
            <div className="estimate-strip">
              <div><span className="tiny faint">About</span><strong>{cost}</strong></div>
              <div><span className="tiny faint">Takes</span><strong>{minutes}</strong></div>
              <div><span className="tiny faint">Using</span><strong>{model}</strong></div>
            </div>
            <p className="small muted">This is billed to your own AI key. You can leave this page; I’ll keep reading.</p>
            {message && <p className="small status-bad">{message}</p>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Not now</button>
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() => start(async () => {
                  const r = await startAnalysis(bookId);
                  if (!r.ok) { setMessage(r.message ?? 'Something went wrong.'); return; }
                  setOpen(false);
                  router.refresh();
                })}
              >
                {pending ? 'Starting…' : `Read it for about ${cost}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Progress while the analysis runs; refreshes the page until it's done. */
export function AnalysisProgress({ done, total }: { done: number; total: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [router]);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="card card-tinted row" style={{ gap: 20, flexWrap: 'wrap' }}>
      <Tuft pose="read" size={80} />
      <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
        <h3>{done < total ? `Reading chapter ${Math.min(done + 1, total)} of ${total}…` : 'Writing the Story Bible…'}</h3>
        <div className="progress-bar" style={{ maxWidth: 420 }}><i style={{ width: `${pct}%` }} /></div>
        <p className="small muted">You can leave this page. I’ll keep reading.</p>
      </div>
    </div>
  );
}

export function DeleteEditionButton({ bookId, editionId, name }: { bookId: string; editionId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--ruby)' }} onClick={() => setOpen(true)}><Icon name="trash" size={16} /> Delete</button>
      {open && (
        <Modal onClose={() => setOpen(false)} label="Delete edition">
          <ModalHead title="Delete this edition?" pose="worry" onClose={() => setOpen(false)} />
          <p><strong>{name}</strong> will be deleted. The original book stays on the shelf.</p>
          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Keep it</button>
            <button className="btn btn-danger" disabled={pending} onClick={() => start(async () => { await deleteEdition(bookId, editionId); setOpen(false); })}>
              {pending ? 'Deleting…' : 'Delete edition'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
