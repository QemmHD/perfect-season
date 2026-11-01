// Claude, 2026-11-01: the Weekly Standouts objective. Win 5 matches this week with 2+ Standouts in
// the starting squad for a Standout pick (three of the week's Standouts, keep one). Each match id
// counts once; the reward's claim id is `so-obj:<week>`.
import { claimed, contentOf, withClaim } from './content-state';
import { addPick, pickFor } from './content-packs';
import type { Pool } from './pool';
import { STANDOUT_OBJECTIVE_NEED, STANDOUT_OBJECTIVE_WINS, standoutsIn } from './standouts';
import type { UtState } from './state';

export function standoutWins(ut: UtState, week: string): number {
  const w = contentOf(ut).soWins;
  return w?.week === week ? w.ids.length : 0;
}

/** After a finished match: a win with 2+ Standouts in the squad counts toward this week's objective. */
export function recordStandoutWin(ut: UtState, r: { matchId: string; week: string; won: boolean; cardIds: string[] }): UtState {
  if (!r.won || standoutsIn(r.cardIds) < STANDOUT_OBJECTIVE_NEED) return ut;
  const c = contentOf(ut);
  const ids = c.soWins?.week === r.week ? c.soWins.ids : [];
  if (ids.includes(r.matchId) || ids.length >= STANDOUT_OBJECTIVE_WINS) return ut;
  return { ...ut, content: { ...c, soWins: { week: r.week, ids: [...ids, r.matchId] } } };
}

export const standoutObjectiveId = (week: string) => 'so-obj:' + week;

/** Claim the objective's Standout pick once a week. */
export function claimStandoutObjective(ut: UtState, pool: Pool, week: string, at: number): UtState {
  const id = standoutObjectiveId(week);
  if (claimed(ut, id) || standoutWins(ut, week) < STANDOUT_OBJECTIVE_WINS) return ut;
  return addPick(withClaim(ut, id), pickFor(pool, 'standout-pick', id, week, at));
}
