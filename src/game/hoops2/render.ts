// Draws arcade basketball as fine pixel art through the broadcast camera (camera.ts: high, three-
// quarter, yawed 12° off the rim line, framed inside the HUD's action-safe box; the same either way
// up): the court drawn a row at a time, the arena's stands behind the basket, ten rigged players in
// their moves, the ball, the backboard, rim and net, the shot meter arched over the shooter and the
// contest grade, and the name chips (labels.ts) placed so none covers another.
import { DEFAULT_HAIR, DEFAULT_SKIN, beardFor, drawBody, hairFor, type Look, type Sprite, SpriteCache, CanvasOut, freeCanvas } from '../pixel/body';
import { type CourtTheme, text } from '../pixel/court';
import { clipMeta, frameAt, getClip, type Ground, legScale, loadClips, mocapJoints, mocapKey, warp } from '../pixel/mocap';
import { courtTexture, type FieldTex } from '../pixel/persp';
import * as P from '../pixel/poses';
import type { Joints, Pose } from '../pixel/rig';
import { heaviness, leanForward, sprintLean, widen } from '../pixel/style';
import { type Juice, squashStretch } from '../juice';
import { ballPos, JUMPER_TOP, RIM, RIM_H, topSpeed } from './engine';
import { HoopsHud, type HudView } from './hud-draw';
import { type Cam3, CAM, camOf, camStart, camStep, type CamState, depthOf, facingIndex, guardOf, pitchAt, project, type SafeBox, screenToCourt, subjectOf, yawFor } from './camera';
import { drawCourtFloor } from './floor';
import { drawChip, foldName, type LabelReq, layoutLabels } from './labels';
import type { Body, Possession } from './types';

export interface Kit {
  jersey: string;
  trim: string;
  shorts: string;
  socks: string;
  shoes: string;
}

export interface Fx {
  /** net swish after a make (1 → 0) */
  swish: number;
  /** screen shake (pixels) */
  shake: number;
  /** the crowd on its feet (0-1) */
  crowd: number;
  /** a white flash (0-1) */
  flash: number;
  /** trauma shake, kick, zoom and particles (render only) */
  juice?: Juice;
}

/**
 * The dunk he throws down, by his ratings (2K-style animation tiers): through contact, a posterizer;
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


function lookFor(b: Body, kit: Kit): Look {
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

/** The motion-capture clips the court uses (mocap.ts). They load with the renderer; until they're in,
 * the hand-keyed poses below stand in. */
const CLIPS = ['jumpshot', 'layup', 'ready', 'jog', 'run', 'sprint', 'backpedal', 'shuffle', 'shuffle_l', 'celebrate', 'stumble', 'stumble_m', 'fall_back', 'fall_back_m', 'slip', 'slip_m', 'getup'];

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
interface Anim {
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
interface Memo {
  gait: { t: number; frac: number };
  last: { act: 'shoot' | 'layup' | 'fall' | 'dunk' | 'contact' | 'standdunk'; at: number; kind?: 'posterized' | 'ankles' } | null;
}

/** The finishes that aren't jump shots (the rest of a shot's kinds are jumpers). */
const AT_RIM = ['layup', 'dunk', 'contact', 'standdunk', 'oop'];

const has = (name: string) => !!getClip(name);
const mirrorOf = (b: Body, name: string) => (b.p.id.length % 2 ? name + '_m' : name);

/** A stride on the run: jog, run or sprint by his speed, played at the rate his feet keep up with
 * the floor, the phase carried from frame to frame so a change of speed doesn't skip a step. */
function gait(b: Body, t: number, look: Look, m: Memo, speed: number): { clip: string; ct: number } | null {
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

/**
 * What a body is doing right now, as a clip or a pose. `shotAt`: when a jump shot of his left his
 * hands (the ball's in the air), so a shot tapped too quickly to be seen rising still follows through.
 */
function animOf(b: Body, t: number, carrying: boolean, look: Look, m: Memo, shotAt: number | null): Anim {
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
function hangOf(p: Possession, b: Body): { h: number; ph: number } | null {
  const ball = p.ball;
  if (!p.end || p.end.kind !== 'make' || !ball || ball.kind !== 'shot' || ball.who !== b.idx) return null;
  const big = ball.shot === 'contact' || ((ball.shot === 'dunk' || ball.shot === 'standdunk') && (b.p.str >= 85 || b.p.ddk >= 92));
  const since = p.t - ball.t1;
  if (!big || since < 0 || since > 0.55) return null;
  return { h: Math.max(0, RIM_H - (b.p.ht / 12) * 1.08), ph: Math.min(4, Math.floor((since / 0.55) * 4)) / 4 };
}

/** The ball hand in a dribble on the run: out in front at his side, down with the bounce. */
function dribbleArm(j: Joints, up: number): Joints {
  const sh = j.shR;
  const hy = j.pelvis.y + 0.02 - 0.08 * (1 - up);
  const hand = { x: sh.x + 0.14, y: hy, z: sh.z + 0.05 };
  const el = { x: sh.x - 0.03, y: (sh.y + hy) / 2 + 0.03, z: sh.z + 0.08 };
  const wr = { x: el.x + (hand.x - el.x) * 0.82, y: el.y + (hand.y - el.y) * 0.82, z: el.z + (hand.z - el.z) * 0.82 };
  return { ...j, elR: el, wrR: wr, handR: hand };
}

/** The pose and its cache key for what a body is doing right now. */
function poseOf(b: Body, t: number, carrying: boolean): { key: string; pose: Pose } {
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

export class HoopsRenderer {
  W = 0;
  H = 0;
  zoom = 1;
  /** the broadcast camera (camera.ts): its follow state, and the camera it places this frame */
  private cs: CamState = camStart();
  private c3!: Cam3;
  /** where the HUD leaves the court free (hud/geometry.ts; the host sets it on every resize) */
  private box: SafeBox = { safeTop: 0, safeBottom: 0, land: false };
  /** the last frame's time (real seconds), for the camera's time-based follow */
  private lastReal: number | null = null;
  /** with reduced motion the camera settles twice as fast and never shakes */
  reduced = false;
  /** the Clutch possessions: the camera sits 6% tighter (V2 B.0.4) */
  clutch = false;
  private tex: FieldTex | null = null;
  /** the floor at half resolution, and the camera it was cast for (NBA-29: reused while the camera
   * has moved less than half a pixel) */
  private floor: { canvas: HTMLCanvasElement; img: ImageData; px: Uint32Array; at: { a: number; b: number; yaw: number; zoom: number; tilt: number } | null } | null = null;
  /** floor casts skipped (the cache) and made, for the probes */
  floorStats = { cast: 0, reused: 0 };
  private sprites = new SpriteCache(360);
  private last = new Map<string, Sprite>();

  /** The game's over: hand back every canvas this drew with, now (iOS caps a page's canvas memory). */
  dispose() {
    this.sprites.dispose();
    for (const s of this.last.values()) freeCanvas(s.canvas);
    this.last.clear();
    freeCanvas(this.floor?.canvas);
    this.floor = null;
  }
  /**
   * A rematch in the same arena (the held arena, plan §4.8): new kits and court, the camera from
   * scratch, the sprite caches kept (the same men keep their drawings). Nothing new is allocated.
   */
  reset(theme?: CourtTheme, kits?: [Kit, Kit]) {
    if (theme && theme !== this.theme) {
      this.theme = theme;
      this.tex = null;
      if (this.floor) this.floor.at = null;
    }
    if (kits && (kits[0] !== this.kits[0] || kits[1] !== this.kits[1])) {
      this.kits = kits;
      this.looks.clear();
    }
    this.cs = camStart();
    this.lastReal = null;
    this.replay = null;
    this.showOdds = true;
    this.clutch = false;
    this.hud.reset();
    this.netSnapUntil = 0;
    this.prevBall = null;
    this.memos.clear();
  }
  private budget = 0;
  private looks = new Map<string, Look>();
  private memos = new Map<string, Memo>();
  private lastLift = new Map<string, boolean>();
  /** an instant replay: the spot to look at, and the camera pushed in a little */
  replay: { cx: number; cz: number } | null = null;
  /** the live shot % under the ball handler and over a pass target (off in replays and the autopilot) */
  showOdds = true;
  /** the court's HUD layer: the rings, the arc meter, Heat on the ball (hud-draw.ts) */
  readonly hud = new HoopsHud();
  /** a make's net snap: the net stretched down for three frames (until this real time, s) */
  netSnapUntil = 0;
  /** what the HUD layer may read of the renderer this frame */
  private view(): HudView {
    return {
      W: this.W,
      H: this.H,
      reduced: this.reduced,
      showOdds: this.showOdds,
      replaying: !!this.replay,
      at: (cx, cz, h = 0) => this.at(cx, cz, h),
      pitch: (cx, cz) => Math.sin(pitchAt(this.c3, cx, cz)),
      chip: (text, x, y, color, pri, slack) => this.chip(text, x, y, color, pri, slack)
    };
  }

  constructor(
    private theme: CourtTheme,
    private kits: [Kit, Kit]
  ) {
    loadClips(CLIPS).catch(() => {
      // the hand-keyed poses carry on
    });
  }

  /** Game pixels are screen pixels: fine pixel art, crisp on any phone. `box`: the HUD's safe box. */
  resize(cssW: number, cssH: number, box?: SafeBox) {
    const W = Math.max(1, Math.round(cssW));
    const H = Math.max(1, Math.round(cssH));
    const boxed = box ?? { safeTop: Math.round(H * 0.14), safeBottom: Math.round(H * 0.67), land: W > H };
    const sameBox = boxed.safeTop === this.box.safeTop && boxed.safeBottom === this.box.safeBottom && boxed.land === this.box.land;
    if (W === this.W && H === this.H && sameBox) return;
    this.box = boxed;
    if (W !== this.W || H !== this.H) {
      // only the floor is drawn for a size: the players' drawings are keyed by their size on screen,
      // so they stay and the old sizes age out. Nothing goes without its memory handed back: Safari
      // slides its toolbar in and out as you tap near the bottom, resizing the game each time, and
      // a page's canvases count against a cap (the game freezes past it) until they're freed
      freeCanvas(this.floor?.canvas);
      this.floor = null;
    } else if (this.floor) this.floor.at = null;
    this.W = W;
    this.H = H;
    // a new shape is a new framing: the camera starts again from where the play is
    this.cs = camStart();
    this.c3 = camOf(this.cs, W, H, this.box);
  }

  /** A court point (along cx, across cz, height h, feet) on screen, and the pixels a foot there. */
  private at(cx: number, cz: number, h = 0) {
    return project(this.c3, cx, cz, h);
  }
  /** The same, for effects drawn by the game (particles at a dunk, a block) and the QA probes. */
  screenOf(cx: number, cz: number, h = 0): { x: number; y: number; s: number } | null {
    return this.c3 ? this.at(cx, cz, h) : null;
  }
  /** The stick (screen right x, down y) as a court direction: up the screen is the camera's forward. */
  stickToCourt(x: number, y: number): { cx: number; cz: number } {
    return this.c3 ? screenToCourt(this.c3, x, y) : { cx: -y, cz: x };
  }

  /** this frame's chips (names, odds, the meter's words), laid out together at the end */
  private chips: LabelReq[] = [];
  /** A chip: folded to the pixel font, centred at x with its plate's top at y. */
  private chip(text: string, x: number, y: number, color: string, pri: number, slack?: number) {
    const t = foldName(text);
    // a man off the side of the screen gets no chip (it would be pinned to the edge, by nobody)
    if (t && x >= 0 && x <= this.W) this.chips.push({ text: t, x, y, color, pri, slack });
  }

  /** Follow the play (camera.ts), by real time; a replay looks at its spot from closer. */
  private follow(p: Possession, real: number) {
    const dt = this.lastReal === null ? 0 : Math.max(0, Math.min(0.25, real - this.lastReal));
    this.lastReal = real;
    const sub = subjectOf(p);
    const ref = p.ball?.kind === 'shot' ? p.ball.who : p.handler;
    const man = ref !== null ? p.bodies[ref] : null;
    const yaw = this.replay ? this.cs.yaw : man ? yawFor(man, guardOf(p, man.idx), this.cs.yaw) : this.cs.yaw;
    const zoom = this.replay ? CAM.replay : this.clutch && !this.reduced ? CAM.clutch : 1;
    this.cs = camStep(this.cs, { W: this.W, H: this.H, box: this.box, rim: { ...RIM, h: RIM_H }, subject: sub, yaw, zoom, spot: this.replay }, dt, this.reduced);
    this.c3 = camOf(this.cs, this.W, this.H, this.box);
  }
  private prevBall: { x: number; y: number; real: number } | null = null;

  /** A body's drawing this frame and whether the jump is drawn into it (then he's placed on the floor). */
  private sprite(b: Body, t: number, carrying: boolean, kit: Kit, s: number, ball: Possession['ball'], over?: { key: string; pose: Pose }): { spr: Sprite; ownLift: boolean } {
    // facing on screen, relative to the camera (it's yawed: camera.ts facingIndex); a 360 dunk
    // turns him all the way round on the way up
    const turn = spins360(b) ? Math.PI * 2 * Math.min(1, Math.max(0, (t - b.actAt - 0.12) / 0.42)) : 0;
    const raw = Math.max(10, Math.round((b.p.ht / 12) * s));
    const px = raw > 14 ? raw - (raw % 2) : raw;
    const dirs = px < 26 ? 8 : 16;
    const fb = facingIndex(this.c3, b.face + turn, dirs);
    const pitch = Math.round(Math.min(0.9, pitchAt(this.c3, b.cx, b.cz)) / 0.15) * 0.15;
    const who = b.p.id + '|' + b.side;
    let look = this.looks.get(who);
    if (!look) {
      look = lookFor(b, kit);
      this.looks.set(who, look);
    }
    let memo = this.memos.get(who);
    if (!memo) {
      memo = { gait: { t, frac: (b.idx * 0.29) % 1 }, last: null };
      this.memos.set(who, memo);
    }
    const shotAt = ball && ball.kind === 'shot' && ball.who === b.idx && !AT_RIM.includes(ball.shot ?? '') ? ball.t0 : null;
    const an: Anim = over ? { key: over.key, pose: over.pose } : animOf(b, t, carrying, look, memo, shotAt);
    const frame = an.clip ? frameAt(an.clip, an.ct ?? 0, an.step ?? 2) : 0;
    // body type on the run: a heavy man's wider base, a fast man's sprint lean
    const striding = !!an.clip && (an.clip === 'jog' || an.clip === 'run' || an.clip === 'sprint');
    const heavy = striding ? Math.round(heaviness(b.p.wt, b.p.ht) * 4) / 4 : 0;
    const lean = striding ? sprintLean(b.p.spd, Math.hypot(b.vx, b.vz) / Math.max(1, topSpeed(b, false))) : 0;
    const key = (an.clip ? mocapKey(an.clip, frame, an.ground) + (an.dribble !== undefined ? 'd' + an.dribble : '') : an.key) + (heavy ? 'w' + heavy : '') + (lean ? 'l' + lean : '');
    const ownLift = !!an.clip && an.ground === 'clip';
    const k = who + '|' + key + '|' + fb + '/' + dirs + '|' + px + '|' + pitch;
    let spr = this.sprites.get(k);
    if (!spr) {
      // a few new drawings a frame (the man with the ball always gets his): the rest keep last frame's
      const last = this.last.get(who);
      if (this.budget <= 0 && last && !carrying) return { spr: last, ownLift: this.lastLift.get(who) ?? false };
      this.budget--;
      const view = { facing: (fb / dirs) * Math.PI * 2, pitch };
      const make = () => {
        if (!an.clip) return drawBody(look, { ...an.pose, lift: 0 }, view, px);
        let j = mocapJoints(an.clip, frame, look, { ground: an.ground });
        if (an.dribble !== undefined) j = dribbleArm(j, an.dribble);
        if (heavy) j = widen(j, heavy * 0.45, heavy * 0.008);
        if (lean) j = leanForward(j, lean);
        return drawBody(look, j, view, px);
      };
      try {
        spr = make();
      } catch (e) {
        if (!(e instanceof CanvasOut)) throw e;
        // the phone is out of canvas memory: let go of every old drawing and try once more; failing
        // that, he keeps last frame's
        this.sprites.dispose(this.last.values());
        try {
          spr = make();
        } catch {
          if (last) return { spr: last, ownLift: this.lastLift.get(who) ?? false };
          throw e;
        }
      }
      this.sprites.set(k, spr, this.last.values());
    }
    this.last.set(who, spr);
    this.lastLift.set(who, ownLift);
    return { spr, ownLift };
  }

  private drawFloorNow(ctx: CanvasRenderingContext2D) {
    if (!this.tex) this.tex = courtTexture(this.theme);
    // the floor at half resolution, doubled: a quarter of the work, the pixels still square
    const q = 2;
    if (!this.floor) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(this.W / q);
      canvas.height = Math.ceil(this.H / q);
      const img = canvas.getContext('2d')!.createImageData(canvas.width, canvas.height);
      this.floor = { canvas, img, px: new Uint32Array(img.data.buffer), at: null };
    }
    const fl = this.floor;
    // NBA-29: cast again only once the camera has moved half a pixel (a still camera, a held shot,
    // a pause, the settle at the end of a follow all reuse the last cast)
    const c = this.cs;
    const was = fl.at;
    const s0 = this.c3.s0;
    const moved = !was || Math.abs(c.a - was.a) * s0 > 0.5 || Math.abs(c.b - was.b) * s0 > 0.5 || Math.abs(c.yaw - was.yaw) * this.c3.f > 0.5 || Math.abs(c.zoom - was.zoom) * this.W > 0.5 || Math.abs(c.tilt - was.tilt) * this.H > 0.5;
    if (moved) {
      drawCourtFloor(this.c3, this.tex, fl.px, q);
      fl.canvas.getContext('2d')!.putImageData(fl.img, 0, 0);
      fl.at = { a: c.a, b: c.b, yaw: c.yaw, zoom: c.zoom, tilt: c.tilt };
      this.floorStats.cast++;
    } else this.floorStats.reused++;
    ctx.drawImage(fl.canvas, 0, 0, fl.canvas.width * q, fl.canvas.height * q);
  }

  /** The stanchion and the backboard, behind everything near the hoop. */
  private drawBoard(ctx: CanvasRenderingContext2D) {
    const c1 = this.theme.c1;
    const poly = (pts: { x: number; y: number }[], fill: string, stroke?: string, lw = 1) => {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    };
    // the padded base behind the baseline, the pole and the arm out to the board
    const bx = 51;
    poly([this.at(bx - 1.5, -2.6, 0), this.at(bx - 1.5, 2.6, 0), this.at(bx - 1.5, 2.6, 3.4), this.at(bx - 1.5, -2.6, 3.4)], c1, 'rgba(0,0,0,0.5)');
    const pb = this.at(bx, 0, 3.4);
    const pt = this.at(bx, 0, 12.8);
    const pw = Math.max(2, Math.round(pb.s * 0.55));
    ctx.fillStyle = '#3a3e4a';
    ctx.fillRect(Math.round(pb.x - pw / 2), Math.round(pt.y), pw, Math.round(pb.y - pt.y));
    const arm0 = this.at(bx, 0, 12.6);
    const arm1 = this.at(43.2, 0, 12.6);
    ctx.strokeStyle = '#3a3e4a';
    ctx.lineWidth = Math.max(2, Math.round(arm1.s * 0.45));
    ctx.beginPath();
    ctx.moveTo(arm0.x, arm0.y);
    ctx.lineTo(arm1.x, arm1.y);
    ctx.stroke();
    // the glass, its frame, the shooter's square
    const B = 43;
    const g = [this.at(B, -3, 13.5), this.at(B, 3, 13.5), this.at(B, 3, 10), this.at(B, -3, 10)];
    const s = g[0].s;
    poly(g, 'rgba(196,222,236,0.82)', '#f6f6f6', Math.max(1, Math.round(s * 0.16)));
    const sq = [this.at(B, -1, 11.5), this.at(B, 1, 11.5), this.at(B, 1, 10.15), this.at(B, -1, 10.15)];
    ctx.strokeStyle = '#d62828';
    ctx.lineWidth = Math.max(1, Math.round(s * 0.13));
    ctx.beginPath();
    sq.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.stroke();
    // a glint across the glass
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1, Math.round(s * 0.2));
    const a = this.at(B, -2.4, 13.2);
    const b = this.at(B, -0.8, 10.4);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  /** The rim (back or front half) and, with the front, the net, swaying after a make. */
  private drawRim(ctx: CanvasRenderingContext2D, half: 'back' | 'front', swish: number, snap = 0) {
    const r = 0.75;
    const ring = (a: number, h = RIM_H) => this.at(RIM.cx + Math.cos(a) * r, RIM.cz + Math.sin(a) * r, h);
    const c = this.at(RIM.cx, RIM.cz, RIM_H);
    const lw = Math.max(1, Math.round(c.s * 0.14));
    // back half: away from the camera (along its forward, which is yawed); front: toward it
    const a0 = (half === 'back' ? -Math.PI / 2 : Math.PI / 2) + this.cs.yaw;
    if (half === 'front') {
      // the net: strands from the rim down to a narrower ring, swaying after a swish; a make snaps
      // it down for three frames (V2 B.0.5)
      const len = 1.5 * (1 - swish * 0.25) + snap * 0.9;
      ctx.lineWidth = Math.max(1, Math.round(c.s * 0.07));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const top = ring(a);
        const sway = Math.sin(swish * 22 + i * 1.3) * swish * 0.3;
        const bot = this.at(RIM.cx + Math.cos(a) * r * 0.5 + sway, RIM.cz + Math.sin(a) * r * 0.5, RIM_H - len);
        ctx.strokeStyle = Math.cos(a - this.cs.yaw) > 0 ? 'rgba(200,204,214,0.85)' : 'rgba(246,246,246,0.95)';
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(bot.x, bot.y);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = half === 'back' ? '#b8481a' : '#f06422';
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const q = ring(a0 + (i / 16) * Math.PI);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    }
    ctx.stroke();
  }

  /** The ball, its size by its distance, the seams turning as it spins. */
  private drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, real: number, fire: boolean, ss?: { angle: number; along: number; across: number }) {
    const r = Math.max(2.5, s * 0.4);
    let X = Math.round(x);
    let Y = Math.round(y);
    const shaped = !!ss && (Math.abs(ss.along - 1) > 0.04 || Math.abs(ss.across - 1) > 0.04);
    if (shaped) {
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(ss.angle);
      ctx.scale(ss.along, ss.across);
      ctx.rotate(-ss.angle);
      X = 0;
      Y = 0;
    }
    ctx.fillStyle = '#3c180a';
    ctx.beginPath();
    ctx.arc(X, Y, r + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fire ? '#ff7a1e' : '#de6822';
    ctx.beginPath();
    ctx.arc(X, Y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fire ? '#ffc070' : '#f8964a';
    ctx.beginPath();
    ctx.arc(X - r * 0.3, Y - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    const a = real * 9;
    ctx.strokeStyle = '#46200c';
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(X + Math.cos(a) * r, Y + Math.sin(a) * r);
    ctx.lineTo(X - Math.cos(a) * r, Y - Math.sin(a) * r);
    ctx.stroke();
    if (shaped) ctx.restore();
  }

  /** One frame. `real` keeps the crowd and the ball's spin moving between plays. */
  /** Pick a real teammate's projected body, so tapping him passes directly. */
  teammateAt(p: Possession,x:number,y:number,radius:number):number|null {
    if(!this.c3)return null;
    let nearest=radius,target:number|null=null;
    for(const b of p.bodies)if(b.side==='O'&&b.idx!==p.handler){const foot=this.at(b.cx,b.cz),head=this.at(b.cx,b.cz,b.h+b.p.ht/12);const d=Math.hypot(x-foot.x,y-(head.y+foot.y)/2);if(d<nearest){nearest=d;target=b.idx;}}
    return target;
  }

  draw(ctx: CanvasRenderingContext2D, p: Possession, real: number, fx: Fx) {
    this.budget = 4;
    this.chips = [];
    ctx.imageSmoothingEnabled = false;
    // the broadcast camera follows the play (camera.ts)
    const bp = ballPos(p);
    this.follow(p, real);
    const jv = fx.juice?.view() ?? { x: 0, y: 0, scale: 1 };
    const sx = (fx.shake ? Math.round((Math.random() - 0.5) * fx.shake * 2) : 0) + jv.x;
    const sy = (fx.shake ? Math.round((Math.random() - 0.5) * fx.shake * 2) : 0) + jv.y;
    ctx.save();
    if (jv.scale !== 1) {
      // the zoom punch, about the middle of the view
      ctx.translate(this.W / 2, this.H * 0.55);
      ctx.scale(jv.scale, jv.scale);
      ctx.translate(-this.W / 2, -this.H * 0.55);
    }
    ctx.translate(sx, sy);
    this.drawFloorNow(ctx);
    this.drawBoard(ctx);
    const call = p.playCall;
    if (!this.replay && !p.end && !p.meter && !p.finish && call && call.until > p.t && call.kind !== 'space') {
      const actor = p.bodies[call.actor];
      if (actor && actor.idx !== p.handler) {
        const goal = call.kind === 'screen' && !call.rolling ? call.target : { cx: RIM.cx - 2, cz: actor.cz > 0 ? 2.5 : -2.5 };
        const from = this.at(actor.cx, actor.cz), to = this.at(goal.cx, goal.cz);
        ctx.save(); ctx.strokeStyle = '#88f6da99'; ctx.lineWidth = 1.5; ctx.setLineDash([4,4]);
        ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.setLineDash([]);
        ctx.beginPath();ctx.ellipse(to.x,to.y,Math.max(4,to.s*1.3),Math.max(2,to.s*.45),0,0,Math.PI*2);ctx.stroke();
        this.chip(call.kind === 'cut' || call.rolling ? 'CUT' : 'SCREEN', to.x, to.y - 11, '#b4ffe6', 1);ctx.restore();
      }
    }
    if(!this.replay&&p.ball?.kind==='loose'&&p.rebounder!==undefined){
      const b=p.bodies[p.rebounder],f=this.at(b.cx,b.cz),to=this.at(p.ball.to.cx,p.ball.to.cz);
      ctx.strokeStyle='#19e3c9';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(f.x,f.y,Math.max(6,f.s*1.7),Math.max(2,f.s*.6),0,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#ffd579bb';ctx.setLineDash([3,3]);ctx.beginPath();ctx.ellipse(to.x,to.y,Math.max(6,to.s*2),Math.max(2,to.s*.7),0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
    // the HUD's rings on the floor (hud-draw.ts), under the players
    const view = this.view();
    this.hud.under(ctx, view, p, real);
    // shadows on the floor
    const t = p.t;
    for (const b of p.bodies) {
      const f = this.at(b.cx, b.cz);
      const shrink = 1 / (1 + b.h * 0.12);
      const rx = Math.max(3, Math.round(f.s * 1.05 * shrink));
      const ry = Math.max(1, Math.round(rx * Math.sin(pitchAt(this.c3, b.cx, b.cz)) * 0.9));
      ctx.fillStyle = 'rgba(30,14,6,' + (0.4 * shrink).toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // the ball's shadow
    const bsh = this.at(bp.cx, bp.cz);
    ctx.fillStyle = 'rgba(30,14,6,0.35)';
    ctx.beginPath();
    ctx.ellipse(Math.round(bsh.x), Math.round(bsh.y), Math.max(2, bsh.s * 0.4), Math.max(1, bsh.s * 0.18), 0, 0, Math.PI * 2);
    ctx.fill();
    // the players and the back of the rim, far to near
    const items: { depth: number; draw: () => void }[] = [];
    let handSpot: { x: number; y: number; s: number } | null = null;
    const headOf: Record<number, { x: number; y: number; right: number }> = {};
    for (const b of p.bodies) {
      items.push({
        depth: depthOf(this.c3, b.cx, b.cz),
        draw: () => {
          const carrying = p.handler === b.idx;
          // a rim hang after a big slam: render only, the engine's man is already coming down
          const hang = hangOf(p, b);
          const f0 = this.at(b.cx, b.cz, hang !== null ? Math.max(b.h, hang.h) : b.h);
          const { spr: s, ownLift } = this.sprite(b, t, carrying, this.kits[b.side === 'O' ? 0 : 1], f0.s, p.ball, hang ? { key: 'hang' + hang.ph, pose: P.dunk(hang.ph, 'hang') } : undefined);
          // a recorded jump is in the drawing itself: then he stands on the floor spot
          const f = ownLift ? this.at(b.cx, b.cz) : f0;
          const x = Math.round(f.x - s.ax);
          const y = Math.round(f.y - s.ay);
          // a burner at full stride (SPD 92+): a short afterimage behind him
          const v = Math.hypot(b.vx, b.vz);
          if (b.p.spd >= 92 && v > 16 && b.h < 0.2 && b.act !== 'shoot' && !this.replay) {
            const a0 = ctx.globalAlpha;
            for (const [back, alpha] of [[12, 0.12], [8, 0.2], [4, 0.3]] as const) {
              const q = b.trail[b.trail.length - 1 - back];
              if (!q) continue;
              const g = this.at(q.cx, q.cz);
              ctx.globalAlpha = a0 * alpha;
              ctx.drawImage(s.canvas, Math.round(g.x - s.ax), Math.round(g.y - s.ay));
            }
            ctx.globalAlpha = a0;
          }
          ctx.drawImage(s.canvas, x, y);
          headOf[b.idx] = { x: Math.round(f.x), y: y + s.top, right: x + s.canvas.width };
          if (carrying) handSpot = { x: x + s.handR.x, y: y + s.handR.y, s: f.s };
        },
      });
    }
    items.push({ depth: depthOf(this.c3, RIM.cx, RIM.cz) + 0.4, draw: () => this.drawRim(ctx, 'back', fx.swish) });
    items.sort((a, b) => b.depth - a.depth);
    for (const it of items) it.draw();
    // the ball: in a flight, on the dribble, or in his hands
    const fire = p.heat === 'fire';
    let ball: { x: number; y: number; s: number };
    const hs = handSpot as { x: number; y: number; s: number } | null;
    if (p.ball) ball = this.at(bp.cx, bp.cz, bp.h);
    else if (hs && p.handler !== null) {
      const h = p.bodies[p.handler];
      if (h.act === 'dribble' && !p.meter && !p.finish) {
        const speed = Math.hypot(h.vx, h.vz);
        const up = P.dribbleBall((t * (speed > 1.8 ? 1.5 + speed / 18 : 1.6)) % 1, speed > 1.8 ? 1 : 0);
        const floor = this.at(h.cx, h.cz).y;
        ball = { x: hs.x, y: floor + (hs.y + 2 - floor) * up, s: hs.s };
      } else ball = { x: hs.x, y: hs.y - 1, s: hs.s };
    } else ball = this.at(bp.cx, bp.cz, bp.h);
    // squash as it meets the floor on the dribble, stretch along a fast flight
    let squash = 0;
    if (!p.ball && hs && p.handler !== null && p.bodies[p.handler].act === 'dribble' && !p.meter && !p.finish) {
      const floorY = this.at(p.bodies[p.handler].cx, p.bodies[p.handler].cz).y;
      squash = Math.max(0, 1 - Math.abs(floorY - ball.y) / Math.max(2, ball.s * 0.6));
    }
    const pb = this.prevBall;
    const dtb = pb ? Math.max(1 / 120, real - pb.real) : 1;
    const ss = squashStretch(pb && dtb < 0.1 ? (ball.x - pb.x) / dtb : 0, pb && dtb < 0.1 ? (ball.y - pb.y) / dtb : 0, squash);
    this.prevBall = { x: ball.x, y: ball.y, real };
    this.drawBall(ctx, ball.x, ball.y, ball.s, real, fire, ss);
    this.hud.ball(ctx, view, ball.x, ball.y, ball.s, p.heat, real);
    // the front of the rim and the net, over the ball
    this.drawRim(ctx, 'front', fx.swish, real < this.netSnapUntil && !this.reduced ? 1 : 0);
    // sweat, sparks and confetti
    fx.juice?.draw(ctx);
    // the arc meter, the pass target's and the handler's chips (hud-draw.ts)
    this.hud.over(ctx, view, p, real, headOf);
    // every chip this frame, placed by priority so none covers another (labels.ts)
    for (const q of layoutLabels(this.chips, this.W, this.H)) drawChip(ctx, q);
    ctx.restore();
    // the crowd on its feet: a warm pulse from the stands
    if (fx.crowd > 0.05) {
      ctx.fillStyle = 'rgba(255,214,120,' + (fx.crowd * 0.08).toFixed(3) + ')';
      ctx.fillRect(0, 0, this.W, this.H * 0.4);
    }
    if (fx.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, fx.flash).toFixed(2) + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }
}

export { text };
