// Claude, 2026-11-10 (studio overhaul, team ut): the Ultimate Team visual kit. One set of pieces
// for every new UT surface (Hub, PreMatch, the match recap, Objectives, Season Pass, the main Home
// bridge), so screens read alike and are restyled once: section titles, reward chips, GO chips, the
// CLAIM button, the one primary button per screen, countdowns, progress rings and empty states.
// Styles and the motion/press tokens are in ut-system.css. Light on purpose: no card data, pool or
// pack imports, so the main Home can use it in its first-paint chunk. Callers pass card or pack art
// into `RewardChip` themselves.
import React, { useEffect, useState } from 'react';
import { sfx, tapHaptic } from '../lib/sound';
import { reducedMotion } from '../ui/motion';
import { IconCheck, IconChevron, IconCoins, IconGift, IconPass, IconStar } from './icons';
import './ut-system.css';

/** The one navigation motion spec, in ms (CSS: --ut-push, --ut-pop, --ut-tab, --ut-sheet). */
export const MOTION = { push: 200, pop: 160, tab: 120, sheet: 240 } as const;
export type MotionKind = keyof typeof MOTION;
/** A transition's length for JS-driven motion: 0 under reduced motion. */
export const motionMs = (kind: MotionKind): number => (reducedMotion() ? 0 : MOTION[kind]);

/** A section's 20 px display title, with an optional aside (a count, a countdown) and action. */
export function SectionTitle(props: { title: string; aside?: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div className="ut-k-sec">
      <h2 className="ut-k-title" id={props.id}>
        {props.title}
      </h2>
      {props.aside}
      {props.action}
    </div>
  );
}

export type RewardKind = 'coins' | 'pack' | 'card' | 'pick' | 'sp' | 'xp';

const PACK_TINT: Record<'bronze' | 'silver' | 'gold' | 'special', [string, string]> = {
  bronze: ['#e0a272', '#8a5330'],
  silver: ['#eef3f6', '#8c9ba5'],
  gold: ['#ffe08a', '#d99a1c'],
  special: ['#b9a4ff', '#4b2fa8'],
};

/** A small foil pack, for a reward chip when no pack art is passed in. */
function MiniPack({ tier = 'gold' }: { tier?: keyof typeof PACK_TINT }) {
  const [a, b] = PACK_TINT[tier];
  const id = 'ut-k-pack-' + tier;
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <path d="M2 1h12l1 2-1 1v13l1 1-1 1H2l-1-1 1-1V4L1 3z" fill={'url(#' + id + ')'} />
      <path d="M3 7h10M3 13h10" stroke="rgba(0,0,0,.25)" strokeWidth="1" />
    </svg>
  );
}

/**
 * What a reward is, at a glance: art plus a short label ("500" coins, "Gold Pack", "+80 SP").
 * `art` takes a mini `PackArt` or `UtCard` from the caller; otherwise a built-in SVG is drawn.
 */
export function RewardChip(props: {
  kind: RewardKind;
  label: string;
  /** the number drawn bold before the label (coins, SP, XP) */
  amount?: number;
  art?: React.ReactNode;
  tier?: keyof typeof PACK_TINT;
}) {
  const art =
    props.art ??
    {
      coins: <IconCoins size={16} />,
      pack: <MiniPack tier={props.tier} />,
      card: <IconStar size={15} />,
      pick: <IconGift size={15} />,
      sp: <IconPass size={15} />,
      xp: <IconStar size={15} />,
    }[props.kind];
  return (
    <span className="ut-k-reward" data-kind={props.kind}>
      <i aria-hidden="true">{art}</i>
      <span>
        {props.amount !== undefined && <b className="num">{props.amount.toLocaleString('en-US')} </b>}
        {props.label}
      </span>
    </span>
  );
}

/** A compact "GO" that leads to where a task is done (44 px hit area around a 32 px chip). */
export function GoChip(props: { onClick: () => void; label?: string; ariaLabel?: string }) {
  return (
    <button type="button" className="ut-k-go" onClick={props.onClick} aria-label={props.ariaLabel}>
      {props.label ?? 'GO'}
      <IconChevron size={14} />
    </button>
  );
}

/** Restart the spark burst on a claim button (a CSS animation; skipped under reduced motion). */
function burst(el: HTMLElement) {
  if (reducedMotion()) return;
  el.removeAttribute('data-burst');
  void el.offsetWidth;
  el.setAttribute('data-burst', '');
}

/**
 * The gold CLAIM button. The haptic fires only inside its own pointer handler, while the finger is
 * on it (iOS allows a tick only inside a gesture; a haptic called later would land on an unrelated
 * tap). The claim itself (and its spark burst and coin sound) happens on click, so keyboard and
 * assistive activation claim too, silently.
 */
export function ClaimButton(props: { onClaim: () => void; label?: string; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button
      type="button"
      className="ut-k-claim"
      disabled={props.disabled}
      aria-label={props.ariaLabel}
      onPointerDown={() => {
        if (!props.disabled) tapHaptic();
      }}
      onClick={(e) => {
        burst(e.currentTarget);
        sfx.coin();
        props.onClaim();
      }}
    >
      <IconCheck size={16} />
      <span>{props.label ?? 'CLAIM'}</span>
    </button>
  );
}

/** A screen's one primary action: 56 px, full width, marked `data-primary` for the QA count. */
export function PrimaryButton(props: {
  children: React.ReactNode;
  onClick: () => void;
  /** a short second line under the label ("About 5 min") */
  sub?: string;
  tone?: 'teal' | 'gold';
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className={'ut-k-primary' + (props.tone === 'gold' ? ' gold' : '')}
      data-primary=""
      disabled={props.disabled}
      aria-label={props.ariaLabel}
      onClick={props.onClick}
    >
      <span>{props.children}</span>
      {props.sub && <small>{props.sub}</small>}
    </button>
  );
}

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** "2d 4h" / "3h 12m" / "12m": minutes round up, so time that is left never reads 0m. */
export function countdownText(ms: number): string {
  if (!(ms > 0)) return '0m';
  const total = Math.ceil(ms / MIN);
  const d = Math.floor(total / 1440);
  if (d >= 1) return d + 'd ' + Math.floor((total % 1440) / 60) + 'h';
  return total >= 60 ? Math.floor(total / 60) + 'h ' + (total % 60) + 'm' : total + 'm';
}

/** Amber in the last 24 hours; `over` once it has passed. */
export function countdownTone(ms: number): 'calm' | 'amber' | 'over' {
  return !(ms > 0) ? 'over' : ms < DAY ? 'amber' : 'calm';
}

/** Time left until `to` (epoch ms), refreshed every 30 s. No ticking animation, in any mode. */
export function Countdown(props: { to: number; prefix?: string; now?: () => number }) {
  const clock = props.now ?? Date.now;
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = props.to - clock();
  const text = countdownText(left);
  return (
    <span className="ut-k-count num" data-tone={countdownTone(left)} role="timer" aria-label={(props.prefix ? props.prefix + ' ' : '') + text}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 3.4V6l1.8 1.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {props.prefix && <span>{props.prefix}</span>}
      {text}
    </span>
  );
}

/** Progress toward a goal as a ring (gold when complete), with the count or a label inside. */
export function ProgressRing(props: { value: number; max: number; size?: number; label?: React.ReactNode; ariaLabel?: string }) {
  const size = props.size ?? 44;
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const share = props.max > 0 ? Math.max(0, Math.min(1, props.value / props.max)) : 0;
  const done = share >= 1;
  return (
    <span
      className="ut-k-ring"
      style={{ width: size, height: size }}
      data-done={done ? '' : undefined}
      role="img"
      aria-label={props.ariaLabel ?? Math.min(props.value, props.max) + ' of ' + props.max}
    >
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} />
        <circle cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} strokeDashoffset={c * (1 - share)} />
      </svg>
      <b className="num" aria-hidden="true">
        {props.label ?? Math.min(props.value, props.max) + '/' + props.max}
      </b>
    </span>
  );
}

/** An empty list says what goes here and leads somewhere: an icon, one line and a way forward. */
export function EmptyState(props: { icon: React.ReactNode; line: string; cta: { label: string; onClick: () => void } }) {
  return (
    <div className="ut-k-empty">
      <i aria-hidden="true">{props.icon}</i>
      <p>{props.line}</p>
      <GoChip label={props.cta.label} onClick={props.cta.onClick} />
    </div>
  );
}
