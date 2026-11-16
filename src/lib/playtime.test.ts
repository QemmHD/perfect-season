// Claude, 2026-11-16 (studio overhaul, team ut; V2 E.1, E.2, E.8): one named test per MINUTES rule.
// The ticker runs against a fake page (visibility, focus, input events, BroadcastChannel, storage) on
// fake timers, so a 5-minute match takes milliseconds; the pure ledger is tested directly.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { easternDateKey } from '../engine/season';
import { weekKey } from '../net/leaderboard';
import type { Profile } from './profile';

type Fn = (e: unknown) => void;
const T0 = Date.parse('2026-11-16T15:00:00Z'); // Monday, 10:00 ET
/** The real clock, kept before the fake page replaces `performance`. */
const realPerf = performance;
const realNow = () => realPerf.now();

/** One fake browser shared by every "tab" (module instance) of a test. */
function fakePage(opts: { locks?: boolean } = {}) {
  const listeners = new Map<string, Fn[]>();
  const store = new Map<string, string>();
  const page = {
    visibilityState: 'visible',
    focused: true,
    hasFocus: () => page.focused,
    addEventListener(type: string, fn: Fn) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    fire(type: string, e: Record<string, unknown> = {}) {
      for (const fn of listeners.get(type) ?? []) fn({ type, ...e });
    },
    store,
    /** the Web Lock: who holds it (released when the holder's promise settles) */
    lock: null as object | null,
  };
  vi.stubGlobal('document', page);
  vi.stubGlobal('addEventListener', (type: string, fn: Fn) => page.addEventListener(type, fn));
  vi.stubGlobal('performance', { now: () => Date.now() });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  // navigator.locks.request(name, { ifAvailable }, cb), answering at once (the real one answers a moment later)
  const locks = {
    request(_name: string, _o: unknown, cb: (l: object | null) => Promise<void> | undefined) {
      if (page.lock) return Promise.resolve(cb(null));
      const me = {};
      page.lock = me;
      return Promise.resolve(cb(me)).finally(() => {
        if (page.lock === me) page.lock = null;
      });
    },
  };
  vi.stubGlobal('navigator', opts.locks === false ? {} : { locks });
  return page;
}

function blankProfile(extra: Partial<Profile> = {}): Profile {
  return { coins: 0, stats: { games: 3 }, history: [], ut: { record: { w: 1, l: 0, h2hW: 0, h2hL: 0 } }, ...extra } as unknown as Profile;
}

type PT = typeof import('./playtime');
/** A tab: a fresh instance of the module with its own profile sink. `relaunch`: the old page is gone. */
async function tab(profile = blankProfile(), relaunch = false) {
  if (relaunch) {
    // the old page's interval goes with it (clearAllTimers also rewinds the fake clock: keep the time)
    const now = Date.now();
    vi.clearAllTimers();
    vi.setSystemTime(now);
    page.lock = null;
  }
  vi.resetModules();
  const m: PT = await import('./playtime');
  const t = { m, profile, writes: 0 };
  m.registerPlaytimeSink(
    (fn) => {
      t.writes++;
      t.profile = fn(t.profile);
    },
    () => t.profile.playtime,
  );
  return t;
}

let page: ReturnType<typeof fakePage>;
let spot = 0;
/** A real thumb: taps that move around the screen. */
const tap = (x = 60 + ((spot++ * 37) % 260), y = 400 + ((spot * 53) % 300)) => page.fire('pointerdown', { clientX: x, clientY: y });
/** Run the clock second by second, tapping every `every` s (0 = never). */
function play(sec: number, every = 2, at?: () => void) {
  for (let s = 0; s < sec; s++) {
    if (every && s % every === 0) (at ?? tap)();
    vi.advanceTimersByTime(1000);
  }
}
const pt = (t: { profile: Profile }) => t.profile.playtime!;
type Tab = Awaited<ReturnType<typeof tab>>;
/** A whole match on screen: enter, play, bank (or not), leave. */
function match(t: Tab, id: string, sec: number, every = 2, how: 'complete' | 'forfeit' | null = 'complete', at?: () => void) {
  const off = t.m.enterPlaytime('match', ACT(id));
  play(sec, every, at);
  if (how) t.m.bankActivity(id, how);
  off();
}
/** A screen for `sec` seconds, then left. */
function screen(t: Tab, ctx: Parameters<PT['enterPlaytime']>[0], sec: number, every = 0, act?: Parameters<PT['enterPlaytime']>[1]) {
  const off = t.m.enterPlaytime(ctx, act);
  play(sec, every);
  off();
}
const ACT = (id = 'ut:1') => ({ id, sport: 'nba' as const, kind: 'match' as const });

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
  page = fakePage();
  spot = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('E.1.1 visible and focused only', () => {
  it('a hidden page or an unfocused window counts nothing, raw included', async () => {
    const t = await tab();
    const off = t.m.enterPlaytime('match', ACT());
    page.visibilityState = 'hidden';
    play(60);
    page.visibilityState = 'visible';
    page.focused = false;
    play(60);
    t.m.bankActivity('ut:1', 'complete');
    off();
    expect(pt(t).daySec).toBe(0);
    expect(pt(t).rawDaySec).toBe(0);
  });
  it('a page that comes back after a long sleep does not count the gap', async () => {
    const t = await tab();
    const off = t.m.enterPlaytime('match', ACT());
    play(30);
    vi.setSystemTime(Date.now() + 3600_000); // the phone slept for an hour with the app open
    play(30);
    t.m.bankActivity('ut:1', 'complete');
    off();
    // after waking, the clock needs fresh varied input again (a few seconds), and the hour is not counted
    expect(pt(t).daySec).toBeGreaterThanOrEqual(52);
    expect(pt(t).daySec).toBeLessThanOrEqual(62);
  });
});

describe('E.1.2 only one tab ticks', () => {
  for (const locks of [true, false])
    it('two tabs open on one phone count one tab of time (' + (locks ? 'Web Lock' : 'storage lock fallback') + ')', async () => {
      page = fakePage({ locks });
      const a = await tab(),
        b = await tab();
      a.m.enterPlaytime('match', ACT('ut:a'));
      b.m.enterPlaytime('match', ACT('ut:b'));
      play(300);
      a.m.bankActivity('ut:a', 'complete');
      b.m.bankActivity('ut:b', 'complete');
      const total = (a.profile.playtime?.daySec ?? 0) + (b.profile.playtime?.daySec ?? 0);
      expect(total).toBeGreaterThanOrEqual(295);
      expect(total).toBeLessThanOrEqual(305);
    });
});

describe('E.1.3 input windows per context', () => {
  it('match: counting stops 45 s after the last input (Auto-defend alone never counts)', async () => {
    const t = await tab();
    const off = t.m.enterPlaytime('match', ACT());
    play(60); // played with the thumb for a minute
    play(120, 0); // then let Auto-defend run for two
    t.m.bankActivity('ut:1', 'complete');
    off();
    expect(pt(t).daySec).toBeGreaterThanOrEqual(103);
    expect(pt(t).daySec).toBeLessThanOrEqual(107);
  });
  it('match with no input at all counts nothing (but completes)', async () => {
    const t = await tab();
    match(t, 'ut:1', 300, 0);
    expect(pt(t).daySec).toBe(0);
    expect(pt(t).acts).toBe(1);
  });
  it('draft: 30 s after the last input', async () => {
    const t = await tab();
    const draft = { id: 'draft:1', sport: 'nba' as const, kind: 'draft' as const };
    const off = t.m.enterPlaytime('draft', draft);
    play(10, 1);
    play(100, 0);
    t.m.bankActivity('draft:1', 'complete');
    off();
    expect(Math.abs(pt(t).daySec - 40)).toBeLessThanOrEqual(2);
  });
  it('menus: 20 s after the last input', async () => {
    const t = await tab();
    match(t, 'ut:1', 1200);
    const before = pt(t).daySec;
    const off = t.m.enterPlaytime('menu');
    tap();
    play(90, 0);
    off();
    match(t, 'ut:2', 10);
    expect(Math.abs(pt(t).dayMenuSec - 20)).toBeLessThanOrEqual(2);
    expect(Math.abs(pt(t).daySec - before - 30)).toBeLessThanOrEqual(3);
  });
  it('a SIM counts its real elapsed time: a 4 s sim counts 4 s', async () => {
    const t = await tab();
    const off = t.m.enterPlaytime('sim', ACT());
    play(4, 0);
    t.m.bankActivity('ut:1', 'complete');
    off();
    expect(pt(t).daySec).toBe(4);
  });
  it('a draft season sim counts at most 3 minutes a run', async () => {
    const t = await tab();
    const off = t.m.enterPlaytime('draftSim', { id: 'draft:7', sport: 'nba', kind: 'draft' });
    play(400, 0);
    t.m.bankActivity('draft:7', 'complete');
    off();
    expect(pt(t).daySec).toBe(180);
  });
  it('replays and reward screens count at most 2 minutes a match; a queue at most 2 minutes', async () => {
    const t = await tab();
    match(t, 'ut:1', 1800);
    const after = pt(t).daySec;
    screen(t, 'replay', 400, 0, ACT('ut:1'));
    screen(t, 'queue', 400);
    match(t, 'ut:2', 5);
    expect(pt(t).daySec - after - 5).toBeGreaterThanOrEqual(238);
    expect(pt(t).daySec - after - 5).toBeLessThanOrEqual(242);
  });
  it('a paused match counts nothing (setPlaytimePaused)', async () => {
    const t = await tab();
    t.m.setPlaytimePaused(true);
    match(t, 'ut:1', 60);
    t.m.setPlaytimePaused(false);
    expect(pt(t).daySec).toBe(0);
  });
  it('a finished match’s screen counts nothing more until the screen changes', async () => {
    const t = await tab();
    const off = t.m.enterPlaytime('match', ACT());
    play(60);
    t.m.bankActivity('ut:1', 'complete');
    play(60);
    off();
    screen(t, 'menu', 61, 5);
    expect(pt(t).daySec).toBeLessThanOrEqual(60 + 20);
    expect(pt(t).dayMenuSec).toBeLessThanOrEqual(20);
  });
});

describe('E.1.5 input variety', () => {
  it('a taped thumb (every input on one spot) stops the clock', async () => {
    const t = await tab();
    match(t, 'ut:1', 300, 2, 'complete', () => tap(200, 500));
    expect(pt(t).daySec).toBeLessThan(25);
  });
  it('an auto-tapper jittering within 8 px stops the clock', async () => {
    const t = await tab();
    match(t, 'ut:1', 300, 1, 'complete', () => tap(200 + (spot++ % 5), 500 + (spot % 4)));
    expect(pt(t).daySec).toBeLessThan(25);
  });
  it('fewer than 6 inputs a minute stops the clock', async () => {
    const t = await tab();
    match(t, 'ut:1', 300, 15);
    expect(pt(t).daySec).toBeLessThan(80);
  });
  it('a joystick drag counts as varied input', async () => {
    const t = await tab();
    const off = t.m.enterPlaytime('match', ACT());
    tap();
    for (let s = 0; s < 300; s++) {
      page.fire('pointermove', { clientX: 100 + (s % 40) * 3, clientY: 600 });
      vi.advanceTimersByTime(1000);
    }
    t.m.bankActivity('ut:1', 'complete');
    off();
    expect(pt(t).daySec).toBeGreaterThanOrEqual(295);
  });
});

describe('E.1.4 banking', () => {
  it('a 5-minute match makes 0 profile writes while it plays and exactly 1 when it banks', async () => {
    const t = await tab();
    const off = t.m.enterPlaytime('match', ACT());
    play(300);
    expect(t.writes).toBe(0);
    t.m.bankActivity('ut:1', 'complete');
    expect(t.writes).toBe(1);
    expect(pt(t).daySec).toBeGreaterThanOrEqual(298);
    expect(pt(t).acts).toBe(1);
    t.m.bankActivity('ut:1', 'complete');
    off();
    expect(t.writes).toBe(1);
  });
  it('a forfeit at 119 s banks nothing; at 121 s it banks (and is not a completed activity)', async () => {
    const t = await tab();
    match(t, 'ut:a', 119, 2, 'forfeit');
    expect(t.writes).toBe(0);
    match(t, 'ut:b', 121, 2, 'forfeit');
    expect(t.writes).toBe(1);
    expect(pt(t).daySec).toBeGreaterThanOrEqual(119);
    expect(pt(t).acts).toBe(0);
  });
  it('an unfinished match banks nothing, and the next one does not take its seconds', async () => {
    const t = await tab();
    match(t, 'ut:a', 200, 2, null);
    match(t, 'ut:b', 10);
    expect(pt(t).daySec).toBeLessThanOrEqual(11);
    expect(pt(t).acts).toBe(1);
  });
  it('a draft left for a match and finished later banks all of its time (review fix: one provisional per activity)', async () => {
    const t = await tab();
    const run = { id: 'draft:r1', sport: 'nba' as const, kind: 'draft' as const };
    screen(t, 'draft', 120, 2, run); // drafting for 2 minutes
    match(t, 'ut:1', 60); // leaves to play a match
    const afterMatch = pt(t).daySec;
    screen(t, 'draft', 60, 2, run); // resumes the same run (checkpoint, same id) and finishes it
    t.m.bankActivity('draft:r1', 'complete');
    expect(pt(t).daySec - afterMatch).toBeGreaterThanOrEqual(178);
    expect(pt(t).daySec - afterMatch).toBeLessThanOrEqual(182);
  });
  it('at most 4 activities wait unbanked, and none from an earlier day', async () => {
    const t = await tab();
    for (const id of ['a', 'b', 'c', 'd', 'e']) match(t, 'ut:' + id, 30, 2, null);
    t.m.bankActivity('ut:a', 'complete'); // the oldest of five was dropped
    expect(pt(t).daySec).toBe(0);
    t.m.bankActivity('ut:b', 'complete');
    expect(pt(t).daySec).toBeGreaterThanOrEqual(29);
    vi.setSystemTime(Date.now() + 86400_000);
    match(t, 'ut:f', 5, 1, null); // a new day's activity drops yesterday's
    const before = pt(t).daySec;
    t.m.bankActivity('ut:c', 'complete');
    expect(pt(t).day).toBe('2026-11-17');
    expect(pt(t).daySec).toBe(0);
    expect(before).toBeGreaterThan(0);
  });
  it('menu seconds bank once a minute, never while a match is live', async () => {
    const t = await tab();
    match(t, 'ut:1', 1200);
    screen(t, 'menu', 300, 5);
    expect(t.writes).toBe(1 + 5);
    const off = t.m.enterPlaytime('match', ACT('ut:2'));
    play(300);
    off();
    expect(t.writes).toBe(6);
  });
  it('hiding the page parks provisional seconds on the device, not in the profile, and a relaunch resumes them', async () => {
    const t = await tab();
    t.m.enterPlaytime('match', ACT());
    play(150);
    page.visibilityState = 'hidden';
    page.fire('visibilitychange');
    expect(t.writes).toBe(0);
    expect(page.store.get('perfect-season:playtime-pending:v1')).toContain('ut:1');
    // the app was killed; the relaunched app settles the match as a forfeit (ut-6)
    page.visibilityState = 'visible';
    const again = await tab(t.profile, true);
    again.m.bankActivity('ut:1', 'forfeit');
    expect(again.writes).toBe(1);
    expect(pt(again).daySec).toBeGreaterThanOrEqual(148);
    expect(page.store.has('perfect-season:playtime-pending:v1')).toBe(false);
  });
  it('parked seconds from an earlier day are dropped on relaunch', async () => {
    const t = await tab();
    t.m.enterPlaytime('match', ACT());
    play(150);
    page.visibilityState = 'hidden';
    page.fire('visibilitychange');
    vi.setSystemTime(Date.now() + 86400_000);
    page.visibilityState = 'visible';
    const again = await tab(t.profile, true);
    again.m.bankActivity('ut:1', 'forfeit');
    expect(again.writes).toBe(0);
    expect(page.store.has('perfect-season:playtime-pending:v1')).toBe(false);
  });
  it('an idle visible hour (app open, no input) makes 0 profile writes; its raw time rides along with the next bank', async () => {
    const t = await tab();
    screen(t, 'menu', 3600);
    expect(t.writes).toBe(0);
    match(t, 'ut:1', 60);
    expect(t.writes).toBe(1);
    expect(pt(t).rawDaySec).toBeGreaterThanOrEqual(3655);
    expect(pt(t).daySec).toBeLessThanOrEqual(61);
  });
  it('30 minutes of menus on a day with no match make 0 profile writes (the 25% rule credits none of them)', async () => {
    const t = await tab();
    screen(t, 'menu', 1800, 5);
    expect(t.writes).toBe(0);
    // a frozen day (the clock went back) writes nothing either
    const f = await tab(blankProfile({ playtime: { ...t.m.freshPlaytime('2026-11-17'), life: 600 } }), true);
    screen(f, 'menu', 600, 5);
    match(f, 'ut:x', 0, 0, null);
    expect(f.writes).toBe(0);
  });
  it('menu seconds wait for room: after a later match they count, up to the 25% rule, in that bank', async () => {
    const t = await tab();
    screen(t, 'menu', 600, 5);
    expect(t.writes).toBe(0);
    match(t, 'ut:1', 1200);
    expect(t.writes).toBe(1);
    expect(pt(t).dayMenuSec).toBeGreaterThanOrEqual(395);
    expect(pt(t).dayMenuSec).toBeLessThanOrEqual(400);
  });
  it('menu and raw seconds of a day that ended do not count on the next', async () => {
    const t = await tab();
    screen(t, 'menu', 600, 5);
    vi.setSystemTime(Date.now() + 86400_000);
    screen(t, 'menu', 61);
    match(t, 'ut:1', 30);
    expect(pt(t).day).toBe('2026-11-17');
    expect(pt(t).dayMenuSec).toBe(0);
    expect(pt(t).rawDaySec).toBeLessThan(200);
  });
  it('a second tab started the same day takes what a hidden tab parked; the first one gives it up (counted once)', async () => {
    const a = await tab();
    a.m.enterPlaytime('match', ACT('ut:a'));
    play(150);
    page.visibilityState = 'hidden';
    page.fire('visibilitychange');
    page.lock = null;
    // the first tab is alive in the background; a second one opens and settles the parked match
    page.visibilityState = 'visible';
    const b = await tab(a.profile);
    b.m.bankActivity('ut:a', 'forfeit');
    expect(pt(b).daySec).toBeGreaterThanOrEqual(148);
    // the first tab comes back and finishes its match: only the seconds after its return count there
    page.fire('visibilitychange');
    play(30);
    a.m.bankActivity('ut:a', 'complete');
    expect((a.profile.playtime?.daySec ?? 0) + pt(b).daySec).toBeLessThanOrEqual(150 + 32);
  });
});

describe('E.1 menus are at most 25% of the day', () => {
  it('menus alone count nothing; after a 30-minute match, at most 10 menu minutes count', async () => {
    const t = await tab();
    screen(t, 'menu', 600, 5);
    expect(t.profile.playtime?.daySec ?? 0).toBe(0);
    match(t, 'ut:1', 1800);
    screen(t, 'menu', 1800, 5);
    expect(pt(t).dayMenuSec).toBe(600);
    expect(pt(t).dayMenuSec / pt(t).daySec).toBeLessThanOrEqual(0.25);
  });
});

describe('E.2 caps, ET days and weeks (pure ledger)', () => {
  const C = (sec: number, menu = 0) => ({ sec, menu, raw: sec + menu, sport: 'nba' as const, act: 1 });
  it('5,400 s a day: more play counts nothing more, raw still grows', async () => {
    const m = await import('./playtime');
    let p = m.credit(undefined, C(5000), T0);
    p = m.credit(p, C(1000), T0);
    expect(p.daySec).toBe(5400);
    expect(p.life).toBe(5400);
    expect(p.rawDaySec).toBe(6000);
    expect(p.weekDays[0]).toBe(5400);
  });
  it('37,800 s a week: seven capped days, and nothing past it', async () => {
    const m = await import('./playtime');
    let p = m.credit(undefined, C(9000), T0);
    for (let d = 1; d < 7; d++) p = m.credit(p, C(9000), T0 + d * 86400_000);
    expect(p.weekDays).toEqual([5400, 5400, 5400, 5400, 5400, 5400, 5400]);
    expect(p.weekDays.reduce((a, b) => a + b)).toBe(37800);
    const tampered = { ...p, weekDays: [9000, 9000, 9000, 9000, 9000, 0, 0], daySec: 0 };
    expect(m.credit(tampered, C(3000), T0 + 6 * 86400_000).daySec).toBe(0);
  });
  it('the Eastern day rolls at midnight ET, not UTC; the week rolls on Monday', async () => {
    const m = await import('./playtime');
    const lateSun = Date.parse('2026-11-23T04:59:00Z'); // Sunday 23:59 ET
    let p = m.credit(undefined, C(600), lateSun);
    expect(p.day).toBe('2026-11-22');
    expect(p.week).toBe('2026-W47');
    p = { ...p, claimed: { ...p.claimed, day: [0, 1], week: [0] } };
    p = m.credit(p, C(60), lateSun + 120_000); // Monday 00:01 ET
    expect(p.day).toBe('2026-11-23');
    expect(p.week).toBe('2026-W48');
    expect(p.daySec).toBe(60);
    expect(p.weekDays).toEqual([60, 0, 0, 0, 0, 0, 0]);
    expect(p.claimed).toMatchObject({ day: [], week: [], dayKey: '2026-11-23', weekKey: '2026-W48' });
    expect(p.life).toBe(660);
  });
  it('etDay and isoWeek equal the app’s easternDateKey and the boards’ weekKey for 800 days', async () => {
    const m = await import('./playtime');
    for (let d = 0; d < 800; d++) {
      const t = Date.parse('2025-12-01T03:30:00Z') + d * 86400_000;
      const day = easternDateKey(new Date(t));
      expect(m.etDay(t)).toBe(day);
      expect(m.isoWeek(day)).toBe(weekKey(day));
    }
  });
  it('rested: the first day back after 3+ days away is marked once', async () => {
    const m = await import('./playtime');
    const p = m.credit(undefined, C(600), T0);
    expect(m.credit(p, C(60), T0 + 3 * 86400_000).restedDay).toBeUndefined(); // 2 days away
    expect(m.credit(p, C(60), T0 + 4 * 86400_000).restedDay).toBe('2026-11-20'); // 3 days away
  });
});

describe('E.8 clock tampering freezes the day', () => {
  const C = (sec: number) => ({ sec, menu: 0, raw: sec, sport: 'nba' as const, act: 1 });
  it('a date set back a day freezes accrual for it (counts and claims stay put)', async () => {
    const m = await import('./playtime');
    const p = m.credit(undefined, C(600), T0 + 86400_000);
    const back = m.credit(p, C(900), T0);
    expect(back.frozenDay).toBe('2026-11-16');
    expect(back.daySec).toBe(600);
    expect(back.day).toBe('2026-11-17');
    expect(back.life).toBe(600);
    expect(m.playtimeLine({ playtime: back }, T0)).toMatch(/paused/);
  });
  it('a repeated day key (forward a day, then back) freezes too', async () => {
    const m = await import('./playtime');
    let p = m.credit(undefined, C(300), T0);
    p = m.credit(p, C(300), T0 + 86400_000);
    p = m.credit(p, C(300), T0 + 3600_000);
    expect(p.frozenDay).toBe('2026-11-16');
    expect(p.life).toBe(600);
  });
  it('a relaunch cannot reset the cap: the ledger keyed by day survives it', async () => {
    const t = await tab();
    match(t, 'ut:1', 3000);
    const again = await tab(t.profile, true);
    match(again, 'ut:2', 3000);
    expect(pt(again).daySec).toBe(5400);
  });
});

describe('ledger creation, view and line', () => {
  it('a brand-new player gets the endowed head start; a returning one does not', async () => {
    const fresh = await tab(blankProfile({ stats: { games: 0 } as Profile['stats'], ut: { record: { w: 0, l: 0, h2hW: 0, h2hL: 0 } } as Profile['ut'] }));
    match(fresh, 'ut:1', 10);
    expect(pt(fresh).endowed).toBe('2026-11-16');
    const old = await tab();
    match(old, 'ut:1', 10);
    expect(pt(old).endowed).toBeUndefined();
  });
  it('playtimeLine and playtimeView read today, the week and lifetime', async () => {
    const m = await import('./playtime');
    const p = m.credit(undefined, { sec: 27 * 60, menu: 0, raw: 40 * 60, sport: 'nfl', act: 2 }, T0);
    expect(m.playtimeLine({ playtime: p }, T0)).toBe('Today 27 min · next reward at 30');
    expect(m.playtimeLine({ playtime: { ...p, daySec: 5400 } }, T0)).toBe('Today 90 min · done for today');
    expect(m.playtimeLine({}, T0)).toBe('Today 0 min · next reward at 5');
    const v = m.playtimeView({ playtime: p }, T0);
    expect(v.today).toMatchObject({ min: 27, rawMin: 40, frozen: false });
    expect(v.week.days[0]).toBe(27);
    expect(v.life.bySport.nfl).toBe(0.4);
    expect(m.playtimeView({ playtime: p }, T0 + 2 * 86400_000).today.min).toBe(0);
  });
});

describe('performance', () => {
  it('per-second work stays far under 0.2 ms (an hour of ticks with a full input buffer)', async () => {
    const t = await tab();
    t.m.enterPlaytime('match', ACT());
    for (let i = 0; i < 100; i++) tap();
    const start = realNow();
    for (let s = 0; s < 3600; s++) {
      if (s % 2 === 0) tap();
      vi.advanceTimersByTime(1000);
    }
    const perTick = (realNow() - start) / 3600;
    expect(perTick).toBeLessThan(0.2);
  });
});
