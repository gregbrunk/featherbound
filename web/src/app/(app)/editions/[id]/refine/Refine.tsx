'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import Tuft from '@/components/Tuft';
import { Guide, Segmented } from '@/components/ui';
import type { VersionLevel } from '@/db/schema';
import { fmtMinutes, money } from '@/lib/estimate';
import type { Block } from '@/lib/import/types';
import { looksLikeNewEdition, nextFreeVersion, suggestedLevel } from '@/lib/versions';
import { startRefine } from '../../../books/edition-actions';
import BudgetNote from '@/components/BudgetNote';
import type { BudgetStatus } from '@/lib/usage';

type Scope = 'whole' | 'chapters' | 'passage' | 'pictures';
type Picture = { sectionId: string; chapterNumber: number; imageId: string; alt: string };
type Op = { action: 'redraw' | 'remove' | 'replace'; note?: string; uploadPath?: string; uploading?: boolean; preview?: string };
type Chapter = { sectionId: string; number: number; title: string; words: number; cost: number };

const safeInline = (html: string) => html.replace(/<(?!\/?(em|strong)>|br\s*\/?>)[^>]*>/gi, '');
const IDEAS = [
  'Give the hero a few more brave moments.',
  'Bring back more of the original humor.',
  'Still a little too scary at bedtime.',
  'Keep more of the author’s own words.',
];

export default function Refine({ book, edition, chapters, prices, capFor, pictures, uploadPrefix, budget }: {
  book: { id: string; title: string };
  edition: { id: string; name: string; version: string; versionName: string; existing: string[] };
  chapters: Chapter[];
  prices: { whole: number; wholeMinutes: number; passage: number; perChapterOverhead: number; perPicture: number };
  capFor: { whole: number; passage: number };
  pictures: Picture[];
  uploadPrefix: string;
  budget: BudgetStatus | null;
}) {
  const [ops, setOps] = useState<Record<string, Op>>({});
  const [scope, setScope] = useState<Scope>('chapters');
  const [picked, setPicked] = useState<string[]>([]);
  const [passageChapter, setPassageChapter] = useState(chapters[0]?.sectionId ?? '');
  const [paragraphs, setParagraphs] = useState<{ sectionId: string; blocks: Block[] } | null>(null);
  const [para, setPara] = useState<number | null>(null);
  const [guidance, setGuidance] = useState('');
  const [levelOverride, setLevelOverride] = useState<VersionLevel | null>(null);
  const [capOverride, setCapOverride] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Load the chosen chapter's paragraphs for passage picking (the current version, without the recap).
  useEffect(() => {
    if (scope !== 'passage' || !passageChapter || paragraphs?.sectionId === passageChapter) return;
    let cancelled = false;
    fetch(`/api/editions/${edition.id}/sections/${passageChapter}?v=${encodeURIComponent(edition.version)}&raw=1`)
      .then((r) => r.json())
      .then((d: { blocks: Block[] }) => { if (!cancelled) setParagraphs({ sectionId: passageChapter, blocks: d.blocks }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [scope, passageChapter, paragraphs, edition.id, edition.version]);

  const opList = Object.entries(ops);
  const redraws = opList.filter(([, o]) => o.action === 'redraw').length;
  const count = scope === 'whole' ? chapters.length : scope === 'chapters' ? picked.length : scope === 'pictures' ? opList.length : 1;
  const suggested = scope === 'pictures' ? 'patch' : suggestedLevel(scope, count);
  const level = levelOverride ?? suggested;
  const next = nextFreeVersion(edition.existing, edition.version, level);
  const cost = scope === 'whole' ? prices.whole
    : scope === 'passage' ? prices.passage
    : scope === 'pictures' ? redraws * prices.perPicture
    : chapters.filter((c) => picked.includes(c.sectionId)).reduce((n, c) => n + c.cost, 0);
  const minutes = scope === 'whole' ? prices.wholeMinutes : Math.max(1, Math.ceil(count / 3) * 2);
  const cap = capOverride ?? (scope === 'whole' ? capFor.whole : scope === 'passage' ? capFor.passage : Math.max(1, Math.ceil(cost * 1.5 + 0.5)));
  const uploading = opList.some(([, o]) => o.uploading || (o.action === 'replace' && !o.uploadPath));
  const nudge = looksLikeNewEdition(guidance);
  const ready = scope === 'pictures'
    ? opList.length > 0 && !uploading
    : guidance.trim().length > 4 && (scope !== 'chapters' || picked.length > 0) && (scope !== 'passage' || para !== null);
  const blocks = paragraphs?.sectionId === passageChapter ? paragraphs.blocks : null;

  const submit = () => start(async () => {
    setMessage(null);
    try {
      const r = await startRefine(edition.id, {
        scope, sectionIds: picked, guidance, level, capUsd: cap,
        pictures: scope === 'pictures' ? opList.map(([key, o]) => {
          const p = pictures.find((x) => `${x.sectionId}:${x.imageId}` === key)!;
          return { sectionId: p.sectionId, imageId: p.imageId, action: o.action, note: o.note, uploadPath: o.uploadPath };
        }) : undefined,
        passage: scope === 'passage' && para !== null ? { sectionId: passageChapter, index: para } : undefined,
      });
      if (r && !r.ok) setMessage(r.message);
    } catch (e) {
      if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) throw e;
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    }
  });

  return (
    <main className="page page-narrow">
      <Link href={`/books/${book.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> {book.title}</Link>
      <div className="stack-lg" style={{ marginTop: 8 }}>
        <div className="stack-sm">
          <h1>Refine this edition</h1>
          <p className="muted">{edition.name} · currently <span className="badge-version">v{edition.version}</span> “{edition.versionName}”</p>
        </div>
        <Guide pose="write" size={66}>
          Tell me what to improve. I’ll only change what you ask for and keep everything else steady. The result is a <strong>new version</strong>, so you can always go back.
        </Guide>

        <div className="card stack">
          <span className="label">What should I change?</span>
          <Segmented<Scope> label="Scope" value={scope} onChange={(s) => { setScope(s); setLevelOverride(null); setCapOverride(null); }}
            options={[
              { value: 'whole', label: 'The whole edition' }, { value: 'chapters', label: 'Some chapters' }, { value: 'passage', label: 'One passage' },
              ...(pictures.length ? [{ value: 'pictures' as Scope, label: 'Pictures' }] : []),
            ]} />

          {scope === 'pictures' && <PicturePicker bookId={book.id} pictures={pictures} ops={ops} setOps={setOps} uploadPrefix={uploadPrefix} />}

          {scope === 'chapters' && (
            <div className="chapter-pick">
              {chapters.map((c) => (
                <button key={c.sectionId} type="button" className={`chip ${picked.includes(c.sectionId) ? '' : 'chip-outline'}`} style={{ border: 'none', cursor: 'pointer' }}
                  onClick={() => { setPicked(picked.includes(c.sectionId) ? picked.filter((x) => x !== c.sectionId) : [...picked, c.sectionId]); setCapOverride(null); }}
                  aria-pressed={picked.includes(c.sectionId)}>
                  {c.number}. {c.title}
                </button>
              ))}
            </div>
          )}

          {scope === 'passage' && (
            <div className="stack-sm">
              <div className="field">
                <span className="label" id="passage-chapter">Chapter</span>
                <Select labelledBy="passage-chapter" value={passageChapter} onChange={(v) => { setPassageChapter(v); setPara(null); }}
                  options={chapters.map((c) => ({ value: c.sectionId, label: `${c.number}. ${c.title}` }))} />
              </div>
              <span className="small muted">Tap the paragraph you want changed.</span>
              <div className="passage-pick prose">
                {!blocks ? <p className="faint">Opening…</p> : blocks.map((b, i) => ('html' in b ? (
                  <p key={i} className={para === i ? 'picked' : ''} onClick={() => setPara(i)} role="button" tabIndex={0} aria-pressed={para === i}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPara(i)} dangerouslySetInnerHTML={{ __html: safeInline(b.html) }} />
                ) : null))}
              </div>
            </div>
          )}

          {scope !== 'pictures' && <div className="field">
            <label className="label" htmlFor="guidance">Your guidance</label>
            <textarea id="guidance" className="textarea" maxLength={2000} value={guidance} onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g. The Lion should get a few more brave moments. He’s her favorite." />
            <div className="row-wrap">
              {IDEAS.map((t) => (
                <button key={t} type="button" className="chip chip-outline" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setGuidance(t)}><Icon name="plus" size={12} /> {t}</button>
              ))}
            </div>
          </div>}

          {nudge && (
            <div className="card card-tinted row" style={{ gap: 14, flexWrap: 'wrap' }}>
              <Tuft pose="think" size={60} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>That sounds like a new edition</strong>
                <p className="small muted">Changing who the book is for works best as a new edition, so this one stays as it is.</p>
              </div>
              <Link className="btn btn-secondary btn-sm" href={`/books/${book.id}/new?from=${edition.id}`}>New edition from these settings</Link>
            </div>
          )}
        </div>

        <div className="card stack">
          <div className="row" style={{ flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
              <span className="label">New version</span>
              <div className="row" style={{ gap: 8 }}>
                <span className="badge-version">v{edition.version}</span><Icon name="arrow" size={16} /><span className="badge-version" style={{ background: 'var(--plum)' }}>v{next}</span>
              </div>
              <Segmented<VersionLevel> label="Version level" value={level} onChange={setLevelOverride}
                options={[{ value: 'patch', label: 'Patch' }, { value: 'minor', label: 'Minor' }, { value: 'major', label: 'Major' }]} />
              <span className="hint">{level === 'major' ? 'Major: changes across the whole book.' : level === 'minor' ? 'Minor: several chapters revised.' : 'Patch: a small, targeted fix.'} I suggested <strong>{suggested}</strong>.</span>
            </div>
            <div className="est-total">
              <span className="tiny faint">ESTIMATE</span>
              <strong>~{money(cost)}</strong>
              <span className="small muted">{scope === 'passage' ? 'one passage' : scope === 'pictures' ? `${count} picture${count === 1 ? '' : 's'}${redraws ? `, ${redraws} to redraw` : ''}` : `${count} chapter${count === 1 ? '' : 's'}`} · about {fmtMinutes(minutes)}</span>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="cap">Cost cap</label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="money-input"><span>$</span><input id="cap" type="number" min={1} step={1} value={cap} onChange={(e) => setCapOverride(Number(e.target.value))} /></div>
              <span className="hint" style={{ flex: 1, minWidth: 200 }}>I’ll pause and ask before going past it.</span>
            </div>
          </div>
          <BudgetNote status={budget} cost={cost} />
          {message && <p className="small status-bad">{message}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Link href={`/books/${book.id}`} className="btn btn-ghost">Cancel</Link>
            <button className="btn btn-primary" disabled={!ready || pending} onClick={submit}><Icon name="sparkle" size={18} /> {pending ? 'Starting…' : 'Make new version'}</button>
          </div>
        </div>
      </div>
    </main>
  );
}

function PicturePicker({ bookId, pictures, ops, setOps, uploadPrefix }: {
  bookId: string; pictures: Picture[]; ops: Record<string, Op>; setOps: (fn: (o: Record<string, Op>) => Record<string, Op>) => void; uploadPrefix: string;
}) {
  const set = (key: string, op: Op | null) => setOps((o) => { const n = { ...o }; if (op) n[key] = op; else delete n[key]; return n; });
  const onFile = async (key: string, file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { alert('Pick a JPEG, PNG or WebP picture.'); return; }
    set(key, { action: 'replace', uploading: true, preview: URL.createObjectURL(file) });
    try {
      const { upload } = await import('@vercel/blob/client');
      const safe = file.name.replace(/[^a-zA-Z0-9._ -]/g, '_');
      const blob = await upload(`${uploadPrefix}${safe}`, file, { access: 'private', handleUploadUrl: '/api/upload' });
      setOps((o) => ({ ...o, [key]: { ...o[key], uploading: false, uploadPath: blob.pathname } }));
    } catch {
      set(key, null);
      alert('That upload didn’t work. Try again?');
    }
  };
  return (
    <div className="stack-sm">
      <span className="small muted">Pick what to do with any picture. Everything else stays as it is.</span>
      <div className="pic-pick">
        {pictures.map((p) => {
          const key = `${p.sectionId}:${p.imageId}`;
          const op = ops[key];
          return (
            <div key={key} className={`pic-card ${op ? 'on' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={op?.preview ?? `/api/books/${bookId}/images/${p.imageId}`} alt={p.alt} loading="lazy" style={{ opacity: op?.action === 'remove' ? 0.35 : 1 }} />
              <span className="tiny faint">Chapter {p.chapterNumber}</span>
              {p.alt && <span className="tiny clamp-3">{p.alt}</span>}
              <div className="row" style={{ gap: 2, flexWrap: 'wrap' }}>
                <button type="button" className={`btn btn-sm ${op?.action === 'redraw' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => set(key, op?.action === 'redraw' ? null : { action: 'redraw' })}><Icon name="refresh" size={14} /> Redraw</button>
                <label className={`btn btn-sm ${op?.action === 'replace' ? 'btn-primary' : 'btn-ghost'}`} style={{ cursor: 'pointer' }}>
                  <Icon name="upload" size={14} /> {op?.uploading ? 'Uploading…' : 'Upload'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(key, f); }} />
                </label>
                <button type="button" className={`btn btn-sm ${op?.action === 'remove' ? 'btn-primary' : 'btn-ghost'}`} aria-label="Remove picture" onClick={() => set(key, op?.action === 'remove' ? null : { action: 'remove' })}><Icon name="trash" size={14} /></button>
              </div>
              {op?.action === 'redraw' && (
                <input className="input" style={{ height: 34, fontSize: 13 }} placeholder="What should change? (optional)" value={op.note ?? ''} maxLength={500}
                  onChange={(e) => set(key, { ...op, note: e.target.value })} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
