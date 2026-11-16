// Codex: the thumb's two screen axes must reach the field in either camera orientation.
import { describe, expect, it } from 'vitest';
import { CarryGate, screenRunInput } from './controls';
describe('football joystick mapping', () => {
  it.each([
    ['end', 0, -1, 0, 1],
    ['end', 0, 1, 0, -1],
    ['end', 1, 0, 1, 0],
    ['end', -1, 0, -1, 0],
    ['side', 1, 0, 0, 1],
    ['side', -1, 0, 0, -1],
    ['side', 0, -1, 1, 0],
    ['side', 0, 1, -1, 0]
  ] as const)('%s view maps screen (%s,%s) to field (%s,%s)', (view, x, y, fx, fy) => {
    const v = screenRunInput(x, y, view);
    expect(v.x).toBeCloseTo(fx);
    expect(v.y).toBeCloseTo(fy);
  });
  it('keeps center/jitter still, retains partial pressure and caps diagonal speed', () => {
    expect(screenRunInput(0, 0.08, 'end')).toEqual({ x: 0, y: 0 });
    const partial = screenRunInput(0, -0.5, 'end');
    expect(partial.y).toBeGreaterThan(0.3);
    expect(partial.y).toBeLessThan(0.6);
    const diagonal = screenRunInput(1, -1, 'end');
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(screenRunInput(NaN, 1, 'end')).toEqual({ x: 0, y: 0 });
  });
});

// Claude (nfl-1): the momentum carry. The engine takes null as "nobody is steering this carrier".
describe('the momentum carry gate', () => {
  const up = { x: 0, y: 1 },
    backLeft = { x: -0.7, y: -0.7 };
  it('lets an untouched new carrier run on his momentum, and gives a touched one the stick', () => {
    const g = new CarryGate();
    expect(g.input(null, false, null)).toEqual({ x: 0, y: 0 });
    expect(g.input(7, false, null)).toBeNull();
    expect(g.input(7, false, null)).toBeNull();
    g.touch();
    expect(g.input(7, false, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(g.input(7, false, up)).toEqual(up);
    // touched, then let go: a brake, never the momentum again for this carrier
    expect(g.input(7, false, null)).toEqual({ x: 0, y: 0 });
  });
  it('counts a stick held upfield at the change at once, and any deflection on a designed handoff', () => {
    const g = new CarryGate();
    expect(g.input(3, false, { x: 0.5, y: 0.6 })).toEqual({ x: 0.5, y: 0.6 });
    g.reset();
    expect(g.input(4, true, backLeft)).toEqual(backLeft);
    g.reset();
    // 0.3 of its length upfield is the line
    expect(g.input(5, false, { x: 0.95, y: 0.3 })).toEqual({ x: 0.95, y: 0.3 });
    g.reset();
    expect(g.input(5, false, { x: 0.96, y: 0.28 })).toBeNull();
  });
  it('ignores a stick held back-left at the catch until it moves a quarter of the way or is touched again', () => {
    const g = new CarryGate();
    expect(g.input(2, false, backLeft)).toBeNull();
    expect(g.input(2, false, { x: -0.6, y: -0.6 })).toBeNull();
    expect(g.input(2, false, { x: -0.7, y: -0.4 })).toEqual({ x: -0.7, y: -0.4 });
    g.reset();
    expect(g.input(2, false, backLeft)).toBeNull();
    g.touch();
    expect(g.input(2, false, backLeft)).toEqual(backLeft);
  });
  it('treats a centred held stick at the change as untouched (a resting thumb never brakes the catch)', () => {
    const g = new CarryGate();
    expect(g.input(6, true, { x: 0, y: 0 })).toBeNull();
    expect(g.input(6, true, { x: 0, y: 0.3 })).toEqual({ x: 0, y: 0.3 });
  });
  it('decides afresh for every new carrier: a touch before the ball changes hands does not carry over', () => {
    const g = new CarryGate();
    g.touch();
    expect(g.input(null, false, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(g.input(8, false, { x: 0, y: 0 })).toBeNull();
    g.touch();
    expect(g.input(8, false, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    // the next carrier (a lateral, a new play) starts over
    expect(g.input(9, false, null)).toBeNull();
  });
});
