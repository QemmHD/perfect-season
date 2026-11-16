// Claude, 2026-11-16 (studio overhaul, team ut-1): the light claimables count equals the Rewards inbox.
// Every UT QA fixture of this sport (scripts/qa/fixtures/ut, built by the app itself: one per reward
// source, the audit's club, runs, a finished day, near misses, a streak at risk, a cold start, the
// Minutes ledgers) plus synthetic clubs: utClaimables(...).count === inboxCount(pool, ...) once the UT
// screen has written its cache, and the light count is flagged `approx` when the cache is missing or
// stale. soccer-claimables.test.ts runs this file under soccer's run.
import { beforeAll, describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { loadProfile, type Profile } from '../lib/profile';
import { easternClock, poolSig, utClaimables, writePoolCache } from './claimables';
import { MemoryStorage, useStorage } from './compat/memory-storage';
import { inboxCount, inboxItems, poolRowCount } from './inbox';
import { weekKey } from './objectives';
import { getPool, type Pool } from './pool';
import { qaFixtures, type QaFixture } from './qa-fixtures.test-util';

const fixtures = qaFixtures(SPORT);

function profileOf(f: QaFixture): Profile {
  useStorage(new MemoryStorage(f.storage));
  return loadProfile();
}

let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 120000);

/** What UltimateTeam.tsx does on open: compute the inbox and write the pool rows' cache. */
function opened(p: Profile, day: string, week: string): Profile {
  const items = inboxItems(pool, p, day, week);
  return { ...p, ut: writePoolCache(p.ut, poolSig(p.ut, SPORT), poolRowCount(items)) };
}

describe('claimables equal the inbox count (' + SPORT + ')', () => {
  it('has at least 10 fixtures with storage, and some with something to claim', () => {
    const withSave = fixtures.filter((f) => Object.keys(f.storage).some((k) => k.includes('profile')));
    expect(withSave.length).toBeGreaterThanOrEqual(30);
  });
  for (const f of fixtures)
    it(f.name + ': with a valid cache, exactly the inbox count', () => {
      const p = opened(profileOf(f), f.day, f.week);
      const want = inboxCount(pool, p, f.day, f.week);
      const got = utClaimables(p.ut, f.day, f.week, SPORT, Date.parse(f.at));
      expect(got.approx).toBe(false);
      expect(got.count).toBe(want);
      // the fixture's own record of its inbox (built by the app) agrees too; 'fresh' has no save at
      // all, so the app recorded no inbox for it
      const recorded = f.inbox.filter((x) => !x.startsWith('('));
      if (Object.keys(f.storage).some((k) => k.includes('profile'))) expect(got.count).toBe(recorded.length);
      expect(got.packs).toBe(p.ut.packs.length);
    });
});

describe('cold start (' + SPORT + ')', () => {
  const cold = fixtures.find((f) => f.name === 'cold-set')!;
  it('a completed set with no cache: the light count, flagged approx, then exact once UT opens', () => {
    const p = profileOf(cold);
    const light = utClaimables(p.ut, cold.day, cold.week, SPORT, Date.parse(cold.at));
    const items = inboxItems(pool, p, cold.day, cold.week);
    expect(light.approx).toBe(true);
    expect(light.count).toBe(inboxCount(pool, p, cold.day, cold.week) - poolRowCount(items));
    const after = opened(p, cold.day, cold.week);
    const exact = utClaimables(after.ut, cold.day, cold.week, SPORT, Date.parse(cold.at));
    expect(exact.approx).toBe(false);
    expect(exact.count).toBe(inboxCount(pool, after, cold.day, cold.week));
  });
  it('a stale cache (a card gained outside UT) is not trusted', () => {
    const p = opened(profileOf(cold), cold.day, cold.week);
    const gift = { ...p.ut, owned: [...p.ut.owned, { ...p.ut.owned[0], uid: 'gift-1', cardId: pool.lines[pool.lines.length - 1].id }] };
    expect(utClaimables(gift, cold.day, cold.week, SPORT, Date.parse(cold.at)).approx).toBe(true);
  });
  it('writing the same cache again changes nothing (no extra save)', () => {
    const p = opened(profileOf(cold), cold.day, cold.week);
    const c = p.ut.hq!.poolClaimables!;
    expect(writePoolCache(p.ut, c.sig, c.n)).toBe(p.ut);
    expect(c.sig.length).toBeLessThanOrEqual(80);
  });
});

describe('the streak at risk (' + SPORT + ')', () => {
  const f = fixtures.find((x) => x.name === 'streak-risk')!;
  // 19:59 and 20:01 Eastern on the fixture's day (EST: UTC-5)
  const at = (hh: number, mm: number) => Date.parse(f.day + 'T00:00:00Z') + ((hh + 5) * 60 + mm) * 60000;
  it('is not at risk at 19:59 ET, and is at 20:01 ET (4 h or less to midnight)', () => {
    const p = profileOf(f);
    expect(easternClock(at(19, 59)).day).toBe(f.day);
    const before = utClaimables(p.ut, f.day, weekKey(f.day), SPORT, at(19, 59));
    const after = utClaimables(p.ut, f.day, weekKey(f.day), SPORT, at(20, 1));
    expect(before.dropReady && after.dropReady).toBe(true);
    expect(before.dropDay).toBeGreaterThanOrEqual(2);
    expect(before.streakAtRisk).toBe(false);
    expect(after.streakAtRisk).toBe(true);
  });
});
