// Claude (packs-6, 2026-11-17): the `ladder` suite (packs-plan §5 packs-6 "Tests"): pity, the stamp shelf's
// value, the stamp pace and the tier ladder in coins and in days with every Game Design V2 income row. One
// module, run once per sport: ladder.test.ts in the NBA and NFL runs, soccer-ladder.test.ts in the soccer
// run. The model is scripts/packs/ladder.ts (the same numbers packs.md publishes). Test code only.
/// <reference types="vite/client" />
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { SPORT } from '../../engine/sport';
import { dayToStamps, daysOf, incomeOf, ladderRoutes, MINUTES_FALLBACK, MINUTES_FROM_UT, REF_DAY, rungScale, rungsOf, shelfShares, spotlightPriceFor, stampPace, D5, type Rung, type RouteCost } from '../../../scripts/packs/ladder';
import { freshProfile } from '../../lib/profile';
import { packsOn } from '../calendar';
import { buysLeft, recordBuy } from '../content-packs';
import { spotlightLeft } from '../pack-actions';
import { registeredOpening } from '../promo';
import { registryNamespace } from '../registry';
import { oddsFor } from '../odds';
import { baseProgramRate, effectiveProgramRate, isHonors, LEGEND_PROGRAM, livePackDef, packOfKind, pityLength, pityState, promoOfPack } from '../live-packs';
import { openPack, packDefs, revealOrder, SPOTLIGHT_PRICE } from '../packs';
import { byValue, getPool, type Pool, rankOf } from '../pool';
import type { PullEntry } from '../pull-log-state';
import { STAMP_SHELF } from '../scout-stamps';
import { weekOf } from '../sbc';
import type { RatedCard } from '../types';

/** The pity as a pure counter: n packs at program rate p with length L. */
function pitySim(p: number, L: number, n: number, seed: string) {
  const r = rng(hashString(seed));
  let misses = 0;
  let cards = 0;
  let forced = 0;
  let maxMiss = 0;
  for (let i = 0; i < n; i++) {
    const force = misses >= L - 1;
    const hit = force || r() < p;
    if (hit) {
      cards++;
      if (force && misses >= L - 1) forced++;
      misses = 0;
    } else maxMiss = Math.max(maxMiss, ++misses);
  }
  return { perCard: forced / cards, perPack: forced / n, maxMiss, rate: cards / n };
}

export function ladderSuite(): void {
  let pool: Pool;
  let routes: Record<Rung, RouteCost>;
  beforeAll(async () => {
    pool = await getPool();
    routes = ladderRoutes(pool);
  }, 120000);

  describe('pity (D6), ' + SPORT, () => {
    it('L = max(13, ceil(3.9 / p)): 30% → 13, 20% → 20, 8% → 49, 7% → 56, 6% → 65', () => {
      expect([0.3, 0.2, 0.08, 0.07, 0.06].map(pityLength)).toEqual([13, 20, 49, 56, 65]);
      expect(pityLength(1)).toBe(1);
      expect(effectiveProgramRate(0.3)).toBeCloseTo(0.3029, 3);
      expect(effectiveProgramRate(0.07)).toBeCloseTo(0.0712, 3);
    });

    it('over 200k packs at p = 0.30: 1.38% ± 0.15 of program cards and 0.42% ± 0.05 of packs come from pity, never 13 misses', () => {
      const s = pitySim(0.3, pityLength(0.3), 200000, 'pity:0.30');
      expect(Math.abs(s.perCard - 0.01384)).toBeLessThan(0.0015);
      expect(Math.abs(s.perPack - 0.0042)).toBeLessThan(0.0005);
      expect(s.maxMiss).toBe(12);
      // the sheet's effective rate matches the simulation within 1 point
      expect(Math.abs(s.rate - effectiveProgramRate(0.3))).toBeLessThan(0.01);
    });

    it('at p = 0.07 and 0.20 the pity fires on 1.4-1.9% of program cards (a low-odds pack stays rare)', () => {
      for (const p of [0.07, 0.2]) {
        const s = pitySim(p, pityLength(p), 400000, 'pity:' + p);
        expect(s.perCard).toBeGreaterThan(0.014);
        expect(s.perCard).toBeLessThan(0.019);
        expect(s.maxMiss).toBe(pityLength(p) - 1);
        expect(Math.abs(s.rate - effectiveProgramRate(p))).toBeLessThan(0.01);
      }
    });

    it.skipIf(SPORT === 'soccer')('2,000 real opens of a program pack never run more than L − 1 packs without a program card; the sheet publishes the effective rate', () => {
      const pack = packsOn(REF_DAY).find((p) => p.tpl === 'program' && !isHonors(promoOfPack(p.id)))!;
      const kind = pack.id;
      const p = baseProgramRate(SPORT, kind)!;
      const L = pityLength(p);
      const at = Date.parse(REF_DAY + 'T17:00:00Z');
      const week = weekOf(REF_DAY);
      const r: PullEntry[] = [];
      let misses = 0;
      let maxMiss = 0;
      let cards = 0;
      let forced = 0;
      for (let i = 0; i < 2000; i++) {
        const ps = pityState(SPORT, { r }, kind, REF_DAY)!;
        expect(ps.misses).toBe(misses);
        const opened = openPack(pool, kind, 'pity-int:' + i, week, { at, forceProgram: ps.force });
        const hit = opened.some((c) => c.tier === 'program');
        if (ps.force) {
          expect(hit).toBe(true);
          forced++;
        }
        if (hit) {
          cards++;
          misses = 0;
        } else maxMiss = Math.max(maxMiss, ++misses);
        r.push({ id: 'p' + i, k: kind, n: 'x', c: 0, s: 'store', at: at + i, u: 'pack:p' + i + ':', cs: opened.map((c) => [c.line.id, c.ovr, c.tier] as [string, number, string]) });
        if (r.length > 300) r.shift();
      }
      expect(maxMiss).toBeLessThanOrEqual(L - 1);
      expect(forced).toBeGreaterThan(0);
      const t = oddsFor(pool, kind, at)!;
      expect(t.pityLength).toBe(L);
      expect(t.effectiveProgram).toBeCloseTo(effectiveProgramRate(livePackDef(SPORT, packOfKind(kind)!, at).odds + livePackDef(SPORT, packOfKind(kind)!, at).extra.reduce((a, [, x]) => a + x, 0), L), 6);
      expect(Math.abs(cards / 2000 - t.effectiveProgram!)).toBeLessThan(0.035);
      expect(t.stamps).toBe(Math.floor(livePackDef(SPORT, packOfKind(kind)!, at).price / 100));
    });

    it.skipIf(SPORT === 'soccer')('a natural program card resets the count, and so does a new wave; other promos and kinds do not count', () => {
      const pack = packsOn(REF_DAY).find((p) => p.tpl === 'program' && !isHonors(promoOfPack(p.id)))!;
      const kind = pack.id;
      const at = Date.parse(REF_DAY + 'T17:00:00Z');
      const e = (i: number, tier: string, k = kind, t = at): PullEntry => ({ id: 'e' + i, k, n: 'x', c: 0, s: 'store', at: t + i, u: 'u', cs: [['nba:season:1:a:b', 80, 'gold'], ['nba:x:' + i, 85, tier]] });
      const L = pityLength(baseProgramRate(SPORT, kind)!);
      const misses = Array.from({ length: L - 1 }, (_, i) => e(i, 'standout'));
      expect(pityState(SPORT, { r: misses }, kind, REF_DAY)).toMatchObject({ misses: L - 1, within: 1, force: true });
      expect(pityState(SPORT, { r: [...misses, e(99, 'program')] }, kind, REF_DAY)).toMatchObject({ misses: 0, within: L, force: false });
      // another kind in between is skipped, not a reset
      expect(pityState(SPORT, { r: [...misses.slice(0, 3), e(50, 'gold', 'gold'), ...misses.slice(3)] }, kind, REF_DAY)!.misses).toBe(L - 1);
      // packs opened before the promo's latest wave began do not count
      const old = Date.parse('2026-10-01T17:00:00Z');
      expect(pityState(SPORT, { r: misses.map((m, i) => ({ ...m, at: old + i })) }, kind, REF_DAY)!.misses).toBe(0);
      // a guarantee has no pity
      const g = packsOn(REF_DAY).find((p) => p.tpl === 'guarantee');
      if (g) expect(pityState(SPORT, { r: [] }, g.id, REF_DAY)).toBeNull();
    });

    it.skipIf(SPORT === 'soccer')('Honors-class programs (band top 96+, from the cutoff): the pack is at most 8% a program card and its guarantee costs at least 40,000 (scaled)', () => {
      let seen = 0;
      for (const d of ['2027-01-20', '2027-06-08', '2027-07-20', '2027-10-25'])
        for (const p of packsOn(d)) {
          if (!isHonors(promoOfPack(p.id))) continue;
          seen++;
          const def = livePackDef(SPORT, p);
          if (p.tpl === 'guarantee') expect(def.price).toBeGreaterThanOrEqual(Math.round(40000 * rungScale(SPORT)));
          else expect(def.odds + def.extra.reduce((a, [, x]) => a + x, 0)).toBeLessThanOrEqual(0.08 + 1e-9);
        }
      expect(seen).toBeGreaterThan(2);
    });
  });

  describe('rankOf (D1), ' + SPORT, () => {
    it('places Hot Season above a program card, Honors and the Finale above a Legend; byValue and revealOrder follow it', () => {
      const card = (tier: RatedCard['tier'], ovr: number, line: Partial<RatedCard['line']> = {}) => ({ tier, ovr, line: { id: tier + ovr, ...line } }) as unknown as RatedCard;
      const program = card('program', 95, { programKind: 'program', program: 's1-first-tip' });
      const hot = card('promo', 90);
      const honors = card('program', 96, { programKind: 'honors', program: 's4-honors' });
      const finale = card('program', 99, { programKind: 'finale', program: 's8-finale' });
      const legend = card('legend', 95);
      expect([program, hot, honors, finale, legend].map(rankOf)).toEqual([3, 3.2, 4.3, 4.6, 4]);
      expect([program, finale, hot, legend, honors].sort(byValue).map((c) => c.line.id)).toEqual([finale, honors, legend, hot, program].map((c) => c.line.id));
      expect(revealOrder([finale, legend, hot, program]).map((c) => c.line.id)).toEqual([program, hot, legend, finale].map((c) => c.line.id));
    });
  });

  describe('the stamp shelf, ' + SPORT, () => {
    it('every item is worth 5-12% of the coins its stamps stand for, and none is sold for coins', () => {
      const shares = shelfShares(pool);
      expect(shares.length).toBe(SPORT === 'soccer' ? 3 : 4);
      for (const s of shares) {
        expect(s.share, s.item).toBeGreaterThanOrEqual(0.05);
        expect(s.share, s.item).toBeLessThanOrEqual(0.12);
      }
      const store = Object.keys(packDefs(SPORT));
      for (const s of STAMP_SHELF) expect(store).not.toContain(s.item);
    });

    it('stamp pace: engaged reach 50 on day 2 or 3 and 300 within 21 days; casual reach 50 within 7 days', () => {
      const engaged = stampPace(SPORT, 'engaged');
      expect(dayToStamps(engaged, 50)).toBeGreaterThanOrEqual(2);
      expect(dayToStamps(engaged, 50)).toBeLessThanOrEqual(3);
      expect(dayToStamps(engaged, 300)).toBeLessThanOrEqual(21);
      expect(dayToStamps(stampPace(SPORT, 'casual'), 50)).toBeLessThanOrEqual(7);
      expect(dayToStamps(stampPace(SPORT, 'max'), 50)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('the tier ladder (D5), ' + SPORT, () => {
    const scale = () => rungScale(SPORT);
    it('every rung sits inside its D5 coin band', () => {
      for (const r of ['standout', 'program', 'promo', 'legend'] as const) {
        if (!rungsOf(SPORT).includes(r)) continue;
        const [lo, hi] = D5[r];
        expect(routes[r].coins, r).toBeGreaterThanOrEqual(Math.round(lo * scale()) - 1);
        expect(routes[r].coins, r).toBeLessThanOrEqual(Math.round(hi * scale()) + 1);
      }
      if (SPORT === 'soccer') return;
      expect(routes.honors.coins).toBeGreaterThanOrEqual(D5.legend[0] * scale());
      expect(routes.finale.coins).toBeGreaterThan(routes.legend.coins);
      expect(routes.goat.coins).toBeGreaterThanOrEqual(1_000_000 * scale());
    });

    it('adjacent rungs are at least 1.5 times apart in coins, and the Spotlight price follows D5', () => {
      const chain = rungsOf(SPORT).filter((r) => r !== 'honors' && r !== 'finale');
      for (let i = 1; i < chain.length; i++) expect(routes[chain[i]].coins / routes[chain[i - 1]].coins, chain[i]).toBeGreaterThanOrEqual(1.5);
      if (SPORT === 'soccer') return;
      expect(routes.spotlight.coins).toBeGreaterThanOrEqual(1.5 * Math.max(routes.legend.coins, routes.finale.coins));
      expect(SPOTLIGHT_PRICE[SPORT]).toBe(spotlightPriceFor(routes));
      expect(packDefs(SPORT).spotlight.price).toBe(SPOTLIGHT_PRICE[SPORT]);
      // the Elite Gold Legend lever is the cheapest Legend route; a program pack's Legend share is not
      expect(routes.legend.route).toBe('Elite Gold');
      expect(LEGEND_PROGRAM).toBe(0.005);
    });

    it('with every V2 income row, adjacent rungs stay at least 1.5 times apart in engaged days', () => {
      // ut's two earned Spotlight packs modelled as packs-1 asked (Program Picks; packs.md Requests)
      const days = daysOf(pool, routes, 'engaged', 'v2', 'requested');
      const chain = rungsOf(SPORT).filter((r) => r !== 'honors' && r !== 'finale');
      for (let i = 1; i < chain.length; i++) expect(days[chain[i]]! / days[chain[i - 1]]!, chain[i]).toBeGreaterThanOrEqual(1.5);
      if (SPORT !== 'soccer') {
        expect(days.spotlight! / days.finale!).toBeGreaterThanOrEqual(1.5);
        expect(days.finale!).toBeGreaterThan(days.legend!);
      }
      // the day ladder is monotone for every player
      for (const p of ['casual', 'regular', 'engaged', 'max'] as const) {
        const d = daysOf(pool, routes, p, 'v2', 'requested');
        for (let i = 1; i < chain.length; i++) expect(d[chain[i]]!).toBeGreaterThan(d[chain[i - 1]]!);
      }
    });

    it('V2 brings the engaged Program rung about 20% sooner (± 3 days) and, in basketball, a Legend in about 20 days (± 3)', () => {
      const before = daysOf(pool, routes, 'engaged', 'planned', 'requested');
      const after = daysOf(pool, routes, 'engaged', 'v2', 'requested');
      const r: Rung = SPORT === 'soccer' ? 'promo' : 'program';
      expect(Math.abs(after[r]! - 0.8 * before[r]!)).toBeLessThanOrEqual(3);
      expect(after[r]!).toBeLessThan(before[r]!);
      if (SPORT === 'nba') expect(Math.abs(after.legend! - 20)).toBeLessThanOrEqual(3);
      // V2 is about +40-50% for the engaged player (D.16)
      const inc = incomeOf(pool, 'engaged', 'v2').total / incomeOf(pool, 'engaged', 'planned').total;
      expect(inc).toBeGreaterThan(1.3);
      expect(inc).toBeLessThan(1.6);
    });

    describe('the Store Spotlight pack: one a week (D5)', () => {
      afterEach(() => vi.useRealTimers());
      const at = Date.parse(REF_DAY + 'T17:00:00Z');
      const settle = (reservedAt: number, packId?: string) => {
        const p = freshProfile();
        p.coins = 100000;
        p.ut.pendingPromo = { id: '33333333-3333-4333-8333-333333333333', kind: 'spotlight', price: packId ? 0 : SPOTLIGHT_PRICE[SPORT], at: reservedAt, ...(packId ? { packId } : {}) };
        const r = { id: p.ut.pendingPromo.id, kind: 'spotlight', sport: SPORT, namespace: registryNamespace(), tier: 'gold' as const, cardId: null, seed: 'seed-sp', serial: null, totalAtPull: null };
        return registeredOpening(pool, p, r).profile;
      };
      it.skipIf(SPORT === 'soccer')('a Store Spotlight pack that lands counts toward this week; the next one waits for Monday', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(at);
        const after = settle(at - 60000);
        expect(after.coins).toBe(100000 - SPOTLIGHT_PRICE[SPORT]);
        expect(spotlightLeft(after.ut, REF_DAY, at)).toBe(false);
        // the next Monday opens a new week
        expect(spotlightLeft(after.ut, '2026-12-07', Date.parse('2026-12-07T17:00:00Z'))).toBe(true);
      });
      it.skipIf(SPORT === 'soccer')('an earned Spotlight pack does not count, and a receipt landing a week late counts nothing and keeps today’s counters', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(at);
        expect(spotlightLeft(settle(at - 60000, 'circuit:2026-W49:spotlight').ut, REF_DAY, at)).toBe(true);
        // reserved last week, landing today, after an Elite Gold bought today: the Elite counter stays
        const p = freshProfile();
        p.coins = 100000;
        p.ut = recordBuy(p.ut, 'elite', REF_DAY, at);
        p.ut.pendingPromo = { id: '44444444-4444-4444-8444-444444444444', kind: 'spotlight', price: SPOTLIGHT_PRICE[SPORT], at: at - 7 * 86400000 };
        const late = registeredOpening(pool, p, { id: p.ut.pendingPromo.id, kind: 'spotlight', sport: SPORT, namespace: registryNamespace(), tier: 'gold', cardId: null, seed: 'seed-late', serial: null, totalAtPull: null }).profile;
        expect(spotlightLeft(late.ut, REF_DAY, at)).toBe(true);
        expect(buysLeft(late.ut, 'elite', REF_DAY, at)).toBe(buysLeft(p.ut, 'elite', REF_DAY, at));
      });
    });

    it('MINUTES_FALLBACK equals ut’s minutes.ts ladders when that module is on the branch', () => {
      if (!MINUTES_FROM_UT) return;
      const strip = (l: typeof MINUTES_FALLBACK) => JSON.parse(JSON.stringify({ daily: l.daily, weekly: l.weekly, life: l.life }));
      expect(strip(MINUTES_FROM_UT)).toEqual(strip(MINUTES_FALLBACK));
    });
  });
}
