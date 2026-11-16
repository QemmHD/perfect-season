// Claude, 2026-11-10 (studio overhaul, team ut): old saves survive this branch. Each fixture is a live
// (acdf3e2) save with every field family (scripts/compat/build-fixtures.ts builds it with the old
// tree). Loading it, saving it, reloading it and syncing it through the encrypted cloud snapshot
// must keep every coin, card, level, XP, squad, streak, receipt and season. The soccer run imports
// this file from soccer-studio-compat.test.ts; the mixed old/new client round trip is
// scripts/compat/old-client.ts.
import { describe, expect, it } from 'vitest';
import { SPORT, type SportId } from '../engine/sport';
import { applyProgress, captureProgress, decryptProgress, encryptProgress } from '../lib/cloud-data';
import { loadProfile, saveProfile, type Profile } from '../lib/profile';
import nbaSave from './compat/acdf3e2-nba.json';
import nflSave from './compat/acdf3e2-nfl.json';
import soccerSave from './compat/acdf3e2-soccer.json';
import { atoms, changedFamilies, lostAtoms, presentFamilies, PROFILE_FAMILIES, UT_FAMILIES, type SaveLike } from './compat/expect-preserved';
import { MemoryStorage, useStorage } from './compat/memory-storage';
import { migrateUt } from './state';

interface Fixture {
  sport: string;
  source: string;
  storage: Record<string, Record<string, unknown>>;
}
const FIXTURES: Record<SportId, Fixture> = { nba: nbaSave, nfl: nflSave, soccer: soccerSave } as unknown as Record<SportId, Fixture>;
const SHARED_KEY = 'perfect-season:profile:v1';
const OWN_KEY: Record<SportId, string> = { nba: SHARED_KEY, nfl: 'perfect-season:profile:nfl:v1', soccer: 'perfect-season:profile:soccer:v1' };
const SHARED = ['coins', 'xp', 'inventory', 'settings', 'name', 'streak', 'rewardDay', 'botLevel', 'gifts'];

/** The profile a phone holds for `sport`: its own key, with the shared wallet from the basketball key. */
function heldProfile(f: Fixture, sport: SportId): SaveLike {
  const own = f.storage[OWN_KEY[sport]];
  const shared = f.storage[SHARED_KEY];
  return { ...own, ...Object.fromEntries(SHARED.map((k) => [k, shared[k]])) } as unknown as SaveLike;
}
/** Families each sport's live build can hold: soccer has no Club Season; formation is soccer's. */
const expectedFamilies = (sport: SportId) => UT_FAMILIES.filter((f) => (f === 'league' ? sport !== 'soccer' : f === 'formation' ? sport === 'soccer' : true));

describe('the acdf3e2 fixtures cover every field family', () => {
  for (const sport of ['nba', 'nfl', 'soccer'] as SportId[]) {
    const f = FIXTURES[sport];
    const held = heldProfile(f, sport);
    it(sport + ': every ut family and every profile family is present, with real progress in it', () => {
      expect(f.sport).toBe(sport);
      expect(f.source).toBe('acdf3e2');
      expect(presentFamilies(held.ut, UT_FAMILIES)).toEqual(expectedFamilies(sport));
      expect(presentFamilies(held, PROFILE_FAMILIES)).toEqual([...PROFILE_FAMILIES]);
      const ut = held.ut;
      expect(ut.owned.some((c) => c.mint && c.level > 1 && c.xp > 0)).toBe(true);
      expect(ut.duplicateStorage?.length).toBeGreaterThan(0);
      expect(Object.keys(ut.squad).length).toBeGreaterThanOrEqual(5);
      expect(ut.packs.some((p) => p.voucher)).toBe(true);
      expect(ut.hq!.claims.length).toBeGreaterThan(0);
      expect(ut.hq!.journal.length).toBeGreaterThan(0);
      expect(Object.values(ut.hq!.seasons).some((s) => s.claimed.length > 0)).toBe(true);
      expect(ut.hq!.circuit.active).toBeTruthy();
      expect(ut.content!.claims!.length).toBeGreaterThan(0);
      expect(ut.content!.draft!.active).toBeTruthy();
      expect(ut.cup!.active && ut.cup!.claims.length).toBeTruthy();
      expect(ut.rivals!.claimed.length).toBeGreaterThan(0);
      if (sport !== 'soccer') expect(ut.league!.active.teams[0].w + ut.league!.active.teams[0].l).toBe(2);
      expect(atoms(held).length).toBeGreaterThan(80);
    });
    it(sport + ': migrateUt (load) keeps every family exactly, and is stable on a second pass', () => {
      const once = migrateUt(JSON.parse(JSON.stringify(held.ut)));
      expect(changedFamilies(held.ut, once, UT_FAMILIES)).toEqual([]);
      const twice = migrateUt(JSON.parse(JSON.stringify(once)));
      expect(changedFamilies(once, twice, UT_FAMILIES)).toEqual([]);
      expect(lostAtoms(held, { ...held, ut: twice })).toEqual([]);
    });
  }
});

describe('the checker itself', () => {
  it('names exactly what a lossy load would drop', () => {
    const held = heldProfile(FIXTURES[SPORT], SPORT);
    const ut = structuredClone(held.ut);
    const claim = ut.hq!.claims.pop()!;
    ut.owned[0] = { ...ut.owned[0], level: 1 };
    ut.content!.claims = ut.content!.claims!.slice(1);
    const lossy = { ...held, coins: (held.coins ?? 0) - 1, ut };
    const lost = lostAtoms(held, lossy);
    expect(lost).toContain('hq.claim:' + claim);
    expect(lost).toContain('content.claim:' + held.ut.content!.claims![0]);
    expect(lost).toContain('coins:' + held.coins);
    expect(lost.filter((a) => a.startsWith('owned:'))).toHaveLength(1);
    expect(changedFamilies(held.ut, ut, UT_FAMILIES)).toEqual(['owned', 'hq.claims', 'content.claims']);
  });
});

describe('a live ' + SPORT + ' save through this build: load, save, reload, cloud sync', () => {
  const f = FIXTURES[SPORT];
  const held = heldProfile(f, SPORT);
  const fresh = () => useStorage(new MemoryStorage(f.storage));

  it('loads with every family and atom intact', () => {
    fresh();
    const p = loadProfile() as unknown as SaveLike;
    expect(changedFamilies(held, p, PROFILE_FAMILIES)).toEqual([]);
    expect(changedFamilies(held.ut, p.ut, UT_FAMILIES)).toEqual([]);
    expect(lostAtoms(held, p)).toEqual([]);
  });
  it('saves and reloads without losing anything, and leaves the other sports keys alone', () => {
    const s = fresh();
    const before = s.dump();
    const p = loadProfile();
    saveProfile(p);
    const back = loadProfile() as unknown as SaveLike;
    expect(lostAtoms(held, back)).toEqual([]);
    expect(changedFamilies(held.ut, back.ut, UT_FAMILIES)).toEqual([]);
    const after = s.dump();
    for (const k of Object.keys(before)) if (k !== OWN_KEY[SPORT] && k !== SHARED_KEY) expect(after[k], k).toEqual(before[k]);
    // the basketball key still holds basketball's own part when another sport saves
    if (SPORT !== 'nba') expect((after[SHARED_KEY] as Profile).ut).toEqual((before[SHARED_KEY] as Profile).ut);
  });
  it('survives the encrypted cloud snapshot and restore onto an empty phone', async () => {
    const s = fresh();
    const snap = captureProgress(s);
    const secret = '11'.repeat(32);
    const restored = await decryptProgress(await encryptProgress(snap, secret, 'inspect', 'studio-compat'), secret, 'inspect', 'studio-compat');
    s.clear();
    applyProgress(s, restored);
    const p = loadProfile() as unknown as SaveLike;
    expect(lostAtoms(held, p)).toEqual([]);
    expect(changedFamilies(held.ut, p.ut, UT_FAMILIES)).toEqual([]);
  });
});
