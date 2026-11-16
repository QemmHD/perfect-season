// Soccer player selection (studio overhaul players-2, moved verbatim from soccer2/render.ts): the look
// a body is drawn with (a keeper's kit and gloves), the motion-capture clip or hand-keyed pose it
// shows each frame and its stride. Render only: it reads the engine's bodies and never writes them.
// The select-golden test proves every choice here is the one the renderer made before the move.
import { DEFAULT_HAIR, DEFAULT_SKIN, beardFor, hairFor, type Look } from './body';
import { clipMeta, getClip, legScale, warp } from './mocap';
import * as P from './poses';
import type { Pose } from './rig';
import type { Body } from '../soccer2/types';
import type { SoccerKit } from '../soccer2/render';

export const CLIPS = ['ready', 'jog', 'run', 'sprint', 'kick', 'dive', 'fall_forward', 'fall_forward_m', 'fall_back', 'catch', 'jump', 'celebrate', 'shuffle', 'shuffle_l', 'backpedal'];
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
}

export interface Memo {
  gait: { t: number; frac: number };
  face: { x: number; y: number };
  faceAt: number;
}

const has = (name: string) => !!getClip(name);
export const heightM = (b: Body) => b.p.ht / 100;

export function lookFor(b: Body, kit: SoccerKit, keeperKit: SoccerKit): Look {
  const gk = b.role === 'gk';
  const k = gk ? keeperKit : kit;
  const ht = b.p.ht / 2.54;
  return {
    sport: 'soccer',
    ht,
    wt: Math.round(23 * Math.pow(b.p.ht / 100, 2) * 2.2046),
    num: b.p.num ?? (gk ? 1 : null),
    hair: hairFor(b.p.id),
    beard: beardFor(b.p.id),
    skin: DEFAULT_SKIN,
    hairColor: DEFAULT_HAIR,
    jersey: k.jersey,
    trim: k.trim,
    shorts: k.shorts,
    socks: k.socks,
    shoes: k.shoes,
    sleeves: gk ? 'long' : 'short',
    gloves: gk ? (k.gloves ?? '#f2f2ee') : undefined,
  };
}

/** A stride: jog, run or sprint by his speed, at the rate his feet keep up with the grass. */
export function gait(b: Body, t: number, look: Look, m: Memo, speed: number): { clip: string; ct: number } | null {
  if (!has('jog') || !has('run') || !has('sprint')) return null;
  const ms = (name: string) => clipMeta(name).root.speed * legScale(look) * heightM(b);
  let clip = 'jog';
  let best = Infinity;
  for (const c of ['jog', 'run', 'sprint']) {
    const d = Math.abs(Math.log(speed / ms(c)));
    if (d < best) {
      best = d;
      clip = c;
    }
  }
  const rate = Math.max(0.65, Math.min(1.7, speed / ms(clip)));
  const dt = t - m.gait.t;
  if (dt > 0 && dt < 0.3) m.gait.frac = (m.gait.frac + (dt * rate) / clipMeta(clip).duration) % 1;
  m.gait.t = t;
  return { clip, ct: m.gait.frac * clipMeta(clip).duration };
}

export function animOf(b: Body, t: number, look: Look, m: Memo): Anim {
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
        const g = gait(b, t, look, m, speed);
        if (g) return clip(g.clip, g.ct);
      }
      return clip('celebrate', since);
    case 'wall':
      return b.h > 0.05 ? clip('jump', JUMP(0.12 + b.h * 0.1), 1) : clip('ready', t + b.id * 0.37, 3);
    default:
      break;
  }
  if (speed > 1) {
    // a defender facing the ball while he gets back: the backpedal / shuffle
    const forward = b.vx * m.face.x + b.vy * m.face.y;
    const lateral = -b.vx * m.face.y + b.vy * m.face.x;
    if (b.side === 'D' && speed < 4.5 && forward < -0.5 && Math.abs(forward) > Math.abs(lateral) && has('backpedal')) {
      const dt = t - m.gait.t;
      if (dt > 0 && dt < 0.3) m.gait.frac = (m.gait.frac + (dt * 1.1) / clipMeta('backpedal').duration) % 1;
      m.gait.t = t;
      return clip('backpedal', m.gait.frac * clipMeta('backpedal').duration);
    }
    const g = gait(b, t, look, m, speed);
    if (g) return clip(g.clip, g.ct);
    const ph = Math.floor((((t * (1.2 + speed * 0.15)) % 1) + 1) % 1 * 8) / 8;
    return { key: 'rn' + ph, pose: P.run(ph, speed > 5 ? 1 : 0.6) };
  }
  return clip('ready', t + b.id * 0.37, 3);
}
