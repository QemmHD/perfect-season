// The Legends Gauntlet: after a run, the team you drafted takes on eight of the greatest teams
// ever, weakest first, on neutral ground. A loss costs one of three lives and means a rematch; the
// third loss ends the climb. The ladder changes each week (the same for everyone that week); the
// last rung is always one of the two best teams of all.
import { PLAYOFF_TEAMS } from './data';
import { gameWinChance, playoffScore } from './playoffs';
import { ratingForWins, type TeamRating } from './rating';
import { hashString, rng } from './rng';
import { NFL } from './sport';
import type { PlayoffTeam } from './types';

export const GAUNTLET_SIZE = 8;
export const LIVES = 3;
/** coins for each rung won, and for winning them all */
export const RUNG_COINS = [4, 5, 6, 7, 8, 10, 12, 15];
export const CLEAR_COINS = 60;

/**
 * Where each rung draws from, by rank among every playoff team in the data (best first). The pools
 * are about the same in both sports as a share of the teams: from a very good team to the best.
 */
const WINDOWS: [number, number][] = NFL
  ? [
      [150, 230],
      [90, 150],
      [55, 90],
      [30, 55],
      [16, 30],
      [8, 16],
      [2, 8],
      [0, 2],
    ]
  : [
      [80, 120],
      [50, 80],
      [30, 50],
      [18, 30],
      [10, 18],
      [5, 10],
      [2, 5],
      [0, 2],
    ];

const RANKED = PLAYOFF_TEAMS.slice().sort((a, b) => b.wFull - a.wFull || b.w - b.l - (a.w - a.l) || a.year.localeCompare(b.year));

/** This week's eight, weakest first. */
export function gauntletLadder(week: string): PlayoffTeam[] {
  const rand = rng(hashString('gauntlet:' + week));
  const out: PlayoffTeam[] = [];
  for (const [lo, hi] of WINDOWS) {
    const pool = RANKED.slice(lo, Math.min(hi, RANKED.length)).filter((t) => !out.some((o) => o.year === t.year && o.team === t.team));
    // football's pools hold many teams with the same record: a champion is the better story
    const champs = pool.filter((t) => t.champ);
    const from = NFL && champs.length && rand() < 0.6 ? champs : pool;
    out.push(from[Math.floor(rand() * from.length)] ?? RANKED[0]);
  }
  return out;
}

export interface GauntletGame {
  /** which rung, 0 first */
  rung: number;
  opp: PlayoffTeam;
  /** your chance to win it */
  chance: number;
  won: boolean;
  /** football's final score, yours first (basketball's comes from the game itself) */
  score: [number, number] | null;
}

/**
 * Football: a legend team's defensive star, for the ladder next to its offensive one. Its best
 * honored defender that season (first-team All-Pro over Pro Bowl), or none. Every legend team
 * brings its season's best DL, LB and DB to the game (PlayoffTeam.def), who make its defensive
 * plays in the telling.
 */
export function defensiveStar(t: PlayoffTeam): string | null {
  const best = (t.def ?? []).filter((p) => (p.s.hon ?? 0) > 0).sort((a, b) => (b.s.hon ?? 0) - (a.s.hon ?? 0))[0];
  return best ? best.name : null;
}

/** Your chance against a legend on neutral ground. */
export function rungChance(rating: number, opp: PlayoffTeam): number {
  return Math.min(0.97, Math.max(0.03, gameWinChance(rating, ratingForWins(opp.wFull))));
}

/**
 * The whole climb, decided up front from the seed (the run): every game until the top or the last
 * life. Watching it only shows what already happened, so leaving early changes nothing.
 */
export function climb(team: TeamRating & { pf?: number; pa?: number }, ladder: PlayoffTeam[], seed: string): GauntletGame[] {
  const rand = rng(hashString('climb:' + seed));
  const out: GauntletGame[] = [];
  let lives = LIVES;
  for (let rung = 0; rung < ladder.length && lives > 0; ) {
    const opp = ladder[rung];
    const chance = rungChance(team.rating, opp);
    const won = rand() < chance;
    out.push({ rung, opp, chance, won, score: NFL ? playoffScore(won, team, opp, rand) : null });
    if (won) rung++;
    else lives--;
  }
  return out;
}

/** Rungs won in a climb. */
export function rungsWon(games: GauntletGame[]): number {
  return games.filter((g) => g.won).length;
}

/** The chance of reaching the top with the lives you have. */
export function clearChance(rating: number, ladder: PlayoffTeam[], lives = LIVES): number {
  const p = ladder.map((t) => rungChance(rating, t));
  const memo = new Map<string, number>();
  const go = (i: number, l: number): number => {
    if (i === p.length) return 1;
    if (l === 0) return 0;
    const k = i + ':' + l;
    if (!memo.has(k)) memo.set(k, p[i] * go(i + 1, l) + (1 - p[i]) * go(i, l - 1));
    return memo.get(k)!;
  };
  return go(0, lives);
}

export function coinsFor(wins: number): number {
  return RUNG_COINS.slice(0, wins).reduce((a, b) => a + b, 0) + (wins >= GAUNTLET_SIZE ? CLEAR_COINS : 0);
}
