// A player drawn as pixel art: his skeleton in a pose (rig.ts), filled in limb by limb into a small
// pixel grid with a depth test (so the near arm passes in front of the chest and the far one behind
// it), shaded in three tones from a light above and in front, then outlined. The grid is drawn
// scaled up with smoothing off, so every pixel stays crisp. Uniform colors, number, hair and size
// all come from the look, so any player can wear any team's home or away set.
import { type RGB, mix, onColor, outlineOf, ramp, rgb } from './color';
import { type Joints, joints, type P2, type Pose, project, type Shape, shapeOf, type View } from './rig';

export interface Look {
  sport: 'nba' | 'nfl';
  /** inches and pounds */
  ht: number;
  wt: number;
  num: number | null;
  /** hair style (basketball): 0 short, 1 buzz, 2 high top, 3 bald, 4 headband, 5 locs */
  hair: number;
  beard?: boolean;
  skin: string;
  hairColor: string;
  jersey: string;
  trim: string;
  shorts: string;
  socks: string;
  shoes: string;
  /** football */
  helmet?: string;
  stripe?: string;
  mask?: string;
  pants?: string;
  /** a big lineman's pads and a lean receiver's differ */
  pads?: number;
  /** football sleeves: 'short' (most), 'long' */
  sleeves?: 'short' | 'long';
}

// palette slots
const SKIN = 1;
const JERSEY = 2;
const TRIM = 3;
const SHORTS = 4;
const SOCK = 5;
const SHOE = 6;
const HAIR = 7;
const HELMET = 8;
const MASK = 9;
const PANTS = 10;
const EYE = 11;
const NUM = 12;
const NUMLINE = 13;
const STRIPE = 14;
const BAND = 15;
const SOLE = 16;
const SKINDARK = 17;
const BUZZ = 18;
const SLOTS = 19;

interface Buf {
  w: number;
  h: number;
  slot: Uint8Array;
  tone: Uint8Array;
  part: Uint8Array;
  depth: Float32Array;
}

function buffer(w: number, h: number): Buf {
  const n = w * h;
  const depth = new Float32Array(n);
  depth.fill(-1e9);
  return { w, h, slot: new Uint8Array(n), tone: new Uint8Array(n), part: new Uint8Array(n), depth };
}

// the light: from the upper left, a little in front
const LX = -0.5;
const LY = 0.62;
const LZ = 0.6;
const LN = Math.hypot(LX, LY, LZ);

function toneOf(nx: number, ny: number, nz: number, bias: number): number {
  const i = (nx * LX + ny * LY + nz * LZ) / LN + bias;
  return i > 0.66 ? 2 : i > 0.1 ? 1 : 0;
}

function put(b: Buf, x: number, y: number, d: number, slot: number, tone: number, part: number) {
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
 */
function capsule(b: Buf, ox: number, oy: number, a: P2, c: P2, ra: number, rb: number, slotAt: (t: number) => number, part: number, bias = 0) {
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
      put(b, x, y, depth, slotAt(t), toneOf(nx, ny, nz, bias), part);
    }
}

function ball(b: Buf, ox: number, oy: number, c: P2, r: number, slotFor: (nx: number, ny: number, nz: number) => number, part: number) {
  const cx = c.x + ox;
  const cy = c.y + oy;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const ex = x + 0.5 - cx;
      const ey = y + 0.5 - cy;
      if (ex * ex + ey * ey > r * r) continue;
      const nx = ex / r;
      const ny = -ey / r;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      put(b, x, y, c.d + nz * r, slotFor(nx, ny, nz), toneOf(nx, ny, nz, 0.05), part);
    }
}

// 3x5 and 4x7 digits for jersey numbers
const D35: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001011001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
  '9': '111101111001111',
};
const D47: Record<string, string> = {
  '0': '0110100110011001100110010110',
  '1': '0010011000100010001000100111',
  '2': '0110100100010010010010001111',
  '3': '1110000100010110000100011110',
  '4': '0011010110011111000100010001',
  '5': '1111100011100001000110010110',
  '6': '0110100010001110100110010110',
  '7': '1111000100010010001001000100',
  '8': '0110100110010110100110010110',
  '9': '0110100110010111000100010110',
};

/** Paint the number onto the torso's pixels, squeezed by how square-on the chest is to us. */
function number(b: Buf, n: number, cx: number, cy: number, width: number, squeeze: number) {
  const s = String(n);
  const big = width >= 13 && s.length <= 2;
  const font = big ? D47 : D35;
  const fw = big ? 4 : 3;
  const fh = big ? 7 : 5;
  const gap = 1;
  const total = s.length * fw + (s.length - 1) * gap;
  if (total * Math.max(0.55, squeeze) > width + 1) return;
  const cols: number[] = [];
  for (let i = 0; i < s.length; i++) {
    for (let c = 0; c < fw; c++) cols.push(i * (fw + gap) + c);
  }
  // squeeze: drop columns evenly when the chest is turned
  const keepW = Math.max(1, Math.round(total * Math.max(0.55, squeeze)));
  const lit = new Set<string>();
  for (let i = 0; i < s.length; i++) {
    const glyph = font[s[i]];
    for (let r = 0; r < fh; r++)
      for (let c = 0; c < fw; c++) {
        if (glyph[r * fw + c] !== '1') continue;
        const col = i * (fw + gap) + c;
        const x = Math.round(cx - keepW / 2 + (col * keepW) / total);
        const y = Math.round(cy - fh / 2 + r);
        lit.add(x + ',' + y);
      }
  }
  for (const k of lit) {
    const [x, y] = k.split(',').map(Number);
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) continue;
    const i = y * b.w + x;
    if (b.slot[i] !== JERSEY && b.slot[i] !== TRIM) continue;
    b.slot[i] = NUM;
    b.tone[i] = Math.min(2, b.tone[i] + 0);
  }
  // a one-pixel border in the trim color around the digits, where it lands on the jersey
  for (const k of lit) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= b.w || yy >= b.h || lit.has(xx + ',' + yy)) continue;
      const i = yy * b.w + xx;
      if (b.slot[i] === JERSEY) b.slot[i] = NUMLINE;
    }
  }
}

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** where the feet are on the canvas (the point that stands on the floor) */
  ax: number;
  ay: number;
  /** where the hands are, for the ball */
  handL: { x: number; y: number };
  handR: { x: number; y: number };
  /** the top of the head */
  top: number;
}

/**
 * The drawings a renderer keeps, the oldest out first once there are `cap` of them. Each is a canvas,
 * and a phone's browser caps the canvas memory a page may hold (iOS freezes the page past it), so a
 * long game mustn't pile them up. `inUse` are drawings still on screen (kept whole). A hit moves a
 * drawing to the back of the line.
 */
export class SpriteCache {
  private map = new Map<string, Sprite>();
  constructor(private cap: number) {}
  get(key: string): Sprite | undefined {
    const s = this.map.get(key);
    if (s) {
      this.map.delete(key);
      this.map.set(key, s);
    }
    return s;
  }
  set(key: string, spr: Sprite, inUse: Iterable<Sprite>) {
    if (this.map.size >= this.cap) {
      const keep = new Set(inUse);
      let drop = Math.ceil(this.cap / 3);
      for (const [k, s] of this.map) {
        if (drop-- <= 0) break;
        this.map.delete(k);
        // let the browser have the memory back now (a zero-size canvas holds none)
        if (!keep.has(s)) {
          s.canvas.width = 0;
          s.canvas.height = 0;
        }
      }
    }
    this.map.set(key, spr);
  }
  clear() {
    this.map.clear();
  }
}

/** A player's body proportions, from his look (height, weight, football pads). */
export function shapeFor(look: Look): Shape {
  return shapeOf({ ht: look.ht, wt: look.wt }, look.sport === 'nfl' ? (look.pads ?? 1) : 0);
}

/** Joints handed in (motion capture, mocap.ts) rather than a pose to build them from. */
function isJoints(p: Pose | Joints): p is Joints {
  return typeof (p as Joints).pelvis === 'object';
}

/**
 * Draw a player: `px` is his height in pixels on the grid (the game scales the grid up). Parts are
 * drawn far to near with a depth test, so overlaps come out right from any side. The body is a
 * hand-keyed pose (poses.ts) or ready-made joints, such as a motion-capture frame retargeted to
 * this player (mocap.ts: built with shapeFor(look), feet at y = 0).
 */
export function drawBody(look: Look, pose: Pose | Joints, view: View, px: number): Sprite {
  const nfl = look.sport === 'nfl';
  const s = shapeFor(look);
  const j = isJoints(pose) ? pose : joints(pose, s);
  const P = (k: keyof typeof j) => project(j[k], view, px);
  const W = Math.ceil(px * 1.25) + 6;
  const H = Math.ceil(px * 1.7) + 6;
  const b = buffer(W, H);
  const ox = W / 2;
  const oy = H - 3;
  const front = Math.sin(view.facing);
  // which side is nearer the viewer: his right when he faces screen-right (cos > 0)
  const rightNear = Math.cos(view.facing) >= 0;
  const farBias = -0.18;
  const biasL = rightNear ? farBias : 0;
  const biasR = rightNear ? 0 : farBias;
  const chest = P('chest');
  const neck = P('neck');
  const head = P('head');
  const shL = P('shL');
  const shR = P('shR');
  const hipL = P('hipL');
  const hipR = P('hipR');
  const R = (r: number) => Math.max(0.9, r * px);
  const bulkR = (r: number) => R(r);

  // ---- legs ----
  const legs = (side: 'L' | 'R', bias: number, part: number) => {
    const hip = side === 'L' ? hipL : hipR;
    const knee = P(side === 'L' ? 'kneeL' : 'kneeR');
    const ankle = P(side === 'L' ? 'ankleL' : 'ankleR');
    const toe = P(side === 'L' ? 'toeL' : 'toeR');
    if (nfl) {
      // pants to below the knee, then the sock
      capsule(b, ox, oy, hip, knee, bulkR(s.rThigh * 1.05), bulkR(s.rThigh * 0.8), () => PANTS, part, bias);
      capsule(b, ox, oy, knee, ankle, bulkR(s.rShin * 1.05), bulkR(s.rShin * 0.8), (t) => (t < 0.18 ? PANTS : SOCK), part, bias);
    } else {
      // shorts to just above the knee (longer from the 90s on would need the era; one length for all)
      capsule(b, ox, oy, knee, ankle, bulkR(s.rShin), bulkR(s.rShin * 0.75), (t) => (t > 0.78 ? SOCK : SKIN), part, bias);
      capsule(b, ox, oy, hip, knee, bulkR(s.rThigh * 0.95), bulkR(s.rThigh * 0.72), () => SKIN, part, bias);
      // the shorts: a loose tube over the thigh, ending just above the knee with a trim hem
      const hem = { x: hip.x + (knee.x - hip.x) * 0.8, y: hip.y + (knee.y - hip.y) * 0.8, d: hip.d + (knee.d - hip.d) * 0.8 + 0.6 };
      capsule(b, ox, oy, { ...hip, d: hip.d + 0.6 }, hem, bulkR(s.rThigh * 1.32), bulkR(s.rThigh * 1.12), (t) => (t > 0.86 ? TRIM : SHORTS), part, bias);
    }
    // the shoe: a chunky toe
    capsule(b, ox, oy, ankle, toe, bulkR(0.024), bulkR(0.02), (t) => (t > 0.15 ? SHOE : SOCK), part, bias + 0.05);
  };
  legs('L', biasL, 1);
  legs('R', biasR, 2);

  // ---- torso: a rounded block from the hips to the shoulders, as wide as they look from here ----
  const half = (a: P2, c: P2) => Math.hypot(a.x - c.x, a.y - c.y) / 2;
  const hipHalf = Math.max(R(s.rTorso * 0.85), half(hipL, hipR) + R(s.rThigh * 0.75));
  const shHalf = Math.max(R(s.rTorso), half(shL, shR) + R(s.rUpper * (nfl ? 0.9 : 0.55)));
  const shMid: P2 = { x: (shL.x + shR.x) / 2, y: (shL.y + shR.y) / 2, d: (shL.d + shR.d) / 2 };
  const hipMid: P2 = { x: (hipL.x + hipR.x) / 2, y: (hipL.y + hipR.y) / 2, d: (hipL.d + hipR.d) / 2 };
  // the waist: shorts (or pants) below, jersey above
  const waist = nfl ? 0.12 : 0.2;
  capsule(b, ox, oy, hipMid, shMid, hipHalf, shHalf, (t) => (t < waist ? (nfl ? PANTS : SHORTS) : t < waist + 0.06 && !nfl ? TRIM : JERSEY), 3, 0);
  // the neck
  capsule(b, ox, oy, chest, neck, R(s.rTorso * 0.42), R(s.rTorso * 0.38), () => SKIN, 3, -0.05);

  // ---- arms ----
  const arms = (side: 'L' | 'R', bias: number, part: number) => {
    const sh = side === 'L' ? shL : shR;
    const el = P(side === 'L' ? 'elL' : 'elR');
    const wr = P(side === 'L' ? 'wrL' : 'wrR');
    const hd = P(side === 'L' ? 'handL' : 'handR');
    const sleeve = nfl ? (look.sleeves === 'long' ? 2 : 0.45) : 0;
    capsule(b, ox, oy, sh, el, bulkR(s.rUpper * (nfl ? 1.15 : 1)), bulkR(s.rUpper * 0.85), (t) => (t < sleeve ? JERSEY : SKIN), part, bias);
    capsule(b, ox, oy, el, wr, bulkR(s.rFore), bulkR(s.rFore * 0.82), () => (sleeve > 1 ? JERSEY : SKIN), part, bias);
    capsule(b, ox, oy, wr, hd, bulkR(s.rFore * 1.08), bulkR(s.rFore * 1.18), () => SKIN, part, bias + 0.05);
  };
  arms('L', biasL, 4);
  arms('R', biasR, 5);

  // ---- the jersey number, on the chest or back when we see it square enough ----
  const squeeze = Math.abs(front);
  if (look.num !== null && squeeze > 0.35 && view.pitch < 1.2) {
    const cx = ox + (shMid.x * 0.6 + hipMid.x * 0.4);
    const cy = oy + (shMid.y * 0.62 + hipMid.y * 0.38);
    number(b, look.num, cx, cy, shHalf * 2 * squeeze - 2, squeeze);
  }

  // ---- head ----
  const hr = R(s.headR);
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  // his up, forward and right, as screen directions (x right, y up, z toward us)
  const fwdW = { x: Math.cos(view.facing), z: Math.sin(view.facing) };
  const fwdS = { x: fwdW.x, y: -fwdW.z * sp, z: fwdW.z * cp };
  const upS = { x: 0, y: cp, z: sp };
  const rightS = { x: -fwdW.z, y: -fwdW.x * sp, z: fwdW.x * cp };
  if (nfl) {
    const hc: P2 = { x: head.x, y: head.y - hr * 0.1, d: head.d };
    const r = hr * 1.2;
    ball(
      b,
      ox,
      oy,
      hc,
      r,
      (nx, ny, nz) => {
        const f = nx * fwdS.x + ny * fwdS.y + nz * fwdS.z;
        const u = nx * upS.x + ny * upS.y + nz * upS.z;
        const rt = nx * rightS.x + ny * rightS.y + nz * rightS.z;
        // the facemask: bars across the front, low
        if (f > 0.55 && u < 0.25) return MASK;
        // the stripe down the middle of the crown
        if (Math.abs(rt) < 0.17 && u > 0.1 && f < 0.6) return STRIPE;
        return HELMET;
      },
      6
    );
    // the face behind the mask, where it shows (front-on views)
    const faceDepth = fwdS.z;
    if (faceDepth > 0.2) {
      const fx = Math.round(ox + hc.x + fwdS.x * r * 0.55);
      const fy = Math.round(oy + hc.y - fwdS.y * r * 0.55 + r * 0.05);
      for (const [dx, dy] of [
        [0, 0],
        [-1, 0],
        [1, 0],
      ]) {
        const i = (fy + dy) * b.w + fx + dx;
        if (b.slot[i] === MASK) b.slot[i] = SKIN;
      }
    }
  } else {
    const style = look.hair;
    const hc: P2 = head;
    ball(
      b,
      ox,
      oy,
      hc,
      hr,
      (nx, ny, nz) => {
        // where on his head this pixel is: forward, up and to his right (each -1 to 1)
        const f = nx * fwdS.x + ny * fwdS.y + nz * fwdS.z;
        const u = nx * upS.x + ny * upS.y + nz * upS.z;
        const r = nx * rightS.x + ny * rightS.y + nz * rightS.z;
        const ar = Math.abs(r);
        // the face
        if (f > 0.45) {
          if (u > -0.02 && u < 0.26 && ar > 0.1 && ar < 0.56) return EYE;
          if (u >= 0.26 && u < 0.42 && ar > 0.08 && ar < 0.6) return style === 3 ? SKINDARK : HAIR;
          if (f > 0.68 && ar < 0.3 && u > -0.6 && u < -0.38) return SKINDARK;
          if (look.beard && u < -0.32 && ar < 0.78) return HAIR;
        }
        // the ears
        if (ar > 0.8 && Math.abs(u) < 0.24 && f > -0.35 && f < 0.32) return SKINDARK;
        if (style === 3) return SKIN;
        // the hairline: high at the forehead, low at the nape
        const hairline = 0.4 + 0.24 * f;
        const hair = u > hairline || (f < -0.5 && u > -0.3);
        if (style === 4 && !hair && u > hairline - 0.2 && u <= hairline) return BAND;
        if (hair) return style === 1 ? BUZZ : HAIR;
        return SKIN;
      },
      6
    );
    if (style === 2) {
      // a high top: a block of hair on the crown
      const top: P2 = { x: hc.x - fwdS.x * hr * 0.1, y: hc.y - upS.y * hr * 0.7, d: hc.d + upS.z * hr * 0.7 };
      capsule(b, ox, oy, top, { ...top, y: top.y - hr * 0.45 }, hr * 0.82, hr * 0.8, () => HAIR, 6, 0.1);
    } else if (style === 5) {
      // locs down the back of the head
      const back: P2 = { x: hc.x - fwdS.x * hr * 0.55, y: hc.y + hr * 0.1, d: hc.d - fwdS.z * hr * 0.55 - 0.5 };
      capsule(b, ox, oy, back, { ...back, x: back.x - fwdS.x * hr * 0.2, y: back.y + hr * 0.95 }, hr * 0.62, hr * 0.42, () => HAIR, 6, -0.05);
    }
  }
  // ---- colors ----
  const pal = palette(look);
  return finish(b, pal, ox, oy, P('handL'), P('handR'), Math.round(oy + head.y - hr * 1.3));
}

function palette(look: Look): RGB[][] {
  const skin = rgb(look.skin);
  const jersey = rgb(look.jersey);
  const trim = rgb(look.trim);
  const shorts = rgb(look.shorts);
  const ramps: RGB[][] = Array.from({ length: SLOTS }, () => [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
  const set = (i: number, c: RGB) => (ramps[i] = ramp(c));
  set(SKIN, skin);
  set(JERSEY, jersey);
  set(TRIM, trim);
  set(SHORTS, shorts);
  set(SOCK, rgb(look.socks));
  set(SHOE, rgb(look.shoes));
  set(SOLE, [240, 240, 240]);
  set(HAIR, rgb(look.hairColor));
  set(HELMET, rgb(look.helmet ?? look.jersey));
  set(STRIPE, rgb(look.stripe ?? look.trim));
  set(MASK, rgb(look.mask ?? '#9aa0a6'));
  set(PANTS, rgb(look.pants ?? '#e8e8e8'));
  set(BAND, trim);
  const sk = ramp(skin);
  ramps[SKINDARK] = [mix(sk[0], [0, 0, 0], 0.15), sk[0], sk[0]];
  set(BUZZ, mix(rgb(look.hairColor), skin, 0.35));
  // the number: the trim color if it reads on the jersey, else black or white
  const num = onColor(jersey, [trim, [255, 255, 255], [20, 20, 24]]);
  ramps[NUM] = [mix(num, [0, 0, 0], 0.15), num, mix(num, [255, 255, 255], 0.12)];
  const line = onColor(num, [shorts, trim, [20, 20, 24]]);
  ramps[NUMLINE] = [line, line, line];
  const eye: RGB = [28, 18, 22];
  ramps[EYE] = [eye, eye, eye];
  return ramps;
}

function finish(b: Buf, pal: RGB[][], ox: number, oy: number, hl: P2, hr: P2, top: number): Sprite {
  const { w, h, slot, tone, depth, part } = b;
  // the colors packed once per slot: its three tones, and the dark line drawn along its edges
  const pack = (c: RGB) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
  const col = pal.map((tones) => (tones ? tones.map(pack) : [0, 0, 0]));
  const line = pal.map((tones) => (tones ? pack(outlineOf(tones[1])) : 0));
  const out = new Uint32Array(w * h);
  const T = 1.6;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const s = slot[i];
      if (s) {
        // an inner line where a nearer part overlaps this farther one
        const d = depth[i] + T;
        const pi = part[i];
        let k = i + 1;
        let edge = x + 1 < w && slot[k] !== 0 && part[k] !== pi && depth[k] > d;
        k = i - 1;
        if (!edge) edge = x > 0 && slot[k] !== 0 && part[k] !== pi && depth[k] > d;
        k = i + w;
        if (!edge) edge = y + 1 < h && slot[k] !== 0 && part[k] !== pi && depth[k] > d;
        k = i - w;
        if (!edge) edge = y > 0 && slot[k] !== 0 && part[k] !== pi && depth[k] > d;
        out[i] = edge ? line[s] : col[s][tone[i]];
        continue;
      }
      // the outline around the whole figure, in a dark version of the nearest part it borders
      let best = -1;
      let bd = -1e9;
      let k = i + 1;
      if (x + 1 < w && slot[k] && depth[k] > bd) {
        bd = depth[k];
        best = k;
      }
      k = i - 1;
      if (x > 0 && slot[k] && depth[k] > bd) {
        bd = depth[k];
        best = k;
      }
      k = i + w;
      if (y + 1 < h && slot[k] && depth[k] > bd) {
        bd = depth[k];
        best = k;
      }
      k = i - w;
      if (y > 0 && slot[k] && depth[k] > bd) best = k;
      if (best >= 0) out[i] = line[slot[best]];
    }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out.buffer), w, h), 0, 0);
  return { canvas, ax: ox, ay: oy, handL: { x: ox + hl.x, y: oy + hl.y }, handR: { x: ox + hr.x, y: oy + hr.y }, top };
}

/** No reliable source says what a player looks like, so everyone shares one skin tone; hair varies by player. */
export const DEFAULT_SKIN = '#a8714f';
export const DEFAULT_HAIR = '#1d1612';

/** A steady hair style per player, from his id. */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function hairFor(id: string): number {
  const styles = [0, 0, 0, 1, 1, 2, 3, 4, 5, 0, 1];
  return styles[hash(id) % styles.length];
}

/** about one in four players gets a beard, steady per player */
export function beardFor(id: string): boolean {
  return (hash(id + ':b') % 4) === 0;
}

export type { Joints, Pose, View };
