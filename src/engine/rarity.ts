// Player rarity, from the value the game scores (`val`, era-adjusted): about the top 0.5% of
// player lines are Legendary, the top 3% Epic, the top 10% Rare.
import type { Player } from './types';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_MIN: Record<Exclude<Rarity, 'common'>, number> = { legendary: 20, epic: 16.3, rare: 12.6 };
export const RARITY_NAMES: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
export const RARITY_COLORS: Record<Rarity, string> = { common: '#8FA6B2', rare: '#4FA3FF', epic: '#B07BFF', legendary: '#F5B83D' };

export function rarityOf(p: Pick<Player, 'val'>): Rarity {
  if (p.val >= RARITY_MIN.legendary) return 'legendary';
  if (p.val >= RARITY_MIN.epic) return 'epic';
  if (p.val >= RARITY_MIN.rare) return 'rare';
  return 'common';
}

/** The best rarity among players, for the "legend spotted" flash when the reels land. */
export function bestRarity(players: Pick<Player, 'val'>[]): Rarity {
  const order: Rarity[] = ['legendary', 'epic', 'rare', 'common'];
  const have = new Set(players.map(rarityOf));
  return order.find((r) => have.has(r))!;
}
