// Claude (nfl-1): the local versions of the V2 shared contracts (C16, C17, C20, C21) behave as
// nfl.md writes them down, so football code built on them keeps working when the real modules land.
import { describe, expect, it } from 'vitest';
import { calibrationLag, controlGeometry, FIRE_SCALE, judge, MIN_HALF, stickFrom, STICK_DEAD, touchTime, usePlaytime, windowHalf } from './shared-v2';

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

  it('lays the C15 geometry out to the V2 §A.5 table at 393×852 and 320×568, insets included (nfl-2)', () => {
    const centre = (g: Record<string, string>, id: string, w: number, h: number) => [w - parseFloat(g['--ctl-' + id + '-right']), h - parseFloat(g['--ctl-' + id + '-bottom'])];
    const a = controlGeometry(393, 852, { top: 59, right: 0, bottom: 34, left: 0 });
    expect(centre(a, 'a', 393, 852)).toEqual([323, 738]);
    expect(centre(a, 'b', 393, 852)).toEqual([238, 778]);
    expect(centre(a, 'c', 393, 852)).toEqual([250, 694]);
    expect(centre(a, 'd', 393, 852)).toEqual([340, 652]);
    expect([a['--ctl-a-d'], a['--ctl-b-d'], a['--ctl-c-d'], a['--stick-d'], a['--pause-top'], a['--pause-left']]).toEqual(['92px', '64px', '48px', '120px', '63px', '12px']);
    const c = controlGeometry(320, 568, { top: 20, right: 0, bottom: 0, left: 0 });
    expect(centre(c, 'a', 320, 568)).toEqual([266, 510]);
    expect(centre(c, 'b', 320, 568)).toEqual([190, 536]);
    expect(centre(c, 'c', 320, 568)).toEqual([200, 468]);
    expect(centre(c, 'd', 320, 568)).toEqual([282, 436]);
    expect([c['--ctl-a-d'], c['--ctl-c-d'], c['--pause-top'], c['--pause-left']]).toEqual(['84px', '44px', '20px', '6px']);
    // landscape takes the compact column, pushed in by the side inset
    const d = controlGeometry(844, 390, { top: 0, right: 59, bottom: 21, left: 59 });
    expect(d['--ctl-a-right']).toBe(54 + 59 + 'px');
    expect(d['--ctl-a-bottom']).toBe(58 + 21 + 'px');
    // every button stays at least 44 px on any phone between and beyond the two columns
    for (const [w, h] of [[300, 520], [375, 667], [430, 932], [480, 1040]]) {
      const g = controlGeometry(w, h, { top: 0, right: 0, bottom: 0, left: 0 });
      for (const id of ['a', 'b', 'c', 'd']) expect(parseFloat(g['--ctl-' + id + '-d'])).toBeGreaterThanOrEqual(44);
    }
  });
});
