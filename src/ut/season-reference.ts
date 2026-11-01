// Implemented by Codex. Public same-season Madden benchmark -> our playable attribute vocabulary.
import { groupOf } from '../game/football2/ratings';
import { profileQuality } from './rating-quality';
import { careerOf } from './cards';
import { combineAthleticism } from './nfl-combine';
import { hasPhysicalIdentity } from './nfl-identity';
import type { CardLine } from './types';

/** Analysis switch for the out-of-sample audit scripts: rate a card from its own season only. */
export const RATING_CONTEXT = { borrow: true, support: true };

/**
 * Claude ratings rework: the same player's nearest season that has a same-era benchmark, within four
 * seasons (the one before on a tie). `years` is signed: positive when this card is later than the
 * benchmark. `careerYear` counts this card's season from the player's first one in the data.
 */
export function nearestReference(line: CardLine, within = 4): { ref: NonNullable<CardLine['ratingReference']>; years: number; careerYear: number } | null {
  if (!RATING_CONTEXT.borrow || line.ratingReference) return null;
  const career = careerOf(line);
  if (!career) return null;
  let best: CardLine | null = null;
  for (const l of career) {
    if (!l.ratingReference || l.season === line.season) continue;
    const d = Math.abs(l.season - line.season);
    if (d > within) continue;
    if (!best || d < Math.abs(best.season - line.season)) best = l;
  }
  if (!best) return null;
  return { ref: best.ratingReference!, years: line.season - best.season, careerYear: line.season - career[0].season };
}

/**
 * A neighbouring season's measured athleticism, aged to this season: speed/acceleration/agility fall
 * about a point a year past a player's sixth season, and a younger season sits slightly below; strength
 * and arm do not drift. Skills are blended (half weight, less with distance) with this season's estimate.
 */
export function borrowNeighbour(line: CardLine, attrs: Record<string, number>, physical: string[], steady: string[], keep: string[] = []): Record<string, number> {
  // athleticism carries further (six seasons) than skills (four)
  const far = nearestReference(line, 6);
  if (!far) return attrs;
  const near = Math.abs(far.years) <= 4 ? far : null;
  const out = { ...attrs };
  for (const [code, value] of Object.entries(far.ref.attrs)) {
    if (!(code in out) || keep.includes(code)) continue;
    const gap = Math.abs(far.years);
    if (physical.includes(code)) {
      const aged = far.years > 0 ? Math.max(0, Math.min(far.years, far.careerYear - 5)) * 1.1 : gap * 0.5;
      out[code] = Math.round(value - aged);
    } else if (!near) continue;
    else if (steady.includes(code)) out[code] = value;
    else {
      const w = 0.5 * (1 - (gap - 1) * 0.12);
      out[code] = Math.round(value * w + out[code] * (1 - w));
    }
    out[code] = Math.max(1, Math.min(99, out[code]));
  }
  return out;
}

/** Claude rework: estimate-path attribute bias against same-era Madden (out-of-sample, 2,120 seasons). */
const NFL_BIAS: Record<string, Record<string, number>> = {
  QB: { DAC: 7 },
  RB: { CAR: 10, JKM: 8, BCV: 6, SPM: 5 },
  WR: { SPC: 10, CTH: 6, BTK: 7, JKM: 8 },
  TE: { SPD: 5, ACC: 6, SPC: 8 },
  DL: { ACC: 6, PUR: 6, PRC: 5, TAK: 4 },
  LB: { ZCV: -8, MCV: -4, TAK: 4, PUR: 4, HIT: 4 },
  CB: { ZCV: 9, CTH: 4 },
  S: { PRS: 6, CTH: 4 },
};
/** Estimate-path overall → same-era Madden overall, by quantile matching (no-benchmark seasons only). */
const NFL_OVR_MAP: Record<string, (x: number) => number> = {
  OL: (x) => -54.5 + 1.536 * x,
  WR: (x) => 11.8 + 0.889 * x,
  CB: (x) => 23.7 + 0.73 * x,
  S: (x) => 26.1 + 0.707 * x,
  DL: (x) => 13.6 + 0.832 * x,
  LB: (x) => 13.8 + 0.847 * x,
  K: (x) => x + 0.8 * (31.4 + 0.543 * x - x),
  QB: (x) => x + 0.6 * (14.6 + 0.77 * x - x),
  TE: (x) => x + 3,
};
const NFL_PHYSICAL = ['SPD', 'ACC', 'AGI', 'STR', 'THP'];

/** A quarterback who rarely runs (under 12 rushing yards a game) keeps his estimated speed. */
function pocketPasser(line: CardLine): boolean {
  return (line.stats.ry ?? 0) / Math.max(1, line.games ?? 1) < 12;
}

export function calibrateNflReference(line: CardLine, pos: string, overall: number, raw: Record<string, number>) {
  const ref = line.ratingReference;
  let attrs = { ...raw };
  const g = groupOf(pos);
  if (ref) {
    for (const [code, value] of Object.entries(ref.attrs)) {
      if (!(code in attrs)) continue;
      // Physical measurements must not be inferred from yards/TDs. Position skills keep a small season-stat contribution.
      const weight = NFL_PHYSICAL.includes(code) ? 1 : 0.95;
      attrs[code] = Math.max(1, Math.min(99, Math.round(value * weight + attrs[code] * (1 - weight))));
    }
    if (g === groupOf(line.pos[0])) overall = ref.ovr * 0.9 + overall * 0.1;
  } else {
    const bias = { ...(NFL_BIAS[g] ?? {}) };
    if (g === 'QB' && !pocketPasser(line)) Object.assign(bias, { SPD: 8, ACC: 5, AGI: 5 });
    for (const [code, d] of Object.entries(bias)) if (code in attrs) attrs[code] = Math.max(1, Math.min(99, Math.round(attrs[code] + d)));
    // athleticism: hand-set identity > measured combine (averaged with an aged neighbouring Madden
    // benchmark when there is one) > neighbouring benchmark > half-weight positional estimate
    const identity = hasPhysicalIdentity(line);
    const athletic = identity ? null : combineAthleticism(line, pos);
    const neighbour = !!nearestReference(line, 6);
    attrs = borrowNeighbour(line, attrs, ['SPD', 'ACC', 'AGI'], ['STR', 'THP'], identity ? NFL_PHYSICAL : []);
    if (athletic)
      for (const code of ['SPD', 'ACC', 'AGI'] as const) {
        const v = athletic[code];
        if (v === undefined || !(code in attrs)) continue;
        const w = athletic.measured ? (neighbour ? 0.5 : 1) : neighbour ? 0 : 0.5;
        attrs[code] = Math.round(attrs[code] * (1 - w) + v * w);
      }
    const map = NFL_OVR_MAP[g];
    if (map) overall = map(overall);
  }
  const exact = Math.min(overall, profileQuality('nfl', pos, attrs) + 5);
  return { attrs, ovr: Math.round(exact), exact, source: ref?.source };
}
