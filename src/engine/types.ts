import { NFL } from './sport';

/**
 * A spot in the lineup. Basketball: PG, SG, SF, PF, C. Football: QB, RB, WR, TE, FLEX on offense,
 * and three defenders: DL (a lineman), LB (a linebacker), DB (a corner or a safety).
 */
export type Slot = string;
export const SLOTS: Slot[] = NFL ? ['QB', 'RB', 'WR', 'TE', 'FLEX', 'DL', 'LB', 'DB'] : ['PG', 'SG', 'SF', 'PF', 'C'];
/** Football's defensive spots: each takes one real defender. */
export const DEF_SLOTS: Slot[] = NFL ? ['DL', 'LB', 'DB'] : [];

export type Mode = 'classic' | 'blind' | 'daily' | '1v1';
export type BotLevel = 'rookie' | 'pro' | 'legend';
export type Booster = 'double' | 'trade' | 'prime';
export const BOOSTERS: Booster[] = ['double', 'trade', 'prime'];

/**
 * A stat line. Basketball, per game: pts, reb, ast, stl, blk. Football's offense, per game: passYds,
 * passTd, int, rushYds, rushTd, rec, recYds, recTd. A football defender, per season: sacks, tkl,
 * int, pd (passes defended), ff (forced fumbles), -1 when no source has it; and pb, ap: his Pro Bowl
 * and first-team All-Pro seasons in the line.
 */
export type Line = Record<string, number>;

export interface Player {
  /** unique per cell: `${cellId}:${pid}` */
  id: string;
  pid: string;
  name: string;
  /** the spots he can fill (a football running back: RB and FLEX) */
  pos: Slot[];
  /** football defenders: the position he played, finer than the spot (DE, DT, OLB, CB, FS...) */
  role?: string;
  g: number;
  seasons: number;
  from: number;
  to: number;
  /** basketball: steals/blocks partly estimated (pre-1973-74 seasons); football: games partly
      estimated from rosters (defenders before 1999) */
  est: boolean;
  primeRef: string | null;
  cellId: string;
  abbr: string;
  era: string;
  teamName: string;
  c1: string;
  c2: string;
  /** the real per-game stats, as shown */
  s: Line;
  /** what the game scores: per-game stats measured against the player's own era,
      with short stints blended toward his career rate. Basketball keeps the stat names;
      football splits the player's value into pass, rush, recv and def (a defender's is all def) */
  r: Line;
  /** weighted value of `r` */
  val: number;
  /** set when the Prime booster upgraded this pick */
  primedFrom?: { cellId: string; abbr: string; era: string };
}

export interface Cell {
  id: string;
  fr: string;
  abbr: string;
  name: string;
  era: string;
  c1: string;
  c2: string;
  from: number;
  to: number;
  players: Player[];
}

/** One of a playoff team's key players, with that season's real per-game line. */
export interface OppPlayer {
  name: string;
  pos: string;
  g: number;
  s: Line;
  /** steals and blocks estimated (before 1973-74) */
  est: boolean;
}

export interface PlayoffTeam {
  /** basketball "1995-96", football "1985" */
  year: string;
  team: string;
  abbr: string;
  w: number;
  l: number;
  /** football ties */
  t: number;
  /** wins over a full season of today's length (82 or 17 games) */
  wFull: number;
  c1: string;
  c2: string;
  star: string;
  /** basketball: the five who played the most minutes; football: QB, RB and the top two receivers */
  five: OppPlayer[];
  /** football: the season's best defender at DL, LB and DB (their `s`: sacks, tkl, int that season,
      -1 not known, and hon: 2 first-team All-Pro, 1 Pro Bowl or second team) */
  def?: OppPlayer[];
  /** football: real points for and against per game, and whether they won it all */
  pf?: number;
  pa?: number;
  champ?: boolean;
}

export type Lineup = Record<Slot, Player | null>;

export function emptyLineup(): Lineup {
  return Object.fromEntries(SLOTS.map((s) => [s, null]));
}
