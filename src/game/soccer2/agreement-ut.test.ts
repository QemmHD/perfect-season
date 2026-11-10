// Two phones, one match: Ultimate Team's simBoth (Claude 2026-11-10, studio overhaul soccer-1). The
// vote went to the sim, and each phone simulates both sides' attacks (ut/Match.tsx simBoth); phone A's
// numbers for each side must be phone B's. Over the 250 odd seeds 1-499 (agreement.test.ts has the
// even ones for the Arcade's takeover), alternating which side's attacks are compared.
import { describe, expect, it } from 'vitest';
import { aiProgressFor } from './arcade';
import { leaky, simBoth, view } from './phones.test-util';

describe('online agreement: simBoth from both seats', () => {
  for (let c = 0; c < 5; c++)
    it('both phones, odd seeds ' + (c * 100 + 1) + '-' + (c * 100 + 99), () => {
      for (let i = c * 100 + 1; i < c * 100 + 100; i += 2) {
        const [onA, onB] = simBoth(i, ((i - 1) / 2) % 2 === 0 ? 0 : 1, aiProgressFor);
        expect(view(onB), 'seed ' + i).toEqual(view(onA));
      }
    });
  it('has teeth: a difficulty that leaked into online play would be caught', () => {
    let caught = 0;
    for (let i = 1; i < 13; i += 2) {
      const [onA, onB] = simBoth(i, ((i - 1) / 2) % 2 === 0 ? 0 : 1, leaky);
      if (JSON.stringify(view(onA)) !== JSON.stringify(view(onB))) caught++;
    }
    expect(caught).toBeGreaterThanOrEqual(4);
  });
});
