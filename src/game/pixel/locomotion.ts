// Locomotion without skating (studio overhaul players-5, V2 F.2 #4, research R4-R6): the stride a body
// shows for the ground it covers, the planted foot that holds its spot, turns that take real time, the
// lean into a burst and the head's bob. Pure and render only: select-{nba,nfl,soccer}.ts call it with
// the engine's positions and speeds (in each sport's own units) and keep its state in their memos; it
// never writes the engine. Every memo here runs on game time `t`, so replays, pauses, SIM jumps,
// rematches and hit-stop can't blend from a pose that belongs to another moment (`stepClock`).
import type { ClipMeta } from './mocap';
import type { Joints } from './rig';
import { leanForward, widen } from './style';

/** A stride plays between these rates of its recorded speed (V2 B.1.6, research R4). */
export const RATE_MIN = 0.8;
export const RATE_MAX = 1.25;
/** The shortest stride a clip is shrunk to (share of its recorded step length) for a slow drift. */
export const STRIDE_MIN = 0.25;
/** A frame slides when the feet cover the ground more than 15% off (the audits' rule). */
export const SLIDE_TOL = Math.log(1.15);
/** A gap in game time this long, or any step back, is a discontinuity: the memos start again. */
export const MAX_DT = 0.25;
/** A turn of 90° takes this long (V2: 80-120 ms). */
export const TURN_S_PER_90 = 0.1;
/** The drawn body never strays from the simulated one by more than this share of his height. */
export const ANCHOR_CAP = 0.05;

/** One way to stride: a clip, its ground speed at rate 1 on this body (game units a second), how far
 * its stride may shrink, and whether it plays backward (a back-run, the feet travelling the other way). */
export interface GaitOption {
  clip: string;
  speed: number;
  minStride?: number;
  reverse?: boolean;
}

/** The stride picked for a speed: its clip, playback rate, stride scale, and how well the feet cover the
 * ground (`match` = speed / the feet's speed; 1 is exact, and a frame slides past ±15%). */
export interface GaitPick {
  clip: string;
  rate: number;
  stride: number;
  reverse: boolean;
  match: number;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
/** stride scales in steps of 10% (each its own sprite: a step never misses the ground by more than
 * that), rounded up so the feet never cover too little */
const quantStride = (k: number, min: number) => {
  const n = Math.floor(Math.log(1 / Math.max(min, k)) / Math.log(1.1) + 1e-9);
  return Math.max(min, Math.round(1000 / 1.1 ** n) / 1000);
};

/**
 * The stride for a ground speed: the clip whose recorded speed is nearest, played at a rate within
 * 0.8-1.25×; below the slowest clip's 0.8× the stride shrinks (short steps, never a frozen pose), so
 * the feet keep up with the ground at every speed down to the slowest stride.
 */
export function pickGait(speed: number, options: GaitOption[], prev?: { clip: string; stride: number }): GaitPick {
  // the stride already showing stays while it still covers the ground within 8% (a speed wobbling at a
  // boundary would otherwise flick between two strides, and their drawings, every frame)
  const keep = prev && options.find((o) => o.clip === prev.clip && o.speed > 0);
  if (keep && prev) {
    const rate = clamp(speed / (keep.speed * prev.stride), RATE_MIN, RATE_MAX);
    const match = speed / (keep.speed * rate * prev.stride);
    if (Math.abs(Math.log(match)) <= Math.log(1.08)) return { clip: keep.clip, rate, stride: prev.stride, reverse: !!keep.reverse, match };
  }
  let best: GaitPick | null = null;
  let bestCost = Infinity;
  for (const o of options) {
    if (!(o.speed > 0)) continue;
    const r = speed / o.speed;
    const rate = clamp(r, RATE_MIN, RATE_MAX);
    // too slow for this clip at its slowest rate: shorter steps at that rate
    const stride = r < RATE_MIN ? quantStride(r / RATE_MIN, o.minStride ?? STRIDE_MIN) : 1;
    const match = speed / (o.speed * rate * stride);
    // the feet covering the ground right comes first; then a rate near 1 and the full stride
    const cost = Math.abs(Math.log(match)) * 10 + Math.abs(Math.log(rate)) + Math.abs(Math.log(stride)) * 2;
    if (cost < bestCost) {
      bestCost = cost;
      best = { clip: o.clip, rate, stride, reverse: !!o.reverse, match };
    }
  }
  return best ?? { clip: options[0]?.clip ?? 'ready', rate: 1, stride: 1, reverse: false, match: 1 };
}

/** A pick slides when its feet are more than 15% off the ground they cover. */
export const slides = (g: Pick<GaitPick, 'match'>) => Math.abs(Math.log(Math.max(1e-6, g.match))) > SLIDE_TOL;

// ---------------------------------------------------------------------------------------------
// the body's motion state, on game time
// ---------------------------------------------------------------------------------------------

/** What locomotion remembers of a body between frames (kept in the sport's select memo). */
export interface Loco {
  /** the last game time seen (NaN: nothing yet) */
  t: number;
  /** the drawn facing (radians, in the sport's ground plane: atan2(y, x)) */
  face: number;
  /** a turn under way: its class, when the plant frame ends, the facing it set out from */
  turn: { cls: TurnClass; plantUntil: number; from: number } | null;
  /** the planted-foot offset (game units, ground plane): drawn = simulated + offset */
  ox: number;
  oy: number;
  /** last frame's velocity, for the lean into a burst or a brake */
  vx: number;
  vy: number;
  /** a brake's lean-back lasts until then */
  brakeUntil: number;
  /** the gait clip last shown (a new one re-anchors its feet) */
  clip: string | null;
  /** last frame's head lead and lean, held while game time stands still (a pause, a hit-stop) */
  lead: number;
  lean: { fwd: number; side: number };
  /** the acceleration along his facing and the turn's pull, smoothed over about 0.1 s (the lean follows
   * these, not one frame's jitter) */
  acc: number;
  pull: number;
}

export type TurnClass = 'glide' | 'plant' | 'shuffle';

export function freshLoco(face: number): Loco {
  return { t: NaN, face, turn: null, ox: 0, oy: 0, vx: 0, vy: 0, brakeUntil: -Infinity, clip: null, lead: 0, lean: { fwd: 0, side: 0 }, acc: 0, pull: 0 };
}

/**
 * Advance a body's clock to `t`. Returns the step in game seconds: 0 on the first frame, on a frozen
 * frame (pause, hit-stop) and on a discontinuity (time going back, a jump of over 0.25 s: a replay, a
 * SIM, a new play or a rematch), when every carried value restarts from `face` (`reset` is true).
 */
export function stepClock(s: Loco, t: number, face: number): { dt: number; reset: boolean } {
  const dt = t - s.t;
  if (!(dt >= 0 && dt <= MAX_DT)) {
    Object.assign(s, freshLoco(face), { t });
    return { dt: 0, reset: true };
  }
  s.t = t;
  return { dt, reset: false };
}

/** A gait's phase (0-1) moved on by `dt` at `rate`; backward for a back-run. */
export function advancePhase(frac: number, dt: number, rate: number, duration: number, reverse = false): number {
  const f = frac + ((reverse ? -1 : 1) * dt * rate) / Math.max(1e-3, duration);
  return ((f % 1) + 1) % 1;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Turn the drawn facing toward `target` (V2 R5): 90° in 100 ms. Under 45° he rotates straight through
 * the facings ('glide'); 45-120° he plants (a 1 px dip for the plant frames) and turns ('plant'); over
 * 120° he chops 2-3 slower steps, then plants ('shuffle'). `exempt` (spins, dives, falls, a keeper's
 * dive) takes the new facing at once. Returns the facing to draw, the turn's class, the plant dip, and
 * the head's lead: where the head already looks, one frame ahead of the body.
 */
export function turnToward(s: Loco, target: number, dt: number, t: number, exempt = false): { face: number; cls: TurnClass; dip: boolean; lead: number } {
  const delta = wrapAngle(target - s.face);
  if (exempt) {
    s.face = target;
    s.turn = null;
    s.lead = 0;
    return { face: s.face, cls: 'glide', dip: false, lead: 0 };
  }
  // game time standing still (a pause, a hit-stop): the frame holds as it was
  if (dt <= 0) return { face: s.face, cls: s.turn?.cls ?? 'glide', dip: !!s.turn && s.turn.cls !== 'glide' && t < s.turn.plantUntil, lead: s.lead };
  const size = Math.abs(delta);
  if (size < 1e-4) {
    s.lead = 0;
    // facing done: a plant still under way finishes its frames
    const tr = s.turn;
    if (tr && tr.cls !== 'glide' && t < tr.plantUntil) return { face: s.face, cls: tr.cls, dip: true, lead: 0 };
    s.turn = null;
    return { face: s.face, cls: 'glide', dip: false, lead: 0 };
  }
  // a new turn (or one that grew past its class) sets its class from where it starts
  if (!s.turn || size > Math.abs(wrapAngle(target - s.turn.from)) + 0.35) {
    const cls: TurnClass = size < Math.PI / 4 ? 'glide' : size <= (2 * Math.PI) / 3 ? 'plant' : 'shuffle';
    s.turn = { cls, from: s.face, plantUntil: -Infinity };
  }
  const tr = s.turn;
  // 90° per 100 ms; a shuffle turn's decel steps at two thirds of that until the last 60° (the plant)
  let w = Math.PI / 2 / TURN_S_PER_90;
  if (tr.cls === 'shuffle' && size > Math.PI / 3) w *= 2 / 3;
  const stepA = Math.min(size, w * dt);
  s.face = wrapAngle(s.face + Math.sign(delta) * stepA);
  // the plant: from the moment a planted turn is within 60° of done, for 3 frames (0.1 s)
  if (tr.cls !== 'glide' && tr.plantUntil === -Infinity && size - stepA <= Math.PI / 3) tr.plantUntil = t + 0.1;
  const dip = tr.cls !== 'glide' && t < tr.plantUntil;
  const left = Math.abs(wrapAngle(target - s.face));
  // the head leads by one frame's turn while there's a real turn left (not the facing's small corrections)
  const lead = left > Math.PI / 9 ? Math.sign(delta) * Math.min(left, w * dt) : 0;
  s.lead = lead;
  if (left < 1e-4 && t >= tr.plantUntil) s.turn = null;
  return { face: s.face, cls: tr.cls, dip, lead };
}

/** Whether a gait clip's time falls in a foot's contact beat: the first 40% of the step after a footfall. */
export function inContact(meta: ClipMeta, ct: number): boolean {
  const beats = [...(meta.beats?.stepL ?? []), ...(meta.beats?.stepR ?? [])].sort((a, b) => a - b);
  if (!beats.length || !meta.duration) return false;
  const d = meta.duration;
  const c = ((ct % d) + d) % d;
  for (let i = 0; i < beats.length; i++) {
    const a = beats[i];
    const gap = beats.length === 1 ? d / 2 : (((beats[(i + 1) % beats.length] - a) % d) + d) % d || d;
    const since = (((c - a) % d) + d) % d;
    if (since < gap * 0.4) return true;
  }
  return false;
}

/**
 * The planted foot (research R4). `ex, ey` is how much faster the simulated body moves than the feet
 * carry it (game units a second); `stride` is the feet's own travel this frame. In a contact beat the
 * planted foot holds its spot: the drawn body moves with the feet and the difference builds in the
 * offset. Between contacts the drawn body leads back to the simulated one through a damper of at most
 * half the stride's own travel a frame. Airborne (or off a stride) the offset decays to 0. It never
 * exceeds `cap` (5% of his height, in game units). Returns how far the planted foot slid this frame.
 */
export function anchorStep(s: Loco, ex: number, ey: number, stride: number, dt: number, contact: boolean, airborne: boolean, cap: number): number {
  if (dt <= 0) return 0;
  let slid = 0;
  if (airborne) {
    const k = Math.exp(-dt / 0.08);
    s.ox *= k;
    s.oy *= k;
    return 0;
  }
  if (contact) {
    s.ox -= ex * dt;
    s.oy -= ey * dt;
  } else {
    const o = Math.hypot(s.ox, s.oy);
    const pull = Math.min(o, Math.max(o * (1 - Math.exp(-dt / 0.06)), 0), 0.5 * stride);
    if (o > 1e-9) {
      s.ox -= (s.ox / o) * pull;
      s.oy -= (s.oy / o) * pull;
    }
    // the feet still carry him while they swing: the rest of the difference shows as drift
    slid = Math.hypot(ex, ey) * dt;
  }
  const o = Math.hypot(s.ox, s.oy);
  if (o > cap) {
    if (contact) slid = o - cap;
    s.ox *= cap / o;
    s.oy *= cap / o;
  }
  return contact ? slid : 0;
}

/** Forget a planted foot at once (a new clip that isn't a stride, a fall, a dive). */
export function releaseAnchor(s: Loco) {
  s.ox = 0;
  s.oy = 0;
}

/**
 * The lean (research R6): up to 12° forward into a burst and 8° into a turn, a 6° lean back for 5
 * frames when he brakes hard. `vx, vy` is his velocity now; `face` the drawn facing; `turnRate` how
 * fast he's turning (rad/s); `top` his top speed (sets what counts as a burst). Rounded to 2° (the
 * sprite cache key). Returns radians: `fwd` (positive forward) and `side` (positive to his right).
 */
export function leanOf(s: Loco, vx: number, vy: number, face: number, dt: number, t: number, turnRate: number, top: number): { fwd: number; side: number } {
  const deg = Math.PI / 180;
  // (whole steps: 3° forward, 4° to the side; each step is its own drawing)
  const q = (a: number, step: number) => Math.round(a / (step * deg)) * step * deg;
  // game time standing still: the lean holds (a fresh body has none)
  if (dt <= 0) {
    s.vx = vx;
    s.vy = vy;
    return s.lean;
  }
  const fx = Math.cos(face);
  const fy = Math.sin(face);
  const acc = ((vx - s.vx) * fx + (vy - s.vy) * fy) / dt;
  const speed = Math.hypot(vx, vy);
  const was = Math.hypot(s.vx, s.vy);
  s.vx = vx;
  s.vy = vy;
  // a hard brake from a run: the body pitches back as the feet plant
  if (acc < -top * 1.6 && was > top * 0.4) s.brakeUntil = t + 5 / 60;
  const k = 1 - Math.exp(-dt / 0.1);
  s.acc += (acc - s.acc) * k;
  s.pull += (turnRate * speed - s.pull) * k;
  if (t < s.brakeUntil) s.lean = { fwd: -6 * deg, side: 0 };
  else {
    const burst = clamp(s.acc / Math.max(1e-6, top * 2.5), 0, 1);
    s.lean = { fwd: q(12 * deg * burst, 3), side: q(clamp(s.pull / Math.max(1e-6, top * 6), -1, 1) * 8 * deg, 4) };
  }
  return s.lean;
}

/** The head's bob through a stride (research R6): -1, -1, +2 art px at 34 art px across the cycle's
 * thirds, scaled to the sprite and rounded to whole art px (none under 24 art px). */
export function headBob(frac: number, px: number): number {
  if (px < 24) return 0;
  const third = Math.min(2, Math.floor((((frac % 1) + 1) % 1) * 3));
  return Math.round([-1, -1, 2][third] * (px / 34));
}

// ---------------------------------------------------------------------------------------------
// joint touches (the rig's body frame: x forward, y up, z to his right, a share of his height)
// ---------------------------------------------------------------------------------------------

type V3 = { x: number; y: number; z: number };
const LEG_L: (keyof Joints)[] = ['kneeL', 'ankleL', 'toeL'];
const LEG_R: (keyof Joints)[] = ['kneeR', 'ankleR', 'toeR'];
const ARM_L: (keyof Joints)[] = ['elL', 'wrL', 'handL'];
const ARM_R: (keyof Joints)[] = ['elR', 'wrR', 'handR'];
const UPPER: (keyof Joints)[] = ['chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'handL', 'handR'];

/** Shorter steps: each leg's (and arm's) reach forward and back from its hip (shoulder) scaled by `k`. */
export function strideScale(j: Joints, k: number): Joints {
  if (k >= 0.999) return j;
  const out = { ...j };
  const scale = (keys: (keyof Joints)[], root: V3) => {
    for (const key of keys) {
      const p = j[key] as V3;
      out[key] = { x: root.x + (p.x - root.x) * k, y: p.y, z: p.z } as never;
    }
  };
  scale(LEG_L, j.hipL);
  scale(LEG_R, j.hipR);
  // the arms swing with the legs: less when the steps are short
  const ka = 0.5 + 0.5 * k;
  const arms = (keys: (keyof Joints)[], root: V3) => {
    for (const key of keys) {
      const p = j[key] as V3;
      out[key] = { x: root.x + (p.x - root.x) * ka, y: p.y, z: p.z } as never;
    }
  };
  arms(ARM_L, j.shL);
  arms(ARM_R, j.shR);
  return out;
}

/** Lean the upper body to his right (positive `a`, radians) or left from the pelvis: into a turn. */
export function leanSide(j: Joints, a: number): Joints {
  if (Math.abs(a) < 1e-3) return j;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const p = j.pelvis;
  const out = { ...j };
  for (const k of UPPER) {
    const q = j[k] as V3;
    const dz = q.z - p.z;
    const dy = q.y - p.y;
    out[k] = { x: q.x, y: p.y - dz * s + dy * c, z: p.z + dz * c + dy * s } as never;
  }
  return out;
}

/** The head nudged `dy` up and `dz` to his right (shares of height): the bob and the turn's head lead. */
export function headNudge(j: Joints, dz: number, dy: number): Joints {
  if (Math.abs(dz) < 1e-6 && Math.abs(dy) < 1e-6) return j;
  return { ...j, head: { x: j.head.x, y: j.head.y + dy, z: j.head.z + dz }, neck: { x: j.neck.x, y: j.neck.y + dy * 0.5, z: j.neck.z + dz * 0.5 } };
}

/** The whole body lowered by `drop` (share of height): a plant's 1 px dip. */
export function dipBody(j: Joints, drop: number): Joints {
  if (drop <= 0) return j;
  const out = { ...j };
  for (const k of ['pelvis', 'hipL', 'hipR', ...UPPER] as (keyof Joints)[]) {
    const q = j[k] as V3;
    out[k] = { x: q.x, y: q.y - drop, z: q.z } as never;
  }
  return out;
}

/**
 * The animation rate a body is drawn at (V2 B.1.6, NBA-25): every recorded frame (30 fps) for the
 * must set (the body with the ball, his defender, the pass target, the body the player controls);
 * every other frame (15 fps) for everyone else, whatever their size (the far players were 10). A
 * clip's own finer step (a release, a throw) is kept. (The plan also put every sprite of 34 art px or
 * more at 30 fps: measured, that doubled an NBA frame's new drawings past the budget and froze the
 * near players it was meant to help, so size alone no longer buys 30 fps.)
 */
export function stepFor(priority: boolean, clipStep = 2): number {
  return Math.min(clipStep, priority ? 1 : 2);
}

/**
 * The frame step for a priority body's stride: under rate 1 a 30 fps clip shows fewer than 30 new
 * frames a second, so it is sampled at half frames (the joints between two recorded frames,
 * rasterised fresh; never two drawings blended).
 */
export function fineStep(step: number, rate: number): number {
  return step === 1 && rate < 1 ? 0.5 : step;
}

/** The next distinct frame after `frame` at `step` (pre-warm): loops wrap, other clips hold their last. */
export function nextFrame(frame: number, step: number, frames: number, loop: boolean, reverse = false): number {
  if (reverse) {
    const f = frame - step;
    return loop ? (f + frames) % frames : Math.max(0, f);
  }
  const f = frame + step;
  return loop ? f % frames : Math.min(frames - 1, f);
}

// ---------------------------------------------------------------------------------------------
// one body's frame: the travel decomposed, the stride's families, the anchor and the lean together
// ---------------------------------------------------------------------------------------------

/** Velocity in a facing's frame: forward along it, lateral to his right (positive). */
export function travelIn(face: number, vx: number, vy: number): { fwd: number; lat: number } {
  const c = Math.cos(face);
  const s = Math.sin(face);
  return { fwd: vx * c + vy * s, lat: -vx * s + vy * c };
}

/** Which way he travels relative to where he faces. */
export type Heading = 'fwd' | 'back' | 'right' | 'left';
export function headingOf(face: number, vx: number, vy: number): Heading {
  const { fwd, lat } = travelIn(face, vx, vy);
  if (Math.abs(lat) > Math.abs(fwd)) return lat > 0 ? 'right' : 'left';
  return fwd < 0 ? 'back' : 'fwd';
}

/** A stride being shown this frame, for the anchor: its clip's metadata, clip time, the pick, and the
 * game units one recorded leg length covers on this body (legScale × his height). */
export interface StrideNow {
  meta: ClipMeta;
  ct: number;
  pick: GaitPick;
  unitsPerLeg: number;
}

/** What locomotion adds to a frame: the planted-foot offset (game units) and the lean (radians). */
export interface Motion {
  ox: number;
  oy: number;
  lean: { fwd: number; side: number };
  /** how far the planted foot slid this frame (game units; 0 while it holds) */
  slid: number;
}

/** The stride's own velocity over the ground (game units a second, world axes). */
export function strideVelocity(face: number, st: StrideNow): { x: number; y: number } {
  const cyc = st.meta.cycle ?? { dx: st.meta.root.dx, dz: st.meta.root.dz };
  const k = (st.unitsPerLeg * st.pick.rate * st.pick.stride * (st.pick.reverse ? -1 : 1)) / Math.max(1e-3, st.meta.duration);
  const fx = Math.cos(face);
  const fy = Math.sin(face);
  // forward along the facing, dz to his right (-sin, cos)
  return { x: (cyc.dx * fx - cyc.dz * fy) * k, y: (cyc.dx * fy + cyc.dz * fx) * k };
}

/**
 * The anchor and the lean for this frame. `stride` is the stride shown (null: a pose or an action,
 * when any offset decays away); `height` his height in game units (the anchor's cap is 5% of it);
 * `top` his top speed; `turnRate` how fast the facing turns (rad/s).
 */
export function bodyMotion(s: Loco, o: { t: number; dt: number; vx: number; vy: number; face: number; turnRate: number; top: number; height: number; airborne: boolean; stride: StrideNow | null }): Motion {
  let slid = 0;
  if (o.stride && !o.airborne) {
    const sv = strideVelocity(o.face, o.stride);
    // a new stride clip re-anchors at its first footfall: the old one's offset carries on into it
    s.clip = o.stride.meta.mirrorOf ?? o.stride.pick.clip;
    slid = anchorStep(s, o.vx - sv.x, o.vy - sv.y, Math.hypot(sv.x, sv.y) * o.dt, o.dt, inContact(o.stride.meta, o.stride.ct), false, ANCHOR_CAP * o.height);
  } else {
    s.clip = null;
    anchorStep(s, 0, 0, 0, o.dt, false, true, ANCHOR_CAP * o.height);
  }
  const lean = leanOf(s, o.vx, o.vy, o.face, o.dt, o.t, o.turnRate, o.top);
  return { ox: s.ox, oy: s.oy, lean, slid };
}

/** Every touch locomotion and body type put on a recorded frame before it is drawn. `fwd`/`side` are
 * the lean (radians), `stride` the step scale, `dip` a plant's 1 px dip, `lead` the turn's head lead
 * (radians a frame), `bob` the head's bob (art px), `heavy` the heavy man's wider base (0-1). */
export interface Touches {
  heavy: number;
  fwd: number;
  side: number;
  stride: number;
  dip: boolean;
  lead: number;
  bob: number;
}

/** The forward lean is at most 12° in all (the sprint's and the burst's together, R6). */
export const LEAN_MAX = (12 * Math.PI) / 180;
const leadSign = (lead: number) => (Math.abs(lead) > 0.05 ? Math.sign(lead) : 0);

/** The sprite cache key's part for a frame's touches (empty when there are none). */
export function touchKey(o: Touches): string {
  let k = '';
  if (o.heavy) k += 'w' + o.heavy;
  if (o.fwd) k += 'l' + Math.round(o.fwd * 100) / 100;
  if (o.side) k += 'q' + Math.round(o.side * 100) / 100;
  if (o.stride < 1) k += 's' + o.stride;
  if (o.dip) k += 'd';
  const h = leadSign(o.lead);
  if (h) k += 'h' + h;
  if (o.bob) k += 'b' + o.bob;
  return k;
}

/** Put the touches on a frame's joints for a sprite `px` art px tall (a dip and the head's nudges are
 * whole art px). */
export function applyTouches(j: Joints, o: Touches, px: number): Joints {
  let out = j;
  if (o.stride < 1) out = strideScale(out, o.stride);
  if (o.heavy) out = widen(out, o.heavy * 0.45, o.heavy * 0.008);
  if (o.fwd) out = leanForward(out, o.fwd);
  if (o.side) out = leanSide(out, o.side);
  if (o.dip) out = dipBody(out, 1 / px);
  const h = leadSign(o.lead);
  if (h || o.bob) out = headNudge(out, h / px, -o.bob / px);
  return out;
}

/**
 * The facing to turn toward: `face` (where the engine or the play wants him to look), unless he moves
 * back or sideways faster than any stride that way can carry him; then he opens his hips and faces
 * the way he goes (a defender giving up the slide to run with his man).
 */
export function openHips(face: number, vx: number, vy: number, optionsFor: (h: Heading) => GaitOption[]): number {
  const speed = Math.hypot(vx, vy);
  if (speed < 1e-6) return face;
  const h = headingOf(face, vx, vy);
  if (h === 'fwd') return face;
  const top = Math.max(0, ...optionsFor(h).map((o) => o.speed)) * RATE_MAX;
  return speed > top ? Math.atan2(vy, vx) : face;
}
