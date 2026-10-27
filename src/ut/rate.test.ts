// Rating cards: the same code the games use, tiers from overall, and what promos and levels add.
import { SPORT } from '../engine/sport';
import { hooper } from '../game/hoops2/ratings';
import { getPool } from './pool';
import { levelBonus, NBA_KEYS, nbaLineOf, onScale, rateCard, tierOf, toHooper } from './rate';
import type { CardLine } from './types';

describe('rating cards (' + SPORT + ')', () => {
  let lines: CardLine[];
  beforeAll(async () => {
    lines = (await getPool()).lines;
  });

  it('gives tiers by overall: bronze under 65, silver to 74, gold 75 and up (football on its own scale)', () => {
    expect([50, 64, 65, 74, 75, 99].map((o) => tierOf(o))).toEqual(['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold']);
    expect([75, 83, 84, 88, 89, 99].map((o) => tierOf(o, 'nfl'))).toEqual(['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold']);
    expect([56, 65, 75, 99].map((o) => onScale(o, 'nfl'))).toEqual([75, 84, 89, 99]);
    expect(onScale(72, 'nba')).toBe(72);
    for (const l of lines.slice(0, 400)) {
      const rc = rateCard(l);
      if (l.kind === 'season') expect(rc.tier).toBe(tierOf(rc.ovr, l.sport));
      else expect(rc.tier).toBe(l.kind);
      expect(rc.key).toHaveLength(6);
      expect(rc.ovr).toBeGreaterThanOrEqual(1);
      expect(rc.ovr).toBeLessThanOrEqual(99);
    }
  });

  it('adds one overall a level, on the key attributes, and keeps the tier', () => {
    const l = lines.find((x) => x.kind === 'season' && rateCard(x).ovr < 90 && rateCard(x).tier === 'bronze')!;
    const one = rateCard(l, 1);
    const five = rateCard(l, 5);
    expect(levelBonus(5)).toBe(4);
    expect(five.ovr).toBe(one.ovr + 4);
    expect(five.tier).toBe(one.tier);
    for (let i = 0; i < 6; i++) expect(five.key[i][2]).toBe(Math.min(99, one.key[i][2] + 4));
  });

  it('applies a promo’s boost once, with its ability', () => {
    const promo = lines.find((x) => x.kind === 'promo' && (x.boost ?? 0) > 0)!;
    const plain = rateCard({ ...promo, kind: 'season', boost: undefined });
    const rc = rateCard(promo);
    expect(rc.ovr).toBe(Math.min(99, plain.ovr + promo.boost!));
    expect(rc.tier).toBe('promo');
    expect(rc.abil).toContain('heat-check');
    const legend = lines.find((x) => x.kind === 'legend')!;
    expect(rateCard(legend).tier).toBe('legend');
    expect(rateCard(legend).ovr).toBeGreaterThanOrEqual(90);
  });

  if (SPORT === 'nba')
    it('rates basketball with the game’s own hooper(), and gives the game its player back', () => {
      const l = lines.find((x) => x.kind === 'season' && x.stats.fg3 !== null && rateCard(x).ovr > 80)!;
      const rc = rateCard(l);
      const h = hooper(nbaLineOf(l), l.pos[0], l.num);
      expect(rc.ovr).toBe(h.ovr);
      expect(rc.attrs['3PT']).toBe(h.thr);
      expect(rc.key.map(([c]) => c)).toEqual(NBA_KEYS[l.pos[0]]);
      const back = toHooper(rateCard(l, 3));
      expect(back.ovr).toBe(h.ovr + 2);
      expect(back.thr).toBe(rateCard(l, 3).attrs['3PT']);
    });
});
