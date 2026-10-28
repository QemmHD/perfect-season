import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBackup,
  openBackup,
  restoreBackup,
  readCheckpoint,
  writeCheckpoint,
} from './recovery';
import { freshProfile, loadProfile, saveProfile } from './profile';
import { SPORT, NFL } from '../engine/sport';
import { newDraft } from '../engine/draft';
const NBA = 'perfect-season:profile:v1',
  NFL_KEY = 'perfect-season:profile:nfl:v1';
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
});
describe('original-player compatibility', () => {
  it('preserves wallet, inventory, cards, packs, history and signed identity on a save round-trip', () => {
    const p = freshProfile();
    p.name = 'ExistingPlayer';
    p.coins = 14230;
    p.xp = 800;
    p.inventory.prime = 4;
    p.gifts = ['testers-2026-10', 'gift-1'];
    p.ut.owned = [
      {
        uid: 'owned-1',
        cardId: 'nba:season:1996:jordan:CHI',
        level: 3,
        xp: 45,
        at: 1,
      },
    ];
    p.ut.owned.push({ ...p.ut.owned[0], uid: 'spare-1', level: 2, xp: 12 });
    p.ut.duplicateStorage = ['spare-1'];
    p.ut.squad = { SG: 'owned-1' };
    p.ut.packs = [{ id: 'earned', kind: 'gold', at: 7 }];
    p.ut.starterClaimed = true;
    p.ut.record = { w: 12, l: 4, h2hW: 3, h2hL: 2 };
    p.ut.sbc.done = { 'challenge-1': 12 };
    values.set(NBA, JSON.stringify(p));
    if (NFL) values.set(NFL_KEY, JSON.stringify(p));
    values.set('perfect-season:key:v1', '11'.repeat(32));
    const loaded = loadProfile();
    expect(loaded).toEqual(p);
    expect(saveProfile(loaded)).toBe(true);
    expect(loadProfile()).toEqual(p);
    expect(values.get('perfect-season:key:v1')).toBe('11'.repeat(32));
  });
  it('stores and reloads a solo checkpoint without changing a player profile', () => {
    values.set(NBA, 'untouched');
    const run = {
      id: 1,
      saveId: 'run-1',
      mode: 'classic',
      draft: newDraft('classic', 'pro', null),
    };
    expect(writeCheckpoint(run, 'draft')).toBe(true);
    expect(readCheckpoint<typeof run>()?.run).toEqual(run);
    expect(values.get(NBA)).toBe('untouched');
  });
  it('ignores an incompatible checkpoint', () => {
    values.set(
      'perfect-season:checkpoint:' + SPORT,
      JSON.stringify({
        v: 1,
        data: 'old',
        sport: SPORT,
        screen: 'draft',
        run: {},
      })
    );
    expect(readCheckpoint()).toBeNull();
  });
});
describe('encrypted save locker', () => {
  it('round-trips both sports, shared wallet, cards, gift claims and identity, excluding admin credentials', async () => {
    const p = freshProfile();
    p.name = 'ReturningPlayer';
    p.coins = 9000;
    p.gifts = ['claimed'];
    p.ut.owned = [
      { uid: 'main', cardId: 'same', level: 4, xp: 35, at: 1 },
      { uid: 'spare', cardId: 'same', level: 2, xp: 17, at: 2 },
    ];
    p.ut.duplicateStorage = ['spare'];
    values.set(NBA, JSON.stringify(p));
    values.set(NFL_KEY, JSON.stringify(p));
    values.set('perfect-season:key:v1', '11'.repeat(32));
    values.set('ps-admin', 'do-not-copy');
    const file = await createBackup('my backup password');
    expect(file).not.toContain('ReturningPlayer');
    expect(file).not.toContain('do-not-copy');
    const preview = await openBackup(file, 'my backup password');
    expect(preview.name).toBe('ReturningPlayer');
    expect(preview.cards).toBe(4);
    values.set(NBA, JSON.stringify({ ...p, coins: 1 }));
    restoreBackup(preview);
    expect(JSON.parse(values.get(NBA)!).coins).toBe(9000);
    expect(JSON.parse(values.get(NBA)!).ut.owned).toEqual(p.ut.owned);
    expect(JSON.parse(values.get(NFL_KEY)!).ut.duplicateStorage).toEqual(['spare']);
    expect(values.get('perfect-season:key:v1')).toBe('11'.repeat(32));
  }, 10000);
  it('rejects a wrong password and leaves the current save untouched', async () => {
    values.set(NBA, JSON.stringify(freshProfile()));
    const file = await createBackup('right password');
    const before = new Map(values);
    await expect(openBackup(file, 'wrong password')).rejects.toThrow();
    expect(values).toEqual(before);
  }, 10000);
  it('rejects a short backup password', async () => {
    await expect(createBackup('tiny')).rejects.toThrow('8 characters');
  });
});
