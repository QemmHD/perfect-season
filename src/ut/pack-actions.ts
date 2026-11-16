// Claude (packs-2, 2026-11-16): the packs team's one hook into UltimateTeam.tsx (packs-plan §1 "Outside
// our lane"). UT's routing file calls `usePackActions` once; everything the pack flows need from the club
// comes from here, so later packs work changes this file, not ut's.
//   openOpts()     what an opening knows about the club: the owned card ids, so Standout and program
//                  slots never repeat an owned card while any of their set is unowned, and Position/Unit
//                  and Elite Gold golds prefer one the club doesn't have (packs.ts curvePick)
//   limitOf(kind)  the Store pack's purchase limit kind, or null for an unlimited pack (packs-3: a Club
//                  Collection pack, also as its frozen `studio:<kind>:…` recipe, has its own daily or
//                  weekly limit)
// Claude (packs-3): the named flash sales' deals (flashDeals, flashDeal) and their one-per-player limit
// (flashLeft, recordFlash), shared by the Store and UltimateTeam's buy flow.
import { useMemo } from 'react';
import { readPackSnapshot } from '../admin/catalog';
import { contentOf, withContent } from './content-state';
import { isLimitedPack, type LimitedPack } from './content-packs';
import { flashPrice, flashSalesAt } from './flash';
import { livePackDef, packOfKind } from './live-packs';
import { ownedCardIds, type OpenOpts, packDefs } from './packs';
import type { UtState } from './state';
import type { OwnedCard, UtSport } from './types';

export interface PackActions {
  openOpts: () => OpenOpts;
  limitOf: (kind: string) => LimitedPack | null;
}

/** The pack actions for the club `ut` (only its owned copies are read). */
export function usePackActions(ut: { owned: readonly OwnedCard[] }): PackActions {
  const owned = useMemo(() => ownedCardIds(ut.owned), [ut.owned]);
  return useMemo(
    () => ({
      openOpts: () => ({ owned }),
      limitOf: (kind: string) => {
        const base = readPackSnapshot(kind)?.base ?? kind;
        return isLimitedPack(base) ? base : null;
      },
    }),
    [owned],
  );
}

/** A flash sale's offer as the Store sells it. */
export interface FlashDeal {
  /** the limit key, `flash:<sale>:<kind>:<day>` (also the deal's id) */
  key: string;
  sale: string;
  /** the pack kind it opens ('scout' is a pick) */
  kind: string;
  name: string;
  /** the Store price, and the sale price */
  was: number;
  price: number;
  /** the discount, 0..1 */
  off: number;
  /** when the sale's window closes (ms) */
  end: number;
}

/** The named flash sales' deals open at `at`, in the sport's Store (none in soccer: no Live Calendar yet). */
export function flashDeals(sport: UtSport, at: number): FlashDeal[] {
  const defs = packDefs(sport);
  const out: FlashDeal[] = [];
  for (const sale of flashSalesAt(at, sport))
    for (const o of sale.offers) {
      const live = o.kind.startsWith('live:') ? packOfKind(o.kind) : null;
      const def = live ? livePackDef(sport, live, at) : defs[o.kind as keyof typeof defs];
      if (!def || !def.price) continue;
      out.push({ key: o.key, sale: sale.name, kind: o.kind, name: def.name, was: def.price, price: flashPrice(def.price, o.off), off: o.off, end: sale.end });
    }
  return out;
}

/** One deal by its key, if its window is open at `at`. */
export function flashDeal(sport: UtSport, key: string, at: number): FlashDeal | null {
  return flashDeals(sport, at).find((d) => d.key === key) ?? null;
}

/** 1 per player per sale day: whether this deal can still be bought. */
export function flashLeft(ut: UtState, key: string): boolean {
  return !contentOf(ut).buys?.[key];
}

/** The deal bought (its limit counter, kept with the other counters' last 40). */
export function recordFlash(ut: UtState, key: string): UtState {
  return withContent(ut, (c) => {
    const { [key]: _had, ...rest } = c.buys ?? {};
    void _had;
    const kept = Object.fromEntries(Object.entries(rest).slice(-39));
    return { ...c, buys: { ...kept, [key]: 1 } };
  });
}
