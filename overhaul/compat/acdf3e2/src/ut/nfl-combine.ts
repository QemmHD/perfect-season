// Claude ratings rework (2026-11-01): measured NFL Combine athleticism for Ultimate Team football
// cards without a same-season Madden benchmark (src/data/nfl-combine.json, loaded with the NFL cards).
// Sources: nflverse (CC-BY 4.0), data from Pro-Football-Reference; 1987–98 hand-timed results from
// nflcombineresults.com (+0.06 s). Hand-set identities (nfl-identity.ts) and Madden benchmarks win.
import { groupOf } from '../game/football2/ratings';
import type { CardLine } from './types';

export interface CombineFile {
  source: string;
  columns: string[];
  rows: Record<string, (number | null)[]>;
}
let rows: CombineFile['rows'] | null = null;
export function registerCombine(file: CombineFile | undefined): void {
  if (file) rows = file.rows;
}

/** 40-yard dash (s) → speed, from Madden's own combine-to-rating spread. */
const FORTY: [number, number][] = [[4.22, 99], [4.3, 97], [4.4, 93], [4.5, 90], [4.6, 86], [4.7, 83], [4.8, 79], [4.9, 76], [5.0, 72], [5.2, 66], [5.4, 60], [5.6, 54]];
/** Without a combine: a typical 40 for the position at the player's weight (a + b·lb). */
const WEIGHT_FORTY: Record<string, [number, number]> = {
  WR: [4.174, 0.00165], CB: [4.3, 0.001], S: [4.467, 0.00045], RB: [3.671, 0.00418], TE: [3.413, 0.00532],
  LB: [3.866, 0.00345], QB: [3.966, 0.00382], DL: [3.137, 0.00631], OL: [3.895, 0.00432],
};

function speedOf(forty: number): number {
  if (forty <= FORTY[0][0]) return 99;
  for (let i = 1; i < FORTY.length; i++)
    if (forty <= FORTY[i][0]) {
      const [x0, y0] = FORTY[i - 1],
        [x1, y1] = FORTY[i];
      return y0 + ((forty - x0) * (y1 - y0)) / (x1 - x0);
    }
  return FORTY[FORTY.length - 1][1];
}

/**
 * Speed, acceleration and agility at this season: measured (the player's combine, aged −0.6 a year
 * past 28, taking the combine year as age 22) or, without one, a weight-based estimate for the position.
 */
export function combineAthleticism(line: CardLine, pos = line.pos[0]): { measured: boolean; SPD?: number; ACC?: number; AGI?: number } | null {
  const g = groupOf(pos);
  if (g === 'K') return null;
  const r = rows?.[line.pid];
  const clamp = (v: number) => Math.max(25, Math.min(99, Math.round(v)));
  if (r && (typeof r[0] === 'number' || typeof r[1] === 'number')) {
    const [forty, cone, , year] = r;
    const age = 22 + (typeof year === 'number' ? line.season - year : 4);
    const decline = Math.max(0, age - 28) * 0.6;
    const out: { measured: boolean; SPD?: number; ACC?: number; AGI?: number } = { measured: true };
    if (typeof forty === 'number') {
      const spd = speedOf(forty) - decline;
      out.SPD = clamp(spd);
      out.ACC = clamp(spd + (typeof cone === 'number' ? Math.max(-4, Math.min(4, (7.0 - cone) * 10)) : 0));
    }
    if (typeof cone === 'number') out.AGI = clamp(99 - (cone - 6.45) * 28 - decline);
    return out;
  }
  const w = WEIGHT_FORTY[g];
  if (!w || !line.wt) return null;
  const spd = speedOf(w[0] + w[1] * line.wt);
  return { measured: false, SPD: clamp(spd), ACC: clamp(spd) };
}
