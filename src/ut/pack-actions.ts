// Claude (packs-2, 2026-11-16): the packs team's one hook into UltimateTeam.tsx (packs-plan §1 "Outside
// our lane"). UT's routing file calls `usePackActions` once; everything the pack flows need from the club
// comes from here, so later packs work changes this file, not ut's.
//   openOpts()     what an opening knows about the club: the owned card ids, so Standout and program
//                  slots never repeat an owned card while any of their set is unowned, and Position/Unit
//                  and Elite Gold golds prefer one the club doesn't have (packs.ts curvePick)
//   limitOf(kind)  the Store pack's purchase limit kind, or null for an unlimited pack
import { useMemo } from 'react';
import { isLimitedPack, type LimitedPack } from './content-packs';
import { ownedCardIds, type OpenOpts } from './packs';
import type { OwnedCard } from './types';

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
      limitOf: (kind: string) => (isLimitedPack(kind) ? kind : null),
    }),
    [owned],
  );
}
