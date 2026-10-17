import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import Icon from '../components/Icon';
import Tuft from '../components/Tuft';
import { Guide, ProtoNote, Switch, fmtDate, money, tokens } from '../components/ui';
import { MONTHLY, RUNS } from '../data/library';
import { IMAGE_MODELS, PROVIDERS, TEXT_MODELS, imageModel, reachable, textModel } from '../data/models';
import type { Provider, Strictness } from '../data/models';

const TABS = [
  { id: 'usage', label: 'Usage & costs', icon: 'chart' },
  { id: 'models', label: 'AI models & keys', icon: 'wand' },
  { id: 'access', label: 'Family access', icon: 'users' },
  { id: 'handoff', label: 'Hand-off PIN', icon: 'key' },
  { id: 'about', label: 'About', icon: 'feather' },
];

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'usage';
  return (
    <main className="page">
      <div className="stack-sm" style={{ marginBottom: 18 }}>
        <h1>Settings</h1>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setParams({ tab: t.id })} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={18} /> {t.label}
            </button>
          ))}
        </nav>
        <section style={{ minWidth: 0 }}>
          {tab === 'usage' && <Usage />}
          {tab === 'models' && <Models />}
          {tab === 'access' && <Access />}
          {tab === 'handoff' && <Handoff />}
          {tab === 'about' && <About />}
        </section>
      </div>
    </main>
  );
}

function Usage() {
  const { books } = useStore();
  const [budgetOn, setBudgetOn] = useState(true);
  const [budget, setBudget] = useState(60);
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const oct = MONTHLY[MONTHLY.length - 1];
  const octTotal = oct.text + oct.images;
  const dayOfMonth = 17, days = 31;
  const projected = (octTotal / dayOfMonth) * days;
  const allTime = MONTHLY.reduce((n, m) => n + m.text + m.images, 0);
  const octRuns = RUNS.filter((r) => r.date.startsWith('2026-10'));
  const octTokens = octRuns.reduce((n, r) => n + r.tokensIn + r.tokensOut, 0);
  const max = Math.ceil((Math.max(...MONTHLY.map((m) => m.text + m.images), projected) * 1.05) / 20) * 20;

  const byBook = Object.values(
    RUNS.reduce<Record<string, { id: string; cost: number; runs: number }>>((acc, r) => {
      (acc[r.bookId] ??= { id: r.bookId, cost: 0, runs: 0 });
      acc[r.bookId].cost += r.actual; acc[r.bookId].runs += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.cost - a.cost);
  const byType = Object.entries(RUNS.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.type]: (acc[r.type] ?? 0) + r.actual }), {})).sort((a, b) => b[1] - a[1]);
  const typeMax = Math.max(...byType.map((x) => x[1]));
  const accuracy = RUNS.filter((r) => r.type !== 'Full adaptation' || r.id !== 'r2');
  const avgErr = accuracy.reduce((n, r) => n + Math.abs(r.actual - r.estimate) / r.estimate, 0) / accuracy.length;

  return (
    <div className="stack-lg">
      <div className="kpi-grid">
        <Kpi label="This month" value={money(octTotal)} sub={`${octRuns.length} runs · ${tokens(octTokens)} tokens`} />
        <Kpi label="Projected for October" value={money(projected)} sub={budgetOn ? `${Math.round((projected / budget) * 100)}% of ${money(budget)} budget` : 'No monthly budget'} warn={budgetOn && projected > budget * 0.9} />
        <Kpi label="All time" value={money(allTime)} sub="Since July 2026" />
        <Kpi label="Estimate accuracy" value={`±${Math.round(avgErr * 100)}%`} sub="Average gap, estimate vs actual" />
      </div>

      <div className="card stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h3>Spending by month</h3>
            <p className="small muted">Text adaptation and pictures. October’s dashed bar is the projection.</p>
          </div>
          <div className="legend">
            <span><i style={{ background: '#6A46B0' }} /> Text</span>
            <span><i style={{ background: '#D4A23A' }} /> Pictures</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show table'}</button>
        </div>
        {table ? (
          <table className="data-table">
            <thead><tr><th>Month</th><th>Text</th><th>Pictures</th><th>Total</th></tr></thead>
            <tbody>{MONTHLY.map((m) => <tr key={m.month}><td>{m.month}</td><td>{money(m.text)}</td><td>{money(m.images)}</td><td><strong>{money(m.text + m.images)}</strong></td></tr>)}</tbody>
          </table>
        ) : (
          <div className="bar-chart" role="img" aria-label={MONTHLY.map((m) => `${m.month} ${money(m.text + m.images)}`).join(', ')}>
            <div className="bar-grid">
              {[0, 0.5, 1].map((t) => <div key={t} style={{ bottom: `${t * 100}%` }}><span>${Math.round(max * t)}</span></div>)}
            </div>
            <div className="bars">
              {MONTHLY.map((m, i) => {
                const total = m.text + m.images;
                const isLast = i === MONTHLY.length - 1;
                return (
                  <div key={m.month} className="bar-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
                    <div className="bar-stack" style={{ height: `${((isLast ? projected : total) / max) * 100}%` }}>
                      {isLast && <div className="bar-proj" style={{ flex: projected - total }} />}
                      {m.images > 0 && <div className="seg" style={{ flex: m.images, background: '#D4A23A' }} />}
                      {m.text > 0 && <div className="seg" style={{ flex: m.text, background: '#6A46B0' }} />}
                    </div>
                    <span className="bar-label">{m.month}</span>
                    {hover === i && (
                      <div className="chart-tip">
                        <strong>{m.month} 2026</strong>
                        <div><i style={{ background: '#6A46B0' }} /> Text {money(m.text)}</div>
                        <div><i style={{ background: '#D4A23A' }} /> Pictures {money(m.images)}</div>
                        <div className="tip-total">Total {money(total)}{isLast ? ` · projected ${money(projected)}` : ''}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="card stack">
          <h3>By book</h3>
          <table className="data-table">
            <thead><tr><th>Book</th><th>Runs</th><th>Cost</th></tr></thead>
            <tbody>
              {byBook.map((b) => {
                const bk = books.find((x) => x.id === b.id);
                return <tr key={b.id}><td><Link to={`/book/${b.id}`}>{bk?.title ?? b.id}</Link></td><td>{b.runs}</td><td><strong>{money(b.cost)}</strong></td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="card stack">
          <h3>By kind of run</h3>
          <div className="hbars">
            {byType.map(([t, v]) => (
              <div key={t} className="hbar" title={`${t}: ${money(v)}`}>
                <span className="small">{t}</span>
                <div className="hbar-track"><i style={{ width: `${(v / typeMax) * 100}%` }} /></div>
                <span className="small mono" style={{ fontWeight: 800 }}>{money(v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack">
        <h3>Recent runs: estimate vs actual</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Book</th><th>Run</th><th className="hide-sm">Tokens in / out</th><th className="hide-sm">Pictures</th><th>Estimate</th><th>Actual</th><th>Gap</th></tr></thead>
            <tbody>
              {RUNS.map((r) => {
                const gap = (r.actual - r.estimate) / r.estimate;
                const running = r.id === 'r2';
                return (
                  <tr key={r.id}>
                    <td className="nowrap">{fmtDate(r.date).replace(', 2026', '')}</td>
                    <td>{books.find((b) => b.id === r.bookId)?.title}</td>
                    <td className="nowrap">{r.type}</td>
                    <td className="hide-sm mono">{tokens(r.tokensIn)} / {tokens(r.tokensOut)}</td>
                    <td className="hide-sm">{r.images || '—'}</td>
                    <td className="mono">{money(r.estimate)}</td>
                    <td className="mono"><strong>{money(r.actual)}</strong>{running && <span className="tiny faint"> so far</span>}</td>
                    <td>{running ? <span className="chip chip-plain">Running</span> : (
                      <span className={`chip ${gap > 0.1 ? 'chip-ruby' : gap < -0.1 ? 'chip-emerald' : 'chip-plain'}`}>{gap > 0 ? '+' : ''}{Math.round(gap * 100)}%</span>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card stack">
        <div className="toggle-row">
          <div style={{ flex: 1 }}>
            <strong>Monthly budget</strong>
            <div className="small muted">Tuft warns you when you’re getting close. Each run still has its own cap.</div>
          </div>
          <Switch checked={budgetOn} onChange={setBudgetOn} label="Monthly budget" />
        </div>
        {budgetOn && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="money-input"><span>$</span><input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} aria-label="Monthly budget" /></div>
            <div className="progress-bar gold" style={{ flex: 1, minWidth: 160 }}><i style={{ width: `${Math.min(100, (octTotal / budget) * 100)}%` }} /></div>
            <span className="small muted">{money(octTotal)} spent</span>
          </div>
        )}
      </div>
      <ProtoNote>Prototype: these are example figures. The real dashboard records every AI call with its tokens and cost.</ProtoNote>
    </div>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className={`card kpi ${warn ? 'warn' : ''}`}>
      <span className="tiny faint" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <strong className="kpi-value">{value}</strong>
      <span className="small muted">{warn && <Icon name="info" size={14} className="inline-icon" />} {sub}</span>
    </div>
  );
}

const STRICT_LABEL: Record<Strictness, { text: string; cls: string }> = {
  strict: { text: 'Strict filters', cls: 'chip-ruby' },
  medium: { text: 'Medium filters', cls: 'chip-gold' },
  loose: { text: 'Loose filters', cls: 'chip-emerald' },
};

function Models() {
  const { ai, setAi, toast } = useStore();
  const slots = [
    { name: 'Main', sub: 'Used first' },
    { name: 'Backup 1', sub: 'If the main model refuses' },
    { name: 'Backup 2', sub: 'Last resort' },
  ];
  const setSlot = (i: number, id: string) => {
    const images = [...ai.images] as typeof ai.images;
    images[i] = id;
    setAi({ images });
  };
  const loosest = ai.images.some((id) => imageModel(id).strictness === 'loose');
  const dupes = new Set(ai.images).size < ai.images.length;
  const tm = textModel(ai.text);

  return (
    <div className="stack-lg">
      <Guide pose="think" size={64}>
        I write with one model and draw with up to three. If a picture model says no (it happens with famous characters), I quietly try the next one.
      </Guide>

      <div className="card stack">
        <div>
          <h3>Your API keys</h3>
          <p className="small muted">
            Keys belong to <strong>you</strong>. Runs you start are paid for by your keys. Other people in the family add their own keys here, so nobody draws on anyone else’s account.
          </p>
        </div>
        <div>
          {PROVIDERS.map((p) => <KeyRow key={p.id} provider={p} />)}
        </div>
        <p className="tiny faint">
          Easiest: one Vercel AI Gateway key reaches every model at the providers’ list prices, with no markup (card fees may apply). Or add keys from each provider directly; prices are the same. Keys are encrypted, never shown again, and never shared with the family.
        </p>
        <div className="toggle-row">
          <div style={{ flex: 1 }}>
            <strong>Let family members use my keys</strong>
            <div className="small muted">Only for people who haven’t added their own. Their runs would be billed to you and show in your usage.</div>
          </div>
          <Switch checked={ai.shareWithFamily} onChange={(v) => { setAi({ shareWithFamily: v }); toast(v ? 'Family can use your keys' : 'Your keys are just for you now', v ? 'cheer' : 'guard'); }} label="Let family members use my keys" />
        </div>
      </div>

      <div className="card stack">
        <div>
          <h3>Writing model</h3>
          <p className="small muted">Adapts the text, writes the Story Bible and checks consistency.</p>
        </div>
        <ModelSelect id="text-model" value={ai.text} onChange={(id) => setAi({ text: id })}
          options={TEXT_MODELS.map((m) => ({ id: m.id, label: `${m.name}${m.recommended ? ' (recommended)' : ''}` }))} />
        <div className="model-meta">
          <span className="chip chip-plain">${tm.inPerM} / ${tm.outPerM} per M tokens</span>
          <span className="chip chip-plain">{tm.speed >= 1.3 ? 'Faster' : tm.speed < 0.9 ? 'Slower' : 'Normal speed'}</span>
          {!reachable(tm.provider, ai.keys) && <span className="chip chip-ruby">Needs a {PROVIDERS.find((p) => p.id === tm.provider)?.name ?? tm.provider} or Gateway key</span>}
        </div>
        <p className="small muted">{tm.note}</p>
      </div>

      <div className="card stack">
        <div>
          <h3>Picture models</h3>
          <p className="small muted">Tried in order. Estimates use the main model’s price and show the most a run could cost if backups were needed.</p>
        </div>
        <div>
          {slots.map((slot, i) => {
            const m = imageModel(ai.images[i]);
            return (
              <div key={slot.name} className="model-slot">
                <label className="slot-name" htmlFor={`img-${i}`}>{slot.name}<small>{slot.sub}</small></label>
                <div>
                  <ModelSelect id={`img-${i}`} value={ai.images[i]} onChange={(id) => setSlot(i, id)}
                    options={IMAGE_MODELS.map((x) => ({ id: x.id, label: x.name }))} />
                  <div className="model-meta">
                    <span className="chip chip-plain">~{money(m.perImage)} / picture</span>
                    <span className="chip chip-plain">~{m.seconds}s each</span>
                    <span className="chip chip-plain">Book-art match {m.denslow}/5</span>
                    <span className="chip chip-plain">Consistency {m.consistency}/5</span>
                    <span className={`chip ${STRICT_LABEL[m.strictness].cls}`}>{STRICT_LABEL[m.strictness].text}</span>
                    {!reachable(m.provider, ai.keys) && <span className="chip chip-ruby">No key reaches this model</span>}
                  </div>
                  <p className="small muted" style={{ marginTop: 6 }}>{m.note}</p>
                </div>
              </div>
            );
          })}
        </div>
        {!loosest && (
          <p className="small" style={{ color: 'var(--ruby)' }}><Icon name="info" size={14} className="inline-icon" /> None of your picture models has loose filters. Books with famous characters (like Harry Potter) may end up with missing pictures.</p>
        )}
        {dupes && <p className="small" style={{ color: 'var(--ruby)' }}><Icon name="info" size={14} className="inline-icon" /> The same model is in more than one slot, so a refusal won’t have a real backup.</p>}
        <p className="tiny faint">Scores come from our Oct 2026 illustration bake-off with W. W. Denslow’s Oz art.</p>
      </div>
      <ProtoNote>Prototype: keys you type here aren’t saved or sent anywhere; only a masked hint is kept until you reload. Model choices are remembered on this device.</ProtoNote>
    </div>
  );
}

function ModelSelect({ id, value, onChange, options }: { id: string; value: string; onChange: (id: string) => void; options: { id: string; label: string }[] }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

function KeyRow({ provider }: { provider: (typeof PROVIDERS)[number] }) {
  const { ai, setAi, toast } = useStore();
  const [value, setValue] = useState('');
  const saved = ai.keys[provider.id];
  const setKey = (id: Provider, k: (typeof ai.keys)[Provider] | undefined) => {
    const keys = { ...ai.keys };
    if (k) keys[id] = k; else delete keys[id];
    setAi({ keys });
  };
  const save = () => {
    const trimmed = value.trim();
    if (trimmed.length < 8) return;
    setKey(provider.id, { hint: `••••${trimmed.slice(-4)}`, added: '2026-10-17', status: 'checking' });
    setValue('');
    setTimeout(() => {
      setKey(provider.id, { hint: `••••${trimmed.slice(-4)}`, added: '2026-10-17', status: 'ok' });
      toast(`${provider.name} key works`, 'cheer');
    }, 900);
  };
  return (
    <div className="key-row">
      <div className="key-info">
        <strong>{provider.name}</strong> {provider.recommended && <span className="chip chip-emerald" style={{ marginLeft: 4 }}>Recommended</span>}
        <div className="small muted">{provider.hint}</div>
      </div>
      {saved ? (
        <div className="row" style={{ gap: 8 }}>
          <span className="mono small">{saved.hint}</span>
          {saved.status === 'checking' ? <span className="chip chip-plain">Checking…</span> : <span className="chip chip-emerald"><Icon name="check" size={12} stroke={3} /> Working</span>}
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--ruby)' }} onClick={() => { setKey(provider.id, undefined); toast(`${provider.name} key removed`, 'worry'); }}>Remove</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input className="input" type="password" autoComplete="off" spellCheck={false} placeholder={`Paste your ${provider.keyLabel}`} value={value} onChange={(e) => setValue(e.target.value)} aria-label={provider.keyLabel} />
          <button className="btn btn-secondary btn-sm" disabled={value.trim().length < 8}>Save</button>
        </form>
      )}
    </div>
  );
}

function Access() {
  const { approved, addEmail, removeEmail, toast } = useStore();
  const [email, setEmail] = useState('');
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <div className="stack-lg">
      <Guide pose="guard" size={64}>Only people on this list can sign in with Google. Everyone on it sees the whole family library.</Guide>
      <div className="card stack">
        <h3>Approved people</h3>
        <ul className="people">
          {approved.map((p) => (
            <li key={p.email}>
              <div className="avatar">{p.email[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong className="ellipsis" style={{ display: 'block' }}>{p.email}</strong>
                <span className="tiny faint">Added {fmtDate(p.added)}</span>
              </div>
              {p.owner ? <span className="chip chip-gold">Owner</span> : (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--ruby)' }} onClick={() => { removeEmail(p.email); toast(`${p.email} removed`, 'worry'); }}>Remove</button>
              )}
            </li>
          ))}
        </ul>
        <form className="row" style={{ flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); if (!valid) return; addEmail(email.trim()); toast(`${email} can now sign in`); setEmail(''); }}>
          <input className="input" style={{ flex: 1, minWidth: 220 }} type="email" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to approve" />
          <button className="btn btn-primary" disabled={!valid}><Icon name="plus" size={18} /> Add person</button>
        </form>
        <p className="small muted">They’ll sign in at the same address with their Google account. Nothing is sent to them; tell them yourself.</p>
      </div>
      <div className="card row" style={{ gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong>What someone not on the list sees</strong>
          <p className="small muted">A friendly “This library is private” page.</p>
        </div>
        <Link to="/private" className="btn btn-secondary btn-sm"><Icon name="eye" size={16} /> Preview</Link>
        <Link to="/signin" className="btn btn-secondary btn-sm"><Icon name="eye" size={16} /> Preview sign-in</Link>
      </div>
    </div>
  );
}

function Handoff() {
  const { pin, setPin, toast } = useStore();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const ok = /^\d{4}$/.test(a) && a === b;
  return (
    <div className="stack-lg">
      <Guide pose="guard" size={64}>When you hand a device to a kid, lock it to one book from the reader’s 🔒 button. To unlock, press and hold me, then enter this PIN.</Guide>
      <div className="card stack">
        <h3>Parent PIN</h3>
        <p className="small muted">Current PIN: {pin.replace(/./g, '•')} <span className="faint">(prototype: {pin})</span></p>
        <div className="grid-2">
          <div className="field"><label className="label" htmlFor="p1">New 4-digit PIN</label><input id="p1" className="input pin-input" inputMode="numeric" maxLength={4} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} /></div>
          <div className="field"><label className="label" htmlFor="p2">Type it again</label><input id="p2" className="input pin-input" inputMode="numeric" maxLength={4} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} /></div>
        </div>
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!ok} onClick={() => { setPin(a); setA(''); setB(''); toast('New PIN saved', 'guard'); }}>Save PIN</button>
      </div>
    </div>
  );
}

function About() {
  return (
    <div className="stack-lg">
      <div className="card card-lg row" style={{ gap: 24, flexWrap: 'wrap' }}>
        <Tuft pose="read" size={120} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 240 }}>
          <h2>Featherbound</h2>
          <p className="muted">Books we love, made softer than 2-ply. A private family library: a 10 Ply project.</p>
          <p className="small faint">Prototype · October 2026</p>
          <Link to="/design" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}><Icon name="feather" size={16} /> Meet Tuft & the design</Link>
        </div>
      </div>
      <div className="card stack-sm">
        <h3>AI models</h3>
        <p className="small muted">Choose the writing and picture models, and add your own API keys, in <Link to="/settings?tab=models">AI models &amp; keys</Link>.</p>
      </div>
    </div>
  );
}
