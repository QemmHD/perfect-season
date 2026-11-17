// Claude (packs-1, 2026-11-16): Scout Stamps, the packs team's bad-luck protection (docs/studio-overhaul/
// packs-plan.md D7 and D13, packs.md "Scout Stamps"). Packs earn stamps that never expire (1 per 100 coins
// of the pack's price; an earned pack at its Store price, an SBC reward pack nothing; +10 for a special edition the player already
// had), ut's rewards grant them (the 30-minute MINUTES rung, Scout Drops, Rookie Week), and the stamp shelf
// (stamp-shelf.ts) turns them into picks.
//
// Saved as the optional `ut.content.stamps = { earned, spent }`. An older build drops that field when it
// re-saves a cloud snapshot, so the balance never relies on it alone: it is the larger of the field and a
// floor rebuilt from fields every build keeps (the Pack Tracker's newest 300 packs, the `stamps-grant:` and
// `stamps:` claims). Granted stamps and spent stamps survive exactly; pack stamps lose at most those of
// packs older than the newest 300 since release.
//
// This module is light on purpose: ut's badge and inbox import it on every UT open. It imports nothing at
// runtime (types only), never the card pool, packs, cards, SBCs, ratings or squads.
import type { ContentState, WithContent } from './content-state';
import type { PullEntry, PullLog } from './pull-log-state';

/** Pack stamps are earned from this instant on (midnight US-Eastern on 2026-11-27, the release; it moves
 * with calendar SHIP_DATE). Packs opened before it pay none: no back-pay. Grants are not time-gated. */
export const STAMPS_FROM = Date.UTC(2026, 10, 27, 5);

/** One stamp per this many coins of a pack's price. */
export const COINS_PER_STAMP = 100;
/** Extra stamps for each special edition pulled that the player already had. */
export const DUPLICATE_SPECIAL_STAMPS = 10;

/** The stamp shelf (packs-6 page): what stamps buy, cheapest first. None of it is ever sold for coins. */
export const STAMP_SHELF: readonly { item: 'g82' | 'scout85' | 'standouts' | 'program'; cost: 50 | 120 | 300 | 600; label: string }[] = [
  // (packs-6: the gold rungs' floors differ by sport, stamp-shelf.ts SHELF_FLOOR, so the labels carry none)
  { item: 'g82', cost: 50, label: 'Player Pick' },
  { item: 'scout85', cost: 120, label: 'Stamp Scout' },
  { item: 'standouts', cost: 300, label: 'Standout Pick' },
  { item: 'program', cost: 600, label: 'Program Pick' },
];
export type ShelfItem = (typeof STAMP_SHELF)[number]['item'];

/** The cheapest item on the shelf: the Store badge and the inbox line light from here. */
export const STAMP_SHELF_MIN = 50;

/** D13: one "Scout Stamp" reward in Game Design V2's tables is a grant of this many stamps. */
export const STAMP_GRANT = { minutes30: 5, drop: 3 } as const;

export type StampSource = 'minutes' | 'drop' | 'rookie' | 'other';
const SOURCES: readonly StampSource[] = ['minutes', 'drop', 'rookie', 'other'];

/** Claim families: a redemption `stamps:<item>:<cost>:<uuid>` and a grant `stamps-grant:<n>:<source>:<id>`. */
const SPEND = 'stamps:';
const GRANT = 'stamps-grant:';
/** Claims kept at the end of `claims`, so a `slice(-5000)` (any build's) never drops them. */
export const isPinnedClaim = (id: string) => id.startsWith(SPEND) || id.startsWith(GRANT);

/**
 * Claims in their kept order: every other claim first (oldest first), then the pinned stamp claims, then
 * the newest `max` overall, the pinned ones last to go. Duplicates are already removed by the caller.
 */
export function pinClaims(claims: string[], max = 5000): string[] {
  const pinned = claims.filter(isPinnedClaim);
  if (!pinned.length) return claims.length > max ? claims.slice(-max) : claims;
  const rest = claims.filter((c) => !isPinnedClaim(c));
  const out = rest.concat(pinned);
  return out.length > max ? out.slice(-max) : out;
}

/** The claims with `id` added once, pinned stamp claims kept at the end (content-state.ts withClaim). */
export function addClaim(claims: string[] | undefined, id: string, max = 5000): string[] {
  const list = claims ?? [];
  if (list.includes(id)) return list;
  if (isPinnedClaim(id)) return pinClaims([...list, id], max);
  const pinned = list.filter(isPinnedClaim);
  if (!pinned.length) return [...list, id].slice(-max);
  return pinClaims([...list.filter((c) => !isPinnedClaim(c)), id, ...pinned], max);
}

// ---------- earning ----------

/**
 * The Store price of the packs an earned (free) pack earns stamps at, per sport (packs.ts packDefs; the
 * stamps suite checks they agree). Kinds not listed (Spotlight and event rewards, Live Calendar program
 * packs, signed Club Collection packs) earn stamps only for coins actually paid.
 */
export const NOMINAL_PRICE: Record<'nba' | 'nfl' | 'soccer', Record<string, number>> = {
  nba: { bronze: 250, silver: 500, gold: 1050, premium: 1900, position: 800, elite: 2700, jumbo: 4200, standout: 3000, lightning: 2250, roster: 1700, captains: 4300, dynasty: 8400 },
  nfl: { bronze: 175, silver: 350, gold: 1000, premium: 1400, position: 575, elite: 1800, jumbo: 3000, standout: 1800, lightning: 1350, roster: 1100, captains: 2600, dynasty: 4900 },
  soccer: { bronze: 220, silver: 450, gold: 900, premium: 1600, position: 650, elite: 1900, jumbo: 3300, standout: 2400, lightning: 1800, roster: 1100, captains: 3200, dynasty: 6200 },
};

const BASE_TIERS = new Set(['bronze', 'silver', 'gold']);
const PICK_KINDS = new Set(['scout', 'standout-pick', 'swap', 'new-era', 'calendar']);

/**
 * A pack that never earns stamps: the Daily Drop and daily bonuses (Scout Drop 1), Scout Drops 2-3,
 * picks (including the shelf's own), the starter and admin awards, and SBC reward packs.
 * Claude (packs-1 fix, review finding 1): an SBC pack is paid for with traded-in cards, not coins, so it
 * earns nothing: at its Store price the daily Upgrades alone paid about 62 stamps a day from junk (NBA),
 * and a full day of SBCs about 100-120, more than an 82+ Player Pick a day. Its pending id is
 * `sbc:<challenge>:<uuid>` from this release (source 'sbc'), a Streamlined SBC's `stream:…` (source 'sbc').
 */
export function earnsNothing(e: Pick<PullEntry, 'id' | 'k' | 's'>): boolean {
  return (
    e.k === 'daily' ||
    e.s === 'daily' ||
    e.s === 'sbc' ||
    e.id.startsWith('sbc:') ||
    e.id.startsWith('stream:') ||
    e.k === 'starter' ||
    e.k.startsWith('admin-') ||
    e.id.startsWith('pick:') ||
    e.id.startsWith('scout-drop:') ||
    PICK_KINDS.has(e.k) ||
    e.k.startsWith('live-pick:')
  );
}

/** The sport of a logged pack, from its first card's id ("nba:season:…"). */
function sportOf(e: Pick<PullEntry, 'cs'>): 'nba' | 'nfl' | 'soccer' | null {
  const s = e.cs[0]?.[0].slice(0, e.cs[0][0].indexOf(':'));
  return s === 'nba' || s === 'nfl' || s === 'soccer' ? s : null;
}

/** The stamps a pack's price earns: coins paid, or an earned pack's Store price, 1 per 100. */
export function priceStamps(e: Pick<PullEntry, 'id' | 'k' | 's' | 'c' | 'at' | 'cs'>): number {
  if (e.at < STAMPS_FROM || earnsNothing(e)) return 0;
  const sport = sportOf(e);
  const kind = e.k.startsWith('position:') ? 'position' : e.k;
  const nominal = sport && Object.prototype.hasOwnProperty.call(NOMINAL_PRICE[sport], kind) ? NOMINAL_PRICE[sport][kind] : 0;
  return Math.floor((e.c > 0 ? e.c : nominal) / COINS_PER_STAMP);
}

/**
 * All the stamps one logged pack earned. `had(cardId)` says whether the player already had that card
 * before this pack (each such special edition adds DUPLICATE_SPECIAL_STAMPS).
 */
export function packStamps(e: Pick<PullEntry, 'id' | 'k' | 's' | 'c' | 'at' | 'cs'>, had: (cardId: string) => boolean): number {
  const base = priceStamps(e);
  if (e.at < STAMPS_FROM || earnsNothing(e)) return base;
  let dup = 0;
  for (const [id, , tier] of e.cs) if (!BASE_TIERS.has(tier) && had(id)) dup += DUPLICATE_SPECIAL_STAMPS;
  return base + dup;
}

// ---------- the recovery floors (D7, D13) ----------

const pullFloors = new WeakMap<PullLog, number>();
/** Stamps of the packs still in the Pack Tracker's recent list (a special is a duplicate when an earlier
 * entry of the list holds its card). Memoized per log object (logs are replaced, never mutated). */
export function pullStampsFloor(log: PullLog | undefined): number {
  if (!log) return 0;
  const hit = pullFloors.get(log);
  if (hit !== undefined) return hit;
  const seen = new Set<string>();
  let sum = 0;
  for (const e of log.r) {
    if (e.at >= STAMPS_FROM) sum += packStamps(e, (id) => seen.has(id));
    for (const c of e.cs) seen.add(c[0]);
  }
  pullFloors.set(log, sum);
  return sum;
}

const claimFloors = new WeakMap<string[], { granted: number; spent: number }>();
/** Stamps granted (`stamps-grant:<n>:…`) and spent (`stamps:<item>:<cost>:…`) by the claims. */
export function claimStamps(claims: string[] | undefined): { granted: number; spent: number } {
  if (!claims) return { granted: 0, spent: 0 };
  const hit = claimFloors.get(claims);
  if (hit) return hit;
  let granted = 0;
  let spent = 0;
  for (const c of claims) {
    if (c.charCodeAt(0) !== 115 || !c.startsWith('stamps')) continue;
    if (c.startsWith(GRANT)) {
      const n = parseGrant(c)?.n;
      if (n) granted += n;
    } else if (c.startsWith(SPEND)) {
      const parts = c.split(':');
      const cost = Number(parts[2]);
      if (parts.length >= 4 && STAMP_SHELF.some((s) => s.item === parts[1] && s.cost === cost)) spent += cost;
    }
  }
  const out = { granted, spent };
  claimFloors.set(claims, out);
  return out;
}

function parseGrant(claim: string): { n: number; key: string } | null {
  const rest = claim.slice(GRANT.length);
  const i = rest.indexOf(':');
  const n = Number(rest.slice(0, i));
  if (i <= 0 || !Number.isInteger(n) || n < 1 || n > 50) return null;
  return { n, key: rest.slice(i + 1) };
}

/** The floors a save's other fields prove: what was earned (packs + grants) and spent. */
export function stampFloors(c: Pick<ContentState, 'pulls' | 'claims'>): { earned: number; spent: number } {
  const k = claimStamps(c.claims);
  return { earned: pullStampsFloor(c.pulls) + k.granted, spent: k.spent };
}

/** `stamps` as the normalizer keeps it: never below its floors (null when there is nothing to keep). */
export function normalizeStamps(raw: unknown, c: Pick<ContentState, 'pulls' | 'claims'>): { earned: number; spent: number } | null {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1e9, Math.round(x))) : 0);
  const f = stampFloors(c);
  if (!r && !f.earned && !f.spent) return null;
  return { earned: Math.max(num(r?.earned), f.earned), spent: Math.max(num(r?.spent), f.spent) };
}

/** The saved counters with their floors applied (what every write builds on). */
function totals(ut: WithContent): { earned: number; spent: number } {
  const c = ut.content ?? {};
  const f = stampFloors(c);
  return { earned: Math.max(c.stamps?.earned ?? 0, f.earned), spent: Math.max(c.stamps?.spent ?? 0, f.spent) };
}

/** The player's Scout Stamps in this sport: what they can spend now (never below 0). */
export function stampsBalance(ut: WithContent): number {
  const t = totals(ut);
  return Math.max(0, t.earned - t.spent);
}

/** The state with `n` stamps earned (recordPull's pack stamps), on top of the floors. */
export function withEarnedStamps<T extends WithContent>(ut: T, n: number): T {
  if (!(n > 0)) return ut;
  const t = totals(ut);
  return { ...ut, content: { ...(ut.content ?? {}), stamps: { earned: t.earned + n, spent: t.spent } } };
}

/** The state with `cost` stamps spent under the redemption claim `stamps:<item>:<cost>:<uuid>`. */
export function withSpentStamps<T extends WithContent>(ut: T, item: ShelfItem, cost: number, uuid: string): T {
  const t = totals(ut);
  const c = ut.content ?? {};
  return { ...ut, content: { ...c, claims: addClaim(c.claims, SPEND + item + ':' + cost + ':' + uuid), stamps: { earned: t.earned, spent: t.spent + cost } } };
}

/** Whether this redemption uuid was already spent (any item, any cost). */
export function redeemed(ut: WithContent, uuid: string): boolean {
  return !!ut.content?.claims?.some((c) => c.startsWith(SPEND) && c.endsWith(':' + uuid) && c.split(':').length >= 4);
}

/**
 * D13: grant `n` stamps from one of ut's rewards, exactly once per (source, id): the claim
 * `stamps-grant:<n>:<source>:<id>` is written with the stamps, and a repeat returns the same state.
 * `n` must be an integer from 1 to 50 (anything else throws: a programming error). Stamps are per sport
 * like packs: they go to the sport whose `ut` is passed (the one the player is in when they claim).
 */
export function grantStamps<T extends WithContent>(ut: T, n: number, source: StampSource, id: string): T {
  if (!Number.isInteger(n) || n < 1 || n > 50) throw new Error('grantStamps: n must be an integer from 1 to 50, got ' + n);
  if (!SOURCES.includes(source)) throw new Error('grantStamps: unknown source ' + String(source));
  if (typeof id !== 'string' || !id) throw new Error('grantStamps: an id is required');
  const key = source + ':' + id;
  const c = ut.content ?? {};
  if (c.claims?.some((x) => x.startsWith(GRANT) && parseGrant(x)?.key === key)) return ut;
  const t = totals(ut);
  return { ...ut, content: { ...c, claims: addClaim(c.claims, GRANT + n + ':' + key), stamps: { earned: t.earned + n, spent: t.spent } } };
}

/** The next shelf item the player can't afford yet ("12 stamps to your 82+ Player Pick"), or null when
 * every item is in reach. A true, deterministic distance (V2 D.10), never a tease. */
export function stampsToNext(ut: WithContent): { have: number; need: number; item: string } | null {
  const have = stampsBalance(ut);
  const next = STAMP_SHELF.find((s) => s.cost > have);
  return next ? { have, need: next.cost - have, item: next.label } : null;
}
