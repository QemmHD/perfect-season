import { pickFor } from '../engine/sport';
// Implemented by Codex. Display original season totals separately from normalized playable ratings.
import type { CardLine } from './types';

const STAT_LABEL: Record<string, string> = {
  g: 'G',
  gs: 'GS',
  mpg: 'MIN',
  pts: 'PTS',
  reb: 'REB',
  ast: 'AST',
  stl: 'STL',
  blk: 'BLK',
  tov: 'TOV',
  fg2: '2P%',
  fg3: '3P%',
  ft: 'FT%',
  yds: 'PASS YDS',
  td: 'PASS TD',
  int: 'INT',
  ry: 'RUSH YDS',
  rtd: 'RUSH TD',
  rec: 'REC',
  recy: 'REC YDS',
  rectd: 'REC TD',
  tkl: 'TACKLES',
  sk: 'SACKS',
  pd: 'PD',
  ff: 'FF',
  fgm: 'FGM',
  fga: 'FGA',
  xpm: 'XPM',
  lng: 'LONG',
  cmpp: 'CMP%',
  ypa: 'Y/A',
};
const PCT = new Set(['fg2', 'fg3', 'ft', 'cmpp']);
const NBA_STATS = ['g', 'mpg', 'pts', 'reb', 'ast', 'stl', 'blk', 'fg2', 'fg3', 'ft'];
const NFL_STATS: Record<string, string[]> = {
  QB: ['g', 'cmpp', 'yds', 'td', 'int', 'ry', 'rtd'],
  RB: ['g', 'ry', 'rtd', 'rec', 'recy', 'rectd'],
  WR: ['g', 'rec', 'recy', 'rectd', 'ry'],
  TE: ['g', 'rec', 'recy', 'rectd'],
  K: ['g', 'fgm', 'fga', 'lng', 'xpm'],
};

/** Soccer's season line (Claude 2026-11-01): league games, starts, minutes, goals, assists, penalties, Champions League. */
const SOCCER_STATS: Record<string, [string, string][]> = {
  OUT: [['apps', 'APPS'], ['starts', 'STARTS'], ['min', 'MIN'], ['g', 'GOALS'], ['a', 'ASSISTS'], ['pen', 'PENS'], ['cl', 'UCL APPS'], ['clg', 'UCL GOALS']],
  GK: [['apps', 'APPS'], ['starts', 'STARTS'], ['min', 'MIN'], ['cs', 'CLEAN SHEETS'], ['ga', 'CONCEDED'], ['cl', 'UCL APPS']],
};

export function cardStatLine(l: CardLine): [string, string][] {
  if (l.sport === 'soccer')
    return (SOCCER_STATS[l.grp ?? 'OUT'] ?? SOCCER_STATS.OUT)
      .filter(([k]) => k in l.stats)
      .map(([k, label]) => {
        const v = l.stats[k];
        return [label, v === null || v === undefined || v < 0 ? '—' : Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1)];
      });
  const values: Record<string, number | null> = { ...l.stats, g: l.games };
  if (l.sport === 'nfl' && l.pos[0] === 'QB') values.cmpp = typeof l.stats.cmp === 'number' && (l.stats.att ?? 0) > 0 ? l.stats.cmp / l.stats.att! : null;
  const keys = pickFor(l.sport, { nba: () => NBA_STATS, soccer: () => NBA_STATS, nfl: () => NFL_STATS[l.pos[0]] ?? Object.keys(values).filter((k) => STAT_LABEL[k]) })();
  return keys
    .filter((k) => k in values)
    .map((k) => {
      const v = values[k];
      const txt = v === null || v === undefined ? '—' : PCT.has(k) && v <= 1 ? (v * 100).toFixed(1) : Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(1);
      return [STAT_LABEL[k] ?? k.toUpperCase(), txt];
    });
}
