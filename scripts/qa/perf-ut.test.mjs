// Claude (studio overhaul, shell-1, 2026-11-10): perf-ut's CPU-profile aggregation on a synthetic profile.
import { describe, expect, it } from 'vitest';
import { aggregateProfile } from './perf-ut.mjs';

describe('aggregateProfile', () => {
  // root → buildPool → rateCard ; root → render ; samples every 1 ms
  const node = (id, functionName, children = []) => ({ id, callFrame: { functionName, url: 'http://localhost:5211/src/ut/x.ts', lineNumber: 0, columnNumber: 0 }, children });
  const profile = {
    nodes: [node(1, '(root)', [2, 4]), node(2, 'buildPool', [3]), node(3, 'rateCard'), node(4, 'render')],
    startTime: 0,
    endTime: 6000,
    samples: [3, 3, 2, 3, 4, 4],
    timeDeltas: [0, 1000, 1000, 1000, 1000, 1000],
  };
  it('splits self time at the last sample inside the named functions', () => {
    const a = aggregateProfile(profile, ['buildPool']);
    expect(a.splitAt).toBe(3);
    expect(a.totalMs).toBe(6);
    expect(Object.fromEntries(a.self.pool)).toEqual({ 3: 3000, 2: 1000 });
    expect(Object.fromEntries(a.self.render)).toEqual({ 4: 1000 });
    expect([...a.self.all.values()].reduce((s, x) => s + x, 0)).toBe(5000);
  });
  it('without a split, counts everything once', () => {
    const a = aggregateProfile(profile);
    expect(a.splitAt).toBeNull();
    expect(a.self.pool.size + a.self.render.size).toBe(0);
  });
});
