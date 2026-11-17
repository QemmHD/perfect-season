import { expect, it } from 'vitest';
import { defenseDifficulty } from './difficulty';
it('uses selected defensive difficulty offline and the same highest setting online, including conflicting overrides', () => {
  expect(defenseDifficulty(false, 'rookie')).toBeLessThan(defenseDifficulty(false, 'pro'));
  expect(defenseDifficulty(false, 'pro')).toBeLessThan(defenseDifficulty(false, 'legend'));
  expect(defenseDifficulty(false, 'pro', 0.5)).toBe(0.5);
  for (const level of ['rookie', 'pro', 'legend'] as const)
    expect(defenseDifficulty(true, level, -0.5)).toBe(defenseDifficulty(false, 'legend'));
});
