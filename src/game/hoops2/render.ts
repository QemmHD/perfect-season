// Draws arcade basketball as fine pixel art from behind the shooter, facing the hoop, with
// perspective (the same either way up; sideways shows more of the floor across): the court drawn a
// row at a time, the arena's stands behind the basket, ten rigged players in their moves, the ball,
// the backboard, rim and net, the 2K-style shot meter arched over the shooter and the contest grade.
import { DEFAULT_HAIR, DEFAULT_SKIN, beardFor, drawBody, hairFor, type Look, type Sprite, SpriteCache, CanvasOut, freeCanvas } from '../pixel/body';
import { type CourtTheme, text } from '../pixel/court';
import { clipMeta, frameAt, getClip, type Ground, legScale, loadClips, mocapJoints, mocapKey, warp } from '../pixel/mocap';
import { courtTexture, drawFloor, type FieldTex, type PCam, pcam, pitchAt, project } from '../pixel/persp';
import * as P from '../pixel/poses';
import type { Joints, Pose } from '../pixel/rig';
import { ballPos, contestOf, JUMPER_TOP, RIM, RIM_H, shotChance } from './engine';
import type { Body, Contest, Possession } from './types';

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
}

const CONTEST_COLOR: Record<Contest, string> = { open: '#3ee08f', light: '#f4d03f', heavy: '#ff8c3a', smothered: '#ff4d5e' };
const CONTEST_TEXT: Record<Contest, string> = { open: 'OPEN', light: 'LIGHT', heavy: 'HEAVY', smothered: 'SMOTHERED' };

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
  const rate = Math.max(0.65, Math.min(1.5, speed / ft(clip)));
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
    if (tail.act === 'shoot' && ts < 1.0 && (ts < 0.8 || speed < 6)) return clip('jumpshot', JUMPER(ts), { step: 1, ground: 'clip' });
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
      return clip('jumpshot', JUMPER(since), { step: 1, ground: 'clip' });
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
      const ph = timed(0.62, 12);
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
      return { key: b.act + ph, pose: P.dunk(ph, b.act === 'contact' ? 'contact' : b.act === 'standdunk' ? 'two' : b.p.id.length % 2 ? 'one' : 'two') };
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

export class HoopsRenderer {
  /** the stick's mapping in Hoops2: the camera looks up the floor at the hoop, as the old upright one did */
  cam = { mode: 'end' as const };
  W = 0;
  H = 0;
  zoom = 1;
  private pc!: PCam;
  private tex: FieldTex | null = null;
  private floor: { canvas: HTMLCanvasElement; img: ImageData; px: Uint32Array } | null = null;
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
  private budget = 0;
  private looks = new Map<string, Look>();
  private memos = new Map<string, Memo>();
  private lastLift = new Map<string, boolean>();
  private focus = { x: 0, y: 14 };
  /** an instant replay: the spot to look at, and the camera pushed in a little */
  replay: { cx: number; cz: number } | null = null;
  /** the live shot % under the ball handler and over a pass target (off in replays and the autopilot) */
  showOdds = true;
  private zoomK = 1;
  /** the last shot meter, kept a moment after the release to show how it went */
  private meterShown: { idx: number; t0: number; top: number; green: number; until: number; frac: number; greened: boolean | null } | null = null;

  constructor(
    private theme: CourtTheme,
    private kits: [Kit, Kit]
  ) {
    loadClips(CLIPS).catch(() => {
      // the hand-keyed poses carry on
    });
  }

  /** Game pixels are screen pixels: fine pixel art, crisp on any phone. */
  resize(cssW: number, cssH: number) {
    const W = Math.max(1, Math.round(cssW));
    const H = Math.max(1, Math.round(cssH));
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    // only the floor is drawn for a size: the players' drawings are keyed by their size on screen,
    // so they stay and the old sizes age out. Nothing goes without its memory handed back: Safari
    // slides its toolbar in and out as you tap near the bottom, resizing the game each time, and
    // a page's canvases count against a cap (the game freezes past it) until they're freed
    freeCanvas(this.floor?.canvas);
    this.floor = null;
    this.pc = this.camAt(this.focus.x, this.focus.y);
  }

  /** The camera behind the shooter: the top of the key two thirds down, the rim up near the stands. */
  private camAt(fx: number, fy: number): PCam {
    // the man with the ball two thirds down, the rim around a third, the stands and the arena's dark
    // roof behind it
    return this.W > this.H
      ? pcam(this.W, this.H, fx, fy, { row: 0.74, s: (this.H / 38) * this.zoomK, horizon: -0.25, pitch: 0.5, fov: 0.55 })
      : pcam(this.W, this.H, fx, fy, { row: 0.68, s: (this.W / 30) * this.zoomK, horizon: 0.1, pitch: 0.45, fov: 0.6 });
  }

  /** A court point (along cx, across cz, height h, feet) on screen, and the pixels a foot there. */
  private at(cx: number, cz: number, h = 0) {
    return project(this.pc, cz, cx, h);
  }

  /** A body's drawing this frame and whether the jump is drawn into it (then he's placed on the floor). */
  private sprite(b: Body, t: number, carrying: boolean, kit: Kit, s: number, ball: Possession['ball']): { spr: Sprite; ownLift: boolean } {
    // facing on screen: the camera looks up the floor (+cx), across is +cz to the right
    const dcx = Math.cos(b.face);
    const dcz = Math.sin(b.face);
    const raw = Math.max(10, Math.round((b.p.ht / 12) * s));
    const px = raw > 14 ? raw - (raw % 2) : raw;
    const dirs = px < 26 ? 8 : 16;
    const fb = (Math.round((Math.atan2(-dcx, dcz) / (Math.PI * 2)) * dirs) + dirs) % dirs;
    const pitch = Math.round(Math.min(0.9, pitchAt(this.pc, b.cx)) / 0.15) * 0.15;
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
    const an = animOf(b, t, carrying, look, memo, shotAt);
    const frame = an.clip ? frameAt(an.clip, an.ct ?? 0, an.step ?? 2) : 0;
    const key = an.clip ? mocapKey(an.clip, frame, an.ground) + (an.dribble !== undefined ? 'd' + an.dribble : '') : an.key;
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
      this.floor = { canvas, img, px: new Uint32Array(img.data.buffer) };
    }
    const fl = this.floor;
    drawFloor(this.pc, this.tex, fl.px, q);
    fl.canvas.getContext('2d')!.putImageData(fl.img, 0, 0);
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
  private drawRim(ctx: CanvasRenderingContext2D, half: 'back' | 'front', swish: number) {
    const r = 0.75;
    const ring = (a: number, h = RIM_H) => this.at(RIM.cx + Math.cos(a) * r, RIM.cz + Math.sin(a) * r, h);
    const c = this.at(RIM.cx, RIM.cz, RIM_H);
    const lw = Math.max(1, Math.round(c.s * 0.14));
    // back half: away from the camera (cos > 0); front: toward it
    const a0 = half === 'back' ? -Math.PI / 2 : Math.PI / 2;
    if (half === 'front') {
      // the net: strands from the rim down to a narrower ring, swaying after a swish
      const len = 1.5 * (1 - swish * 0.25);
      ctx.lineWidth = Math.max(1, Math.round(c.s * 0.07));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const top = ring(a);
        const sway = Math.sin(swish * 22 + i * 1.3) * swish * 0.3;
        const bot = this.at(RIM.cx + Math.cos(a) * r * 0.5 + sway, RIM.cz + Math.sin(a) * r * 0.5, RIM_H - len);
        ctx.strokeStyle = Math.cos(a) > 0 ? 'rgba(200,204,214,0.85)' : 'rgba(246,246,246,0.95)';
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
  private drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, real: number, fire: boolean) {
    const r = Math.max(2.5, s * 0.4);
    const X = Math.round(x);
    const Y = Math.round(y);
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
  }

  /** One frame. `real` keeps the crowd and the ball's spin moving between plays. */
  draw(ctx: CanvasRenderingContext2D, p: Possession, real: number, fx: Fx) {
    this.budget = 4;
    ctx.imageSmoothingEnabled = false;
    // the camera drifts across with the ball and a little up and down the floor with it
    const bp = ballPos(p);
    const rp = this.replay;
    const wantX = rp ? Math.max(-12, Math.min(12, rp.cz * 0.9)) : Math.max(-10, Math.min(10, bp.cz * 0.6));
    const wantY = rp ? Math.max(14, Math.min(34, rp.cx - 4)) : Math.max(13, Math.min(30, bp.cx));
    this.focus.x += (wantX - this.focus.x) * (rp ? 0.12 : 0.07);
    this.focus.y += (wantY - this.focus.y) * (rp ? 0.1 : 0.05);
    this.zoomK += ((rp ? 1.35 : 1) - this.zoomK) * 0.08;
    this.pc = this.camAt(this.focus.x, this.focus.y);
    const sx = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake * 2) : 0;
    const sy = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake * 2) : 0;
    ctx.save();
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
        label(ctx,call.kind === 'cut' || call.rolling ? 'CUT' : 'SCREEN',to.x,to.y-9,'#b4ffe6');ctx.restore();
      }
    }
    // shadows on the floor
    const t = p.t;
    for (const b of p.bodies) {
      const f = this.at(b.cx, b.cz);
      const shrink = 1 / (1 + b.h * 0.12);
      const rx = Math.max(3, Math.round(f.s * 1.05 * shrink));
      const ry = Math.max(1, Math.round(rx * Math.sin(pitchAt(this.pc, b.cx)) * 0.9));
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
        depth: b.cx,
        draw: () => {
          const carrying = p.handler === b.idx;
          const f0 = this.at(b.cx, b.cz, b.h);
          const { spr: s, ownLift } = this.sprite(b, t, carrying, this.kits[b.side === 'O' ? 0 : 1], f0.s, p.ball);
          // a recorded jump is in the drawing itself: then he stands on the floor spot
          const f = ownLift ? this.at(b.cx, b.cz) : f0;
          const x = Math.round(f.x - s.ax);
          const y = Math.round(f.y - s.ay);
          ctx.drawImage(s.canvas, x, y);
          headOf[b.idx] = { x: Math.round(f.x), y: y + s.top, right: x + s.canvas.width };
          if (carrying) handSpot = { x: x + s.handR.x, y: y + s.handR.y, s: f.s };
        },
      });
    }
    items.push({ depth: RIM.cx + 0.4, draw: () => this.drawRim(ctx, 'back', fx.swish) });
    items.sort((a, b) => b.depth - a.depth);
    for (const it of items) it.draw();
    // the ball: in a flight, on the dribble, or in his hands
    const fire = p.fire >= 0 && (p.handler === p.fire || p.ball?.who === p.fire);
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
    this.drawBall(ctx, ball.x, ball.y, ball.s, real, fire);
    if (fire) {
      // flames trailing the ball
      for (let i = 0; i < 8; i++) {
        const a = real * 9 + i * 1.7;
        ctx.fillStyle = i % 2 ? '#ffd23a' : '#ff6a1a';
        const d = Math.max(1, Math.round(ball.s * 0.18));
        ctx.fillRect(Math.round(ball.x + Math.sin(a) * ball.s * 0.4), Math.round(ball.y - ball.s * 0.4 - ((real * 30 + i * 3) % (ball.s * 1.2))), d, d * 2);
      }
    }
    // the front of the rim and the net, over the ball
    this.drawRim(ctx, 'front', fx.swish);
    // the shot meter and the contest on the shooter
    this.drawMeter(ctx, p, real, headOf);
    // the pass target: a marker over the man the stick points at
    if (p.target !== null && p.handler !== null && !p.meter && !p.finish) {
      const h = headOf[p.target];
      if (h) {
        ctx.fillStyle = '#19e3c9';
        const ty = h.y - 12;
        ctx.beginPath();
        ctx.moveTo(h.x - 6, ty);
        ctx.lineTo(h.x + 6, ty);
        ctx.lineTo(h.x, ty + 7);
        ctx.closePath();
        ctx.fill();
        // his shot if he catches it and lets it fly
        if (this.showOdds) {
          const c = shotChance(p, p.bodies[p.target]);
          label(ctx, Math.round(c * 100) + '%', h.x, ty - 15, oddsColor(c));
        }
      }
    }
    // the handler's name over his head (the contest grade takes its place while he shoots); at his
    // feet his sprint's stamina while it isn't full, and his shot % from here
    if (p.handler !== null && !p.ball && !p.meter) {
      const b = p.bodies[p.handler];
      const h = headOf[b.idx];
      if (h) label(ctx, b.p.tag, h.x, h.y - 16, p.fire === b.idx ? '#ffb02e' : '#ffffff');
      if (!p.finish) {
        const f = this.at(b.cx, b.cz);
        let y = Math.round(f.y + Math.max(4, f.s * 0.5));
        if (b.burst < 0.99 || p.sprinting) {
          const w = Math.max(22, Math.round(f.s * 2.6));
          const x0 = Math.round(f.x - w / 2);
          ctx.fillStyle = 'rgba(8,10,18,0.8)';
          ctx.fillRect(x0 - 1, y - 1, w + 2, 5);
          ctx.fillStyle = b.burst < 0.25 ? '#ff6a4a' : p.sprinting ? '#ffd35a' : '#19e3c9';
          ctx.fillRect(x0, y, Math.round(w * b.burst), 3);
          y += 7;
        }
        if (this.showOdds) {
          const c = shotChance(p, b);
          label(ctx, Math.round(c * 100) + '%', f.x, y, oddsColor(c));
        }
      }
    }
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

  private drawMeter(ctx: CanvasRenderingContext2D, p: Possession, real: number, heads: Record<number, { x: number; y: number; right: number }>) {
    const m = p.meter;
    if (m && p.handler !== null) {
      const span = m.top * 1.3;
      const frac = Math.min(1, (p.t - m.t0) / span);
      this.meterShown = { idx: p.handler, t0: m.t0, top: m.top, green: m.green, until: Infinity, frac, greened: m.off !== undefined ? !!m.greened : null };
    } else if (this.meterShown && this.meterShown.until === Infinity) {
      // A canceled hold has no release result to display.
      if (!p.lastShot && !p.ball && !p.finish) { this.meterShown = null; return; }
      // just released (the engine let go of the meter): hold the result a moment
      const ls = p.lastShot;
      this.meterShown.greened = ls ? ls.greened : false;
      this.meterShown.until = real + 0.7;
    }
    const ms = this.meterShown;
    if (!ms) return;
    if (ms.until !== Infinity && real > ms.until) {
      this.meterShown = null;
      return;
    }
    const head = heads[ms.idx];
    if (!head) return;
    // a 2K-style arch over his head: it fills from the left end as he rises, the green slice sits
    // where the top of his jump lands, near the right end
    const R = Math.max(26, Math.round(Math.min(this.W, this.H) * 0.09));
    const th = Math.max(7, Math.round(R * 0.27));
    const cx = head.x;
    // centered low enough that the arch frames his head and arms (it reads as his, not the
    // defender's in front of him), high enough that his hands and the ball stay inside it
    const cy = Math.max(R + th + 24, head.y + Math.round(R * 0.3));
    const A0 = Math.PI + 0.36;
    const SW = Math.PI - 0.72;
    const span = ms.top * 1.3;
    const band = (a0: number, a1: number, r: number, w: number, color: string) => {
      if (a1 <= a0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'butt';
    // the case: a dark edge, a light rim, a deep track
    band(A0 - 0.05, A0 + SW + 0.05, R, th + 5, '#05070d');
    band(A0 - 0.03, A0 + SW + 0.03, R, th + 2, '#e8ecf5');
    band(A0, A0 + SW, R, th, '#1a2235');
    // the green slice at its true size (a let-go inside it is a green), with bright marks just
    // outside the track; a sliver under a heavy contest is drawn as the sliver it is
    const gc = A0 + (ms.top / span) * SW;
    const gw = Math.max(0.006, (ms.green / span) * SW);
    const g0 = Math.max(A0, gc - gw);
    const g1 = Math.min(A0 + SW, gc + gw);
    const result = ms.greened !== null;
    const glow = result ? 0 : Math.max(0, 1 - Math.abs(ms.frac * span - ms.top) / 0.12);
    band(g0, g1, R, th, glow > 0 ? mixHex('#1f9e4c', '#7dffab', glow) : '#1f9e4c');
    band(g0, g1, R + th / 2 + 2, 2, '#3ef07a');
    band(g0, g1, R - th / 2 - 2, 2, '#3ef07a');
    // the fill: warm while he rises, then green, white (close) or red (off)
    const off = p.lastShot && result ? Math.abs(p.lastShot.off) : 1;
    const fillTo = A0 + ms.frac * SW;
    const color = !result ? '#ffd35a' : ms.greened ? '#3ef07a' : off < 0.32 ? '#f4f4f4' : '#ff5a5a';
    band(A0, fillTo, R, th - 2, color);
    band(A0, fillTo, R - th / 2 + 2, 1, 'rgba(255,255,255,0.55)');
    // the leading edge: a bright notch that runs ahead of the fill
    if (ms.frac > 0.01) band(fillTo - 0.035, fillTo, R, th + 4, '#ffffff');
    // a green release: the whole arch lights up and a ring bursts off it
    if (ms.greened && ms.until !== Infinity) {
      const k = Math.min(1, (real - (ms.until - 0.7)) / 0.35);
      band(A0, A0 + SW, R, th, 'rgba(62,240,122,' + (0.9 * (1 - k * 0.5)).toFixed(2) + ')');
      if (k < 1) band(A0 - 0.1, A0 + SW + 0.1, R + 4 + k * R * 0.6, 3 * (1 - k) + 1, 'rgba(160,255,190,' + (1 - k).toFixed(2) + ')');
    }
    ctx.restore();
    // the contest grade over his head while he rises
    if (p.meter && p.handler === ms.idx) {
      const grade = contestOf(p, p.bodies[ms.idx]);
      label(ctx, CONTEST_TEXT[grade], head.x, cy - R - th - 16, CONTEST_COLOR[grade]);
    } else if (result && p.lastShot) {
      const shot = p.lastShot;
      const text = shot.greened ? (shot.contest === 'heavy' || shot.contest === 'smothered' ? 'PERFECT / ' + CONTEST_TEXT[shot.contest] : 'PERFECT') : Math.abs(shot.off) < 0.22 ? 'GOOD RELEASE' : shot.off < 0 ? 'EARLY' : 'LATE';
      label(ctx, text, head.x, cy - R - th - 16, shot.greened ? '#3ef07a' : '#ffd35a');
    }
  }
}

/** The live shot %'s color: green a good look, yellow a fair one, orange a poor one. */
function oddsColor(c: number): string {
  return c >= 0.5 ? '#3ef07a' : c >= 0.35 ? '#ffd35a' : '#ff8c5a';
}

/** a blend of two #rrggbb colors */
function mixHex(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  let out = '#';
  for (let i = 0; i < 3; i++) out += Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, '0');
  return out;
}

/** A pixel label (the 3x5 letters doubled) with a dark backing, centered at x. */
function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string) {
  const z = 2;
  const up = s.toUpperCase();
  const w = (up.length * 4 - 1) * z;
  const x0 = Math.round(x - w / 2);
  ctx.fillStyle = 'rgba(8,10,18,0.78)';
  ctx.fillRect(x0 - 3, y - 3, w + 6, 5 * z + 6);
  ctx.fillStyle = color;
  for (let i = 0; i < up.length; i++) {
    const g = F35[up[i]] ?? F35[' '];
    for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) if (g[r * 3 + col] === '1') ctx.fillRect(x0 + (i * 4 + col) * z, y + r * z, z, z);
  }
}

// a 3x5 font for labels
const F35: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', "'": '010010000000000', '!': '010010010000010', '%': '101001010100101',
};

export function tiny(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const g = F35[up[i]] ?? F35[' '];
    for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) if (g[r * 3 + col] === '1') ctx.fillRect(x + i * 4 + col, y + r, 1, 1);
  }
}

export { text };
