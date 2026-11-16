// Claude, 2026-11-16 (studio overhaul, team ut-1): the claimables suites under soccer's run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files with "soccer" in the name).
import { it } from 'vitest';
import { SPORT } from '../engine/sport';

if (SPORT === 'soccer') {
  await import('./claimables.test');
  await import('./claimables-reimpl.test');
  await import('./next-action.test');
  await import('./progress-core.test');
} else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
