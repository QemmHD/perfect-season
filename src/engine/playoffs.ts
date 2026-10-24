import { PLAYOFF_TEAMS } from './data';
import { ratingForWins, type TeamRating } from './rating';
import { type Rand, pickOne } from './rng';
import type { PlayoffTeam } from './types';

export const ROUND_NAMES = ['First Round', 'Conference Semifinals', 'Conference Finals', 'NBA Finals'];
/** Opponent strength by round, in 82-game wins */
export const ROUND_POOLS: [number, number][] = [
  [50, 55],
  [55, 59],
  [59, 63],
  [64, 82],
];
/**
 * Spread of the per-game win chance, in rating points; higher = more upsets. At 12 a typical
 * 62-win team wins the title about 12% of the time, a 70-win team 45%, an 82-0 team 88%, and an
 * 82-0 team sweeps all four rounds about 4% of the time (src/engine/engine.test.ts checks this).
 */
export const SERIES_K = 12;
/** Fewest wins that make the playoffs: the "C · Playoff Team" grade. Below it a team is in the lottery. */
export const PLAYOFF_MIN_WINS = 50;
export const HOME_EDGE = 0.04;

export interface Series {
  round: number;
  opp: PlayoffTeam;
  oppRating: number;
  /** 1 = we won that game */
  games: number[];
  played: boolean;
  won: boolean;
}

export function gameWinChance(ourRating: number, oppRating: number): number {
  return 1 / (1 + Math.exp(-(ourRating - oppRating) / SERIES_K));
}

/** Your chance in one game against a playoff team, at home and on the road. */
export function matchupOdds(ourRating: number, opp: PlayoffTeam): { home: number; road: number } {
  const p = gameWinChance(ourRating, ratingForWins(opp.w82));
  const clamp = (x: number) => Math.min(0.97, Math.max(0.03, x));
  return { home: clamp(p + HOME_EDGE), road: clamp(p - HOME_EDGE) };
}

/** Your games at home in a best-of-7 (2-2-1-1-1): games 1, 2, 5 and 7 when you have the better record. */
function homeGame(g: number, highSeed: boolean): boolean {
  const highHome = g === 0 || g === 1 || g === 4 || g === 6;
  return highSeed ? highHome : !highHome;
}

/** Exact chance of winning the series, from the per-game odds and the home pattern. */
export function seriesWinChance(ourRating: number, ourWins: number, opp: PlayoffTeam): number {
  const { home, road } = matchupOdds(ourRating, opp);
  const highSeed = ourWins >= opp.w82;
  const memo = new Map<string, number>();
  const go = (a: number, b: number): number => {
    if (a === 4) return 1;
    if (b === 4) return 0;
    const key = a + ':' + b;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const p = homeGame(a + b, highSeed) ? home : road;
    const v = p * go(a + 1, b) + (1 - p) * go(a, b + 1);
    memo.set(key, v);
    return v;
  };
  return go(0, 0);
}

export function simSeries(ourRating: number, ourWins: number, opp: PlayoffTeam, rand: Rand): number[] {
  const { home, road } = matchupOdds(ourRating, opp);
  const highSeed = ourWins >= opp.w82;
  const games: number[] = [];
  let a = 0;
  let b = 0;
  for (let g = 0; a < 4 && b < 4; g++) {
    const pg = homeGame(g, highSeed) ? home : road;
    if (rand() < pg) {
      games.push(1);
      a++;
    } else {
      games.push(0);
      b++;
    }
  }
  return games;
}

export function pickOpponents(rand: Rand, pool: PlayoffTeam[] = PLAYOFF_TEAMS): PlayoffTeam[] {
  const chosen: PlayoffTeam[] = [];
  for (const [lo, hi] of ROUND_POOLS) {
    const options = pool.filter((t) => t.w82 >= lo && t.w82 <= hi && !chosen.some((c) => c.year === t.year && c.team === t.team));
    chosen.push(pickOne(options.length ? options : pool, rand));
  }
  return chosen;
}

export function buildBracket(season: TeamRating, rand: Rand): Series[] {
  const opps = pickOpponents(rand);
  let alive = true;
  return opps.map((opp, round) => {
    const s: Series = { round, opp, oppRating: ratingForWins(opp.w82), games: [], played: alive, won: false };
    if (alive) {
      s.games = simSeries(season.rating, season.wins, opp, rand);
      s.won = s.games.filter((x) => x === 1).length === 4;
      if (!s.won) alive = false;
    }
    return s;
  });
}

export interface PlayoffOutcome {
  seriesWon: number;
  title: boolean;
  sweeps: number;
  lostTo: Series | null;
  finals: Series;
}

export function playoffOutcome(bracket: Series[]): PlayoffOutcome {
  const played = bracket.filter((b) => b.played);
  return {
    seriesWon: played.filter((b) => b.won).length,
    title: played.length === 4 && played.every((b) => b.won),
    sweeps: played.filter((b) => b.won && b.games.length === 4).length,
    lostTo: played.find((b) => !b.won) ?? null,
    finals: bracket[3],
  };
}

export function seriesScore(games: number[]): [number, number] {
  const w = games.filter((x) => x === 1).length;
  return [w, games.length - w];
}
