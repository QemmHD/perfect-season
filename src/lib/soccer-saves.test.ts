// Claude 2026-11-01: soccer's saves are additive. Its own profile key, its checkpoint and training keys
// join the recovery and cloud-save keys after the original ones; a save without them (every save an
// older build wrote) still validates and restores, and leaves a phone's soccer progress alone; a
// player who never played soccer saves exactly what older builds wrote. Runs in every sport.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyProgress, captureProgress, checkedSnapshot, CLOUD_KEYS } from './cloud-data';
import { freshProfile, loadProfile, OTHER_SPORTS, PROFILE_KEYS, readOtherLbs, resetOtherSport, saveProfile, updateOtherLb } from './profile';
import { OPTIONAL_KEYS, RECOVERY_KEYS, restoreBackup, validateSaveValues } from './recovery';
import { SPORT } from '../engine/sport';

const NBA = 'perfect-season:profile:v1';
const NFL = 'perfect-season:profile:nfl:v1';
const SOC = 'perfect-season:profile:soccer:v1';
let values: Map<string, string>;
const storage = () => ({ getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v), removeItem: (k: string) => void values.delete(k) });
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', storage());
});

/** A profile as builds before soccer wrote it (no soccer fields anywhere). */
function oldProfile(name: string) {
  const p = freshProfile();
  p.name = name;
  p.coins = 4321;
  p.xp = 990;
  p.ut.owned = [{ uid: 'u1', cardId: 'nba:season:1996:jordan:CHI', level: 2, xp: 10, at: 1 }];
  p.ut.squad = { SG: 'u1' };
  return JSON.parse(JSON.stringify(p));
}

describe('soccer saves (additive)', () => {
  it('has its own key, after the original keys, in recovery and the cloud snapshot', () => {
    expect(PROFILE_KEYS).toEqual({ nba: NBA, nfl: NFL, soccer: SOC });
    expect(RECOVERY_KEYS.slice(0, 2)).toEqual([NBA, NFL]);
    expect(RECOVERY_KEYS).toContain(SOC);
    expect(CLOUD_KEYS).toContain(SOC);
    expect(OPTIONAL_KEYS).toEqual(['perfect-season:profile:soccer:v1', 'perfect-season:checkpoint:soccer', 'perfect-season:training:soccer']);
    expect(OTHER_SPORTS).not.toContain(SPORT);
    expect(OTHER_SPORTS).toHaveLength(2);
  });

  it('a player who never played soccer saves to the cloud exactly what older builds did', () => {
    values.set(NBA, JSON.stringify(oldProfile('Old')));
    values.set(NFL, JSON.stringify({ v: 1, history: [], ut: { owned: [] }, coins: 0 }));
    const snap = captureProgress(storage());
    expect(Object.keys(snap.values).some((k) => k.includes('soccer'))).toBe(false);
    // an older build's snapshot (no soccer keys) still validates
    expect(() => checkedSnapshot(snap)).not.toThrow();
  });

  it('round-trips soccer progress through the cloud snapshot, and an old snapshot leaves it alone', () => {
    values.set(NBA, JSON.stringify(oldProfile('Both')));
    const soccer = { v: 1, history: [{ wins: 30 }], ut: { owned: [{ uid: 's1', cardId: 'soccer:season:2015:28003:BAR', level: 1, xp: 0, at: 1 }], squad: {} }, collection: {} };
    values.set(SOC, JSON.stringify(soccer));
    const snap = captureProgress(storage());
    expect(JSON.parse(snap.values[SOC]!).ut.owned[0].cardId).toBe('soccer:season:2015:28003:BAR');
    // restore on a fresh phone
    values = new Map();
    applyProgress(storage(), snap);
    expect(JSON.parse(values.get(SOC)!).history[0].wins).toBe(30);
    // an older build's snapshot: basketball and football come back, soccer stays as it was
    const old = { v: 1 as const, values: Object.fromEntries(Object.entries(snap.values).filter(([k]) => !k.includes('soccer'))) };
    values.set(NBA, 'x');
    applyProgress(storage(), old);
    expect(JSON.parse(values.get(NBA)!).name).toBe('Both');
    expect(JSON.parse(values.get(SOC)!).history[0].wins).toBe(30);
  });

  it('validates a file backup without soccer keys, and restoring it keeps soccer progress', () => {
    const data: Record<string, string | null> = Object.fromEntries(RECOVERY_KEYS.filter((k) => !OPTIONAL_KEYS.includes(k)).map((k) => [k, null]));
    data[NBA] = JSON.stringify(oldProfile('FileSave'));
    const preview = validateSaveValues(data, 1);
    expect(preview.name).toBe('FileSave');
    values.set(SOC, JSON.stringify({ v: 1, history: [], ut: { owned: [] } }));
    restoreBackup(preview);
    expect(values.has(SOC)).toBe(true);
    expect(JSON.parse(values.get(NBA)!).name).toBe('FileSave');
    // a broken soccer profile is refused like any other
    expect(() => validateSaveValues({ ...data, [SOC]: JSON.stringify({ v: 1, history: 'no' }) }, 1)).toThrow();
  });

  it('this sport loads and saves its own part, the shared part through basketball, the others untouched', () => {
    const nba = oldProfile('Shared');
    values.set(NBA, JSON.stringify(nba));
    const nfl = { ...freshProfile(), history: [{ wins: 12 }] };
    values.set(NFL, JSON.stringify(nfl));
    const p = loadProfile();
    expect(p.name).toBe('Shared');
    expect(p.coins).toBe(4321);
    p.coins = 5000;
    saveProfile(p);
    expect(JSON.parse(values.get(NBA)!).coins).toBe(5000);
    if (SPORT !== 'nfl') expect(JSON.parse(values.get(NFL)!).history).toEqual([{ wins: 12 }]);
    if (SPORT === 'soccer') {
      expect(values.has(SOC)).toBe(true);
      // basketball's own part (its cards) is untouched by a soccer save
      expect(JSON.parse(values.get(NBA)!).ut.owned[0].cardId).toBe('nba:season:1996:jordan:CHI');
    } else expect(values.has(SOC)).toBe(false);
  });

  it('the other sports’ leaderboard queues and Reset reach every other sport', () => {
    for (const s of OTHER_SPORTS) values.set(PROFILE_KEYS[s], JSON.stringify({ ...freshProfile(), name: 'Q', lb: { entries: { a: { name: 'Q' } }, dirty: ['a'] }, history: [{ wins: 1 }] }));
    expect(readOtherLbs().map((o) => o.sport).sort()).toEqual([...OTHER_SPORTS].sort());
    updateOtherLb((lb) => ({ ...lb, dirty: [] }), OTHER_SPORTS[0]);
    expect(JSON.parse(values.get(PROFILE_KEYS[OTHER_SPORTS[0]])!).lb.dirty).toEqual([]);
    expect(JSON.parse(values.get(PROFILE_KEYS[OTHER_SPORTS[1]])!).lb.dirty).toEqual(['a']);
    resetOtherSport();
    for (const s of OTHER_SPORTS) {
      const o = JSON.parse(values.get(PROFILE_KEYS[s])!);
      expect(o.history).toEqual([]);
      expect(o.lb.entries.a.name).toBe('Q');
    }
  });
});
