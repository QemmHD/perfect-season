import { specialEditions } from './specials';
// Ultimate Team card data: every player-season as a CardLine, plus promo ("Hot Season") and legend
// lines. Built by scripts/build_cards.py into src/data/cards-<sport>.json (stored column by
// column; the script's header has every rule) and loaded only when Ultimate Team opens.
//
// Card id: `<sport>:<kind>:<season>:<pid>:<fr>`, fr the franchise code (NBA 'OKC' for a 1979
// SuperSonics card, whose abbr is 'SEA'). A promo or legend shares its season card's stats, ranks,
// honors and pos objects (treat them as read-only) and names it in `seasonId`.
//
// NBA `stats` (per team stint; per game unless noted):
//   g games, mpg minutes; pts reb ast stl blk tov (stl/blk from 1973-74, tov from 1977-78, else
//   null); fg2 2P% (0-1); fg3 3P% (null under 25 attempts); a3 3PA; ft FT% (null under 20 attempts);
//   fta FTA; orb drb (from 1973-74); dunk share of FGA that were dunks, rim FG% from 0-3 ft (both
//   1996-97 on)
// NBA `rk` (0-1 within the season, among stints with 20+ games): pts (per game); reb ast stl blk
//   (per 36 minutes); val (the draft game's era-rated value); fg3, ft (among stints with a %)
//
// NFL `stats` are season totals, by group (`grp`); every group has dr dp (draft round, overall pick):
//   QB  att cmp yds td int (passing; cmp null 1992-98), sk (sacks taken, 1999+), car ry rtd (rushing)
//   RB  car ry rtd (rushing), tgt rec recy rectd (receiving; tgt from 1992, partly)
//   WR  tgt rec recy rectd car ry rtd;  TE tgt rec recy rectd
//   DL LB CB S  tkl tfl sk qbh int pd ff td (1999+; before, only sk/int and what a Wikipedia table has)
//   OL  dr dp only;  K fgm fga, fgm40 fga40 (40-49 yds), fgm50 fga50 (50+), lng, xpm xpa
// NFL `rk` (0-1 within the season and group, among its regulars; counting stats per game):
//   QB  yds td ypa cmpp intr (fewer INTs per attempt is higher) rating aya ry gs draft
//   RB  ry ypc rtd rec recy gs draft;  WR/TE rec recy rectd ypr tgt cr gs draft
//   DL  sk tfl qbh tkl ff gs draft;  LB tkl sk int tfl pd gs draft;  CB/S int pd tkl ff gs draft
//   OL  gs draft;  K fgp fgp50 lng fgm xpp
//   gs ranks starts; draft ranks the overall pick (earlier is higher, undrafted lowest).
/// <reference types="vite/client" />
import type { CardKind, CardLine, UtSport } from './types';

/** The file as build_cards.py writes it. */
export interface CardsFile {
  sport: UtSport;
  /** season lines */
  n: number;
  /** [group, stat keys, rank keys] */
  groups: [string, string[], string[]][];
  /** [pid, name, height in, weight lb] */
  players: [string, string, number | null, number | null][];
  /** [franchise, abbreviation, team name, color 1, color 2] */
  teams: [string, string, string, string, string][];
  honors: string[];
  cols: {
    player: number[];
    season: number[];
    team: number[];
    pos: string[];
    num: (number | null)[];
    games: (number | null)[];
    starts: (number | null)[];
    group: number[];
    honors: number[][];
    sparse: number[];
  };
  /** group -> stat -> one value per line of that group, in line order */
  stats: Record<string, Record<string, (number | null)[]>>;
  /** the same for ranks, as permille (0-1000) */
  rk: Record<string, Record<string, (number | null)[]>>;
  /** [season line index, boost, label] */
  promos: [number, number, string][];
  legends: [number, number, string][];
}

export interface CardPool {
  lines: CardLine[];
  byId: Map<string, CardLine>;
  promos: CardLine[];
  legends: CardLine[];
}

export function cardId(sport: UtSport, kind: CardKind, season: number, pid: string, fr: string): string {
  return `${sport}:${kind}:${season}:${pid}:${fr}`;
}

/** The file's columns as CardLine objects: season lines first, then promos, then legends. */
export interface SeasonReferences {
  source: string;
  columns: string[];
  rows: Record<string, (number | string | null)[]>;
}

export function expandCards(f: CardsFile, references?: SeasonReferences): CardPool {
  const c = f.cols;
  const seen: Record<string, number> = {};
  const seasons: CardLine[] = [];
  for (let i = 0; i < f.n; i++) {
    const [grp, statKeys, rkKeys] = f.groups[c.group[i]];
    const j = (seen[grp] = (seen[grp] ?? -1) + 1);
    const [pid, name, ht, wt] = f.players[c.player[i]];
    const [fr, abbr, teamName, c1, c2] = f.teams[c.team[i]];
    const stats: Record<string, number | null> = {};
    for (const k of statKeys) stats[k] = f.stats[grp][k][j];
    const rk: Record<string, number | null> = {};
    for (const k of rkKeys) {
      const v = f.rk[grp][k][j];
      rk[k] = v === null ? null : v / 1000;
    }
    const line: CardLine = {
      id: cardId(f.sport, 'season', c.season[i], pid, fr),
      sport: f.sport,
      kind: 'season',
      pid,
      name,
      season: c.season[i],
      fr,
      abbr,
      teamName,
      c1,
      c2,
      pos: c.pos[i].split('/'),
      ht,
      wt,
      num: c.num[i],
      games: c.games[i],
      starts: c.starts[i],
      stats,
      rk,
      honors: c.honors[i].map((h) => f.honors[h]),
      grp,
    };
    if (c.sparse[i]) line.sparse = true;
    const ref = references?.rows[`${pid}:${line.season}`];
    if (ref && typeof ref[1] === 'number') {
      const attrs: Record<string, number> = {};
      references!.columns.forEach((code, j) => {
        const value = ref[j + 2];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 99) attrs[code] = value;
      });
      line.ratingReference = { source: references!.source, snapshot: String(ref[0]), ovr: ref[1], attrs };
    }
    seasons.push(line);
  }
  const derive = (kind: CardKind) => ([i, boost, label]: [number, number, string]): CardLine => {
    const base = seasons[i];
    return { ...base, id: cardId(f.sport, kind, base.season, base.pid, base.fr), kind, boost, label, seasonId: base.id };
  };
  const promos = f.promos.map(derive('promo'));
  const legends = f.legends.map(derive('legend'));
  const lines = [...seasons, ...promos, ...legends, ...specialEditions(seasons)];
  return { lines, byId: new Map(lines.map((l) => [l.id, l])), promos, legends };
}

// the files may not exist (an older build): a glob finds whatever is there
const FILES = import.meta.glob<{ default: CardsFile }>('../data/cards-*.json');
const REFERENCES = import.meta.glob<{ default: SeasonReferences }>('../data/season-references-*.json');

const pools = new Map<UtSport, Promise<CardPool>>();

/** The sport's card pool, loaded once (a failed load is retried on the next call). */
export function loadCards(sport: UtSport): Promise<CardPool> {
  let p = pools.get(sport);
  if (!p) {
    const key = Object.keys(FILES).find((k) => k.endsWith(`cards-${sport}.json`));
    p = key
      ? Promise.all([FILES[key](), REFERENCES[`../data/season-references-${sport}.json`]?.()]).then(([m, r]) => expandCards(m.default, r?.default))
      : Promise.resolve({ lines: [], byId: new Map(), promos: [], legends: [] });
    p.catch(() => pools.delete(sport));
    pools.set(sport, p);
  }
  return p;
}

/** The sport's ~120 legend cards, best first. */
export async function legendsOf(sport: UtSport): Promise<CardLine[]> {
  return (await loadCards(sport)).legends;
}

/** The sport's promo (Hot Season) cards. */
export async function promosOf(sport: UtSport): Promise<CardLine[]> {
  return (await loadCards(sport)).promos;
}
