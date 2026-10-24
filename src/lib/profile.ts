import type { Booster, BotLevel, Mode } from '../engine/types';

export interface RunRecord {
  /** Unique id, so a leaderboard post can be retried safely. Older records have none. */
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
  vs?: { won: boolean | null; botWins: number; botLevel: BotLevel };
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  hints: boolean;
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
  stats: { games: number; titles: number; perfect: number; undefeated: number; vsWins: number };
  /** Anonymous id for the global leaderboard; never shown to other players */
  device: string;
  /** Leaderboard name; null until the player picks one, and nothing is posted before that */
  name: string | null;
  /** Run ids already sent to the leaderboard (newest first) */
  posted: string[];
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
    stats: { games: 0, titles: 0, perfect: 0, undefeated: 0, vsWins: 0 },
    device: newId(),
    name: null,
    posted: [],
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshProfile();
    const p = JSON.parse(raw) as Profile;
    if (p.v !== 1) return freshProfile();
    const base = freshProfile();
    return { ...base, ...p, device: p.device || base.device, posted: p.posted ?? [], settings: { ...base.settings, ...p.settings }, inventory: { ...base.inventory, ...p.inventory }, stats: { ...base.stats, ...p.stats } };
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
