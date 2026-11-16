// The pixel grid a player is drawn into (studio overhaul players-2, moved from body.ts): each pixel
// keeps its material slot, its light tone, the body part it belongs to and its depth, so nearer limbs
// cover farther ones and the outline pass can tell an overlap from the figure's edge. Pure: no canvas,
// so sprites can be built and tested anywhere.
import type { P2 } from './rig';

export interface Buf {
  w: number;
  h: number;
  slot: Uint8Array;
  tone: Uint8Array;
  part: Uint8Array;
  depth: Float32Array;
}

export function buffer(w: number, h: number): Buf {
  const n = w * h;
  const depth = new Float32Array(n);
  depth.fill(-1e9);
  return { w, h, slot: new Uint8Array(n), tone: new Uint8Array(n), part: new Uint8Array(n), depth };
}

// the light: from the upper left, a little in front
export const LX = -0.5;
export const LY = 0.62;
export const LZ = 0.6;
export const LN = Math.hypot(LX, LY, LZ);

export function toneOf(nx: number, ny: number, nz: number, bias: number): number {
  const i = (nx * LX + ny * LY + nz * LZ) / LN + bias;
  return i > 0.66 ? 2 : i > 0.1 ? 1 : 0;
}

export function put(b: Buf, x: number, y: number, d: number, slot: number, tone: number, part: number) {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const i = y * b.w + x;
  if (d <= b.depth[i]) return;
  b.depth[i] = d;
  b.slot[i] = slot;
  b.tone[i] = tone;
  b.part[i] = part;
}

/**
 * A limb: a rounded segment from a to b whose radius goes from ra to rb. `slotAt(t)` picks the
 * material along it (t 0 at a, 1 at b), so one thigh can be shorts at the top and skin at the knee.
 * `over`: a body part it always covers, whatever its depth (hair lying on his back when we see it).
 */
export function capsule(b: Buf, ox: number, oy: number, a: P2, c: P2, ra: number, rb: number, slotAt: (t: number) => number, part: number, bias = 0, over = -1) {
  const ax = a.x + ox;
  const ay = a.y + oy;
  const bx = c.x + ox;
  const by = c.y + oy;
  const r = Math.max(ra, rb);
  const x0 = Math.floor(Math.min(ax, bx) - r - 1);
  const x1 = Math.ceil(Math.max(ax, bx) + r + 1);
  const y0 = Math.floor(Math.min(ay, by) - r - 1);
  const y1 = Math.ceil(Math.max(ay, by) + r + 1);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-6;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      const rr = ra + (rb - ra) * t;
      const ex = px - cx;
      const ey = py - cy;
      const d2 = ex * ex + ey * ey;
      if (d2 > rr * rr) continue;
      const nx = ex / rr;
      const ny = -ey / rr;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const depth = a.d + (c.d - a.d) * t + nz * rr;
      if (over >= 0 && x >= 0 && y >= 0 && x < b.w && y < b.h && b.slot[y * b.w + x] && b.part[y * b.w + x] === over) b.depth[y * b.w + x] = -1e9;
      put(b, x, y, depth, slotAt(t), toneOf(nx, ny, nz, bias), part);
    }
}

export function ball(b: Buf, ox: number, oy: number, c: P2, r: number, slotFor: (nx: number, ny: number, nz: number, x: number, y: number) => number, part: number, sx = 1, over = -1) {
  // `sx` narrows it across (a head is taller than it is wide); `over`: a body part this ball always
  // covers, whatever its depth (the head sits on the torso and neck: a chin never sinks into the chest)
  const cx = c.x + ox;
  const cy = c.y + oy;
  const rx = r * sx;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const ex = (x + 0.5 - cx) / sx;
      const ey = y + 0.5 - cy;
      if (ex * ex + ey * ey > r * r) continue;
      const nx = ex / r;
      const ny = -ey / r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      // slot 0 from slotFor: no pixel here (a partial shell, such as hair volume); x and y are the grid
      // pixel, for patterns that must stay put on the grid (cornrow partings, curls)
      const slot = slotFor(nx, ny, nz, x, y);
      if (!slot) continue;
      const i = y * b.w + x;
      if (over >= 0 && x >= 0 && y >= 0 && x < b.w && y < b.h && b.slot[i] && b.part[i] === over) b.depth[i] = -1e9;
      put(b, x, y, c.d + nz * r, slot, toneOf(nx, ny, nz, 0.05), part);
    }
}
