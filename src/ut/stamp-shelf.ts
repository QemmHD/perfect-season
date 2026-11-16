// Claude (packs-1, 2026-11-16): the stamp shelf's redemption (packs-plan.md §V2.4 B). Scout Stamps buy
// picks, never coins or packs: 50 stamps a 1-of-3 82+ gold pick, 120 an 85+ Stamp Scout (open since
// packs-2's gold curve), 300 a Standout pick and 600 a Program pick (both open with the shelf page in
// packs-6). Each redemption is spent exactly once under `stamps:<item>:<cost>:<uuid>` (a pinned claim, so
// the spend survives an older build) and the pick opens through the ordinary pending-pick sheet.
import { awardPick, type AwardPickKind } from './content-packs';
import type { Pool } from './pool';
import { redeemed, type ShelfItem, STAMP_SHELF, stampsBalance, withSpentStamps } from './scout-stamps';
import type { UtState } from './state';

/** The shelf items that can be redeemed in this build. */
const OPEN: ReadonlySet<ShelfItem> = new Set(['g82', 'scout85']);
/** The pick each open item awards. */
const PICK: Partial<Record<ShelfItem, AwardPickKind>> = { g82: 'pick-82', scout85: 'pick-85' };

/** Whether this shelf item can be redeemed in this build (the page shows the others as coming soon). */
export function shelfOpen(item: ShelfItem): boolean {
  return OPEN.has(item);
}

/**
 * Spend stamps on a shelf item: the balance drops by its cost and exactly one pick sheet is pending
 * (pick id `stamps:<item>:<uuid>`). A uuid already redeemed returns the same state (a retried tap or a
 * replayed update changes nothing). Null when the item isn't open yet, the balance is short, the open
 * pick sheets are full (PICKS_MAX: the new pick would be dropped on the next load), or the pool has
 * nothing to offer. `day` is the Eastern date the Standout and Program picks will draw from.
 */
export function redeemStamps(ut: UtState, pool: Pool, item: ShelfItem, uuid: string, _day: string, at: number): UtState | null {
  const shelf = STAMP_SHELF.find((s) => s.item === item);
  if (!shelf || !uuid) return null;
  if (redeemed(ut, uuid)) return ut;
  const kind = PICK[item];
  if (!kind || !shelfOpen(item) || stampsBalance(ut) < shelf.cost) return null;
  // null (nothing spent) when the pick sheets are full (PICKS_MAX) or the pool has nothing to offer
  const picked = awardPick(ut, pool, kind, 'stamps:' + item + ':' + uuid, at);
  if (!picked || picked === ut) return null;
  return withSpentStamps(picked, item, shelf.cost, uuid);
}
