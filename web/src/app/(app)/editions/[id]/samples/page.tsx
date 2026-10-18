import { notFound } from 'next/navigation';
import { getModelChoices } from '@/lib/ai';
import { getEdition } from '@/lib/analysis';
import { editionSettingsSchema } from '@/lib/editions';
import { defaultCap, estimateEdition } from '@/lib/estimate';
import type { Block } from '@/lib/import/types';
import { getBook, listSections } from '@/lib/library';
import { getRun, latestRun, listRunChapters, listSheets } from '@/lib/runs';
import { requireAccount } from '@/lib/session';
import { readJson } from '@/lib/storage';
import { clearNotice } from '../../../books/edition-actions';
import SampleReview, { SamplesWriting } from './SampleReview';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export default async function SamplesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const { userId } = await requireAccount();
  const [{ id }, { run: runParam }] = await Promise.all([params, searchParams]);
  const ed = await getEdition(userId, id);
  if (!ed) notFound();
  const book = await getBook(userId, ed.bookId);
  if (!book) notFound();
  const run = runParam ? await getRun(userId, runParam) : await latestRun(userId, ed.id, 'samples');
  if (!run || run.editionId !== ed.id || run.kind !== 'samples') notFound();
  if (ed.notice === 'samples-ready') await clearNotice(ed.id);

  const sections = (await listSections(userId, book.id)).filter((s) => s.include);
  const numberOf = new Map(sections.map((s, i) => [s.id, i + 1]));
  const sampleSections = run.sectionIds.map((sid) => sections.find((s) => s.id === sid)).filter((s) => s !== undefined);

  if (run.status === 'running' || run.status === 'failed') {
    return (
      <SamplesWriting
        bookId={book.id}
        bookTitle={book.title}
        editionName={ed.name}
        round={run.round}
        runId={run.id}
        chapters={sampleSections.map((s) => `chapter ${numberOf.get(s.id)}`)}
        done={run.chaptersDone}
        pictures={editionSettingsSchema.parse(ed.settings).picture.on}
        error={run.status === 'failed' ? run.error ?? 'Something went wrong.' : null}
      />
    );
  }

  const written = await listRunChapters(userId, run.id);
  const samples = await Promise.all(
    sampleSections.map(async (s) => {
      const adapted = written.find((w) => w.sectionId === s.id);
      const [orig, soft] = await Promise.all([
        readJson<{ blocks: Block[] }>(s.textPath),
        adapted ? readJson<{ blocks: Block[] }>(adapted.textPath) : null,
      ]);
      return {
        sectionId: s.id,
        number: numberOf.get(s.id) ?? 0,
        title: s.title,
        kidTitle: adapted?.kidTitle ?? null,
        recap: adapted?.recap ?? null,
        original: orig.blocks,
        softened: soft?.blocks ?? [],
        changeNotes: adapted?.changeNotes ?? [],
        words: adapted?.words ?? 0,
        originalWords: adapted?.originalWords ?? s.words,
      };
    }),
  );

  const settings = editionSettingsSchema.parse(ed.settings);
  const sheets = settings.picture.on ? await listSheets(userId, ed.id) : [];
  const est = estimateEdition({ words: book.words, chapters: sections.length }, settings, await getModelChoices(userId));
  const firstNumber = numberOf.get(sections[0]?.id ?? '') ?? 1;

  return (
    <SampleReview
      key={run.id}
      bookId={book.id}
      bookTitle={book.title}
      edition={{ id: ed.id, name: ed.name, status: ed.status, cap: Number(ed.costCap), guidance: ed.sampleGuidance }}
      run={{ id: run.id, round: run.round, spent: Number(run.spentUsd), comments: run.comments, overall: run.overall }}
      samples={samples.map((x) => ({ ...x, why: x.number === firstNumber ? 'Voice check' : 'Hardest chapter' }))}
      chapters={sections.map((s, i) => ({ id: s.id, label: `${i + 1}. ${s.title}` }))}
      estimate={{ total: est.total, minutes: est.minutes, samples: est.samples, cap: Math.max(Number(ed.costCap), defaultCap(est.total)) }}
      pictures={settings.picture.on ? {
        look: ed.art?.look ?? null,
        error: ed.art?.error ?? null,
        sheets: sheets.map((x) => ({ id: x.id, name: x.name, description: x.description, status: x.status, imageId: x.imageId, model: x.model, error: x.error })),
      } : null}
    />
  );
}
