// Jersey numbers (studio overhaul players-4, V2 L-5): 3x5 below 34 art px, 4x7 from 34 to 59, 6x10 from
// 60; exact glyphs or nothing, never a scramble. Read back from the raster's NUM pixels: their box
// tells the font, and the pixels must be exactly that number's bitmap (with one or no gap columns).
import { defaultAppearance, skinTone } from './appearance';
import { type Look, NUMBER_FONTS, numberBitmap, rasterBody, type Raster } from './body';
import { STAND } from './rig';
import { NUM } from './slots';

const NUMBERS = [23, 80, 88, 99, 7, 12];

const look = (sport: Look['sport'], num: number, ht: number, wt: number): Look => ({
  sport,
  ht,
  wt,
  num,
  hair: 0,
  skin: skinTone(4),
  hairColor: '#1d1612',
  jersey: '#1d428a',
  trim: '#ffc72c',
  shorts: '#1d428a',
  socks: '#f2f2f2',
  shoes: '#1b1b1f',
  helmet: '#1d428a',
  stripe: '#ffc72c',
  mask: '#9aa0a6',
  pants: '#f2f2f2',
  pads: 1,
  app: defaultAppearance(sport, 'numbers', 2010),
});

/** What the raster shows: the number read back exactly, 'hidden', or 'scrambled'. */
function readNumber(r: Raster, num: number): { got: number | 'hidden' | 'scrambled'; font?: number } {
  const lit: [number, number][] = [];
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.slot[y * r.w + x] === NUM) lit.push([x, y]);
  if (!lit.length) return { got: 'hidden' };
  const x0 = Math.min(...lit.map((p) => p[0]));
  const y0 = Math.min(...lit.map((p) => p[1]));
  const h = Math.max(...lit.map((p) => p[1])) - y0 + 1;
  const key = (ps: [number, number][]) => ps.map(([x, y]) => x + ',' + y).sort().join(' ');
  const seen = key(lit.map(([x, y]) => [x - x0, y - y0]));
  for (const font of Object.values(NUMBER_FONTS))
    for (const gap of [1, 0]) {
      const bm = numberBitmap(num, font, gap);
      // a glyph's first column may be blank: line the bitmaps up at their own first lit pixel
      const bx = Math.min(...bm.px.map((p) => p[0]));
      const by = Math.min(...bm.px.map((p) => p[1]));
      if (key(bm.px.map(([x, y]) => [x - bx, y - by])) === seen) return { got: num, font: font.h };
    }
  return { got: 'scrambled', font: h };
}

const BUILDS: [Look['sport'], number, number][] = [
  ['nba', 78, 215],
  ['nba', 74, 180],
  ['nfl', 74, 220],
  ['soccer', 71, 165],
];

describe('jersey numbers', () => {
  it.each(BUILDS)('%s %i in %i lb: exact front-on at 28 art px (28 design px at 393), in the 3x5 font', (sport, ht, wt) => {
    for (const n of NUMBERS) {
      const r = readNumber(rasterBody(look(sport, n, ht, wt), STAND, { facing: Math.PI / 2, pitch: 0.2 }, 28), n);
      expect(r, `${n}`).toEqual({ got: n, font: 5 });
    }
  });

  it.each(BUILDS)('%s %i in %i lb: exact or hidden at 34, 56 and 80 art px, facings 0.6 to 0.9', (sport, ht, wt) => {
    let shown = 0;
    for (const px of [34, 56, 80])
      for (const facing of [0.6, 0.7, 0.8, 0.9, Math.PI / 2])
        for (const n of NUMBERS) {
          const r = readNumber(rasterBody(look(sport, n, ht, wt), STAND, { facing, pitch: 0.35 }, px), n);
          expect(r.got, `${n} at ${px} px facing ${facing}`).not.toBe('scrambled');
          if (r.got === n) shown++;
        }
    // and shown more often than not (facing 0.6 is past the 0.6 squeeze, and an arm across the chest
    // hides it), not dodged by hiding
    expect(shown).toBeGreaterThan(3 * 5 * NUMBERS.length * 0.5);
  });

  it('uses the 4x7 font from 34 and the 6x10 from 60, front-on', () => {
    for (const n of NUMBERS) {
      expect(readNumber(rasterBody(look('nba', n, 78, 215), STAND, { facing: Math.PI / 2, pitch: 0.2 }, 34), n).font).toBe(7);
      expect(readNumber(rasterBody(look('nba', n, 78, 215), STAND, { facing: Math.PI / 2, pitch: 0.2 }, 60), n).font).toBe(10);
      expect(readNumber(rasterBody(look('nba', n, 78, 215), STAND, { facing: Math.PI / 2, pitch: 0.2 }, 80), n).font).toBe(10);
    }
  });

  it('hides the number on a chest turned past 0.6, and keeps it on the back', () => {
    expect(readNumber(rasterBody(look('nba', 23, 78, 215), STAND, { facing: 0.5, pitch: 0.3 }, 60), 23).got).toBe('hidden');
    expect(readNumber(rasterBody(look('nba', 23, 78, 215), STAND, { facing: -Math.PI / 2, pitch: 0.3 }, 60), 23).got).toBe(23);
  });
});
