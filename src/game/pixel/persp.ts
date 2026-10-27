// A camera with perspective for the football field held upright: from behind the offense and up in
// the stands, the way a broadcast shows a play. Near players are big, the far field narrows toward
// the stands, and the whole width fits by the time the receivers are downfield. The grass is drawn
// a row at a time from a top-down picture of the field (like the old consoles' "mode 7"), and the
// far stands are a wall of fans past the end zone.
import { mix, type RGB, rgb } from './color';
import { drawField, FIELD_W, type FieldCam, type FieldTheme } from './field';
import { noise } from './pixbuf';

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

/** The far wall of stands, past the far end zone */
export const WALL_Y = 117;
const WALL_H = 28;

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
  wall: Uint32Array;
  wallW: number;
  sky: Uint32Array;
}

const pack = (c: RGB) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];

/** The field as seen from straight above, at 8 pixels a yard, and two smaller copies for the distance. */
export function fieldTexture(theme: FieldTheme): FieldTex {
  const k = 8;
  const top: FieldCam = { mode: 'end', W: 0, H: 0, k, pitch: Math.PI / 2, fx: 0, fy: 0, ax: 0, ay: 0 };
  const { canvas, cam } = drawField(top, theme, { crowd: false });
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const base = new Uint32Array(img.data.buffer.slice(0));
  // field (x, y) -> texel: col = (x - cam.fx) k + cam.ax, row = cam.ay - (y - cam.fy) k
  const x0 = cam.fx - cam.ax / k;
  const y0 = cam.fy + cam.ay / k;
  const lv = [{ px: base, w: canvas.width, h: canvas.height, k }];
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
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const v = a.px[(y * 2 + dy) * a.w + x * 2 + dx];
          r += v & 255;
          g += (v >> 8) & 255;
          b += (v >> 16) & 255;
        }
        px[y * w + x] = (255 << 24) | ((b >> 2) << 16) | ((g >> 2) << 8) | (r >> 2);
      }
    lv.push({ px, w, h, k: a.k / 2 });
  }
  // the stands: a padded wall, an LED ribbon, the lower bowl, a facade, the upper deck and the
  // roof's edge with its lights; four texels a yard
  const wallW = 512;
  const wallH = WALL_H * 4;
  const wall = new Uint32Array(wallW * wallH);
  const home = rgb(theme.homeC1);
  const away = rgb(theme.awayC1);
  const trim = rgb(theme.awayC2);
  const darkC: RGB = [14, 18, 26];
  const shirts: RGB[] = [home, away, away, [230, 230, 230], [44, 48, 66], mix(away, [255, 255, 255], 0.3), trim];
  for (let y = 0; y < wallH; y++) {
    const yd = WALL_H - y / 4;
    for (let x = 0; x < wallW; x++) {
      let c: RGB;
      if (yd < 1) c = mix(away, darkC, 0.45);
      else if (yd < 1.75) c = Math.floor(x / 24) % 2 ? mix(away, [255, 255, 255], 0.15) : trim;
      else if (yd >= 10 && yd < 11.5) c = yd < 10.5 ? [30, 34, 46] : Math.floor(x / 40) % 3 === 0 ? mix(trim, [255, 255, 255], 0.3) : mix(away, darkC, 0.2);
      else if (yd >= 25.5) c = yd < 26.25 && x % 32 < 5 ? [255, 250, 220] : [22, 25, 34];
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
        c = mix(c, darkC, yd > 11.5 ? 0.25 + ((yd - 11.5) / 14) * 0.35 : 0.08);
      }
      wall[y * wallW + x] = pack(c);
    }
  }
  // the sky over the stadium: night, with a glow from the lights
  const sky = new Uint32Array(256);
  for (let i = 0; i < 256; i++) sky[i] = pack(mix([10, 14, 30], [44, 54, 92], Math.pow(i / 255, 1.6)));
  return { lv, x0, y0, dark: pack([18, 30, 20]), wall, wallW, sky };
}

/**
 * Draw the ground, the far wall and the sky into `out` (W x H pixels), a row at a time. Returns the
 * row where the wall's top meets the sky, for lights and such.
 */
export function drawFloor(c: PCam, tex: FieldTex, out: Uint32Array) {
  const { W, H, f, ch, cx, cy } = c;
  const cs = Math.cos(c.pitch);
  const sn = Math.sin(c.pitch);
  const wallBase = project(c, cx, WALL_Y, 0).y;
  const wallTop = project(c, cx, WALL_Y, WALL_H).y;
  const wallZ = Math.max(0.5, (WALL_Y - cy) * cs + ch * sn);
  for (let sy = 0; sy < H; sy++) {
    const row = sy * W;
    if (sy < wallTop) {
      const v = tex.sky[Math.max(0, Math.min(255, Math.round((sy / Math.max(1, wallTop)) * 255)))];
      out.fill(v, row, row + W);
      continue;
    }
    if (sy < wallBase) {
      // the fans: across by the wall's scale, up by the row
      const hgt = ((wallBase - sy) / Math.max(1, wallBase - wallTop)) * WALL_H;
      const wy = Math.max(0, Math.min(WALL_H * 4 - 1, Math.floor((WALL_H - hgt) * 4)));
      const step = wallZ / f;
      for (let sx = 0; sx < W; sx++) {
        const gx = cx + (sx - W / 2) * step;
        const wx = ((Math.floor(gx * 4) % tex.wallW) + tex.wallW) % tex.wallW;
        out[row + sx] = tex.wall[wy * tex.wallW + wx];
      }
      continue;
    }
    const b = (c.hy - sy) / f;
    const den = sn - b * cs;
    if (den <= 1e-4) {
      out.fill(tex.dark, row, row + W);
      continue;
    }
    const t = ch / den;
    const gy = cy + t * (cs + b * sn);
    const step = t / f;
    // the nearest level that's still at least a texel a pixel
    const want = step * 8;
    const L = tex.lv[want < 1.6 ? 0 : want < 3.2 ? 1 : 2];
    const ty = Math.floor((tex.y0 - gy) * L.k);
    if (ty < 0 || ty >= L.h) {
      out.fill(tex.dark, row, row + W);
      continue;
    }
    const tRow = ty * L.w;
    let gx = cx - (W / 2) * step;
    for (let sx = 0; sx < W; sx++, gx += step) {
      const tx = Math.floor((gx - tex.x0) * L.k);
      out[row + sx] = tx < 0 || tx >= L.w ? tex.dark : L.px[tRow + tx];
    }
  }
}

/** The camera's look-down angle at a ground point: steep up close, shallow far away. */
export function pitchAt(c: PCam, y: number): number {
  return Math.atan2(c.ch, Math.max(1, y - c.cy));
}

export { FIELD_W };
