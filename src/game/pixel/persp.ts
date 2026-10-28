// A camera with perspective, from behind the offense and up in the stands, the way a broadcast shows
// a play: the football field held upright, and the basketball court (behind the shooter, facing the
// hoop) either way up. Near players are big, the far end narrows toward the stands. The floor is
// drawn a row at a time from a top-down picture of it (like the old consoles' "mode 7"), and past
// the far end there's a wall of fans. Units are the sport's: yards for the field, feet for the court.
import { mix, type RGB, rgb } from './color';
import { type CourtCam, type CourtTheme, drawCourt } from './court';
import { drawField, FIELD_W, type FieldCam, type FieldTheme } from './field';
import { freeCanvas } from './body';
import { noise, PixBuf } from './pixbuf';

export interface PCam {
  W: number;
  H: number;
  /** where the camera is: across, along (behind the play) and up, in yards */
  cx: number;
  cy: number;
  ch: number;
  /** how far it looks down (radians) */
  pitch: number;
  /** focal length in game pixels */
  f: number;
  /** the screen row of the camera's axis */
  hy: number;
}

/** The football field's far wall of stands, past the far end zone (yards) */
export const WALL_Y = 117;

export function project(c: PCam, x: number, y: number, h = 0): { x: number; y: number; s: number; z: number } {
  const cs = Math.cos(c.pitch);
  const sn = Math.sin(c.pitch);
  const dy = y - c.cy;
  const dz = h - c.ch;
  const z = Math.max(0.5, dy * cs - dz * sn);
  const u = dy * sn + dz * cs;
  return { x: c.W / 2 + (c.f * (x - c.cx)) / z, y: c.hy - (c.f * u) / z, s: c.f / z, z };
}

/**
 * A camera for a screen W x H that puts the ground point (fx, fy) on row `row` (0-1 of the
 * height), `s` pixels to the yard there, with the horizon at `horizon` (0-1). `fov` is half the
 * width's angle: wider is closer and steeper with more perspective, narrower flatter.
 */
export function pcam(W: number, H: number, fx: number, fy: number, opts: { row: number; s: number; horizon: number; pitch: number; fov: number }): PCam {
  const cs = Math.cos(opts.pitch);
  const sn = Math.sin(opts.pitch);
  const hz = opts.horizon * H;
  // a ground point sits s * height / cos(pitch) below the horizon
  const ch = ((opts.row * H - hz) * cs) / opts.s;
  const f = W / 2 / Math.tan(opts.fov);
  // s = f / z, and z = d cos + height sin
  const d = (f / opts.s - ch * sn) / cs;
  return { W, H, cx: fx, cy: fy - d, ch, pitch: opts.pitch, f, hy: hz + f * Math.tan(opts.pitch) };
}

export interface FieldTex {
  /** top-down texture levels (each half the last), and how they map to the field */
  lv: { px: Uint32Array; w: number; h: number; k: number }[];
  x0: number;
  y0: number;
  dark: number;
  /** the wall of fans: where it stands (along), how high, texels a unit, and its picture */
  wallY: number;
  wallH: number;
  wallK: number;
  wall: Uint32Array;
  wallW: number;
  sky: Uint32Array;
}

const pack = (c: RGB) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];

/** A top-down picture as texture levels: full size, then two smaller copies for the distance. */
function levels(canvas: HTMLCanvasElement, k: number): FieldTex['lv'] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const lv = [{ px: new Uint32Array(img.data.buffer.slice(0)), w: canvas.width, h: canvas.height, k }];
  for (let i = 0; i < 2; i++) {
    const a = lv[lv.length - 1];
    const w = a.w >> 1;
    const h = a.h >> 1;
    const px = new Uint32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let q = 0; q < 4; q++) {
          const v = a.px[(y * 2 + (q >> 1)) * a.w + x * 2 + (q & 1)];
          r += v & 255;
          g += (v >> 8) & 255;
          b += (v >> 16) & 255;
        }
        px[y * w + x] = (255 << 24) | ((b >> 2) << 16) | ((g >> 2) << 8) | (r >> 2);
      }
    lv.push({ px, w, h, k: a.k / 2 });
  }
  return lv;
}

/**
 * A wall of fans `h` units high at `k` texels a unit, in tiers: a padded wall and an LED ribbon at
 * the bottom, the lower bowl, a facade, the upper deck in the dark, the roof's edge with its lights.
 * The tiers are given as heights (units): the ribbon's top, the facade's, the roof's.
 */
function standsWall(h: number, k: number, tiers: { pad: number; ribbon: number; facade: number; facadeH: number; roof: number }, colors: { home: RGB; away: RGB; trim: RGB }) {
  const wallW = 512;
  const wallH = Math.round(h * k);
  const wall = new Uint32Array(wallW * wallH);
  const { home, away, trim } = colors;
  const darkC: RGB = [14, 18, 26];
  const shirts: RGB[] = [home, away, away, [230, 230, 230], [44, 48, 66], mix(away, [255, 255, 255], 0.3), trim];
  for (let y = 0; y < wallH; y++) {
    const yd = h - y / k;
    for (let x = 0; x < wallW; x++) {
      let c: RGB;
      if (yd < tiers.pad) c = mix(away, darkC, 0.45);
      else if (yd < tiers.ribbon) c = Math.floor(x / 24) % 2 ? mix(away, [255, 255, 255], 0.15) : trim;
      else if (yd >= tiers.facade && yd < tiers.facade + tiers.facadeH) c = yd < tiers.facade + tiers.facadeH / 3 ? [30, 34, 46] : Math.floor(x / 40) % 3 === 0 ? mix(trim, [255, 255, 255], 0.3) : mix(away, darkC, 0.2);
      else if (yd >= tiers.roof) c = yd < tiers.roof + 0.75 * (4 / k) && x % 32 < 5 ? [255, 250, 220] : [22, 25, 34];
      else {
        // fans, a row every three texels, heads on top, a few empty seats
        const rowN = Math.floor(y / 3);
        const seat = Math.floor((x + (rowN % 2)) / 2);
        const n = noise(seat, rowN, 5);
        if (y % 3 === 2 && n < 0.5) c = [34, 38, 52];
        else if (n < 0.07) c = [40, 44, 60];
        else if (y % 3 === 0) c = mix([200, 156, 118], [74, 46, 30], noise(seat, rowN, 8) * 0.85);
        else c = shirts[Math.floor(noise(seat, rowN, 2) * shirts.length)];
        // the upper deck sits back in the dark
        const upper = tiers.facade + tiers.facadeH;
        c = mix(c, darkC, yd > upper ? 0.25 + ((yd - upper) / Math.max(1, tiers.roof - upper)) * 0.35 : 0.08);
      }
      wall[y * wallW + x] = pack(c);
    }
  }
  return { wall, wallW };
}

/** The night sky over the stadium, with a glow from the lights. */
function skyRamp(): Uint32Array {
  const sky = new Uint32Array(256);
  for (let i = 0; i < 256; i++) sky[i] = pack(mix([10, 14, 30], [44, 54, 92], Math.pow(i / 255, 1.6)));
  return sky;
}

/** The field as seen from straight above, at 8 pixels a yard, with the stands past the far end zone. */
export function fieldTexture(theme: FieldTheme): FieldTex {
  const k = 8;
  const top: FieldCam = { mode: 'end', W: 0, H: 0, k, pitch: Math.PI / 2, fx: 0, fy: 0, ax: 0, ay: 0 };
  const { canvas, cam } = drawField(top, theme, { crowd: false });
  // field (x, y) -> texel: col = (x - cam.fx) k + cam.ax, row = cam.ay - (y - cam.fy) k
  const x0 = cam.fx - cam.ax / k;
  const y0 = cam.fy + cam.ay / k;
  const { wall, wallW } = standsWall(28, 4, { pad: 1, ribbon: 1.75, facade: 10, facadeH: 1.5, roof: 25.5 }, { home: rgb(theme.homeC1), away: rgb(theme.awayC1), trim: rgb(theme.awayC2) });
  const lv = levels(canvas, k);
  // read into the texture: the canvas can go
  freeCanvas(canvas);
  return { lv, x0, y0, dark: pack([18, 30, 20]), wallY: WALL_Y, wallH: 28, wallK: 4, wall, wallW, sky: skyRamp() };
}

/** The court's far wall of stands, behind the basket (feet past midcourt) */
export const COURT_WALL = 56;

/**
 * The basketball court from straight above at 8 pixels a foot, as the perspective camera's floor:
 * ground x is across the court (cz), ground y along it (cx, the hoop's end the far one). Behind the
 * basket, the arena's stands.
 */
export function courtTexture(theme: CourtTheme): FieldTex {
  const k = 8;
  const top = 54;
  const bottom = -26;
  const half = 34;
  const c: CourtCam = { mode: 'end', W: half * 2 * k, H: (top - bottom) * k, k, pitch: Math.PI / 2, cam: top, origin: half * k, top: 0 };
  const buf = new PixBuf(c.W, c.H);
  drawCourt(buf, c, theme, 0, 0, false);
  // courtside: rows of seats beyond the sidelines, fans seen from above
  const c1 = rgb(theme.c1);
  for (let y = 0; y < c.H; y++)
    for (let x = 0; x < c.W; x++) {
      const cz = (x - c.origin) / k;
      if (Math.abs(cz) < 31) continue;
      const row = Math.floor((Math.abs(cz) - 31) / 2.2);
      const seat = Math.floor(y / 12);
      const n = noise(seat, row, Math.sign(cz) + 3);
      const inRow = (Math.abs(cz) - 31) % 2.2;
      const col: RGB = inRow < 0.5 ? [22, 24, 34] : n < 0.1 ? [40, 44, 60] : (y % 12) < 5 ? mix([200, 156, 118], [74, 46, 30], noise(seat, row, 8)) : mix(([c1, [230, 230, 230], [44, 48, 66], [30, 70, 120]] as RGB[])[Math.floor(n * 4)], [14, 18, 26], 0.2);
      buf.set(x, y, PixBuf.pack(col));
    }
  const canvas = document.createElement('canvas');
  canvas.width = c.W;
  canvas.height = c.H;
  buf.put(canvas.getContext('2d')!);
  const home = rgb(theme.c1);
  const { wall, wallW } = standsWall(24, 3, { pad: 3, ribbon: 5.5, facade: 13, facadeH: 2, roof: 22 }, { home, away: home, trim: rgb(theme.c2) });
  const lv = levels(canvas, k);
  freeCanvas(canvas);
  return { lv, x0: -half, y0: top, dark: pack([14, 16, 24]), wallY: COURT_WALL, wallH: 24, wallK: 3, wall, wallW, sky: skyRamp() };
}

/**
 * Draw the ground, the far wall and the sky into `out`, a row at a time, at 1/q of the screen's
 * resolution (out is ceil(W/q) x ceil(H/q)); the caller scales it up with nearest-neighbour.
 */
export function drawFloor(c: PCam, tex: FieldTex, out: Uint32Array, q = 1) {
  const { W, H, f, ch, cx, cy } = c;
  const Wq = Math.ceil(W / q);
  const Hq = Math.ceil(H / q);
  const cs = Math.cos(c.pitch);
  const sn = Math.sin(c.pitch);
  const WALL_Y = tex.wallY;
  const WALL_H = tex.wallH;
  const WK = tex.wallK;
  const wallBase = project(c, cx, WALL_Y, 0).y;
  const wallTop = project(c, cx, WALL_Y, WALL_H).y;
  const wallZ = Math.max(0.5, (WALL_Y - cy) * cs + ch * sn);
  // a run of texels across a row: u the first texel (fractional), du per output pixel
  const span = (row: number, src: Uint32Array, srcRow: number, w: number, u: number, du: number, wrap: boolean) => {
    if (wrap) {
      for (let ox = 0; ox < Wq; ox++, u += du) {
        const tx = Math.floor(u) % w;
        out[row + ox] = src[srcRow + (tx < 0 ? tx + w : tx)];
      }
      return;
    }
    // dark off either side of the texture, a straight copy in between
    let ox = 0;
    for (; ox < Wq && u < 0; ox++, u += du) out[row + ox] = tex.dark;
    for (; ox < Wq && u < w; ox++, u += du) out[row + ox] = src[srcRow + (u | 0)];
    for (; ox < Wq; ox++) out[row + ox] = tex.dark;
  };
  for (let oy = 0; oy < Hq; oy++) {
    const sy = oy * q + q / 2;
    const row = oy * Wq;
    if (sy < wallTop) {
      out.fill(tex.sky[Math.max(0, Math.min(255, Math.round((sy / Math.max(1, wallTop)) * 255)))], row, row + Wq);
      continue;
    }
    if (sy < wallBase) {
      // the fans: across by the wall's scale, up by the row
      const hgt = ((wallBase - sy) / Math.max(1, wallBase - wallTop)) * WALL_H;
      const wy = Math.max(0, Math.min(Math.round(WALL_H * WK) - 1, Math.floor((WALL_H - hgt) * WK)));
      const step = wallZ / f;
      span(row, tex.wall, wy * tex.wallW, tex.wallW, (cx + (q / 2 - W / 2) * step) * WK + tex.wallW * 64, step * q * WK, true);
      continue;
    }
    const b = (c.hy - sy) / f;
    const den = sn - b * cs;
    if (den <= 1e-4) {
      out.fill(tex.dark, row, row + Wq);
      continue;
    }
    const t = ch / den;
    const gy = cy + t * (cs + b * sn);
    const step = t / f;
    // the nearest level that's still about a texel a pixel
    const want = step * q * tex.lv[0].k;
    const L = tex.lv[want < 1.6 ? 0 : want < 3.2 ? 1 : 2];
    const ty = Math.floor((tex.y0 - gy) * L.k);
    if (ty < 0 || ty >= L.h) {
      out.fill(tex.dark, row, row + Wq);
      continue;
    }
    span(row, L.px, ty * L.w, L.w, (cx + (q / 2 - W / 2) * step - tex.x0) * L.k, step * q * L.k, false);
  }
}

/** The camera's look-down angle at a ground point: steep up close, shallow far away. */
export function pitchAt(c: PCam, y: number): number {
  return Math.atan2(c.ch, Math.max(1, y - c.cy));
}

export { FIELD_W };
