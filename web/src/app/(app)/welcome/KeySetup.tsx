'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import Tuft, { type TuftPose } from '@/components/Tuft';
import { saveKeyAction, type FormState } from '../settings/actions';
import { finishWelcomeAction } from './actions';

// First-run key setup. Shown once: finishing or skipping sets welcomedAt, after which /welcome
// only replays the tour. Steers people to an AI Gateway key, optionally with an Anthropic key.

type Path = 'gateway' | 'both';
type Step = 'choose' | 'gateway' | 'anthropic' | 'later' | 'done';
type Saved = { gateway?: string; anthropic?: string };

const GATEWAY_KEYS = 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys%3FshowCreateKeyModal%3Dtrue&title=AI+Gateway+API+Keys';
const GATEWAY_HOME = 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway&title=Go+to+AI+Gateway';
const ANTHROPIC_KEYS = 'https://platform.claude.com/settings/keys';
const ANTHROPIC_BILLING = 'https://platform.claude.com/settings/billing';

export default function KeySetup({ saved: initial, onBack }: { saved: Saved; onBack?: () => void }) {
  const [path, setPath] = useState<Path>(initial.anthropic ? 'both' : 'gateway');
  const [step, setStep] = useState<Step>('choose');
  const [saved, setSaved] = useState<Saved>(initial);

  const flow: Step[] = path === 'both' ? ['choose', 'gateway', 'anthropic', 'done'] : ['choose', 'gateway', 'done'];
  const at = flow.indexOf(step);
  const next = () => setStep(flow[at + 1]);
  const back = () => (at > 0 ? setStep(flow[at - 1]) : onBack?.());

  return (
    <section className="card card-lg keysetup" aria-label="Set up your AI keys">
      {step !== 'later' && (
        <div className="keysetup-top">
          <span className="chip chip-plum"><Icon name="key" size={14} /> Key setup</span>
          <span className="tiny faint">Step {at + 1} of {flow.length}</span>
        </div>
      )}

      {step === 'choose' && (
        <StepBody pose="think" title="Let’s get you a key"
          lead="I need an AI key to read books, write softened editions and draw pictures. Everything you run is billed to your key at the providers’ list prices, and nobody else can use it.">
          <div className="keypath-grid" role="radiogroup" aria-label="How do you want to pay for AI?">
            <PathCard on={path === 'gateway'} onClick={() => setPath('gateway')} badge="Recommended" title="One AI Gateway key"
              desc="One Vercel key covers every writing and picture model. One balance, one bill. Takes about five minutes."
              icon={<Icon name="key" size={24} />} />
            <PathCard on={path === 'both'} onClick={() => setPath('both')} title="AI Gateway + Anthropic"
              desc="The gateway draws pictures, and Claude’s writing bills straight to your Anthropic account. Good if you already have Claude credits."
              icon={<span className="keypath-pair"><Icon name="key" size={20} /><Icon name="feather" size={20} /></span>} />
          </div>
          <div className="keysetup-nav">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('later')}>I’ll do this later in Settings</button>
            <div className="spacer" />
            {onBack && <button type="button" className="btn btn-ghost" onClick={back}><Icon name="left" size={18} /> Tour</button>}
            <button type="button" className="btn btn-primary" onClick={next}>Continue <Icon name="right" size={18} /></button>
          </div>
        </StepBody>
      )}

      {step === 'gateway' && (
        <StepBody pose="write" title="Get your Vercel AI Gateway key"
          lead="Open Vercel in a new tab, follow these steps, then paste the key back here. This page will wait for you.">
          <ol className="howto">
            <li>
              <strong>Sign in to Vercel</strong> or create a free account at <ExtLink href="https://vercel.com/signup">vercel.com/signup</ExtLink>. A Hobby account is fine.
            </li>
            <li>
              <strong>Add credits.</strong> Open <ExtLink href={GATEWAY_HOME}>AI Gateway</ExtLink>, click your credit balance in the top-right corner, pick an amount and select <em>Continue to Payment</em>.
              <div className="tiny muted">The free monthly credits only cover a few basic models, so Featherbound needs purchased credits. $20 is plenty to start: an illustrated chapter book is usually $5–$8.</div>
            </li>
            <li>
              <strong>Create a key.</strong> Open <ExtLink href={GATEWAY_KEYS}>AI Gateway → API Keys</ExtLink>, name it <code>Featherbound</code>, and select <em>Create API Key</em>.
            </li>
            <li>
              <strong>Copy it right away.</strong> Vercel shows the key only once.
            </li>
          </ol>
          <KeyPaste provider="gateway" name="Vercel AI Gateway" last4={saved.gateway}
            onSaved={(last4) => setSaved((s) => ({ ...s, gateway: last4 }))} />
          <div className="keysetup-nav">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('later')}>I’ll do this later</button>
            <div className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={back}><Icon name="left" size={18} /> Back</button>
            <button type="button" className="btn btn-primary" onClick={next} disabled={!saved.gateway}>Continue <Icon name="right" size={18} /></button>
          </div>
        </StepBody>
      )}

      {step === 'anthropic' && (
        <StepBody pose="write" title="Add your Anthropic key"
          lead="With this key, Claude’s writing bills to your Anthropic account, and your gateway key keeps drawing the pictures.">
          <ol className="howto">
            <li>
              <strong>Sign in to the Claude Console</strong> at <ExtLink href="https://platform.claude.com">platform.claude.com</ExtLink>.
            </li>
            <li>
              <strong>Check your credits</strong> under <ExtLink href={ANTHROPIC_BILLING}>Settings → Billing</ExtLink>. Add some if your balance is empty; a softened chapter book is usually $2–$4.
            </li>
            <li>
              <strong>Create a key.</strong> Open <ExtLink href={ANTHROPIC_KEYS}>Settings → API keys</ExtLink>, select <em>Create Key</em>, and name it <code>Featherbound</code>.
            </li>
            <li>
              <strong>Copy it right away.</strong> It starts with <code>sk-ant-</code> and is shown only once.
            </li>
          </ol>
          <KeyPaste provider="anthropic" name="Anthropic" last4={saved.anthropic}
            onSaved={(last4) => setSaved((s) => ({ ...s, anthropic: last4 }))} />
          <div className="keysetup-nav">
            {!saved.anthropic && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPath('gateway'); setStep('done'); }}>Skip: use the gateway for everything</button>
            )}
            <div className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={back}><Icon name="left" size={18} /> Back</button>
            <button type="button" className="btn btn-primary" onClick={next} disabled={!saved.anthropic}>Continue <Icon name="right" size={18} /></button>
          </div>
        </StepBody>
      )}

      {step === 'done' && (
        <StepBody pose="cheer" title="You’re all set!"
          lead="Your keys are checked, encrypted and saved. You can change them, or pick different models, any time in Settings → AI models & keys.">
          <ul className="keysetup-summary">
            {saved.gateway && <li><Icon name="check" size={16} stroke={3} /> <strong>AI Gateway</strong> <span className="mono small">••••{saved.gateway}</span> <span className="muted small">pays for pictures{saved.anthropic ? '' : ' and writing'}</span></li>}
            {saved.anthropic && <li><Icon name="check" size={16} stroke={3} /> <strong>Anthropic</strong> <span className="mono small">••••{saved.anthropic}</span> <span className="muted small">pays for Claude’s writing</span></li>}
          </ul>
          <div className="keysetup-nav">
            <button type="button" className="btn btn-ghost" onClick={back}><Icon name="left" size={18} /> Back</button>
            <div className="spacer" />
            <FinishButton next="/" className="btn btn-secondary">Go to my library</FinishButton>
            <FinishButton next="/add" className="btn btn-primary"><Icon name="plus" size={18} /> Add my first book</FinishButton>
          </div>
        </StepBody>
      )}

      {step === 'later' && (
        <StepBody pose="worry" title="Skip keys for now?"
          lead="You can add them later in Settings → AI models & keys. Until you do, Featherbound won’t work properly.">
          <div className="keysetup-warn" role="alert">
            <Icon name="info" size={20} />
            <div>
              <strong>Without a key, I can’t:</strong>
              <ul>
                <li>read your books or make content reports</li>
                <li>write sample chapters or softened editions</li>
                <li>draw pictures</li>
              </ul>
              <span className="small">You can still upload books and read the originals.</span>
            </div>
          </div>
          <div className="keysetup-nav">
            <FinishButton next="/" className="btn btn-ghost">Skip anyway</FinishButton>
            <div className="spacer" />
            <button type="button" className="btn btn-primary" onClick={() => setStep(saved.gateway ? 'choose' : 'gateway')}>
              <Icon name="key" size={18} /> Add a key now
            </button>
          </div>
        </StepBody>
      )}
    </section>
  );
}

function StepBody({ pose, title, lead, children }: { pose: TuftPose; title: string; lead: string; children: ReactNode }) {
  return (
    <div className="stack">
      <div className="keysetup-head">
        <Tuft pose={pose} size={72} />
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <h2>{title}</h2>
          <p className="muted">{lead}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function PathCard({ on, onClick, title, desc, icon, badge }: { on: boolean; onClick: () => void; title: string; desc: string; icon: ReactNode; badge?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`mode-card keypath ${on ? 'on' : ''}`} onClick={onClick}>
      <span className="keypath-icon" aria-hidden="true">{icon}</span>
      <strong>{title} {badge && <span className="chip chip-emerald">{badge}</span>}</strong>
      <span className="small muted">{desc}</span>
      {on && <span className="mode-check"><Icon name="check" size={14} stroke={3} /></span>}
    </button>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="link">{children}<Icon name="arrow" size={12} /></a>;
}

/** Paste box that checks the key with the provider before saving (same action as Settings). */
function KeyPaste({ provider, name, last4, onSaved }: { provider: 'gateway' | 'anthropic'; name: string; last4?: string; onSaved: (last4: string) => void }) {
  const [value, setValue] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await saveKeyAction(prev, form);
    if (result?.ok) { onSaved(String(form.get('key') ?? '').trim().slice(-4)); setReplacing(false); setValue(''); }
    return result;
  }, null);

  if (last4 && !replacing) {
    return (
      <div className="keypaste keypaste-ok" role="status">
        <Icon name="check" size={18} stroke={3} />
        <span><strong>{name} key saved and working</strong> <span className="mono small">••••{last4}</span></span>
        {state?.ok && state.message && <span className="tiny muted">{state.message.replace(/^Saved and working\.\s*/, '')}</span>}
        <div className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplacing(true)}>Replace</button>
      </div>
    );
  }
  return (
    <form action={action} className="keypaste">
      <label className="label" htmlFor={`key-${provider}`}>Paste your {name} key</label>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input type="hidden" name="provider" value={provider} />
        <input id={`key-${provider}`} className="input" style={{ flex: 1, minWidth: 220 }} name="key" type="password" autoComplete="off" spellCheck={false}
          value={value} onChange={(e) => setValue(e.target.value)} placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'Your AI Gateway key'} required />
        <button className="btn btn-primary" disabled={pending || value.trim().length === 0}>{pending ? 'Checking…' : 'Check and save'}</button>
        {replacing && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplacing(false)}>Cancel</button>}
      </div>
      {state && !state.ok && state.message && <p className="small status-bad" role="status"><Icon name="info" size={14} className="inline-icon" /> {state.message}</p>}
      <p className="tiny faint">I check the key with {provider === 'anthropic' ? 'Anthropic' : 'Vercel'}, then encrypt it. It’s never shown again, only its last four characters.</p>
    </form>
  );
}

function FinishButton({ next, className, children }: { next: '/' | '/add'; className: string; children: ReactNode }) {
  return (
    <form action={finishWelcomeAction}>
      <input type="hidden" name="next" value={next} />
      <Submit className={className}>{children}</Submit>
    </form>
  );
}

function Submit({ className, children }: { className: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{children}</button>;
}
