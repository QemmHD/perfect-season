// Claude, 2026-11-16 (studio overhaul, team ut, task ut-4): Ultimate Team's sheets that open by
// themselves, one at a time and in a fixed order, never over a pack opening, a pick, a card or the
// first starter pack, and each at most once a visit of the app once dismissed:
//   1  'interrupted'  a match the app was closed during (ut-6 adds the sheet)
//   2  'launch'       packs' program launch takeover (packs adds it at merge)
//   3  'newEra'       the one-time New Era bundle
// A sheet that is not wanted (its condition is false) is skipped; the next one shows when the one on
// screen is dismissed or done.
import { useState } from 'react';

export type UtModal = 'interrupted' | 'launch' | 'newEra';
export const MODAL_ORDER: readonly UtModal[] = ['interrupted', 'launch', 'newEra'];

/** Dismissed this app visit (module state: leaving and re-entering UT does not bring a sheet back). */
const dismissed = new Set<UtModal>();

/** The sheet to show now, or null: the first wanted one in order that has not been dismissed. */
export function nextModal(wants: Partial<Record<UtModal, boolean>>, blocked: boolean, done: ReadonlySet<UtModal> = dismissed): UtModal | null {
  if (blocked) return null;
  return MODAL_ORDER.find((m) => wants[m] && !done.has(m)) ?? null;
}

/** For tests: forget this visit's dismissals. */
export function resetModalQueue(): void {
  dismissed.clear();
}

/** The queue in a component: the sheet to show and the way to dismiss it. */
export function useUtModalQueue(wants: Partial<Record<UtModal, boolean>>, blocked: boolean): [UtModal | null, (m: UtModal) => void] {
  const [, bump] = useState(0);
  return [
    nextModal(wants, blocked),
    (m) => {
      dismissed.add(m);
      bump((n) => n + 1);
    },
  ];
}
