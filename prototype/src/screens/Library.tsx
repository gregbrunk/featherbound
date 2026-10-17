import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import type { ViewPrefs } from '../store';
import BookCover from '../components/BookCover';
import Tuft from '../components/Tuft';
import Icon from '../components/Icon';
import { Guide, Segmented } from '../components/ui';
import type { Book, Edition } from '../data/types';

type ShelfEntry =
  | { kind: 'series'; id: string; name: string; author: string; books: Book[] }
  | { kind: 'book'; book: Book }
  | { kind: 'edition'; book: Book; edition: Edition };

const AGE_GROUPS = [
  { id: '3-5', label: 'Ages 3–5', test: (a: number) => a <= 5 },
  { id: '6-8', label: 'Ages 6–8', test: (a: number) => a >= 6 && a <= 8 },
  { id: '9-12', label: 'Ages 9–12', test: (a: number) => a >= 9 && a <= 12 },
  { id: '13+', label: 'Ages 13+', test: (a: number) => a >= 13 },
];

const STATUS_LABEL: Record<string, string> = {
  running: 'Being written',
  'samples-ready': 'Samples ready',
  'making-samples': 'Making samples',
  'paused-cap': 'Paused at cap',
};

export default function Library() {
  const { books, series, editions, progress, prefs, setPrefs } = useStore();
  const [q, setQ] = useState('');
  const [panel, setPanel] = useState<null | 'view' | 'filter'>(null);
  const nav = useNavigate();

  const edByBook = useMemo(() => {
    const m: Record<string, Edition[]> = {};
    for (const e of editions) (m[e.bookId] ??= []).push(e);
    return m;
  }, [editions]);

  // ----- Filtering -----
  const f = prefs.filters;
  const activeFilters = f.genre.length + f.age.length + f.mode.length + f.status.length + (f.illustrated === null ? 0 : 1);

  const editionPasses = (e: Edition) =>
    (!f.age.length || AGE_GROUPS.some((g) => f.age.includes(g.id) && g.test(e.settings.targetAge))) &&
    (!f.mode.length || f.mode.includes(e.settings.readingMode)) &&
    (f.illustrated === null || e.settings.picture.on === f.illustrated) &&
    (!f.status.length || f.status.includes(e.status === 'ready' ? 'ready' : 'in-progress'));
  const editionFiltersOn = f.age.length + f.mode.length + f.status.length + (f.illustrated === null ? 0 : 1) > 0;

  const query = q.trim().toLowerCase();
  const visibleBooks = books.filter((b) => {
    const s = series.find((x) => x.id === b.seriesId);
    if (query && ![b.title, b.author, s?.name ?? '', ...b.tags].some((t) => t.toLowerCase().includes(query)) && !(query === 'dorothy' && b.id === 'oz'))
      return false;
    if (f.genre.length && !b.genres.some((g) => f.genre.includes(g))) return false;
    if (editionFiltersOn && !(edByBook[b.id] ?? []).some(editionPasses)) return false;
    return true;
  });

  // ----- Sorting -----
  const lastRead = (b: Book) =>
    Math.max(0, ...(edByBook[b.id] ?? []).map((e) => (progress[e.id] ? Date.parse(progress[e.id].updatedAt) : 0)));
  const sorted = [...visibleBooks].sort((a, b) => {
    switch (prefs.sort) {
      case 'title': return a.title.localeCompare(b.title);
      case 'author': return a.author.localeCompare(b.author) || a.title.localeCompare(b.title);
      case 'recent-read': return lastRead(b) - lastRead(a);
      case 'recent-added': return b.addedAt.localeCompare(a.addedAt);
      default: return (a.seriesId ?? a.title).localeCompare(b.seriesId ?? b.title) || (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0);
    }
  });

  // ----- Grouping into shelves -----
  const toEntries = (list: Book[], boxSeries: boolean): ShelfEntry[] => {
    const out: ShelfEntry[] = [];
    const seen = new Set<string>();
    for (const b of list) {
      if (boxSeries && b.seriesId) {
        if (seen.has(b.seriesId)) continue;
        seen.add(b.seriesId);
        const sb = list.filter((x) => x.seriesId === b.seriesId).sort((x, y) => (x.seriesOrder ?? 0) - (y.seriesOrder ?? 0));
        const s = series.find((x) => x.id === b.seriesId)!;
        if (sb.length > 1) {
          out.push({ kind: 'series', id: s.id, name: s.name, author: s.author, books: sb });
          continue;
        }
      }
      if (prefs.editions === 'separate') {
        const eds = (edByBook[b.id] ?? []).filter((e) => !editionFiltersOn || editionPasses(e));
        if (!editionFiltersOn) out.push({ kind: 'book', book: b });
        for (const e of eds) out.push({ kind: 'edition', book: b, edition: e });
      } else {
        out.push({ kind: 'book', book: b });
      }
    }
    return out;
  };

  let shelves: { title: string; sub?: string; entries: ShelfEntry[]; link?: string }[] = [];
  if (prefs.groupBy === 'series') {
    const inSeries = sorted.filter((b) => b.seriesId);
    const solo = sorted.filter((b) => !b.seriesId);
    const seriesShelf = toEntries(inSeries, true);
    // Single-book series sit with the standalones.
    shelves = [
      { title: 'Series', sub: 'Box sets open to show every book in order', entries: seriesShelf.filter((e) => e.kind === 'series') },
      { title: 'Books', sub: 'Standalones and first books', entries: [...seriesShelf.filter((e) => e.kind !== 'series'), ...toEntries(solo, false)] },
    ];
  } else if (prefs.groupBy === 'author') {
    const authors = [...new Set(sorted.map((b) => b.author))].sort();
    shelves = authors.map((a) => ({ title: a, entries: toEntries(sorted.filter((b) => b.author === a), true) }));
  } else if (prefs.groupBy === 'genre') {
    const genres = [...new Set(sorted.flatMap((b) => b.genres))].sort();
    shelves = genres.map((g) => ({ title: g, entries: toEntries(sorted.filter((b) => b.genres.includes(g)), false) }));
  } else {
    shelves = [{ title: 'All books', entries: toEntries(sorted, false) }];
  }
  shelves = shelves.filter((s) => s.entries.length);

  // ----- Continue reading -----
  const continueReading = Object.entries(progress)
    .map(([eid, p]) => ({ e: editions.find((x) => x.id === eid), p }))
    .filter((x): x is { e: Edition; p: typeof x.p } => !!x.e)
    .sort((a, b) => b.p.updatedAt.localeCompare(a.p.updatedAt))
    .slice(0, 3);

  const inProgress = editions.filter((e) => e.status !== 'ready');

  return (
    <main className="page">
      <section className="lib-hero">
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <h1>The Family Library</h1>
          <p className="muted">{books.length} books · {editions.length} softened editions</p>
        </div>
        <div className="lib-hero-guide">
          <Guide pose="read" size={78}>
            {inProgress.length ? (
              <>
                Good evening! I’m busy writing <strong>{inProgress.length} edition{inProgress.length > 1 ? 's' : ''}</strong>.{' '}
                {inProgress.some((e) => e.status === 'samples-ready') && <>Some sample chapters are ready for you. </>}
                {inProgress.some((e) => e.status === 'paused-cap') && <>One run paused at its cost cap.</>}
              </>
            ) : (
              <>Good evening! What shall we read tonight?</>
            )}
          </Guide>
        </div>
      </section>

      {inProgress.length > 0 && (
        <section className="attention" aria-label="Needs attention">
          {inProgress.map((e) => {
            const b = books.find((x) => x.id === e.bookId)!;
            const to = e.status === 'samples-ready' ? `/edition/${e.id}/samples` : `/edition/${e.id}/progress`;
            return (
              <Link key={e.id} to={to} className="attention-card">
                <BookCover cover={b.cover} image={b.coverUrl} title={b.title} author={b.author} size="sm" className="mini-cover" />
                <div style={{ minWidth: 0, flex: 1 }} className="stack-sm">
                  <div>
                    <div className="t">{b.title}</div>
                    <div className="s">{e.name}</div>
                  </div>
                  <span className={`chip ${e.status === 'paused-cap' ? 'chip-ruby' : e.status === 'samples-ready' ? 'chip-gold' : ''}`} style={{ alignSelf: 'flex-start' }}>
                    {e.status === 'running' && e.run ? `Writing chapter ${e.run.chapter} of ${e.run.of}` : STATUS_LABEL[e.status]}
                  </span>
                  {e.run && e.status === 'running' && (
                    <div className="progress-bar"><i style={{ width: `${(e.run.chapter / e.run.of) * 100}%` }} /></div>
                  )}
                </div>
                <Icon name="right" size={18} className="faint" />
              </Link>
            );
          })}
        </section>
      )}

      {continueReading.length > 0 && (
        <section className="shelf-section">
          <div className="shelf-head"><h2>Keep reading</h2></div>
          <div className="continue-row">
            {continueReading.map(({ e, p }) => {
              const b = books.find((x) => x.id === e.bookId)!;
              return (
                <Link key={e.id} to={`/read/edition/${e.id}`} className="continue-card">
                  <BookCover cover={b.cover} image={b.coverUrl} title={b.title} author={b.author} size="sm" className="mini-cover" />
                  <div style={{ minWidth: 0, flex: 1 }} className="stack-sm">
                    <div>
                      <div className="t">{b.title}</div>
                      <div className="s">{e.name}</div>
                    </div>
                    <div className="progress-bar gold"><i style={{ width: `${p.percent}%` }} /></div>
                    <div className="s">Chapter {p.chapter} · {p.percent}%</div>
                  </div>
                  <span className="btn btn-primary btn-icon btn-sm" aria-hidden="true"><Icon name="play" size={16} /></span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="shelf-section">
        <div className="toolbar" role="search">
          <label className="search">
            <Icon name="search" size={18} />
            <span className="sr-only">Search the library</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, authors, series, characters…" />
            {q && (
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setQ('')} aria-label="Clear search">
                <Icon name="x" size={16} />
              </button>
            )}
          </label>
          <Segmented<ViewPrefs['view']>
            label="Layout"
            value={prefs.view}
            onChange={(v) => setPrefs({ view: v })}
            options={[
              { value: 'shelf', label: <><Icon name="grid" size={16} /> <span className="hide-sm">Shelves</span></> },
              { value: 'list', label: <><Icon name="list" size={16} /> <span className="hide-sm">List</span></> },
            ]}
          />
          <Popover open={panel === 'view'} onOpen={() => setPanel(panel === 'view' ? null : 'view')} onClose={() => setPanel(null)}
            button={<><Icon name="sliders" size={16} /> View & sort</>}
          >
            <ViewPanel />
          </Popover>
          <Popover open={panel === 'filter'} onOpen={() => setPanel(panel === 'filter' ? null : 'filter')} onClose={() => setPanel(null)}
            button={<><Icon name="flag" size={16} /> Filter{activeFilters ? ` · ${activeFilters}` : ''}</>}
          >
            <FilterPanel genres={[...new Set(books.flatMap((b) => b.genres))].sort()} />
          </Popover>
        </div>
      </section>

      {shelves.length === 0 && (
        <div className="card center stack" style={{ marginTop: 30, alignItems: 'center', padding: 40 }}>
          <Tuft pose="think" size={110} />
          <h2>Hmm, no books match that</h2>
          <p className="muted">Try a different search or clear your filters.</p>
          <button className="btn btn-secondary" onClick={() => { setQ(''); setPrefs({ filters: { genre: [], age: [], mode: [], illustrated: null, status: [] } }); }}>
            Clear search & filters
          </button>
        </div>
      )}

      {prefs.view === 'shelf'
        ? shelves.map((s) => (
            <section key={s.title} className="shelf-section">
              <div className="shelf-head">
                <h2>{s.title}</h2>
                {s.sub && <span className="small faint hide-sm">{s.sub}</span>}
              </div>
              <div className="shelf">
                {s.entries.map((en) => (
                  <ShelfItem key={en.kind === 'series' ? `s-${en.id}` : en.kind === 'edition' ? `e-${en.edition.id}` : `b-${en.book.id}`} entry={en} eds={edByBook} onOpen={(to) => nav(to)} />
                ))}
              </div>
              <div className="shelf-board" />
            </section>
          ))
        : (
          <section className="shelf-section">
            <ListView books={sorted} eds={edByBook} />
          </section>
        )}
    </main>
  );
}

function ShelfItem({ entry, eds, onOpen }: { entry: ShelfEntry; eds: Record<string, Edition[]>; onOpen: (to: string) => void }) {
  if (entry.kind === 'series') {
    const first = entry.books[0];
    const count = entry.books.reduce((n, b) => n + (eds[b.id]?.length ?? 0), 0);
    return (
      <button className="shelf-item" onClick={() => onOpen(`/series/${entry.id}`)} aria-label={`${entry.name} series, ${entry.books.length} books`}>
        <div className="boxset">
          <span className="boxset-count">{entry.books.length} books</span>
          {entry.books.slice(0, 3).map((b) => (
            <BookCover key={b.id} cover={b.cover} image={b.coverUrl} title={b.id === first.id ? entry.name : ''} author={b.id === first.id ? entry.author : ''} />
          ))}
        </div>
        <div className="shelf-meta">
          <div className="t">{entry.name}</div>
          <div className="s">{count} edition{count === 1 ? '' : 's'}</div>
        </div>
      </button>
    );
  }
  if (entry.kind === 'edition') {
    const { book, edition } = entry;
    return (
      <button className="shelf-item" onClick={() => onOpen(`/read/edition/${edition.id}`)}>
        <div style={{ position: 'relative' }}>
          <BookCover cover={book.cover} image={book.coverUrl} title={book.title} author={book.author} ribbon={`${edition.settings.targetAge}`} />
          {edition.status !== 'ready' && <span className="status-pill"><span className="dot" /> {STATUS_LABEL[edition.status]}</span>}
        </div>
        <div className="shelf-meta">
          <div className="t">{book.title}</div>
          <div className="s">{edition.name}</div>
        </div>
      </button>
    );
  }
  const { book } = entry;
  const list = eds[book.id] ?? [];
  const busy = list.find((e) => e.status !== 'ready');
  return (
    <button className="shelf-item" onClick={() => onOpen(`/book/${book.id}`)}>
      <div style={{ position: 'relative' }}>
        <BookCover cover={book.cover} image={book.coverUrl} title={book.title} author={book.author} />
        {busy && <span className="status-pill"><span className="dot" /> {STATUS_LABEL[busy.status]}</span>}
        {list.length > 0 && (
          <span className="edition-count" title={`${list.length} softened editions`}>
            <Icon name="feather" size={12} stroke={2.5} /> {list.length}
          </span>
        )}
      </div>
      <div className="shelf-meta">
        <div className="t">{book.title}</div>
        <div className="s">{book.seriesLabel && book.seriesId ? `${book.seriesLabel} · ` : ''}{book.author}</div>
      </div>
    </button>
  );
}

function ListView({ books, eds }: { books: Book[]; eds: Record<string, Edition[]> }) {
  const { series } = useStore();
  return (
    <table className="list-table">
      <thead className="sr-only">
        <tr><th>Cover</th><th>Title</th><th>Series</th><th>Editions</th></tr>
      </thead>
      <tbody>
        {books.map((b) => {
          const s = series.find((x) => x.id === b.seriesId);
          const list = eds[b.id] ?? [];
          return (
            <tr key={b.id} className="list-row">
              <td style={{ width: 64 }}>
                <Link to={`/book/${b.id}`} aria-label={b.title}><BookCover cover={b.cover} image={b.coverUrl} title="" author="" size="sm" className="list-cover" /></Link>
              </td>
              <td>
                <Link to={`/book/${b.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontWeight: 800 }}>{b.title}</div>
                  <div className="small muted">{b.author}</div>
                </Link>
              </td>
              <td className="small muted hide-sm">{s ? `${s.name} · ${b.seriesLabel}` : '—'}</td>
              <td>
                <div className="row-wrap">
                  {list.length ? list.map((e) => (
                    <Link key={e.id} to={`/read/edition/${e.id}`} className="chip" style={{ textDecoration: 'none' }}>Age {e.settings.targetAge}{e.settings.picture.on ? ' · 🎨' : ''}</Link>
                  )) : <span className="chip chip-plain">Original only</span>}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Popover({ open, onOpen, onClose, button, children }: { open: boolean; onOpen: () => void; onClose: () => void; button: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open, onClose]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`btn btn-secondary btn-sm ${open ? 'pressed' : ''}`} onClick={onOpen} aria-expanded={open}>{button}</button>
      {open && <div className="popover">{children}</div>}
    </div>
  );
}

function ViewPanel() {
  const { prefs, setPrefs } = useStore();
  return (
    <div className="stack">
      <div>
        <h4>Group shelves by</h4>
        <div className="row-wrap">
          {(['series', 'author', 'genre', 'none'] as const).map((g) => (
            <button key={g} className={`chip ${prefs.groupBy === g ? '' : 'chip-outline'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setPrefs({ groupBy: g })}>
              {g === 'none' ? 'Nothing' : g[0].toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4>Editions</h4>
        <Segmented
          label="Editions"
          value={prefs.editions}
          onChange={(v) => setPrefs({ editions: v })}
          options={[{ value: 'nested', label: 'Inside each book' }, { value: 'separate', label: 'Own spot on shelf' }]}
        />
      </div>
      <div>
        <h4>Sort by</h4>
        <select className="select" value={prefs.sort} onChange={(e) => setPrefs({ sort: e.target.value as ViewPrefs['sort'] })} aria-label="Sort by">
          <option value="series">Series order</option>
          <option value="title">Title</option>
          <option value="author">Author</option>
          <option value="recent-read">Recently read</option>
          <option value="recent-added">Recently added</option>
        </select>
      </div>
      <p className="tiny faint">Featherbound remembers how you like your shelves.</p>
    </div>
  );
}

function FilterPanel({ genres }: { genres: string[] }) {
  const { prefs, setPrefs } = useStore();
  const f = prefs.filters;
  const toggle = (key: 'genre' | 'age' | 'mode' | 'status', v: string) => {
    const list = f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v];
    setPrefs({ filters: { ...f, [key]: list } });
  };
  const chip = (key: 'genre' | 'age' | 'mode' | 'status', v: string, label: string) => (
    <button key={v} className={`chip ${f[key].includes(v) ? '' : 'chip-outline'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => toggle(key, v)} aria-pressed={f[key].includes(v)}>
      {label}
    </button>
  );
  return (
    <div className="stack">
      <div><h4>Genre</h4><div className="row-wrap">{genres.map((g) => chip('genre', g, g))}</div></div>
      <div><h4>Edition age</h4><div className="row-wrap">{AGE_GROUPS.map((g) => chip('age', g.id, g.label))}</div></div>
      <div><h4>Reading mode</h4><div className="row-wrap">{chip('mode', 'read-aloud', 'Read-aloud')}{chip('mode', 'independent', 'Independent')}</div></div>
      <div>
        <h4>Pictures</h4>
        <Segmented
          label="Illustrated"
          value={f.illustrated === null ? 'any' : f.illustrated ? 'yes' : 'no'}
          onChange={(v) => setPrefs({ filters: { ...f, illustrated: v === 'any' ? null : v === 'yes' } })}
          options={[{ value: 'any', label: 'Any' }, { value: 'yes', label: 'Illustrated' }, { value: 'no', label: 'Text only' }]}
        />
      </div>
      <div><h4>Status</h4><div className="row-wrap">{chip('status', 'ready', 'Ready to read')}{chip('status', 'in-progress', 'In progress')}</div></div>
      <button className="btn btn-ghost btn-sm" onClick={() => setPrefs({ filters: { genre: [], age: [], mode: [], illustrated: null, status: [] } })}>Clear filters</button>
    </div>
  );
}
