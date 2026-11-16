// The gold ring (plan §4.4; V2 B.0.1, B.1.5): the window maths and the judging every sport shares.
//
// One rule runs through all of it: the gold half-width starts from the shooter's rating
// (`goldBase`), every situation that widens or narrows it is a `WindowPart`, and the parts meet in
// one place only, `windowScale`: their product, capped at ×1.45 and ±90 ms, then the ±30 ms floor
// applied last ("anyone, anywhere"). A sport decides the ring's state (gold, amber, red) from its own
// situation and passes `state: 'gold'` only when its outcome function gives the best result there is
// for a release inside it ("gold never lies"; each sport tests it over 10,000 seeded releases).
//
// Pure: no clock of its own, no randomness, no DOM, and no transcendental maths (only
// + − × ÷, min/max and sqrt), so the outcome maths is bit-identical on every phone's JS engine
// (hoops2/determinism.test.ts scans this file).

export type RingState = 'gold' | 'amber' | 'red';
/** What a miss failed on: the release (TIMING), the defense (PRESSURE) or the distance (RANGE). */
export type Dial = 'TIMING' | 'PRESSURE' | 'RANGE';

/** Half-width (ms): nothing ever shrinks gold below it. */
export const GOLD_FLOOR_MS = 30;
/** The parts multiplied together are capped here, and so is the half-width itself. */
export const WINDOW_CAP = { mult: 1.45, ms: 90 } as const;

export interface WindowPart {
  id: string;
  mult: number;
}

/** V2's published multipliers (plan §3.3). Difficulty and fatigue are functions below. */
export const PART = { light: 0.75, rhythm: 1.2, fire: 1.25, meterOff: 1.1, pullup: 0.88 } as const;
/** A pull-up's window sits this much later than a set shot's (ms). */
export const PULLUP_LATE_MS = 10;

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/**
 * The gold half-width (ms) for a shot rating, before any part: 30 at 55, 60 at 99, linear between,
 * plus 0.4 ms a point above 99 (at most +5).
 */
export function goldBase(rating: number): number {
  return 30 + 30 * clamp((rating - 55) / 44, 0, 1) + Math.min(5, 0.4 * Math.max(0, rating - 99));
}

/** The only place multipliers meet: their product, capped (×1.45, ±90 ms), then floored (±30 ms). */
export function windowScale(baseMs: number, parts: readonly WindowPart[]): number {
  let m = 1;
  for (const p of parts) m *= p.mult;
  m = Math.min(m, WINDOW_CAP.mult);
  return Math.max(GOLD_FLOOR_MS, Math.min(WINDOW_CAP.ms, baseMs * m));
}

/** The difficulty rungs' factors (Rookie, Pro, All-Star, Legend), by the defense level they play at. */
const RUNGS: [number, number][] = [
  [-0.5, 1.25],
  [0, 1],
  [0.5, 0.9],
  [1, 0.8]
];
/** The difficulty part for a defense level (difficulty.ts: Rookie −0.5, Pro 0, Legend 1; between, linear). */
export function difficultyPart(def: number): WindowPart {
  const d = clamp(def, RUNGS[0][0], RUNGS[RUNGS.length - 1][0]);
  let mult = RUNGS[RUNGS.length - 1][1];
  for (let i = 1; i < RUNGS.length; i++) {
    const [d0, m0] = RUNGS[i - 1];
    const [d1, m1] = RUNGS[i];
    if (d <= d1) {
      mult = m0 + ((m1 - m0) * (d - d0)) / (d1 - d0);
      break;
    }
  }
  return { id: 'difficulty', mult };
}

/**
 * Tired legs (energy 0-1): the window comes later (+15 ms at 60% energy, +25 ms at 40%, linear from
 * none at full) and narrower (down to ×0.85 at 40%).
 */
export function fatigueOf(energy: number): { part: WindowPart; lateMs: number } {
  const e = clamp(energy, 0, 1);
  const lateMs = e >= 0.6 ? (1 - e) * 37.5 : e >= 0.4 ? 15 + (0.6 - e) * 50 : 25;
  return { part: { id: 'fatigue', mult: 1 - 0.15 * clamp((1 - e) / 0.6, 0, 1) }, lateMs };
}

export interface RingSpec {
  /** from the touch-down to the perfect moment (ms) */
  idealMs: number;
  /** half-width (ms) */
  goldMs: number;
  state: RingState;
  /** why the ring isn't gold (amber or red) */
  dial?: Dial;
}

export interface Judged {
  /** 0 = on the ideal (inside gold's half-width); ±1 slightly, ±2, ±3 very early / late */
  step: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  inGold: boolean;
  offMs: number;
  dial?: Dial;
  /** 'PERFECT', 'SLIGHTLY LATE', … ('ON TIME' for a timed release on a ring that wasn't gold) */
  word: string;
}

export const STEP_WORDS = ['VERY EARLY', 'EARLY', 'SLIGHTLY EARLY', 'PERFECT', 'SLIGHTLY LATE', 'LATE', 'VERY LATE'] as const;
/** Beyond the gold edge: within this much it's "slightly", within the second "early/late", else "very" (ms). */
export const STEP_EDGES_MS = [40, 110] as const;

/** How a release `offMs` from the ideal went on this ring. In gold only when the state is gold. */
export function judge(spec: RingSpec, offMs: number): Judged {
  const a = Math.abs(offMs);
  const beyond = a - spec.goldMs;
  const size = beyond <= 0 ? 0 : beyond <= STEP_EDGES_MS[0] ? 1 : beyond <= STEP_EDGES_MS[1] ? 2 : 3;
  const step = (offMs < 0 ? -size : size) as Judged['step'];
  const inGold = spec.state === 'gold' && size === 0;
  const dial: Dial | undefined = inGold ? undefined : spec.state !== 'gold' ? (spec.dial ?? 'PRESSURE') : 'TIMING';
  const word = inGold ? 'PERFECT' : size === 0 ? 'ON TIME' : STEP_WORDS[step + 3];
  return { step, inGold, offMs, ...(dial ? { dial } : {}), word };
}

/**
 * A touch's time in game time. The host updates it every animation frame: `real` is that frame's
 * time (ms, the clock PointerEvent.timeStamp uses), `game` the game time stepped so far (s), `acc`
 * the game time that has passed but not been stepped yet (s), `rate` game seconds per real second
 * (the lab's slow motion and the posterizer's 0.35 included). A hit-stop holds `rate` at 0.
 */
export interface TouchClock {
  real: number;
  game: number;
  acc: number;
  rate: number;
}

export const touchClock = (): TouchClock => ({ real: 0, game: 0, acc: 0, rate: 1 });

/**
 * Game time (s) at a pointer event's timeStamp. A stamp more than a second from `now` (a browser
 * with a different clock behind it) is taken as `now`.
 */
export function gameTimeAt(c: TouchClock, timeStamp: number, now: number): number {
  const ts = Math.abs(timeStamp - now) > 1000 ? now : timeStamp;
  return c.game + c.acc + ((ts - c.real) / 1000) * c.rate;
}

/** A tap more than this far off its beat is a stray, not a measurement (ms). */
export const CALIBRATE_OUTLIER_MS = 150;

/**
 * The 4-tap "tap on the beat" calibration: the mean offset of the taps from their beats (positive:
 * late) and their spread, outliers dropped. With nothing left, 0 and 0.
 */
export function calibrate(taps: number[], beats: number[]): { offsetMs: number; sdMs: number; kept: number } {
  const offs: number[] = [];
  for (let i = 0; i < Math.min(taps.length, beats.length); i++) {
    const o = taps[i] - beats[i];
    if (Number.isFinite(o) && Math.abs(o) <= CALIBRATE_OUTLIER_MS) offs.push(o);
  }
  if (!offs.length) return { offsetMs: 0, sdMs: 0, kept: 0 };
  const mean = offs.reduce((a, b) => a + b, 0) / offs.length;
  const sd = offs.length > 1 ? Math.sqrt(offs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (offs.length - 1)) : 0;
  return { offsetMs: mean, sdMs: sd, kept: offs.length };
}
