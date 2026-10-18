'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import type { RunStatus } from '@/db/schema';
import { fmtMinutes, money } from '@/lib/estimate';
import { answerCap, resumeRun } from '../../../books/edition-actions';

const STAGE: Record<string, string> = {
  writing: 'Writing the whole book',
  checking: 'Checking names and details across the book',
  fixing: 'Touching up a few chapters',
  finishing: 'Finishing up',
};

export default function RunProgress({ book, edition, run, version, pace }: {
  book: { id: string; title: string };
  edition: { id: string; name: string };
  run: { id: string; status: RunStatus; stage: string | null; error: string | null; done: number; of: number; spent: number; cap: number; estimate: number; totalWords: number; minutes: number | null };
  version: { number: string; name: string; description: string; cost: number } | null;
  pace: { needMore: number; vsEstimate: number } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const live = run.status === 'running';
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router, live]);

  const remaining = pace?.needMore ?? (run.estimate / Math.max(1, run.of)) * (run.of - run.done) * 1.1;
  const [newCap, setNewCap] = useState<number | null>(null);
  const capValue = newCap ?? Math.ceil(run.spent + remaining + 0.5);
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => {
    setMessage(null);
    const r = await fn();
    if (!r.ok) setMessage(r.message ?? 'Something went wrong.');
    router.refresh();
  });

  if (run.status === 'ready') {
    return (
      <main className="page page-narrow">
        <div className="card card-lg center stack celebrate" style={{ alignItems: 'center', marginTop: 20 }}>
          <div className="sparkles" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 5) * 0.4}s` }} />)}
          </div>
          <Tuft pose="cheer" size={150} />
          <h1>Ta-da! It’s ready.</h1>
          <p className="muted">{book.title} · {edition.name}</p>
          {version && (
            <div className="version-hero">
              <span className="badge-version">v{version.number}</span>
              <strong>“{version.name}”</strong>
              <p className="small muted">{version.description}</p>
              <p className="tiny faint">Cost {money(version.cost)} · estimate was {money(run.estimate)}</p>
            </div>
          )}
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Link href={`/read/edition/${edition.id}`} className="btn btn-primary"><Icon name="book" size={18} /> Start reading</Link>
            <Link href={`/books/${book.id}`} className="btn btn-secondary">Back to the book</Link>
          </div>
        </div>
      </main>
    );
  }

  const paused = run.status === 'paused-cap';
  const stopped = run.status === 'stopped';
  const failed = run.status === 'failed';
  const pct = Math.round((run.done / Math.max(1, run.of)) * 100);
  const minutesLeft = run.minutes ? Math.max(1, run.minutes * (1 - run.done / Math.max(1, run.of))) : null;

  return (
    <main className="page page-narrow">
      <Link href={`/books/${book.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> {book.title}</Link>
      <div className="card card-lg stack-lg" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
          <Tuft pose={paused || failed || stopped ? 'worry' : 'write'} size={120} />
          <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
            <span className={`chip ${paused || failed ? 'chip-ruby' : stopped ? 'chip-plain' : ''}`} style={{ alignSelf: 'flex-start' }}>
              {paused ? <><Icon name="pause" size={12} /> Paused at your cost cap</>
                : failed ? <>Stopped by a problem</>
                : stopped ? <><Icon name="pause" size={12} /> Stopped for now</>
                : <><span className="dot" /> {STAGE[run.stage ?? 'writing'] ?? 'Writing'}</>}
            </span>
            <h1>
              {paused ? 'I stopped to check with you'
                : failed ? 'Something went wrong'
                : stopped ? `${run.done} of ${run.of} chapters written`
                : run.done < run.of ? `Chapter ${run.done + 1} of ${run.of}` : 'Nearly there'}
            </h1>
            <p className="muted">
              {paused ? `I’ve written ${run.done} of ${run.of} chapters. The next ones would likely go past your ${money(run.cap)} cap.`
                : failed ? (run.error ?? 'The run stopped unexpectedly.') + ' Finished chapters are kept; trying again picks up where I left off.'
                : stopped ? 'Finished chapters are kept. You can carry on whenever you like.'
                : 'You can close this page. I’ll keep going and put a note on your library when I’m done.'}
            </p>
          </div>
        </div>

        <div className="stack-sm">
          <div className="row small"><strong>Progress</strong><span className="spacer" /><span className="muted">{pct}%</span></div>
          <div className="chapter-dots" aria-label={`${run.done} of ${run.of} chapters done`}>
            {Array.from({ length: run.of }, (_, i) => <i key={i} className={i < run.done ? 'done' : i === run.done && live ? 'now' : ''} />)}
          </div>
          <span className="tiny faint">Chapters are written a few at a time, so they may finish out of order.</span>
        </div>

        <div className="cost-meter">
          <div className="row small"><strong>Cost so far</strong><span className="spacer" /><span className="mono">{money(run.spent)} of {money(run.cap)} cap</span></div>
          <div className="meter">
            <i className={paused ? 'over' : ''} style={{ width: `${Math.min(100, (run.spent / Math.max(0.01, run.cap)) * 100)}%` }} />
            <b style={{ left: `${Math.min(100, (run.estimate / Math.max(0.01, run.cap)) * 100)}%` }} title="Estimate" />
          </div>
          <div className="row tiny muted"><span>Estimate {money(run.estimate)}</span><span className="spacer" /><span>Cap {money(run.cap)}</span></div>
          {live && minutesLeft && <div className="row tiny muted"><span>About {fmtMinutes(minutesLeft)} left</span></div>}
        </div>

        {(paused || stopped) && (
          <div className="card card-tinted stack">
            <h3>{paused ? 'What would you like to do?' : 'Carry on?'}</h3>
            <p className="small muted">
              {pace && Math.abs(pace.vsEstimate) >= 0.05
                ? `So far this book is running ${Math.round(Math.abs(pace.vsEstimate) * 100)}% ${pace.vsEstimate > 0 ? 'over' : 'under'} the estimate. `
                : pace ? 'So far this book is right on the estimate. ' : ''}
              I’ll need about {money(remaining)} more to finish.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="money-input"><span>$</span><input type="number" value={capValue} onChange={(e) => setNewCap(Number(e.target.value))} aria-label="New cap" /></div>
              <button className="btn btn-primary" disabled={pending} onClick={() => act(() => paused ? answerCap(run.id, { action: 'continue', cap: capValue }) : resumeRun(run.id, capValue))}>
                <Icon name="play" size={16} /> Raise cap & keep going
              </button>
              {paused && <button className="btn btn-ghost" disabled={pending} onClick={() => act(() => answerCap(run.id, { action: 'stop' }))}>Stop here for now</button>}
            </div>
          </div>
        )}

        {failed && (
          <div className="row-wrap">
            <button className="btn btn-primary" disabled={pending} onClick={() => act(() => resumeRun(run.id))}><Icon name="refresh" size={16} /> Try again</button>
          </div>
        )}
        {message && <p className="small status-bad">{message}</p>}
      </div>
    </main>
  );
}
