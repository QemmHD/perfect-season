// A player's head in pixel art (studio overhaul players-4, V2 C.1.4 and C.5 rule 2): the skull, the
// face, the 18 hair silhouettes, facial hair, head gear, goggles and the mouthguard, and the football
// helmet with its centre stripe, visor and the hair that shows out of the back of it. Painted into the
// body's pixel grid (raster.ts) with the same depth test, so a near arm still passes in front of it.
//
// Hair is drawn the way the eye reads it at 20-60 px: as a change to the head's outline. Every style
// but bald stands at least one art pixel off the skull on two sides (V2 C.5 rule 2), so a buzz cut, a
// high top and an afro are three different shapes before they are three different colours. Below 24
// art px the 18 styles collapse to four silhouettes, and facial hair goes below 20 except a full beard
// (appearance.ts `lodHair`, `lodFacial`).
//
// Directions: `frame.fwd`, `frame.up` and `frame.right` are his forward, up and right as screen
// directions (x right, y up, z toward us), so a surface normal tells which part of his head a pixel is.
import { type Facial, type Eyes, type Hair, type Head, type HelmetHair, lodFacial, lodHair } from './appearance';
import type { Look } from './body';
import { ball, type Buf, capsule } from './raster';
import type { P2 } from './rig';
import { BAND, BUZZ, EYE, FRAME, HAIR, HAIR_HANG, HAIR_VOL, HEAD, HELMET, LENS, MASK, MOUTH, SKIN, SKINDARK, STRIPE, STUBBLE, TORSO } from './slots';

export interface Dir {
  x: number;
  y: number;
  z: number;
}

/** The head's orientation on screen, and its width over its height (whole columns over whole rows). */
export interface HeadFrame {
  fwd: Dir;
  up: Dir;
  right: Dir;
  hw: number;
}

/** What the head shows at this size: the record's traits after level of detail. */
export interface HeadTraits {
  hair: Hair;
  facial: Facial;
  head: Head;
  eyes: Eyes;
  mouthguard: boolean;
  helmetHair: HelmetHair;
}

/** The legacy look codes (galleries and looks built by hand): 0 short, 1 buzz, 2 high top, 3 bald, 4 headband, 5 locs. */
const LEGACY_HAIR: Hair[] = ['short', 'buzz', 'hightop', 'bald', 'band-bound', 'locs-long'];

/** The four silhouettes small sprites keep, as the style each one draws. */
const LOD_STYLE: Record<string, Hair> = { none: 'bald', cap: 'short', tall: 'hightop', long: 'flow' };

/** A look's head traits at `detail` art px (the sprite's height). */
export function headTraits(look: Look, detail: number): HeadTraits {
  const a = look.app;
  const hair0: Hair = a ? a.hair : (LEGACY_HAIR[look.hair] ?? 'short');
  const lod = lodHair(hair0, detail);
  const hair = (LOD_STYLE[lod] ?? lod) as Hair;
  const facial0: Facial = a ? a.facial : look.beard ? 'short' : 'none';
  return {
    hair,
    facial: lodFacial(facial0, detail),
    head: a ? (a.hair === 'band-bound' && a.head === 'none' ? 'band' : a.head) : look.hair === 4 ? 'band' : 'none',
    eyes: a ? a.eyes : 'none',
    mouthguard: !!a?.mouthguard && detail >= 24,
    helmetHair: a?.helmetHair ?? 'none',
  };
}

/** A small, steady per-pixel hash (curl bumps): the same pixels every frame, so nothing shimmers. */
function bump(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Paint the head at `head` (offset from the grid origin ox, oy), `hr` art px tall from its centre to
 * the crown. `detail` is the sprite's art px height (level of detail). `sec` is the hair's lag behind
 * the head, in art px (secondary motion: long hair, locs and ponytails trail it).
 */
export function paintHead(b: Buf, ox: number, oy: number, head: P2, hr: number, frame: HeadFrame, look: Look, detail: number, sec?: { x: number; y: number }) {
  const t = headTraits(look, detail);
  const { fwd, up, right, hw } = frame;
  // a point on or around the head: `f`, `u`, `r` head radii forward, up and to his right, and `dd`
  // extra depth (negative: behind)
  const at = (f: number, u: number, r = 0, dd = 0): P2 => ({
    x: head.x + (fwd.x * f + up.x * u + right.x * r) * hr,
    y: head.y - (fwd.y * f + up.y * u + right.y * r) * hr,
    d: head.d + (fwd.z * f + up.z * u + right.z * r) * hr + dd,
  });
  const lag = (p: P2): P2 => (sec ? { x: p.x + sec.x, y: p.y + sec.y, d: p.d } : p);
  const onHead = (nx: number, ny: number, nz: number) => ({
    f: nx * fwd.x + ny * fwd.y + nz * fwd.z,
    u: nx * up.x + ny * up.y + nz * up.z,
    r: nx * right.x + ny * right.y + nz * right.z,
  });
  /**
   * A shell of hair or gear `px` art px off the skull (centre shifted `du` radii up, `df` forward),
   * behind it. A close crop (scale 1) stands off the crown and the back of the head but never past the
   * skull's own width, so the head box stays V2's box with hair; an afro (scale > 1) is wider on purpose.
   */
  const shell = (px: number, du: number, df: number, slotAt: (f: number, u: number, r: number, x: number, y: number) => number, scale = 1, lift = true) => {
    const R = hr * scale + px;
    const sx = (hr * hw * scale + px) / R;
    // on a big head (a near player, a replay, the card) a crop stands a pixel higher over the crown
    // than at the sides: V2's 12x13 box with hair is a row taller than it is wide
    const crown = lift && scale === 1 && hr >= 4.5 ? 1 / hr : 0;
    const c = at(df, du + crown, 0, -hr * 0.9);
    // a crop's pixels stay inside the skull's own columns on a small head, one column out on a big one
    // (V2's head box with hair: the skull and a pixel of hair each side from about 40 art px)
    const wide = hr * hw + (hr >= 4.5 ? 1 : 0);
    const mid = ox + head.x;
    ball(b, ox, oy, c, R, (nx, ny, nz, x, y) => {
      if (scale === 1 && Math.abs(x + 0.5 - mid) > wide) return 0;
      const o = onHead(nx, ny, nz);
      return slotAt(o.f, o.u, o.r, x, y);
    }, HAIR_VOL, sx);
  };
  // hair hanging behind the head lies on his back: seen from behind, it covers the torso
  const onBack = fwd.z < -0.05 ? TORSO : -1;
  const strand = (a: P2, c: P2, ra: number, rb: number, slot = HAIR) => capsule(b, ox, oy, a, lag(c), ra, rb, () => slot, HAIR_HANG, -0.05, onBack);

  if (look.sport === 'nfl') {
    paintHelmet(b, ox, oy, head, hr, frame, t, at, strand);
    return;
  }

  // ---- the hair standing off the skull: the silhouette (C.5 rule 2) ----
  const gear = t.head === 'wrap' || t.head === 'skullcap';
  const hairOrGear = gear ? BAND : HAIR;
  const band = t.head === 'band';
  // the band's height on the head, all the way round
  const inBand = (u: number) => band && u > 0.42 && u < 0.66;
  const topBack = (lo: number) => (f: number, u: number) => u > lo || (f < -0.4 && u > -0.35);
  const plain = (lo: number, slot: number) => (f: number, u: number) => (topBack(lo)(f, u) ? (inBand(u) ? BAND : slot) : 0);
  const thin = Math.max(0.6, hr * 0.16);
  switch (t.hair) {
    case 'bald':
      if (gear) shell(1, 0, 0, plain(0.45, BAND));
      break;
    case 'buzz':
      shell(1, 0, 0, plain(0.32, gear ? BAND : BUZZ), 1, false);
      break;
    case 'short':
    case 'band-bound':
      shell(t.hair === 'short' ? 1 : 1.3, 0.06, 0, plain(0.3, hairOrGear));
      break;
    case 'receding':
      shell(1, 0, -0.08, plain(0.5, hairOrGear));
      break;
    case 'fade':
      // volume on top, a forward lift at the front, the sides cut close
      shell(1.2, 0.08, 0.06, (_f, u) => (u > 0.5 ? (inBand(u) ? BAND : hairOrGear) : 0));
      break;
    case 'cornrows':
    case 'braids':
      shell(1, 0, 0, (f, u, _r, x) => (topBack(0.3)(f, u) ? (inBand(u) ? BAND : gear ? BAND : x % 2 ? HAIR : BUZZ) : 0));
      if (t.hair === 'braids')
        for (const s of [-0.45, 0.45]) strand(at(-0.9, -0.1, s), at(-1.05, -1.6, s * 1.2), thin, thin * 0.8);
      break;
    case 'curly-top':
      // a crop of curls on top, its edge bumpy, the sides faded
      shell(1.6, 0.06, 0.05, (_f, u, _r, x, y) => {
        if (u <= 0.36) return 0;
        if (inBand(u)) return BAND;
        return u > 0.6 && bump(x, y) < 0.3 ? 0 : hairOrGear;
      });
      shell(1, 0, 0, plain(0.3, BUZZ), 1, false);
      break;
    case 'mohawk': {
      // a ridge of hair over the crown from the brow to the nape, the sides faded to stubble
      const ridge = Math.max(0.9, hr * 0.3);
      shell(1, 0, 0, (_f, u, r) => (u > 0.2 && Math.abs(r) > 0.35 ? BUZZ : 0), 1, false);
      capsule(b, ox, oy, at(0.6, 0.9, 0, -0.2), at(-0.95, 0.55, 0, -0.2), ridge, ridge * 0.85, () => HAIR, HAIR_VOL, 0);
      capsule(b, ox, oy, at(0.35, 1.05, 0, -0.3), at(-0.4, 1.15, 0, -0.3), ridge * 0.95, ridge * 0.8, () => HAIR, HAIR_VOL, 0);
      break;
    }
    case 'hightop': {
      // a flat-topped block on the crown, set behind the skull so the face and hairline stay whole
      const top = at(-0.1, 0.7, 0, -hr * 0.9);
      capsule(b, ox, oy, top, { ...top, y: top.y - hr * 0.55 }, hr * hw * 0.88, hr * hw * 0.85, (q) => (inBand(0.5) && q < 0.08 ? BAND : HAIR), HAIR_VOL, 0.1);
      shell(1, 0, 0, plain(0.3, hairOrGear));
      break;
    }
    case 'afro':
    case 'afro-big': {
      const big = t.hair === 'afro-big';
      shell(0.5, big ? 0.3 : 0.2, -0.05, (f, u) => (f > 0.5 && u < 0.4 ? 0 : u < (big ? -0.55 : -0.3) ? 0 : inBand(u - 0.08) ? BAND : HAIR), big ? 1.55 : 1.28);
      break;
    }
    case 'locs-short':
    case 'locs-long': {
      const long = t.hair === 'locs-long';
      shell(1, 0.04, 0, plain(0.28, hairOrGear));
      // locs hang from the crown's edge round the sides and the back: to the jaw, or past the shoulders
      const ends = long ? -1.75 : -0.55;
      for (const [f, r] of [[-0.85, 0], [-0.55, -0.7], [-0.55, 0.7], [-0.1, -0.92], [-0.1, 0.92]] as const)
        strand(at(f, 0.25, r, -0.25), at(f * 1.2 - 0.1, ends, r * 1.05), thin * 1.1, thin * 0.9);
      break;
    }
    case 'ponytail':
    case 'bun': {
      shell(1, 0.04, 0, plain(0.3, hairOrGear));
      if (t.hair === 'bun') ball(b, ox, oy, at(-0.45, 0.95, 0, -0.2), Math.max(1, hr * 0.38), () => HAIR, HAIR_VOL);
      else {
        const knot = at(-1.0, 0.15, 0, -0.2);
        ball(b, ox, oy, knot, Math.max(0.9, hr * 0.3), () => HAIR, HAIR_VOL);
        strand(knot, at(-1.1, -1.2, 0, -0.3), Math.max(0.8, hr * 0.26), thin);
      }
      break;
    }
    case 'flow': {
      // long hair: volume over the crown and the ears, falling behind the neck to the shoulders
      shell(1.2, 0.05, -0.05, (f, u) => (u > 0.25 || (f < 0.2 && u > -0.6) ? (inBand(u) ? BAND : hairOrGear) : 0));
      strand(at(-0.6, 0.1, 0, -0.3), at(-1.05, -1.45, 0), hr * 0.8, hr * 0.6);
      break;
    }
  }

  // ---- the skull, the face and what is painted on it ----
  const hairline = (f: number) => (t.hair === 'receding' ? 0.6 + 0.32 * Math.max(0, f) : 0.4 + 0.24 * f);
  const sides = t.hair === 'fade' || t.hair === 'curly-top' || t.hair === 'mohawk';
  const scalp = (f: number, u: number, r: number, x: number): number => {
    if (t.hair === 'bald') return 0;
    if (t.hair === 'mohawk') return Math.abs(r) < 0.3 && u > 0.2 ? HAIR : 0;
    const covered = u > hairline(f) || (f < -0.5 && u > -0.3) || (t.hair === 'flow' && Math.abs(r) > 0.7 && u > -0.3 && f < 0.3);
    if (!covered) return 0;
    if (t.hair === 'buzz') return BUZZ;
    if (sides && u < 0.62) return BUZZ;
    if (t.hair === 'cornrows' || t.hair === 'braids') return x % 2 ? HAIR : BUZZ;
    return HAIR;
  };
  const beardTone = t.facial === 'stubble' ? STUBBLE : HAIR;
  const beard = (f: number, u: number, ar: number): boolean => {
    switch (t.facial) {
      case 'goatee':
        return f > 0.45 && ((u < -0.5 && ar < 0.34) || (u > -0.46 && u < -0.32 && ar < 0.36 && f > 0.66));
      case 'mustache':
        return f > 0.62 && u > -0.47 && u < -0.31 && ar < 0.38;
      case 'chinstrap':
        return f > 0.05 && ((u < -0.18 && ar > 0.58 && ar < 0.9) || u < -0.76);
      case 'short':
        return f > 0.2 && u < -0.3 && ar < 0.8;
      case 'stubble':
        return f > 0.15 && u < -0.24 && ar < 0.86;
      case 'full':
      case 'long':
        return f > 0.08 && (u < -0.2 ? ar < 0.92 : ar > 0.74 && u < 0.18);
      default:
        return false;
    }
  };
  const goggles = t.eyes === 'goggles';
  const big = hr >= 4.5;
  ball(
    b,
    ox,
    oy,
    head,
    hr,
    (nx, ny, nz, x) => {
      const { f, u, r } = onHead(nx, ny, nz);
      const ar = Math.abs(r);
      if (goggles) {
        if (f > 0.3 && u > -0.06 && u < 0.32 && ar < 0.72) return f > 0.55 && ar > 0.08 && ar < 0.6 && u > 0 && u < 0.28 ? LENS : FRAME;
        if (f <= 0.3 && u > 0.06 && u < 0.22) return FRAME;
      }
      if (inBand(u)) return BAND;
      if (gear && u > 0.36 + 0.1 * f) return BAND;
      if (f > 0.45) {
        // the eyes and brows: a band on a small head; two eyes with skin between and thin brows on a
        // big one (a near player, a replay, the card)
        if (big ? u > 0.02 && u < 0.22 && ar > 0.2 && ar < 0.52 : u > -0.02 && u < 0.26 && ar > 0.1 && ar < 0.56) return EYE;
        // the brows in his hair colour (a bald man's in the skin's shadow)
        if (big ? u >= 0.3 && u < 0.4 && ar > 0.16 && ar < 0.58 : u >= 0.26 && u < 0.42 && ar > 0.08 && ar < 0.6) return t.hair === 'bald' ? SKINDARK : HAIR;
        if (t.mouthguard && f > 0.66 && u > -0.62 && u < -0.4 && ar < 0.24) return MOUTH;
      }
      if (beard(f, u, ar)) return beardTone;
      if (f > 0.68 && ar < 0.3 && u > -0.6 && u < -0.38) return SKINDARK;
      // the ears (a flow of hair covers them)
      if (ar > 0.8 && Math.abs(u) < 0.24 && f > -0.35 && f < 0.32) return t.hair === 'flow' ? HAIR : SKINDARK;
      return scalp(f, u, r, x) || SKIN;
    },
    HEAD,
    hw,
    TORSO
  );
  // a long beard below the chin
  if (t.facial === 'long') strand(at(0.55, -0.85, 0, 0.2), at(0.5, -1.35, 0, 0.2), Math.max(0.8, hr * 0.3), Math.max(0.6, hr * 0.2));
}

type At = (f: number, u: number, r?: number, dd?: number) => P2;
type Strand = (a: P2, c: P2, ra: number, rb: number, slot?: number) => void;

/** The football helmet: a shell in the helmet colour, the centre stripe, the mask, the visor, and the hair below it. */
function paintHelmet(b: Buf, ox: number, oy: number, head: P2, hr: number, frame: HeadFrame, t: HeadTraits, at: At, strand: Strand) {
  const { fwd, up, right } = frame;
  const hc: P2 = { x: head.x, y: head.y - hr * 0.1, d: head.d };
  const r = hr * 1.2;
  const visor = t.eyes === 'visor-clear' || t.eyes === 'visor-dark' || t.eyes === 'visor-tint';
  ball(
    b,
    ox,
    oy,
    hc,
    r,
    (nx, ny, nz) => {
      const f = nx * fwd.x + ny * fwd.y + nz * fwd.z;
      const u = nx * up.x + ny * up.y + nz * up.z;
      const rt = nx * right.x + ny * right.y + nz * right.z;
      // the visor across the eyes, inside the mask's cage
      if (visor && f > 0.5 && u > -0.05 && u < 0.3 && Math.abs(rt) < 0.62) return LENS;
      // the facemask: bars across the front, low
      if (f > 0.55 && u < 0.25) return MASK;
      // the stripe down the middle of the crown; the sides stay blank (no logos)
      if (Math.abs(rt) < 0.17 && u > 0.1 && f < 0.6) return STRIPE;
      return HELMET;
    },
    HEAD,
    1,
    // the helmet sits on the shoulder pads: it always covers them, so the pads never swallow it
    TORSO
  );
  // the face behind the mask, where it shows (front-on views); a clear visor shows it too, with a glint
  if (fwd.z > 0.2 && t.eyes !== 'visor-dark' && t.eyes !== 'visor-tint') {
    const fx = Math.round(ox + hc.x + fwd.x * r * 0.55);
    const fy = Math.round(oy + hc.y - fwd.y * r * 0.55 + r * 0.05);
    for (const dx of [-1, 0, 1]) {
      const i = fy * b.w + fx + dx;
      if (i < 0 || i >= b.slot.length) continue;
      if (b.slot[i] === MASK || (b.slot[i] === LENS && dx !== -1)) b.slot[i] = SKIN;
    }
  }
  // hair out of the back of the helmet (locs, a flow, curls at the nape)
  const thin = Math.max(0.6, hr * 0.18);
  switch (t.helmetHair) {
    case 'locs':
      // down the back, and over each shoulder pad, where they show from the front too
      for (const s of [-0.4, 0, 0.4]) strand(at(-1.05, -0.6, s), at(-1.2, -1.9, s * 1.3), thin, thin * 0.85);
      for (const s of [-1, 1]) strand(at(-0.45, -0.7, s * 0.95), at(-0.35, -1.75, s * 1.15), thin, thin * 0.85);
      break;
    case 'flow':
      strand(at(-1.0, -0.5, 0), at(-1.2, -1.5, 0), Math.max(0.9, hr * 0.5), Math.max(0.7, hr * 0.35));
      break;
    case 'curly':
      strand(at(-1.05, -0.65, 0), at(-1.1, -1.05, 0), Math.max(1, hr * 0.42), Math.max(0.9, hr * 0.36));
      break;
    default:
      break;
  }
}
