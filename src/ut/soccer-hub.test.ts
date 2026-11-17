// Claude, 2026-11-16 (studio overhaul, team ut, ut-4): UT Home's feed under soccer's run (`PS_SPORT=soccer
// vitest run soccer sport-branches` only picks files with "soccer" in the name): never a hidden soccer
// mode, Live Now with at least two items every day, Done for today, the Season card.
import { it } from 'vitest';
import { SPORT } from '../engine/sport';

if (SPORT === 'soccer') await import('./hub-feed.test');
else it.skip('runs in the soccer run (PS_SPORT=soccer)', () => {});
