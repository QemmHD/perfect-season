// players-2: the selection code moved out of soccer2/render.ts into select-soccer verbatim. The digest
// was taken from the code as it stood inside the renderer at the base commit (79682ba), with the same
// runner, so any behavioural drift in the move fails here. Run with PS_SPORT=soccer.
import { SOCCER } from '../../engine/sport';
import { goldenSoccer } from './select-golden.helpers';
import * as soccer from './select-soccer';

describe.skipIf(!SOCCER)('select-soccer: identical to the renderer before the move', () => {
  it('hashes every body, every other frame of 16 seeded attacks to the base digest', async () => {
    const r = await goldenSoccer(soccer);
    expect(r.samples).toBe(31656);
    expect(r.digest).toBe('326e398f');
  }, 120000);
});
