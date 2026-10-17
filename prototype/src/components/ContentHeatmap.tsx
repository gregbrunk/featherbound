import { CATEGORIES, contentReport } from '../data/library';
import type { Book, FilterCategory } from '../data/types';

const SHADES = ['rgba(43,33,64,0.06)', '#f6e3ae', '#f0b067', '#c8475e'];
const WORDS = ['None', 'Mild', 'Moderate', 'Strong'];

export function summarize(book: Book) {
  const report = contentReport(book);
  return CATEGORIES.map((c) => {
    const vals = report[c.id];
    const peak = Math.max(...vals);
    const hot = vals.map((v, i) => ({ v, ch: i + 1 })).filter((x) => x.v >= 2).map((x) => x.ch);
    const any = vals.filter((v) => v > 0).length;
    return { ...c, peak, hot, any, vals };
  });
}

export default function ContentHeatmap({ book, only }: { book: Book; only?: FilterCategory[] }) {
  const rows = summarize(book).filter((r) => !only || only.includes(r.id));
  return (
    <div className="heatmap">
      <div className="heatmap-legend tiny muted">
        {WORDS.map((w, i) => (
          <span key={w} className="row" style={{ gap: 6 }}>
            <i className="heat-swatch" style={{ background: SHADES[i] }} /> {w}
          </span>
        ))}
        <span className="spacer" />
        <span>Chapters 1 → {book.chapters}</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="heat-row">
          <div className="heat-label">
            <span aria-hidden="true">{r.icon}</span>
            <span>{r.name}</span>
          </div>
          <div className="heat-cells" role="img" aria-label={`${r.name}: ${r.any ? `strongest ${WORDS[r.peak].toLowerCase()}${r.hot.length ? `, chapters ${r.hot.join(', ')}` : ''}` : 'none found'}`}>
            {r.vals.map((v, i) => (
              <i key={i} title={`Chapter ${i + 1}: ${WORDS[v]}`} style={{ background: SHADES[v] }} />
            ))}
          </div>
          <div className="heat-sum small">
            {r.any === 0 ? <span className="faint">None found</span> : (
              <>
                <strong style={{ color: r.peak >= 3 ? 'var(--ruby)' : r.peak === 2 ? '#b8661c' : 'var(--gold-deep)' }}>{WORDS[r.peak]}</strong>
                <span className="muted">{r.hot.length ? ` · ch. ${r.hot.slice(0, 4).join(', ')}${r.hot.length > 4 ? '…' : ''}` : ''}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
