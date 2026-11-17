// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5): the end-of-match recap (match-recap.ts)
// from real settlements (play.ts settle): what moved, by how much, and that a reward is reported once.
import { describe, expect, it } from 'vitest';
import { levelInfo, LEVEL_UP_COINS } from '../engine/economy';
import { SPORT } from '../engine/sport';
import { freshPlaytime } from '../lib/playtime';
import { freshHQ } from './hq-state';
import { buildRecap, milestonesOf, type RecapIn, verdictOf } from './match-recap';
import { addCareerXp, CAREER_XP, careerXp, PAID_GAMES_A_DAY, settle } from './play';
import { seasonFor, SEASON_STEP, weekKey } from './objectives';
import { DIVISIONS, rivalsOf } from './rivals';
import { freshUt, type UtState } from './state';

const DAY = '2026-11-17';
const WEEK = weekKey(DAY);
const NOON = Date.parse(DAY + 'T17:00:00Z');
const SEASON = seasonFor(DAY).id;

function club(): UtState {
  const ut = freshUt();
  ut.starterClaimed = true;
  ut.hq = freshHQ();
  ut.owned = [
    { uid: 'u1', cardId: 'c1', level: 1, xp: 0, at: 1 },
    { uid: 'u2', cardId: 'c2', level: 1, xp: 0, at: 1 },
  ];
  ut.squad = { a: 'u1', b: 'u2' };
  ut.battles = { week: WEEK, cleared: 0, best: 0, level: 'pro' };
  return ut;
}
const input = (o: Partial<Parameters<typeof settle>[1]> = {}): Parameters<typeof settle>[1] => ({
  won: true,
  us: 30,
  them: 20,
  online: false,
  rung: null,
  played: ['u1', 'u2'],
  week: WEEK,
  day: DAY,
  packId: 'p1',
  at: NOON,
  matchId: 'm1',
  how: 'played',
  opponent: 'Bots',
  ...o,
});
const profile = (ut: UtState, xp = 0) => ({ coins: 1000, xp, ut, inventory: { double: 0, trade: 0, prime: 0 }, playtime: undefined as RecapIn['before']['playtime'] });

/** settle + Career XP on a profile, as Match.tsx applies it */
function play(p: ReturnType<typeof profile>, o: Partial<Parameters<typeof settle>[1]> = {}) {
  const i = input(o);
  const r = settle(p.ut, i);
  const c = addCareerXp({ ...p, coins: p.coins + r.coins, ut: r.ut }, careerXp({ how: i.how!, won: i.won, paid: r.xp > 0 }));
  return { r, after: c.profile, gain: c.gain };
}
function recap(before: ReturnType<typeof profile>, o: Partial<Parameters<typeof settle>[1]> = {}, extra: Partial<RecapIn> = {}) {
  const { r, after, gain } = play(before, o);
  const i = input(o);
  return {
    r,
    after,
    rec: buildRecap({
      sport: SPORT,
      day: DAY,
      week: WEEK,
      now: NOON,
      before,
      after,
      verdict: verdictOf({ us: i.us, them: i.them, won: i.won }, SPORT),
      cards: { xp: r.xp, ups: r.ups.map((u) => ({ name: u.uid, level: u.level })) },
      capped: r.capped,
      career: gain,
      online: i.online,
      minutesSec: null,
      milestones: [],
      grade: null,
      box: null,
      ...extra,
    }),
  };
}

describe('the recap (' + SPORT + ')', () => {
  it('coins, card XP and the Season Pass bar crossing a level', () => {
    const ut = club();
    ut.hq!.seasons[SEASON] = { xp: SEASON_STEP - 10, claimed: [] };
    const { rec } = recap(profile(ut));
    expect(rec.coins).toBe(60);
    expect(rec.cards.xp).toBe(60);
    expect(rec.sp).toMatchObject({ gained: 110, from: SEASON_STEP - 10, to: SEASON_STEP + 100, levelFrom: 0, levelTo: 1 });
    expect(rec.sp!.next).toBeTruthy();
    expect(rec.grade).toBeNull();
    expect(rec.box).toBeNull();
    expect(rec.scoutDrop).toBeNull();
    expect(rec.league).toBeNull();
  });
  it('an objective completing reads DONE; objectives that did not move are left out', () => {
    const { rec } = recap(profile(club()));
    const winner = rec.objectives.find((o) => o.id.endsWith(':winner'));
    expect(winner).toMatchObject({ from: 0, to: 1, target: 1, done: true });
    expect(rec.objectives[0].done).toBe(true);
    const showUp = rec.objectives.find((o) => o.id.endsWith(':show-up'));
    expect(showUp).toMatchObject({ from: 0, to: 1, target: 2, done: false });
    // a second game the same day: "winner" is already done, so it no longer moves
    const { after } = recap(profile(club()));
    const again = recap({ ...after, ut: after.ut }, { matchId: 'm2' }).rec;
    expect(again.objectives.some((o) => o.id.endsWith(':winner'))).toBe(false);
    expect(again.objectives.find((o) => o.id.endsWith(':show-up'))).toMatchObject({ from: 1, to: 2, done: true });
  });
  it('a card levelling is reported with its new level', () => {
    const ut = club();
    ut.owned[0] = { ...ut.owned[0], xp: 999 };
    const { rec, r } = recap(profile(ut));
    expect(r.ups.map((u) => u.uid)).toEqual(['u1']);
    expect(rec.cards.ups).toEqual(r.ups.map((u) => ({ name: u.uid, level: u.level })));
  });
  it('a capped day pays nothing and says so: no coins, no card XP, no Career XP', () => {
    const ut = club();
    ut.paid = { day: DAY, n: PAID_GAMES_A_DAY };
    const { rec } = recap(profile(ut));
    expect(rec.capped).toBe(true);
    expect(rec.coins).toBe(0);
    expect(rec.cards.xp).toBe(0);
    expect(rec.career).toBeNull();
  });
  it('Career XP: played +20, +10 for a win, a sim +5; a level pays its coins once', () => {
    expect(careerXp({ how: 'played', won: false, paid: true })).toBe(CAREER_XP.played);
    expect(careerXp({ how: 'played', won: true, paid: true })).toBe(CAREER_XP.played + CAREER_XP.win);
    expect(careerXp({ how: 'sim', won: true, paid: true })).toBe(CAREER_XP.sim);
    expect(careerXp({ how: 'played', won: true, paid: false })).toBe(0);
    // 60 XP into level 1 (70 to level 2): a win takes it to level 2 and unlocks its booster
    const p = profile(club(), 60);
    const { rec, after } = recap(p);
    expect(rec.career).toMatchObject({ gain: { xp: 30, levelUps: [2], coins: LEVEL_UP_COINS } });
    expect(rec.career!.to.level).toBe(2);
    expect(after.xp).toBe(90);
    expect(after.coins).toBe(1000 + 60 + LEVEL_UP_COINS);
    expect(after.inventory.double).toBe(1);
    expect(rec.coins).toBe(60 + LEVEL_UP_COINS);
    // the same match settled again (a second phone update, a replay of the same id) pays nothing more
    const twice = play(after);
    expect(twice.r.coins).toBe(0);
    expect(twice.gain.xp).toBe(0);
    expect(twice.after.xp).toBe(after.xp);
    expect(twice.after.coins).toBe(after.coins);
    // the next match keeps climbing level 2: no second level-2 payment
    const next = play(after, { matchId: 'm2' });
    expect(next.gain.levelUps).toEqual(levelInfo(after.xp + 30).level > 2 ? [3] : []);
  });
  it('a Rivals promotion: RP and the division move, and the recap says PROMOTED', () => {
    const ut = club();
    const pro = DIVISIONS[1];
    ut.rivals = { ...rivalsOf(undefined, WEEK), points: pro.at - 10, best: pro.at - 10, w: 2 };
    const { rec } = recap(profile(ut), { online: true, matchId: 'live-1' });
    expect(rec.rivals).toMatchObject({ from: pro.at - 10, to: pro.at + 20, divFrom: 0, divTo: 1, promoted: true, name: pro.name });
    // offline matches never show Rivals
    expect(recap(profile(club())).rec.rivals).toBeNull();
  });
  it('Active Minutes: +N today and the next rung, from the ledger before the match banks', () => {
    const p = profile(club());
    const pt = freshPlaytime(DAY);
    p.playtime = { ...pt, daySec: 25 * 60, weekDays: pt.weekDays.map((x, i) => (i === 1 ? 25 * 60 : x)) };
    const { rec } = recap(p, {}, { minutesSec: 150 });
    expect(rec.minutes).toMatchObject({ plus: 2, now: 27, at: 30, capped: false, frozen: false });
    expect(rec.minutes!.next).toBe('3 min to 75 coins + a Scout Stamp');
    // no ledger yet: a first match starts the count
    const first = recap(profile(club()), {}, { minutesSec: 300 }).rec.minutes!;
    expect(first.plus).toBe(5);
    expect(first.now).toBe(5);
    // the ticker reported nothing: no Minutes row
    expect(recap(profile(club())).rec.minutes).toBeNull();
  });
  it('milestones: rung cleared with its pack, a Circuit prize, a run over, the Career level', () => {
    const gain = addCareerXp({ xp: 60, coins: 0, inventory: { double: 0, trade: 0, prime: 0 } }, 30).gain;
    const m = milestonesOf({
      sport: SPORT,
      climbed: { rung: 3, rungs: 8, pack: 'silver' },
      circuitPrizes: ['Gold Pack'],
      draft: { wins: 3, games: 3, done: true },
      career: gain,
    });
    expect(m.map((x) => x.title)).toEqual(['LEVEL 2', 'RUNG 4 CLEARED', 'CIRCUIT REWARD', 'PERFECT DRAFT']);
    expect(m[1]).toMatchObject({ store: true, line: 'Your Silver Pack is waiting in the Store' });
    expect(milestonesOf({ sport: SPORT, climbed: { rung: 7, rungs: 8, pack: null, level: 'Pro' }, refreshed: true })[0]).toMatchObject({ title: 'LADDER CLEARED', line: 'A new ladder is up on Pro' });
  });
});
