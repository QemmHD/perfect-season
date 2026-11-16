// Claude (nfl-1): the local versions of the V2 shared contracts (C16, C17, C20, C21) behave as
// nfl.md writes them down, so football code built on them keeps working when the real modules land.
import { describe, expect, it } from 'vitest';
import { calibrationLag, FIRE_SCALE, judge, MIN_HALF, stickFrom, STICK_DEAD, touchTime, usePlaytime, windowHalf } from './shared-v2';

describe('shared V2 contracts, local versions', () => {
  it('reads the stick with y up, a dead zone, a capped length and the sprint ring', () => {
    const o = { x: 100, y: 100 };
    const dead = stickFrom(o, { x: 100 + 40 * STICK_DEAD * 0.99, y: 100 }, 40);
    expect(dead.vec).toEqual({ x: 0, y: 0 });
    expect(dead.mag).toBeCloseTo(STICK_DEAD * 0.99);
    expect(dead.sprint).toBe(false);
    const up = stickFrom(o, { x: 100, y: 60 }, 40);
    expect(up.vec.x).toBeCloseTo(0);
    expect(up.vec.y).toBeCloseTo(1);
    expect(up.sprint).toBe(false);
    const far = stickFrom(o, { x: 160, y: 100 }, 40);
    expect(Math.hypot(far.vec.x, far.vec.y)).toBeCloseTo(1);
    expect(far.mag).toBeCloseTo(1.5);
    expect(far.sprint).toBe(true);
    const half = stickFrom(o, { x: 100 - 20, y: 100 }, 40);
    expect(half.vec.x).toBeCloseTo(-(0.5 - STICK_DEAD) / (1 - STICK_DEAD));
    expect(stickFrom(o, { x: NaN, y: 0 }, 40).vec).toEqual({ x: 0, y: 0 });
  });

  it('sizes ring windows from the rating, widens them on fire and never goes below the floor', () => {
    expect(windowHalf(0.06, 1, false)).toBeCloseTo(0.06);
    expect(windowHalf(0.06, 1, true)).toBeCloseTo(0.06 * FIRE_SCALE);
    expect(windowHalf(0.06, 0.2, false)).toBe(MIN_HALF);
    expect(windowHalf(NaN, 1, false)).toBe(MIN_HALF);
  });

  it('only calls a gold window perfect ("gold never lies")', () => {
    const w = { center: 2, half: 0.05, state: 'gold' as const };
    expect(judge(2.04, w)).toBe('perfect');
    expect(judge(2.04, { ...w, state: 'amber' })).toBe('good');
    expect(judge(2.04, { ...w, state: 'red' })).toBe('good');
    expect(judge(1.92, w)).toBe('good');
    expect(judge(1.85, w)).toBe('early');
    expect(judge(2.2, w)).toBe('late');
  });

  it('turns a touch timestamp into engine time once, less the measured lag', () => {
    expect(touchTime({ timeStamp: 1500 }, { perf: 1000, engine: 3 }, 0)).toBeCloseTo(3.5);
    expect(touchTime({ timeStamp: 1500 }, { perf: 1000, engine: 3 }, 40)).toBeCloseTo(3.46);
    expect(touchTime({ timeStamp: 1500 }, { perf: 1000, engine: 3 }, NaN)).toBeCloseTo(3.5);
    expect(calibrationLag()).toBe(0);
  });

  it('gives a playtime meter that can be called at every input without counting anything yet', () => {
    const p = usePlaytime('match');
    expect(() => {
      p.input();
      p.pause(true);
      p.pause(false);
      p.complete();
      p.abandon(1000);
    }).not.toThrow();
    expect(usePlaytime('match')).toBe(p);
  });
});
