// What the screens say and show differently for each sport.
import { GAMES } from '../engine/rating';
import { NFL } from '../engine/sport';
import type { Line, OppPlayer, Player } from '../engine/types';
import { lastName } from '../lib/share';

/** "82–0" / "17–0" */
export const PERFECT_RECORD = GAMES + '–0';
/** the playoff part of a perfect run: four sweeps, or four wins */
export const PERFECT_PLAYOFFS = NFL ? '4–0' : '16–0';
export const CHAMPS = NFL ? 'Super Bowl champions' : 'NBA champions';
/** where the lineup stands */
export const FLOOR = NFL ? 'field' : 'court';

export function record(wins: number, games = GAMES): string {
  return wins + '–' + (games - wins);
}

export function isDefense(p: { pos: string[] }): boolean {
  return p.pos[0] === 'DEF';
}

/** Basketball "1989–90", football "1989". */
export function seasonLabel(year: number): string {
  return NFL ? String(year) : year - 1 + '–' + String(year).slice(2);
}

/** "PG • SG" in basketball; a football player's own position (a RB is "RB", not "RB • FLEX"). */
export function posLabel(p: Player): string {
  return NFL ? p.pos[0] : p.pos.join(' • ');
}

export interface StatCol {
  key: string;
  label: string;
  value: number;
  text: string;
}

const one = (x: number) => x.toFixed(1);
const yards = (x: number) => Math.round(x).toString();
const ordinal = (n: number) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');

/** The stats a player's row shows, by sport and position (per game). */
export function statCols(p: { pos: string[]; s: Line }): StatCol[] {
  const s = p.s;
  const col = (key: string, label: string, text: (x: number) => string): StatCol => ({ key, label, value: s[key] ?? 0, text: text(s[key] ?? 0) });
  if (!NFL) return ['pts', 'reb', 'ast', 'stl', 'blk'].map((k) => col(k, k.toUpperCase(), one));
  switch (p.pos[0]) {
    case 'QB':
      return [col('passYds', 'PASS', yards), col('passTd', 'TD', one), col('int', 'INT', one), col('rushYds', 'RUSH', yards)];
    case 'RB':
      return [col('rushYds', 'RUSH', yards), col('rushTd', 'TD', one), col('rec', 'REC', one), col('recYds', 'YDS', yards)];
    case 'DEF':
      return [col('pa', 'ALLOWED', one), col('lg', 'LEAGUE', one), col('top5', 'TOP 5', (x) => String(x)), col('best', 'BEST', (x) => ordinal(x))];
    default:
      return [col('rec', 'REC', one), col('recYds', 'YDS', yards), col('recTd', 'TD', one), col('rushYds', 'RUSH', yards)];
  }
}

/** A playoff opponent's key player, the same way. */
export function oppCols(p: OppPlayer): StatCol[] {
  return statCols({ pos: [p.pos], s: p.s });
}

export type SortKey = string;
/**
 * Ways to sort a team's list. Football, whatever the position: total yards (every yards column a
 * row shows lights up) and the touchdowns in the row's TD column.
 */
export const SORTS: [SortKey, string][] = NFL
  ? [
      ['val', 'VALUE'],
      ['yds', 'YARDS'],
      ['td', 'TDS'],
      ['g', 'GAMES'],
    ]
  : [
      ['val', 'VALUE'],
      ['pts', 'PTS'],
      ['reb', 'REB'],
      ['ast', 'AST'],
      ['stl', 'STL'],
      ['blk', 'BLK'],
      ['g', 'GAMES'],
    ];

export function sortValue(p: Player, key: SortKey): number {
  if (key === 'val') return p.val;
  if (key === 'g') return p.g;
  if (NFL) {
    const s = p.s;
    // a defense has no yards or touchdowns of its own: it sorts last
    if (isDefense(p)) return -1;
    // the yards columns the row shows: a passer's passing and rushing, everyone else's rushing and receiving
    if (key === 'yds') return statCols(p).reduce((sum, c) => sum + (c.key.endsWith('Yds') ? c.value : 0), 0);
    // a passer's, a back's runs, a receiver's catches: the one TD a row shows
    if (key === 'td') return (p.pos[0] === 'QB' ? s.passTd : p.pos[0] === 'RB' ? s.rushTd : s.recTd) ?? 0;
  }
  return p.s[key] ?? 0;
}

/** Which of a row's stats light up for a sort. */
export function hotFor(key: SortKey, col: StatCol, p: { pos: string[] }): boolean {
  if (!NFL) return col.key === key;
  if (p.pos[0] === 'DEF') return false;
  if (key === 'yds') return col.key === 'passYds' || col.key === 'recYds' || col.key === 'rushYds';
  if (key === 'td') return col.key === 'passTd' || col.key === 'rushTd' || col.key === 'recTd';
  return false;
}

/** The short name on a lineup card: the last name (with its St. or Van), or a defense's team name. */
export function cardName(p: Player): string {
  return isDefense(p) ? p.name.replace(/ Defense$/, '') : lastName(p.name);
}
