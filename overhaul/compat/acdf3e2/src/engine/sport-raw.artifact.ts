// Codex (OpenAI): the single-file IIFE keeps both original datasets and has no top-level await.
import nba from '../data/nba.json';
import nfl from '../data/nfl.json';
export const NBA_RAW: unknown = nba;
export const NFL_RAW: unknown = nfl;
