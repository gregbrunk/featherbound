import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import BookCover from '@/components/BookCover';
import ContentHeatmap, { ChapterNotes, type HeatChapter } from '@/components/ContentHeatmap';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import { Guide } from '@/components/ui';
import type { CoverSpec, StoryBible } from '@/db/schema';
import { NoKeyError, getModelChoices, getTextModel } from '@/lib/ai';
import { getLatestAnalysis, getReadyAnalysis, getStoryBible, listEditions, listSectionAnalyses, type AnalysisRow, type EditionRow } from '@/lib/analysis';
import { CATEGORIES, LEVEL_LABEL, bandFor, editionSettingsSchema, gradeLevelFor } from '@/lib/editions';
import { densityLabel, estimateAnalysis, fmtMinutes, money, type BookSize } from '@/lib/estimate';
import { bookTarget, getBook, getProgress, getSeries, listSections, listSeries, type BookRow, type SectionRow } from '@/lib/library';
import { textModel } from '@/lib/models';
import { listVersions, type VersionRow } from '@/lib/runs';
import { requireAccount } from '@/lib/session';
import { DeleteBookButton, EditDetailsButton, ReimportButton } from './BookActions';
import { AnalysisProgress, DeleteEditionButton, MakeSamplesButton, StartAnalysisButton } from './EditionParts';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

const FALLBACK: CoverSpec = { from: '#4b2e83', to: '#2e1b55', emblem: 'feather', ink: '#F6E3AE' };
const TABS = ['editions', 'inside', 'bible', 'details'] as const;
type Tab = (typeof TABS)[number];

export default async function BookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { userId } = await requireAccount();
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'editions';
  const book = await getBook(userId, id);
  if (!book) notFound();
  if (book.status !== 'ready') redirect(`/books/${book.id}/review`);

  const [series, allSeries, sections, progress, latest, ready, bible, eds, choices] = await Promise.all([
    book.seriesId ? getSeries(userId, book.seriesId) : null,
    listSeries(userId),
    listSections(userId, book.id),
    getProgress(userId, bookTarget(book.id)),
    getLatestAnalysis(userId, book.id),
    getReadyAnalysis(userId, book.id),
    getStoryBible(userId, book.id),
    listEditions(userId, book.id),
    getModelChoices(userId),
  ]);
  const versions = (await Promise.all(eds.filter((e) => e.currentVersion).map((e) => listVersions(userId, e.id)))).flat();
  const chapters = sections.filter((s) => s.include);
  const size: BookSize = { words: book.words, chapters: chapters.length };
  const coverUrl = book.coverPath ? `/api/books/${book.id}/cover?v=${encodeURIComponent(book.coverPath.split('/').pop() ?? '')}` : undefined;

  // The heat map uses the newest finished analysis. Chapters re-imported since then have no
  // rows any more, so the report counts as out of date and offers to read the book again.
  const rows = ready ? await listSectionAnalyses(userId, ready.id) : [];
  const byId = new Map(rows.map((r) => [r.sectionId, r]));
  const heat: HeatChapter[] = chapters.flatMap((c, i) => {
    const r = byId.get(c.id);
    return r ? [{ number: i + 1, title: c.title, intensities: r.intensities, notes: r.notes }] : [];
  });
  const summaries = chapters.flatMap((c) => byId.get(c.id)?.summary ?? []);
  const complete = ready !== null && heat.length === chapters.length;
  const running = latest?.status === 'running' ? latest : null;
  const failed = latest?.status === 'failed' ? latest : null;

  let hasKey = true;
  try { await getTextModel(userId); } catch (e) { if (e instanceof NoKeyError) hasKey = false; else throw e; }
  const est = estimateAnalysis(size, choices.text);
  const startProps = { bookId: book.id, title: book.title, cost: money(est.cost), minutes: fmtMinutes(est.minutes), model: textModel(choices.text).name, hasKey };

  const analysisCard = running ? <AnalysisProgress done={running.chaptersDone} total={running.chaptersTotal || chapters.length} /> : !complete ? (
    <div className="card card-tinted row" style={{ gap: 20, flexWrap: 'wrap' }}>
      <Tuft pose={failed ? 'worry' : 'think'} size={90} />
      <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
        <h3>{failed ? 'I couldn’t finish reading this one' : ready ? 'The chapters changed since I read this' : 'First, I’ll read it through'}</h3>
        <p className="muted">
          {failed
            ? `Something went wrong partway: ${failed.error ?? 'unknown error'}. You can try again; you’re only billed for chapters read.`
            : `I’ll note what’s in each chapter and write a Story Bible, so you can see what’s inside before choosing settings. About ${money(est.cost)} and ${fmtMinutes(est.minutes)}.`}
        </p>
      </div>
      <StartAnalysisButton {...startProps} />
    </div>
  ) : null;

  return (
    <main className="page">
      <Link href={series ? `/series/${series.id}` : '/'} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}>
        <Icon name="left" size={16} /> {series ? series.name : 'Library'}
      </Link>

      <section className="book-hero">
        <div className="book-hero-cover">
          <BookCover cover={book.coverFallback ?? FALLBACK} image={coverUrl} title={book.title} author={book.author} size="lg" />
        </div>
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="row-wrap">
            {series && <Link href={`/series/${series.id}`} className="chip chip-gold" style={{ textDecoration: 'none' }}>{series.name}{book.seriesLabel ? ` · ${book.seriesLabel}` : ''}</Link>}
            {book.genres.map((g) => <span key={g} className="chip chip-plain">{g}</span>)}
          </div>
          <h1>{book.title}</h1>
          <p className="muted" style={{ fontWeight: 700 }}>{book.author}</p>
          {book.description && <p style={{ maxWidth: 640 }} className="clamp-6">{book.description}</p>}
          <p className="small faint">
            {book.words.toLocaleString()} words · {chapters.length} chapters · {book.format} · added {fmtDay(book.addedAt)}
          </p>
          {progress && (
            <div className="row" style={{ maxWidth: 360 }}>
              <div className="progress-bar gold" style={{ flex: 1 }}><i style={{ width: `${progress.percent}%` }} /></div>
              <span className="tiny muted">{Math.round(progress.percent)}% read</span>
            </div>
          )}
          <div className="row-wrap" style={{ marginTop: 6 }}>
            <Link href={`/books/${book.id}/new`} className="btn btn-primary"><Icon name="wand" size={18} /> New softened edition</Link>
            <Link href={`/read/book/${book.id}`} className="btn btn-secondary"><Icon name="book" size={18} /> {progress ? 'Keep reading' : 'Read original'}</Link>
            <a href={`/api/books/${book.id}/original`} className="btn btn-ghost"><Icon name="download" size={18} /> Download original</a>
          </div>
        </div>
      </section>

      <nav className="tabs" aria-label="Book sections" style={{ marginTop: 28 }}>
        {([['editions', `Editions (${eds.length})`], ['inside', 'What’s inside'], ['bible', 'Story Bible'], ['details', 'Details']] as const).map(([k, l]) => (
          <Link key={k} href={`/books/${book.id}${k === 'editions' ? '' : `?tab=${k}`}`} scroll={false} aria-current={tab === k ? 'page' : undefined} className={tab === k ? 'on' : ''}>{l}</Link>
        ))}
      </nav>

      <div className="stack-lg" style={{ marginTop: 20 }}>
        {tab === 'editions' && (
          <>
            {analysisCard}
            {eds.length === 0 && complete && (
              <div className="card card-tinted row" style={{ gap: 20, flexWrap: 'wrap' }}>
                <Tuft pose="hello" size={90} />
                <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
                  <h3>No softened editions yet</h3>
                  <p className="muted">I’ve read it through and made a content report. Want to make the first edition?</p>
                </div>
                <Link href={`/books/${book.id}/new`} className="btn btn-primary"><Icon name="wand" size={18} /> Start the wizard</Link>
              </div>
            )}
            {eds.map((e) => <EditionCard key={e.id} edition={e} book={book} size={size} coverUrl={coverUrl} canSample={complete && Boolean(bible)}
              version={versions.find((v) => v.editionId === e.id && v.number === e.currentVersion)} />)}
          </>
        )}

        {tab === 'inside' && (
          <>
            {analysisCard}
            {heat.length > 0 && (
              <div className="card stack">
                <Guide pose="read" size={60}>
                  Here’s what I found while reading <em>{book.title}</em>, chapter by chapter. Darker squares mean stronger content. Hover a square for a note.
                </Guide>
                <ContentHeatmap chapters={heat} />
              </div>
            )}
            {heat.length > 0 && (
              <div className="card stack-sm">
                <h3>Chapter by chapter</h3>
                <ChapterNotes chapters={heat} summaries={summaries} />
              </div>
            )}
            {ready && complete && <AnalysisFooter analysis={ready} start={<StartAnalysisButton {...startProps} again />} />}
          </>
        )}

        {tab === 'bible' && (bible ? <StoryBibleView bible={bible.data} /> : analysisCard ?? null)}

        {tab === 'details' && <Details book={book} chapters={chapters} series={series?.name ?? null} allSeries={allSeries} />}
      </div>
    </main>
  );
}

const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function AnalysisFooter({ analysis, start }: { analysis: AnalysisRow; start: React.ReactNode }) {
  return (
    <div className="row-wrap small faint">
      <span>Read on {fmtDay(analysis.finishedAt ?? analysis.startedAt)} with {textModel(analysis.model).name} · cost {money(Number(analysis.costUsd))}</span>
      <span className="spacer" />
      {start}
    </div>
  );
}

const STATUS_LABEL: Record<EditionRow['status'], string> = {
  draft: 'Draft · settings saved',
  'making-samples': 'Writing samples…',
  'samples-ready': 'Samples ready for review',
  running: 'Writing the whole book…',
  'paused-cap': 'Paused at the cost cap',
  ready: 'Ready',
  failed: 'Something went wrong',
};

function EditionCard({ edition: e, book, size, coverUrl, version, canSample }: { edition: EditionRow; book: BookRow; size: BookSize; coverUrl?: string; version?: VersionRow; canSample: boolean }) {
  const parsed = editionSettingsSchema.safeParse(e.settings);
  if (!parsed.success) return null;
  const s = parsed.data;
  return (
    <article className="card edition-card">
      <header className="edition-head">
        <BookCover cover={book.coverFallback ?? FALLBACK} image={coverUrl} title={book.title} author={book.author} size="sm" ribbon={`${s.targetAge}`} className="edition-cover" />
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <h3>{e.name}</h3>
          <div className="row-wrap">
            {version && <span className="badge-version">v{version.number}</span>}
            {version && <span className="small" style={{ fontWeight: 800, color: 'var(--plum)' }}>“{version.name}”</span>}
            {e.status !== 'ready' && <span className={`chip ${e.status === 'draft' ? 'chip-plain' : e.status === 'failed' || e.status === 'paused-cap' ? 'chip-ruby' : 'chip-gold'}`}>{STATUS_LABEL[e.status]}</span>}
            {e.estimate && <span className="small muted">About {money(e.estimate.total)} · cap {money(Number(e.costCap))}</span>}
            <span className="small faint">Made {fmtDay(e.createdAt)}</span>
          </div>
        </div>
        <div className="edition-primary">
          {e.status === 'draft' && <MakeSamplesButton editionId={e.id} cost={money(e.estimate?.samples ?? 0.5)} disabled={!canSample} />}
          {(e.status === 'making-samples' || e.status === 'samples-ready') && (
            <Link href={`/editions/${e.id}/samples`} className={`btn ${e.status === 'samples-ready' ? 'btn-gold' : 'btn-secondary'}`}>
              <Icon name={e.status === 'samples-ready' ? 'eye' : 'clock'} size={18} /> {e.status === 'samples-ready' ? 'Review samples' : 'Writing samples…'}
            </Link>
          )}
          {(e.status === 'running' || e.status === 'paused-cap' || e.status === 'failed') && (
            <Link href={`/editions/${e.id}/progress`} className="btn btn-secondary"><Icon name="clock" size={18} /> {e.status === 'failed' ? 'See what happened' : 'See progress'}</Link>
          )}
          {e.status === 'ready' && <Link href={`/read/edition/${e.id}`} className="btn btn-primary"><Icon name="book" size={18} /> Read</Link>}
        </div>
      </header>

      <div className="settings-grid">
        <Setting label="Made for" value={`Age ${s.targetAge}`} sub={bandFor(s.targetAge).name} />
        <Setting label="Reading mode" value={s.readingMode === 'read-aloud' ? 'Read aloud' : 'Independent reader'} sub={`${gradeLevelFor(s.targetAge, s.readingMode, s.readingLevelShift)} language`} />
        <Setting label="Faithfulness" value={s.faithfulness < 34 ? 'Close to the author' : s.faithfulness < 67 ? 'Balanced' : 'Free retelling'} sub={`${100 - s.faithfulness}% author’s words`} />
        <Setting label="Pictures" value={s.picture.on ? densityLabel(size, s.picture.density) : 'Text only'} sub={s.picture.on ? `${s.picture.style}${s.picture.look ? ` · ${s.picture.look}` : ''}` : undefined} />
      </div>

      <div className="stack-sm">
        <span className="label">Content filters</span>
        <div className="row-wrap">
          {CATEGORIES.map((c) => {
            const lvl = s.filters[c.id];
            return (
              <span key={c.id} className={`chip ${lvl === 'keep' ? 'chip-emerald' : lvl === 'soften' ? 'chip-gold' : 'chip-ruby'}`} title={c.examples}>
                {c.name}: {LEVEL_LABEL[lvl]}
              </span>
            );
          })}
        </div>
      </div>

      {s.notes && (
        <div className="note-box">
          <span className="label">Your notes for the AI</span>
          <p>“{s.notes}”</p>
        </div>
      )}

      <footer className="edition-actions">
        {e.status === 'draft' && (
          <Link href={`/books/${book.id}/new?edit=${e.id}`} className="btn btn-secondary btn-sm"><Icon name="sliders" size={16} /> Change settings</Link>
        )}
        <Link href={`/books/${book.id}/new?from=${e.id}`} className="btn btn-secondary btn-sm"><Icon name="copy" size={16} /> New edition from these settings</Link>
        <span className="spacer" />
        <DeleteEditionButton bookId={book.id} editionId={e.id} name={e.name} />
      </footer>
    </article>
  );
}

function Setting({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="setting">
      <span className="tiny faint" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <strong>{value}</strong>
      {sub && <span className="small muted">{sub}</span>}
    </div>
  );
}

function StoryBibleView({ bible }: { bible: StoryBible }) {
  return (
    <div className="stack">
      <Guide pose="write" size={60}>This is my notebook for this book. I check it while writing every chapter so names, looks and plot threads stay steady.</Guide>
      <h3>Characters</h3>
      <div className="grid-3">
        {bible.characters.map((c) => (
          <div key={c.name} className="card stack-sm">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <strong>{c.name}</strong>
              <span className="chip chip-plain">{c.role}</span>
            </div>
            {c.look && <p className="small"><span className="faint">Looks: </span>{c.look}</p>}
            <p className="small muted">{c.note}</p>
          </div>
        ))}
      </div>
      <div className="grid-3">
        <div className="card stack-sm">
          <h3>Places</h3>
          <ul className="small bible-place-list">{bible.places.map((p) => <li key={p.name}><strong>{p.name}</strong>{p.look ? `: ${p.look}` : ''}</li>)}</ul>
        </div>
        <div className="card stack-sm"><h3>Plot threads</h3><ul className="small bible-place-list">{bible.threads.map((p) => <li key={p}>{p}</li>)}</ul></div>
        <div className="card stack-sm"><h3>Key themes</h3><ul className="small bible-place-list">{bible.themes.map((p) => <li key={p}>{p}</li>)}</ul></div>
      </div>
      {bible.keyScenes.length > 0 && (
        <div className="card stack-sm">
          <h3>Key scenes</h3>
          <ul className="small bible-place-list">{bible.keyScenes.map((k) => <li key={`${k.chapter}-${k.scene}`}><span className="faint">Ch. {k.chapter}: </span>{k.scene}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function Details({ book, chapters, series, allSeries }: { book: BookRow; chapters: SectionRow[]; series: string | null; allSeries: { id: string; name: string }[] }) {
  const rows: [string, string][] = [
    ['Title', book.title], ['Author', book.author || '—'], ['Series', series ? `${series}${book.seriesLabel ? ` (${book.seriesLabel})` : ''}` : 'Standalone'],
    ['Genres', book.genres.join(', ') || '—'], ['Tags', book.tags.join(', ') || '—'],
    ['File', `${book.fileName} · ${book.format}, ${chapters.length} chapters, ${book.words.toLocaleString()} words`],
    ['Added', fmtDay(book.addedAt)],
  ];
  return (
    <>
      <div className="card stack">
        <dl className="details">
          {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
        <div className="row-wrap">
          <EditDetailsButton
            bookId={book.id}
            series={allSeries.map((s) => ({ id: s.id, name: s.name }))}
            initial={{
              title: book.title, author: book.author, description: book.description ?? '', genres: book.genres, tags: book.tags,
              seriesId: book.seriesId, seriesPosition: book.seriesOrder !== null ? String(book.seriesOrder) : '',
            }}
          />
          <span className="spacer" />
          <DeleteBookButton bookId={book.id} title={book.title} />
        </div>
      </div>
      <div className="card stack">
        <h3>Chapters</h3>
        <ol className="toc-list">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <Link href={`/read/book/${book.id}?section=${c.id}`}><span className="mono faint">{i + 1}</span> {c.title}</Link>
            </li>
          ))}
        </ol>
        <div className="row-wrap" style={{ marginTop: 8 }}>
          <ReimportButton bookId={book.id} />
        </div>
      </div>
    </>
  );
}
