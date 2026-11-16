// The calibration kit, its script and its pinned fixtures are for tests and scripts only: no product
// file may import them, so none of it can reach a bundle (the fixtures are tens of kilobytes of
// ratings, and the kit plays whole games). And football reaches the V2 pieces other teams write
// (nba's stick, ring, Heat and HUD kit; ut's haptics and playtime) only through shared-v2.ts, so the
// merge swaps one file's bodies for re-exports and no football code changes.
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['../../**/*.ts', '../../**/*.tsx', '!../../**/*.test.ts', '!../../**/*.test.tsx', '!./sim-kit.ts'], { query: '?raw', import: 'default', eager: true });
const FOOTBALL = import.meta.glob<string>(['./**/*.ts', './**/*.tsx', './**/*.css', '../football/**/*.ts', '../football/**/*.tsx', '!./shared-v2.ts', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true });

describe('calibration kit isolation', () => {
  it('keeps sim-kit, nfl_calibrate and the calibration fixtures out of every product file', () => {
    const files = Object.keys(SOURCES);
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.endsWith('Football2.tsx'))).toBe(true);
    const ref = /(?:from\s+|import\(\s*)['"][^'"]*(?:sim-kit|nfl_calibrate|nfl-calibration)[^'"]*['"]/;
    expect(files.filter((f) => ref.test(SOURCES[f]))).toEqual([]);
  });
});

describe('one import point for the V2 shared modules', () => {
  // an import (or a CSS @import) of src/game/{Stick,stick,perfect,heat}, src/game/hud/*,
  // src/game/controls-geometry.css, src/lib/playtime or src/lib/haptics
  const V2 = /(?:from\s+|import\(\s*|@import\s+|import\s+)['"](?:\.\.\/)+(?:game\/)?(?:Stick|stick|perfect|heat|hud\/[^'"]*|controls-geometry\.css)(?:\.tsx?)?['"]|['"](?:\.\.\/)+lib\/(?:playtime|haptics)(?:\.ts)?['"]/;
  it('finds the rule working on a sample line', () => {
    expect(V2.test("import { Stick } from '../Stick';")).toBe(true);
    expect(V2.test("import { haptic } from '../../lib/haptics';")).toBe(true);
    expect(V2.test("import '../controls-geometry.css';")).toBe(true);
    expect(V2.test("import { screenRunInput } from './controls';")).toBe(false);
    expect(V2.test("import { sfx } from '../../lib/sound';")).toBe(false);
  });
  it('lets no football file but shared-v2.ts import them', () => {
    const files = Object.keys(FOOTBALL);
    expect(files.some((f) => f.endsWith('Football2.tsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('shared-v2.ts'))).toBe(false);
    expect(files.filter((f) => V2.test(FOOTBALL[f]))).toEqual([]);
  });
});
