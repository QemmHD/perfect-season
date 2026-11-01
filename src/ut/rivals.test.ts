import { describe, expect, it } from 'vitest';
import { rivalsMatch, rivalsOf, divisionOf } from './rivals';
import { freshUt, migrateUt } from './state';
import { settle } from './play';
const input = {
  won: true,
  us: 12,
  them: 5,
  online: true,
  rung: null,
  played: [],
  week: '2026-W44',
  day: '2026-10-28',
  packId: 'pack-1',
  at: 1,
  matchId: 'match-1',
};
describe('Rivals and existing Ultimate Team progress', () => {
  it('does not add new fields or reset old accounts during migration', () => {
    const u = freshUt();
    u.packs = [{ id: 'old-pack', kind: 'premium', at: 9 }];
    u.record.h2hW = 27;
    expect(migrateUt(u)).toEqual(u);
  });
  it('settles a real match once across coins, record and Rivals', () => {
    const first = settle(freshUt(), input);
    expect(first.coins).toBe(60);
    expect(first.ut.rivals?.points).toBe(30);
    const again = settle(first.ut, input);
    expect(again.coins).toBe(0);
    expect(again.ut).toEqual(first.ut);
  });
  it('AI fallback never awards ranked progression', () => {
    const u = settle(freshUt(), { ...input, online: false });
    expect(u.ut.rivals).toBeUndefined();
    expect(u.ut.record.w).toBe(1);
  });
  it('retains unclaimed earned rewards across weekly rollover', () => {
    let r = rivalsOf(undefined, input.week);
    for (let i = 0; i < 8; i++) r = rivalsMatch(r, input.week, 'm' + i, true);
    expect(divisionOf(r.points)).toBe(2);
    expect(r.rewards.length).toBe(3);
    const next = rivalsOf(r, '2026-W45');
    expect(next.points).toBe(0);
    expect(next.peak).toBe(2);
    expect(next.rewards).toEqual(r.rewards);
  });
  it('allows demotion, never negative points, and never duplicates a match', () => {
    let r = rivalsOf(undefined, input.week);
    for (let i = 0; i < 3; i++) r = rivalsMatch(r, input.week, 'win' + i, true);
    expect(divisionOf(r.points)).toBe(1);
    r = rivalsMatch(r, input.week, 'loss', false);
    expect(divisionOf(r.points)).toBe(0);
    const copy = rivalsMatch(r, input.week, 'loss', false);
    expect(copy).toEqual(r);
    for (let i = 0; i < 20; i++)
      r = rivalsMatch(r, input.week, 'loss' + i, false);
    expect(r.points).toBe(0);
  });
});
