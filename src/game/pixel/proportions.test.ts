// players-2: Broadcast Pixel proportions (Game Design V2 C.1.1), measured on the raster.
// Heads tall = the figure's height (feet to crown; the outline and the hair over the skull excluded, so
// a high top or an afro doesn't make a player more heads tall) over the skull's rows (the head ball).
// Head box = the head and hair pixels' bounding box (V2's "with hair").
// V2's table holds one number per band; it is checked at each band's centre and swept over every
// figure height in the band with all six hair styles (a head is whole pixels, so at 18 art px one row
// is 1.1 heads: the sweep asks for the nearest whole row, and +-0.25 heads where a row is finer).
import { rasterBody, shapeFor, type Look } from './body';
import { legScale } from './mocap';
import * as P from './poses';
import { bmi, drawnHeight, HEAD_TABLE, headCols, headRows, MEAN_HEIGHT_IN, snapCentre, targetHeads, torsoWidthPx } from './proportions';

const plain: Look = { sport: 'nba', ht: 78, wt: 215, num: 23, hair: 0, beard: false, skin: '#a8714f', hairColor: '#1d1612', jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' };
const front = { facing: Math.PI / 2, pitch: 0.45 };

function measure(look: Look, px: number) {
  const r = rasterBody(look, P.idle(0), front, px);
  let y0 = 1e9, y1 = -1, s0 = 1e9, s1 = -1, bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const i = y * r.w + x;
      if (!r.slot[i]) continue;
      const p = r.part[i];
      if (p !== 7) y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      if (p === 6) (s0 = Math.min(s0, y)), (s1 = Math.max(s1, y));
      if (p === 6 || p === 7) (bx0 = Math.min(bx0, x)), (bx1 = Math.max(bx1, x)), (by0 = Math.min(by0, y)), (by1 = Math.max(by1, y));
    }
  const figure = y1 - y0 + 1;
  const skull = s1 - s0 + 1;
  return { figure, skull, heads: figure / skull, boxW: bx1 - bx0 + 1, boxH: by1 - by0 + 1 };
}

/** the grid height whose drawn figure is `artH` tall (the idle pose and the camera's pitch shorten it) */
function atFigure(look: Look, artH: number) {
  for (let px = Math.floor(artH * 0.9); px < artH * 1.5; px++) {
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
  it("reads V2's table: a band's heads across the band, linear between bands", () => {
    expect(targetHeads(12)).toBe(4.5);
    expect(targetHeads(18)).toBe(4.5);
    expect(targetHeads(21)).toBeCloseTo(4.75, 6);
    expect(targetHeads(24)).toBe(5);
    expect(targetHeads(29)).toBeCloseTo(5.25, 6);
    expect(targetHeads(36)).toBe(5.5);
    expect(targetHeads(46)).toBeCloseTo(5.75, 6);
    expect(targetHeads(64)).toBe(6);
    expect(targetHeads(120)).toBe(6);
  });

  it('sizes the head in whole rows, round when small, and centres it on the grid', () => {
    for (let px = 10; px <= 120; px++) expect(Number.isInteger(headRows(0.084, px))).toBe(true);
    expect(headRows(0.084, 10)).toBe(3);
    expect(headCols(4)).toBe(4);
    expect(headCols(11)).toBe(11);
    expect(snapCentre(10.3, 4)).toBe(10);
    expect(snapCentre(10.3, 5)).toBe(10.5);
    // a taller player's smaller rig head (rig.ts) still draws smaller at the same grid size
    expect(headRows(0.078, 80)).toBeLessThan(headRows(0.084, 80));
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

  // every figure height in each band, with all six hair styles (short, buzz, high top, bald, headband, locs)
  describe.each(HEAD_TABLE.map(([lo, hi, heads], i) => ({ lo, hi, heads, box: [[5, 5], [6, 6], [7, 8], [12, 13]][i] })))(
    'figures $lo-$hi art px',
    ({ lo, hi, heads, box }) => {
      const ms: { hair: number; artH: number; m: ReturnType<typeof measure> }[] = [];
      for (let artH = lo; artH <= hi; artH++) for (let hair = 0; hair < 6; hair++) ms.push({ hair, artH, m: atFigure({ ...plain, hair }, artH) });

      it('draws the head the nearest whole row to the figure over the band heads', () => {
        const near = ms.filter(({ m }) => Math.abs(m.figure / heads - m.skull) <= 0.6).length;
        expect(near / ms.length).toBeGreaterThanOrEqual(0.95);
      });

      it('averages the band heads tall (+-0.1)', () => {
        const mean = ms.reduce((a, { m }) => a + m.heads, 0) / ms.length;
        expect(Math.abs(mean - heads)).toBeLessThanOrEqual(0.1);
      });

      // where the head is 9 rows or more (56+ art px). Two heights in 17 (57, 63) have no whole row
      // within 0.25 heads (57/9 = 6.33, 57/10 = 5.70), so 15 of 17 is the most whole rows allow.
      it('keeps the most heights whole rows allow within +-0.25 heads, at 9 rows and up', () => {
        if (lo / heads < 9) return; // one row is over 0.9 heads here; the nearest-row check holds it
        const ok = ms.filter(({ m }) => Math.abs(m.heads - heads) <= 0.25).length;
        expect(ok / ms.length).toBeGreaterThanOrEqual(15 / 17 - 1e-9);
      });

      // V2's box is for the band-centre head; a head drawn a whole row bigger or smaller keeps its shape
      it("keeps the head box near V2's (+-1 px of the band's box, or of it scaled to the head's rows)", () => {
        const rowsAtCentre = (lo + hi) / 2 / heads;
        const near = (v: number, t: number, k: number) => v >= Math.min(t, t * k) - 1 && v <= Math.max(t, t * k) + 1;
        // with hair: short, headband, locs; bald and buzz have no hair over the skull and the high top's
        // height is its own (checked by width only)
        const withHair = ms.filter(({ hair }) => hair === 0 || hair === 4 || hair === 5);
        const okBox = withHair.filter(({ m }) => near(m.boxW, box[0], m.skull / rowsAtCentre) && near(m.boxH, box[1], m.skull / rowsAtCentre)).length;
        expect(okBox / withHair.length).toBeGreaterThanOrEqual(0.9);
        // without hair at the sides (bald, buzz, high top) the head is V2's box less the hair: up to 2 px narrower
        const bare = ms.filter(({ hair }) => hair === 1 || hair === 2 || hair === 3);
        const okW = bare.filter(({ m }) => near(m.boxW + 1, box[0], m.skull / rowsAtCentre)).length;
        expect(okW / bare.length).toBeGreaterThanOrEqual(0.9);
      });
    }
  );

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
