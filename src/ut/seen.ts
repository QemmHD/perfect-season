// Claude, 2026-11-16 (studio overhaul, team ut-1): what the player has already looked at, so a "new"
// dot shows only for something new that they can act on, and clears the first time they see it.
// Stored as optional `hq.seen` (key → the token last seen: a wave id, a week, a season id), at most
// 64 keys, each key and token ≤ 80 characters (hq-state.ts normalizes it). An old client drops it,
// which only brings a dot back once.
//   keys in use: 'store:wave', 'live:<id>', 'objectives:week', 'pass:season'
import { SEEN_MAX } from './hq-state';
import { hqOf } from './objectives';
import type { UtState } from './state';

const ok = (s: string) => s.length > 0 && s.length <= 80;

/** Has the player not yet seen `token` under `key`? */
export function isUnseen(ut: UtState, key: string, token: string): boolean {
  return hqOf(ut).seen?.[key] !== token;
}
/** The dot rule: show a "new" dot only when something is unseen and the player can act on it. */
export function showDot(ut: UtState, key: string, token: string, actionable: boolean): boolean {
  return actionable && !!token && isUnseen(ut, key, token);
}
/** The state with `token` seen under `key` (unchanged when it already is; the oldest key goes past 64). */
export function markSeen(ut: UtState, key: string, token: string): UtState {
  if (!ok(key) || !ok(token) || !isUnseen(ut, key, token)) return ut;
  const h = hqOf(ut),
    rest = Object.entries(h.seen ?? {}).filter(([k]) => k !== key);
  return { ...ut, hq: { ...h, seen: Object.fromEntries([...rest.slice(-(SEEN_MAX - 1)), [key, token]]) } };
}
