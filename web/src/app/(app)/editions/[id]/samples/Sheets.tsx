'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import type { SheetStatus } from '@/db/schema';
import { approveSheet, redrawSheetAction } from '../../../books/edition-actions';

export type SheetView = { id: string; name: string; description: string; status: SheetStatus; imageId: string | null; model: string | null; error: string | null };

/** Approve or redraw each main character before any scene is drawn. */
export default function Sheets({ bookId, look, error, sheets }: { bookId: string; look: string | null; error: string | null; sheets: SheetView[] }) {
  const router = useRouter();
  const drawing = sheets.some((s) => s.status === 'drawing');
  useEffect(() => {
    if (!drawing) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [drawing, router]);
  const approved = sheets.filter((s) => s.status === 'approved').length;

  if (error && !sheets.length) {
    return (
      <div className="card row" style={{ gap: 14, flexWrap: 'wrap' }}>
        <Tuft pose="worry" size={60} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3>I couldn’t work out the pictures yet</h3>
          <p className="small muted">{error}</p>
        </div>
      </div>
    );
  }
  if (!sheets.length) return null;

  return (
    <section className="card stack">
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
          <h2>Meet the characters</h2>
          <p className="muted small">{look ? <>The look: <strong>{look}</strong>. </> : null}Every picture uses these drawings, so check them before I draw any scenes.</p>
        </div>
        <span className={`chip ${approved === sheets.length ? 'chip-emerald' : 'chip-gold'}`}>{approved} of {sheets.length} approved</span>
      </div>
      <div className="sheet-grid">
        {sheets.map((s) => <SheetCard key={s.id} bookId={bookId} sheet={s} />)}
      </div>
    </section>
  );
}

function SheetCard({ bookId, sheet: s }: { bookId: string; sheet: SheetView }) {
  const [redrawing, setRedrawing] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => {
    const r = await fn();
    if (!r.ok) setMessage(r.message ?? 'Something went wrong.');
    else { setRedrawing(false); setNote(''); router.refresh(); }
  });
  return (
    <article className={`sheet-card ${s.status === 'approved' ? 'approved' : ''}`}>
      <div className="sheet-art">
        {s.status === 'drawing' ? (
          <div className="center stack-sm" style={{ alignItems: 'center' }}><Tuft pose="write" size={60} /><span className="tiny muted">Drawing…</span></div>
        ) : s.imageId ? (
          // Drawn pictures come from the auth-checked image route.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/books/${bookId}/images/${s.imageId}`} alt={`Character sheet: ${s.name}`} />
        ) : (
          <div className="center stack-sm" style={{ alignItems: 'center', padding: 12 }}><Tuft pose="worry" size={50} /><span className="tiny muted">{s.error ?? 'Not drawn yet'}</span></div>
        )}
      </div>
      <div className="stack-sm" style={{ padding: '10px 12px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <strong>{s.name}</strong>
          {s.status === 'approved' && <span className="chip chip-emerald"><Icon name="check" size={12} stroke={3} /> Approved</span>}
        </div>
        <p className="tiny muted clamp-3" title={s.description}>{s.description}</p>
        {redrawing ? (
          <div className="stack-sm">
            <textarea className="textarea" style={{ minHeight: 60 }} value={note} maxLength={500} autoFocus onChange={(e) => setNote(e.target.value)} placeholder="What should change? (optional)" />
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(() => redrawSheetAction(s.id, note))}>{pending ? 'Starting…' : 'Redraw'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setRedrawing(false)}>Cancel</button>
            </div>
          </div>
        ) : s.status !== 'drawing' && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {s.status === 'ready' && <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(() => approveSheet(s.id))}><Icon name="check" size={14} /> Approve</button>}
            {s.status === 'approved' && <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act(() => approveSheet(s.id, false))}>Undo</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => setRedrawing(true)}><Icon name="refresh" size={14} /> Redraw</button>
          </div>
        )}
        {message && <p className="tiny status-bad">{message}</p>}
      </div>
    </article>
  );
}
