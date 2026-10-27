// The basketball court in pixel art. Two cameras, one per way the phone is held:
//   side: sideways, from the near sideline like Hoop Land, the hoop on the right
//   end:  upright, from behind the offense looking up the floor, the hoop at the top
// Court feet: cx along the court (0 midcourt, 47 the baseline under the hoop), cz across it
// (-25 to 25), h up from the floor. Everything is plotted pixel by pixel (pixbuf.ts).
import { mix, type RGB, rgb } from './color';
import { noise, PixBuf } from './pixbuf';

export const RIM = { cx: 41.75, cz: 0, h: 10 };
export const COURT_LEN = 47;

export interface CourtCam {
  mode: 'side' | 'end';
  /** the game screen, in game pixels */
  W: number;
  H: number;
  /** game pixels per foot */
  k: number;
  pitch: number;
  /** side: court cx at the left edge. end: court cx at the floor's top edge */
  cam: number;
  /** side: where the far sideline (cz -25) sits. end: the screen x of cz 0 */
  origin: number;
  /** end: the y of `cam` on screen */
  top: number;
}

/** A court point on screen. */
export function at(c: CourtCam, cx: number, cz: number, h = 0): { x: number; y: number } {
  const sp = Math.sin(c.pitch);
  const cp = Math.cos(c.pitch);
  if (c.mode === 'side') return { x: (cx - c.cam) * c.k, y: c.origin + (cz + 25) * c.k * sp - h * c.k * cp };
  return { x: c.origin + cz * c.k, y: c.top + (c.cam - cx) * c.k * sp - h * c.k * cp };
}

/** The court point under a screen pixel (on the floor). */
export function floorAt(c: CourtCam, x: number, y: number): { cx: number; cz: number } {
  const sp = Math.sin(c.pitch);
  if (c.mode === 'side') return { cx: x / c.k + c.cam, cz: (y - c.origin) / (c.k * sp) - 25 };
  return { cx: c.cam - (y - c.top) / (c.k * sp), cz: (x - c.origin) / c.k };
}

/** The way a player faces on screen (the rig's angle) when he faces along (dcx, dcz) on the court. */
export function facingOn(c: CourtCam, dcx: number, dcz: number): number {
  return c.mode === 'side' ? Math.atan2(dcz, dcx) : Math.atan2(-dcx, dcz);
}

/** Depth for drawing order: bigger is nearer the viewer. */
export function nearness(c: CourtCam, cx: number, cz: number): number {
  return c.mode === 'side' ? cz : -cx;
}

/**
 * The camera for a screen. Sideways shows the whole half court; upright looks up the floor at the
 * hoop, zoomed in and panning across with the ball (`focusCz`).
 */
export function courtCam(W: number, H: number, focusCx = 30, focusCz = 0): CourtCam {
  if (W > H) {
    // sideways: a high three-quarter look, the near sideline running under the controls
    const k = W / 51;
    const pitch = 0.46;
    const floorH = 50 * k * Math.sin(pitch);
    return { mode: 'side', W, H, k, pitch, cam: 3, origin: Math.round(Math.max(H * 0.2, H - floorH + k * 2.5)), top: 0 };
  }
  void focusCx;
  // upright: looking up the floor, zoomed in on the half court, panning across with the ball
  const k = W / 27;
  const pitch = 0.8;
  const pan = Math.max(-7, Math.min(7, focusCz * 0.6));
  return { mode: 'end', W, H, k, pitch, cam: COURT_LEN, origin: Math.round(W / 2 - pan * k), top: Math.round(H * 0.25) };
}

export interface CourtTheme {
  /** the paint and the apron */
  c1: string;
  c2: string;
  abbr: string;
}

const WOOD: RGB[] = [
  [214, 160, 102],
  [205, 150, 93],
  [222, 170, 112],
  [199, 143, 88],
];

const FONT: Record<string, string> = {
  A: '01110100011000111111100011000110001',
  B: '11110100011000111110100011000111110',
  C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111',
  F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111',
  H: '10001100011000111111100011000110001',
  I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100',
  K: '10001100101010011000101001001010001',
  L: '10000100001000010000100001000011111',
  M: '10001110111010110001100011000110001',
  N: '10001110011010110011100011000110001',
  O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101',
  R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110',
  T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100',
  W: '10001100011000110101101011010101010',
  X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100',
  Z: '11111000010001000100010001000011111',
  '0': '01110100011001110101110011000101110',
  '1': '00100011000010000100001000010001110',
  '2': '01110100010000100010001000100011111',
  '3': '11111000100010000010000011000101110',
  '4': '00010001100101010010111110001000010',
  '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110',
  '7': '11111000010001000100010000100001000',
  '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100',
  ' ': '00000000000000000000000000000000000',
  '-': '00000000000000011111000000000000000',
  '!': '00100001000010000100001000000000100',
  '.': '00000000000000000000000000000000100',
  '+': '00000001000010011111001000010000000',
};

/** Pixel text (5x7), scaled; `syk` squeezes it vertically (for letters lying on the floor). */
export function text(buf: PixBuf, s: string, x: number, y: number, scale: number, c: number, syk = 1) {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const g = FONT[up[i]] ?? FONT[' '];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++) {
        if (g[r * 5 + col] !== '1') continue;
        buf.rect(x + (i * 6 + col) * scale, y + r * scale * syk, scale, Math.max(1, Math.ceil(scale * syk)), c);
      }
  }
}

export function textWidth(s: string, scale: number): number {
  return (s.length * 6 - 1) * scale;
}

/**
 * The court and the arena around it, drawn whole. `crowd` (0-1) gets the fans on their feet; `t`
 * moves the scoreboard ticker and the crowd.
 */
export function drawCourt(buf: PixBuf, c: CourtCam, theme: CourtTheme, crowd = 0, t = 0, stands = true) {
  const c1 = rgb(theme.c1);
  const c2 = rgb(theme.c2);
  const sp = Math.sin(c.pitch);
  const dark: RGB = [14, 18, 30];
  // where the stands end: behind the far sideline (side) or the baseline (end)
  const wallY = wallOf(c);
  if (stands) {
    buf.fill(PixBuf.pack(dark));
    drawCrowd(buf, c, wallY, c1, c2, crowd, t);
  }
  // the floor: each pixel finds its spot on the court
  const apron = mix(c1, [0, 0, 0], 0.18);
  const outer = mix(c1, [0, 0, 0], 0.5);
  const paint = mix(c1, [0, 0, 0], 0.08);
  for (let y = wallY; y < c.H; y++) {
    for (let x = 0; x < c.W; x++) {
      const { cx, cz } = floorAt(c, x + 0.5, y + 0.5);
      const acz = Math.abs(cz);
      let col: RGB;
      if (cx > COURT_LEN + 6 || acz > 29 || cx < -COURT_LEN - 6) col = outer;
      else if (cx > COURT_LEN || acz > 25 || cx < -COURT_LEN) col = apron;
      else if (cx > COURT_LEN - 19 && acz < 8) col = paint;
      else {
        // planks run the length of the court, about 4 inches wide here so they read
        const band = Math.floor((cz + 30) * 3);
        const base = WOOD[((band % 4) + 4) % 4];
        const seg = Math.floor((cx + 20 + band * 1.7) / 6);
        const seam = noise(band, seg) < 0.5 && Math.abs(((cx + 20 + band * 1.7) % 6) - 0) < 0.12;
        const grain = noise(Math.floor(cx * 2), band, 11) * 0.07 - 0.035;
        col = seam ? mix(base, [80, 45, 20], 0.32) : mix(base, grain > 0 ? [255, 230, 190] : [90, 50, 20], Math.abs(grain));
      }
      buf.set(x, y, PixBuf.pack(col));
    }
  }
  if (stands) drawBoard(buf, c, theme, wallY, t);
  // the midcourt logo: the home team's letters lying on the floor
  const mid = at(c, 0, 0);
  const logoScale = Math.max(2, Math.round(c.k * 0.8));
  buf.fillEllipse(mid.x, mid.y, c.k * 6, c.k * 6 * sp, PixBuf.pack(mix(c1, [0, 0, 0], 0.06)));
  const lw = textWidth(theme.abbr, logoScale);
  text(buf, theme.abbr, Math.round(mid.x - lw / 2), Math.round(mid.y - (7 * logoScale * sp) / 2), logoScale, PixBuf.pack(c2), sp);
  // the lines
  const white = PixBuf.pack([246, 242, 232]);
  const seg = (a: [number, number], b: [number, number]) => {
    const p = at(c, a[0], a[1]);
    const q = at(c, b[0], b[1]);
    buf.line(p.x, p.y, q.x, q.y, white);
  };
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number) => {
    const n = Math.max(24, Math.round(r * 6));
    let prev: [number, number] | null = null;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const p: [number, number] = [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
      if (prev) seg(prev, p);
      prev = p;
    }
  };
  seg([-6, -25], [COURT_LEN, -25]);
  seg([-6, 25], [COURT_LEN, 25]);
  seg([COURT_LEN, -25], [COURT_LEN, 25]);
  seg([0, -25], [0, 25]);
  seg([COURT_LEN - 19, -8], [COURT_LEN, -8]);
  seg([COURT_LEN - 19, 8], [COURT_LEN, 8]);
  seg([COURT_LEN - 19, -8], [COURT_LEN - 19, 8]);
  arc(COURT_LEN - 19, 0, 6, Math.PI / 2, (3 * Math.PI) / 2);
  arc(0, 0, 6, -Math.PI / 2, Math.PI / 2);
  // the three-point line: straight in the corners (22 ft), then an arc of 23.75 ft
  const arcAt = Math.asin(22 / 23.75);
  const cornerX = RIM.cx - Math.cos(arcAt) * 23.75;
  seg([cornerX, -22], [COURT_LEN, -22]);
  seg([cornerX, 22], [COURT_LEN, 22]);
  arc(RIM.cx, 0, 23.75, Math.PI - arcAt, Math.PI + arcAt);
  arc(RIM.cx, 0, 4, Math.PI / 2, (3 * Math.PI) / 2);
  // the lane's block marks
  for (const d of [7, 8, 11, 14]) {
    seg([COURT_LEN - d, -8], [COURT_LEN - d, -8.7]);
    seg([COURT_LEN - d, 8], [COURT_LEN - d, 8.7]);
  }
  // the sheen: arena lights gleaming off the varnish in long soft streaks
  for (let i = 0; i < 4; i++) {
    const cxl = 4 + i * 12;
    for (let y = wallY; y < c.H; y++)
      for (let x = 0; x < c.W; x++) {
        const f = floorAt(c, x + 0.5, y + 0.5);
        if (f.cx > COURT_LEN || Math.abs(f.cz) > 25) continue;
        const along = c.mode === 'side' ? f.cx - (cxl + (f.cz + 25) * 0.18) : f.cz - (cxl - 24 + (f.cx - 20) * 0.18);
        const a = 0.08 * Math.max(0, 1 - Math.abs(along) / 2.4);
        if (a > 0) buf.tint(x, y, [255, 246, 220], a);
      }
  }
}

function drawCrowd(buf: PixBuf, c: CourtCam, wallY: number, c1: RGB, c2: RGB, crowd: number, t: number) {
  const fanW = Math.max(4, Math.round(c.k * 0.62));
  const fanH = Math.round(fanW * 1.5);
  const shirts: RGB[] = [c1, c1, c1, c2, [235, 235, 235], [40, 44, 60], mix(c1, [255, 255, 255], 0.3), [30, 70, 120], [60, 60, 66]];
  const skins: RGB[] = [
    [233, 196, 160],
    [198, 145, 105],
    [168, 113, 79],
    [120, 80, 55],
    [88, 58, 40],
  ];
  const dark: RGB = [14, 18, 30];
  const rows = Math.max(1, Math.ceil((wallY - c.k * 1.2) / (fanH - 1)));
  for (let row = 0, y = wallY - fanH - Math.round(c.k * 1.2); y > -fanH; row++, y -= fanH - 1) {
    const dim = Math.min(0.5, (row / rows) * 0.55);
    for (let i = -1, x = (row % 2) * (fanW >> 1) - fanW; x < c.W + fanW; i++, x += fanW + 1) {
      const n = noise(i, row, 7);
      if (n < 0.07) continue;
      const shirt = mix(shirts[Math.floor(noise(i, row, 3) * shirts.length)], dark, dim);
      const skin = mix(skins[Math.floor(noise(i, row, 5) * skins.length)], dark, dim);
      const jump = crowd > 0 ? Math.round(Math.max(0, Math.sin(t * 13 + n * 9)) * crowd * 2.4) : Math.round(Math.max(0, Math.sin(t * 2 + n * 30) - 0.96) * 30);
      const yy = y - jump;
      const head = Math.round(fanH * 0.42);
      buf.rect(x, yy + head, fanW, fanH - head, PixBuf.pack(shirt));
      const hw = Math.max(2, Math.round(fanW * 0.55));
      buf.rect(x + Math.round((fanW - hw) / 2), yy, hw, head, PixBuf.pack(skin));
      if (jump > 1 && n > 0.45) {
        buf.rect(x - 1, yy - 2, 1, Math.round(fanH * 0.55), PixBuf.pack(skin));
        buf.rect(x + fanW, yy - 2, 1, Math.round(fanH * 0.55), PixBuf.pack(skin));
      }
    }
  }
}

/** Where the stands meet the floor. */
export function wallOf(c: CourtCam): number {
  return Math.round(c.mode === 'side' ? at(c, 0, -28).y : at(c, COURT_LEN + 7, 0).y);
}

/** The courtside board: a lit strip in the home color with a scrolling ticker. */
export function drawBoard(buf: PixBuf, c: CourtCam, theme: CourtTheme, wallY: number, t: number) {
  const c1 = rgb(theme.c1);
  const c2 = rgb(theme.c2);
  const boardH = Math.max(5, Math.round(c.k * (c.mode === 'side' ? 1.1 : 1.3)));
  buf.rect(0, wallY - boardH, c.W, boardH, PixBuf.pack(mix(c1, [0, 0, 0], 0.25)));
  buf.rect(0, wallY - boardH, c.W, 1, PixBuf.pack(mix(c1, [255, 255, 255], 0.45)));
  buf.rect(0, wallY - 1, c.W, 1, PixBuf.pack(mix(c1, [0, 0, 0], 0.55)));
  const unit = ' ' + theme.abbr + ' + PERFECT SEASON +';
  const scale = Math.max(1, Math.floor((boardH - 2) / 7));
  const shift = Math.round((t * 20) % textWidth(unit, scale));
  text(buf, unit.repeat(8), -shift, wallY - boardH + Math.max(1, Math.floor((boardH - 7 * scale) / 2)), scale, PixBuf.pack(mix(c2, [255, 255, 255], 0.35)));
}

/** The stands and the board alone (redrawn every frame: the ticker scrolls, the crowd jumps). */
export function drawStands(buf: PixBuf, c: CourtCam, theme: CourtTheme, crowd: number, t: number) {
  const wallY = wallOf(c);
  buf.rect(0, 0, c.W, wallY, PixBuf.pack([14, 18, 30]));
  drawCrowd(buf, c, wallY, rgb(theme.c1), rgb(theme.c2), crowd, t);
  drawBoard(buf, c, theme, wallY, t);
}

/** The hoop behind the play: stanchion, backboard and the back of the rim. */
export function drawHoopBack(buf: PixBuf, c: CourtCam, theme: CourtTheme) {
  const c1 = rgb(theme.c1);
  const pad = PixBuf.pack(mix(c1, [0, 0, 0], 0.25));
  const padLight = PixBuf.pack(mix(c1, [255, 255, 255], 0.2));
  const pole = PixBuf.pack([58, 62, 74]);
  const poleLight = PixBuf.pack([96, 102, 118]);
  const glassC = PixBuf.pack([196, 222, 236]);
  const frame = PixBuf.pack([246, 246, 246]);
  const red = PixBuf.pack([214, 40, 40]);
  if (c.mode === 'side') {
    const base = at(c, COURT_LEN + 4, 0);
    const k = c.k;
    buf.rect(base.x - k * 1.2, at(c, COURT_LEN + 4, 0, 4).y, k * 2.4, base.y - at(c, COURT_LEN + 4, 0, 4).y, pad);
    buf.rect(base.x - k * 1.2, at(c, COURT_LEN + 4, 0, 4).y, k * 2.4, 1, padLight);
    const poleTop = at(c, COURT_LEN + 4, 0, 12.6);
    buf.rect(base.x - k * 0.3, poleTop.y, k * 0.6, at(c, COURT_LEN + 4, 0, 4).y - poleTop.y, pole);
    buf.rect(at(c, 43.3, 0).x, poleTop.y, base.x - at(c, 43.3, 0).x, k * 0.5, pole);
    // the board, turned a little toward us so the glass reads
    const skew = k * 0.32;
    const sp = Math.sin(c.pitch);
    const bx = at(c, 43, 0).x;
    const corner = (fx: number, h: number) => ({ x: bx + skew * fx, y: at(c, 43, 0, h).y + fx * k * sp });
    const g = [corner(-3, 13.5), corner(3, 13.5), corner(3, 10), corner(-3, 10)];
    buf.poly(g, glassC);
    for (let i = 0; i < 4; i++) buf.line(g[i].x, g[i].y, g[(i + 1) % 4].x, g[(i + 1) % 4].y, frame);
    const s = [corner(-1, 11.5), corner(1, 11.5), corner(1, 10.2), corner(-1, 10.2)];
    for (let i = 0; i < 4; i++) buf.line(s[i].x, s[i].y, s[(i + 1) % 4].x, s[(i + 1) % 4].y, red);
  } else {
    // upright: the board faces us, the stanchion stands behind it
    const k = c.k;
    const base = at(c, COURT_LEN + 4, 0);
    const poleTop = at(c, COURT_LEN + 4, 0, 13);
    buf.rect(base.x - k * 2.2, at(c, COURT_LEN + 4, 0, 3.5).y, k * 4.4, base.y - at(c, COURT_LEN + 4, 0, 3.5).y, pad);
    buf.rect(base.x - k * 2.2, at(c, COURT_LEN + 4, 0, 3.5).y, k * 4.4, 1, padLight);
    buf.rect(base.x - k * 0.35, poleTop.y, k * 0.7, at(c, COURT_LEN + 4, 0, 3.5).y - poleTop.y, pole);
    buf.rect(base.x - k * 0.35, poleTop.y, 1, at(c, COURT_LEN + 4, 0, 3.5).y - poleTop.y, poleLight);
    const tl = at(c, 43, -3, 13.5);
    const br = at(c, 43, 3, 10);
    buf.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y, glassC);
    // glass glint
    for (let i = 0; i < (br.y - tl.y) * 0.8; i++) buf.set(tl.x + 2 + i * 0.6, tl.y + 2 + i, PixBuf.pack([235, 246, 252]));
    buf.line(tl.x, tl.y, br.x, tl.y, frame);
    buf.line(br.x, tl.y, br.x, br.y, frame);
    buf.line(br.x, br.y, tl.x, br.y, frame);
    buf.line(tl.x, br.y, tl.x, tl.y, frame);
    const s0 = at(c, 43, -1, 11.5);
    const s1 = at(c, 43, 1, 10.2);
    buf.line(s0.x, s0.y, s1.x, s0.y, red);
    buf.line(s1.x, s0.y, s1.x, s1.y, red);
    buf.line(s0.x, s0.y, s0.x, s1.y, red);
  }
  // the back of the rim
  const r = at(c, RIM.cx, RIM.cz, RIM.h);
  const [rx, ry] = rimRadii(c);
  buf.ellipse(r.x, r.y, rx, ry, PixBuf.pack([186, 66, 18]), 0, Math.PI);
}

function rimRadii(c: CourtCam): [number, number] {
  const r = 0.78 * c.k;
  return [r, r * Math.sin(c.pitch)];
}

/** The front of the rim and the net, over the ball. `swish` (0-1) shakes the net after a make. */
export function drawHoopFront(buf: PixBuf, c: CourtCam, swish: number) {
  const p = at(c, RIM.cx, RIM.cz, RIM.h);
  const [r, rv] = rimRadii(c);
  const net = PixBuf.pack([240, 240, 240]);
  const netShade = PixBuf.pack([190, 196, 206]);
  const len = c.k * 1.6 * Math.cos(c.pitch);
  const strands = 9;
  for (let i = 0; i < strands; i++) {
    const a = Math.PI + (Math.PI * i) / (strands - 1);
    const x0 = p.x + Math.cos(a) * r;
    const y0 = p.y - Math.sin(a) * rv;
    const sway = Math.sin(swish * 22 + i * 1.3) * swish * c.k * 0.35;
    const x1 = p.x + Math.cos(a) * r * 0.42 + sway;
    const y1 = p.y + len * (1 - swish * 0.3);
    buf.line(x0, y0, x1, y1, i % 2 ? netShade : net);
  }
  for (const f of [0.35, 0.7]) buf.line(p.x - r * (1 - f * 0.55), p.y + len * f, p.x + r * (1 - f * 0.55), p.y + len * f, netShade);
  buf.ellipse(p.x, p.y, r, rv, PixBuf.pack([240, 100, 34]), Math.PI, Math.PI * 2);
  buf.ellipse(p.x, p.y + 1, r, rv, PixBuf.pack([160, 54, 16]), Math.PI, Math.PI * 2);
}
