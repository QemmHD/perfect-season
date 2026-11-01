// Rating cards: the same code the games use, tiers from overall, and what promos and levels add.
import { SPORT } from '../engine/sport';
import { hooper } from '../game/hoops2/ratings';
import { getPool } from './pool';
import { levelBonus, NBA_KEYS, nbaLineOf, onScale, promoLift, rateCard, squeeze, tierOf, toHooper } from './rate';
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

  it('puts a promo well above the season it is made from, every rating up, with its ability', () => {
    const promo = lines.find((x) => x.kind === 'promo' && (x.boost ?? 0) > 0 && rateCard({ ...x, kind: 'season', boost: undefined }).ovr < 85)!;
    const plain = rateCard({ ...promo, kind: 'season', boost: undefined });
    const rc = rateCard(promo);
    expect(rc.ovr).toBe(Math.min(99, Math.round(squeeze(rateCard({ ...promo, kind: 'season', boost: undefined }).ovr, SPORT) + promoLift(promo.boost!, SPORT))));
    expect(rc.ovr).toBeGreaterThanOrEqual(plain.ovr + (SPORT === 'nba' ? 5 : 2));
    for (const c of Object.keys(plain.attrs)) expect(rc.attrs[c]).toBeGreaterThanOrEqual(Math.min(99, plain.attrs[c] + 1));
    expect(rc.tier).toBe('promo');
    expect(rc.abil).toContain('heat-check');
    const legend = lines.find((x) => x.kind === 'legend')!;
    expect(rateCard(legend).tier).toBe('legend');
    expect(rateCard(legend).ovr).toBeGreaterThanOrEqual(90);
  });

  it('leaves room at the top: no season above the squeeze, promos and legends over it', () => {
    const seasons = lines.filter((x) => x.kind === 'season').map((x) => rateCard(x).ovr);
    const best = Math.max(...seasons);
    expect(best).toBe(SPORT === 'nba' ? 94 : 95);
    // below the knee a season's overall is as rated
    expect(squeeze(80, 'nba')).toBe(80);
    expect(squeeze(99, 'nba')).toBe(94);
    expect(squeeze(99, 'nfl')).toBe(95);
    const promos = lines.filter((x) => x.kind === 'promo').map((x) => rateCard(x).ovr).sort((a, b) => a - b);
    expect(promos[Math.floor(promos.length / 2)]).toBeGreaterThan(best);
  });

  if (SPORT === 'nba')
    it('rates basketball with the game’s own hooper(), and gives the game its player back', () => {
      // (below the squeeze, where a card's overall is the game's own)
      const l = lines.find((x) => x.kind === 'season' && x.stats.fg3 !== null && rateCard(x).ovr > 78 && rateCard(x).ovr < 84)!;
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
