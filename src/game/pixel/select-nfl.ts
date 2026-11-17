// NFL player selection (studio overhaul players-2, moved from football2/render.ts): the look a body is
// drawn with (helmet, pads), the motion-capture clip or hand-keyed pose it shows each frame, its stride
// and the ball arm. players-5: the facing (it was the renderer's) turns at 90° per 100 ms, defenders
// retreating face the ball, the quarterback takes the snap and drops facing downfield at the speed he
// drops (never the idle clip while he moves), blockers and rushers step with their feet, and every
// stride comes from locomotion.ts (`motionOf`). Render only: it reads the engine's bodies and never
// writes them. The select-golden test pins every choice here.
import { refOf } from './appearance';
import type { Look } from './body';
import { matchLook } from './looks';
import { advancePhase, bodyMotion, freshLoco, openHips, type GaitOption, type GaitPick, type Heading, headingOf, type Loco, MAX_DT, type Motion, pickGait, stepClock, type StrideNow, turnToward } from './locomotion';
import { clipMeta, getClip, type Ground, legScale, warp } from './mocap';
import * as P from './poses';
import { preloadPixels } from './ready';
import type { Joints, Pose } from './rig';
import { NFL_STANDINS, standIn } from './select-family';
import { ballNow, isLine, speedOf } from '../football2/engine';
import type { Act, Body, Play } from '../football2/types';
import type { FbKit } from '../football2/render';

// this page's clips and looks start loading now, as the game chunk is evaluated, long before the first
// frame (players-3, ready.ts)
preloadPixels('nfl');

/** His look in this kit: his appearance record (looks.ts), his engine build, pads by position. */
export function lookFor(b: Body, kit: FbKit): Look {
  const big = isLine(b) || b.p.pos === 'DT' || b.p.pos === 'DE';
  const colors = { jersey: kit.jersey, trim: kit.trim, shorts: kit.pants, socks: kit.socks, shoes: kit.shoes, helmet: kit.helmet, stripe: kit.stripe, mask: kit.mask, pants: kit.pants };
  return matchLook('nfl', refOf('nfl', b.p.id), colors, { id: b.p.id, num: b.p.num, ht: b.p.ht, wt: b.p.wt, pos: b.p.pos, pads: big ? 1.25 : 1 });
}

export function poseOf(b: Body, t: number, p: Play): { key: string; pose: Pose } {
  const since = t - b.actAt;
  const speed = Math.hypot(b.vx, b.vy);
  const timed = (dur: number, frames = 8) => Math.min(frames, Math.floor((since / dur) * frames)) / frames;
  const cycle = (hz: number, frames: number) => Math.floor(((((t * hz) % 1) + 1) % 1) * frames) / frames;
  const sp = Math.min(1, speed / Math.max(1, speedOf(b.p)));
  if (p.phase === 'pre' || (b.act === 'stance' && speed < 0.6)) {
    const three = isLine(b) || (b.side === 'D' && (b.p.pos === 'DE' || b.p.pos === 'DT'));
    return { key: 'st' + (three ? 3 : 2), pose: P.stance(three) };
  }
  switch (b.act) {
    case 'run':
    case 'rush': {
      const ph = cycle(1.2 + sp * 1.4, 8);
      return { key: 'rn' + ph + (sp > 0.55 ? 'f' : 's'), pose: P.run(ph, sp > 0.55 ? 1 : 0.6) };
    }
    case 'carry': {
      const ph = cycle(1.2 + sp * 1.4, 8);
      return { key: 'ca' + ph + (sp > 0.55 ? 'f' : 's'), pose: P.carry(ph, sp > 0.55 ? 1 : 0.6) };
    }
    case 'block': {
      const ph = cycle(1.5, 4);
      return { key: 'bl' + ph, pose: P.block(ph) };
    }
    case 'backpedal': {
      const ph = cycle(2, 6);
      return { key: 'bp' + ph + (speed > 3 ? 'r' : ''), pose: speed > 3 ? P.run(ph, 0.6) : P.backpedal(ph) };
    }
    case 'throw': {
      const ph = timed(0.45, 9);
      return { key: 'th' + ph, pose: P.throwBall(ph) };
    }
    case 'catch': {
      const ph = timed(0.3, 4);
      return { key: 'ct' + ph, pose: P.catchBall(1 - ph) };
    }
    case 'juke': {
      const ph = timed(0.32, 4);
      return { key: 'jk' + ph, pose: P.crossover(ph) };
    }
    case 'spin': {
      const ph = timed(0.42, 6);
      return { key: 'sp' + ph, pose: P.spin(ph) };
    }
    case 'stiff': {
      const ph = cycle(2, 6);
      return { key: 'sa' + ph, pose: P.stiffArm(ph) };
    }
    case 'truck': {
      const ph = cycle(2, 6);
      return { key: 'tr' + ph, pose: P.truck(ph) };
    }
    case 'tackle': {
      // the dive, then on the turf
      if (since > 0.55) return { key: 'dn', pose: P.grounded() };
      const ph = timed(0.35, 5);
      return { key: 'tk' + ph, pose: P.dive(ph) };
    }
    case 'down': {
      // knocked over: a stumble back first, then on the ground
      if (since < 0.3) {
        const ph = timed(0.3, 3);
        return { key: 'kb' + ph, pose: P.stumble(ph) };
      }
      return { key: 'dn', pose: P.grounded() };
    }
    case 'celebrate': {
      const ph = cycle(1.4, 6);
      return { key: 'ce' + ph, pose: P.celebrate(ph) };
    }
    case 'kick': {
      const ph = timed(0.4, 6);
      return { key: 'kk' + ph, pose: P.kickLeg(ph) };
    }
    default: {
      const ph = cycle(0.5, 4);
      return { key: 'id' + ph, pose: P.idle(ph) };
    }
  }
}

/** The motion-capture clips the field uses (mocap.ts). They arrive in the NFL bundle before the first frame
 * (ready.ts); if they never do,
 * the hand-keyed poses stand in (and keep the stances, the backpedal and the moves with the ball). */
export const CLIPS = ['ready', 'walk', 'jog', 'run', 'sprint', 'backpedal', 'shuffle', 'shuffle_l', 'block', 'throw', 'catch', 'catch_run', 'dive', 'fall_back', 'fall_back_m', 'fall_forward', 'fall_forward_m', 'kick', 'celebrate'];

/** The throw: the arm comes through from the cocked frame (held while he aims) and the ball's off
 * as the engine lets it go, then the follow-through. */
const THROW_COCKED = 1.62;
const THROW = warp(clipMeta('throw'), { release: 0.06 });
/** The tackle: he leaves his feet at contact, lands on the runner a third of a second later. */
const DIVE = warp(clipMeta('dive'), { takeoff: 0, impact: 0.35, ground: 0.55 });
/** Knocked down: driven back onto his back (a big hit, a truck, a stiff arm), or down forward. */
const FALL_BACK = warp(clipMeta('fall_back'), { impact: 0.28, ground: 0.5 });
const FALL_FORWARD = warp(clipMeta('fall_forward'), { impact: 0.3, ground: 0.5 });
/** The field goal: the plant and the swing, the boot through the ball as it leaves (0.22 s). */
const KICK = warp(clipMeta('kick'), { contact: 0.22 });

export interface Anim {
  key: string;
  pose: Pose;
  clip?: string;
  ct?: number;
  step?: number;
  ground?: Ground;
  /** an arm on the ball over the recorded body: tucked to run with it, or held up in both hands */
  ball?: 'tuck' | 'hold';
  /** a stride (locomotion.ts): its rate, stride scale and direction */
  gait?: GaitPick;
}

/** What the drawing remembers of a body: his stride's phase, and the way he faced when he went
 * down (a man on the ground doesn't turn with his slide). */
export interface Memo {
  /** the stride's phase on game time, and the stride last shown (kept while it still fits) */
  gait: { t: number; frac: number; clip?: string; stride?: number };
  /** the drawn facing as a unit vector (kept with `loco.face`) */
  face: { x: number; y: number };
  /** locomotion's state (players-5): drawn facing, turn, planted foot, lean; made on first use */
  loco?: Loco;
  /** the quarterback: whether the play was still before the snap last frame, and when the snap came */
  pre?: boolean;
  snapAt?: number;
}

const has = (name: string) => !!getClip(name);
/** over this (yd/s) a body is moving: his feet stride (players-5: no idle clip while he moves) */
const MOVING = 1 / 3;
const mirrorOf = (b: Body, name: string) => (b.id % 2 ? name + '_m' : name);

/** A recorded stride's ground speed on this man's sprite legs, yd/s at rate 1. */
const ydOf = (b: Body, look: Look, name: string) => clipMeta(name).root.speed * legScale(look) * (b.p.ht / 36);

/** The strides for each way he travels relative to where he faces (locomotion.ts `pickGait` picks):
 * forward walk, jog, run, sprint (a blocker drives with his block steps first); back the backpedal,
 * then a back-run; sideways the shuffle (a pass set's slide), its steps shortening for a slow drift. */
export function gaitOptions(b: Body, look: Look, h: Heading, blocking = false): GaitOption[] {
  const o = (clip: string, more: Partial<GaitOption> = {}): GaitOption => ({ clip, speed: ydOf(b, look, clip), ...more });
  const list =
    h === 'fwd'
      ? [...(blocking ? [o('block')] : []), ...['walk', 'jog', 'run', 'sprint'].map((c) => o(c))]
      : h === 'back'
        ? [o('backpedal'), o('walk', { reverse: true }), o('jog', { reverse: true })]
        : [o(h === 'right' ? 'shuffle' : 'shuffle_l', { minStride: 0.15 })];
  return list.filter((g) => has(g.clip));
}

/** A stride at his speed, its phase carried from frame to frame on game time. */
export function stride(t: number, m: Memo, speed: number, options: GaitOption[]): { clip: string; ct: number; pick: GaitPick } | null {
  if (!options.length) return null;
  const dt = t - m.gait.t;
  const fresh = dt > 0 && dt <= MAX_DT;
  const pick = pickGait(speed, options, fresh && m.gait.clip ? { clip: m.gait.clip, stride: m.gait.stride ?? 1 } : undefined);
  const meta = clipMeta(pick.clip);
  if (fresh) m.gait.frac = advancePhase(m.gait.frac, dt, pick.rate, meta.duration, pick.reverse);
  m.gait.t = t;
  m.gait.clip = pick.clip;
  m.gait.stride = pick.stride;
  return { clip: pick.clip, ct: m.gait.frac * meta.duration, pick };
}

/** the quarterback takes the snap for this long (6 frames) */
const SNAP_CATCH = 0.1;

/** Every act the NFL selection animates (football2/types.ts `Act`); anything else gets a stand-in. */
export const KNOWN_ACTS: ReadonlySet<string> = new Set<Act>(['stance', 'run', 'block', 'throw', 'catch', 'carry', 'juke', 'spin', 'stiff', 'truck', 'windup', 'tackle', 'down', 'rush', 'backpedal', 'celebrate', 'kick']);

/**
 * What a body is doing right now, as a clip or a pose. An act this file doesn't animate yet is drawn
 * as its family's stand-in (select-family.ts); the play's quarterback and carrier are matched by
 * identity below, so the stand-in body takes their place in a copy of the play too.
 */
export function animOf(b: Body, t: number, p: Play, look: Look, m: Memo, aiming: boolean): Anim {
  if (!KNOWN_ACTS.has(b.act)) {
    const nb: Body = { ...b, act: standIn(b.act, KNOWN_ACTS, NFL_STANDINS, Math.hypot(b.vx, b.vy) > 0.6) as Act };
    p = { ...p, qb: p.qb === b ? nb : p.qb, carrier: p.carrier === b ? nb : p.carrier };
    b = nb;
  }
  return animKnown(b, t, p, look, m, aiming);
}

function animKnown(b: Body, t: number, p: Play, look: Look, m: Memo, aiming: boolean): Anim {
  const pose: Anim = poseOf(b, t, p);
  if (p.phase === 'pre' || (b.act === 'stance' && Math.hypot(b.vx, b.vy) <= MOVING)) return pose;
  const speed = Math.hypot(b.vx, b.vy);
  const since = t - b.actAt;
  const clip = (name: string, ct: number, opts: Partial<Anim> = {}): Anim =>
    has(name) ? { key: '', pose: pose.pose, clip: name, ct, step: 2, ground: 'clip', ...opts } : pose;
  // a stride the way he travels (relative to the drawn facing), at the speed he travels
  const go = (opts: Partial<Anim> = {}, blocking = false): Anim | null => {
    const g = stride(t, m, speed, gaitOptions(b, look, headingOf(Math.atan2(m.face.y, m.face.x), b.vx, b.vy), blocking));
    return g ? clip(g.clip, g.ct, { gait: g.pick, ...opts }) : null;
  };
  const ready = () => clip('ready', t + b.id * 0.37);
  const qbBall = b === p.carrier ? { ball: p.phase === 'drop' ? ('hold' as const) : ('tuck' as const) } : {};
  // the quarterback with the slingshot drawn back: arm cocked, ready to let it go
  if (aiming && b === p.qb && b === p.carrier) return clip('throw', THROW_COCKED, { step: 1 });
  // the snap: the ball into his hands (6 frames), then his drop at the speed he drops, facing downfield
  if (b === p.qb && p.phase === 'drop' && b.act !== 'throw') {
    if (m.snapAt !== undefined && t - m.snapAt < SNAP_CATCH && has('catch')) return clip('catch', clipMeta('catch').events.catch - SNAP_CATCH + (t - m.snapAt), { step: 1 });
    if (speed > MOVING) return go(qbBall) ?? ready();
    if (b.act === 'stance' || b.act === 'run') return ready();
  }
  switch (b.act) {
    case 'backpedal':
      return (speed > MOVING ? go() : null) ?? ready();
    case 'run':
    case 'rush':
      // a rusher locked up with his blocker: driving into him, stepping as he's moved
      if (b.act === 'rush' && speed < 2) return (speed > MOVING ? go({}, true) : null) ?? clip('block', t + b.id * 0.31);
      return (speed > MOVING ? go(qbBall) : null) ?? ready();
    case 'carry':
      return (speed > MOVING ? go({ ball: 'tuck' }) : null) ?? pose;
    case 'block':
      // a blocker's feet: the drive step forward, the pass set's slide, the kick-slide back
      return (speed > MOVING ? go({}, true) : null) ?? clip('block', t + b.id * 0.31);
    case 'throw':
      return clip('throw', THROW(since), { step: 1 });
    case 'catch': {
      const name = speed > 3 ? 'catch_run' : 'catch';
      return clip(name, clipMeta(name).events.catch - 0.06 + since, { step: 1 });
    }
    case 'windup':
      // gathering to dive: the crouch before he leaves his feet
      return has('dive') ? clip('dive', Math.max(0, clipMeta('dive').events.takeoff - 0.3 + Math.min(0.26, since * 0.7))) : pose;
    case 'tackle':
      return clip('dive', DIVE(since));
    case 'down': {
      // driven back against the way he faced: onto his back; otherwise face first
      const back = b.vx * m.face.x + b.vy * m.face.y < -0.5;
      return back ? clip(mirrorOf(b, 'fall_back'), FALL_BACK(since)) : clip(mirrorOf(b, 'fall_forward'), FALL_FORWARD(since));
    }
    case 'kick':
      return clip('kick', KICK(since), { step: 1 });
    case 'celebrate':
      return clip('celebrate', since);
    case 'stance':
      // moving out of his stance (motion, a release): a stride, never the idle clip
      return (speed > MOVING ? go() : null) ?? ready();
    default:
      return pose;
  }
}

const mix = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });

/** The ball arm over a recorded body: tucked high and tight in the left arm on the run (the ball's
 * drawn at the left hand), or held up at the chest in the right before a throw. */
export function ballArm(j: Joints, how: 'tuck' | 'hold'): Joints {
  if (how === 'tuck') {
    const sh = j.shL;
    const hand = { x: j.chest.x + 0.07, y: j.chest.y - 0.03, z: sh.z * 0.35 };
    const el = { x: sh.x - 0.04, y: j.chest.y - 0.12, z: sh.z * 1.1 };
    return { ...j, elL: el, wrL: mix(el, hand, 0.85), handL: hand };
  }
  const sh = j.shR;
  const hand = { x: j.chest.x + 0.1, y: j.chest.y + 0.01, z: sh.z * 0.3 };
  const el = { x: sh.x + 0.02, y: j.chest.y - 0.1, z: sh.z * 1.15 };
  return { ...j, elR: el, wrR: mix(el, hand, 0.85), handR: hand };
}

/** Where a body wants to face (the drawn facing turns toward it): null keeps the facing (a man diving or
 * going down keeps the way he faced). The quarterback in his drop faces downfield; a backpedalling
 * defender watches the quarterback unless he has opened his hips to run with his man; any defender
 * retreating from the ball faces it; anyone else faces the way he moves, or set, up the field
 * (offense) or down it (defense). Angles are atan2(y, x) on the field. */
export function faceTarget(b: Body, p: Play): number | null {
  if (b.act === 'tackle' || b.act === 'down') return null;
  const speed = Math.hypot(b.vx, b.vy);
  const at = (q: { x: number; y: number }) => Math.atan2(q.y - b.y, q.x - b.x);
  if (b === p.qb && p.phase === 'drop' && p.carrier === b) return Math.PI / 2;
  if (b.act === 'backpedal') {
    const mark = p.bodies.find((o) => o.id === b.mark);
    const openHips = speed > 4.8 && mark && mark.y > b.y - 1;
    if (!openHips) return at(p.qb);
  }
  const ball = ballNow(p) ?? p.carrier ?? p.qb;
  if (b.side === 'D' && speed > 0.6 && speed < 6 && ball !== b) {
    const bx = ball.x - b.x;
    const by = ball.y - b.y;
    if (b.vx * bx + b.vy * by < 0) return Math.atan2(by, bx);
  }
  if (speed > 0.6) return Math.atan2(b.vy, b.vx);
  return b.side === 'O' ? Math.PI / 2 : -Math.PI / 2;
}

/** A frame's motion for one body (players-5): what he shows, the facing to draw him in, a plant's dip,
 * the head's lead, the planted-foot offset and the lean. */
export interface BodyFrame {
  an: Anim;
  face: number;
  dip: boolean;
  lead: number;
  mo: Motion;
}

export function motionOf(b: Body, t: number, p: Play, look: Look, m: Memo, aiming: boolean): BodyFrame {
  const loco = (m.loco ??= freshLoco(Math.atan2(m.face.y, m.face.x)));
  // where he looks, unless he slides or backs off faster than his feet can that way (he opens his hips)
  const blocking = b.act === 'block' || (b.act === 'rush' && Math.hypot(b.vx, b.vy) < 2);
  const look0 = faceTarget(b, p);
  const want = look0 === null ? null : openHips(look0, b.vx, b.vy, (h) => gaitOptions(b, look, h, blocking));
  const { dt } = stepClock(loco, t, want ?? loco.face);
  // the snap, as this body sees it
  if (p.phase === 'pre') m.pre = true;
  else if (m.pre) {
    m.pre = false;
    m.snapAt = t;
  }
  const exempt = b.act === 'spin' || b.act === 'windup';
  const tr = want === null ? { face: loco.face, dip: false, lead: 0 } : turnToward(loco, want, dt, t, exempt);
  m.face = { x: Math.cos(tr.face), y: Math.sin(tr.face) };
  const an = animOf(b, t, p, look, m, aiming);
  const yd = legScale(look) * (b.p.ht / 36);
  const stride: StrideNow | null = an.gait && an.clip ? { meta: clipMeta(an.clip), ct: an.ct ?? 0, pick: an.gait, unitsPerLeg: yd } : null;
  const mo = bodyMotion(loco, { t, dt, vx: b.vx, vy: b.vy, face: tr.face, turnRate: dt > 0 ? tr.lead / dt : 0, top: speedOf(b.p), height: b.p.ht / 36, airborne: b.act === 'tackle' || b.act === 'down', stride });
  return { an, face: tr.face, dip: tr.dip, lead: tr.lead, mo };
}
