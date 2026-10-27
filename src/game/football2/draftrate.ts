// Football ratings for a draft line: his rank within his position by value, and the splits the
// game attributes file keeps (completions, yards per attempt and carry, catch rate...).
import type { Player } from '../../engine/types';
import type { Attrs } from '../attrs';
import { rankOf } from '../football/model';
import { type NflRating, rateNfl } from './ratings';

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
  return rateNfl({ pos, ht: a?.ht ?? null, wt: a?.wt ?? null, rank: rankOf(p), stats, rk: {}, honors: [] });
}
