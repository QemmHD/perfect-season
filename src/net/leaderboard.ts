// Global leaderboards on Nostr. Each player keeps one replaceable entry per board (their best),
// signed with their key, on every relay. Reading a board means fetching every entry for it,
// checking each one against the player data, and ranking them here on the phone.
import { CELL_BY_ID, primeVersion } from '../engine/data';
import { dailyOrder } from '../engine/draft';
import { rateTeam } from '../engine/rating';
import { type Player, type Slot, SLOTS } from '../engine/types';
import { displayName } from '../lib/names';
import type { RunRecord } from '../lib/profile';
import { type Event, KIND_APP, myPubkey, NET_ON, NS_SUFFIX, pool, query, sign, tagValue } from './nostr';

const NS = 'perfect-season/v1' + NS_SUFFIX;

export type BoardKind = 'daily' | 'classic' | 'blind' | 'h2h';
export type Span = 'week' | 'all';

/** Keys of players the owner took off the boards. */
const BLOCKED: string[] = [];

/** ISO week of an Eastern date key: "2026-10-24" → "2026-W43". */
export function weekKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  // the week's Thursday decides which year the week belongs to
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

export function boardTag(kind: BoardKind, span: Span, day: string): string {
  if (kind === 'daily') return NS + '/daily/' + day;
  return NS + '/' + kind + '/' + (span === 'week' ? 'w/' + weekKey(day) : 'all');
}

// ---------- what goes in an entry ----------

export interface RunScore {
  wins: number;
  series: number;
  title: boolean;
  perfect: boolean;
  rating: number;
}

interface RunContent extends RunScore {
  v: 1;
  name: string;
  mode: 'classic' | 'blind' | 'daily';
  lineup: { s: Slot; id: string; pr?: string }[];
}

export interface H2HRecord {
  w: number;
  l: number;
  streak: number;
}

interface H2HContent extends H2HRecord {
  v: 1;
  name: string;
}

export type EntryContent = RunContent | H2HContent;

export function runContent(name: string, r: RunRecord): RunContent | null {
  if (!r.ids || r.ids.length !== 5 || (r.mode !== 'classic' && r.mode !== 'blind' && r.mode !== 'daily')) return null;
  return { v: 1, name, mode: r.mode, wins: r.wins, series: r.series ?? (r.title ? 4 : 0), title: r.title, perfect: r.perfect, rating: r.rating, lineup: r.ids };
}

/** Better run first: wins, then playoff rounds, then a perfect run, then team rating. */
export function compareRuns(a: RunScore, b: RunScore): number {
  return b.wins - a.wins || b.series - a.series || Number(b.perfect) - Number(a.perfect) || b.rating - a.rating;
}

// ---------- checking an entry ----------

function findPlayer(id: unknown): Player | null {
  if (typeof id !== 'string') return null;
  const cell = CELL_BY_ID[id.slice(0, id.indexOf(':'))];
  return cell?.players.find((p) => p.id === id) ?? null;
}

/** The lineup an entry claims, rebuilt from the player data, or null when it doesn't hold up. */
export function rebuildLineup(lineup: unknown, day: string | null): Player[] | null {
  if (!Array.isArray(lineup) || lineup.length !== 5) return null;
  const slots = new Set<string>();
  const pids = new Set<string>();
  const order = day ? new Set(dailyOrder(day).slice(0, 40)) : null;
  const out: Player[] = [];
  for (const x of lineup as { s?: unknown; id?: unknown; pr?: unknown }[]) {
    const base = findPlayer(x?.id);
    if (!base || typeof x.s !== 'string' || !SLOTS.includes(x.s as Slot) || slots.has(x.s) || pids.has(base.pid)) return null;
    if (order && !order.has(base.cellId)) return null;
    let p = base;
    if (x.pr !== undefined) {
      const up = primeVersion(base);
      if (!up || up.primedFrom!.cellId !== x.pr) return null;
      p = up;
    }
    if (!p.pos.includes(x.s as Slot)) return null;
    slots.add(x.s);
    pids.add(base.pid);
    out.push(p);
  }
  return out;
}

export interface BoardRow {
  rank: number;
  pubkey: string;
  name: string;
  me: boolean;
  at: number;
  run?: RunScore & { lineup: { slot: Slot; name: string; abbr: string; era: string; primed: boolean }[] };
  h2h?: H2HRecord;
}

export function readEntry(e: Event, kind: BoardKind, day: string): Omit<BoardRow, 'rank' | 'me'> | null {
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(e.content);
  } catch {
    return null;
  }
  if (!c || c.v !== 1) return null;
  const base = { pubkey: e.pubkey, name: displayName(c.name), at: e.created_at };
  if (kind === 'h2h') {
    const w = c.w;
    const l = c.l;
    const streak = c.streak;
    if (!Number.isInteger(w) || !Number.isInteger(l) || (w as number) < 0 || (l as number) < 0 || (w as number) + (l as number) > 100000) return null;
    return { ...base, h2h: { w: w as number, l: l as number, streak: Number.isInteger(streak) ? Math.max(0, streak as number) : 0 } };
  }
  const players = rebuildLineup(c.lineup, kind === 'daily' ? day : null);
  if (!players) return null;
  const rating = rateTeam(players);
  const series = c.series;
  const wins = c.wins;
  // the record must be the one the lineup actually earns
  if (wins !== rating.wins || !Number.isInteger(series) || (series as number) < 0 || (series as number) > 4) return null;
  if ((series as number) > 0 && rating.wins < 50) return null;
  const title = series === 4;
  if (c.title !== title || (c.perfect === true && !(title && rating.wins === 82))) return null;
  const slots = (c.lineup as { s: Slot }[]).map((x) => x.s);
  return {
    ...base,
    run: {
      wins: rating.wins,
      series: series as number,
      title,
      perfect: c.perfect === true,
      rating: Math.round(rating.rating * 10) / 10,
      lineup: players.map((p, i) => ({ slot: slots[i], name: p.name, abbr: p.abbr, era: p.era, primed: !!p.primedFrom })),
    },
  };
}

function rankRows(rows: Omit<BoardRow, 'rank' | 'me'>[], me: string): BoardRow[] {
  const cmp = (a: Omit<BoardRow, 'rank' | 'me'>, b: Omit<BoardRow, 'rank' | 'me'>) => {
    if (a.h2h && b.h2h) {
      const pa = a.h2h.w / Math.max(1, a.h2h.w + a.h2h.l);
      const pb = b.h2h.w / Math.max(1, b.h2h.w + b.h2h.l);
      return b.h2h.w - a.h2h.w || pb - pa || a.h2h.l - b.h2h.l;
    }
    return compareRuns(a.run!, b.run!);
  };
  const sorted = rows.slice().sort((a, b) => cmp(a, b) || a.at - b.at);
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || cmp(sorted[i - 1], r) !== 0) rank = i + 1;
    return { ...r, rank, me: r.pubkey === me };
  });
}

const cache = new Map<string, BoardRow[]>();

export function cachedBoard(kind: BoardKind, span: Span, day: string): BoardRow[] | undefined {
  return cache.get(boardTag(kind, span, day));
}

/** Fetch, check and rank a board. Rejects when no relay could be reached. */
export async function fetchBoard(kind: BoardKind, span: Span, day: string): Promise<BoardRow[]> {
  const d = boardTag(kind, span, day);
  pool.start();
  const events = await query([{ kinds: [KIND_APP], '#d': [d], limit: 500 }]);
  if (!events.length && pool.connected() === 0) throw new Error('offline');
  const newest = new Map<string, Event>();
  for (const e of events) {
    if (tagValue(e, 'd') !== d || BLOCKED.includes(e.pubkey)) continue;
    const old = newest.get(e.pubkey);
    if (!old || old.created_at < e.created_at) newest.set(e.pubkey, e);
  }
  const rows = Array.from(newest.values())
    .map((e) => readEntry(e, kind, day))
    .filter((x): x is Omit<BoardRow, 'rank' | 'me'> => !!x);
  const ranked = rankRows(rows, myPubkey());
  cache.set(d, ranked);
  return ranked;
}

/** Publish one entry; resolves true when at least one relay stored it. */
export async function publishEntry(d: string, content: EntryContent): Promise<boolean> {
  if (!NET_ON) return false;
  const e = sign(KIND_APP, [['d', d], ['t', 'perfect-season']], JSON.stringify(content));
  return (await pool.publish(e)) > 0;
}

// ---------- this player's entries ----------

export interface LbState {
  entries: Record<string, EntryContent>;
  dirty: string[];
}

function mark(lb: LbState, d: string, c: EntryContent): LbState {
  return { entries: { ...lb.entries, [d]: c }, dirty: lb.dirty.includes(d) ? lb.dirty : lb.dirty.concat([d]) };
}

/** Boards a run goes on: its mode all-time and this week, or the day's board for a ranked Daily. */
export function runBoards(r: RunRecord, day: string): string[] {
  if (r.mode === 'daily') return r.ranked && r.dailyKey ? [boardTag('daily', 'all', r.dailyKey)] : [];
  if (r.mode === 'classic' || r.mode === 'blind') return [boardTag(r.mode, 'all', day), boardTag(r.mode, 'week', day)];
  return [];
}

/** Record a finished run: it replaces an entry only when it beats it. Returns the boards it improved. */
export function withRun(lb: LbState, name: string, r: RunRecord, day: string): { lb: LbState; improved: string[] } {
  const c = runContent(name, r);
  if (!c) return { lb, improved: [] };
  const improved: string[] = [];
  let out = lb;
  for (const d of runBoards(r, day)) {
    const old = out.entries[d] as RunContent | undefined;
    // the Daily counts your first ranked run only
    if (old && (r.mode === 'daily' || compareRuns(c, old) >= 0)) continue;
    out = mark(out, d, c);
    improved.push(d);
  }
  return { lb: out, improved };
}

/** Head-to-head record, all-time and this week. */
export function withH2H(lb: LbState, name: string, all: H2HRecord, week: H2HRecord, day: string): LbState {
  let out = mark(lb, boardTag('h2h', 'all', day), { v: 1, name, ...all });
  out = mark(out, boardTag('h2h', 'week', day), { v: 1, name, ...week });
  return out;
}

/** Drop entries for past days and weeks (those boards are closed). */
export function prune(lb: LbState, day: string): LbState {
  const keep = (d: string) => d.endsWith('/all') || d.endsWith('/w/' + weekKey(day)) || d === boardTag('daily', 'all', day);
  const entries = Object.fromEntries(Object.entries(lb.entries).filter(([d]) => keep(d)));
  return { entries, dirty: lb.dirty.filter((d) => d in entries) };
}

/** A new name: every open board gets the entry again with the new name. */
export function renamed(lb: LbState, name: string, day: string): LbState {
  const live = prune(lb, day);
  let out: LbState = { entries: {}, dirty: [] };
  for (const [d, c] of Object.entries(live.entries)) out = mark(out, d, { ...c, name });
  return out;
}
