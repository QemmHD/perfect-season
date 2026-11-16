// Claude, 2026-11-16 (studio overhaul, team ut; V2 E.5, E.6): the MINUTES ladders, claims, rested
// bonus, endowed start, the lean table and the league maths, against the design's own numbers.
import { describe, expect, it } from 'vitest';
import { mergePlaytime } from '../lib/cloud-data';
import { credit, type Playtime } from '../lib/playtime';
import type { Profile } from '../lib/profile';
import {
  claimMinutes,
  coinValue,
  freshForMinutes,
  LADDERS,
  ladders,
  leagueResult,
  leagueReward,
  leagueSeason,
  MINUTES_TABLE,
  minutesExtras,
  minutesView,
  nextRung,
  PACK_VALUE,
  rewardText,
  seasonEndTier,
  type MinutesTable,
  type WeekEntry,
} from './minutes';
import { PACK_SHAPE } from './packs';

const DAY = 86400_000;
const MON = Date.parse('2026-11-16T15:00:00Z'); // Monday 10:00 ET
const NIGHT = 8.5 * 3600_000; // to 18:30 ET the same day
const play = (pt: Playtime | undefined, min: number, at: number, menu = 0) => credit(pt, { sec: min * 60, menu: menu * 60, raw: (min + menu) * 60, sport: 'nba', act: Math.ceil(min / 5) }, at);

function profile(pt?: Playtime, extra: Partial<Profile> = {}): Profile {
  return {
    coins: 1000,
    stats: { games: 4 },
    history: [],
    ut: { packs: [], record: { w: 2, l: 1, h2hW: 0, h2hL: 0 } },
    ...(pt ? { playtime: pt } : {}),
    ...extra,
  } as unknown as Profile;
}

describe('the E.5 tables', () => {
  it('full: daily 5/15/30/60/90 and weekly 60/150/300/450/600 with the design’s rewards', () => {
    expect(MINUTES_TABLE).toBe('full');
    expect(LADDERS.daily.map((r) => [r.at, rewardText(r.reward)])).toEqual([
      [5, '25 coins'],
      [15, '50 coins'],
      [30, '75 coins + a Scout Stamp'],
      [60, 'Silver Pack + 50 coins'],
      [90, '50 coins'],
    ]);
    expect(LADDERS.daily[4].reward.done).toBe(true);
    expect(LADDERS.weekly.map((r) => [r.at, rewardText(r.reward)])).toEqual([
      [60, '150 coins'],
      [150, 'Silver Pack'],
      [300, 'Gold Pack'],
      [450, '400 coins'],
      [600, 'Premium Pack'],
    ]);
    expect(LADDERS.weekly[4].reward.flair).toBe('Iron Man week');
    expect(LADDERS.life.map((r) => r.at / 60)).toEqual([1, 5, 10, 25, 50, 100, 250, 500, 1000]);
    // power stops at 25 hours: after it, status only
    expect(LADDERS.life.slice(4).every((r) => !r.reward.coins && !r.reward.pack && !r.reward.pick)).toBe(true);
    expect(rewardText(LADDERS.life[3].reward)).toBe('a Player Pick (84+)');
  });
  it('daily ≈ 450 (250 coins + Silver + a stamp), weekly ≈ 2,100', () => {
    const sum = (rs: { reward: Parameters<typeof coinValue>[0] }[]) => rs.reduce((a, r) => a + coinValue(r.reward), 0);
    expect(LADDERS.daily.reduce((a, r) => a + (r.reward.coins ?? 0), 0)).toBe(250);
    expect(sum(LADDERS.daily)).toBe(450);
    expect(sum(LADDERS.weekly)).toBe(2100);
  });
  // Wave 1: packs-2 re-priced the NBA Silver/Gold packs (500 / 1,050; Premium stays 1,800). MINUTES has no
  // claim screen in Wave 1, so its economy table keeps the prices it was designed on until team ut re-runs
  // the coin flow against packs' prices (ut.md integration checklist item 10) and moves PACK_VALUE.
  it('pack values are quick-sell of the prices the table was designed on (Premium still half the NBA price)', () => {
    expect(PACK_VALUE).toEqual({ silver: 200, gold: 450, premium: 900 });
    expect(PACK_VALUE.premium).toBe(PACK_SHAPE.nba.price.premium / 2);
  });
  it('lean: ladder coins × 0.6, a Gold for the 600 rung, the 60-minute Silver on weekdays only', () => {
    const L = ladders('lean');
    expect(L.daily.map((r) => r.reward.coins)).toEqual([15, 30, 45, 30, 30]);
    expect(L.weekly.map((r) => coinValue(r.reward))).toEqual([90, 200, 450, 240, 450]);
    const sat = profile(play(undefined, 61, MON + 5 * DAY));
    const v = minutesView(sat.playtime, MON + 5 * DAY, false, 'lean');
    expect(v.day.rungs[3].reward).toEqual({ coins: 30 });
    expect(minutesView(play(undefined, 61, MON), MON, false, 'lean').day.rungs[3].reward.pack).toBe('silver');
  });
});

/** A week of `perDay` counted minutes, claimed every evening: coin-equivalents a day from the day and week ladders. */
function weekValue(perDay: number[], table: MinutesTable = 'full'): number {
  let p = profile();
  let total = 0;
  perDay.forEach((min, d) => {
    const at = MON + d * DAY + NIGHT;
    p = { ...p, playtime: play(p.playtime, min, at - 3600_000) };
    const r = claimMinutes(p, at, 'nba', table);
    const v = minutesView(p.playtime, at, false, table);
    // value only the day and week rungs this claim paid
    total += v.ready.filter((x) => x.track !== 'life').reduce((a, x) => a + coinValue(x.reward), 0);
    p = r.profile;
  });
  return total / 7;
}

describe('what MINUTES adds per day (E.5 table)', () => {
  it('casual ≈ 96, regular ≈ 200, engaged ≈ 514, maximum ≈ 750 (hard ceiling)', () => {
    expect(Math.round(weekValue([17, 17, 17, 17, 17, 17, 17]))).toBe(96);
    expect(Math.round(weekValue([30, 30, 30, 30, 30, 30, 30]))).toBe(200);
    expect(Math.round(weekValue([60, 60, 60, 60, 60, 60, 60]))).toBe(514);
    expect(Math.round(weekValue([90, 90, 90, 90, 90, 90, 90]))).toBe(750);
    // a third hour pays nothing more
    expect(Math.round(weekValue([180, 180, 180, 180, 180, 180, 180]))).toBe(750);
  });
  it('raw coins from time stay below match coins (engaged: 221 a day against ≈ 384)', () => {
    const coinsOnly = LADDERS.daily.slice(0, 4).reduce((a, r) => a + (r.reward.coins ?? 0), 0) + (LADDERS.weekly[0].reward.coins ?? 0) / 7;
    expect(Math.round(coinsOnly)).toBe(221);
    expect(coinsOnly).toBeLessThan(384);
  });
  it('lean is cheaper on every row', () => {
    for (const m of [17, 30, 60, 90]) expect(weekValue(Array(7).fill(m), 'lean')).toBeLessThan(weekValue(Array(7).fill(m)));
  });
});

describe('claims', () => {
  it('every rung of the three ladders pays once: a second claim grants nothing', () => {
    // Sunday evening, 600 min this week, 90 today, 1,000 h lifetime
    let pt = play(undefined, 90, MON + 6 * DAY);
    pt = { ...pt, weekDays: [90, 90, 90, 90, 90, 90, 90].map((m) => m * 60), life: 1000 * 3600 };
    const p = profile(pt);
    const first = claimMinutes(p, MON + 6 * DAY + 3600_000, 'nba');
    expect(first.granted).toHaveLength(5 + 5 + 9);
    const again = claimMinutes(first.profile, MON + 6 * DAY + 7200_000, 'nba');
    expect(again.granted).toEqual([]);
    expect(again.profile).toBe(first.profile);
    // coins: daily 250 + weekly 550 + lifetime 1,000
    expect(first.profile.coins - p.coins).toBe(250 + 550 + 1000);
    expect(first.profile.ut.packs.map((x) => x.kind).sort()).toEqual(['gold', 'gold', 'premium', 'premium', 'silver', 'silver']);
    expect(first.profile.ut.packs.every((x) => x.id.startsWith('minutes:') && x.id.includes(':nba:'))).toBe(true);
    // stamps and the Player Pick wait for packs' API as owed receipts
    expect(first.profile.playtime!.owed).toEqual(['stamp:day:2026-11-22:30:0', 'pick:life:life:1500']);
  });
  it('rungs reached on another day are not paid today; the daily ladder starts over at midnight ET', () => {
    const pt = play(undefined, 40, MON);
    const p = claimMinutes(profile(pt), MON + 600_000, 'nba').profile;
    expect(p.playtime!.claimed.day).toEqual([0, 1, 2]);
    const next = claimMinutes(p, MON + DAY, 'nba');
    expect(next.granted).toEqual([]);
    const later = { ...next.profile, playtime: play(next.profile.playtime, 6, MON + DAY) };
    const r = claimMinutes(later, MON + DAY + 600_000, 'nba');
    expect(r.granted).toEqual([{ coins: 25 }]);
    expect(r.profile.playtime!.claimed).toMatchObject({ day: [0], dayKey: '2026-11-17' });
  });
  it('a pack lands in the club of the sport you claim in', () => {
    const p = profile(play(undefined, 61, MON));
    const r = claimMinutes(p, MON + 1000, 'soccer');
    expect(r.profile.ut.packs).toHaveLength(2); // the daily Silver and the 1-hour Gold
    expect(r.profile.ut.packs[0].id).toContain(':soccer:');
  });
  it('a frozen day (the clock went back) pays no daily rung', () => {
    const pt = play(undefined, 40, MON + DAY);
    const v = minutesView(pt, MON, false);
    expect(v.frozen).toBe(true);
    expect(v.day.min).toBe(0);
    expect(claimMinutes(profile(pt), MON, 'nba').granted.filter((g) => g.coins && g.coins < 100)).toEqual([]);
  });
  it('two phones that each claimed before syncing never pay a rung twice, and keep every minute', () => {
    const base = play(undefined, 20, MON);
    const a = claimMinutes(profile(play(base, 15, MON + 1000)), MON + 2000, 'nba').profile.playtime!; // 35 min: 5, 15, 30
    const b = claimMinutes(profile(play(base, 50, MON + 1000)), MON + 2000, 'nba').profile.playtime!; // 70 min: 5, 15, 30, 60
    const merged = mergePlaytime(a, b)!;
    expect(merged.daySec).toBe(70 * 60);
    expect(merged.claimed.day).toEqual([0, 1, 2, 3]);
    expect(claimMinutes(profile(merged), MON + 3000, 'nba').granted).toEqual([]);
  });
});

describe('rested bonus and endowed start', () => {
  it('first day back after 3+ days away: 5/15/30 coins doubled once (+150), +60 weekly minutes once', () => {
    const before = play(undefined, 30, MON - 7 * DAY);
    const back = play(before, 31, MON + 3 * DAY); // Thursday, 9 days away
    expect(back.restedDay).toBe('2026-11-19');
    const v = minutesView(back, MON + 3 * DAY, false);
    expect(v.rested).toBe(true);
    expect(v.day.rungs.slice(0, 3).map((r) => r.reward.coins)).toEqual([50, 100, 150]);
    expect(v.week.min).toBe(31 + 60);
    const paid = claimMinutes(profile(back), MON + 3 * DAY + 1000, 'nba');
    expect(paid.profile.coins - 1000).toBe(300 + 150); // daily 50+100+150, weekly 60-rung 150
    // the next day is ordinary; the weekly credit stays for this week only
    const fri = play(paid.profile.playtime, 31, MON + 4 * DAY);
    expect(fri.restedDay).toBe('2026-11-19');
    expect(minutesView(fri, MON + 4 * DAY, false).day.rungs[0].reward.coins).toBe(25);
    expect(minutesView(fri, MON + 4 * DAY, false).week.min).toBe(62 + 60);
    expect(minutesView(fri, MON + 7 * DAY, false).week.min).toBe(0);
  });
  it('2 days away is not rested', () => {
    const before = play(undefined, 30, MON);
    expect(play(before, 10, MON + 3 * DAY).restedDay).toBeUndefined();
  });
  it('endowed: a profile with no ledger and no games starts with 3 of the first 5 minutes; any other profile does not', () => {
    const newbie = profile(undefined, { stats: { games: 0 } as Profile['stats'], ut: { packs: [], record: { w: 0, l: 0, h2hW: 0, h2hL: 0 } } as unknown as Profile['ut'] });
    expect(freshForMinutes(newbie)).toBe(true);
    expect(freshForMinutes(profile())).toBe(false);
    expect(freshForMinutes(profile(play(undefined, 1, MON)))).toBe(false);
    expect(minutesView(undefined, MON, true).day.min).toBe(3);
    expect(minutesView(undefined, MON, false).day.min).toBe(0);
    expect(nextRung(undefined, MON, true)).toMatchObject({ track: 'day', atMin: 5, minutesLeft: 2 });
    // the head start rides on the ledger for that day only
    const pt = credit(undefined, { sec: 60, menu: 0, raw: 60, sport: 'nba', act: 0 }, MON, true);
    expect(minutesView(pt, MON, false).day.min).toBe(4);
    expect(minutesView(play(pt, 1, MON + DAY), MON + DAY, false).day.min).toBe(1);
  });
});

describe('next rung and the next-action feed', () => {
  it('the nearest rung on any track; the day wins a tie; nothing once everything is reached', () => {
    expect(nextRung(play(undefined, 27, MON), MON)).toMatchObject({ track: 'day', atMin: 30, minutesLeft: 3 });
    const week = { ...play(undefined, 89, MON + 3 * DAY), weekDays: [60, 60, 60, 89, 0, 0, 0].map((m) => m * 60) };
    expect(nextRung(week, MON + 3 * DAY)).toMatchObject({ track: 'day', atMin: 90, minutesLeft: 1 });
    const capped = { ...play(undefined, 90, MON + 2 * DAY), weekDays: [90, 50, 90, 0, 0, 0, 0].map((m) => m * 60) };
    expect(nextRung(capped, MON + 2 * DAY)).toMatchObject({ track: 'week', atMin: 300, minutesLeft: 70 });
  });
  it('minutesExtras: the claimable line, the cap and a rung ≤ 5 minutes away', () => {
    const e = minutesExtras(play(undefined, 27, MON), MON);
    expect(e.minutes).toEqual({ n: 2, line: '2 Minutes rewards to claim' });
    expect(e.milestones).toEqual([{ id: 'minutes:day:30', steps: 2, line: '3 min to 75 coins + a Scout Stamp', target: { app: 'minutes' } }]);
    expect(e.minutesCapped).toBe(false);
    const one = claimMinutes(profile(play(undefined, 14, MON)), MON + 1, 'nba').profile;
    const e2 = minutesExtras(play(one.playtime, 1, MON + 2), MON + 3);
    expect(e2.minutes).toEqual({ n: 1, line: '15 min today: 50 coins to claim' });
    expect(minutesExtras(play(undefined, 95, MON), MON).minutesCapped).toBe(true);
  });
});

describe('the weekly league (E.6)', () => {
  const W = '2026-W48';
  const entry = (i: number, am: number, extra: Partial<WeekEntry> = {}): WeekEntry => ({ key: 'k' + i, name: 'P' + i, tier: 2, am, days: 5, acts: 20, at: 1000 + i, ...extra });
  it('31 entries: one division (30 rounds to 1), top 20% up, bottom 20% down', () => {
    const all = Array.from({ length: 31 }, (_, i) => entry(i, 600 - i * 10));
    const top = leagueResult(all, 'k0', 2, W);
    expect(top.mode).toBe('rank');
    expect(top.division).toHaveLength(31);
    expect(top).toMatchObject({ rank: 1, moved: 1, toPromote: 0, rival: null });
    expect(leagueResult(all, 'k5', 2, W).moved).toBe(1); // 6th of 31: top 6
    expect(leagueResult(all, 'k6', 2, W)).toMatchObject({ rank: 7, moved: 0, toPromote: 11, rival: { name: 'P5', gap: 10 } });
    expect(leagueResult(all, 'k30', 2, W).moved).toBe(-1);
  });
  it('60 entries split into two divisions of 30, the same on every phone', () => {
    const all = Array.from({ length: 60 }, (_, i) => entry(i, 100 + i));
    const a = leagueResult(all, 'k3', 2, W);
    expect(a.division).toHaveLength(30);
    expect(leagueResult([...all].reverse(), 'k3', 2, W).division.map((e) => e.key)).toEqual(a.division.map((e) => e.key));
    expect(leagueResult(all, 'k3', 2, '2026-W49').division.map((e) => e.key)).not.toEqual(a.division.map((e) => e.key));
  });
  it('30 entries: 6 up, 6 down; never down from Rookie; never up from Hall of Fame', () => {
    const all = Array.from({ length: 30 }, (_, i) => entry(i, 300 - i));
    expect(all.filter((e) => leagueResult(all, e.key, 2, W).moved === 1)).toHaveLength(6);
    expect(all.filter((e) => leagueResult(all, e.key, 2, W).moved === -1)).toHaveLength(6);
    const rookies = all.map((e) => ({ ...e, tier: 0 }));
    expect(leagueResult(rookies, 'k29', 0, W).moved).toBe(0);
    const hof = all.map((e) => ({ ...e, tier: 5 }));
    expect(leagueResult(hof, 'k0', 5, W)).toMatchObject({ moved: 0, toPromote: null });
  });
  it('9 entries: thresholds (≥ 300 up, < 60 down) and everyone shown; 1 entry: the league works alone', () => {
    const nine = [entry(0, 320), ...Array.from({ length: 7 }, (_, i) => entry(i + 1, 100 + i)), entry(8, 40)];
    expect(leagueResult(nine, 'k0', 2, W)).toMatchObject({ mode: 'threshold', moved: 1, toPromote: 0 });
    expect(leagueResult(nine, 'k8', 2, W).moved).toBe(-1);
    expect(leagueResult(nine, 'k3', 2, W)).toMatchObject({ moved: 0, toPromote: 198 });
    expect(leagueResult(nine, 'k3', 2, W).division).toHaveLength(9);
    const solo = [entry(0, 310, { tier: 0 })];
    expect(leagueResult(solo, 'k0', 0, W)).toMatchObject({ mode: 'threshold', rank: 1, moved: 1, rival: null });
    expect(leagueResult([], 'k0', 1, W)).toMatchObject({ rank: 0, moved: -1 });
  });
  it('0 minutes is not shown; ties go to more days, then more activities, then the earliest', () => {
    const tied = [entry(0, 200, { days: 4 }), entry(1, 200, { days: 5, acts: 10 }), entry(2, 200, { days: 5, acts: 12 }), entry(3, 200, { days: 5, acts: 12, at: 1 }), entry(4, 0)];
    expect(leagueResult(tied, 'k0', 2, W).division.map((e) => e.key)).toEqual(['k3', 'k2', 'k1', 'k0']);
  });
  it('rewards, seasons of 6 weeks, and the season-end drop above Pro', () => {
    const all = Array.from({ length: 30 }, (_, i) => entry(i, 300 - i));
    expect(leagueReward(leagueResult(all, 'k0', 2, W), 2)).toEqual({ pack: 'gold', flair: 'Crown of the week' });
    expect(leagueReward(leagueResult(all, 'k1', 1, W), 1)).toEqual({});
    expect(leagueReward(leagueResult(all.map((e) => ({ ...e, tier: 1 })), 'k1', 1, W), 1)).toEqual({ pack: 'silver' });
    expect(leagueReward(leagueResult(all, 'k10', 2, W), 2)).toEqual({ coins: 100 });
    expect(leagueReward(leagueResult(all, 'k29', 2, W), 2)).toEqual({});
    expect(leagueSeason('2026-W47')).toEqual({ season: 'S1', week: 1 });
    expect(leagueSeason('2026-W52')).toEqual({ season: 'S1', week: 6 });
    expect(leagueSeason('2026-W53')).toEqual({ season: 'S2', week: 1 });
    expect(leagueSeason('2027-W01')).toEqual({ season: 'S2', week: 2 });
    expect([0, 1, 2, 3, 4, 5].map(seasonEndTier)).toEqual([0, 1, 2, 2, 3, 4]);
  });
});
