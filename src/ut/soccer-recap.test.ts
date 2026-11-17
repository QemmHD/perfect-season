// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5; audit M3): a level soccer score reads
// DRAW, never WIN; penalties say who won the shootout; and the dormant three-way draw branch
// (play.ts isDraw) pays a draw only where one can stand. Runs in the soccer suite (and the others).
import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../game/soccer2/match';
import { REGULATION, verdictOf } from './match-recap';
import { COINS_DRAW, isDraw, matchRewards, settle, XP_FOR_DRAW, XP_PER_GAME } from './play';
import { migrateUt, freshUt } from './state';
import { freshHQ, normalizeHQ } from './hq-state';
import { weekKey } from './objectives';

const DAY = '2026-11-17';

describe('soccer: the result reads what happened', () => {
  it('regulation is soccer\'s attack count', () => {
    expect(REGULATION.soccer).toBe(ATTACKS);
  });
  it('2–2 reads DRAW whichever way the tiebreak went, never WIN or LOSS', () => {
    for (const won of [true, false]) {
      const v = verdictOf({ us: 2, them: 2, won, tiebreak: true }, 'soccer');
      expect(v.word).toBe('DRAW');
      expect(v.word).not.toBe('WIN');
    }
    expect(verdictOf({ us: 2, them: 2, won: true, tiebreak: true, pens: { us: 5, them: 4, won: true } }, 'soccer')).toMatchObject({ word: 'DRAW', tag: 'PENS', note: 'Won 5–4 on penalties' });
    expect(verdictOf({ us: 3, them: 2, won: true }, 'soccer').word).toBe('WIN');
  });
});

describe('the dormant three-way draw branch (contract G)', () => {
  const base = { won: false, us: 1, them: 1, online: false, draw: true };
  it('stands only for a level, unwon, offline match outside Cups and Club Season', () => {
    expect(isDraw(base)).toBe(true);
    expect(isDraw({ ...base, us: 2 })).toBe(false);
    expect(isDraw({ ...base, won: true })).toBe(false);
    expect(isDraw({ ...base, online: true })).toBe(false);
    expect(isDraw({ ...base, cup: {} })).toBe(false);
    expect(isDraw({ ...base, league: {} })).toBe(false);
    expect(isDraw({ ...base, draw: false })).toBe(false);
  });
  it('pays between a win and a loss, and records a draw (stats only)', () => {
    expect(matchRewards({ won: false, draw: true })).toEqual({ coins: COINS_DRAW, xp: XP_PER_GAME + XP_FOR_DRAW });
    expect(matchRewards({ won: true, draw: true }).coins).toBe(60);
    const ut = freshUt();
    ut.hq = freshHQ();
    ut.owned = [{ uid: 'u', cardId: 'c', level: 1, xp: 0, at: 1 }];
    const r = settle(ut, { ...base, rung: null, played: ['u'], week: weekKey(DAY), day: DAY, packId: 'p', at: 5, matchId: 'd1', how: 'played' });
    expect(r.coins).toBe(COINS_DRAW);
    expect(r.ut.record).toEqual({ w: 0, l: 0, h2hW: 0, h2hL: 0, d: 1 });
    expect(r.seasonXP).toBe(80 + 15);
    expect(r.ut.hq!.history[r.ut.hq!.history.length - 1]).toMatchObject({ won: false, draw: true });
    // a save with a draw survives a reload; one without it gains no field
    const back = migrateUt(JSON.parse(JSON.stringify(r.ut)));
    expect(back.record.d).toBe(1);
    expect(normalizeHQ(JSON.parse(JSON.stringify(r.ut.hq)), r.ut.owned).history.slice(-1)[0].draw).toBe(true);
    expect('d' in migrateUt(JSON.parse(JSON.stringify(freshUt()))).record).toBe(false);
    // a level score without the draw flag still settles as today (a loss for the record)
    const plain = settle(ut, { ...base, draw: false, rung: null, played: ['u'], week: weekKey(DAY), day: DAY, packId: 'p', at: 5, matchId: 'd2', how: 'played' });
    expect(plain.ut.record).toEqual({ w: 0, l: 1, h2hW: 0, h2hL: 0 });
  });
});
