// Claude, 2026-11-01: the Pack Tracker's log (docs/PULL-TRACKER.md). Runs in every sport (NBA,
// PS_SPORT=nfl, and PS_SPORT=soccer through soccer-pull-tracker.test.ts). A pack is logged exactly
// once, the recent list holds its caps while the totals never stop counting, old saves without the
// field load and round-trip through recovery and the cloud snapshot, and the "all cards" list marks
// copies packed before the tracker.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SPORT } from '../engine/sport';
import { applyProgress, captureProgress, checkedSnapshot } from '../lib/cloud-data';
import { freshProfile, PROFILE_KEYS } from '../lib/profile';
import { OPTIONAL_KEYS, RECOVERY_KEYS, validateSaveValues } from '../lib/recovery';
import { ownedCardsForPack } from './acquisition';
import { addPick, keepPick, pickFor } from './content-packs';
import { normalizeContent } from './content-state';
import { openPack, packDefs, quickSellValue } from './packs';
import { byValue, getPool, type Pool } from './pool';
import { registeredOpening } from './promo';
import { allPulled, expectedFor, ovrEdges, packGroup, pullsOf, recordPull, sourceOfPending, specialOdds, uidOf, untrackedPacks, type PullInput } from './pull-log';
import { PULL_LOG_CARDS, PULL_LOG_PACKS, normalizePulls } from './pull-log-state';
import { registryNamespace } from './registry';
import { freshUt, migrateUt, type UtState } from './state';
import { organizeStorage, removeCards } from './storage';
import type { RatedCard } from './types';

let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 120000);

/** What UltimateTeam.openNow does: log on the state before the cards land, then deposit them. */
function open(ut: UtState, kind: string, id: string, at: number, price = 0, source = 'store', cards?: RatedCard[]): UtState {
  const cs = cards ?? openPack(pool, kind, id);
  const input: PullInput = { id, kind, name: kind + ' pack', price, source, at, uid: 'pack:' + id + ':', cards: cs };
  return { ...organizeStorage(recordPull(ut, input), ownedCardsForPack(cs, id, at)), packsOpened: ut.packsOpened + 1 };
}

describe('pack tracker log (' + SPORT + ')', () => {
  it('logs a pack exactly once (same id, or a replay whose cards are already owned)', () => {
    let ut = open(freshUt(), 'gold', 'g1', 1000, 900);
    const log = pullsOf(ut)!;
    expect(log.r).toHaveLength(1);
    expect(log.since).toBe(1000);
    expect(log.a.gold.n).toBe(1);
    expect(log.r[0].cs.map((_, i) => uidOf(log.r[0], i))).toEqual(ut.owned.map((c) => c.uid));
    // a re-render / retried update with the same pack id
    const again = recordPull(ut, { id: 'g1', kind: 'gold', name: 'Gold', price: 900, source: 'store', at: 1000, uid: 'pack:g1:', cards: openPack(pool, 'gold', 'g1') });
    expect(again).toBe(ut);
    // the same cards replayed under the same uids after the entry aged out of the recent list
    const aged = { ...ut, content: { ...ut.content, pulls: { ...log, r: [] } } };
    expect(recordPull(aged, { id: 'g1', kind: 'gold', name: 'Gold', price: 900, source: 'store', at: 1000, uid: 'pack:g1:', cards: openPack(pool, 'gold', 'g1') })).toBe(aged);
    // and a reload (save → load) keeps exactly one
    ut = migrateUt(JSON.parse(JSON.stringify(ut)));
    expect(pullsOf(ut)!.r).toHaveLength(1);
    expect(pullsOf(ut)!.a.gold.n).toBe(1);
  });

  it('keeps totals uncapped while the recent list holds its pack and card caps', () => {
    let ut = freshUt();
    const n = PULL_LOG_PACKS + 25;
    for (let i = 0; i < n; i++) ut = open(ut, 'bronze', 'b' + i, 10 + i, packDefs(SPORT).bronze.price);
    const log = pullsOf(ut)!;
    expect(log.a.bronze.n).toBe(n);
    expect(log.a.bronze.c).toBe(n * packDefs(SPORT).bronze.price);
    expect(log.r.length).toBeLessThanOrEqual(PULL_LOG_PACKS);
    expect(log.r.reduce((s, e) => s + e.cs.length, 0)).toBeLessThanOrEqual(PULL_LOG_CARDS);
    expect(log.r[log.r.length - 1].id).toBe('b' + (n - 1));
    expect(log.since).toBe(10);
    // big packs: the card cap trims the oldest
    for (let i = 0; i < 120; i++) ut = open(ut, 'jumbo', 'j' + i, 1000 + i, packDefs(SPORT).jumbo.price);
    const l2 = pullsOf(ut)!;
    expect(l2.r.reduce((s, e) => s + e.cs.length, 0)).toBeLessThanOrEqual(PULL_LOG_CARDS);
    expect(l2.r[l2.r.length - 1].id).toBe('j119');
    expect(l2.a.jumbo.n).toBe(120);
    expect(l2.a.bronze.n).toBe(n);
    // the profile stays small: the whole log as JSON
    expect(JSON.stringify(l2).length).toBeLessThan(110_000);
  });

  it('adds up tiers, overall buckets, hits, specials, best pull and quick-sell value', () => {
    let ut = freshUt();
    const packs = Array.from({ length: 12 }, (_, i) => openPack(pool, 'premium', 'p' + i));
    packs.forEach((cs, i) => (ut = open(ut, 'premium', 'p' + i, 100 + i, i < 10 ? packDefs(SPORT).premium.price : 0, i < 10 ? 'store' : 'reward', cs)));
    const a = pullsOf(ut)!.a.premium;
    const all = packs.flat();
    const e = ovrEdges(SPORT);
    expect(a.n).toBe(12);
    expect(a.pd).toBe(10);
    expect(a.c).toBe(10 * packDefs(SPORT).premium.price);
    expect(a.k).toBe(all.length);
    expect(Object.values(a.t).reduce((s, x) => s + x, 0)).toBe(all.length);
    expect(a.o.reduce((s, x) => s + x, 0)).toBe(all.length);
    expect(a.o[5]).toBe(all.filter((rc) => rc.ovr >= e[4]).length);
    expect(a.h86).toBe(packs.filter((cs) => cs.some((rc) => rc.ovr >= e[3])).length);
    expect(a.q).toBe(all.reduce((s, rc) => s + quickSellValue(rc), 0));
    expect(a.qp).toBe(packs.slice(0, 10).flat().reduce((s, rc) => s + quickSellValue(rc), 0));
    const best = all.slice().sort(byValue)[0];
    expect([a.b![1], a.b![2]]).toEqual([best.ovr, best.tier]);
    expect(a.f).toBe(100);
    expect(a.l).toBe(111);
  });

  it('groups packs by type and reads where a waiting pack came from', () => {
    expect(packGroup('position:PG', 'store')).toBe('position');
    expect(packGroup('premium', 'preview')).toBe('preview');
    expect(packGroup('event-spotlight:immortals', 'event')).toBe('event-spotlight');
    expect(packGroup('live-pick:s4:3', 'reward')).toBe('live-pick');
    expect(sourceOfPending('daily-gold:2026-11-01')).toBe('daily');
    expect(sourceOfPending('2026-W44:tier:5')).toBe('season');
    expect(sourceOfPending('objective:abc')).toBe('objective');
    expect(sourceOfPending('event:immortals:2')).toBe('event');
    expect(sourceOfPending('stream:nba:x:1')).toBe('sbc');
    expect(sourceOfPending('7c0f3b1e-aaaa-4bbb-8ccc-000000000000')).toBe('reward');
  });

  it('logs a kept pick once, with the Store price for a bought Scout’s Choice', () => {
    const id = 'scout:abc';
    let ut = addPick(freshUt(), pickFor(pool, 'scout', id, '2026-W44', 5));
    const shown = keepPick(ut, id, 1, 9);
    const rc = pool.base.get(shown.card!.cardId)!;
    const log = (u: UtState) => keepPick(recordPull(u, { id: 'pick:' + id, kind: 'scout', name: "Scout's Choice", price: packDefs(SPORT).scout.price, source: 'store', at: 9, uid: 'pick:' + id, cards: [rc] }), id, 1, 9).ut;
    ut = log(ut);
    expect(ut.owned.map((c) => c.uid)).toEqual(['pick:' + id]);
    expect(pullsOf(ut)!.a.scout).toMatchObject({ n: 1, pd: 1, c: packDefs(SPORT).scout.price, k: 1 });
    expect(uidOf(pullsOf(ut)!.r[0], 0)).toBe('pick:' + id);
    // replaying the keep changes nothing
    expect(pullsOf(log(ut))!.a.scout.n).toBe(1);
    // picks never counted in packsOpened
    expect(untrackedPacks({ ...ut, packsOpened: 0 })).toBe(0);
  });

  it('logs a registered (Spotlight) pack once when its receipt settles, retries included', () => {
    const p = freshProfile();
    p.coins = 10000;
    p.ut.pendingPromo = { id: '22222222-2222-4222-8222-222222222222', kind: 'spotlight', price: 3500, at: 70 };
    const r = { id: p.ut.pendingPromo.id, kind: 'spotlight', sport: SPORT, namespace: registryNamespace(), tier: 'gold', cardId: null, seed: 'seed-1', serial: null, totalAtPull: null };
    const a = registeredOpening(pool, p, r);
    const log = pullsOf(a.profile.ut)!;
    expect(log.a.spotlight).toMatchObject({ n: 1, pd: 1, c: 3500 });
    expect(log.r[0].cs.map((_, i) => uidOf(log.r[0], i))).toEqual(a.opening!.cards.map((c) => c.uid));
    expect(pullsOf(registeredOpening(pool, a.profile, r).profile.ut)!.a.spotlight.n).toBe(1);
    expect(migrateUt(JSON.parse(JSON.stringify(a.profile.ut)))).toEqual(a.profile.ut);
  });

  it('lists every pulled card, marking copies from before the tracker', () => {
    const gold = [...pool.base.values()].find((rc) => rc.tier === 'gold')!;
    let ut: UtState = { ...freshUt(), owned: [{ uid: 'pack:old:0', cardId: gold.line.id, level: 2, xp: 5, at: 50 }, { uid: 'sbc1234abcd', cardId: gold.line.id, level: 1, xp: 0, at: 60 }], packsOpened: 3 };
    ut = open(ut, 'silver', 's1', 500, packDefs(SPORT).silver.price);
    const sold = ut.owned.find((c) => c.uid === 'pack:s1:0')!;
    ut = removeCards(ut, [sold.uid], 'sold');
    // the retirement acknowledged by the server and pruned: still listed from the log
    ut = { ...ut, retirements: [] };
    const items = allPulled(ut);
    expect(items[0].at).toBeGreaterThanOrEqual(500);
    expect(items.find((x) => x.uid === 'pack:old:0')).toMatchObject({ origin: 'pre', status: 'club' });
    expect(items.find((x) => x.uid === 'sbc1234abcd')).toMatchObject({ origin: 'sbc' });
    expect(items.find((x) => x.uid === sold.uid)).toMatchObject({ status: 'gone', origin: 'pack' });
    expect(items.filter((x) => x.entry?.id === 's1')).toHaveLength(pullsOf(ut)!.r[0].cs.length);
    expect(untrackedPacks(ut)).toBe(3);
  });

  it('compares with the published odds through the real pack code', () => {
    const exp = expectedFor(pool, 'premium', '2026-11-01', '2026-W44', 60)!;
    expect(exp.packs).toBe(60);
    expect(exp.special).toBeCloseTo(specialOdds(packDefs(SPORT).premium), 10);
    expect(exp.qs).toBeGreaterThan(0);
    expect(exp.r86).toBeGreaterThanOrEqual(exp.r90);
    expect(expectedFor(pool, 'scout', '2026-11-01', '2026-W44')).toBeNull();
    expect(expectedFor(pool, 'position', '2026-11-01', '2026-W44', 12)!.packs).toBe(12);
  });
});

describe('pack tracker saves (' + SPORT + ')', () => {
  let values: Map<string, string>;
  const storage = () => ({ getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v), removeItem: (k: string) => void values.delete(k) });
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', storage());
  });

  it('loads a save from before the tracker unchanged, with nothing tracked', () => {
    const old = { ...freshUt(), owned: [{ uid: 'u1', cardId: 'x', level: 3, xp: 4, at: 1 }], packsOpened: 7, content: { claims: ['a'] } };
    const ut = migrateUt(JSON.parse(JSON.stringify(old)));
    expect(ut.content).toEqual({ claims: ['a'] });
    expect(pullsOf(ut)).toBeNull();
    expect(untrackedPacks(ut)).toBe(7);
    expect(allPulled(ut)[0]).toMatchObject({ uid: 'u1', origin: 'pre' });
    expect(migrateUt(JSON.parse(JSON.stringify({ ...freshUt(), content: undefined }))).content).toBeUndefined();
  });

  it('drops bad entries and duplicates without losing good ones', () => {
    const good = { id: 'a', k: 'gold', n: 'Gold Pack', c: 900, s: 'store', at: 5, u: 'pack:a:', cs: [['nba:x', 80, 'gold']] };
    const raw = { since: 5, r: [good, good, { id: 3 }, null, { ...good, id: 'b', cs: [['ok', 70, 'silver'], [1, 2, 3]] }], a: { gold: { nm: 'Gold Pack', n: 2, o: [0, 1, 'x'] }, bad: 4 } };
    const n = normalizePulls(raw)!;
    expect(n.r.map((e) => e.id)).toEqual(['a', 'b']);
    expect(n.r[1].cs).toEqual([['ok', 70, 'silver']]);
    expect(n.a.gold).toMatchObject({ n: 2, o: [0, 1, 0, 0, 0, 0] });
    expect(n.a.bad).toBeUndefined();
    expect(normalizeContent({ pulls: 'nope' })).toEqual({});
    expect(normalizePulls(JSON.parse(JSON.stringify(n)))).toEqual(n);
  });

  it('round-trips through the file backup check and the cloud snapshot, old and new', () => {
    const key = PROFILE_KEYS[SPORT];
    const p = freshProfile();
    p.name = 'Tracker';
    p.ut = open(freshUt(), 'gold', 'cloud1', 77, 900);
    const nba = SPORT === 'nba' ? p : { ...freshProfile(), name: 'Tracker' };
    values.set(PROFILE_KEYS.nba, JSON.stringify(nba));
    if (SPORT !== 'nba') values.set(key, JSON.stringify(p));
    const snap = captureProgress(storage());
    expect(() => checkedSnapshot(snap)).not.toThrow();
    values = new Map();
    applyProgress(storage(), snap);
    const back = migrateUt(JSON.parse(values.get(key)!).ut);
    expect(pullsOf(back)!.a.gold.n).toBe(1);
    expect(back).toEqual(migrateUt(JSON.parse(JSON.stringify(p.ut))));
    // an old save (no pulls anywhere) still validates
    const data: Record<string, string | null> = Object.fromEntries(RECOVERY_KEYS.filter((k) => !OPTIONAL_KEYS.includes(k)).map((k) => [k, null]));
    data[PROFILE_KEYS.nba] = JSON.stringify({ ...freshProfile(), name: 'Old' });
    expect(validateSaveValues(data, 1).name).toBe('Old');
    data[PROFILE_KEYS.nba] = JSON.stringify(nba);
    expect(validateSaveValues(data, 1).name).toBe('Tracker');
  });
});
