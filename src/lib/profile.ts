import type { Booster, BotLevel, Mode, Slot } from '../engine/types';
import type { EntryContent } from '../net/leaderboard';

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
  h2h: H2HStats;
  /** Days in a row with a game played; `last` is the Eastern date of the latest */
  streak: { count: number; last: string | null; best: number };
  /** Eastern date the daily reward was last opened */
  rewardDay: string | null;
  /** Today's missions: progress and claimed, by position in the day's list */
  missions: { day: string; progress: number[]; claimed: boolean[] } | null;
  /** A head-to-head match in progress; still set on launch means the app was closed mid-match */
  activeMatch: { id: string; opp: string } | null;
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

const KEY = 'perfect-season:profile:v1';

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
    h2h: freshH2H(),
    streak: { count: 0, last: null, best: 0 },
    rewardDay: null,
    missions: null,
    activeMatch: null,
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshProfile();
    const p = JSON.parse(raw) as Profile;
    if (p.v !== 1) return freshProfile();
    const base = freshProfile();
    return {
      ...base,
      ...p,
      settings: { ...base.settings, ...p.settings },
      inventory: { ...base.inventory, ...p.inventory },
      stats: { ...base.stats, ...p.stats },
      lb: p.lb && p.lb.entries ? { entries: p.lb.entries, dirty: Array.isArray(p.lb.dirty) ? p.lb.dirty : [] } : base.lb,
      h2h: { ...base.h2h, ...p.h2h },
      streak: { ...base.streak, ...p.streak },
    };
  } catch {
    return freshProfile();
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage blocked (private window, previews): the game still works for this session
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
