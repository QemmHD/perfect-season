// Seeded synthetic elevens for the soccer guard tests (golden, agreement, rules): Claude 2026-11-10,
// studio overhaul soccer-1. Every player's six face stats spread around the side's level, so the
// attacks look like real ones (a quick winger, a big centre-back), but nothing depends on the card
// file: a re-rate of the real cards can't move the golden hash; only the engine can.
import { hashString, rng } from '../../engine/rng';
import { type CardForPitch, cardSquad } from './arcade';
import { GK_KEYS, OUT_KEYS } from './ratings';
import type { SoccerPos, Squad } from './types';

const SHAPE: SoccerPos[] = ['GK', 'FB', 'CB', 'CB', 'FB', 'CM', 'DM', 'CM', 'W', 'ST', 'W'];

/** An eleven's cards (Ultimate Team's form), the stats seeded from `seed` around `level`. */
export function cardsFor(seed: string, level: number): CardForPitch[] {
  const r = rng(hashString('xi:' + seed));
  const g = () => (r() + r() + r() - 1.5) * 2;
  return SHAPE.map((pos, i) => {
    const ovr = Math.round(Math.max(45, Math.min(97, level + g() * 4)));
    const keys = pos === 'GK' ? GK_KEYS : OUT_KEYS;
    const attrs = Object.fromEntries(keys.map((k) => [k, Math.round(Math.max(30, Math.min(99, ovr + g() * 7)))]));
    return { pid: seed + '-' + i, name: 'P' + i, pos: [pos], ovr, attrs, ht: 170 + Math.round(r() * 24), num: i + 1, season: 2020, fr: 'SYN', abbr: 'SYN', teamName: 'Synthetic', c1: '#cc2222', c2: '#ffffff' };
  });
}

/** The same eleven as the engine plays it (Ultimate Team's cardSquad). */
export const squadFor = (seed: string, level: number, info = { name: seed, abbr: 'SYN', c1: '#cc2222', c2: '#ffffff' }): Squad => cardSquad(cardsFor(seed, level), info);
