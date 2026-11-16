// players-2: the selection code moved out of hoops2/football2 render.ts into select-nba/select-nfl
// verbatim. These digests were taken from the code as it stood inside the renderers at the base
// commit (79682ba), with the same runner (select-golden.helpers.ts), so any behavioural drift in the
// move fails here. The soccer twin is select-golden-soccer.test.ts (run with PS_SPORT=soccer).
//
// players-4: `lookFor` now draws each body's appearance record (looks.ts `matchLook`), which changes
// the look half of every sample on purpose. Run with the looks the renderers drew before
// (LEGACY_LOOK), the modules still hash to the players-2 digests: the clip, pose and gait choices are
// untouched. The new digest is pinned beside it, with the sport's appearance data loaded.
import { SPORT } from '../../engine/sport';
import { loadAppearance } from './appearance';
import { goldenNba, goldenNfl, LEGACY_LOOK } from './select-golden.helpers';
import * as nba from './select-nba';
import * as nfl from './select-nfl';

describe.skipIf(SPORT !== 'nba')('select-nba: identical to the renderer before the move', () => {
  it('hashes every body, every other frame of 3 seeded games to the base digest, with the old looks', async () => {
    const r = await goldenNba({ ...nba, lookFor: LEGACY_LOOK.nba });
    expect(r.samples).toBe(88750);
    expect(r.digest).toBe('556ad50a');
  }, 120000);

  it('pins the players-4 digest (looks from the appearance record)', async () => {
    await loadAppearance('nba');
    const r = await goldenNba(nba);
    expect(r.samples).toBe(88750);
    expect(r.digest).toBe('3f9c227c');
  }, 120000);
});

describe.skipIf(SPORT !== 'nfl')('select-nfl: identical to the renderer before the move', () => {
  it('hashes every body, every other frame of 2 seeded games to the base digest, with the old looks', async () => {
    const r = await goldenNfl({ ...nfl, lookFor: LEGACY_LOOK.nfl });
    expect(r.samples).toBe(104852);
    expect(r.digest).toBe('ed52d518');
  }, 120000);

  it('pins the players-4 digest (looks from the appearance record)', async () => {
    await loadAppearance('nfl');
    const r = await goldenNfl(nfl);
    expect(r.samples).toBe(104852);
    expect(r.digest).toBe('aad55a15');
  }, 120000);
});
