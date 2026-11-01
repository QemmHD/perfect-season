// Tiered badges (Claude, 2026-11-01). A badge a card carries works by tier, read from the player's
// ratings at the moment it is used (so a mid-range Deadeye does nothing for his threes, and a level
// or an Icon boost can lift a tier). Thresholds are NBA 2K26's published badge requirements
// (Bronze / Silver / Gold / Hall of Fame / Legend; destructoid.com and nba2klab.com, Aug 2025); badges
// 2K26 doesn't publish for this game's badge are noted. The badge itself is still granted by
// ratings.ts `badges()` (unchanged), so card ability lists stay the same.
import type { Hooper } from './types';

export const TIER_NAMES = ['', 'Bronze', 'Silver', 'Gold', 'Hall of Fame', 'Legend'] as const;
/** how much of a badge's full effect each tier gives (Bronze .. Legend) */
export const TIER_MULT = [0, 0.35, 0.55, 0.75, 0.9, 1] as const;

type Need = [keyof Hooper, readonly number[]];
/** each badge: the ratings it needs per tier (all of them for a tier) */
const NEEDS: Record<string, Need[]> = {
  // Deadeye: the matching jump shot (the caller passes that rating as `shot`)
  deadeye: [['thr', [73, 85, 92, 95, 99]]],
  limitless: [['thr', [83, 89, 93, 96, 99]]],
  posterizer: [
    ['ddk', [73, 87, 93, 96, 99]],
    ['vrt', [65, 75, 80, 85, 90]]
  ],
  // 2K26 On-Ball Menace (PD + agility; acceleration stands in for agility here)
  clamps: [
    ['prd', [74, 79, 91, 96, 99]],
    ['acc', [70, 76, 80, 84, 86]]
  ],
  // 2K26 Ankle Assassin
  'ankle-breaker': [['hnd', [75, 86, 93, 95, 98]]],
  // 2K26 Paint Patroller (interior D + block) for this game's rim protector
  'rim-protector': [
    ['ind', [60, 70, 84, 94, 99]],
    ['blk', [74, 84, 93, 97, 99]]
  ],
  dimer: [['pas', [55, 71, 82, 92, 98]]]
};

/**
 * The tier (0 none, 1 Bronze .. 5 Legend) of a badge he carries, from his ratings now. `shot` is
 * the rating of the shot being taken, for Deadeye. Badges without published tiers (Lob City, Heat
 * Check, Icon) play at full strength when carried.
 */
export function badgeTier(p: Hooper, id: string, shot?: number): number {
  if (!p.abil.includes(id)) return 0;
  const needs = NEEDS[id];
  if (!needs) return 5;
  let tier = 5;
  for (const [key, marks] of needs) {
    const v = id === 'deadeye' && shot !== undefined ? shot : (p[key] as number);
    let t = 0;
    while (t < 5 && v >= marks[t]) t++;
    tier = Math.min(tier, t);
  }
  return tier;
}

/** The share of a badge's full effect he gets right now (0 without it). */
export function badgeMult(p: Hooper, id: string, shot?: number): number {
  return TIER_MULT[badgeTier(p, id, shot)];
}
