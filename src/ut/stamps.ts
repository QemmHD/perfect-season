// Claude, 2026-11-16 (studio overhaul, team ut-1): two permanent stamps written once, on the first
// Ultimate Team open of the studio build, into `hq.claims` (a list every older client keeps verbatim,
// so the stamps never move):
//   studio:since:<Eastern day>  when this save first ran the studio build. New reward schemes start
//                               after it (daily objectives v2 the next day, Career Road from the
//                               level then), so nobody is paid retroactively and nothing earned
//                               before it changes meaning.
//   pid:<12 base36 chars>       a random per-save key for things that must differ between players
//                               but stay fixed for one (never an identity: it is not the Nostr key).
// The random bytes come from crypto.getRandomValues: this is not simulation code.
import { hqOf } from './objectives';
import type { UtState } from './state';

const SINCE = 'studio:since:';
const PID = 'pid:';

function randomKey(bytes: (n: number) => Uint8Array): string {
  return Array.from(bytes(12), (b) => (b % 36).toString(36)).join('');
}
const cryptoBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Write the stamps if this save has none yet (unchanged otherwise). */
export function ensureStudio(ut: UtState, day: string, bytes: (n: number) => Uint8Array = cryptoBytes): UtState {
  const h = hqOf(ut),
    add: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ut;
  if (!h.claims.some((c) => c.startsWith(SINCE))) add.push(SINCE + day);
  if (!h.claims.some((c) => c.startsWith(PID))) add.push(PID + randomKey(bytes));
  return add.length ? { ...ut, hq: { ...h, claims: [...h.claims, ...add] } } : ut;
}
/** The Eastern day this save first ran the studio build (the earliest, should two phones race). */
export function studioSince(ut: UtState): string | null {
  const days = hqOf(ut)
    .claims.filter((c) => c.startsWith(SINCE))
    .map((c) => c.slice(SINCE.length))
    .sort();
  return days[0] ?? null;
}
/** The save's random key (the first written, should two phones race). */
export function playerKey(ut: UtState): string | null {
  const k = hqOf(ut).claims.find((c) => c.startsWith(PID));
  return k ? k.slice(PID.length) : null;
}
