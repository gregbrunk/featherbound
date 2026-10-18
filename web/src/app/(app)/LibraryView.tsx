'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

export default function LibraryView({ books, series, initialPrefs }: { books: LibraryBook[]; series: LibrarySeries[]; initialPrefs: Partial<Prefs> | null }) {
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

  const keepReading = ready.filter((b) => b.lastReadAt && (b.percent ?? 0) < 100).sort((a, b) => (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? '')).slice(0, 3);

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

      {keepReading.length > 0 && (
        <section className="shelf-section">
          <div className="shelf-head"><h2>Keep reading</h2></div>
          <div className="continue-row">
            {keepReading.map((b) => (
              <Link key={b.id} href={`/read/book/${b.id}`} className="continue-card">
                <Cover book={b} className="mini-cover" />
                <div style={{ minWidth: 0, flex: 1 }} className="stack-sm">
                  <div><div className="t">{b.title}</div><div className="s">Original</div></div>
                  <div className="progress-bar gold"><i style={{ width: `${b.percent ?? 0}%` }} /></div>
                  <div className="s">{Math.round(b.percent ?? 0)}%</div>
                </div>
                <span className="btn btn-primary btn-icon btn-sm" aria-hidden="true"><Icon name="play" size={16} /></span>
              </Link>
            ))}
          </div>
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
