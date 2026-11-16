// The one place football reaches the Game Design V2 pieces other teams write (Claude, studio
// overhaul nfl-1): nba's stick, gold-ring maths, Heat and HUD kit (src/game/Stick.tsx, stick.ts,
// perfect.ts, heat.ts, hud/*, controls-geometry.css), and ut's haptics and playtime
// (src/lib/haptics.ts, playtime.ts). imports.test.ts fails if any other football file imports
// those modules directly.
//
// Until those files reach this branch, this module is a thin local version of the contracts
// written down in docs/studio-overhaul/nfl.md (C15-C21): the same names and signatures, pure
// maths where the contract is pure, and pass-throughs to today's sound and vibrate where it is
// feedback. At the merge the lead replaces each body with a re-export from the real module (a
// merge step listed in nfl.md); football code does not change. Nothing here reads a clock or a
// random number, so engine code may call the maths.
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { sfx, vibrate } from '../../lib/sound';

/** A point or vector in screen or field units. */
export interface Vec {
  x: number;
  y: number;
}

// ---------- C15: control geometry (nba's controls-geometry.css) ----------

/** Safe-area insets in CSS px. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The V2 §A.5 geometry for a screen, as the C15 custom properties (CSS px, inset-aware). The table
 * has two columns, 393×852 and 320×568; a phone between them (or bigger, up to 1.25 of the step)
 * takes the blend by whichever of its width and height is the tighter fit, so a short phone keeps
 * compact controls. Landscape takes the compact column, pushed in by the side insets. Button centres
 * are offsets from the screen's right and bottom edges, the stick ghost from its left and bottom.
 * The real file switches these on `.arcade-full` from the stage; this local version is applied by
 * Football2 as an inline style, so nothing moves when the real one lands.
 */
export function controlGeometry(w: number, h: number, ins: Insets): Record<string, string> {
  const wide = w > h;
  const k = wide ? 0 : Math.max(0, Math.min(1.25, (w - 320) / 73, (h - 568) / 284));
  const at = (c: number, a: number) => Math.round((c + (a - c) * k) * 10) / 10;
  const px = (v: number) => v + 'px';
  const sab = ins.bottom,
    sat = ins.top,
    sar = ins.right,
    sal = ins.left;
  // [320 column, 393 column]: diameter, centre from the right edge, centre above the safe bottom
  const btn = { a: [84, 92, 54, 70, 58, 80], b: [56, 64, 130, 155, 32, 40], c: [44, 48, 120, 143, 100, 124], d: [44, 48, 38, 53, 132, 166] } as const;
  const out: Record<string, string> = {};
  for (const [id, [d0, d1, r0, r1, b0, b1]] of Object.entries(btn)) {
    out['--ctl-' + id + '-d'] = px(at(d0, d1));
    out['--ctl-' + id + '-right'] = px(at(r0, r1) + sar);
    out['--ctl-' + id + '-bottom'] = px(at(b0, b1) + sab);
  }
  Object.assign(out, {
    '--stick-d': px(at(104, 120)),
    '--stick-ghost-left': px(at(70, 84) + sal),
    '--stick-ghost-bottom': px(at(72, 88) + sab),
    '--stick-zone-w': px(Math.round(w * 0.48)),
    '--stick-zone-h': px(Math.round(h * 0.55)),
    '--safe-top': px(sat + 56),
    '--safe-bottom': px(sab + at(200, 250)),
    '--bug-w': px(at(200, 232)),
    '--bug-h': px(at(34, 40)),
    '--bug-top': px(sat + at(4, 6)),
    '--heat-h': px(at(5, 6)),
    '--toast-bottom': px(sab + at(164, 200)),
    '--pause-top': px(sat + at(0, 4)),
    '--pause-left': px(sal + at(6, 12))
  });
  return out;
}

// ---------- C16: the stick (nba's stick.ts) ----------

/** Below this share of the radius the stick reads as centred. */
export const STICK_DEAD = 0.12;

/**
 * The stick vector for a thumb at `point` on a stick centred at `origin` with travel `radius`
 * (screen pixels, y down). `vec` is in -1..1 with y UP, rescaled past the dead zone and capped at
 * length 1; `mag` is the raw travel as a share of the radius (it can pass 1); `sprint` is set once
 * the thumb is past the sprint ring, `sprintAt` radii out.
 */
export function stickFrom(origin: Vec, point: Vec, radius: number, sprintAt = 1.15): { vec: Vec; mag: number; sprint: boolean } {
  const r = radius > 0 ? radius : 1;
  const dx = (point.x - origin.x) / r;
  const dy = (origin.y - point.y) / r;
  const mag = Math.hypot(dx, dy);
  if (!Number.isFinite(mag) || mag <= STICK_DEAD) return { vec: { x: 0, y: 0 }, mag: Number.isFinite(mag) ? mag : 0, sprint: false };
  const len = Math.min(1, (mag - STICK_DEAD) / (1 - STICK_DEAD));
  return { vec: { x: (dx / mag) * len, y: (dy / mag) * len }, mag, sprint: mag >= sprintAt };
}

/** What Stick.tsx's imperative handle reads each frame (no React state). */
export interface StickRead {
  vec: Vec | null;
  sprint: boolean;
  heldSince: number | null;
}

export interface StickHandle {
  read(): StickRead;
  /** let go (a new play, the game paused, the touch taken away) */
  release(): void;
}

export interface StickProps {
  /** whether the zone takes touches (pre-snap too: a thumb resting there is live at the snap) */
  active: boolean;
  /** draw the ring where the thumb would land (the ghost) while nothing holds it */
  ghost?: boolean;
  /** a word above the ghost (HOLD TO RUN) */
  label?: string;
  /** hide the ring until a thumb lands (pre-snap) */
  quiet?: boolean;
  sprintAt?: number;
  onDown?: (e: React.PointerEvent) => void;
  onMove?: (vec: Vec, sprint: boolean, e: React.PointerEvent) => void;
  onUp?: (e: React.PointerEvent | null) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onKeyUp?: (e: React.KeyboardEvent) => void;
}

/**
 * The floating stick (C16, local version of nba's Stick.tsx). It lives in the C15 zone; the ring
 * jumps to wherever the thumb lands (kept on screen) and sits at the ghost spot otherwise. The knob
 * and the ring move by ref, so a drag never re-renders the game. Pushing past `sprintAt` radii sets
 * `sprint` with a haptic tick.
 */
export const Stick = forwardRef<StickHandle, StickProps>(function Stick(props, ref) {
  const zone = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLElement>(null);
  const st = useRef<{ id: number; o: Vec; r: number; vec: Vec; sprint: boolean; since: number } | null>(null);
  const sprintAt = props.sprintAt ?? 1.15;
  const draw = () => {
    const s = st.current;
    const z = zone.current,
      rg = ring.current,
      kb = knob.current;
    if (!z || !rg || !kb) return;
    z.classList.toggle('held', !!s);
    z.classList.toggle('sprint', !!s?.sprint);
    if (!s) {
      rg.style.transform = '';
      kb.style.transform = '';
      return;
    }
    // the ring's centre sits on the thumb (the ring element is laid out at the ghost spot)
    const zr = z.getBoundingClientRect();
    const gr = rg.offsetParent === z ? { x: rg.offsetLeft + rg.offsetWidth / 2, y: rg.offsetTop + rg.offsetHeight / 2 } : { x: 0, y: 0 };
    rg.style.transform = 'translate(' + Math.round(s.o.x - zr.left - gr.x) + 'px,' + Math.round(s.o.y - zr.top - gr.y) + 'px)';
  };
  const release = (e: React.PointerEvent | null) => {
    if (!st.current) return;
    st.current = null;
    draw();
    props.onUp?.(e);
  };
  useImperativeHandle(ref, () => ({
    read: () => {
      const s = st.current;
      return s ? { vec: s.vec, sprint: s.sprint, heldSince: s.since } : { vec: null, sprint: false, heldSince: null };
    },
    release: () => release(null)
  }));
  const moveTo = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    const r = stickFrom(s.o, { x: e.clientX, y: e.clientY }, s.r, sprintAt);
    const was = s.sprint;
    // the knob shows the thumb up to the sprint ring
    const l = Math.min(r.mag, sprintAt);
    const raw = r.mag > 0 ? { x: ((e.clientX - s.o.x) / s.r / r.mag) * l, y: ((s.o.y - e.clientY) / s.r / r.mag) * l } : { x: 0, y: 0 };
    s.vec = r.vec;
    s.sprint = r.sprint;
    if (r.sprint && !was) haptic('tick');
    zone.current?.classList.toggle('sprint', r.sprint);
    const kb = knob.current;
    if (kb) kb.style.transform = 'translate(' + Math.round(raw.x * s.r) + 'px,' + Math.round(-raw.y * s.r) + 'px)';
    props.onMove?.(r.vec, r.sprint, e);
  };
  return React.createElement(
    'div',
    {
      ref: zone,
      className: 'v2-stick' + (props.active ? '' : ' off') + (props.quiet ? ' quiet' : '') + (props.ghost ? ' ghost' : ''),
      role: 'group',
      'aria-label': 'Movement stick: touch anywhere here and drag; push past the ring to burst. Arrow keys or WASD.',
      tabIndex: props.active ? 0 : -1,
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (!props.active || st.current) return;
        e.preventDefault();
        const d = parseFloat(getComputedStyle(e.currentTarget).getPropertyValue('--stick-d')) || 120;
        const r = d / 2;
        // the ring floats to the thumb, kept on screen
        const o = { x: Math.max(r + 4, Math.min(window.innerWidth - r - 4, e.clientX)), y: Math.max(r + 4, Math.min(window.innerHeight - r - 4, e.clientY)) };
        st.current = { id: e.pointerId, o, r, vec: { x: 0, y: 0 }, sprint: false, since: e.timeStamp };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        draw();
        props.onDown?.(e);
        moveTo(e);
      },
      onPointerMove: moveTo,
      onPointerUp: (e: React.PointerEvent) => st.current?.id === e.pointerId && release(e),
      onPointerCancel: (e: React.PointerEvent) => st.current?.id === e.pointerId && release(e),
      onLostPointerCapture: (e: React.PointerEvent) => st.current?.id === e.pointerId && release(e),
      onKeyDown: props.onKeyDown,
      onKeyUp: props.onKeyUp
    },
    React.createElement(
      'div',
      { ref: ring, className: 'v2-stick-ring' },
      React.createElement('i', { ref: knob }),
      props.label ? React.createElement('b', { className: 'v2-stick-label' }, props.label) : null
    )
  );
});

// ---------- C17: the gold ring (nba's perfect.ts) ----------

export type Ring = 'gold' | 'amber' | 'red';
/** A timing window in engine seconds, and whether gold is on offer in it. */
export interface RingWindow {
  center: number;
  half: number;
  state: Ring;
}
export type Judgement = 'perfect' | 'good' | 'early' | 'late';

/** The narrowest half-window (s): a 95 and a 70 both get something a thumb can hit. */
export const MIN_HALF = 0.03;
/** On Fire widens every window by this much. */
export const FIRE_SCALE = 1.25;

/** A window's half-width (s) from its base, the rating scale and On Fire; never below MIN_HALF. */
export function windowHalf(base: number, scale: number, fire: boolean): number {
  const h = base * scale * (fire ? FIRE_SCALE : 1);
  return Number.isFinite(h) ? Math.max(MIN_HALF, h) : MIN_HALF;
}

/**
 * A release at engine time `at` against a window. Inside the half-window it is 'perfect' when
 * gold is on offer and 'good' otherwise ("gold never lies": amber and red never say perfect);
 * within twice the half-window it is 'good'; beyond, 'early' or 'late'.
 */
export function judge(at: number, w: RingWindow): Judgement {
  const d = at - w.center;
  if (Math.abs(d) <= w.half) return w.state === 'gold' ? 'perfect' : 'good';
  if (Math.abs(d) <= 2 * w.half) return 'good';
  return d < 0 ? 'early' : 'late';
}

/**
 * A touch's engine time: its event timestamp, less the device's measured input lag, counted from
 * an anchor that pairs a performance.now() reading with the engine time at that moment. Done once
 * at the input; the engine only ever sees the resulting number.
 */
export function touchTime(e: { timeStamp: number }, anchor: { perf: number; engine: number }, lagMs: number): number {
  return anchor.engine + (e.timeStamp - (Number.isFinite(lagMs) ? lagMs : 0) - anchor.perf) / 1000;
}

/** The device's input lag (ms) from nba's one-time "tap on the beat"; 0 until that lands. */
export function calibrationLag(): number {
  return 0;
}

// ---------- C18: Heat (nba's heat.ts); the NFL table is filled in nfl-4 ----------

export interface Heat {
  /** 0-100 */
  pts: number;
  /** On Fire units left */
  fire: number;
  /** the most pts this match */
  best: number;
  /** times On Fire this match */
  lit: number;
}
export type HeatEv = 'perfect' | 'score' | 'stop' | 'clean' | 'turnover' | 'conceded' | 'half';
export const HEATING = 66;
export const FULL = 100;

// ---------- C19: the HUD kit (nba's hud/*); football's labels go through these props ----------

export interface ScoreBugProps {
  us: number;
  them: number;
  /** 'DRIVE 3', 'OT', 'CLUTCH' */
  label: string;
  clock?: string;
  heatUs: number;
  heatThem: number;
  fireUs: boolean;
  fireThem: boolean;
  /** 0-1, the 3 px pip line */
  progress: number;
}

/** The pause button (C19's PauseButton, local version): 44×44 at the C15 pause slot, fires on touch-down. */
export function PauseButton({ onPause }: { onPause: () => void }) {
  return React.createElement(
    'button',
    {
      type: 'button',
      className: 'v2-pause',
      'data-ctl': 'pause',
      'aria-label': 'Pause',
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onPause();
      },
      onClick: (e: React.MouseEvent) => {
        // a keyboard press (a pointer press already paused on touch-down)
        if (e.detail === 0) onPause();
      }
    },
    React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 18 18', 'aria-hidden': true }, React.createElement('rect', { x: 3, y: 2, width: 4.5, height: 14, rx: 1.4, fill: 'currentColor' }), React.createElement('rect', { x: 10.5, y: 2, width: 4.5, height: 14, rx: 1.4, fill: 'currentColor' }))
  );
}

// ---------- C20: haptics (ut's lib/haptics.ts) and the PERFECT chime ----------

export type HapticKind = 'tick' | 'double' | 'long';
const PATTERNS: Record<HapticKind, number | number[]> = { tick: 10, double: [12, 40, 12], long: 45 };

/** A haptic by kind; today the shared vibrate (which honours the haptics setting and iOS rules). */
export function haptic(kind: HapticKind) {
  vibrate(PATTERNS[kind]);
}

/** The PERFECT chime for the `streak`-th perfect in a row; today the existing two-note coin cue. */
export function perfectChime(streak: number) {
  void streak;
  sfx.coin();
}

// ---------- C21: playtime (ut's lib/playtime.ts) ----------

export interface Playtime {
  /** a gameplay or play-call input (never an auto snap, Auto-defend, SIM or replay) */
  input(): void;
  pause(on: boolean): void;
  complete(): void;
  abandon(elapsedMs: number): void;
}
const NO_PLAYTIME: Playtime = { input() {}, pause() {}, complete() {}, abandon() {} };

/** The match's playtime meter; a no-op until ut's module lands (it counts nothing yet). */
export function usePlaytime(kind: 'match'): Playtime {
  void kind;
  return NO_PLAYTIME;
}
