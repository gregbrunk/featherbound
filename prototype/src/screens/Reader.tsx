import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { currentVersionOf, useStore } from '../store';
import Icon from '../components/Icon';
import Tuft from '../components/Tuft';
import Illustration, { SCENES } from '../components/Illustration';
import type { Scene } from '../components/Illustration';
import { Modal, ModalHead, Segmented } from '../components/ui';
import { ozOriginal } from '../data/ozOriginal';
import { ozSoftenedV1, ozSoftenedV11 } from '../data/ozSoftened';
import { OZ_CHAPTERS, OZ_KID_TITLES } from '../data/library';

const AVAILABLE = [1, 12];
// Where pictures sit (after paragraph index). Originals keep Denslow's art as published;
// the softened edition swaps the dead-wolf picture for a redrawn scene.
const ILLUS_ORIGINAL: Record<number, Record<number, Scene>> = {
  1: { 17: 'toto', 19: 'bed' },
  12: { 0: 'soldier', 10: 'witch', 19: 'wolf', 28: 'crows', 36: 'lion' },
};
const ILLUS_EDITION: Record<number, Record<number, Scene>> = {
  1: { 17: 'toto', 19: 'bed' },
  12: { 0: 'soldier', 10: 'witch', 18: 'clang', 28: 'crows', 36: 'lion' },
};
const RECAPS: Record<number, string> = {
  12: 'The story so far… Dorothy and her friends reached the Emerald City and met the great Oz. He promised to help them, but only if they could stop the Wicked Witch of the West. So off they go!',
};

const FONTS = [
  { id: 'literata', name: 'Literata', css: 'var(--font-read)' },
  { id: 'fraunces', name: 'Storybook', css: "'Fraunces', serif" },
  { id: 'lexend', name: 'Lexend', css: "'Lexend', sans-serif" },
  { id: 'atkinson', name: 'Hyperlegible', css: "'Atkinson Hyperlegible', sans-serif" },
];

type Prefs = { size: number; font: string; spacing: number; theme: 'day' | 'parchment' | 'night'; spread: boolean };
const DEFAULT_PREFS: Prefs = { size: 20, font: 'literata', spacing: 1.65, theme: 'parchment', spread: true };

function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('fb.reader') ?? '{}') }; } catch { return DEFAULT_PREFS; }
}

export default function Reader() {
  const { kind, id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { books, editions, progress, setProgress, lock, setLock, pin, toast } = useStore();
  const isEdition = kind === 'edition';
  const edition = isEdition ? editions.find((e) => e.id === id) : undefined;
  const book = books.find((b) => b.id === (edition ? edition.bookId : id));
  const versionNum = params.get('v') ?? edition?.currentVersion;
  const version = edition?.versions.find((v) => v.number === versionNum) ?? (edition ? currentVersionOf(edition) : undefined);
  const locked = !!lock && lock.editionId === edition?.id;
  const progressKey = edition ? edition.id : `orig-${book?.id}`;

  const startCh = progress[progressKey]?.chapter;
  const [chapter, setChapter] = useState(AVAILABLE.includes(startCh ?? 0) ? startCh! : 1);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState<null | 'toc' | 'type' | 'lock' | 'unlock'>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [compare, setCompare] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [wide, setWide] = useState(() => window.innerWidth >= 900);
  const [zoom, setZoom] = useState<Scene | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const pagerRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const goLast = useRef(false);
  const [geom, setGeom] = useState({ col: 600, gap: 64 });

  useEffect(() => { try { localStorage.setItem('fb.reader', JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);
  useEffect(() => {
    const r = () => setWide(window.innerWidth >= 900);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);

  const spread = prefs.spread && wide && !compare;
  const text: string[] = !edition
    ? ozOriginal[chapter]
    : (version?.number === '1.0.0' || edition.bookId !== 'oz' ? ozSoftenedV1 : ozSoftenedV11)[chapter];
  const illustrated = edition ? edition.settings.picture.on : book?.id === 'oz';
  const ILLUS = edition ? ILLUS_EDITION : ILLUS_ORIGINAL;
  const kidTitles = !!edition?.settings.extras.kidTitles;
  const recaps = !!edition?.settings.extras.recaps;

  // ----- Pagination with CSS columns -----
  const measure = useCallback(() => {
    const pager = pagerRef.current, flow = flowRef.current;
    if (!pager || !flow) return;
    const w = pager.getBoundingClientRect().width; // fractional, so pages don't drift
    const gap = Math.max(32, Math.min(80, w * 0.06));
    const col = spread ? (w - gap) / 2 : w;
    setGeom({ col, gap });
    requestAnimationFrame(() => {
      const total = Math.max(1, Math.round((flow.scrollWidth + gap) / (col + gap)));
      const perView = spread ? 2 : 1;
      const n = Math.max(1, Math.ceil(total / perView));
      setPages(n);
      if (goLast.current) { setPage(n - 1); goLast.current = false; }
      else setPage((p) => Math.min(p, n - 1));
    });
  }, [spread]);

  useLayoutEffect(() => {
    measure();
    // Fonts and images settle after the first layout; measure again once they have.
    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [measure, chapter, prefs.size, prefs.font, prefs.spacing, text, compare]);
  useEffect(() => {
    const ro = new ResizeObserver(() => measure());
    if (pagerRef.current) ro.observe(pagerRef.current);
    document.fonts?.ready.then(() => measure());
    return () => ro.disconnect();
  }, [measure]);

  const ci = AVAILABLE.indexOf(chapter);
  const next = useCallback(() => {
    if (page < pages - 1) setPage(page + 1);
    else if (ci < AVAILABLE.length - 1) {
      if (isEdition) { setCelebrate(true); setTimeout(() => setCelebrate(false), 2600); }
      setChapter(AVAILABLE[ci + 1]); setPage(0);
    } else if (isEdition) { setCelebrate(true); setTimeout(() => setCelebrate(false), 2600); }
  }, [page, pages, ci, isEdition]);
  const prev = useCallback(() => {
    if (page > 0) setPage(page - 1);
    else if (ci > 0) { goLast.current = true; setChapter(AVAILABLE[ci - 1]); }
  }, [page, ci]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (panel) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [next, prev, panel]);

  // Save progress as you read.
  useEffect(() => {
    const chapterSpan = 100 / 24;
    const pct = Math.round(((chapter - 1) + (page + 1) / pages) * chapterSpan);
    setProgress(progressKey, { chapter, percent: Math.min(100, pct), updatedAt: '2026-10-17' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, page, pages]);

  // Swipe
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { touch.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const t = touch.current; touch.current = null;
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      if ((e.target as HTMLElement).closest('figure')) return;
      const r = pagerRef.current!.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < 0.28) prev(); else if (x > 0.72) next(); else setChrome((c) => !c);
    }
  };

  if (!book) return <main className="page"><p>Book not found.</p></main>;

  const step = (geom.col + geom.gap) * (spread ? 2 : 1);
  const font = FONTS.find((f) => f.id === prefs.font)!;
  const title = book.id === 'oz' ? OZ_CHAPTERS[chapter - 1] : `Chapter ${chapter}`;
  const overall = Math.round(((chapter - 1) + (page + 1) / pages) * (100 / 24));

  return (
    <div className={`reader theme-${prefs.theme} ${chrome ? '' : 'immersive'} ${locked ? 'locked' : ''}`}>
      <header className="reader-bar">
        {!locked ? (
          <Link to={edition ? `/book/${book.id}` : `/book/${book.id}`} className="btn btn-ghost btn-icon" aria-label="Back to book"><Icon name="left" /></Link>
        ) : (
          <span className="lock-badge"><Icon name="lock" size={14} /> Hand-off mode</span>
        )}
        <div className="reader-title">
          <strong className="ellipsis">{book.title}</strong>
          <span className="tiny ellipsis">{edition ? `${edition.name}${version ? ` · v${version.number}` : ''}` : 'Original'}</span>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setPanel('toc')} aria-label="Contents"><Icon name="toc" /></button>
          <button className="btn btn-ghost btn-icon" onClick={() => setPanel('type')} aria-label="Reading settings"><Icon name="text" /></button>
          {!locked && (
            <button className={`btn btn-ghost btn-icon ${bookmarked ? 'on' : ''}`} onClick={() => { setBookmarked(!bookmarked); toast(bookmarked ? 'Bookmark removed' : 'Bookmarked this page', 'read'); }} aria-label="Bookmark" aria-pressed={bookmarked}>
              <Icon name="bookmark" />
            </button>
          )}
          {edition && !locked && wide && (
            <button className={`btn btn-ghost btn-icon ${compare ? 'on' : ''}`} onClick={() => setCompare(!compare)} aria-label="Compare with original" aria-pressed={compare} title="Compare with original">
              <Icon name="columns" />
            </button>
          )}
          {edition && !locked && (
            <button className="btn btn-ghost btn-icon" onClick={() => setPanel('lock')} aria-label="Hand-off mode" title="Hand-off mode"><Icon name="lock" /></button>
          )}
          {locked && <HoldToUnlock onUnlocked={() => setPanel('unlock')} />}
        </div>
      </header>

      {edition && edition.bookId !== 'oz' && !locked && (
        <div className="reader-note">Prototype: showing sample chapters from <em>The Wonderful Wizard of Oz</em> in place of this book’s text.</div>
      )}
      {version && edition && version.number !== edition.currentVersion && (
        <div className="reader-note">You’re reading an older version: v{version.number} “{version.name}”. <Link to={`/read/edition/${edition.id}`}>Go to current</Link></div>
      )}

      {compare && edition ? (
        <div className="compare-reader">
          <div className="compare-col original"><div className="compare-head"><span className="chip chip-plain">Original</span></div>
            <div className="prose reading" style={{ fontFamily: font.css, fontSize: prefs.size - 2, lineHeight: prefs.spacing }}>{ozOriginal[chapter].map((p, i) => <p key={i}>{p}</p>)}</div>
          </div>
          <div className="compare-col softened"><div className="compare-head"><span className="chip"><Icon name="feather" size={12} /> {edition.name}</span></div>
            <div className="prose reading" style={{ fontFamily: font.css, fontSize: prefs.size - 2, lineHeight: prefs.spacing }}>{text.map((p, i) => <p key={i}>{p}</p>)}</div>
          </div>
        </div>
      ) : (
        <div className="pager" ref={pagerRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          <div
            className={`flow ${spread ? 'spread' : ''}`}
            ref={flowRef}
            style={{
              columnWidth: geom.col, columnGap: geom.gap, transform: `translateX(-${page * step}px)`,
              fontFamily: font.css, fontSize: prefs.size, lineHeight: prefs.spacing,
            }}
          >
            <div className="chapter-head">
              <span className="chapter-num">Chapter {chapter}</span>
              <h1>{kidTitles && OZ_KID_TITLES[chapter] ? OZ_KID_TITLES[chapter] : title}</h1>
              {kidTitles && OZ_KID_TITLES[chapter] && <span className="chapter-orig">{title}</span>}
              <div className="chapter-flourish" aria-hidden="true">✦ ❦ ✦</div>
            </div>
            {recaps && RECAPS[chapter] && (
              <aside className="recap"><Tuft pose="read" size={44} still /><p>{RECAPS[chapter]}</p></aside>
            )}
            {text.map((p, i) => (
              <div key={i} className="para-wrap">
                <p className={i === 0 ? 'dropcap' : ''}>{p}</p>
                {illustrated && ILLUS[chapter]?.[i] && (
                  <figure className="illus" onClick={() => setZoom(ILLUS[chapter][i])}>
                    <Illustration scene={ILLUS[chapter][i]} />
                    <figcaption>{SCENES[ILLUS[chapter][i]].caption}</figcaption>
                  </figure>
                )}
              </div>
            ))}
            {chapter === AVAILABLE[AVAILABLE.length - 1] && (
              <div className="end-note">
                <Tuft pose="sleep" size={70} still />
                <p>That’s the end of the prototype chapters. In the real app, the whole book is here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="reader-foot">
        <button className="btn btn-ghost btn-icon" onClick={prev} aria-label="Previous page" disabled={compare}><Icon name="left" /></button>
        <div className="reader-progress">
          <div className="chapter-track" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i / 24) * 100}%` }} />)}
            <b style={{ width: `${overall}%` }} />
          </div>
          <span className="tiny">Chapter {chapter} · {compare ? 'comparing' : `page ${page + 1} of ${pages}`} · {overall}% of the book</span>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={next} aria-label="Next page" disabled={compare}><Icon name="right" /></button>
      </footer>

      {celebrate && (
        <div className="chapter-cheer" role="status">
          <Tuft pose="cheer" size={90} />
          <strong>Chapter finished!</strong>
        </div>
      )}

      {zoom && (
        <div className="scrim" onClick={() => setZoom(null)}>
          <figure className="illus-zoom"><Illustration scene={zoom} /><figcaption>{SCENES[zoom].caption}</figcaption>
            {!locked && <span className="tiny" style={{ opacity: 0.8 }}>{SCENES[zoom].source}</span>}
          </figure>
        </div>
      )}

      {panel === 'toc' && (
        <Modal onClose={() => setPanel(null)} label="Contents">
          <ModalHead title="Contents" onClose={() => setPanel(null)} />
          <ol className="toc">
            {(book.id === 'oz' ? OZ_CHAPTERS : AVAILABLE.map((n) => `Chapter ${n}`)).map((t, i) => {
              const n = book.id === 'oz' ? i + 1 : AVAILABLE[i];
              const ok = AVAILABLE.includes(n);
              return (
                <li key={n}>
                  <button className={`toc-item ${n === chapter ? 'on' : ''}`} disabled={!ok} onClick={() => { setChapter(n); setPage(0); setPanel(null); setCompare(false); }}>
                    <span className="mono faint">{n}</span>
                    <span style={{ flex: 1 }}>{kidTitles && OZ_KID_TITLES[n] ? OZ_KID_TITLES[n] : t}</span>
                    {!ok && <span className="tiny faint">not in prototype</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </Modal>
      )}

      {panel === 'type' && (
        <Modal onClose={() => setPanel(null)} label="Reading settings">
          <ModalHead title="Make it comfy" pose="read" onClose={() => setPanel(null)} />
          <div className="stack">
            <div className="field">
              <span className="label">Text size</span>
              <div className="row">
                <span style={{ fontSize: 14 }}>A</span>
                <input className="range" type="range" min={15} max={30} value={prefs.size} onChange={(e) => setPrefs({ ...prefs, size: Number(e.target.value) })} aria-label="Text size" />
                <span style={{ fontSize: 26 }}>A</span>
              </div>
            </div>
            <div className="field">
              <span className="label">Typeface</span>
              <div className="font-grid">
                {FONTS.map((f) => (
                  <button key={f.id} className={`font-card ${prefs.font === f.id ? 'on' : ''}`} style={{ fontFamily: f.css }} onClick={() => setPrefs({ ...prefs, font: f.id })} aria-pressed={prefs.font === f.id}>
                    <span style={{ fontSize: 22 }}>Aa</span><span className="tiny">{f.name}</span>
                  </button>
                ))}
              </div>
              <span className="hint">Lexend and Hyperlegible are designed to be easier for early and dyslexic readers.</span>
            </div>
            <div className="field">
              <span className="label">Line spacing</span>
              <Segmented label="Line spacing" value={String(prefs.spacing)} onChange={(v) => setPrefs({ ...prefs, spacing: Number(v) })}
                options={[{ value: '1.45', label: 'Snug' }, { value: '1.65', label: 'Comfy' }, { value: '1.95', label: 'Airy' }]} />
            </div>
            <div className="field">
              <span className="label">Theme</span>
              <div className="theme-row">
                {(['day', 'parchment', 'night'] as const).map((t) => (
                  <button key={t} className={`theme-swatch ${t} ${prefs.theme === t ? 'on' : ''}`} onClick={() => setPrefs({ ...prefs, theme: t })} aria-pressed={prefs.theme === t}>
                    {t === 'day' ? 'Day' : t === 'parchment' ? 'Parchment' : 'Night'}
                  </button>
                ))}
              </div>
            </div>
            {wide && (
              <div className="field">
                <span className="label">Layout</span>
                <Segmented label="Layout" value={prefs.spread ? 'spread' : 'single'} onChange={(v) => setPrefs({ ...prefs, spread: v === 'spread' })}
                  options={[{ value: 'single', label: 'One page' }, { value: 'spread', label: 'Two-page spread' }]} />
              </div>
            )}
          </div>
        </Modal>
      )}

      {panel === 'lock' && edition && (
        <Modal onClose={() => setPanel(null)} label="Hand-off mode">
          <ModalHead title="Handing it to a young reader?" pose="guard" onClose={() => setPanel(null)} />
          <div className="stack">
            <p>I’ll lock Featherbound to <strong>{book.title}</strong> ({edition.name}). They can turn pages, use the contents, and change text size, but they can’t leave this book or open anything else.</p>
            <div className="card card-tinted small row" style={{ gap: 10 }}>
              <Icon name="key" size={18} />
              <span>To unlock: <strong>press and hold me</strong> (top right) for 2 seconds, then enter your parent PIN.</span>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setPanel(null)}>Not now</button>
              <button className="btn btn-primary" onClick={() => { setLock({ editionId: edition.id, bookId: book.id }); setPanel(null); setCompare(false); toast('Locked. Happy reading!', 'guard'); }}>
                <Icon name="lock" size={18} /> Lock & hand over
              </button>
            </div>
          </div>
        </Modal>
      )}

      {panel === 'unlock' && (
        <Modal onClose={() => setPanel(null)} label="Unlock">
          <PinPad
            onCancel={() => setPanel(null)}
            onDone={(entered) => {
              if (entered === pin) { setLock(null); setPanel(null); toast('Unlocked. Welcome back!', 'cheer'); nav(`/book/${book.id}`); return true; }
              return false;
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function HoldToUnlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [p, setP] = useState(0);
  const timer = useRef<number | null>(null);
  const start = () => {
    const t0 = Date.now();
    const tick = () => {
      const v = Math.min(1, (Date.now() - t0) / 2000);
      setP(v);
      if (v >= 1) { stop(); onUnlocked(); return; }
      timer.current = requestAnimationFrame(tick);
    };
    timer.current = requestAnimationFrame(tick);
  };
  const stop = () => { if (timer.current) cancelAnimationFrame(timer.current); timer.current = null; setP(0); };
  return (
    <button className="hold-unlock" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onContextMenu={(e) => e.preventDefault()} aria-label="Grown-ups: press and hold to unlock">
      <svg viewBox="0 0 48 48" className="hold-ring"><circle cx="24" cy="24" r="21" /><circle cx="24" cy="24" r="21" style={{ strokeDashoffset: 132 - 132 * p }} className="fill" /></svg>
      <Tuft pose="guard" size={34} still />
    </button>
  );
}

function PinPad({ onDone, onCancel }: { onDone: (pin: string) => boolean; onCancel: () => void }) {
  const [v, setV] = useState('');
  const [bad, setBad] = useState(false);
  const press = (d: string) => {
    if (v.length >= 4) return;
    const nv = v + d;
    setV(nv);
    if (nv.length === 4) {
      setTimeout(() => { if (!onDone(nv)) { setBad(true); setV(''); setTimeout(() => setBad(false), 600); } }, 150);
    }
  };
  return (
    <div className="stack center" style={{ alignItems: 'center' }}>
      <Tuft pose={bad ? 'worry' : 'guard'} size={80} />
      <h2>Grown-ups only</h2>
      <p className="small muted">Enter your parent PIN <span className="faint">(prototype: 1234)</span></p>
      <div className={`pin-dots ${bad ? 'shake' : ''}`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < v.length ? 'on' : ''} />)}</div>
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        <button onClick={onCancel} className="pin-cancel">Cancel</button>
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => setV(v.slice(0, -1))} aria-label="Delete"><Icon name="left" /></button>
      </div>
    </div>
  );
}
