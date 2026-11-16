// Claude, 2026-11-16 (studio overhaul, ut-1): the packs team's seam in the light claimables count
// (claimables.ts). Team packs owns this function's body and fills it at merge with the claims its
// new systems add (calendar check-in and path claims, stamp redemption ready, Program Bag keys); the
// same items must appear in inbox.ts inboxItems so the badge and the inbox keep counting alike.
// Until then nothing of theirs is claimable on this branch, so it is exactly zero.
//
// Rule for the body: no imports from pool, packs, cards, sbc, rate or squad (claimables-graph.test.ts),
// so the main-app badge never loads the card pool.
import type { UtState } from './state';
import type { UtSport } from './types';

export interface PacksClaimables {
  /** claimable items (inbox rows) */
  n: number;
  /** stable item ids, as the inbox lists them */
  ids: string[];
  /** one short line per item, for the badge's "Next up" text */
  lines: string[];
}

export function packsClaimables(ut: UtState, day: string, sport: UtSport): PacksClaimables {
  void ut;
  void day;
  void sport;
  return { n: 0, ids: [], lines: [] };
}
