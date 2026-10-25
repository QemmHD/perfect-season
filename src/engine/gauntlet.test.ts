// The Legends Gauntlet (npm test runs both sports).
import { climb, clearChance, coinsFor, GAUNTLET_SIZE, gauntletLadder, LIVES, RUNG_COINS, rungChance, rungsWon } from './gauntlet';
import { ratingForWins, type TeamRating } from './rating';
import { NFL } from './sport';

const FULL = NFL ? 17 : 82;

describe('legends gauntlet', () => {
  it('climbs from very good to the best team ever, the same for everyone in a week', () => {
    const a = gauntletLadder('2026-W43');
    expect(a.length).toBe(GAUNTLET_SIZE);
    expect(gauntletLadder('2026-W43')).toEqual(a);
    expect(new Set(a.map((t) => t.year + t.team)).size).toBe(GAUNTLET_SIZE);
    for (let i = 1; i < a.length; i++) expect(a[i].wFull).toBeGreaterThanOrEqual(a[i - 1].wFull);
    expect(a[a.length - 1].wFull).toBeGreaterThanOrEqual(NFL ? 17 : 72);
    // the weeks differ
    const weeks = new Set(['2026-W40', '2026-W41', '2026-W42', '2026-W43'].map((w) => gauntletLadder(w).map((t) => t.year + t.team).join()));
    expect(weeks.size).toBeGreaterThan(1);
  });

  it('is hard: a perfect team clears it often, a good one almost never', () => {
    const ladder = gauntletLadder('2026-W43');
    const perfect = ratingForWins(FULL);
    const good = ratingForWins(NFL ? 12 : 60);
    const all = clearChance(perfect, ladder);
    expect(all).toBeGreaterThan(0.15);
    expect(all).toBeLessThan(0.7);
    expect(clearChance(good, ladder)).toBeLessThan(0.02);
    // with one life it's the product of the rungs
    expect(clearChance(perfect, ladder, 1)).toBeCloseTo(ladder.reduce((a, t) => a * rungChance(perfect, t), 1), 9);
    // a good team is about a coin flip or worse on the first rung, and long odds on the last
    expect(rungChance(good, ladder[0])).toBeLessThan(0.6);
    expect(rungChance(good, ladder[ladder.length - 1])).toBeLessThan(0.35);
    expect(rungChance(perfect, ladder[0])).toBeGreaterThan(rungChance(perfect, ladder[ladder.length - 1]));
  });

  it('decides the climb from the seed: a loss is a rematch, the last life ends it', () => {
    const ladder = gauntletLadder('2026-W43');
    const team = { rating: ratingForWins(FULL - (NFL ? 1 : 6)), wins: 0, ratios: [], balance: 1, pf: NFL ? 30 : undefined, pa: NFL ? 15 : undefined } as unknown as TeamRating;
    let cleared = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const c = climb(team, ladder, 'run' + i);
      expect(climb(team, ladder, 'run' + i)).toEqual(c);
      expect(c.length).toBeGreaterThan(0);
      const losses = c.filter((g) => !g.won).length;
      expect(losses).toBeLessThanOrEqual(LIVES);
      const top = rungsWon(c) === GAUNTLET_SIZE;
      // it ends at the top or on the last life, never before
      expect(top || losses === LIVES).toBe(true);
      if (top) cleared++;
      // each game is the rung after the last win, or the same rung again after a loss
      let rung = 0;
      for (const g of c) {
        expect(g.rung).toBe(rung);
        expect(g.opp).toBe(ladder[rung]);
        if (g.won) rung++;
      }
      for (const r of c) {
        if (NFL) {
          expect(r.score).not.toBeNull();
          expect(r.score![0] > r.score![1]).toBe(r.won);
        } else expect(r.score).toBeNull();
      }
    }
    // about as often as the odds say
    expect(Math.abs(cleared / N - clearChance(team.rating, ladder))).toBeLessThan(0.07);
  });

  it('pays for each rung, and more for the top', () => {
    expect(coinsFor(0)).toBe(0);
    expect(coinsFor(1)).toBe(RUNG_COINS[0]);
    expect(coinsFor(GAUNTLET_SIZE)).toBeGreaterThan(coinsFor(GAUNTLET_SIZE - 1) + RUNG_COINS[GAUNTLET_SIZE - 1]);
  });
});
