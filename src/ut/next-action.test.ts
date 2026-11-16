// Claude, 2026-11-16 (studio overhaul, team ut-1): the next best action (V2 D.5) and the One-More rules
// (V2 D.10). One case per priority level, each `after` rule, the recency tie-break, the three sports'
// "one score", the never-Done-while-claimable property, and the speed budget (≤ 2 ms on a 3,000-card,
// 5,000-claim club). Runs in soccer through soccer-claimables.test.ts.
import { describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { utClaimables, writePoolCache, poolSig } from './claimables';
import { emptyTotals, freshHQ } from './hq-state';
import { nearMisses } from './near-miss';
import { DAILY_BONUS_LINE, nextCtxOf, nextUp, ONE_SCORE, type AfterCtx, type NextCtx } from './next-action';
import { objectiveDeck, seasonFor, weekKey } from './objectives';
import { freshUt, type UtState } from './state';
import type { UtSport } from './types';

const DAY = '2026-11-17'; // a Tuesday
const WEEK = weekKey(DAY);
const NOON = Date.parse(DAY + 'T17:00:00Z'); // 12:00 Eastern
const SUNDAY = '2026-11-22';
const SEASON = seasonFor(DAY).id;

/** A settled club with nothing waiting: today's Daily Drop and calendar claimed, starter opened. */
function club(day = DAY): UtState {
  const ut = freshUt();
  ut.starterClaimed = true;
  ut.content = { daily: { day, streak: 3, total: 9 }, calendar: { day, n: 4 } };
  ut.hq = freshHQ();
  ut.owned = [{ uid: 'u1', cardId: 'c1', level: 1, xp: 0, at: 1 }];
  ut.battles = { week: weekKey(day), cleared: 2, best: 4, level: 'pro' };
  return ut;
}
const ctx = (ut: UtState, extras: Parameters<typeof nextCtxOf>[3] = {}, now = NOON, sport: UtSport = SPORT) => nextCtxOf(ut, sport, now, extras);
const today = (ut: UtState, t: Partial<ReturnType<typeof emptyTotals>>, day = DAY) => {
  ut.hq!.days[day] = { ...emptyTotals(), ...t };
};
const allDailiesClaimed = (ut: UtState, day = DAY) => {
  today(ut, { games: 3, wins: 2, points: 60 }, day);
  ut.hq!.claims.push(...['show-up', 'winner', 'score'].map((id) => 'daily:' + day + ':' + id));
  ut.content!.claims = [...(ut.content!.claims ?? []), 'daily-bonus:' + day];
};

describe('next best action: the D.5 priority list (' + SPORT + ')', () => {
  it('1. unclaimed rewards first: CLAIM ALL into the Rewards inbox', () => {
    const ut = club();
    ut.content = {}; // Daily Drop and calendar waiting
    const a = nextUp(ctx(ut));
    expect(a).toMatchObject({ id: 'claim', cta: 'CLAIM ALL', line: '2 rewards to claim', target: { app: 'ut', view: 'inbox' } });
  });
  it('1. one reward names itself', () => {
    const ut = club();
    ut.content = { calendar: { day: DAY, n: 4 } };
    expect(nextUp(ctx(ut))).toMatchObject({ id: 'claim', cta: 'CLAIM', line: 'Daily Drop · day 1 · ready' });
  });
  it("1. another sport's rewards, read from its stored count", () => {
    const other: UtSport = SPORT === 'nba' ? 'nfl' : 'nba';
    const a = nextUp(ctx(club(), { elsewhere: [{ sport: SPORT, count: 9 }, { sport: other, count: 3 }] }));
    expect(a.id).toBe('claim:' + other);
    expect(a.target).toEqual({ app: 'ut', view: 'inbox', sport: other });
  });
  it('1. the first-run starter pack', () => {
    const ut = club();
    ut.starterClaimed = false;
    expect(nextUp(ctx(ut))).toMatchObject({ id: 'starter', cta: 'OPEN' });
  });
  it('1. Minutes rungs count with the claims (ut-2 slot)', () => {
    expect(nextUp(ctx(club(), { minutes: { n: 1, line: '30 min reward ready' } }))).toMatchObject({ id: 'claim', line: '30 min reward ready', target: { app: 'minutes' } });
  });
  it('2. an unfinished run: RESUME the most recently played one (recency tie-break)', () => {
    const ut = club();
    ut.hq!.circuit = { week: WEEK, entries: 1, best: 0, claimed: [], active: { id: 'c', games: 3, wins: 3, results: [true, true, true], at: 100 } };
    ut.content!.draft = { active: { id: 'd', at: 500, week: WEEK, paid: 'token', captains: [], squad: {}, games: 1, wins: 1, results: [true], done: false } };
    expect(nextUp(ctx(ut))).toMatchObject({ id: 'run:draft', cta: 'RESUME', target: { app: 'ut', view: 'draft' } });
    ut.hq!.history.push({ id: 'm', at: 900, mode: 'circuit', won: true, us: 3, them: 1, opponent: 'X', coins: 0, xp: 0 });
    const a = nextUp(ctx(ut));
    expect(a.id).toBe('run:circuit');
    expect(a.line).toBe('1 win to Finalist · Champions Circuit');
  });
  it('3. the streak slot (ut-7) and the Daily Drop streak at risk, amber, at 9 pm', () => {
    const ut = club();
    ut.content = { daily: { day: '2026-11-16', streak: 4, total: 4 }, calendar: { day: DAY, n: 2 } };
    const nine = Date.parse(DAY + 'T02:00:00Z') + 86400000; // 21:00 Eastern on DAY
    const a = nextUp(ctx(ut, {}, nine));
    expect(a).toMatchObject({ id: 'claim', amber: true });
    expect(a.line).toContain('Day 5 streak ends at midnight');
    expect(nextUp(ctx(club(), { streak: { line: 'Play 1 match to keep your 6-day streak', target: { app: 'ut', view: 'battles' } } }))).toMatchObject({ id: 'streak', amber: true });
  });
  it('4. something ending within 24 h: a weekly objective one game short on Sunday', () => {
    const ut = club(SUNDAY);
    ut.hq!.weeks[weekKey(SUNDAY)] = { ...emptyTotals(), games: 9 };
    const a = nextUp(ctx(ut, {}, Date.parse(SUNDAY + 'T17:00:00Z')));
    expect(a).toMatchObject({ id: 'ending:weekly:' + weekKey(SUNDAY) + ':compete', amber: true, stake: 'Gold Pack' });
    expect(a.line).toBe('1 game to a weekly objective · ends tonight');
    // the same club on Tuesday has no clock running
    const tue = club();
    tue.hq!.weeks[WEEK] = { ...emptyTotals(), games: 9 };
    expect(nextUp(ctx(tue)).amber).toBeFalsy();
  });
  it('5. one or two steps from a milestone: Rivals division, and the closest milestone wins', () => {
    const ut = club();
    ut.rivals = { week: WEEK, points: 60, best: 60, peak: 0, w: 2, l: 0, seen: [], rewards: [], claimed: [] };
    expect(nextUp(ctx(ut))).toMatchObject({ id: 'milestone:rivals:Rookie', line: '1 win to Rookie · Rivals' });
    const m = nextUp(ctx(ut, { milestones: [{ id: 'minutes:day:30', steps: 1, line: '3 min to 75 coins', target: { app: 'minutes' } }] }));
    expect(m.id).toBe('milestone:rivals:Rookie' < 'minutes:day:30' ? 'milestone:rivals:Rookie' : 'minutes:day:30');
  });
  it('6. the Daily Play when unplayed (B1 slot)', () => {
    expect(nextUp(ctx(club(), { dailyPlay: { line: 'Daily Play ready · 75 coins', target: { app: 'ut', view: 'hub' } } }))).toMatchObject({ id: 'daily-play', cta: 'PLAY' });
  });
  it("7. a daily objective at 2 of 3: the true distance to today's bonus", () => {
    const ut = club();
    today(ut, { games: 2, wins: 1, points: 20 });
    ut.hq!.claims.push('daily:' + DAY + ':show-up', 'daily:' + DAY + ':winner');
    expect(nextUp(ctx(ut))).toMatchObject({ id: 'daily-last', line: "4 points to today's three objectives" });
  });
  it('8. Season Pass within 30% of a named reward', () => {
    const ut = club();
    allDailiesClaimed(ut);
    ut.hq!.seasons[SEASON] = { xp: 1400, claimed: [1, 2, 3, 4] }; // level 5 (Gold Pack) at 1,500
    const a = nextUp(ctx(ut));
    expect(a).toMatchObject({ id: 'pass', line: '100 SP to level 5 · Season Pass', stake: 'Gold Pack' });
    ut.hq!.seasons[SEASON] = { xp: 1000, claimed: [1, 2, 3] };
    expect(nextUp(ctx(ut)).id).not.toBe('pass');
  });
  it('9. a new program wave (packs slot)', () => {
    expect(nextUp(ctx(club(), { wave: { line: 'New program wave', target: { app: 'ut', view: 'store' } } }))).toMatchObject({ id: 'wave' });
  });
  it('10. unopened packs or picks', () => {
    const ut = club();
    ut.packs = [{ id: 'p1', kind: 'gold', at: 1 }, { id: 'p2', kind: 'silver', at: 2 }];
    expect(nextUp(ctx(ut))).toMatchObject({ id: 'packs', line: '2 packs to open', cta: 'OPEN' });
  });
  it('11. the best next match in your recent mode, with its stake', () => {
    const a = nextUp(ctx(club()));
    expect(a).toMatchObject({ id: 'play', cta: 'PLAY', target: { app: 'match', setup: { mode: 'battles', rung: 2, level: 'pro' } } });
    expect(a.line).toBe('Squad Battles · Pro rung 3 of 8');
  });
  it("12. Done for today once the day's goals are met: calm, KEEP PLAYING, never pushed", () => {
    const ut = club();
    allDailiesClaimed(ut);
    const a = nextUp(ctx(ut));
    expect(a).toMatchObject({ id: 'done', done: true, cta: 'KEEP PLAYING' });
    expect(a.line).toMatch(/^Done for today/);
    const capped = club();
    capped.paid = { day: DAY, n: 8 };
    expect(nextUp(ctx(capped)).done).toBe(true);
    expect(nextUp(ctx(club(), { minutesCapped: true })).done).toBe(true);
  });
  it('never Done for today while anything is claimable, on Home or on the One-More bar (fuzzed over 400 clubs)', () => {
    let seed = 7;
    const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const modes: AfterCtx['mode'][] = ['battles', 'cup', 'circuit', 'league', 'draft', 'rivals', 'events'];
    const levels = ['rookie', 'pro', 'allstar', 'legend'] as const;
    let calm = 0,
      calmAfter = 0;
    for (let i = 0; i < 400; i++) {
      const ut = club();
      if (r() < 0.6) allDailiesClaimed(ut);
      if (r() < 0.3) ut.content!.calendar = undefined;
      if (r() < 0.2) ut.content!.daily = undefined;
      if (r() < 0.3) ut.hq!.claims = ut.hq!.claims.filter((c) => !c.endsWith(':score'));
      if (r() < 0.3) ut.paid = { day: DAY, n: 8 };
      if (r() < 0.2) ut.hq!.seasons[SEASON] = { xp: Math.floor(r() * 7500), claimed: [] };
      if (r() < 0.2) ut.packs = [{ id: 'p', kind: 'gold', at: 1 }];
      if (r() < 0.1) ut.starterClaimed = false;
      const elsewhere = r() < 0.2 ? [{ sport: 'nfl' as UtSport, count: 1 }] : [];
      const minutes = r() < 0.15 ? { n: 1, line: '30 min reward ready' } : null;
      const won = r() < 0.5,
        us = Math.floor(r() * 30),
        them = won ? Math.max(0, us - 1 - Math.floor(r() * 10)) : us + 1 + Math.floor(r() * 10);
      const after: AfterCtx = {
        mode: modes[Math.floor(r() * modes.length)],
        won,
        us,
        them,
        lossStreak: won ? 0 : 1 + Math.floor(r() * 4),
        flawless: won && r() < 0.3,
        rung: Math.floor(r() * 8),
        level: levels[Math.floor(r() * 4)],
        runContinues: r() < 0.5,
      };
      for (const extras of [{ elsewhere, minutes, minutesCapped: r() < 0.2 }, { elsewhere, minutes, minutesCapped: r() < 0.2, after }]) {
        const c = ctx(ut, extras);
        const a = nextUp(c);
        const waits = c.claim.count > 0 || !!c.minutes?.n || c.elsewhere.length > 0 || c.starter || c.packs > 0 || c.picks > 0;
        if (waits) expect(a.done, JSON.stringify(a)).toBeFalsy();
        if (waits) expect(a.line, JSON.stringify(a)).not.toMatch(/Done for today/);
        if (a.done) c.after ? calmAfter++ : calm++;
      }
    }
    // the property is not vacuous: both surfaces do go calm when nothing waits
    expect(calm).toBeGreaterThan(10);
    expect(calmAfter).toBeGreaterThan(10);
  });
});

describe('One-More after a match (V2 D.10) (' + SPORT + ')', () => {
  const after = (a: Partial<AfterCtx>, ut = club()): ReturnType<typeof nextUp> =>
    nextUp(ctx(ut, { after: { mode: 'battles', won: true, us: 10, them: 5, lossStreak: 0, rung: 2, level: 'pro', ...a } }));
  it('a loss by one score offers REMATCH first, by each sport\'s score', () => {
    for (const sport of ['nba', 'nfl', 'soccer'] as UtSport[]) {
      const c: NextCtx = { ...ctx(club(), {}, NOON, sport), after: { mode: 'cup', won: false, us: 10, them: 10 + ONE_SCORE[sport], lossStreak: 1 } };
      expect(nextUp(c)).toMatchObject({ id: 'after:rematch', cta: 'REMATCH', target: { app: 'match', setup: { mode: 'cup', rematch: true } } });
      const wide: NextCtx = { ...c, after: { ...c.after!, them: 11 + ONE_SCORE[sport] } };
      expect(nextUp(wide).id).not.toBe('after:rematch');
    }
  });
  it('a third straight loss offers a lower rung, not the same game again', () => {
    expect(after({ won: false, us: 2, them: 3, lossStreak: 3 })).toMatchObject({ id: 'after:easier', target: { setup: { rung: 1, level: 'pro' } } });
    expect(after({ won: false, us: 0, them: 30, lossStreak: 3, rung: 0, level: 'allstar' })).toMatchObject({ id: 'after:easier', target: { setup: { rung: 0, level: 'pro' } } });
  });
  it('a third straight loss at the bottom offers a practice drill (no Moments in soccer)', () => {
    const a = after({ won: false, us: 0, them: 30, lossStreak: 3, rung: 0, level: 'rookie' });
    if (SPORT === 'soccer') expect(a.id).not.toBe('after:drill');
    else expect(a).toMatchObject({ id: 'after:drill', target: { app: 'ut', view: 'moments' } });
  });
  it('a FLAWLESS win says so and offers the harder rung', () => {
    const a = after({ flawless: true });
    expect(a).toMatchObject({ id: 'after:harder', target: { setup: { rung: 3, level: 'pro' } }, stake: 'Silver Pack' });
    expect(a.line).toMatch(/^FLAWLESS/);
    expect(after({ flawless: true, rung: 7, level: 'pro' })).toMatchObject({ target: { setup: { rung: 0, level: 'allstar' } } });
  });
  it('a run continues: the next Cup round, Circuit game, season or draft game', () => {
    const ut = club();
    ut.cup = { claims: [], trophies: { open: 0, silver: 0, chemistry: 0 }, history: [], active: { id: 'k', kind: 'open', week: WEEK, sport: SPORT, level: 'pro', anchor: 80, at: 5, round: 1, results: [{ id: 'r', won: true, us: 3, them: 1, at: 6 }], done: false } };
    expect(after({ mode: 'cup', runContinues: true }, ut)).toMatchObject({ id: 'after:run:cup', line: 'Club Cups · round 2 of 3', cta: 'NEXT' });
  });
  it('a Squad Battles win moves to the next rung and names its pack', () => {
    expect(after({})).toMatchObject({ id: 'after:battles', line: '1 win to Silver Pack · Squad Battles · Pro rung 4 of 8', stake: 'Silver Pack' });
    // the save as settled by that win (cleared 3) reads the same
    const settled = club();
    settled.battles = { week: WEEK, cleared: 3, best: 4, level: 'pro' };
    expect(after({}, settled)).toMatchObject({ id: 'after:battles', stake: 'Silver Pack' });
  });
  it('a rung pays its pack only on its first clear this week: no stake on a replay or a cleared ladder', () => {
    // replaying rung 2 (index 1) when 6 are cleared: rung 3 pays coins only this week
    const ut = club();
    ut.battles = { week: WEEK, cleared: 6, best: 6, level: 'pro' };
    const replay = after({ rung: 1 }, ut);
    expect(replay.stake).toBeUndefined();
    expect(replay.line).toBe('Squad Battles · Pro rung 3 of 8');
    expect(after({ flawless: true, rung: 2 }, ut)).toMatchObject({ id: 'after:harder' });
    expect(after({ flawless: true, rung: 2 }, ut).stake).toBeUndefined();
    // an old save that cleared all 8 this week: nothing on the ladder pays a pack
    const full = club();
    full.battles = { week: WEEK, cleared: 8, best: 8, level: 'pro' };
    const n = nextUp(ctx(full));
    expect(n).toMatchObject({ id: 'play', line: 'Squad Battles · Pro rung 8 of 8' });
    expect(n.stake).toBeUndefined();
    // last week's ladder doesn't count: this week starts at rung 1, and rung 4 pays again
    const old = club();
    old.battles = { week: '2026-W01', cleared: 6, best: 6, level: 'pro' };
    expect(nextUp(ctx(old)).line).toBe('Squad Battles · Pro rung 1 of 8');
    expect(after({ rung: 2 }, old)).toMatchObject({ stake: 'Silver Pack' });
  });
  it('a FLAWLESS win on the top Legend rung offers the new ladder, never a Premium Pack it already paid', () => {
    const ut = club();
    ut.battles = { week: WEEK, cleared: 0, best: 8, level: 'legend', round: 1 }; // settled: the ladder refreshed
    const a = after({ flawless: true, rung: 7, level: 'legend' }, ut);
    expect(a).toMatchObject({ id: 'after:battles', line: 'Squad Battles · Legend rung 1 of 8', target: { setup: { rung: 0, level: 'legend' } } });
    expect(a.stake).toBeUndefined();
  });
  it('no pack once the day\'s paid games are played (a capped win pays nothing)', () => {
    const ut = club();
    ut.paid = { day: DAY, n: 8 };
    expect(after({}).stake).toBe('Silver Pack');
    const a = after({}, ut);
    expect(a.stake).toBeUndefined();
    expect(a.line).not.toMatch(/Pack/);
  });
  it('rewards waiting keep the bar from going calm (the review cases)', () => {
    // all three dailies done and waiting to be claimed, then a Squad Battles win
    const ready = club();
    today(ready, { games: 3, wins: 2, points: 60 });
    const c1 = ctx(ready, { after: { mode: 'battles', won: true, us: 10, them: 5, lossStreak: 0, rung: 2, level: 'pro' } });
    expect(c1.claim.count).toBeGreaterThan(0);
    expect(nextUp(c1).done).toBeFalsy();
    expect(nextUp(c1).line).not.toMatch(/Done for today/);
    // the paid cap reached with the Daily Drop and calendar waiting, after a loss by one point
    const capped = club();
    capped.paid = { day: DAY, n: 8 };
    capped.content = {};
    const c2 = ctx(capped, { after: { mode: 'cup', won: false, us: 10, them: 11, lossStreak: 1 } });
    expect(c2.claim.count).toBe(2);
    expect(nextUp(c2)).toMatchObject({ id: 'after:rematch', cta: 'REMATCH' });
    expect(nextUp(c2).done).toBeFalsy();
  });
  it("after the day's goals the bar turns calm: Done for today · KEEP PLAYING, the match still one tap away", () => {
    const ut = club();
    allDailiesClaimed(ut);
    const a = after({}, ut);
    expect(a).toMatchObject({ done: true, cta: 'KEEP PLAYING', target: { app: 'match', setup: { mode: 'battles', rung: 3 } } });
  });
});

describe('near-miss chips (' + SPORT + ')', () => {
  it('at most three true distances, closest first, each leading somewhere', () => {
    const ut = club();
    ut.hq!.circuit = { week: WEEK, entries: 1, best: 0, claimed: [], active: { id: 'c', games: 2, wins: 2, results: [true, true], at: 1 } };
    ut.rivals = { week: WEEK, points: 60, best: 60, peak: 0, w: 2, l: 0, seen: [], rewards: [], claimed: [] };
    today(ut, { games: 1, wins: 1, points: 30 });
    ut.hq!.claims.push('daily:' + DAY + ':winner', 'daily:' + DAY + ':score');
    ut.hq!.seasons[SEASON] = { xp: 1380, claimed: [] };
    const chips = nearMisses(ut, SPORT, NOON);
    expect(chips.length).toBe(3);
    expect(chips.every((c) => c.steps >= 1 && c.steps <= 2 && c.go.view)).toBe(true);
    expect(chips.map((c) => c.steps)).toEqual([...chips.map((c) => c.steps)].sort((a, b) => a - b));
    expect(chips.map((c) => c.text)).toContain("1 game to today's bonus");
    expect(nearMisses(ut, SPORT, NOON)).toEqual(chips); // deterministic
  });
  it("the bonus chip names today's whole bonus; the Season Pass chip leads to a match, where SP is earned", () => {
    const ut = club();
    today(ut, { games: 1, wins: 1, points: 30 });
    ut.hq!.claims.push('daily:' + DAY + ':winner', 'daily:' + DAY + ':score');
    ut.hq!.seasons[SEASON] = { xp: 1380, claimed: [] };
    const chips = nearMisses(ut, SPORT, NOON);
    expect(chips.find((c) => c.id === 'daily')!.stake).toBe(DAILY_BONUS_LINE);
    expect(DAILY_BONUS_LINE).toBe('100 coins + Silver Pack');
    expect(chips.find((c) => c.id === 'pass')!.go).toEqual({ view: 'battles', label: 'PLAY' });
  });
  it('no Squad Battles pack chip once the rung is paid this week or the paid games are played', () => {
    const ut = club();
    ut.battles = { week: WEEK, cleared: 3, best: 3, level: 'pro' }; // rung 4 pays a Silver Pack
    expect(nearMisses(ut, SPORT, NOON).find((c) => c.id === 'battles')?.text).toBe('1 win to Silver Pack');
    ut.paid = { day: DAY, n: 8 };
    expect(nearMisses(ut, SPORT, NOON).find((c) => c.id === 'battles')).toBeUndefined();
    const full = club();
    full.battles = { week: WEEK, cleared: 8, best: 8, level: 'pro' };
    expect(nearMisses(full, SPORT, NOON).find((c) => c.id === 'battles')).toBeUndefined();
  });
  it('no chip for a goal out of reach (a Circuit prize the games left cannot reach)', () => {
    const ut = club();
    ut.battles = { week: WEEK, cleared: 0, best: 0, level: 'pro' }; // rung 1 pays nothing
    ut.hq!.circuit = { week: WEEK, entries: 1, best: 0, claimed: [], active: { id: 'c', games: 5, wins: 0, results: [false, false, false, false, false], at: 1 } };
    expect(nearMisses(ut, SPORT, NOON).find((c) => c.id === 'circuit')).toBeUndefined();
  });
});

describe('speed: a long-lived club (3,000 cards, 6,200 receipts, a year of days)', () => {
  // ut-1 review: realistic ids and a year of banked days and weeks, the shape a daily player reaches
  function big(): UtState {
    const ut = club();
    ut.owned = Array.from({ length: 3000 }, (_, i) => ({ uid: SPORT + '-ut-copy-' + i.toString(36) + '-x7f3k2', cardId: SPORT + ':base:player-name-' + (i % 2200) + ':2019', level: 1 + (i % 5), xp: i, at: i }));
    ut.collected = Array.from({ length: 2600 }, (_, i) => SPORT + ':base:player-name-' + i + ':2019');
    const claims: string[] = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.parse('2025-11-16T12:00:00Z') + i * 86400000).toISOString().slice(0, 10);
      ut.hq!.days[d] = { ...emptyTotals(), games: 4, wins: 2, points: 60 };
      for (const id of ['show-up', 'winner', 'score']) claims.push('daily:' + d + ':' + id);
      if (i % 3) claims.push('calendar:' + d, 'drop:' + d, 'season:' + d);
    }
    for (let w = 0; w < 52; w++) {
      const k = weekKey(new Date(Date.parse('2025-11-16T12:00:00Z') + w * 7 * 86400000).toISOString().slice(0, 10));
      ut.hq!.weeks[k] = { ...emptyTotals(), games: 12, wins: 6, sbcs: 2 };
      for (const id of ['compete', 'wins', 'builder']) claims.push('weekly:' + k + ':' + id);
    }
    while (claims.length < 6200) claims.push('lifetime:receipt-' + claims.length);
    ut.hq!.claims = claims;
    ut.hq!.journal = Array.from({ length: 5000 }, (_, i) => 'match:' + i);
    ut.content!.claims = Array.from({ length: 5000 }, (_, i) => 'set:x' + i);
    ut.hq!.history = Array.from({ length: 20 }, (_, i) => ({ id: 'h' + i, at: i, mode: 'battle' as const, won: true, us: 3, them: 1, opponent: 'A', coins: 1, xp: 1 }));
    return writePoolCache(ut, poolSig(ut, SPORT), 1);
  }
  // the 10th percentile of 41 runs: the cost of the work itself, not of a neighbour's build on the
  // shared machine (a median read 2.16 ms once under load; today's numbers are about 0.4 ms)
  const p10 = (f: () => void) => {
    for (let i = 0; i < 15; i++) f();
    const t: number[] = [];
    for (let i = 0; i < 41; i++) {
      const s = performance.now();
      f();
      t.push(performance.now() - s);
    }
    return t.sort((a, b) => a - b)[4];
  };
  it('utClaimables ≤ 2 ms and nextUp (with its context) ≤ 2 ms', () => {
    const ut = big();
    const c = p10(() => utClaimables(ut, DAY, WEEK, SPORT, NOON));
    const n = p10(() => nextUp(nextCtxOf(ut, SPORT, NOON)));
    const m = p10(() => nearMisses(ut, SPORT, NOON));
    console.log('speed (p10 of 41): utClaimables ' + c.toFixed(3) + ' ms, nextCtxOf + nextUp ' + n.toFixed(3) + ' ms, nearMisses ' + m.toFixed(3) + ' ms');
    expect(utClaimables(ut, DAY, WEEK, SPORT, NOON).approx).toBe(false);
    expect(c).toBeLessThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(2);
    expect(m).toBeLessThanOrEqual(2);
  });
  it('the memoised receipts and card counts follow a new save (arrays are replaced, and a push is seen)', () => {
    const ut = big();
    const ready = (u: UtState) => objectiveDeck(u, DAY).filter((o) => o.period === DAY && !o.claimed && o.progress >= o.target).length;
    const lifetime = (u: UtState) => objectiveDeck(u, DAY).find((o) => o.id === 'lifetime:club-50')!.progress;
    expect(ready(ut)).toBe(0);
    // a new day's three objectives done: a replaced hq.days, the same receipts array
    const done = { ...ut, hq: { ...ut.hq!, days: { ...ut.hq!.days, [DAY]: { ...emptyTotals(), games: 3, wins: 2, points: 60 } } } };
    expect(ready(done)).toBe(3);
    // claiming them: a replaced receipts array
    const claimed = { ...done, hq: { ...done.hq, claims: [...done.hq.claims, ...['show-up', 'winner', 'score'].map((id) => 'daily:' + DAY + ':' + id)] } };
    expect(ready(claimed)).toBe(0);
    // an in-place push (tests do this) is still seen
    done.hq.claims.push('daily:' + DAY + ':show-up');
    expect(ready(done)).toBe(2);
    // the collected count follows a replaced owned list
    const fresh = { ...ut, owned: [], collected: [] };
    expect(lifetime(ut)).toBe(50);
    expect(lifetime(fresh)).toBe(0);
    expect(lifetime({ ...fresh, collected: ['a', 'b'] })).toBe(2);
  });
});
