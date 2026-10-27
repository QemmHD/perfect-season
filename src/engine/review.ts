// The draft, looked back on: how good each pick was against what else was there, and the best
// team the same spins could have made. Hindsight only; nothing here changes a result.
import { CELL_BY_ID } from './data';
import { dailyOrder, type PickLog } from './draft';
import { rateTeam, rateTotals, type TeamRating, W, winsFromRating } from './rating';
import { NFL } from './sport';
import { type Line, type Lineup, type Player, type Slot, SLOTS, emptyLineup } from './types';

export type PickGrade = 'best' | 'great' | 'good' | 'reach' | 'miss';

export const GRADE_LABEL: Record<PickGrade, string> = { best: 'BEST PICK', great: 'GREAT', good: 'GOOD', reach: 'REACH', miss: 'MISS' };
/** for the share text, Wordle style */
export const GRADE_EMOJI: Record<PickGrade, string> = { best: '🟩', great: '🟩', good: '🟨', reach: '🟧', miss: '🟥' };

export interface PickReview {
  round: number;
  cellId: string;
  slot: Slot;
  pick: Player;
  /** how much the pick raised the team rating */
  gain: number;
  /** the best pick there was at that moment, and what it would have added */
  best: Player | null;
  bestSlot: Slot | null;
  bestGain: number;
  grade: PickGrade;
  trade: boolean;
}

export interface DraftReview {
  picks: PickReview[];
  yours: TeamRating;
  /** the best team the teams you landed could make */
  best: { lineup: Lineup; rating: TeamRating };
  /** wins the best team would have had over yours */
  winsLeft: number;
  /** your rating as a share of the best, 0-100 */
  score: number;
  letter: string;
}

const ratingOf = (l: Lineup) => rateTeam(SLOTS.map((k) => l[k])).rating;

/** How far below the best option a pick was, in rating points, sets its grade. */
export function gradeOf(short: number): PickGrade {
  if (short <= 0.3) return 'best';
  if (short <= 2) return 'great';
  if (short <= 4.5) return 'good';
  if (short <= 8) return 'reach';
  return 'miss';
}

function reviewPick(e: PickLog): PickReview {
  const base = ratingOf(e.before);
  const withPick = { ...e.before, [e.slot]: e.player };
  const gain = ratingOf(withPick) - base;
  const held = new Set(SLOTS.map((k) => e.before[k]?.pid).filter(Boolean) as string[]);
  let best: Player | null = null;
  let bestSlot: Slot | null = null;
  let bestGain = gain;
  for (const p of CELL_BY_ID[e.cellId]?.players ?? []) {
    if (e.taken.includes(p.id)) continue;
    for (const k of e.open) {
      if (!p.pos.includes(k)) continue;
      // never hold someone twice; in football a trade may swap a player for another season of his
      // (the same rule the draft uses)
      if (held.has(p.pid) && !(NFL && e.trade && e.before[k]?.pid === p.pid && e.before[k]?.id !== p.id)) continue;
      const g = ratingOf({ ...e.before, [k]: p }) - base;
      if (g > bestGain + 1e-9) {
        bestGain = g;
        best = p;
        bestSlot = k;
      }
    }
  }
  return { round: e.round, cellId: e.cellId, slot: e.slot, pick: e.player, gain, best, bestSlot, bestGain, grade: gradeOf(bestGain - gain), trade: e.trade };
}

/**
 * The best team that one pick from each of these teams (a team listed twice gives two) could
 * make: every way of giving the teams to the spots, each spot taking that team's best player
 * who can play it. (Football's eight spots make 40,320 ways: walked as a tree, leaving out the
 * branches that can't beat the best so far even with every remaining spot at its best and no
 * balance penalty, since a rating is never more than its players' values added up.)
 */
export function bestFromCells(cellIds: string[]): { lineup: Lineup; rating: TeamRating } {
  const ids = cellIds.slice(0, SLOTS.length);
  // each team's players who can play each spot, best first
  const cand: Record<string, Player[][]> = {};
  for (const id of new Set(ids)) {
    const ranked = (CELL_BY_ID[id]?.players ?? []).slice().sort((a, b) => b.val - a.val);
    cand[id] = SLOTS.map((k) => ranked.filter((x) => x.pos.includes(k)));
  }
  let bestL = emptyLineup();
  let bestR = rateTeam([]);
  const team: (Player | null)[] = SLOTS.map(() => null);
  const totals: Line = rateTeam([]).totals;
  const keys = Object.keys(W);
  const used = new Set<string>();
  const left = ids.slice();
  let value = 0;
  /** the most the spots from i on could still add */
  const ceiling = (i: number) => {
    let c = 0;
    for (let k = i; k < Math.min(SLOTS.length, i + left.length); k++) {
      let m = 0;
      for (const id of left) m = Math.max(m, cand[id][k][0]?.val ?? 0);
      c += m;
    }
    return c;
  };
  const walk = (i: number) => {
    if (bestR.rating > 0 && value + ceiling(i) <= bestR.rating - 1e-9) return;
    if (i === SLOTS.length || !left.length) {
      const r = rateTotals(totals);
      // the same players seated another way rate the same: the first seating found stands
      if (r.rating > bestR.rating + 1e-9) {
        bestR = { ...r, totals: { ...totals } };
        bestL = Object.fromEntries(SLOTS.map((k, j) => [k, team[j]]));
      }
      return;
    }
    const tried = new Set<string>();
    for (let j = 0; j < left.length; j++) {
      const id = left[j];
      // the same team twice (Double Pick): its orders are the same
      if (tried.has(id)) continue;
      tried.add(id);
      left.splice(j, 1);
      const p = cand[id][i].find((x) => !used.has(x.pid)) ?? null;
      team[i] = p;
      if (p) {
        used.add(p.pid);
        value += p.val;
        for (const k of keys) totals[k] += p.r[k] ?? 0;
      }
      walk(i + 1);
      if (p) {
        used.delete(p.pid);
        value -= p.val;
        for (const k of keys) totals[k] -= p.r[k] ?? 0;
      }
      team[i] = null;
      left.splice(j, 0, id);
    }
  };
  walk(0);
  return { lineup: bestL, rating: bestR };
}

const LETTERS: [number, string][] = [
  [99, 'A+'],
  [96, 'A'],
  [92, 'A-'],
  [88, 'B+'],
  [84, 'B'],
  [80, 'B-'],
  [75, 'C+'],
  [70, 'C'],
  [62, 'D'],
  [0, 'F'],
];

export function draftLetter(score: number): string {
  return LETTERS.find(([min]) => score >= min)![1];
}

export function reviewDraft(log: PickLog[], lineup: Lineup): DraftReview {
  const picks = log.map(reviewPick);
  const yours = rateTeam(SLOTS.map((k) => lineup[k]));
  const cells = SLOTS.map((k) => lineup[k]?.cellId).filter(Boolean) as string[];
  const best = bestFromCells(cells);
  // your own team counts as possible (a Prime can beat every base line)
  const top = best.rating.rating >= yours.rating ? best : { lineup, rating: yours };
  const winsLeft = Math.max(0, top.rating.wins - yours.wins);
  const score = top.rating.rating > 0 ? Math.min(100, (100 * yours.rating) / top.rating.rating) : 100;
  return { picks, yours, best: top, winsLeft, score, letter: draftLetter(score) };
}

/** Daily par: the best team from the day's spins, the same for everyone. */
export function dailyPar(dailyKey: string): { lineup: Lineup; rating: TeamRating; wins: number } {
  const b = bestFromCells(dailyOrder(dailyKey).slice(0, SLOTS.length));
  return { ...b, wins: winsFromRating(b.rating.rating) };
}
