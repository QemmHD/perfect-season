// A player drawn as pixel art: his skeleton in a pose (rig.ts), filled in limb by limb into a small
// pixel grid with a depth test (so the near arm passes in front of the chest and the far one behind
// it), shaded in three tones from a light above and in front, then outlined. The grid is drawn
// scaled up with smoothing off, so every pixel stays crisp. Uniform colors, number, hair and size
// all come from the look, so any player can wear any team's home or away set; his head, hair and
// gear come from his appearance record (head.ts, studio overhaul players-4).
import type { Appearance, Arm, Leg, Socks } from './appearance';
import { luma, OUTLINE, type RGB, mix, onColor, ramp3, rgb } from './color';
import { paintHead } from './head';
import { headCols, headRows, LIMB_SCALE, padsWidthPx, snapCentre, torsoWidthPx } from './proportions';
import { type Buf, buffer, capsule } from './raster';
import { type Joints, joints, type P2, type Pose, project, type Shape, shapeOf, type V3, type View } from './rig';
import { ARMGEAR, ARM_L, ARM_R, BAND, BUZZ, EYE, FRAME, GLOVE, HAIR, HAIR_HANG, HAIR_VOL, HEAD, HELMET, JERSEY, LEG_L, LEG_R, LEGGEAR, LENS, MASK, MOUTH, NUM, NUMLINE, PANTS, SHOE, SHORTS, SKIN, SKINDARK, SLOTS, SOCK, SOLE, STRIPE, STUBBLE, TORSO, TOWEL, TRIM } from './slots';

export interface Look {
  sport: 'nba' | 'nfl' | 'soccer';
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
  /** soccer: a keeper's gloves */
  gloves?: string;
  /** the appearance record this look was made from (looks.ts), for drawing its full detail */
  app?: Appearance;
  /** gear colours resolved against the kit (looks.ts): head gear, arm and leg gear */
  gear?: { head?: string; arm?: string; leg?: string };
  /** a cosmetic ground-ring colour (Ultimate Team rewards), for the ground mark */
  ring?: string;
  /** made with the sport's appearance data in (false: before it arrived, so only the defaults) */
  withData?: boolean;
}

/** The main materials' palette slots, for tests and tools that read a Raster's `slot`. */
export const MATERIAL_SLOT = { skin: SKIN, jersey: JERSEY, trim: TRIM, shorts: SHORTS, socks: SOCK, shoes: SHOE, hair: HAIR, helmet: HELMET, pants: PANTS } as const;

// jersey-number fonts: 3x5 below 34 art px, 4x7 from 34 to 59, 6x10 from 60 (V2 L-5)
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
const rows610 = (r: string[]) => r.join('').replace(/#/g, '1').replace(/\./g, '0');
const D610: Record<string, string> = {
  '0': rows610(['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.']),
  '1': rows610(['..##..', '.###..', '####..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '######']),
  '2': rows610(['.####.', '##..##', '....##', '....##', '...##.', '..##..', '.##...', '##....', '##....', '######']),
  '3': rows610(['.####.', '##..##', '....##', '....##', '..###.', '....##', '....##', '....##', '##..##', '.####.']),
  '4': rows610(['...##.', '..###.', '.####.', '##.##.', '##.##.', '######', '...##.', '...##.', '...##.', '...##.']),
  '5': rows610(['######', '##....', '##....', '#####.', '....##', '....##', '....##', '....##', '##..##', '.####.']),
  '6': rows610(['.####.', '##..##', '##....', '##....', '#####.', '##..##', '##..##', '##..##', '##..##', '.####.']),
  '7': rows610(['######', '....##', '....##', '...##.', '...##.', '..##..', '..##..', '..##..', '..##..', '..##..']),
  '8': rows610(['.####.', '##..##', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '##..##', '.####.']),
  '9': rows610(['.####.', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '....##', '##..##', '.####.']),
};
export interface NumberFont {
  w: number;
  h: number;
  glyphs: Record<string, string>;
}
export const NUMBER_FONTS: Record<'s' | 'm' | 'l', NumberFont> = { s: { w: 3, h: 5, glyphs: D35 }, m: { w: 4, h: 7, glyphs: D47 }, l: { w: 6, h: 10, glyphs: D610 } };

/** The fonts a sprite of `px` art px tries, biggest first: its own size's, then the smaller ones. */
export function numberFonts(px: number): NumberFont[] {
  const { s, m, l } = NUMBER_FONTS;
  return px >= 60 ? [l, m, s] : px >= 34 ? [m, s] : [s];
}

/** A number's pixels in a font: [x, y] from its top-left, `gap` columns between digits. */
export function numberBitmap(n: number, font: NumberFont, gap: number): { w: number; px: [number, number][] } {
  const s = String(n);
  const px: [number, number][] = [];
  for (let i = 0; i < s.length; i++) {
    const g = font.glyphs[s[i]];
    for (let r = 0; r < font.h; r++) for (let c = 0; c < font.w; c++) if (g[r * font.w + c] === '1') px.push([i * (font.w + gap) + c, r]);
  }
  return { w: s.length * font.w + (s.length - 1) * gap, px };
}

/**
 * Paint the number onto the jersey, centred on (cx, cy): exact glyphs or nothing, never a scramble.
 * The size's own font first, then smaller ones; a chest turned from us closes the gap between digits
 * (never a glyph's columns); turned past `squeeze` 0.6, or with nowhere it fits whole on the jersey
 * (an arm across it), it isn't drawn. Its trim border goes on only where the chest has room.
 */
function number(b: Buf, n: number, cx: number, cy: number, squeeze: number, px: number) {
  if (squeeze < 0.6) return;
  const { slot, w, h } = b;
  const jersey = JERSEY,
    trim = TRIM;
  // the shirt's own pixels before the number goes on
  let shirt = 0;
  for (let i = 0; i < slot.length; i++) if (slot[i] === jersey) shirt++;
  const fonts = numberFonts(px);
  for (const font of fonts)
    for (const gap of squeeze < 0.9 ? [1, 0] : [1]) {
      const bm = numberBitmap(n, font, gap);
      const x0 = Math.round(cx - bm.w / 2);
      const y0 = Math.round(cy - font.h / 2);
      const fits = bm.px.every(([x, y]) => {
        const xx = x0 + x;
        const yy = y0 + y;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false;
        const sl = slot[yy * w + xx];
        return sl === jersey || sl === trim;
      });
      if (!fits) continue;
      const lit = new Set(bm.px.map(([x, y]) => (y0 + y) * w + x0 + x));
      // a one-pixel border in the trim color around the digits, where it lands on the jersey
      const border = new Set<number>();
      const edge = (k: number) => {
        if (k >= 0 && k < slot.length && !lit.has(k) && slot[k] === jersey) border.add(k);
      };
      for (const i of lit) {
        const x = i % w;
        if (x + 1 < w) edge(i + 1);
        if (x > 0) edge(i - 1);
        edge(i + w);
        edge(i - w);
      }
      for (const i of lit) slot[i] = NUM;
      // the border only where the chest has room for it: with it the shirt must still show twice as
      // much shirt as number (the arms and the chin land on it after), or its shading goes (a turned
      // or narrow chest; V2 C.7 #8). The number's colour reads on the jersey without it (onColor)
      if (shirt - lit.size - border.size >= 2 * lit.size) for (const k of border) slot[k] = NUMLINE;
      return;
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

/** The browser wouldn't give a new canvas (iOS caps the canvas memory a page holds). */
export class CanvasOut extends Error {
  constructor() {
    super('out of canvas memory');
  }
}

/** Give a canvas's memory back now rather than whenever it's collected (iOS counts it till then). */
export function freeCanvas(c: HTMLCanvasElement | null | undefined) {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

/**
 * The drawings a renderer keeps, the oldest out first once there are `cap` of them. Each is a canvas,
 * and a phone's browser caps the canvas memory a page may hold (iOS freezes the page past it), so a
 * long game mustn't pile them up. `inUse` are drawings still on screen (kept whole). A hit moves a
 * drawing to the back of the line.
 */
export class SpriteCache<S extends Sprite = Sprite> {
  private map = new Map<string, S>();
  constructor(private cap: number) {}
  get(key: string): S | undefined {
    const s = this.map.get(key);
    if (s) {
      this.map.delete(key);
      this.map.set(key, s);
    }
    return s;
  }
  set(key: string, spr: S, inUse: Iterable<Sprite>) {
    if (this.map.size >= this.cap) {
      const keep = new Set(inUse);
      let drop = Math.ceil(this.cap / 3);
      for (const [k, s] of this.map) {
        if (drop-- <= 0) break;
        this.map.delete(k);
        // let the browser have the memory back now (a zero-size canvas holds none)
        if (!keep.has(s)) freeCanvas(s.canvas);
      }
    }
    this.map.set(key, spr);
  }
  clear() {
    this.map.clear();
  }
  /** Drop every drawing and hand back its memory (the game's over, or the phone is short of it). */
  dispose(keep: Iterable<Sprite> = []) {
    const k = new Set(keep);
    for (const s of this.map.values()) if (!k.has(s)) freeCanvas(s.canvas);
    this.map.clear();
  }
}

/** A player's body proportions, from his look (height, weight, football pads). */
export function shapeFor(look: Look): Shape {
  return shapeOf({ ht: look.ht, wt: look.wt }, look.sport === 'nfl' ? (look.pads ?? 1) : 0);
}

/** Where the sock starts up the shin (0 the knee, 1 the ankle) for a record's sock height: basketball
 * crew socks and soccer's socks to the knee are the old defaults. */
function sockTop(sport: Look['sport'], socks: Socks | undefined): number {
  const soccer = sport === 'soccer';
  switch (socks) {
    case 'low':
      return soccer ? 0.72 : 0.88;
    case 'high':
      return soccer ? 0.1 : 0.45;
    case 'over-knee':
      return 0;
    case 'crew':
      return soccer ? 0.45 : 0.78;
    default:
      return soccer ? 0.1 : 0.78;
  }
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
  return toSprite(rasterBody(look, pose, view, px));
}

/** A player's drawing as pixels (RGBA packed little-endian, 0 transparent), with its anchors. */
export interface Raster {
  w: number;
  h: number;
  px: Uint32Array;
  /** the feet, the hands and the top of the head, as in Sprite */
  ax: number;
  ay: number;
  handL: { x: number; y: number };
  handR: { x: number; y: number };
  top: number;
  /** per pixel: the material slot (0 empty) and the body part (1-2 legs, 3 torso, 4-5 arms, 6 head,
   * 7 hair volume, 8 hair hanging below the head; slots.ts), for tests and tools; the outline ring is slot 0 */
  slot: Uint8Array;
  part: Uint8Array;
}

/** The pixels of drawBody, without a canvas (the same arguments; see drawBody). */
export function rasterBody(look: Look, pose: Pose | Joints, view: View, px: number): Raster {
  const nfl = look.sport === 'nfl';
  // soccer (Claude, 2026-11-01): short sleeves, shorter shorts, socks to the knee, keeper's gloves
  const soccer = look.sport === 'soccer';
  const s = shapeFor(look);
  const j0 = isJoints(pose) ? pose : joints(pose, s);
  // Broadcast Pixel build (proportions.ts): the torso's face-on width comes from his weight for his
  // height (football pads add shoulders), and his arms hang outside it, however wide it is
  const torsoHalf = (torsoWidthPx(look.ht, look.wt, px) + (nfl ? padsWidthPx(look.pads ?? 1, px) : 0)) / 2;
  const j = armsOut(j0, torsoHalf / px - s.rUpper * LIMB_SCALE * 0.35);
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
  const head0 = P('head');
  const shL = P('shL');
  const shR = P('shR');
  const hipL = P('hipL');
  const hipR = P('hipR');
  const R = (r: number) => Math.max(0.9, r * px);
  // limbs drawn x1.15 thicker than the rig (V2 C.1.1)
  const bulkR = (r: number) => R(r * LIMB_SCALE);

  // ---- legs: socks to his record's height, his knee and leg gear ----
  const app = look.app;
  const legs = (side: 'L' | 'R', bias: number, part: number) => {
    const hip = side === 'L' ? hipL : hipR;
    const knee = P(side === 'L' ? 'kneeL' : 'kneeR');
    const ankle = P(side === 'L' ? 'ankleL' : 'ankleR');
    const toe = P(side === 'L' ? 'toeL' : 'toeR');
    const gear: Leg = (side === 'L' ? app?.legL : app?.legR) ?? 'none';
    if (nfl) {
      // pants to below the knee, then the sock (low socks show the calf)
      const low = app?.socks === 'low' || app?.socks === 'crew';
      capsule(b, ox, oy, hip, knee, bulkR(s.rThigh * 1.05), bulkR(s.rThigh * 0.8), () => PANTS, part, bias);
      capsule(b, ox, oy, knee, ankle, bulkR(s.rShin * 1.05), bulkR(s.rShin * 0.8), (t) => (t < 0.18 ? PANTS : low && t < 0.62 ? (gear === 'tights' || gear === 'calf' ? LEGGEAR : SKIN) : SOCK), part, bias);
    } else {
      // shorts to just above the knee (longer from the 90s on would need the era; one length for all)
      const sockAt = sockTop(look.sport, app?.socks);
      const shin = (t: number) => (t > sockAt ? SOCK : gear === 'tights' || (gear === 'calf' && t > 0.18) || ((gear === 'kneesleeve' || gear === 'brace') && t < 0.3) ? LEGGEAR : SKIN);
      const thigh = (t: number) => (gear === 'tights' || ((gear === 'kneesleeve' || gear === 'brace') && t > 0.7) ? LEGGEAR : app?.socks === 'over-knee' && t > 0.82 ? SOCK : SKIN);
      capsule(b, ox, oy, knee, ankle, bulkR(s.rShin * (soccer ? 1.08 : 1)), bulkR(s.rShin * 0.75), shin, part, bias);
      capsule(b, ox, oy, hip, knee, bulkR(s.rThigh * 0.95), bulkR(s.rThigh * 0.72), thigh, part, bias);
      // a knee pad: a block over the knee, proud of the leg
      if (gear === 'kneepad') capsule(b, ox, oy, { ...knee, d: knee.d + 0.3 }, { ...knee, d: knee.d + 0.3 }, bulkR(s.rShin * 1.25), bulkR(s.rShin * 1.25), () => LEGGEAR, part, bias);
      // the shorts: a loose tube over the thigh, ending just above the knee with a trim hem
      const hl = soccer ? 0.6 : 0.8;
      const hem = { x: hip.x + (knee.x - hip.x) * hl, y: hip.y + (knee.y - hip.y) * hl, d: hip.d + (knee.d - hip.d) * hl + 0.6 };
      capsule(b, ox, oy, { ...hip, d: hip.d + 0.6 }, hem, bulkR(s.rThigh * 1.32), bulkR(s.rThigh * 1.12), (t) => (t > 0.86 ? TRIM : SHORTS), part, bias);
    }
    // the shoe: a chunky toe
    capsule(b, ox, oy, ankle, toe, R(0.024), R(0.02), (t) => (t > 0.15 ? SHOE : SOCK), part, bias + 0.05);
  };
  legs('L', biasL, LEG_L);
  legs('R', biasR, LEG_R);

  // ---- torso: a rounded block from the hips to the shoulders, as wide as they look from here ----
  const half = (a: P2, c: P2) => Math.hypot(a.x - c.x, a.y - c.y) / 2;
  // how square-on the shoulders and hips are to us (1 face-on, 0 side-on), from the rig's joints
  const squareSh = Math.min(1, half(project(j0.shL, view, px), project(j0.shR, view, px)) / Math.max(1e-6, s.shoulderW * px));
  const squareHip = Math.min(1, half(hipL, hipR) / Math.max(1e-6, s.hipW * px));
  // face-on the build's width, side-on the chest's depth, an ellipse between
  const depthHalf = Math.max(R(s.rTorso), torsoHalf * 0.6);
  const across = (w: number, dpt: number, sq: number) => Math.hypot(w * sq, dpt * Math.sqrt(1 - sq * sq));
  const hipHalf = Math.max(across(torsoHalf * 0.8, depthHalf * 0.9, squareHip), half(hipL, hipR) + bulkR(s.rThigh * 0.75));
  const shHalf = across(torsoHalf, depthHalf, squareSh);
  const shMid: P2 = { x: (shL.x + shR.x) / 2, y: (shL.y + shR.y) / 2, d: (shL.d + shR.d) / 2 };
  const hipMid: P2 = { x: (hipL.x + hipR.x) / 2, y: (hipL.y + hipR.y) / 2, d: (hipL.d + hipR.d) / 2 };
  // the waist: shorts (or pants) below, jersey above
  const waist = nfl ? 0.12 : 0.2;
  // a V: tapering from the chest down to the hips, the build's full width from the chest up
  const chestAt: P2 = { x: hipMid.x + (shMid.x - hipMid.x) * 0.55, y: hipMid.y + (shMid.y - hipMid.y) * 0.55, d: hipMid.d + (shMid.d - hipMid.d) * 0.55 };
  const lowT = (t: number) => t * 0.55;
  capsule(b, ox, oy, hipMid, chestAt, hipHalf, shHalf, (t) => (lowT(t) < waist ? (nfl ? PANTS : SHORTS) : lowT(t) < waist + 0.06 && !nfl ? TRIM : JERSEY), 3, 0);
  capsule(b, ox, oy, chestAt, shMid, shHalf, shHalf, () => JERSEY, 3, 0);
  // the neck
  capsule(b, ox, oy, chest, neck, R(s.rTorso * 0.42), R(s.rTorso * 0.38), () => SKIN, 3, -0.05);

  // ---- arms ----
  const arms = (side: 'L' | 'R', bias: number, part: number) => {
    const sh = side === 'L' ? shL : shR;
    const el = P(side === 'L' ? 'elL' : 'elR');
    const wr = P(side === 'L' ? 'wrL' : 'wrR');
    const hd = P(side === 'L' ? 'handL' : 'handR');
    const sleeve = nfl || soccer ? (look.sleeves === 'long' ? 2 : soccer ? 0.5 : 0.45) : 0;
    // arm gear (his record): a full sleeve, a shooting sleeve from mid-arm, an elbow sleeve, long
    // sleeves under a basketball jersey; wristbands and tape from 34 art px, where they read
    const gear: Arm = (side === 'L' ? app?.armL : app?.armR) ?? 'none';
    const fine = px >= 34;
    const under = gear === 'long' ? JERSEY : ARMGEAR;
    const upper = (t: number) => (t < sleeve ? JERSEY : gear === 'sleeve' || gear === 'long' || (gear === 'shooter' && t > 0.45) || (gear === 'elbow' && t > 0.72) ? under : SKIN);
    const fore = (t: number) =>
      sleeve > 1 ? JERSEY : gear === 'sleeve' || gear === 'shooter' || gear === 'long' || (gear === 'elbow' && t < 0.28) ? under : fine && gear === 'wrist' && t > 0.74 ? ARMGEAR : fine && gear === 'tape' && t > 0.78 ? TOWEL : SKIN;
    capsule(b, ox, oy, sh, el, bulkR(s.rUpper * (nfl ? 1.15 : 1)), bulkR(s.rUpper * 0.85), upper, part, bias);
    capsule(b, ox, oy, el, wr, bulkR(s.rFore), bulkR(s.rFore * 0.82), fore, part, bias);
    capsule(b, ox, oy, wr, hd, bulkR(s.rFore * (look.gloves ? 1.35 : 1.08)), bulkR(s.rFore * (look.gloves ? 1.5 : 1.18)), () => (look.gloves ? GLOVE : SKIN), part, bias + 0.05);
  };
  arms('L', biasL, ARM_L);
  arms('R', biasR, ARM_R);

  // his forward, up and right as screen directions (x right, y up, z toward us), for the head and gear
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  const fwdW = { x: Math.cos(view.facing), z: Math.sin(view.facing) };
  const fwdS = { x: fwdW.x, y: -fwdW.z * sp, z: fwdW.z * cp };
  const upS = { x: 0, y: cp, z: sp };
  const rightS = { x: -fwdW.z, y: -fwdW.x * sp, z: fwdW.x * cp };

  // ---- the kit's trim at the collar: jersey round the neck (V2 C.1.6: base, trim, number) ----
  // (only the rows round the shoulder line, where the neck meets the shirt: the raster is rebuilt
  // often, so this stays a small scan with no allocation)
  {
    const { w, slot, part } = b;
    const reach = Math.max(2, Math.ceil(shHalf + px * 0.08));
    const y0 = Math.max(1, Math.floor(oy + shMid.y - reach));
    const y1 = Math.min(b.h - 2, Math.ceil(oy + shMid.y + reach));
    const neck = (k: number) => slot[k] === SKIN && part[k] === TORSO;
    for (let y = y0; y <= y1; y++)
      for (let i = y * w + 1, end = y * w + w - 1; i < end; i++)
        if (slot[i] === JERSEY && part[i] === TORSO && (neck(i - 1) || neck(i + 1) || neck(i - w) || neck(i + w))) slot[i] = TRIM;
  }

  // ---- the jersey number, on the chest or back when we see it square enough ----
  const squeeze = Math.abs(front);
  if (look.num !== null && squeeze > 0.35 && view.pitch < 1.2) {
    const cx = ox + (shMid.x * 0.6 + hipMid.x * 0.4);
    const cy = oy + (shMid.y * 0.62 + hipMid.y * 0.38);
    number(b, look.num, cx, cy, squeeze, px);
  }

  // ---- football: a towel tucked into the front of the pants (from 24 art px) ----
  if (nfl && app?.towel && px >= 24) {
    const k = hipHalf * 0.85;
    const side = rightNear ? 0.35 : -0.35;
    const top: P2 = { x: hipMid.x + fwdS.x * k + rightS.x * k * side, y: hipMid.y - fwdS.y * k - rightS.y * k * side, d: hipMid.d + fwdS.z * k + rightS.z * k * side + 0.4 };
    capsule(b, ox, oy, top, { ...top, y: top.y + px * 0.1 }, Math.max(0.7, px * 0.022), Math.max(0.7, px * 0.026), () => TOWEL, TORSO, 0.1);
  }

  // ---- head: the 5-head hero's (proportions.ts), set on the neck at its drawn size ----
  // sized in whole rows and columns and centred on the grid so it gets exactly that many, so the head
  // keeps one size across a band instead of gaining or losing a row with the sprite's sub-pixel offset
  const rows = headRows(s.headR, px);
  const cols = headCols(rows);
  const hr = rows / 2;
  const hw = cols / rows;
  const grow = hr / Math.max(1e-6, s.headR * px);
  const head: P2 = { x: neck.x + (head0.x - neck.x) * grow, y: neck.y + (head0.y - neck.y) * grow, d: neck.d + (head0.d - neck.d) * grow };
  head.x = snapCentre(head.x + ox, cols) - ox;
  head.y = snapCentre(head.y + oy, rows) - oy;
  paintHead(b, ox, oy, head, hr, { fwd: fwdS, up: upS, right: rightS, hw }, look, px);
  // ---- colors ----
  const pal = palette(look);
  // dark skin on a dark kit: a 1 px lit-side rim on the skin, so his arms don't sink into the jersey
  const rim = luma(rgb(look.skin)) < 95 && luma(rgb(look.jersey)) < 95;
  // the top of the head: the highest pixel of the head, its hair or its helmet
  let top = Math.round(oy + head.y - hr * 1.3);
  for (let i = 0; i < b.slot.length; i++)
    if (b.slot[i] && (b.part[i] === HEAD || b.part[i] === HAIR_VOL || b.part[i] === HAIR_HANG)) {
      top = Math.floor(i / b.w);
      break;
    }
  return finish(b, pal, ox, oy, P('handL'), P('handR'), top, rim);
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
  const set = (i: number, c: RGB) => (ramps[i] = ramp3(c));
  // skin and hair keep their true base (ramp3's identity rule); kit materials keep clear of the outline
  const own = (i: number, c: RGB) => (ramps[i] = ramp3(c, true));
  own(SKIN, skin);
  set(JERSEY, jersey);
  set(TRIM, trim);
  set(SHORTS, shorts);
  set(SOCK, rgb(look.socks));
  set(SHOE, rgb(look.shoes));
  set(SOLE, [240, 240, 240]);
  own(HAIR, rgb(look.hairColor));
  set(HELMET, rgb(look.helmet ?? look.jersey));
  set(STRIPE, rgb(look.stripe ?? look.trim));
  set(MASK, rgb(look.mask ?? '#9aa0a6'));
  set(PANTS, rgb(look.pants ?? '#e8e8e8'));
  // gear: head gear, sleeves and leg gear in the record's colours (looks.ts), else the kit's trim,
  // white and black
  set(BAND, look.gear?.head ? rgb(look.gear.head) : trim);
  set(ARMGEAR, rgb(look.gear?.arm ?? '#f2f2ee'));
  set(LEGGEAR, rgb(look.gear?.leg ?? '#1b1b1f'));
  set(TOWEL, [244, 244, 240]);
  set(GLOVE, rgb(look.gloves ?? look.skin));
  // goggles: a clear lens in a dark frame; football visors clear, smoked or tinted amber
  const eyes = look.app?.eyes;
  set(LENS, eyes === 'visor-dark' ? [34, 37, 46] : eyes === 'visor-tint' ? [214, 148, 58] : [196, 228, 238]);
  set(FRAME, [58, 61, 70]);
  own(MOUTH, [236, 242, 238]);
  // the nose and the ears: the skin's own shadow tone, so skin stays three tones
  const sk = ramp3(skin, true);
  ramps[SKINDARK] = [sk[0], sk[0], sk[0]];
  // hair cut close shows the scalp through it; a dyed colour (Rodman's red) is meant to be seen, so
  // it shows through far less
  const dyed = ['red', 'blue', 'green', 'pink', 'purple', 'platinum', 'team'].includes(look.app?.hairTone ?? '');
  own(BUZZ, mix(rgb(look.hairColor), skin, dyed ? 0.12 : 0.35));
  own(STUBBLE, mix(rgb(look.hairColor), skin, 0.55));
  // the number: the trim color if it reads on the jersey, else black or white
  const num = onColor(jersey, [trim, [255, 255, 255], [20, 20, 24]]);
  // the number is a marking inside the jersey, not an edge: a black number stays black
  ramps[NUM] = ramp3(num, true);
  const line = onColor(num, [shorts, trim, [20, 20, 24]]);
  ramps[NUMLINE] = [line, line, line];
  const eye: RGB = [28, 18, 22];
  ramps[EYE] = [eye, eye, eye];
  return ramps;
}

function finish(b: Buf, pal: RGB[][], ox: number, oy: number, hl: P2, hr: P2, top: number, rim: boolean): Raster {
  const { w, h, slot, tone, depth, part } = b;
  // the lit-side rim (dark skin on a dark kit): skin with nothing above or to the left of it takes
  // the skin's highlight, the side the light comes from
  const rimmed: number[] = [];
  if (rim)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (slot[i] === SKIN && (x === 0 || !slot[i - 1] || y === 0 || !slot[i - w])) rimmed.push(i);
      }
  // the colours packed once per slot: its three tones
  const pack = (c: RGB) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
  const col = pal.map((tones) => (tones ? tones.map(pack) : [0, 0, 0]));
  const line = pack(OUTLINE) >>> 0;
  // hair (volume and hanging) and the head are one shape: no line between them
  const hairVol = HAIR_VOL,
    hairHang = HAIR_HANG,
    headPart = HEAD;
  const grp = (p: number) => (p === hairVol || p === hairHang ? headPart : p);
  const out = new Uint32Array(w * h);
  const T = 1.6;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const s = slot[i];
      if (s) {
        // the grid's own edge: a figure cut off there still gets its outline (in place of the pixel)
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          out[i] = line;
          continue;
        }
        // an inner separation where a nearer part overlaps this farther one: this part's shadow tone
        const d = depth[i] + T;
        const pi = grp(part[i]);
        let k = i + 1;
        let edge = slot[k] !== 0 && grp(part[k]) !== pi && depth[k] > d;
        k = i - 1;
        if (!edge) edge = slot[k] !== 0 && grp(part[k]) !== pi && depth[k] > d;
        k = i + w;
        if (!edge) edge = slot[k] !== 0 && grp(part[k]) !== pi && depth[k] > d;
        k = i - w;
        if (!edge) edge = slot[k] !== 0 && grp(part[k]) !== pi && depth[k] > d;
        out[i] = col[s][edge ? 0 : tone[i]];
        continue;
      }
      // the outline: one art pixel of #14121c around the whole figure (V2 C.1.3)
      const r = x + 1 < w && slot[i + 1],
        l = x > 0 && slot[i - 1],
        dn = y + 1 < h && slot[i + w],
        upk = y > 0 && slot[i - w];
      if (!(r || l || dn || upk)) continue;
      if (r && l && dn && upk) {
        // a pinhole inside the figure (between an arm and the body) is an inner separation, not
        // outline: the farthest neighbour's shadow tone
        let k = i + 1;
        for (const q of [i - 1, i + w, i - w]) if (depth[q] < depth[k]) k = q;
        out[i] = col[slot[k]][0];
      } else out[i] = line;
    }
  // the rim wins over the inner separations
  for (const i of rimmed) out[i] = col[SKIN][2];
  // no dithering (V2: none below 56 art px, and the shading never needs it above): a 2x2 checkerboard
  // of two tones of one material, which a curved surface can fall into by chance, takes one tone
  // (a fix can make a new checkerboard in a window already passed, so until none is left)
  const keep = new Set(rimmed);
  for (let pass = 0, changed = true; changed && pass < 8; pass++) {
    changed = false;
    for (let y = 0; y + 1 < h; y++)
      for (let x = 0; x + 1 < w; x++) {
        const i = y * w + x;
        const s = slot[i];
        if (!s || slot[i + 1] !== s || slot[i + w] !== s || slot[i + w + 1] !== s) continue;
        if (out[i] !== out[i + w + 1] || out[i + 1] !== out[i + w] || out[i] === out[i + 1]) continue;
        for (const [k, from] of [[i + 1, i], [i + w, i], [i, i + 1], [i + w + 1, i + 1]])
          if (!keep.has(k)) {
            out[k] = out[from];
            changed = true;
            break;
          }
      }
  }
  // an outline pixel boxed in on all four sides (a concave corner, a gap two pixels wide between a limb
  // and the body) reads as a black line inside the figure, and doubles the outline at corners: it
  // takes the farthest body neighbour's shadow tone, so corners turn on the diagonal
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (out[i] !== line || slot[i] || !out[i - 1] || !out[i + 1] || !out[i - w] || !out[i + w]) continue;
      let k = -1;
      for (const q of [i - 1, i + 1, i - w, i + w, i - w - 1, i - w + 1, i + w - 1, i + w + 1]) if (slot[q] && (k < 0 || depth[q] < depth[k])) k = q;
      if (k >= 0) out[i] = col[slot[k]][0];
    }
  return { w, h, px: out, ax: ox, ay: oy, handL: { x: ox + hl.x, y: oy + hl.y }, handR: { x: ox + hr.x, y: oy + hr.y }, top, slot, part };
}

/**
 * The arms set out from the spine so they hang outside the drawn torso (a heavy man's torso is wider
 * than his rig's shoulders): each arm moves sideways along the shoulder line, whole, so no bone
 * changes length. `reach` is the wanted distance from the spine to each shoulder, a share of height.
 */
function armsOut(j: Joints, reach: number): Joints {
  const dx = j.shR.x - j.shL.x,
    dy = j.shR.y - j.shL.y,
    dz = j.shR.z - j.shL.z;
  const span = Math.hypot(dx, dy, dz);
  const push = reach - span / 2;
  if (push <= 1e-4 || span < 1e-6) return j;
  const u = { x: (dx / span) * push, y: (dy / span) * push, z: (dz / span) * push };
  const move = (q: V3, k: number): V3 => ({ x: q.x + u.x * k, y: q.y + u.y * k, z: q.z + u.z * k });
  return { ...j, shL: move(j.shL, -1), elL: move(j.elL, -1), wrL: move(j.wrL, -1), handL: move(j.handL, -1), shR: move(j.shR, 1), elR: move(j.elR, 1), wrR: move(j.wrR, 1), handR: move(j.handR, 1) };
}

/** A raster on a canvas of its own size. */
export function toSprite(r: Raster): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = r.w;
  canvas.height = r.h;
  // (a phone out of canvas memory hands back no context: the sprite stays blank, and the caller
  // is told so it can let go of old drawings)
  const g = canvas.getContext('2d');
  if (!g) throw new CanvasOut();
  g.putImageData(new ImageData(new Uint8ClampedArray(r.px.buffer), r.w, r.h), 0, 0);
  return { canvas, ax: r.ax, ay: r.ay, handL: r.handL, handR: r.handR, top: r.top };
}

/** The neutral default skin and hair, for any player without a curated look (never a guess from a name, team or nationality). */
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
