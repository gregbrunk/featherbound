import Link from 'next/link';
import { notFound } from 'next/navigation';
import Icon from '@/components/Icon';
import { Guide } from '@/components/ui';
import type { VersionRow } from '@/lib/runs';
import { getEdition } from '@/lib/analysis';
import { money } from '@/lib/estimate';
import { getBook } from '@/lib/library';
import { latestRun, listVersions } from '@/lib/runs';
import { requireAccount } from '@/lib/session';
import { MakeCurrentButton } from './MakeCurrent';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

const LEVEL_CHIP: Record<VersionRow['level'], [string, string]> = {
  initial: ['First version', 'chip-emerald'],
  major: ['Major', 'chip-ruby'],
  minor: ['Minor', 'chip-gold'],
  patch: ['Patch', 'chip-sapphire'],
};

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireAccount();
  const { id } = await params;
  const ed = await getEdition(userId, id);
  if (!ed) notFound();
  const [book, versions, run] = await Promise.all([getBook(userId, ed.bookId), listVersions(userId, ed.id), latestRun(userId, ed.id, 'refine')]);
  if (!book) notFound();
  const current = versions.find((v) => v.number === ed.currentVersion);
  const busy = run && (run.status === 'running' || run.status === 'paused-cap');

  return (
    <main className="page page-narrow">
      <Link href={`/books/${book.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> {book.title}</Link>
      <div className="stack-lg" style={{ marginTop: 8 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="stack-sm" style={{ flex: 1 }}>
            <h1>Version history</h1>
            <p className="muted">{ed.name} · {versions.length} version{versions.length === 1 ? '' : 's'}</p>
          </div>
          {busy
            ? <Link href={`/editions/${ed.id}/progress`} className="btn btn-secondary"><Icon name="clock" size={18} /> Refining… see progress</Link>
            : current && <Link href={`/editions/${ed.id}/refine`} className="btn btn-primary"><Icon name="sparkle" size={18} /> Refine</Link>}
        </div>
        <Guide pose="read" size={60}>Every change makes a new version. Going back never deletes anything; later versions stay here.</Guide>

        <ol className="timeline">
          {versions.map((v) => {
            const isCurrent = v.number === ed.currentVersion;
            const [lvl, cls] = LEVEL_CHIP[v.level];
            return (
              <li key={v.id} className={isCurrent ? 'current' : ''}>
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
                  <p className="tiny faint">{v.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · cost {money(Number(v.costUsd))}</p>
                  <div className="row-wrap">
                    <Link href={`/read/edition/${ed.id}?v=${encodeURIComponent(v.number)}`} className="btn btn-secondary btn-sm"><Icon name="book" size={16} /> Read this version</Link>
                    {!isCurrent && current && (
                      <Link href={`/editions/${ed.id}/compare?a=${encodeURIComponent(v.number)}&b=${encodeURIComponent(current.number)}`} className="btn btn-secondary btn-sm">
                        <Icon name="columns" size={16} /> Compare with current
                      </Link>
                    )}
                    {!isCurrent && current && <MakeCurrentButton editionId={ed.id} number={v.number} name={v.name} current={{ number: current.number, name: current.name }} />}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
