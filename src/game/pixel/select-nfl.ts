// NFL player selection (studio overhaul players-2, moved verbatim from football2/render.ts): the look
// a body is drawn with (helmet, pads), the motion-capture clip or hand-keyed pose it shows each frame,
// its stride and the ball arm. Render only: it reads the engine's bodies and never writes them. The
// select-golden test proves every choice here is the one the renderer made before the move.
import { DEFAULT_HAIR, DEFAULT_SKIN, type Look } from './body';
import { clipMeta, getClip, type Ground, legScale, warp } from './mocap';
import * as P from './poses';
import type { Joints, Pose } from './rig';
import { NFL_STANDINS, standIn } from './select-family';
import { heaviness } from './style';
import { isLine, speedOf } from '../football2/engine';
import type { Act, Body, Play } from '../football2/types';
import type { FbKit } from '../football2/render';

export function lookFor(b: Body, kit: FbKit): Look {
  const big = isLine(b) || b.p.pos === 'DT' || b.p.pos === 'DE';
  return {
    sport: 'nfl',
    ht: b.p.ht,
    wt: b.p.wt,
    num: b.p.num,
    hair: 0,
    skin: DEFAULT_SKIN,
    hairColor: DEFAULT_HAIR,
    jersey: kit.jersey,
    trim: kit.trim,
    shorts: kit.pants,
    socks: kit.socks,
    shoes: kit.shoes,
    helmet: kit.helmet,
    stripe: kit.stripe,
    mask: kit.mask,
    pants: kit.pants,
    pads: big ? 1.25 : 1,
  };
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

/** The motion-capture clips the field uses (mocap.ts). They load with the renderer; until they're in,
 * the hand-keyed poses stand in (and keep the stances, the backpedal and the moves with the ball). */
export const CLIPS = ['ready', 'jog', 'run', 'sprint', 'backpedal', 'shuffle', 'shuffle_l', 'block', 'throw', 'catch', 'catch_run', 'dive', 'fall_back', 'fall_back_m', 'fall_forward', 'fall_forward_m', 'kick', 'celebrate'];

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
}

/** What the drawing remembers of a body: his stride's phase, and the way he faced when he went
 * down (a man on the ground doesn't turn with his slide). */
export interface Memo {
  gait: { t: number; frac: number };
  face: { x: number; y: number };
  faceAt: number;
}

const has = (name: string) => !!getClip(name);
const mirrorOf = (b: Body, name: string) => (b.id % 2 ? name + '_m' : name);

/** A stride: jog, run or sprint by his speed, at the rate his feet keep up with the turf. */
export function gait(b: Body, t: number, look: Look, m: Memo, speed: number): { clip: string; ct: number } | null {
  if (!has('jog') || !has('run') || !has('sprint')) return null;
  // the clip's ground speed in yards a second on this man's sprite legs
  const yd = (name: string) => clipMeta(name).root.speed * legScale(look) * (b.p.ht / 36);
  let clip = 'jog';
  let best = Infinity;
  for (const c of ['jog', 'run', 'sprint']) {
    const d = Math.abs(Math.log(speed / yd(c)));
    if (d < best) {
      best = d;
      clip = c;
    }
  }
  // a heavy man's stride comes round a little slower (the lineman's plod)
  const rate = Math.max(0.65, Math.min(1.7, speed / yd(clip))) * (1.04 - 0.1 * heaviness(b.p.wt, b.p.ht));
  const dt = t - m.gait.t;
  if (dt > 0 && dt < 0.3) m.gait.frac = (m.gait.frac + (dt * rate) / clipMeta(clip).duration) % 1;
  m.gait.t = t;
  return { clip, ct: m.gait.frac * clipMeta(clip).duration };
}

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
  if (p.phase === 'pre' || (b.act === 'stance' && Math.hypot(b.vx, b.vy) < 0.6)) return pose;
  const speed = Math.hypot(b.vx, b.vy);
  const since = t - b.actAt;
  const clip = (name: string, ct: number, opts: Partial<Anim> = {}): Anim =>
    has(name) ? { key: '', pose: pose.pose, clip: name, ct, step: 2, ground: 'clip', ...opts } : pose;
  // the quarterback with the slingshot drawn back: arm cocked, ready to let it go
  if (aiming && b === p.qb && b === p.carrier) return clip('throw', THROW_COCKED, { step: 1 });
  switch (b.act) {
    case 'backpedal': {
      if (speed < 0.7) return clip('ready', t + b.id * 0.37, { step: 3 });
      const forward = b.vx * m.face.x + b.vy * m.face.y;
      const lateral = -b.vx * m.face.y + b.vy * m.face.x;
      const name = Math.abs(lateral) > Math.abs(forward) ? (lateral > 0 ? 'shuffle' : 'shuffle_l') : forward < -0.4 ? 'backpedal' : null;
      if (!name || !has(name)) {
        const g = gait(b, t, look, m, speed);
        return g ? clip(g.clip, g.ct) : pose;
      }
      const groundSpeed = clipMeta(name).root.speed * legScale(look) * (b.p.ht / 36);
      const dt = t - m.gait.t;
      if (dt > 0 && dt < 0.3) m.gait.frac = (m.gait.frac + dt * Math.max(0.65, Math.min(1.8, speed / Math.max(0.1, groundSpeed))) / clipMeta(name).duration) % 1;
      m.gait.t = t;
      return clip(name, m.gait.frac * clipMeta(name).duration);
    }
    case 'run':
    case 'rush': {
      // a rusher locked up with his blocker: driving into him
      if (b.act === 'rush' && speed < 2) return clip('block', t + b.id * 0.31);
      const g = speed > 1 ? gait(b, t, look, m, speed) : null;
      if (!g) return clip('ready', t + b.id * 0.37, { step: 3 });
      return clip(g.clip, g.ct, b === p.carrier ? { ball: p.phase === 'drop' ? 'hold' : 'tuck' } : {});
    }
    case 'carry': {
      const g = speed > 1.2 ? gait(b, t, look, m, speed) : null;
      return g ? clip(g.clip, g.ct, { ball: 'tuck' }) : pose;
    }
    case 'block':
      return clip('block', t + b.id * 0.31);
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
      return clip('ready', t + b.id * 0.37, { step: 3 });
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
