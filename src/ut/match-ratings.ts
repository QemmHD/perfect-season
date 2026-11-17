// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5): player ratings and the man of the match,
// from the match's own box (match-box.ts) and nothing else. A line the sport already rated (soccer's
// match report) keeps its rating; NBA lines are rated from the game score (Hollinger's GmSc, scaled
// to the short arcade game); NFL lines from their passing, rushing, receiving and defensive numbers.
// Every rating is 1.0–10.0 in tenths and rises with each good stat (match-ratings.test.ts checks it
// stat by stat). No box, no ratings: the recap hides the block instead of guessing.
import type { RecapBox, RecapLine } from './match-box';
import type { UtSport } from './types';

export interface RatedLine extends RecapLine {
  rating: number;
}
export interface RatedBox {
  /** every line, best first */
  lines: RatedLine[];
  /** your side's best three, for the recap */
  ours: RatedLine[];
  /** the player of the match: the sport's pick when it named one in the box, else the top rating */
  motm: RatedLine;
}

const clamp = (x: number) => Math.round(Math.max(1, Math.min(10, x)) * 10) / 10;
const s = (l: RecapLine, k: string) => l.stats[k] ?? 0;

/** NBA game score (Hollinger), the box's own counting stats. */
export function gameScore(l: RecapLine): number {
  return (
    s(l, 'pts') +
    0.4 * s(l, 'fgm') -
    0.7 * s(l, 'fga') -
    0.4 * (s(l, 'fta') - s(l, 'ftm')) +
    0.7 * s(l, 'orb') +
    0.3 * s(l, 'drb') +
    s(l, 'stl') +
    0.7 * s(l, 'ast') +
    0.7 * s(l, 'blk') -
    0.4 * s(l, 'pf') -
    s(l, 'tov')
  );
}

/** An NFL line's value in rating points: yards, scores, takeaways and sacks up; giveaways down. */
function footballValue(l: RecapLine): number {
  return (
    0.012 * s(l, 'passYds') +
    0.6 * s(l, 'passTd') -
    0.9 * s(l, 'int') +
    0.03 * s(l, 'rushYds') +
    0.7 * s(l, 'rushTd') +
    0.1 * s(l, 'rec') +
    0.025 * s(l, 'recYds') +
    0.7 * s(l, 'recTd') +
    0.25 * s(l, 'tkl') +
    0.8 * s(l, 'sack') +
    1.0 * s(l, 'defInt') +
    0.6 * s(l, 'pd') +
    0.8 * s(l, 'ff') -
    0.9 * s(l, 'fum')
  );
}

/** A soccer line the report did not rate: goals, assists, shots on target and saves up. */
function soccerValue(l: RecapLine): number {
  return 1.2 * s(l, 'goals') + 0.8 * s(l, 'assists') + 0.25 * s(l, 'shotsOn') + 0.3 * s(l, 'saves') + 0.15 * s(l, 'tackles') + 0.15 * s(l, 'keyPasses') - 0.5 * s(l, 'lost');
}

/** One line's 1–10 rating: the sport's own when it gave one, else from its numbers (6.0 is par). */
export function rateLine(sport: UtSport, l: RecapLine): number {
  return clamp(rawRating(sport, l));
}
/** The rating before the 1–10 clamp: two players at 10 are told apart by it (the bigger game wins MOTM). */
function rawRating(sport: UtSport, l: RecapLine): number {
  if (l.rating !== undefined) return l.rating;
  return 6 + { nba: () => 0.3 * gameScore(l), nfl: () => footballValue(l), soccer: () => soccerValue(l) }[sport]();
}

/** Ratings for every line and the man of the match; null without a box. */
export function rateBox(sport: UtSport, box: RecapBox | null): RatedBox | null {
  if (!box) return null;
  const raw = new Map(box.lines.map((l) => [l, rawRating(sport, l)]));
  const rated = box.lines.map((l) => ({ line: { ...l, rating: rateLine(sport, l) } as RatedLine, raw: raw.get(l)! }));
  // best first, the unclamped value breaking a tie; an exact tie keeps the box's order (stable sort)
  const lines = [...rated].sort((a, b) => b.line.rating - a.line.rating || b.raw - a.raw).map((x) => x.line);
  const ours = lines.filter((l) => l.side === 'us').slice(0, 3);
  if (!ours.length) return null;
  const named = box.potm ? lines.find((l) => l.name === box.potm) : undefined;
  return { lines, ours, motm: named ?? lines[0] };
}

/** "8.4": a rating as the recap shows it. */
export const ratingText = (r: number) => r.toFixed(1);

/** The line's headline numbers, in the sport's own words: "24 PTS · 7 REB · 5 AST", "212 YDS · 2 TD". */
export function statLine(sport: UtSport, l: RecapLine): string {
  const parts = (xs: [number, string][]) =>
    xs
      .filter(([n]) => n > 0)
      .slice(0, 3)
      .map(([n, w]) => Math.round(n) + ' ' + w)
      .join(' · ');
  const out = {
    nba: () => parts([[s(l, 'pts'), 'PTS'], [s(l, 'orb') + s(l, 'drb'), 'REB'], [s(l, 'ast'), 'AST'], [s(l, 'stl'), 'STL'], [s(l, 'blk'), 'BLK']]),
    nfl: () =>
      parts([
        [s(l, 'passYds') + s(l, 'rushYds') + s(l, 'recYds'), 'YDS'],
        [s(l, 'passTd') + s(l, 'rushTd') + s(l, 'recTd'), 'TD'],
        [s(l, 'rec'), 'REC'],
        [s(l, 'tkl'), 'TKL'],
        [s(l, 'sack'), 'SACK'],
        [s(l, 'defInt'), 'INT'],
      ]),
    soccer: () => parts([[s(l, 'goals'), s(l, 'goals') === 1 ? 'GOAL' : 'GOALS'], [s(l, 'assists'), 'AST'], [s(l, 'saves'), 'SAVES'], [s(l, 'shotsOn'), 'ON TGT'], [s(l, 'tackles'), 'TKL']]),
  }[sport]();
  return out;
}
