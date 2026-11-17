import { pickFor } from '../engine/sport';
// Claude, 2026-11-01: Landmark Seasons. Real statistical landmarks found in our own card data (a 30
// PPG season, a rebounding or assists title, a 1,500-yard rushing season, 15 sacks, ...). Each one
// is a permanent edition `<sport>:landmark:<season>:<pid>:<fr>` (editions.ts), obtainable only from
// Landmark SBCs and set rewards. Nothing here depends on ratings: a catalog built from stats stays
// the same when the rating model changes. See docs/UT-CONTENT-2.md.
import type { CardLine, UtSport } from './types';

export type LandmarkType = 'scorer' | 'rebounder' | 'passer' | 'protector' | 'allround' | 'qb' | 'rusher' | 'receiver' | 'passrush' | 'ballhawk';

export interface Landmark {
  seasonId: string;
  type: LandmarkType;
  /** printed on the card: "31.4 PPG" */
  text: string;
  /** what the SBC list calls it: "Scoring Season" */
  title: string;
  /** larger is more remarkable (orders the catalog) */
  score: number;
}

/** The attributes a landmark boosts (+6 on the card): the skill that made the season. */
export const LANDMARK_ATTRS: Record<LandmarkType, string[]> = {
  scorer: ['3PT', 'MID', 'CLS', 'LAY'],
  rebounder: ['REB', 'BLK', 'IND'],
  passer: ['PAS', 'HND'],
  protector: ['BLK', 'IND', 'STL', 'PRD'],
  allround: ['PAS', 'REB', 'HND', 'LAY'],
  qb: ['THP', 'SAC', 'MAC', 'DAC', 'TUP'],
  rusher: ['BTK', 'JKM', 'CAR', 'BCV'],
  receiver: ['CTH', 'RTE', 'CIT', 'SPC', 'REL'],
  passrush: ['PMV', 'FMV', 'BSH'],
  ballhawk: ['ZCV', 'MCV', 'CTH', 'PRC'],
};

export const LANDMARK_TITLES: Record<LandmarkType, string> = {
  scorer: 'Scoring Season',
  rebounder: 'Rebounding Title',
  passer: 'Assists Title',
  protector: 'Blocks Title',
  allround: 'Triple-Double Season',
  qb: 'Record Passer',
  rusher: 'Rushing Landmark',
  receiver: 'Receiving Landmark',
  passrush: 'Sack Season',
  ballhawk: 'Ballhawk Season',
};

const n = (x: number | null | undefined) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const one = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const big = (x: number) => Math.round(x).toLocaleString('en-US');

/** NBA stints need this many games to count (a traded player's partial stint never qualifies). */
const NBA_GAMES = 50;

function nbaLandmarks(seasons: CardLine[]): Landmark[] {
  const out: Landmark[] = [];
  const qualified = seasons.filter((l) => n(l.stats.g ?? l.games) >= NBA_GAMES);
  // the season's leaders (per game, among qualified stints)
  const leader = (k: string) => {
    const by = new Map<number, CardLine>();
    for (const l of qualified) {
      if (typeof l.stats[k] !== 'number') continue;
      const b = by.get(l.season);
      if (!b || n(l.stats[k]) > n(b.stats[k]) || (n(l.stats[k]) === n(b.stats[k]) && l.id < b.id)) by.set(l.season, l);
    }
    return new Set([...by.values()].map((l) => l.id));
  };
  const reb = leader('reb');
  const ast = leader('ast');
  const blk = leader('blk');
  for (const l of qualified) {
    const s = l.stats;
    const pts = n(s.pts);
    let lm: Landmark | null = null;
    if (pts >= 10 && n(s.reb) >= 10 && n(s.ast) >= 10)
      lm = { seasonId: l.id, type: 'allround', text: one(pts) + ' / ' + one(n(s.reb)) + ' / ' + one(n(s.ast)), title: LANDMARK_TITLES.allround, score: 100 + pts };
    else if (pts >= 30) lm = { seasonId: l.id, type: 'scorer', text: one(pts) + ' PPG', title: LANDMARK_TITLES.scorer, score: 60 + pts };
    else if (reb.has(l.id) && n(s.reb) >= 11) lm = { seasonId: l.id, type: 'rebounder', text: one(n(s.reb)) + ' RPG · REB TITLE', title: LANDMARK_TITLES.rebounder, score: 50 + n(s.reb) };
    else if (ast.has(l.id) && n(s.ast) >= 8) lm = { seasonId: l.id, type: 'passer', text: one(n(s.ast)) + ' APG · AST TITLE', title: LANDMARK_TITLES.passer, score: 50 + n(s.ast) };
    else if (blk.has(l.id) && n(s.blk) >= 2.5) lm = { seasonId: l.id, type: 'protector', text: one(n(s.blk)) + ' BPG · BLK TITLE', title: LANDMARK_TITLES.protector, score: 45 + n(s.blk) * 3 };
    if (lm) out.push(lm);
  }
  return out;
}

function nflLandmarks(seasons: CardLine[]): Landmark[] {
  const out: Landmark[] = [];
  for (const l of seasons) {
    const s = l.stats;
    const g = l.grp ?? '';
    let lm: Landmark | null = null;
    if (g === 'QB' && (n(s.yds) >= 4500 || n(s.td) >= 40))
      lm = { seasonId: l.id, type: 'qb', text: big(n(s.yds)) + ' YDS · ' + n(s.td) + ' TD', title: LANDMARK_TITLES.qb, score: n(s.yds) / 100 + n(s.td) };
    else if (g === 'RB' && n(s.ry) >= 1500) lm = { seasonId: l.id, type: 'rusher', text: big(n(s.ry)) + ' RUSH YDS', title: LANDMARK_TITLES.rusher, score: n(s.ry) / 30 };
    else if ((g === 'WR' || g === 'TE') && n(s.recy) >= 1500) lm = { seasonId: l.id, type: 'receiver', text: big(n(s.recy)) + ' REC YDS', title: LANDMARK_TITLES.receiver, score: n(s.recy) / 30 };
    else if ((g === 'DL' || g === 'LB') && n(s.sk) >= 15) lm = { seasonId: l.id, type: 'passrush', text: one(n(s.sk)).replace(/\.0$/, '') + ' SACKS', title: LANDMARK_TITLES.passrush, score: n(s.sk) * 3 };
    else if ((g === 'CB' || g === 'S' || g === 'LB') && n(s.int) >= 10) lm = { seasonId: l.id, type: 'ballhawk', text: n(s.int) + ' INT', title: LANDMARK_TITLES.ballhawk, score: n(s.int) * 5 };
    if (lm) out.push(lm);
  }
  return out;
}

const catalogs = new WeakMap<CardLine[], Map<string, Landmark>>();

/** Every landmark season in the data, by its season card id (built once per card list). */
export function landmarkCatalog(lines: CardLine[]): Map<string, Landmark> {
  let c = catalogs.get(lines);
  if (!c) {
    const seasons = lines.filter((l) => l.kind === 'season' && !l.sparse);
    const sport: UtSport = seasons[0]?.sport ?? 'nba';
    // soccer has no landmark catalogue (Claude 2026-11-01): its Landmark editions don't exist
    const list = pickFor(sport, { nba: () => nbaLandmarks(seasons), nfl: () => nflLandmarks(seasons), soccer: () => [] as Landmark[] })();
    list.sort((a, b) => b.score - a.score || (a.seasonId < b.seasonId ? -1 : 1));
    c = new Map(list.map((x) => [x.seasonId, x]));
    catalogs.set(lines, c);
  }
  return c;
}

/**
 * The landmark of a season card even when the catalog no longer lists it (a data rebuild): an owned
 * Landmark edition must load forever, so it falls back to the season's best line.
 */
export function landmarkFallback(line: CardLine): Landmark {
  const s = line.stats;
  if (line.sport === 'nba') return { seasonId: line.id, type: 'scorer', text: one(n(s.pts)) + ' PPG', title: LANDMARK_TITLES.scorer, score: 0 };
  const g = line.grp ?? '';
  if (g === 'QB') return { seasonId: line.id, type: 'qb', text: big(n(s.yds)) + ' YDS', title: LANDMARK_TITLES.qb, score: 0 };
  if (g === 'RB') return { seasonId: line.id, type: 'rusher', text: big(n(s.ry)) + ' RUSH YDS', title: LANDMARK_TITLES.rusher, score: 0 };
  if (g === 'WR' || g === 'TE') return { seasonId: line.id, type: 'receiver', text: big(n(s.recy)) + ' REC YDS', title: LANDMARK_TITLES.receiver, score: 0 };
  if (g === 'DL') return { seasonId: line.id, type: 'passrush', text: n(s.sk) + ' SACKS', title: LANDMARK_TITLES.passrush, score: 0 };
  return { seasonId: line.id, type: 'ballhawk', text: n(s.int) + ' INT', title: LANDMARK_TITLES.ballhawk, score: 0 };
}
