// Claude, 2026-11-01: the Pack Tracker suite under soccer's run (`PS_SPORT=soccer vitest run soccer
// sport-branches` only picks files named for soccer). The cases are in pull-tracker.test.ts, which
// the NBA and NFL runs already cover, so they load here only in the soccer run.
import { SPORT } from '../engine/sport';

if (SPORT === 'soccer') await import('./pull-tracker.test');
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
