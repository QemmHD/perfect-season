// 2K-style ratings (0-99) for a basketball player, from his real numbers: his percentages and how
// often he took each shot, how he ranks (era-adjusted) in scoring, rebounding, passing, steals and
// blocks among every line in the data, and his size. Badges (abilities) unlock at 2K-like
// thresholds. Overall comes from his value's rank, spread the way 2K spreads a league: a few
// 95+, a handful of 90s, most rotation players in the 70s.
import { CELLS } from '../../engine/data';
import type { Player } from '../../engine/types';
import type { Attrs } from '../attrs';
import type { Hooper } from './types';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const r99 = (x: number) => Math.max(25, Math.min(99, Math.round(x)));

/** each stat's values over every line, sorted, to rank a player by it */
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

export function rankIn(k: string, v: number): number {
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

const SPOT_HT: Record<string, number> = { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 };

export function initials(name: string): string {
  const parts = name.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').replace(/\./g, '').split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function tagOf(name: string): string {
  const parts = name.replace(/ \(.*\)$/, '').split(' ');
  const last = parts.slice(1).join(' ') || parts[0];
  return last.toUpperCase().slice(0, 12);
}

/** The inputs a rating needs: the same whether it's a draft line or one season. */
export interface NbaLine {
  name: string;
  id: string;
  pos: string[];
  from: number;
  /** era-adjusted per-game stats and overall value */
  r: { pts: number; reb: number; ast: number; stl: number; blk: number };
  val: number;
  /** ranks already worked out (a season card's, within its season, per 36 minutes): used instead of ranking `r` */
  rk?: { pts: number; reb: number; ast: number; stl: number; blk: number; val: number };
  ppg: number;
  apg: number;
  a: Attrs | null;
}

export function lineOf(p: Player, a: Attrs | null): NbaLine {
  return {
    name: p.name,
    id: p.id,
    pos: p.pos,
    from: p.from,
    r: { pts: p.r.pts ?? 0, reb: p.r.reb ?? 0, ast: p.r.ast ?? 0, stl: p.r.stl ?? 0, blk: p.r.blk ?? 0 },
    val: p.val,
    ppg: p.s.pts ?? 0,
    apg: p.s.ast ?? 0,
    a,
  };
}

/** 2K overall from a 0-1 standing: a 2K-shaped league (few 95+, a handful of 90s, most in the 70s). */
export function overallFromRank(p: number): number {
  return r99(56 + 43 * Math.pow(clamp01(p), 3.4));
}

export function hooper(l: NbaLine, spot: string, num: number | null): Hooper {
  const a = l.a;
  const ht = a?.ht ?? SPOT_HT[spot] ?? 79;
  const wt = a?.wt ?? 215;
  const size = clamp01((ht - 72) / 14);
  const heavy = clamp01((wt - 175) / 115);
  // rates per minute, not per game: a star's 38 minutes shouldn't make him a great shot blocker
  const mpg = a?.mpg ?? null;
  const per = mpg !== null ? Math.max(0.82, Math.min(1.5, 30 / Math.max(mpg, 8))) : 1;
  const pts = l.rk ? l.rk.pts : rankIn('pts', l.r.pts);
  const reb = l.rk ? l.rk.reb : rankIn('reb', l.r.reb * per);
  const ast = l.rk ? l.rk.ast : rankIn('ast', l.r.ast * per);
  const stl = l.rk ? l.rk.stl : rankIn('stl', l.r.stl * per);
  const blk = l.rk ? l.rk.blk : rankIn('blk', l.r.blk * per);
  const val = l.rk ? l.rk.val : rankIn('val', l.val);
  const ft = a?.ft ?? null;
  const touch = ft !== null ? clamp01((ft - 0.6) / 0.32) : 0.35 + 0.3 * pts;
  const fta = a?.fta ?? null;
  // threes: accuracy first, then volume; a handful of attempts says little; before the line, his touch
  const fg3 = a?.fg3 ?? null;
  const a3 = a?.a3 ?? 0;
  let thr: number;
  if (fg3 !== null && a3 >= 0.3) {
    const acc = clamp01((fg3 - 0.28) / 0.16) * clamp01(a3 / 1.4);
    thr = 40 + 50 * acc + 9 * clamp01(a3 / 9);
  } else if (l.from < 1980) thr = 38 + 40 * touch + 8 * pts;
  else thr = 30 + 18 * touch;
  const fg2 = a?.fg2 ?? 0.46;
  const mid = 42 + 22 * clamp01((fg2 - 0.42) / 0.15) + 22 * touch + 13 * pts;
  const rim = a?.rim ?? null;
  const cls = 40 + 26 * clamp01(((rim ?? fg2 + 0.12) - 0.55) / 0.2) + 18 * size + 15 * pts;
  const lay = 46 + 28 * clamp01(((rim ?? fg2 + 0.12) - 0.55) / 0.2) + 16 * pts + 7 * (1 - size);
  // attacking the rim: free throws drawn (a driver lives at the line) and size
  const attack = fta !== null ? clamp01(fta / 8) : 0.4 * pts;
  const athletic = clamp01(0.35 * (1 - heavy * 0.6) + 0.25 * blk + 0.2 * attack + 0.2 * stl);
  // dunks: his share of shots that were dunks when tracked (1996-97 on), else an estimate from his
  // size, how much he attacked the rim and his athleticism
  const dunkShare = a?.dunk ?? null;
  const ddk =
    dunkShare !== null
      ? 30 + 62 * Math.pow(clamp01(dunkShare / 0.11), 0.55) * (0.75 + 0.25 * athletic) + 7 * attack
      : (30 + 22 * clamp01((ht - 74) / 9) + 26 * attack + 16 * athletic + 5 * pts) * (spot === 'PG' ? 0.9 : spot === 'C' ? 0.96 : 1);
  const sdk = 28 + 52 * clamp01((ht - 77) / 8) + 14 * (dunkShare !== null ? clamp01(dunkShare / 0.12) : blk) + 5 * reb;
  const tov = a?.tov ?? null;
  const usage = l.ppg + l.apg * 2;
  const secure = tov !== null && usage > 0 ? clamp01(1 - (tov / usage - 0.06) / 0.12) : 0.5;
  const guard = spot === 'PG' || spot === 'SG' ? 1 : spot === 'SF' ? 0.5 : 0;
  const hnd = 36 + 30 * Math.pow(ast, 1.3) + 14 * secure + 18 * guard * (0.5 + 0.5 * pts);
  const pas = 32 + 66 * Math.pow(ast, 1.4);
  const quick = clamp01(0.55 * (1 - size) + 0.2 * stl + 0.15 * (1 - heavy) + 0.1 * athletic);
  const spd = 46 + 34 * quick + 14 * athletic;
  const acc = 48 + 36 * quick + 12 * athletic;
  const str = 35 + 60 * heavy;
  const vrt = 38 + 34 * athletic + 22 * (dunkShare !== null ? clamp01(dunkShare / 0.1) : 0.5 * attack + 0.3 * blk);
  const sta = 55 + 40 * clamp01(((mpg ?? 22) - 12) / 26);
  const prd = 38 + 30 * Math.pow(stl, 1.6) + 16 * quick + 8 * val + 5 * guard;
  const ind = 34 + 32 * Math.pow(blk, 1.6) + 18 * size + 9 * reb + 5 * heavy;
  const stlR = 30 + 69 * Math.pow(stl, 2.2);
  const blkR = 25 + 74 * Math.pow(blk, 2.6);
  const orb = a?.orb ?? null;
  const rebR = 32 + 54 * Math.pow(reb, 1.5) + 12 * (orb !== null ? clamp01(orb / 3.5) : size);
  const ftR = ft !== null ? 25 + 74 * clamp01((ft - 0.48) / 0.44) : 50 + 25 * touch;
  const ovr = overallFromRank(0.75 * val + 0.25 * pts);
  const h: Hooper = {
    id: l.id,
    name: l.name,
    tag: tagOf(l.name),
    num,
    ht,
    wt,
    pos: spot,
    ovr,
    spd: r99(spd),
    acc: r99(acc),
    hnd: r99(hnd),
    pas: r99(pas),
    thr: r99(thr),
    mid: r99(mid),
    cls: r99(cls),
    lay: r99(lay),
    ft: r99(ftR),
    ddk: r99(ddk),
    sdk: r99(sdk),
    str: r99(str),
    vrt: r99(vrt),
    sta: r99(sta),
    prd: r99(prd),
    ind: r99(ind),
    stl: r99(stlR),
    blk: r99(blkR),
    reb: r99(rebR),
    abil: [],
  };
  h.abil = badges(h, a3);
  return h;
}

/** Abilities, unlocked at 2K-like thresholds. */
export function badges(h: Hooper, a3: number): string[] {
  const out: string[] = [];
  if (h.ddk >= 84 && h.vrt >= 68) out.push('posterizer');
  if (h.thr >= 88 && a3 >= 5) out.push('limitless');
  if (h.thr >= 84 || h.mid >= 88) out.push('deadeye');
  if (h.prd >= 84) out.push('clamps');
  if (h.blk >= 85 && h.ind >= 78 && h.ht >= 80) out.push('rim-protector');
  if (h.hnd >= 88) out.push('ankle-breaker');
  if (h.pas >= 88) out.push('dimer');
  if (h.ddk >= 80 && h.vrt >= 74) out.push('lob-city');
  return out;
}

export const BADGE_NAMES: Record<string, string> = {
  posterizer: 'Posterizer',
  limitless: 'Limitless Range',
  deadeye: 'Deadeye',
  clamps: 'Clamps',
  'rim-protector': 'Rim Protector',
  'ankle-breaker': 'Ankle Breaker',
  dimer: 'Dimer',
  'lob-city': 'Lob City',
};

export const SPOTS = ['PG', 'SG', 'SF', 'PF', 'C'];
