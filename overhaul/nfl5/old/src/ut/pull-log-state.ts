// Claude, 2026-11-01: the Pack Tracker's saved shape (docs/PULL-TRACKER.md). Optional and additive:
// it lives at `ut.content.pulls`, so a save without it (every save before this build) loads, round-
// trips through recovery and the cloud snapshot, and simply has nothing tracked yet. This file has no
// imports on purpose: the profile loads it on every launch (content-state.ts), before any card data.
// The logic that writes it (recordPull) and reads it (the screen) is in pull-log.ts.

/** The most recent packs kept in full (with their cards), and the most cards those may hold. */
export const PULL_LOG_PACKS = 300;
export const PULL_LOG_CARDS = 1500;
/** A pack's card list is never longer than this (football's Jumbo is 32). */
const PACK_CARDS = 64;

/** One pulled card as it was shown: its edition id, the overall on its face and its tier. */
export type PulledCard = [cardId: string, ovr: number, tier: string];

/** One opened pack (or a kept pick), kept until it ages out of the recent list. */
export interface PullEntry {
  /** stable: the pack's id/seed, the registry receipt id or the pick id (also the dedupe key) */
  id: string;
  /** the pack kind as opened ('gold', 'position:PG', 'live:…', 'scout', 'spotlight', …) */
  k: string;
  /** its name as shown when it opened */
  n: string;
  /** coins paid (0: free, a reward, a gift, a pick from a reward) */
  c: number;
  /** where it came from: store, daily, reward, starter, preview, sbc, season, objective, … */
  s: string;
  at: number;
  /** the cards' uids: card i is `u + i` when `u` ends in ':', otherwise `u` itself (one-card picks) */
  u: string;
  cs: PulledCard[];
}

/** Running totals for one pack type: never capped, never reset. */
export interface PullAgg {
  /** the pack type's name */
  nm: string;
  /** packs opened, packs paid for, coins spent */
  n: number;
  pd: number;
  c: number;
  /** quick-sell value of everything pulled, and of what the paid packs pulled */
  q: number;
  qp: number;
  /** cards pulled */
  k: number;
  /** cards by tier */
  t: Record<string, number>;
  /** cards by overall: under 75, 75–79, 80–82, 83–85, 86–89, 90+ (pull-log.ts OVR_EDGES) */
  o: number[];
  /** special editions, legends (Legend/GOAT/Landmark), walkouts */
  sp: number;
  lg: number;
  w: number;
  /** packs holding at least one 86+, at least one 90+, at least one special edition */
  h86: number;
  h90: number;
  hs: number;
  /** the best pull: [cardId, ovr, tier, at] */
  b?: [string, number, string, number];
  /** first and last opened */
  f: number;
  l: number;
}

export interface PullLog {
  /** when the first pack was tracked: copies packed before it can't be attributed to a pack */
  since: number;
  /** recent packs, oldest first (capped at PULL_LOG_PACKS packs and PULL_LOG_CARDS cards) */
  r: PullEntry[];
  /** totals by pack type (pull-log.ts packGroup) */
  a: Record<string, PullAgg>;
}

const str = (x: unknown): x is string => typeof x === 'string';
const rec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const int = (x: unknown, lo = 0, hi = Number.MAX_SAFE_INTEGER) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : lo);

function cardOf(x: unknown): PulledCard | null {
  if (!Array.isArray(x) || !str(x[0]) || !str(x[2])) return null;
  return [x[0], int(x[1], 0, 200), x[2]];
}

function entryOf(x: unknown): PullEntry | null {
  if (!rec(x) || !str(x.id) || !str(x.k) || !Array.isArray(x.cs)) return null;
  return {
    id: x.id,
    k: x.k,
    n: str(x.n) ? x.n.slice(0, 60) : 'Pack',
    c: int(x.c),
    s: str(x.s) ? x.s.slice(0, 24) : 'reward',
    at: int(x.at),
    u: str(x.u) ? x.u : 'pack:' + x.id + ':',
    cs: x.cs.map(cardOf).filter((c): c is PulledCard => !!c).slice(0, PACK_CARDS),
  };
}

function aggOf(x: unknown): PullAgg | null {
  if (!rec(x)) return null;
  const t: Record<string, number> = {};
  if (rec(x.t)) for (const [k, v] of Object.entries(x.t)) if (typeof v === 'number') t[k] = int(v);
  const o = Array.from({ length: 6 }, (_, i) => (Array.isArray(x.o) ? int(x.o[i]) : 0));
  const b = Array.isArray(x.b) && str(x.b[0]) && str(x.b[2]) ? ([x.b[0], int(x.b[1], 0, 200), x.b[2], int(x.b[3])] as PullAgg['b']) : undefined;
  return {
    nm: str(x.nm) ? x.nm.slice(0, 60) : 'Pack',
    n: int(x.n),
    pd: int(x.pd),
    c: int(x.c),
    q: int(x.q),
    qp: int(x.qp),
    k: int(x.k),
    t,
    o,
    sp: int(x.sp),
    lg: int(x.lg),
    w: int(x.w),
    h86: int(x.h86),
    h90: int(x.h90),
    hs: int(x.hs),
    ...(b ? { b } : {}),
    f: int(x.f),
    l: int(x.l),
  };
}

/** The recent list within its caps: the newest PULL_LOG_PACKS packs, then oldest dropped until the
 * cards fit in PULL_LOG_CARDS (the newest pack always stays). */
export function capRecent(r: PullEntry[]): PullEntry[] {
  let out = r.length > PULL_LOG_PACKS ? r.slice(-PULL_LOG_PACKS) : r;
  let cards = out.reduce((a, e) => a + e.cs.length, 0);
  let drop = 0;
  while (cards > PULL_LOG_CARDS && drop < out.length - 1) cards -= out[drop++].cs.length;
  if (drop) out = out.slice(drop);
  return out;
}

/** Any saved `pulls` as valid state (bad entries drop, duplicates by id drop, the caps hold). */
export function normalizePulls(raw: unknown): PullLog | undefined {
  if (!rec(raw)) return undefined;
  const seen = new Set<string>();
  const r = (Array.isArray(raw.r) ? raw.r : [])
    .map(entryOf)
    .filter((e): e is PullEntry => !!e && !seen.has(e.id) && !!seen.add(e.id));
  const a: Record<string, PullAgg> = {};
  if (rec(raw.a))
    for (const [k, v] of Object.entries(raw.a)) {
      const g = aggOf(v);
      if (g) a[k] = g;
    }
  return { since: int(raw.since), r: capRecent(r), a };
}
