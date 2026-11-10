// Claude (packs-1, 2026-11-10): a FROZEN copy of the profile's `ut.content` normalizer as it was on
// the studio-overhaul base (claude/studio-overhaul = acdf3e2: src/ut/content-state.ts normalizeContent
// and src/ut/pull-log-state.ts normalizePulls). It stands for "an older cached build": that build
// loads a cloud snapshot, drops every `ut.content` field it doesn't know, and saves it back. Every packs
// task that adds saved state round-trips its new state through this copy (docs/studio-overhaul/
// packs-plan.md §1 Saves) to prove what survives. NEVER edit it to follow the live normalizer: it is
// the old build. Test code only; no app module imports it.

/** The most recent packs kept in full (with their cards), and the most cards those may hold. */
const PULL_LOG_PACKS = 300;
const PULL_LOG_CARDS = 1500;
/** A pack's card list is never longer than this (football's Jumbo is 32). */
const PACK_CARDS = 64;

/** One pulled card as it was shown: its edition id, the overall on its face and its tier. */
export type LegacyPulledCard = [cardId: string, ovr: number, tier: string];

/** One opened pack (or a kept pick), kept until it ages out of the recent list. */
export interface LegacyPullEntry {
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
  cs: LegacyPulledCard[];
}

/** Running totals for one pack type: never capped, never reset. */
export interface LegacyPullAgg {
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

export interface LegacyPullLog {
  /** when the first pack was tracked: copies packed before it can't be attributed to a pack */
  since: number;
  /** recent packs, oldest first (capped at PULL_LOG_PACKS packs and PULL_LOG_CARDS cards) */
  r: LegacyPullEntry[];
  /** totals by pack type (pull-log.ts packGroup) */
  a: Record<string, LegacyPullAgg>;
}

const pstr = (x: unknown): x is string => typeof x === 'string';
const prec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const pint = (x: unknown, lo = 0, hi = Number.MAX_SAFE_INTEGER) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : lo);

function cardOf(x: unknown): LegacyPulledCard | null {
  if (!Array.isArray(x) || !pstr(x[0]) || !pstr(x[2])) return null;
  return [x[0], pint(x[1], 0, 200), x[2]];
}

function entryOf(x: unknown): LegacyPullEntry | null {
  if (!prec(x) || !pstr(x.id) || !pstr(x.k) || !Array.isArray(x.cs)) return null;
  return {
    id: x.id,
    k: x.k,
    n: pstr(x.n) ? x.n.slice(0, 60) : 'Pack',
    c: pint(x.c),
    s: pstr(x.s) ? x.s.slice(0, 24) : 'reward',
    at: pint(x.at),
    u: pstr(x.u) ? x.u : 'pack:' + x.id + ':',
    cs: x.cs.map(cardOf).filter((c): c is LegacyPulledCard => !!c).slice(0, PACK_CARDS),
  };
}

function aggOf(x: unknown): LegacyPullAgg | null {
  if (!prec(x)) return null;
  const t: Record<string, number> = {};
  if (prec(x.t)) for (const [k, v] of Object.entries(x.t)) if (typeof v === 'number') t[k] = pint(v);
  const o = Array.from({ length: 6 }, (_, i) => (Array.isArray(x.o) ? pint(x.o[i]) : 0));
  const b = Array.isArray(x.b) && pstr(x.b[0]) && pstr(x.b[2]) ? ([x.b[0], pint(x.b[1], 0, 200), x.b[2], pint(x.b[3])] as LegacyPullAgg['b']) : undefined;
  return {
    nm: pstr(x.nm) ? x.nm.slice(0, 60) : 'Pack',
    n: pint(x.n),
    pd: pint(x.pd),
    c: pint(x.c),
    q: pint(x.q),
    qp: pint(x.qp),
    k: pint(x.k),
    t,
    o,
    sp: pint(x.sp),
    lg: pint(x.lg),
    w: pint(x.w),
    h86: pint(x.h86),
    h90: pint(x.h90),
    hs: pint(x.hs),
    ...(b ? { b } : {}),
    f: pint(x.f),
    l: pint(x.l),
  };
}

/** The recent list within its caps: the newest PULL_LOG_PACKS packs, then oldest dropped until the
 * cards fit in PULL_LOG_CARDS (the newest pack always stays). */
function capRecent(r: LegacyPullEntry[]): LegacyPullEntry[] {
  let out = r.length > PULL_LOG_PACKS ? r.slice(-PULL_LOG_PACKS) : r;
  let cards = out.reduce((a, e) => a + e.cs.length, 0);
  let drop = 0;
  while (cards > PULL_LOG_CARDS && drop < out.length - 1) cards -= out[drop++].cs.length;
  if (drop) out = out.slice(drop);
  return out;
}

/** Any saved `pulls` as valid state (bad entries drop, duplicates by id drop, the caps hold). */
export function legacyNormalizePulls(raw: unknown): LegacyPullLog | undefined {
  if (!prec(raw)) return undefined;
  const seen = new Set<string>();
  const r = (Array.isArray(raw.r) ? raw.r : [])
    .map(entryOf)
    .filter((e): e is LegacyPullEntry => !!e && !seen.has(e.id) && !!seen.add(e.id));
  const a: Record<string, LegacyPullAgg> = {};
  if (prec(raw.a))
    for (const [k, v] of Object.entries(raw.a)) {
      const g = aggOf(v);
      if (g) a[k] = g;
    }
  return { since: pint(raw.since), r: capRecent(r), a };
}

/** An open pick sheet: persisted until one card is kept, so closing the app never loses it. */
export interface LegacyPickState {
  id: string;
  /** scout (Scout's Choice), standout (Standout pick), swap (Swap Desk), landmark */
  kind: string;
  title: string;
  /** card ids, face down until the sheet opens */
  options: string[];
  at: number;
}

export interface LegacyDraftRun {
  id: string;
  at: number;
  week: string;
  paid: 'coins' | 'token';
  /** the five captains offered */
  captains: string[];
  /** slot → card id (drafted, never owned) */
  squad: Record<string, string>;
  /** the slot being drafted and its five options */
  pick?: { slot: string; options: string[] };
  games: number;
  wins: number;
  results: boolean[];
  /** a loss, or four wins: the rewards can be claimed */
  done: boolean;
}

export interface LegacyDraftState {
  active?: LegacyDraftRun;
  /** the Eastern ISO week the free entry token was used */
  tokenWeek?: string;
  history?: { id: string; wins: number; at: number }[];
}

export interface LegacyContentState {
  daily?: { day: string; streak: number; total: number };
  /** purchase limits: key ("elite:2026-11-01", "scout:2026-W44") → bought */
  buys?: Record<string, number>;
  picks?: LegacyPickState[];
  claims?: string[];
  market?: { day: string; bought: number[] };
  /** this week's wins with 2+ Standouts in the squad (match ids, so a match counts once) */
  soWins?: { week: string; ids: string[] };
  draft?: LegacyDraftState;
  /** New Era bundle eligibility, stamped once when this build first loads the save (new-era.ts) */
  era?: { eligible: boolean };
  /** Favourite / LOCK: owned copy uids that are never quick-sold, traded in SBCs or swapped */
  locked?: string[];
  /** wave 2: Evolutions per owned copy uid (evolutions.ts), and the match ids already counted */
  evo?: Record<string, { done: string[]; active?: { id: string; games: number; wins: number; at: number } }>;
  evoSeen?: string[];
  /** wave 2: Streamlined SBC points carried between submissions (streamlined.ts) */
  streams?: Record<string, number>;
  /** wave 2: the login calendar (daily-hub.ts): days claimed so far in the cycle and the last day */
  calendar?: { day: string; n: number };
  /** wave 2: the Preview Pack (preview-pack.ts): a per-player seed, the preview number, a cooldown */
  preview?: { seed: string; n: number; until?: number };
  /** Claude: the Pack Tracker (pull-log-state.ts, docs/PULL-TRACKER.md): recent packs and per-type totals */
  pulls?: LegacyPullLog;
}

const str = (x: unknown): x is string => typeof x === 'string';
const int = (x: unknown, lo: number, hi: number, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : d);
const strs = (x: unknown, max = 5000): string[] => (Array.isArray(x) ? [...new Set(x.filter(str))].slice(-max) : []);
const rec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function pickOf(x: unknown): LegacyPickState | null {
  if (!rec(x) || !str(x.id) || !str(x.kind) || !Array.isArray(x.options)) return null;
  const options = x.options.filter(str).slice(0, 5);
  if (!options.length) return null;
  return { id: x.id, kind: x.kind, title: str(x.title) ? x.title : "Scout's Choice", options, at: int(x.at, 0, Number.MAX_SAFE_INTEGER) };
}

function runOf(x: unknown): LegacyDraftRun | undefined {
  if (!rec(x) || !str(x.id) || !str(x.week)) return undefined;
  const squad: Record<string, string> = {};
  if (rec(x.squad)) for (const [k, v] of Object.entries(x.squad)) if (str(v)) squad[k] = v;
  const p = rec(x.pick) && str(x.pick.slot) && Array.isArray(x.pick.options) ? { slot: x.pick.slot, options: x.pick.options.filter(str).slice(0, 5) } : undefined;
  const results = Array.isArray(x.results) ? x.results.filter((r): r is boolean => typeof r === 'boolean').slice(0, 4) : [];
  return {
    id: x.id,
    at: int(x.at, 0, Number.MAX_SAFE_INTEGER),
    week: x.week,
    paid: x.paid === 'token' ? 'token' : 'coins',
    captains: Array.isArray(x.captains) ? x.captains.filter(str).slice(0, 5) : [],
    squad,
    ...(p && p.options.length ? { pick: p } : {}),
    games: results.length,
    wins: results.filter(Boolean).length,
    results,
    done: x.done === true,
  };
}

/** Any saved `content` as valid state (unknown fields go, bad entries drop, nothing resets). */
export function legacyNormalizeContent(raw: unknown): LegacyContentState | undefined {
  if (!rec(raw)) return undefined;
  const out: LegacyContentState = {};
  if (rec(raw.daily) && str(raw.daily.day)) out.daily = { day: raw.daily.day, streak: int(raw.daily.streak, 0, 7), total: int(raw.daily.total, 0, 1e6) };
  if (rec(raw.buys)) out.buys = Object.fromEntries(Object.entries(raw.buys).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, int(v, 0, 1000)]));
  if (Array.isArray(raw.picks)) out.picks = raw.picks.map(pickOf).filter((p): p is LegacyPickState => !!p).slice(0, 50);
  if (Array.isArray(raw.claims)) out.claims = strs(raw.claims);
  if (rec(raw.market) && str(raw.market.day))
    out.market = { day: raw.market.day, bought: Array.isArray(raw.market.bought) ? [...new Set(raw.market.bought.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 64))] : [] };
  if (rec(raw.soWins) && str(raw.soWins.week)) out.soWins = { week: raw.soWins.week, ids: strs(raw.soWins.ids, 50) };
  if (rec(raw.evo)) {
    const evo: NonNullable<LegacyContentState['evo']> = {};
    for (const [uid, e] of Object.entries(raw.evo)) {
      if (!rec(e)) continue;
      const done = strs(e.done, 20);
      const a = rec(e.active) && str(e.active.id) ? { id: e.active.id, games: int(e.active.games, 0, 99), wins: int(e.active.wins, 0, 99), at: int(e.active.at, 0, Number.MAX_SAFE_INTEGER) } : undefined;
      evo[uid] = { done, ...(a ? { active: a } : {}) };
    }
    out.evo = evo;
  }
  if (Array.isArray(raw.evoSeen)) out.evoSeen = strs(raw.evoSeen, 60);
  if (rec(raw.streams)) out.streams = Object.fromEntries(Object.entries(raw.streams).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, int(v, 0, 1e9)]));
  if (rec(raw.calendar) && str(raw.calendar.day)) out.calendar = { day: raw.calendar.day, n: int(raw.calendar.n, 0, 1e6) };
  if (rec(raw.preview) && str(raw.preview.seed))
    out.preview = { seed: raw.preview.seed, n: int(raw.preview.n, 0, 1e9), ...(typeof raw.preview.until === 'number' ? { until: int(raw.preview.until, 0, Number.MAX_SAFE_INTEGER) } : {}) };
  if (rec(raw.pulls)) {
    const pulls = legacyNormalizePulls(raw.pulls);
    if (pulls) out.pulls = pulls;
  }
  if (Array.isArray(raw.locked)) out.locked = strs(raw.locked, 2000);
  if (rec(raw.era)) out.era = { eligible: raw.era.eligible === true };
  if (rec(raw.draft)) {
    const d = raw.draft;
    const active = runOf(d.active);
    out.draft = {
      ...(active ? { active } : {}),
      ...(str(d.tokenWeek) ? { tokenWeek: d.tokenWeek } : {}),
      ...(Array.isArray(d.history)
        ? { history: d.history.filter((h): h is { id: string; wins: number; at: number } => rec(h) && str(h.id)).map((h) => ({ id: h.id, wins: int(h.wins, 0, 4), at: int(h.at, 0, Number.MAX_SAFE_INTEGER) })).slice(-10) }
        : {}),
    };
  }
  return out;
}
