import nbaRaw from '../data/nba.json';
import nflRaw from '../data/nfl.json';
import { NFL } from './sport';
import type { Cell, Line, OppPlayer, Player, PlayoffTeam, Slot } from './types';
import { lineValue } from './rating';

interface RawTeam<P> {
  id: string;
  fr: string;
  abbr: string;
  name: string;
  era: string;
  c1: string;
  c2: string;
  from: number;
  to: number;
  players: P[];
}

// basketball: see scripts/build_nba_data.py for the fields
type NbaPlayer = [string, string, number, number, number, number, number, number, number, number, number, number, string | null, string, number, number, number, number, number];
type NbaOpp = [string, string, number, number, number, number, number, number, number];
interface NbaData {
  source: string;
  built: number;
  teams: RawTeam<NbaPlayer>[];
  playoff: { year: string; team: string; abbr: string; w: number; l: number; w82: number; c1: string; c2: string; star: string; five: NbaOpp[] }[];
}

// football: see scripts/build_nfl_data.py (a defender's row has his role last)
type NflPlayer = [string, string, number, number, number, number, string | null, string, number, number, number, number, number, number, number, number, number, number, number, number, string?];
type NflOpp = [string, string, number, number, number, number, number, number, number, number, number];
type NflDefOpp = [string, string, number, number, number, number, number];
interface NflData {
  source: string;
  built: number;
  teams: RawTeam<NflPlayer>[];
  playoff: {
    year: string;
    team: string;
    abbr: string;
    w: number;
    l: number;
    t: number;
    w17: number;
    c1: string;
    c2: string;
    star: string;
    pf: number;
    pa: number;
    champ: boolean;
    five: NflOpp[];
    def: NflDefOpp[];
  }[];
}

const NFL_STATS = ['passYds', 'passTd', 'int', 'rushYds', 'rushTd', 'rec', 'recYds', 'recTd'] as const;
/** a defender's shown stats: per season (-1 not known), then Pro Bowls and All-Pro seasons */
const NFL_DEF = ['sacks', 'tkl', 'int', 'pd', 'ff', 'pb', 'ap'] as const;
/** Where each football position can play: anyone who runs or catches can be the FLEX; a defender plays his own spot. */
const NFL_SPOTS: Record<string, Slot[]> = { QB: ['QB'], RB: ['RB', 'FLEX'], WR: ['WR', 'FLEX'], TE: ['TE', 'FLEX'], DL: ['DL'], LB: ['LB'], DB: ['DB'] };
const NFL_DEFENDERS = new Set(['DL', 'LB', 'DB']);

function cellBase(t: RawTeam<unknown>) {
  return { cellId: t.id, abbr: t.abbr, era: t.era, teamName: t.name, c1: t.c1, c2: t.c2 };
}

function nbaPlayer(t: RawTeam<NbaPlayer>, p: NbaPlayer): Player {
  const player: Player = {
    id: t.id + ':' + p[13],
    pid: p[13],
    name: p[0],
    pos: p[1].split('/'),
    g: p[7],
    seasons: p[8],
    from: p[9],
    to: p[10],
    est: p[11] === 1,
    primeRef: p[12],
    ...cellBase(t),
    s: { pts: p[2], reb: p[3], ast: p[4], stl: p[5], blk: p[6] },
    r: { pts: p[14], reb: p[15], ast: p[16], stl: p[17], blk: p[18] },
    val: 0,
  };
  player.val = lineValue(player.r);
  return player;
}

function nflPlayer(t: RawTeam<NflPlayer>, p: NflPlayer): Player {
  const def = NFL_DEFENDERS.has(p[1]);
  const s: Line = {};
  const shown = p.slice(8, 16) as number[];
  if (def) NFL_DEF.forEach((k, i) => (s[k] = shown[i]));
  else NFL_STATS.forEach((k, i) => (s[k] = shown[i]));
  const player: Player = {
    id: t.id + ':' + p[7],
    pid: p[7],
    name: p[0],
    pos: NFL_SPOTS[p[1]] ?? [p[1]],
    g: p[2],
    seasons: p[3],
    from: p[4],
    to: p[5],
    // a defender's games before 1999 are partly counted from rosters
    est: def && shown[7] === 1,
    primeRef: p[6],
    ...cellBase(t),
    s,
    r: { pass: p[16], rush: p[17], recv: p[18], def: p[19] },
    val: 0,
  };
  if (def && p[20]) player.role = p[20];
  player.val = lineValue(player.r);
  return player;
}

function nflOpp([name, pos, g, ...line]: NflOpp): OppPlayer {
  const s: Line = {};
  NFL_STATS.forEach((k, i) => (s[k] = line[i]));
  return { name, pos, g, s, est: false };
}

function nflDefOpp([name, pos, g, sacks, tkl, int, hon]: NflDefOpp): OppPlayer {
  return { name, pos, g, s: { sacks, tkl, int, hon }, est: false };
}

const nba = nbaRaw as unknown as NbaData;
const nfl = nflRaw as unknown as NflData;

export const DATA_SOURCE = NFL ? nfl.source : nba.source;
export const LATEST_SEASON = NFL ? nfl.built : nba.built;

export const CELLS: Cell[] = NFL
  ? nfl.teams.map((t) => ({ id: t.id, fr: t.fr, abbr: t.abbr, name: t.name, era: t.era, c1: t.c1, c2: t.c2, from: t.from, to: t.to, players: t.players.map((p) => nflPlayer(t, p)) }))
  : nba.teams.map((t) => ({ id: t.id, fr: t.fr, abbr: t.abbr, name: t.name, era: t.era, c1: t.c1, c2: t.c2, from: t.from, to: t.to, players: t.players.map((p) => nbaPlayer(t, p)) }));

/** Cells by id. No prototype, so ids that arrive over the network ("constructor", "toString") find nothing. */
export const CELL_BY_ID: Record<string, Cell> = Object.assign(Object.create(null) as Record<string, Cell>, Object.fromEntries(CELLS.map((c) => [c.id, c])));
export const ERAS = NFL ? ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s'] : ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
export const TEAM_ABBRS = Array.from(new Set(CELLS.map((c) => c.abbr))).sort();
export const PLAYOFF_TEAMS: PlayoffTeam[] = NFL
  ? nfl.playoff.map(({ w17, five, def, ...t }) => ({ ...t, wFull: w17, five: five.map(nflOpp), def: def.map(nflDefOpp) }))
  : nba.playoff.map(({ w82, five, ...t }) => ({
      ...t,
      t: 0,
      wFull: w82,
      five: five.map(([name, pos, pts, reb, ast, stl, blk, g, est]) => ({ name, pos, g, s: { pts, reb, ast, stl, blk }, est: est === 1 })),
    }));

/** The player's best team-decade line, as a copy that keeps his current cell identity. */
export function primeVersion(p: Player): Player | null {
  if (!p.primeRef) return null;
  const cell = CELL_BY_ID[p.primeRef];
  if (!cell) return null;
  const best = cell.players.find((x) => x.pid === p.pid);
  if (!best || best.val <= p.val) return null;
  return { ...p, s: best.s, est: best.est, r: best.r, val: best.val, primedFrom: { cellId: cell.id, abbr: cell.abbr, era: cell.era } };
}
