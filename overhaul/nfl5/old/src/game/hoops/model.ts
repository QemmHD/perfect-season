// Arcade basketball: each drafted player's game, from his real line. Shooting from his real
// percentages (a three-point line that didn't exist yet is judged by his free-throw touch), finishing
// from his rim percentage and size, passing and defense from where he ranks among every line in the
// data. Ratings run 0 to 1.
import { CELLS } from '../../engine/data';
import type { Lineup, Player } from '../../engine/types';
import type { Attrs } from '../attrs';
import { tagOf } from '../football/model';

export interface Baller {
  name: string;
  tag: string;
  /** the court spot he plays: PG, SG, SF, PF, C */
  spot: string;
  /** inches, for the sprite and blocks and rebounds */
  ht: number;
  wt: number;
  /** top speed, feet a second */
  speed: number;
  three: number;
  mid: number;
  finish: number;
  /** throws it down (0-1: how often he gets all the way to the rim and dunks) */
  dunk: number;
  pass: number;
  handle: number;
  steal: number;
  block: number;
  reb: number;
  /** for the card: 0-99 */
  ovr: number;
  c1: string;
  c2: string;
  initials: string;
  player: Player;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

/** each stat's values over every line, sorted, to rank a player by it (era-adjusted) */
const SORTED: Record<string, number[]> = (() => {
  const out: Record<string, number[]> = { pts: [], reb: [], ast: [], stl: [], blk: [], val: [] };
  for (const c of CELLS)
    for (const p of c.players) {
      for (const k of ['pts', 'reb', 'ast', 'stl', 'blk']) out[k].push(p.r[k] ?? 0);
      out.val.push(p.val);
    }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a - b);
  return out;
})();

function rank(k: string, v: number): number {
  const list = SORTED[k];
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (list[m] < v) lo = m + 1;
    else hi = m;
  }
  return lo / Math.max(1, list.length - 1);
}

function initialsOf(name: string): string {
  const parts = name.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').replace(/\./g, '').split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** A typical height for a spot, when the data has none. */
const SPOT_HT: Record<string, number> = { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 };

export function baller(p: Player, spot: string, a: Attrs | null): Baller {
  const ht = a?.ht ?? SPOT_HT[spot] ?? 79;
  const wt = a?.wt ?? 215;
  const r = (k: string) => rank(k, p.r[k] ?? 0);
  const pts = r('pts');
  const ft = a?.ft ?? null;
  const touch = ft !== null ? clamp01((ft - 0.6) / 0.3) : 0.4 + 0.3 * pts;
  // threes: his percentage and how many he took; before the line, his free-throw touch
  let three: number;
  const fg3 = a?.fg3 ?? null;
  const a3 = a?.a3 ?? 0;
  const noLine = p.to < 1980;
  if (fg3 !== null && a3 >= 0.4) three = 0.7 * clamp01((fg3 - 0.27) / 0.16) + 0.3 * clamp01(a3 / 7);
  else if (noLine) three = 0.85 * touch + 0.15 * pts;
  else three = Math.min(0.32, 0.6 * touch);
  // the mid-range: his twos and his touch
  const fg2 = a?.fg2 ?? 0.45;
  const mid = 0.45 * clamp01((fg2 - 0.4) / 0.17) + 0.35 * touch + 0.2 * pts;
  // finishing: his rim percentage when tracked, else his twos and his size
  const rim = a?.rim ?? null;
  const size = clamp01((ht - 72) / 13);
  const finish = rim !== null ? 0.7 * clamp01((rim - 0.52) / 0.26) + 0.3 * size : 0.45 * clamp01((fg2 - 0.4) / 0.17) + 0.35 * size + 0.2 * pts;
  const dunkShare = a?.dunk ?? null;
  const dunk = dunkShare !== null ? clamp01(dunkShare / 0.12) : clamp01((ht - 77) / 7) * 0.7 + 0.3 * pts * size;
  const ast = r('ast');
  const tov = a?.tov ?? null;
  const usage = (p.s.pts ?? 0) + (p.s.ast ?? 0) * 2;
  const handle = tov !== null && usage > 0 ? clamp01(1 - (tov / usage - 0.06) / 0.12) * 0.6 + 0.4 * ast : 0.4 + 0.5 * ast;
  const stl = r('stl');
  const blk = r('blk');
  const orb = a?.orb ?? null;
  const reb = 0.6 * r('reb') + 0.4 * (orb !== null ? clamp01(orb / 4) : size);
  // quickness: smaller and handsy players are quicker
  const quick = clamp01(0.55 * (1 - size) + 0.25 * stl + 0.2 * clamp01((240 - wt) / 70));
  return {
    name: p.name,
    tag: tagOf(p.name),
    spot,
    ht,
    wt,
    speed: lerp(14.5, 19.5, quick),
    three,
    mid,
    finish,
    dunk,
    pass: ast,
    handle,
    steal: stl,
    block: blk,
    reb,
    ovr: Math.round(lerp(55, 99, rank('val', p.val))),
    c1: p.c1,
    c2: p.c2,
    initials: initialsOf(p.name),
    player: p,
  };
}

export const SPOTS = ['PG', 'SG', 'SF', 'PF', 'C'];

export function fiveOf(lineup: Lineup, attrs: (p: Player) => Attrs | null): Baller[] {
  return SPOTS.map((s) => baller(lineup[s] as Player, s, attrs(lineup[s] as Player)));
}
