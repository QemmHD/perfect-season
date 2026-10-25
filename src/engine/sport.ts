// Which sport this page plays. It's chosen once, as the page loads: from ?sport= in the
// address (invite links carry it), else the last one played, else basketball. Switching
// sports saves the choice and reloads, so every module reads one fixed sport.

export type SportId = 'nba' | 'nfl';
const KEY = 'perfect-season:sport';

function fromUrl(): SportId | null {
  try {
    const v = new URLSearchParams(location.search).get('sport');
    return v === 'nba' || v === 'nfl' ? v : null;
  } catch {
    return null;
  }
}

function read(): SportId {
  // tests pick the sport with PS_SPORT=nfl
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PS_SPORT;
  if (env === 'nba' || env === 'nfl') return env;
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
    if (v === 'nba' || v === 'nfl') return v;
  } catch {
    // storage blocked
  }
  return 'nba';
}

export const SPORT: SportId = read();
export const NFL = SPORT === 'nfl';

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
