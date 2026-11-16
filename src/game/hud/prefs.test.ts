// The touch preferences (plan §4.7): one new key, read defensively, written read-modify-write, and
// never touching another key.
import { beforeEach, describe, expect, it } from 'vitest';
import { firstTime, loadPrefs, PREFS_KEY, savePrefs } from './prefs';

class MemoryStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  get length() {
    return this.m.size;
  }
}
const mem = new MemoryStorage();
(globalThis as unknown as { localStorage: Storage }).localStorage = mem as unknown as Storage;

describe('touch prefs', () => {
  beforeEach(() => mem.clear());
  it('missing, corrupt or an old shape read as the defaults, never a throw', () => {
    expect(loadPrefs()).toEqual({ v: 1 });
    mem.setItem(PREFS_KEY, '{not json');
    expect(loadPrefs()).toEqual({ v: 1 });
    mem.setItem(PREFS_KEY, JSON.stringify({ v: 0, controls: 'buttons' }));
    expect(loadPrefs()).toEqual({ v: 1 });
    mem.setItem(PREFS_KEY, JSON.stringify([1, 2]));
    expect(loadPrefs()).toEqual({ v: 1 });
    mem.setItem(PREFS_KEY, JSON.stringify({ v: 1, controls: 'joystick', meter: 'off', offsetMs: 9999, hints: { nba: 5, nfl: -1, golf: 3 }, autoDefend: { nba: 'yes', nfl: true } }));
    expect(loadPrefs()).toEqual({ v: 1, meter: 'off', hints: { nba: 5 }, autoDefend: { nfl: true } });
  });
  it('saves read-modify-write, merging the per-sport maps', () => {
    savePrefs({ controls: 'buttons' });
    savePrefs({ hints: { nba: 3 } });
    savePrefs({ hints: { nfl: 1 }, offsetMs: -12 });
    expect(loadPrefs()).toEqual({ v: 1, controls: 'buttons', hints: { nba: 3, nfl: 1 }, offsetMs: -12 });
  });
  it('touches no other key (the profile, the saves, settings)', () => {
    mem.setItem('perfect-season:profile:v1', '{"coins":123}');
    mem.setItem('perfect-season:settings', 'x');
    const before = new Map(mem.m);
    savePrefs({ controls: 'gestures', hints: { nba: 1 } });
    expect(mem.length).toBe(before.size + 1);
    for (const [k, v] of before) expect(mem.getItem(k)).toBe(v);
  });
  it('a one-line hint shows once per device', () => {
    expect(firstTime('nba', 2)).toBe(true);
    expect(firstTime('nba', 2)).toBe(false);
    expect(firstTime('nba', 3)).toBe(true);
    expect(firstTime('nfl', 2)).toBe(true);
    expect(loadPrefs().hints).toEqual({ nba: 12, nfl: 4 });
  });
  it('works with no storage at all (a locked-down browser)', () => {
    const keep = globalThis.localStorage;
    (globalThis as unknown as { localStorage: unknown }).localStorage = undefined;
    expect(loadPrefs()).toEqual({ v: 1 });
    expect(() => savePrefs({ controls: 'buttons' })).not.toThrow();
    (globalThis as unknown as { localStorage: Storage }).localStorage = keep;
  });
});
