import { notFound, redirect } from 'next/navigation';
import Tuft from '@/components/Tuft';
import { getBook, getSeries, listSections, listSeries } from '@/lib/library';
import { requireAccount } from '@/lib/session';
import { DeleteBookButton } from '../BookActions';
import { Poller, RetryButton } from './Poller';
import ReviewForm from './ReviewForm';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export const metadata = { title: 'Check the details · Featherbound' };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireAccount();
  const { id } = await params;
  const book = await getBook(userId, id);
  if (!book) notFound();
  if (book.status === 'ready') redirect(`/books/${book.id}`);

  if (book.status === 'importing') {
    return (
      <main className="page page-narrow">
        <Poller />
        <div className="card card-lg center stack" style={{ alignItems: 'center', marginTop: 20 }}>
          <Tuft pose="read" size={130} />
          <h2>Reading “{book.fileName}”…</h2>
          <p className="muted">Finding the chapters, the cover and which series it belongs to. This usually takes under a minute.</p>
          <div className="progress-bar" style={{ width: 260 }}><i className="indeterminate" /></div>
          <p className="small faint">You can leave this page. The book will wait for you in your library.</p>
        </div>
      </main>
    );
  }

  if (book.status === 'failed') {
    const [reason, ...rest] = (book.importError ?? 'corrupt: Something went wrong.').split(': ');
    return (
      <main className="page page-narrow">
        <div className="card card-lg stack" style={{ marginTop: 20 }}>
          <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
            <Tuft pose="worry" size={110} />
            <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
              <h2>{reason === 'drm' ? 'This book is locked with DRM' : 'I couldn’t open this book'}</h2>
              <p className="muted">“{book.fileName}”: {rest.join(': ')}</p>
            </div>
          </div>
          {reason === 'drm' && (
            <div className="card card-tinted stack-sm">
              <h3>Ways to get a DRM-free copy</h3>
              <ul className="tips">
                <li><strong>Kobo:</strong> near the bottom of the store page, look for “EPUB (DRM-Free)”. Tor books like <em>Ender’s Game</em> are DRM-free.</li>
                <li><strong>Amazon Kindle:</strong> some indie and self-published books offer an EPUB or PDF download under “Content &amp; Devices”.</li>
                <li><strong>Straight from the author:</strong> many indie and LitRPG authors sell DRM-free EPUBs on their own site or Patreon.</li>
              </ul>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {reason !== 'drm' && reason !== 'scanned' && reason !== 'unsupported' && <RetryButton bookId={book.id} />}
            <DeleteBookButton bookId={book.id} title={book.title} label="Remove this file" />
          </div>
        </div>
      </main>
    );
  }

  const [sections, series] = await Promise.all([listSections(userId, book.id), listSeries(userId)]);
  const suggested = book.suggestions?.series;
  const current = book.seriesId ? await getSeries(userId, book.seriesId) : null;
  return (
    <ReviewForm
      book={{
        id: book.id,
        fileName: book.fileName,
        title: book.title,
        author: book.author,
        description: book.description ?? '',
        genres: book.genres,
        coverUrl: book.coverPath ? `/api/books/${book.id}/cover` : null,
        coverFallback: book.coverFallback,
        warnings: book.warnings,
      }}
      covers={book.suggestions?.covers ?? []}
      series={series.map((s) => ({ id: s.id, name: s.name }))}
      suggestedSeries={current ? { seriesId: current.id, name: current.name, position: book.seriesOrder ?? undefined, reason: '' } : suggested ?? null}
      sections={sections.map((s) => ({ id: s.id, title: s.title, kind: s.kind, include: s.include, words: s.words }))}
    />
  );
}
