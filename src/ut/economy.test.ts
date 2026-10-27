// The economy played out (npm test runs both sports): players earning about 400 coins a day open
// the starter, buy Gold packs while their squad has many gaps and position packs for the last few,
// and count the days to a full Gold starting squad. Two kinds of player: a seller quick-sells
// everything the squad can't use; a keeper keeps his silvers and spare golds (for the bench,
// challenges, chemistry) and only sells bronze. See the math at the top of packs.ts.
import { SPORT } from '../engine/sport';
import { LEGEND_PREMIUM, openPack, packDefs, positionChoices, quickSellValue } from './packs';
import { getPool, type Pool } from './pool';
import { positionMix } from './squad';
import type { RatedCard } from './types';

export const DAILY_COINS = 400;

function daysToGoldSquad(pool: Pool, player: number, keeper: boolean): number {
  const defs = packDefs(pool.sport);
  const need = positionMix(pool.sport);
  // gold-or-better cards kept for the squad, by main position (one per player)
  const kept: Record<string, RatedCard[]> = {};
  let coins = 0;
  let n = 0;
  const take = (cards: RatedCard[]) => {
    for (const c of cards) {
      const p = c.line.pos[0];
      const list = (kept[p] ??= []);
      const good = c.tier === 'gold' || c.tier === 'promo' || c.tier === 'legend';
      if (good && list.length < (need[p] ?? 0) && !list.some((x) => x.line.pid === c.line.pid)) list.push(c);
      else if (!keeper || c.tier === 'bronze') coins += quickSellValue(c);
    }
  };
  const gaps = () => Object.entries(need).map(([p, k]) => [p, k - (kept[p]?.length ?? 0)] as [string, number]).filter(([, m]) => m > 0);
  take(openPack(pool, 'starter', 'sim:' + player + ':starter'));
  for (let day = 1; day <= 40; day++) {
    coins += DAILY_COINS;
    for (;;) {
      const g = gaps();
      const left = g.reduce((a, [, m]) => a + m, 0);
      if (!left) return day;
      // many gaps: a Gold pack; a few: the position pack that covers the most of them
      const many = left > (pool.sport === 'nba' ? 2 : 6);
      let kind = 'gold';
      if (!many) {
        const best = positionChoices(pool.sport)
          .map((c) => ({ key: c.key, m: g.filter(([p]) => c.positions.includes(p)).reduce((a, [, m]) => a + m, 0) }))
          .sort((a, b) => b.m - a.m)[0];
        kind = 'position:' + best.key;
      }
      const price = many ? defs.gold.price : defs.position.price;
      if (coins < price) break;
      coins -= price;
      take(openPack(pool, kind, 'sim:' + player + ':' + n++));
    }
  }
  return 99;
}

const median = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe('the economy (' + SPORT + ')', () => {
  it('gets a full Gold starting squad in about a week of normal play', async () => {
    const pool = await getPool();
    const seller = median(Array.from({ length: 100 }, (_, i) => daysToGoldSquad(pool, i, false)));
    const keeper = median(Array.from({ length: 100 }, (_, i) => daysToGoldSquad(pool, i, true)));
    console.log(SPORT + ': days to a full Gold starting squad at ' + DAILY_COINS + ' coins a day: seller ' + seller + ', keeper ' + keeper);
    expect(seller).toBeGreaterThanOrEqual(3);
    expect(seller).toBeLessThanOrEqual(9);
    expect(keeper).toBeGreaterThanOrEqual(5);
    expect(keeper).toBeLessThanOrEqual(12);
  });

  it('never sells a pack for more than it cost', async () => {
    const pool = await getPool();
    const defs = packDefs(pool.sport);
    const choices = positionChoices(pool.sport);
    for (const def of Object.values(defs)) {
      let back = 0;
      const N = 300;
      for (let i = 0; i < N; i++) back += openPack(pool, def.kind === 'position' ? 'position:' + choices[i % choices.length].key : def.kind, 'qs:' + def.kind + i).reduce((a, c) => a + quickSellValue(c), 0);
      const ratio = back / N / def.price;
      expect(ratio).toBeLessThan(0.95);
      expect(ratio).toBeGreaterThan(0.3);
    }
  });

  it('pulls a legend from about 1 in 150 Premium packs', async () => {
    const pool = await getPool();
    const N = 15000;
    let legends = 0;
    for (let i = 0; i < N; i++) if (openPack(pool, 'premium', 'leg:' + i).some((c) => c.tier === 'legend')) legends++;
    const want = N * LEGEND_PREMIUM;
    // within four standard deviations of 1 in 150
    expect(Math.abs(legends - want)).toBeLessThan(4 * Math.sqrt(want));
    expect(N / legends).toBeGreaterThan(110);
    expect(N / legends).toBeLessThan(210);
  });
});
