// Claude (packs-5, 2026-11-16): the ratings-truth suite (packs-suites/ratings-truth.ts) in the soccer run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files named for soccer). The NBA and NFL
// runs load it from ratings-truth.test.ts.
import { SPORT } from '../engine/sport';
import { ratingsTruthSuite } from './packs-suites/ratings-truth';

if (SPORT === 'soccer') ratingsTruthSuite();
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
