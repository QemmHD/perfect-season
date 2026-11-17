// Which sport this page plays. It's chosen once, as the page loads: from ?sport= in the
// address (invite links carry it), else the last one played, else basketball. Switching
// sports saves the choice and reloads, so every module reads one fixed sport.
//
// Claude 2026-11-01: soccer is the third sport. A branch on the sport goes through `pick` (or
// `pickFor`), which needs all three answers, so soccer can never fall silently into basketball's
// (or football's) behaviour. `sport-branches.test.ts` fails on new two-way `NFL ? a : b` branches.

export type SportId = 'nba' | 'nfl' | 'soccer';
export const SPORTS: readonly SportId[] = ['nba', 'nfl', 'soccer'];
const KEY = 'perfect-season:sport';

/** False in the single-file artifact build (no lazy chunks there), which plays NBA and NFL only. */
export const SOCCER_ON: boolean = typeof __SOCCER__ === 'boolean' ? __SOCCER__ : true;

export function isSport(v: unknown): v is SportId {
  return v === 'nba' || v === 'nfl' || (v === 'soccer' && SOCCER_ON);
}

function fromUrl(): SportId | null {
  try {
    const v = new URLSearchParams(location.search).get('sport');
    return isSport(v) ? v : null;
  } catch {
    return null;
  }
}

function read(): SportId {
  // tests pick the sport with PS_SPORT=nfl
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PS_SPORT;
  if (isSport(env)) return env;
  const url = fromUrl();
  if (url) {
    try {
      localStorage.setItem(KEY, url);
    } catch {
      // storage blocked: this page still plays it
    }
    return url;
  }
  try {
    const v = localStorage.getItem(KEY);
    if (isSport(v)) return v;
  } catch {
    // storage blocked
  }
  return 'nba';
}

export const SPORT: SportId = read();
export const NFL = SPORT === 'nfl';
export const NBA = SPORT === 'nba';
export const SOCCER = SPORT === 'soccer';

/** One answer per sport. */
export type PerSport<T> = { nba: T; nfl: T; soccer: T };

/** This page's sport's answer: `pick({ nba: 82, nfl: 17, soccer: 38 })`. */
export function pick<T>(v: PerSport<T>): T {
  return v[SPORT];
}

/** A given sport's answer (Ultimate Team code passes the sport around). */
export function pickFor<T>(sport: SportId, v: PerSport<T>): T {
  return v[sport] ?? v.nba;
}

/** The sport's short name, as the app prints it. */
export const SPORT_LABEL: PerSport<string> = { nba: 'NBA', nfl: 'NFL', soccer: 'SOCCER' };
/** The sport's long name. */
export const SPORT_NAME: PerSport<string> = { nba: 'basketball', nfl: 'football', soccer: 'soccer' };

/** Play the other sport: remember it and reload into it (into a friend's room, when `room` is set). */
export function switchSport(to: SportId, room?: string): void {
  const u = new URL(location.href);
  u.searchParams.delete('room');
  u.searchParams.delete('sport');
  if (room) u.searchParams.set('room', room);
  try {
    localStorage.setItem(KEY, to);
  } catch {
    // storage blocked: the address carries it instead
    u.searchParams.set('sport', to);
  }
  location.replace(u.toString());
}

/** The ?sport= of an invite link has done its job once it's saved: keep the address clean. */
export function clearSportParam(): void {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has('sport') || localStorage.getItem(KEY) !== SPORT) return;
    u.searchParams.delete('sport');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch {
    // storage blocked: the address keeps carrying it
  }
}
