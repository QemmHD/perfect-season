import { NFL } from '../engine/sport';
import type { Booster, BotLevel, Mode, Slot } from '../engine/types';
import type { EntryContent } from '../net/leaderboard';
import { freshUt, migrateUt, type UtState } from '../ut/state';

export interface RunRecord {
  /** Unique id. Older records have none. */
  id?: string;
  at: string;
  mode: Mode;
  dailyKey?: string;
  ranked?: boolean;
  wins: number;
  rating: number;
  grade: string;
  tier: string;
  playoff: string;
  /** Playoff series won, 0–4 */
  series?: number;
  title: boolean;
  perfect: boolean;
  lineup: { slot: string; name: string; abbr: string; era: string; primed?: boolean }[];
  /** The lineup by player id (and the Prime cell when primed): what a leaderboard entry carries */
  ids?: { s: Slot; id: string; pr?: string }[];
  vs?: { won: boolean | null; botWins: number; botLevel: BotLevel };
  /** Head to head against a real player */
  online?: { opp: string; forfeit?: 'them' | 'you' };
  /** the draft report: each pick's grade (b best, g great, o good, r reach, m miss), the draft's
      score against the best team your spins could make, and (Daily) against the day's par */
  draft?: { picks: string; score: number; letter: string; left: number; par?: number };
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  hints: boolean;
}

/** Head-to-head record against real players: all time, and this week (`week` is its key). */
export interface H2HStats {
  w: number;
  l: number;
  streak: number;
  best: number;
  week: string;
  ww: number;
  wl: number;
  wstreak: number;
}

export interface Profile {
  v: 1;
  coins: number;
  xp: number;
  inventory: Record<Booster, number>;
  settings: Settings;
  firstRun: boolean;
  mode: Mode;
  botLevel: BotLevel;
  history: RunRecord[];
  daily: { key: string; record: RunRecord } | null;
  stats: { games: number; titles: number; perfect: number; undefeated: number; vsWins: number; legends: number; h2hGames: number };
  /** Leaderboard and head-to-head name; asked for on the first launch of the web app */
  name: string | null;
  /** This player's leaderboard entries (their best per board) and the ones still to send */
  lb: { entries: Record<string, EntryContent>; dirty: string[] };
  /** the binder: every card drafted (card id -> times), this sport's */
  collection: Record<string, number>;
  /** the Legends Gauntlet: best climb this week (`week` is its key) and of all time, and clears */
  gauntlet: { week: string; best: number; allBest: number; clears: number };
  h2h: H2HStats;
  /** Days in a row with a game played; `last` is the Eastern date of the latest */
  streak: { count: number; last: string | null; best: number };
  /** Eastern date the daily reward was last opened */
  rewardDay: string | null;
  /** Today's missions: progress and claimed, by position in the day's list */
  missions: { day: string; progress: number[]; claimed: boolean[] } | null;
  /** A head-to-head match in progress; still set on launch means the app was closed mid-match */
  activeMatch: { id: string; opp: string; key?: string } | null;
  /** your record against each real opponent you've played (this sport), by their key */
  vs?: Record<string, VsRecord>;
  /** Ultimate Team: this sport's club, squad, packs and challenges (src/ut/state.ts) */
  ut: UtState;
}

/** A random v4 UUID. */
export function newId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  try {
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // not a secure context
  }
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

/** Basketball's profile, which also holds everything the two sports share. */
const KEY = 'perfect-season:profile:v1';
/** Football's own part: its drafts, records, boards, missions and matches. */
const NFL_KEY = 'perfect-season:profile:nfl:v1';
/** One player across both sports: the same name, wallet, level, boosters, settings and daily chest. */
const SHARED = ['coins', 'xp', 'inventory', 'settings', 'name', 'streak', 'rewardDay', 'botLevel'] as const;

export interface VsRecord {
  name: string;
  w: number;
  l: number;
}

/** A result against one opponent added to the records against each (the most recent 300 kept). */
export function addVs(vs: Record<string, VsRecord> | undefined, key: string, name: string, won: boolean): Record<string, VsRecord> {
  const was = vs?.[key] ?? { name, w: 0, l: 0 };
  const rest = Object.entries(vs ?? {}).filter(([k]) => k !== key);
  const next = { name, w: was.w + (won ? 1 : 0), l: was.l + (won ? 0 : 1) };
  return Object.fromEntries([...rest.slice(-299), [key, next]]);
}

export function freshH2H(): H2HStats {
  return { w: 0, l: 0, streak: 0, best: 0, week: '', ww: 0, wl: 0, wstreak: 0 };
}

export function freshProfile(): Profile {
  return {
    v: 1,
    coins: 50,
    xp: 0,
    inventory: { double: 0, trade: 0, prime: 0 },
    settings: { sound: true, haptics: true, hints: true },
    firstRun: true,
    mode: 'classic',
    botLevel: 'pro',
    history: [],
    daily: null,
    stats: { games: 0, titles: 0, perfect: 0, undefeated: 0, vsWins: 0, legends: 0, h2hGames: 0 },
    name: null,
    lb: { entries: {}, dirty: [] },
    collection: {},
    gauntlet: { week: '', best: 0, allBest: 0, clears: 0 },
    h2h: freshH2H(),
    streak: { count: 0, last: null, best: 0 },
    rewardDay: null,
    missions: null,
    activeMatch: null,
    ut: freshUt(),
  };
}

function read(key: string): Profile | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    return p && p.v === 1 ? p : null;
  } catch {
    return null;
  }
}

function pick(p: Profile, keys: readonly string[], keep: boolean): Partial<Profile> {
  return Object.fromEntries(Object.entries(p).filter(([k]) => keys.includes(k) === keep)) as Partial<Profile>;
}

export function loadProfile(): Profile {
  if (!NFL) return loadFrom(read(KEY));
  // football: its own part, with the shared part from the basketball profile
  const own = read(NFL_KEY);
  const shared = read(KEY);
  const merged = { ...(own ?? freshProfile()), ...(shared ? pick(shared, SHARED, true) : {}), v: 1 } as Profile;
  return loadFrom(own || shared ? merged : null);
}

function loadFrom(p: Profile | null): Profile {
  try {
    if (!p) return freshProfile();
    const base = freshProfile();
    return {
      ...base,
      ...p,
      settings: { ...base.settings, ...p.settings },
      inventory: { ...base.inventory, ...p.inventory },
      stats: { ...base.stats, ...p.stats },
      lb: p.lb && p.lb.entries ? { entries: p.lb.entries, dirty: Array.isArray(p.lb.dirty) ? p.lb.dirty : [] } : base.lb,
      h2h: { ...base.h2h, ...p.h2h },
      collection: p.collection && typeof p.collection === 'object' ? p.collection : {},
      gauntlet: { ...base.gauntlet, ...p.gauntlet },
      streak: { ...base.streak, ...p.streak },
      ut: migrateUt(p.ut),
    };
  } catch {
    return freshProfile();
  }
}

export function saveProfile(p: Profile): void {
  try {
    if (!NFL) {
      localStorage.setItem(KEY, JSON.stringify(p));
      return;
    }
    // the shared part goes back into the basketball profile, without touching basketball's own
    const base = read(KEY) ?? freshProfile();
    localStorage.setItem(KEY, JSON.stringify({ ...base, ...pick(p, SHARED, true) }));
    localStorage.setItem(NFL_KEY, JSON.stringify({ ...pick(p, SHARED, false), v: 1 }));
  } catch {
    // storage blocked (private window, previews): the game still works for this session
  }
}

/**
 * Reset the other sport's progress too (Settings → Reset progress erases both). Its name,
 * leaderboard entries and head-to-head record stay, like this sport's: those are public.
 */
export function resetOtherSport(): void {
  try {
    const key = NFL ? KEY : NFL_KEY;
    const other = read(key);
    if (!other) return;
    const kept: Partial<Profile> = { lb: other.lb, h2h: other.h2h };
    const fresh = freshProfile();
    // basketball's profile also carries the shared part, which this sport has just reset itself
    const next = NFL ? { ...fresh, ...pick(other, SHARED, true), ...kept } : { ...pick(fresh, SHARED, false), ...kept, v: 1 };
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // storage blocked
  }
}

/**
 * The other sport's leaderboard entries. Its queued results and name changes go out from either
 * sport, so they don't wait (and expire) until that sport is opened again.
 */
export function readOtherLb(): Profile['lb'] | null {
  const other = read(NFL ? KEY : NFL_KEY);
  return other ? loadFrom(other).lb : null;
}

export function updateOtherLb(fn: (lb: Profile['lb']) => Profile['lb']): void {
  try {
    const key = NFL ? KEY : NFL_KEY;
    const other = read(key);
    if (other) localStorage.setItem(key, JSON.stringify({ ...other, lb: fn(loadFrom(other).lb) }));
  } catch {
    // storage blocked
  }
}

/** Best results first: wins, then rating. */
export function bestRuns(history: RunRecord[], mode: Mode | 'all', n = 10): RunRecord[] {
  return history
    .filter((r) => (mode === 'all' ? true : r.mode === mode) && !(r.mode === 'daily' && !r.ranked))
    .slice()
    .sort((a, b) => b.wins - a.wins || Number(b.title) - Number(a.title) || b.rating - a.rating)
    .slice(0, n);
}
