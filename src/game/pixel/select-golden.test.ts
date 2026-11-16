// players-2: the selection code moved out of hoops2/football2 render.ts into select-nba/select-nfl
// verbatim. These digests were taken from the code as it stood inside the renderers at the base
// commit (79682ba), with the same runner (select-golden.helpers.ts), so any behavioural drift in the
// move fails here. The soccer twin is select-golden-soccer.test.ts (run with PS_SPORT=soccer).
import { SPORT } from '../../engine/sport';
import { goldenNba, goldenNfl } from './select-golden.helpers';
import * as nba from './select-nba';
import * as nfl from './select-nfl';

describe.skipIf(SPORT !== 'nba')('select-nba: identical to the renderer before the move', () => {
  it('hashes every body, every other frame of 3 seeded games to the base digest', async () => {
    const r = await goldenNba(nba);
    expect(r.samples).toBe(88750);
    expect(r.digest).toBe('556ad50a');
  }, 120000);
});

describe.skipIf(SPORT !== 'nfl')('select-nfl: identical to the renderer before the move', () => {
  it('hashes every body, every other frame of 2 seeded games to the base digest', async () => {
    const r = await goldenNfl(nfl);
    expect(r.samples).toBe(104852);
    expect(r.digest).toBe('ed52d518');
  }, 120000);
});
