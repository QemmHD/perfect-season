// Football's hit-stop (Claude, studio overhaul nfl-4; contract C10, V2 §B.0.5). Every NFL hit-stop
// goes through `impact`, so the lengths live in one table and the V2 budget is kept in one place:
// each stop is 33-120 ms (30 under reduced motion), and no more than 150 ms of them in any second
// of real time (a stop that would break the budget is shortened to fit, or skipped). At the merge
// its body becomes players' impactOf.
//
// RENDER ONLY, like juice.ts: it holds back the real time fed to the fixed-step accumulator, so the
// same steps run with the same inputs and a seeded game comes out the same with or without it.
import type { Juice } from '../juice';

/** Hit-stop lengths (ms) by moment. */
export const FEEL = { juke: 50, truck: 90, bighit: 80, int: 50 } as const;
export type ImpactKind = keyof typeof FEEL;

/** No more than this much hit-stop (ms) in any 1,000 ms of real time. */
export const HITSTOP_BUDGET = 150;
/** Reduced motion keeps the beat but holds the picture no longer than this (ms). */
const REDUCED_MS = 30;

/**
 * Hold the game still for `kind`'s moment from real time `now` (ms). Returns the ms actually held
 * (0 when the second's budget is spent). `log` is the screen's record of recent stops.
 */
export function impact(kind: ImpactKind, juice: Juice, now: number, log: { at: number; ms: number }[]): number {
  for (let i = log.length - 1; i >= 0; i--) if (now - log[i].at >= 1000) log.splice(i, 1);
  const spent = log.reduce((n, s) => n + s.ms, 0);
  const want = juice.reduced ? Math.min(REDUCED_MS, FEEL[kind]) : FEEL[kind];
  const ms = Math.min(want, HITSTOP_BUDGET - spent);
  if (ms < (juice.reduced ? 1 : 33)) return 0;
  juice.freezeUntil = Math.max(juice.freezeUntil, now + ms);
  log.push({ at: now, ms });
  return ms;
}
