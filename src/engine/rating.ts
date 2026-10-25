import { NFL } from './sport';
import type { Line, Player } from './types';

// ---------- basketball ----------

/** Stat weights per game, measured from 82-0 (see research/82-0/README.md §2.5). */
const NBA_W: Line = { pts: 0.33, reb: 0.67, ast: 0.64, stl: 1.2, blk: 1.13 };

/**
 * Team totals of a "near-perfect" lineup (era-rated), used for the balance check and the
 * breakdown bars: about the 97th percentile of skilled drafts in each category.
 */
const NBA_BENCHMARK = { pts: 125, reb: 51, ast: 31, def: 16 };

/**
 * Win curve as [rating, wins] anchors, linear in between. Each anchor is a quantile of
 * simulated drafts (src/engine/sim.test.ts), so the curve says how good a team is compared
 * with how people actually draft: random picks have a median of 30 wins, picking the best
 * available player has 10th/50th/90th percentiles of 52/57/64 wins, the top 1% of
 * skilled drafts win 75+, and the top ~0.15% go 82-0.
 */
const NBA_CURVE: [number, number][] = [
  [0, 0],
  [23.5, 18],
  [33.6, 30],
  [46.5, 36],
  [81.8, 52],
  [89.1, 57],
  [97.1, 64],
  [104.7, 75],
  [109.1, 82],
];

// ---------- football ----------

/** Football values are already in one currency (see scripts/build_nfl_data.py): each part counts once. */
const NFL_W: Line = { pass: 1, rush: 1, recv: 1, def: 1 };

/**
 * About the 97th percentile of skilled drafts in passing, rushing, receiving and defense, and in
 * rushing plus receiving together (src/engine/sim.test.ts, CALIB=1).
 */
const NFL_BENCHMARK = { pass: 23.2, rush: 38.3, recv: 70.6, def: 23.5, skill: 89.6 };

/**
 * Win curve for a 17-game season, from simulated drafts like basketball's: random picks have
 * 10th/50th/90th percentiles of 4/6/8 wins, picking the best available player 11/12/13, the
 * top 1% of skilled drafts win 16, and only the top ~0.15% go 17-0.
 */
const NFL_CURVE: [number, number][] = [
  [0, 0],
  [50.9, 4],
  [63.8, 6],
  [76.9, 8],
  [99, 11],
  [107.7, 12],
  [117.4, 13],
  [126.2, 16],
  [132.9, 16.5],
  // 16.5 rounds up, so 132.9 is already 17-0; a real 17-win team is rated where 17-0 starts
  [133, 17],
];

export const W: Line = NFL ? NFL_W : NBA_W;
export const BENCHMARK: Record<string, number> = NFL ? NFL_BENCHMARK : NBA_BENCHMARK;
export const WIN_CURVE: [number, number][] = NFL ? NFL_CURVE : NBA_CURVE;
/** Games in a regular season. */
export const GAMES = NFL ? 17 : 82;

export const CATEGORY_LABELS = NFL ? ['Passing', 'Rushing', 'Receiving', 'Defense'] : ['Scoring', 'Rebounding', 'Playmaking', 'Defense'];
export const BALANCE_FLOOR = 0.85;

export function lineValue(l: Line): number {
  let v = 0;
  for (const k in W) v += (l[k] ?? 0) * W[k];
  return v;
}

export interface TeamRating {
  totals: Line;
  base: number;
  /** the four categories vs the benchmark (1 = benchmark) */
  ratios: [number, number, number, number];
  balance: number;
  rating: number;
  wins: number;
}

function interpolate(x: number, from: 0 | 1): number {
  const to = from === 0 ? 1 : 0;
  const pts = WIN_CURVE;
  if (x <= pts[0][from]) return pts[0][to];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (x <= b[from]) return a[to] + ((x - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  }
  return pts[pts.length - 1][to];
}

export function winsFromRating(rating: number): number {
  return Math.max(0, Math.min(GAMES, Math.round(interpolate(rating, 0))));
}

export function ratingForWins(wins: number): number {
  return interpolate(Math.min(GAMES, Math.max(0, wins)), 1);
}

function ratiosOf(t: Line): [number, number, number, number] {
  if (NFL) return [t.pass / BENCHMARK.pass, t.rush / BENCHMARK.rush, t.recv / BENCHMARK.recv, t.def / BENCHMARK.def];
  return [t.pts / BENCHMARK.pts, t.reb / BENCHMARK.reb, t.ast / BENCHMARK.ast, (t.stl * W.stl + t.blk * W.blk) / BENCHMARK.def];
}

/**
 * What the balance check compares. Basketball: the four categories. Football: passing, the run
 * and catch game together, and defense, so the FLEX can be a back or a receiver at no cost
 * (the bars still show rushing and receiving apart).
 */
function balanceParts(t: Line, ratios: [number, number, number, number]): number[] {
  if (NFL) return [ratios[0], (t.rush + t.recv) / BENCHMARK.skill, ratios[3]];
  return ratios;
}

/** Scores a lineup from its players' rated lines (era-adjusted, see Player.r). */
export function rateTeam(players: (Player | null | undefined)[]): TeamRating {
  const totals: Line = {};
  for (const k in W) totals[k] = 0;
  for (const p of players) {
    if (!p) continue;
    for (const k in W) totals[k] += p.r[k] ?? 0;
  }
  const base = lineValue(totals);
  const ratios = ratiosOf(totals);
  const capped = balanceParts(totals, ratios).map((r) => Math.min(r, 1.25));
  const mean = capped.reduce((a, b) => a + b, 0) / capped.length;
  const balance = mean > 0 ? Math.min(...capped) / mean : 1;
  const rating = base * (BALANCE_FLOOR + (1 - BALANCE_FLOOR) * balance);
  return { totals, base, ratios, balance, rating, wins: winsFromRating(rating) };
}

export interface Grade {
  min: number;
  letter: string;
  tier: string;
  color: string;
  coins: number;
}

export const GRADES: Grade[] = NFL
  ? [
      { min: 17, letter: 'S+', tier: 'Perfect', color: '#F5B83D', coins: 100 },
      { min: 16, letter: 'S', tier: 'Legendary', color: '#F5B83D', coins: 60 },
      { min: 15, letter: 'A+', tier: 'Dynasty', color: '#19E3C9', coins: 55 },
      { min: 14, letter: 'A', tier: 'Juggernaut', color: '#4FD8C6', coins: 50 },
      { min: 12, letter: 'B', tier: 'Contender', color: '#6CB4FF', coins: 40 },
      { min: 10, letter: 'C', tier: 'Playoff Team', color: '#F2A33A', coins: 30 },
      { min: 7, letter: 'D', tier: 'Bubble Team', color: '#A3B1BC', coins: 25 },
      { min: 0, letter: 'F', tier: 'Rebuilding', color: '#FF7A7A', coins: 20 },
    ]
  : [
      { min: 82, letter: 'S+', tier: 'Perfect', color: '#F5B83D', coins: 100 },
      { min: 75, letter: 'S', tier: 'Legendary', color: '#F5B83D', coins: 60 },
      { min: 69, letter: 'A+', tier: 'Dynasty', color: '#19E3C9', coins: 55 },
      { min: 63, letter: 'A', tier: 'Juggernaut', color: '#4FD8C6', coins: 50 },
      { min: 57, letter: 'B', tier: 'Contender', color: '#6CB4FF', coins: 40 },
      { min: 50, letter: 'C', tier: 'Playoff Team', color: '#F2A33A', coins: 30 },
      { min: 38, letter: 'D', tier: 'Lottery Bound', color: '#A3B1BC', coins: 25 },
      { min: 0, letter: 'F', tier: 'Rebuilding', color: '#FF7A7A', coins: 20 },
    ];

export function gradeFor(wins: number): Grade {
  return GRADES.find((g) => wins >= g.min) ?? GRADES[GRADES.length - 1];
}
