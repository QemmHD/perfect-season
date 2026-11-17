// The drive rules that aren't about a single play: the two-minute clock on the last drive and the
// On Fire streak.
import { CLOCK, afterPlay, FIRE_AT, newGame, RUNOFF } from './drive';
import type { Defense, FbPlayer, Offense, PlayEnd } from './types';

const man = (pos: string, a: Record<string, number> = {}): FbPlayer => ({ id: pos, name: pos, tag: pos, num: null, ht: 74, wt: 220, pos, ovr: 75, a, abil: [] });
const off: Offense = { qb: man('QB'), rb: man('RB'), wr: [man('WR'), man('WR'), man('WR')], te: man('TE'), ol: [man('OT'), man('OG'), man('C'), man('OG'), man('OT')], k: man('K', { KPW: 77, KAC: 77 }) };
const def: Defense = { dl: [man('DE'), man('DT'), man('DT'), man('DE')], lb: [man('LB'), man('LB'), man('LB')], cb: [man('CB'), man('CB')], s: [man('S'), man('S')] };
const end = (kind: PlayEnd['kind'], y: number, secs = 4, caught = false): PlayEnd => ({ kind, x: 26, y, gain: 0, text: '', caught, secs });

describe('the two-minute clock', () => {
  it('runs only on the last drive', () => {
    const g = newGame(off, def, 'clock', 2);
    expect(g.clock).toBeNull();
    afterPlay(g, end('int', 30));
    expect(g.drive).toBe(1);
    expect(g.clock).toBe(CLOCK);
  });

  it('runs between plays that end in bounds, and stops on an incompletion or out of bounds', () => {
    const g = newGame(off, def, 'clock', 1);
    afterPlay(g, end('tackle', 28, 5));
    expect(g.clock).toBe(CLOCK - 5 - RUNOFF);
    afterPlay(g, end('incomplete', 0, 3));
    expect(g.clock).toBe(CLOCK - 5 - RUNOFF - 3);
    afterPlay(g, end('out', 33, 4));
    expect(g.clock).toBe(CLOCK - 5 - RUNOFF - 3 - 4);
  });

  it('gives one last kick when it runs out in range, and ends the drive when it runs out short of it', () => {
    const near = newGame(off, def, 'clock', 1);
    near.ballOn = 70;
    near.clock = 6;
    const a = afterPlay(near, end('tackle', 74, 4));
    expect(a.timeUp).toBe(true);
    expect(near.down).toBe(4);
    expect(near.clock).toBe(0);
    expect(near.over).toBe(false);

    const far = newGame(off, def, 'clock', 1);
    far.ballOn = 30;
    far.clock = 6;
    const b = afterPlay(far, end('tackle', 34, 4));
    expect(b.driveOver).toBe('TIME');
    expect(far.ends).toEqual(['TIME']);
    expect(far.over).toBe(true);
  });

  it('a touchdown on the last play counts, clock or no clock', () => {
    const g = newGame(off, def, 'clock', 1);
    g.ballOn = 80;
    g.clock = 2;
    const a = afterPlay(g, end('td', 100, 5, true));
    expect(a.points).toBe(7);
    expect(g.ends).toEqual(['TD']);
  });
});

describe('On Fire', () => {
  it('lights after three completions in a row and goes out on an incompletion', () => {
    const g = newGame(off, def, 'fire');
    let lit = null;
    for (let i = 0; i < FIRE_AT; i++) lit = afterPlay(g, end('tackle', g.ballOn + 3, 3, true)).fire;
    expect(lit).toBe('lit');
    expect(g.fire).toBe(true);
    // a run doesn't break the streak
    expect(afterPlay(g, end('tackle', g.ballOn + 2, 3)).fire).toBeNull();
    expect(g.fire).toBe(true);
    expect(afterPlay(g, end('incomplete', 0, 2)).fire).toBe('out');
    expect(g.fire).toBe(false);
    expect(g.streak).toBe(0);
  });
});
