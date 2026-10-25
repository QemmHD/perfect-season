// The game told as it happens must agree with the result: run for both sports (npm test).
import { castGame, footballPlays, winProb } from './broadcast';
import { CELLS, PLAYOFF_TEAMS } from './data';
import { NFL } from './sport';
import { emptyLineup, SLOTS } from './types';

const SCORES = [0, 3, 6, 7, 9, 10, 13, 14, 16, 17, 19, 20, 21, 23, 24, 26, 27, 28, 30, 31, 33, 34, 35, 37, 38, 41, 42, 44, 45, 48, 49, 52, 55];

function lineup() {
  const l = emptyLineup();
  // any legal-looking team: the first player at each spot from the first cells
  for (const k of SLOTS) {
    for (const c of CELLS) {
      const p = c.players.find((x) => x.pos.includes(k) && !SLOTS.some((s) => l[s]?.pid === x.pid));
      if (p) {
        l[k] = p;
        break;
      }
    }
  }
  return l;
}

describe('broadcast', () => {
  it('splits every football score into real scoring plays', () => {
    for (const s of SCORES) expect(footballPlays(s).reduce((a, b) => a + b, 0)).toBe(s);
  });
  it('win probability starts at the pregame odds and ends at the result', () => {
    expect(winProb(0, 0, 0.7)).toBeCloseTo(0.7, 2);
    expect(winProb(3, 1, 0.2)).toBe(1);
    expect(winProb(-1, 1, 0.9)).toBe(0);
    expect(winProb(10, 0.5, 0.5)).toBeGreaterThan(0.75);
  });
  it('tells every game so it ends with the real result', () => {
    const l = lineup();
    let clutch = 0;
    for (let i = 0; i < 400; i++) {
      const opp = PLAYOFF_TEAMS[i % PLAYOFF_TEAMS.length];
      const won = i % 3 !== 0;
      // blowouts and one-score games
      const hi = SCORES[6 + (i % 26)];
      const lo = SCORES[6 + (i % 26) - 1 - (i % 4 === 0 ? 5 : i % 3)];
      const score: [number, number] | null = NFL ? (won ? [hi, lo] : [lo, hi]) : null;
      const g = castGame({ lineup: l, opp, won, score, pre: 0.3 + (i % 7) / 10, seed: 'test:' + i });
      expect(g.won).toBe(won);
      if (score) expect([g.us, g.them]).toEqual(score);
      const last = g.events[g.events.length - 1];
      expect([last.us, last.them]).toEqual([g.us, g.them]);
      expect(g.periods.reduce((a, p) => a + p[0], 0)).toBe(g.us);
      expect(g.periods.reduce((a, p) => a + p[1], 0)).toBe(g.them);
      for (let j = 1; j < g.events.length; j++) expect(g.events[j].t).toBeGreaterThanOrEqual(g.events[j - 1].t);
      for (const e of g.events) {
        expect(e.wp).toBeGreaterThanOrEqual(0);
        expect(e.wp).toBeLessThanOrEqual(1);
        expect(e.text.length).toBeGreaterThan(4);
        expect(e.period).toBeGreaterThanOrEqual(1);
        expect(e.period).toBeLessThanOrEqual(4);
      }
      expect(g.wp[g.wp.length - 1][1]).toBe(won ? 1 : 0);
      expect(g.stars.length).toBeGreaterThan(0);
      // a late winner really put them ahead
      const c = g.events.findIndex((e) => e.clutch);
      if (c >= 0) {
        clutch++;
        const e = g.events[c];
        expect(c).toBe(g.events.length - 1);
        const before = e.side === 'us' ? e.us - e.pts - e.them : e.them - e.pts - e.us;
        expect(before).toBeLessThanOrEqual(0);
      }
      // the same game always tells the same way
      expect(castGame({ lineup: l, opp, won, score, pre: 0.3 + (i % 7) / 10, seed: 'test:' + i }).events.map((e) => e.text)).toEqual(g.events.map((e) => e.text));
    }
    expect(clutch).toBeGreaterThan(5);
  });
});
