// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5): the result's headline (match-recap.ts
// verdictOf) for each sport, and the regulation counts it reads, pinned to the engines.
import { describe, expect, it } from 'vitest';
import { DRIVES } from '../game/football2/drive';
import { POSSESSIONS } from '../game/hoops2/game';
import { REGULATION, verdictOf } from './match-recap';
import type { UtSport } from './types';

const SPORTS: UtSport[] = ['nba', 'nfl', 'soccer'];
const ends = (n: number) => Array.from({ length: n }, () => 'X');

describe('verdictOf', () => {
  it('regulation counts match the engines (soccer is pinned in soccer-recap.test.ts)', () => {
    expect(REGULATION.nba).toBe(POSSESSIONS);
    expect(REGULATION.nfl).toBe(DRIVES);
  });
  it('a decided score reads WIN or LOSS', () => {
    for (const s of SPORTS) {
      expect(verdictOf({ us: 3, them: 1, won: true }, s)).toMatchObject({ word: 'WIN', tone: 'win', won: true });
      expect(verdictOf({ us: 1, them: 3, won: false }, s)).toMatchObject({ word: 'LOSS', tone: 'loss', won: false });
      expect(verdictOf({ us: 3, them: 1, won: true }, s).tag).toBeUndefined();
    }
  });
  it('soccer: more ends than attacks is not overtime (counters and restarts), only its own ot is', () => {
    expect(verdictOf({ us: 2, them: 0, won: true, ends: [ends(9), ends(7)] }, 'soccer').tag).toBeUndefined();
    expect(verdictOf({ us: 2, them: 1, won: true, ot: 1 }, 'soccer').tag).toBe('OT');
  });
  it('OT from Progress.ot, or (NBA, NFL) from more ends than regulation on either side', () => {
    for (const s of ['nba', 'nfl'] as UtSport[]) {
      expect(verdictOf({ us: 3, them: 1, won: true, ot: 1 }, s)).toMatchObject({ word: 'WIN', tag: 'OT' });
      expect(verdictOf({ us: 1, them: 3, won: false, ends: [ends(REGULATION[s]), ends(REGULATION[s] + 1)] }, s)).toMatchObject({ word: 'LOSS', tag: 'OT' });
      expect(verdictOf({ us: 1, them: 3, won: false, ends: [ends(REGULATION[s]), ends(REGULATION[s])] }, s).tag).toBeUndefined();
    }
  });
  it('a level score never reads WIN or LOSS: TIE (NBA, NFL), DRAW (soccer)', () => {
    for (const s of SPORTS) {
      const word = s === 'soccer' ? 'DRAW' : 'TIE';
      const tb = verdictOf({ us: 2, them: 2, won: true, tiebreak: true }, s);
      expect(tb).toMatchObject({ word, tone: 'win', won: true });
      expect(tb.note).toBe('A ' + word.toLowerCase() + ' goes to the better squad: yours.');
      expect(verdictOf({ us: 2, them: 2, won: false, tiebreak: true }, s)).toMatchObject({ word, tone: 'loss', note: 'A ' + word.toLowerCase() + ' goes to the better squad: theirs.' });
      expect(verdictOf({ us: 2, them: 2, won: false, draw: true }, s)).toMatchObject({ word, tone: 'draw', won: false });
    }
  });
  it('penalties: the level score reads as such, with who won the shootout', () => {
    expect(verdictOf({ us: 2, them: 2, won: true, tiebreak: true, pens: { us: 4, them: 3, won: true } }, 'soccer')).toMatchObject({
      word: 'DRAW',
      tag: 'PENS',
      tone: 'win',
      won: true,
      note: 'Won 4–3 on penalties',
    });
    expect(verdictOf({ us: 1, them: 1, won: false, tiebreak: true, pens: { us: 2, them: 4, won: false } }, 'soccer')).toMatchObject({ tag: 'PENS', tone: 'loss', note: 'Lost 2–4 on penalties' });
  });
});
