// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5): every end code each sport writes, its
// label on the result strip and what it scores (match-recap.ts END_CODES), including the codes the
// sport teams added in the overhaul: NFL TD6/TD8 and every sport's FF (a forfeited unit, worth 0).
import { describe, expect, it } from 'vitest';
import { END_CODES, endLabel, endPoints, endSpoken } from './match-recap';
import { matchDebrief } from './match-debrief';

describe('end codes', () => {
  it('the table, pinned', () => {
    const flat = Object.fromEntries(Object.entries(END_CODES).map(([s, t]) => [s, Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.label + '/' + v.points]))]));
    expect(flat).toEqual({
      nba: { '2': '2/2', '3': '3/3', A: '2+1/3', X: '·/0', TO: 'TO/0', FF: 'FF/0' },
      nfl: { TD: 'TD/7', TD6: 'TD/6', TD8: 'TD+2/8', FG: 'FG/3', MISS: 'FG✕/0', INT: 'INT/0', DOWNS: 'DWN/0', PUNT: 'PUNT/0', FUM: 'FUM/0', SAF: 'SAF/0', TIME: 'TIME/0', FF: 'FF/0' },
      soccer: { G: 'GOAL/1', S: 'SAVE/0', W: 'WIDE/0', B: 'BLK/0', L: 'LOST/0', O: 'OFF/0', T: '·/0', FF: 'FF/0' },
    });
  });
  it('a score line made of codes adds up to the points the engines count', () => {
    expect(['3', '2', 'A', 'X', 'TO'].reduce((n, e) => n + endPoints('nba', e), 0)).toBe(8);
    expect(['TD', 'TD6', 'TD8', 'FG', 'PUNT', 'FF'].reduce((n, e) => n + endPoints('nfl', e), 0)).toBe(24);
    expect(['G', 'S', 'G', 'T', 'FF'].reduce((n, e) => n + endPoints('soccer', e), 0)).toBe(2);
  });
  it('unknown codes show as themselves and score nothing; soccer reads aloud in words', () => {
    expect(endLabel('nba', 'ZZ')).toBe('ZZ');
    expect(endPoints('nfl', 'ZZ')).toBe(0);
    expect(endSpoken('soccer', 'G')).toBe('goal');
    expect(endSpoken('soccer', 'T')).toBe('time');
    expect(endSpoken('nfl', 'TD')).toBe('TD');
  });
  it('every code the breakdown counts has a label', () => {
    for (const [sport, codes] of [
      ['nba', ['2', '3', 'A', 'X', 'TO']],
      ['nfl', ['TD', 'FG', 'MISS', 'INT', 'DOWNS', 'PUNT', 'FUM', 'SAF', 'TIME']],
      ['soccer', ['G', 'S', 'W', 'B', 'L', 'O', 'T']],
    ] as const) {
      for (const c of codes) expect(END_CODES[sport][c], sport + ' ' + c).toBeDefined();
      expect(matchDebrief(sport, codes).total).toBe(codes.length);
    }
  });
});
