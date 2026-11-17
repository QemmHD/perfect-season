// The soccer pitch in pixel art, for the perspective camera (persp.ts): implemented by Claude
// (Anthropic), 2026-11-01. A top-down picture at 8 texels a metre, mowed in stripes across the
// pitch, with every marking (touchlines, goal lines, the halfway line and centre circle, both
// penalty areas, six-yard boxes, spots, arcs and corner arcs), a strip of grass round it, the
// advertising boards and fans seen from above along the touchlines. Behind the goal you attack,
// the far stand (persp.ts' wall of fans). Pitch metres: x across (0-68), y up (0-105).
import { mix, type RGB, rgb } from './color';
import { freeCanvas } from './body';
import { type FieldTex, levels, skyRamp, standsWall } from './persp';
import { noise, PixBuf } from './pixbuf';

export const PITCH_W = 68;
export const PITCH_L = 105;
/** the far stand, past the goal line you attack (metres) */
export const PITCH_WALL_Y = 111.5;

export interface PitchTheme {
  /** the home side's colors (the stands, the boards) */
  homeC1: string;
  homeC2: string;
  /** the visitors' (a few of their fans) */
  awayC1: string;
}

const GRASS: RGB[] = [
  [54, 132, 56],
  [64, 146, 62],
];

/** The texture's span (metres): wide enough for the boards and fans either side. */
const X0 = -16;
const X1 = 84;
const Y0 = -4;
const Y1 = 116;

/** Is (x, y) on a marking? Lines are drawn 0.22 m wide so they survive the distance. */
function onLine(x: number, y: number): boolean {
  const w = 0.11;
  const near = (v: number, at: number) => Math.abs(v - at) < w;
  const inX = (a: number, b: number) => x >= a - w && x <= b + w;
  const inY = (a: number, b: number) => y >= a - w && y <= b + w;
  // the outline and the halfway line
  if ((near(x, 0) || near(x, PITCH_W)) && inY(0, PITCH_L)) return true;
  if ((near(y, 0) || near(y, PITCH_L) || near(y, PITCH_L / 2)) && inX(0, PITCH_W)) return true;
  const ring = (cx: number, cy: number, r: number) => Math.abs(Math.hypot(x - cx, y - cy) - r) < w;
  const dot = (cx: number, cy: number, r: number) => Math.hypot(x - cx, y - cy) < r;
  if (ring(34, PITCH_L / 2, 9.15) || dot(34, PITCH_L / 2, 0.25)) return true;
  for (const end of [0, 1]) {
    const gy = end ? PITCH_L : 0;
    const s = end ? -1 : 1;
    // penalty area 16.5 deep, 40.32 wide; six-yard box 5.5 by 18.32
    const box = (depth: number, half: number) => {
      const yIn = gy + s * depth;
      const yLo = Math.min(gy, yIn);
      const yHi = Math.max(gy, yIn);
      if (near(y, yIn) && inX(34 - half, 34 + half)) return true;
      if ((near(x, 34 - half) || near(x, 34 + half)) && inY(yLo, yHi)) return true;
      return false;
    };
    if (box(16.5, 20.16) || box(5.5, 9.16)) return true;
    const spot = gy + s * 11;
    if (dot(34, spot, 0.22)) return true;
    // the arc outside the area
    if (ring(34, spot, 9.15) && (end ? y < gy - 16.5 : y > gy + 16.5)) return true;
    for (const cx of [0, PITCH_W]) if (ring(cx, gy, 1) && (cx ? x < cx : x > cx) && (end ? y < gy : y > gy)) return true;
  }
  return false;
}

/** The pitch as seen from straight above, as the perspective camera's floor (and its far stand). */
export function pitchTexture(theme: PitchTheme): FieldTex {
  const k = 8;
  const W = (X1 - X0) * k;
  const H = (Y1 - Y0) * k;
  const buf = new PixBuf(W, H);
  const home = rgb(theme.homeC1);
  const trim = rgb(theme.homeC2);
  const away = rgb(theme.awayC1);
  const dark: RGB = [14, 22, 16];
  const white = PixBuf.pack([246, 248, 240]);
  for (let ty = 0; ty < H; ty++) {
    const y = Y1 - (ty + 0.5) / k;
    for (let tx = 0; tx < W; tx++) {
      const x = X0 + (tx + 0.5) / k;
      let col: RGB;
      const inside = x >= -4 && x <= PITCH_W + 4 && y >= -4 && y <= PITCH_L + 4;
      if (inside) {
        // mowed in stripes across the pitch, a slight check along it, a little texture
        const stripe = ((Math.floor((y + 0.0001) / 5.25) % 2) + 2) % 2;
        const across = ((Math.floor((x + 0.0001) / 8.5) % 2) + 2) % 2;
        const n = noise(Math.floor(x * 3), Math.floor(y * 3), 3) * 0.06 - 0.03;
        col = mix(GRASS[stripe], across ? [80, 160, 70] : [40, 110, 50], 0.05);
        col = mix(col, n > 0 ? [180, 220, 140] : [20, 50, 20], Math.abs(n));
        // the run-off a shade darker, worn in front of the goals
        if (x < 0 || x > PITCH_W || y < 0 || y > PITCH_L) col = mix(col, dark, 0.14);
        if (onLine(x, y)) {
          buf.set(tx, ty, white);
          continue;
        }
      } else if (x > -6 && x < PITCH_W + 6 && y > -6 && y < PITCH_L + 6) {
        // the boards along the touchlines: the home colors in panels with a light strip
        const along = ((Math.floor(y / 3.2) % 2) + 2) % 2;
        col = Math.abs(x - -5) < 0.6 || Math.abs(x - (PITCH_W + 5)) < 0.6 ? (along ? mix(trim, [255, 255, 255], 0.2) : home) : [28, 34, 38];
      } else if (x > -8 && x < PITCH_W + 8 && y > -8 && y < PITCH_L + 8) col = [24, 28, 34];
      else {
        // the fans from above, in rows: shirts mostly home, some away, heads every few texels
        const side = x < 0 ? x + 8 : x - (PITCH_W + 8);
        const row = Math.floor(Math.abs(side) / 0.9);
        const seat = Math.floor(y / 0.55);
        const n = noise(seat, row, x < 0 ? 1 : 2);
        const inRow = Math.abs(side) % 0.9;
        const shirts: RGB[] = [home, home, trim, away, [230, 230, 230], [44, 48, 66]];
        if (inRow < 0.22) col = [20, 22, 30];
        else if (n < 0.08) col = [40, 44, 60];
        else if (Math.floor(y * k) % 4 < 2 && inRow < 0.5) col = mix([200, 156, 118], [74, 46, 30], noise(seat, row, 8) * 0.85);
        else col = mix(shirts[Math.floor(noise(seat, row, 5) * shirts.length)], dark, 0.22 + Math.min(0.4, Math.abs(side) * 0.02));
      }
      buf.set(tx, ty, PixBuf.pack(col));
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  buf.put(canvas.getContext('2d')!);
  const { wall, wallW } = standsWall(16, 5, { pad: 0.9, ribbon: 1.8, facade: 7, facadeH: 1.1, roof: 14.6 }, { home, away: home, trim });
  const lv = levels(canvas, k);
  freeCanvas(canvas);
  return { lv, x0: X0, y0: Y1, dark: (255 << 24) | (dark[2] << 16) | (dark[1] << 8) | dark[0], wallY: PITCH_WALL_Y, wallH: 16, wallK: 5, wall, wallW, sky: skyRamp() };
}
