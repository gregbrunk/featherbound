'use client';

import { useActionState, useState, useTransition } from 'react';
import { Switch } from '@/components/ui';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import { IMAGE_MODELS, TEXT_MODELS, imageModel, textModel, type Strictness } from '@/lib/models';
import { addEmailAction, removeEmailAction, removeKeyAction, saveKeyAction, saveModelsAction, setPinAction, setPreferDirectKeysAction, type FormState } from './actions';

function Status({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <p className={`small ${state.ok ? 'status-ok' : 'status-bad'}`} role="status">
      <Icon name={state.ok ? 'check' : 'info'} size={14} className="inline-icon" /> {state.message}
    </p>
  );
}

export type SavedKeyView = { provider: string; last4: string; status: 'ok' | 'invalid'; statusDetail: string | null };

export function KeyRow({ provider, name, hint, recommended, saved }: { provider: string; name: string; hint: string; recommended?: boolean; saved?: SavedKeyView }) {
  const [state, action, pending] = useActionState(saveKeyAction, null);
  const [editing, setEditing] = useState(!saved);
  const showForm = editing || !saved;
  return (
    <div className="key-row">
      <div className="key-info">
        <strong>{name}</strong>{recommended && <span className="chip chip-emerald">Recommended</span>}
        <div className="small muted">{hint}</div>
      </div>
      {showForm ? (
        <form action={action} className="key-form">
          <input type="hidden" name="provider" value={provider} />
          <input className="input" name="key" type="password" autoComplete="off" spellCheck={false} placeholder={`Paste your ${name} key`} aria-label={`${name} key`} required />
          <button className="btn btn-secondary btn-sm" disabled={pending}>{pending ? 'Checking…' : 'Save'}</button>
          {saved && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>}
        </form>
      ) : (
        <div className="key-saved">
          <span className="mono small">••••{saved.last4}</span>
          {saved.status === 'ok'
            ? <span className="chip chip-emerald"><Icon name="check" size={12} stroke={3} /> Working</span>
            : <span className="chip chip-ruby">Not working</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Replace</button>
          <form action={removeKeyAction}>
            <input type="hidden" name="provider" value={provider} />
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--ruby)' }}>Remove</button>
          </form>
        </div>
      )}
      {saved?.statusDetail && !showForm && <p className="tiny faint key-note">{saved.statusDetail.replace(/^Balance:/, 'Balance when checked:')}</p>}
      {state?.message && !state.ok && <div className="key-note"><Status state={state} /></div>}
    </div>
  );
}

const STRICT_LABEL: Record<Strictness, string> = { strict: 'Strict filters', medium: 'Medium filters', loose: 'Loose filters' };

export function ModelsForm({ text, images, reachable }: { text: string; images: [string, string, string]; reachable: Record<string, boolean> }) {
  const [state, action, pending] = useActionState(saveModelsAction, null);
  const [t, setT] = useState(text);
  const [imgs, setImgs] = useState(images);
  const tm = textModel(t);
  const dupes = new Set(imgs).size < 3;
  const noLoose = !imgs.some((id) => imageModel(id).strictness === 'loose');
  return (
    <form action={action} className="stack">
      <div className="card stack">
        <div>
          <h3>Writing model</h3>
          <p className="small muted">Adapts the text, writes the Story Bible and checks consistency.</p>
        </div>
        <Select name="text" value={t} onChange={setT} label="Writing model"
          options={TEXT_MODELS.map((m) => ({
            value: m.id,
            label: m.name,
            hint: `$${m.inPerM} / $${m.outPerM} per million tokens`,
            badge: m.recommended ? <span className="chip chip-emerald">Recommended</span> : !reachable[m.id] ? <span className="chip chip-plain">Needs a key</span> : undefined,
          }))} />
        <div className="row-wrap">
          <span className="chip chip-plain">${tm.inPerM} / ${tm.outPerM} per million tokens</span>
          {!reachable[tm.id] && <span className="chip chip-ruby">Add a key that covers this model</span>}
        </div>
        <p className="small muted">{tm.note}</p>
      </div>

      <div className="card stack">
        <div>
          <h3>Picture models</h3>
          <p className="small muted">Tried in order. If one refuses a picture (common with famous characters), the next one draws it.</p>
        </div>
        {(['Main', 'Backup 1', 'Backup 2'] as const).map((label, i) => {
          const m = imageModel(imgs[i]);
          return (
            <div key={label} className="model-slot">
              <span className="slot-name" id={`slot-${i}`}>{label}</span>
              <div style={{ minWidth: 0 }}>
                <Select labelledBy={`slot-${i}`} name={`image${i}`} value={imgs[i]}
                  onChange={(v) => setImgs((cur) => cur.map((x, j) => (j === i ? v : x)) as [string, string, string])}
                  options={IMAGE_MODELS.map((x) => ({
                    value: x.id,
                    label: x.name,
                    hint: `~$${x.perImage.toFixed(2)} a picture · ${STRICT_LABEL[x.strictness].toLowerCase()}`,
                    badge: !reachable[x.id] ? <span className="chip chip-plain">Needs a key</span> : undefined,
                  }))} />
                <div className="model-meta">
                  <span className="chip chip-plain">~${m.perImage.toFixed(2)} / picture</span>
                  <span className="chip chip-plain">~{m.seconds}s each</span>
                  <span className="chip chip-plain">Book-art match {m.bookArt}/5</span>
                  <span className="chip chip-plain">Consistency {m.consistency}/5</span>
                  <span className={`chip ${m.strictness === 'loose' ? 'chip-gold' : 'chip-plain'}`}>{STRICT_LABEL[m.strictness]}</span>
                </div>
                <p className="small muted" style={{ marginTop: 6 }}>{m.note}</p>
              </div>
            </div>
          );
        })}
        {dupes && <p className="small status-bad">One model is in two slots, so a refusal can’t fall back to something different.</p>}
        {noLoose && <p className="small status-bad">None of these has loose filters, so pictures of famous characters may be refused by all three.</p>}
      </div>
      <div className="row">
        <button className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save models'}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AddEmailForm() {
  const [state, action, pending] = useActionState(addEmailAction, null);
  return (
    <form action={action} className="stack-sm">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 220 }} type="email" name="email" placeholder="name@gmail.com" aria-label="Email to approve" required />
        <button className="btn btn-primary" disabled={pending}><Icon name="plus" size={18} /> Add account</button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function RemoveEmailButton({ email }: { email: string }) {
  return (
    <form action={removeEmailAction}>
      <input type="hidden" name="email" value={email} />
      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--ruby)' }}>Remove</button>
    </form>
  );
}

export function PinForm({ hasPin }: { hasPin: boolean }) {
  const [state, action, pending] = useActionState(setPinAction, null);
  return (
    <form action={action} className="stack">
      <p className="small muted">{hasPin ? 'A PIN is set. Enter a new one to change it.' : 'No PIN yet. Set one before you use Hand-off mode.'}</p>
      <div className="grid-2">
        <div className="field"><label className="label" htmlFor="pin">New 4-digit PIN</label><input id="pin" name="pin" className="input pin-input" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" required /></div>
        <div className="field"><label className="label" htmlFor="again">Type it again</label><input id="again" name="again" className="input pin-input" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" required /></div>
      </div>
      <div className="row">
        <button className="btn btn-primary" disabled={pending}>Save PIN</button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Which key wins when both the gateway key and a provider's own key could pay for a model. */
export function PreferDirectForm({ prefer, billing }: { prefer: boolean; billing: { model: string; key: string }[] }) {
  const [on, setOn] = useState(prefer);
  const [pending, start] = useTransition();
  return (
    <div className="stack-sm">
      <div className="toggle-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>Use a provider’s own key when I’ve added one</strong>
          <div className="small muted">
            For example, with an Anthropic key saved, Claude is billed to your Claude Console account instead of your AI Gateway balance.
            Models without their own key still use the gateway key.
          </div>
        </div>
        <Switch checked={on} label="Use a provider’s own key when I’ve added one"
          onChange={(v) => { setOn(v); start(async () => { await setPreferDirectKeysAction(v); }); }} />
      </div>
      {billing.length > 0 && (
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
          {billing.map((b) => <li key={b.model}><strong>{b.model}</strong> bills to {b.key}{pending ? '…' : ''}</li>)}
        </ul>
      )}
    </div>
  );
}
