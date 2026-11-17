// merge: replace with nba's src/game/perfect.ts (+ src/game/hud/ring-draw.ts), then delete this file.
//
// The gold ring (Game Design V2 B.0.1), as soccer uses it until nba's shared piece is in this branch
// (Claude 2026-11-16, studio overhaul soccer-4; the interface is docs/studio-overhaul/soccer.md §5.0.2,
// with nba's names where nba's plan publishes them: GOLD_FLOOR_MS, WINDOW_CAP, windowScale).
//
// Pure: no Math.random, no Date.now, no DOM. The engine uses ringWindow() (the AI's simulations judge
// their own seeded releases against the same window maths); the match screen uses judge() on the
// touches' own timestamps and turns the offset into the release time in game seconds that
// releaseShoot() takes, so the engine never reads a pointer timestamp. drawRing() draws on a canvas.
import type { JudgeWord, Judgement, RingDial, RingDraw, RingState, RingWindow, RingWindowIn } from './index';

/** Half-width (ms) nothing ever shrinks gold below: "anyone, anywhere" (V2 B.0.1). */
export const GOLD_FLOOR_MS = 30;
/** The product of every multiplier is capped here before the floor (nba-plan §3.3). */
export const WINDOW_CAP = { mult: 1.45, ms: 90 };
/** On Fire widens every gold window (V2 B.0.2). */
export const FIRE_MULT = 1.25;
/** The gold arc is never drawn under this many design px (V2 B.0.1, plan G1). */
export const GOLD_ARC_MIN_PX = 8;
/** A release within this many gold half-widths of the target is still GOOD. */
export const GOOD_SPAN = 2.2;
/** The display lag a person's release is corrected by until a calibration says otherwise (ms): the
 * screen shows the ring a beat behind the touch (soccer's RELEASE_LAG before soccer-4: 30 ms). */
export const DEFAULT_LAG_MS = 30;

export interface WindowPart {
  id: string;
  mult: number;
}

/** The one place the window's multipliers meet: product, then the cap, then the floor (always last). */
export function windowScale(baseMs: number, parts: readonly WindowPart[] = []): number {
  let k = 1;
  for (const p of parts) if (Number.isFinite(p.mult) && p.mult > 0) k *= p.mult;
  const ms = Math.min(WINDOW_CAP.ms, (Number.isFinite(baseMs) ? baseMs : 0) * Math.min(WINDOW_CAP.mult, k));
  return Math.max(GOLD_FLOOR_MS, ms);
}

/**
 * The ring for a chance: red when out of range, amber when contested (or another sport's own amber
 * cause, `amber`), gold otherwise. On Fire widens the window and turns an *uncontested* amber gold;
 * pressure stays amber and red stays red. The half-width is never under GOLD_FLOOR_MS.
 */
export function ringWindow(i: RingWindowIn & { amber?: RingDial; parts?: readonly WindowPart[] }): RingWindow {
  const parts: WindowPart[] = [...(i.parts ?? [])];
  if (i.fire) parts.push({ id: 'fire', mult: FIRE_MULT });
  const goldHalfMs = windowScale(i.baseHalfMs, parts);
  if (!i.inRange) return { state: 'red', goldHalfMs, dial: 'RANGE' };
  if (i.contested) return { state: 'amber', goldHalfMs, dial: 'PRESSURE' };
  if (i.amber && !i.fire) return { state: 'amber', goldHalfMs, dial: i.amber };
  return { state: 'gold', goldHalfMs };
}

/** The word for a release `offMs` from the target (negative early) against a window. */
export function wordFor(offMs: number, win: Pick<RingWindow, 'goldHalfMs'>): JudgeWord {
  const u = Math.abs(offMs) / Math.max(1, win.goldHalfMs);
  if (u <= 1) return 'PERFECT';
  if (u <= GOOD_SPAN) return 'GOOD';
  return offMs < 0 ? 'EARLY' : 'LATE';
}

/**
 * Judge a release from the touches' own timestamps (`PointerEvent.timeStamp`, ms): held is the time
 * between them less the device's display lag, and the offset is held less the target. Gold only when
 * the ring is gold and the offset is inside its half-width; an in-window release on amber or red is
 * GOOD (timing still counts there, but it guarantees nothing).
 */
export function judge(pressTs: number, releaseTs: number, targetMs: number, win: RingWindow, lagMs = 0): Judgement {
  const offMs = releaseTs - pressTs - lagMs - targetMs;
  const inWindow = Math.abs(offMs) <= win.goldHalfMs;
  const gold = inWindow && win.state === 'gold';
  const w = wordFor(offMs, win);
  return { offMs, word: gold ? 'PERFECT' : w === 'PERFECT' ? 'GOOD' : w, gold };
}

let calibratedLag: number | null = null;
/** The device's display lag (ms): the one-time calibration's value, else DEFAULT_LAG_MS. */
export function deviceLagMs(): number {
  return calibratedLag ?? DEFAULT_LAG_MS;
}
/** Set by the calibration (nba's TimingCalibrator at merge); null goes back to the default. */
export function setDeviceLag(ms: number | null) {
  calibratedLag = ms === null || !Number.isFinite(ms) ? null : Math.max(0, Math.min(150, ms));
}

/**
 * The ring's time-to-angle map: the gold band gets at least GOLD_ARC_MIN_PX of arc (the rest of the
 * ring is squeezed to make room), so the band is never too small to see on a 320 px phone. The window
 * itself never changes, only how it is drawn. `t` and the band are fractions (0..1) of the ring.
 */
export function ringMap(r: number, sweep: number, goldFrom: number, goldTo: number): (t: number) => number {
  const len = Math.max(1e-6, r * sweep);
  const g0 = Math.max(0, Math.min(1, goldFrom));
  const g1 = Math.max(g0, Math.min(1, goldTo));
  const band = g1 - g0;
  // (a hair over the minimum, so rounding never draws it at 7.99… px)
  const want = Math.min(1, Math.max(band, (GOLD_ARC_MIN_PX / len) * (1 + 1e-9)));
  if (want <= band || band <= 0) return (t) => Math.max(0, Math.min(1, t));
  // grow the band about its centre, squeezing what is before and after it in proportion
  const c = (g0 + g1) / 2;
  const n0 = Math.max(0, Math.min(1 - want, c - want / 2));
  const n1 = n0 + want;
  return (t) => {
    const x = Math.max(0, Math.min(1, t));
    if (x <= g0) return g0 > 0 ? (x / g0) * n0 : 0;
    if (x >= g1) return g1 < 1 ? n1 + ((x - g1) / (1 - g1)) * (1 - n1) : 1;
    return n0 + ((x - g0) / Math.max(1e-9, band)) * want;
  };
}

/** The drawn length (px) of the gold band on a ring of radius `r` sweeping `sweep` radians. */
export function goldArcPx(r: number, sweep: number, goldFrom: number, goldTo: number): number {
  const m = ringMap(r, sweep, goldFrom, goldTo);
  return (m(goldTo) - m(goldFrom)) * r * sweep;
}

/**
 * The ring's colours. `band` is the window, saturated; `lit` is the window while the fill is inside it
 * (release now); `rim` its edge ticks. The fill is never the band's colour (soccer-4 review fix: a
 * yellow fill heading into a yellow band hid where gold starts and ends): it is the neutral `RING_FILL`
 * on every ring.
 */
export const RING_COLORS: Record<RingState, { band: string; lit: string; rim: string }> = {
  gold: { band: '#f2a516', lit: '#ffe066', rim: '#fff6cf' },
  amber: { band: '#c9852c', lit: '#ffb04a', rim: '#ffe2b8' },
  red: { band: '#b0343c', lit: '#ff5d5d', rim: '#ffc2c2' },
};
/** The fill heading to the window: a pale teal-white, the same on gold, amber and red rings. */
export const RING_FILL = 'rgba(206,238,244,0.72)';

/**
 * Draw the ring: a dark track, the band (gold, or amber/red when the ring can't be gold), the fill up
 * to `progress`, and a bright tick at its head. `sweep` is the arc's angle (2π a full ring, less for
 * the arc over the shooter's head), starting at `start` (canvas radians, clockwise). `ry` squashes it
 * into a ground ellipse. Returns the gold band's drawn length in px (≥ GOLD_ARC_MIN_PX when there is
 * a band).
 */
export function drawRing(ctx: CanvasRenderingContext2D, o: RingDraw & { start?: number; sweep?: number; ry?: number; width?: number; reduced?: boolean }): number {
  const start = o.start ?? -Math.PI / 2;
  const sweep = o.sweep ?? Math.PI * 2;
  const ry = o.ry ?? o.r;
  const w = o.width ?? Math.max(3, Math.round(o.r * 0.22));
  // an ellipse is flattest along its short axis: map on that radius, so the band is never under 8 px
  const rMap = Math.min(o.r, ry);
  const map = ringMap(rMap, sweep, o.goldFrom, o.goldTo);
  const col = RING_COLORS[o.state];
  const arc = (t0: number, t1: number, width: number, color: string) => {
    const a0 = start + map(t0) * sweep;
    const a1 = start + map(t1) * sweep;
    if (a1 <= a0) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, o.r, ry, 0, a0, a1);
    ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'butt';
  arc(0, 1, w + 4, 'rgba(5,7,13,0.82)');
  arc(0, 1, w, '#1a2235');
  const p = Math.max(0, Math.min(1, o.progress));
  // the fill first, neutral; the window over it in its own saturated colour (lit while the fill is in
  // it: release now), so the band always reads as the band
  if (p > 0) arc(0, p, Math.max(2, w - 2), RING_FILL);
  const inside = p >= o.goldFrom && p <= o.goldTo;
  arc(o.goldFrom, o.goldTo, w, inside ? col.lit : col.band);
  // bright edge ticks where the window starts and ends: 2 px along the ring, taller than the track
  const tick = (t: number) => {
    const at = start + map(t) * sweep;
    const da = 2 / Math.max(4, o.r);
    ctx.strokeStyle = col.rim;
    ctx.lineWidth = w + 5;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, o.r, ry, 0, at - da / 2, at + da / 2);
    ctx.stroke();
  };
  tick(o.goldFrom);
  tick(o.goldTo);
  if (p > 0) {
    const head = start + map(p) * sweep;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = w + 3;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, o.r, ry, 0, head - 0.04, head);
    ctx.stroke();
  }
  ctx.restore();
  return (map(o.goldTo) - map(o.goldFrom)) * rMap * sweep;
}
