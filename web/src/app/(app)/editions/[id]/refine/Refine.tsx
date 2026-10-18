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

type Scope = 'whole' | 'chapters' | 'passage';
type Chapter = { sectionId: string; number: number; title: string; words: number; cost: number };

const safeInline = (html: string) => html.replace(/<(?!\/?(em|strong)>|br\s*\/?>)[^>]*>/gi, '');
const IDEAS = [
  'Give the hero a few more brave moments.',
  'Bring back more of the original humor.',
  'Still a little too scary at bedtime.',
  'Keep more of the author’s own words.',
];

export default function Refine({ book, edition, chapters, prices, capFor }: {
  book: { id: string; title: string };
  edition: { id: string; name: string; version: string; versionName: string; existing: string[] };
  chapters: Chapter[];
  prices: { whole: number; wholeMinutes: number; passage: number; perChapterOverhead: number };
  capFor: { whole: number; passage: number };
}) {
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

  const count = scope === 'whole' ? chapters.length : scope === 'chapters' ? picked.length : 1;
  const suggested = suggestedLevel(scope, count);
  const level = levelOverride ?? suggested;
  const next = nextFreeVersion(edition.existing, edition.version, level);
  const cost = scope === 'whole' ? prices.whole
    : scope === 'passage' ? prices.passage
    : chapters.filter((c) => picked.includes(c.sectionId)).reduce((n, c) => n + c.cost, 0);
  const minutes = scope === 'whole' ? prices.wholeMinutes : Math.max(1, Math.ceil(count / 3) * 2);
  const cap = capOverride ?? (scope === 'whole' ? capFor.whole : scope === 'passage' ? capFor.passage : Math.max(1, Math.ceil(cost * 1.5 + 0.5)));
  const nudge = looksLikeNewEdition(guidance);
  const ready = guidance.trim().length > 4 && (scope !== 'chapters' || picked.length > 0) && (scope !== 'passage' || para !== null);
  const blocks = paragraphs?.sectionId === passageChapter ? paragraphs.blocks : null;

  const submit = () => start(async () => {
    setMessage(null);
    try {
      const r = await startRefine(edition.id, {
        scope, sectionIds: picked, guidance, level, capUsd: cap,
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
            options={[{ value: 'whole', label: 'The whole edition' }, { value: 'chapters', label: 'Some chapters' }, { value: 'passage', label: 'One passage' }]} />

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

          <div className="field">
            <label className="label" htmlFor="guidance">Your guidance</label>
            <textarea id="guidance" className="textarea" maxLength={2000} value={guidance} onChange={(e) => setGuidance(e.target.value)}
              placeholder="e.g. The Lion should get a few more brave moments. He’s her favorite." />
            <div className="row-wrap">
              {IDEAS.map((t) => (
                <button key={t} type="button" className="chip chip-outline" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setGuidance(t)}><Icon name="plus" size={12} /> {t}</button>
              ))}
            </div>
          </div>

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
              <span className="small muted">{scope === 'passage' ? 'one passage' : `${count} chapter${count === 1 ? '' : 's'}`} · about {fmtMinutes(minutes)}</span>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="cap">Cost cap</label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="money-input"><span>$</span><input id="cap" type="number" min={1} step={1} value={cap} onChange={(e) => setCapOverride(Number(e.target.value))} /></div>
              <span className="hint" style={{ flex: 1, minWidth: 200 }}>I’ll pause and ask before going past it.</span>
            </div>
          </div>
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
