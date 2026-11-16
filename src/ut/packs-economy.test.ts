// Claude (packs-1, 2026-11-10): the packs-economy suite (packs-suites/packs-economy.ts) in the NBA and
// NFL runs. Soccer runs it from soccer-packs-economy.test.ts, the only files its run picks up.
import { SPORT } from '../engine/sport';
import { packsEconomySuite } from './packs-suites/packs-economy';

if (SPORT !== 'soccer') packsEconomySuite();
else it.skip('runs in soccer-packs-economy.test.ts', () => {});
