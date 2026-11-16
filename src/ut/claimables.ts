// Claude, 2026-11-16 (studio overhaul, team ut-1): what Ultimate Team has waiting to claim, without the
// card pool. The Rewards inbox (inbox.ts) needs the pool for Sets and Collection milestones and pulls
// packs/cards/sbc into memory; the main-app badge, the "Next up" strip and the One-More bar must not.
// utClaimables counts the same inbox rows by the same rules:
//   - most sources are read straight from the save, through local re-implementations of inbox.ts's
//     checks wherever the original lives next to the pool (each one is pinned to its original by
//     claimables-reimpl.test.ts);
//   - the three pool-dependent rows (Sets, Collection milestones, Moments) come from a small cache,
//     `hq.poolClaimables`, that UltimateTeam.tsx rewrites whenever it computes the inbox. The cache is
//     keyed by a signature of everything those rows read; when it does not match (cards gained outside
//     UT, an old client stripped it), the count is the light one and says so (`approx`).
// Nothing here writes state except writePoolCache, which the UT screen calls.
import { contentOf } from './content-state';
import { freshCup } from './cup-state';
import { readyEvos } from './evolutions';
import { developmentReady, hqOf, objectiveDeck, SEASON_STEP, SEASON_TIERS } from './objectives';
import { packsClaimables } from './packs-claimables';
import { rivalsOf } from './rivals';
import type { UtState } from './state';
import type { UtSport } from './types';

// ---------- the Eastern clock (the game's day turns at midnight in New York) ----------

let fmt: Intl.DateTimeFormat | null = null;
/** The Eastern date key and the hours left until Eastern midnight, for an epoch time. */
export function easternClock(now: number): { day: string; hoursLeft: number } {
  try {
    fmt ??= new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const p = Object.fromEntries(fmt.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
    const mins = Number(p.hour) * 60 + Number(p.minute);
    return { day: p.year + '-' + p.month + '-' + p.day, hoursLeft: (1440 - mins) / 60 };
  } catch {
    const d = new Date(now);
    return { day: d.toISOString().slice(0, 10), hoursLeft: 24 - d.getUTCHours() - d.getUTCMinutes() / 60 };
  }
}

// ---------- local re-implementations (originals: claimables-reimpl.test.ts) ----------

/** content-packs.ts previousDay */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10);
}
/** content-packs.ts STREAK_DAYS */
export const DROP_STREAK_DAYS = 7;
/** content-packs.ts dailyStatus: today's Daily Drop, and the streak day it is (or was) for */
export function dropStatus(ut: UtState, day: string): { ready: boolean; streak: number } {
  const d = contentOf(ut).daily;
  if (d?.day === day) return { ready: false, streak: d.streak };
  const cont = d && d.day === previousDay(day);
  return { ready: true, streak: cont ? (d!.streak % DROP_STREAK_DAYS) + 1 : 1 };
}
/** daily-hub.ts CALENDAR_DAYS and calendarStatus */
export const CALENDAR_STEPS = 5;
export function calendarReady(ut: UtState, day: string): boolean {
  return contentOf(ut).calendar?.day !== day;
}
/** new-era.ts NEW_ERA_ID and newEraReady */
export const NEW_ERA_CLAIM = 'new-era-2026';
const contentClaimed = (ut: UtState, id: string) => !!ut.content?.claims?.includes(id);
export const newEraWaiting = (ut: UtState) => !!contentOf(ut).era?.eligible && !contentClaimed(ut, NEW_ERA_CLAIM);
/** standouts.ts STANDOUT_OBJECTIVE_WINS, content-progress.ts standoutObjectiveId and standoutWins */
export const STANDOUT_WINS = 5;
export function standoutReady(ut: UtState, week: string): boolean {
  const w = contentOf(ut).soWins;
  return (w?.week === week ? w.ids.length : 0) >= STANDOUT_WINS && !contentClaimed(ut, 'so-obj:' + week);
}
/** cup.ts cupOf, cupClaimId and inbox.ts cupRewardReady */
export function cupTitleReady(ut: UtState, sport: UtSport): boolean {
  const c = ut.cup ?? freshCup(),
    a = c.active;
  return (
    !!a &&
    a.sport === sport &&
    a.done &&
    a.results.length === 3 &&
    a.results.every((r) => r.won) &&
    !c.claims.includes('cup:' + a.sport + ':' + a.week + ':' + a.kind)
  );
}
/** inbox.ts seasonsReady: Season Pass tiers unlocked and not claimed, every season */
export function seasonTiersReady(ut: UtState): number {
  let n = 0;
  for (const s of Object.values(hqOf(ut).seasons))
    for (let t = 1; t <= SEASON_TIERS; t++) if (s.xp >= t * SEASON_STEP && !s.claimed.includes(t)) n++;
  return n;
}
/** inbox.ts daily-bonus row: today's three are all done (claimed or ready) and the bonus is not claimed */
function dailyBonusWaiting(ut: UtState, day: string, deck: ReturnType<typeof objectiveDeck>): boolean {
  const today = deck.filter((o) => o.group === 'daily' && o.period === day);
  return today.length > 0 && today.every((o) => o.claimed || o.progress >= o.target) && !contentClaimed(ut, 'daily-bonus:' + day);
}
/**
 * moments.ts readiness without the Moments table (it lives next to the Squad Battles ladder): a
 * Moment of this sport cleared and not claimed. Used only when the cache does not match; the exact
 * row comes from the cache.
 */
function momentsLight(ut: UtState, sport: UtSport): number {
  if (sport === 'soccer') return 0;
  return Object.entries(hqOf(ut).moments).filter(([id, m]) => id.startsWith(sport + ':') && m.completedAt && !m.claimed).length;
}

// ---------- the cache of pool-dependent rows ----------

/** The rows only the pool can decide; their count is cached in `hq.poolClaimables`. */
export const POOL_ROWS = ['sets', 'collection', 'moments'] as const;

/** Order-independent 32-bit hash of a list of ids (FNV-1a per id, summed and xored). */
function bag(ids: Iterable<string>): string {
  let sum = 0,
    x = 0,
    n = 0;
  for (const s of ids) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    sum = (sum + (h >>> 0)) >>> 0;
    x = (x ^ h) >>> 0;
    n++;
  }
  return n + '.' + sum.toString(36) + '.' + x.toString(36);
}
// Claude, 2026-11-16 (ut-1 review): a bag per array, once (arrays are replaced, never mutated, in the
// app; the length check also catches an in-place push): a 3,000-card club hashed every read cost 0.3 ms.
const bags = new WeakMap<object, { n: number; bag: string }>();
function bagOf<T>(list: readonly T[], id: (x: T) => string): string {
  const hit = bags.get(list);
  if (hit && hit.n === list.length) return hit.bag;
  const b = bag(list.map(id));
  bags.set(list, { n: list.length, bag: b });
  return b;
}
const EMPTY: readonly string[] = [];
/**
 * The signature of everything the pool rows read: owned editions, discovered editions, set and
 * collection receipts, and Moments progress. ≤ 80 characters.
 */
export function poolSig(ut: UtState, sport: UtSport): string {
  const h = hqOf(ut);
  let setClaims = 0;
  for (const c of ut.content?.claims ?? []) if (c.startsWith('set:')) setClaims++;
  let done = 0,
    taken = 0;
  for (const m of Object.values(h.moments)) {
    if (m.completedAt) done++;
    if (m.claimed) taken++;
  }
  return [
    sport + bagOf(ut.owned, (c) => c.cardId),
    bagOf(ut.collected ?? EMPTY, (c) => c),
    setClaims + '.' + (ut.collectionClaims?.length ?? 0) + '.' + done + '.' + taken,
  ]
    .join(':')
    .slice(0, 80);
}
/** The state with the cache set (unchanged when it already says this). */
export function writePoolCache(ut: UtState, sig: string, n: number): UtState {
  const h = hqOf(ut),
    c = h.poolClaimables;
  if (c && c.sig === sig && c.n === n) return ut;
  return { ...ut, hq: { ...h, poolClaimables: { sig, n: Math.max(0, Math.min(999, Math.floor(n))) } } };
}

// ---------- the count ----------

export interface Claimables {
  /** claimable inbox rows: the badge number (inbox.ts inboxCount) */
  count: number;
  /** the claimable rows' ids, as inbox.ts names them (the pool rows as one 'pool' id when cached) */
  ids: string[];
  /** one short line per claimable row */
  lines: string[];
  /** unopened packs and open picks in the Store (shown, not claimed by CLAIM ALL) */
  packs: number;
  picks: number;
  /** the Daily Drop is waiting, and the streak day it would be */
  dropReady: boolean;
  dropDay: number;
  calendarReady: boolean;
  /** the Daily Drop streak kept so far (0 when it has lapsed) */
  streak: number;
  /** Daily Drop waiting, a streak of 2+ days running, and 4 h or less to Eastern midnight */
  streakAtRisk: boolean;
  hoursLeft: number;
  /** the pool rows were estimated (no matching cache): the count may be off until UT opens */
  approx: boolean;
}

/** `deck`: today's objectiveDeck(ut, day), when the caller already has it (next-action.ts). */
export function utClaimables(ut: UtState, day: string, week: string, sport: UtSport, now: number, deck = objectiveDeck(ut, day)): Claimables {
  const ids: string[] = [],
    lines: string[] = [];
  const row = (id: string, line: string) => {
    ids.push(id);
    lines.push(line);
  };
  if (newEraWaiting(ut)) row('new-era', 'New Era bundle');
  const drop = dropStatus(ut, day);
  if (drop.ready) row('daily', 'Daily Drop · day ' + drop.streak);
  if (calendarReady(ut, day)) row('calendar', 'Login calendar');
  const objectives = deck.filter((o) => !o.claimed && o.progress >= o.target).length;
  if (objectives) row('objectives', objectives + (objectives === 1 ? ' objective' : ' objectives') + ' complete');
  if (dailyBonusWaiting(ut, day, deck)) row('daily-bonus', 'Daily objectives bonus');
  const tiers = seasonTiersReady(ut);
  if (tiers) row('season', tiers + (tiers === 1 ? ' Season Pass tier' : ' Season Pass tiers'));
  if (standoutReady(ut, week)) row('standout', 'Weekly Standouts pick');
  if (contentOf(ut).draft?.active?.done) row('draft', 'UT Draft rewards');
  const evos = readyEvos(ut).length;
  if (evos) row('evos', evos + (evos === 1 ? ' Evolution' : ' Evolutions') + ' ready');
  const rivals = rivalsOf(ut.rivals, week),
    rivalsN = rivals.rewards.filter((r) => !rivals.claimed.includes(r.id)).length;
  if (rivalsN) row('rivals', 'Rivals ' + (rivalsN === 1 ? 'reward' : rivalsN + ' rewards'));
  if (developmentReady(ut)) row('development', 'Card development');
  if (cupTitleReady(ut, sport)) row('cup', 'Club Cup title');
  const pk = packsClaimables(ut, day, sport);
  pk.ids.forEach((id, i) => row(id, pk.lines[i] ?? 'Reward'));
  const cache = hqOf(ut).poolClaimables,
    valid = !!cache && cache.sig === poolSig(ut, sport);
  let count = ids.length;
  if (valid) {
    if (cache!.n > 0) {
      ids.push('pool');
      lines.push(cache!.n === 1 ? 'Collection reward' : cache!.n + ' collection rewards');
    }
    count += cache!.n;
  } else {
    const m = momentsLight(ut, sport);
    if (m) row('moments', m === 1 ? 'Moment reward' : m + ' Moment rewards');
    count = ids.length;
  }
  const { hoursLeft } = easternClock(now);
  const d = contentOf(ut).daily;
  const streak = d && (d.day === day || d.day === previousDay(day)) ? d.streak : 0;
  return {
    count,
    ids,
    lines,
    packs: ut.packs.length,
    picks: contentOf(ut).picks?.length ?? 0,
    dropReady: drop.ready,
    dropDay: drop.streak,
    calendarReady: calendarReady(ut, day),
    streak,
    streakAtRisk: drop.ready && drop.streak >= 2 && hoursLeft <= 4,
    hoursLeft,
    approx: !valid,
  };
}
