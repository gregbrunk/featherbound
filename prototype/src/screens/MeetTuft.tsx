import Tuft from '../components/Tuft';
import type { TuftPose } from '../components/Tuft';
import BookCover from '../components/BookCover';
import { Guide } from '../components/ui';

const POSES: { pose: TuftPose; where: string }[] = [
  { pose: 'hello', where: 'Greeting, app icon' },
  { pose: 'wave', where: 'Sign-in, welcomes' },
  { pose: 'read', where: 'Library, reader, tips' },
  { pose: 'write', where: 'Writing editions' },
  { pose: 'think', where: 'Suggestions, empty search' },
  { pose: 'cheer', where: 'Finished chapters & books' },
  { pose: 'worry', where: 'Errors, cost-cap pauses' },
  { pose: 'guard', where: 'Hand-off lock, privacy' },
  { pose: 'sleep', where: 'Text-only, quiet states' },
];

const NAMES = ['Tuft', 'Pip', 'Mochi', 'Wisp', 'Dumpling', 'Snowdrop'];

const COLORS = [
  ['Parchment', '#fbf4e4'], ['Paper', '#fffdf7'], ['Plum ink', '#2b2140'], ['Wizard plum', '#4b2e83'], ['Lavender', '#b9a5e3'],
  ['Gold', '#d4a23a'], ['Emerald', '#2f7d62'], ['Sapphire', '#3462a8'], ['Ruby', '#b23a52'], ['Blush', '#f6b8c6'], ['Shelf wood', '#8a5a3b'],
];

export default function MeetTuft() {
  return (
    <main className="page">
      <section className="meet-hero">
        <Tuft pose="wave" size={200} />
        <div className="stack" style={{ flex: 1, minWidth: 260 }}>
          <span className="chip chip-gold" style={{ alignSelf: 'flex-start' }}>Design notes for review</span>
          <h1>Meet Tuft</h1>
          <p style={{ fontSize: 18 }}>
            The softest little puffball bird, inspired by the snow-white long-tailed tit (the “snow fairy” of Hokkaido), wearing a wizard hat that’s <em>much</em> too big for it.
          </p>
          <p className="muted">Tuft is the app icon and your guide through Featherbound, the way Duo guides you through Duolingo. Round, soft and a little bit magical. “Tuft” is a working name; some others are below.</p>
          <div className="row-wrap">{NAMES.map((n) => <span key={n} className={`chip ${n === 'Tuft' ? '' : 'chip-outline'}`}>{n}</span>)}</div>
        </div>
      </section>

      <section className="shelf-section">
        <h2>Poses</h2>
        <div className="pose-grid">
          {POSES.map((p) => (
            <div key={p.pose} className="card pose-card">
              <Tuft pose={p.pose} size={110} />
              <strong>{p.pose[0].toUpperCase() + p.pose.slice(1)}</strong>
              <span className="tiny muted">{p.where}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="shelf-section grid-2">
        <div className="card stack">
          <h2>App icon</h2>
          <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
            {[96, 64, 40].map((s) => (
              <div key={s} className="app-icon" style={{ width: s, height: s, borderRadius: s * 0.24 }}>
                <Tuft size={s * 0.9} still />
              </div>
            ))}
          </div>
          <p className="small muted">Plum tile, white puffball, gold hat band. It still reads as Tuft at favicon size.</p>
        </div>
        <div className="card stack">
          <h2>Voice</h2>
          <Guide pose="hello" size={56}>Good evening! What shall we read tonight?</Guide>
          <Guide pose="worry" size={56}>Oops, this book is locked with DRM, so I can’t open the pages.</Guide>
          <p className="small muted">Warm, short and a little playful. Tuft talks to grown-ups in the setup screens and stays quiet while you read.</p>
        </div>
      </section>

      <section className="shelf-section card stack">
        <h2>Palette & type</h2>
        <div className="swatches">
          {COLORS.map(([n, c]) => (
            <div key={n} className="swatch"><i style={{ background: c }} /><span className="tiny"><strong>{n}</strong><br />{c}</span></div>
          ))}
        </div>
        <div className="grid-3" style={{ marginTop: 10 }}>
          <div><span className="tiny faint">DISPLAY · FRAUNCES (SOFT)</span><p style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, fontVariationSettings: "'SOFT' 100, 'WONK' 1", color: 'var(--plum-deep)' }}>Once upon a shelf</p></div>
          <div><span className="tiny faint">INTERFACE · NUNITO</span><p style={{ fontSize: 18, fontWeight: 700 }}>Make sample chapters</p></div>
          <div><span className="tiny faint">READING · LITERATA</span><p style={{ fontFamily: 'var(--font-read)', fontSize: 18 }}>Dorothy lived in the midst of the great Kansas prairies.</p></div>
        </div>
      </section>

      <section className="shelf-section">
        <h2>Covers on the shelf</h2>
        <p className="muted small">The prototype draws simple stand-in covers. The real app shows each book’s actual cover, with an age ribbon on softened editions.</p>
        <div className="shelf" style={{ marginTop: 10 }}>
          {[{ from: '#3fae6a', to: '#0f5a3a', emblem: 'house', ink: '#F6E3AE' }, { from: '#2f5fb3', to: '#14244f', emblem: 'egg' }, { from: '#e3a33b', to: '#a2541d', emblem: 'chicken' }].map((c, i) => (
            <div key={i} className="shelf-item"><BookCover cover={c} title={['The Wonderful Wizard of Oz', 'Eragon', 'Beware of Chicken'][i]} author={['L. Frank Baum', 'Christopher Paolini', 'Casualfarmer'][i]} ribbon={i === 0 ? '5' : undefined} /></div>
          ))}
        </div>
        <div className="shelf-board" />
      </section>
    </main>
  );
}
