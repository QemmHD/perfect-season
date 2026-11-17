// Claude, 2026-11-01 (UI reorganisation, docs/UI-NAVIGATION.md): the small shared pieces every
// Ultimate Team screen is built from, so they all read alike: a segmented control for a tab's
// sections, a one-line explainer instead of a big in-page title, compact mode/list rows with a live
// status line, section heads and empty states. Styles: nav.css.
import React from 'react';
import { IconChevron } from './icons';

export function Segmented<T extends string>(props: {
  label: string;
  items: [T, string][];
  value: T;
  onChange: (v: T) => void;
  /** a count shown on a segment (something to claim there) */
  badges?: Partial<Record<T, number>>;
  className?: string;
}) {
  const i = Math.max(0, props.items.findIndex(([k]) => k === props.value));
  return (
    <div
      className={'ut-segs' + (props.className ? ' ' + props.className : '')}
      role="tablist"
      aria-label={props.label}
      style={{ '--n': props.items.length, '--i': i } as React.CSSProperties}
    >
      <span className="ut-segs-ind" aria-hidden="true" />
      {props.items.map(([k, label]) => {
        const n = props.badges?.[k] ?? 0;
        return (
          <button key={k} role="tab" aria-selected={k === props.value} onClick={() => k !== props.value && props.onChange(k)}>
            <span>{label}</span>
            {n > 0 && <i className="ut-segs-n num">{n}</i>}
          </button>
        );
      })}
    </div>
  );
}

/** A screen's one-line explainer (the screen's name is already in the top bar). */
export function Lede({ children }: { children: React.ReactNode }) {
  return <p className="ut-lede">{children}</p>;
}

export function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="ut-sechead">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </div>
  );
}

/** A compact row that opens something: an icon tile, a name, a live status line and a chevron or
 * a count. `tone` tints the icon tile; `live` adds the pulsing "in progress" dot. */
export function ModeRow(props: {
  icon: React.ReactNode;
  title: string;
  status?: React.ReactNode;
  tone?: 'teal' | 'gold' | 'violet' | 'red' | 'blue';
  live?: boolean;
  badge?: number;
  pill?: string;
  onClick: () => void;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button className={'ut-row' + (props.tone ? ' tone-' + props.tone : '') + (props.className ? ' ' + props.className : '')} onClick={props.onClick} aria-label={props.label} style={props.style}>
      <span className="ut-row-icon" aria-hidden="true">
        {props.icon}
        {props.live && <i className="ut-row-live" />}
      </span>
      <span className="ut-row-txt">
        <b>{props.title}</b>
        {props.status && <small>{props.status}</small>}
      </span>
      {props.pill && <em className="ut-row-pill">{props.pill}</em>}
      {props.badge ? <i className="ut-row-n num">{props.badge}</i> : <IconChevron size={18} />}
    </button>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="ut-empty">
      {icon && <span className="ut-empty-icon">{icon}</span>}
      <b>{title}</b>
      {children && <small>{children}</small>}
    </div>
  );
}

/** Staggered entrance for list items (CSS `rise-in`, off with reduced motion). */
export const stagger = (i: number): React.CSSProperties => ({ animationDelay: Math.min(i, 10) * 35 + 'ms' });
