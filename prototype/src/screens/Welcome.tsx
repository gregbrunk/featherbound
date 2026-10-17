import { Link } from 'react-router-dom';
import Tuft from '../components/Tuft';
import Icon from '../components/Icon';
import { ProtoNote } from '../components/ui';

// What a newly approved account sees on its first visit: its own empty library, nothing shared.
export default function Welcome() {
  return (
    <main className="page page-narrow">
      <ProtoNote>Prototype preview: a brand-new account’s first visit. Your own library is untouched; <Link to="/">go back to it</Link>.</ProtoNote>
      <section className="card card-lg center stack" style={{ alignItems: 'center', marginTop: 20, position: 'relative', overflow: 'hidden' }}>
        <div className="sparkles" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 100}%`, top: `${(i * 67) % 100}%`, animationDelay: `${(i % 4) * 0.5}s` }} />)}
        </div>
        <Tuft pose="wave" size={140} />
        <h1>Welcome to your library!</h1>
        <p className="muted" style={{ maxWidth: 520 }}>
          I’m Tuft. This library is all yours: your books, your softened editions and your settings. Two quick steps and we can start reading.
        </p>
      </section>

      <ol className="welcome-steps">
        <li className="card">
          <span className="welcome-num">1</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>Add your AI key</h3>
            <p className="small muted">I need a key to write and draw. One Vercel AI Gateway key covers every model at list price, or add keys from each provider. Your key pays only for what you run.</p>
          </div>
          <Link to="/settings?tab=models" className="btn btn-primary btn-sm"><Icon name="key" size={16} /> Add key</Link>
        </li>
        <li className="card">
          <span className="welcome-num">2</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>Add your first book</h3>
            <p className="small muted">Upload a DRM-free EPUB or PDF you own. I’ll read it, find its cover and series, and help you make a softer edition.</p>
          </div>
          <Link to="/add" className="btn btn-secondary btn-sm"><Icon name="plus" size={16} /> Add a book</Link>
        </li>
      </ol>

      <section className="shelf-section">
        <div className="shelf-head"><h2>My Library</h2></div>
        <div className="shelf empty-shelf"><span className="muted small">Your shelves are empty… for now.</span></div>
        <div className="shelf-board" />
      </section>
    </main>
  );
}
