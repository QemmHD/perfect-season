import { PLAYOFF_TEAMS } from './data';
import { GAMES, ratingForWins, type TeamRating } from './rating';
import { type Rand, pickOne } from './rng';
import { gameScore, LEAGUE_PPG } from './season';
import { NFL } from './sport';
import type { PlayoffTeam } from './types';

export const ROUND_NAMES = NFL ? ['Wild Card', 'Divisional Round', 'Conference Championship', 'Super Bowl'] : ['First Round', 'Conference Semifinals', 'Conference Finals', 'NBA Finals'];
/** Opponent strength by round, in wins over a full season */
export const ROUND_POOLS: [number, number][] = NFL
  ? [
      [10, 11],
      [11, 12],
      [12, 14],
      [14, 17],
    ]
  : [
      [50, 55],
      [55, 59],
      [59, 63],
      [64, 82],
    ];
/** Wins that take a round: best of 7 in basketball, one game in football. */
export const SERIES_WINS = NFL ? 1 : 4;
/**
 * Spread of the per-game win chance, in rating points; higher = more upsets. Basketball, at 12:
 * a typical 62-win team wins the title about 12% of the time, a 70-win team 45%, an 82-0 team 88%,
 * and an 82-0 team sweeps all four rounds about 4% of the time. Football, at 10: one game a
 * round: a 14-win team wins it all about 28% of the time and a 17-0 team 64-73%
 * (src/engine/engine.test.ts and nfl.test.ts check these).
 */
export const SERIES_K = NFL ? 10 : 12;
/** Fewest wins that make the playoffs: the "C · Playoff Team" grade. Below it a team is in the lottery. */
export const PLAYOFF_MIN_WINS = NFL ? 10 : 50;
export const HOME_EDGE = NFL ? 0.06 : 0.04;
/** The football final is on neutral ground. */
const NEUTRAL_FINAL = NFL;

export interface Series {
  round: number;
  opp: PlayoffTeam;
  oppRating: number;
  /** 1 = we won that game */
  games: number[];
  /** football: each game's score, ours first */
  scores?: [number, number][];
  played: boolean;
  won: boolean;
}

export function gameWinChance(ourRating: number, oppRating: number): number {
  return 1 / (1 + Math.exp(-(ourRating - oppRating) / SERIES_K));
}

/** Your chance in one game against a playoff team, at home and on the road (and on neutral ground). */
export function matchupOdds(ourRating: number, opp: PlayoffTeam): { home: number; road: number; neutral: number } {
  const p = gameWinChance(ourRating, ratingForWins(opp.wFull));
  const clamp = (x: number) => Math.min(0.97, Math.max(0.03, x));
  return { home: clamp(p + HOME_EDGE), road: clamp(p - HOME_EDGE), neutral: clamp(p) };
}

/** Basketball: your games at home in a best-of-7 (2-2-1-1-1), games 1, 2, 5 and 7 when you have the better record. */
export function homeGame(g: number, highSeed: boolean): boolean {
  const highHome = g === 0 || g === 1 || g === 4 || g === 6;
  return highSeed ? highHome : !highHome;
}

/** The chance of each game, in order (football: one game, at the better record's stadium or neutral). */
export function gameOdds(ourRating: number, ourWins: number, opp: PlayoffTeam, round: number, g: number): number {
  const odds = matchupOdds(ourRating, opp);
  const highSeed = ourWins >= opp.wFull;
  if (NFL) return NEUTRAL_FINAL && round === 3 ? odds.neutral : highSeed ? odds.home : odds.road;
  return homeGame(g, highSeed) ? odds.home : odds.road;
}

/** Exact chance of winning the round, from the per-game odds and the home pattern. */
export function seriesWinChance(ourRating: number, ourWins: number, opp: PlayoffTeam, round = 0): number {
  const memo = new Map<string, number>();
  const go = (a: number, b: number): number => {
    if (a === SERIES_WINS) return 1;
    if (b === SERIES_WINS) return 0;
    const key = a + ':' + b;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const p = gameOdds(ourRating, ourWins, opp, round, a + b);
    const v = p * go(a + 1, b) + (1 - p) * go(a, b + 1);
    memo.set(key, v);
    return v;
  };
  return go(0, 0);
}

export function simSeries(ourRating: number, ourWins: number, opp: PlayoffTeam, rand: Rand, round = 0): number[] {
  const games: number[] = [];
  let a = 0;
  let b = 0;
  for (let g = 0; a < SERIES_WINS && b < SERIES_WINS; g++) {
    if (rand() < gameOdds(ourRating, ourWins, opp, round, g)) {
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
    const options = pool.filter((t) => t.wFull >= lo && t.wFull <= hi && !chosen.some((c) => c.year === t.year && c.team === t.team));
    chosen.push(pickOne(options.length ? options : pool, rand));
  }
  return chosen;
}

/** Football: a playoff game's score, from both teams' scoring and defense. */
export function playoffScore(won: boolean, season: TeamRating & { pf?: number; pa?: number }, opp: PlayoffTeam, rand: Rand): [number, number] {
  const ourPf = season.pf ?? LEAGUE_PPG;
  const ourPa = season.pa ?? LEAGUE_PPG;
  return gameScore(won, (ourPf + (opp.pa ?? LEAGUE_PPG)) / 2, ((opp.pf ?? LEAGUE_PPG) + ourPa) / 2, rand);
}

export function buildBracket(season: TeamRating & { pf?: number; pa?: number }, rand: Rand): Series[] {
  const opps = pickOpponents(rand);
  let alive = true;
  return opps.map((opp, round) => {
    const s: Series = { round, opp, oppRating: ratingForWins(opp.wFull), games: [], played: alive, won: false };
    if (alive) {
      s.games = simSeries(season.rating, season.wins, opp, rand, round);
      s.won = s.games.filter((x) => x === 1).length === SERIES_WINS;
      if (NFL) s.scores = s.games.map((g) => playoffScore(g === 1, season, opp, rand));
      if (!s.won) alive = false;
    }
    return s;
  });
}

export interface PlayoffOutcome {
  seriesWon: number;
  title: boolean;
  /** rounds won without losing a game (in football, every round won) */
  sweeps: number;
  lostTo: Series | null;
  finals: Series;
}

export function playoffOutcome(bracket: Series[]): PlayoffOutcome {
  const played = bracket.filter((b) => b.played);
  return {
    seriesWon: played.filter((b) => b.won).length,
    title: played.length === 4 && played.every((b) => b.won),
    sweeps: played.filter((b) => b.won && b.games.length === SERIES_WINS).length,
    lostTo: played.find((b) => !b.won) ?? null,
    finals: bracket[3],
  };
}

/** A perfect season: every regular-season game, then every playoff game. */
export function isPerfect(wins: number, out: PlayoffOutcome | null): boolean {
  return !!out && out.title && out.sweeps === 4 && wins === GAMES;
}

export function seriesScore(games: number[]): [number, number] {
  const w = games.filter((x) => x === 1).length;
  return [w, games.length - w];
}
