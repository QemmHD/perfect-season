// Real motion capture on our pixel players. The clips (src/data/mocap, built by
// scripts/build_mocap.py from the CMU Graphics Lab Motion Capture Database) hold, for every frame
// at 30 fps, the direction of each bone in the body's own frame (rig.ts axes: x forward, y up, z to
// his right) and a root track: how far the body travelled and turned over the ground, and how high
// his feet were off the floor. Playing a clip on a player keeps every bone's recorded direction
// and uses that player's own bone lengths (shapeOf), so a 6'1" guard and a 7'0" center shoot the
// same recorded jump shot each with his own limbs, feet on the floor.
//
// Clips load lazily (each is its own small file); the index (durations, events, root motion) is
// here up front, so a game can plan with the metadata before the frames arrive. Every clip faces
// +x (the body's forward, the way the game's `facing` points); clips ending in _l / _m are the
// left-right mirrors of their twins, made at load.
//
// The jump shot, released exactly when the game says (T seconds after the shot starts):
//
//   await loadClips(['jumpshot', 'fall_back'])                      // once, before tip-off
//   const clipT = warp(clipMeta('jumpshot'), { release: T })(since) // since = now - shot start
//   const f = frameAt('jumpshot', clipT)                            // a whole frame (cacheable)
//   const key = id + '|' + mocapKey('jumpshot', f, 'pin') + '|' + facing16 + '|' + px
//   sprite = cache.get(key) ?? drawBody(look, mocapJoints('jumpshot', f, look, { ground: 'pin' }), view, px)
//   // 'pin' keeps his feet on the floor so the game raises the sprite by its own jump height
//   // (or 'clip' to use the recorded jump); sprite.handR is where the ball is at the release
//
// A defender knocked backward by contact at time t0 (facing the man who hit him):
//
//   const t = now - t0, f = frameAt('fall_back', t)
//   sprite = drawBody(look, mocapJoints('fall_back', f, look), view, px)
//   const r = rootAt('fall_back', t, heightFt)  // optional slide: r.forward (negative: back)
//   if (t >= clipMeta('fall_back').events.impact) ... // the thud, the shake; .ground: lying still
//   // then 'getup' (from his back), or hold the last frame: one-shot clips hold their end
import INDEX from '../../data/mocap/index.json';
import { type Look, shapeFor } from './body';
import type { Joints, Shape, V3 } from './rig';

/** A human's hip-to-ankle length as a share of his height: the clips measure in leg lengths. */
export const LEG_PER_HEIGHT = 0.48;

export const BONES = [
  'hipAxis',
  'thighL',
  'shinL',
  'footL',
  'thighR',
  'shinR',
  'footR',
  'spine',
  'neck',
  'shAxis',
  'upperL',
  'foreL',
  'handL',
  'upperR',
  'foreR',
  'handR',
] as const;
export type Bone = (typeof BONES)[number];
const NB = BONES.length;
const BI = Object.fromEntries(BONES.map((b, i) => [b, i])) as Record<Bone, number>;

export interface ClipMeta {
  /** CMU trial (subject_trial) */
  src: string;
  desc: string;
  frames: number;
  fps: number;
  /** seconds */
  duration: number;
  loop: boolean;
  /** 'fixed': every turn is in the pose; 'smooth': slow turning is in the root track instead */
  yaw: 'fixed' | 'smooth';
  /** named moments, seconds from the clip's start (release, takeoff, land, impact...) */
  events: Record<string, number>;
  /** repeated moments: dribble bounces, footfalls */
  beats?: Record<string, number[]>;
  /** the root motion over the whole clip (leg lengths, radians): travel forward (dx) and to his
   * right (dz) in the clip's starting facing, turn, average ground speed, highest lift */
  root: { dx: number; dz: number; turn: number; speed: number; peak: number };
  /** a loop's travel and turn per cycle */
  cycle?: { dx: number; dz: number; turn: number };
  /** the name a left-right mirrored copy goes by */
  mirror?: string;
  tags?: string[];
  /** set on a mirrored copy: the clip it mirrors */
  mirrorOf?: string;
}

interface ClipFile {
  name: string;
  src: string;
  bones: string[];
  frames: number;
  fps: number;
  data: string;
}

/** A loaded clip, decoded. */
export interface Clip {
  name: string;
  meta: ClipMeta;
  frames: number;
  fps: number;
  /** per frame: root x, z (leg lengths, in the clip's starting facing), yaw (radians), lift (feet
   * off the floor, leg lengths), pelvis height (leg lengths) */
  root: Float32Array;
  /** per frame: NB unit vectors (x, y, z) */
  dirs: Float32Array;
}

const META: Record<string, ClipMeta> = {};
for (const [name, m] of Object.entries(INDEX.clips as Record<string, ClipMeta>)) {
  META[name] = m;
  if (m.mirror) {
    const beats = m.beats ? { ...m.beats } : undefined;
    if (beats && (beats.stepL || beats.stepR)) [beats.stepL, beats.stepR] = [beats.stepR ?? [], beats.stepL ?? []];
    const cycle = m.cycle ? { dx: m.cycle.dx, dz: -m.cycle.dz, turn: -m.cycle.turn } : undefined;
    META[m.mirror] = { ...m, mirror: undefined, mirrorOf: name, beats, cycle, root: { ...m.root, dz: -m.root.dz, turn: -m.root.turn } };
  }
}

/** Every clip by name (mirrored copies included), with its metadata. */
export const CLIPS: Readonly<Record<string, ClipMeta>> = META;

export function clipMeta(name: string): ClipMeta {
  const m = META[name];
  if (!m) throw new Error('no mocap clip ' + name);
  return m;
}

const FILES = import.meta.glob<{ default: ClipFile }>(['../../data/mocap/*.json', '!../../data/mocap/index.json']);
const loaded = new Map<string, Clip>();
const loading = new Map<string, Promise<Clip>>();

function decode(name: string, meta: ClipMeta, f: ClipFile, mirror: boolean): Clip {
  const bin = atob(f.data);
  const n = f.frames;
  const per = 10 + NB * 3;
  if (bin.length !== n * per) throw new Error('mocap ' + name + ': bad data');
  const root = new Float32Array(n * 5);
  const dirs = new Float32Array(n * NB * 3);
  const u8 = (i: number) => bin.charCodeAt(i);
  const i16 = (i: number) => {
    const v = u8(i) | (u8(i + 1) << 8);
    return v >= 0x8000 ? v - 0x10000 : v;
  };
  const i8 = (i: number) => {
    const v = u8(i);
    return v >= 0x80 ? v - 0x100 : v;
  };
  // the bones a mirror swaps: each left bone takes its right twin's direction
  const twin = (b: Bone): Bone => (b.endsWith('L') ? ((b.slice(0, -1) + 'R') as Bone) : b.endsWith('R') ? ((b.slice(0, -1) + 'L') as Bone) : b);
  const swap = BONES.map((b) => BI[twin(b)]);
  for (let k = 0; k < n; k++) {
    const o = k * per;
    for (let c = 0; c < 5; c++) root[k * 5 + c] = i16(o + c * 2) / 1000;
    for (let b = 0; b < NB; b++) {
      const src = mirror ? swap[b] : b;
      let x = i8(o + 10 + src * 3) / 127;
      let y = i8(o + 10 + src * 3 + 1) / 127;
      let z = i8(o + 10 + src * 3 + 2) / 127;
      if (mirror) {
        // a mirror flips his right for his left; the hip and shoulder axes (left to right) also
        // turn round, since his left hip is now where his right was
        z = -z;
        if (BONES[b] === 'hipAxis' || BONES[b] === 'shAxis') {
          x = -x;
          y = -y;
          z = -z;
        }
      }
      const l = Math.hypot(x, y, z) || 1;
      dirs[(k * NB + b) * 3] = x / l;
      dirs[(k * NB + b) * 3 + 1] = y / l;
      dirs[(k * NB + b) * 3 + 2] = z / l;
    }
    if (mirror) {
      root[k * 5 + 1] = -root[k * 5 + 1];
      root[k * 5 + 2] = -root[k * 5 + 2];
    }
  }
  return { name, meta, frames: n, fps: f.fps, root, dirs };
}

/** Load a clip (and remember it): its file arrives on first use. */
export function loadClip(name: string): Promise<Clip> {
  const have = loaded.get(name);
  if (have) return Promise.resolve(have);
  let p = loading.get(name);
  if (!p) {
    const meta = clipMeta(name);
    const base = meta.mirrorOf ?? name;
    const file = FILES['../../data/mocap/' + base + '.json'];
    if (!file) return Promise.reject(new Error('no mocap file for ' + name));
    p = file().then((mod) => {
      const clip = decode(name, meta, mod.default, !!meta.mirrorOf);
      loaded.set(name, clip);
      loading.delete(name);
      return clip;
    });
    loading.set(name, p);
  }
  return p;
}

export function loadClips(names: string[]): Promise<Clip[]> {
  return Promise.all(names.map(loadClip));
}

/** A clip if it's loaded (games draw a fallback pose until it is). */
export function getClip(name: string): Clip | undefined {
  return loaded.get(name);
}

/** For tests and tools: decode a clip file directly. */
export function clipFromFile(f: ClipFile, meta: ClipMeta, mirror = false, name = f.name): Clip {
  return decode(name, meta, f, mirror);
}

// ---------- time ----------

/** Where in the clip a time falls, as a frame position (fractional), wrapping loops and holding the
 * last frame of the others. */
function framePos(clip: Clip, t: number): number {
  const f = t * clip.fps;
  if (clip.meta.loop) return ((f % clip.frames) + clip.frames) % clip.frames;
  return Math.max(0, Math.min(clip.frames - 1, f));
}

/** The whole frame nearest a time: sprites cache per (clip, frame). `step` (frames) coarsens it,
 * for a choppier pixel-art rate (2 = 15 fps). */
export function frameAt(clip: Clip | string, t: number, step = 1): number {
  const c = typeof clip === 'string' ? need(clip) : clip;
  const f = Math.round(framePos(c, t) / step) * step;
  return c.meta.loop ? f % c.frames : Math.min(c.frames - 1, f);
}

/** The stable cache key for a clip frame drawn a given way. */
export function mocapKey(clip: Clip | string, frame: number, ground: Ground = 'clip'): string {
  return 'mo:' + (typeof clip === 'string' ? clip : clip.name) + ':' + frame + (ground === 'pin' ? 'p' : '');
}

/**
 * A time warp: game time from the clip's start → clip time, so that each named event lands when
 * the game wants it (`{ release: 0.42 }`: the ball leaves his hand 0.42 s in). Between anchors the
 * clip plays at an even rate; after the last it plays at normal speed. If reaching the first anchor
 * would need playing faster than `maxRate`, the clip starts partway in instead (skipping some of
 * the wind-up); slower than `minRate`, it holds its first frame a moment first.
 */
export function warp(meta: ClipMeta, at: Record<string, number>, opts: { maxRate?: number; minRate?: number } = {}): (t: number) => number {
  const maxRate = opts.maxRate ?? 1.7;
  const minRate = opts.minRate ?? 0.5;
  const pts = Object.entries(at)
    .map(([ev, g]) => {
      const c = ev === 'end' ? meta.duration : ev === 'start' ? 0 : meta.events[ev];
      if (c === undefined) throw new Error(meta.src + ': no event ' + ev);
      return { c, g };
    })
    .sort((a, b) => a.c - b.c);
  if (!pts.length) return (t) => t;
  // the start: clip time 0 at game time 0, unless that would play the lead-in too fast or slow
  let c0 = 0;
  let g0 = 0;
  const first = pts[0];
  if (first.g <= 0) {
    c0 = first.c;
    g0 = first.g;
  } else if (first.c / first.g > maxRate) c0 = first.c - first.g * maxRate;
  else if (first.c / first.g < minRate) g0 = first.g - first.c / minRate;
  const knots = [{ c: c0, g: g0 }, ...pts.filter((p) => p.c > c0 + 1e-6 && p.g > g0 + 1e-6)];
  return (t: number) => {
    if (t <= knots[0].g) return knots[0].c;
    for (let i = 1; i < knots.length; i++) {
      const a = knots[i - 1];
      const b = knots[i];
      if (t <= b.g) return a.c + ((t - a.g) * (b.c - a.c)) / (b.g - a.g);
    }
    const last = knots[knots.length - 1];
    return last.c + (t - last.g);
  };
}

// ---------- frames ----------

export interface Frame {
  /** unit directions per bone, in the body frame */
  dirs: V3[];
  /** root travel (leg lengths, the clip's starting facing), turn (radians), feet off the floor
   * and pelvis height (leg lengths) */
  x: number;
  z: number;
  yaw: number;
  lift: number;
  pelvis: number;
}

function need(name: string): Clip {
  const c = loaded.get(name);
  if (!c) throw new Error('mocap clip ' + name + ' is not loaded');
  return c;
}

/** One stored frame, exactly. */
export function frame(clip: Clip | string, k: number): Frame {
  const c = typeof clip === 'string' ? need(clip) : clip;
  const i = Math.max(0, Math.min(c.frames - 1, Math.round(k)));
  const dirs: V3[] = [];
  for (let b = 0; b < NB; b++) {
    const o = (i * NB + b) * 3;
    dirs.push({ x: c.dirs[o], y: c.dirs[o + 1], z: c.dirs[o + 2] });
  }
  const r = i * 5;
  return { dirs, x: c.root[r], z: c.root[r + 1], yaw: c.root[r + 2], lift: c.root[r + 3], pelvis: c.root[r + 4] };
}

/** The motion at any time, between frames: directions blended and renormalized. Loops carry
 * their root travel on from cycle to cycle. */
export function sample(clip: Clip | string, t: number): Frame {
  const c = typeof clip === 'string' ? need(clip) : clip;
  const f = framePos(c, t);
  const i = Math.floor(f);
  const a = f - i;
  const j = c.meta.loop ? (i + 1) % c.frames : Math.min(c.frames - 1, i + 1);
  const A = frame(c, i);
  if (a < 1e-6) return withCycles(c, A, t);
  const B = frame(c, j);
  const dirs = A.dirs.map((d, k) => {
    const e = B.dirs[k];
    const x = d.x + (e.x - d.x) * a;
    const y = d.y + (e.y - d.y) * a;
    const z = d.z + (e.z - d.z) * a;
    const l = Math.hypot(x, y, z) || 1;
    return { x: x / l, y: y / l, z: z / l };
  });
  // a loop's last frame runs into the first of the next cycle: carry its travel on
  const wrap = c.meta.loop && j === 0 && c.meta.cycle;
  const bx = wrap ? B.x + c.meta.cycle!.dx : B.x;
  const bz = wrap ? B.z + c.meta.cycle!.dz : B.z;
  const by = wrap ? B.yaw + c.meta.cycle!.turn : B.yaw;
  const L = (p: number, q: number) => p + (q - p) * a;
  return withCycles(c, { dirs, x: L(A.x, bx), z: L(A.z, bz), yaw: L(A.yaw, by), lift: L(A.lift, B.lift), pelvis: L(A.pelvis, B.pelvis) }, t);
}

function withCycles(c: Clip, f: Frame, t: number): Frame {
  if (!c.meta.loop || !c.meta.cycle) return f;
  const n = Math.floor((t * c.fps) / c.frames);
  if (!n) return f;
  // (a loop's per-cycle travel, in its own starting facing; good for straight runs)
  return { ...f, x: f.x + n * c.meta.cycle.dx, z: f.z + n * c.meta.cycle.dz, yaw: f.yaw + n * c.meta.cycle.turn };
}

// ---------- retargeting ----------

/** 'clip': his feet leave the floor as they did in the recording (a jump goes up); 'pin': the
 * lowest foot stays on the floor (the game raises the sprite for its own jump). */
export type Ground = 'clip' | 'pin';

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const unit = (a: V3, fb: V3 = v(0, 1, 0)): V3 => {
  const l = Math.hypot(a.x, a.y, a.z);
  return l > 1e-9 ? mul(a, 1 / l) : fb;
};

/** the drawn shoe's radii at the ankle and toe (body.ts), as shares of height */
const SHOE_ANKLE = 0.024;
const SHOE_TOE = 0.02;

/**
 * A frame on a body: from the pelvis out, each bone along its recorded direction with this body's
 * length. Arms are kept out of the (stylized, thick) torso, and the body is set on the floor: in
 * 'clip' mode his feet are as far off it as in the recording (scaled to his legs), in 'pin' mode
 * the lowest foot touches it; either way nothing sinks through it.
 */
export function retarget(f: Frame, s: Shape, opts: { ground?: Ground } = {}): Joints {
  const d = f.dirs;
  const D = (b: Bone) => d[BI[b]];
  const O = v(0, 0, 0);
  const hipAx = D('hipAxis');
  const hipL = mul(hipAx, -s.hipW);
  const hipR = mul(hipAx, s.hipW);
  const kneeL = add(hipL, mul(D('thighL'), s.thigh));
  const ankleL = add(kneeL, mul(D('shinL'), s.shin));
  const toeL = add(ankleL, mul(D('footL'), s.foot));
  const kneeR = add(hipR, mul(D('thighR'), s.thigh));
  const ankleR = add(kneeR, mul(D('shinR'), s.shin));
  const toeR = add(ankleR, mul(D('footR'), s.foot));
  const up = D('spine');
  const chest = mul(up, s.spine);
  const neck = add(chest, mul(up, s.neck));
  const head = add(neck, mul(D('neck'), s.headR * 0.96));
  const shAt = mul(up, s.spine * 0.9);
  const shAx = D('shAxis');
  const shL = add(shAt, mul(shAx, -s.shoulderW));
  const shR = add(shAt, mul(shAx, s.shoulderW));
  // the torso's frame, to keep the arms out of it
  const right = unit(sub(shAx, mul(up, dot(shAx, up))), v(0, 0, 1));
  const fwd = cross(up, right);
  const arm = (sh: V3, upper: V3, fore: V3, hand: V3) => {
    let e = add(sh, mul(upper, s.upper));
    e = clearTorso(e, sh, s.upper, up, fwd, right, s, s.rUpper);
    let w = add(e, mul(fore, s.fore));
    w = clearTorso(w, e, s.fore, up, fwd, right, s, s.rFore);
    let h = add(w, mul(hand, s.hand));
    h = clearTorso(h, w, s.hand, up, fwd, right, s, s.rFore);
    return { e, w, h };
  };
  const AL = arm(shL, D('upperL'), D('foreL'), D('handL'));
  const AR = arm(shR, D('upperR'), D('foreR'), D('handR'));
  const j: Joints = {
    pelvis: O,
    chest,
    neck,
    head,
    hipL,
    hipR,
    kneeL,
    kneeR,
    ankleL,
    ankleR,
    toeL,
    toeR,
    shL,
    shR,
    elL: AL.e,
    elR: AR.e,
    wrL: AL.w,
    wrR: AR.w,
    handL: AL.h,
    handR: AR.h,
  };
  // on the floor
  const feet = Math.min(ankleL.y - SHOE_ANKLE, toeL.y - SHOE_TOE, ankleR.y - SHOE_ANKLE, toeR.y - SHOE_TOE);
  const body = lowest(j, s);
  const leg = s.thigh + s.shin;
  const want = opts.ground === 'pin' ? 0 : Math.max(0, f.lift) * leg;
  const y = Math.max(want - feet, -body);
  return shift(j, y);
}

/** the lowest the drawn body reaches below its joints (a lying body's back, head, elbows) */
function lowest(j: Joints, s: Shape): number {
  // a little less than the drawn radii: a body lying on the floor squashes into it a touch
  const k = 0.75;
  return Math.min(
    j.pelvis.y - s.rTorso * 0.85 * k,
    j.chest.y - s.rTorso * k,
    j.head.y - s.headR * k,
    j.kneeL.y - s.rThigh * 0.8 * k,
    j.kneeR.y - s.rThigh * 0.8 * k,
    j.elL.y - s.rUpper * k,
    j.elR.y - s.rUpper * k,
    j.handL.y - s.rFore * k,
    j.handR.y - s.rFore * k,
    j.hipL.y - s.rThigh * k,
    j.hipR.y - s.rThigh * k,
  );
}

function shift(j: Joints, y: number): Joints {
  const out = {} as Joints;
  for (const k of Object.keys(j) as (keyof Joints)[]) out[k] = v(j[k].x, j[k].y + y, j[k].z);
  return out;
}

/**
 * Keep an arm joint out of the torso. The pixel torso is a thick rounded block (its depth the
 * torso radius, its width the hips widening to the shoulders); a real person's arms brush their
 * body, so on our thicker bodies a recorded arm can pass inside. Push the joint out to the block's
 * surface, then back to its bone's length from its parent.
 */
function clearTorso(p: V3, parent: V3, len: number, up: V3, fwd: V3, right: V3, s: Shape, r: number): V3 {
  const h = dot(p, up);
  if (h < -0.04 || h > s.spine * 0.86) return p;
  const a = dot(p, fwd);
  const b = dot(p, right);
  const t = Math.max(0, Math.min(1, h / s.spine));
  const depth = s.rTorso * 0.95 + r * 0.8;
  const width = s.hipW + s.rThigh * 0.75 + (s.shoulderW - s.hipW - s.rThigh * 0.75) * t + r * 0.8;
  const e = (a / depth) ** 2 + (b / width) ** 2;
  if (e >= 1) return p;
  // out to the surface, the way it already leans (straight out to the side when it's dead center)
  const k = e > 1e-6 ? 1 / Math.sqrt(e) : 0;
  const a2 = e > 1e-6 ? a * k : 0;
  const b2 = e > 1e-6 ? b * k : Math.sign(dot(parent, right) || 1) * width;
  const q = add(add(mul(up, h), mul(fwd, a2)), mul(right, b2));
  return add(parent, mul(unit(sub(q, parent)), len));
}

/** A player's joints at a stored frame of a loaded clip, ready for drawBody (cache the sprite
 * under mocapKey(clip, frame, ground)). */
export function mocapJoints(clip: Clip | string, frameIndex: number, look: Look, opts: { ground?: Ground } = {}): Joints {
  return retarget(frame(clip, frameIndex), shapeFor(look), opts);
}

/** The same at any time between frames (smooth, for slow motion; not cacheable per frame). */
export function mocapJointsAt(clip: Clip | string, t: number, look: Look, opts: { ground?: Ground } = {}): Joints {
  return retarget(sample(clip, t), shapeFor(look), opts);
}

/** How far one leg length of recorded travel goes on this player's sprite, as a share of his
 * height: moving the sprite by (root travel × this × px) keeps his planted feet from sliding, since
 * the pixel bodies' legs are shorter than a real man's for their height. */
export function legScale(look: Look): number {
  const s = shapeFor(look);
  return s.thigh + s.shin;
}

/** The root motion so far, in the game's units: `height` is the player's height in those units
 * (feet, say). Forward and to his right in the facing he started the clip with (for clips that
 * follow turns, 'smooth', in the facing he had at each step: the path comes out straight and
 * `turn` says how far he turned). Loops carry on cycle after cycle. */
export function rootAt(clip: Clip | string, t: number, height: number): { forward: number; right: number; turn: number; lift: number } {
  const f = sample(clip, t);
  const k = LEG_PER_HEIGHT * height;
  return { forward: f.x * k, right: f.z * k, turn: f.yaw, lift: f.lift * k };
}
