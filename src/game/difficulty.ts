// Implemented by Codex. One defensive ruleset for played games, simulations and online takeovers.
import type { BotLevel } from '../engine/types';
export const DEFENSE_LEVEL: Record<BotLevel, number> = { rookie: -0.5, pro: 0, legend: 1 };
export const COMPETITIVE_DEFENSE = 1;
export function defenseDifficulty(online: boolean, level: BotLevel, override?: number): number {
  return online ? COMPETITIVE_DEFENSE : Math.max(-0.5, Math.min(1, override ?? DEFENSE_LEVEL[level]));
}
