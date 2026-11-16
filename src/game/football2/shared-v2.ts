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
import { sfx, vibrate } from '../../lib/sound';

/** A point or vector in screen or field units. */
export interface Vec {
  x: number;
  y: number;
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
