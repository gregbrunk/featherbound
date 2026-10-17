import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import Icon from '../components/Icon';
import Tuft from '../components/Tuft';
import { Guide, ProtoNote, Segmented, money } from '../components/ui';
import { ozOriginal } from '../data/ozOriginal';
import { ozChangeNotes, ozSoftenedV1 } from '../data/ozSoftened';
import { OZ_CHAPTERS } from '../data/library';
import { estimate, hardestChapter } from './Wizard';

type Comment = { id: number; chapter: number; quote: string; text: string };

export default function SampleReview() {
  const { id } = useParams();
  const { editions, books, updateEdition, toast } = useStore();
  const nav = useNavigate();
  const edition = editions.find((e) => e.id === id);
  const book = books.find((b) => b.id === edition?.bookId);
  const [making, setMaking] = useState(edition?.status === 'making-samples');
  const [round, setRound] = useState(1);
  const [chapter, setChapter] = useState(1);
  const [view, setView] = useState<'side' | 'original' | 'softened'>('side');
  const [comments, setComments] = useState<Comment[]>([
    { id: 1, chapter: 12, quote: 'CLANG! CLANG! CLANG!', text: 'Love this! He’ll want to bang pots for a week.' },
  ]);
  const [general, setGeneral] = useState('');
  const [pending, setPending] = useState<{ quote: string; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState('');
  const softRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!making) return;
    const t = setTimeout(() => {
      setMaking(false);
      if (edition) updateEdition(edition.id, { status: 'samples-ready' });
    }, 3200);
    return () => clearTimeout(t);
  }, [making, edition, updateEdition]);

  if (!edition || !book) return <main className="page"><p>Edition not found.</p></main>;
  const realHard = book.id === 'oz' ? 12 : hardestChapter(book);
  const samples = [
    { n: 1, why: 'Voice check', shown: 1 },
    { n: realHard, why: 'Hardest chapter', shown: 12 },
  ];
  const est = estimate(book, edition.settings);

  if (making) {
    return (
      <main className="page page-narrow">
        <div className="card card-lg center stack" style={{ alignItems: 'center', marginTop: 30 }}>
          <Tuft pose="write" size={140} />
          <h2>{round > 1 ? 'Rewriting the samples with your notes…' : 'Writing your sample chapters…'}</h2>
          <p className="muted">Chapter 1 and chapter {realHard} of <em>{book.title}</em>, for {edition.name.toLowerCase()}.</p>
          <div className="progress-bar" style={{ width: 260 }}><i className="indeterminate" /></div>
          <p className="small faint">Usually under a minute. You can leave this page; I’ll put a note on the book when they’re ready.</p>
        </div>
      </main>
    );
  }

  const onMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !sel || sel.rangeCount === 0 || !softRef.current?.contains(sel.anchorNode)) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setPending({ quote: text.slice(0, 140), x: rect.left + rect.width / 2, y: rect.bottom + window.scrollY });
    setDraft('');
  };

  const orig = ozOriginal[chapter];
  const soft = ozSoftenedV1[chapter];
  const notes = ozChangeNotes[chapter];
  const chComments = comments.filter((c) => c.chapter === chapter);

  const highlight = (p: string) => {
    const hit = chComments.find((c) => p.includes(c.quote));
    if (!hit) return p;
    const i = p.indexOf(hit.quote);
    return (<>{p.slice(0, i)}<mark title={hit.text}>{hit.quote}</mark>{p.slice(i + hit.quote.length)}</>);
  };

  const approve = () => {
    const guidance = [...comments.map((c) => `“${c.quote}”: ${c.text}`), ...(general ? [general] : [])];
    updateEdition(edition.id, {
      sampleGuidance: guidance.length ? guidance : edition.sampleGuidance,
      status: 'running',
      run: { chapter: 0, of: book.chapters, spent: 0, estimate: est.total, cap: Math.ceil(est.total * 1.3) },
    });
    toast('Off I go! I’ll write the whole book now.', 'write');
    nav(`/edition/${edition.id}/progress`);
  };

  return (
    <main className="page sample-page">
      <Link to={`/book/${book.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> {book.title}</Link>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
        <div className="stack-sm" style={{ flex: 1, minWidth: 260 }}>
          <span className="chip chip-gold" style={{ alignSelf: 'flex-start' }}><Icon name="sparkle" size={12} /> Sample review{round > 1 ? ` · round ${round}` : ''}</span>
          <h1>How do these feel?</h1>
          <p className="muted">{book.title} · {edition.name}</p>
        </div>
        <div className="hide-sm" style={{ maxWidth: 420 }}>
          <Guide pose="read" size={64}>Read them side by side. <strong>Highlight any words</strong> in my version to leave a comment. When you’re happy, I’ll do the whole book.</Guide>
        </div>
      </div>

      {book.id !== 'oz' && (
        <div style={{ marginTop: 16 }}>
          <ProtoNote>Prototype: every book shows sample text from <em>The Wonderful Wizard of Oz</em> (public domain), since I can’t include copyrighted text here.</ProtoNote>
        </div>
      )}

      <div className="sample-toolbar">
        <div className="sample-tabs" role="tablist">
          {samples.map((x) => (
            <button key={x.shown} role="tab" aria-selected={chapter === x.shown} className={chapter === x.shown ? 'on' : ''} onClick={() => setChapter(x.shown)}>
              <span className="tiny" style={{ fontWeight: 800, opacity: 0.8 }}>{x.why.toUpperCase()}</span>
              <span>Chapter {x.n}{book.id === 'oz' ? `: ${OZ_CHAPTERS[x.shown - 1]}` : ''}</span>
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => toast('Prototype: pick any chapter to sample instead', 'think')}>Pick other chapters</button>
        </div>
        <Segmented label="View" value={view} onChange={setView}
          options={[{ value: 'side', label: <><Icon name="columns" size={16} /> <span className="hide-sm">Side by side</span></> }, { value: 'original', label: 'Original' }, { value: 'softened', label: 'Softened' }]} />
      </div>

      <div className="sample-grid">
        <div className={`compare ${view}`}>
          {view !== 'softened' && (
            <div className="compare-col original">
              <div className="compare-head"><span className="chip chip-plain">Original</span></div>
              <div className="prose">{orig.map((p, i) => <p key={i} data-i={i}>{p}</p>)}</div>
            </div>
          )}
          {view !== 'original' && (
            <div className="compare-col softened" ref={softRef} onMouseUp={onMouseUp}>
              <div className="compare-head"><span className="chip"><Icon name="feather" size={12} /> Softened · {edition.name}</span></div>
              <div className="prose">{soft.map((p, i) => <p key={i} data-i={i}>{highlight(p)}</p>)}</div>
            </div>
          )}
        </div>

        <aside className="sample-side">
          <div className="card stack-sm">
            <h3>What I changed</h3>
            <ul className="change-notes">
              {notes.map((n, i) => (
                <li key={i}>
                  <span className={`chip ${n.level === 'Remove' ? 'chip-ruby' : 'chip-gold'}`}>{n.level}</span>
                  <div><strong className="small">{n.category}</strong><div className="small muted">{n.note}</div></div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card stack-sm">
            <h3>Your comments {comments.length > 0 && <span className="chip">{comments.length}</span>}</h3>
            {comments.length === 0 && <p className="small muted">Highlight words in the softened text to comment on them.</p>}
            <ul className="comment-list">
              {comments.map((c) => (
                <li key={c.id}>
                  <div className="tiny faint">Chapter {c.chapter === 12 ? realHard : 1}</div>
                  <blockquote>“{c.quote}”</blockquote>
                  <p className="small">{c.text}</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => setComments(comments.filter((x) => x.id !== c.id))}>Remove</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card stack-sm">
            <label className="label" htmlFor="general">Overall thoughts</label>
            <textarea id="general" className="textarea" value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="e.g. A touch too babyish. Keep a bit more of the old-fashioned charm." />
            <div className="row-wrap">
              {['Too babyish', 'Still too scary', 'Perfect tone', 'Keep more of the original words'].map((t) => (
                <button key={t} className="chip chip-outline" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setGeneral((g) => (g ? `${g} ${t}.` : `${t}.`))}>{t}</button>
              ))}
            </div>
          </div>

          <div className="card card-tinted stack-sm">
            <button className="btn btn-secondary" disabled={!comments.length && !general}
              onClick={() => { setRound(round + 1); setMaking(true); updateEdition(edition.id, { sampleGuidance: [...edition.sampleGuidance, ...(general ? [general] : [])] }); }}>
              <Icon name="refresh" size={18} /> Rewrite samples with my notes · ~{money(est.samples)}
            </button>
            <button className="btn btn-primary" onClick={approve}>
              <Icon name="check" size={18} /> Looks great: write the whole book
            </button>
            <p className="tiny muted center">Full book: ~{money(est.total)} · cap {money(Math.ceil(est.total * 1.3))} · about {Math.max(5, est.minutes)} min</p>
          </div>
        </aside>
      </div>

      {pending && (
        <div className="comment-pop" style={{ left: Math.min(Math.max(pending.x - 160, 12), window.innerWidth - 332), top: pending.y + 10 }}>
          <blockquote>“{pending.quote}”</blockquote>
          <textarea className="textarea" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What should I change here?" style={{ minHeight: 70 }} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={!draft.trim()} onClick={() => {
              setComments([...comments, { id: Date.now(), chapter, quote: pending.quote, text: draft.trim() }]);
              setPending(null);
              window.getSelection()?.removeAllRanges();
            }}>Add comment</button>
          </div>
        </div>
      )}
    </main>
  );
}
