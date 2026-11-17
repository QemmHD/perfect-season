// Implemented by Codex. One defensive ruleset for played games, simulations and online takeovers.
import { pick } from '../engine/sport';
import type { BotLevel } from '../engine/types';
export const DEFENSE_LEVEL: Record<BotLevel, number> = { rookie: -0.5, pro: 0, legend: 1 };
export const COMPETITIVE_DEFENSE = 1;
export function defenseDifficulty(online: boolean, level: BotLevel, override?: number): number {
  return online ? COMPETITIVE_DEFENSE : Math.max(-0.5, Math.min(1, override ?? DEFENSE_LEVEL[level]));
}
/**
 * How well the user's own team defends the AI's offense (contract C5; Claude, studio overhaul
 * nfl-5, audit D-3). Difficulty is the AI's side only: online both defenses play the same competitive
 * defense; offline football's own defense is a little sharper on Rookie (a learning level) and
 * standard otherwise, and the AI offense's skill (its reads, its calls) carries the difficulty.
 */
export const NFL_USER_DEFENSE: Record<BotLevel, number> = { rookie: 0.35, pro: 0, legend: 0 };
export function rivalOffenseFaces(online: boolean, level: BotLevel = 'pro'): number {
  return online ? COMPETITIVE_DEFENSE : pick({ nba: 0, nfl: NFL_USER_DEFENSE[level], soccer: 0 });
}
