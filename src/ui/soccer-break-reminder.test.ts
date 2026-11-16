// Claude, 2026-11-16 (studio overhaul, team ut, ut-3): the break reminder under soccer's run.
import { it } from 'vitest';
import { SPORT } from '../engine/sport';

if (SPORT === 'soccer') await import('./break-reminder.test');
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
