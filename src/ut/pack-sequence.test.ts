import { describe, expect, it } from 'vitest';
import { packSequence } from './pack-sequence';
import type { Tier } from './types';
describe('pack presentation pacing', () => {
  it('reserves the extra surprise beat for GOAT and reveals the real card after that escalation', () => {
    const goat = packSequence('goat', 4);
    expect(goat.surge).not.toBeNull();
    expect(goat.surge!).toBeGreaterThan(goat.team);
    expect(goat.surge!).toBeLessThan(goat.player);
    for (const tier of ['bronze', 'silver', 'gold', 'promo', 'legend', 'spotlight'] as Tier[])
      expect(packSequence(tier, 3).surge).toBeNull();
  });
  it('keeps every sequence ordered and bounded, with quicker ceremonies for ordinary pulls', () => {
    for (const [tier, level] of [
      ['gold', 1],
      ['promo', 2],
      ['spotlight', 3],
      ['goat', 4],
    ] as const) {
      const s = packSequence(tier, level);
      expect(s.position).toBeLessThan(s.team);
      expect(s.team).toBeLessThan(s.player);
      expect(s.player).toBeLessThan(s.settled);
      expect(s.tear + s.settled).toBeLessThan(7000);
    }
    expect(packSequence('gold', 1).settled).toBeLessThan(packSequence('spotlight', 3).settled);
  });
});
