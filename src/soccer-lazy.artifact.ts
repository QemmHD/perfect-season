// The artifact build's stand-in for soccer-lazy.ts: that build plays NBA and NFL only.
import type { CardsFile } from './ut/cards';

export const loadSoccerGame = (): Promise<typeof import('./game/soccer2/arcade')> => Promise.reject(new Error('soccer is not in this build'));
export type SoccerGame = Awaited<ReturnType<typeof loadSoccerGame>>;
export const loadSoccerCards = (): Promise<CardsFile> => Promise.reject(new Error('soccer is not in this build'));
