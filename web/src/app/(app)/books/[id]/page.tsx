import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import BookCover from '@/components/BookCover';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import type { CoverSpec } from '@/db/schema';
import { bookTarget, getBook, getProgress, getSeries, listSections, listSeries } from '@/lib/library';
import { requireAccount } from '@/lib/session';
import { DeleteBookButton, EditDetailsButton } from './BookActions';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

const FALLBACK: CoverSpec = { from: '#4b2e83', to: '#2e1b55', emblem: 'feather', ink: '#F6E3AE' };

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireAccount();
  const { id } = await params;
  const book = await getBook(userId, id);
  if (!book) notFound();
  if (book.status !== 'ready') redirect(`/books/${book.id}/review`);

  const [series, allSeries, sections, progress] = await Promise.all([
    book.seriesId ? getSeries(userId, book.seriesId) : null,
    listSeries(userId),
    listSections(userId, book.id),
    getProgress(userId, bookTarget(book.id)),
  ]);
  const chapters = sections.filter((s) => s.include);
  const coverUrl = book.coverPath ? `/api/books/${book.id}/cover?v=${encodeURIComponent(book.coverPath.split('/').pop() ?? '')}` : undefined;

  return (
    <main className="page">
      <Link href={series ? `/series/${series.id}` : '/'} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}>
        <Icon name="left" size={16} /> {series ? series.name : 'Library'}
      </Link>

      <section className="book-hero">
        <div className="book-hero-cover">
          <BookCover cover={book.coverFallback ?? FALLBACK} image={coverUrl} title={book.title} author={book.author} size="lg" />
        </div>
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="row-wrap">
            {series && <Link href={`/series/${series.id}`} className="chip chip-gold" style={{ textDecoration: 'none' }}>{series.name}{book.seriesLabel ? ` · ${book.seriesLabel}` : ''}</Link>}
            {book.genres.map((g) => <span key={g} className="chip chip-plain">{g}</span>)}
          </div>
          <h1>{book.title}</h1>
          <p className="muted" style={{ fontWeight: 700 }}>{book.author}</p>
          {book.description && <p style={{ maxWidth: 640 }} className="clamp-6">{book.description}</p>}
          <p className="small faint">
            {book.words.toLocaleString()} words · {chapters.length} chapters · {book.format} · added {book.addedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {progress && (
            <div className="row" style={{ maxWidth: 360 }}>
              <div className="progress-bar gold" style={{ flex: 1 }}><i style={{ width: `${progress.percent}%` }} /></div>
              <span className="tiny muted">{Math.round(progress.percent)}% read</span>
            </div>
          )}
          <div className="row-wrap" style={{ marginTop: 6 }}>
            <Link href={`/read/book/${book.id}`} className="btn btn-primary"><Icon name="book" size={18} /> {progress ? 'Keep reading' : 'Read original'}</Link>
            <a href={`/api/books/${book.id}/original`} className="btn btn-ghost"><Icon name="download" size={18} /> Download original</a>
            <EditDetailsButton
              bookId={book.id}
              series={allSeries.map((s) => ({ id: s.id, name: s.name }))}
              initial={{
                title: book.title, author: book.author, description: book.description ?? '', genres: book.genres, tags: book.tags,
                seriesId: book.seriesId, seriesPosition: book.seriesOrder !== null ? String(book.seriesOrder) : '',
              }}
            />
          </div>
        </div>
      </section>

      <section className="shelf-section">
        <div className="card row" style={{ gap: 20, flexWrap: 'wrap' }}>
          <Tuft pose="write" size={80} />
          <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
            <h3>Softened editions are coming next</h3>
            <p className="muted">Soon you’ll be able to make a gentler edition of this book for any age, right from here.</p>
          </div>
        </div>
      </section>

      <section className="shelf-section card stack">
        <h3>Chapters</h3>
        <ol className="toc-list">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <Link href={`/read/book/${book.id}?section=${c.id}`}><span className="mono faint">{i + 1}</span> {c.title}</Link>
            </li>
          ))}
        </ol>
        <div className="row-wrap" style={{ marginTop: 8 }}>
          <span className="spacer" />
          <DeleteBookButton bookId={book.id} title={book.title} />
        </div>
      </section>
    </main>
  );
}
