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
 * The rival's three letters on the score bug (Wave 1): the first real word of the name, skipping a decade
 * ("'10s Barcelona" -> BAR, not 10S), a short first word kept whole ("AI Pro" -> AI, not AIP), else RIV.
 */
export function bugTag(name: string): string {
  const words = name.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter((w) => /[A-Za-z]/.test(w) && !/^\d+s?$/i.test(w));
  const w = words[0] ?? '';
  return (w.length <= 3 ? w : w.slice(0, 3)).toUpperCase() || 'RIV';
}
