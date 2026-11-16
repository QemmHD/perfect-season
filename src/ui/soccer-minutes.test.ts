// Claude, 2026-11-16 (studio overhaul, team ut, ut-3): MINUTES on screen under soccer's run
// (`PS_SPORT=soccer vitest run soccer sport-branches` only picks files with "soccer" in the name).
// The break-reminder suite has its own fake page and clock, so it runs in its own soccer file.
import { it } from 'vitest';
import { SPORT } from '../engine/sport';

if (SPORT === 'soccer') await import('./minutes-view.test');
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
