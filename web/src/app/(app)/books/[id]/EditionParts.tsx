'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import Select from '@/components/Select';
import { Modal, ModalHead, Segmented } from '@/components/ui';
import { deleteEdition, startAnalysis, startSamples } from '../edition-actions';

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

/** Write the first round of sample chapters for a draft edition. */
export function MakeSamplesButton({ editionId, cost, disabled }: { editionId: string; cost: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
      <button className="btn btn-gold" disabled={pending || disabled} title={disabled ? 'Read the book through first' : undefined}
        onClick={() => start(async () => {
          const r = await startSamples(editionId);
          if (!r.ok) setMessage(r.message);
          else router.push(`/editions/${editionId}/samples`);
        })}>
        <Icon name="wand" size={18} /> {pending ? 'Starting…' : `Make sample chapters · ~${cost}`}
      </button>
      {disabled && <span className="tiny muted">Read the book through first (What’s inside tab).</span>}
      {message && <span className="small status-bad">{message}</span>}
    </div>
  );
}

type DownloadVersion = { number: string; name: string; current: boolean };

/** Download an edition (any version) or the original book, as EPUB or PDF. */
export function DownloadButton({ target, id, title, versions, originalName, small = false }: {
  target: 'edition' | 'book'; id: string; title: string; versions?: DownloadVersion[]; originalName?: string; small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<'epub' | 'pdf' | 'original'>(target === 'book' ? 'original' : 'epub');
  const [version, setVersion] = useState(versions?.find((v) => v.current)?.number ?? versions?.[0]?.number ?? '');
  const [started, setStarted] = useState(false);
  const href = target === 'book'
    ? format === 'original' ? `/api/books/${id}/original` : `/api/books/${id}/export?format=${format}`
    : `/api/editions/${id}/export?format=${format}&v=${encodeURIComponent(version)}`;
  const options = [
    ...(target === 'book' ? [{ value: 'original' as const, label: 'Original file' }] : []),
    { value: 'epub' as const, label: 'EPUB (e-readers)' },
    { value: 'pdf' as const, label: 'PDF (print)' },
  ];
  return (
    <>
      <button className={`btn btn-${small ? 'secondary btn-sm' : 'ghost'}`} onClick={() => { setOpen(true); setStarted(false); }}>
        <Icon name="download" size={small ? 16 : 18} /> {target === 'book' ? 'Download original' : 'Download'}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} label="Download">
          <ModalHead title={target === 'book' ? 'Download original' : 'Download edition'} pose="read" onClose={() => setOpen(false)} />
          <div className="stack">
            <p className="muted">{title}</p>
            <div className="field">
              <span className="label">Format</span>
              <Segmented label="Format" value={format} onChange={(v) => { setFormat(v); setStarted(false); }} options={options} />
            </div>
            {versions && versions.length > 0 && (
              <div className="field">
                <span className="label" id="dl-version">Version</span>
                <Select labelledBy="dl-version" value={version} onChange={(v) => { setVersion(v); setStarted(false); }}
                  options={versions.map((v) => ({ value: v.number, label: `v${v.number} “${v.name}”${v.current ? ' (current)' : ''}` }))} />
              </div>
            )}
            <p className="small muted">
              {format === 'original' ? `The file you uploaded${originalName ? ` (${originalName})` : ''}, unchanged.`
                : target === 'book' ? 'Rebuilt from the chapters in your library, with the cover and pictures.'
                : 'Includes the cover, pictures, kid-friendly titles and recaps if this edition has them, and a title-page note with the edition and version.'}
              {format === 'pdf' ? ' A PDF takes up to a minute to prepare for a long book.' : ''}
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>{started ? 'Close' : 'Cancel'}</button>
              <a className="btn btn-primary" href={href} onClick={() => setStarted(true)} download>
                <Icon name="download" size={18} /> {started ? 'Preparing your download…' : `Download ${format === 'original' ? 'file' : format.toUpperCase()}`}
              </a>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
