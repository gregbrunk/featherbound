import { useEffect } from 'react';
import type { ReactNode } from 'react';
import Tuft from './Tuft';
import type { TuftPose } from './Tuft';
import Icon from './Icon';

export function Modal({ onClose, children, wide = false, label }: { onClose: () => void; children: ReactNode; wide?: boolean; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function ModalHead({ title, onClose, pose }: { title: string; onClose: () => void; pose?: TuftPose }) {
  return (
    <div className="row" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
      {pose && <Tuft pose={pose} size={52} />}
      <h2 style={{ flex: 1, alignSelf: 'center' }}>{title}</h2>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
        <Icon name="x" />
      </button>
    </div>
  );
}

export function Guide({ pose = 'hello', children, size = 72 }: { pose?: TuftPose; children: ReactNode; size?: number }) {
  return (
    <div className="guide">
      <Tuft pose={pose} size={size} />
      <div className="bubble">{children}</div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function Segmented<T extends string>({
  value, options, onChange, label, classFor,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  classFor?: (v: T) => string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`${value === o.value ? 'on' : ''} ${classFor?.(o.value) ?? ''}`}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProtoNote({ children }: { children: ReactNode }) {
  return (
    <div className="proto-note">
      <Icon name="info" size={18} />
      <div>{children}</div>
    </div>
  );
}

export function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function tokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
