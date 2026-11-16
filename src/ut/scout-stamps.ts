// Claude (packs-1, 2026-11-10): Scout Stamps, the packs team's bad-luck protection (docs/studio-overhaul/
// packs-plan.md D7). Packs earn stamps that never expire; the shelf turns them into 82+ picks and Scout's
// Choice. This module is the contract the ut team codes against (Store badge, Hub, Season Pass): the
// balance is read here and nowhere else. Named scout-stamps.ts because ut's own stamps.ts (enrolment
// stamps) takes that path. Commit B of packs-1 fills in earning, grants and the recovery floors.
import type { WithContent } from './content-state';

/** The cheapest item on the stamp shelf (50 / 120 / 300 / 600, packs-6): the Store badge lights from here. */
export const STAMP_SHELF_MIN = 50;

/** The player's Scout Stamps: what they can spend now (never below 0). */
export function stampsBalance(_ut: WithContent): number {
  return 0;
}
