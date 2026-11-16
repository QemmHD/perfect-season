// Claude, 2026-11-16 (studio overhaul, team ut-1): the objectives move (progression.ts → objectives.ts)
// changes no behaviour. The snapshot below was written by the pre-move code (progression.ts at
// 8033a4b) and must keep matching: every objective id, claim id, target, progress, reward amount,
// Season Pass reward and ready count for six club states.
import { describe, expect, it } from 'vitest';
import { freshHQ, emptyTotals } from './hq-state';
import * as CM from './club-management';
import * as O from './objectives';
import * as P from './progression';
import { weekOf } from './sbc';
import { weekKey as boardWeek } from '../net/leaderboard';
import { freshUt, type UtState } from './state';

const DAY = '2026-11-10';
const WEEK = '2026-W46';

/** Six club states: fresh, a mid-day club, a finished day, banked old periods, a veteran, no hq. */
export function objectiveFixtures(): [string, UtState, string][] {
  const fresh = freshUt();
  const mid = freshUt();
  mid.hq = freshHQ();
  mid.hq.days[DAY] = { ...emptyTotals(), games: 1, wins: 1, points: 30 };
  mid.hq.weeks[WEEK] = { ...emptyTotals(), games: 4, wins: 2, sbcs: 1 };
  mid.hq.seasons['season:1'] = { xp: 1450, claimed: [1, 2] };
  const done = freshUt();
  done.hq = freshHQ();
  done.hq.days[DAY] = { ...emptyTotals(), games: 3, wins: 2, points: 61 };
  done.hq.claims = ['daily:' + DAY + ':show-up', 'daily:' + DAY + ':winner', 'daily:' + DAY + ':score'];
  const banked = freshUt();
  banked.hq = freshHQ();
  banked.hq.days['2026-11-08'] = { ...emptyTotals(), games: 2, wins: 1, points: 10 };
  banked.hq.days['2026-11-09'] = { ...emptyTotals(), games: 5, wins: 0, points: 40 };
  banked.hq.weeks['2026-W45'] = { ...emptyTotals(), games: 12, wins: 6, sbcs: 3 };
  banked.hq.claims = ['daily:2026-11-08:show-up', 'weekly:2026-W45:wins'];
  banked.hq.seasons['season:1'] = { xp: 7500, claimed: [1, 2, 3, 5, 25] };
  const vet = freshUt();
  vet.hq = freshHQ();
  vet.hq.totals = { games: 140, wins: 90, points: 3000, onlineWins: 7, packs: 33, sbcs: 20, moments: 5, development: 2 };
  vet.hq.claims = ['lifetime:games-10', 'lifetime:wins-25', 'lifetime:club-10'];
  vet.collected = Array.from({ length: 60 }, (_, i) => 'card-' + i);
  vet.hq.seasons['season:1'] = { xp: 3000, claimed: [] };
  vet.hq.seasons['season:2'] = { xp: 600, claimed: [1] };
  const legacy = freshUt();
  legacy.record = { w: 30, l: 10, h2hW: 6, h2hL: 2 };
  legacy.packsOpened = 12;
  legacy.sbc = { done: { a: 1, b: 2, c: 3 } };
  return [
    ['fresh', fresh, DAY],
    ['mid-day', mid, DAY],
    ['day done', done, DAY],
    ['banked', banked, DAY],
    ['veteran', vet, '2026-12-01'],
    ['no hq (legacy)', legacy, DAY],
  ];
}

describe('objectives: the move keeps every id, target and reward', () => {
  for (const [name, ut, day] of objectiveFixtures())
    it(name, () => {
      const deck = O.objectiveDeck(ut, day);
      expect({
        deck: deck.map((o) => [o.id, o.group, o.period, o.title, o.text, o.counter, o.target, o.progress, o.reward, o.claimed]),
        ready: O.readyRewards(ut, day),
        hq: O.hqOf(ut).totals,
        seasons: Object.keys(O.hqOf(ut).seasons).map((k) => [k, O.seasonReady(ut, k)]),
      }).toMatchSnapshot();
    });
  it('the Season Pass track and calendar', () => {
    expect({
      tiers: O.SEASON_TIERS,
      step: O.SEASON_STEP,
      rewards: Array.from({ length: O.SEASON_TIERS }, (_, i) => O.seasonReward(i + 1)),
      seasons: ['2026-10-25', '2026-10-26', '2026-11-22', '2026-11-23', '2027-03-01'].map(O.seasonFor),
    }).toMatchSnapshot();
  });
  it('progression.ts and club-management.ts re-export the moved names (one implementation)', () => {
    for (const k of ['DAILY', 'WEEKLY', 'LIFETIME', 'hqOf', 'objectiveDeck', 'readyRewards', 'rewardLabel', 'seasonFor', 'seasonReady', 'seasonReward', 'SEASON_STEP', 'SEASON_TIERS', 'weekKey'] as const)
      expect(P[k], k).toBe(O[k]);
    expect(CM.DEVELOPMENT_PATHS).toBe(O.DEVELOPMENT_PATHS);
    expect(CM.developmentReady).toBe(O.developmentReady);
  });
  it('weekKey equals sbc.ts weekOf and the boards\' weekKey for 800 days across two year boundaries', () => {
    const t0 = Date.UTC(2025, 9, 1);
    for (let i = 0; i < 800; i++) {
      const day = new Date(t0 + i * 86400000).toISOString().slice(0, 10);
      expect(O.weekKey(day), day).toBe(weekOf(day));
      expect(O.weekKey(day), day).toBe(boardWeek(day));
    }
  });
  it('clubStatsOf reads the copy\'s games and wins with this club', () => {
    const ut = freshUt();
    ut.owned = [{ uid: 'u1', cardId: 'c', level: 1, xp: 0, at: 1234 }];
    ut.hq = freshHQ();
    ut.hq.cardStats.u1 = { games: 7, wins: 5 };
    expect(O.clubStatsOf(ut, 'u1')).toEqual({ games: 7, wins: 5, since: 1234 });
    expect(O.clubStatsOf(ut, 'gone')).toEqual({ games: 0, wins: 0 });
  });
});
