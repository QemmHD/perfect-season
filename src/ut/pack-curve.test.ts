// Claude (packs-2, 2026-11-16): the pack-curve suite (packs-suites/pack-curve.ts) in the NBA and NFL runs.
// Soccer runs it from soccer-pack-curve.test.ts, the only files its run picks up.
import { SPORT } from '../engine/sport';
import { packCurveSuite } from './packs-suites/pack-curve';

if (SPORT !== 'soccer') packCurveSuite();
else it.skip('runs in soccer-pack-curve.test.ts', () => {});
