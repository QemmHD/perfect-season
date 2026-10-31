import { progressChanged } from './save-events';
// Each player's favorite NBA and NFL team: stored once on the phone for both sports (the sport is
// fixed per page load, the favorites aren't), asked for at first launch and changeable in Profile.
// Their colors dress your players in a head to head.
import { useSyncExternalStore } from 'react';
import { teamOf } from '../data/teams';
import type { SportId } from '../engine/sport';

export const FAV_KEY = 'perfect-season:fav';
/** set once the player was asked (picked, or said not now): the home screen asks only once */
export const FAV_ASKED_KEY = 'perfect-season:fav:asked';

export interface Favorites {
  nba: string | null;
  nfl: string | null;
}

const NONE: Favorites = { nba: null, nfl: null };

function store(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** What's stored, checked: anything that isn't a current team reads as no pick. */
export function readFavorites(): Favorites {
  try {
    const raw = store()?.getItem(FAV_KEY);
    if (!raw) return NONE;
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || typeof v !== 'object') return NONE;
    return { nba: teamOf('nba', v.nba)?.abbr ?? null, nfl: teamOf('nfl', v.nfl)?.abbr ?? null };
  } catch {
    return NONE;
  }
}

let cache: Favorites | null = null;
const listeners = new Set<() => void>();

function current(): Favorites {
  cache ??= readFavorites();
  return cache;
}

/** Change one or both picks (an unknown team clears that one). Saved at once; every screen showing them updates. */
export function saveFavorites(next: Partial<Favorites>): Favorites {
  const prev = current();
  const f: Favorites = {
    nba: 'nba' in next ? (teamOf('nba', next.nba)?.abbr ?? null) : prev.nba,
    nfl: 'nfl' in next ? (teamOf('nfl', next.nfl)?.abbr ?? null) : prev.nfl,
  };
  cache = f;
  try {
    store()?.setItem(FAV_KEY, JSON.stringify(f));
  } catch {
    // storage blocked: kept for this visit
  }
  progressChanged();
  listeners.forEach((fn) => fn());
  return f;
}

export function favoriteFor(sport: SportId): string | null {
  return current()[sport];
}

export function markFavoritesAsked(): void {
  try {
    store()?.setItem(FAV_ASKED_KEY, '1');
    progressChanged();
  } catch {
    // storage blocked
  }
}

/** Ask on the home screen: a player without both picks who hasn't been asked yet. */
export function shouldAskFavorites(): boolean {
  const f = current();
  if (f.nba && f.nfl) return false;
  try {
    return store()?.getItem(FAV_ASKED_KEY) !== '1';
  } catch {
    return false;
  }
}

/** Forget the cached copy (tests, and a reset). */
export function reloadFavorites(): Favorites {
  cache = null;
  return current();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The picks, kept up to date. */
export function useFavorites(): Favorites {
  return useSyncExternalStore(subscribe, current, current);
}
