// The football preferences fall back to their defaults whatever storage does: missing, garbage,
// blocked or throwing.
import { afterEach, describe, expect, it } from 'vitest';
import { choicePref, flagPref, jsonPref, readPref, writePref } from './prefs';

const layout = choicePref('perfect-season:test-layout', ['field', 'panel'] as const, 'field');
const flag = flagPref('perfect-season:test-flag', false);
const log = jsonPref<{ plays: number }>('perfect-season:test-log', { plays: 0 }, (x) => (x && typeof x === 'object' && Number.isInteger((x as { plays?: unknown }).plays) ? (x as { plays: number }) : undefined));

/** A Map-backed Storage, optionally throwing on reads and/or writes. */
function memory({ throwGet = false, throwSet = false } = {}): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    getItem: (k: string) => {
      if (throwGet) throw new Error('SecurityError');
      return m.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (throwSet) throw new Error('QuotaExceededError');
      m.set(k, String(v));
    }
  };
}
const g = globalThis as { localStorage?: Storage };
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
function install(s: Storage | (() => never)) {
  Object.defineProperty(globalThis, 'localStorage', typeof s === 'function' ? { configurable: true, get: s } : { configurable: true, value: s, writable: true });
}
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete g.localStorage;
});

describe('football preferences', () => {
  it('gives the default for a missing key, and the stored value once written', () => {
    install(memory());
    expect(readPref(layout)).toBe('field');
    expect(readPref(flag)).toBe(false);
    expect(readPref(log)).toEqual({ plays: 0 });
    expect(writePref(layout, 'panel')).toBe(true);
    expect(writePref(flag, true)).toBe(true);
    expect(writePref(log, { plays: 12 })).toBe(true);
    expect(readPref(layout)).toBe('panel');
    expect(readPref(flag)).toBe(true);
    expect(readPref(log)).toEqual({ plays: 12 });
  });
  it('gives the default for garbage', () => {
    const s = memory();
    install(s);
    s.setItem(layout.key, 'sideways');
    s.setItem(flag.key, 'yes');
    s.setItem(log.key, '{not json');
    expect(readPref(layout)).toBe('field');
    expect(readPref(flag)).toBe(false);
    expect(readPref(log)).toEqual({ plays: 0 });
    s.setItem(log.key, JSON.stringify({ plays: 'many' }));
    expect(readPref(log)).toEqual({ plays: 0 });
  });
  it('gives the default when getItem throws, and drops a write when setItem throws', () => {
    install(memory({ throwGet: true }));
    expect(readPref(layout)).toBe('field');
    install(memory({ throwSet: true }));
    expect(writePref(layout, 'panel')).toBe(false);
    expect(readPref(layout)).toBe('field');
  });
  it('gives the default when storage itself is missing or its accessor throws', () => {
    delete g.localStorage;
    expect(readPref(flag)).toBe(false);
    expect(writePref(flag, true)).toBe(false);
    install(() => {
      throw new Error('SecurityError: storage blocked');
    });
    expect(readPref(layout)).toBe('field');
    expect(writePref(layout, 'panel')).toBe(false);
  });
});
