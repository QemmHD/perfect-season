// A solo QUIT settles as the least-rewarded result (soccer-2 re-review): the loss stands on the record
// and in the mode, but it pays nothing, so pause -> QUIT at kick-off can never out-earn a sim or a played
// loss. (ut's settle/settleDraft with `quit: true`, which ut/Match.tsx's onQuit passes.)
import { describe, expect, it } from 'vitest';
import { freshUt } from '../../ut/state';
import { settle } from '../../ut/play';
import { hqOf } from '../../ut/progression';
import { startDevelopment } from '../../ut/club-management';

const day = '2026-11-16';
const week = '2026-11-16';
const club = () => {
  const ut = {
    ...freshUt(),
    owned: [{ uid: 'c1', cardId: 'soccer:x', level: 1, xp: 0, at: 1 }],
    squad: { ST: 'c1' },
  } as ReturnType<typeof freshUt>;
  return startDevelopment(ut, 'c1', 'breakout', 1);
};
const input = (matchId: string, quit?: boolean) => ({
  matchId,
  won: false,
  us: 0,
  them: 3,
  online: false,
  rung: { i: 0, pack: 'gold' },
  played: ['c1'],
  week,
  day,
  packId: 'p-' + matchId,
  at: 1000,
  how: 'played' as const,
  pay: 1,
  quit,
});

describe('a solo quit pays nothing', () => {
  it('a quit at 0 attacks: the loss is recorded, with no coins, card XP, Season XP, paid slot, objective game or development', () => {
    const before = club();
    const games0 = hqOf(before).days[day]?.games ?? 0;
    const dev0 = hqOf(before).development.active!;
    const q = settle(before, input('quit-1', true));
    expect(q.coins).toBe(0);
    expect(q.xp).toBe(0);
    expect(q.seasonXP).toBe(0);
    expect(q.ups).toEqual([]);
    expect(q.ut.record.l).toBe(before.record.l + 1);
    expect(q.ut.record.w).toBe(before.record.w);
    expect(q.ut.settled).toContain('quit-1');
    expect(q.ut.paid.n).toBe(before.paid.day === day ? before.paid.n : 0);
    expect(q.ut.owned[0].xp).toBe(0);
    const h = hqOf(q.ut);
    expect(h.days[day]?.games ?? 0).toBe(games0);
    expect(h.development.active!.games).toBe(dev0.games);
    // and it cannot be settled twice
    expect(settle(q.ut, input('quit-1', true)).ut).toBe(q.ut);
  });
  it('a played loss still pays as before (the quit is the only path that pays nothing)', () => {
    const before = club();
    const p = settle(before, input('loss-1'));
    expect(p.coins).toBeGreaterThan(0);
    expect(p.xp).toBeGreaterThan(0);
    expect(p.seasonXP).toBeGreaterThan(0);
    expect(hqOf(p.ut).development.active!.games).toBe(hqOf(before).development.active!.games + 1);
  });
});
