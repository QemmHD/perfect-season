// Madden-style ratings (0-99) for a football player-season. PLACEHOLDER: the real formulas (from
// each position's stats and their ranks within the season, size, honors and draft slot) replace
// this; the signature stays. See docs/ULTIMATE-TEAM.md.
import type { CardLine } from '../../ut/types';

/** The attributes each position shows on its card, in order (Madden names, shortened). */
export const NFL_KEYS: Record<string, [string, string][]> = {
  QB: [['THP', 'Throw power'], ['SAC', 'Short accuracy'], ['MAC', 'Medium accuracy'], ['DAC', 'Deep accuracy'], ['TUP', 'Throw under pressure'], ['SPD', 'Speed']],
  RB: [['SPD', 'Speed'], ['ACC', 'Acceleration'], ['BTK', 'Break tackle'], ['JKM', 'Juke move'], ['CAR', 'Carrying'], ['CTH', 'Catching']],
  WR: [['SPD', 'Speed'], ['CTH', 'Catching'], ['RTE', 'Route running'], ['CIT', 'Catch in traffic'], ['SPC', 'Spectacular catch'], ['REL', 'Release']],
  TE: [['CTH', 'Catching'], ['RBK', 'Run block'], ['SPD', 'Speed'], ['CIT', 'Catch in traffic'], ['RTE', 'Route running'], ['STR', 'Strength']],
  OL: [['PBK', 'Pass block'], ['RBK', 'Run block'], ['STR', 'Strength'], ['AWR', 'Awareness'], ['IBL', 'Impact block'], ['AGI', 'Agility']],
  DL: [['PMV', 'Power moves'], ['FMV', 'Finesse moves'], ['BSH', 'Block shedding'], ['STR', 'Strength'], ['SPD', 'Speed'], ['TAK', 'Tackle']],
  LB: [['TAK', 'Tackle'], ['PUR', 'Pursuit'], ['PRC', 'Play recognition'], ['ZCV', 'Zone coverage'], ['SPD', 'Speed'], ['BSH', 'Block shedding']],
  CB: [['SPD', 'Speed'], ['MCV', 'Man coverage'], ['ZCV', 'Zone coverage'], ['PRS', 'Press'], ['CTH', 'Catching'], ['TAK', 'Tackle']],
  S: [['SPD', 'Speed'], ['ZCV', 'Zone coverage'], ['MCV', 'Man coverage'], ['TAK', 'Tackle'], ['HIT', 'Hit power'], ['PRC', 'Play recognition']],
  K: [['KPW', 'Kick power'], ['KAC', 'Kick accuracy'], ['AWR', 'Awareness'], ['STR', 'Strength'], ['SPD', 'Speed'], ['AGI', 'Agility']],
};

/** the position group a listed position rates as */
export function groupOf(pos: string): string {
  if (pos === 'OT' || pos === 'OG' || pos === 'C' || pos === 'OL') return 'OL';
  if (pos === 'DE' || pos === 'DT' || pos === 'DL') return 'DL';
  return pos;
}

export interface NflRating {
  ovr: number;
  pos: string;
  attrs: Record<string, number>;
  key: [string, string, number][];
  abil: string[];
}

/** PLACEHOLDER: a rough overall from the line's best rank; attributes all at that level. */
export function rateNflLine(line: CardLine, pos = line.pos[0]): NflRating {
  const g = groupOf(pos);
  const ranks = Object.values(line.rk).filter((x): x is number => typeof x === 'number');
  const best = ranks.length ? Math.max(...ranks) : 0.4;
  const honor = line.honors.includes('ALLPRO1') ? 0.98 : line.honors.includes('ALLPRO2') ? 0.94 : line.honors.includes('PB') ? 0.88 : 0;
  const p = Math.max(best * 0.9, honor);
  const ovr = Math.round(55 + 44 * Math.pow(p, 2.5)) + (line.boost ?? 0);
  const keys = NFL_KEYS[g] ?? NFL_KEYS.WR;
  const attrs: Record<string, number> = {};
  for (const [k] of keys) attrs[k] = Math.min(99, ovr);
  return { ovr: Math.min(99, ovr), pos, attrs, key: keys.map(([k, n]) => [k, n, attrs[k]]), abil: [] };
}
