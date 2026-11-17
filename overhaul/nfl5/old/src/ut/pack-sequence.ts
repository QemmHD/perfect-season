// Implemented by Codex. Presentation timings only; pack outcomes/odds never pass through this module.
import type { Tier } from './types';
export function packSequence(tier: Tier | undefined, level: number) {
  const goat = tier === 'goat',
    premium = level >= 3;
  return {
    tear: premium ? 1050 : 680,
    position: premium ? 900 : 540,
    team: premium ? 1750 : 1120,
    surge: goat ? 2550 : null,
    player: goat ? 3900 : premium ? 2800 : level >= 2 ? 2100 : 1650,
    settled: goat ? 5550 : premium ? 4250 : level >= 2 ? 3350 : 2650,
  };
}
