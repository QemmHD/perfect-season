// The calibration kit, its script and its pinned fixtures are for tests and scripts only: no product
// file may import them, so none of it can reach a bundle (the fixtures are tens of kilobytes of
// ratings, and the kit plays whole games).
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['../../**/*.ts', '../../**/*.tsx', '!../../**/*.test.ts', '!../../**/*.test.tsx', '!./sim-kit.ts'], { query: '?raw', import: 'default', eager: true });

describe('calibration kit isolation', () => {
  it('keeps sim-kit, nfl_calibrate and the calibration fixtures out of every product file', () => {
    const files = Object.keys(SOURCES);
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.endsWith('Football2.tsx'))).toBe(true);
    const ref = /(?:from\s+|import\(\s*)['"][^'"]*(?:sim-kit|nfl_calibrate|nfl-calibration)[^'"]*['"]/;
    expect(files.filter((f) => ref.test(SOURCES[f]))).toEqual([]);
  });
});
