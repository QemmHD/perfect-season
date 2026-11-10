// Two phones, one match (Claude 2026-11-10, studio overhaul soccer-1). An online soccer match is
// played on two phones that never swap the attacks themselves, only the letters, so every number one
// phone works out about the other's attacks must be the number the other works out for itself. This
// file holds the Arcade's online paths; agreement-ut.test.ts holds Ultimate Team's simBoth (together
// 500 seeds, split across two files so the suite runs them side by side):
//  - takeover / taken: phone A's AI finishes B's attacks (the rival's, from A's seat) and B, told it
//    was taken over, finishes its own (Arcade.tsx takeOver / taken), at the online Legend level, over
//    the 250 even seeds;
//  - agreedShootout: a level match's penalties, from the host's seat and the guest's, over 1,000 seeds.
// Nothing that reads aiProgressFor's ctx (the solo ladder) may change an online result.
import { describe, expect, it } from 'vitest';
import { agreedShootout, aiProgressFor } from './arcade';
import { arcadeSeat, clubs, leaky, takeover, view } from './phones.test-util';

describe('online agreement: takeover and taken', () => {
  // the even seeds 0-498, in chunks well inside the 30 s test timeout
  for (let c = 0; c < 5; c++)
    it('both phones, even seeds ' + c * 100 + '-' + (c * 100 + 98), () => {
      for (let i = c * 100; i < c * 100 + 100; i += 2) {
        const [onA, onB] = takeover(i, aiProgressFor);
        expect(view(onB), 'seed ' + i).toEqual(view(onA));
      }
    });
  it('has teeth: a difficulty that leaked into online play would be caught', () => {
    let caught = 0;
    for (let i = 0; i < 12; i += 2) {
      const [onA, onB] = takeover(i, leaky);
      if (JSON.stringify(view(onA)) !== JSON.stringify(view(onB))) caught++;
    }
    expect(caught).toBeGreaterThanOrEqual(4);
  });
});

describe('online agreement: the agreed shootout, host and guest', () => {
  for (let c = 0; c < 5; c++)
    it('mirrored, seeds ' + c * 200 + '-' + (c * 200 + 199), () => {
      for (let i = c * 200; i < c * 200 + 200; i++) {
        const { a, b } = clubs(i);
        const host = arcadeSeat(a, b, 'Bianca');
        const guest = arcadeSeat(b, a, 'Arturo');
        const seed = 'pens-seed:' + i;
        const h = agreedShootout(host.us, host.them, seed, true);
        const g = agreedShootout(guest.us, guest.them, seed, false);
        const other = (s: 'us' | 'them') => (s === 'us' ? 'them' : 'us');
        expect({ first: g.first, us: g.us, them: g.them, winner: g.winner, scored: g.scored }, 'seed ' + i).toEqual({ first: other(h.first), us: h.them, them: h.us, winner: other(h.winner), scored: h.scored });
      }
    });
});
