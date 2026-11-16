// Claude (packs-1, 2026-11-16): the packs team's lines for ut's claimables (the main-tab badge, the app
// badge and the rewards inbox). ut owns this file's existence and shape (ut plan §4 H); packs owns its
// body (packs-plan.md §V2.4 C). It stays light: it imports only scout-stamps.ts, never the card pool,
// packs, cards, SBCs, ratings or squads, so the badge costs nothing at launch.
//
// This round it has one line: a stamp-shelf pick is ready. The Daily Drop is not counted here (ut counts
// it itself), and the Live Calendar check-in lines arrive with the check-in days (deferred F2).
import { STAMP_SHELF_MIN, stampsBalance } from './scout-stamps';
import type { WithContent } from './content-state';
import type { UtSport } from './types';

/** The id of the "a pick is ready" line: a pointer to the stamp shelf, never a claim. */
export const STAMPS_READY = 'stamp-shelf:ready';

/** What packs adds to ut's claimables: how many, stable ids, and the inbox lines. */
export function packsClaimables(ut: WithContent, _day: string, _sport: UtSport): { n: number; ids: string[]; lines: string[] } {
  const ids: string[] = [];
  const lines: string[] = [];
  if (stampsBalance(ut) >= STAMP_SHELF_MIN) {
    ids.push(STAMPS_READY);
    lines.push('Scout Stamps: a pick is ready');
  }
  return { n: ids.length, ids, lines };
}
