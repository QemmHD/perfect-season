// Claude (packs-6, 2026-11-17): the ladder suite (packs-suites/ladder.ts) in the NBA and NFL runs: pity, the
// stamp shelf, the stamp pace and the tier ladder with every V2 income row. Soccer runs it from
// soccer-ladder.test.ts, the only files its run picks up.
import { SPORT } from '../engine/sport';
import { ladderSuite } from './packs-suites/ladder';

if (SPORT !== 'soccer') ladderSuite();
else it.skip('runs in soccer-ladder.test.ts', () => {});
