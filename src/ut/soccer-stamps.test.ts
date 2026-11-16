// Claude (packs-1, 2026-11-16): the stamps suite (packs-suites/stamps.ts) in the soccer run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files named for soccer). The NBA and NFL
// runs load it from stamps.test.ts.
import { SPORT } from '../engine/sport';
import { stampsSuite } from './packs-suites/stamps';

if (SPORT === 'soccer') stampsSuite();
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
