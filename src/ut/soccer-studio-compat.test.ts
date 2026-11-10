// Claude, 2026-11-10 (studio overhaul, team ut): the old-save compatibility suite under soccer's run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files with "soccer" in the name).
import { it } from 'vitest';
import { SPORT } from '../engine/sport';

if (SPORT === 'soccer') await import('./studio-compat.test');
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
