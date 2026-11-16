// Claude (packs-1, 2026-11-10): the packs-economy suite (packs-suites/packs-economy.ts) in the soccer
// run (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files named for soccer). The NBA
// and NFL runs load it from packs-economy.test.ts.
import { SPORT } from '../engine/sport';
import { packsEconomySuite } from './packs-suites/packs-economy';

if (SPORT === 'soccer') packsEconomySuite();
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
