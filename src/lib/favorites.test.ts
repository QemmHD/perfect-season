import { FAV_ASKED_KEY, FAV_KEY, favoriteFor, markFavoritesAsked, readFavorites, reloadFavorites, saveFavorites, shouldAskFavorites } from './favorites';

/** A phone's localStorage, in memory (optionally one that refuses everything, like a locked-down browser). */
function fakeStorage(broken = false): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  const no = () => {
    throw new Error('SecurityError');
  };
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => (broken ? no() : (data.get(k) ?? null)),
    setItem: (k: string, v: string) => (broken ? no() : void data.set(k, String(v))),
    removeItem: (k: string) => void data.delete(k),
  };
}

const g = globalThis as { localStorage?: Storage };
let saved: Storage | undefined;
beforeEach(() => {
  saved = g.localStorage;
});
afterEach(() => {
  g.localStorage = saved;
  reloadFavorites();
});

describe('favorite teams', () => {
  it('starts with none and asks', () => {
    g.localStorage = fakeStorage();
    expect(reloadFavorites()).toEqual({ nba: null, nfl: null });
    expect(shouldAskFavorites()).toBe(true);
  });

  it('stores both sports’ picks once, under one key', () => {
    const s = fakeStorage();
    g.localStorage = s;
    reloadFavorites();
    saveFavorites({ nba: 'GSW' });
    expect(favoriteFor('nba')).toBe('GSW');
    expect(favoriteFor('nfl')).toBeNull();
    expect(shouldAskFavorites()).toBe(true);
    saveFavorites({ nfl: 'KC' });
    expect(JSON.parse(s.data.get(FAV_KEY)!)).toEqual({ nba: 'GSW', nfl: 'KC' });
    // a fresh launch reads them back
    expect(reloadFavorites()).toEqual({ nba: 'GSW', nfl: 'KC' });
    expect(readFavorites()).toEqual({ nba: 'GSW', nfl: 'KC' });
    expect(shouldAskFavorites()).toBe(false);
    // changed later, in Profile
    saveFavorites({ nba: 'BOS' });
    expect(reloadFavorites()).toEqual({ nba: 'BOS', nfl: 'KC' });
  });

  it('reads anything that isn’t a current team as no pick', () => {
    const s = fakeStorage();
    g.localStorage = s;
    s.data.set(FAV_KEY, '{not json');
    expect(reloadFavorites()).toEqual({ nba: null, nfl: null });
    s.data.set(FAV_KEY, JSON.stringify({ nba: 'KC', nfl: 'SEA' }));
    expect(reloadFavorites()).toEqual({ nba: null, nfl: 'SEA' });
    s.data.set(FAV_KEY, JSON.stringify(['GSW']));
    expect(reloadFavorites()).toEqual({ nba: null, nfl: null });
    s.data.set(FAV_KEY, 'null');
    expect(reloadFavorites()).toEqual({ nba: null, nfl: null });
    expect(saveFavorites({ nba: 'XXX', nfl: 'DAL' })).toEqual({ nba: null, nfl: 'DAL' });
  });

  it('asks only once: a player who said not now isn’t asked again', () => {
    const s = fakeStorage();
    g.localStorage = s;
    reloadFavorites();
    markFavoritesAsked();
    expect(s.data.get(FAV_ASKED_KEY)).toBe('1');
    expect(shouldAskFavorites()).toBe(false);
  });

  it('keeps working when storage is blocked or missing', () => {
    g.localStorage = fakeStorage(true);
    expect(reloadFavorites()).toEqual({ nba: null, nfl: null });
    expect(() => saveFavorites({ nba: 'MIA', nfl: 'MIA' })).not.toThrow();
    // kept for this visit
    expect(favoriteFor('nba')).toBe('MIA');
    expect(favoriteFor('nfl')).toBe('MIA');
    expect(() => markFavoritesAsked()).not.toThrow();
    expect(shouldAskFavorites()).toBe(false);
    g.localStorage = undefined;
    expect(reloadFavorites()).toEqual({ nba: null, nfl: null });
  });
});
