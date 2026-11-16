// players-2: the selection code moved out of soccer2/render.ts into select-soccer verbatim. The digest
// was taken from the code as it stood inside the renderer at the base commit (79682ba), with the same
// runner, so any behavioural drift in the move fails here. Run with PS_SPORT=soccer.
import { SOCCER } from '../../engine/sport';
import { goldenSoccer } from './select-golden.helpers';
import * as soccer from './select-soccer';

describe.skipIf(!SOCCER)('select-soccer: identical to the renderer before the move', () => {
  it('hashes every body, every other frame of 16 seeded attacks to the base digest', async () => {
    const r = await goldenSoccer(soccer);
    // Wave 1 re-base: the move was proved on claude/studio-players (31656 samples, 326e398f). soccer-1's
    // engine (dead shots play on, parries wide, restarts) changes the attacks themselves, so the stream is
    // re-pinned on the merged engine; select-soccer.ts is byte-identical to players' tip.
    expect(r.samples).toBe(33201);
    expect(r.digest).toBe('32f0c3bc');
  }, 120000);
});
