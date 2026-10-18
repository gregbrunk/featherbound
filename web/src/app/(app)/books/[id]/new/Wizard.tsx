'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import BookCover from '@/components/BookCover';
import ContentHeatmap, { summarize, type HeatChapter } from '@/components/ContentHeatmap';
import Icon from '@/components/Icon';
import Tuft, { type TuftPose } from '@/components/Tuft';
import { Guide, Segmented, Switch } from '@/components/ui';
import type { CoverSpec } from '@/db/schema';
import {
  AGE_BANDS, ART_STYLES, CATEGORIES, LEVEL_LABEL, bandFor, defaultFilters, defaultSettings, editionName, gradeLevelFor,
  type EditionSettings, type FilterLevel,
} from '@/lib/editions';
import { defaultCap, densityLabel, densityTiers, estimateEdition, fmtMinutes, money, type BookSize, type ModelChoice } from '@/lib/estimate';
import { imageModel, textModel } from '@/lib/models';
import { saveDraftEdition } from '../../edition-actions';

const STEPS = [
  { key: 'who', title: 'Who’s it for?', pose: 'hello' as TuftPose },
  { key: 'inside', title: 'What’s inside', pose: 'read' as TuftPose },
  { key: 'filters', title: 'Content filters', pose: 'think' as TuftPose },
  { key: 'style', title: 'Story & style', pose: 'write' as TuftPose },
  { key: 'pictures', title: 'Pictures', pose: 'cheer' as TuftPose },
  { key: 'notes', title: 'Anything else?', pose: 'think' as TuftPose },
  { key: 'review', title: 'Review & save', pose: 'cheer' as TuftPose },
];

export type WizardBook = BookSize & { id: string; title: string; cover: CoverSpec; coverUrl?: string };

export default function Wizard({ book, heat, analysed, seriesName, models, start, editingId }: {
  book: WizardBook;
  heat: HeatChapter[];
  analysed: boolean;
  seriesName?: string;
  models: ModelChoice;
  start: { settings: EditionSettings; name: string; cap: number } | null;
  editingId?: string;
}) {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<EditionSettings>(() => (start ? structuredClone(start.settings) : defaultSettings(7, 'read-aloud')));
  const [cap, setCap] = useState<number | null>(editingId && start ? start.cap : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSave] = useTransition();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  const est = estimateEdition(book, s, models);
  const capValue = cap ?? defaultCap(est.total);
  const set = (patch: Partial<EditionSettings>) => setS((prev) => ({ ...prev, ...patch }));
  const cur = STEPS[step];

  const save = () => {
    setError(null);
    startSave(async () => {
      try {
        await saveDraftEdition(book.id, { settings: s, costCap: capValue, editionId: editingId });
      } catch (e) {
        // redirect() throws to navigate; anything else is a real error.
        if (e instanceof Error && !/NEXT_REDIRECT/.test(e.message) && !('digest' in e && String(e.digest).startsWith('NEXT_REDIRECT'))) {
          setError(e.message || 'Couldn’t save. Try again?');
        } else throw e;
      }
    });
  };

  return (
    <main className="page wizard">
      <div className="wizard-top">
        <Link href={`/books/${book.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="x" size={16} /> Cancel</Link>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <div style={{ width: 34, flex: 'none' }}><BookCover cover={book.cover} image={book.coverUrl} title="" author="" size="sm" /></div>
          <div style={{ minWidth: 0 }}>
            <div className="tiny faint" style={{ fontWeight: 800 }}>{editingId ? 'CHANGE EDITION SETTINGS' : 'NEW SOFTENED EDITION'}</div>
            <div style={{ fontWeight: 800 }} className="ellipsis">{book.title}</div>
          </div>
        </div>
      </div>

      <div className="wizard-grid">
        <nav className="stepper" aria-label="Wizard steps">
          {STEPS.map((st, i) => (
            <button key={st.key} className={`step ${i === step ? 'now' : i < step ? 'done' : ''}`} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
              <span className="step-num">{i < step ? <Icon name="check" size={14} stroke={3} /> : i + 1}</span>
              <span className="step-title">{st.title}</span>
            </button>
          ))}
          {start && (
            <div className="card card-tinted small" style={{ marginTop: 16, padding: 14 }}>
              <strong>{editingId ? 'Changing' : 'Starting from'}</strong>
              <div className="muted">{start.name}</div>
            </div>
          )}
        </nav>

        <section className="wizard-main">
          <div className="wizard-guide">
            <Guide pose={cur.pose} size={68}>
              <StepGuide step={cur.key} title={book.title} s={s} fromName={start && !editingId ? start.name : undefined} seriesName={seriesName} analysed={analysed} />
            </Guide>
          </div>

          <div className="card card-lg wizard-card">
            <h2 style={{ marginBottom: 18 }}>{cur.title}</h2>

            {cur.key === 'who' && (
              <div className="stack-lg">
                <div className="field">
                  <label className="label" htmlFor="age">Target age</label>
                  <div className="age-picker">
                    <div className="age-big"><span>{s.targetAge}</span><small>years old</small></div>
                    <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                      <input id="age" className="range" type="range" min={3} max={17} value={s.targetAge}
                        onChange={(e) => {
                          const age = Number(e.target.value);
                          set({ targetAge: age, filters: defaultFilters(age) });
                        }} />
                      <div className="row tiny faint" style={{ justifyContent: 'space-between' }}><span>3</span><span>10</span><span>17</span></div>
                    </div>
                  </div>
                  <div className="band-strip">
                    {AGE_BANDS.map((b) => (
                      <span key={b.name} className={`band ${bandFor(s.targetAge).name === b.name ? 'on' : ''}`}>{b.name}</span>
                    ))}
                  </div>
                  <p className="hint">Publishing calls age {s.targetAge} <strong>{bandFor(s.targetAge).name.toLowerCase()}</strong>: {bandFor(s.targetAge).feel.toLowerCase()}. It’s just a guide; I write for the exact age.</p>
                </div>
                <div className="field">
                  <span className="label">How will it be read?</span>
                  <div className="grid-2">
                    <ModeCard on={s.readingMode === 'read-aloud'} onClick={() => set({ readingMode: 'read-aloud' })} title="Read aloud" icon="🛋️"
                      desc="A grown-up reads it to them. I can keep richer words and longer sentences, because you’re there to help." />
                    <ModeCard on={s.readingMode === 'independent'} onClick={() => set({ readingMode: 'independent' })} title="Independent reader" icon="🔦"
                      desc="They read it alone. I simplify vocabulary and sentences so they can read it themselves." />
                  </div>
                  <p className="hint">Language will be written at about <strong>{gradeLevelFor(s.targetAge, s.readingMode, s.readingLevelShift)}</strong> level.</p>
                </div>
              </div>
            )}

            {cur.key === 'inside' && <InsideStep heat={heat} analysed={analysed} bookId={book.id} />}

            {cur.key === 'filters' && (
              <div className="stack">
                <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
                  <p className="small muted" style={{ flex: '1 1 300px' }}>
                    <strong style={{ color: 'var(--emerald)' }}>Keep</strong> leaves it as written. <strong style={{ color: 'var(--gold-deep)' }}>Soften</strong> keeps it but makes it gentler.{' '}
                    <strong style={{ color: 'var(--ruby)' }}>Remove</strong> moves it off-page. The story still happens; it just isn’t shown.
                  </p>
                  <button className="btn btn-ghost btn-sm" onClick={() => set({ filters: defaultFilters(s.targetAge) })}><Icon name="refresh" size={16} /> Reset to age {s.targetAge} defaults</button>
                </div>
                <FilterRows heat={heat} analysed={analysed} s={s} onChange={(c, v) => set({ filters: { ...s.filters, [c]: v } })} />
              </div>
            )}

            {cur.key === 'style' && (
              <div className="stack-lg">
                <div className="field">
                  <label className="label" htmlFor="faith">Faithfulness</label>
                  <input id="faith" className="range" type="range" min={0} max={100} step={5} value={s.faithfulness} onChange={(e) => set({ faithfulness: Number(e.target.value) })} />
                  <div className="row small muted" style={{ justifyContent: 'space-between' }}>
                    <span>📜 Stay close to the author’s words</span><span>🪄 Retell freely in kid-friendly language</span>
                  </div>
                  <FaithExample value={s.faithfulness} />
                </div>
                <div className="field">
                  <span className="label">Reading level</span>
                  <div className="row-wrap">
                    <Segmented
                      label="Reading level"
                      value={String(s.readingLevelShift)}
                      onChange={(v) => set({ readingLevelShift: Number(v) })}
                      options={[{ value: '-1', label: 'A bit simpler' }, { value: '0', label: `Just right (${gradeLevelFor(s.targetAge, s.readingMode)})` }, { value: '1', label: 'A bit richer' }]}
                    />
                  </div>
                  <span className="hint">Based on age {s.targetAge}, {s.readingMode === 'read-aloud' ? 'read aloud' : 'reading alone'}.</span>
                </div>
                <ToggleRow title="Keep original names and invented words" desc="Names and made-up words stay as the author wrote them. Turn off only if they’re too hard to say." checked={s.keepNames} onChange={(v) => set({ keepNames: v })} />
                <div className="stack-sm">
                  <span className="label">Little extras</span>
                  <ToggleRow title="Kid-friendly chapter titles" desc="“Whoosh! Up Goes the House” instead of “The Cyclone”. The original title stays underneath." checked={s.extras.kidTitles} onChange={(v) => set({ extras: { ...s.extras, kidTitles: v } })} />
                  <ToggleRow title="“The story so far…” recaps" desc="Two or three sentences from Tuft at the start of each chapter. Great for bedtime reading across many nights." checked={s.extras.recaps} onChange={(v) => set({ extras: { ...s.extras, recaps: v } })} />
                  <ToggleRow title="Who’s who glossary" desc="A friendly list of characters and places at the back of the book." checked={s.extras.glossary} onChange={(v) => set({ extras: { ...s.extras, glossary: v } })} badge="Soon" />
                </div>
              </div>
            )}

            {cur.key === 'pictures' && <PicturesStep book={book} s={s} set={set} seriesName={seriesName} models={models} />}

            {cur.key === 'notes' && (
              <div className="stack">
                <div className="field">
                  <label className="label" htmlFor="notes">Notes for the AI</label>
                  <textarea id="notes" className="textarea" rows={7} maxLength={4000} value={s.notes} onChange={(e) => set({ notes: e.target.value })}
                    placeholder="Anything I should know? Fears to avoid, favorite scenes to protect, characters to keep funny…" />
                </div>
                <div className="stack-sm">
                  <span className="small muted" style={{ fontWeight: 700 }}>Ideas (tap to add)</span>
                  <div className="row-wrap">
                    {[
                      'She’s scared of spiders. Tone those scenes down a lot.',
                      'Keep the humor; that’s our favorite part.',
                      'Don’t change the ending’s emotional weight, just soften it.',
                      'Keep the villain clearly a villain, just less frightening.',
                      'Avoid anything about parents dying or leaving.',
                      'He loves the battles. Keep them exciting, just not gory.',
                    ].map((t) => (
                      <button key={t} type="button" className="chip chip-outline" style={{ border: 'none', cursor: 'pointer' }} onClick={() => set({ notes: (s.notes ? s.notes.trim() + ' ' : '') + t })}>
                        <Icon name="plus" size={12} /> {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {cur.key === 'review' && (
              <div className="stack-lg">
                <div className="review-summary">
                  <SumItem k="Edition name" v={editionName(s)} onEdit={() => setStep(0)} />
                  <SumItem k="Reading level" v={`${gradeLevelFor(s.targetAge, s.readingMode, s.readingLevelShift)} · ${s.faithfulness < 34 ? 'close to the author' : s.faithfulness < 67 ? 'balanced' : 'free retelling'}`} onEdit={() => setStep(3)} />
                  <SumItem k="Filters" v={CATEGORIES.filter((c) => s.filters[c.id] !== 'keep').map((c) => `${c.name}: ${LEVEL_LABEL[s.filters[c.id]].toLowerCase()}`).join(' · ') || 'Everything kept'} onEdit={() => setStep(2)} />
                  <SumItem k="Pictures" v={s.picture.on ? `${densityLabel(book, s.picture.density)} · ${s.picture.style}${s.picture.look ? ` · ${s.picture.look}` : ''}` : 'Text only'} onEdit={() => setStep(4)} />
                  <SumItem k="Notes" v={s.notes || 'None'} onEdit={() => setStep(5)} />
                </div>

                <div className="estimate">
                  <div className="row" style={{ alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                    <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
                      <h3>Estimate</h3>
                      <p className="small muted">For {book.words.toLocaleString()} words over {book.chapters} chapters, adapted chapter by chapter with the Story Bible.</p>
                    </div>
                    <div className="est-total">
                      <span className="tiny faint">FULL BOOK</span>
                      <strong>~{money(est.total)}</strong>
                      <span className="small muted">about {fmtMinutes(est.minutes)}</span>
                    </div>
                  </div>
                  <div className="est-lines">
                    <div><span>Sample chapters (first)</span><strong>~{money(est.samples)}</strong></div>
                    <div><span>Text · {textModel(models.text).name} · ~{(est.tokensIn / 1e6).toFixed(2)}M in / {(est.tokensOut / 1e6).toFixed(2)}M out tokens · ~{fmtMinutes(est.textMinutes)}</span><strong>~{money(est.text)}</strong></div>
                    {s.picture.on && <div><span>Pictures · {imageModel(models.images[0]).name} · research, 5 character sheets + ~{est.images} illustrations · ~{fmtMinutes(est.imageMinutes)}</span><strong>~{money(est.imageCost)}</strong></div>}
                    {s.picture.on && est.imageWorst > est.imageCost * 1.05 && <div className="faint"><span>If every picture fell back to the priciest backup model</span><span>up to ~{money(est.totalWorst)}</span></div>}
                  </div>
                  <div className="field" style={{ marginTop: 6 }}>
                    <label className="label" htmlFor="cap">Cost cap for the full run</label>
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      <div className="money-input"><span>$</span><input id="cap" type="number" min={1} step={1} value={capValue} onChange={(e) => setCap(Number(e.target.value))} /></div>
                      <span className="hint" style={{ flex: 1, minWidth: 200 }}>If a chapter would push past this, I’ll pause at the end of the chapter before it and check with you.</span>
                    </div>
                  </div>
                  <p className="tiny faint">Pictures are drawn while later chapters are written, so the times overlap. Prices come from your chosen models (<Link href="/settings?tab=models">Settings → AI models</Link>).</p>
                </div>

                <Guide pose="read" size={56}>
                  {analysed
                    ? <>When samples arrive, I’ll write <strong>chapter 1</strong> to check the voice, and <strong>chapter {hardestChapter(heat)}</strong>, the most intense one, as the hardest test.</>
                    : <>When samples arrive, I’ll write <strong>chapter 1</strong> to check the voice, plus the most intense chapter once I’ve read the book.</>}
                  {' '}For now I’ll save these settings as a draft; sample chapters come in the next update.
                </Guide>
                {error && <p className="small status-bad">{error}</p>}
              </div>
            )}
          </div>

          <div className="wizard-nav">
            <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}><Icon name="left" size={18} /> Back</button>
            <span className="spacer" />
            <span className="small faint hide-sm">Step {step + 1} of {STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next <Icon name="right" size={18} /></button>
            ) : (
              <button className="btn btn-gold" disabled={pending} onClick={save}>
                <Icon name="check" size={18} /> {pending ? 'Saving…' : editingId ? 'Save changes' : 'Save draft edition'}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/** The chapter with the most content across all categories: the hardest test for a sample. */
export function hardestChapter(heat: HeatChapter[]) {
  let best = heat[0]?.number ?? 1, bestScore = -1;
  for (const ch of heat) {
    const score = Object.values(ch.intensities).reduce<number>((n, v) => n + (v ?? 0), 0);
    if (score > bestScore) { best = ch.number; bestScore = score; }
  }
  return best;
}

function StepGuide({ step, title, s, fromName, seriesName, analysed }: { step: string; title: string; s: EditionSettings; fromName?: string; seriesName?: string; analysed: boolean }) {
  switch (step) {
    case 'who':
      return fromName
        ? <>I copied the settings from <strong>{fromName}</strong>. Change anything you like, maybe the age?</>
        : <>Let’s make a softer <em>{title}</em>! First, who’s the reader?</>;
    case 'inside':
      return analysed
        ? <>I read the whole book. Here’s what’s inside, so you can decide what to soften.</>
        : <>I haven’t read this one yet. You can still choose settings, but it helps to see what’s inside first.</>;
    case 'filters':
      return <>I’ve set these for a {s.targetAge}-year-old. Change any of them. Whatever you choose, the plot stays the same.</>;
    case 'style':
      return <>How close should I stay to the author’s words? Most families like “close”: it still feels like the real book.</>;
    case 'pictures':
      return seriesName
        ? <>Want pictures every few pages? If I’ve researched the <em>{seriesName}</em> look before, I’ll start from that.</>
        : <>Want pictures every few pages, like a real chapter book?</>;
    case 'notes':
      return <>Anything else I should know? Little details make a big difference.</>;
    default:
      return <>All set! Check everything over, then save. Nothing is written or billed yet.</>;
  }
}

function ModeCard({ on, onClick, title, desc, icon }: { on: boolean; onClick: () => void; title: string; desc: string; icon: string }) {
  return (
    <button type="button" className={`mode-card ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="mode-icon" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <span className="small muted">{desc}</span>
      {on && <span className="mode-check"><Icon name="check" size={14} stroke={3} /></span>}
    </button>
  );
}

function InsideStep({ heat, analysed, bookId }: { heat: HeatChapter[]; analysed: boolean; bookId: string }) {
  if (!analysed) {
    return (
      <div className="card card-tinted row" style={{ gap: 18, flexWrap: 'wrap' }}>
        <Tuft pose="think" size={80} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
          <h3>Not read yet</h3>
          <p className="muted">On the book’s page I can read it through first and show you a chapter-by-chapter content report. Your choices here will wait.</p>
        </div>
        <Link href={`/books/${bookId}?tab=inside`} className="btn btn-secondary"><Icon name="book" size={18} /> See what’s inside</Link>
      </div>
    );
  }
  const rows = summarize(heat).filter((r) => r.any);
  const strong = rows.filter((r) => r.peak >= 3);
  return (
    <div className="stack">
      <div className="inside-summary">
        {strong.length > 0 ? (
          <p><strong>Strongest content:</strong> {strong.map((r) => `${r.name.toLowerCase()} (ch. ${r.hot.slice(0, 3).join(', ')})`).join('; ')}.</p>
        ) : (
          <p><strong>Good news:</strong> nothing stronger than moderate in this one.</p>
        )}
      </div>
      <ContentHeatmap chapters={heat} />
    </div>
  );
}

function FilterRows({ heat, analysed, s, onChange }: { heat: HeatChapter[]; analysed: boolean; s: EditionSettings; onChange: (c: keyof EditionSettings['filters'], v: FilterLevel) => void }) {
  const rows = useMemo(() => summarize(heat), [heat]);
  const defaults = defaultFilters(s.targetAge);
  return (
    <div className="filter-rows">
      {rows.map((r) => (
        <div key={r.id} className={`filter-row ${r.any || !analysed ? '' : 'quiet'}`}>
          <div className="filter-info">
            <span className="filter-icon" aria-hidden="true">{r.icon}</span>
            <div style={{ minWidth: 0 }}>
              <strong>{r.name}</strong>
              <div className="small muted">{r.examples}</div>
              {analysed && (
                <div className="tiny" style={{ marginTop: 2, fontWeight: 700, color: r.peak >= 3 ? 'var(--ruby)' : r.any ? 'var(--gold-deep)' : 'var(--ink-faint)' }}>
                  {r.any ? `In this book: ${['', 'mild', 'moderate', 'strong'][r.peak]}, ${r.any} chapter${r.any > 1 ? 's' : ''}` : 'Not found in this book'}
                </div>
              )}
            </div>
          </div>
          <div className="filter-control">
            <Segmented<FilterLevel>
              label={r.name}
              value={s.filters[r.id]}
              onChange={(v) => onChange(r.id, v)}
              classFor={(v) => v}
              options={(['keep', 'soften', 'remove'] as FilterLevel[]).map((v) => ({
                value: v,
                label: <>{LEVEL_LABEL[v]}{defaults[r.id] === v && <span className="default-dot" title={`Default for age ${s.targetAge}`} />}</>,
              }))}
            />
          </div>
        </div>
      ))}
      <p className="tiny faint"><span className="default-dot" /> = default for age {s.targetAge}</p>
    </div>
  );
}

function FaithExample({ value }: { value: number }) {
  const text =
    value < 34
      ? '“The house whirled around two or three times and rose slowly through the air. Dorothy felt as if she were going up in a balloon.”'
      : value < 67
      ? '“The house spun around two or three times and rose slowly up into the air. Dorothy felt as if she were going up in a balloon!”'
      : '“Round and round went the little house, and then — whoosh! — up it floated, just like a big balloon, with Dorothy inside!”';
  return (
    <div className="faith-example">
      <span className="tiny faint" style={{ fontWeight: 800 }}>FOR EXAMPLE</span>
      <p>{text}</p>
    </div>
  );
}

function ToggleRow({ title, desc, checked, onChange, badge }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void; badge?: string }) {
  return (
    <div className="toggle-row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{title}</strong> {badge && <span className="chip chip-plain" style={{ marginLeft: 6 }}>{badge}</span>}
        <div className="small muted">{desc}</div>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

function PicturesStep({ book, s, set, seriesName, models }: { book: WizardBook; s: EditionSettings; set: (p: Partial<EditionSettings>) => void; seriesName?: string; models: ModelChoice }) {
  const p = s.picture;
  const pp = (patch: Partial<EditionSettings['picture']>) => set({ picture: { ...p, ...patch } });
  return (
    <div className="stack-lg">
      <div className="picture-toggle">
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 18 }}>Picture Book mode</strong>
          <div className="small muted">Illustrations every few pages, in one consistent style that’s true to the book’s world.</div>
        </div>
        <Switch checked={p.on} onChange={(v) => pp({ on: v })} label="Picture Book mode" />
      </div>

      {!p.on ? (
        <div className="center stack-sm" style={{ alignItems: 'center', padding: '20px 0' }}>
          <Tuft pose="sleep" size={90} />
          <p className="muted">Text only. You can always make an illustrated edition later.</p>
        </div>
      ) : (
        <>
          <DensityPicker book={book} s={s} models={models} onChange={(density) => pp({ density })} />

          <div className="field">
            <label className="label" htmlFor="look">Which look should characters match? <span className="faint">(optional)</span></label>
            <input id="look" className="input" maxLength={160} value={p.look} onChange={(e) => pp({ look: e.target.value })}
              placeholder="e.g. the original illustrations, or the first film" />
            <span className="hint">
              Before drawing, I’ll research the book’s official art{seriesName ? ` (and anything I found for ${seriesName})` : ''} and suggest the best look for age {s.targetAge}. Leave this blank and I’ll pick.
            </span>
          </div>

          <div className="field">
            <span className="label">Art style</span>
            <div className="style-grid">
              {ART_STYLES.map((a) => (
                <button key={a.name} type="button" className={`style-card ${p.style === a.name ? 'on' : ''}`} onClick={() => pp({ style: a.name })} aria-pressed={p.style === a.name}>
                  <span className="style-swatch" style={{ background: `linear-gradient(135deg, ${a.swatch[0]} 0 33%, ${a.swatch[1]} 33% 66%, ${a.swatch[2]} 66%)` }} />
                  <strong>{a.name}</strong>
                  <span className="tiny muted">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card card-tinted small row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <Icon name="info" size={18} />
            <span>Before drawing, I’ll show you a <strong>character sheet</strong> for each main character so you can approve how they look. You can swap, redraw, upload or remove any picture later.</span>
          </div>
        </>
      )}
    </div>
  );
}

function DensityPicker({ book, s, models, onChange }: { book: WizardBook; s: EditionSettings; models: ModelChoice; onChange: (d: EditionSettings['picture']['density']) => void }) {
  const tiers = densityTiers(book);
  const found = tiers.findIndex((t) => t.id === s.picture.density);
  const idx = found >= 0 ? found : Math.min(2, tiers.length - 1);
  const rows = tiers.map((t) => ({ ...t, est: estimateEdition(book, { ...s, picture: { ...s.picture, density: t.id } }, models) }));
  const cur = rows[idx];
  const textOnly = estimateEdition(book, { ...s, picture: { ...s.picture, on: false } }, models);
  const maxCost = Math.max(...rows.map((r) => r.est.total));
  return (
    <div className="field">
      <label className="label" htmlFor="density">Image density</label>
      {/* Tiers run most → fewest pictures; the slider is flipped so sliding right means more pictures. */}
      <input id="density" className="range" type="range" min={0} max={tiers.length - 1} step={1} value={tiers.length - 1 - idx}
        onChange={(e) => onChange(tiers[tiers.length - 1 - Number(e.target.value)].id)}
        aria-valuetext={`${cur.label}, about ${cur.count} pictures, about ${money(cur.est.total)} and ${fmtMinutes(cur.est.minutes)} for the full book`} />
      <div className="row small muted" style={{ justifyContent: 'space-between' }}>
        <span>Fewer pictures</span><span>More pictures</span>
      </div>
      <div className="density-readout" aria-live="polite">
        <div>
          <span className="tiny faint">PICTURES</span>
          <strong>{cur.label}</strong>
          <span className="small muted">~{cur.count} illustrations</span>
        </div>
        <div>
          <span className="tiny faint">FULL BOOK COST</span>
          <strong>~{money(cur.est.total)}</strong>
          <span className="small muted">text {money(cur.est.text)} + pictures {money(cur.est.imageCost)}</span>
        </div>
        <div>
          <span className="tiny faint">TIME</span>
          <strong>~{fmtMinutes(cur.est.minutes)}</strong>
          <span className="small muted">text only: {fmtMinutes(textOnly.minutes)}</span>
        </div>
      </div>
      <table className="density-table">
        <caption className="sr-only">Cost and time for each density</caption>
        <thead><tr><th>Density</th><th>Pictures</th><th>Cost</th><th>Time</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={i === idx ? 'on' : ''} onClick={() => onChange(r.id)}>
              <td><button type="button" className="linkish" onClick={() => onChange(r.id)} aria-pressed={i === idx}>{r.label}</button></td>
              <td className="mono">~{r.count}</td>
              <td className="mono"><span className="cost-bar" style={{ width: `${(r.est.total / maxCost) * 60}px` }} />~{money(r.est.total)}</td>
              <td className="mono">~{fmtMinutes(r.est.minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="hint">Using {imageModel(models.images[0]).name} at about {money(imageModel(models.images[0]).perImage)} a picture. Change models in <Link href="/settings?tab=models">Settings</Link>.</span>
    </div>
  );
}

function SumItem({ k, v, onEdit }: { k: string; v: string; onEdit: () => void }) {
  return (
    <div className="sum-item">
      <span className="tiny faint" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k}</span>
      <span>{v}</span>
      <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
    </div>
  );
}
