// Two phones, one match: the agreed shootout (Claude 2026-11-10, studio overhaul soccer-1; its own file
// since the soccer-4 review fix, so the suite runs it beside agreement.test.ts). A level online match's
// penalties are settled on both phones from the same seed: from the host's seat and the guest's, over
// 1,000 seeds, the two must be the same shootout mirrored.
import { describe, expect, it } from 'vitest';
import { agreedShootout } from './arcade';
import { arcadeSeat, clubs } from './phones.test-util';

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
