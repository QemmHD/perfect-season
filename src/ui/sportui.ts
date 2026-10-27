// What the screens say and show differently for each sport.
import { GAMES } from '../engine/rating';
import { NFL } from '../engine/sport';
import { DEF_SLOTS, type Line, type OppPlayer, type Player } from '../engine/types';
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

/** A football defender (DL, LB or DB): his stats are per season, and he has no yards or touchdowns. */
export function isDefender(p: { pos: string[] }): boolean {
  return DEF_SLOTS.includes(p.pos[0]);
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
/** a defender's stat: -1 when no source kept it that far back */
const kept = (f: (x: number) => string) => (x: number) => (x < 0 ? '–' : f(x));
const count = (x: number) => String(Math.round(x));

/** A playoff team's defender's honor that season: "ALL-PRO", "PRO BOWL", or none. */
export function honorLabel(p: OppPlayer): string | null {
  return p.s.hon === 2 ? 'ALL-PRO' : p.s.hon === 1 ? 'PRO BOWL' : null;
}

/**
 * The stats a player's row shows, by sport and position: per game, a football defender's per
 * season (with his Pro Bowls and first-team All-Pro seasons for the team), and a playoff team's
 * defender's that one season (with his honor).
 */
export function statCols(p: { pos: string[]; s: Line }): StatCol[] {
  const s = p.s;
  const col = (key: string, label: string, text: (x: number) => string): StatCol => ({ key, label, value: s[key] ?? 0, text: text(s[key] ?? 0) });
  if (!NFL) return ['pts', 'reb', 'ast', 'stl', 'blk'].map((k) => col(k, k.toUpperCase(), one));
  if (isDefender(p)) {
    const sacks = col('sacks', 'SACKS', kept(one));
    const tkl = col('tkl', 'TKL', kept(count));
    const int = col('int', 'INT', kept(one));
    const main = p.pos[0] === 'DL' ? [sacks, tkl] : p.pos[0] === 'LB' ? [tkl, sacks] : [int, tkl];
    // a playoff team's defender, that one season (his honor goes by his name: honorLabel)
    if ('hon' in s) return [...main, p.pos[0] === 'DB' ? sacks : int];
    return [...main, col('pb', 'PRO BOWL', count), col('ap', 'ALL-PRO', count)];
  }
  switch (p.pos[0]) {
    case 'QB':
      return [col('passYds', 'PASS', yards), col('passTd', 'TD', one), col('int', 'INT', one), col('rushYds', 'RUSH', yards)];
    case 'RB':
      return [col('rushYds', 'RUSH', yards), col('rushTd', 'TD', one), col('rec', 'REC', one), col('recYds', 'YDS', yards)];
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
 * row shows lights up), the touchdowns in the row's TD column, and the defenders first, by value
 * (their main stat lights up).
 */
export const SORTS: [SortKey, string][] = NFL
  ? [
      ['val', 'VALUE'],
      ['yds', 'YARDS'],
      ['td', 'TDS'],
      ['def', 'DEFENSE'],
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
    // the defenders first, the best on top; then everyone else, the same way
    if (key === 'def') return isDefender(p) ? 100 + p.val : p.val - 100;
    // a defender has no yards or touchdowns of his own: he sorts last
    if (isDefender(p)) return -1;
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
  // a defender's main stat: sacks, tackles or interceptions, the first a row shows
  if (isDefender(p)) return key === 'def' && statCols({ pos: p.pos, s: {} })[0].key === col.key;
  if (key === 'yds') return col.key === 'passYds' || col.key === 'recYds' || col.key === 'rushYds';
  if (key === 'td') return col.key === 'passTd' || col.key === 'rushTd' || col.key === 'recTd';
  return false;
}

/** The short name on a lineup card: the last name (with its St. or Van). */
export function cardName(p: Player): string {
  return lastName(p.name);
}

/** "LB · OLB": a football defender's spot and the position he played, when it says more. */
export function roleLabel(p: Player): string {
  return p.role && p.role !== p.pos[0] ? posLabel(p) + ' · ' + p.role : posLabel(p);
}
