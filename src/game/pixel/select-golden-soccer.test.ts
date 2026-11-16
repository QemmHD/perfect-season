// players-2: the selection code moved out of soccer2/render.ts into select-soccer verbatim. The digest
// was taken from the code as it stood inside the renderer at the base commit (79682ba), with the same
// runner, so any behavioural drift in the move fails here. Run with PS_SPORT=soccer.
//
// players-4: `lookFor` now draws each body's appearance record and `buildOf`'s weight (looks.ts
// `matchLook`). With the looks drawn before (LEGACY_LOOK) the module still hashes to the players-2
// digest; the new digest is pinned beside it (see select-golden.test.ts).
import { SOCCER } from '../../engine/sport';
import { loadAppearance } from './appearance';
import { goldenSoccer, LEGACY_LOOK } from './select-golden.helpers';
import * as soccer from './select-soccer';

describe.skipIf(!SOCCER)('select-soccer: identical to the renderer before the move', () => {
  it('hashes every body, every other frame of 16 seeded attacks to the base digest, with the old looks', async () => {
    const r = await goldenSoccer({ ...soccer, lookFor: LEGACY_LOOK.soccer });
    expect(r.samples).toBe(31656);
    expect(r.digest).toBe('326e398f');
  }, 120000);

  it('pins the players-4 digest (looks from the appearance record)', async () => {
    await loadAppearance('soccer');
    const r = await goldenSoccer(soccer);
    expect(r.samples).toBe(31656);
    expect(r.digest).toBe('65fa5e81');
  }, 120000);
});
