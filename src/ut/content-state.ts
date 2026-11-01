// Claude, 2026-11-01: the optional, additive `ut.content` state for UT content drop 2 (Daily Drop,
// Scout's Choice picks, pack limits, the Scout Market, Weekly Standout objective, sets, Draft). It
// lives inside the profile's `ut`, so the encrypted automatic server save (cloud-data.ts captures
// the whole profile keys) carries it with no backend change. Every reward is claimed under a stable
// id in `claims` exactly once. See docs/UT-CONTENT-2.md.

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
