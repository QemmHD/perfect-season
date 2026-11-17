// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5): the One-More bar (V2 D.1, D.10). Each
// `after` rule picks the right target from a real settlement, the target starts the right match, the
// bar never starts anything by itself, and its stake line is true: in every fixture below, the pack it
// names is exactly the pack a win on that match pays (play.ts settle), and it names none when none pays.
import { describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { LEVEL, type Level } from './battles';
import { freshHQ } from './hq-state';
import { afterCtxOf, lossStreakOf, modeOf, oneMoreStart } from './match-recap';
import { nextCtxOf, nextUp, packName, RUNGS } from './next-action';
import { weekKey } from './objectives';
import { PAID_GAMES_A_DAY, settle } from './play';
import RECAP_SOURCE from './MatchRecap.tsx?raw';
import { freshUt, type UtState } from './state';

const DAY = '2026-11-17';
const WEEK = weekKey(DAY);
const NOON = Date.parse(DAY + 'T17:00:00Z');

function club(b: Partial<UtState['battles']> = {}, paid = 0): UtState {
  const ut = freshUt();
  ut.starterClaimed = true;
  ut.content = { daily: { day: DAY, streak: 3, total: 9 }, calendar: { day: DAY, n: 4 } };
  ut.hq = freshHQ();
  ut.owned = [{ uid: 'u1', cardId: 'c1', level: 1, xp: 0, at: 1 }];
  ut.squad = { a: 'u1' };
  ut.battles = { week: WEEK, cleared: 0, best: 0, level: 'pro', ...b };
  ut.paid = { day: DAY, n: paid };
  return ut;
}
let ids = 0;
/** One Squad Battles match on `rung` of the saved difficulty, settled exactly as Match.tsx settles it. */
function battle(ut: UtState, rung: number, won: boolean, score: [number, number] = won ? [30, 20] : [20, 30]) {
  const level = ut.battles.level as Level;
  return settle(ut, {
    won,
    us: score[0],
    them: score[1],
    online: false,
    rung: { i: rung, pack: LEVEL[level].packs[rung] ?? null },
    played: ['u1'],
    week: WEEK,
    day: DAY,
    packId: 'pk' + ++ids,
    at: NOON + ids,
    matchId: 'm' + ids,
    how: 'played',
    pay: LEVEL[level].pay,
  });
}
function bar(ut: UtState, rung: number, won: boolean, score?: [number, number], flawless = false) {
  const level = ut.battles.level as Level;
  const s = battle(ut, rung, won, score);
  const after = afterCtxOf(s.ut, { online: false, rung, level }, { won, us: score?.[0] ?? (won ? 30 : 20), them: score?.[1] ?? (won ? 20 : 30), flawless });
  return { settled: s.ut, action: nextUp(nextCtxOf(s.ut, SPORT, NOON, { after })) };
}

describe('One-More: the rules, from real settlements (' + SPORT + ')', () => {
  it('a win moves to the next rung; a loss by one score offers REMATCH; a third straight loss steps down', () => {
    expect(bar(club(), 0, true).action).toMatchObject({ id: 'after:battles', target: { setup: { mode: 'battles', rung: 1 } } });
    const one = SPORT === 'nba' ? 2 : 1;
    expect(bar(club(), 2, false, [20, 20 + one]).action).toMatchObject({ id: 'after:rematch', cta: 'REMATCH', target: { setup: { mode: 'battles', rung: 2, rematch: true } } });
    let ut = club({ cleared: 3 });
    ut = battle(ut, 3, false).ut;
    ut = battle(ut, 3, false).ut;
    expect(lossStreakOf(ut)).toBe(2);
    const third = bar(ut, 3, false, [0, 40]);
    expect(lossStreakOf(third.settled)).toBe(3);
    expect(third.action).toMatchObject({ id: 'after:easier', target: { setup: { rung: 2 } } });
  });
  it('a FLAWLESS win offers the harder rung', () => {
    expect(bar(club({ cleared: 2 }), 2, true, [30, 10], true).action).toMatchObject({ id: 'after:harder', target: { setup: { rung: 3 } } });
  });
  it('modes map to their One-More mode', () => {
    expect(modeOf({ online: true })).toBe('rivals');
    expect(modeOf({ online: false, cup: {} })).toBe('cup');
    expect(modeOf({ online: false, circuit: {} })).toBe('circuit');
    expect(modeOf({ online: false, league: {} })).toBe('league');
    expect(modeOf({ online: false, draft: {} })).toBe('draft');
    expect(modeOf({ online: false, event: {} })).toBe('events');
    expect(modeOf({ online: false })).toBe('battles');
  });
});

describe('One-More: the target starts the right match at once', () => {
  it('Squad Battles: the rung, quick; another difficulty is set first', () => {
    const ut = club({ cleared: 2 });
    const a = bar(ut, 2, true).action;
    expect(oneMoreStart(a, ut, { online: false }, 7, true)).toEqual({ kind: 'match', req: { id: 7, mode: 'ai', quick: true, rung: 3 } });
    const easier = { ...a, target: { app: 'match' as const, setup: { mode: 'battles' as const, rung: 0, level: 'rookie' as const } } };
    expect(oneMoreStart(easier, ut, { online: false }, 8, false)).toEqual({ kind: 'match', req: { id: 8, mode: 'ai', quick: true, rung: 0 }, level: 'rookie' });
  });
  it('Rivals re-queues online; a Moments drill or a finished run opens its screen', () => {
    const ut = club();
    const rivals = { id: 'x', line: '', cta: 'PLAY', target: { app: 'match' as const, setup: { mode: 'rivals' as const } } };
    expect(oneMoreStart(rivals, ut, { online: true }, 9, true)).toEqual({ kind: 'match', req: { id: 9, mode: 'online' } });
    expect(oneMoreStart({ id: 'd', line: '', cta: 'DRILL', target: { app: 'ut', view: 'moments' } }, ut, { online: false }, 1, false)).toEqual({ kind: 'view', view: 'moments' });
    for (const mode of ['cup', 'circuit', 'league', 'draft'] as const)
      expect(oneMoreStart({ id: 'r', line: '', cta: 'NEXT', target: { app: 'match', setup: { mode } } }, ut, { online: false }, 1, true)).toEqual({ kind: 'view', view: mode });
  });
  it('Legends Events: the next node after a win, the same node after a loss', () => {
    const e = { id: 'e', line: '', cta: 'PLAY', target: { app: 'match' as const, setup: { mode: 'events' as const } } };
    expect(oneMoreStart(e, club(), { online: false, event: { id: 'ev', node: 0 } }, 3, true)).toMatchObject({ req: { event: { id: 'ev', node: 1 }, quick: true } });
    expect(oneMoreStart(e, club(), { online: false, event: { id: 'ev', node: 1 } }, 3, false)).toMatchObject({ req: { event: { id: 'ev', node: 1 } } });
  });
  it('the bar never starts a match by itself: its only caller is the bar tap', () => {
    const calls = RECAP_SOURCE.match(/onOneMore/g) ?? [];
    expect(calls.length).toBe(2); // the prop's declaration and the GoldBar's onClick
    expect(RECAP_SOURCE).toContain('onClick={p.onOneMore}');
    expect(RECAP_SOURCE).not.toMatch(/setTimeout\([^)]*onOneMore/);
  });
});

describe('One-More: the stake line is true (' + SPORT + ')', () => {
  // [saved difficulty, rungs cleared this week, rung played, won, paid games before, flawless]
  const FIXTURES: [Level, number, number, boolean, number, boolean][] = [
    ['pro', 0, 0, true, 0, false],
    ['pro', 2, 2, true, 0, false],
    ['pro', 6, 6, true, 0, false],
    ['pro', 3, 3, false, 1, false],
    ['pro', 6, 1, true, 0, false],
    ['rookie', 2, 2, true, 2, false],
    ['allstar', 6, 6, true, 3, false],
    ['allstar', 2, 2, true, 0, true],
    ['legend', 0, 0, true, 0, false],
    ['legend', 4, 4, true, 4, false],
    ['legend', 7, 7, true, 0, false],
    ['pro', 2, 2, true, PAID_GAMES_A_DAY - 1, false],
    ['pro', 6, 6, true, PAID_GAMES_A_DAY - 1, false],
  ];
  it('in ' + FIXTURES.length + ' fixtures, the pack the bar names is exactly what the next win pays', () => {
    let named = 0;
    for (const [level, cleared, rung, won, paid, flawless] of FIXTURES) {
      const tag = level + ' cleared ' + cleared + ' rung ' + rung + (won ? ' win' : ' loss') + ' paid ' + paid;
      const { settled, action } = bar(club({ level, cleared, best: cleared }, paid), rung, won, undefined, flawless);
      const t = action.target;
      expect(t.app, tag).toBe('match');
      if (t.app !== 'match' || t.setup.mode !== 'battles') continue;
      // play the bar's match: a different difficulty starts its ladder at rung 1 (as picking it does)
      let ut = settled;
      if (t.setup.level && t.setup.level !== ut.battles.level) ut = { ...ut, battles: { ...ut.battles, level: t.setup.level, cleared: 0 } };
      expect(t.setup.rung, tag).toBeLessThan(RUNGS);
      const next = battle(ut, t.setup.rung!, true);
      expect(next.pack ? packName(next.pack) : undefined, tag).toBe(action.stake);
      if (action.stake) named++;
    }
    expect(named).toBeGreaterThanOrEqual(4);
  });
});
