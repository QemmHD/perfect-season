// nba-2 review fix: a game quit from the pause sheet is a loss that pays nothing. Before, it settled as
// an ordinary played loss: +30 coins, card XP and 80 season points for a 3-second quit at tip-off.
import { describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { COINS_LOSS, settle } from './play';
import { freshUt } from './state';

const base = {
  won: false,
  us: 0,
  them: 11,
  online: false,
  rung: null,
  played: [],
  week: '2026-W46',
  day: '2026-11-16',
  packId: 'p1',
  at: 5,
  matchId: 'ut-ai:quit-1',
  how: 'played' as const,
};

describe('a quit pays nothing (forfeit)', () => {
  it('Squad Battles: no coins, XP or season points, no paid game used; the loss is recorded once', () => {
    const u = freshUt();
    const played = settle(u, base);
    expect(played.coins).toBe(COINS_LOSS);
    expect(played.seasonXP).toBeGreaterThan(0);
    const q = settle(u, { ...base, forfeit: true });
    expect(q.coins).toBe(0);
    expect(q.xp).toBe(0);
    expect(q.seasonXP).toBe(0);
    expect(q.ups).toEqual([]);
    expect(q.pack).toBeNull();
    expect(q.ut.record.l).toBe(u.record.l + 1);
    expect(q.ut.record.w).toBe(u.record.w);
    expect(q.ut.paid.n).toBe(u.paid.day === base.day ? u.paid.n : 0);
    expect(q.ut.settled).toContain(base.matchId);
    // exactly once
    const again = settle(q.ut, { ...base, forfeit: true });
    expect(again.ut).toBe(q.ut);
  });
  it('a forfeit can never be a win', () => {
    const u = freshUt();
    const r = settle(u, { ...base, won: true, us: 12, them: 3, forfeit: true });
    expect(r.ut).toBe(u);
    expect(r.coins).toBe(0);
  });
  it('a Cup game quit: the round is lost and the run moves on, with no wallet or XP change', () => {
    const u = {
      ...freshUt(),
      cup: {
        active: { id: 'run', kind: 'open' as const, week: '2026-W46', sport: SPORT, level: 'pro' as const, anchor: 70, at: 1, round: 0, results: [], done: false },
        history: [],
        claims: [],
        trophies: { open: 0, silver: 0, chemistry: 0 },
      },
    };
    // the quit's scores as Arcade now reports them: them is at least us + 1
    const r = settle(u, { ...base, us: 14, them: 15, matchId: 'cup-quit', cup: { runId: 'run', round: 0 }, forfeit: true });
    expect(r.ut).not.toBe(u);
    expect(r.coins).toBe(0);
    expect(r.xp).toBe(0);
    expect(r.seasonXP).toBe(0);
    expect(r.ut.record.l).toBe(u.record.l + 1);
    expect(r.ut.cup?.active?.done ?? r.ut.cup?.history.length).toBeTruthy();
  });
});
