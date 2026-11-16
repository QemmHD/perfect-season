// Claude (packs-2, 2026-11-16): the pack-curve suite (packs-suites/pack-curve.ts) in the soccer run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files named for soccer). The NBA and NFL
// runs load it from pack-curve.test.ts.
import { SPORT } from '../engine/sport';
import { packCurveSuite } from './packs-suites/pack-curve';

if (SPORT === 'soccer') packCurveSuite();
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
