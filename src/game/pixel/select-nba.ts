// NBA player selection (studio overhaul players-2, moved from hoops2/render.ts): the look a body is
// drawn with, the motion-capture clip or hand-keyed pose it shows each frame, its stride, its dunk
// style, the rim hang and the dribble arm. players-5: strides from locomotion.ts (a walk below the jog,
// rates held to 0.8-1.25x, shorter steps for a slow drift, the defender's slide and backpedal at the
// speed he moves), turns that take time, the planted foot and the lean (`motionOf`). Render only: it
// reads the engine's bodies and never writes them. The renderer keeps the camera, the sprite cache
// and the drawing; the select-golden test pins every choice here.
import { refOf } from './appearance';
import type { Look } from './body';
import { matchLook } from './looks';
import { bodyMotion, freshLoco, openHips, headingOf, type GaitOption, type GaitPick, type Heading, type Loco, type Motion, pickGait, advancePhase, MAX_DT, stepClock, type StrideNow, turnToward } from './locomotion';
import { clipMeta, getClip, type Ground, legScale, warp } from './mocap';
import * as P from './poses';
import { preloadPixels } from './ready';
import type { Joints, Pose } from './rig';
import { NBA_STANDINS, standIn } from './select-family';
import { JUMPER_TOP, RIM_H, topSpeed } from '../hoops2/engine';
import type { Act, Body, Possession } from '../hoops2/types';
import type { Kit } from '../hoops2/render';

// this page's clips and looks start loading now, as the game chunk is evaluated, long before the first
// frame (players-3, ready.ts)
preloadPixels('nba');

/**
 * The dunk he throws down, by his ratings (tiered animations): through contact, a posterizer;
 * a windmill (or a 360) for an elite leaper-dunker (DNK 92+, VRT 85+); a tomahawk (DNK 85+, VRT
 * 75+); a two-handed power slam for a strong big (STR 80+, 6'9"+); otherwise one or two hands.
 */
export function dunkStyle(b: Body): P.DunkStyle {
  if (b.act === 'contact') return 'contact';
  if (b.act === 'standdunk') return 'two';
  const p = b.p;
  if (p.ddk >= 92 && p.vrt >= 85) return 'windmill';
  if (p.ddk >= 85 && p.vrt >= 75) return 'tomahawk';
  if (p.str >= 80 && p.ht >= 81) return 'two';
  return p.id.length % 2 ? 'one' : 'two';
}
/** an elite dunker spins a 360 on some of his windmill-tier dunks (by his id: the same man, the same dunk) */
export const spins360 = (b: Body) => b.act === 'dunk' && dunkStyle(b) === 'windmill' && b.p.id.charCodeAt(0) % 2 === 1;

/** His look in this kit: his appearance record (looks.ts), his engine height and weight. */
export function lookFor(b: Body, kit: Kit): Look {
  return matchLook('nba', refOf('nba', b.p.id), kit, { id: b.p.id, num: b.p.num, ht: b.p.ht, wt: b.p.wt, pos: b.p.pos });
}

/** The motion-capture clips the court uses (mocap.ts). They arrive in the NBA bundle before the first frame
 * (ready.ts); if they never do,
 * the hand-keyed poses below stand in. */
export const CLIPS = ['jumpshot', 'layup', 'ready', 'walk', 'jog', 'run', 'sprint', 'backpedal', 'shuffle', 'shuffle_l', 'celebrate', 'stumble', 'stumble_m', 'fall_back', 'fall_back_m', 'slip', 'slip_m', 'getup'];

/** The jump shot: its recorded release lands at the top of the meter, so a green is let go at the
 * height of his jump. */
const JUMPER = warp(clipMeta('jumpshot'), { release: JUMPER_TOP });
/** The layup: he leaves the floor and lets it go when the engine says (finish: up at 0.26 s, the
 * ball off his hand at the top, about 0.31 s later). */
const LAYUP = warp(clipMeta('layup'), { takeoff: 0.26, release: 0.57 });
/** Posterized: rocked back by the contact, flat on his back, then up again (quick, athletic: the
 * recorded get-up at about three times its speed) just as he's back in play (engine: 2.2 s). */
const POSTERIZED = warp(clipMeta('fall_back'), { impact: 0.3, ground: 0.55 });
const POSTER_UP = { at: 1.05, from: 0.4, rate: 2.8 };
/** Ankles broken: his feet go out from under him, then he scrambles up (engine: back in at 1.9 s). */
const ANKLES = warp(clipMeta('slip'), { impact: 0.42, ground: 0.8 });
const ANKLES_UP = { at: 0.9, from: 0.47, rate: 3.2 };
const GETUP_END = 3.63;

/** What a body shows: a recorded clip at a time, or a hand-keyed pose. */
export interface Anim {
  key: string;
  pose: Pose;
  clip?: string;
  /** clip seconds */
  ct?: number;
  /** frame step: 1 is the clip's 30 fps, 2 is 15 */
  step?: number;
  /** 'clip': the recorded jump is in the drawing (he's drawn from the floor); 'pin': feet on the floor */
  ground?: Ground;
  /** the ball hand dribbling (0 the ball at the floor, 1 in his hand): the run with the ball */
  dribble?: number;
  /** a stride (locomotion.ts): its rate, stride scale and direction, for the renderer and the anchor */
  gait?: GaitPick;
  /** a bump on the run (0-1): the body rocks back over his stride instead of stopping in a pose */
  bump?: number;
}

/** What the drawing remembers of a body between frames: the stride it's in, the last shot or fall
 * (so a follow-through and a get-up play out after the engine has moved on). */
export interface Memo {
  /** the stride's phase on game time, and the stride last shown (kept while it still fits) */
  gait: { t: number; frac: number; clip?: string; stride?: number };
  last: { act: 'shoot' | 'layup' | 'fall' | 'dunk' | 'contact' | 'standdunk'; at: number; kind?: 'posterized' | 'ankles' } | null;
  /** locomotion's state (players-5): drawn facing, turn, planted foot, lean; made on first use */
  loco?: Loco;
}

/** The finishes that aren't jump shots (the rest of a shot's kinds are jumpers). */
export const AT_RIM = ['layup', 'dunk', 'contact', 'standdunk', 'oop'];

const has = (name: string) => !!getClip(name);
/** over this (ft/s) a body is moving: his feet stride (players-5: the 1-3 ft/s dead bands are gone) */
const MOVING = 1;
const mirrorOf = (b: Body, name: string) => (b.p.id.length % 2 ? name + '_m' : name);

/** A recorded stride's ground speed on this man's sprite legs, ft/s at rate 1. */
const ftOf = (b: Body, look: Look, name: string) => clipMeta(name).root.speed * legScale(look) * (b.p.ht / 12);

/** The strides for each way he travels relative to where he faces (locomotion.ts `pickGait` picks):
 * forward walk, jog, run, sprint; back the backpedal, then a back-run (walk or jog played backward);
 * sideways the defensive slide, its steps shortening for a slow drift. */
export function gaitOptions(b: Body, look: Look, h: Heading): GaitOption[] {
  const o = (clip: string, more: Partial<GaitOption> = {}): GaitOption => ({ clip, speed: ftOf(b, look, clip), ...more });
  const list =
    h === 'fwd'
      ? ['walk', 'jog', 'run', 'sprint'].map((c) => o(c))
      : h === 'back'
        ? [o('backpedal'), o('walk', { reverse: true }), o('jog', { reverse: true })]
        : [o(h === 'right' ? 'shuffle' : 'shuffle_l', { minStride: 0.15 })];
  return list.filter((g) => has(g.clip));
}

/** A stride at his speed: the pick (rate 0.8-1.25x, stride scale), its phase carried from frame to frame
 * on game time so a change of speed or clip doesn't skip a step. */
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

/** The drawn facing (the turn under way, locomotion.ts), or the engine's before the first frame. */
const faceOf = (b: Body, m: Memo) => m.loco?.face ?? b.face;

/** Every act the NBA selection animates (hoops2/types.ts `Act`); anything else gets a stand-in. */
export const KNOWN_ACTS: ReadonlySet<string> = new Set<Act>(['idle', 'screen', 'run', 'dribble', 'shoot', 'layup', 'dunk', 'contact', 'standdunk', 'pass', 'catch', 'defend', 'contest', 'block', 'cross', 'stepback', 'spin', 'stumble', 'fall', 'land', 'celebrate', 'rebound']);

/**
 * What a body is doing right now, as a clip or a pose. An act this file doesn't animate yet (a V2
 * act the engine emits first) is drawn as its family's stand-in (select-family.ts). `shotAt`: when a
 * jump shot of his left his hands (the ball's in the air), so a shot tapped too quickly to be seen
 * rising still follows through.
 */
export function animOf(b: Body, t: number, carrying: boolean, look: Look, m: Memo, shotAt: number | null): Anim {
  if (!KNOWN_ACTS.has(b.act)) b = { ...b, act: standIn(b.act, KNOWN_ACTS, NBA_STANDINS, Math.hypot(b.vx, b.vz) > 1) as Act };
  return animKnown(b, t, carrying, look, m, shotAt);
}

function animKnown(b: Body, t: number, carrying: boolean, look: Look, m: Memo, shotAt: number | null): Anim {
  const pose: Anim = poseOf(b, t, carrying);
  const speed = Math.hypot(b.vx, b.vz);
  // off the floor (still up after a dunk, knocked back in the air), a clip keeps its feet under him
  // and he's drawn at his height; only the jump shot's recorded leap is drawn into the clip itself
  const air = b.h > 0.05;
  const clip = (name: string, ct: number, opts: Partial<Anim> = {}): Anim =>
    has(name) ? { key: '', pose: pose.pose, clip: name, ct, step: 2, ground: air ? 'pin' : 'clip', ...opts } : pose;
  // a stride the way he travels, at the speed he travels
  const go = (opts: Partial<Anim> = {}): Anim | null => {
    const g = stride(t, m, speed, gaitOptions(b, look, headingOf(faceOf(b, m), b.vx, b.vz)));
    return g ? clip(g.clip, g.ct, { gait: g.pick, ...opts }) : null;
  };
  // remember the moments whose ends play out after the engine moves on
  if (m.last && t < m.last.at) m.last = null;
  if (b.act === 'shoot' || b.act === 'layup' || b.act === 'dunk' || b.act === 'contact' || b.act === 'standdunk') m.last = { act: b.act, at: b.actAt };
  else if (b.act === 'fall') m.last = { act: 'fall', at: b.actAt, kind: b.fallKind };
  else if (shotAt !== null && !(m.last?.act === 'shoot' && m.last.at > shotAt - 1.5)) m.last = { act: 'shoot', at: shotAt - JUMPER_TOP };
  const since = t - b.actAt;
  if (b.contactAt !== undefined && t >= b.contactAt && t - b.contactAt < 0.18 && !air && !AT_RIM.includes(b.act)) {
    const bump = Math.sin((t - b.contactAt) / 0.18 * Math.PI);
    // moving: the bump rocks him back over his stride (his feet keep going)
    const arm = b.act === 'dribble' ? { dribble: Math.round(P.dribbleBall((t * (1.5 + speed / 18)) % 1, 1) * 4) / 4 } : {};
    const run = speed > MOVING && (b.act === 'run' || b.act === 'dribble' || b.act === 'defend') ? go({ bump: Math.round(bump * 5) / 5, ...arm }) : null;
    if (run) return run;
    return { key: 'body-up:' + Math.round(bump * 5) + ':' + pose.key, pose: { ...pose.pose, lean: pose.pose.lean - 0.18 * bump, crouch: pose.pose.crouch + 0.035 * bump } };
  }
  // the follow-through and the landing after the ball's gone; the get-up after a fall
  const tail = m.last && b.act !== m.last.act && (b.act === 'idle' || b.act === 'run' || b.act === 'defend') ? m.last : null;
  if (tail) {
    const ts = t - tail.at;
    if (tail.act === 'shoot' && ts < 1.0 && (ts < 0.8 || speed < 6)) return clip('jumpshot', JUMPER(ts*(b.shotTempo??1)), { step: 1, ground: 'clip' });
    // a dunker hangs on in his dunk until he's down
    if ((tail.act === 'dunk' || tail.act === 'contact' || tail.act === 'standdunk') && (air || ts < 0.75)) return poseOf({ ...b, act: tail.act, actAt: tail.at }, t, false);
    if (tail.act === 'layup' && ts < 0.95) return clip('layup', LAYUP(ts), { ground: 'pin' });
    // (once the engine has him running again, he's up: the get-up gives way to his stride)
    if (tail.act === 'fall' && speed <= 3) {
      const up = tail.kind === 'posterized' ? POSTER_UP : ANKLES_UP;
      const ct = up.from + (ts - up.at) * up.rate;
      if (ct < GETUP_END) return clip('getup', ct);
    }
  }
  switch (b.act) {
    case 'shoot':
      return clip('jumpshot', JUMPER(since*(b.shotTempo??1)), { step: 1, ground: 'clip' });
    case 'layup':
      return clip('layup', LAYUP(since), { ground: 'pin' });
    case 'fall': {
      const up = b.fallKind === 'posterized' ? POSTER_UP : ANKLES_UP;
      if (since >= up.at) return clip('getup', up.from + (since - up.at) * up.rate);
      return b.fallKind === 'posterized' ? clip(mirrorOf(b, 'fall_back'), POSTERIZED(since)) : clip(mirrorOf(b, 'slip'), ANKLES(since));
    }
    case 'stumble':
      return clip(mirrorOf(b, 'stumble'), since * 1.3);
    case 'celebrate':
      return clip('celebrate', since);
    case 'run':
    case 'idle':
      // moving at all, a stride (a walk below the jog: no frozen stance while he drifts)
      return (speed > MOVING ? go() : null) ?? clip('ready', t + b.idx * 0.37);
    case 'dribble': {
      // on the move: a real stride, the ball hand pumping with the bounce (the same beat the ball keeps)
      if (speed <= MOVING) return pose;
      const up = P.dribbleBall((t * (1.5 + speed / 18)) % 1, 1);
      return go({ dribble: Math.round(up * 4) / 4 }) ?? pose;
    }
    case 'defend':
      // sliding with his man at the speed he slides, backpedalling or running back at his speed
      return (speed > MOVING ? go() : null) ?? pose;
    default:
      return pose;
  }
}

/** A rim hang (render only): after a posterizer or a big man's power slam goes down, he hangs on
 * the rim a moment instead of dropping straight away. */
export function hangOf(p: Possession, b: Body): { h: number; ph: number } | null {
  const ball = p.ball;
  if (!p.end || p.end.kind !== 'make' || !ball || ball.kind !== 'shot' || ball.who !== b.idx) return null;
  const big = ball.shot === 'contact' || ((ball.shot === 'dunk' || ball.shot === 'standdunk') && (b.p.str >= 85 || b.p.ddk >= 92));
  const since = p.t - ball.t1;
  if (!big || since < 0 || since > 0.55) return null;
  return { h: Math.max(0, RIM_H - (b.p.ht / 12) * 1.08), ph: Math.min(4, Math.floor((since / 0.55) * 4)) / 4 };
}

/** The ball hand in a dribble on the run: out in front at his side, down with the bounce. */
export function dribbleArm(j: Joints, up: number): Joints {
  const sh = j.shR;
  const hy = j.pelvis.y + 0.02 - 0.08 * (1 - up);
  const hand = { x: sh.x + 0.14, y: hy, z: sh.z + 0.05 };
  const el = { x: sh.x - 0.03, y: (sh.y + hy) / 2 + 0.03, z: sh.z + 0.08 };
  const wr = { x: el.x + (hand.x - el.x) * 0.82, y: el.y + (hand.y - el.y) * 0.82, z: el.z + (hand.z - el.z) * 0.82 };
  return { ...j, elR: el, wrR: wr, handR: hand };
}

/** The pose and its cache key for what a body is doing right now. */
export function poseOf(b: Body, t: number, carrying: boolean): { key: string; pose: Pose } {
  const since = t - b.actAt;
  const speed = Math.hypot(b.vx, b.vz);
  const timed = (dur: number, frames = 10) => Math.min(frames, Math.floor((since / dur) * frames)) / frames;
  const cycle = (hz: number, frames: number) => Math.floor((((t * hz) % 1) + 1) % 1 * frames) / frames;
  switch (b.act) {
    case 'screen':
      // Original brace pose: feet planted, elbows tucked, with no new art dependency.
      return { key: 'screen', pose: { ...P.idle(0), lean: .04, crouch: .07, spread: .2, kneeL: .25, kneeR: .25, shL: .12, shR: .12, elL: 1.4, elR: 1.4, abL: .12, abR: .12 } };
    case 'dribble': {
      const sp = Math.min(1, speed / 18);
      const ph = cycle(sp > 0.1 ? 1.5 + sp : 1.6, 8);
      return { key: 'dr' + ph + (sp > 0.1 ? 'm' + Math.round(sp * 3) : 's'), pose: P.dribble(ph, sp > 0.1 ? sp : 0) };
    }
    case 'run': {
      const sp = Math.min(1, speed / 18);
      const ph = cycle(1.1 + sp * 1.3, 8);
      return { key: 'rn' + ph + Math.round(sp * 3), pose: P.run(ph, 0.4 + sp * 0.6) };
    }
    case 'shoot': {
      const ph = timed(0.62/(b.shotTempo??1), 12);
      return { key: 'js' + ph, pose: P.jumpShot(ph) };
    }
    case 'layup': {
      const ph = timed(0.6);
      return { key: 'ly' + ph, pose: P.layup(ph) };
    }
    case 'dunk':
    case 'contact':
    case 'standdunk': {
      const ph = timed(0.62, 12);
      const style = spins360(b) ? 'two' : dunkStyle(b);
      return { key: b.act + style + ph, pose: P.dunk(ph, style) };
    }
    case 'pass': {
      const ph = timed(0.3, 6);
      return { key: 'ps' + ph, pose: P.pass(ph) };
    }
    case 'catch': {
      const ph = timed(0.25, 5);
      return { key: 'ct' + ph, pose: P.catchBall(1 - ph) };
    }
    case 'cross': {
      const ph = timed(0.35, 6);
      return { key: 'cr' + ph, pose: P.crossover(ph) };
    }
    case 'stepback': {
      const ph = timed(0.35, 6);
      return { key: 'sb' + ph, pose: P.crossover(1 - ph) };
    }
    case 'spin': {
      const ph = timed(0.45, 6);
      return { key: 'sn' + ph, pose: P.spin(ph) };
    }
    case 'fall': {
      // ankles broken: he stumbles, then he's down, then he scrambles up
      if (since < 0.35) {
        const ph = timed(0.35, 4);
        return { key: 'fs' + ph, pose: P.stumble(ph) };
      }
      return since < 1.2 ? { key: 'fd', pose: P.grounded() } : { key: 'fu', pose: P.stumble(0.4) };
    }
    case 'contest':
    case 'block':
    case 'rebound': {
      const ph = timed(0.7);
      return { key: 'co' + ph, pose: P.contest(ph) };
    }
    case 'stumble': {
      const ph = timed(0.7, 7);
      return { key: 'st' + ph, pose: P.stumble(ph) };
    }
    case 'defend': {
      const active = speed > 3 ? 1 : 0;
      const ph = active ? cycle(2.2, 6) : 0;
      return { key: 'df' + ph + active, pose: P.defend(ph, active) };
    }
    case 'celebrate': {
      const ph = cycle(1.4, 6);
      return { key: 'ce' + ph, pose: P.celebrate(ph) };
    }
    default: {
      const ph = carrying ? 0 : cycle(0.5, 4);
      return { key: 'id' + ph, pose: P.idle(ph) };
    }
  }
}

/** A frame's motion for one body (players-5): what he shows, the facing to draw him in (turning at
 * 90° per 100 ms toward the engine's, a plant's dip, the head's lead), and the planted-foot offset
 * and lean. Spins and falls take the engine's facing at once. */
export interface BodyFrame {
  an: Anim;
  face: number;
  dip: boolean;
  lead: number;
  mo: Motion;
}

export function motionOf(b: Body, t: number, carrying: boolean, look: Look, m: Memo, shotAt: number | null): BodyFrame {
  const loco = (m.loco ??= freshLoco(b.face));
  // where he looks (the engine's facing), unless he slides or backs off faster than his feet can that way
  const want = openHips(b.face, b.vx, b.vz, (h) => gaitOptions(b, look, h));
  const { dt } = stepClock(loco, t, want);
  const exempt = b.act === 'spin' || b.act === 'fall' || b.act === 'stumble' || spins360(b);
  const tr = turnToward(loco, want, dt, t, exempt);
  const an = animOf(b, t, carrying, look, m, shotAt);
  const ft = legScale(look) * (b.p.ht / 12);
  const stride: StrideNow | null = an.gait && an.clip ? { meta: clipMeta(an.clip), ct: an.ct ?? 0, pick: an.gait, unitsPerLeg: ft } : null;
  const mo = bodyMotion(loco, { t, dt, vx: b.vx, vy: b.vz, face: tr.face, turnRate: dt > 0 ? tr.lead / dt : 0, top: topSpeed(b, false), height: b.p.ht / 12, airborne: b.h > 0.05, stride });
  return { an, face: tr.face, dip: tr.dip, lead: tr.lead, mo };
}
