/// <reference types="vite/client" />
// heat.ts (plan §3.7 and §4.5): every gain and loss, the 66 / 100 stages, the spell length per sport,
// the half-time reset, and that the file stays integer-only.
import { heatAfter, heatHalf, heatRules, heatStage, heatStart, heatUnitEnd, heatWindow, type HeatState } from './heat';

const SRC = import.meta.glob<string>('./heat.ts', { query: '?raw', import: 'default', eager: true })['./heat.ts'];
const at = (v: number, extra: Partial<HeatState> = {}): HeatState => ({ v, fire: 0, peak: v, fires: 0, ...extra });

describe('heat.ts', () => {
  it('every gain and loss, NBA: +12 PERFECT, +10 basket, +15 stop, +5 clean, -20 turnover, -10 conceded', () => {
    expect(heatAfter(at(30), 'perfect', 'nba').v).toBe(42);
    expect(heatAfter(at(30), 'score', 'nba').v).toBe(40);
    expect(heatAfter(at(30), 'stop', 'nba').v).toBe(45);
    expect(heatAfter(at(30), 'clean', 'nba').v).toBe(35);
    expect(heatAfter(at(30), 'turnover', 'nba').v).toBe(10);
    expect(heatAfter(at(30), 'conceded', 'nba').v).toBe(20);
    // a Heat Check card's PERFECT: +16 in all
    expect(heatAfter(at(30), 'perfect', 'nba', 4).v).toBe(46);
    // never below 0
    expect(heatAfter(at(5), 'turnover', 'nba').v).toBe(0);
  });

  it('a basket is worth more where baskets are rarer; the shared gains are the same for every sport', () => {
    expect(heatRules('nfl').gain.score).toBe(25);
    expect(heatRules('soccer').gain.score).toBe(40);
    for (const s of ['nba', 'nfl', 'soccer'] as const) {
      const g = heatRules(s).gain;
      expect([g.perfect, g.stop, g.clean, g.turnover, g.conceded]).toEqual([12, 15, 5, -20, -10]);
    }
  });

  it('HEATING UP at 66, ON FIRE at 100 for 2 possessions (NBA), 3 drives (NFL), 1 attack (soccer)', () => {
    expect(heatStage(at(65))).toBe('cold');
    expect(heatStage(at(66))).toBe('heating');
    for (const [sport, spell] of [
      ['nba', 2],
      ['nfl', 3],
      ['soccer', 1]
    ] as const) {
      let s = heatAfter(at(95), 'perfect', sport);
      expect(s).toEqual({ v: 100, fire: spell, peak: 100, fires: 1 });
      expect(heatStage(s)).toBe('fire');
      expect(heatWindow(s)).toBe(1.25);
      // while On Fire nothing moves the bar (a turnover doesn't end the spell)
      expect(heatAfter(s, 'turnover', sport)).toBe(s);
      for (let i = 1; i < spell; i++) {
        s = heatUnitEnd(s);
        expect(heatStage(s)).toBe('fire');
      }
      s = heatUnitEnd(s);
      // the spell over: the bar back to 0, the peak and the spell count kept
      expect(s).toEqual({ v: 0, fire: 0, peak: 100, fires: 1 });
      expect(heatWindow(s)).toBe(1);
      expect(heatUnitEnd(s)).toBe(s);
    }
  });

  it('half-time resets the bar and any spell, keeps the peak and the spells', () => {
    expect(heatHalf({ v: 100, fire: 1, peak: 100, fires: 2 })).toEqual({ v: 0, fire: 0, peak: 100, fires: 2 });
    expect(heatHalf(at(70))).toEqual({ v: 0, fire: 0, peak: 70, fires: 0 });
  });

  it('starts cold and empty; the peak follows the bar', () => {
    expect(heatStart).toEqual({ v: 0, fire: 0, peak: 0, fires: 0 });
    let s = heatStart;
    s = heatAfter(s, 'score', 'nba');
    s = heatAfter(s, 'perfect', 'nba');
    s = heatAfter(s, 'turnover', 'nba');
    expect(s.v).toBe(2);
    expect(s.peak).toBe(22);
  });

  it('integer only: every value it can reach over 20,000 random events is an integer in 0..100', () => {
    let seed = 7;
    const next = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed);
    const evs = ['perfect', 'score', 'stop', 'clean', 'turnover', 'conceded'] as const;
    let s = heatStart;
    for (let i = 0; i < 20000; i++) {
      const r = next();
      s = r % 7 === 0 ? heatUnitEnd(s) : r % 97 === 0 ? heatHalf(s) : heatAfter(s, evs[r % 6], (['nba', 'nfl', 'soccer'] as const)[r % 3]);
      for (const x of [s.v, s.fire, s.peak, s.fires]) {
        expect(Number.isInteger(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
      }
      expect(s.v).toBeLessThanOrEqual(100);
    }
  });

  it('the source: integer literals only (but the published ×1.25), no division, no Math, no clock, no randomness', () => {
    const code = SRC.split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const decimals = (code.match(/\b\d+\.\d+\b/g) ?? []).filter((d) => d !== '1.25');
    expect(decimals).toEqual([]);
    expect(code).not.toMatch(/\bMath\.|Date\.now|performance\.now|\.random\b/);
    // no division: `/` only appears in comments (stripped above) and import paths
    expect(code.replace(/'[^']*'/g, "''").match(/[^/*]\/[^/*]/g) ?? []).toEqual([]);
  });

  it('branches on the sport with pickFor (all three answers), never a two-way ternary', () => {
    expect(SRC).toMatch(/pickFor\(sport, SCORE\)/);
    expect(SRC).not.toMatch(/===\s*'(nba|nfl|soccer)'\s*\?/);
  });
});
