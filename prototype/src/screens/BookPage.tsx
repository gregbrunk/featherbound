import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { currentVersionOf, useStore } from '../store';
import BookCover from '../components/BookCover';
import Icon from '../components/Icon';
import Tuft from '../components/Tuft';
import ContentHeatmap from '../components/ContentHeatmap';
import { Guide, Modal, ModalHead, Segmented, fmtDate, money } from '../components/ui';
import { CATEGORIES, LEVEL_LABEL, OZ_BIBLE, bandFor, gradeLevelFor } from '../data/library';
import type { Book, Edition } from '../data/types';

export default function BookPage() {
  const { id } = useParams();
  const { books, series, editions, progress } = useStore();
  const [tab, setTab] = useState<'editions' | 'inside' | 'bible' | 'details'>('editions');
  const [modal, setModal] = useState<null | { kind: 'download'; edition?: Edition } | { kind: 'edit' } | { kind: 'delete-book' }>(null);
  const book = books.find((b) => b.id === id);
  if (!book) return <main className="page"><p>Book not found.</p></main>;
  const s = series.find((x) => x.id === book.seriesId);
  const eds = editions.filter((e) => e.bookId === book.id);

  return (
    <main className="page">
      <Link to={s ? `/series/${s.id}` : '/'} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}>
        <Icon name="left" size={16} /> {s ? s.name : 'Library'}
      </Link>

      <section className="book-hero">
        <div className="book-hero-cover">
          <BookCover cover={book.cover} image={book.coverUrl} title={book.title} author={book.author} size="lg" />
        </div>
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="row-wrap">
            {s && <Link to={`/series/${s.id}`} className="chip chip-gold" style={{ textDecoration: 'none' }}>{s.name} · {book.seriesLabel}</Link>}
            {book.genres.map((g) => <span key={g} className="chip chip-plain">{g}</span>)}
            {book.hasRealText && <span className="chip chip-emerald">Public domain · real sample text</span>}
          </div>
          <h1>{book.title}</h1>
          <p className="muted" style={{ fontWeight: 700 }}>{book.author}</p>
          <p style={{ maxWidth: 640 }}>{book.description}</p>
          <p className="small faint">
            {book.words.toLocaleString()} words · {book.chapters} chapters · {book.format} · added {fmtDate(book.addedAt)}
          </p>
          <div className="row-wrap" style={{ marginTop: 6 }}>
            <Link to={`/book/${book.id}/new`} className="btn btn-primary"><Icon name="wand" size={18} /> New softened edition</Link>
            <Link to={`/read/original/${book.id}`} className="btn btn-secondary"><Icon name="book" size={18} /> Read original</Link>
            <button className="btn btn-ghost" onClick={() => setModal({ kind: 'download' })}><Icon name="download" size={18} /> Download original</button>
            <button className="btn btn-ghost" onClick={() => setModal({ kind: 'edit' })}><Icon name="pencil" size={18} /> Edit details</button>
          </div>
        </div>
      </section>

      <div className="tabs" role="tablist" style={{ marginTop: 28 }}>
        {([['editions', `Editions (${eds.length})`], ['inside', 'What’s inside'], ['bible', 'Story Bible'], ['details', 'Details']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        {tab === 'editions' && (
          <div className="stack-lg">
            {eds.length === 0 && (
              <div className="card card-tinted row" style={{ gap: 20, flexWrap: 'wrap' }}>
                <Tuft pose="think" size={90} />
                <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
                  <h3>No softened editions yet</h3>
                  <p className="muted">I’ve already read it through and made a content report. Want to make the first edition?</p>
                </div>
                <Link to={`/book/${book.id}/new`} className="btn btn-primary"><Icon name="wand" size={18} /> Start the wizard</Link>
              </div>
            )}
            {eds.map((e) => (
              <EditionCard key={e.id} edition={e} book={book} progress={progress[e.id]?.percent} onDownload={() => setModal({ kind: 'download', edition: e })} />
            ))}
          </div>
        )}
        {tab === 'inside' && (
          <div className="card stack">
            <Guide pose="read" size={60}>
              Here’s what I found while reading <em>{book.title}</em>, chapter by chapter. Darker squares mean stronger content.
            </Guide>
            <ContentHeatmap book={book} />
          </div>
        )}
        {tab === 'bible' && <StoryBible book={book} />}
        {tab === 'details' && <Details book={book} onEdit={() => setModal({ kind: 'edit' })} onDelete={() => setModal({ kind: 'delete-book' })} />}
      </div>

      {modal?.kind === 'download' && <DownloadModal book={book} edition={modal.edition} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <EditBookModal book={book} onClose={() => setModal(null)} />}
      {modal?.kind === 'delete-book' && <DeleteBookModal book={book} editions={eds.length} onClose={() => setModal(null)} />}
    </main>
  );
}

function EditionCard({ edition: e, book, progress, onDownload }: { edition: Edition; book: Book; progress?: number; onDownload: () => void }) {
  const { updateEdition, deleteEdition, toast } = useStore();
  const nav = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(e.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const v = currentVersionOf(e);
  const s = e.settings;
  const ready = e.status === 'ready';

  return (
    <article className="card edition-card">
      <header className="edition-head">
        <BookCover cover={book.cover} image={book.coverUrl} title={book.title} author={book.author} size="sm" ribbon={`${s.targetAge}`} className="edition-cover" />
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <form className="row" onSubmit={(ev) => { ev.preventDefault(); updateEdition(e.id, { name }); setRenaming(false); toast('Renamed!'); }}>
              <input className="input" value={name} onChange={(ev) => setName(ev.target.value)} autoFocus aria-label="Edition name" />
              <button className="btn btn-primary btn-sm">Save</button>
            </form>
          ) : (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <h3>{e.name}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setRenaming(true)} aria-label="Rename edition"><Icon name="pencil" size={16} /></button>
            </div>
          )}
          <div className="row-wrap">
            {v && <span className="badge-version">v{v.number}</span>}
            {v && <span className="small" style={{ fontWeight: 800, color: 'var(--plum)' }}>“{v.name}”</span>}
            {!ready && <StatusChip e={e} />}
            <span className="small faint">Made {fmtDate(e.createdAt)}</span>
          </div>
          {ready && progress !== undefined && (
            <div className="row" style={{ maxWidth: 320 }}>
              <div className="progress-bar gold" style={{ flex: 1 }}><i style={{ width: `${progress}%` }} /></div>
              <span className="tiny muted">{progress}% read</span>
            </div>
          )}
        </div>
        <div className="edition-primary">
          {ready && <Link to={`/read/edition/${e.id}`} className="btn btn-primary"><Icon name="book" size={18} /> Read</Link>}
          {e.status === 'samples-ready' && <Link to={`/edition/${e.id}/samples`} className="btn btn-gold"><Icon name="eye" size={18} /> Review samples</Link>}
          {(e.status === 'running' || e.status === 'paused-cap' || e.status === 'making-samples') && (
            <Link to={`/edition/${e.id}/progress`} className="btn btn-secondary"><Icon name="clock" size={18} /> See progress</Link>
          )}
        </div>
      </header>

      <div className="settings-grid">
        <Setting label="Made for" value={`Age ${s.targetAge}`} sub={bandFor(s.targetAge).name} />
        <Setting label="Reading mode" value={s.readingMode === 'read-aloud' ? 'Read aloud' : 'Independent reader'} sub={gradeLevelFor(s.targetAge, s.readingMode, s.readingLevelShift) + ' language'} />
        <Setting label="Faithfulness" value={s.faithfulness < 34 ? 'Close to the author' : s.faithfulness < 67 ? 'Balanced' : 'Free retelling'} sub={`${100 - s.faithfulness}% author’s words`} />
        <Setting label="Pictures" value={s.picture.on ? `Every ~${s.picture.every} pages` : 'Text only'} sub={s.picture.on ? `${s.picture.style}${s.picture.look ? ` · ${s.picture.look}` : ''}` : undefined} />
      </div>

      <div className="stack-sm">
        <span className="label">Content filters</span>
        <div className="row-wrap">
          {CATEGORIES.map((c) => {
            const lvl = s.filters[c.id];
            return (
              <span key={c.id} className={`chip ${lvl === 'keep' ? 'chip-emerald' : lvl === 'soften' ? 'chip-gold' : 'chip-ruby'}`} title={c.examples}>
                {c.name}: {LEVEL_LABEL[lvl]}
              </span>
            );
          })}
        </div>
      </div>

      {(s.notes || e.sampleGuidance.length > 0) && (
        <div className="grid-2">
          {s.notes && (
            <div className="note-box">
              <span className="label">Your notes for the AI</span>
              <p>“{s.notes}”</p>
            </div>
          )}
          {e.sampleGuidance.length > 0 && (
            <div className="note-box">
              <span className="label">What you said about the samples</span>
              <ul>{e.sampleGuidance.map((g) => <li key={g}>{g}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <footer className="edition-actions">
        {ready && (
          <>
            <Link to={`/edition/${e.id}/refine`} className="btn btn-secondary btn-sm"><Icon name="sparkle" size={16} /> Refine</Link>
            <Link to={`/edition/${e.id}/history`} className="btn btn-secondary btn-sm"><Icon name="history" size={16} /> Versions ({e.versions.length})</Link>
            <button className="btn btn-secondary btn-sm" onClick={onDownload}><Icon name="download" size={16} /> Download</button>
          </>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => nav(`/book/${book.id}/new?from=${e.id}`)}>
          <Icon name="copy" size={16} /> New edition from these settings
        </button>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--ruby)' }} onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} /> Delete</button>
      </footer>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} label="Delete edition">
          <ModalHead title="Delete this edition?" pose="worry" onClose={() => setConfirmDelete(false)} />
          <p>
            <strong>{e.name}</strong> and all {e.versions.length} of its versions will be deleted
            {progress !== undefined ? ', along with your reading progress' : ''}. The original book stays on the shelf.
          </p>
          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
            <button className="btn btn-danger" onClick={() => { deleteEdition(e.id); toast('Edition deleted', 'worry'); }}>Delete edition</button>
          </div>
        </Modal>
      )}
    </article>
  );
}

function StatusChip({ e }: { e: Edition }) {
  if (e.status === 'running' && e.run) return <span className="chip"><span className="dot" /> Writing chapter {e.run.chapter} of {e.run.of}</span>;
  if (e.status === 'paused-cap' && e.run) return <span className="chip chip-ruby"><Icon name="pause" size={12} /> Paused at {money(e.run.cap)} cap · ch. {e.run.chapter}/{e.run.of}</span>;
  if (e.status === 'samples-ready') return <span className="chip chip-gold"><Icon name="sparkle" size={12} /> Samples ready for review</span>;
  return <span className="chip"><span className="dot" /> Making samples…</span>;
}

function Setting({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="setting">
      <span className="tiny faint" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <strong>{value}</strong>
      {sub && <span className="small muted">{sub}</span>}
    </div>
  );
}

function StoryBible({ book }: { book: Book }) {
  if (book.id !== 'oz') {
    return (
      <div className="card row" style={{ gap: 18, flexWrap: 'wrap' }}>
        <Tuft pose="write" size={80} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
          <h3>The Story Bible is built when you make the first edition</h3>
          <p className="muted">It lists characters, places, plot threads, themes and how everything looks. Open <Link to="/book/oz">The Wonderful Wizard of Oz</Link> to see a finished example.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="stack">
      <Guide pose="write" size={60}>This is my notebook for this book. I check it while writing every chapter so names, looks and plot threads stay steady.</Guide>
      <h3>Characters</h3>
      <div className="grid-3">
        {OZ_BIBLE.characters.map((c) => (
          <div key={c.name} className="card stack-sm">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{c.name}</strong>
              <span className="chip chip-plain">{c.role}</span>
            </div>
            <p className="small"><span className="faint">Looks: </span>{c.look}</p>
            <p className="small muted">{c.note}</p>
          </div>
        ))}
      </div>
      <div className="grid-3">
        <div className="card stack-sm"><h3>Places</h3><ul className="small">{OZ_BIBLE.places.map((p) => <li key={p}>{p}</li>)}</ul></div>
        <div className="card stack-sm"><h3>Plot threads</h3><ul className="small">{OZ_BIBLE.threads.map((p) => <li key={p}>{p}</li>)}</ul></div>
        <div className="card stack-sm"><h3>Key themes</h3><ul className="small">{OZ_BIBLE.themes.map((p) => <li key={p}>{p}</li>)}</ul></div>
      </div>
    </div>
  );
}

function Details({ book, onEdit, onDelete }: { book: Book; onEdit: () => void; onDelete: () => void }) {
  const { series } = useStore();
  const s = series.find((x) => x.id === book.seriesId);
  const rows: [string, string][] = [
    ['Title', book.title], ['Author', book.author], ['Series', s ? `${s.name} (${book.seriesLabel})` : 'Standalone'],
    ['Genres', book.genres.join(', ')], ['Tags', book.tags.join(', ') || '—'], ['File', `${book.format}, ${book.chapters} chapters, ${book.words.toLocaleString()} words`],
    ['Added', fmtDate(book.addedAt)],
  ];
  return (
    <div className="card stack">
      <dl className="details">
        {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
      <div className="row-wrap">
        <button className="btn btn-secondary" onClick={onEdit}><Icon name="pencil" size={16} /> Edit details</button>
        <span className="spacer" />
        <button className="btn btn-ghost" style={{ color: 'var(--ruby)' }} onClick={onDelete}><Icon name="trash" size={16} /> Delete book</button>
      </div>
    </div>
  );
}

function DownloadModal({ book, edition, onClose }: { book: Book; edition?: Edition; onClose: () => void }) {
  const { toast } = useStore();
  const [fmt, setFmt] = useState<'epub' | 'pdf'>('epub');
  const [ver, setVer] = useState(edition?.currentVersion ?? '');
  return (
    <Modal onClose={onClose} label="Download">
      <ModalHead title={edition ? 'Download edition' : 'Download original'} pose="read" onClose={onClose} />
      <div className="stack">
        <p className="muted">{book.title}{edition ? ` · ${edition.name}` : ' · original'}</p>
        <div className="field">
          <span className="label">Format</span>
          <Segmented label="Format" value={fmt} onChange={setFmt} options={[{ value: 'epub', label: 'EPUB (e-readers)' }, { value: 'pdf', label: 'PDF (print)' }]} />
        </div>
        {edition && (
          <div className="field">
            <label className="label" htmlFor="ver">Version</label>
            <select id="ver" className="select" value={ver} onChange={(e) => setVer(e.target.value)}>
              {[...edition.versions].reverse().map((v) => (
                <option key={v.number} value={v.number}>v{v.number} “{v.name}”{v.number === edition.currentVersion ? ' (current)' : ''}</option>
              ))}
            </select>
          </div>
        )}
        {edition && (
          <p className="small muted">
            Includes the cover{edition.settings.picture.on ? ', all illustrations' : ''} and a title-page note: “{edition.name} · v{ver} · Featherbound”.
          </p>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onClose(); toast(`Your ${fmt.toUpperCase()} is ready (prototype: no real file)`); }}>
            <Icon name="download" size={18} /> Download {fmt.toUpperCase()}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditBookModal({ book, onClose }: { book: Book; onClose: () => void }) {
  const { updateBook, series, toast } = useStore();
  const [d, setD] = useState({ ...book, genresText: book.genres.join(', '), tagsText: book.tags.join(', ') });
  return (
    <Modal onClose={onClose} label="Edit book details" wide>
      <ModalHead title="Edit book details" onClose={onClose} />
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          updateBook(book.id, {
            title: d.title, author: d.author, seriesId: d.seriesId || undefined, seriesLabel: d.seriesLabel, seriesOrder: d.seriesOrder,
            description: d.description, genres: d.genresText.split(',').map((x) => x.trim()).filter(Boolean), tags: d.tagsText.split(',').map((x) => x.trim()).filter(Boolean),
          });
          toast('Saved!');
          onClose();
        }}
      >
        <div className="edit-book-grid">
          <div className="stack-sm" style={{ alignItems: 'center' }}>
            <div style={{ width: 130 }}><BookCover cover={book.cover} image={book.coverUrl} title={d.title} author={d.author} /></div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast('Prototype: pick an image file here', 'think')}><Icon name="image" size={16} /> Change cover</button>
          </div>
          <div className="stack">
            <div className="field"><label className="label" htmlFor="t">Title</label><input id="t" className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></div>
            <div className="field"><label className="label" htmlFor="a">Author</label><input id="a" className="input" value={d.author} onChange={(e) => setD({ ...d, author: e.target.value })} /></div>
            <div className="grid-2">
              <div className="field">
                <label className="label" htmlFor="s">Series</label>
                <select id="s" className="select" value={d.seriesId ?? ''} onChange={(e) => setD({ ...d, seriesId: e.target.value || undefined })}>
                  <option value="">Standalone</option>
                  {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="n">Position</label>
                <input id="n" className="input" value={d.seriesLabel ?? ''} placeholder="Book 1" onChange={(e) => setD({ ...d, seriesLabel: e.target.value })} disabled={!d.seriesId} />
              </div>
            </div>
            <div className="field"><label className="label" htmlFor="g">Genres</label><input id="g" className="input" value={d.genresText} onChange={(e) => setD({ ...d, genresText: e.target.value })} /><span className="hint">Separate with commas</span></div>
            <div className="field"><label className="label" htmlFor="tg">Tags</label><input id="tg" className="input" value={d.tagsText} onChange={(e) => setD({ ...d, tagsText: e.target.value })} /></div>
            <div className="field"><label className="label" htmlFor="ds">Description</label><textarea id="ds" className="textarea" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">Save details</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteBookModal({ book, editions, onClose }: { book: Book; editions: number; onClose: () => void }) {
  const { deleteBook, toast } = useStore();
  const nav = useNavigate();
  const [typed, setTyped] = useState('');
  return (
    <Modal onClose={onClose} label="Delete book">
      <ModalHead title="Delete this book?" pose="worry" onClose={onClose} />
      <div className="stack">
        <p>
          This removes <strong>{book.title}</strong>, its original file{editions ? <>, and <strong>all {editions} softened editions</strong> with every version and reading progress</> : ''}. This can’t be undone.
        </p>
        <div className="field">
          <label className="label" htmlFor="confirm">Type <strong>delete</strong> to confirm</label>
          <input id="confirm" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Keep it</button>
          <button className="btn btn-danger" disabled={typed.trim().toLowerCase() !== 'delete'} onClick={() => { deleteBook(book.id); toast('Book deleted', 'worry'); nav('/'); }}>Delete forever</button>
        </div>
      </div>
    </Modal>
  );
}
