// players-2: the Broadcast Pixel outline and shading (Game Design V2 C.1.3), measured on the raster:
// a 1 art px #14121c ring around every figure, no outline colour inside it (inner separations use the
// part's shadow tone), exactly three tones per material below 56 art px, lit from the top-left, no
// dithering, and the lit-side rim for dark skin on a dark kit.
import { MATERIAL_SLOT, rasterBody, type Look, type Raster } from './body';
import { OUTLINE, ramp3, rgb } from './color';
import * as P from './poses';
import { LOOKS } from './__fixtures__/looks';

const pack = ([r, g, b]: number[]) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const LINE = pack(OUTLINE);
const VIEWS = [
  { facing: Math.PI / 2, pitch: 0.45 },
  { facing: -Math.PI / 2, pitch: 0.3 },
  { facing: 0, pitch: 0.45 },
  { facing: 0.9, pitch: 0.6 },
  { facing: 2.4, pitch: 0.9 },
];
const POSES = [P.idle(0.25), P.run(0.375, 1), P.jumpShot(0.5), P.stance(true), P.kickLeg(0.5), P.dive(0.6), P.contest(0.6), P.celebrate(0.5)];
const SIZES = [16, 22, 34, 48];

function each(fn: (r: Raster, look: Look, px: number) => void) {
  for (const look of LOOKS) for (const view of VIEWS) for (let i = 0; i < POSES.length; i++) for (const px of SIZES) fn(rasterBody(look, POSES[i], view, px), look, px);
}

describe('the outline and the tones (V2 C.1.3)', () => {
  it('rings every silhouette edge pixel in #14121c, and never uses it inside', () => {
    let edges = 0;
    each((r) => {
      const op = (x: number, y: number) => x >= 0 && y >= 0 && x < r.w && y < r.h && (r.px[y * r.w + x] >>> 24) !== 0;
      for (let y = 0; y < r.h; y++)
        for (let x = 0; x < r.w; x++) {
          if (!op(x, y)) continue;
          const c = r.px[y * r.w + x] >>> 0;
          if (!op(x + 1, y) || !op(x - 1, y) || !op(x, y + 1) || !op(x, y - 1)) {
            edges++;
            expect(c).toBe(LINE);
          } else expect(c).not.toBe(LINE);
        }
    });
    expect(edges).toBeGreaterThan(10000);
  });

  it('paints each material in exactly its three V2 tones below 56 art px', () => {
    const look = LOOKS[0];
    for (const view of [VIEWS[0], VIEWS[3]])
      for (const px of [22, 34, 48]) {
        const r = rasterBody(look, P.idle(0.25), view, px);
        for (const [name, hex] of [['jersey', look.jersey], ['skin', look.skin], ['shorts', look.shorts]] as const) {
          const slot = MATERIAL_SLOT[name];
          const tones = new Set(ramp3(rgb(hex)).map(pack));
          const seen = new Set<number>();
          for (let i = 0; i < r.px.length; i++) if (r.slot[i] === slot) seen.add(r.px[i] >>> 0);
          for (const c of seen) expect(tones.has(c), `${name} at ${px}: a colour outside its ramp`).toBe(true);
          // the jersey and the skin show all three tones; shorts may hide one (they are a short tube)
          if (name !== 'shorts') expect(seen.size, `${name} at ${px} px`).toBe(3);
        }
      }
  });

  it('builds the ramp V2 asks for: shadow 22 points darker and bluer, highlight 14 lighter, all distinct', () => {
    for (const hex of ['#1d428a', '#ffc72c', '#ffffff', '#000000', '#111111', '#a8714f', '#c8102e', '#f2f2f2']) {
      const [s, m, l] = ramp3(rgb(hex));
      const L = ([r, g, b]: number[]) => (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
      expect(L(s)).toBeLessThan(L(m));
      expect(L(l)).toBeGreaterThan(L(m));
      for (const c of [s, m, l]) expect(pack(c)).not.toBe(LINE);
    }
    const [s, m, l] = ramp3(rgb('#1d428a'));
    const L = ([r, g, b]: number[]) => (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
    expect(L(m) - L(s)).toBeCloseTo(0.22, 1);
    expect(L(l) - L(m)).toBeCloseTo(0.14, 1);
    // the shadow's hue turns 10 degrees toward blue (240) along the shorter way round: navy toward
    // blue, gold toward orange, red toward magenta
    const hue = ([r, g, b]: number[]) => {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return h * 60;
    };
    for (const [hex, dir] of [['#ffc72c', -1], ['#c8102e', -1], ['#1fa34a', 1]] as const) {
      const [s2, m2] = ramp3(rgb(hex));
      const turn = ((hue(s2) - hue(m2) + 540) % 360) - 180;
      expect(Math.sign(turn), hex).toBe(dir);
      expect(Math.abs(Math.abs(turn) - 10)).toBeLessThan(3);
    }
  });

  it('lights the torso from the top-left', () => {
    const look = LOOKS[0];
    const r = rasterBody(look, P.idle(0), VIEWS[0], 48);
    const [sh, , hi] = ramp3(rgb(look.jersey)).map(pack);
    const mean = (c: number) => {
      let n = 0, x = 0, y = 0;
      for (let i = 0; i < r.px.length; i++) if (r.slot[i] === MATERIAL_SLOT.jersey && r.part[i] === 3 && r.px[i] >>> 0 === c) (n++, (x += i % r.w), (y += Math.floor(i / r.w)));
      return { x: x / n, y: y / n, n };
    };
    const a = mean(hi), b = mean(sh);
    expect(a.n).toBeGreaterThan(0);
    expect(b.n).toBeGreaterThan(0);
    expect(a.x).toBeLessThan(b.x);
  });

  it('never dithers: no 2x2 checkerboard of two tones of one material', () => {
    each((r) => {
      for (let y = 0; y + 1 < r.h; y++)
        for (let x = 0; x + 1 < r.w; x++) {
          const i = y * r.w + x;
          const s = r.slot[i];
          if (!s || r.slot[i + 1] !== s || r.slot[i + r.w] !== s || r.slot[i + r.w + 1] !== s) continue;
          const a = r.px[i], b = r.px[i + 1], c = r.px[i + r.w], d = r.px[i + r.w + 1];
          expect(a === d && b === c && a !== b).toBe(false);
        }
    });
  });

  it('gives dark skin on a dark kit a lit-side rim, and nobody else', () => {
    const dark: Look = { ...LOOKS[0], skin: '#3a312a', jersey: '#111111', shorts: '#111111' };
    const hi = (look: Look) => {
      const r = rasterBody(look, P.idle(0), VIEWS[0], 34);
      const [, , light] = ramp3(rgb(look.skin)).map(pack);
      let rimPx = 0, edgePx = 0;
      for (let y = 1; y < r.h; y++)
        for (let x = 1; x < r.w; x++) {
          const i = y * r.w + x;
          if (r.slot[i] !== MATERIAL_SLOT.skin) continue;
          if (!r.slot[i - 1] || !r.slot[i - r.w]) {
            edgePx++;
            if (r.px[i] >>> 0 === light) rimPx++;
          }
        }
      return rimPx / edgePx;
    };
    expect(hi(dark)).toBe(1);
    expect(hi(LOOKS[0])).toBeLessThan(1);
  });
});
