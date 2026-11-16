// Claude (nfl-2 review fix): the name chips' fan-out separates every overlapping pair, not only
// neighbours in x (a chip at another height between two stacked ones used to hide the overlap).
import { describe, expect, it } from 'vitest';
import { fanOut, ICON_HIT } from './ReceiverIcons';

/** every pair whose touch areas would overlap after the fan */
function overlaps(xs: number[], ys: number[]) {
  const out: [number, number][] = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (Math.abs(ys[i] - ys[j]) < ICON_HIT && Math.abs(xs[i] - xs[j]) < ICON_HIT) out.push([i, j]);
  return out;
}

describe('fanOut', () => {
  it('separates two stacked chips with a third at another height between them in x (the landscape case)', () => {
    // CARR 279,187 and #89 270,187 overlap; MOSES 278,109 sits between them in x order
    const xs = [163, 279, 270, 278, 256],
      ys = [187, 187, 187, 109, 141];
    expect(overlaps(xs, ys).length).toBeGreaterThan(0);
    const f = fanOut(xs, ys, 844);
    expect(overlaps(f, ys)).toEqual([]);
  });
  it('separates any pile of chips on a wide screen, and keeps them on it', () => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 300; n++) {
      const k = 2 + Math.floor(r() * 4);
      const xs = Array.from({ length: k }, () => 60 + r() * 200),
        ys = Array.from({ length: k }, () => 100 + r() * 90);
      const f = fanOut(xs, ys, 844);
      expect(overlaps(f, ys)).toEqual([]);
      for (const x of f) {
        expect(x).toBeGreaterThanOrEqual(ICON_HIT / 2);
        expect(x).toBeLessThanOrEqual(844 - ICON_HIT / 2);
      }
    }
  });
  it('leaves chips that already clear each other where they are', () => {
    expect(fanOut([60, 160, 260], [200, 200, 200], 393)).toEqual([60, 160, 260]);
  });
});
