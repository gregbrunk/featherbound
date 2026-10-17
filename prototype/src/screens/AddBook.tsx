import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import BookCover from '../components/BookCover';
import Icon from '../components/Icon';
import Tuft from '../components/Tuft';
import { Guide, ProtoNote, Switch } from '../components/ui';
import type { Book } from '../data/types';
import { olCover } from '../data/library';

type Stage = 'drop' | 'reading' | 'review' | 'drm';

const STEPS = ['Opening the file', 'Reading the metadata & cover', 'Finding the chapters', 'Checking which series it belongs to', 'Writing the content report'];

type Ch = { n: number; title: string; words: number; include: boolean; kind: 'chapter' | 'front' | 'back' };

function sampleChapters(): Ch[] {
  const front: Ch[] = [
    { n: 0, title: 'Copyright', words: 180, include: false, kind: 'front' },
    { n: 0, title: 'Map of the Azure Hills', words: 0, include: false, kind: 'front' },
  ];
  const chapters: Ch[] = Array.from({ length: 38 }, (_, i) => ({
    n: i + 1, title: i === 0 ? 'Prologue' : i === 37 ? 'Epilogue' : `Chapter ${i}`, words: 2600 + ((i * 937) % 1900), include: true, kind: 'chapter',
  }));
  const back: Ch[] = [
    { n: 0, title: 'Acknowledgments', words: 420, include: false, kind: 'back' },
    { n: 0, title: 'About the Author', words: 210, include: false, kind: 'back' },
  ];
  return [...front, ...chapters, ...back];
}

export default function AddBook() {
  const [stage, setStage] = useState<Stage>('drop');
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState(0);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const start = (name: string) => {
    setFileName(name);
    if (/drm|azw|kfx|acsm/i.test(name)) { setStage('drm'); return; }
    setStage('reading');
    setStep(0);
  };

  useEffect(() => {
    if (stage !== 'reading') return;
    if (step >= STEPS.length) { const t = setTimeout(() => setStage('review'), 400); return () => clearTimeout(t); }
    const t = setTimeout(() => setStep((s) => s + 1), 750);
    return () => clearTimeout(t);
  }, [stage, step]);

  return (
    <main className="page page-narrow">
      {stage === 'drop' && (
        <div className="stack-lg">
          <div className="stack-sm">
            <h1>Add a book</h1>
            <p className="muted">Upload a DRM-free ebook you own. I’ll read it, sort it onto the right shelf, and help you make a softer edition.</p>
          </div>
          <div
            className={`dropzone ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) start(f.name); }}
            onClick={() => input.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          >
            <Tuft pose={over ? 'cheer' : 'hello'} size={110} />
            <h2>Drop your book here</h2>
            <p className="muted">or click to choose a file</p>
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              <span className="chip">EPUB</span><span className="chip">PDF</span>
              <span className="chip chip-plain">Soon: MOBI · AZW3 · DOCX · TXT · HTML</span>
            </div>
            <input ref={input} type="file" accept=".epub,.pdf,.mobi,.azw3,.docx,.txt,.md,.html" hidden onChange={(e) => e.target.files?.[0] && start(e.target.files[0].name)} />
          </div>
          <ProtoNote>
            Prototype: any file you drop runs a pretend import of <em>Beware of Chicken 3</em>. Or try one:{' '}
            <button className="link-btn" onClick={() => start('Beware of Chicken 3.epub')}>a normal EPUB</button> ·{' '}
            <button className="link-btn" onClick={() => start('Eldest (Adobe DRM).epub')}>a DRM-locked file</button>
          </ProtoNote>
        </div>
      )}

      {stage === 'reading' && (
        <div className="card card-lg center stack" style={{ alignItems: 'center', marginTop: 20 }}>
          <Tuft pose="read" size={130} />
          <h2>Reading “{fileName}”…</h2>
          <ul className="steps-list">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
                <span className="step-dot">{i < step ? <Icon name="check" size={14} stroke={3} /> : null}</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stage === 'drm' && (
        <div className="card card-lg stack" style={{ marginTop: 20 }}>
          <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
            <Tuft pose="worry" size={110} />
            <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
              <h2>This book is locked with DRM</h2>
              <p className="muted">“{fileName}” is protected, so I can’t open the pages. Featherbound only works with DRM-free files.</p>
            </div>
          </div>
          <div className="card card-tinted stack-sm">
            <h3>Ways to get a DRM-free copy</h3>
            <ul className="tips">
              <li><strong>Kobo:</strong> near the bottom of the store page, look for <em>“EPUB (DRM-Free)”</em>. Tor books like <em>Ender’s Game</em> are DRM-free.</li>
              <li><strong>Amazon Kindle:</strong> some indie and self-published books now offer an EPUB or PDF download. Look for it on the book’s page under “Content &amp; Devices”.</li>
              <li><strong>Straight from the author:</strong> many indie and LitRPG authors sell DRM-free EPUBs on their own site or Patreon.</li>
            </ul>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setStage('drop')}>Try another file</button>
          </div>
        </div>
      )}

      {stage === 'review' && <Review fileName={fileName} onBack={() => setStage('drop')} />}
    </main>
  );
}

function Review({ fileName, onBack }: { fileName: string; onBack: () => void }) {
  const { series, addBook, toast } = useStore();
  const nav = useNavigate();
  const [title, setTitle] = useState('Beware of Chicken 3');
  const [author, setAuthor] = useState('Casualfarmer');
  const [seriesChoice, setSeriesChoice] = useState<'suggested' | 'other' | 'standalone'>('suggested');
  const [otherSeries, setOtherSeries] = useState('hp');
  const [position, setPosition] = useState('3');
  const [genres, setGenres] = useState(['Fantasy', 'Cozy', 'Cultivation']);
  const [chapters, setChapters] = useState<Ch[]>(sampleChapters);
  const [showAll, setShowAll] = useState(false);
  const boc = series.find((s) => s.id === 'boc')!;

  const included = chapters.filter((c) => c.include);
  const words = included.reduce((n, c) => n + c.words, 0);

  const save = () => {
    const seriesId = seriesChoice === 'suggested' ? 'boc' : seriesChoice === 'other' ? otherSeries : undefined;
    const b: Book = {
      id: `boc3-${Date.now().toString(36)}`, title, author, seriesId, seriesOrder: seriesId ? Number(position) || 1 : undefined,
      seriesLabel: seriesId ? `Book ${position}` : undefined, genres, tags: ['Farming', 'Humor'],
      description: 'More seasons on the farm, and more trouble from the outside world.',
      cover: { from: '#c9772f', to: '#6e2c10', emblem: 'chicken' }, coverUrl: olCover(15171799), words, chapters: included.length, addedAt: '2026-10-17', format: 'EPUB',
    };
    addBook(b);
    toast('On the shelf! Now let’s soften it.');
    nav(`/book/${b.id}/new`);
  };

  const visible = showAll ? chapters : chapters.slice(0, 7);

  return (
    <div className="stack-lg">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="stack-sm" style={{ flex: 1 }}>
          <h1>Check the details</h1>
          <p className="muted">I read “{fileName}”. Fix anything I got wrong, then save it to the shelf.</p>
        </div>
      </div>

      <div className="card review-grid">
        <div className="stack-sm" style={{ alignItems: 'center' }}>
          <div style={{ width: 150 }}><BookCover cover={{ from: '#c9772f', to: '#6e2c10', emblem: 'chicken' }} image={olCover(15171799)} title={title} author={author} /></div>
          <span className="tiny faint">Cover from the file</span>
        </div>
        <div className="stack">
          <div className="field"><label className="label" htmlFor="title">Title</label><input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="author">Author</label><input id="author" className="input" value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
          <div className="field">
            <span className="label">Genres</span>
            <div className="row-wrap">
              {['Fantasy', 'Cozy', 'Cultivation', 'Humor', 'LitRPG', 'Science fiction'].map((g) => (
                <button key={g} type="button" className={`chip ${genres.includes(g) ? '' : 'chip-outline'}`} style={{ border: 'none', cursor: 'pointer' }}
                  onClick={() => setGenres(genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g])} aria-pressed={genres.includes(g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="card stack">
        <Guide pose="think" size={64}>
          This looks like <strong>book 3 of <em>Beware of Chicken</em></strong>. The title matches, it’s the same author, and the file says “#3”. You already have books 1 and 2.
        </Guide>
        <div className="series-choices" role="radiogroup" aria-label="Series">
          <label className={`choice ${seriesChoice === 'suggested' ? 'on' : ''}`}>
            <input type="radio" name="series" checked={seriesChoice === 'suggested'} onChange={() => setSeriesChoice('suggested')} />
            <div className="boxset" style={{ width: 42 }}><BookCover cover={boc.cover} title="" author="" size="sm" /></div>
            <div style={{ flex: 1 }}>
              <strong>Add to Beware of Chicken</strong>
              <div className="row small" style={{ gap: 6, marginTop: 4 }}>
                as book <input className="input input-xs" value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Book number" onClick={(e) => e.stopPropagation()} />
              </div>
            </div>
            <span className="chip chip-emerald">Suggested</span>
          </label>
          <label className={`choice ${seriesChoice === 'other' ? 'on' : ''}`}>
            <input type="radio" name="series" checked={seriesChoice === 'other'} onChange={() => setSeriesChoice('other')} />
            <div style={{ flex: 1 }}>
              <strong>A different series</strong>
              {seriesChoice === 'other' && (
                <select className="select" style={{ marginTop: 8 }} value={otherSeries} onChange={(e) => setOtherSeries(e.target.value)} aria-label="Series">
                  {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__new">+ Start a new series…</option>
                </select>
              )}
            </div>
          </label>
          <label className={`choice ${seriesChoice === 'standalone' ? 'on' : ''}`}>
            <input type="radio" name="series" checked={seriesChoice === 'standalone'} onChange={() => setSeriesChoice('standalone')} />
            <div style={{ flex: 1 }}><strong>Standalone book</strong></div>
          </label>
        </div>
      </section>

      <section className="card stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h3>Chapters</h3>
            <p className="small muted">{included.length} sections included · {words.toLocaleString()} words. I left out the copyright page, map and back matter.</p>
          </div>
        </div>
        <ol className="chapter-list">
          {visible.map((c, i) => (
            <li key={i} className={c.include ? '' : 'excluded'}>
              <Switch checked={c.include} onChange={(v) => setChapters(chapters.map((x, j) => (j === i ? { ...x, include: v } : x)))} label={`Include ${c.title}`} />
              <input className="input input-plain" value={c.title} onChange={(e) => setChapters(chapters.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} aria-label="Chapter title" />
              <span className="tiny faint mono hide-sm">{c.words ? `${c.words.toLocaleString()} words` : 'image'}</span>
              {c.kind !== 'chapter' && <span className="chip chip-plain">{c.kind === 'front' ? 'Front matter' : 'Back matter'}</span>}
              {c.kind === 'chapter' && (
                <span className="row hide-sm" style={{ gap: 2 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast('Prototype: merges with the next chapter', 'think')}>Merge</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast('Prototype: pick where to split', 'think')}>Split</button>
                </span>
              )}
            </li>
          ))}
        </ol>
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${chapters.length} sections`} <Icon name="down" size={16} />
        </button>
      </section>

      <div className="sticky-actions">
        <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={save}>Save to shelf & make an edition <Icon name="arrow" size={18} /></button>
      </div>
    </div>
  );
}
