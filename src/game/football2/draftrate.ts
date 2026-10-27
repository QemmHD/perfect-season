// Football ratings for a draft line: his rank within his position by value, and the splits the
// game attributes file keeps (completions, yards per attempt and carry, catch rate; for defenders
// sacks, interceptions, tackles and passes defended a game).
import type { Player } from '../../engine/types';
import type { Attrs } from '../attrs';
import { rankOf } from '../football/model';
import { groupOf, type NflRating, rateNfl } from './ratings';

/**
 * A defender's numbers a game, at the 10th and 90th percentile of the drafted defenders at his
 * position (1970-2025 lines that have the stat): where his own falls between them is his standing
 * in it, 0.1 to 0.9.
 */
const DEF_RANGE: Record<string, Partial<Record<'sck' | 'ints' | 'tkl' | 'pd', [number, number]>>> = {
  DL: { sck: [0.16, 0.63], tkl: [1.5, 3.32], pd: [0, 0.29], ints: [0, 0.03] },
  LB: { sck: [0.05, 0.55], tkl: [2.52, 7.47], pd: [0.08, 0.46], ints: [0, 0.12] },
  CB: { tkl: [2.88, 5.72], pd: [0.33, 0.99], ints: [0.07, 0.3] },
  S: { tkl: [2.88, 5.72], pd: [0.33, 0.99], ints: [0.07, 0.3] },
};

/** His standing in each defensive stat the line has, partly his overall standing too (eras credit
 * tackles differently, and a stat alone misses what the tape saw). */
function defenseRanks(a: Attrs | null, group: string, rank: number): Record<string, number> {
  const range = DEF_RANGE[group];
  const out: Record<string, number> = {};
  if (!range || !a) return out;
  const at = (k: 'sck' | 'ints' | 'tkl' | 'pd'): number | undefined => {
    const v = a[k];
    const r = range[k];
    if (typeof v !== 'number' || !r) return undefined;
    const s = Math.max(0, Math.min(1, 0.1 + (0.8 * (v - r[0])) / Math.max(1e-6, r[1] - r[0])));
    return 0.7 * s + 0.3 * rank;
  };
  const sk = at('sck');
  const tkl = at('tkl');
  const int = at('ints');
  const pd = at('pd');
  if (sk !== undefined) out.sk = out.qbh = sk;
  if (tkl !== undefined) out.tkl = tkl;
  if (int !== undefined) out.int = int;
  if (pd !== undefined) out.pd = pd;
  // tackles for loss aren't kept: a disruptive front man makes plays behind the line
  if (sk !== undefined || tkl !== undefined) out.tfl = ((sk ?? rank) + (tkl ?? rank)) / 2;
  return out;
}

export function rateDraftLine(p: Player, a: Attrs | null, pos = p.pos[0] === 'FLEX' ? 'WR' : p.pos[0]): NflRating {
  const stats: Record<string, number | null | undefined> = {
    cmp: a?.cmp,
    ypa: a?.ypa,
    intr: a?.intr,
    sk: a?.sk,
    ry: a?.ry,
    ypc: a?.ypc,
    rec: a?.rec,
    ypr: a?.ypr,
    cr: a?.cr,
  };
  const rank = rankOf(p);
  return rateNfl({ pos, ht: a?.ht ?? null, wt: a?.wt ?? null, rank, stats, rk: defenseRanks(a, groupOf(pos), rank), honors: [] });
}
