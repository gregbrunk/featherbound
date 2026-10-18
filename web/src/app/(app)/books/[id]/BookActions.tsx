'use client';

import { useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import { Modal, ModalHead } from '@/components/ui';
import { GENRES } from '@/lib/genres';
import { deleteBook, reimportBook, saveDetails, type DetailsInput } from '../actions';

export function DeleteBookButton({ bookId, title, label = 'Delete book' }: { bookId: string; title: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="btn btn-ghost" style={{ color: 'var(--ruby)' }} onClick={() => setOpen(true)}>
        <Icon name="trash" size={16} /> {label}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} label="Delete book">
          <ModalHead title="Delete this book?" pose="worry" onClose={() => setOpen(false)} />
          <div className="stack">
            <p>This removes <strong>{title}</strong>, its file and your reading progress. This can’t be undone.</p>
            <div className="field">
              <label className="label" htmlFor="confirm">Type <strong>delete</strong> to confirm</label>
              <input id="confirm" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Keep it</button>
              <button className="btn btn-danger" disabled={pending || typed.trim().toLowerCase() !== 'delete'} onClick={() => start(() => deleteBook(bookId))}>
                {pending ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function EditDetailsButton({ bookId, initial, series }: { bookId: string; initial: DetailsInput; series: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(initial);
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const genreChoices = [...new Set([...GENRES, ...initial.genres])];
  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)}><Icon name="pencil" size={18} /> Edit details</button>
      {open && (
        <Modal onClose={() => setOpen(false)} label="Edit book details" wide>
          <ModalHead title="Edit book details" onClose={() => setOpen(false)} />
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveDetails(bookId, { ...d, tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean) });
                setMessage(r.message);
                if (r.ok) setOpen(false);
              });
            }}
          >
            <div className="field"><label className="label" htmlFor="t">Title</label><input id="t" className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></div>
            <div className="field"><label className="label" htmlFor="a">Author</label><input id="a" className="input" value={d.author} onChange={(e) => setD({ ...d, author: e.target.value })} /></div>
            <div className="grid-2">
              <div className="field">
                <span className="label" id="series-label">Series</span>
                <Select labelledBy="series-label" value={d.seriesId ?? ''} onChange={(v) => setD({ ...d, seriesId: v || null })}
                  options={[{ value: '', label: 'Standalone' }, ...series.map((s) => ({ value: s.id, label: s.name }))]} />
              </div>
              <div className="field">
                <label className="label" htmlFor="n">Book number</label>
                <input id="n" className="input" value={d.seriesPosition} inputMode="decimal" placeholder="1" disabled={!d.seriesId} onChange={(e) => setD({ ...d, seriesPosition: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <span className="label">Genres</span>
              <div className="row-wrap">
                {genreChoices.map((g) => (
                  <button key={g} type="button" className={`chip ${d.genres.includes(g) ? '' : 'chip-outline'}`} style={{ border: 'none', cursor: 'pointer' }} aria-pressed={d.genres.includes(g)}
                    onClick={() => setD({ ...d, genres: d.genres.includes(g) ? d.genres.filter((x) => x !== g) : [...d.genres, g] })}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="field"><label className="label" htmlFor="tg">Tags</label><input id="tg" className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} /><span className="hint">Separate with commas</span></div>
            <div className="field"><label className="label" htmlFor="ds">Description</label><textarea id="ds" className="textarea" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>
            {message && <p className="small status-bad">{message}</p>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save details'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function ReimportButton({ bookId }: { bookId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}><Icon name="refresh" size={16} /> Re-import from the original file</button>
      {open && (
        <Modal onClose={() => setOpen(false)} label="Re-import book">
          <ModalHead title="Re-import this book?" pose="think" onClose={() => setOpen(false)} />
          <div className="stack">
            <p>I’ll read the original file again and find the chapters fresh. You’ll check the details before it goes back on the shelf.</p>
            <p className="small muted">Your bookmarks and reading position may move back to the start of a chapter.</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={pending} onClick={() => start(() => reimportBook(bookId))}>{pending ? 'Starting…' : 'Re-import'}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
