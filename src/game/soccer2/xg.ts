// Soccer v2: expected goals for a shot, for display and the box score only (Claude 2026-11-16,
// studio overhaul soccer-4; plan §5.10: `xgOf` is the single source). Never read by the engine or the
// AI, so it changes no outcome.
//
// The curve is real football's, from our own analysis of the StatsBomb Open Data shot set (65,931
// open-play shots; docs/CREDITS.md, CC BY-SA 4.0; research-soccer §6.2): conversion by distance for
// feet and heads, a central/wide factor at the same range, and the set-piece rates (penalties 0.76,
// direct free kicks 0.064). It is the real-world chance of the shot, not this game's (which runs about
// 1.6× real per attack); the match screen shows it as "xG".
import type { ShotInfo } from './types';

/** Distance bands (yards to the goal's centre) and real conversion for feet and heads (§6.2). */
const BANDS_YD: readonly (readonly [number, number, number])[] = [
  // [upper edge yd, foot, head]
  [6, 0.559, 0.322],
  [8, 0.36, 0.167],
  [10, 0.273, 0.103],
  [12, 0.2, 0.058],
  [14, 0.171, 0.045],
  [16, 0.137, 0.02],
  [18, 0.109, 0.028],
  [20, 0.076, 0.02],
  [22, 0.051, 0.015],
  [25, 0.039, 0.01],
  [30, 0.025, 0.006],
  [35, 0.016, 0.004],
];
/** Set pieces (§6.2: penalties 73.3–79.2%, direct free kicks 5.2–6.4%). */
export const XG_SET = { pen: 0.76, fk: 0.064 };
const YD = 0.9144;
/** At the same range a shot from wide converts about two thirds as often (§6.2: 8.2% vs 12.4%). */
const WIDE = { from: 0.45, to: 1.1, k: 0.66 };

export interface XgShot {
  /** metres to the goal's centre */
  d: number;
  /** angle off the goal's centre line (radians, 0 straight on) */
  ang: number;
  kind: ShotInfo['kind'];
}

/** A shot's xG (0..1): real football's chance of a goal from there. */
export function xgOf(s: XgShot): number {
  if (s.kind === 'pen') return XG_SET.pen;
  if (s.kind === 'fk') return XG_SET.fk;
  const yd = Math.max(0, s.d) / YD;
  const col = s.kind === 'header' ? 2 : 1;
  // piecewise linear between the bands' midpoints; flat inside the first, fading past the last
  let lo = 0;
  let v = BANDS_YD[0][col];
  let prev: [number, number] | null = null;
  for (const b of BANDS_YD) {
    const mid = (lo + b[0]) / 2;
    lo = b[0];
    if (yd <= mid) {
      v = prev ? prev[1] + ((b[col] - prev[1]) * (yd - prev[0])) / (mid - prev[0]) : b[col];
      prev = null;
      break;
    }
    prev = [mid, b[col]];
  }
  if (prev) v = prev[1] * Math.max(0.25, 1 - (yd - prev[0]) / 20);
  const a = Math.abs(s.ang);
  const wide = a <= WIDE.from ? 1 : 1 - (1 - WIDE.k) * Math.min(1, (a - WIDE.from) / (WIDE.to - WIDE.from));
  return Math.max(0.005, Math.min(0.95, v * wide));
}

/** xG for a struck shot from where it was struck. */
export function xgOfShot(info: ShotInfo, from: { x: number; y: number }, goal: { x: number; y: number }): number {
  const d = Math.hypot(goal.x - from.x, goal.y - from.y);
  return xgOf({ d, ang: Math.atan2(from.x - goal.x, Math.max(0.3, goal.y - from.y)), kind: info.kind });
}
