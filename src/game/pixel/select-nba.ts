// NBA player selection (studio overhaul players-2, moved verbatim from hoops2/render.ts): the look a
// body is drawn with, the motion-capture clip or hand-keyed pose it shows each frame, its stride, its
// dunk style, the rim hang and the dribble arm. Render only: it reads the engine's bodies and never
// writes them. The renderer keeps the camera, the sprite cache and the drawing; the select-golden test
// proves every choice here is the one the renderer made before the move.
import { DEFAULT_HAIR, DEFAULT_SKIN, beardFor, hairFor, type Look } from './body';
import { clipMeta, getClip, type Ground, legScale, warp } from './mocap';
import * as P from './poses';
import { preloadPixels } from './ready';
import type { Joints, Pose } from './rig';
import { NBA_STANDINS, standIn } from './select-family';
import { heaviness } from './style';
import { JUMPER_TOP, RIM_H } from '../hoops2/engine';
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

export function lookFor(b: Body, kit: Kit): Look {
  return {
    sport: 'nba',
    ht: b.p.ht,
    wt: b.p.wt,
    num: b.p.num,
    hair: hairFor(b.p.id),
    beard: beardFor(b.p.id),
    skin: DEFAULT_SKIN,
    hairColor: DEFAULT_HAIR,
    jersey: kit.jersey,
    trim: kit.trim,
    shorts: kit.shorts,
    socks: kit.socks,
    shoes: kit.shoes,
  };
}

/** The motion-capture clips the court uses (mocap.ts). They arrive in the NBA bundle before the first frame
 * (ready.ts); if they never do,
 * the hand-keyed poses below stand in. */
export const CLIPS = ['jumpshot', 'layup', 'ready', 'jog', 'run', 'sprint', 'backpedal', 'shuffle', 'shuffle_l', 'celebrate', 'stumble', 'stumble_m', 'fall_back', 'fall_back_m', 'slip', 'slip_m', 'getup'];

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
}

/** What the drawing remembers of a body between frames: the stride it's in, the last shot or fall
 * (so a follow-through and a get-up play out after the engine has moved on). */
export interface Memo {
  gait: { t: number; frac: number };
  last: { act: 'shoot' | 'layup' | 'fall' | 'dunk' | 'contact' | 'standdunk'; at: number; kind?: 'posterized' | 'ankles' } | null;
}

/** The finishes that aren't jump shots (the rest of a shot's kinds are jumpers). */
export const AT_RIM = ['layup', 'dunk', 'contact', 'standdunk', 'oop'];

const has = (name: string) => !!getClip(name);
const mirrorOf = (b: Body, name: string) => (b.p.id.length % 2 ? name + '_m' : name);

/** A stride on the run: jog, run or sprint by his speed, played at the rate his feet keep up with
 * the floor, the phase carried from frame to frame so a change of speed doesn't skip a step. */
export function gait(b: Body, t: number, look: Look, m: Memo, speed: number): { clip: string; ct: number } | null {
  if (!has('jog') || !has('run') || !has('sprint')) return null;
  // the clip's ground speed in feet a second on this man's sprite legs
  const ft = (name: string) => clipMeta(name).root.speed * legScale(look) * (b.p.ht / 12);
  const options = ['jog', 'run', 'sprint'];
  let clip = options[0];
  let best = Infinity;
  for (const c of options) {
    const d = Math.abs(Math.log(speed / ft(c)));
    if (d < best) {
      best = d;
      clip = c;
    }
  }
  // a heavy man's stride comes round a little slower (the lineman's plod, not the guard's patter)
  const rate = Math.max(0.65, Math.min(1.5, speed / ft(clip))) * (1.04 - 0.1 * heaviness(b.p.wt, b.p.ht));
  const dt = t - m.gait.t;
  if (dt > 0 && dt < 0.3) m.gait.frac = (m.gait.frac + (dt * rate) / clipMeta(clip).duration) % 1;
  m.gait.t = t;
  return { clip, ct: m.gait.frac * clipMeta(clip).duration };
}

/** Every act the NBA selection animates (hoops2/types.ts `Act`); anything else gets a stand-in. */
export const KNOWN_ACTS: ReadonlySet<string> = new Set<Act>(['idle', 'screen', 'run', 'dribble', 'shoot', 'layup', 'dunk', 'contact', 'standdunk', 'pass', 'catch', 'defend', 'contest', 'block', 'cross', 'stepback', 'spin', 'pump', 'euro', 'stumble', 'fall', 'land', 'celebrate', 'rebound']);

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
  // remember the moments whose ends play out after the engine moves on
  if (m.last && t < m.last.at) m.last = null;
  if (b.act === 'shoot' || b.act === 'layup' || b.act === 'dunk' || b.act === 'contact' || b.act === 'standdunk') m.last = { act: b.act, at: b.actAt };
  else if (b.act === 'fall') m.last = { act: 'fall', at: b.actAt, kind: b.fallKind };
  else if (shotAt !== null && !(m.last?.act === 'shoot' && m.last.at > shotAt - 1.5)) m.last = { act: 'shoot', at: shotAt - JUMPER_TOP };
  const since = t - b.actAt;
  if (b.contactAt !== undefined && t >= b.contactAt && t - b.contactAt < 0.18 && !air && !AT_RIM.includes(b.act)) {
    const bump = Math.sin((t - b.contactAt) / 0.18 * Math.PI);
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
    if (tail.act === 'fall') {
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
    case 'run': {
      const g = speed > 2.5 ? gait(b, t, look, m, speed) : null;
      return g ? clip(g.clip, g.ct) : clip('ready', t + b.idx * 0.37, { step: 3 });
    }
    case 'idle':
      return clip('ready', t + b.idx * 0.37, { step: 3 });
    case 'dribble': {
      // on the move: a real stride, the ball hand pumping with the bounce (the same beat the ball keeps)
      if (speed <= 1.8) return pose;
      const g = gait(b, t, look, m, speed);
      if (!g) return pose;
      const up = P.dribbleBall((t * (1.5 + speed / 18)) % 1, 1);
      return clip(g.clip, g.ct, { dribble: Math.round(up * 4) / 4 });
    }
    case 'defend': {
      if (speed <= 3) return pose;
      // sliding with his man: the defensive shuffle to his right or left; going back or up the
      // floor, a stride
      const lat = -b.vx * Math.sin(b.face) + b.vz * Math.cos(b.face);
      const fwd = b.vx * Math.cos(b.face) + b.vz * Math.sin(b.face);
      if (fwd < -3 && Math.abs(fwd) >= Math.abs(lat) && has('backpedal')) {
        const name = 'backpedal', ft = clipMeta(name).root.speed * legScale(look) * (b.p.ht / 12);
        const dt = t - m.gait.t;
        if (dt > 0 && dt < 0.3) m.gait.frac = (m.gait.frac + dt * Math.max(0.7, Math.min(1.6, -fwd / Math.max(0.1, ft))) / clipMeta(name).duration) % 1;
        m.gait.t = t;
        return clip(name, m.gait.frac * clipMeta(name).duration);
      }
      if (Math.abs(lat) > Math.abs(fwd) && has('shuffle')) {
        const name = lat > 0 ? 'shuffle' : 'shuffle_l';
        const ft = clipMeta(name).root.speed * legScale(look) * (b.p.ht / 12);
        const dt = t - m.gait.t;
        if (dt > 0 && dt < 0.3) m.gait.frac = (m.gait.frac + (dt * Math.max(0.7, Math.min(1.6, Math.abs(lat) / ft))) / clipMeta(name).duration) % 1;
        m.gait.t = t;
        return clip(name, m.gait.frac * clipMeta(name).duration);
      }
      const g = gait(b, t, look, m, speed);
      return g ? clip(g.clip, g.ct) : pose;
    }
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
    // nba-2 fallbacks until players' own poses land (plan §4.6): the pump fake is the start of the
    // jump shot and back down; the euro-step rides the crossover's weight shift
    case 'pump': {
      const ph = timed(0.34, 6);
      return { key: 'pf' + ph, pose: P.jumpShot(0.3 * (ph < 0.5 ? ph * 2 : (1 - ph) * 2)) };
    }
    case 'euro': {
      const ph = timed(0.34, 6);
      return { key: 'eu' + ph, pose: P.crossover(ph) };
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
