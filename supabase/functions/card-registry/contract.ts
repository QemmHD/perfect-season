/** Implemented by Codex. Shared, pure pack contract: browser odds and server rolls use this file. */
export const SPOTLIGHT_RATES = { goat: 0.0005, spotlight: 0.2, legend: 0.02, promo: 0.28, gold: 0.4995 } as const;
export type ChaseTier = keyof typeof SPOTLIGHT_RATES;
export const EVENT_IDS = ['dynasty', 'deep-range', 'immortals'] as const;
/** `roll` is uniform in [0, 1,000,000); exact integer buckets, not floating point subtraction. */
export function chaseTier(roll: number): ChaseTier {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 1_000_000) throw new Error('Invalid roll');
  if (roll < 500) return 'goat';
  if (roll < 200500) return 'spotlight';
  if (roll < 220500) return 'legend';
  if (roll < 500500) return 'promo';
  return 'gold';
}
