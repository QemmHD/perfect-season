// Claude, 2026-11-16 (studio overhaul, team ut, task ut-4): the main app's next best action.
//   - The Home strip says what the engine says, and the distance it states is the real one (every UT
//     QA fixture of this sport: claims, runs, near misses, Minutes, a finished day...).
//   - The UT tab badge is UT HOME's Rewards count, which is the inbox's claimable rows.
//   - Every target leads where its action is done (goHome), across sports too.
//   - Missions: every mission has a GO, and the mode it starts can complete it.
//   - The first run: one sheet, COLLECT ALL pays the gift and the chest once, ids unchanged.
// soccer-next-up.test.ts runs this file under soccer's run.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { advance, missionMode, missionsFor, type GameEvent, type MissionGo } from '../engine/missions';
import { pickFor, SOCCER_ON, SPORT } from '../engine/sport';
import { loadProfile, type Profile } from '../lib/profile';
import { poolSig, writePoolCache } from '../ut/claimables';
import { MemoryStorage, useStorage } from '../ut/compat/memory-storage';
import { inboxCount, inboxItems, poolRowCount } from '../ut/inbox';
import { freshForMinutes, minutesExtras, nextRung } from '../ut/minutes';
import { dailyLeft, nextCtxOf, nextUp, rivalsNext } from '../ut/next-action';
import { weekKey, hqOf } from '../ut/objectives';
import { getPool, type Pool } from '../ut/pool';
import { qaFixtures, type QaFixture, fs, SRC } from '../ut/qa-fixtures.test-util';
import { utReturnView, rememberUtReturn } from '../ut/return-view';
import type { UtSport } from '../ut/types';
import { NextUpStrip, TabBadge } from './NextUpStrip';
import { DEVICE_KEY, elsewhereOf, goHome, homeNext, MATCH_VIEW, readDevice, writeDeviceCount, type HomeAction, type HomeRoutes } from './next-up-main';
import { collectFirstRun, firstRunPlan } from './Welcome';

const fixtures = qaFixtures(SPORT);
const S = SPORT as UtSport;
const NO_INPUTS = { missions: 0, daily: { no: 300, done: true } };

function profileOf(f: QaFixture): Profile {
  useStorage(new MemoryStorage(f.storage));
  return loadProfile();
}

let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 120000);

/** The distance a line states, recomputed from the save by a route independent of the strip. */
function statedDistance(p: Profile, a: HomeAction, now: number, day: string): { said: number; real: number } | null {
  const n = (re: RegExp) => Number(re.exec(a.line)?.[1]);
  if (a.id === 'claim' && /rewards to claim/.test(a.line)) {
    const mx = minutesExtras(p.playtime, now, freshForMinutes(p));
    return { said: n(/(\d+) rewards to claim/), real: nextCtxOf(p.ut, S, now).claim.count + (mx.minutes?.n ?? 0) };
  }
  if (a.id === 'run:circuit' && /wins? to/.test(a.line)) {
    const c = hqOf(p.ut).circuit.active!;
    const step = [2, 4, 6].find((w) => w > c.wins && w - c.wins <= 6 - c.games)!;
    return { said: n(/(\d+) wins? to/), real: step - c.wins };
  }
  if (a.id.startsWith('milestone:rivals') || a.id === 'ending:rivals') return { said: n(/(\d+) wins? to/), real: rivalsNext(p.ut, weekKey(day))!.wins };
  if (a.id.startsWith('minutes:')) return { said: n(/(\d+) min to/), real: nextRung(p.playtime, now, freshForMinutes(p))!.minutesLeft };
  if (a.id === 'daily-last') return { said: n(/(\d+) \w+ to today/), real: dailyLeft(p.ut, day)!.left };
  return null;
}

describe('the Home strip says what the engine says (' + SPORT + ')', () => {
  it('has at least 12 fixtures', () => expect(fixtures.length).toBeGreaterThanOrEqual(12));
  let distances = 0;
  for (const f of fixtures)
    it(f.name + ': same action as the engine, a true distance, and the strip shows its line', () => {
      const p = profileOf(f),
        now = Date.parse(f.at);
      const h = homeNext(p, SPORT, now, NO_INPUTS, {});
      const ctx = nextCtxOf(p.ut, S, now, { ...minutesExtras(p.playtime, now, freshForMinutes(p)), elsewhere: [], dailyPlay: null });
      expect(h.action).toEqual(nextUp(ctx));
      const d = statedDistance(p, h.action, now, f.day);
      if (d) {
        distances++;
        expect(d.said).toBe(d.real);
      }
      const html = renderToStaticMarkup(<NextUpStrip action={h.action} onGo={() => {}} />);
      expect(html).toContain(h.action.done ? h.action.line.replace(/^Done for today · /, '') : h.action.line.replace(/&/g, '&amp;').replace(/'/g, '&#x27;'));
      expect(html).toContain('data-action="' + h.action.id + '"');
    });
  it('states a distance in many fixtures', () => expect(distances).toBeGreaterThanOrEqual(6));
});

describe('the UT tab badge is UT HOME’s Rewards count (' + SPORT + ')', () => {
  for (const f of fixtures)
    it(f.name, () => {
      let p = profileOf(f);
      // as after one UT open: the pool rows' cache written (claimables.ts), so the count is exact
      p = { ...p, ut: writePoolCache(p.ut, poolSig(p.ut, S), poolRowCount(inboxItems(pool, p, f.day, f.week))) };
      const h = homeNext(p, SPORT, Date.parse(f.at), NO_INPUTS, {});
      expect(h.approx).toBe(false);
      expect(h.count).toBe(inboxCount(pool, p, f.day, f.week));
    });
  it('draws white 11 px bold on #c62828 (5.6:1), and 99+ past 99', () => {
    const css = fs.readFileSync(new URL('ui/next-up.css', SRC), 'utf8');
    const rule = /\.tabs \.tab-badge \{([^}]*)\}/.exec(css)![1];
    expect(rule).toMatch(/background: #c62828/);
    expect(rule).toMatch(/color: #fff/);
    expect(rule).toMatch(/font-size: 11px/);
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    expect((1.05) / (lum('#c62828') + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(renderToStaticMarkup(<TabBadge count={140} amber={false} />)).toContain('99+');
    expect(renderToStaticMarkup(<TabBadge count={0} amber={false} />)).toBe('');
    expect(renderToStaticMarkup(<TabBadge count={2} amber />)).toContain('amber');
    // UT's own tab dots follow the same rule
    const nav = fs.readFileSync(new URL('ut/nav.css', SRC), 'utf8');
    expect(/\.ut-tabs \.ut-dot \{([^}]*)\}/.exec(nav)![1]).toMatch(/background: #c62828[\s\S]*font-size: 11px/);
  });
});

describe('Home sources the engine cannot see (' + SPORT + ')', () => {
  const base = fixtures.find((f) => f.name === 'all-done') ?? fixtures[0];
  it('missions ready: claimed after this sport’s UT rewards, before everything else', () => {
    const p = profileOf(base),
      now = Date.parse(base.at);
    const plain = homeNext(p, SPORT, now, NO_INPUTS, {});
    const withM = homeNext(p, SPORT, now, { ...NO_INPUTS, missions: 2 }, {});
    if (plain.action.id === 'claim') expect(withM.action.id).toBe('claim');
    else {
      expect(withM.action.id).toBe('missions');
      expect(withM.action.line).toMatch(/^2 missions done/);
      expect(withM.action.target).toEqual({ app: 'missions' });
    }
  });
  it('another sport’s count: today only, whole numbers only, never this sport, soccer only where it is on', () => {
    const day = '2026-11-16';
    const d = { claims: { nba: { n: 3, day }, nfl: { n: 2, day: '2026-11-15' }, soccer: { n: 1.5, day } } };
    const others = elsewhereOf(d, 'nfl', day);
    expect(others).toEqual([{ sport: 'nba', count: 3 }]);
    expect(elsewhereOf({ claims: { soccer: { n: 4, day } } }, 'nba', day)).toEqual(SOCCER_ON ? [{ sport: 'soccer', count: 4 }] : []);
    expect(elsewhereOf({}, 'nba', day)).toEqual([]);
  });
  it('the device cache is written only when the count changes', () => {
    const store = new MemoryStorage();
    useStorage(store);
    let writes = 0;
    const set = store.setItem.bind(store);
    store.setItem = (k: string, v: string) => (writes++, set(k, v));
    writeDeviceCount('nba', 3, '2026-11-16');
    writeDeviceCount('nba', 3, '2026-11-16');
    writeDeviceCount('nfl', 1, '2026-11-16');
    expect(writes).toBe(2);
    expect(readDevice().claims).toEqual({ nba: { n: 3, day: '2026-11-16' }, nfl: { n: 1, day: '2026-11-16' } });
    expect(store.getItem(DEVICE_KEY)).toBeTruthy();
  });
  it('the app-icon total counts every sport’s rewards and Minutes rungs', () => {
    const p = profileOf(base),
      now = Date.parse(base.at);
    const other = pickFor(S, { nba: 'nfl', nfl: 'nba', soccer: 'nba' }) as UtSport;
    const h = homeNext(p, SPORT, now, NO_INPUTS, { claims: { [other]: { n: 4, day: base.day } } });
    const mins = minutesExtras(p.playtime, now, freshForMinutes(p)).minutes?.n ?? 0;
    expect(h.total).toBe(h.count + 4 + mins);
  });
});

describe('every target leads where its action is done', () => {
  const calls: string[] = [];
  const routes: HomeRoutes = {
    openUt: () => calls.push('ut:' + utReturnView()),
    otherSport: (s, v) => calls.push('sport:' + s + ':' + v),
    minutes: () => calls.push('minutes'),
    draft: (m) => calls.push('draft:' + m),
    missions: () => calls.push('missions'),
  };
  it('UT views open there; another sport reloads into its UT; a match opens its mode; drafts start', () => {
    rememberUtReturn('hub');
    goHome({ app: 'ut', view: 'inbox' }, SPORT, routes);
    goHome({ app: 'ut', view: 'inbox', sport: S }, SPORT, routes);
    const other = pickFor(S, { nba: 'nfl', nfl: 'nba', soccer: 'nba' }) as UtSport;
    goHome({ app: 'ut', view: 'inbox', sport: other }, SPORT, routes);
    goHome({ app: 'match', setup: { mode: 'cup' } }, SPORT, routes);
    goHome({ app: 'minutes' }, SPORT, routes);
    goHome({ app: 'draft', mode: 'h2h' }, SPORT, routes);
    goHome({ app: 'draft', mode: 'daily' }, SPORT, routes);
    goHome({ app: 'missions' }, SPORT, routes);
    expect(calls).toEqual(['ut:inbox', 'ut:inbox', 'sport:' + other + ':inbox', 'ut:cup', 'minutes', 'draft:1v1', 'draft:daily', 'missions']);
  });
  it('every match mode has a UT screen', () => {
    for (const v of Object.values(MATCH_VIEW)) expect(typeof v).toBe('string');
  });
});

describe('Missions GO (' + SPORT + ')', () => {
  const all = new Map<string, ReturnType<typeof missionsFor>[number]>();
  for (let i = 0; i < 400; i++) for (const m of missionsFor(new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString().slice(0, 10))) all.set(m.id, m);
  const MODES: GameEvent['mode'][] = ['classic', 'blind', 'daily', '1v1'];
  it('every mission has a GO', () => {
    expect(all.size).toBeGreaterThanOrEqual(10);
    for (const m of all.values()) expect(['any', 'season', 'daily', 'blind', '1v1'] as MissionGo[]).toContain(m.go);
  });
  it('the mode its GO starts can complete it, whatever mode Home is on', () => {
    for (const m of all.values())
      for (const cur of MODES) {
        const mode = missionMode(m.go, cur);
        const e: GameEvent = { mode, wins: mode === '1v1' ? 0 : 82, series: 4, title: true, sweeps: 4, balance: 1, legends: 2, vsWon: mode === '1v1' ? true : null, online: mode === '1v1', margin: 40 };
        expect(m.step(e), m.id + ' from ' + cur + ' → ' + mode).toBeGreaterThan(0);
      }
  });
  it('ids, goals and rewards are unchanged by the GO field (advance still works)', () => {
    const day = '2026-11-16';
    const r = advance(day, [0, 0, 0], { mode: 'classic', wins: 82, series: 4, title: true, sweeps: 4, balance: 1, legends: 2, vsWon: null, online: false, margin: 40 });
    expect(r.progress.length).toBe(3);
    for (const m of missionsFor(day)) expect(Object.keys(m).sort()).toEqual(['coins', 'go', 'goal', 'id', 'step', 'text', 'xp']);
  });
});

describe('the first run: one sheet (' + SPORT + ')', () => {
  const GIFT = { id: 'testers-2026-10', coins: 9000 };
  const today = '2026-11-16';
  const fresh = (): Profile => {
    useStorage(new MemoryStorage());
    return loadProfile();
  };
  it('offers the gift, today’s chest and the starter pack together', () => {
    const plan = firstRunPlan(fresh(), today, GIFT)!;
    expect(plan.gift).toEqual(GIFT);
    expect(plan.chest).toEqual({ day: 1, coins: 25, xp: 20 });
    expect(plan.starter).toBe(true);
  });
  it('COLLECT ALL pays both once, with the same receipts as the two old sheets', () => {
    const p = fresh();
    const a = collectFirstRun(p, today, GIFT);
    expect(a.coins - p.coins).toBe(9000 + 25);
    expect(a.xp - p.xp).toBe(20);
    expect(a.gifts).toContain('testers-2026-10');
    expect(a.rewardDay).toBe(today);
    expect(a.streak).toEqual({ count: 1, last: today, best: Math.max(1, p.streak.best) });
    const b = collectFirstRun(a, today, GIFT);
    expect(b).toBe(a);
    expect(firstRunPlan(a, today, GIFT)).toBeNull();
  });
  it('a chest already opened today is not offered or paid again; a streak carries on', () => {
    const p = { ...fresh(), rewardDay: today, streak: { count: 3, last: today, best: 3 } };
    expect(firstRunPlan(p, today, GIFT)!.chest).toBeNull();
    expect(collectFirstRun(p, today, GIFT).coins - p.coins).toBe(9000);
    const y = { ...fresh(), streak: { count: 2, last: '2026-11-15', best: 4 } };
    expect(firstRunPlan(y, today, GIFT)!.chest).toEqual({ day: 3, coins: 55, xp: 30 });
  });
});
