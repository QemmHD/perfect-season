// Claude (packs-1, 2026-11-10): Scout Stamps, the packs team's bad-luck protection (docs/studio-overhaul/
// packs-plan.md D7). Packs earn stamps that never expire; the shelf turns them into 82+ picks and Scout's
// Choice. This module is the contract the ut team codes against (Store badge, Hub, Season Pass): the
// balance is read here and nowhere else. Stamps start being earned with packs-6 (`STAMPS_FROM`, the
// release instant), with no back-pay for earlier packs, so every profile's balance is 0 until then.
import type { WithContent } from './content-state';

/** The cheapest item on the stamp shelf (50 / 120 / 300 / 600, packs-6): the Store badge lights from here. */
export const STAMP_SHELF_MIN = 50;

/** The player's Scout Stamps: what they can spend now (never below 0). */
export function stampsBalance(_ut: WithContent): number {
  return 0;
}
