// Claude (studio overhaul, shell-4): what the recovery screen treats as a missing download, and the
// match attribute file's strict load (game/attrs.ts), which Arcade uses so a failed download ends on
// the recovery screen instead of a match played without real ratings.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SPORT } from '../engine/sport';
import { isChunkError } from './Recovery';

const { state, file } = vi.hoisted(() => {
  const state = { fail: true, imports: 0 };
  const file = async () => {
    state.imports++;
    if (state.fail) throw new TypeError('Failed to fetch dynamically imported module: /assets/nba-attrs-abc123.js');
    return { default: { fields: ['ht', 'num'], lines: { p1: [80, 23] } } };
  };
  return { state, file };
});
vi.mock('../data/nba-attrs.json', file);
vi.mock('../data/nfl-attrs.json', file);

describe('isChunkError', () => {
  it('knows each browser’s wording for a missing module', () => {
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a-1.js'))).toBe(true);
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkError(Object.assign(new Error('Loading chunk 12 failed.'), { name: 'ChunkLoadError' }))).toBe(true);
    expect(isChunkError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true);
  });
  it('treats everything else as a bug', () => {
    expect(isChunkError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isChunkError(undefined)).toBe(false);
    expect(isChunkError('qa-crash: view')).toBe(false);
  });
});

// soccer has no attribute file: its match loads the soccer engine instead
describe.skipIf(SPORT === 'soccer')('loadAttrs(strict)', () => {
  beforeEach(() => {
    vi.resetModules();
    state.fail = true;
    state.imports = 0;
  });

  it('rejects for a match when the file can’t download, and the lenient call still gets the empty lookup', async () => {
    const { loadAttrs } = await import('../game/attrs');
    // (vitest rewraps a failing mock factory's error, so only the rejection itself is checked)
    await expect(loadAttrs(true)).rejects.toThrow();
    const lenient = await loadAttrs();
    expect(lenient({ id: 'p1' } as never)).toBe(null);
  });

  it('tries the download again on the next call, and then caches it', async () => {
    const { loadAttrs } = await import('../game/attrs');
    await expect(loadAttrs(true)).rejects.toThrow();
    state.fail = false;
    const f = await loadAttrs(true);
    expect(f({ id: 'p1' } as never)).toEqual({ ht: 80, num: 23 });
    const before = state.imports;
    expect((await loadAttrs())({ id: 'p1' } as never)).toEqual({ ht: 80, num: 23 });
    expect(state.imports).toBe(before);
  });
});
