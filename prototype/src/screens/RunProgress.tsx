import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { nextVersion, useStore } from '../store';
import Icon from '../components/Icon';
import Tuft from '../components/Tuft';
import { ProtoNote, money } from '../components/ui';
import { fmtMinutes } from '../data/models';

// Shows a background adaptation or refinement run. The prototype fast-forwards it.

export default function RunProgress() {
  const { id } = useParams();
  const { editions, books, updateEdition, addVersion, toast } = useStore();
  const edition = editions.find((e) => e.id === id);
  const book = books.find((b) => b.id === edition?.bookId);
  const [auto, setAuto] = useState(true);
  const [newCap, setNewCap] = useState<number | null>(null);

  const run = edition?.run;
  const isRefine = !!edition && edition.versions.length > 0;

  useEffect(() => {
    if (!edition || !run || edition.status !== 'running' || !auto) return;
    const t = setTimeout(() => {
      const perChapter = run.estimate / run.of;
      const next = run.chapter + 1;
      const spent = +(run.spent + perChapter * (0.9 + Math.random() * 0.25)).toFixed(2);
      if (next > run.of) return finish();
      if (spent + perChapter > run.cap) {
        updateEdition(edition.id, { status: 'paused-cap', run: { ...run, chapter: next, spent } });
        toast('I paused: the next chapter would go past your cost cap.', 'worry');
        return;
      }
      updateEdition(edition.id, { run: { ...run, chapter: next, spent } });
    }, 650);
    return () => clearTimeout(t);
  });

  if (!edition || !book) return <main className="page"><p>Not found.</p></main>;

  function finish() {
    if (!edition || !run) return;
    if (isRefine) {
      const level = run.level ?? 'minor';
      addVersion(edition.id, {
        number: nextVersion(edition.currentVersion, level), name: run.versionName ?? 'Gentle Touches', level, date: '2026-10-17', cost: run.spent,
        guidance: run.guidance ?? '',
        description: run.versionDescription ?? 'Refined the edition following your guidance.',
      });
    } else {
      addVersion(edition.id, {
        number: '1.0.0', name: 'First Light', level: 'initial', date: '2026-10-17', cost: run.spent, guidance: '',
        description: `The first full adaptation of ${book!.title} for ${edition.name.toLowerCase()}.`,
      });
    }
    toast('All done! Your edition is ready to read.', 'cheer');
  }

  if (edition.status === 'ready') {
    const v = edition.versions.find((x) => x.number === edition.currentVersion);
    return (
      <main className="page page-narrow">
        <div className="card card-lg center stack celebrate" style={{ alignItems: 'center', marginTop: 20 }}>
          <div className="sparkles" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 5) * 0.4}s` }} />)}
          </div>
          <Tuft pose="cheer" size={150} />
          <h1>Ta-da! It’s ready.</h1>
          <p className="muted">{book.title} · {edition.name}</p>
          {v && (
            <div className="version-hero">
              <span className="badge-version">v{v.number}</span>
              <strong>“{v.name}”</strong>
              <p className="small muted">{v.description}</p>
              <p className="tiny faint">Cost {money(v.cost)}</p>
            </div>
          )}
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Link to={`/read/edition/${edition.id}`} className="btn btn-primary"><Icon name="book" size={18} /> Start reading</Link>
            <Link to={`/book/${book.id}`} className="btn btn-secondary">Back to the book</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="page page-narrow">
        <div className="card card-lg center stack" style={{ alignItems: 'center' }}>
          <Tuft pose="write" size={120} />
          <h2>Getting ready…</h2>
          <Link to={`/edition/${edition.id}/samples`} className="btn btn-secondary">Go to sample review</Link>
        </div>
      </main>
    );
  }

  const paused = edition.status === 'paused-cap';
  const pct = Math.round((run.chapter / run.of) * 100);
  const capValue = newCap ?? Math.ceil(run.cap + run.estimate * 0.25);

  return (
    <main className="page page-narrow">
      <Link to={`/book/${book.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> {book.title}</Link>
      <div className="card card-lg stack-lg" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
          <Tuft pose={paused ? 'worry' : 'write'} size={120} />
          <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
            <span className={`chip ${paused ? 'chip-ruby' : ''}`} style={{ alignSelf: 'flex-start' }}>
              {paused ? <><Icon name="pause" size={12} /> Paused at your cost cap</> : <><span className="dot" /> {isRefine ? 'Refining' : 'Writing the whole book'}</>}
            </span>
            <h1>{paused ? 'I stopped to check with you' : `Chapter ${Math.min(run.chapter + 1, run.of)} of ${run.of}`}</h1>
            <p className="muted">
              {paused
                ? `I’ve finished chapter ${run.chapter - 1}. Writing chapter ${run.chapter} would likely go past your ${money(run.cap)} cap.`
                : 'You can close this page. I’ll keep going and put a note on the book when I’m done.'}
            </p>
          </div>
        </div>

        <div className="stack-sm">
          <div className="row small"><strong>Progress</strong><span className="spacer" /><span className="muted">{pct}%</span></div>
          <div className="chapter-dots" aria-label={`${run.chapter} of ${run.of} chapters done`}>
            {Array.from({ length: run.of }, (_, i) => (
              <i key={i} className={i < run.chapter - (paused ? 1 : 0) ? 'done' : i === run.chapter && !paused ? 'now' : ''} />
            ))}
          </div>
        </div>

        <div className="cost-meter">
          <div className="row small"><strong>Cost so far</strong><span className="spacer" /><span className="mono">{money(run.spent)} of {money(run.cap)} cap</span></div>
          <div className="meter">
            <i className={paused ? 'over' : ''} style={{ width: `${Math.min(100, (run.spent / run.cap) * 100)}%` }} />
            <b style={{ left: `${Math.min(100, (run.estimate / run.cap) * 100)}%` }} title="Estimate" />
          </div>
          <div className="row tiny muted"><span>Estimate {money(run.estimate)}{run.images ? ` · includes ~${run.images} pictures` : ''}</span><span className="spacer" /><span>Cap {money(run.cap)}</span></div>
          {run.minutes != null && !paused && (
            <div className="row tiny muted"><span>About {fmtMinutes(Math.max(1, run.minutes * (1 - run.chapter / run.of)))} left of ~{fmtMinutes(run.minutes)}</span></div>
          )}
        </div>

        {paused ? (
          <div className="card card-tinted stack">
            <h3>What would you like to do?</h3>
            <p className="small muted">
              This book is running {Math.round(((run.spent / run.chapter) * run.of / run.estimate - 1) * 100)}% over the estimate. Later chapters are longer than average.
              I’ll need about {money(((run.spent / run.chapter) * (run.of - run.chapter + 1)))} more to finish.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="money-input"><span>$</span><input type="number" value={capValue} onChange={(e) => setNewCap(Number(e.target.value))} aria-label="New cap" /></div>
              <button className="btn btn-primary" onClick={() => { updateEdition(edition.id, { status: 'running', run: { ...run, cap: capValue } }); toast('Thanks! Back to writing.', 'write'); }}>
                <Icon name="play" size={16} /> Raise cap & keep going
              </button>
              <button className="btn btn-ghost" onClick={() => toast('Prototype: the edition would stay paused; finished chapters are kept.', 'think')}>Stop here for now</button>
            </div>
          </div>
        ) : (
          <div className="row-wrap">
            <button className="btn btn-secondary btn-sm" onClick={() => setAuto(!auto)}>{auto ? <><Icon name="pause" size={16} /> Pause demo</> : <><Icon name="play" size={16} /> Resume demo</>}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => updateEdition(edition.id, { run: { ...run, cap: +(run.spent + run.estimate / run.of * 0.5).toFixed(2) } })}>Demo: hit the cost cap</button>
          </div>
        )}
        <ProtoNote>Prototype: the run is sped up, about 1 chapter every 0.6 seconds.</ProtoNote>
      </div>
    </main>
  );
}
