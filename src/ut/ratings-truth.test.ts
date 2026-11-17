// Claude (packs-5, 2026-11-16): the ratings-truth suite (packs-suites/ratings-truth.ts) in the NBA and NFL
// runs. Soccer runs it from soccer-ratings-truth.test.ts, the only files its run picks up.
import { SPORT } from '../engine/sport';
import { ratingsTruthSuite } from './packs-suites/ratings-truth';

if (SPORT !== 'soccer') ratingsTruthSuite();
else it.skip('runs in soccer-ratings-truth.test.ts', () => {});
