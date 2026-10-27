// Packs (npm test runs both sports): seeded contents, the odds of every slot, position packs, the
// starter, and quick-sell values. The pool is this sport's (the stand-in pool until the real card
// data lands; the odds don't depend on it).
import { SPORT } from '../engine/sport';
import { LEGEND_GOLD, LEGEND_PREMIUM, openPack, PACK_SHAPE, packDefs, positionChoices, PROMO_GOLD, PROMO_PREMIUM, quickSellValue, revealOrder, walkoutLevel } from './packs';
import { getPool, type Pool, TIER_RANK } from './pool';
import { onScale } from './rate';
import { positionMix } from './squad';
import type { RatedCard, Tier } from './types';

let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
});

const count = (cards: RatedCard[], t: Tier) => cards.filter((c) => c.tier === t).length;
const atLeast = (cards: RatedCard[], t: Tier) => cards.filter((c) => TIER_RANK[c.tier] >= TIER_RANK[t]).length;
/** within four standard deviations of n draws at p */
const near = (got: number, n: number, p: number) => expect(Math.abs(got - n * p)).toBeLessThan(4 * Math.sqrt(n * p * (1 - p)) + 1);

describe('packs (' + SPORT + ')', () => {
  it('opens the same cards from the same seed, and different ones from another', () => {
    const a = openPack(pool, 'gold', 'seed-1').map((c) => c.line.id);
    expect(openPack(pool, 'gold', 'seed-1').map((c) => c.line.id)).toEqual(a);
    expect(openPack(pool, 'gold', 'seed-2').map((c) => c.line.id)).not.toEqual(a);
  });

  it('holds what the store says, with no card twice in a pack', () => {
    const defs = packDefs(SPORT);
    const shape = PACK_SHAPE[SPORT];
    for (let i = 0; i < 200; i++) {
      for (const kind of ['bronze', 'silver', 'gold', 'premium'] as const) {
        const cards = openPack(pool, kind, kind + i);
        expect(cards).toHaveLength(defs[kind].slots.length);
        expect(new Set(cards.map((c) => c.line.id)).size).toBe(cards.length);
      }
      const gold = openPack(pool, 'gold', 'g' + i);
      expect(atLeast(gold, 'gold')).toBe(shape.gold[1] + shape.gold[2]);
      const bronze = openPack(pool, 'bronze', 'b' + i);
      expect(atLeast(bronze, 'gold')).toBe(0);
      expect(count(bronze, 'bronze')).toBeGreaterThanOrEqual(shape.bronze[0]);
    }
  });

  it('draws each tier at the odds the store shows', () => {
    const N = 4000;
    const shape = PACK_SHAPE[SPORT];
    let silverInBronze = 0;
    let goldInSilver = 0;
    let promoGold = 0;
    let legendGold = 0;
    let promoPremium = 0;
    for (let i = 0; i < N; i++) {
      silverInBronze += count(openPack(pool, 'bronze', 'ob' + i), 'silver');
      goldInSilver += count(openPack(pool, 'silver', 'os' + i), 'gold');
      const g = openPack(pool, 'gold', 'og' + i);
      promoGold += count(g, 'promo');
      legendGold += count(g, 'legend');
      promoPremium += count(openPack(pool, 'premium', 'op' + i), 'promo');
    }
    near(silverInBronze, N * shape.bronze[1], 0.2);
    near(goldInSilver, N * shape.silver[2], 0.25);
    near(promoGold, N, PROMO_GOLD);
    near(legendGold, N, LEGEND_GOLD);
    near(promoPremium, N, PROMO_PREMIUM);
    expect(LEGEND_PREMIUM).toBeCloseTo(1 / 150, 3);
  });

  it('makes high overalls rarer within a tier', () => {
    const golds = Array.from({ length: 600 }, (_, i) => openPack(pool, 'gold', 'r' + i))
      .flat()
      .filter((c) => c.tier === 'gold');
    const low = golds.filter((c) => c.ovr < onScale(80, SPORT)).length;
    const high = golds.filter((c) => c.ovr >= onScale(88, SPORT)).length;
    expect(low).toBeGreaterThan(high * 3);
  });

  it('draws positions in the mix a squad needs', () => {
    const mix = positionMix(SPORT);
    const total = Object.values(mix).reduce((a, b) => a + b, 0);
    const seen: Record<string, number> = {};
    const N = 1500;
    let n = 0;
    for (let i = 0; i < N; i++)
      for (const c of openPack(pool, 'gold', 'mix' + i))
        if (c.tier === 'gold' || c.tier === 'silver') {
          seen[c.line.pos[0]] = (seen[c.line.pos[0]] ?? 0) + 1;
          n++;
        }
    for (const [p, k] of Object.entries(mix)) near(seen[p] ?? 0, n, k / total);
  });

  it('fills a position pack from the position (or unit) picked, all golds', () => {
    for (const ch of positionChoices(SPORT))
      for (let i = 0; i < 30; i++) {
        const cards = openPack(pool, 'position:' + ch.key, ch.key + i);
        expect(cards).toHaveLength(PACK_SHAPE[SPORT].position);
        for (const c of cards) {
          expect(ch.positions).toContain(c.line.pos[0]);
          expect(c.tier).toBe('gold');
        }
      }
    expect(openPack(pool, 'position:nowhere', 'x')).toEqual([]);
  });

  it('gives a starter with a card for every spot, a gold among them, one player once', () => {
    for (let i = 0; i < 40; i++) {
      const cards = openPack(pool, 'starter', 'starter' + i);
      const mix = positionMix(SPORT);
      const have: Record<string, number> = {};
      for (const c of cards) have[c.line.pos[0]] = (have[c.line.pos[0]] ?? 0) + 1;
      for (const [p, k] of Object.entries(mix)) expect(have[p] ?? 0).toBeGreaterThanOrEqual(k);
      expect(atLeast(cards, 'gold')).toBe(1);
      expect(atLeast(cards, 'silver')).toBeGreaterThanOrEqual(3);
      expect(new Set(cards.map((c) => c.line.pid)).size).toBe(cards.length);
      expect(cards.length).toBe(SPORT === 'nba' ? 11 : 24);
    }
  });

  it('quick-sells for the doc’s ranges (football at its scale)', () => {
    const k = PACK_SHAPE[SPORT].qs;
    const all = Array.from(pool.base.values());
    const range = (t: Tier) => {
      const v = all.filter((c) => c.tier === t).map(quickSellValue);
      return [Math.min(...v), Math.max(...v)];
    };
    const [b0, b1] = range('bronze');
    expect(b0).toBeGreaterThanOrEqual(Math.round((15 * k) / 5) * 5 - 5);
    expect(b1).toBeLessThanOrEqual(30 * k + 5);
    const [s0, s1] = range('silver');
    expect(s0).toBeGreaterThanOrEqual(40 * k - 5);
    expect(s1).toBeLessThanOrEqual(80 * k + 5);
    const [g0, g1] = range('gold');
    expect(g0).toBeGreaterThanOrEqual(100 * k - 5);
    expect(g1).toBeLessThanOrEqual(400 * k + 5);
    expect(range('promo')[0]).toBeGreaterThanOrEqual(500 * k - 5);
    expect(range('legend')[0]).toBeGreaterThanOrEqual(2500 * k - 5);
  });

  it('reveals worst to best, and walks out the gold-or-better', () => {
    const cards = openPack(pool, 'premium', 'reveal');
    const order = revealOrder(cards);
    for (let i = 1; i < order.length; i++) expect(TIER_RANK[order[i].tier] * 100 + order[i].ovr).toBeGreaterThanOrEqual(TIER_RANK[order[i - 1].tier] * 100 + order[i - 1].ovr);
    expect(walkoutLevel(order[order.length - 1])).toBeGreaterThan(0);
    expect(walkoutLevel(revealOrder(openPack(pool, 'bronze', 'b'))[0])).toBe(0);
  });
});
