// Claude, 2026-11-16 (studio overhaul, team ut; V2 E.3, plan §2 and W3): the MINUTES ledger and the two
// healthy-play settings in the profile. Old saves load untouched (no new key appears), the ledger lives
// in the basketball key for every sport (SHARED), and the cloud apply path merges it instead of
// replacing it. The soccer run imports this file from soccer-playtime.test.ts; the byte-for-byte
// comparison with the live (acdf3e2) client is scripts/compat/old-client.ts.
import { describe, expect, it } from 'vitest';
import { SPORT, type SportId } from '../engine/sport';
import nbaSave from '../ut/compat/acdf3e2-nba.json';
import nflSave from '../ut/compat/acdf3e2-nfl.json';
import soccerSave from '../ut/compat/acdf3e2-soccer.json';
import { changedFamilies, lostAtoms, PROFILE_FAMILIES, type SaveLike } from '../ut/compat/expect-preserved';
import { MemoryStorage, useStorage } from '../ut/compat/memory-storage';
import { applyProgress, captureProgress, mergePlaytime, withDeviceLedger } from './cloud-data';
import { credit, type Playtime } from './playtime';
import { loadProfile, saveProfile } from './profile';

const FIXTURES = { nba: nbaSave, nfl: nflSave, soccer: soccerSave } as unknown as Record<SportId, { storage: Record<string, Record<string, unknown>> }>;
const SHARED_KEY = 'perfect-season:profile:v1';
const OWN_KEY: Record<SportId, string> = { nba: SHARED_KEY, nfl: 'perfect-season:profile:nfl:v1', soccer: 'perfect-season:profile:soccer:v1' };
const MON = Date.parse('2026-11-16T15:00:00Z');
const DAY = 86400_000;
const ledger = (min: number, at = MON, sport: SportId = 'nba'): Playtime => credit(undefined, { sec: min * 60, menu: 0, raw: min * 90, sport, act: 3 }, at);
const storage = (extra: Record<string, unknown> = {}) => {
  const st = structuredClone(FIXTURES[SPORT].storage);
  Object.assign(st[SHARED_KEY], extra);
  return useStorage(new MemoryStorage(st));
};

describe('an old (acdf3e2) save in this build', () => {
  it('loads with playtime undefined and no new settings keys; every family and atom kept', () => {
    const s = storage();
    const before = s.dump();
    const p = loadProfile();
    expect('playtime' in p).toBe(false);
    expect(Object.keys(p.settings).sort()).toEqual(Object.keys((before[SHARED_KEY] as { settings: object }).settings).sort());
    const shared = before[SHARED_KEY] as Record<string, unknown>;
    const held = { ...(before[OWN_KEY[SPORT]] as object), ...Object.fromEntries(['coins', 'xp', 'inventory', 'settings', 'name', 'streak', 'rewardDay', 'botLevel', 'gifts'].map((k) => [k, shared[k]])) } as SaveLike;
    expect(lostAtoms(held, p as unknown as SaveLike)).toEqual([]);
    expect(changedFamilies(p, loadProfile(), PROFILE_FAMILIES)).toEqual([]);
  });
  it('saves back with no playtime and no new settings key in any profile key', () => {
    const s = storage();
    saveProfile(loadProfile());
    for (const k of Object.values(OWN_KEY)) {
      const raw = JSON.stringify(s.dump()[k] ?? null);
      expect(raw).not.toContain('"playtime"');
      expect(raw).not.toContain('hideBoards');
      expect(raw).not.toContain('breakReminder');
    }
  });
});

describe('the ledger and settings are shared across the three sports', () => {
  it('a ledger in the basketball key loads in ' + SPORT + ' and saves back there only', () => {
    const pt = ledger(27);
    const s = storage({ playtime: pt, settings: { sound: true, haptics: false, hints: true, hideBoards: true, breakReminder: false } });
    const p = loadProfile();
    expect(p.playtime).toEqual(pt);
    expect(p.settings).toMatchObject({ haptics: false, hideBoards: true, breakReminder: false });
    const more = credit(p.playtime, { sec: 300, menu: 0, raw: 300, sport: SPORT, act: 1 }, MON + 1000);
    saveProfile({ ...p, playtime: more });
    const d = s.dump();
    expect((d[SHARED_KEY] as { playtime: Playtime }).playtime).toEqual(more);
    if (SPORT !== 'nba') expect('playtime' in (d[OWN_KEY[SPORT]] as object)).toBe(false);
    expect(loadProfile().playtime).toEqual(more);
    expect(loadProfile().settings).toMatchObject({ hideBoards: true, breakReminder: false });
  });
});

describe('cloud apply path: mergePlaytime', () => {
  it('max of every count on the same day, union of claims, newer league, union of owed receipts', () => {
    const a: Playtime = { ...ledger(40), claimed: { day: [0, 1, 2], week: [], life: [], dayKey: '2026-11-16', weekKey: '2026-W47' }, owed: ['stamp:day:2026-11-16:30:0'] };
    const b: Playtime = {
      ...ledger(25, MON, 'nfl'),
      claimed: { day: [0, 1], week: [], life: [], dayKey: '2026-11-16', weekKey: '2026-W47' },
      league: { tier: 2, season: 'S1', best: 2, lastWeek: { week: '2026-W46', rank: 3, am: 200, moved: 1 } },
      owed: ['pick:life:life:1500'],
    };
    const m = mergePlaytime(a, b)!;
    expect(m.daySec).toBe(2400);
    expect(m.weekDays[0]).toBe(2400);
    expect(m.life).toBe(2400);
    expect(m.bySport).toEqual({ nba: 2400, nfl: 1500, soccer: 0 });
    expect(m.claimed.day).toEqual([0, 1, 2]);
    expect(m.league.tier).toBe(2);
    expect(m.owed!.sort()).toEqual(['pick:life:life:1500', 'stamp:day:2026-11-16:30:0']);
    const r = mergePlaytime(b, a)!;
    expect([r.daySec, r.life, r.claimed.day, r.league.tier]).toEqual([m.daySec, m.life, m.claimed.day, m.league.tier]);
  });
  it('the newer league compares like with like: weeks when both have one, else season numbers', () => {
    const lg = (season: string, week?: string, tier = 1): Playtime => ({ ...ledger(10), league: { tier, season, best: tier, ...(week ? { lastWeek: { week, rank: 1, am: 0, moved: 0 as const } } : {}) } });
    // a season string alone must not beat a real week of a later season ('2' sorts before 'S')
    for (const [x, y] of [[lg('S1'), lg('S2', '2026-W53', 4)], [lg('S2', '2026-W53', 4), lg('S1')]] as const) expect(mergePlaytime(x, y)!.league.tier).toBe(4);
    // a later season with no finished week yet beats an earlier season's week
    expect(mergePlaytime(lg('S3', undefined, 5), lg('S2', '2027-W02', 2))!.league.tier).toBe(5);
    expect(mergePlaytime(lg('S2', '2027-W02', 2), lg('S3', undefined, 5))!.league.tier).toBe(5);
    // same season: the ledger that has finished a week is newer; two weeks compare as weeks
    expect(mergePlaytime(lg('S2', undefined, 1), lg('S2', '2026-W50', 3))!.league.tier).toBe(3);
    expect(mergePlaytime(lg('S2', '2026-W51', 2), lg('S2', '2026-W50', 3))!.league.tier).toBe(2);
  });
  it('different days: the later day’s counts and claims, the week per weekday, the lifetime max', () => {
    const mon = ledger(50);
    const tue = { ...credit(ledger(10), { sec: 1200, menu: 0, raw: 1200, sport: 'nba', act: 1 }, MON + DAY), claimed: { day: [0, 1], week: [], life: [], dayKey: '2026-11-17', weekKey: '2026-W47' } };
    const m = mergePlaytime(mon, tue)!;
    expect(m.day).toBe('2026-11-17');
    expect(m.daySec).toBe(1200);
    expect(m.weekDays.slice(0, 2)).toEqual([3000, 1200]);
    expect(m.claimed.day).toEqual([0, 1]);
    expect(m.life).toBe(3000);
    // a new week on one phone: its week wins whole
    const next = credit(undefined, { sec: 600, menu: 0, raw: 600, sport: 'nba', act: 1 }, MON + 7 * DAY);
    const w = mergePlaytime(mon, next)!;
    expect([w.week, w.weekDays]).toEqual(['2026-W48', [600, 0, 0, 0, 0, 0, 0]]);
  });
  it('hook state merges by the same rule (numbers max, lists union, keys newest)', () => {
    const a = { ...ledger(1), hook: { drops: 2, road: ['l5'], day: '2026-11-16' } };
    const b = { ...ledger(1), hook: { drops: 3, road: ['l6'], hot: 1 } };
    expect(mergePlaytime(a, b)!.hook).toEqual({ drops: 3, road: ['l5', 'l6'], day: '2026-11-16', hot: 1 });
  });
  it('a server save applied over this phone keeps the phone’s minutes and claims; the rest is the server’s', () => {
    const phone = storage({ playtime: { ...ledger(70), claimed: { day: [0, 1, 2, 3], week: [0], life: [0], dayKey: '2026-11-16', weekKey: '2026-W47' } }, coins: 999 });
    const server = new MemoryStorage(structuredClone(FIXTURES[SPORT].storage));
    const sp = JSON.parse(server.getItem(SHARED_KEY)!);
    server.setItem(SHARED_KEY, JSON.stringify({ ...sp, coins: 5, playtime: { ...ledger(20), claimed: { day: [0, 1], week: [], life: [], dayKey: '2026-11-16', weekKey: '2026-W47' } } }));
    applyProgress(phone, captureProgress(server));
    const after = JSON.parse(phone.getItem(SHARED_KEY)!);
    expect(after.coins).toBe(5);
    expect(after.playtime.daySec).toBe(4200);
    expect(after.playtime.claimed.day).toEqual([0, 1, 2, 3]);
    expect(after.playtime.claimed.week).toEqual([0]);
  });
  it('a server save without a ledger is applied byte for byte when the phone has none either; the phone’s ledger survives one', () => {
    const snap = captureProgress(new MemoryStorage(structuredClone(FIXTURES[SPORT].storage)));
    const raw = snap.values[SHARED_KEY]!;
    expect(withDeviceLedger(raw, JSON.stringify({ v: 1 }))).toBe(raw);
    expect(withDeviceLedger(raw, null)).toBe(raw);
    const pt = ledger(33);
    expect(JSON.parse(withDeviceLedger(raw, JSON.stringify({ playtime: pt }))!).playtime).toEqual(pt);
    const empty = useStorage(new MemoryStorage({}));
    applyProgress(empty, snap);
    expect(empty.getItem(SHARED_KEY)).toBe(raw);
  });
});
