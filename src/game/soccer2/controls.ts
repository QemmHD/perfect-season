// The V2 control grammar for soccer, pure (Claude 2026-11-16, studio overhaul soccer-2; plan §5.8,
// V2 A.5 and B.3.2): which slot each of the four right-thumb buttons holds in each phase, where a touch
// lands (buttons first, then the stick zone, then the pitch), what a stroke was (tap, hold, swipe,
// drag), and which teammate a tap on the pitch means. No DOM: the component feeds it numbers, and
// controls.test.ts drives thousands of synthetic touches through it.
import type { Circle, Geometry, Rect } from './v2';

/* ---------- strokes ---------- */

/** A tap moves under 12 px and lasts under 200 ms; a swipe moves 40 px or more inside 250 ms. */
export const TAP_PX = 12;
export const TAP_MS = 200;
export const SWIPE_PX = 40;
export const SWIPE_MS = 250;
/** PASS or THRU held this long (s) is the lofted version (a lob or a cross; the lofted through ball). */
export const LOFT_HOLD = 0.22;

export type Stroke = 'tap' | 'hold' | 'swipe' | 'drag';

/** What a finished stroke was, from where it went down and came up. */
export function classify(dx: number, dy: number, ms: number): Stroke {
  const d = Math.hypot(dx, dy);
  if (d < TAP_PX) return ms < TAP_MS ? 'tap' : 'hold';
  if (d >= SWIPE_PX && ms <= SWIPE_MS) return 'swipe';
  return 'drag';
}

/* ---------- the four buttons ---------- */

export type SlotId = 'A' | 'B' | 'C' | 'D';
export type SlotAct = 'shoot' | 'pass' | 'thru' | 'cross' | 'short' | 'bend';
export interface Slot {
  act: SlotAct;
  label: string;
  /** the second line */
  sub?: string;
  /** the second line says what a HOLD does: drawn after a hold glyph (soccer-2 re-review: PASS and THRU read alike) */
  hold?: boolean;
}
export type Slots = Record<SlotId, Slot | null>;
/** What the player is doing: open play on the ball, or one of the three set pieces. */
export type ControlPhase = 'attack' | 'freekick' | 'corner' | 'penalty';

/**
 * The cluster for a phase. A is always the timed thing (SHOOT) and never moves; B passes; C is the
 * context button; D is empty in open play until TRICK arrives (soccer-6). At most four right-thumb
 * targets, ever. A free kick puts its bend on D (tap to cycle left, right, straight) beside the swipe
 * on the pitch, so the three BEND chips no longer crowd the cluster.
 */
export function slotsFor(phase: ControlPhase): Slots {
  switch (phase) {
    case 'penalty':
      return { A: { act: 'shoot', label: 'SHOOT' }, B: null, C: null, D: null };
    case 'corner':
      return { A: null, B: { act: 'cross', label: 'CROSS', sub: 'TO HIM' }, C: { act: 'short', label: 'SHORT' }, D: null };
    case 'freekick':
      return { A: { act: 'shoot', label: 'SHOOT' }, B: { act: 'cross', label: 'CROSS', sub: 'TO HIM' }, C: { act: 'short', label: 'SHORT' }, D: { act: 'bend', label: 'BEND' } };
    default:
      return { A: { act: 'shoot', label: 'SHOOT' }, B: { act: 'pass', label: 'PASS', sub: 'LOB', hold: true }, C: { act: 'thru', label: 'THRU', sub: 'LOFT', hold: true }, D: null };
  }
}

/** The free kick's bend as D cycles it: straight, then the way each arrow points (bendCurl's k). */
export const BEND_CYCLE: readonly (-1 | 0 | 1)[] = [0, -1, 1];
export const nextBend = (k: -1 | 0 | 1): -1 | 0 | 1 => BEND_CYCLE[(BEND_CYCLE.indexOf(k) + 1) % BEND_CYCLE.length];

/* ---------- where a touch lands ---------- */

export type Zone = SlotId | 'stick' | 'pitch';

const inCircle = (c: Circle, x: number, y: number) => Math.hypot(x - c.cx, y - c.cy) <= c.d / 2;
const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * Where a touch at (x, y) goes: a button that holds something (its circle), else the stick zone,
 * else the pitch. Empty slots are not targets: a touch there is the pitch's.
 */
export function zoneAt(g: Geometry, slots: Slots, x: number, y: number): Zone {
  for (const id of ['A', 'B', 'C', 'D'] as const) if (slots[id] && inCircle(g[id.toLowerCase() as 'a' | 'b' | 'c' | 'd'], x, y)) return id;
  if (inRect(g.stickZone, x, y)) return 'stick';
  return 'pitch';
}

/** The right-thumb targets on screen now (never more than four). */
export const targetsOf = (slots: Slots): SlotId[] => (['A', 'B', 'C', 'D'] as const).filter((id) => !!slots[id]);

/* ---------- tap a teammate ---------- */

/** A tap on the pitch reaches a teammate within this many px of his feet (V2 C3: at least 22). */
export const TAP_PLAYER_PX = 30;

/** The nearest of `pts` to (x, y) within `r` px, or null. */
export function nearestWithin<T extends { x: number; y: number }>(pts: readonly T[], x: number, y: number, r = TAP_PLAYER_PX): T | null {
  let best: T | null = null;
  let bd = r;
  for (const p of pts) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/**
 * A SHOOT hold in game seconds, from its two touches' own timestamps (ms: `PointerEvent.timeStamp`)
 * less the device's display lag, at the match's time scale (soccer-4, plan G5). Not rounded to the
 * frame either touch lands in, so a release is judged to the millisecond.
 */
export function holdOf(pressTs: number, releaseTs: number, lagMs: number, timeScale = 1): number {
  return (Math.max(0, releaseTs - pressTs - lagMs) / 1000) * timeScale;
}

/**
 * The match's game clock against real time (soccer-4 review fix). The ring the player watches moves on
 * game time (slow motion after a near miss or the woodwork, hit-stops, a long frame clamped to 0.1 s),
 * while touches carry real timestamps; `holdOf` alone assumes the two run together, so a shot on a
 * rebound inside a 0.4× slow-motion beat was judged hundreds of ms late while the ring showed gold. The
 * loop calls `tick` each frame with the real time and the game seconds it advanced; `at` maps a real
 * timestamp to game seconds, interpolated between the frames around it, and past the newest frame at
 * `rate` (game s per real s now: 0 in a hit-stop, 0.4 in slow motion).
 */
export class GameClock {
  private s: { real: number; game: number }[] = [];
  game = 0;
  tick(realMs: number, dGame: number) {
    this.game += Math.max(0, dGame);
    const last = this.s[this.s.length - 1];
    if (last && realMs <= last.real) last.game = this.game;
    else this.s.push({ real: realMs, game: this.game });
    if (this.s.length > 600) this.s.splice(0, this.s.length - 600);
  }
  at(tsMs: number, rate = 1): number {
    const s = this.s;
    if (!s.length) return (tsMs / 1000) * rate;
    const last = s[s.length - 1];
    if (tsMs >= last.real) return last.game + ((tsMs - last.real) / 1000) * rate;
    if (tsMs <= s[0].real) return s[0].game - ((s[0].real - tsMs) / 1000) * rate;
    let lo = 0;
    let hi = s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid].real <= tsMs) lo = mid;
      else hi = mid;
    }
    const a = s[lo];
    const b = s[hi];
    return a.game + ((tsMs - a.real) / Math.max(1e-9, b.real - a.real)) * (b.game - a.game);
  }
}

/**
 * A SHOOT hold in game seconds on the match's clock (soccer-4 review fix): the release less the
 * device's display lag (the ring the player saw was that much behind), minus the press. At a steady
 * time scale it equals `holdOf`.
 */
export function holdOnClock(clock: GameClock, pressTs: number, releaseTs: number, lagMs: number, rate: number): number {
  return Math.max(0, clock.at(releaseTs - lagMs, rate) - clock.at(pressTs, rate));
}
