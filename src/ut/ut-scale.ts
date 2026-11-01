// Claude ratings rework (2026-11-01): the ONE place the Ultimate Team overall scale is configured.
//
// Ratings are built on a "rating scale" (2K/Madden-like: attributes, raw overall, face categories);
// gameplay always reads the rating-scale attributes. What a card DISPLAYS — its overall, its six face
// numbers, its tier — goes through the per-sport curve below, and every UT threshold (tiers, onScale
// challenge/SBC targets, Squad Battles ladders, pack walkouts, Hot Season/Legend ranges) follows.
// Re-targeting the UT scale means editing UT_SCALE only (then re-running scripts/fit_ut_scale.ts and
// scripts/fit_ut_balance.ts if the pool changes).
//
// Current setting: the EA FC 27-style scale (see docs/RATINGS-AUDIT.md, "UT display scale"):
//  - Bronze 40–64, Silver 65–74, Gold 75–99 in both sports (≈35% / 35% / 30% of season cards)
//  - base season golds: common 75–82, good 83–86, elite 87–90, only a dozen or so per sport at 90+,
//    the greatest seasons 91; each overall above 83 several times rarer than the one below
//  - Legends 88–95 (a handful at 94–95), Hot Season promos 94–97 (Team-of-the-Year analog, no 99s),
//    room left for weekly promos at 80–92; Spotlight 100–105 and GOAT 106–110 stay above, unchanged.
import type { UtSport } from './types';

export interface UtScale {
  /** rating-scale overall → displayed overall, piecewise-linear, increasing (fitted to the pool's
   * season-card quantiles by scripts/fit_ut_scale.ts) */
  curve: [number, number][];
  /** displayed tier cuts for season cards */
  cuts: { silver: number; gold: number };
  /** displayed overall from which a pack reveal walks out */
  walkout: number;
  /** the season card's displayed overall → the edition's displayed overall */
  promo: [number, number][];
  legend: [number, number][];
}

export const UT_SCALE: Record<UtSport, UtScale> = {
  nba: {
    curve: [[48.15,39.5],[70.255,64.5],[76.751,74.5],[84.047,79.5],[89.3,82.5],[91.515,83.5],[93.181,84.5],[94.856,85.5],[96.227,86.5],[97.077,87.5],[97.684,88.5],[98.054,89.5],[98.44,90.5],[99,91]],
    cuts: { silver: 65, gold: 75 },
    walkout: 86,
    promo: [[78, 94], [84, 95], [88, 96], [91, 97]],
    legend: [[78, 88], [84, 90], [88, 92], [90, 94], [91, 95]],
  },
  nfl: {
    curve: [[56.79,39.5],[75.125,64.5],[82.769,74.5],[89.875,79.5],[92.942,82.5],[93.941,83.5],[94.323,84.5],[95.311,85.5],[96.255,86.5],[97.564,87.5],[98,88.5],[98.35,89.5],[98.922,90.5],[99,91]],
    cuts: { silver: 65, gold: 75 },
    walkout: 86,
    promo: [[78, 94], [84, 95], [88, 96], [91, 97]],
    legend: [[76, 88], [82, 90], [86, 92], [89, 93], [90, 94], [91, 95]],
  },
};

/** Tier cuts on the displayed scale (Bronze < silver ≤ Silver < gold ≤ Gold). */
export const TIER_CUTS: Record<UtSport, { silver: number; gold: number }> = {
  nba: UT_SCALE.nba.cuts,
  nfl: UT_SCALE.nfl.cuts,
};

/** Piecewise-linear through increasing knots; flat beyond the ends' slope of 1. */
export function along(x: number, knots: [number, number][]): number {
  if (x <= knots[0][0]) return knots[0][1] + (x - knots[0][0]);
  for (let i = 1; i < knots.length; i++)
    if (x <= knots[i][0]) {
      const [x0, y0] = knots[i - 1],
        [x1, y1] = knots[i];
      return x1 === x0 ? y1 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
    }
  const [xn, yn] = knots[knots.length - 1];
  return yn + (x - xn);
}

/** A rating-scale value (overall or face category, ≤99) as displayed, unrounded. */
export function toDisplay(sport: UtSport, x: number): number {
  const top = UT_SCALE[sport].curve[UT_SCALE[sport].curve.length - 1];
  return x >= top[0] ? top[1] : along(x, UT_SCALE[sport].curve);
}

/** The inverse: a displayed value back on the rating scale (for scale-independent thresholds). */
export function fromDisplay(sport: UtSport, y: number): number {
  return along(y, UT_SCALE[sport].curve.map(([a, b]) => [b, a] as [number, number]));
}

/** A Hot Season or Legend edition's displayed overall, from its season card's displayed overall. */
export function editionDisplay(sport: UtSport, kind: 'promo' | 'legend', seasonShown: number): number {
  const knots = UT_SCALE[sport][kind];
  const lo = knots[0][1],
    hi = knots[knots.length - 1][1];
  return Math.round(Math.max(lo, Math.min(hi, along(Math.max(knots[0][0], seasonShown), knots))));
}
