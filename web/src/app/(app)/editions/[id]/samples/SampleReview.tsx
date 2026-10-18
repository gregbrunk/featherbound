'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import Tuft from '@/components/Tuft';
import { Guide, Modal, ModalHead, Segmented } from '@/components/ui';
import type { ChangeNote, SampleComment } from '@/db/schema';
import { fmtMinutes, money } from '@/lib/estimate';
import type { Block } from '@/lib/import/types';
import { approveSamples, resumeRun, rewriteSamples, startSamples } from '../../../books/edition-actions';
import Sheets, { type SheetView } from './Sheets';

const safeInline = (html: string) => html.replace(/<(?!\/?(em|strong)>|br\s*\/?>)[^>]*>/gi, '');
const plain = (html: string) => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, '’');

type Sample = {
  sectionId: string; number: number; title: string; kidTitle: string | null; recap: string | null; why: string;
  original: Block[]; softened: Block[]; changeNotes: ChangeNote[]; words: number; originalWords: number;
};

/** Shown while a round of samples is being written (or if it failed). Refreshes until it's done. */
export function SamplesWriting({ bookId, bookTitle, editionName, round, runId, chapters, done, error, pictures }: {
  bookId: string; bookTitle: string; editionName: string; round: number; runId: string; chapters: string[]; done: number; error: string | null; pictures: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (error) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [router, error]);
  return (
    <main className="page page-narrow">
      <Link href={`/books/${bookId}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> {bookTitle}</Link>
      <div className="card card-lg center stack" style={{ alignItems: 'center', marginTop: 20 }}>
        <Tuft pose={error ? 'worry' : 'write'} size={140} />
        {error ? (
          <>
            <h2>I got stuck writing the samples</h2>
            <p className="muted" style={{ maxWidth: 520 }}>{error}</p>
            {message && <p className="small status-bad">{message}</p>}
            <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
              const r = await resumeRun(runId);
              if (!r.ok) setMessage(r.message); else router.refresh();
            })}><Icon name="refresh" size={18} /> {pending ? 'Starting…' : 'Try again'}</button>
          </>
        ) : (
          <>
            <h2>{round > 1 ? 'Rewriting the samples with your notes…' : 'Writing your sample chapters…'}</h2>
            <p className="muted">{chapters.join(' and ').replace(/^./, (c) => c.toUpperCase())} of <em>{bookTitle}</em>, {editionName.toLowerCase()}.</p>
            <div className="progress-bar" style={{ width: 260 }}><i className="indeterminate" /></div>
            {pictures && <p className="small muted">{done < chapters.length ? 'Then' : 'Now'} I’ll look up how the book should look and draw the main characters for you to check.</p>}
            <p className="small faint">{done} of {chapters.length} chapters done. Usually a few minutes. You can leave this page; I’ll put a note on your library when they’re ready.</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function SampleReview({ bookId, bookTitle, edition, run, samples, chapters, estimate, pictures }: {
  bookId: string;
  bookTitle: string;
  edition: { id: string; name: string; status: string; cap: number; guidance: string[] };
  run: { id: string; round: number; spent: number; comments: SampleComment[]; overall: string };
  samples: Sample[];
  chapters: { id: string; label: string }[];
  estimate: { total: number; minutes: number; samples: number; cap: number };
  pictures: { look: string | null; error: string | null; sheets: SheetView[] } | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(samples[0]?.sectionId ?? '');
  const [view, setView] = useState<'side' | 'original' | 'softened'>('side');
  const [comments, setComments] = useState<(SampleComment & { id: number })[]>(() => run.comments.map((c, i) => ({ ...c, id: i + 1 })));
  const [general, setGeneral] = useState(run.overall);
  const [pending, setPending] = useState<{ quote: string; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [cap, setCap] = useState(estimate.cap);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const softRef = useRef<HTMLDivElement>(null);
  const sample = samples.find((s) => s.sectionId === tab) ?? samples[0];
  const decided = edition.status !== 'samples-ready';
  const sheetsPending = pictures ? !pictures.sheets.length || pictures.sheets.some((x) => x.status !== 'approved') : false;

  if (!sample) return <main className="page"><p>No samples yet.</p></main>;
  const chComments = comments.filter((c) => c.sectionId === sample.sectionId);

  const onMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !sel || sel.rangeCount === 0 || !softRef.current?.contains(sel.anchorNode)) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setPending({ quote: text.slice(0, 200), x: rect.left + rect.width / 2, y: rect.bottom + window.scrollY });
    setDraft('');
  };

  const highlight = (html: string): ReactNode => {
    const text = plain(html);
    const hit = chComments.find((c) => text.includes(c.quote));
    if (!hit) return <span dangerouslySetInnerHTML={{ __html: safeInline(html) }} />;
    const i = text.indexOf(hit.quote);
    return <>{text.slice(0, i)}<mark title={hit.text}>{hit.quote}</mark>{text.slice(i + hit.quote.length)}</>;
  };

  const feedback = () => ({ comments: comments.map((c) => ({ sectionId: c.sectionId, quote: c.quote, text: c.text })), overall: general });
  const act = (fn: () => Promise<{ ok: boolean; message?: string } | void>) => start(async () => {
    setMessage(null);
    try {
      const r = await fn();
      if (r && !r.ok) setMessage(r.message ?? 'Something went wrong.');
      else router.refresh();
    } catch (e) {
      if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) throw e;
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    }
  });

  return (
    <main className="page sample-page">
      <Link href={`/books/${bookId}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> {bookTitle}</Link>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
        <div className="stack-sm" style={{ flex: 1, minWidth: 260 }}>
          <span className="chip chip-gold" style={{ alignSelf: 'flex-start' }}><Icon name="sparkle" size={12} /> Sample review{run.round > 1 ? ` · round ${run.round}` : ''}</span>
          <h1>How do these feel?</h1>
          <p className="muted">{bookTitle} · {edition.name} · samples cost {money(run.spent)}</p>
        </div>
        <div className="hide-sm" style={{ maxWidth: 420 }}>
          <Guide pose="read" size={64}>Read them side by side. <strong>Highlight any words</strong> in my version to leave a comment. When you’re happy, I’ll do the whole book.</Guide>
        </div>
      </div>

      {pictures && !decided && <div style={{ marginTop: 18 }}><Sheets bookId={bookId} look={pictures.look} error={pictures.error} sheets={pictures.sheets} /></div>}

      <div className="sample-toolbar">
        <div className="sample-tabs" role="tablist">
          {samples.map((x) => (
            <button key={x.sectionId} role="tab" aria-selected={tab === x.sectionId} className={tab === x.sectionId ? 'on' : ''} onClick={() => setTab(x.sectionId)}>
              <span className="tiny" style={{ fontWeight: 800, opacity: 0.8 }}>{x.why.toUpperCase()}</span>
              <span>Chapter {x.number}: {x.title}</span>
            </button>
          ))}
          {!decided && <button className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>Pick other chapters</button>}
        </div>
        <Segmented label="View" value={view} onChange={setView}
          options={[{ value: 'side', label: <><Icon name="columns" size={16} /> <span className="hide-sm">Side by side</span></> }, { value: 'original', label: 'Original' }, { value: 'softened', label: 'Softened' }]} />
      </div>

      <div className="sample-grid">
        <div className={`compare ${view}`}>
          {view !== 'softened' && (
            <div className="compare-col original">
              <div className="compare-head"><span className="chip chip-plain">Original</span></div>
              <div className="prose"><Blocks blocks={sample.original} bookId={bookId} /></div>
            </div>
          )}
          {view !== 'original' && (
            <div className="compare-col softened" ref={softRef} onMouseUp={onMouseUp}>
              <div className="compare-head"><span className="chip"><Icon name="feather" size={12} /> Softened · {edition.name}</span></div>
              {(sample.kidTitle || sample.recap) && (
                <div className="sample-extras">
                  {sample.kidTitle && <p className="small"><span className="faint">Kid-friendly title: </span><strong>{sample.kidTitle}</strong></p>}
                  {sample.recap && <p className="small"><span className="faint">The story so far: </span>{sample.recap}</p>}
                </div>
              )}
              <div className="prose"><Blocks blocks={sample.softened} bookId={bookId} render={highlight} /></div>
            </div>
          )}
        </div>

        <aside className="sample-side">
          <div className="card stack-sm">
            <h3>What I changed</h3>
            <p className="tiny faint">{sample.words.toLocaleString()} words, from {sample.originalWords.toLocaleString()} in the original.</p>
            {sample.changeNotes.length === 0 && <p className="small muted">Nothing needed changing here beyond small wording.</p>}
            <ul className="change-notes">
              {sample.changeNotes.map((n, i) => (
                <li key={i}>
                  <span className={`chip ${n.level === 'Remove' ? 'chip-ruby' : n.level === 'Soften' ? 'chip-gold' : 'chip-plain'}`}>{n.level}</span>
                  <div><strong className="small">{n.category}</strong><div className="small muted">{n.note}</div></div>
                </li>
              ))}
            </ul>
          </div>

          {decided ? (
            <div className="card card-tinted stack-sm">
              <p className="small">You’ve already answered these samples.</p>
              <Link href={edition.status === 'ready' ? `/read/edition/${edition.id}` : `/editions/${edition.id}/progress`} className="btn btn-secondary">
                {edition.status === 'ready' ? 'Read the edition' : 'See progress'}
              </Link>
            </div>
          ) : (
            <>
              <div className="card stack-sm">
                <h3>Your comments {comments.length > 0 && <span className="chip">{comments.length}</span>}</h3>
                {comments.length === 0 && <p className="small muted">Highlight words in the softened text to comment on them.</p>}
                <ul className="comment-list">
                  {comments.map((c) => (
                    <li key={c.id}>
                      <div className="tiny faint">Chapter {samples.find((x) => x.sectionId === c.sectionId)?.number}</div>
                      <blockquote>“{c.quote}”</blockquote>
                      <p className="small">{c.text}</p>
                      <button className="btn btn-ghost btn-sm" onClick={() => setComments(comments.filter((x) => x.id !== c.id))}>Remove</button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card stack-sm">
                <label className="label" htmlFor="general">Overall thoughts</label>
                <textarea id="general" className="textarea" value={general} maxLength={2000} onChange={(e) => setGeneral(e.target.value)} placeholder="e.g. A touch too babyish. Keep a bit more of the old-fashioned charm." />
                <div className="row-wrap">
                  {['Too babyish', 'Still too scary', 'Perfect tone', 'Keep more of the original words'].map((t) => (
                    <button key={t} className="chip chip-outline" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setGeneral((g) => (g ? `${g} ${t}.` : `${t}.`))}>{t}</button>
                  ))}
                </div>
                {edition.guidance.length > 0 && (
                  <details className="small muted">
                    <summary>Notes from earlier rounds ({edition.guidance.length})</summary>
                    <ul>{edition.guidance.map((g) => <li key={g}>{g}</li>)}</ul>
                  </details>
                )}
              </div>

              <div className="card card-tinted stack-sm">
                <button className="btn btn-secondary" disabled={busy || (!comments.length && !general.trim())}
                  onClick={() => act(() => rewriteSamples(edition.id, run.id, feedback()))}>
                  <Icon name="refresh" size={18} /> Rewrite samples with my notes · ~{money(Math.max(0.05, run.spent || estimate.samples))}
                </button>
                <div className="field">
                  <label className="label" htmlFor="cap">Cost cap for the whole book</label>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <div className="money-input"><span>$</span><input id="cap" type="number" min={1} step={1} value={cap} onChange={(e) => setCap(Number(e.target.value))} /></div>
                    <span className="hint" style={{ flex: 1, minWidth: 150 }}>I’ll pause and ask before going past it.</span>
                  </div>
                </div>
                {sheetsPending && <p className="tiny muted">Approve every character above first, so all the pictures match.</p>}
                <button className="btn btn-primary" disabled={busy || sheetsPending} onClick={() => act(() => approveSamples(edition.id, run.id, feedback(), cap))}>
                  <Icon name="check" size={18} /> {busy ? 'Starting…' : 'Looks great: write the whole book'}
                </button>
                <p className="tiny muted center">
                  Full book: ~{money(estimate.total)} · about {fmtMinutes(Math.max(5, estimate.minutes))}.
                  {comments.length || general.trim() ? ' Your notes here will guide every chapter.' : ' These sample chapters are kept as they are.'}
                  {pictures ? ' Includes the pictures.' : ''}
                </p>
                {message && <p className="small status-bad">{message}</p>}
              </div>
            </>
          )}
        </aside>
      </div>

      {pending && (
        <div className="comment-pop" style={{ left: Math.min(Math.max(pending.x - 160, 12), window.innerWidth - 332), top: pending.y + 10 }}>
          <blockquote>“{pending.quote}”</blockquote>
          <textarea className="textarea" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What should I change here?" style={{ minHeight: 70 }} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={!draft.trim()} onClick={() => {
              setComments([...comments, { id: Date.now(), sectionId: sample.sectionId, quote: pending.quote, text: draft.trim() }]);
              setPending(null);
              window.getSelection()?.removeAllRanges();
            }}>Add comment</button>
          </div>
        </div>
      )}

      {picking && <PickChapters chapters={chapters} current={samples.map((s) => s.sectionId)} onClose={() => setPicking(false)}
        onPick={(ids) => act(async () => { const r = await startSamples(edition.id, ids); if (r.ok) setPicking(false); return r; })} busy={busy} />}
    </main>
  );
}

function Blocks({ blocks, bookId, render }: { blocks: Block[]; bookId: string; render?: (html: string) => ReactNode }) {
  return blocks.map((b, i) => {
    if (b.type === 'hr') return <div key={i} className="scene-break" aria-hidden="true">⁂</div>;
    if (b.type === 'img') {
      // eslint-disable-next-line @next/next/no-img-element
      return <figure key={i} className="illus"><img className="illus-img" src={`/api/books/${bookId}/images/${b.imageId}`} alt={b.alt} loading="lazy" /></figure>;
    }
    const inner = render ? render(b.html) : <span dangerouslySetInnerHTML={{ __html: safeInline(b.html) }} />;
    if (b.type === 'h') return <h3 key={i} className="book-h">{inner}</h3>;
    if (b.type === 'quote') return <blockquote key={i} className="book-quote">{inner}</blockquote>;
    return <p key={i}>{inner}</p>;
  });
}

function PickChapters({ chapters, current, onClose, onPick, busy }: {
  chapters: { id: string; label: string }[]; current: string[]; onClose: () => void; onPick: (ids: string[]) => void; busy: boolean;
}) {
  const [a, setA] = useState(current[0] ?? chapters[0]?.id ?? '');
  const [b, setB] = useState(current[1] ?? '');
  const options = chapters.map((c) => ({ value: c.id, label: c.label }));
  return (
    <Modal onClose={onClose} label="Pick sample chapters">
      <ModalHead title="Pick sample chapters" pose="think" onClose={onClose} />
      <div className="stack">
        <p className="small muted">I’ll write a new round of samples for the chapters you choose. Pick ones you know well, or ones that worry you.</p>
        <div className="field"><span className="label" id="pick-a">First sample</span><Select labelledBy="pick-a" value={a} onChange={setA} options={options} /></div>
        <div className="field"><span className="label" id="pick-b">Second sample</span><Select labelledBy="pick-b" value={b} onChange={setB} options={[{ value: '', label: 'Just the one' }, ...options]} /></div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !a} onClick={() => onPick([a, b].filter(Boolean))}>{busy ? 'Starting…' : 'Write these'}</button>
        </div>
      </div>
    </Modal>
  );
}
