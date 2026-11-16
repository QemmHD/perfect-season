// players-2: ground marks (V2 C.1.3): a soft rgba(0,0,0,0.32) shadow at 70% of the shoulder width,
// and the four meaning colours for rings, used nowhere else on a field.
import { drawGroundMark, groundEllipse, MARK_COLOR, SHADOW_ALPHA } from './ground';

const fs = (n: string) => import(/* @vite-ignore */ 'node:' + n);

function recorder() {
  const fills: { style: string; rx: number }[] = [];
  const strokes: { style: string; width: number; a0: number; a1: number }[] = [];
  let style = '', stroke = '', rx = 0, a0 = 0, a1 = 0, lw = 0;
  const ctx = {
    set fillStyle(v: string) { style = v; },
    set strokeStyle(v: string) { stroke = v; },
    set lineWidth(v: number) { lw = v; },
    beginPath() {},
    ellipse(_x: number, _y: number, r: number, _ry: number, _rot: number, s: number, e: number) { rx = r; a0 = s; a1 = e; },
    fill() { fills.push({ style, rx }); },
    stroke() { strokes.push({ style: stroke, width: lw, a0, a1 }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, strokes };
}

describe('ground marks', () => {
  it('sizes the shadow at 70% of the shoulders, flattened by the camera', () => {
    expect(groundEllipse(20, Math.PI / 2).rx).toBe(7);
    expect(groundEllipse(20, Math.PI / 2).ry).toBe(7);
    expect(groundEllipse(20, 0.5).ry).toBeCloseTo(7 * Math.sin(0.5), 6);
  });

  it('reads rgba(0,0,0,0.32) in the middle, softer at the edge', () => {
    const r = recorder();
    drawGroundMark(r.ctx, { x: 10, y: 10, shoulderPx: 20, pitch: 0.5 });
    const alpha = r.fills.map((f) => Number(/rgba\(0,0,0,([\d.]+)\)/.exec(f.style)![1]));
    expect(alpha).toHaveLength(2);
    // the halo and the core over it composite to the shadow's alpha
    expect(1 - (1 - alpha[0]) * (1 - alpha[1])).toBeCloseTo(SHADOW_ALPHA, 2);
    expect(r.fills[0].rx).toBeGreaterThan(r.fills[1].rx);
    expect(r.strokes).toHaveLength(0);
  });

  it('draws each mark as a 2 px ring in its colour (pressure: an arc), and takes a cosmetic colour', () => {
    expect(MARK_COLOR).toEqual({ you: '#f6b93b', target: '#4fe3c1', pressure: '#ff5d5d', rival: '#8b7cf6' });
    for (const mark of ['you', 'target', 'pressure', 'rival'] as const) {
      const r = recorder();
      drawGroundMark(r.ctx, { x: 0, y: 0, shoulderPx: 18, mark });
      expect(r.strokes).toHaveLength(1);
      expect(r.strokes[0].style).toBe(MARK_COLOR[mark]);
      expect(r.strokes[0].width).toBe(2);
      expect(r.strokes[0].a1 - r.strokes[0].a0 < Math.PI * 2 - 1e-9).toBe(mark === 'pressure');
    }
    const r = recorder();
    drawGroundMark(r.ctx, { x: 0, y: 0, shoulderPx: 18, mark: 'you', color: '#c0c0c0' });
    expect(r.strokes[0].style).toBe('#c0c0c0');
  });

  it('keeps the four mark colours off the field: no venue or renderer file uses them', async () => {
    const { readFileSync } = await fs('fs');
    const root = new URL('../', import.meta.url);
    for (const f of ['hoops2/render.ts', 'football2/render.ts', 'soccer2/render.ts', 'pixel/court.ts', 'pixel/field.ts', 'pixel/pitch.ts', 'pixel/persp.ts', 'pixel/body.ts', 'uniforms.ts', 'sprites.ts']) {
      const src = String(readFileSync(new URL(f, root))).toLowerCase();
      for (const c of Object.values(MARK_COLOR)) expect(src.includes(c), `${f} uses ${c}`).toBe(false);
    }
  });
});
