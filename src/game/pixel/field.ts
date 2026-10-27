// The football field in pixel art, two cameras like the court:
//   side: sideways, the field running left to right (your offense attacks right), a high look from
//         the near sideline that follows the ball both ways
//   end:  upright, from behind your offense looking up the field, following the ball
// Field yards: x across (0 near sideline .. 53.3), y the yard line from your goal (end zones -10..0
// and 100..110), h up.
import { mix, type RGB, rgb } from './color';
import { textWidth, text } from './court';
import { noise, PixBuf } from './pixbuf';

export const FIELD_W = 53.33;

export interface FieldCam {
  mode: 'side' | 'end';
  W: number;
  H: number;
  /** game pixels per yard */
  k: number;
  pitch: number;
  /** the field point at the screen's anchor (the camera follows it) */
  fx: number;
  fy: number;
  /** where on screen that point sits */
  ax: number;
  ay: number;
}

export function fieldAt(c: FieldCam, x: number, y: number, h = 0): { x: number; y: number } {
  const sp = Math.sin(c.pitch);
  const cp = Math.cos(c.pitch);
  if (c.mode === 'side') return { x: c.ax + (y - c.fy) * c.k, y: c.ay + (c.fx - x) * c.k * sp - h * c.k * cp };
  return { x: c.ax + (x - c.fx) * c.k, y: c.ay + (c.fy - y) * c.k * sp - h * c.k * cp };
}

export function fieldFloor(c: FieldCam, sx: number, sy: number): { x: number; y: number } {
  const sp = Math.sin(c.pitch);
  if (c.mode === 'side') return { y: (sx - c.ax) / c.k + c.fy, x: c.fx - (sy - c.ay) / (c.k * sp) };
  return { x: (sx - c.ax) / c.k + c.fx, y: c.fy - (sy - c.ay) / (c.k * sp) };
}

/** the rig's facing angle for a body moving (dx across, dy up the field) */
export function fieldFacing(c: FieldCam, dx: number, dy: number): number {
  // side: up the field is screen-right, across toward 0 (near) is toward the viewer
  return c.mode === 'side' ? Math.atan2(-dx, dy) : Math.atan2(-dy, dx);
}

/** bigger is nearer the viewer */
export function fieldNear(c: FieldCam, x: number, y: number): number {
  return c.mode === 'side' ? -x : -y;
}

/** A camera for the screen, following a field point. */
export function fieldCam(W: number, H: number, fx: number, fy: number): FieldCam {
  if (W > H) {
    const k = Math.max(10, Math.min(16, W / 56));
    return { mode: 'side', W, H, k, pitch: 0.45, fx, fy, ax: Math.round(W * 0.36), ay: Math.round(H * 0.6) };
  }
  const k = W / 30;
  return { mode: 'end', W, H, k, pitch: 0.72, fx, fy, ax: Math.round(W / 2), ay: Math.round(H * 0.66) };
}

export interface FieldTheme {
  /** your end zone (bottom/left) and theirs (top/right) */
  homeC1: string;
  homeC2: string;
  homeName: string;
  awayC1: string;
  awayC2: string;
  awayName: string;
}

const GRASS: RGB[] = [
  [62, 138, 58],
  [70, 150, 64],
];

/**
 * The whole field drawn once, from the near side to the far stands, on its own camera fixed at the
 * field's middle: the game blits the part the camera shows.
 */
export function drawField(c: FieldCam, theme: FieldTheme, opts: { crowd?: boolean } = {}): { canvas: HTMLCanvasElement; cam: FieldCam } {
  const side = c.mode === 'side';
  // a canvas covering the whole field and its surroundings, at the same scale
  const spanY = 130; // -15 .. 115
  const spanX = 53.33 + 16; // -8 .. 61
  const sp = Math.sin(c.pitch);
  const Wc = Math.ceil(side ? spanY * c.k : spanX * c.k);
  const Hc = Math.ceil(side ? spanX * c.k * sp + c.k * 9 : spanY * c.k * sp + c.k * 9);
  const cam: FieldCam = side
    ? { ...c, W: Wc, H: Hc, fx: 0, fy: -15, ax: 0, ay: Math.round(Hc - 8 * c.k * sp) }
    : { ...c, W: Wc, H: Hc, fx: -8, fy: -15, ax: 0, ay: Math.round(Hc - 2) };
  const buf = new PixBuf(Wc, Hc);
  const home = rgb(theme.homeC1);
  const away = rgb(theme.awayC1);
  const dark: RGB = [16, 22, 18];
  buf.fill(PixBuf.pack(dark));
  for (let sy = 0; sy < Hc; sy++)
    for (let sx = 0; sx < Wc; sx++) {
      const f = fieldFloor(cam, sx + 0.5, sy + 0.5);
      const { x, y } = f;
      let col: RGB;
      if (x < -6 || x > FIELD_W + 6 || y < -12 || y > 112) col = mix([40, 82, 40], dark, 0.35);
      else if (x < -1.2 || x > FIELD_W + 1.2 || y < -10 || y > 110) col = [52, 104, 50];
      else if (x < 0 || x > FIELD_W) col = [246, 246, 240];
      else if (y < 0) col = mix(home, [0, 0, 0], 0.08);
      else if (y > 100) col = mix(away, [0, 0, 0], 0.08);
      else {
        // mowed in five-yard stripes, with a little texture
        const stripe = Math.floor(y / 5) % 2;
        const n = noise(Math.floor(x * 3), Math.floor(y * 3), 3) * 0.06 - 0.03;
        col = mix(GRASS[stripe], n > 0 ? [180, 220, 140] : [20, 50, 20], Math.abs(n));
      }
      buf.set(sx, sy, PixBuf.pack(col));
    }
  const white = PixBuf.pack([248, 248, 240]);
  const seg = (x0: number, y0: number, x1: number, y1: number, col = white) => {
    const a = fieldAt(cam, x0, y0);
    const b = fieldAt(cam, x1, y1);
    buf.line(a.x, a.y, b.x, b.y, col);
  };
  // yard lines every five, the goal lines thicker
  for (let y = 0; y <= 100; y += 5) {
    seg(0, y, FIELD_W, y);
    if (y === 0 || y === 100) seg(0, y + (y === 0 ? -0.15 : 0.15), FIELD_W, y + (y === 0 ? -0.15 : 0.15));
  }
  // hash marks every yard, and along the sidelines
  for (let y = 1; y < 100; y++) {
    if (y % 5 === 0) continue;
    for (const hx of [1, 23.58, 29.75, FIELD_W - 1]) seg(hx - 0.35, y, hx + 0.35, y);
  }
  // the yard numbers, near both sidelines
  const nScale = Math.max(1, Math.round(c.k * 0.32));
  for (let y = 10; y <= 90; y += 10) {
    const label = String(y <= 50 ? y : 100 - y);
    for (const nx of [9, FIELD_W - 9]) {
      const at = fieldAt(cam, nx, y);
      const w = textWidth(label, nScale);
      text(buf, label, Math.round(at.x - w / 2), Math.round(at.y - (7 * nScale * (side ? sp : sp)) / 2), nScale, white, sp);
    }
  }
  // the end zones: each team's name across its own
  const ezScale = Math.max(2, Math.round(c.k * 0.62));
  const ez = (y: number, name: string, c2: string) => {
    const at = fieldAt(cam, FIELD_W / 2, y);
    const label = name.toUpperCase().slice(0, 12);
    const w = textWidth(label, ezScale);
    text(buf, label, Math.round(at.x - w / 2), Math.round(at.y - (7 * ezScale * sp) / 2), ezScale, PixBuf.pack(rgb(c2)), sp);
  };
  ez(-5, theme.homeName, theme.homeC2);
  ez(105, theme.awayName, theme.awayC2);
  // the stands beyond the far sideline (side) or beyond the far end zone (end)
  const crowdBand = (x0: number, y0: number, w: number, h: number) => {
    const fanW = Math.max(3, Math.round(c.k * 0.32));
    const fanH = Math.round(fanW * 1.5);
    const shirts: RGB[] = [home, away, [235, 235, 235], [40, 44, 60], mix(home, [255, 255, 255], 0.3)];
    for (let row = 0, y = y0 + h - fanH; y > y0 - fanH; row++, y -= fanH - 1)
      for (let i = 0, x = x0 + (row % 2) * 2; x < x0 + w; i++, x += fanW + 1) {
        const n = noise(i, row, 9);
        if (n < 0.06) continue;
        const dim = Math.min(0.45, row * 0.04);
        buf.rect(x, y + Math.round(fanH * 0.4), fanW, fanH - Math.round(fanH * 0.4), PixBuf.pack(mix(shirts[Math.floor(noise(i, row, 2) * shirts.length)], dark, dim)));
        buf.rect(x + 1, y, Math.max(1, fanW - 2), Math.round(fanH * 0.4), PixBuf.pack(mix([196, 150, 112], dark, dim + noise(i, row, 4) * 0.3)));
      }
  };
  if (opts.crowd === false) {
    // no stands (a texture for the perspective camera)
  } else if (side) {
    const top = fieldAt(cam, FIELD_W + 6, 0).y;
    crowdBand(0, 0, Wc, Math.max(0, Math.round(top)));
  } else {
    const top = fieldAt(cam, 0, 112).y;
    crowdBand(0, 0, Wc, Math.max(0, Math.round(top)));
  }
  const canvas = document.createElement('canvas');
  canvas.width = Wc;
  canvas.height = Hc;
  buf.put(canvas.getContext('2d')!);
  return { canvas, cam };
}

/** The goal posts at the back of an end zone (y 110 or -10): yellow, a crossbar at 10 ft. */
export function drawPosts(ctx: CanvasRenderingContext2D, c: FieldCam, y: number) {
  const yellow = '#f7d21d';
  const shade = '#b8960e';
  const base = fieldAt(c, FIELD_W / 2, y);
  const bar = fieldAt(c, FIELD_W / 2, y, 3.33);
  const px = Math.max(1, Math.round(c.k * 0.16));
  ctx.fillStyle = shade;
  ctx.fillRect(Math.round(base.x - px / 2), Math.round(bar.y), px, Math.round(base.y - bar.y));
  const left = fieldAt(c, FIELD_W / 2 - 3.08, y, 3.33);
  const right = fieldAt(c, FIELD_W / 2 + 3.08, y, 3.33);
  ctx.fillStyle = yellow;
  if (c.mode === 'end') {
    ctx.fillRect(Math.round(left.x), Math.round(bar.y), Math.round(right.x - left.x), px);
    for (const p of [left, right]) {
      const top = fieldAt(c, p === left ? FIELD_W / 2 - 3.08 : FIELD_W / 2 + 3.08, y, 11);
      ctx.fillRect(Math.round(p.x - px / 2), Math.round(top.y), px, Math.round(p.y - top.y));
    }
  } else {
    // seen from the side the crossbar runs into the screen
    ctx.beginPath();
    ctx.strokeStyle = yellow;
    ctx.lineWidth = px;
    ctx.moveTo(Math.round(left.x), Math.round(left.y));
    ctx.lineTo(Math.round(right.x), Math.round(right.y));
    ctx.stroke();
    for (const [p, fx] of [
      [left, FIELD_W / 2 - 3.08],
      [right, FIELD_W / 2 + 3.08],
    ] as const) {
      const top = fieldAt(c, fx, y, 11);
      ctx.fillRect(Math.round(p.x - px / 2), Math.round(top.y), px, Math.round(p.y - top.y));
    }
  }
}
