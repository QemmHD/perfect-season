import { CELLS } from './data';
import { autoDraft, type Strategy } from './autodraft';
import { buildBracket, isPerfect, playoffOutcome } from './playoffs';
import { GAMES, rateTeam, W } from './rating';
import { rng } from './rng';
import { playSeason } from './season';
import { SPORT } from './sport';
import { SLOTS } from './types';

function pct(n: number, d: number) {
  return Math.round((n / d) * 1000) / 10 + '%';
}

describe('calibration', () => {
  it('prints win distributions by strategy', () => {
    const N = 3000;
    for (const strat of ['random', 'best', 'smart'] as Strategy[]) {
      const wins: number[] = [];
      let titles = 0;
      let perfect = 0;
      let undefeated = 0;
      for (let i = 0; i < N; i++) {
        const s = autoDraft(strat, 1000 + i, 'classic', 'pro', strat === 'smart');
        const season = playSeason(s.lineup);
        wins.push(season.wins);
        const out = playoffOutcome(buildBracket(season, rng(5000 + i)));
        if (out.title) titles++;
        if (season.wins === GAMES) undefeated++;
        if (isPerfect(season.wins, out)) perfect++;
      }
      wins.sort((a, b) => a - b);
      const q = (f: number) => wins[Math.floor(f * (wins.length - 1))];
      console.log(SPORT, strat, 'p10', q(0.1), 'p50', q(0.5), 'p90', q(0.9), 'max', q(1), 'undefeated', pct(undefeated, N), 'titles', pct(titles, N), 'perfect', pct(perfect, N));
    }
    expect(CELLS.length).toBeGreaterThan(150);
  });
  // CALIB=1: the quantiles the benchmark and the win curve are set from
  it.runIf(!!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CALIB)('prints rating and category quantiles', () => {
    const N = 6000;
    for (const strat of ['random', 'best', 'smart'] as Strategy[]) {
      const ratings: number[] = [];
      const cats: number[][] = [[], [], [], []];
      for (let i = 0; i < N; i++) {
        const s = autoDraft(strat, 20000 + i, 'classic', 'pro', strat === 'smart');
        const r = rateTeam(SLOTS.map((k) => s.lineup[k]));
        ratings.push(r.rating);
        Object.keys(W).forEach((k, j) => j < 4 && cats[j].push(r.totals[k]));
        (cats[4] ??= []).push((r.totals.rush ?? 0) + (r.totals.recv ?? 0));
      }
      ratings.sort((a, b) => a - b);
      const q = (a: number[], f: number) => Math.round(a[Math.floor(f * (a.length - 1))] * 10) / 10;
      cats.forEach((c) => c.sort((a, b) => a - b));
      console.log(
        SPORT,
        strat,
        'rating p10/50/90',
        q(ratings, 0.1),
        q(ratings, 0.5),
        q(ratings, 0.9),
        'p99',
        q(ratings, 0.99),
        'p99.85',
        q(ratings, 0.9985),
        'max',
        q(ratings, 1),
        'cats p97',
        cats.map((c) => q(c, 0.97))
      );
    }
  });
});
