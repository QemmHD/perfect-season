// Claude (packs-1, 2026-11-16): the stamps suite (packs-suites/stamps.ts) in the NBA and NFL runs.
// Soccer runs it from soccer-stamps.test.ts, the only files its run picks up.
import { SPORT } from '../engine/sport';
import { stampsSuite } from './packs-suites/stamps';

if (SPORT !== 'soccer') stampsSuite();
else it.skip('runs in soccer-stamps.test.ts', () => {});
