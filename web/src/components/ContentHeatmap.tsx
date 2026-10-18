import type { Intensities } from '@/db/schema';
import { CATEGORIES, type FilterCategory } from '@/lib/editions';

// One row per content category, one square per chapter. Shades step from paper to ruby;
// every row also says its peak in words, so the colour is never the only signal.

const SHADES = ['rgba(43,33,64,0.06)', '#f6e3ae', '#f0b067', '#c8475e'];
const WORDS = ['None', 'Mild', 'Moderate', 'Strong'];

export type HeatChapter = { number: number; title: string; intensities: Intensities; notes: Partial<Record<string, string>> };

export function summarize(chapters: HeatChapter[]) {
  return CATEGORIES.map((c) => {
    const vals = chapters.map((ch) => ch.intensities[c.id] ?? 0);
    const peak = vals.length ? Math.max(...vals) : 0;
    const hot = chapters.filter((ch) => (ch.intensities[c.id] ?? 0) >= 2).map((ch) => ch.number);
    const any = vals.filter((v) => v > 0).length;
    return { ...c, peak, hot, any, vals };
  });
}

export default function ContentHeatmap({ chapters, only }: { chapters: HeatChapter[]; only?: FilterCategory[] }) {
  const rows = summarize(chapters).filter((r) => !only || only.includes(r.id));
  return (
    <div className="heatmap">
      <div className="heatmap-legend tiny muted">
        {WORDS.map((w, i) => (
          <span key={w} className="row" style={{ gap: 6 }}>
            <i className="heat-swatch" style={{ background: SHADES[i] }} /> {w}
          </span>
        ))}
        <span className="spacer" />
        <span>Chapters 1 → {chapters.length}</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="heat-row">
          <div className="heat-label">
            <span aria-hidden="true">{r.icon}</span>
            <span>{r.name}</span>
          </div>
          <div className="heat-cells" role="img" aria-label={`${r.name}: ${r.any ? `strongest ${WORDS[r.peak].toLowerCase()}${r.hot.length ? `, chapters ${r.hot.join(', ')}` : ''}` : 'none found'}`}>
            {chapters.map((ch, i) => {
              const v = r.vals[i];
              const note = ch.notes[r.id];
              return <i key={ch.number} title={`Chapter ${ch.number}, ${ch.title}: ${WORDS[v]}${note ? `. ${note}` : ''}`} style={{ background: SHADES[v] }} />;
            })}
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

/** Chapter-by-chapter notes for the categories that came up, for the "What's inside" tab. */
export function ChapterNotes({ chapters, summaries }: { chapters: HeatChapter[]; summaries: string[] }) {
  return (
    <ol className="chapter-notes">
      {chapters.map((ch, i) => {
        const flagged = CATEGORIES.filter((c) => (ch.intensities[c.id] ?? 0) > 0);
        return (
          <li key={ch.number}>
            <details>
              <summary>
                <span className="mono faint">{ch.number}</span> <strong>{ch.title}</strong>
                <span className="chapter-notes-flags">
                  {flagged.map((c) => <span key={c.id} title={`${c.name}: ${WORDS[ch.intensities[c.id] ?? 0]}`} aria-label={`${c.name}: ${WORDS[ch.intensities[c.id] ?? 0]}`}>{c.icon}</span>)}
                </span>
              </summary>
              <div className="stack-sm" style={{ padding: '6px 0 10px 28px' }}>
                <p className="small">{summaries[i]}</p>
                {flagged.length > 0 && (
                  <ul className="small muted">
                    {flagged.map((c) => <li key={c.id}><strong>{c.name}</strong> ({WORDS[ch.intensities[c.id] ?? 0].toLowerCase()}): {ch.notes[c.id] ?? ''}</li>)}
                  </ul>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
