// players-2: the soccer twin of render-only.test.ts (run with PS_SPORT=soccer): seeded attacks hash
// the same engine state after every step with and without the drawing pipeline on every body.
import { SOCCER } from '../../engine/sport';
import { stepDigestsSoccer } from './render-only.helpers';

describe.skipIf(!SOCCER)('soccer: drawing leaves the engine state alone', () => {
  it('hashes the same state after every step with and without the drawing pipeline', async () => {
    const bare = await stepDigestsSoccer(false);
    const drawn = await stepDigestsSoccer(true);
    expect(bare.steps).toBeGreaterThan(1000);
    expect(drawn).toEqual(bare);
  }, 180000);
});
