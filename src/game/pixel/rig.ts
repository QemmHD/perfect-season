// A player's skeleton: joint angles (a pose) turned into points on screen. The body is a small 3D
// figure seen by an orthographic camera tilted down by `pitch`, so the same pose can face any way
// (side-on on a basketball court, from above on a football field) and every player's limbs scale
// with his real height and build.
//
// Units: the player's height is 1. Local axes: x forward (the way he faces), y up, z to his right.
// World axes: X screen-right, Y up, Z toward the viewer.

export interface Pose {
  /** spine tilt forward (radians) */
  lean: number;
  /** spine tilt to the side (radians, + to his right) */
  side?: number;
  /** pelvis drop, a share of height (a crouch, a landing) */
  crouch: number;
  /** off the floor, a share of height */
  lift: number;
  /** thigh angles (0 hanging, + forward) and knee bends (+ shin back) */
  hipL: number;
  kneeL: number;
  hipR: number;
  kneeR: number;
  /** legs spread sideways (radians each) */
  spread?: number;
  /** upper-arm angles (0 hanging, + forward, PI straight up) and elbow bends (+ forearm forward) */
  shL: number;
  elL: number;
  shR: number;
  elR: number;
  /** arms raised out to the side (radians) */
  abL?: number;
  abR?: number;
  /** shoulders turned relative to the hips (radians, + toward his left) */
  twist?: number;
  /** head tipped back (+) or down (-) */
  nod?: number;
}

export const STAND: Pose = { lean: 0.04, crouch: 0, lift: 0, hipL: 0.05, kneeL: 0.08, hipR: -0.03, kneeR: 0.06, shL: 0.12, elL: 0.35, shR: -0.06, elR: 0.3, abL: 0.12, abR: 0.12 };

/** Blend two poses (t from 0 to 1). */
export function blend(a: Pose, b: Pose, t: number): Pose {
  const out = { ...a } as Record<string, number>;
  const bb = b as unknown as Record<string, number>;
  const aa = a as unknown as Record<string, number>;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = (aa[k] ?? 0) + ((bb[k] ?? 0) - (aa[k] ?? 0)) * t;
  return out as unknown as Pose;
}

/** Body proportions: lengths as shares of height, widths scaled by build. */
export interface Build {
  /** inches */
  ht: number;
  /** pounds */
  wt: number;
}

export interface Shape {
  hipY: number;
  spine: number;
  neck: number;
  headR: number;
  thigh: number;
  shin: number;
  foot: number;
  upper: number;
  fore: number;
  hand: number;
  shoulderW: number;
  hipW: number;
  /** limb thickness (radii) */
  rThigh: number;
  rShin: number;
  rUpper: number;
  rFore: number;
  rTorso: number;
  /** body mass: heavier players are thicker everywhere */
  bulk: number;
}

/**
 * Proportions for a build. Taller players get relatively longer limbs and a slightly smaller head
 * (a 7-footer is all legs and arms); heavier players (for their height) get thicker limbs and torso.
 * `pads` widens the shoulders for football.
 */
export function shapeOf(b: Build, pads = 0): Shape {
  const tall = Math.max(-1, Math.min(1, (b.ht - 78) / 8));
  // body-mass index-like bulk: 1 for a lean 6'6" 215, up to ~1.45 for a 6'4" 320 lineman
  const bmi = (b.wt / (b.ht * b.ht)) * 703;
  const bulk = Math.max(0.85, Math.min(1.5, bmi / 24.5));
  // stylized, the way sports pixel art reads on a phone: a big head, broad shoulders, thick limbs.
  // A taller player's head is a smaller share of him, so a center towers over a guard.
  const headR = (pads ? 0.088 : 0.084) - tall * 0.006;
  const leg = 1 + tall * 0.03;
  return {
    hipY: 0.47 + tall * 0.012,
    spine: 0.255 - tall * 0.004,
    neck: 0.03,
    headR,
    thigh: 0.225 * leg,
    shin: 0.21 * leg,
    foot: 0.075,
    upper: 0.158 + tall * 0.004,
    fore: 0.142 + tall * 0.005,
    hand: 0.05,
    shoulderW: (0.128 + pads * 0.035) * (0.84 + 0.16 * bulk),
    hipW: 0.07 * (0.82 + 0.18 * bulk),
    rThigh: 0.054 * bulk,
    rShin: 0.04 * (0.85 + 0.15 * bulk),
    rUpper: (0.039 + pads * 0.006) * (0.82 + 0.18 * bulk),
    rFore: 0.033 * (0.85 + 0.15 * bulk),
    rTorso: 0.082 * (0.78 + 0.22 * bulk),
    bulk,
  };
}

export interface V3 {
  x: number;
  y: number;
  z: number;
}

/** The joints, in the player's own space. */
export interface Joints {
  pelvis: V3;
  chest: V3;
  neck: V3;
  head: V3;
  hipL: V3;
  hipR: V3;
  kneeL: V3;
  kneeR: V3;
  ankleL: V3;
  ankleR: V3;
  toeL: V3;
  toeR: V3;
  shL: V3;
  shR: V3;
  elL: V3;
  elR: V3;
  wrL: V3;
  wrR: V3;
  handL: V3;
  handR: V3;
}

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const scale = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);

/** a direction from a pitch angle in the body's front-back plane (0 = down, + = forward) */
const down = (a: number): V3 => v(Math.sin(a), -Math.cos(a), 0);

export function joints(p: Pose, s: Shape): Joints {
  const py = s.hipY - p.crouch + p.lift;
  const pelvis = v(0, py, 0);
  const spread = p.spread ?? 0;
  // legs: thigh then shin, each in the front-back plane, spread sideways a little
  const leg = (side: 1 | -1, hip: number, knee: number) => {
    const h = v(0, py, side * s.hipW);
    const sp = side * spread;
    const d1 = down(hip);
    const thighDir = v(d1.x * Math.cos(sp), d1.y * Math.cos(sp), Math.sin(sp));
    const k = add(h, scale(thighDir, s.thigh));
    const d2 = down(hip - knee);
    const shinDir = v(d2.x * Math.cos(sp), d2.y * Math.cos(sp), Math.sin(sp) * 0.6);
    const a = add(k, scale(shinDir, s.shin));
    // the foot stays roughly flat, pointing forward, tipping with a big knee bend
    const tip = Math.max(-0.6, Math.min(0.9, (hip - knee) * 0.5));
    const toe = add(a, v(Math.cos(tip) * s.foot, -Math.sin(tip) * s.foot * 0.4 - 0.004, 0));
    return { h, k, a, toe };
  };
  const L = leg(-1, p.hipL, p.kneeL);
  const R = leg(1, p.hipR, p.kneeR);
  // the upper body: the spine leans forward (and to the side), the shoulders twist
  const lean = p.lean;
  const side = p.side ?? 0;
  const twist = p.twist ?? 0;
  const up = v(Math.sin(lean) * Math.cos(side), Math.cos(lean) * Math.cos(side), Math.sin(side));
  const chest = add(pelvis, scale(up, s.spine));
  const neck = add(chest, scale(up, s.neck));
  const nod = p.nod ?? 0;
  const head = add(neck, v(Math.sin(lean - nod * 0.5) * s.headR * 0.9 + s.headR * 0.12, Math.cos(lean) * s.headR * 0.95, 0));
  // shoulders: across the chest, turned by the twist
  const across = v(Math.sin(twist), 0, Math.cos(twist));
  const shoulderAt = add(pelvis, scale(up, s.spine * 0.9));
  const shL = add(shoulderAt, scale(across, -s.shoulderW));
  const shR = add(shoulderAt, scale(across, s.shoulderW));
  const arm = (shp: V3, side: 1 | -1, sh: number, el: number, ab: number) => {
    // the arm's pitch is measured from the leaning spine, so a leaning player's hanging arms lean too
    const pitch = sh + lean * 0.6;
    const d = down(pitch);
    const out = side * Math.sin(ab);
    const c = Math.cos(ab);
    const upperDir = v(d.x * c, d.y * c, out);
    const e = add(shp, scale(upperDir, s.upper));
    const d2 = down(pitch + el);
    const foreDir = v(d2.x * c, d2.y * c, out * 0.7);
    const w = add(e, scale(foreDir, s.fore));
    const hnd = add(w, scale(foreDir, s.hand));
    return { e, w, hnd };
  };
  const AL = arm(shL, -1, p.shL, p.elL, p.abL ?? 0.1);
  const AR = arm(shR, 1, p.shR, p.elR, p.abR ?? 0.1);
  return {
    pelvis,
    chest,
    neck,
    head,
    hipL: L.h,
    hipR: R.h,
    kneeL: L.k,
    kneeR: R.k,
    ankleL: L.a,
    ankleR: R.a,
    toeL: L.toe,
    toeR: R.toe,
    shL,
    shR,
    elL: AL.e,
    elR: AR.e,
    wrL: AL.w,
    wrR: AR.w,
    handL: AL.hnd,
    handR: AR.hnd,
  };
}

/** The camera: which way the player faces (radians: 0 screen-right, PI/2 toward the viewer) and how far it looks down. */
export interface View {
  facing: number;
  pitch: number;
}

/** A point on screen: x right, y down (pixels from the feet), and depth (bigger = nearer the viewer). */
export interface P2 {
  x: number;
  y: number;
  d: number;
}

export function project(j: V3, view: View, px: number): P2 {
  const c = Math.cos(view.facing);
  const s = Math.sin(view.facing);
  // body space to world: forward = (c, 0, s), right = (-s, 0, c)
  const X = j.x * c - j.z * s;
  const Y = j.y;
  const Z = j.x * s + j.z * c;
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  return { x: X * px, y: -(Y * cp - Z * sp) * px, d: (Z * cp + Y * sp) * px };
}

/** the direction the player faces, in world space, toward the viewer component (+1 facing us, -1 back to us) */
export function frontness(view: View): number {
  return Math.sin(view.facing);
}
