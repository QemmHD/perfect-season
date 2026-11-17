// Claude, 2026-11-16 (studio overhaul, team ut, task ut-4): UT Home's feed around the hero.
//   - Clocks are Eastern midnights, right across DST; amber under 24 h (23:59 vs 24:01).
//   - Live Now has at least 3 items every day of a year in NBA and NFL, 2 in soccer, and every item,
//     near-miss chip and next action leads to a screen this sport has.
//   - Done for today in every all-done fixture, never when anything is claimable.
//   - The Season card names the top reward from day 1 and the next named reward truly.
//   - The modal queue shows one sheet at a time, in order; the session summary is true.
// soccer-hub.test.ts runs this file under soccer's run.
import { describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { loadProfile, type Profile } from '../lib/profile';
import { easternClock } from './claimables';
import { MemoryStorage, useStorage } from './compat/memory-storage';
import { dayAfter, endOfDay, endOfWeek, etStart, HIDDEN_VIEWS, liveNow, seasonCard, todayCard, tomorrowLine, upcomingFeed, viewShown } from './hub-feed';
import { countdownTone } from './kit';
import { freshForMinutes, minutesExtras } from './minutes';
import { nearMisses } from './near-miss';
import { doneAction, loopDone, nextCtxOf, nextUp, type Target } from './next-action';
import { SEASON_STEP, seasonReward, SEASON_TIERS } from './objectives';
import { qaFixtures, type QaFixture } from './qa-fixtures.test-util';
import { markSession, QUIET_MS, sessionSummary, summaryText } from './session-summary';
import { markSeen } from './seen';
import { nextModal, resetModalQueue, type UtModal } from './ut-modal-queue';
import { tabOf, viewInfo } from './nav';
import type { UtSport } from './types';
import type { UtView } from './UltimateTeam';

const S = SPORT as UtSport;
const fixtures = qaFixtures(SPORT);
function profileOf(f: QaFixture): Profile {
  useStorage(new MemoryStorage(f.storage));
  return loadProfile();
}
const H = 3600000;
/** a view the UT router knows (nav.ts gives every view one title; unknown views fall back to Home's) */
const known = (v: UtView) => v === 'hub' || viewInfo(v) !== viewInfo('hub');

describe('Eastern clocks (' + SPORT + ')', () => {
  it('midnight is EDT or EST as the day has it, and the DST days are 25 and 23 hours long', () => {
    expect(new Date(etStart('2026-07-01')).toISOString()).toBe('2026-07-01T04:00:00.000Z');
    expect(new Date(etStart('2026-12-01')).toISOString()).toBe('2026-12-01T05:00:00.000Z');
    expect(endOfDay('2026-11-01') - etStart('2026-11-01')).toBe(25 * H);
    expect(endOfDay('2026-03-08') - etStart('2026-03-08')).toBe(23 * H);
    expect(dayAfter('2026-12-31')).toBe('2027-01-01');
  });
  it('a day ends at the next Eastern midnight, from any hour of it (across DST too)', () => {
    for (const day of ['2026-11-01', '2026-03-08', '2026-11-16', '2027-01-01'])
      for (let h = 0; h < 23; h += 1) {
        const now = etStart(day) + h * H + 59 * 60000;
        expect(easternClock(now).day).toBe(day);
        expect(endOfDay(easternClock(now).day)).toBe(etStart(dayAfter(day)));
      }
  });
  it('the week ends Monday 00:00 Eastern', () => {
    // 2026-11-16 is a Monday
    expect(endOfWeek('2026-11-16')).toBe(etStart('2026-11-23'));
    expect(endOfWeek('2026-11-22')).toBe(etStart('2026-11-23'));
    expect(endOfWeek('2026-11-23')).toBe(etStart('2026-11-30'));
  });
  it('amber under 24 h: 23:59 left is amber, 24:01 is calm', () => {
    const ut = loadProfile().ut;
    const end = endOfWeek('2026-11-21');
    const at = (ms: number) => liveNow(ut, S, ms).find((x) => x.id === 'battles')!;
    const a = at(end - 24 * H + 60000),
      b = at(end - 24 * H - 60000);
    expect(countdownTone(a.endsAt - (end - 24 * H + 60000))).toBe('amber');
    expect(countdownTone(b.endsAt - (end - 24 * H - 60000))).toBe('calm');
  });
});

describe('Live Now and Upcoming (' + SPORT + ')', () => {
  useStorage(new MemoryStorage());
  const ut = loadProfile().ut;
  it('at least ' + (S === 'soccer' ? 2 : 3) + ' live items every day of a year, every one live and on a screen this sport has', () => {
    let min = 99;
    for (let i = 0; i < 366; i++) {
      const day = new Date(Date.UTC(2026, 10, 1) + i * 864e5).toISOString().slice(0, 10);
      for (const hour of [0.02, 12.5, 23.98]) {
        const now = etStart(day) + hour * H;
        const live = liveNow(ut, S, now);
        min = Math.min(min, live.length);
        for (const x of live) {
          expect(x.endsAt, x.id).toBeGreaterThan(now);
          expect(viewShown(x.view, S) && known(x.view), x.id + ' → ' + x.view).toBe(true);
        }
        const up = upcomingFeed(ut, S, now);
        expect(up.length).toBeGreaterThanOrEqual(3);
        for (const u of up) expect(u.at).toBeGreaterThan(now);
      }
    }
    expect(min).toBeGreaterThanOrEqual(S === 'soccer' ? 2 : 3);
  });
  it('soccer never shows its hidden modes or the Live Calendar', () => {
    const live = liveNow(ut, 'soccer', Date.parse('2026-11-20T17:00:00Z'));
    expect(live.some((x) => x.id.startsWith('promo:'))).toBe(false);
    for (const x of live) expect(HIDDEN_VIEWS.soccer).not.toContain(x.view);
    expect(upcomingFeed(ut, 'soccer', Date.parse('2026-11-20T17:00:00Z')).some((u) => u.id.startsWith('cal'))).toBe(false);
  });
  it('a dot shows until the item is seen', () => {
    const now = Date.parse('2026-11-18T17:00:00Z');
    const x = liveNow(ut, S, now).find((i) => i.id === 'battles')!;
    expect(x.fresh).toBe(true);
    const seen = markSeen(ut, 'live:battles', x.token);
    expect(liveNow(seen, S, now).find((i) => i.id === 'battles')!.fresh).toBe(false);
  });
});

describe('every hub target exists in this sport (' + SPORT + ')', () => {
  const ok = (t: Target) => (t.app === 'ut' ? viewShown(t.view, S) && known(t.view) : t.app === 'match' ? viewShown(t.setup.mode as UtView, S) : true);
  for (const f of fixtures)
    it(f.name, () => {
      const p = profileOf(f),
        now = Date.parse(f.at);
      const ctx = nextCtxOf(p.ut, S, now, minutesExtras(p.playtime, now, freshForMinutes(p)));
      expect(ok(nextUp(ctx).target)).toBe(true);
      expect(ok(doneAction(ctx).target)).toBe(true);
      for (const n of nearMisses(p.ut, S, now)) expect(viewShown(n.go.view, S) && known(n.go.view), n.id).toBe(true);
      for (const x of liveNow(p.ut, S, now)) expect(viewShown(x.view, S), x.id).toBe(true);
      expect(tabOf('season')).toBe('sbc');
    });
});

describe('Done for today (' + SPORT + ')', () => {
  let done = 0,
    claimable = 0;
  for (const f of fixtures)
    it(f.name, () => {
      const p = profileOf(f),
        now = Date.parse(f.at);
      const ctx = nextCtxOf(p.ut, S, now, minutesExtras(p.playtime, now, freshForMinutes(p)));
      if (f.name === 'all-done') {
        expect(loopDone(ctx)).toBe(true);
        expect(doneAction(ctx)).toMatchObject({ id: 'done', done: true, cta: 'KEEP PLAYING' });
        done++;
      }
      if (ctx.claim.count > 0 || (ctx.minutes?.n ?? 0) > 0 || ctx.starter || ctx.packs > 0) {
        expect(loopDone(ctx)).toBe(false);
        claimable++;
      }
      expect(loopDone({ ...ctx, after: { mode: 'battles', won: true, us: 2, them: 1, lossStreak: 0 } })).toBe(false);
    });
  it('covers both sides', () => {
    expect(done).toBe(1);
    expect(claimable).toBeGreaterThanOrEqual(10);
  });
  it('the teaser names tomorrow’s drop day and the new objectives', () => {
    const f = fixtures.find((x) => x.name === 'all-done')!;
    expect(tomorrowLine(profileOf(f).ut, Date.parse(f.at))).toMatch(/^Daily Drop Day [1-7] of 7 · 3 new objectives$/);
  });
});

describe('the Season card (' + SPORT + ')', () => {
  it('names the top reward from day 1 and the next named reward, truly', () => {
    useStorage(new MemoryStorage());
    const ut = loadProfile().ut;
    const now = Date.parse('2026-11-10T17:00:00Z');
    const c0 = seasonCard(ut, S, now);
    expect(c0.level).toBe(0);
    expect(c0.top.tier).toBe(SEASON_TIERS);
    expect(c0.top.pack).toBe(seasonReward(SEASON_TIERS).pack);
    expect(c0.next).toMatchObject({ tier: 1, levels: 1 });
    expect(c0.endsAt).toBeGreaterThan(now);
    const id = 'season:' + c0.title.replace('Season ', '').replace(/^0/, '');
    const at4 = { ...ut, hq: { ...ut.hq!, seasons: { [id]: { xp: 4 * SEASON_STEP + 10, claimed: [1, 2, 3] } } } } as typeof ut;
    const c4 = seasonCard(at4, S, now);
    expect(c4.level).toBe(4);
    expect(c4.ready).toBe(1);
    // level 5 pays a Gold Pack (objectives.ts seasonReward): one level away
    expect(c4.next).toMatchObject({ tier: 5, levels: 1, pack: 'gold' });
  });
  it('today’s card counts the three daily objectives', () => {
    const f = fixtures.find((x) => x.name === 'all-done')!;
    const t = todayCard(profileOf(f).ut, f.day);
    expect(t.rows.length).toBe(3);
    expect(t.done).toBe(3);
  });
});

describe('the modal queue', () => {
  it('one sheet at a time, in order, none while blocked, none after a dismissal', () => {
    resetModalQueue();
    const all: Partial<Record<UtModal, boolean>> = { interrupted: true, launch: true, newEra: true };
    expect(nextModal(all, false)).toBe('interrupted');
    expect(nextModal(all, true)).toBeNull();
    expect(nextModal({ newEra: true }, false)).toBe('newEra');
    expect(nextModal({ launch: true, newEra: true }, false, new Set<UtModal>(['launch']))).toBe('newEra');
    expect(nextModal({}, false)).toBeNull();
  });
});

describe('the session summary (' + SPORT + ')', () => {
  const base = (): Profile => {
    useStorage(new MemoryStorage());
    return loadProfile();
  };
  it('a short visit that earned nothing says nothing', () => {
    const p = base(),
      now = Date.parse('2026-11-10T17:00:00Z');
    expect(sessionSummary(markSession(p, now), p, now + QUIET_MS - 1)).toBeNull();
  });
  it('coins, packs and active minutes earned, then tomorrow', () => {
    const p = base(),
      now = Date.parse('2026-11-10T17:00:00Z'),
      day = easternClock(now).day;
    const m = markSession({ ...p, playtime: { ...(p.playtime as object), day, daySec: 600 } as Profile['playtime'] }, now);
    const after = {
      ...p,
      coins: p.coins + 350,
      ut: { ...p.ut, packs: [...p.ut.packs, { id: 'x', kind: 'gold', at: now }], packsOpened: p.ut.packsOpened + 1 },
      playtime: { ...(p.playtime as object), day, daySec: 600 + 14 * 60 + 20 } as Profile['playtime'],
    };
    const s = sessionSummary(m, after, now + 15 * 60000)!;
    expect(s.earned).toBe('This visit: +350 coins · 2 packs · 14 active min');
    expect(s.tomorrow).toMatch(/^Tomorrow: Daily Drop Day 1 of 7 · 3 new objectives$/);
    expect(summaryText(s)).toBe(s.earned + '. ' + s.tomorrow + '.');
  });
  it('spending more than earning shows no negative coins', () => {
    const p = base(),
      now = Date.parse('2026-11-10T17:00:00Z');
    const s = sessionSummary(markSession(p, now), { ...p, coins: p.coins - 500 }, now + 5 * 60000)!;
    expect(s.earned).toBeNull();
    expect(summaryText(s)).toMatch(/^Tomorrow: /);
  });
});
