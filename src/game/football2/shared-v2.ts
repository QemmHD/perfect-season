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
import { pickFor, type PerSport, type SportId } from '../../engine/sport';
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

/**
 * The dial a ring is drawn as (nfl-4; V2 §B.0.1: "its angular size is the real window"). A sweep
 * goes once round the ring in `sweep` seconds and reaches the middle of the window at GOLD_AT of a
 * turn (three quarters: the last quarter is the late side). Shares of a turn, clockwise from 12.
 */
export const GOLD_AT = 0.75;
export function ringDial(now: number, w: RingWindow, sweep: number): { at: number; from: number; to: number } {
  const s = sweep > 0 ? sweep : 1;
  const k = (t: number) => GOLD_AT - (w.center - t) / s;
  return { at: k(now), from: k(w.center - w.half), to: k(w.center + w.half) };
}

/** The window's segment on a ring of radius `r` (px): its arc length, the size a thumb sees. */
export function goldArcPx(w: Pick<RingWindow, 'half'>, sweep: number, r: number): number {
  return (2 * Math.PI * r * 2 * w.half) / (sweep > 0 ? sweep : 1);
}

/** Ring colours by state (gold, amber, red) and the track under them. */
export const RING_INK: Record<Ring, string> = { gold: '#ffd23a', amber: '#ff9a2a', red: '#ff4a4a' };

/**
 * Draw a dial ring (the C17 PerfectRing, local version) in canvas pixels: a dark track, the window's
 * segment in its state's colour (none when red: the whole ring is red), the sweep so far, and an
 * outer ring that closes onto it as the moment comes (it closes under reduced motion too: it carries
 * the timing). `lw` is the stroke in canvas px; `glow` adds the soft halo (off under reduced motion).
 */
export function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dial: { at: number; from: number; to: number }, state: Ring, opts: { lw: number; glow: boolean }) {
  const ang = (k: number) => -Math.PI / 2 + 2 * Math.PI * k;
  const lw = Math.max(1, opts.lw);
  ctx.save();
  ctx.lineCap = 'butt';
  // the track
  ctx.lineWidth = lw + 2;
  ctx.strokeStyle = 'rgba(4,10,16,0.78)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = lw;
  ctx.strokeStyle = state === 'red' ? 'rgba(255,74,74,0.85)' : 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // the sweep so far (from 12 o'clock to now)
  const at = Math.max(0, Math.min(1, dial.at));
  if (at > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x, y, r, ang(0), ang(at));
    ctx.stroke();
  }
  // the window
  if (state !== 'red') {
    ctx.strokeStyle = RING_INK[state];
    ctx.lineWidth = lw * 1.7;
    if (opts.glow) {
      ctx.shadowColor = RING_INK[state];
      ctx.shadowBlur = lw * 3;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, ang(dial.from), ang(dial.to));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  // the needle: a bright tick where the sweep is
  if (dial.at >= 0 && dial.at <= 1.02) {
    const a = ang(dial.at);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, lw * 0.8);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - lw * 1.6), y + Math.sin(a) * (r - lw * 1.6));
    ctx.lineTo(x + Math.cos(a) * (r + lw * 1.6), y + Math.sin(a) * (r + lw * 1.6));
    ctx.stroke();
  }
  // the closing ring: wide while the moment is far, on the ring as it comes
  const left = GOLD_AT - dial.at;
  if (left > 0 && state !== 'red') {
    const rr = r * (1 + 0.9 * Math.min(1, left / GOLD_AT));
    ctx.globalAlpha = 0.35 + 0.5 * (1 - Math.min(1, left / GOLD_AT));
    ctx.strokeStyle = RING_INK[state];
    ctx.lineWidth = Math.max(1, lw * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- C18: Heat (nba's heat.ts) with the V2 tables ----------

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
/** A match's Heat before anything has happened. */
export const COLD: Heat = { pts: 0, fire: 0, best: 0, lit: 0 };

/** What each moment is worth (V2 §B.0.2; NFL's table is nfl-4's, the others V2's numbers for nba and soccer to confirm). */
const HEAT_TABLE: PerSport<Record<Exclude<HeatEv, 'half'>, number>> = {
  nba: { perfect: 12, score: 10, stop: 15, clean: 5, turnover: -20, conceded: -10 },
  nfl: { perfect: 12, score: 25, stop: 15, clean: 5, turnover: -20, conceded: -10 },
  soccer: { perfect: 12, score: 40, stop: 15, clean: 5, turnover: -20, conceded: -10 }
};
/** How long ON FIRE lasts: NBA possessions, NFL snaps, soccer attacks. */
export const FIRE_UNITS: PerSport<number> = { nba: 2, nfl: 3, soccer: 1 };

/** What a Heat event is worth in a sport (0 for 'half'). */
export function heatValue(ev: HeatEv, sport: SportId): number {
  return ev === 'half' ? 0 : pickFor(sport, HEAT_TABLE)[ev];
}

/**
 * One Heat event (pure, integer). Gains fill the bar to 100: crossing 66 is HEATING UP, reaching 100
 * lights ON FIRE for `units` (the sport's FIRE_UNITS unless a card says otherwise); while On Fire the
 * bar stays full. A loss takes its points off and puts any fire out. 'half' empties the bar and the
 * fire (best and lit are the match's and stay).
 */
export function addHeat(h: Heat, ev: HeatEv, sport: SportId, units = FIRE_UNITS[sport]): { h: Heat; heating: boolean; lit: boolean } {
  if (ev === 'half') return { h: { ...h, pts: 0, fire: 0 }, heating: false, lit: false };
  const v = heatValue(ev, sport);
  if (v < 0) {
    const pts = Math.max(0, h.pts + v);
    return { h: { ...h, pts, fire: 0 }, heating: false, lit: false };
  }
  if (h.fire > 0) return { h, heating: false, lit: false };
  const pts = Math.min(FULL, h.pts + v);
  const lit = pts >= FULL;
  const heating = !lit && h.pts < HEATING && pts >= HEATING;
  return {
    h: { pts, fire: lit ? Math.max(1, Math.round(units)) : 0, best: Math.max(h.best, pts), lit: h.lit + (lit ? 1 : 0) },
    heating,
    lit
  };
}

/** One On Fire unit used (a snap played On Fire). The last one burns out: the bar empties for the next run at it. */
export function spendFire(h: Heat): Heat {
  if (h.fire <= 0) return h;
  const fire = h.fire - 1;
  return { ...h, fire, pts: fire > 0 ? h.pts : 0 };
}

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

/** Football's additions to the C19 bug (local until nba's kit lands; recorded in nfl.md C19). */
export interface ScoreBugExtra {
  usName?: string;
  themName?: string;
  /** no rival score to show yet (a practice or a lab game): a dash */
  themBlank?: boolean;
  /** a second line under the label: the down and distance and the spot */
  sub?: string;
  /** the drive pips along the progress line, one per drive: how each ended, or 'open' for those to come */
  pips?: ('td' | 'fg' | 'lost' | 'none' | 'open')[];
  /** the game clock's element, written each frame by the screen (no React state) */
  clockRef?: React.Ref<HTMLElement>;
  /** Clutch staging (V2 §B.0.4): the bug turns gold */
  clutch?: boolean;
}

/**
 * The score bug (C19's ScoreBug, local version): two team blocks and a dark centre with the label
 * and clock, a 3 px progress line along its foot (one pip a drive, the live one filling with the
 * field position), and the Heat bar directly under it. Sized and placed by the C15 variables
 * (--bug-w, --bug-h, --bug-top, --heat-h). Purely presentational; never takes a touch.
 */
export function ScoreBug(props: ScoreBugProps & ScoreBugExtra) {
  const h = React.createElement;
  const pips = props.pips ?? [];
  const live = pips.indexOf('open');
  const bar = (who: 'us' | 'them', v: number, fire: boolean, name: string) => {
    const pts = Math.max(0, Math.min(100, Math.round(v)));
    return h(
      'span',
      {
        className: 'v2-heat-bar ' + who + (fire ? ' fire' : pts >= HEATING ? ' heating' : ''),
        role: 'meter',
        'aria-label': name + (fire ? ': On Fire' : pts >= HEATING ? ': Heating up' : ': Heat'),
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': pts
      },
      h('i', { style: { width: pts + '%' } }),
      h('b', { className: 'v2-heat-mark' })
    );
  };
  // the flame on the bug: still (it says ON FIRE without moving, for reduced motion too), in the
  // block's top corner so the name keeps its width on a 320 px phone
  const flame = (on: boolean) =>
    on
      ? h('svg', { className: 'v2-bug-flame', viewBox: '0 0 12 14', width: 10, height: 12, 'aria-hidden': true }, h('path', { d: 'M6 0C7 3 10 4.5 10 8.5 10 11.5 8.2 14 6 14S2 11.5 2 8.5C2 6.5 3 5.5 4 4.5 4 6 4.8 7 5.6 7 5.6 4.5 4.6 2.5 6 0Z', fill: 'currentColor' }))
      : null;
  return h(
    React.Fragment,
    null,
    h(
      'div',
      { className: 'v2-bug' + (props.clutch ? ' clutch' : ''), role: 'group', 'aria-label': 'Score: ' + (props.usName ?? 'You') + ' ' + props.us + ', ' + (props.themName ?? 'Rival') + ' ' + props.them + '. ' + props.label + (props.sub ? ', ' + props.sub : '') },
      h('span', { className: 'v2-bug-team us' + (props.fireUs ? ' fire' : '') }, flame(props.fireUs), h('i', null, props.usName ?? 'YOU'), h('b', { className: 'num' }, props.us)),
      h(
        'span',
        { className: 'v2-bug-mid' },
        h('i', null, props.label, props.clock !== undefined ? h('em', { ref: props.clockRef, className: 'v2-bug-clock' }, props.clock) : null),
        props.sub ? h('b', null, props.sub) : null
      ),
      h('span', { className: 'v2-bug-team them' + (props.fireThem ? ' fire' : '') }, h('b', { className: 'num' }, props.themBlank ? '–' : props.them), h('i', null, props.themName ?? 'RIVAL'), flame(props.fireThem)),
      h(
        'span',
        { className: 'v2-bug-line', 'aria-hidden': true },
        pips.map((p, i) => h('i', { key: i, className: 'pip ' + p, style: i === live ? ({ '--fill': Math.round(props.progress * 100) + '%' } as React.CSSProperties) : undefined }))
      )
    ),
    // the two Heat bars under the bug, each under its own side (yours fills toward the middle's left
    // edge from the left, theirs the same way on the right); a dash of mark at HEATING UP
    h('div', { className: 'v2-heat' + (props.fireUs ? ' fire' : '') }, bar('us', props.heatUs, props.fireUs, props.usName ?? 'Your heat'), bar('them', props.themBlank ? 0 : props.heatThem, !props.themBlank && props.fireThem, props.themName ?? 'Rival heat'))
  );
}

export interface ToastView {
  id: number;
  text: string;
  sub?: string;
  tone: string;
}

/**
 * The toast line (C19's Toast, local version): one line, 28 px, a glass capsule with a glowing
 * status dot and the keyword coloured by tone; its bottom edge sits at --toast-bottom. Only the
 * queue (hud.ts) decides what it says.
 */
export function ToastLine({ toast }: { toast: ToastView | null }) {
  const h = React.createElement;
  if (!toast) return null;
  return h(
    'div',
    { key: toast.id, className: 'v2-toast ' + toast.tone, role: 'status', 'aria-live': 'polite' },
    h('i', { className: 'v2-toast-dot', 'aria-hidden': true }),
    h('b', null, toast.text),
    toast.sub ? h('span', null, toast.sub) : null
  );
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

/** The semitones a PERFECT streak lifts the chime: 0 for the first in a row, +1 each after, at most +4 (V2 §B.0.5). */
export function chimeStep(streak: number): number {
  return Math.max(0, Math.min(4, Math.floor(Number.isFinite(streak) ? streak : 1) - 1));
}

/**
 * The PERFECT chime for the `streak`-th perfect in a row: two notes a fourth apart, a semitone higher
 * for each perfect in a row up to five. The shared cue (sfx.perfect, soccer's, in sound.ts at the
 * merge) when this build has it; until then the same two notes on the existing pitched tone
 * (sfx.count steps 2 semitones per unit, so half a unit is one semitone; G5 is 3.5 units over C5).
 */
export function perfectChime(streak: number) {
  const shared = (sfx as typeof sfx & { perfect?: (streak: number) => void }).perfect;
  if (shared) {
    shared(streak);
    return;
  }
  const base = 3.5 + chimeStep(streak) / 2;
  sfx.count(base);
  setTimeout(() => sfx.count(base + 2.5), 70);
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
