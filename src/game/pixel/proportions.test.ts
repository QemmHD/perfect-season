// players-2: Broadcast Pixel proportions (Game Design V2 C.1.1), measured on the raster.
// Heads tall = the figure's height (outline excluded) over the skull's (the head ball's rows; the hair
// volume over it is not head). Head box = the head and hair pixels' bounding box (V2's "with hair").
// V2's table holds one number per band, so it is checked at each band's centre height.
import { rasterBody, shapeFor, type Look } from './body';
import { legScale } from './mocap';
import * as P from './poses';
import { bmi, drawnHeight, headScale, MEAN_HEIGHT_IN, torsoWidthPx } from './proportions';

const plain: Look = { sport: 'nba', ht: 78, wt: 215, num: 23, hair: 0, beard: false, skin: '#a8714f', hairColor: '#1d1612', jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' };
const front = { facing: Math.PI / 2, pitch: 0.45 };

function measure(look: Look, px: number) {
  const r = rasterBody(look, P.idle(0), front, px);
  let y0 = 1e9, y1 = -1, s0 = 1e9, s1 = -1, bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const i = y * r.w + x;
      if (!r.slot[i]) continue;
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      const p = r.part[i];
      if (p === 6) (s0 = Math.min(s0, y)), (s1 = Math.max(s1, y));
      if (p === 6 || p === 7) (bx0 = Math.min(bx0, x)), (bx1 = Math.max(bx1, x)), (by0 = Math.min(by0, y)), (by1 = Math.max(by1, y));
    }
  const figure = y1 - y0 + 1;
  return { figure, heads: figure / (s1 - s0 + 1), boxW: bx1 - bx0 + 1, boxH: by1 - by0 + 1 };
}

/** the grid height whose drawn figure is `artH` tall (the idle pose and the camera's pitch shorten it) */
function atFigure(look: Look, artH: number) {
  for (let px = artH; px < artH * 1.4; px++) {
    const m = measure(look, px);
    if (m.figure >= artH) return m;
  }
  throw new Error('no grid height draws a ' + artH + ' px figure');
}

/** the torso's face-on width at its widest, in rows no arm crosses (arms raised out of the way) */
function torsoWidth(look: Look, px = 34) {
  const up = { ...P.idle(0), shL: 3.0, shR: 3.0, elL: 0, elR: 0, abL: 0.25, abR: 0.25 };
  const r = rasterBody(look, up, front, px);
  let best = 0;
  for (let y = 0; y < r.h; y++) {
    let a = -1, b = -1, arm = false;
    for (let x = 0; x < r.w; x++) {
      const i = y * r.w + x;
      if (!r.slot[i]) continue;
      if (r.part[i] === 4 || r.part[i] === 5) arm = true;
      if (r.part[i] === 3) {
        if (a < 0) a = x;
        b = x;
      }
    }
    if (!arm && a >= 0) best = Math.max(best, b - a + 1);
  }
  return best;
}

describe('the 5-head hero (V2 C.1.1)', () => {
  it('scales the head by V2 formula, clamped', () => {
    expect(headScale(18)).toBeCloseTo(1.4, 5);
    expect(headScale(34)).toBeCloseTo(1.55 - 34 / 120, 5);
    expect(headScale(8)).toBe(1.45);
    expect(headScale(64)).toBe(1.2);
  });

  it.each([
    [18, 4.5, 5, 5],
    [24, 5, 6, 6],
    [34, 5.5, 7, 8],
    [64, 6, 12, 13],
  ])('a %i art px figure is %f heads tall (+-0.25) with a %ix%i head box (+-1)', (artH, heads, w, h) => {
    const m = atFigure(plain, artH);
    expect(Math.abs(m.heads - heads)).toBeLessThanOrEqual(0.25);
    expect(Math.abs(m.boxW - w)).toBeLessThanOrEqual(1);
    expect(Math.abs(m.boxH - h)).toBeLessThanOrEqual(1);
  });

  it('gives Shaq and Manute Bol different torsos at 34 art px', () => {
    const shaq = torsoWidth({ ...plain, ht: 85, wt: 325 });
    const bol = torsoWidth({ ...plain, ht: 91, wt: 200 });
    expect(shaq).toBeGreaterThanOrEqual(12);
    expect(bol).toBeLessThanOrEqual(9);
    expect(shaq - bol).toBeGreaterThanOrEqual(3);
  });

  it('draws BMI 31 at least 25% wider than BMI 20 at the same height', () => {
    const wt = (b: number) => Math.round((b * 78 * 78) / 703);
    const heavy = torsoWidth({ ...plain, wt: wt(31) });
    const light = torsoWidth({ ...plain, wt: wt(20) });
    expect(heavy / light).toBeGreaterThanOrEqual(1.25);
    // and the width rule is 8 to 13 at 34 art px
    expect(torsoWidthPx(91, 200, 34)).toBe(8);
    expect(torsoWidthPx(80, 400, 34)).toBe(13);
    expect(bmi(85, 325)).toBeCloseTo(31.6, 1);
  });

  it.each(['nba', 'nfl', 'soccer'] as const)('%s: spreads drawn heights x1.15 around the mean', (sport) => {
    const mean = MEAN_HEIGHT_IN[sport];
    expect(drawnHeight(sport, mean)).toBe(mean);
    const k = (drawnHeight(sport, mean + 6) - drawnHeight(sport, mean - 6)) / 12;
    expect(Math.abs(k - 1.15)).toBeLessThanOrEqual(0.02);
  });

  it('leaves bone lengths alone (the rig, the stride and the mocap retarget)', () => {
    // the rig's lengths for a 6'6" 215 lb player, as before players-2
    const s = shapeFor(plain);
    expect(s.thigh).toBeCloseTo(0.225, 6);
    expect(s.shin).toBeCloseTo(0.21, 6);
    expect(s.upper).toBeCloseTo(0.158, 6);
    expect(s.fore).toBeCloseTo(0.142, 6);
    expect(s.spine).toBeCloseTo(0.255, 6);
    expect(s.headR).toBeCloseTo(0.084, 6);
    expect(legScale(plain)).toBeCloseTo(0.435, 6);
  });
});
