import { type Rand, hashString, rng, shuffle } from './rng';
import { GAMES, rateTeam, type TeamRating } from './rating';
import { NFL } from './sport';
import { type Lineup, SLOTS } from './types';

/** One football game: our score, theirs, the other team and whether we were home. */
export interface GameScore {
  us: number;
  them: number;
  opp: string;
  home: boolean;
}

export interface Season extends TeamRating {
  /** the season's results in order, 1 = win. Same lineup -> same sequence. */
  seq: number[];
  longestWin: number;
  firstHalfWins: number;
  /** football: every game's score, and points for and against per game */
  scores?: GameScore[];
  pf?: number;
  pa?: number;
}

export function lineupKey(l: Lineup): string {
  return SLOTS.map((s) => (l[s] ? l[s]!.id + (l[s]!.primedFrom ? '*' : '') : '-')).join('|');
}

export function playSeason(l: Lineup): Season {
  const r = rateTeam(SLOTS.map((s) => l[s]));
  const rand = rng(hashString('season:' + lineupKey(l)));
  const seq = seasonSequence(r.wins, rand);
  const out: Season = { ...r, seq, longestWin: longestRun(seq, 1), firstHalfWins: seq.slice(0, Math.floor(GAMES / 2)).filter((x) => x === 1).length };
  if (NFL) {
    const { pf, pa } = expectedScores(r);
    out.scores = gameScores(seq, pf, pa, rand);
    out.pf = out.scores.reduce((a, g) => a + g.us, 0) / GAMES;
    out.pa = out.scores.reduce((a, g) => a + g.them, 0) / GAMES;
  }
  return out;
}

export function seasonSequence(wins: number, rand: Rand): number[] {
  const a: number[] = [];
  for (let i = 0; i < GAMES; i++) a.push(i < wins ? 1 : 0);
  return shuffle(a, rand);
}

export function longestRun(seq: number[], v: number): number {
  let best = 0;
  let cur = 0;
  for (const x of seq) {
    if (x === v) {
      cur++;
      if (cur > best) best = cur;
    } else cur = 0;
  }
  return best;
}

// ---------- football scores ----------

/** Scores a football team actually puts up: touchdowns and field goals, most often. */
const SCORES = [0, 3, 6, 7, 9, 10, 13, 14, 16, 17, 19, 20, 21, 23, 24, 26, 27, 28, 30, 31, 33, 34, 35, 37, 38, 41, 42, 44, 45, 48, 49, 52, 55];
/** A season's league average, points per team per game. */
export const LEAGUE_PPG = 22;
const TEAMS = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'];

/**
 * Points for and against per game that go with a record: the margin a real team needs for that
 * win rate (about 0.028 of win rate per point a game), split between offense and defense by
 * how strong each is on this team.
 */
export function expectedScores(r: TeamRating): { pf: number; pa: number } {
  const winRate = r.wins / GAMES;
  const margin = Math.max(-16, Math.min(20, (winRate - 0.5) / 0.028));
  const off = (r.ratios[0] + r.ratios[1] + r.ratios[2]) / 3;
  const def = r.ratios[3];
  const share = Math.max(0.2, Math.min(0.8, 0.5 + 0.9 * (off - def)));
  return { pf: LEAGUE_PPG + margin * share, pa: LEAGUE_PPG - margin * (1 - share) };
}

function normal(rand: Rand): number {
  // Box-Muller from the seeded generator
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** A plausible football score near `mean`. */
export function sampleScore(mean: number, rand: Rand): number {
  const x = mean + 9.5 * normal(rand);
  let best = SCORES[0];
  for (const s of SCORES) if (Math.abs(s - x) < Math.abs(best - x)) best = s;
  return best;
}

/** A game's score that agrees with its result (no ties). */
export function gameScore(won: boolean, pf: number, pa: number, rand: Rand): [number, number] {
  for (let i = 0; i < 24; i++) {
    const us = sampleScore(pf, rand);
    const them = sampleScore(pa, rand);
    if (us !== them && us > them === won) return [us, them];
  }
  // the dice keep disagreeing with the result: the winner gets the higher score, and a tie
  // becomes a field goal
  const a = sampleScore(pf, rand);
  const b = sampleScore(pa, rand);
  const hi = Math.max(a, b);
  const lo = a === b ? Math.max(0, hi - 3) : Math.min(a, b);
  const top = a === b && hi === 0 ? 3 : hi;
  return won ? [top, lo] : [lo, top];
}

function gameScores(seq: number[], pf: number, pa: number, rand: Rand): GameScore[] {
  const opps = shuffle(TEAMS, rand);
  const start = rand() < 0.5 ? 0 : 1;
  return seq.map((x, i) => {
    const [us, them] = gameScore(x === 1, pf, pa, rand);
    return { us, them, opp: opps[i % opps.length], home: (i + start) % 2 === 0 };
  });
}

/** Calendar day in US Eastern time, e.g. "2026-10-24". */
export function easternDateKey(d: Date = new Date()): string {
  try {
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Daily puzzle number: #1 is 2026-10-24 (launch day). */
export function dailyNumber(key: string): number {
  const t = Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  return Math.floor((t - Date.UTC(2026, 9, 24)) / 86400000) + 1;
}
