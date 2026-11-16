// Claude (studio overhaul, shell-1, 2026-11-10): the QA fixture injector writes only the app's own
// existing keys, only on localhost, only into empty storage; the serialized fixtures (when this
// machine holds them: PS_QA_FIXTURES) have the shapes the shell plan promises.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyFixture, FIXTURE_KEYS, fixtureAge, fixtureFile, loadFixture, PROFILES, SPORTS, summarize, weekOfDay } from './fixtures.mjs';
import { allowedUrl } from './browser.mjs';
import { RECOVERY_KEYS } from '../../src/lib/recovery';

class Store {
  constructor(init = {}) {
    this.m = new Map(Object.entries(init));
    this.writes = [];
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.writes.push(k);
    this.m.set(k, String(v));
  }
}
const profile = JSON.stringify({ v: 1, name: 'Fixture', coins: 10, rewardDay: '2026-01-01', ut: { owned: [] } });
const keys = { 'perfect-season:profile:v1': profile, 'perfect-season:sport': 'nba', 'perfect-season:key:v1': 'not-a-fixture-key', 'perfect-season:other': 'x' };

describe('fixture keys', () => {
  it('are exactly the app’s recovery keys without the signing key', () => {
    expect(FIXTURE_KEYS).toEqual(RECOVERY_KEYS.filter((k) => k !== 'perfect-season:key:v1'));
  });
});

describe('applyFixture', () => {
  it('writes only allowed keys on localhost, with today’s reward day and the caller’s name', () => {
    for (const hostname of ['localhost', '127.0.0.1']) {
      const s = new Store();
      expect(applyFixture({ keys, allowed: FIXTURE_KEYS, name: 'Edge QA', today: '2026-11-10' }, { location: { hostname }, localStorage: s })).toBe('written');
      expect(s.writes.sort()).toEqual(['perfect-season:profile:v1', 'perfect-season:sport']);
      expect(JSON.parse(s.getItem('perfect-season:profile:v1'))).toMatchObject({ name: 'Edge QA', rewardDay: '2026-11-10', coins: 10 });
    }
  });

  it('never writes off localhost', () => {
    for (const hostname of ['qemmhd.github.io', 'example.com', 'localhost.example.com', '192.168.1.2']) {
      const s = new Store();
      expect(applyFixture({ keys, allowed: FIXTURE_KEYS, name: null, today: null }, { location: { hostname }, localStorage: s })).toBe('skipped:host');
      expect(s.writes).toEqual([]);
    }
  });

  it('never overwrites a profile the app already saved (later reloads keep the app’s writes)', () => {
    const s = new Store({ 'perfect-season:profile:v1': '{"name":"mine"}' });
    expect(applyFixture({ keys, allowed: FIXTURE_KEYS, name: null, today: null }, { location: { hostname: 'localhost' }, localStorage: s })).toBe('skipped:present');
    expect(s.writes).toEqual([]);
  });

  it('survives storage that throws', () => {
    const s = {
      getItem() {
        throw Error('denied');
      },
    };
    expect(applyFixture({ keys, allowed: FIXTURE_KEYS, name: null, today: null }, { location: { hostname: 'localhost' }, localStorage: s })).toBe('skipped:storage');
  });
});

describe('isolation', () => {
  it('lets through only this machine, inline data and the font CDN', () => {
    const ok = ['http://localhost:5211/', 'http://127.0.0.1:7777/x', 'ws://localhost:7777', 'data:text/plain,a', 'blob:http://localhost:5211/1', 'https://fonts.googleapis.com/css2?family=Archivo', 'https://fonts.gstatic.com/s/a.woff2'];
    const no = ['https://example.com/', 'https://ryqaibujweiwwvdtswxj.supabase.co/rest/v1/x', 'wss://relay.damus.io', 'http://fonts.googleapis.com/css', 'https://localhost.example.com/', 'https://qemmhd.github.io/perfect-season/'];
    for (const u of ok) expect(allowedUrl(u), u).toBe(true);
    for (const u of no) expect(allowedUrl(u), u).toBe(false);
  });
});

// The serialized fixtures live in the overhaul scratchpad, not the repo; checked when present.
const have = (p, s) => !!process.env.PS_QA_FIXTURES && fs.existsSync(fixtureFile(p, s));
describe('serialized fixtures', () => {
  for (const sport of SPORTS)
    for (const p of PROFILES.filter((x) => x !== 'fresh'))
      it.skipIf(!have(p, sport))(`${p}/${sport} holds only fixture keys and the promised player`, () => {
        const f = loadFixture(p, sport);
        expect(Object.keys(f.keys).every((k) => FIXTURE_KEYS.includes(k))).toBe(true);
        const s = summarize(f.keys, sport);
        expect(s).toEqual(f.summary);
        if (p === 'heavy') {
          expect(s.owned).toBeGreaterThanOrEqual(1900);
          expect(s.owned).toBeLessThanOrEqual(2100);
          expect(s.levelledShare).toBeGreaterThanOrEqual(0.3);
          expect(s.evolved).toBeGreaterThanOrEqual(50);
          expect(s.pullLogPacks).toBe(300);
          expect(s.hq).toMatchObject({ seasons: 1, presets: 3, developmentActive: true, circuitActive: true, circuitHistory: 6, moments: 5 });
          expect(s.hq.developmentDone).toBeGreaterThan(0);
          expect([s.coins, s.xp]).toEqual([59672, 6530]);
        }
        if (p === 'utNoStarter') expect([s.owned, s.starterClaimed]).toEqual([0, false]);
        if (p === 'checkpoint') expect(s.checkpoint).toBe(true);
        if (p === 'standard') expect([s.starterClaimed, s.checkpoint, s.owned > 30]).toEqual([true, false, true]);
      });
});

// Claude (shell-1 fix, 2026-11-16): a serialized fixture carries week-bound state, so its age is reported.
describe('fixture age', () => {
  it('names app weeks the way src/ut/sbc.ts weekOf does (ISO, Monday start)', () => {
    expect(['2026-11-10', '2026-11-15', '2026-11-16', '2026-01-01', '2027-01-01', '2025-12-29'].map(weekOfDay)).toEqual(['2026-W46', '2026-W46', '2026-W47', '2026-W01', '2026-W53', '2026-W01']);
  });
  it('is stale after 6 days or when the app week changes', () => {
    const made = '2026-11-10T15:00:00.000Z';
    expect(fixtureAge(made, new Date('2026-11-12T15:00:00Z'))).toEqual({ days: 2, madeWeek: '2026-W46', nowWeek: '2026-W46', weekChanged: false, stale: false });
    // the reviewed case: made Tuesday Nov 10, read Monday Nov 16 (a new week, 6 days later)
    expect(fixtureAge(made, new Date('2026-11-16T15:00:00Z'))).toMatchObject({ days: 6, weekChanged: true, stale: true });
    // same week but Sunday night Eastern vs Monday UTC: the Eastern day decides
    expect(fixtureAge('2026-11-16T02:00:00Z', new Date('2026-11-16T03:30:00Z')).weekChanged).toBe(false);
    // Monday 00:30 to Sunday 23:30 Eastern: the same week, but almost 7 days old
    expect(fixtureAge('2026-11-09T05:30:00Z', new Date('2026-11-16T04:30:00Z'))).toMatchObject({ days: 7, weekChanged: false, stale: true });
    expect(fixtureAge('not a date').stale).toBe(true);
  });
});
