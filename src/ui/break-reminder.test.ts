// Claude, 2026-11-16 (studio overhaul, team ut, ut-3; V2 D.11): the break reminder, against the real
// MINUTES ticker (src/lib/playtime.ts) on a fake page and fake clock: never during a match, exactly
// once at the next stoppage after 60 active minutes, once per hour, a 10-minute break resets it, the
// match handshake holds it, and the Session reminder setting turns it off without a backlog.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../lib/profile';
import { BREAK_AFTER, BREAK_GAP, breakStep, breakWatcher, holdBreak } from './BreakReminder';

vi.mock('../lib/sound', () => ({ sfx: {} }));

type Fn = (e: unknown) => void;
const T0 = Date.parse('2026-11-16T15:00:00Z');

function fakePage() {
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
    lock: null as object | null,
  };
  vi.stubGlobal('document', page);
  vi.stubGlobal('addEventListener', (type: string, fn: Fn) => page.addEventListener(type, fn));
  vi.stubGlobal('performance', { now: () => Date.now() });
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
  vi.stubGlobal('navigator', {
    locks: {
      request(_n: string, _o: unknown, cb: (l: object | null) => Promise<void> | undefined) {
        if (page.lock) return Promise.resolve(cb(null));
        const me = {};
        page.lock = me;
        return Promise.resolve(cb(me)).finally(() => page.lock === me && (page.lock = null));
      },
    },
  });
  return page;
}

let page: ReturnType<typeof fakePage>;
let spot = 0;
const tap = () => (spot++, page.fire('pointerdown', { clientX: 40 + ((spot * 37) % 300), clientY: 300 + ((spot * 53) % 400) }));
/** `sec` seconds, a tap every 2 s (a real thumb) unless `idle`. */
function run(sec: number, idle = false) {
  for (let s = 0; s < sec; s++) {
    if (!idle && s % 2 === 0) tap();
    vi.advanceTimersByTime(1000);
  }
}

/** The app: the ticker with a profile sink, the root menu screen, and the reminder watcher. */
async function app() {
  vi.resetModules();
  const m = await import('../lib/playtime');
  let profile = { stats: { games: 3 }, history: [], ut: { record: { w: 1, l: 0, h2hW: 0, h2hL: 0 } } } as unknown as Profile;
  m.registerPlaytimeSink((fn) => (profile = fn(profile)));
  m.enterPlaytime('menu');
  const shown: { at: number; ctx: string }[] = [];
  let ctx = 'menu';
  m.watchPlaytime(breakWatcher(() => shown.push({ at: Date.now() - T0, ctx })));
  /** a match on screen for `sec` seconds, then banked and left */
  const match = (id: string, sec: number) => {
    ctx = 'match';
    const off = m.enterPlaytime('match', { id, sport: 'nba', kind: 'match' });
    run(sec);
    m.bankActivity(id, 'complete');
    // the result screen
    ctx = 'replay';
    off();
    const res = m.enterPlaytime('replay', { id, sport: 'nba', kind: 'match' });
    run(5);
    res();
    ctx = 'menu';
  };
  return { m, shown, match, profile: () => profile, setCtx: (c: string) => (ctx = c) };
}

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
  page = fakePage();
  spot = 0;
  holdBreak('test', false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the break reminder on the real ticker (70-minute fake-clock runs)', () => {
  it('one 70-minute match: 0 reminders during it, exactly 1 at the next stoppage (its result screen)', async () => {
    const a = await app();
    a.match('ut:long', 70 * 60);
    expect(a.shown).toHaveLength(1);
    expect(a.shown[0].ctx).toBe('replay');
    // it came after the match ended, not inside it
    expect(a.shown[0].at).toBeGreaterThanOrEqual(70 * 60 * 1000);
    // the counted time really was more than an hour
    expect(a.profile().playtime!.daySec).toBeGreaterThanOrEqual(BREAK_AFTER);
    // 5 more minutes of menus: nothing more
    run(300);
    expect(a.shown).toHaveLength(1);
  });
  it('seven 10-minute matches with menus between: the reminder lands between matches, never in one', async () => {
    const a = await app();
    for (let i = 0; i < 7; i++) {
      a.match('ut:' + i, 600);
      run(20); // the menus between matches
    }
    expect(a.shown).toHaveLength(1);
    expect(['menu', 'replay']).toContain(a.shown[0].ctx);
    // it is the first stoppage after the hour: after match 6 (60 min of play)
    expect(a.shown[0].at).toBeGreaterThan(60 * 60 * 1000);
    // (70 min of matches, results and menus later at the latest)
    expect(a.shown[0].at).toBeLessThan(63 * 60 * 1000);
  });
  it('once per 60 minutes: a 2.5-hour session gets two', async () => {
    const a = await app();
    for (let i = 0; i < 15; i++) a.match('ut:' + i, 600);
    expect(a.shown).toHaveLength(2);
  });
  it('a 10-minute break (the app away) starts the hour again', async () => {
    const a = await app();
    a.match('ut:a', 40 * 60);
    page.visibilityState = 'hidden';
    vi.advanceTimersByTime(BREAK_GAP + 60_000);
    page.visibilityState = 'visible';
    // the hidden tab let its Web Lock go: the release settles on the microtask queue
    for (let i = 0; i < 3; i++) await Promise.resolve();
    a.match('ut:b', 40 * 60);
    expect(a.shown).toHaveLength(0);
    a.match('ut:c', 25 * 60);
    expect(a.shown).toHaveLength(1);
  });
  it('idle menus do not count toward the hour', async () => {
    const a = await app();
    run(90 * 60, true);
    expect(a.shown).toHaveLength(0);
  });
  it('a held screen (the match handshake, the draft vote, a Gauntlet climb, Training Camp) waits until it is over', async () => {
    const a = await app();
    const off = a.m.enterPlaytime('match', { id: 'ut:h', sport: 'nba', kind: 'match' });
    run(61 * 60);
    expect(a.shown).toHaveLength(0);
    a.m.bankActivity('ut:h', 'complete');
    // straight into the next match's handshake: a menu-class screen with a clock on it
    holdBreak('ut-match', true);
    off();
    run(30);
    expect(a.shown).toHaveLength(0);
    // two hosts holding: one letting go is not enough
    holdBreak('app', true);
    holdBreak('ut-match', false);
    run(5);
    expect(a.shown).toHaveLength(0);
    holdBreak('app', false);
    run(2);
    expect(a.shown).toHaveLength(1);
  });
});

describe('the Session reminder setting', () => {
  it('off: nothing shows, and turning it back on fires no backlog', async () => {
    vi.resetModules();
    const m = await import('../lib/playtime');
    m.registerPlaytimeSink(() => {});
    m.enterPlaytime('menu');
    let on = false;
    const shown: number[] = [];
    m.watchPlaytime(breakWatcher(() => on && shown.push(Date.now())));
    const off = m.enterPlaytime('match', { id: 'ut:x', sport: 'nba', kind: 'match' });
    run(65 * 60);
    m.bankActivity('ut:x', 'complete');
    off();
    run(5);
    expect(shown).toHaveLength(0);
    on = true;
    run(10 * 60);
    expect(shown).toHaveLength(0);
  });
});

describe('breakStep (pure)', () => {
  it('due only at a stoppage, and the count resets when it fires', () => {
    let s = { active: BREAK_AFTER - 1, lastAt: 0 };
    let r = breakStep(s, 1, 'match', 1000);
    expect(r.due).toBe(false);
    s = r.s;
    for (const ctx of ['sim', 'draft', 'draftSim', 'queue', 'off', undefined] as const) expect(breakStep(s, 0, ctx, 2000).due).toBe(false);
    r = breakStep(s, 0, 'menu', 2000);
    expect(r.due).toBe(true);
    expect(r.s.active).toBe(0);
    expect(breakStep({ active: BREAK_AFTER, lastAt: 0 }, 0, 'replay', 1000).due).toBe(true);
  });
  it('a gap longer than the break resets the hour', () => {
    expect(breakStep({ active: BREAK_AFTER, lastAt: 0 }, 0, 'menu', BREAK_GAP + 1).due).toBe(false);
  });
});
