// Claude (packs-4, 2026-11-16): the odds suite (packs-suites/odds.ts) in the soccer run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files named for soccer). The NBA and NFL
// runs load it from odds.test.ts.
import { SPORT } from '../engine/sport';
import { oddsSuite } from './packs-suites/odds';

if (SPORT === 'soccer') oddsSuite();
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
