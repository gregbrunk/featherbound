import { and, asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BookCover from '@/components/BookCover';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import { getDb } from '@/db';
import { books, type CoverSpec } from '@/db/schema';
import { getSeries } from '@/lib/library';
import { requireAccount } from '@/lib/session';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

const FALLBACK: CoverSpec = { from: '#4b2e83', to: '#2e1b55', emblem: 'feather', ink: '#F6E3AE' };

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireAccount();
  const s = await getSeries(userId, (await params).id);
  if (!s) notFound();
  const list = await getDb()
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.seriesId, s.id), eq(books.status, 'ready')))
    .orderBy(asc(books.seriesOrder), asc(books.title));

  return (
    <main className="page">
      <Link href="/" className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> Library</Link>
      <header className="series-head">
        <div className="stack-sm">
          <span className="chip chip-gold" style={{ alignSelf: 'flex-start' }}>Series · {list.length} book{list.length === 1 ? '' : 's'}</span>
          <h1>{s.name}</h1>
          {s.author && <p className="muted">{s.author}</p>}
        </div>
        <div className="row hide-sm" style={{ gap: 10 }}>
          <Tuft pose="read" size={70} />
          <p className="small muted" style={{ maxWidth: 260 }}>Every book gets its own settings when you soften it.</p>
        </div>
      </header>
      <ol className="series-list">
        {list.map((b) => (
          <li key={b.id} className="card series-book">
            <Link href={`/books/${b.id}`} className="series-cover" aria-label={b.title}>
              <BookCover cover={b.coverFallback ?? FALLBACK} image={b.coverPath ? `/api/books/${b.id}/cover` : undefined} title={b.title} author={b.author} size="sm" />
            </Link>
            <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
              {b.seriesLabel && <span className="tiny faint" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>{b.seriesLabel}</span>}
              <Link href={`/books/${b.id}`} style={{ textDecoration: 'none' }}><h3>{b.title}</h3></Link>
              {b.description && <p className="small muted clamp-2">{b.description}</p>}
            </div>
            <div className="series-actions">
              <Link href={`/read/book/${b.id}`} className="btn btn-secondary btn-sm"><Icon name="book" size={16} /> Read</Link>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
