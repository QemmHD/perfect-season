// Claude (packs-1, 2026-11-16): the stamp shelf's redemption (packs-plan.md §V2.4 B). Scout Stamps buy
// picks, never coins or packs. Each redemption is spent exactly once under `stamps:<item>:<cost>:<uuid>` (a
// pinned claim, so the spend survives an older build) and the pick opens through the ordinary pending-pick
// sheet.
//
// Claude (packs-6, 2026-11-17): every rung is open, and the page (StampShelf.tsx) shows them.
//   50   Player Pick   1 of 3 golds at the sport's shelf floor (SHELF_FLOOR)
//   120  Stamp Scout   1 of 3 golds at the sport's higher shelf floor
//   300  Standout Pick 1 of 3 of this week's Weekly Standouts (soccer: Matchday Standouts)
//   600  Program Pick  1 of 3 released cards of the program live now (basketball and football only;
//                      with no program live the tile says so and nothing can be spent)
// Each item is worth 5-12% of the 100 coins of packs a stamp stands for, by the game's own prices
// (scripts/packs/ladder.ts shelfValue; the ladder suite checks every sport): a pick of three golds at a
// floor costs what the Store charges for one (Scout's Choice: a quarter of the cheapest pack route to a
// gold that good, odds.ts routeCost), a Standout or program card its ladder rung. That is why the gold
// floors differ by sport and are lower than packs-1's 82+ / 85+: on the realistic curve an 85+ is a real
// hit (NBA route 29,600 coins), so 120 stamps for one would have paid back 62% of the coins spent, and
// stamps would have become the main source of 85+ golds. Picks already waiting keep the kind they were
// saved with.
import { easternDateKey } from '../engine/season';
import { pickFor as bySport } from '../engine/sport';
import { addPick, awardPick, type AwardPickKind, pickFor, programPickSource } from './content-packs';
import { picksFull } from './content-state';
import type { Pool } from './pool';
import { weekOf } from './sbc';
import { redeemed, type ShelfItem, STAMP_SHELF, stampsBalance, withSpentStamps } from './scout-stamps';
import { standoutProgram } from './standouts';
import type { UtState } from './state';
import type { UtSport } from './types';

/**
 * The gold rungs' floors per sport (basketball's scale; each sport shows its own): the highest floor whose
 * Store price stays inside 5-12% of the coins the stamps stand for (packs-plan packs-6 "Shelf").
 */
export const SHELF_FLOOR: Record<UtSport, { g82: 80 | 82; scout85: 82 | 83 | 84 }> = {
  nba: { g82: 80, scout85: 82 },
  nfl: { g82: 82, scout85: 84 },
  soccer: { g82: 82, scout85: 83 },
};

/** The award pick a gold rung hands out (content-packs GOLD_PICKS, by its floor). */
const GOLD_KIND: Record<number, AwardPickKind> = { 80: 'pick-80', 82: 'pick-82', 83: 'pick-83', 84: 'pick-84' };

/** The pick kind a shelf item opens in a sport (what odds.ts publishes its sheet for). */
export function shelfPickKind(item: ShelfItem, sport: UtSport): string {
  if (item === 'standouts') return 'standout-pick';
  if (item === 'program') return 'program-pick';
  return GOLD_KIND[SHELF_FLOOR[sport][item]];
}

/** What the page calls an item ("Player Pick", "Standout Pick", …). */
export function shelfLabel(item: ShelfItem, sport: UtSport): string {
  const label = STAMP_SHELF.find((s) => s.item === item)!.label;
  return item === 'standouts' ? bySport(sport, { nba: label, nfl: label, soccer: 'Matchday ' + label }) : label;
}

/** Whether a shelf item can be redeemed on `day`, and why not when it can't (the tile says so). */
export function shelfStatus(pool: Pool, item: ShelfItem, day: string): { open: boolean; why?: string } {
  if (item === 'program') {
    if (pool.sport === 'soccer') return { open: false, why: 'No programs in soccer yet' };
    if (!programPickSource(pool, day)) return { open: false, why: 'No program live' };
  }
  if (item === 'standouts' && standoutProgram(pool, weekOf(day)).cards.length < 1) return { open: false, why: 'No Standouts this week' };
  return { open: true };
}

/** Whether this shelf item can be redeemed in this build (every rung since packs-6). */
export function shelfOpen(item: ShelfItem): boolean {
  return STAMP_SHELF.some((s) => s.item === item);
}

/**
 * Spend stamps on a shelf item: the balance drops by its cost and exactly one pick sheet is pending
 * (pick id `stamps:<item>:<uuid>`). A uuid already redeemed returns the same state (a retried tap or a
 * replayed update changes nothing). Null when the item can't be had on `day` (no program live, no
 * Standouts), the balance is short, the open pick sheets are full (PICKS_MAX: the new pick would be
 * dropped on the next load), or the pool has nothing to offer. `day` is the Eastern date of `at`: the
 * Standout week and the live program come from it.
 */
export function redeemStamps(ut: UtState, pool: Pool, item: ShelfItem, uuid: string, day: string, at: number): UtState | null {
  const shelf = STAMP_SHELF.find((s) => s.item === item);
  if (!shelf || !uuid) return null;
  if (redeemed(ut, uuid)) return ut;
  if (!shelfStatus(pool, item, day).open || stampsBalance(ut) < shelf.cost) return null;
  const id = 'stamps:' + item + ':' + uuid;
  let picked: UtState | null;
  if (item === 'standouts') {
    if (picksFull(ut)) return null;
    const pick = pickFor(pool, 'standout-pick', id, weekOf(day), at);
    picked = pick.options.length ? addPick(ut, pick) : null;
  } else {
    // a Program Pick draws from the program live at `at` (awardPick reads its day from it): never an 82+ stand-in
    if (item === 'program' && !programPickSource(pool, easternDateKey(new Date(at)))) return null;
    picked = awardPick(ut, pool, shelfPickKind(item, pool.sport) as AwardPickKind, id, at);
  }
  // null (nothing spent) when the pick sheets are full (PICKS_MAX) or the pool has nothing to offer
  if (!picked || picked === ut) return null;
  return withSpentStamps(picked, item, shelf.cost, uuid);
}
