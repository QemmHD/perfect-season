// Soccer's device preferences (Claude 2026-11-16, studio overhaul soccer-2; plan §5.9): whatever is
// stored, old or new or broken, loads as a valid set; a save keeps fields it does not know; and
// nothing both phones compute can read them.
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, loadPrefs, PREFS_KEY, prefsOf, savePrefs } from './prefs';

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('soccer prefs', () => {
  it('uses its own device key, never one of the save keys', () => {
    expect(PREFS_KEY).toBe('perfect-season:soccer-prefs:v1');
    expect(DEFAULT_PREFS).toEqual({ v: 1, autoDefend: false, autoSwitch: 'on', buttonsOnly: false });
  });
  it('absent, garbage, wrong types and an older shape all load as valid defaults', () => {
    expect(loadPrefs(memory())).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(memory({ [PREFS_KEY]: '{not json' }))).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(memory({ [PREFS_KEY]: '[1,2,3]' }))).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(memory({ [PREFS_KEY]: 'null' }))).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(prefsOf({ autoDefend: 'yes', autoSwitch: 'sometimes', buttonsOnly: 1 })).toMatchObject(DEFAULT_PREFS);
    // revision 2's planned shape (never shipped): its 'cross' switch and its own fields survive
    expect(prefsOf({ v: 1, autoSwitch: 'cross', stick: 'fixed', spacing: 1 })).toMatchObject({ autoSwitch: 'cross', autoDefend: false, stick: 'fixed', spacing: 1 });
  });
  it('a save round-trips and keeps the fields it does not know', () => {
    const st = memory({ [PREFS_KEY]: JSON.stringify({ v: 1, autoDefend: true, futureField: { a: 1 } }) });
    const saved = savePrefs({ buttonsOnly: true }, st);
    expect(saved).toMatchObject({ v: 1, autoDefend: true, buttonsOnly: true, autoSwitch: 'on', futureField: { a: 1 } });
    expect(loadPrefs(st)).toEqual(saved);
    expect(JSON.parse(st.m.get(PREFS_KEY)!)).toEqual(saved);
  });
  it('a store that throws (private mode) costs nothing but the save', () => {
    const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
    expect(loadPrefs(bad)).toEqual(DEFAULT_PREFS);
    expect(savePrefs({ autoDefend: true }, bad)).toMatchObject({ autoDefend: true });
  });
});

describe('the import graph: nothing both phones compute reads prefs or the V2 adapter', () => {
  // every source under src/, keyed by its path from this folder ('./engine.ts', '../../engine/rng.ts')
  const SRC = import.meta.glob<string>(['../../**/*.ts', '../../**/*.tsx', '!../../**/*.test.ts'], { query: '?raw', import: 'default', eager: true });
  const join = (from: string, rel: string) => {
    const parts = from.split('/').slice(0, -1).filter((x) => x !== '.');
    for (const seg of rel.split('/')) {
      if (seg === '..') {
        if (parts.length && parts[parts.length - 1] !== '..') parts.pop();
        else parts.push('..');
      } else if (seg !== '.') parts.push(seg);
    }
    const p = parts.join('/');
    return p.startsWith('.') ? p : './' + p;
  };
  /** every module a file reaches through relative imports (type-only imports erased) */
  const reach = (file: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(file) || SRC[file] === undefined) return seen;
    seen.add(file);
    for (const m of SRC[file].matchAll(/^\s*(import|export)\s+(?!type\b)[^'";]*?from\s+'(\.[^']+)'/gm)) {
      const base = join(file, m[2]);
      const hit = [base + '.ts', base + '.tsx', base + '/index.ts'].find((f) => SRC[f] !== undefined);
      if (hit) reach(hit, seen);
    }
    return seen;
  };
  it('finds the sources it walks', () => {
    expect(SRC['./engine.ts']).toBeTruthy();
    expect(reach('./engine.ts').size).toBeGreaterThan(2);
  });
  it('prefs.ts imports no soccer code at all', () => {
    expect([...reach('./prefs.ts')]).toEqual(['./prefs.ts']);
  });
  it('the engine, the autopilot, the match, the shootout and the ratings never reach prefs.ts, controls.ts or v2/', () => {
    for (const f of ['./engine.ts', './autopilot.ts', './match.ts', './shootout.ts', './ratings.ts']) {
      const hits = [...reach(f)].filter((m) => m.endsWith('/prefs.ts') || m.startsWith('./v2/') || m === './controls.ts');
      expect(hits, f).toEqual([]);
    }
  });
});
