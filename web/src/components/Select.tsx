'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import Icon from './Icon';

// Featherbound's themed dropdown. Use it for every choice list; the app never uses a native
// <select>. It follows the ARIA "select-only combobox" pattern: a button that opens a listbox,
// with arrow keys, Home/End, Enter/Space, Escape and type-to-jump.

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  hint?: string;
  badge?: ReactNode;
  disabled?: boolean;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** Accessible name, used when there's no visible <label>. */
  label?: string;
  /** id of a visible label element. */
  labelledBy?: string;
  /** Adds a hidden input so the value is submitted with a <form>. */
  name?: string;
  className?: string;
  style?: CSSProperties;
};

export default function Select<T extends string>({ value, onChange, options, label, labelledBy, name, className = '', style }: Props<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const [above, setAbove] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const openList = () => {
    const rect = button.current?.getBoundingClientRect();
    if (rect) setAbove(window.innerHeight - rect.bottom < 280 && rect.top > window.innerHeight - rect.bottom);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    button.current?.focus();
  };

  const move = (from: number, step: number) => {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i;
    return from;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive((a) => move(a, 1)); break;
      case 'ArrowUp': e.preventDefault(); setActive((a) => move(a, -1)); break;
      case 'Home': e.preventDefault(); setActive(move(-1, 1)); break;
      case 'End': e.preventDefault(); setActive(move(options.length, -1)); break;
      case 'Enter': case ' ': e.preventDefault(); choose(active); break;
      case 'Escape': e.preventDefault(); setOpen(false); break;
      case 'Tab': setOpen(false); break;
      default:
        if (e.key.length === 1) {
          const now = Date.now();
          typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
          const hit = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
          if (hit >= 0) setActive(hit);
        }
    }
  };

  return (
    <div ref={root} className={`fb-select ${open ? 'open' : ''} ${className}`} style={style}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        className="fb-select-button"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="fb-select-value">
          <span className="ellipsis">{selected?.label}</span>
          {selected?.badge}
        </span>
        <Icon name="down" size={18} className="fb-select-chevron" />
      </button>
      {open && (
        <ul ref={list} id={listId} role="listbox" aria-label={label} className={`fb-select-list ${above ? 'above' : ''}`}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              className={`fb-select-option ${i === active ? 'active' : ''} ${o.value === value ? 'selected' : ''}`}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span className="fb-select-check">{o.value === value && <Icon name="check" size={16} stroke={3} />}</span>
              <span className="fb-select-text">
                <span className="row" style={{ gap: 8 }}><span>{o.label}</span>{o.badge}</span>
                {o.hint && <span className="tiny muted">{o.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
