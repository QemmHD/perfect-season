import { SPORT } from '../engine/sport';
import { freshProfile } from '../lib/profile';
import { newPossession, greenWindow, topSpeed } from '../game/hoops2/engine';
import { speedOf } from '../game/football2/engine';
import { chaseTier, SPOTLIGHT_RATES } from '../../supabase/functions/card-registry/contract';
import manifest from '../data/special-editions.json';
import catalog from '../../supabase/functions/card-registry/catalog.json';
import { ownedCardsForPack } from './acquisition';
import { aiOpponent } from './battles';
import { loadCards } from './cards';
import { collectionRewards, claimCollection } from './collection';
import { eventsFor, eventRung, settleEvent } from './events';
import { registeredOpening } from './promo';
import { registeredPack, openPack, packDefs, quickSellValue, walkoutLevel } from './packs';
import { buildPool, getPool, type Pool } from './pool';
import { rateCard, toHooper } from './rate';
import { settle } from './play';
import { freshUt, migrateUt } from './state';
import { organizeStorage, removeCards } from './storage';
import { registryNamespace, type RegistryReceipt } from './registry';
import { squadFromWire, lineupOf } from './teams';
import { startersComplete } from './squad';
import type { OwnedCard, RatedCard } from './types';

let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 60000);
const copy = (rc: RatedCard, uid: string): OwnedCard => ({ uid, cardId: rc.line.id, level: 1, xp: 0, at: 1 });
const receipt = (id: string, rc: RatedCard, kind = 'spotlight'): RegistryReceipt => ({
  id,
  kind,
  sport: SPORT,
  namespace: registryNamespace(),
  tier: rc.tier,
  cardId: rc.line.id,
  seed: 'canonical-server-seed',
  serial: 8,
  totalAtPull: 20,
});

describe('Spotlight content (' + SPORT + ')', () => {
  it('audits every edition and attribute, retains all original IDs, and matches the backend catalog', async () => {
    const data = await loadCards(SPORT);
    const invalid: string[] = [];
    for (const rc of pool.base.values()) {
      const cap = rc.tier === 'goat' ? 110 : rc.tier === 'spotlight' ? 105 : 99;
      if (!Number.isFinite(rc.ovr) || rc.ovr < 1 || rc.ovr > cap || Object.values(rc.attrs).some((v) => !Number.isFinite(v) || v < 1 || v > cap)) invalid.push(rc.line.id);
      if ((rc.tier === 'goat' && rc.ovr <= 105) || (rc.tier === 'spotlight' && rc.ovr <= 99)) invalid.push(rc.line.id + ' underpowered');
      if (rc.line.seasonId && !pool.byId.has(rc.line.seasonId)) invalid.push(rc.line.id + ' missing original');
    }
    expect(invalid).toEqual([]);
    for (const edition of manifest.filter((e) => e.id.startsWith(SPORT + ':'))) expect(pool.byId.get(edition.id)?.seasonId).toBe(edition.seasonId);
    for (const tier of ['promo', 'legend', 'spotlight', 'goat'] as const)
      expect(
        data.lines
          .filter((l) => l.kind === tier)
          .map((l) => l.id)
          .sort()
      ).toEqual(catalog[SPORT][tier]);
    expect(pool.lines.filter((l) => l.kind === 'goat').length).toBeGreaterThanOrEqual(19);
    const regular = pool.lines.find((l) => l.kind === 'season' && !l.honors.length)!;
    expect(buildPool(SPORT, [regular]).print).not.toBe(buildPool(SPORT, [{ ...regular, stats: { ...regular.stats, ft: 0.99, ypc: 8 }, wt: 160 }]).print);
  });
  it('shares exact per-pack odds and cannot roll numbered editions offline', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000000; i++) {
      const t = chaseTier(i);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    for (const [tier, probability] of Object.entries(SPOTLIGHT_RATES)) expect(counts[tier] / 1000000).toBe(probability);
    expect(counts.goat).toBe(500);
    expect(packDefs(SPORT).spotlight.slots.reduce((n, o) => n + (o.goat ?? 0), 0)).toBe(0.0005);
    expect(() => openPack(pool, 'spotlight')).toThrow(/registry/);
    expect(() => openPack(pool, 'event-spotlight:dynasty')).toThrow(/registry/);
  });
  it('retains every card from reward packs sharing a prefix', () => {
    const a = ownedCardsForPack(openPack(pool, 'silver', 'a'), 'event:dynasty:0', 1);
    const b = ownedCardsForPack(openPack(pool, 'premium', 'b'), 'event:dynasty:1', 2);
    const result = organizeStorage(organizeStorage(freshUt(), a), b);
    expect(result.owned).toHaveLength(a.length + b.length);
    expect(new Set(result.owned.map((c) => c.uid)).size).toBe(a.length + b.length);
  });
  it('boosts actual attributes, respects signature weaknesses and uses a distinct GOAT reveal', () => {
    const goat = [...pool.base.values()].find((c) => c.tier === 'goat')!;
    const base = pool.base.get(goat.line.seasonId!)!;
    expect(goat.ovr).toBeGreaterThan(base.ovr);
    expect(goat.key.every(([code, , v]) => v > base.attrs[code])).toBe(true);
    expect(walkoutLevel(goat)).toBe(4);
    expect(rateCard(goat.line, 5).ovr).toBeLessThanOrEqual(110);
  });
  it('settles the same numbered receipt once, preserving IDs, XP, coins and serials through reload/storage', () => {
    const goat = [...pool.base.values()].find((c) => c.tier === 'goat')!;
    const p = freshProfile();
    p.coins = 10000;
    p.ut = organizeStorage({ ...p.ut, owned: [{ ...copy(goat, 'existing'), level: 3, xp: 42 }], squad: { [goat.pos]: 'existing' } });
    p.ut.pendingPromo = { id: '11111111-1111-4111-8111-111111111111', kind: 'spotlight', price: 3500, at: 50 };
    const r = receipt(p.ut.pendingPromo.id, goat);
    const a = registeredOpening(pool, p, r);
    expect(a.profile.coins).toBe(6500);
    expect(a.profile.ut.owned.find((c) => c.uid === 'existing')).toMatchObject({ level: 3, xp: 42 });
    const minted = a.profile.ut.owned.find((c) => c.mint)!;
    expect(minted.mint).toEqual({ serial: 8, totalAtPull: 20, requestId: r.id, namespace: r.namespace });
    expect(a.profile.ut.duplicateStorage).toContain(minted.uid);
    expect(registeredOpening(pool, a.profile, r)).toEqual({ profile: a.profile, opening: null });
    expect(migrateUt(JSON.parse(JSON.stringify(a.profile.ut)))).toEqual(a.profile.ut);
    expect(a.opening?.cards.length).toBe(SPORT === 'nba' ? 8 : 16);
  });
  it('rejects mismatched or malformed receipts without changing the saved profile', () => {
    const rc = [...pool.base.values()].find((c) => c.tier === 'goat')!,
      p = freshProfile();
    p.coins = 5000;
    p.ut.pendingPromo = { id: '11111111-1111-4111-8111-111111111111', kind: 'spotlight', price: 3500, at: 1 };
    const before = JSON.stringify(p);
    expect(() => registeredOpening(pool, p, { ...receipt(p.ut.pendingPromo!.id, rc), serial: 0 })).toThrow(/invalid/);
    expect(() => registeredOpening(pool, p, { ...receipt(p.ut.pendingPromo!.id, rc), sport: SPORT === 'nba' ? 'nfl' : 'nba' })).toThrow(/match/);
    expect(JSON.stringify(p)).toBe(before);
  });
  it('collection claims do not consume cards, cannot pay twice and survive using a duplicate in an SBC', () => {
    const cards = [...pool.base.values()].slice(0, 30);
    let ut = organizeStorage({ ...freshUt(), owned: cards.map((rc, i) => copy(rc, 'c' + i)) });
    const result = claimCollection(pool, ut, 'editions:25', 100);
    expect(result.coins).toBe(100);
    expect(result.ut.owned).toEqual(ut.owned);
    expect(claimCollection(pool, result.ut, 'editions:25', 101).coins).toBe(0);
    ut = removeCards(
      result.ut,
      result.ut.owned.map((c) => c.uid)
    );
    expect(collectionRewards(pool, ut).find((g) => g.id === 'editions:25')?.have).toBe(30);
    expect(claimCollection(pool, migrateUt(ut), 'editions:25', 102).claimed).toBe(false);
    expect(claimCollection(pool, freshUt(), 'editions:25', 103).coins).toBe(0);
  });
  it('builds all nine event matchups with a valid full lineup and GOAT finale', () => {
    for (const e of eventsFor(pool))
      for (let node = 0; node < 3; node++) {
        const rung = eventRung(pool, e.id, node)!;
        expect(startersComplete(SPORT, lineupOf(squadFromWire(pool, rung.squad)))).toBe(true);
        expect(rung.ovr).toBeGreaterThan(50);
        if (node === 2) expect(rung.squad.some(([, id]) => pool.base.get(id)?.tier === 'goat')).toBe(true);
      }
    expect(eventRung(pool, 'invalid', 0)).toBeNull();
  });
  it('gives a 99+ squad a comparably strong AI fallback', () => {
    const rival = aiOpponent(pool, 108, 'goat-fallback');
    expect(rival.ovr).toBeGreaterThanOrEqual(104);
    expect(startersComplete(SPORT, lineupOf(squadFromWire(pool, rival.squad)))).toBe(true);
  });
  it('grants each event stage once, never skips stages, and does not advance Squad Battles or Rivals', () => {
    let ut = freshUt();
    expect(settleEvent(ut, 'dynasty', 1, 1)).toBe(ut);
    for (let node = 0; node < 3; node++) ut = settleEvent(ut, 'dynasty', node, node + 1);
    expect(ut.events?.dynasty).toBe(3);
    expect(ut.packs.map((p) => p.kind)).toEqual(['silver', 'premium', 'event-spotlight:dynasty']);
    expect(settleEvent(ut, 'dynasty', 2, 4)).toBe(ut);
    const s = settle(freshUt(), {
      won: true,
      us: 10,
      them: 0,
      online: false,
      rung: null,
      played: [],
      week: '2026-W44',
      day: '2026-10-28',
      packId: 'x',
      at: 1,
      event: { id: 'dynasty', node: 0 },
      matchId: 'event-test',
    });
    expect(s.ut.events?.dynasty).toBe(1);
    expect(s.ut.battles.cleared).toBe(0);
    expect(s.ut.rivals).toBeUndefined();
    expect(
      settle(s.ut, {
        won: true,
        us: 10,
        them: 0,
        online: false,
        rung: null,
        played: [],
        week: '2026-W44',
        day: '2026-10-28',
        packId: 'x',
        at: 1,
        event: { id: 'dynasty', node: 0 },
        matchId: 'event-test',
      }).coins
    ).toBe(0);
  });
  it('keeps expected Spotlight quick-sell returns below the pack price', () => {
    let expected = 0;
    for (const [tier, probability] of Object.entries(SPOTLIGHT_RATES)) {
      const cards = [...pool.base.values()].filter((rc) => rc.tier === tier);
      const mean = cards.reduce((n, c) => n + quickSellValue(c), 0) / cards.length;
      expected += probability * mean;
    }
    const common = registeredPack(pool, 'spotlight', 'common', null)
      .slice(0, -1)
      .reduce((n, c) => n + quickSellValue(c), 0);
    expect(expected + common).toBeLessThan(packDefs(SPORT).spotlight.price);
  });
});

describe.skipIf(SPORT !== 'nba')('NBA player identity and above-99 gameplay', () => {
  const player = (name: string, season: number) => rateCard(pool.lines.find((l) => l.kind === 'season' && l.name === name && l.season === season)!);
  it('keeps elite defenders, shooters, finishers and rebounders distinct', () => {
    const pip = player('Scottie Pippen', 1996),
      curry = player('Stephen Curry', 2016),
      jordan = player('Michael Jordan', 1996),
      shaq = player("Shaquille O'Neal", 2000),
      rodman = player('Dennis Rodman', 1996);
    expect(pip.attrs.PRD).toBeGreaterThanOrEqual(94);
    expect(pip.attrs.PRD - curry.attrs.PRD).toBeGreaterThan(10);
    expect(curry.attrs['3PT']).toBeGreaterThanOrEqual(97);
    expect(curry.attrs.HND).toBeGreaterThanOrEqual(94);
    expect(jordan.attrs.MID).toBeGreaterThanOrEqual(95);
    expect(jordan.attrs.CLS).toBeGreaterThanOrEqual(93);
    expect(player('LeBron James', 2013).attrs.SPD).toBeGreaterThanOrEqual(90);
    expect(player('Kobe Bryant', 2006).attrs.MID).toBeGreaterThanOrEqual(94);
    expect(shaq.attrs.CLS).toBeGreaterThanOrEqual(95);
    expect(shaq.attrs.MID).toBeLessThan(60);
    expect(shaq.attrs['3PT']).toBeLessThan(50);
    expect(player('Tim Duncan', 2003).attrs['3PT']).toBeLessThan(60);
    expect(rodman.attrs.REB).toBeGreaterThanOrEqual(95);
    expect(rodman.ovr).toBeGreaterThanOrEqual(89);
    expect(player('Michael Jordan', 1985).attrs).not.toEqual(player('Michael Jordan', 2003).attrs);
  });
  it('above-99 speed and shooting improve real movement and timing windows without changing the 99 ceiling behavior', () => {
    const h = toHooper(player('Stephen Curry', 2016));
    h.spd = 99;
    h.thr = 99;
    const elite = { ...h, spd: 110, thr: 110 };
    const normal = newPossession([h, h, h, h, h], [h, h, h, h, h], [1, 1, 1, 1, 1], () => 0.5),
      special = newPossession([elite, h, h, h, h], [h, h, h, h, h], [1, 1, 1, 1, 1], () => 0.5);
    expect(topSpeed(special.bodies[0], false)).toBeGreaterThan(topSpeed(normal.bodies[0], false));
    expect(greenWindow(special, special.bodies[0], 'three', 'open')).toBeGreaterThan(greenWindow(normal, normal.bodies[0], 'three', 'open'));
  });
});
describe.skipIf(SPORT !== 'nfl')('NFL rate normalization and above-99 movement', () => {
  it('pocket QBs do not become sprinters from season rushing totals, and source season totals stay intact', () => {
    const l = pool.lines.find((l) => l.kind === 'season' && l.name === 'Tom Brady' && l.season === 2007)!;
    const before = JSON.stringify(l);
    const rc = rateCard(l);
    expect(rc.attrs.SPD).toBeLessThan(65);
    expect(Math.abs(rc.attrs.ACC - rc.attrs.SPD)).toBeLessThanOrEqual(4);
    expect(rc.abil).not.toContain('scrambler');
    expect(JSON.stringify(l)).toBe(before);
    const man = { id: 'test', name: 'Test', tag: 'T', num: 1, ht: 74, wt: 220, pos: 'RB', ovr: 99, a: { SPD: 99 }, abil: [] };
    expect(speedOf({ ...man, a: { SPD: 110 } })).toBeGreaterThan(speedOf(man));
  });
});
