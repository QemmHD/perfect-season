// A pixel buffer for scenery: plotted pixel by pixel (lines, ellipses, filled shapes), never
// anti-aliased, so courts and fields are true pixel art like the players on them.
import { type RGB, rgb } from './color';

export class PixBuf {
  readonly data: Uint32Array;
  readonly img: ImageData;
  constructor(
    readonly w: number,
    readonly h: number
  ) {
    this.img = new ImageData(w, h);
    this.data = new Uint32Array(this.img.data.buffer);
  }

  static pack([r, g, b]: RGB, a = 255): number {
    // ImageData is RGBA in memory: little-endian uint32 is ABGR
    return ((a & 255) << 24) | ((Math.round(b) & 255) << 16) | ((Math.round(g) & 255) << 8) | (Math.round(r) & 255);
  }

  static hex(h: string, a = 255): number {
    return PixBuf.pack(rgb(h), a);
  }

  set(x: number, y: number, c: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  /** blend a color over what's there (alpha 0-1), for floor sheen and shadows */
  tint(x: number, y: number, [r, g, b]: RGB, a: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    const v = this.data[i];
    const r0 = v & 255;
    const g0 = (v >> 8) & 255;
    const b0 = (v >> 16) & 255;
    this.data[i] = PixBuf.pack([r0 + (r - r0) * a, g0 + (g - g0) * a, b0 + (b - b0) * a]);
  }

  fill(c: number) {
    this.data.fill(c);
  }

  rect(x: number, y: number, w: number, h: number, c: number) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    // nothing on screen (a negative end would make fill() count from the end of the buffer)
    if (x1 <= x0 || y1 <= y0) return;
    for (let yy = y0; yy < y1; yy++) this.data.fill(c, yy * this.w + x0, yy * this.w + x1);
  }

  /** Bresenham line */
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** the outline of an ellipse (or part of one: angles in radians, 0 = +x, counter-clockwise on screen) */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number, a0 = 0, a1 = Math.PI * 2) {
    const steps = Math.max(24, Math.ceil((rx + ry) * 4));
    let px: number | null = null;
    let py = 0;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy - Math.sin(a) * ry);
      if (px !== null && (Math.abs(x - px) > 1 || Math.abs(y - py) > 1)) this.line(px, py, x, y, c);
      else this.set(x, y, c);
      px = x;
      py = y;
    }
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const t = (y + 0.5 - cy) / ry;
      if (Math.abs(t) > 1) continue;
      const half = rx * Math.sqrt(1 - t * t);
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) this.set(x, y, c);
    }
  }

  /** a filled convex polygon */
  poly(pts: { x: number; y: number }[], c: number) {
    const ys = pts.map((p) => p.y);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) {
          const x = a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x);
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
      }
      if (lo > hi) continue;
      for (let x = Math.round(lo); x < Math.round(hi); x++) this.set(x, y, c);
    }
  }

  /** draw onto a canvas context at (0, 0) */
  put(ctx: CanvasRenderingContext2D) {
    ctx.putImageData(this.img, 0, 0);
  }
}

/** a steady pseudo-random number from integers, for wood grain and crowds */
export function noise(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}
