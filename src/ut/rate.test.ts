// Rating cards: the same code the games use, tiers from overall, and what promos and levels add.
import { SPORT } from '../engine/sport';
import { getPool } from './pool';
import { levelBonus, NBA_ATTRS, NBA_KEYS, onScale, rateCard, tierOf, toHooper } from './rate';
import type { CardLine } from './types';

describe('rating cards (' + SPORT + ')', () => {
  let lines: CardLine[];
  beforeAll(async () => {
    lines = (await getPool()).lines;
  }, 60_000);

  it('gives tiers by the displayed UT scale: bronze under 65, silver to 74, gold 75 and up (both sports)', () => {
    for (const sport of ['nba', 'nfl'] as const) expect([50, 64, 65, 74, 75, 99].map((o) => tierOf(o, sport))).toEqual(['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold']);
    // legacy challenge numbers keep their standing: the old gold line is still gold, scale order kept
    for (const sport of ['nba', 'nfl'] as const) {
      const xs = [40, 56, 65, 72, 75, 85, 95, 99].map((o) => onScale(o, sport));
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      expect(tierOf(onScale(75, sport), sport)).toBe('gold');
      expect(tierOf(onScale(56, sport), sport)).not.toBe('gold');
    }
    for (const l of lines.slice(0, 400)) {
      const rc = rateCard(l);
      if (l.kind === 'season') expect(rc.tier).toBe(tierOf(rc.ovr, l.sport));
      else expect(rc.tier).toBe(l.kind);
      expect(rc.key).toHaveLength(6);
      expect(rc.ovr).toBeGreaterThanOrEqual(1);
      expect(rc.ovr).toBeLessThanOrEqual(99);
    }
  });

  it('levels add one overall at level 3 and one more at 5 (+2 at most), +1 key attributes a level, and keep the tier', () => {
    const l = lines.find((x) => x.kind === 'season' && rateCard(x).ovr < 90 && rateCard(x).tier === 'bronze')!;
    const one = rateCard(l, 1);
    const five = rateCard(l, 5);
    expect([1, 2, 3, 4, 5].map(levelBonus)).toEqual([0, 0, 1, 1, 2]);
    expect(rateCard(l, 2).ovr).toBe(one.ovr);
    expect(rateCard(l, 3).ovr).toBe(one.ovr + 1);
    expect(five.ovr).toBe(one.ovr + 2);
    expect(five.tier).toBe(one.tier);
    for (let i = 0; i < 6; i++) expect(five.key[i][2]).toBe(Math.min(99, one.key[i][2] + 4));
  });

  it('applies a promo’s boost once, with its ability', () => {
    const promo = lines.find((x) => x.kind === 'promo' && (x.boost ?? 0) > 0)!;
    const plain = rateCard({ ...promo, kind: 'season', boost: undefined });
    const rc = rateCard(promo);
    // Hot Season (Team-of-the-Year analog) shows 94–97, always above its season card
    expect(rc.ovr).toBeGreaterThan(plain.ovr);
    expect(rc.ovr).toBeGreaterThanOrEqual(94);
    expect(rc.ovr).toBeLessThanOrEqual(97);
    expect(rc.tier).toBe('promo');
    expect(rc.abil).toContain('heat-check');
    const legend = lines.find((x) => x.kind === 'legend')!;
    expect(rateCard(legend).tier).toBe('legend');
    expect(rateCard(legend).ovr).toBeGreaterThanOrEqual(88);
  });

  if (SPORT === 'nba')
    it('gives the played game every calibrated and levelled attribute shown on the card', () => {
      const l = lines.find((x) => x.kind === 'season' && x.stats.fg3 !== null && rateCard(x).ovr > 80)!;
      const rc = rateCard(l);
      expect(rc.attrs['3PT']).toBeGreaterThanOrEqual(1);
      expect(rc.key.map(([c]) => c)).toEqual(NBA_KEYS[l.pos[0]]);
      const back = toHooper(rateCard(l, 3));
      expect(back.ovr).toBe(Math.min(99, rc.ovr + 1));
      for (const [code, field] of NBA_ATTRS) expect(back[field]).toBe(rateCard(l, 3).attrs[code]);
    });
});
