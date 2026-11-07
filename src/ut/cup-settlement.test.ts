// Codex: reject stale/combined/sim Cup requests before ANY ordinary wallet/XP/record reward.
import { describe, it, expect } from 'vitest';
import { freshUt, migrateUt } from './state';
import { settle } from './play';
import { SPORT } from '../engine/sport';
const entry = () => ({
  ...freshUt(),
  cup: {
    active: {
      id: 'integrated-run',
      kind: 'open' as const,
      week: '2026-W45',
      sport: SPORT,
      level: 'pro' as const,
      anchor: 70,
      at: 1,
      round: 0,
      results: [],
      done: false,
    },
    history: [],
    claims: [],
    trophies: { open: 0, silver: 0, chemistry: 0 },
  },
});
const result = {
  won: true,
  us: 10,
  them: 5,
  online: false,
  rung: null,
  played: [],
  week: '2026-W45',
  day: '2026-11-07',
  packId: 'no-ladder-pack',
  at: 5,
  matchId: 'cup-game-one',
  how: 'played' as const,
  cup: { runId: 'integrated-run', round: 0 },
};
describe('Cup atomic match integration', () => {
  it('books normal match progression and Cup round together, and retries pay nothing', () => {
    const u = entry(),
      r = settle(u, result);
    expect(r.coins).toBe(60);
    expect(r.ut.cup?.active?.round).toBe(1);
    expect(r.ut.record.w).toBe(1);
    expect(r.ut.hq?.history[0].mode).toBe('cup');
    const retry = settle(r.ut, result);
    expect(retry.ut).toBe(r.ut);
    expect(retry.coins).toBe(0);
    expect(migrateUt(r.ut).cup).toEqual(r.ut.cup);
  });
  it('does not advance paid games, XP, inventory, trophies or records for rejected fixtures', () => {
    for (const patch of [
      { at: NaN },
      { at: -1 },
      { how: 'sim' as const },
      { matchId: '' },
      { cup: { runId: 'other', round: 0 } },
      { cup: { runId: 'integrated-run', round: 2 } },
      { online: true },
      { rung: { i: 0, pack: 'gold' } },
      { event: { id: 'dynasty', node: 0 } },
      { circuit: { runId: 'x', round: 0 } },
      { us: -1 },
      { us: 10, them: 5, won: false },
    ]) {
      const u = entry(),
        r = settle(u, { ...result, ...patch });
      expect(r.ut).toBe(u);
      expect(r.coins).toBe(0);
      expect(r.xp).toBe(0);
    }
  });
  it('keeps daily payout caps while letting an eligible played Cup fixture progress', () => {
    const u = entry();
    u.paid = { day: result.day, n: 8 };
    const r = settle(u, result);
    expect(r.capped).toBe(true);
    expect(r.coins).toBe(0);
    expect(r.xp).toBe(0);
    expect(r.ut.cup?.active?.round).toBe(1);
    expect(r.ut.packs).toEqual([]);
  });
});
