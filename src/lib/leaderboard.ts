// Global leaderboard client. Talks to the three functions in supabase/leaderboard.sql through
// Supabase's REST API. The project URL and anon key come from the build (VITE_SUPABASE_URL,
// VITE_SUPABASE_ANON_KEY); without them the game only shows each player's own bests.
import type { Mode } from '../engine/types';
import type { RunRecord } from './profile';
import { APP_VERSION } from './update';

const BASE = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const GLOBAL_ON = !!BASE && !!KEY && import.meta.env.MODE !== 'artifact';

export type Board = 'daily' | 'week' | 'all';

export interface BoardRow {
  rank: number;
  name: string;
  wins: number;
  series: number;
  title: boolean;
  perfect: boolean;
  rating: number;
  lineup: RunRecord['lineup'];
  at: string;
  me: boolean;
}

/** Server answer to a post or rename. ok: false is final (bad name, closed Daily…), except error 'busy'. */
export interface PostResult {
  ok: boolean;
  rank?: number | null;
  board?: Board;
  error?: 'name' | 'closed' | 'invalid' | 'busy';
  message?: string;
}

/** Thrown when the leaderboard can't be reached; the caller tries again later. */
export class Unreachable extends Error {}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: KEY };
  // legacy anon keys are JWTs and go in Authorization too; new sb_publishable_ keys must not
  if (KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + KEY;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = window.setTimeout(() => ctrl?.abort(), 9000);
  let res: Response;
  try {
    res = await fetch(BASE + '/rest/v1/rpc/' + fn, { method: 'POST', headers, body: JSON.stringify(args), signal: ctrl?.signal });
  } catch {
    throw new Unreachable('network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Unreachable('HTTP ' + res.status);
  return (await res.json()) as T;
}

/** Same rules as ps_private.name_problem in the SQL. */
export function nameProblem(name: string): string | null {
  const n = name.trim();
  if (n.length < 2) return 'Use at least 2 characters.';
  if (n.length > 16) return 'Use 16 characters or fewer.';
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._'-]*$/.test(n)) return 'Use letters, numbers, spaces and . _ ’ - only.';
  const letters = n
    .toLowerCase()
    .replace(/[013457$]/g, (d) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', $: 's' })[d] as string)
    .replace(/[^a-z]/g, '');
  if (/(fuck|shit|cunt|nigg|faggot|bitch|whore|slut|nazi|hitler|porn)/.test(letters)) return 'Pick a different name.';
  return null;
}

/** Runs that go on the global boards: Classic, Blind and your first (ranked) Daily, from the last week. */
export function postable(r: RunRecord, now = Date.now()): boolean {
  if (!r.id) return false;
  if (r.mode !== 'classic' && r.mode !== 'blind' && !(r.mode === 'daily' && r.ranked)) return false;
  return now - Date.parse(r.at) < 7 * 86400000;
}

export function postRun(device: string, name: string, r: RunRecord): Promise<PostResult> {
  return rpc<PostResult>('submit_score', {
    p_run: r.id,
    p_device: device,
    p_name: name.trim(),
    p_mode: r.mode,
    p_daily: r.mode === 'daily' ? (r.dailyKey ?? null) : null,
    p_wins: r.wins,
    p_series: r.series ?? (r.title ? 4 : 0),
    p_title: r.title,
    p_perfect: r.perfect,
    p_rating: r.rating,
    p_lineup: r.lineup,
    p_version: APP_VERSION.slice(0, 40),
  });
}

export function saveName(device: string, name: string): Promise<PostResult> {
  return rpc<PostResult>('set_name', { p_device: device, p_name: name.trim() });
}

const cache = new Map<string, BoardRow[]>();
const cacheKey = (board: Board, mode: Mode, day: string) => board + ':' + (board === 'daily' ? day : mode);

/** The last copy of a board fetched this session, to show while a fresh one loads. */
export function cachedBoard(board: Board, mode: Mode, day: string): BoardRow[] | undefined {
  return cache.get(cacheKey(board, mode, day));
}

export async function fetchBoard(board: Board, mode: Mode, day: string, device: string): Promise<BoardRow[]> {
  const rows = await rpc<BoardRow[]>('leaderboard', { p_board: board, p_mode: board === 'daily' ? 'daily' : mode, p_day: day, p_device: device, p_limit: 50 });
  cache.set(cacheKey(board, mode, day), rows);
  return rows;
}

/** "#3 on today's Daily", "#12 in Classic this week" */
export function rankLine(res: PostResult, mode: Mode): string {
  if (!res.rank) return 'Posted to the leaderboard';
  return '#' + res.rank + (res.board === 'daily' ? ' on today’s Daily leaderboard' : ' in ' + (mode === 'blind' ? 'Blind' : 'Classic') + ' this week');
}
