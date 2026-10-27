// The hook for playing a squad. The played matches (vs AI ladders and online head to head, matched
// by squad overall: docs/ULTIMATE-TEAM.md "Playing") are the next step; this is the contract the UT
// screens call and what a finished match hands back.
//
// TODO(match step): App.tsx passes `onPlaySquad` to <UltimateTeam>; it starts the arcade game with
// `request.cards` (basketball: `toHooper()` from rate.ts turns each into the game's player; the
// bench subs in on fatigue), and when the game ends calls `request.done(result)`. The UT screen
// then credits the coins and the cards' XP (state.ts `awardXp`) and shows the result.
import type { Profile } from '../lib/profile';
import type { SquadRating } from './squad';
import { awardXp } from './state';
import type { RatedCard, UtSport } from './types';

export interface UtMatchRequest {
  sport: UtSport;
  /** vs an AI squad (a ladder rung), or online head to head */
  mode: 'ai' | 'online';
  /** the squad by slot id (PG, B1, QB, WR2, ...), rated at each card's level */
  cards: Record<string, RatedCard>;
  /** the owned cards' uids by slot, for the XP afterwards */
  uids: Record<string, string>;
  rating: SquadRating;
  /** the match is over: the screen credits it */
  done: (result: UtMatchResult) => void;
}

export interface UtMatchResult {
  won: boolean;
  us: number;
  them: number;
  /** the uids of the cards that played (the whole squad, usually) */
  played: string[];
}

export type PlaySquad = (req: UtMatchRequest) => void;

/** What a played card earns: per game, and on top for a win. 700 XP takes a card to level 5. */
export const XP_PER_GAME = 40;
export const XP_FOR_WIN = 20;
/** A UT game pays like a draft's grade, so the economy (packs.ts) holds: about 50 a game. */
export const COINS_WIN = 60;
export const COINS_LOSS = 30;

export function matchRewards(r: UtMatchResult): { coins: number; xp: number } {
  return { coins: r.won ? COINS_WIN : COINS_LOSS, xp: XP_PER_GAME + (r.won ? XP_FOR_WIN : 0) };
}

/**
 * `awardXp(uids, n)` for the match code, bound to the profile: e.g. in App.tsx,
 * `const award = xpAwarder(update); award(result.played, matchRewards(result).xp)`.
 * (For the result screen's level-ups, `awardXp(profile.ut, uids, n).ups` before calling it.)
 */
export function xpAwarder(update: (fn: (p: Profile) => Profile) => void): (uids: string[], n: number) => void {
  return (uids, n) => update((p) => ({ ...p, ut: awardXp(p.ut, uids, n).ut }));
}
