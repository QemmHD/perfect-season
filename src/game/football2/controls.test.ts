// Codex: the thumb's two screen axes must reach the field in either camera orientation.
import { describe, expect, it } from 'vitest';
import { screenRunInput } from './controls';
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
