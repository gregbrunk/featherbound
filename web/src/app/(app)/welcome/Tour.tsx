'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import Tuft, { type TuftPose } from '@/components/Tuft';

// A short look at what Featherbound does. New accounts see it before key setup (/welcome);
// anyone can replay it from Settings → About or the account menu (/tour).

type Slide = { key: string; kicker: string; title: string; pose: TuftPose; body: string; points: string[]; scene: () => ReactNode };

const SLIDES: Slide[] = [
  {
    key: 'shelf', kicker: 'Your library', title: 'Bring the books you already own', pose: 'hello',
    body: 'Upload a DRM-free EPUB or PDF. I read the file, find the cover and the series, and put it on your shelf.',
    points: ['EPUB or PDF', 'Covers and series found for you', 'Private to your account'],
    scene: ShelfScene,
  },
  {
    key: 'inside', kicker: 'Before you change a word', title: 'See what’s inside, chapter by chapter', pose: 'read',
    body: 'I read the whole book first and rate every chapter for things like violence, scary moments and language, so you know exactly where the tricky parts are.',
    points: ['Nine content categories', 'Spot the hot chapters at a glance', 'An estimate before anything runs'],
    scene: InsideScene,
  },
  {
    key: 'soften', kicker: 'Softened editions', title: 'Make it just right for your reader', pose: 'write',
    body: 'Pick an age, choose what to keep, soften or remove, and I rewrite only what needs it, in the author’s own voice. The original stays untouched.',
    points: ['Ages 3 to 17', 'Keep, soften or remove each category', 'Read aloud or independent reader'],
    scene: SoftenScene,
  },
  {
    key: 'samples', kicker: 'You stay in charge', title: 'Try a sample chapter first', pose: 'think',
    body: 'I soften one or two chapters so you can read them, highlight a passage and tell me what to change. The full book only runs when you’re happy, with a cost cap you set.',
    points: ['Changed words highlighted', 'Comment on any passage', 'Refine later, with every version kept'],
    scene: SamplesScene,
  },
  {
    key: 'read', kicker: 'Pictures and reading', title: 'Illustrate it, then hand it over', pose: 'cheer',
    body: 'Add pictures drawn in the book’s own style, read it here or download an EPUB or PDF, and lock a device to one book before you hand it to a kid.',
    points: ['Pictures in the book’s style', 'EPUB and PDF downloads', 'Hand-off mode with a parent PIN'],
    scene: ReadScene,
  },
];

export default function Tour({ onFinish, finishLabel, onSkip, skipLabel, exitHref }: {
  /** Called after the last slide. Without it, the last button links to exitHref. */
  onFinish?: () => void;
  finishLabel: string;
  onSkip?: () => void;
  skipLabel: string;
  exitHref?: string;
}) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, SLIDES.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const skip = onSkip
    ? <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>{skipLabel}</button>
    : <Link href={exitHref ?? '/'} className="btn btn-ghost btn-sm">{skipLabel}</Link>;
  const finish = onFinish
    ? <button type="button" className="btn btn-primary" onClick={onFinish}>{finishLabel} <Icon name="right" size={18} /></button>
    : <Link href={exitHref ?? '/'} className="btn btn-primary">{finishLabel} <Icon name="right" size={18} /></Link>;

  return (
    <section className="card card-lg tour" aria-roledescription="carousel" aria-label="A quick tour of Featherbound">
      <div className="tour-top">
        <span className="tiny faint tour-count">{i + 1} of {SLIDES.length}</span>
        <div className="tour-dots" role="tablist" aria-label="Tour slides">
          {SLIDES.map((x, n) => (
            <button key={x.key} type="button" role="tab" aria-selected={n === i} aria-label={`${n + 1}: ${x.title}`}
              className={n === i ? 'on' : n < i ? 'done' : ''} onClick={() => setI(n)} />
          ))}
        </div>
        {!last && skip}
      </div>

      <div className="tour-body" key={s.key} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${SLIDES.length}`}>
        <div className="tour-scene" aria-hidden="true">{s.scene()}</div>
        <div className="tour-copy">
          <div className="row" style={{ gap: 10 }}>
            <Tuft pose={s.pose} size={56} />
            <span className="chip chip-gold">{s.kicker}</span>
          </div>
          <h2>{s.title}</h2>
          <p className="muted">{s.body}</p>
          <ul className="tour-points">
            {s.points.map((p) => <li key={p}><Icon name="check" size={16} stroke={3} /> {p}</li>)}
          </ul>
        </div>
      </div>

      <div className="tour-nav">
        <button type="button" className="btn btn-ghost" onClick={() => setI(i - 1)} disabled={i === 0}><Icon name="left" size={18} /> Back</button>
        <div className="spacer" />
        {last ? finish : <button type="button" className="btn btn-primary" onClick={() => setI(i + 1)}>Next <Icon name="right" size={18} /></button>}
      </div>
    </section>
  );
}

/* ---------- Little illustrated scenes, one per slide ---------- */

function ShelfScene() {
  return (
    <div className="scene scene-shelf">
      <div className="scene-books">
        <span style={{ background: '#4b2e83', height: 92 }} />
        <span style={{ background: '#2f7d62', height: 80 }} />
        <span style={{ background: '#b23a52', height: 100 }} />
        <span style={{ background: '#d4a23a', height: 86 }} />
        <span className="scene-new" style={{ background: '#3462a8', height: 96 }} />
      </div>
      <div className="scene-plank" />
      <div className="scene-file">
        <Icon name="upload" size={18} />
        <div>
          <strong className="small">wizard-of-oz.epub</strong>
          <div className="tiny muted">Cover found · Oz, book 1</div>
        </div>
        <span className="chip chip-emerald"><Icon name="check" size={12} stroke={3} /> On your shelf</span>
      </div>
    </div>
  );
}

const HEAT: [string, number[]][] = [
  ['Scary moments', [0, 1, 1, 3, 2, 0, 1, 3]],
  ['Violence', [0, 0, 2, 3, 1, 0, 0, 2]],
  ['Language', [0, 0, 0, 1, 0, 0, 1, 0]],
  ['Death', [0, 0, 1, 2, 0, 0, 0, 1]],
];
const HEAT_COLORS = ['rgba(43,33,64,0.07)', 'var(--gold-soft)', 'var(--rose)', 'var(--ruby)'];

function InsideScene() {
  return (
    <div className="scene scene-inside">
      <div className="tiny faint" style={{ fontWeight: 800, marginBottom: 8 }}>CHAPTERS 1–8</div>
      {HEAT.map(([name, cells]) => (
        <div key={name} className="scene-heat-row">
          <span className="tiny" style={{ fontWeight: 700 }}>{name}</span>
          <div className="scene-heat-cells">{cells.map((c, n) => <i key={n} style={{ background: HEAT_COLORS[c] }} />)}</div>
        </div>
      ))}
      <div className="scene-callout small"><Icon name="info" size={14} /> Strongest in chapters 4 and 8</div>
    </div>
  );
}

function SoftenScene() {
  return (
    <div className="scene scene-soften">
      <div className="row-wrap">
        <span className="chip chip-plain">Age 7</span>
        <span className="chip chip-plain">Read aloud</span>
        <span className="chip chip-sapphire">Scary: soften</span>
      </div>
      <p className="scene-text">
        The Wicked Witch <del>shrieked and melted away into a brown, shapeless mass</del>{' '}
        <ins>gave a startled cry and shrank away until only her hat was left</ins> on the kitchen floor.
      </p>
      <div className="tiny faint">Everything else stays word for word.</div>
    </div>
  );
}

function SamplesScene() {
  return (
    <div className="scene scene-samples">
      <p className="scene-text">
        Dorothy picked up her basket. <mark>“We must hurry,” said the Scarecrow, “before the wolves come back.”</mark> They set off down the road.
      </p>
      <div className="scene-comment">
        <span className="avatar" style={{ width: 28, height: 28, fontSize: 13 }}>A</span>
        <span className="small">Leave the wolves out of this part, please.</span>
      </div>
      <div className="row-wrap">
        <span className="chip chip-plain">Estimate $3.10</span>
        <span className="chip chip-gold">Cap $5.00</span>
      </div>
    </div>
  );
}

function ReadScene() {
  return (
    <div className="scene scene-read">
      <div className="scene-picture">
        <Tuft pose="read" size={84} still />
      </div>
      <div className="scene-lock">
        <Icon name="lock" size={16} />
        <span className="small"><strong>Hand-off on.</strong> Locked to <em>The Wizard of Oz</em></span>
      </div>
    </div>
  );
}
