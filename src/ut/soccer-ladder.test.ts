// Claude (packs-6, 2026-11-17): the ladder suite (packs-suites/ladder.ts) in the soccer run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files named for soccer). The NBA and NFL
// runs load it from ladder.test.ts.
import { SPORT } from '../engine/sport';
import { ladderSuite } from './packs-suites/ladder';

if (SPORT === 'soccer') ladderSuite();
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
