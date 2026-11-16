// Claude, 2026-11-16 (studio overhaul, team ut): the MINUTES suites under soccer's run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files with "soccer" in the name).
import { it } from 'vitest';
import { SPORT } from '../engine/sport';

if (SPORT === 'soccer') {
  await import('./profile-playtime.test');
  await import('./playtime.test');
  await import('../ut/minutes.test');
} else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
