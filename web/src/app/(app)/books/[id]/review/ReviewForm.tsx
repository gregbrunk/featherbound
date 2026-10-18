'use client';

import { useState, useTransition } from 'react';
import BookCover from '@/components/BookCover';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import Tuft from '@/components/Tuft';
import type { CoverSpec } from '@/db/schema';
import { GENRES } from '@/lib/genres';
import { saveReview, type ReviewInput } from '../../actions';
import { DeleteBookButton } from '../BookActions';

type Section = { id: string; title: string; kind: 'chapter' | 'front' | 'back'; include: boolean; words: number };
type Props = {
  book: { id: string; fileName: string; title: string; author: string; description: string; genres: string[]; coverUrl: string | null; coverFallback: CoverSpec | null; warnings: string[] };
  covers: { url: string; label: string }[];
  series: { id: string; name: string }[];
  suggestedSeries: { seriesId?: string; name: string; position?: number; reason: string } | null;
  sections: Section[];
};

const FALLBACK: CoverSpec = { from: '#4b2e83', to: '#2e1b55', emblem: 'feather', ink: '#F6E3AE' };

export default function ReviewForm({ book, covers, series, suggestedSeries, sections: initialSections }: Props) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [description, setDescription] = useState(book.description);
  const [genres, setGenres] = useState(book.genres);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [seriesMode, setSeriesMode] = useState<'suggested' | 'existing' | 'new' | 'none'>(suggestedSeries ? 'suggested' : 'none');
  const [existingId, setExistingId] = useState(series[0]?.id ?? '');
  const [newName, setNewName] = useState('');
  const [position, setPosition] = useState(suggestedSeries?.position ? String(suggestedSeries.position) : '');
  const [sections, setSections] = useState(initialSections.map((s) => ({ ...s, mergeWithNext: false })));
  const [showAll, setShowAll] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const included = sections.filter((s, i) => s.include && !(i > 0 && sections[i - 1].mergeWithNext));
  const words = sections.filter((s) => s.include).reduce((n, s) => n + s.words, 0);
  const visible = showAll ? sections : sections.slice(0, 12);
  const genreChoices = [...new Set([...GENRES, ...book.genres])];

  const submit = () => {
    setError(null);
    let seriesInput: ReviewInput['series'] = { mode: 'none' };
    if (seriesMode === 'suggested' && suggestedSeries) {
      seriesInput = suggestedSeries.seriesId
        ? { mode: 'existing', seriesId: suggestedSeries.seriesId, position }
        : { mode: 'new', name: suggestedSeries.name, position };
    } else if (seriesMode === 'existing' && existingId) seriesInput = { mode: 'existing', seriesId: existingId, position };
    else if (seriesMode === 'new' && newName.trim()) seriesInput = { mode: 'new', name: newName, position };
    start(async () => {
      try {
        await saveReview(book.id, {
          title, author, description, genres, series: seriesInput, coverUrl,
          sections: sections.map((s) => ({ id: s.id, title: s.title, include: s.include, mergeWithNext: s.mergeWithNext })),
        });
      } catch (e) {
        if ((e as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw e;
        setError('Something went wrong saving. Please try again.');
      }
    });
  };

  return (
    <main className="page page-narrow">
      <div className="stack-lg">
        <div className="stack-sm">
          <h1>Check the details</h1>
          <p className="muted">I read “{book.fileName}”. Fix anything I got wrong, then put it on the shelf.</p>
        </div>

        {book.warnings.length > 0 && (
          <div className="card card-tinted row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Icon name="info" size={18} />
            <div className="small">{book.warnings.map((w) => <p key={w}>{w}</p>)}</div>
          </div>
        )}

        <div className="card review-grid">
          <div className="stack-sm" style={{ alignItems: 'center' }}>
            <div style={{ width: 150 }}>
              <BookCover cover={book.coverFallback ?? FALLBACK} image={coverUrl ?? book.coverUrl ?? undefined} title={title} author={author} />
            </div>
            <span className="tiny faint">{coverUrl ? 'Chosen from the catalog' : book.coverUrl ? 'Current cover' : 'No cover found'}</span>
          </div>
          <div className="stack">
            <div className="field"><label className="label" htmlFor="title">Title</label><input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field"><label className="label" htmlFor="author">Author</label><input id="author" className="input" value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
            <div className="field"><label className="label" htmlFor="desc">Description</label><textarea id="desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
        </div>

        {covers.length > 0 && (
          <section className="card stack">
            <h3>Cover</h3>
            <p className="small muted">Pick a different cover from the Open Library catalog, or keep the current one.</p>
            <div className="cover-picks">
              <button type="button" className={`cover-pick ${coverUrl === null ? 'on' : ''}`} onClick={() => setCoverUrl(null)}>
                <BookCover cover={book.coverFallback ?? FALLBACK} image={book.coverUrl ?? undefined} title={title} author={author} size="sm" />
                <span className="tiny">Keep current</span>
              </button>
              {covers.map((c) => (
                <button key={c.url} type="button" className={`cover-pick ${coverUrl === c.url ? 'on' : ''}`} onClick={() => setCoverUrl(c.url)}>
                  {/* External catalog thumbnail, shown only while choosing. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url.replace('-L.jpg', '-M.jpg')} alt={c.label} loading="lazy" />
                  <span className="tiny ellipsis">{c.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="card stack">
          {suggestedSeries && (
            <div className="guide">
              <Tuft pose="think" size={60} />
              <div className="bubble">
                This looks like <strong>{suggestedSeries.position ? `book ${suggestedSeries.position} of ` : 'part of '}<em>{suggestedSeries.name}</em></strong>. {suggestedSeries.reason}
              </div>
            </div>
          )}
          <h3>Series</h3>
          <div className="series-choices" role="radiogroup" aria-label="Series">
            {suggestedSeries && (
              <label className={`choice ${seriesMode === 'suggested' ? 'on' : ''}`}>
                <input type="radio" name="series" checked={seriesMode === 'suggested'} onChange={() => setSeriesMode('suggested')} />
                <div style={{ flex: 1 }}><strong>{suggestedSeries.seriesId ? 'Add to' : 'Start the series'} {suggestedSeries.name}</strong></div>
                <span className="chip chip-emerald">Suggested</span>
              </label>
            )}
            {series.length > 0 && (
              <label className={`choice ${seriesMode === 'existing' ? 'on' : ''}`}>
                <input type="radio" name="series" checked={seriesMode === 'existing'} onChange={() => setSeriesMode('existing')} />
                <div style={{ flex: 1 }} className="stack-sm">
                  <strong>A series on my shelf</strong>
                  {seriesMode === 'existing' && <Select label="Series" value={existingId} onChange={setExistingId} options={series.map((s) => ({ value: s.id, label: s.name }))} />}
                </div>
              </label>
            )}
            <label className={`choice ${seriesMode === 'new' ? 'on' : ''}`}>
              <input type="radio" name="series" checked={seriesMode === 'new'} onChange={() => setSeriesMode('new')} />
              <div style={{ flex: 1 }} className="stack-sm">
                <strong>A new series</strong>
                {seriesMode === 'new' && <input className="input" placeholder="Series name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New series name" />}
              </div>
            </label>
            <label className={`choice ${seriesMode === 'none' ? 'on' : ''}`}>
              <input type="radio" name="series" checked={seriesMode === 'none'} onChange={() => setSeriesMode('none')} />
              <div style={{ flex: 1 }}><strong>Standalone book</strong></div>
            </label>
          </div>
          {seriesMode !== 'none' && (
            <div className="row small" style={{ gap: 8 }}>
              <label htmlFor="pos" className="label">Book number</label>
              <input id="pos" className="input input-xs" value={position} onChange={(e) => setPosition(e.target.value)} inputMode="decimal" />
            </div>
          )}
        </section>

        <section className="card stack">
          <h3>Genres</h3>
          <div className="row-wrap">
            {genreChoices.map((g) => (
              <button key={g} type="button" className={`chip ${genres.includes(g) ? '' : 'chip-outline'}`} style={{ border: 'none', cursor: 'pointer' }} aria-pressed={genres.includes(g)}
                onClick={() => setGenres(genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g])}>
                {g}
              </button>
            ))}
          </div>
        </section>

        <section className="card stack">
          <div>
            <h3>Chapters</h3>
            <p className="small muted">{included.length} sections included · {words.toLocaleString()} words. I left out things like the copyright page and the author’s notes; switch any section back on if you want it.</p>
          </div>
          <ol className="chapter-list">
            {visible.map((s, i) => {
              const mergedIntoPrev = i > 0 && visible[i - 1].mergeWithNext;
              return (
                <li key={s.id} className={`${s.include ? '' : 'excluded'} ${mergedIntoPrev ? 'merged' : ''}`}>
                  <label className="switch">
                    <input type="checkbox" role="switch" checked={s.include} aria-label={`Include ${s.title}`} disabled={mergedIntoPrev}
                      onChange={(e) => setSections(sections.map((x) => (x.id === s.id ? { ...x, include: e.target.checked } : x)))} />
                    <span />
                  </label>
                  <input className="input input-plain" value={s.title} aria-label="Section title" disabled={mergedIntoPrev}
                    onChange={(e) => setSections(sections.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} />
                  <span className="tiny faint mono hide-sm">{s.words.toLocaleString()} words</span>
                  {s.kind !== 'chapter' && <span className="chip chip-plain">{s.kind === 'front' ? 'Front matter' : 'Back matter'}</span>}
                  {mergedIntoPrev && <span className="chip">Joined to the one above</span>}
                  {i < sections.length - 1 && !mergedIntoPrev && (
                    <button type="button" className="btn btn-ghost btn-sm hide-sm" aria-pressed={s.mergeWithNext}
                      onClick={() => setSections(sections.map((x) => (x.id === s.id ? { ...x, mergeWithNext: !x.mergeWithNext } : x)))}>
                      {s.mergeWithNext ? 'Undo join' : 'Join with next'}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {sections.length > 12 && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${sections.length} sections`} <Icon name="down" size={16} />
            </button>
          )}
        </section>

        {error && <p className="status-bad" role="alert">{error}</p>}
        <div className="sticky-actions">
          <DeleteBookButton bookId={book.id} title={title} label="Cancel import" />
          <span className="spacer" />
          <button className="btn btn-primary" disabled={pending} onClick={submit}>{pending ? 'Saving…' : 'Put it on the shelf'} <Icon name="arrow" size={18} /></button>
        </div>
      </div>
    </main>
  );
}
