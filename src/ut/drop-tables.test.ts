// Claude (packs-2, 2026-11-16): the drop-tables suite (packs-suites/drop-tables.ts) in the NBA and NFL runs.
// Soccer runs it from soccer-drop-tables.test.ts, the only files its run picks up.
import { SPORT } from '../engine/sport';
import { dropTablesSuite } from './packs-suites/drop-tables';

if (SPORT !== 'soccer') dropTablesSuite();
else it.skip('runs in soccer-drop-tables.test.ts', () => {});
