// players-2: the art pixel (Game Design V2 C.1.2). Every art pixel must cover a whole number of
// device pixels: devPerArt is an integer at every phone scale, and every blit lands on whole canvas
// px at a whole number of canvas px per art px. Far players are rasterised at their own size.
import { ART_C, artScaleFor, type ArtSprite, blitSprite, devPerArt, quantPx, toView } from './art-scale';
import { rasterBody } from './body';
import { LOOKS } from './__fixtures__/looks';
import * as P from './poses';

/** a 2D context that only records what blitSprite does with it */
function recorder(a: number, e = 0, f = 0) {
  let m = { a, b: 0, c: 0, d: a, e, f };
  const calls: number[][] = [];
  const ctx = {
    getTransform: () => ({ ...m }),
    setTransform: (...t: unknown[]) => {
      const [x] = t;
      m = typeof x === 'object' && x ? { ...(x as typeof m) } : { a: t[0] as number, b: t[1] as number, c: t[2] as number, d: t[3] as number, e: t[4] as number, f: t[5] as number };
    },
    drawImage: (_c: unknown, ...r: number[]) => calls.push(r),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, now: () => m };
}

const fakeSprite = (w: number, h: number): ArtSprite['canvas'] => ({ width: w, height: h }) as HTMLCanvasElement;

describe('the art pixel (V2 C.1.2)', () => {
  it.each([1, 2, 3])('devPerArt is a whole number at DPR %i for every phone scale', (dpr) => {
    for (const k of [0.82, 1.0, 1.103]) {
      const d = devPerArt(k, dpr);
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(2);
      // V2's 1.5 design px, to the nearest device px
      expect(Math.abs(d - 1.5 * k * dpr)).toBeLessThanOrEqual(0.5 + (d === 2 ? 1 : 0));
    }
    // a 3x phone at 393: 4 or 5 device px per art px
    expect([4, 5]).toContain(devPerArt(393 / 390, 3));
  });

  it('places every blit on whole canvas px at a whole scale (option A, DPR 1/2/3, k 0.82/1/1.103)', () => {
    for (const dpr of [1, 2, 3])
      for (const k of [0.82, 1.0, 1.103]) {
        const a = artScaleFor('A', k * dpr, k, dpr);
        expect(Number.isInteger(a.canvasPerArt)).toBe(true);
        const r = recorder(a.backing);
        for (const [w, h] of [[23, 40], [31, 56], [50, 90]]) {
          const spr = toView({ canvas: fakeSprite(w, h), ax: w / 2, ay: h - 3, top: 2, handL: { x: 1, y: 1 }, handR: { x: 2, y: 2 } }, a);
          for (const x of [0, 13.4, 101.7]) blitSprite(r.ctx, spr, Math.round(x - spr.ax), 50);
        }
        for (const [dx, dy, dw, dh] of r.calls) {
          for (const v of [dx, dy, dw, dh]) expect(Number.isInteger(v)).toBe(true);
          // canvas px = device px in option A: the scale per art px is the whole devPerArt
          expect(dw % a.canvasPerArt).toBe(0);
          expect(dh % a.canvasPerArt).toBe(0);
        }
        // and the context is left as it was
        expect(r.now().a).toBe(a.backing);
      }
  });

  it('blits 1:1 in option C (today grain), with anchors untouched', () => {
    const spr = toView({ canvas: fakeSprite(20, 30), ax: 10, ay: 27, top: 3, handL: { x: 4, y: 5 }, handR: { x: 6, y: 7 } }, ART_C);
    expect([spr.ax, spr.ay, spr.top, spr.w, spr.h, spr.cpa]).toEqual([10, 27, 3, 20, 30, 1]);
    const r = recorder(1);
    blitSprite(r.ctx, spr, 5, 6);
    expect(r.calls).toEqual([[5, 6]]);
  });

  it('rasterises far players at their own art size, never from a bigger drawing', () => {
    const a = artScaleFor('A', 3, 1, 3);
    for (const viewH of [24, 36, 51, 95]) {
      const art = a.artPxFor(viewH);
      const r = rasterBody(LOOKS[0], P.idle(0), { facing: 1.2, pitch: 0.5 }, art);
      // the raster's grid is sized from its own art height, and it is drawn up (never down)
      expect(r.h).toBe(Math.ceil(art * 1.7) + 6);
      expect(a.canvasPerArt).toBeGreaterThanOrEqual(1);
      // and on screen it is the height asked for, within an art pixel
      expect(Math.abs(art * a.viewPerArt - viewH)).toBeLessThanOrEqual(a.viewPerArt);
    }
  });

  it('steps sprite sizes 1/2/4/6 art px by size, monotone and idempotent', () => {
    let prev = 0;
    for (let p = 1; p <= 140; p++) {
      const q = quantPx(p);
      expect(q).toBeLessThanOrEqual(p);
      expect(q).toBeGreaterThanOrEqual(prev);
      expect(quantPx(q)).toBe(q);
      prev = q;
    }
    expect([quantPx(13), quantPx(29), quantPx(33), quantPx(59), quantPx(67)]).toEqual([13, 28, 30, 58, 62]);
  });
});
