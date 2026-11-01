// Claude, 2026-11-01: the Pack Tracker (docs/PULL-TRACKER.md). Every pack opened from this build
// on (store packs, the Daily Drop, rewards and gifts, the starter, the Preview Pack, Spotlight and
// program packs) and every kept pick (Scout's Choice, Standout/Icon/calendar/program picks, the Swap
// Desk) is written once, in the same state update that deposits its cards, to `ut.content.pulls`:
// the most recent packs in full plus uncapped running totals per pack type. The saved shape and its
// caps are in pull-log-state.ts. Nothing here changes odds, prices, card ids or what a pack holds.
import { pickFor } from '../engine/sport';
import { fcToDisplay } from './fc-scale';
import { livePackDef, livePacksOn } from './live-packs';
import { fill, openPack, packDefs, packRand, positionChoices, quickSellValue, walkoutLevel, type Odds, type PackDef, type SlotTier } from './packs';
import { TIER_RANK, type Pool } from './pool';
import { capRecent, type PullAgg, type PullEntry, type PullLog, type PulledCard } from './pull-log-state';
import type { ContentState } from './content-state';
import type { OwnedCard, CardRetirement, RatedCard, Tier, UtSport } from './types';

export type { PullAgg, PullEntry, PullLog, PulledCard };

/** Overall bucket edges on the FC-style display scale: under 75, 75–79, 80–82, 83–85, 86–89, 90+. */
export const OVR_EDGES = [75, 80, 83, 86, 90];
export const OVR_LABELS = ['<75', '75–79', '80–82', '83–85', '86–89', '90+'];
const BASE: Tier[] = ['bronze', 'silver', 'gold'];
const LEGENDS = new Set(['legend', 'goat', 'landmark']);
export const isSpecial = (tier: string) => !BASE.includes(tier as Tier);

/** The display-scale edges for a sport (the identity while the tier cuts are 65/75). */
export function ovrEdges(sport: UtSport): number[] {
  return OVR_EDGES.map((x) => fcToDisplay(x, sport));
}
export function ovrBucket(ovr: number, sport: UtSport): number {
  const e = ovrEdges(sport);
  let i = 0;
  while (i < e.length && ovr >= e[i]) i++;
  return i;
}

/** Picks: one card kept from a sheet (they never counted in `packsOpened`). */
const PICK_GROUPS = new Set(['scout', 'standout-pick', 'swap', 'new-era', 'calendar', 'live-pick']);
export const isPickGroup = (g: string) => PICK_GROUPS.has(g);

/** The pack type a pack's totals go under: unit/position packs together, a Preview Pack apart from
 * Premium Gold (its buyer saw the cards first), every event Spotlight reward together. */
export function packGroup(kind: string, source: string): string {
  if (source === 'preview') return 'preview';
  if (kind.startsWith('position:')) return 'position';
  if (kind.startsWith('event-spotlight:')) return 'event-spotlight';
  if (kind.startsWith('live-pick:')) return 'live-pick';
  return kind;
}

/** A pack type's name (picks and unit packs read the same whatever their sheet said). */
export function groupName(group: string, name: string, sport: UtSport): string {
  const fixed: Record<string, string> = {
    position: pickFor(sport, { nba: 'Position Pack', nfl: 'Unit Pack', soccer: 'Position Pack' }),
    preview: 'Preview Pack',
    'event-spotlight': 'Spotlight Reward',
    'live-pick': 'Program Pick',
    scout: "Scout's Choice",
    'standout-pick': 'Standout Pick',
    swap: 'Swap Desk Pick',
    calendar: 'Calendar Gold Pick',
    'new-era': 'Icon Pick',
    starter: 'Starter Pack',
    daily: 'Daily Drop',
  };
  return fixed[group] ?? name;
}

/** Where a waiting (earned) pack came from, read from its stable id. */
export function sourceOfPending(id: string): string {
  const pre: [string, string][] = [
    ['event:', 'event'],
    ['set:', 'set'],
    ['collection:', 'collection'],
    ['calendar:', 'calendar'],
    ['daily-bonus:', 'daily'],
    ['daily-gold:', 'daily'],
    ['daily-', 'daily'],
    ['draft:', 'draft'],
    ['stream:', 'sbc'],
    ['objective:', 'objective'],
    ['moment:', 'moment'],
    ['circuit:', 'circuit'],
    ['rivals:', 'rivals'],
    ['so-obj:', 'objective'],
    ['new-era', 'bundle'],
    ['swap:', 'swap'],
    ['scout:', 'store'],
  ];
  for (const [p, s] of pre) if (id.startsWith(p)) return s;
  if (id.includes(':tier:')) return 'season';
  return 'reward';
}

export const SOURCE_LABEL: Record<string, string> = {
  store: 'Store',
  daily: 'Daily',
  reward: 'Reward',
  starter: 'Starter',
  preview: 'Preview',
  sbc: 'SBC',
  season: 'Season Pass',
  objective: 'Objective',
  moment: 'Moment',
  circuit: 'Circuit',
  event: 'Event',
  set: 'Set',
  collection: 'Collection',
  calendar: 'Calendar',
  draft: 'UT Draft',
  rivals: 'Rivals',
  swap: 'Swap Desk',
  bundle: 'New Era',
};

/** A pack (or pick) as it opened: what the tracker writes. `uid` is the uid prefix (see PullEntry.u). */
export interface PullInput {
  id: string;
  kind: string;
  name: string;
  price: number;
  source: string;
  at: number;
  uid: string;
  cards: RatedCard[];
}

/** Card i's uid in a logged pack. */
export const uidOf = (e: Pick<PullEntry, 'u'>, i: number) => (e.u.endsWith(':') ? e.u + i : e.u);

const better = (a: [string, number, string], b?: [string, number, string, number]) => !b || (TIER_RANK[a[2] as Tier] ?? 0) - (TIER_RANK[b[2] as Tier] ?? 0) > 0 || ((TIER_RANK[a[2] as Tier] ?? 0) === (TIER_RANK[b[2] as Tier] ?? 0) && a[1] > b[1]);

function addToAgg(prev: PullAgg | undefined, p: PullInput, group: string, sport: UtSport): PullAgg {
  const a: PullAgg = prev
    ? { ...prev, t: { ...prev.t }, o: prev.o.slice() }
    : { nm: '', n: 0, pd: 0, c: 0, q: 0, qp: 0, k: 0, t: {}, o: [0, 0, 0, 0, 0, 0], sp: 0, lg: 0, w: 0, h86: 0, h90: 0, hs: 0, f: p.at, l: p.at };
  const e = ovrEdges(sport);
  const qs = p.cards.reduce((s, rc) => s + quickSellValue(rc), 0);
  a.nm = groupName(group, p.name, sport);
  a.n++;
  if (p.price > 0) {
    a.pd++;
    a.c += p.price;
    a.qp += qs;
  }
  a.q += qs;
  a.k += p.cards.length;
  for (const rc of p.cards) {
    a.t[rc.tier] = (a.t[rc.tier] ?? 0) + 1;
    a.o[ovrBucket(rc.ovr, sport)]++;
    if (isSpecial(rc.tier)) a.sp++;
    if (LEGENDS.has(rc.tier)) a.lg++;
    if (walkoutLevel(rc) >= 2) a.w++;
    const c: [string, number, string] = [rc.line.id, rc.ovr, rc.tier];
    if (better(c, a.b)) a.b = [...c, p.at];
  }
  if (p.cards.some((rc) => rc.ovr >= e[3])) a.h86++;
  if (p.cards.some((rc) => rc.ovr >= e[4])) a.h90++;
  if (p.cards.some((rc) => isSpecial(rc.tier))) a.hs++;
  a.f = Math.min(a.f || p.at, p.at);
  a.l = Math.max(a.l, p.at);
  return a;
}

interface Loggable {
  content?: ContentState;
  owned?: OwnedCard[];
}

/**
 * The state with one opened pack logged, exactly once: call it in the same update that deposits
 * the pack's cards, on the state *before* they are added. A pack already in the recent list, or
 * whose first card is already owned (a retried or replayed opening), changes nothing.
 */
export function recordPull<T extends Loggable>(ut: T, p: PullInput): T {
  if (!p.cards.length) return ut;
  const c = ut.content ?? {};
  const log = c.pulls;
  if (log?.r.some((e) => e.id === p.id)) return ut;
  const first = p.uid.endsWith(':') ? p.uid + 0 : p.uid;
  if (ut.owned?.some((o) => o.uid === first)) return ut;
  const sport = p.cards[0].line.sport;
  const group = packGroup(p.kind, p.source);
  const entry: PullEntry = {
    id: p.id,
    k: p.kind,
    n: p.name.slice(0, 60),
    c: Math.max(0, Math.round(p.price)),
    s: p.source,
    at: p.at,
    u: p.uid,
    cs: p.cards.map((rc) => [rc.line.id, rc.ovr, rc.tier] as PulledCard),
  };
  const pulls: PullLog = {
    since: log?.since ? Math.min(log.since, p.at) : p.at,
    r: capRecent([...(log?.r ?? []), entry]),
    a: { ...(log?.a ?? {}), [group]: addToAgg(log?.a[group], { ...p, price: entry.c }, group, sport) },
  };
  return { ...ut, content: { ...c, pulls } };
}

export function pullsOf(ut: Loggable): PullLog | null {
  return ut.content?.pulls ?? null;
}

/** Packs opened before the tracker existed (they counted in `packsOpened`, pick sheets never did). */
export function untrackedPacks(ut: Loggable & { packsOpened: number }): number {
  const a = ut.content?.pulls?.a ?? {};
  const tracked = Object.entries(a).reduce((s, [g, x]) => s + (isPickGroup(g) ? 0 : x.n), 0);
  return Math.max(0, ut.packsOpened - tracked);
}

// ---------- the published odds, for comparing ----------

/** A pack type's published definition, when it has one this build can read. */
export function defFor(sport: UtSport, group: string, day: string): PackDef | null {
  const defs = packDefs(sport) as Record<string, PackDef>;
  if (group === 'preview') return defs.premium;
  if (defs[group]) return defs[group];
  if (group.startsWith('live:') || group.startsWith('live-plus:')) {
    const pack = livePacksOn(day).find((p) => p.id === group);
    return pack ? livePackDef(sport, pack) : null;
  }
  return null;
}

const SPECIAL_SLOTS: SlotTier[] = ['standout', 'promo', 'legend', 'landmark', 'program', 'spotlight', 'goat'];
/** The published chance that a pack holds at least one special edition (exact, from its slot odds). */
export function specialOdds(def: Pick<PackDef, 'slots'>): number {
  return 1 - def.slots.reduce((a, o: Odds) => a * (1 - SPECIAL_SLOTS.reduce((s, t) => s + (o[t] ?? 0), 0)), 1);
}

export interface Expected {
  /** packs simulated */
  packs: number;
  /** chance of at least one 86+ / 90+ in a pack */
  r86: number;
  r90: number;
  special: number;
  /** average quick-sell value of one pack */
  qs: number;
}

const expectCache = new Map<string, Expected | null>();
/**
 * What a pack type is expected to return by its published odds: `n` packs drawn with fixed seeds
 * through the same code that fills real packs (openPack / fill), so it follows the odds sheet's
 * slots and the within-tier weighting exactly. Picks, the starter and event rewards have none.
 */
export function expectedFor(pool: Pool, group: string, day: string, week: string, n = 160): Expected | null {
  const key = pool.sport + '|' + group + '|' + week + '|' + n;
  if (expectCache.has(key)) return expectCache.get(key)!;
  let out: Expected | null = null;
  if (!isPickGroup(group) && group !== 'starter' && group !== 'event-spotlight') {
    const def = defFor(pool.sport, group, day);
    const choices = positionChoices(pool.sport);
    const e = ovrEdges(pool.sport);
    try {
      let h86 = 0,
        h90 = 0,
        sp = 0,
        qs = 0,
        done = 0;
      for (let i = 0; i < n; i++) {
        const seed = 'tracker-expect:' + group + ':' + i;
        const cards =
          group === 'spotlight'
            ? def
              ? fill(pool, def.slots, packRand(seed), undefined, week)
              : []
            : openPack(pool, group === 'preview' ? 'premium' : group === 'position' ? 'position:' + choices[i % choices.length].key : group, seed, week);
        if (!cards.length) continue;
        done++;
        if (cards.some((rc) => rc.ovr >= e[3])) h86++;
        if (cards.some((rc) => rc.ovr >= e[4])) h90++;
        if (cards.some((rc) => isSpecial(rc.tier))) sp++;
        qs += cards.reduce((s, rc) => s + quickSellValue(rc), 0);
      }
      out = done ? { packs: done, r86: h86 / done, r90: h90 / done, special: def ? specialOdds(def) : sp / done, qs: qs / done } : null;
    } catch {
      out = null;
    }
  }
  expectCache.set(key, out);
  return out;
}

// ---------- every card pulled ----------

export type PulledStatus = 'club' | 'storage' | 'sold' | 'sbc' | 'gone';
export interface PulledItem {
  uid: string;
  cardId: string;
  level: number;
  /** when it was packed (ms), null when unknown (an older retirement) */
  at: number | null;
  status: PulledStatus;
  /** the logged pack it came from */
  entry?: PullEntry;
  /** the logged overall and tier at pull time (from the log only) */
  logged?: PulledCard;
  /** where it came from when no logged pack says: 'pre' (before the tracker), 'old' (aged out of
   * the recent list), 'sbc', 'market', 'other' */
  origin: 'pack' | 'pre' | 'old' | 'sbc' | 'market' | 'pick' | 'other';
}

/** The kind of acquisition a copy uid names. */
export function originOfUid(uid: string): 'pack' | 'pick' | 'sbc' | 'market' | 'other' {
  if (uid.startsWith('pack:') || uid.startsWith('registered:')) return 'pack';
  if (uid.startsWith('pick:')) return 'pick';
  if (uid.startsWith('market:')) return 'market';
  if (/^sbc[0-9a-f]{8}$/.test(uid)) return 'sbc';
  return 'other';
}

/**
 * Every card this club has pulled that the save still knows about, newest first: each copy in
 * `ut.owned`, each pending retirement (sold / used in an SBC), and each logged card no longer owned.
 * A copy packed before the tracker began is marked 'pre' (its pack type is unknown).
 */
export function allPulled(ut: Loggable & { owned: OwnedCard[]; duplicateStorage?: string[]; retirements?: CardRetirement[] }): PulledItem[] {
  const log = pullsOf(ut);
  const since = log?.since ?? Infinity;
  const byUid = new Map<string, { e: PullEntry; c: PulledCard }>();
  for (const e of log?.r ?? []) e.cs.forEach((c, i) => byUid.set(uidOf(e, i), { e, c }));
  const stored = new Set(ut.duplicateStorage ?? []);
  const out: PulledItem[] = [];
  const seen = new Set<string>();
  const originFor = (uid: string, at: number | null): PulledItem['origin'] => {
    const o = originOfUid(uid);
    if (o === 'sbc' || o === 'market') return o;
    if (at === null || at < since) return 'pre';
    return o === 'other' ? 'other' : 'old';
  };
  for (const oc of ut.owned) {
    seen.add(oc.uid);
    const hit = byUid.get(oc.uid);
    out.push({ uid: oc.uid, cardId: oc.cardId, level: oc.level, at: oc.at || hit?.e.at || null, status: stored.has(oc.uid) ? 'storage' : 'club', ...(hit ? { entry: hit.e, logged: hit.c, origin: 'pack' as const } : { origin: originFor(oc.uid, oc.at) }) });
  }
  for (const r of ut.retirements ?? []) {
    if (seen.has(r.uid)) continue;
    seen.add(r.uid);
    const hit = byUid.get(r.uid);
    out.push({ uid: r.uid, cardId: r.cardId, level: r.level, at: hit?.e.at ?? null, status: r.reason, ...(hit ? { entry: hit.e, logged: hit.c, origin: 'pack' as const } : { origin: originFor(r.uid, null) }) });
  }
  for (const [uid, { e, c }] of byUid) {
    if (seen.has(uid)) continue;
    out.push({ uid, cardId: c[0], level: 1, at: e.at, status: 'gone', entry: e, logged: c, origin: 'pack' });
  }
  return out.sort((a, b) => (b.at ?? -1) - (a.at ?? -1) || a.uid.localeCompare(b.uid));
}
