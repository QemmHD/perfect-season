// Soccer player selection (studio overhaul players-2, moved from soccer2/render.ts): the look a body is
// drawn with (a keeper's kit and gloves), the motion-capture clip or hand-keyed pose it shows each
// frame and its stride. players-5: the facing (it was the renderer's) turns at 90° per 100 ms and a
// defender getting back faces the ball; a drifting player walks instead of standing in `ready`; every
// stride, forward, back or sideways, comes from locomotion.ts at the speed he moves (`motionOf`).
// Render only: it reads the engine's bodies and never writes them. The select-golden test pins every
// choice here.
import { refOf } from './appearance';
import type { Look } from './body';
import { matchLook } from './looks';
import { advancePhase, bodyMotion, freshLoco, openHips, type GaitOption, type GaitPick, type Heading, headingOf, type Loco, MAX_DT, type Motion, pickGait, stepClock, type StrideNow, turnToward } from './locomotion';
import { clipMeta, getClip, legScale, warp } from './mocap';
import * as P from './poses';
import { preloadPixels } from './ready';
import type { Pose } from './rig';
import { SOCCER_STANDINS, standIn } from './select-family';
import type { Act, Body } from '../soccer2/types';
import type { SoccerKit } from '../soccer2/render';

// this page's clips and looks start loading now, as the game chunk is evaluated, long before the first
// frame (players-3, ready.ts)
preloadPixels('soccer');

export const CLIPS = ['ready', 'walk', 'jog', 'run', 'sprint', 'kick', 'dive', 'fall_forward', 'fall_forward_m', 'fall_back', 'catch', 'jump', 'celebrate', 'shuffle', 'shuffle_l', 'backpedal'];
/** the kick: the boot through the ball when the engine strikes it (0.11 s after the swing starts) */
const KICK = warp(clipMeta('kick'), { contact: 0.11 });
/** a slide tackle or a keeper's dive: off his feet at once, down 0.45 s later */
const DIVE = warp(clipMeta('dive'), { takeoff: 0.02, impact: 0.42, ground: 0.6 });
const FALL = warp(clipMeta('fall_forward'), { impact: 0.3, ground: 0.5 });
/** a header: the jump's top at contact */
const JUMP = warp(clipMeta('jump'), { takeoff: 0.0, apex: 0.18 });

export interface Anim {
  key: string;
  pose: Pose;
  clip?: string;
  ct?: number;
  step?: number;
  /** a stride (locomotion.ts): its rate, stride scale and direction */
  gait?: GaitPick;
}

export interface Memo {
  /** the stride's phase on game time, and the stride last shown (kept while it still fits) */
  gait: { t: number; frac: number; clip?: string; stride?: number };
  /** the drawn facing as a unit vector (kept with `loco.face`) */
  face: { x: number; y: number };
  /** locomotion's state (players-5): drawn facing, turn, planted foot, lean; made on first use */
  loco?: Loco;
}

const has = (name: string) => !!getClip(name);
export const heightM = (b: Body) => b.p.ht / 100;

export function lookFor(b: Body, kit: SoccerKit, keeperKit: SoccerKit): Look {
  const gk = b.role === 'gk';
  const k = gk ? keeperKit : kit;
  // one build with his card (buildOf: his height, his position's weight), his appearance record
  return matchLook('soccer', refOf('soccer', b.p.id), k, { id: b.p.id, num: b.p.num ?? (gk ? 1 : null), ht: b.p.ht, pos: b.p.pos, gk });
}

/** A recorded stride's ground speed on this man's sprite legs, m/s at rate 1. */
const msOf = (b: Body, look: Look, name: string) => clipMeta(name).root.speed * legScale(look) * heightM(b);

/** The strides for each way he travels relative to where he faces (locomotion.ts `pickGait` picks):
 * forward walk, jog, run, sprint; back the backpedal, then a back-run; sideways the shuffle, its steps
 * shortening for a slow drift. */
export function gaitOptions(b: Body, look: Look, h: Heading): GaitOption[] {
  const o = (clip: string, more: Partial<GaitOption> = {}): GaitOption => ({ clip, speed: msOf(b, look, clip), ...more });
  const list =
    h === 'fwd'
      ? ['walk', 'jog', 'run', 'sprint'].map((c) => o(c))
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

/** over this (m/s) a body is moving: his feet stride (players-5: no ready clip while he drifts) */
const MOVING = 0.15;

/** Every act the soccer selection animates (soccer2/types.ts `Act`); anything else gets a stand-in. */
export const KNOWN_ACTS: ReadonlySet<string> = new Set<Act>(['idle', 'run', 'dribble', 'kick', 'tackle', 'down', 'dive', 'catch', 'header', 'celebrate', 'set', 'wall']);

/** What a body shows; an act this file doesn't animate yet is drawn as its family's stand-in (select-family.ts). */
export function animOf(b: Body, t: number, look: Look, m: Memo): Anim {
  if (!KNOWN_ACTS.has(b.act)) b = { ...b, act: standIn(b.act, KNOWN_ACTS, SOCCER_STANDINS, Math.hypot(b.vx, b.vy) > 1) as Act };
  return animKnown(b, t, look, m);
}

function animKnown(b: Body, t: number, look: Look, m: Memo): Anim {
  const since = t - b.actAt;
  const speed = Math.hypot(b.vx, b.vy);
  const fallback: Anim = { key: 'id' + Math.floor(((t * 0.5) % 1) * 4), pose: P.idle(Math.floor(((t * 0.5) % 1) * 4) / 4) };
  const clip = (name: string, ct: number, step = 2): Anim => (has(name) ? { key: '', pose: fallback.pose, clip: name, ct, step } : fallback);
  switch (b.act) {
    case 'kick':
      if (since < 0.55) return clip('kick', KICK(since), 1);
      break;
    case 'tackle':
      if (since < 0.9) return clip('dive', DIVE(since));
      break;
    case 'dive':
      return clip('dive', DIVE(since));
    case 'down':
      return clip(b.id % 2 ? 'fall_forward_m' : 'fall_forward', FALL(since));
    case 'header':
      if (since < 0.7) return clip('jump', JUMP(since), 1);
      break;
    case 'catch':
      return clip('catch', Math.min(clipMeta('catch').events.catch, since + 0.2), 1);
    case 'celebrate':
      if (speed > 2) {
        const g = stride(t, m, speed, gaitOptions(b, look, 'fwd'));
        if (g) return { ...clip(g.clip, g.ct), gait: g.pick };
      }
      return clip('celebrate', since);
    case 'wall':
      return b.h > 0.05 ? clip('jump', JUMP(0.12 + b.h * 0.1), 1) : clip('ready', t + b.id * 0.37);
    default:
      break;
  }
  if (speed > MOVING) {
    // forward, back or sideways from where he faces (a defender getting back faces the ball: motionOf)
    const g = stride(t, m, speed, gaitOptions(b, look, headingOf(Math.atan2(m.face.y, m.face.x), b.vx, b.vy)));
    if (g) return { ...clip(g.clip, g.ct), gait: g.pick };
    const ph = Math.floor((((t * (1.2 + speed * 0.15)) % 1) + 1) % 1 * 8) / 8;
    return { key: 'rn' + ph, pose: P.run(ph, speed > 5 ? 1 : 0.6) };
  }
  return clip('ready', t + b.id * 0.37);
}

/** Where a body wants to face: the engine's facing, a keeper's dive across his line, and a defender
 * getting back (backing off or sliding, under 4.5 m/s) faces the ball (V2 B.3.6). atan2(y, x). */
export function faceTarget(b: Body, ball: { x: number; y: number }): number {
  if (b.role === 'gk' && b.act === 'dive') return Math.atan2(0, Math.sign(b.vx) || 1);
  const speed = Math.hypot(b.vx, b.vy);
  const bx = ball.x - b.x;
  const by = ball.y - b.y;
  if (b.side === 'D' && b.role !== 'gk' && speed > MOVING && speed < 4.5 && Math.hypot(bx, by) > 0.5 && b.vx * bx + b.vy * by < 0) return Math.atan2(by, bx);
  return Math.atan2(b.fy, b.fx);
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

/** a footballer's top speed (m/s), for what counts as a burst */
const TOP_MS = 8;

export function motionOf(b: Body, t: number, look: Look, m: Memo, ball: { x: number; y: number }): BodyFrame {
  const loco = (m.loco ??= freshLoco(Math.atan2(m.face.y, m.face.x)));
  // where he looks, unless he slides or backs off faster than his feet can that way (he opens his hips)
  const want = openHips(faceTarget(b, ball), b.vx, b.vy, (h) => gaitOptions(b, look, h));
  const { dt } = stepClock(loco, t, want);
  const down = b.act === 'tackle' || b.act === 'down' || b.act === 'dive';
  // a man going to ground keeps the way he faced (a keeper turns into his dive at once)
  const tr = down && b.role !== 'gk' ? { face: loco.face, dip: false, lead: 0 } : turnToward(loco, want, dt, t, b.act === 'dive' || b.act === 'kick');
  m.face = { x: Math.cos(tr.face), y: Math.sin(tr.face) };
  const an = animOf(b, t, look, m);
  const units = legScale(look) * heightM(b);
  const stride: StrideNow | null = an.gait && an.clip ? { meta: clipMeta(an.clip), ct: an.ct ?? 0, pick: an.gait, unitsPerLeg: units } : null;
  const mo = bodyMotion(loco, { t, dt, vx: b.vx, vy: b.vy, face: tr.face, turnRate: dt > 0 ? tr.lead / dt : 0, top: TOP_MS, height: heightM(b), airborne: down || b.h > 0.05, stride });
  return { an, face: tr.face, dip: tr.dip, lead: tr.lead, mo };
}
