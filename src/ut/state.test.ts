// Ultimate Team's saved state: old profiles load, bad data is cleaned up, and cards level up.
import { NFL } from '../engine/sport';
import { freshProfile, loadProfile, saveProfile } from '../lib/profile';
import { awardXp, freshUt, MAX_LEVEL, migrateUt, xpToNext } from './state';

/** A localStorage for node, so the real profile code runs. */
function fakeStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  const ls = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = ls;
  return m;
}

const KEY = 'perfect-season:profile:v1';
const NFL_KEY = 'perfect-season:profile:nfl:v1';

describe('profile migration', () => {
  afterEach(() => delete (globalThis as { localStorage?: unknown }).localStorage);

  it('gives a profile saved before Ultimate Team an empty one', () => {
    // a profile from the last release: no `ut` at all
    const old = { ...freshProfile(), coins: 1234, name: 'Old' } as Record<string, unknown>;
    delete old.ut;
    fakeStorage({ [KEY]: JSON.stringify(old), [NFL_KEY]: JSON.stringify({ v: 1, firstRun: false }) });
    const p = loadProfile();
    expect(p.coins).toBe(1234);
    expect(p.ut).toEqual(freshUt());
  });

  it('keeps each sport’s club apart, and the coins shared', () => {
    const m = fakeStorage();
    const p = loadProfile();
    const ut = { ...freshUt(), owned: [{ uid: 'a-0', cardId: 'x', level: 2, xp: 10, at: 1 }], starterClaimed: true };
    saveProfile({ ...p, coins: 999, ut });
    const back = loadProfile();
    expect(back.ut.owned.map((c) => c.uid)).toEqual(['a-0']);
    expect(back.coins).toBe(999);
    // this sport's club lives in this sport's part of the profile only
    const mine = JSON.parse(m.get(NFL ? NFL_KEY : KEY)!);
    expect(mine.ut.owned).toHaveLength(1);
    if (NFL) expect(JSON.parse(m.get(KEY)!).ut?.owned ?? []).toHaveLength(0);
  });
});

describe('migrateUt', () => {
  it('turns anything into a valid state', () => {
    for (const raw of [undefined, null, 3, 'x', [], {}]) expect(migrateUt(raw)).toEqual(freshUt());
  });

  it('keeps good data and drops what is broken', () => {
    const ut = migrateUt({
      owned: [
        { uid: 'a', cardId: 'c1', level: 3, xp: 40, at: 5 },
        { uid: 'a', cardId: 'dupe uid', level: 1, xp: 0, at: 6 },
        { uid: 'b', cardId: 'c2', level: 9, xp: -5 },
        { cardId: 'no uid' },
        null,
      ],
      squad: { PG: 'a', SG: 'gone', SF: 'b', PF: 'a', C: 7 },
      packsOpened: 4.4,
      starterClaimed: true,
      sbc: { done: { 'd:2026-10-27:0': 123, bad: 'x' } },
      packs: [{ id: 'p', kind: 'gold', at: 1 }, { kind: 'no id' }],
      sold: { cards: 2, coins: 300 },
      extra: 'dropped',
    });
    expect(ut.owned).toEqual([
      { uid: 'a', cardId: 'c1', level: 3, xp: 40, at: 5 },
      { uid: 'b', cardId: 'c2', level: MAX_LEVEL, xp: 0, at: 0 },
    ]);
    // the squad only points at owned cards, each card once
    expect(ut.squad).toEqual({ PG: 'a', SF: 'b' });
    expect(ut.packsOpened).toBe(4);
    expect(ut.starterClaimed).toBe(true);
    expect(ut.sbc.done).toEqual({ 'd:2026-10-27:0': 123 });
    expect(ut.packs).toEqual([{ id: 'p', kind: 'gold', at: 1 }]);
    expect(ut.sold).toEqual({ cards: 2, coins: 300 });
    expect('extra' in ut).toBe(false);
  });
});

describe('upgrades', () => {
  it('levels a card 1 to 5 on 700 XP, carrying the rest over', () => {
    expect([1, 2, 3, 4].map(xpToNext)).toEqual([100, 150, 200, 250]);
    expect(xpToNext(5)).toBe(0);
    let ut = { ...freshUt(), owned: [{ uid: 'a', cardId: 'c', level: 1, xp: 0, at: 0 }, { uid: 'b', cardId: 'c', level: 1, xp: 0, at: 0 }] };
    let r = awardXp(ut, ['a'], 120);
    expect(r.ut.owned[0]).toMatchObject({ level: 2, xp: 20 });
    expect(r.ut.owned[1]).toMatchObject({ level: 1, xp: 0 });
    expect(r.ups).toEqual([{ uid: 'a', level: 2 }]);
    ut = r.ut;
    r = awardXp(ut, ['a', 'b'], 600);
    expect(r.ut.owned[0]).toMatchObject({ level: 5, xp: 0 });
    expect(r.ut.owned[1]).toMatchObject({ level: 4, xp: 150 });
    // a max-level card takes no more
    expect(awardXp(r.ut, ['a'], 500).ups).toEqual([]);
    expect(awardXp(r.ut, ['a'], 500).ut.owned[0]).toMatchObject({ level: 5, xp: 0 });
  });
});
