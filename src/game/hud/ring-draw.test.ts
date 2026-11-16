// hud/ring-draw.ts (plan §3.3, §4.4): the gold band is at least 8 design px at 320 and 393 wide for
// the narrowest gold there is (THR 55 open, ±30 ms), on the arc meter (radius 0.13 × the short side)
// and on the ground ring; amber and red rings are drawn in their own colours and never with gold.
import { goldBase } from '../perfect';
import { ARC_R } from '../hoops2/hud-draw';
import { arcPx, bandPx, drawRing, MIN_GOLD_PX, RING_COLOR, ringScale } from './ring-draw';
import type { RingSpec } from '../perfect';

/** A canvas context that records each stroke and fill: its colour and line width. */
function recorder() {
  const ops: { op: 'stroke' | 'fill'; color: string; width: number }[] = [];
  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    lineCap: 'butt',
    save() {},
    restore() {},
    beginPath() {},
    ellipse() {},
    arc() {},
    stroke() {
      ops.push({ op: 'stroke', color: String(ctx.strokeStyle), width: ctx.lineWidth });
    },
    fill() {
      ops.push({ op: 'fill', color: String(ctx.fillStyle), width: 0 });
    }
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

const SIZES = [
  [320, 568],
  [393, 852]
] as const;
const THR55: RingSpec = { idealMs: 520, goldMs: goldBase(55), state: 'gold' };
const GOLDS = new Set([RING_COLOR.gold, '#ffe08a']);

describe('ring drawing', () => {
  it('the gold band is ≥ 8 px at 320 and 393 for THR 55 open, on the arc and on the ground ring', () => {
    for (const [W, H] of SIZES) {
      const R = Math.max(26, Math.round(Math.min(W, H) * ARC_R));
      expect(bandPx(THR55, arcPx(R, THR55.idealMs))).toBeGreaterThanOrEqual(MIN_GOLD_PX);
      // the ground ring at a far shooter's feet (a small ring): stretched to the minimum, never the window
      for (const rx of [10, 14, 22]) expect(bandPx(THR55, (rx * 1.6) / THR55.idealMs)).toBeGreaterThanOrEqual(MIN_GOLD_PX - 1e-9);
    }
    // the window itself is untouched: only the px per ms grows
    expect(ringScale(THR55, 0.01) * 2 * THR55.goldMs).toBeCloseTo(MIN_GOLD_PX, 9);
    expect(ringScale(THR55, 0.5)).toBe(0.5);
  });

  it('the arc radius is 0.13 × the short side', () => {
    expect(ARC_R).toBe(0.13);
  });

  for (const mode of ['ground', 'arc'] as const) {
    it(mode + ': gold draws a gold band of the window width; amber its own colour; red no band and no gold', () => {
      const g = recorder();
      drawRing(g.ctx, { x: 100, y: 100, rx: 40, ry: 40, t: 0.5, spec: THR55, px: 0.05, reduced: false, mode });
      expect(g.ops.some((o) => GOLDS.has(o.color))).toBe(true);
      if (mode === 'ground') expect(g.ops.some((o) => o.color === RING_COLOR.gold && Math.abs(o.width - bandPx(THR55, 0.05)) < 1e-9)).toBe(true);
      const a = recorder();
      drawRing(a.ctx, { x: 100, y: 100, rx: 40, ry: 40, t: 1, spec: { ...THR55, state: 'amber', dial: 'PRESSURE' }, px: 0.05, reduced: false, mode });
      expect(a.ops.some((o) => o.color === RING_COLOR.amber)).toBe(true);
      expect(a.ops.some((o) => GOLDS.has(o.color))).toBe(false);
      const r = recorder();
      drawRing(r.ctx, { x: 100, y: 100, rx: 40, ry: 40, t: 1, spec: { ...THR55, state: 'red', dial: 'PRESSURE' }, px: 0.05, reduced: false, mode });
      expect(r.ops.some((o) => o.color === RING_COLOR.red)).toBe(true);
      expect(r.ops.some((o) => GOLDS.has(o.color) || o.color === RING_COLOR.amber)).toBe(false);
    });
  }

  it('reduced motion: no closing ring; the target lights while the release is in the window', () => {
    const inside = recorder();
    drawRing(inside.ctx, { x: 0, y: 0, rx: 30, ry: 12, t: 1, spec: THR55, px: 0.05, reduced: true, mode: 'ground' });
    expect(inside.ops.filter((o) => o.op === 'fill').map((o) => o.color)).toEqual(['#ffe08a']);
    const early = recorder();
    drawRing(early.ctx, { x: 0, y: 0, rx: 30, ry: 12, t: 0.3, spec: THR55, px: 0.05, reduced: true, mode: 'ground' });
    expect(early.ops.filter((o) => o.op === 'fill').map((o) => o.color)).toEqual(['#ffffff']);
    // no stroke of the closing ring's width-2 white/ink pair: only the band, its edge and the target
    expect(early.ops.filter((o) => o.op === 'stroke' && o.width === 4)).toEqual([]);
  });
});
