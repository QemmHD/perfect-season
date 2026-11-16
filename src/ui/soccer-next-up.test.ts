// Claude, 2026-11-16 (studio overhaul, team ut, ut-4): the main app's next best action under soccer's
// run (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files with "soccer" in the name).
import { it } from 'vitest';
import { SPORT } from '../engine/sport';

if (SPORT === 'soccer') await import('./next-up.test');
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
