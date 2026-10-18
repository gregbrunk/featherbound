'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import { Modal, ModalHead, Segmented } from '@/components/ui';
import type { Block } from '@/lib/import/types';
import { addBookmark, removeBookmark, saveProgress } from '../../../(app)/books/actions';

type Section = { id: string; title: string; subtitle?: string };
type Bookmark = { id: string; sectionId: string; fraction: number; label: string };
type Props = {
  bookId: string;
  /** Where chapter text comes from; defaults to the original book's sections. */
  textBase?: string;
  textQuery?: string;
  title: string;
  subtitle: string;
  backHref: string;
  target: string;
  sections: Section[];
  start: { sectionId: string; fraction: number };
  bookmarks: Bookmark[];
};

const FONTS = [
  { id: 'literata', name: 'Literata', css: 'var(--font-read)' },
  { id: 'fraunces', name: 'Storybook', css: 'var(--font-display)' },
  { id: 'lexend', name: 'Lexend', css: 'var(--font-lexend)' },
  { id: 'atkinson', name: 'Hyperlegible', css: 'var(--font-hyperlegible)' },
];

type Prefs = { size: number; font: string; spacing: number; theme: 'day' | 'parchment' | 'night'; spread: boolean };
const DEFAULT_PREFS: Prefs = { size: 20, font: 'literata', spacing: 1.65, theme: 'parchment', spread: true };

// Reading preferences live in this device's localStorage; screen width comes from a media
// query. Both are read through useSyncExternalStore so server and first client render agree.
const PREFS_KEY = 'fb.reader';
const prefsListeners = new Set<() => void>();
let prefsCache: { raw: string | null; value: Prefs } = { raw: null, value: DEFAULT_PREFS };
function readPrefs(): Prefs {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PREFS_KEY); } catch { /* storage unavailable */ }
  if (raw !== prefsCache.raw) {
    try { prefsCache = { raw, value: raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS }; } catch { prefsCache = { raw, value: DEFAULT_PREFS }; }
  }
  return prefsCache.value;
}
function writePrefs(p: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  prefsListeners.forEach((l) => l());
}
const subscribePrefs = (l: () => void) => { prefsListeners.add(l); return () => prefsListeners.delete(l); };
const WIDE = '(min-width: 900px)';
const subscribeWide = (l: () => void) => { const m = window.matchMedia(WIDE); m.addEventListener('change', l); return () => m.removeEventListener('change', l); };

// Chapter html is produced by our parser (only <em>, <strong>, <br>); this is a second guard.
const safeInline = (html: string) => html.replace(/<(?!\/?(em|strong)>|br\s*\/?>)[^>]*>/gi, '');

export default function Reader({ bookId, textBase, textQuery = '', title, subtitle, backHref, target, sections, start, bookmarks: initialBookmarks }: Props) {
  const startIndex = Math.max(0, sections.findIndex((s) => s.id === start.sectionId));
  const [index, setIndex] = useState(startIndex);
  const [loaded, setLoaded] = useState<{ sectionId: string; blocks: Block[] } | null>(null);
  const [zoom, setZoom] = useState<{ imageId: string; alt: string } | null>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState<null | 'toc' | 'type'>(null);
  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, () => DEFAULT_PREFS);
  const setPrefs = writePrefs;
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [geom, setGeom] = useState({ col: 600, gap: 64 });
  const pagerRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const pendingFraction = useRef<number | null>(start.fraction);
  const goLast = useRef(false);
  const cache = useRef(new Map<string, Block[]>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the current chapter (and warm the next one).
  useEffect(() => {
    let cancelled = false;
    const load = async (i: number) => {
      const s = sections[i];
      if (!s) return null;
      const hit = cache.current.get(s.id);
      if (hit) return hit;
      const res = await fetch(`${textBase ?? `/api/books/${bookId}/sections`}/${s.id}${textQuery}`);
      if (!res.ok) throw new Error('Could not load chapter');
      const data = (await res.json()) as { blocks: Block[] };
      cache.current.set(s.id, data.blocks);
      return data.blocks;
    };
    const sectionId = sections[index]?.id;
    load(index).then((b) => {
      if (cancelled || !sectionId) return;
      setLoaded({ sectionId, blocks: b ?? [] });
      void load(index + 1).catch(() => undefined);
    }).catch(() => {
      if (!cancelled && sectionId) setLoaded({ sectionId, blocks: [{ type: 'p', html: 'This chapter couldn’t be loaded. Check your connection and try again.' }] });
    });
    return () => { cancelled = true; };
  }, [index, sections, bookId, textBase, textQuery]);

  const blocks = loaded && loaded.sectionId === sections[index]?.id ? loaded.blocks : null;
  const spread = prefs.spread && wide;

  const measure = useCallback(() => {
    const pager = pagerRef.current, flow = flowRef.current;
    if (!pager || !flow) return;
    const w = pager.getBoundingClientRect().width;
    const gap = Math.max(32, Math.min(80, w * 0.06));
    const col = spread ? (w - gap) / 2 : w;
    setGeom({ col, gap });
    requestAnimationFrame(() => {
      const total = Math.max(1, Math.round((flow.scrollWidth + gap) / (col + gap)));
      const n = Math.max(1, Math.ceil(total / (spread ? 2 : 1)));
      setPages(n);
      if (goLast.current) { setPage(n - 1); goLast.current = false; }
      else if (pendingFraction.current !== null) { setPage(Math.min(n - 1, Math.round(pendingFraction.current * (n - 1)))); pendingFraction.current = null; }
      else setPage((p) => Math.min(p, n - 1));
    });
  }, [spread]);

  useLayoutEffect(() => {
    if (!blocks) return;
    measure();
    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [measure, blocks, prefs.size, prefs.font, prefs.spacing]);
  useEffect(() => {
    const ro = new ResizeObserver(() => measure());
    if (pagerRef.current) ro.observe(pagerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const fraction = pages > 1 ? page / (pages - 1) : 0;
  const overall = sections.length ? ((index + (pages > 1 ? (page + 1) / pages : 1)) / sections.length) * 100 : 0;

  // Save progress a moment after the reader stops turning pages.
  useEffect(() => {
    if (!blocks) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const s = sections[index];
    saveTimer.current = setTimeout(() => void saveProgress(target, s.id, fraction, overall), 1200);
  }, [index, page, pages, blocks, sections, target, fraction, overall]);

  const next = useCallback(() => {
    if (page < pages - 1) setPage(page + 1);
    else if (index < sections.length - 1) { setIndex(index + 1); setPage(0); }
  }, [page, pages, index, sections.length]);
  const prev = useCallback(() => {
    if (page > 0) setPage(page - 1);
    else if (index > 0) { goLast.current = true; setIndex(index - 1); }
  }, [page, index]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (zoom) { if (e.key === 'Escape') setZoom(null); return; }
      if (panel) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [next, prev, panel, zoom]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { touch.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
    // A tap on a picture opens it full screen instead of turning the page.
    if ((e.target as HTMLElement).closest('.illus')) return;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && window.getSelection()?.isCollapsed !== false) {
      const r = pagerRef.current!.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < 0.28) prev(); else if (x > 0.72) next(); else setChrome((c) => !c);
    }
  };

  const goTo = (sectionId: string, frac = 0) => {
    const i = sections.findIndex((s) => s.id === sectionId);
    if (i < 0) return;
    pendingFraction.current = frac;
    if (i === index) measure();
    setIndex(i);
    setPanel(null);
  };

  const here = bookmarks.find((b) => b.sectionId === sections[index]?.id && Math.abs(b.fraction - fraction) < 0.5 / Math.max(1, pages));
  const toggleBookmark = async () => {
    if (here) {
      setBookmarks((bs) => bs.filter((b) => b.id !== here.id));
      await removeBookmark(here.id);
    } else {
      const label = `${sections[index].title} · page ${page + 1}`;
      const row = await addBookmark(target, sections[index].id, fraction, label);
      setBookmarks((bs) => [...bs, { id: row.id, sectionId: row.sectionId, fraction: row.fraction, label: row.label }]);
    }
  };

  const step = (geom.col + geom.gap) * (spread ? 2 : 1);
  const font = FONTS.find((f) => f.id === prefs.font) ?? FONTS[0];
  const section = sections[index];

  return (
    <div className={`reader theme-${prefs.theme} ${chrome ? '' : 'immersive'}`}>
      <header className="reader-bar">
        <Link href={backHref} className="btn btn-ghost btn-icon" aria-label="Back to book"><Icon name="left" /></Link>
        <div className="reader-title">
          <strong className="ellipsis">{title}</strong>
          <span className="tiny ellipsis">{subtitle}</span>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setPanel('toc')} aria-label="Contents and bookmarks"><Icon name="toc" /></button>
          <button className="btn btn-ghost btn-icon" onClick={() => setPanel('type')} aria-label="Reading settings"><Icon name="text" /></button>
          <button className={`btn btn-ghost btn-icon ${here ? 'on' : ''}`} onClick={() => void toggleBookmark()} aria-label={here ? 'Remove bookmark' : 'Bookmark this page'} aria-pressed={Boolean(here)}>
            <Icon name="bookmark" />
          </button>
        </div>
      </header>

      <div className="pager" ref={pagerRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        {!blocks ? (
          <div className="center stack" style={{ alignItems: 'center', paddingTop: '20vh' }}><Tuft pose="read" size={80} /><span className="small">Opening…</span></div>
        ) : (
          <div
            className={`flow ${spread ? 'spread' : ''}`}
            ref={flowRef}
            style={{ columnWidth: geom.col, columnGap: geom.gap, transform: `translateX(-${page * step}px)`, fontFamily: font.css, fontSize: prefs.size, lineHeight: prefs.spacing }}
          >
            <div className="chapter-head">
              <span className="chapter-num">{index + 1} of {sections.length}</span>
              <h1>{section?.title}</h1>
              {section?.subtitle && <p className="chapter-subtitle">{section.subtitle}</p>}
              <div className="chapter-flourish" aria-hidden="true">✦ ❦ ✦</div>
            </div>
            {blocks.map((b, i) => {
              if (b.type === 'hr') return <div key={i} className="scene-break" aria-hidden="true">⁂</div>;
              if (b.type === 'img') return (
                <figure key={i} className="illus" role="button" tabIndex={0} aria-label={`Show picture full screen${b.alt ? `: ${b.alt}` : ''}`}
                  onClick={(e) => { e.stopPropagation(); setZoom({ imageId: b.imageId, alt: b.alt }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setZoom({ imageId: b.imageId, alt: b.alt }); } }}>
                  {/* Book images come from our auth-checked image route. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="illus-img" src={`/api/books/${bookId}/images/${b.imageId}`} alt={b.alt} loading="lazy" />
                </figure>
              );
              if (b.type === 'h') return <h2 key={i} className={`book-h book-h${b.level}`} dangerouslySetInnerHTML={{ __html: safeInline(b.html) }} />;
              if (b.type === 'quote') return <blockquote key={i} className={`book-quote${b.html.startsWith('<em>The story so far') ? ' recap' : ''}`} dangerouslySetInnerHTML={{ __html: safeInline(b.html) }} />;
              return <p key={i} dangerouslySetInnerHTML={{ __html: safeInline(b.html) }} />;
            })}
            {index === sections.length - 1 && (
              <div className="end-note"><Tuft pose="cheer" size={70} still /><p>The end.</p></div>
            )}
          </div>
        )}
      </div>

      {zoom && (
        <div className="scrim" onClick={() => setZoom(null)} role="dialog" aria-modal="true" aria-label="Picture">
          <figure className="illus-zoom">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="illus-img" src={`/api/books/${bookId}/images/${zoom.imageId}`} alt={zoom.alt} />
            {zoom.alt && <figcaption>{zoom.alt}</figcaption>}
          </figure>
        </div>
      )}

      <footer className="reader-foot">
        <button className="btn btn-ghost btn-icon" onClick={prev} aria-label="Previous page"><Icon name="left" /></button>
        <div className="reader-progress">
          <div className="chapter-track" aria-hidden="true">
            {sections.length <= 80 && sections.map((s, i) => <i key={s.id} style={{ left: `${(i / sections.length) * 100}%` }} />)}
            <b style={{ width: `${overall}%` }} />
          </div>
          <span className="tiny">Page {page + 1} of {pages} · {Math.round(overall)}% of the book</span>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={next} aria-label="Next page"><Icon name="right" /></button>
      </footer>

      {panel === 'toc' && (
        <Modal onClose={() => setPanel(null)} label="Contents">
          <ModalHead title="Contents" onClose={() => setPanel(null)} />
          {bookmarks.length > 0 && (
            <div className="stack-sm" style={{ marginBottom: 14 }}>
              <span className="label">Bookmarks</span>
              <ul className="toc">
                {bookmarks.map((b) => (
                  <li key={b.id} className="row" style={{ gap: 4 }}>
                    <button className="toc-item" style={{ flex: 1 }} onClick={() => goTo(b.sectionId, b.fraction)}><Icon name="bookmark" size={16} /> <span>{b.label}</span></button>
                    <button className="btn btn-ghost btn-icon btn-sm" aria-label="Remove bookmark" onClick={() => { setBookmarks((bs) => bs.filter((x) => x.id !== b.id)); void removeBookmark(b.id); }}><Icon name="x" size={14} /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ol className="toc">
            {sections.map((s, i) => (
              <li key={s.id}>
                <button className={`toc-item ${i === index ? 'on' : ''}`} onClick={() => goTo(s.id)}>
                  <span className="mono faint">{i + 1}</span><span style={{ flex: 1 }}>{s.title}</span>
                </button>
              </li>
            ))}
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
    </div>
  );
}
