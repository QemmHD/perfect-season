// Claude (packs-1, 2026-11-16): the `stamps` suite (docs/studio-overhaul/packs.md "Scout Stamps"). One
// module, run once per sport: stamps.test.ts in the NBA and NFL runs, soccer-stamps.test.ts in the soccer
// run (which only picks files named for soccer). It proves the stamp core ut's MINUTES ladder and Scout
// Drops build on: pack earning exactly once per opening, grants exactly once per (source, id), the
// recovery floors after an older build strips the field, pinned claims, redemption, the light import
// graph and the balance's speed. Test code only: no app module imports it.
/// <reference types="vite/client" />
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { applyProgress, captureProgress, checkedSnapshot } from '../../lib/cloud-data';
import { freshProfile, PROFILE_KEYS } from '../../lib/profile';
import { OPTIONAL_KEYS, RECOVERY_KEYS, validateSaveValues } from '../../lib/recovery';
import { pickFor, SPORT } from '../../engine/sport';
import { legacyNormalizeContent } from '../__fixtures__/legacy-content-state';
import { normalizeContent, withClaim } from '../content-state';
import { packDefs } from '../packs';
import { packsClaimables, STAMPS_READY } from '../packs-claimables';
import { getPool, type Pool } from '../pool';
import { recordPull, type PullInput } from '../pull-log';
import { claimStamps, grantStamps, NOMINAL_PRICE, pullStampsFloor, STAMP_GRANT, STAMP_SHELF, STAMPS_FROM, stampsBalance, stampsToNext } from '../scout-stamps';
import { redeemStamps } from '../stamp-shelf';
import { freshUt, migrateUt, type UtState } from '../state';
import type { RatedCard } from '../types';

const AT = STAMPS_FROM + 86400000;
/** The sources an import walk from src/ut can reach (keys like '../pool.ts', '../../engine/rng.ts'). */
const SOURCES = import.meta.glob<string>(['../*.ts', '../../engine/*.ts', '../../lib/*.ts'], { query: '?raw', import: 'default', eager: true });
/** '../a/b/../c.ts' → '../a/c.ts' */
const norm = (p: string) => {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (part === '..' && out.length && out[out.length - 1] !== '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return out.join('/');
};

export function stampsSuite(): void {
  let pool: Pool;
  let golds: RatedCard[];
  let specials: RatedCard[];
  beforeAll(async () => {
    pool = await getPool();
    golds = Object.values(pool.buckets.gold).flat();
    specials = [...Object.values(pool.buckets.legend).flat(), ...Object.values(pool.buckets.promo).flat()];
  }, 120000);

  /** A pack as recordPull sees it: `n` golds (and any extra cards), opened at `at`. */
  const pack = (id: string, kind: string, price: number, source: string, at = AT, extra: RatedCard[] = [], n = 4): PullInput => ({
    id,
    kind,
    name: kind,
    price,
    source,
    at,
    uid: 'pack:' + id + ':',
    cards: [...golds.slice(0, n), ...extra],
  });

  describe('Scout Stamps: earning (' + SPORT + ')', () => {
    it('pays 1 per 100 coins of the price, once per opening (a replayed id or a deposited pack earns 0)', () => {
      const price = packDefs(SPORT).gold.price;
      let ut: UtState = recordPull(freshUt(), pack('g1', 'gold', price, 'store'));
      expect(stampsBalance(ut)).toBe(Math.floor(price / 100));
      expect(recordPull(ut, pack('g1', 'gold', price, 'store'))).toBe(ut);
      // the same pack whose cards are already in the club (a reload after the deposit)
      const deposited = { ...ut, owned: [{ uid: 'pack:g2:0', cardId: golds[0].line.id, level: 1, xp: 0, at: AT }] };
      expect(stampsBalance(recordPull(deposited, pack('g2', 'gold', price, 'store')))).toBe(stampsBalance(ut));
      ut = recordPull(ut, pack('g3', 'gold', price, 'store'));
      expect(stampsBalance(ut)).toBe(2 * Math.floor(price / 100));
      expect(ut.content!.stamps).toEqual({ earned: 2 * Math.floor(price / 100), spent: 0 });
    });

    // (packs-2 re-priced the Silver Pack: NBA 400 → 500, NFL 320 → 350, soccer 380 → 450)
    it('earns an earned pack at its Store price: a MINUTES Silver is 5 stamps in NBA (its 500)', () => {
      const ut = recordPull(freshUt(), pack('minutes:life:1h', 'silver', 0, 'reward'));
      expect(stampsBalance(ut)).toBe(Math.floor(packDefs(SPORT).silver.price / 100));
      expect(stampsBalance(ut)).toBe(pickFor(SPORT, { nba: 5, nfl: 3, soccer: 4 }));
      expect(stampsBalance(recordPull(freshUt(), pack('objective:x', 'position:' + 'any', 0, 'objective')))).toBe(Math.floor(packDefs(SPORT).position.price / 100));
    });

    it('earns 0 for the Daily Drop and daily bonuses, picks, the starter, Scout Drop packs and admin awards', () => {
      const none: PullInput[] = [
        pack('daily:' + SPORT + ':2026-12-01', 'daily', 0, 'daily'),
        pack('daily-bonus:2026-12-01', 'silver', 0, 'daily'),
        pack('pick:scout:2026-12-01', 'scout', packDefs(SPORT).scout.price, 'store', AT, [], 1),
        pack('pick:stamps:g82:u1', 'pick-82', 0, 'reward', AT, [], 1),
        pack('starter', 'starter', 0, 'starter'),
        pack('scout-drop:p1:' + SPORT + ':2026-12-01:2', 'silver', 0, 'reward'),
        pack('gift:1', 'admin-icon', 0, 'reward'),
      ];
      for (const p of none) expect(stampsBalance(recordPull(freshUt(), p)), p.id).toBe(0);
    });

    it('adds 10 for each special edition the player already had, and only then', () => {
      const sp = specials[0];
      const price = packDefs(SPORT).premium.price;
      const base = Math.floor(price / 100);
      expect(stampsBalance(recordPull(freshUt(), pack('p1', 'premium', price, 'store', AT, [sp])))).toBe(base);
      const owned = { ...freshUt(), owned: [{ uid: 'old', cardId: sp.line.id, level: 1, xp: 0, at: 1 }] };
      expect(stampsBalance(recordPull(owned, pack('p1', 'premium', price, 'store', AT, [sp])))).toBe(base + 10);
      // pulled twice: the second pack earns the bonus (the first is in the log)
      const twice = recordPull(recordPull(freshUt(), pack('p1', 'premium', price, 'store', AT, [sp])), pack('p2', 'premium', price, 'store', AT + 1, [sp]));
      expect(stampsBalance(twice)).toBe(2 * base + 10);
      // a gold already owned adds nothing
      const g = { ...freshUt(), owned: [{ uid: 'g', cardId: golds[0].line.id, level: 1, xp: 0, at: 1 }] };
      expect(stampsBalance(recordPull(g, pack('p3', 'premium', price, 'store')))).toBe(base);
    });

    it('pays nothing for packs before the release (no back-pay)', () => {
      const ut = recordPull(freshUt(), pack('g0', 'gold', packDefs(SPORT).gold.price, 'store', STAMPS_FROM - 1));
      expect(stampsBalance(ut)).toBe(0);
      expect(ut.content!.stamps).toBeUndefined();
    });

    it('prices earned packs exactly as the Store does (NOMINAL_PRICE = packDefs)', () => {
      const defs = packDefs(SPORT) as Record<string, { price: number }>;
      for (const [kind, price] of Object.entries(NOMINAL_PRICE[SPORT])) expect(price, kind).toBe(defs[kind].price);
    });
  });

  describe('Scout Stamps: grants (' + SPORT + ')', () => {
    it('applies a grant exactly once per (source, id), in this sport', () => {
      const once = grantStamps(freshUt(), STAMP_GRANT.minutes30, 'minutes', 'day:2026-12-01:30');
      expect(stampsBalance(once)).toBe(5);
      expect(grantStamps(once, STAMP_GRANT.minutes30, 'minutes', 'day:2026-12-01:30')).toBe(once);
      // the same id from another source, and another day, are different grants
      const more = grantStamps(grantStamps(once, STAMP_GRANT.drop, 'drop', 'day:2026-12-01:30'), 5, 'minutes', 'day:2026-12-02:30');
      expect(stampsBalance(more)).toBe(13);
      expect(more.content!.claims).toEqual(['stamps-grant:5:minutes:day:2026-12-01:30', 'stamps-grant:3:drop:day:2026-12-01:30', 'stamps-grant:5:minutes:day:2026-12-02:30']);
    });

    it('throws for n outside 1..50 or not an integer, and for an empty id', () => {
      for (const n of [0, 51, 2.5, -1, NaN]) expect(() => grantStamps(freshUt(), n, 'minutes', 'x'), String(n)).toThrow(/integer from 1 to 50/);
      expect(() => grantStamps(freshUt(), 5, 'minutes', '')).toThrow();
      expect(stampsBalance(grantStamps(freshUt(), 50, 'rookie', 'day7'))).toBe(50);
      expect(stampsBalance(grantStamps(freshUt(), 1, 'other', 'x'))).toBe(1);
    });

    it('stampsToNext names the next shelf item it can’t afford yet', () => {
      expect(stampsToNext(freshUt())).toEqual({ have: 0, need: 50, item: '82+ Player Pick' });
      const ut = grantStamps(grantStamps(freshUt(), 33, 'other', 'a'), 5, 'minutes', 'b');
      expect(stampsToNext(ut)).toEqual({ have: 38, need: 12, item: '82+ Player Pick' });
      let rich: UtState = freshUt();
      for (let i = 0; i < 12; i++) rich = grantStamps(rich, 50, 'other', 'r' + i);
      expect(stampsToNext(rich)).toBeNull();
      expect(stampsToNext(grantStamps(freshUt(), 50, 'other', 'x'))).toEqual({ have: 50, need: 70, item: STAMP_SHELF[1].label });
    });

    it('packsClaimables: one line once a pick is ready, none before', () => {
      expect(packsClaimables(freshUt(), '2026-12-01', SPORT)).toEqual({ n: 0, ids: [], lines: [] });
      expect(packsClaimables(grantStamps(freshUt(), 49, 'other', 'x'), '2026-12-01', SPORT).n).toBe(0);
      expect(packsClaimables(grantStamps(freshUt(), 50, 'other', 'x'), '2026-12-01', SPORT)).toEqual({ n: 1, ids: [STAMPS_READY], lines: ['Scout Stamps: a pick is ready'] });
    });
  });

  describe('Scout Stamps: redemption (' + SPORT + ')', () => {
    it('spends the cost and leaves exactly one pick pending; a repeat uuid is a no-op; short returns null', () => {
      const at = AT;
      const rich = grantStamps(grantStamps(freshUt(), 40, 'other', 'a'), 30, 'other', 'b');
      expect(redeemStamps(grantStamps(freshUt(), 49, 'other', 'a'), pool, 'g82', 'u1', '2026-12-01', at)).toBeNull();
      expect(redeemStamps(rich, pool, 'scout85', 'u1', '2026-12-01', at)).toBeNull();
      const r = redeemStamps(rich, pool, 'g82', 'u1', '2026-12-01', at)!;
      expect(stampsBalance(r)).toBe(20);
      expect(r.content!.picks).toHaveLength(1);
      const pick = r.content!.picks![0];
      expect(pick.id).toBe('stamps:g82:u1');
      expect(pick.options).toHaveLength(3);
      expect(pick.options.every((id) => pool.base.get(id)!.tier === 'gold')).toBe(true);
      expect(redeemStamps(r, pool, 'g82', 'u1', '2026-12-01', at)).toBe(r);
      expect(redeemStamps(r, pool, 'g82', 'u2', '2026-12-01', at)).toBeNull();
      expect(r.content!.claims!.slice(-1)).toEqual(['stamps:g82:50:u1']);
    });
  });

  describe('Scout Stamps: older builds (' + SPORT + ')', () => {
    /** 400 packs since release (5 cards each; a special pulled twice in a row every 10 packs), grants and a redemption. */
    const history = () => {
      let ut: UtState = freshUt();
      const price = packDefs(SPORT).gold.price;
      const stampsOf: number[] = [];
      for (let i = 0; i < 400; i++) {
        const sp = i % 10 < 2 ? [specials[Math.floor(i / 10) % specials.length]] : [];
        const before = stampsBalance(ut);
        ut = recordPull(ut, { ...pack('h' + i, i % 3 ? 'gold' : 'silver', i % 3 ? price : 0, i % 3 ? 'store' : 'reward', AT + i, sp, 5 - sp.length) });
        stampsOf.push(stampsBalance(ut) - before);
        if (i % 50 === 0) ut = grantStamps(ut, STAMP_GRANT.minutes30, 'minutes', 'day:' + i + ':30');
        if (i % 37 === 0) ut = withClaim(ut, 'objective:filler:' + i);
      }
      ut = redeemStamps(ut, pool, 'g82', 'r1', '2026-12-01', AT + 500)!;
      return { ut, stampsOf };
    };

    it('after a legacy strip, grants lose 0 and pack stamps lose at most those beyond the newest 300; never more than the truth', () => {
      const { ut, stampsOf } = history();
      const truth = stampsBalance(ut);
      expect(ut.content!.pulls!.r).toHaveLength(300);
      const stripped = legacyNormalizeContent(JSON.parse(JSON.stringify(ut.content)));
      expect(stripped).not.toHaveProperty('stamps');
      const back = { ...ut, content: normalizeContent(stripped) };
      const after = stampsBalance(back);
      const beyond = stampsOf.slice(0, 100).reduce((a, b) => a + b, 0);
      expect(beyond).toBeGreaterThan(0);
      expect(after).toBeLessThanOrEqual(truth);
      expect(truth - after).toBeLessThanOrEqual(beyond);
      // the window's own packs come back exactly, and so do every grant and the spend
      expect(truth - after).toBe(beyond);
      expect(claimStamps(back.content!.claims)).toEqual({ granted: 8 * STAMP_GRANT.minutes30, spent: 50 });
      // and with nothing stripped, the normalizer keeps the field as it is
      expect(normalizeContent(JSON.parse(JSON.stringify(ut.content)))!.stamps).toEqual(ut.content!.stamps);
      // a balance the floors restored keeps building from them
      expect(stampsBalance(grantStamps(back, 5, 'minutes', 'day:new:30'))).toBe(after + 5);
    });

    it('pins every stamps: and stamps-grant: claim at the end, so slice(-5000) (old builds too) keeps them', () => {
      let ut: UtState = grantStamps(freshUt(), 5, 'minutes', 'day:1:30');
      ut = redeemStamps(grantStamps(ut, 50, 'other', 'big'), pool, 'g82', 'u1', '2026-12-01', AT)!;
      for (let i = 0; i < 6000; i++) ut = withClaim(ut, 'sbc:filler:' + i);
      const claims = ut.content!.claims!;
      expect(claims).toHaveLength(5000);
      expect(claims.slice(-3)).toEqual(['stamps-grant:5:minutes:day:1:30', 'stamps-grant:50:other:big', 'stamps:g82:50:u1']);
      // an older build appends after them and slices: still kept
      const old = legacyNormalizeContent({ claims: [...claims, ...Array.from({ length: 200 }, (_, i) => 'old:' + i)] })!;
      expect(old.claims!.filter((c) => c.startsWith('stamps'))).toHaveLength(3);
      // the normalizer re-pins them at the end
      expect(normalizeContent(old)!.claims!.slice(-3)).toEqual(claims.slice(-3));
      expect(stampsBalance({ content: normalizeContent(old) })).toBe(5);
    });

    it('survives the cloud snapshot and the file-backup check', () => {
      const values = new Map<string, string>();
      const storage = () => ({ getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v), removeItem: (k: string) => void values.delete(k) });
      vi.stubGlobal('localStorage', storage());
      try {
        const ut = recordPull(grantStamps(freshUt(), 5, 'minutes', 'day:1:30'), pack('g1', 'gold', packDefs(SPORT).gold.price, 'store'));
        const p = freshProfile();
        p.name = 'Stamps';
        p.ut = ut;
        values.set(PROFILE_KEYS.nba, JSON.stringify({ ...freshProfile(), name: 'Stamps' }));
        values.set(PROFILE_KEYS[SPORT], JSON.stringify(p));
        const snap = captureProgress(storage());
        expect(() => checkedSnapshot(snap)).not.toThrow();
        values.clear();
        applyProgress(storage(), snap);
        const back = migrateUt(JSON.parse(values.get(PROFILE_KEYS[SPORT])!).ut);
        expect(stampsBalance(back)).toBe(stampsBalance(ut));
        expect(back.content!.stamps).toEqual(ut.content!.stamps);
        const data: Record<string, string | null> = Object.fromEntries(RECOVERY_KEYS.filter((k) => !OPTIONAL_KEYS.includes(k)).map((k) => [k, null]));
        for (const [k, v] of values) data[k] = v;
        expect(validateSaveValues(data, 1).name).toBe('Stamps');
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('an old save without stamps loads exactly as before', () => {
      const raw = { daily: { day: '2026-11-10', streak: 3, total: 9 }, claims: ['a', 'b'], pulls: { since: 5, r: [{ id: 'g', k: 'gold', n: 'Gold Pack', c: 900, s: 'store', at: 5, u: 'pack:g:', cs: [[SPORT + ':season:x', 80, 'gold']] }], a: {} } };
      expect(normalizeContent(raw)).toEqual(legacyNormalizeContent(raw));
      expect(stampsBalance({ content: normalizeContent(raw) })).toBe(0);
    });
  });

  describe('Scout Stamps: light and fast (' + SPORT + ')', () => {
    it('scout-stamps.ts and packs-claimables.ts import none of the heavy modules', () => {
      const HEAVY = ['pool', 'packs', 'cards', 'sbc', 'rate', 'squad', 'content-packs', 'daily-hub', 'moments', 'inbox'];
      const seen = new Set<string>();
      const missing: string[] = [];
      const walk = (file: string) => {
        if (seen.has(file)) return;
        seen.add(file);
        const src = SOURCES[file];
        if (src === undefined) return void missing.push(file);
        for (const m of src.matchAll(/^\s*(import|export)\s+(type\s+)?[^'";]*?from\s+['"](\.[^'"]+)['"]/gm)) {
          if (m[2]) continue; // a type-only import is erased
          walk(norm(file.slice(0, file.lastIndexOf('/') + 1) + m[3]) + (m[3].endsWith('.ts') ? '' : '.ts'));
        }
      };
      walk('../scout-stamps.ts');
      walk('../packs-claimables.ts');
      expect(missing).toEqual([]);
      const names = [...seen].map((f) => f.replace(/^\.\.\//, '').replace(/\.ts$/, ''));
      expect(names.sort()).toEqual(['packs-claimables', 'scout-stamps']);
      expect(names.filter((n) => HEAVY.includes(n))).toEqual([]);
    });

    it('stampsBalance takes at most 1 ms on a full 300-pack log', () => {
      let ut: UtState = freshUt();
      const sp = specials.slice(0, 50);
      for (let i = 0; i < 320; i++) ut = recordPull(ut, pack('f' + i, 'gold', 900, 'store', AT + i, [sp[i % 50]], 4));
      for (let i = 0; i < 60; i++) ut = grantStamps(ut, 5, 'minutes', 'd' + i);
      for (let i = 0; i < 4000; i++) ut = withClaim(ut, 'sbc:f' + i);
      expect(ut.content!.pulls!.r).toHaveLength(300);
      const c = ut.content!;
      const runs = 200;
      // fresh objects every run, so the memo never answers (the cold cost)
      const copies = Array.from({ length: runs + 20 }, () => ({ content: { ...c, pulls: { ...c.pulls! }, claims: c.claims!.slice() } }));
      for (let i = 0; i < 20; i++) stampsBalance(copies[i]);
      const t0 = performance.now();
      for (let i = 20; i < runs + 20; i++) stampsBalance(copies[i]);
      const ms = (performance.now() - t0) / runs;
      console.log('stampsBalance (' + SPORT + '): ' + ms.toFixed(3) + ' ms per call on 300 packs and ' + c.claims!.length + ' claims');
      expect(ms).toBeLessThanOrEqual(1);
      expect(pullStampsFloor(c.pulls)).toBeGreaterThan(0);
    });
  });
}
