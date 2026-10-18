'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import { Switch } from '@/components/ui';
import { money } from '@/lib/estimate';
import type { Usage } from '@/lib/usage';
import { saveBudgetAction } from './actions';

const TEXT = '#6A46B0';
const PICS = '#D4A23A';
const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function UsageView({ usage: u, budget: initialBudget }: { usage: Usage; budget: number | null }) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [budgetOn, setBudgetOn] = useState(initialBudget !== null);
  const [budget, setBudget] = useState(initialBudget ?? 30);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const last = u.months.length - 1;
  const max = Math.max(1, Math.ceil((Math.max(...u.months.map((m) => m.text + m.images), u.projected) * 1.1) / 5) * 5);
  const kindMax = Math.max(0.0001, ...u.byKind.map((k) => k[1]));
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });

  const saveBudget = (on: boolean, value: number) => start(async () => {
    const r = await saveBudgetAction(on ? value : null);
    setSaved(r?.ok ? 'Saved' : r?.message ?? 'Couldn’t save');
  });

  if (u.allTime === 0) {
    return <div className="card"><p className="muted">Nothing spent yet. Every AI call shows up here with its tokens and cost.</p></div>;
  }

  return (
    <div className="stack-lg">
      <div className="kpi-grid">
        <Kpi label="This month" value={money(u.monthTotal)} sub={`${u.monthRuns} runs · ${tokens(u.monthTokens)} tokens`} />
        <Kpi label={`Projected for ${monthName}`} value={money(u.projected)} warn={budgetOn && u.projected > budget * 0.9}
          sub={budgetOn ? `${Math.round((u.projected / budget) * 100)}% of ${money(budget)} budget` : 'No monthly budget'} />
        <Kpi label="All time" value={money(u.allTime)} sub={u.since ? `Since ${new Date(u.since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ''} />
        <Kpi label="Estimate accuracy" value={u.accuracy === null ? '—' : `±${Math.round(u.accuracy * 100)}%`} sub="Average gap, estimate vs actual" />
      </div>

      <div className="card stack">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h3>Spending by month</h3>
            <p className="small muted">Text and pictures. This month’s dashed bar is the projection.</p>
          </div>
          <div className="legend">
            <span><i style={{ background: TEXT }} /> Text</span>
            <span><i style={{ background: PICS }} /> Pictures</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show table'}</button>
        </div>
        {table ? (
          <table className="data-table">
            <thead><tr><th>Month</th><th>Text</th><th>Pictures</th><th>Total</th></tr></thead>
            <tbody>{u.months.map((m) => <tr key={m.key}><td>{m.label}</td><td>{money(m.text)}</td><td>{money(m.images)}</td><td><strong>{money(m.text + m.images)}</strong></td></tr>)}</tbody>
          </table>
        ) : (
          <div className="bar-chart" role="img" aria-label={u.months.map((m) => `${m.label} ${money(m.text + m.images)}`).join(', ')}>
            <div className="bar-grid">
              {[0, 0.5, 1].map((t) => <div key={t} style={{ bottom: `${t * 100}%` }}><span>${Math.round(max * t)}</span></div>)}
            </div>
            <div className="bars">
              {u.months.map((m, i) => {
                const total = m.text + m.images;
                const isLast = i === last;
                const shown = isLast ? Math.max(total, u.projected) : total;
                return (
                  <div key={m.key} className="bar-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
                    <div className="bar-stack" style={{ height: `${(shown / max) * 100}%` }}>
                      {isLast && shown > total && <div className="bar-proj" style={{ flex: shown - total }} />}
                      {m.images > 0 && <div className="seg" style={{ flex: m.images, background: PICS }} />}
                      {m.text > 0 && <div className="seg" style={{ flex: m.text, background: TEXT }} />}
                    </div>
                    <span className="bar-label">{m.label}</span>
                    {hover === i && (
                      <div className="chart-tip">
                        <strong>{m.label}</strong>
                        <div><i style={{ background: TEXT }} /> Text {money(m.text)}</div>
                        <div><i style={{ background: PICS }} /> Pictures {money(m.images)}</div>
                        <div className="tip-total">Total {money(total)}{isLast ? ` · projected ${money(u.projected)}` : ''}</div>
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
          {u.byBook.length === 0 ? <p className="small muted">No book runs yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Book</th><th>Runs</th><th>Cost</th></tr></thead>
              <tbody>{u.byBook.map((b) => <tr key={b.id}><td><Link href={`/books/${b.id}`}>{b.title}</Link></td><td>{b.runs}</td><td><strong>{money(b.cost)}</strong></td></tr>)}</tbody>
            </table>
          )}
        </div>
        <div className="card stack">
          <h3>By kind of run</h3>
          <div className="hbars">
            {u.byKind.map(([k, v]) => (
              <div key={k} className="hbar" title={`${k}: ${money(v)}`}>
                <span className="small">{k}</span>
                <div className="hbar-track"><i style={{ width: `${(v / kindMax) * 100}%` }} /></div>
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
            <thead><tr><th>Date</th><th>Book</th><th>Run</th><th className="hide-sm">Tokens in / out</th><th>Estimate</th><th>Actual</th><th>Gap</th></tr></thead>
            <tbody>
              {u.recent.map((r) => {
                const gap = r.estimate ? (r.actual - r.estimate) / r.estimate : null;
                return (
                  <tr key={r.id}>
                    <td className="nowrap">{day(r.date)}</td>
                    <td>{r.bookId ? <Link href={`/books/${r.bookId}`}>{r.bookTitle}</Link> : r.bookTitle}</td>
                    <td className="nowrap">{r.kind}</td>
                    <td className="hide-sm mono">{tokens(r.tokensIn)} / {tokens(r.tokensOut)}</td>
                    <td className="mono">{r.estimate ? money(r.estimate) : '—'}</td>
                    <td className="mono"><strong>{money(r.actual)}</strong>{r.running && <span className="tiny faint"> so far</span>}</td>
                    <td>{r.running ? <span className="chip chip-plain">Running</span> : gap === null ? '—' : (
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
          <Switch checked={budgetOn} onChange={(v) => { setBudgetOn(v); saveBudget(v, budget); }} label="Monthly budget" />
        </div>
        {budgetOn && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div className="money-input"><span>$</span><input type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} onBlur={() => saveBudget(true, budget)} aria-label="Monthly budget" /></div>
            <div className="progress-bar gold" style={{ flex: 1, minWidth: 160 }}><i style={{ width: `${Math.min(100, (u.monthTotal / Math.max(1, budget)) * 100)}%` }} /></div>
            <span className="small muted">{money(u.monthTotal)} spent{pending ? ' · saving…' : saved ? ` · ${saved}` : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className={`card kpi ${warn ? 'warn' : ''}`}>
      <span className="tiny faint" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      <strong className="kpi-value">{value}</strong>
      <span className="small muted">{warn && <Icon name="info" size={14} />} {sub}</span>
    </div>
  );
}
