// Claude (packs-4, 2026-11-16): the odds suite (packs-suites/odds.ts) in the NBA and NFL runs. Soccer runs
// it from soccer-odds.test.ts, the only files its run picks up.
import { SPORT } from '../engine/sport';
import { oddsSuite } from './packs-suites/odds';

if (SPORT !== 'soccer') oddsSuite();
else it.skip('runs in soccer-odds.test.ts', () => {});
