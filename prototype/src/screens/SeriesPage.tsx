import { Link, useParams } from 'react-router-dom';
import { useStore } from '../store';
import BookCover from '../components/BookCover';
import Icon from '../components/Icon';
import Tuft from '../components/Tuft';

export default function SeriesPage() {
  const { id } = useParams();
  const { series, books, editions } = useStore();
  const s = series.find((x) => x.id === id);
  if (!s) return <main className="page"><p>Series not found.</p></main>;
  const list = books.filter((b) => b.seriesId === s.id).sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));

  return (
    <main className="page">
      <Link to="/" className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> Library</Link>
      <header className="series-head">
        <div className="stack-sm">
          <span className="chip chip-gold" style={{ alignSelf: 'flex-start' }}>Series · {list.length} books</span>
          <h1>{s.name}</h1>
          <p className="muted">{s.author}</p>
        </div>
        <div className="row hide-sm" style={{ gap: 10 }}>
          <Tuft pose="read" size={70} />
          <p className="small muted" style={{ maxWidth: 260 }}>
            Every book gets its own settings. For pictures, I reuse the series’ visual direction as a head start.
          </p>
        </div>
      </header>

      <ol className="series-list">
        {list.map((b) => {
          const eds = editions.filter((e) => e.bookId === b.id);
          return (
            <li key={b.id} className="card series-book">
              <Link to={`/book/${b.id}`} className="series-cover" aria-label={b.title}>
                <BookCover cover={b.cover} image={b.coverUrl} title={b.title} author={b.author} size="sm" />
              </Link>
              <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                <span className="tiny faint" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>{b.seriesLabel}</span>
                <Link to={`/book/${b.id}`} style={{ textDecoration: 'none' }}><h3>{b.title}</h3></Link>
                <p className="small muted clamp-2">{b.description}</p>
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  {eds.length ? eds.map((e) => (
                    <Link key={e.id} to={e.status === 'ready' ? `/read/edition/${e.id}` : `/book/${b.id}`} className={`chip ${e.status === 'ready' ? '' : 'chip-gold'}`} style={{ textDecoration: 'none' }}>
                      <Icon name="feather" size={12} /> {e.name}{e.status !== 'ready' ? ' (in progress)' : ''}
                    </Link>
                  )) : <span className="chip chip-plain">No softened editions yet</span>}
                </div>
              </div>
              <div className="series-actions">
                <Link to={`/book/${b.id}/new`} className="btn btn-secondary btn-sm"><Icon name="wand" size={16} /> New edition</Link>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
