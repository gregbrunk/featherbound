'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import BookCover from '@/components/BookCover';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import Tuft from '@/components/Tuft';
import type { CoverSpec } from '@/db/schema';
import { saveLibraryPrefs } from './books/actions';

export type LibraryBook = {
  id: string;
  title: string;
  author: string;
  status: 'importing' | 'review' | 'ready' | 'failed';
  seriesId: string | null;
  seriesOrder: number | null;
  seriesLabel: string | null;
  genres: string[];
  coverUrl: string | null;
  coverFallback: CoverSpec | null;
  addedAt: string;
  lastReadAt: string | null;
  percent: number | null;
};

export type LibrarySeries = { id: string; name: string; author: string | null };

/** A book or edition the reader is partway through. */
export type ResumeItem = {
  key: string;
  bookId: string;
  href: string;
  edition: string;
  percent: number;
  chapter: { title: string; number: number | null; total: number } | null;
  lastRead: string;
};

/** An edition being adapted right now. */
export type WorkItem = {
  key: string;
  bookId: string;
  href: string;
  edition: string;
  kind: 'samples' | 'full' | 'refine';
  done: number;
  total: number;
  paused: boolean;
};

type Prefs = {
  view: 'shelf' | 'list';
  groupBy: 'series' | 'author' | 'genre' | 'none';
  sort: 'series' | 'title' | 'author' | 'recent-read' | 'recent-added';
  genres: string[];
};

const DEFAULT_PREFS: Prefs = { view: 'shelf', groupBy: 'series', sort: 'series', genres: [] };
const FALLBACK: CoverSpec = { from: '#4b2e83', to: '#2e1b55', emblem: 'feather', ink: '#F6E3AE' };

const STATUS: Record<LibraryBook['status'], string> = {
  importing: 'Reading the file…',
  review: 'Ready to check',
  failed: 'Couldn’t import',
  ready: '',
};

type Entry = { kind: 'series'; series: LibrarySeries; books: LibraryBook[] } | { kind: 'book'; book: LibraryBook };

export default function LibraryView({ books, series, resume = [], working = [], initialPrefs, notices }: { books: LibraryBook[]; series: LibrarySeries[]; resume?: ResumeItem[]; working?: WorkItem[]; initialPrefs: Partial<Prefs> | null; notices?: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>({ ...DEFAULT_PREFS, ...(initialPrefs ?? {}) });
  const [q, setQ] = useState('');
  const [panel, setPanel] = useState<null | 'view' | 'filter'>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPrefs = (patch: Partial<Prefs>) => {
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void saveLibraryPrefs(next), 600);
      return next;
    });
  };

  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s])), [series]);
  const booksById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const ready = books.filter((b) => b.status === 'ready');
  const attention = books.filter((b) => b.status !== 'ready');
  const allGenres = [...new Set(ready.flatMap((b) => b.genres))].sort();

  const query = q.trim().toLowerCase();
  const visible = ready.filter((b) => {
    const sName = b.seriesId ? seriesById.get(b.seriesId)?.name ?? '' : '';
    if (query && ![b.title, b.author, sName, ...b.genres].some((t) => t.toLowerCase().includes(query))) return false;
    if (prefs.genres.length && !b.genres.some((g) => prefs.genres.includes(g))) return false;
    return true;
  });

  const sorted = [...visible].sort((a, b) => {
    switch (prefs.sort) {
      case 'title': return a.title.localeCompare(b.title);
      case 'author': return a.author.localeCompare(b.author) || a.title.localeCompare(b.title);
      case 'recent-read': return (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? '');
      case 'recent-added': return b.addedAt.localeCompare(a.addedAt);
      default: {
        const sa = a.seriesId ? seriesById.get(a.seriesId)?.name ?? '' : a.title;
        const sb = b.seriesId ? seriesById.get(b.seriesId)?.name ?? '' : b.title;
        return sa.localeCompare(sb) || (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0);
      }
    }
  });

  const toEntries = (list: LibraryBook[], boxSets: boolean): Entry[] => {
    const out: Entry[] = [];
    const seen = new Set<string>();
    for (const b of list) {
      if (boxSets && b.seriesId) {
        if (seen.has(b.seriesId)) continue;
        seen.add(b.seriesId);
        const inSeries = list.filter((x) => x.seriesId === b.seriesId).sort((x, y) => (x.seriesOrder ?? 0) - (y.seriesOrder ?? 0));
        const s = seriesById.get(b.seriesId);
        if (s && inSeries.length > 1) {
          out.push({ kind: 'series', series: s, books: inSeries });
          continue;
        }
      }
      out.push({ kind: 'book', book: b });
    }
    return out;
  };

  let shelves: { title: string; sub?: string; entries: Entry[] }[] = [];
  if (prefs.groupBy === 'series') {
    const all = toEntries(sorted, true);
    shelves = [
      { title: 'Series', sub: 'Box sets open to show every book in order', entries: all.filter((e) => e.kind === 'series') },
      { title: 'Books', entries: all.filter((e) => e.kind === 'book') },
    ];
  } else if (prefs.groupBy === 'author') {
    shelves = [...new Set(sorted.map((b) => b.author || 'Unknown author'))].sort().map((a) => ({ title: a, entries: toEntries(sorted.filter((b) => (b.author || 'Unknown author') === a), true) }));
  } else if (prefs.groupBy === 'genre') {
    const gs = [...new Set(sorted.flatMap((b) => (b.genres.length ? b.genres : ['Other'])))].sort();
    shelves = gs.map((g) => ({ title: g, entries: toEntries(sorted.filter((b) => (b.genres.length ? b.genres : ['Other']).includes(g)), false) }));
  } else {
    shelves = [{ title: 'All books', entries: toEntries(sorted, false) }];
  }
  shelves = shelves.filter((s) => s.entries.length);

  const [hero, ...alsoReading] = resume.flatMap((r) => { const book = booksById.get(r.bookId); return book ? [{ ...r, book }] : []; });
  const adapting = working.flatMap((w) => { const book = booksById.get(w.bookId); return book ? [{ ...w, book }] : []; });

  if (books.length === 0) {
    return (
      <main className="page">
        <h1>My Library</h1>
        <section className="shelf-section">
          <div className="shelf empty-shelf">
            <div className="row" style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Tuft pose="read" size={80} />
              <div className="stack-sm">
                <span className="muted">Your shelves are empty… for now.</span>
                <Link href="/add" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}><Icon name="plus" size={16} /> Add your first book</Link>
              </div>
            </div>
          </div>
          <div className="shelf-board" />
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      {notices}
      <section className="lib-hero">
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <h1>My Library</h1>
          <p className="muted">{ready.length} book{ready.length === 1 ? '' : 's'}</p>
        </div>
        <Link href="/add" className="btn btn-primary"><Icon name="plus" size={18} /> Add a book</Link>
      </section>

      {attention.length > 0 && (
        <section className="attention" aria-label="Needs attention">
          {attention.map((b) => (
            <Link key={b.id} href={`/books/${b.id}/review`} className="attention-card">
              <Cover book={b} className="mini-cover" />
              <div style={{ minWidth: 0, flex: 1 }} className="stack-sm">
                <div className="t">{b.title}</div>
                <span className={`chip ${b.status === 'failed' ? 'chip-ruby' : b.status === 'review' ? 'chip-gold' : ''}`} style={{ alignSelf: 'flex-start' }}>
                  {b.status === 'importing' && <span className="dot" />} {STATUS[b.status]}
                </span>
              </div>
              <Icon name="right" size={18} className="faint" />
            </Link>
          ))}
        </section>
      )}

      {(hero || adapting.length > 0) && (
        <section className={`now-reading ${hero && (alsoReading.length || adapting.length) ? '' : 'solo'}`} aria-label="Keep reading">
          {hero && (
            <Link href={hero.href} className="now-hero">
              <Sparkle className="now-spark" style={{ right: 26, top: 22 }} size={18} />
              <Sparkle className="now-spark" style={{ right: 64, top: 56 }} size={10} />
              <Cover book={hero.book} className="now-cover" />
              <div className="now-body">
                <span className="eyebrow">Pick up where you left off</span>
                <h2 className="clamp-2">{hero.book.title}</h2>
                <span className="now-sub">{hero.edition}{hero.chapter ? ` · ${chapterLabel(hero.chapter)}` : ''}</span>
                <div className="progress-bar gold"><i style={{ width: `${Math.max(2, hero.percent)}%` }} /></div>
                <div className="now-line"><span>{Math.round(hero.percent)}% read</span><span>{hero.lastRead}</span></div>
                <span className="btn btn-gold btn-sm now-cta"><Icon name="play" size={16} /> Continue reading</span>
              </div>
            </Link>
          )}
          {(alsoReading.length > 0 || adapting.length > 0) && (
            <div className="now-queue">
              <span className="eyebrow">{hero ? 'Also on the go' : 'In progress'}</span>
              {alsoReading.map((r) => (
                <Link key={r.key} href={r.href} className="now-row">
                  <Cover book={r.book} className="mini-cover" />
                  <div className="now-row-body">
                    <span className="t ellipsis">{r.book.title}</span>
                    <div className="progress-bar gold"><i style={{ width: `${Math.max(2, r.percent)}%` }} /></div>
                    <span className="s"><span className="ellipsis">{r.edition}</span><span>{Math.round(r.percent)}%</span></span>
                  </div>
                </Link>
              ))}
              {adapting.map((w) => {
                const pct = w.total ? Math.round((w.done / w.total) * 100) : 0;
                return (
                  <Link key={w.key} href={w.href} className="now-row">
                    <Cover book={w.book} className="mini-cover" />
                    <div className="now-row-body">
                      <span className="t ellipsis">{w.book.title}</span>
                      <div className={`progress-bar ${w.paused ? 'ruby' : 'working'}`}><i style={{ width: `${Math.max(2, pct)}%` }} /></div>
                      <span className="s">
                        <span className="ellipsis">{w.paused ? 'Paused at your cost cap' : `${w.kind === 'samples' ? 'Writing samples' : w.kind === 'refine' ? 'Refining' : 'Adapting'} · ${w.done} of ${w.total} chapters`}</span>
                        <span>{pct}%</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="shelf-section">
        <div className="toolbar" role="search">
          <label className="search">
            <Icon name="search" size={18} />
            <span className="sr-only">Search the library</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, authors, series, genres…" />
            {q && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setQ('')} aria-label="Clear search"><Icon name="x" size={16} /></button>}
          </label>
          <div className="segmented" role="radiogroup" aria-label="Layout">
            {(['shelf', 'list'] as const).map((v) => (
              <button key={v} role="radio" aria-checked={prefs.view === v} className={prefs.view === v ? 'on' : ''} onClick={() => setPrefs({ view: v })}>
                <Icon name={v === 'shelf' ? 'grid' : 'list'} size={16} /> <span className="hide-sm">{v === 'shelf' ? 'Shelves' : 'List'}</span>
              </button>
            ))}
          </div>
          <Popover open={panel === 'view'} onToggle={() => setPanel(panel === 'view' ? null : 'view')} onClose={() => setPanel(null)} button={<><Icon name="sliders" size={16} /> View & sort</>}>
            <div className="stack">
              <div>
                <h4>Group shelves by</h4>
                <div className="row-wrap">
                  {(['series', 'author', 'genre', 'none'] as const).map((g) => (
                    <button key={g} className={`chip ${prefs.groupBy === g ? '' : 'chip-outline'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setPrefs({ groupBy: g })} aria-pressed={prefs.groupBy === g}>
                      {g === 'none' ? 'Nothing' : g[0].toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4>Sort by</h4>
                <Select<Prefs['sort']> label="Sort by" value={prefs.sort} onChange={(v) => setPrefs({ sort: v })}
                  options={[
                    { value: 'series', label: 'Series order' },
                    { value: 'title', label: 'Title' },
                    { value: 'author', label: 'Author' },
                    { value: 'recent-read', label: 'Recently read' },
                    { value: 'recent-added', label: 'Recently added' },
                  ]} />
              </div>
              <p className="tiny faint">Featherbound remembers how you like your shelves.</p>
            </div>
          </Popover>
          {allGenres.length > 0 && (
            <Popover open={panel === 'filter'} onToggle={() => setPanel(panel === 'filter' ? null : 'filter')} onClose={() => setPanel(null)} button={<><Icon name="flag" size={16} /> Filter{prefs.genres.length ? ` · ${prefs.genres.length}` : ''}</>}>
              <div className="stack">
                <div>
                  <h4>Genre</h4>
                  <div className="row-wrap">
                    {allGenres.map((g) => (
                      <button key={g} className={`chip ${prefs.genres.includes(g) ? '' : 'chip-outline'}`} style={{ cursor: 'pointer', border: 'none' }} aria-pressed={prefs.genres.includes(g)}
                        onClick={() => setPrefs({ genres: prefs.genres.includes(g) ? prefs.genres.filter((x) => x !== g) : [...prefs.genres, g] })}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setPrefs({ genres: [] })}>Clear filters</button>
              </div>
            </Popover>
          )}
        </div>
      </section>

      {shelves.length === 0 && (
        <div className="card center stack" style={{ marginTop: 30, alignItems: 'center', padding: 40 }}>
          <Tuft pose="think" size={100} />
          <h2>Hmm, no books match that</h2>
          <button className="btn btn-secondary" onClick={() => { setQ(''); setPrefs({ genres: [] }); }}>Clear search & filters</button>
        </div>
      )}

      {prefs.view === 'shelf'
        ? shelves.map((s) => (
            <section key={s.title} className="shelf-section">
              <div className="shelf-head"><h2>{s.title}</h2>{s.sub && <span className="small faint hide-sm">{s.sub}</span>}</div>
              <div className="shelf">
                {s.entries.map((e) =>
                  e.kind === 'series' ? (
                    <Link key={`s-${e.series.id}`} href={`/series/${e.series.id}`} className="shelf-item" aria-label={`${e.series.name} series, ${e.books.length} books`}>
                      <div className="boxset">
                        <span className="boxset-count">{e.books.length} books</span>
                        {e.books.slice(0, 3).map((b) => <Cover key={b.id} book={b} />)}
                      </div>
                      <div className="shelf-meta"><div className="t">{e.series.name}</div><div className="s">{e.series.author ?? ''}</div></div>
                    </Link>
                  ) : (
                    <Link key={`b-${e.book.id}`} href={`/books/${e.book.id}`} className="shelf-item">
                      <Cover book={e.book} />
                      <div className="shelf-meta">
                        <div className="t">{e.book.title}</div>
                        <div className="s">{e.book.seriesLabel && e.book.seriesId ? `${e.book.seriesLabel} · ` : ''}{e.book.author}</div>
                      </div>
                    </Link>
                  ),
                )}
              </div>
              <div className="shelf-board" />
            </section>
          ))
        : (
          <section className="shelf-section">
            <table className="list-table">
              <thead className="sr-only"><tr><th>Cover</th><th>Title</th><th>Series</th><th>Genres</th></tr></thead>
              <tbody>
                {sorted.map((b) => {
                  const s = b.seriesId ? seriesById.get(b.seriesId) : null;
                  return (
                    <tr key={b.id} className="list-row">
                      <td style={{ width: 64 }}><Link href={`/books/${b.id}`} aria-label={b.title}><Cover book={b} className="list-cover" /></Link></td>
                      <td><Link href={`/books/${b.id}`} style={{ textDecoration: 'none', color: 'inherit' }}><div style={{ fontWeight: 800 }}>{b.title}</div><div className="small muted">{b.author}</div></Link></td>
                      <td className="small muted hide-sm">{s ? `${s.name}${b.seriesLabel ? ` · ${b.seriesLabel}` : ''}` : '—'}</td>
                      <td><div className="row-wrap">{b.genres.slice(0, 3).map((g) => <span key={g} className="chip chip-plain">{g}</span>)}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
    </main>
  );
}

function chapterLabel(c: NonNullable<ResumeItem['chapter']>) {
  if (/^(chapter|part|book)\b/i.test(c.title) || c.number === null) return c.title;
  return `Chapter ${c.number}: ${c.title}`;
}

function Sparkle({ size, className, style }: { size: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="-6 -6 12 12" aria-hidden="true">
      <path d="M0-5L1.4-1.4 5 0 1.4 1.4 0 5-1.4 1.4-5 0-1.4-1.4Z" fill="currentColor" />
    </svg>
  );
}

function Cover({ book, className = '' }: { book: LibraryBook; className?: string }) {
  return <BookCover cover={book.coverFallback ?? FALLBACK} image={book.coverUrl ?? undefined} title={book.title} author={book.author} className={className} />;
}

function Popover({ open, onToggle, onClose, button, children }: { open: boolean; onToggle: () => void; onClose: () => void; button: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.fb-select-list')) onClose();
    };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open, onClose]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`btn btn-secondary btn-sm ${open ? 'pressed' : ''}`} onClick={onToggle} aria-expanded={open}>{button}</button>
      {open && <div className="popover">{children}</div>}
    </div>
  );
}
