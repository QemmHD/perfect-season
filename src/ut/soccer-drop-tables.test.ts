// Claude (packs-2, 2026-11-16): the drop-tables suite (packs-suites/drop-tables.ts) in the soccer run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files named for soccer). The NBA and NFL
// runs load it from drop-tables.test.ts.
import { SPORT } from '../engine/sport';
import { dropTablesSuite } from './packs-suites/drop-tables';

if (SPORT === 'soccer') dropTablesSuite();
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
