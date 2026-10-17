import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { currentVersionOf, nextVersion, useStore } from '../store';
import Icon from '../components/Icon';
import Tuft from '../components/Tuft';
import Illustration, { SCENES } from '../components/Illustration';
import type { Scene } from '../components/Illustration';
import { Guide, Segmented, money } from '../components/ui';
import { OZ_CHAPTERS } from '../data/library';
import { estimate, fmtMinutes, imageCost, imageModel } from '../data/models';
import { ozSoftenedV11 } from '../data/ozSoftened';

type Scope = 'whole' | 'chapters' | 'passage' | 'pictures';

function friendly(guidance: string) {
  const g = guidance.toLowerCase();
  if (g.includes('lion')) return { name: 'Braver Lion', desc: 'Gave the Cowardly Lion more brave moments while keeping his worries funny.' };
  if (g.includes('funny') || g.includes('humor')) return { name: 'More Giggles', desc: 'Brought back more humor and playful moments.' };
  if (g.includes('scary') || g.includes('scared')) return { name: 'Cozier Nights', desc: 'Toned down the remaining scary moments for bedtime.' };
  if (g.includes('picture') || g.includes('illustration')) return { name: 'Fresh Pictures', desc: 'Redrew the selected illustrations.' };
  return { name: 'Gentle Touches', desc: 'Small refinements following your guidance.' };
}

export default function Refine() {
  const { id } = useParams();
  const { editions, books, updateEdition, toast, ai } = useStore();
  const nav = useNavigate();
  const edition = editions.find((e) => e.id === id);
  const book = books.find((b) => b.id === edition?.bookId);
  const [scope, setScope] = useState<Scope>('whole');
  const [chapters, setChapters] = useState<number[]>([]);
  const [para, setPara] = useState<number | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [guidance, setGuidance] = useState('');
  const [levelOverride, setLevelOverride] = useState<null | 'major' | 'minor' | 'patch'>(null);

  if (!edition || !book) return <main className="page"><p>Edition not found.</p></main>;
  const v = currentVersionOf(edition);
  const chapterNames = book.id === 'oz' ? OZ_CHAPTERS : Array.from({ length: book.chapters }, (_, i) => `Chapter ${i + 1}`);

  const affected = scope === 'whole' ? book.chapters : scope === 'chapters' ? chapters.length : 1;
  const suggested: 'major' | 'minor' | 'patch' = scope === 'whole' ? 'major' : scope === 'chapters' && chapters.length > 1 ? 'minor' : 'patch';
  const level = levelOverride ?? suggested;
  const full = estimate(book, edition.settings, ai);
  // Rewriting text reuses the Story Bible, so it costs a bit less than the first pass.
  const textCost = scope === 'pictures' ? 0 : (full.text / book.chapters) * affected * 0.8 + 0.08;
  const textMin = scope === 'pictures' ? 0 : (full.textMinutes / book.chapters) * affected * 0.8;
  // Pictures in rewritten chapters are redrawn only when their scene changed (about half of them).
  const redraw = scope === 'pictures' ? scenes.length
    : edition.settings.picture.on ? Math.ceil((full.images / book.chapters) * affected * (scope === 'passage' ? 0.3 : 0.5)) : 0;
  const pics = imageCost(redraw, ai);
  const cost = textCost + pics.cost;
  const minutes = Math.max(1, Math.round(textMin + pics.minutes));
  const looksLikeNewEdition = /\b(age|years? old|older|younger)\b|\bfor (my )?\d+\b/i.test(guidance);
  const ready = (scope === 'pictures' ? scenes.length > 0 : guidance.trim().length > 4) && (scope !== 'chapters' || chapters.length > 0) && (scope !== 'passage' || para !== null);

  const submit = () => {
    const f = friendly(scope === 'pictures' ? 'picture' : guidance);
    updateEdition(edition.id, {
      status: 'running',
      run: {
        chapter: 0, of: Math.max(1, affected), spent: 0, estimate: +cost.toFixed(2), cap: Math.ceil(cost * 1.5 + 0.5), minutes, images: redraw,
        level, guidance: scope === 'pictures' ? `Redraw ${scenes.length} picture(s). ${guidance}` : guidance, versionName: f.name,
        versionDescription: `${f.desc} ${scope === 'whole' ? 'Touched the whole book.' : scope === 'chapters' ? `Touched ${chapters.length} chapter(s).` : scope === 'passage' ? 'One passage in chapter 12.' : ''}`.trim(),
      },
    });
    toast('On it! I’ll make a new version.', 'write');
    nav(`/edition/${edition.id}/progress`);
  };

  return (
    <main className="page page-narrow">
      <Link to={`/book/${book.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }}><Icon name="left" size={16} /> {book.title}</Link>
      <div className="stack-lg" style={{ marginTop: 8 }}>
        <div className="stack-sm">
          <h1>Refine this edition</h1>
          <p className="muted">{edition.name} · currently <span className="badge-version">v{v?.number}</span> “{v?.name}”</p>
        </div>
        <Guide pose="write" size={66}>
          Tell me what to improve. I’ll only change what you ask for and keep everything else steady. The result is a <strong>new version</strong>, so you can always go back.
        </Guide>

        <div className="card stack">
          <span className="label">What should I change?</span>
          <Segmented<Scope> label="Scope" value={scope} onChange={(s) => { setScope(s); setLevelOverride(null); }}
            options={[
              { value: 'whole', label: 'The whole edition' },
              { value: 'chapters', label: 'Some chapters' },
              { value: 'passage', label: 'One passage' },
              ...(edition.settings.picture.on ? [{ value: 'pictures' as Scope, label: 'Pictures' }] : []),
            ]} />

          {scope === 'chapters' && (
            <div className="chapter-pick">
              {chapterNames.map((t, i) => (
                <button key={i} className={`chip ${chapters.includes(i + 1) ? '' : 'chip-outline'}`} style={{ border: 'none', cursor: 'pointer' }}
                  onClick={() => setChapters(chapters.includes(i + 1) ? chapters.filter((c) => c !== i + 1) : [...chapters, i + 1])} aria-pressed={chapters.includes(i + 1)}>
                  {i + 1}. {t}
                </button>
              ))}
            </div>
          )}

          {scope === 'passage' && (
            <div className="stack-sm">
              <span className="small muted">Tap the paragraph you want changed (chapter 12 shown).</span>
              <div className="passage-pick prose">
                {ozSoftenedV11[12].slice(8, 20).map((p, i) => (
                  <p key={i} className={para === i ? 'picked' : ''} onClick={() => setPara(i)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setPara(i)}>{p}</p>
                ))}
              </div>
            </div>
          )}

          {scope === 'pictures' && (
            <div className="stack-sm">
              <span className="small muted">Pick the pictures to redraw. You can also upload your own or remove one.</span>
              <div className="pic-pick">
                {(['toto', 'bed', 'soldier', 'witch', 'clang', 'crows', 'lion'] as Scene[]).map((sc) => (
                  <div key={sc} className={`pic-card ${scenes.includes(sc) ? 'on' : ''}`}>
                    <button onClick={() => setScenes(scenes.includes(sc) ? scenes.filter((x) => x !== sc) : [...scenes, sc])} aria-pressed={scenes.includes(sc)}>
                      <Illustration scene={sc} />
                    </button>
                    <span className="tiny">{SCENES[sc].caption}</span>
                    <span className="tiny faint">{SCENES[sc].source}</span>
                    <div className="row" style={{ gap: 2 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => toast('Prototype: choose an image to upload', 'think')}><Icon name="upload" size={14} /> Upload</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toast('Prototype: picture removed in the new version', 'worry')}><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label className="label" htmlFor="guidance">{scope === 'pictures' ? 'Anything to change in the pictures? (optional)' : 'Your guidance'}</label>
            <textarea id="guidance" className="textarea" value={guidance} onChange={(e) => setGuidance(e.target.value)}
              placeholder={scope === 'pictures' ? 'e.g. Make the wolves look fluffier and less fierce.' : 'e.g. The Lion should get a few more brave moments. He’s her favorite.'} />
            <div className="row-wrap">
              {['The Lion should get a few more brave moments.', 'Bring back more of the original humor.', 'Still a little too scary at bedtime.', 'Names are hard to say aloud; add a pronunciation note.'].map((t) => (
                <button key={t} className="chip chip-outline" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setGuidance(t)}><Icon name="plus" size={12} /> {t}</button>
              ))}
            </div>
          </div>

          {looksLikeNewEdition && (
            <div className="card card-tinted row" style={{ gap: 14, flexWrap: 'wrap' }}>
              <Tuft pose="think" size={60} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>That sounds like a new edition</strong>
                <p className="small muted">Changing who the book is for works best as a new edition, so this one stays as it is.</p>
              </div>
              <Link className="btn btn-secondary btn-sm" to={`/book/${book.id}/new?from=${edition.id}`}>New edition from these settings</Link>
            </div>
          )}
        </div>

        <div className="card stack">
          <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
              <span className="label">New version</span>
              <div className="row" style={{ gap: 8 }}>
                <span className="badge-version">v{v?.number}</span><Icon name="arrow" size={16} /><span className="badge-version" style={{ background: 'var(--plum)' }}>v{nextVersion(edition.currentVersion, level)}</span>
              </div>
              <Segmented label="Version level" value={level} onChange={setLevelOverride}
                options={[{ value: 'patch', label: 'Patch' }, { value: 'minor', label: 'Minor' }, { value: 'major', label: 'Major' }]} />
              <span className="hint">{level === 'major' ? 'Major: changes across the whole book.' : level === 'minor' ? 'Minor: several chapters revised.' : 'Patch: a small, targeted fix.'} I suggested <strong>{suggested}</strong>.</span>
            </div>
            <div className="est-total">
              <span className="tiny faint">ESTIMATE</span>
              <strong>~{money(cost)}</strong>
              <span className="small muted">
                {scope === 'pictures' ? `${redraw} picture${redraw === 1 ? '' : 's'}` : `${affected} chapter${affected === 1 ? '' : 's'}`} · about {fmtMinutes(minutes)} · cap {money(Math.ceil(cost * 1.5 + 0.5))}
              </span>
              {redraw > 0 && scope !== 'pictures' && <span className="tiny faint">Includes ~{redraw} redrawn picture{redraw === 1 ? '' : 's'} ({money(pics.cost)}, {imageModel(ai.images[0]).name})</span>}
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Link to={`/book/${book.id}`} className="btn btn-ghost">Cancel</Link>
            <button className="btn btn-primary" disabled={!ready} onClick={submit}><Icon name="sparkle" size={18} /> Make new version</button>
          </div>
        </div>
      </div>
    </main>
  );
}
