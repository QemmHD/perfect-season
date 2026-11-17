// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5): player ratings and the man of the match
// come only from the match's own box (match-box.ts, match-ratings.ts). Every published shape reads,
// malformed data is dropped, ratings rise with every good stat, and no box means nothing is shown.
import { describe, expect, it } from 'vitest';
import { boxOf, gradeOf, heatText, MAX_LINES, type RecapLine } from './match-box';
import { gameScore, rateBox, rateLine, statLine } from './match-ratings';

const line = (stats: Record<string, number>, o: Partial<RecapLine> = {}): RecapLine => ({ id: 'p', name: 'P', side: 'us', stats, ...o });

describe('boxOf: every published shape, nothing trusted', () => {
  it('NBA tracker shape { us, them, pog } with flat stats', () => {
    const b = boxOf({ us: [{ id: 'a', name: 'Ace', tag: 'PG', pts: 12, ast: 3 }], them: [{ id: 'z', name: 'Zed', tag: 'C', pts: 4 }], pog: 'Ace' })!;
    expect(b.lines).toEqual([
      { id: 'a', name: 'Ace', tag: 'PG', side: 'us', stats: { pts: 12, ast: 3 } },
      { id: 'z', name: 'Zed', tag: 'C', side: 'them', stats: { pts: 4 } },
    ]);
    expect(b.potm).toBe('Ace');
  });
  it('C2 BoxLine[] with side, rating and stats', () => {
    const b = boxOf([{ id: 'k', name: 'Keeper', side: 'us', rating: 7.46, stats: { saves: 4 } }])!;
    expect(b.lines[0]).toEqual({ id: 'k', name: 'Keeper', side: 'us', rating: 7.5, stats: { saves: 4 } });
  });
  it('drops malformed lines and values; no line for your side means no box', () => {
    const b = boxOf({ us: [null, 5, { name: 'NoSide' }, { id: 'x', name: 'Ok', pts: Infinity, ast: 'many', stl: 2 }], them: 'junk' })!;
    expect(b.lines).toEqual([{ id: 'x', name: 'Ok', side: 'us', stats: { stl: 2 } }]);
    expect(boxOf({ us: [], them: [{ id: 'z', name: 'Z', pts: 3 }] })).toBeNull();
    expect(boxOf(undefined)).toBeNull();
    expect(boxOf('box')).toBeNull();
    expect(boxOf([{ id: 'a', name: 'A', side: 'us', rating: 42, stats: {} }])!.lines[0].rating).toBeUndefined();
  });
  it('one line per player and side, at most MAX_LINES', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ id: 'p' + (i % 50), name: 'P' + i, side: 'us', stats: { pts: 1 } }));
    expect(boxOf(many)!.lines).toHaveLength(MAX_LINES);
  });
});

describe('gradeOf: the three published grade shapes', () => {
  it('nba (bestHeat, fires, moments), nfl (heatBest, lit, chances), plan C1 (heatPeak, onFire)', () => {
    expect(gradeOf({ v: 1, letter: 'A', flawless: true, perfects: 9, moments: 12, bestHeat: 100, fires: 1, ppu: 1.2, par: 1.1 }, true)).toEqual({ letter: 'A', perfects: 9, chances: 12, heat: 100, fires: 1, flawless: true });
    expect(gradeOf({ letter: 'B', perfects: 3, chances: 8, heatBest: 70, lit: 0, flawless: false, turnovers: 1 }, true)).toEqual({ letter: 'B', perfects: 3, chances: 8, heat: 70, fires: 0, flawless: false });
    expect(gradeOf({ letter: 'S', perfects: 4, chances: 4, heatPeak: 40, onFire: 2, flawless: true }, true)).toMatchObject({ heat: 40, fires: 2 });
  });
  it('FLAWLESS needs the win; a bad letter means no grade', () => {
    expect(gradeOf({ letter: 'A', perfects: 1, flawless: true }, false)!.flawless).toBe(false);
    expect(gradeOf({ letter: 'Z', perfects: 1 }, true)).toBeNull();
    expect(gradeOf(null, true)).toBeNull();
  });
  it('BEST HEAT text', () => {
    expect(heatText({ letter: 'A', perfects: 0, fires: 2, flawless: false })).toBe('ON FIRE ×2');
    expect(heatText({ letter: 'A', perfects: 0, fires: 1, flawless: false })).toBe('ON FIRE');
    expect(heatText({ letter: 'A', perfects: 0, fires: 0, heat: 70, flawless: false })).toBe('HEATING UP');
    expect(heatText({ letter: 'A', perfects: 0, fires: 0, heat: 40, flawless: false })).toBe('40%');
    expect(heatText({ letter: 'A', perfects: 0, fires: 0, flawless: false })).toBeNull();
  });
});

describe('ratings', () => {
  it('rise with every good stat and fall with every bad one (each sport), within 1–10', () => {
    const good = { nba: ['pts', 'fgm', 'orb', 'drb', 'stl', 'ast', 'blk', 'ftm'], nfl: ['passYds', 'passTd', 'rushYds', 'rushTd', 'rec', 'recYds', 'recTd', 'tkl', 'sack', 'defInt', 'pd', 'ff'], soccer: ['goals', 'assists', 'shotsOn', 'saves', 'tackles', 'keyPasses'] } as const;
    const bad = { nba: ['fga', 'tov', 'pf', 'fta'], nfl: ['int', 'fum'], soccer: ['lost'] } as const;
    for (const sport of ['nba', 'nfl', 'soccer'] as const) {
      const base = rateLine(sport, line({}));
      expect(base).toBe(6);
      for (const k of good[sport]) expect(rateLine(sport, line({ [k]: k === 'ftm' ? 1 : /Yds$/.test(k) ? 40 : 2, ...(k === 'ftm' ? { fta: 1 } : {}) })), sport + ' ' + k).toBeGreaterThan(k === 'ftm' ? rateLine(sport, line({ fta: 1 })) : base);
      for (const k of bad[sport]) expect(rateLine(sport, line({ [k]: 2 })), sport + ' ' + k).toBeLessThan(base);
      expect(rateLine(sport, line({ pts: 999, passYds: 9999, goals: 99 }))).toBe(10);
      expect(rateLine(sport, line({ tov: 99, int: 99, lost: 99 }))).toBe(1);
    }
    expect(gameScore(line({ pts: 10, fgm: 4, fga: 8 }))).toBeCloseTo(10 + 1.6 - 5.6);
  });
  it("a sport's own rating is kept", () => {
    expect(rateLine('soccer', line({ goals: 5 }, { rating: 6.2 }))).toBe(6.2);
  });
  it('MOTM is the top rating (two 10s: the bigger game) unless the sport named one; null without a box', () => {
    const box = { lines: [line({ pts: 4 }, { id: 'a', name: 'A' }), line({ pts: 20 }, { id: 'b', name: 'B' }), line({ pts: 30 }, { id: 'z', name: 'Z', side: 'them' })] };
    const r = rateBox('nba', box)!;
    expect(r.motm.name).toBe('Z');
    expect(r.ours.map((l) => l.name)).toEqual(['B', 'A']);
    expect(rateBox('nba', { ...box, potm: 'A' })!.motm.name).toBe('A');
    expect(rateBox('nba', { ...box, potm: 'Nobody' })!.motm.name).toBe('Z');
    expect(rateBox('nba', null)).toBeNull();
  });
  it('stat lines in each sport\'s words', () => {
    expect(statLine('nba', line({ pts: 24, orb: 2, drb: 5, ast: 5, stl: 1 }))).toBe('24 PTS · 7 REB · 5 AST');
    expect(statLine('nfl', line({ passYds: 180, passTd: 2, rushYds: 32 }))).toBe('212 YDS · 2 TD');
    expect(statLine('soccer', line({ goals: 1, assists: 1 }))).toBe('1 GOAL · 1 AST');
  });
});
