// Claude 2026-11-01: soccer's code and data, loaded only when soccer is played. Each import below is
// its own chunk (never in the main bundle, never precached at install: pwa/sw.js caches it on first
// use). The single-file artifact build swaps this module for soccer-lazy.artifact.ts (no soccer).
import type { CardsFile } from './ut/cards';

/** The match engine and its app glue (src/game/soccer2/arcade.ts). */
export const loadSoccerGame = () => import('./game/soccer2/arcade');
export type SoccerGame = Awaited<ReturnType<typeof loadSoccerGame>>;

/** Ultimate Team's soccer cards (src/data/cards-soccer.json, about 1 MB gzipped). */
export const loadSoccerCards = (): Promise<CardsFile> => import('./data/cards-soccer.json').then((m) => (m.default ?? m) as unknown as CardsFile);
