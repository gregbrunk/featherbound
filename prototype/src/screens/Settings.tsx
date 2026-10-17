import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import Icon from '../components/Icon';
import Tuft from '../components/Tuft';
import { Guide, ProtoNote, Switch, fmtDate, money, tokens } from '../components/ui';
import { MONTHLY, RUNS } from '../data/library';

const TABS = [
  { id: 'usage', label: 'Usage & costs', icon: 'chart' },
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
        <p className="small muted">Text: a top-tier Claude model. Pictures: chosen in the build plan. Model choices will live here so they can be swapped later.</p>
      </div>
    </div>
  );
}
