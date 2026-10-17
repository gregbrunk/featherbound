import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../store';
import Icon from '../components/Icon';
import { Guide, Modal, ModalHead, fmtDate, money } from '../components/ui';
import { ozSoftenedV1, ozSoftenedV11 } from '../data/ozSoftened';
import type { Version } from '../data/types';

const LEVEL_CHIP: Record<Version['level'], [string, string]> = {
  initial: ['First version', 'chip-emerald'],
  major: ['Major', 'chip-ruby'],
  minor: ['Minor', 'chip-gold'],
  patch: ['Patch', 'chip-sapphire'],
};

export default function History() {
  const { id } = useParams();
  const { editions, books, setCurrentVersion, toast } = useStore();
  const edition = editions.find((e) => e.id === id);
  const book = books.find((b) => b.id === edition?.bookId);
  const [diff, setDiff] = useState<Version | null>(null);
  const [rollback, setRollback] = useState<Version | null>(null);
  if (!edition || !book) return <main className="page"><p>Edition not found.</p></main>;
  const list = [...edition.versions].reverse();
  const current = edition.versions.find((v) => v.number === edition.currentVersion)!;

  return (
    <main className="page page-narrow">
      <Link to={`/book/${book.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> {book.title}</Link>
      <div className="stack-lg" style={{ marginTop: 8 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="stack-sm" style={{ flex: 1 }}>
            <h1>Version history</h1>
            <p className="muted">{edition.name} · {edition.versions.length} version{edition.versions.length === 1 ? '' : 's'}</p>
          </div>
          <Link to={`/edition/${edition.id}/refine`} className="btn btn-primary"><Icon name="sparkle" size={18} /> Refine</Link>
        </div>
        <Guide pose="read" size={60}>Every change makes a new version. Going back never deletes anything; later versions stay here.</Guide>

        <ol className="timeline">
          {list.map((v) => {
            const isCurrent = v.number === edition.currentVersion;
            const [lvl, cls] = LEVEL_CHIP[v.level];
            return (
              <li key={v.number} className={isCurrent ? 'current' : ''}>
                <span className="tl-dot" aria-hidden="true" />
                <article className="card stack-sm">
                  <div className="row-wrap">
                    <span className="badge-version">v{v.number}</span>
                    <h3 style={{ marginRight: 4 }}>“{v.name}”</h3>
                    <span className={`chip ${cls}`}>{lvl}</span>
                    {isCurrent && <span className="chip"><Icon name="check" size={12} stroke={3} /> Current</span>}
                  </div>
                  <p>{v.description}</p>
                  {v.guidance && <blockquote className="guidance-quote"><span className="tiny faint">YOU ASKED</span>{v.guidance}</blockquote>}
                  <p className="tiny faint">{fmtDate(v.date)} · cost {money(v.cost)}</p>
                  <div className="row-wrap">
                    <Link to={`/read/edition/${edition.id}?v=${v.number}`} className="btn btn-secondary btn-sm"><Icon name="book" size={16} /> Read this version</Link>
                    {!isCurrent && <button className="btn btn-secondary btn-sm" onClick={() => setDiff(v)}><Icon name="columns" size={16} /> Compare with current</button>}
                    {!isCurrent && <button className="btn btn-ghost btn-sm" onClick={() => setRollback(v)}><Icon name="history" size={16} /> Make this current</button>}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </div>

      {diff && (
        <Modal onClose={() => setDiff(null)} label="Compare versions" wide>
          <ModalHead title={`v${diff.number} → v${current.number}`} onClose={() => setDiff(null)} />
          <DiffView older={diff} newer={current} bookId={book.id} />
        </Modal>
      )}

      {rollback && (
        <Modal onClose={() => setRollback(null)} label="Make version current">
          <ModalHead title={`Go back to v${rollback.number}?`} pose="think" onClose={() => setRollback(null)} />
          <div className="stack">
            <p>“{rollback.name}” becomes the version everyone reads and downloads. <strong>Nothing is deleted.</strong> v{current.number} “{current.name}” stays in the history, and you can switch back any time.</p>
            <p className="small muted">Reading progress stays on the same chapter.</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setRollback(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setCurrentVersion(edition.id, rollback.number); setRollback(null); toast(`v${rollback.number} is current again`, 'cheer'); }}>Make v{rollback.number} current</button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

function DiffView({ older, newer, bookId }: { older: Version; newer: Version; bookId: string }) {
  const real = bookId === 'oz' && ((older.number === '1.0.0' && newer.number === '1.1.0') || (older.number === '1.1.0' && newer.number === '1.0.0'));
  if (!real) {
    return (
      <div className="stack">
        <p className="muted">{newer.description}</p>
        <p className="small faint">Prototype: a word-by-word comparison is shown for <em>Oz</em> v1.0.0 → v1.1.0. Other books show their change notes.</p>
      </div>
    );
  }
  const a = older.number === '1.0.0' ? ozSoftenedV1[12] : ozSoftenedV11[12];
  const b = older.number === '1.0.0' ? ozSoftenedV11[12] : ozSoftenedV1[12];
  const changed = a.map((p, i) => ({ i, old: p, new: b[i] })).filter((x) => x.old !== x.new);
  return (
    <div className="stack">
      <p className="small muted">Chapter 12 · {changed.length} paragraphs changed. Chapters 13, 14 and 23 changed too (not in prototype).</p>
      {changed.map((c) => (
        <div key={c.i} className="diff-pair">
          <p className="diff-old"><span className="tiny">BEFORE</span>{c.old}</p>
          <p className="diff-new"><span className="tiny">AFTER</span>{c.new}</p>
        </div>
      ))}
    </div>
  );
}
