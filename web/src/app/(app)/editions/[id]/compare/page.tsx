import Link from 'next/link';
import { notFound } from 'next/navigation';
import Icon from '@/components/Icon';
import { getEdition } from '@/lib/analysis';
import type { Block } from '@/lib/import/types';
import { getBook } from '@/lib/library';
import { getVersion, listVersionChapters } from '@/lib/runs';
import { requireAccount } from '@/lib/session';
import { readJson } from '@/lib/storage';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

const MAX_SHOWN = 150;
const safeInline = (html: string) => html.replace(/<(?!\/?(em|strong)>|br\s*\/?>)[^>]*>/gi, '');
const text = (b: Block | undefined) => (b && 'html' in b ? b.html : '');

/** Paragraph-by-paragraph differences between two versions: only chapters and paragraphs that changed. */
export default async function ComparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  const { userId } = await requireAccount();
  const [{ id }, { a, b }] = await Promise.all([params, searchParams]);
  const ed = await getEdition(userId, id);
  if (!ed || !a || !b) notFound();
  const [book, older, newer] = await Promise.all([getBook(userId, ed.bookId), getVersion(userId, ed.id, a), getVersion(userId, ed.id, b)]);
  if (!book || !older || !newer) notFound();

  const [olderChapters, newerChapters] = await Promise.all([listVersionChapters(userId, older.manifest), listVersionChapters(userId, newer.manifest)]);
  const oldBySection = new Map(olderChapters.map((c) => [c.sectionId, c]));
  const changedChapters = newerChapters.filter((c) => c.sectionId && oldBySection.get(c.sectionId)?.id !== c.id);

  let shown = 0;
  let total = 0;
  const sections = [];
  for (const c of changedChapters) {
    const o = oldBySection.get(c.sectionId!);
    const [ob, nb] = await Promise.all([o ? readJson<{ blocks: Block[] }>(o.textPath) : null, readJson<{ blocks: Block[] }>(c.textPath)]);
    const pairs = nb.blocks
      .map((blk, i) => ({ i, before: text(ob?.blocks[i]), after: text(blk) }))
      .filter((p) => p.before !== p.after);
    total += pairs.length;
    const room = Math.max(0, MAX_SHOWN - shown);
    shown += Math.min(room, pairs.length);
    sections.push({ id: c.id, number: newer.manifest.findIndex((m) => m.chapterId === c.id) + 1, title: c.kidTitle ?? c.title, pairs: pairs.slice(0, room), more: Math.max(0, pairs.length - room) });
  }

  return (
    <main className="page page-narrow">
      <Link href={`/editions/${ed.id}/history`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> Version history</Link>
      <div className="stack-lg" style={{ marginTop: 8 }}>
        <div className="stack-sm">
          <h1>v{older.number} → v{newer.number}</h1>
          <p className="muted">{book.title} · {ed.name} · {changedChapters.length} chapter{changedChapters.length === 1 ? '' : 's'}, {total} paragraph{total === 1 ? '' : 's'} changed</p>
        </div>
        {newer.guidance && <blockquote className="guidance-quote"><span className="tiny faint">YOU ASKED</span>{newer.guidance}</blockquote>}
        {sections.length === 0 && <div className="card"><p className="muted">These two versions read exactly the same.</p></div>}
        {sections.map((s) => (
          <section key={s.id} className="card stack">
            <h3>Chapter {s.number}: {s.title}</h3>
            {s.pairs.map((p) => (
              <div key={p.i} className="diff-pair">
                <p className="diff-old"><span className="tiny">BEFORE</span><span dangerouslySetInnerHTML={{ __html: safeInline(p.before) || '<em>(nothing)</em>' }} /></p>
                <p className="diff-new"><span className="tiny">AFTER</span><span dangerouslySetInnerHTML={{ __html: safeInline(p.after) }} /></p>
              </div>
            ))}
            {s.more > 0 && <p className="small faint">…and {s.more} more changed paragraphs in this chapter.</p>}
          </section>
        ))}
      </div>
    </main>
  );
}
