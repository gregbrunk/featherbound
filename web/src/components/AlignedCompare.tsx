'use client';

import { useEffect, useMemo, useState } from 'react';
import { diffWords, plainText, type Seg } from '@/lib/diff';
import type { Block } from '@/lib/import/types';
import Tuft from './Tuft';

// The original and the softened chapter side by side, one row per paragraph pair, with the
// changed words highlighted. Used by the reader's compare mode.

const segs = (list: Seg[], cls: string) => list.map((x, k) => (x.changed ? <span key={k} className={cls}>{x.text}</span> : <span key={k}>{x.text}</span>));

export default function AlignedCompare({ originalUrl, softenedUrl, bookId, fontFamily, fontSize }: {
  originalUrl: string; softenedUrl: string; bookId: string; fontFamily: string; fontSize: number;
}) {
  const [data, setData] = useState<{ key: string; original: Block[]; softened: Block[] } | null>(null);
  const key = `${originalUrl}|${softenedUrl}`;
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch(originalUrl).then((r) => r.json()), fetch(softenedUrl).then((r) => r.json())])
      .then(([o, s]: { blocks: Block[] }[]) => { if (!cancelled) setData({ key, original: o.blocks, softened: s.blocks }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [originalUrl, softenedUrl, key]);
  const rows = useMemo(() => (data?.key === key ? data.softened.map((b, i) => ({ o: data.original[i], s: b })) : null), [data, key]);

  if (!rows) return <div className="center stack" style={{ alignItems: 'center', paddingTop: '20vh' }}><Tuft pose="read" size={80} /><span className="small">Opening…</span></div>;
  return (
    <div className="compare-reader-scroll">
      <div className="compare aligned" style={{ fontFamily, fontSize }}>
        <div className="compare-row">
          <div className="compare-col original"><div className="compare-head"><span className="chip chip-plain">Original</span></div></div>
          <div className="compare-col softened"><div className="compare-head"><span className="chip">Softened</span></div></div>
        </div>
        {rows.map(({ o, s }, i) => {
          if (s.type === 'img') {
            // eslint-disable-next-line @next/next/no-img-element
            const pic = <figure className="illus"><img className="illus-img" src={`/api/books/${bookId}/images/${s.imageId}`} alt={s.alt} loading="lazy" /></figure>;
            return <div key={i} className="compare-row"><div className="compare-col original" /><div className="compare-col softened prose">{pic}</div></div>;
          }
          if (!('html' in s)) return <div key={i} className="compare-row"><div className="compare-col original prose"><p className="scene-break">⁂</p></div><div className="compare-col softened prose"><p className="scene-break">⁂</p></div></div>;
          const d = o && 'html' in o ? diffWords(plainText(o.html), plainText(s.html)) : null;
          return (
            <div key={i} className="compare-row">
              <div className="compare-col original prose"><p>{d ? segs(d.left, 'diff-del') : null}</p></div>
              <div className="compare-col softened prose"><p>{d ? segs(d.right, 'diff-ins') : plainText(s.html)}</p></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
