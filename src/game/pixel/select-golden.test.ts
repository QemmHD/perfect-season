// players-2: the selection code moved out of hoops2/football2 render.ts into select-nba/select-nfl
// verbatim. These digests were taken from the code as it stood inside the renderers at the base
// commit (79682ba), with the same runner (select-golden.helpers.ts), so any behavioural drift in the
// move fails here. The soccer twin is select-golden-soccer.test.ts (run with PS_SPORT=soccer).
//
// players-4: `lookFor` now draws each body's appearance record (looks.ts `matchLook`), which changes
// the look half of every sample on purpose. Run with the looks the renderers drew before
// (LEGACY_LOOK), the modules still hash to the players-2 digests: the clip, pose and gait choices are
// untouched. The new digest is pinned beside it, with the sport's appearance data loaded.
//
// players-5: locomotion changes the clip, pose and gait choices on purpose (a walk below the jog, rates
// held to 0.8-1.25x, shorter steps, the slide and backpedal at the speed he moves, turns that take
// 100 ms per 90°, the planted foot and the lean), and the runner now hashes the whole frame the
// renderers take (`motionOf`: facing, plant, head lead, offset, lean, gait). Both digests are re-pinned
// on that code: the legacy-look one still isolates the look half (it differs from the players-4 one by
// the looks alone), and the old players-2 / players-4 values (556ad50a, 3f9c227c; NFL ed52d518,
// aad55a15) stay in git history as the proof of the move.
import { SPORT } from '../../engine/sport';
import { loadAppearance } from './appearance';
import { goldenNba, goldenNfl, LEGACY_LOOK } from './select-golden.helpers';
import * as nba from './select-nba';
import * as nfl from './select-nfl';

describe.skipIf(SPORT !== 'nba')('select-nba: every choice pinned', () => {
  it('hashes every body, every other frame of 3 seeded games to the players-5 digest, with the old looks', async () => {
    const r = await goldenNba({ ...nba, lookFor: LEGACY_LOOK.nba });
    expect(r.samples).toBe(88750);
    expect(r.digest).toBe('0fb1e2aa');
  }, 120000);

  it('pins the players-5 digest (looks from the appearance record)', async () => {
    await loadAppearance('nba');
    const r = await goldenNba(nba);
    expect(r.samples).toBe(88750);
    expect(r.digest).toBe('eee73918');
  }, 120000);
});

describe.skipIf(SPORT !== 'nfl')('select-nfl: every choice pinned', () => {
  it('hashes every body, every other frame of 2 seeded games to the players-5 digest, with the old looks', async () => {
    const r = await goldenNfl({ ...nfl, lookFor: LEGACY_LOOK.nfl });
    expect(r.samples).toBe(104852);
    expect(r.digest).toBe('f83f9e62');
  }, 120000);

  it('pins the players-5 digest (looks from the appearance record)', async () => {
    await loadAppearance('nfl');
    const r = await goldenNfl(nfl);
    expect(r.samples).toBe(104852);
    expect(r.digest).toBe('4ea8a66d');
  }, 120000);
});
