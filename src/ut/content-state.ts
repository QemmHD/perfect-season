// Claude, 2026-11-01: the optional, additive `ut.content` state for UT content drop 2 (Daily Drop,
// Scout's Choice picks, pack limits, the Scout Market, Weekly Standout objective, sets, Draft). It
// lives inside the profile's `ut`, so the encrypted automatic server save (cloud-data.ts captures
// the whole profile keys) carries it with no backend change. Every reward is claimed under a stable
// id in `claims` exactly once. See docs/UT-CONTENT-2.md.
import { normalizePulls, type PullLog } from './pull-log-state';

/** An open pick sheet: persisted until one card is kept, so closing the app never loses it. */
export interface PickState {
  id: string;
  /** scout (Scout's Choice), standout (Standout pick), swap (Swap Desk), landmark */
  kind: string;
  title: string;
  /** card ids, face down until the sheet opens */
  options: string[];
  at: number;
}

export interface DraftRun {
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

export interface DraftState {
  active?: DraftRun;
  /** the Eastern ISO week the free entry token was used */
  tokenWeek?: string;
  history?: { id: string; wins: number; at: number }[];
}

export interface ContentState {
  daily?: { day: string; streak: number; total: number };
  /** purchase limits: key ("elite:2026-11-01", "scout:2026-W44") → bought */
  buys?: Record<string, number>;
  picks?: PickState[];
  claims?: string[];
  market?: { day: string; bought: number[] };
  /** this week's wins with 2+ Standouts in the squad (match ids, so a match counts once) */
  soWins?: { week: string; ids: string[] };
  draft?: DraftState;
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
  pulls?: PullLog;
}

const str = (x: unknown): x is string => typeof x === 'string';
const int = (x: unknown, lo: number, hi: number, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : d);
const strs = (x: unknown, max = 5000): string[] => (Array.isArray(x) ? [...new Set(x.filter(str))].slice(-max) : []);
const rec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function pickOf(x: unknown): PickState | null {
  if (!rec(x) || !str(x.id) || !str(x.kind) || !Array.isArray(x.options)) return null;
  const options = x.options.filter(str).slice(0, 5);
  if (!options.length) return null;
  return { id: x.id, kind: x.kind, title: str(x.title) ? x.title : "Scout's Choice", options, at: int(x.at, 0, Number.MAX_SAFE_INTEGER) };
}

function runOf(x: unknown): DraftRun | undefined {
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
export function normalizeContent(raw: unknown): ContentState | undefined {
  if (!rec(raw)) return undefined;
  const out: ContentState = {};
  if (rec(raw.daily) && str(raw.daily.day)) out.daily = { day: raw.daily.day, streak: int(raw.daily.streak, 0, 7), total: int(raw.daily.total, 0, 1e6) };
  if (rec(raw.buys)) out.buys = Object.fromEntries(Object.entries(raw.buys).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, int(v, 0, 1000)]));
  if (Array.isArray(raw.picks)) out.picks = raw.picks.map(pickOf).filter((p): p is PickState => !!p).slice(0, 50);
  if (Array.isArray(raw.claims)) out.claims = strs(raw.claims);
  if (rec(raw.market) && str(raw.market.day))
    out.market = { day: raw.market.day, bought: Array.isArray(raw.market.bought) ? [...new Set(raw.market.bought.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 64))] : [] };
  if (rec(raw.soWins) && str(raw.soWins.week)) out.soWins = { week: raw.soWins.week, ids: strs(raw.soWins.ids, 50) };
  if (rec(raw.evo)) {
    const evo: NonNullable<ContentState['evo']> = {};
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
    const pulls = normalizePulls(raw.pulls);
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

export interface WithContent {
  content?: ContentState;
}

export function contentOf(ut: WithContent): ContentState {
  return ut.content ?? {};
}

export function claimed(ut: WithContent, id: string): boolean {
  return !!ut.content?.claims?.includes(id);
}

/** The state with `id` recorded as claimed (once). */
export function withClaim<T extends WithContent>(ut: T, id: string): T {
  const c = contentOf(ut);
  if (c.claims?.includes(id)) return ut;
  return { ...ut, content: { ...c, claims: [...(c.claims ?? []), id].slice(-5000) } };
}

export function withContent<T extends WithContent>(ut: T, fn: (c: ContentState) => ContentState): T {
  return { ...ut, content: fn(contentOf(ut)) };
}

/** A locked (favourite) copy: quick-sell, SBCs, the Swap Desk and dupe bars all leave it alone. */
export function isLocked(ut: WithContent, uid: string): boolean {
  return !!ut.content?.locked?.includes(uid);
}

export function lockedSet(ut: WithContent): Set<string> {
  return new Set(ut.content?.locked ?? []);
}

export function toggleLock<T extends WithContent>(ut: T, uid: string): T {
  const c = contentOf(ut);
  const locked = c.locked ?? [];
  return { ...ut, content: { ...c, locked: locked.includes(uid) ? locked.filter((u) => u !== uid) : [...locked, uid] } };
}
