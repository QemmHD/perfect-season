// Draws arcade football as pixel art. Sideways it's the classic side-on look (the whole field drawn
// once, blitted under a camera that follows the ball); upright it's a broadcast camera from behind
// the offense with perspective, the grass drawn a row at a time. On top: twenty-two rigged players
// in their kits, the ball, the posts, the lines, the routes before the snap and the slingshot's arc.
import { DEFAULT_HAIR, DEFAULT_SKIN, drawBody, type Look, type Sprite, SpriteCache, CanvasOut, freeCanvas } from '../pixel/body';
import { drawField, type FieldCam, fieldAt, fieldCam, fieldFacing, type FieldTheme } from '../pixel/field';
import { clipMeta, frameAt, getClip, type Ground, legScale, loadClips, mocapJoints, mocapKey, warp } from '../pixel/mocap';
import { drawFloor, type FieldTex, fieldTexture, type PCam, pcam, pitchAt, project } from '../pixel/persp';
import * as P from '../pixel/poses';
import type { Joints, Pose } from '../pixel/rig';
import { ballNow, dist, FIELD_W, flightTime, isLine, maxThrow, peakOf, projectRoute, sight, speedOf, throwErrorRadius, windupOf } from './engine';
import type { Body, Play, Pt } from './types';

export interface FbKit {
  jersey: string;
  trim: string;
  pants: string;
  helmet: string;
  stripe: string;
  socks: string;
  shoes: string;
  mask: string;
}

export interface FbOverlay {
  /** the slingshot's landing spot, while dragging */
  aim: Pt | null;
  /** first-down line */
  toGain: number | null;
  /** pre-snap: show the routes */
  routes: boolean;
  /** a new player's help: rings on the receivers while he's back to pass, by how open each is */
  open: boolean;
  shake: number;
  flash: number;
}

/** What the drawing needs from a camera, either kind. */
interface Lens {
  mode: 'side' | 'end';
  /** a field point on screen, and the pixels to a yard there */
  at(x: number, y: number, h?: number): { x: number; y: number; s: number };
  facing(dx: number, dy: number): number;
  /** bigger is nearer the viewer */
  near(x: number, y: number): number;
  pitch(y: number): number;
}

function lookFor(b: Body, kit: FbKit): Look {
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

function poseOf(b: Body, t: number, p: Play): { key: string; pose: Pose } {
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
const CLIPS = ['ready', 'jog', 'run', 'sprint', 'backpedal', 'shuffle', 'shuffle_l', 'block', 'throw', 'catch', 'catch_run', 'dive', 'fall_back', 'fall_back_m', 'fall_forward', 'fall_forward_m', 'kick', 'celebrate'];

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

interface Anim {
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
interface Memo {
  gait: { t: number; frac: number };
  face: { x: number; y: number };
  faceAt: number;
}

const has = (name: string) => !!getClip(name);
const mirrorOf = (b: Body, name: string) => (b.id % 2 ? name + '_m' : name);

/** A stride: jog, run or sprint by his speed, at the rate his feet keep up with the turf. */
function gait(b: Body, t: number, look: Look, m: Memo, speed: number): { clip: string; ct: number } | null {
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
  const rate = Math.max(0.65, Math.min(1.7, speed / yd(clip)));
  const dt = t - m.gait.t;
  if (dt > 0 && dt < 0.3) m.gait.frac = (m.gait.frac + (dt * rate) / clipMeta(clip).duration) % 1;
  m.gait.t = t;
  return { clip, ct: m.gait.frac * clipMeta(clip).duration };
}

function animOf(b: Body, t: number, p: Play, look: Look, m: Memo, aiming: boolean): Anim {
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
function ballArm(j: Joints, how: 'tuck' | 'hold'): Joints {
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

export class FootballRenderer {
  W = 0;
  H = 0;
  zoom = 1;
  mode: 'side' | 'end' = 'end';
  private side: FieldCam | null = null;
  private persp: PCam | null = null;
  private field: { canvas: HTMLCanvasElement; cam: FieldCam } | null = null;
  private tex: FieldTex | null = null;
  private floor: { canvas: HTMLCanvasElement; img: ImageData; px: Uint32Array } | null = null;
  private sprites = new SpriteCache(600);

  /** The game's over: hand back every canvas this drew with, now (iOS caps a page's canvas memory). */
  dispose() {
    this.sprites.dispose();
    for (const s of this.last.values()) freeCanvas(s.canvas);
    this.last.clear();
    freeCanvas(this.floor?.canvas);
    this.floor = null;
    freeCanvas(this.field?.canvas);
    this.field = null;
  }
  private looks = new Map<string, Look>();
  private memos = new Map<string, Memo>();
  /** the slingshot's drawn back this frame: the quarterback cocks his arm */
  private aiming = false;
  private follow: Pt | null = null;
  /** each player's drawing last frame, and how many new drawings this frame may still make */
  private last = new Map<string, Sprite>();
  private budget = 0;
  /** turf kicked up, confetti and the On Fire flames: field position and height, speed, life left, color, size */
  private bits: { x: number; y: number; h: number; vx: number; vy: number; vh: number; life: number; color: string; size: number; rise?: boolean }[] = [];
  /** what each player was doing last frame, to see a tackle or a move start */
  private acts = new Map<number, string>();
  private playSeen: Play | null = null;
  private lastNow = 0;
  /** an instant replay: the spot to look at, the camera pushed in a little */
  replay: Pt | null = null;
  private zoomK = 1;
  private lens!: Lens;

  constructor(
    private theme: FieldTheme,
    private kits: [FbKit, FbKit]
  ) {
    loadClips(CLIPS).catch(() => {
      // the hand-keyed poses carry on
    });
  }

  /** Game pixels are screen pixels (crisp on any phone); upright gets the perspective camera. */
  resize(cssW: number, cssH: number) {
    const W = Math.max(1, Math.round(cssW));
    const H = Math.max(1, Math.round(cssH));
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.mode = W > H ? 'side' : 'end';
    // the field and the floor are drawn for a size; the players' drawings are keyed by their size,
    // so they stay. What goes is freed (Safari's toolbar resizes the game as you tap near the
    // bottom, and a page's canvases count against a cap until they're freed)
    freeCanvas(this.field?.canvas);
    this.field = null;
    freeCanvas(this.floor?.canvas);
    this.floor = null;
    this.follow = null;
    if (this.mode === 'side') {
      this.side = fieldCam(W, H, FIELD_W / 2, 25);
      this.persp = null;
    } else {
      this.side = null;
      this.persp = this.perspAt(FIELD_W / 2, 25);
    }
    this.lens = this.makeLens();
  }

  private perspAt(fx: number, fy: number): PCam {
    // the play's spot two thirds down the screen, the far stands under the scoreboard
    return pcam(this.W, this.H, fx, fy, { row: 0.68, s: Math.max(11, this.W / 26) * this.zoomK, horizon: 0.13, pitch: 0.5, fov: 0.42 });
  }

  private makeLens(): Lens {
    const sc = this.side;
    if (sc) {
      return {
        mode: 'side',
        at: (x, y, h = 0) => ({ ...fieldAt(sc, x, y, h), s: sc.k }),
        facing: (dx, dy) => fieldFacing(sc, dx, dy),
        near: (x) => -x,
        pitch: () => sc.pitch,
      };
    }
    const pc = this.persp!;
    return {
      mode: 'end',
      at: (x, y, h = 0) => project(pc, x, y, h),
      facing: (dx, dy) => Math.atan2(-dy, dx),
      near: (_x, y) => -y,
      pitch: (y) => pitchAt(pc, y),
    };
  }

  /** where the camera wants to be: the ball (in the air, the man with it) and a bit downfield */
  private target(p: Play, aim: Pt | null): Pt {
    if (this.replay) return { x: Math.max(12, Math.min(FIELD_W - 12, this.replay.x)), y: Math.min(this.replay.y + 2, 104) };
    const b = ballNow(p);
    const c = p.carrier ?? p.qb;
    const at = b ?? c;
    const pre = p.phase === 'pre' || p.phase === 'drop';
    let y = at.y + (pre ? (this.mode === 'side' ? 9 : 1) : this.mode === 'side' ? 3 : -1);
    if (aim && p.phase === 'drop') y = Math.max(y, (p.qb.y + aim.y) / 2 + (this.mode === 'side' ? 2 : -6));
    // an overthrow out the back: the camera stops at the end zone
    y = Math.min(y, this.mode === 'side' ? 100 : 104);
    // sideways the camera follows across too; upright it stays near the middle before the throw so
    // both sides show, then rides with the ball
    const x =
      this.mode === 'side'
        ? Math.max(20, Math.min(FIELD_W - 20, at.x))
        : pre
          ? FIELD_W / 2 + (Math.max(8, Math.min(FIELD_W - 8, at.x)) - FIELD_W / 2) * 0.55
          : Math.max(12, Math.min(FIELD_W - 12, at.x));
    return { x, y };
  }

  /** Who a throw to `aim` is going to: the receiver whose route takes him closest, and where. */
  receiverFor(p: Play, aim: Pt): { b: Body; at: Pt } | null {
    const len = Math.min(maxThrow(p), dist(p.qb, aim));
    const flight = flightTime(p, len);
    let best: { b: Body; at: Pt } | null = null;
    let bestD = 99;
    for (const b of p.bodies) {
      if (b.side !== 'O' || b === p.qb || isLine(b)) continue;
      const at = projectRoute(b, flight);
      const d = dist(at, aim);
      if (d < bestD && dist(b, aim) / speedOf(b.p) <= flight + 0.45) {
        bestD = d;
        best = { b, at };
      }
    }
    return best && bestD < 6 ? best : null;
  }

  private sprite(b: Body, t: number, p: Play, s: number): Sprite {
    const L = this.lens;
    const who = b.p.id + '|' + b.side;
    let memo = this.memos.get(who);
    if (!memo) {
      memo = { gait: { t, frac: (b.id * 0.29) % 1 }, face: { x: 0, y: b.side === 'O' ? 1 : -1 }, faceAt: t };
      this.memos.set(who, memo);
    }
    const moving = Math.hypot(b.vx, b.vy) > 0.6;
    const grounded = b.act === 'tackle' || b.act === 'down';
    // facing: where he's going, or (set) up the field for the offense, down it for the defense; a
    // man diving or going down keeps the way he faced as it started
    const assignment = p.bodies.find((o) => o.id === b.mark);
    const openHips = b.act === 'backpedal' && Math.hypot(b.vx, b.vy) > 4.8 && assignment && assignment.y > b.y - 1;
    const watch = b.act === 'backpedal' && !openHips ? p.qb : null;
    let dir = grounded ? memo.face : watch ? { x: watch.x - b.x, y: watch.y - b.y } : moving ? { x: b.vx, y: b.vy } : b.side === 'O' ? { x: 0, y: 1 } : { x: 0, y: -1 };
    if (!grounded) {
      const target = Math.atan2(dir.y, dir.x), old = Math.atan2(memo.face.y, memo.face.x);
      const delta = Math.atan2(Math.sin(target - old), Math.cos(target - old));
      const facing = old + delta * Math.min(1, Math.max(0, t - memo.faceAt) * 14);
      memo.face = { x: Math.cos(facing), y: Math.sin(facing) };
      dir = memo.face;
    }
    memo.faceAt = t;
    // sizes, angles and (for small, far players) facings in steps, so a player moving up the field
    // reuses his drawings
    const raw = Math.max(8, Math.round((b.p.ht / 36) * s));
    const px = raw > 14 ? raw - (raw % 2) : raw;
    const dirs = px < 22 ? 8 : 16;
    const fb = (Math.round((L.facing(dir.x, dir.y) / (Math.PI * 2)) * dirs) + dirs) % dirs;
    // seen from high up close: the rig reads best no steeper than this
    const pitch = Math.round(Math.min(0.9, L.pitch(b.y)) / 0.15) * 0.15;
    let look = this.looks.get(who);
    if (!look) {
      look = lookFor(b, this.kits[b.side === 'O' ? 0 : 1]);
      this.looks.set(who, look);
    }
    const an = animOf(b, t, p, look, memo, this.aiming);
    // far, small players step their clips more coarsely (fewer new drawings as the camera moves)
    const step = an.clip ? (px < 22 ? Math.max(3, an.step ?? 2) : (an.step ?? 2)) : 1;
    const frame = an.clip ? frameAt(an.clip, an.ct ?? 0, step) : 0;
    const key = an.clip ? mocapKey(an.clip, frame, an.ground) + (an.ball ?? '') : an.key;
    const k = who + '|' + key + '|' + fb + '/' + dirs + '|' + px + '|' + pitch;
    let spr = this.sprites.get(k);
    if (!spr) {
      // a few new drawings a frame at most (the man with the ball always gets his): past that, he
      // keeps his last one a frame longer
      const last = this.last.get(who);
      if (this.budget <= 0 && last && b !== p.carrier) return last;
      this.budget--;
      const view = { facing: (fb / dirs) * Math.PI * 2, pitch };
      const make = () => {
        if (!an.clip) return drawBody(look, { ...an.pose, lift: 0 }, view, px);
        let j = mocapJoints(an.clip, frame, look, { ground: an.ground });
        if (an.ball) j = ballArm(j, an.ball);
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
          if (last) return last;
          throw e;
        }
      }
      this.sprites.set(k, spr, this.last.values());
    }
    this.last.set(who, spr);
    return spr;
  }

  private drawGround(ctx: CanvasRenderingContext2D) {
    if (this.side) {
      const c = this.side;
      if (!this.field) this.field = drawField(c, this.theme);
      const fld = this.field;
      const origin = fieldAt(fld.cam, c.fx, c.fy);
      ctx.fillStyle = '#10160f';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.drawImage(fld.canvas, Math.round(c.ax - origin.x), Math.round(c.ay - origin.y));
      return;
    }
    if (!this.tex) this.tex = fieldTexture(this.theme);
    // the grass at half resolution, doubled: a quarter of the work, and the pixels still square
    const q = 2;
    if (!this.floor) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(this.W / q);
      canvas.height = Math.ceil(this.H / q);
      const img = canvas.getContext('2d')!.createImageData(canvas.width, canvas.height);
      this.floor = { canvas, img, px: new Uint32Array(img.data.buffer) };
    }
    const fl = this.floor;
    drawFloor(this.persp!, this.tex, fl.px, q);
    fl.canvas.getContext('2d')!.putImageData(fl.img, 0, 0);
    ctx.drawImage(fl.canvas, 0, 0, fl.canvas.width * q, fl.canvas.height * q);
  }

  /** Goal posts at the back of an end zone: yellow, a crossbar at 10 ft, uprights to 35 ft. */
  private posts(ctx: CanvasRenderingContext2D, y: number) {
    const L = this.lens;
    const base = L.at(FIELD_W / 2, y);
    const bar = L.at(FIELD_W / 2, y, 3.33);
    const w = Math.max(1, Math.round(base.s * 0.18));
    ctx.fillStyle = '#b8960e';
    ctx.fillRect(Math.round(base.x - w / 2), Math.round(bar.y), w, Math.max(1, Math.round(base.y - bar.y)));
    ctx.strokeStyle = '#f7d21d';
    ctx.lineWidth = w;
    ctx.beginPath();
    const l = L.at(FIELD_W / 2 - 3.08, y, 3.33);
    const r = L.at(FIELD_W / 2 + 3.08, y, 3.33);
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(r.x, r.y);
    for (const sx of [-3.08, 3.08]) {
      const a = L.at(FIELD_W / 2 + sx, y, 3.33);
      const b = L.at(FIELD_W / 2 + sx, y, 11.7);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  /** A burst at a field spot: turf off a cut or a tackle, confetti for a touchdown. */
  private burst(x: number, y: number, n: number, kind: 'turf' | 'confetti') {
    const turf = ['#3c7a2c', '#58993c', '#6b4a2a', '#8a6a3c'];
    const conf = [this.kits[0].jersey, this.kits[0].trim, '#ffffff', '#ffd23a'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'turf' ? 1.5 + Math.random() * 2.5 : 2 + Math.random() * 5;
      this.bits.push({
        x: x + (kind === 'confetti' ? (Math.random() - 0.5) * 3 : 0),
        y: y + (kind === 'confetti' ? (Math.random() - 0.5) * 3 : 0),
        h: kind === 'turf' ? 0.1 : 2.5 + Math.random() * 1.5,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        vh: kind === 'turf' ? 2 + Math.random() * 3 : 4 + Math.random() * 6,
        life: kind === 'turf' ? 0.45 + Math.random() * 0.25 : 1.4 + Math.random() * 0.8,
        color: (kind === 'turf' ? turf : conf)[Math.floor(Math.random() * 4)],
        size: kind === 'turf' ? 0.16 : 0.22,
      });
    }
    if (this.bits.length > 400) this.bits.splice(0, this.bits.length - 400);
  }

  /** Watch the players for the moments worth a burst, move the bits along and draw them. */
  private particles(ctx: CanvasRenderingContext2D, p: Play) {
    const now = performance.now() / 1000;
    const dt = this.lastNow ? Math.min(0.05, now - this.lastNow) : 0;
    this.lastNow = now;
    if (this.playSeen !== p) {
      this.playSeen = p;
      this.acts.clear();
      for (const b of p.bodies) this.acts.set(b.id, b.act);
    }
    for (const b of p.bodies) {
      const was = this.acts.get(b.id);
      if (was !== b.act) {
        if (b.act === 'down') this.burst(b.x, b.y, 12, 'turf');
        else if (b.act === 'juke' || b.act === 'spin' || b.act === 'truck' || b.act === 'tackle') this.burst(b.x, b.y, 7, 'turf');
        else if (b.act === 'celebrate') this.burst(b.x, b.y, 70, 'confetti');
        this.acts.set(b.id, b.act);
      }
    }
    // On Fire: flames lick up off the quarterback while he has it
    if (p.fire && p.carrier === p.qb && (p.phase === 'pre' || p.phase === 'drop') && dt > 0) {
      const fire = ['#fff1a0', '#ffd23a', '#ff9a2a', '#ff5a1f'];
      for (let i = 0; i < 2; i++)
        this.bits.push({ x: p.qb.x + (Math.random() - 0.5) * 1.1, y: p.qb.y + (Math.random() - 0.5) * 0.6, h: Math.random() * 1.2, vx: 0, vy: 0, vh: 2.2 + Math.random() * 1.8, life: 0.3 + Math.random() * 0.25, color: fire[Math.floor(Math.random() * 4)], size: 0.15, rise: true });
    }
    const L = this.lens;
    this.bits = this.bits.filter((q) => (q.life -= dt) > 0);
    for (const q of this.bits) {
      const conf = q.size > 0.2;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.h = Math.max(0, q.h + q.vh * dt);
      // confetti flutters down; turf drops; flames rise
      if (!q.rise) q.vh -= (conf ? 3.2 : 14) * dt;
      if (conf) {
        q.vh = Math.max(q.vh, -1.6);
        q.vx *= 0.98;
        q.vy *= 0.98;
      }
      const a = L.at(q.x, q.y, q.h);
      const d = Math.max(1, Math.round(a.s * q.size));
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(a.x - d / 2), Math.round(a.y - d / 2), d, conf && Math.floor(now * 10 + q.x) % 2 ? Math.max(1, d - 1) : d);
    }
  }

  draw(ctx: CanvasRenderingContext2D, p: Play, ballOn: number, o: FbOverlay) {
    ctx.imageSmoothingEnabled = false;
    this.aiming = !!o.aim;
    // follow the play
    this.zoomK += ((this.replay ? 1.3 : 1) - this.zoomK) * 0.08;
    const want = this.target(p, o.aim);
    if (!this.follow) this.follow = want;
    this.follow = { x: this.follow.x + (want.x - this.follow.x) * 0.08, y: this.follow.y + (want.y - this.follow.y) * 0.1 };
    if (this.side) {
      this.side.fx = this.follow.x;
      this.side.fy = this.follow.y;
    } else this.persp = this.perspAt(this.follow.x, this.follow.y);
    this.lens = this.makeLens();
    const L = this.lens;
    this.budget = 4;
    const shx = o.shake ? Math.round((Math.random() - 0.5) * o.shake * 2) : 0;
    const shy = o.shake ? Math.round((Math.random() - 0.5) * o.shake * 2) : 0;
    ctx.save();
    ctx.translate(shx, shy);
    this.drawGround(ctx);
    // the line of scrimmage and the line to gain
    const across = (y: number, color: string) => {
      const a = L.at(0, y);
      const b = L.at(FIELD_W, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.round(a.s * 0.14));
      ctx.beginPath();
      ctx.moveTo(Math.round(a.x), Math.round(a.y) + 0.5);
      ctx.lineTo(Math.round(b.x), Math.round(b.y) + 0.5);
      ctx.stroke();
    };
    across(ballOn, '#4aa8ff');
    if (o.toGain !== null && o.toGain < 100) across(o.toGain, '#ffd23a');
    this.posts(ctx, 110);
    // the routes before the snap, a color for each man, an arrowhead at the end
    if (o.routes) {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const b of p.bodies) {
        if (b.side !== 'O' || !b.route.length || isLine(b) || b === p.qb) continue;
        const pts = [L.at(b.x, b.y), ...b.route.map((w) => L.at(w.x, w.y))];
        const wdt = Math.max(2, Math.round(pts[0].s * 0.16));
        for (const [color, wd, dy] of [
          ['rgba(0,0,0,0.35)', wdt + 2, 1],
          [ROUTE_COLOR[b.slot] ?? '#ffffff', wdt, 0],
        ] as const) {
          ctx.strokeStyle = color;
          ctx.lineWidth = wd;
          ctx.beginPath();
          pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y + dy) : ctx.moveTo(q.x, q.y + dy)));
          ctx.stroke();
        }
        // the arrowhead
        const a = pts[pts.length - 2];
        const e = pts[pts.length - 1];
        const ang = Math.atan2(e.y - a.y, e.x - a.x);
        const hl = Math.max(6, Math.round(e.s * 0.6));
        ctx.fillStyle = ROUTE_COLOR[b.slot] ?? '#ffffff';
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(ang) * hl * 0.6, e.y + Math.sin(ang) * hl * 0.6);
        ctx.lineTo(e.x + Math.cos(ang + 2.5) * hl * 0.6, e.y + Math.sin(ang + 2.5) * hl * 0.6);
        ctx.lineTo(e.x + Math.cos(ang - 2.5) * hl * 0.6, e.y + Math.sin(ang - 2.5) * hl * 0.6);
        ctx.fill();
      }
    }
    // shadows
    for (const b of p.bodies) {
      const f = L.at(b.x, b.y);
      const rx = Math.max(2, Math.round(f.s * 0.42));
      const ry = Math.max(1, Math.round(rx * Math.sin(L.pitch(b.y)) * 0.8));
      ctx.fillStyle = 'rgba(8,26,8,0.42)';
      ctx.beginPath();
      ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // who's open: green, tight (yellow) or covered (red), live while the quarterback has it
    if (o.open && p.phase === 'drop' && p.call === 'pass' && p.carrier === p.qb) {
      for (const b of p.bodies) {
        if (b.side !== 'O' || b === p.qb || isLine(b) || b.job === 'block') continue;
        let near = 99;
        for (const d of p.bodies) if (d.side === 'D' && d.job !== 'rush') near = Math.min(near, dist(d, b));
        const f = L.at(b.x, b.y);
        const rx = Math.max(5, Math.round(f.s * 0.7));
        ctx.strokeStyle = near >= 3.2 ? 'rgba(62,240,122,0.95)' : near >= 1.8 ? 'rgba(255,210,58,0.95)' : 'rgba(255,90,90,0.9)';
        ctx.lineWidth = Math.max(2, Math.round(f.s * 0.12));
        ctx.beginPath();
        ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, Math.max(2, Math.round(rx * Math.sin(L.pitch(b.y)))), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // the man with the ball, ringed so the eye finds him (red, pulsing, as the rush closes on the passer)
    const lead = p.carrier && p.phase !== 'pre' ? p.carrier : null;
    if (lead) {
      const f = L.at(lead.x, lead.y);
      const heat = lead === p.qb && p.phase === 'drop' ? p.pressure : 0;
      const rx = Math.max(4, Math.round(f.s * (0.62 + heat * (0.18 + 0.08 * Math.sin(p.t * 22)))));
      ctx.strokeStyle = heat > 0.05 ? 'rgba(255,' + Math.round(224 - 170 * heat) + ',' + Math.round(138 - 100 * heat) + ',0.95)' : 'rgba(255,224,138,0.85)';
      ctx.lineWidth = Math.max(1, Math.round(f.s * 0.08));
      ctx.beginPath();
      ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, Math.max(2, Math.round(rx * Math.sin(L.pitch(lead.y)) * 0.85)), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // a tackler gathering to dive: a ring that tightens and reddens as he's about to go
    if (p.phase === 'run') {
      for (const b of p.bodies) {
        if (b.side !== 'D' || b.windAt === Infinity) continue;
        const k = Math.min(1, (p.t - b.windAt) / windupOf(b));
        const f = L.at(b.x, b.y);
        const rx = Math.max(5, Math.round(f.s * (0.95 - 0.3 * k)));
        ctx.strokeStyle = 'rgba(255,' + Math.round(170 - 120 * k) + ',40,0.95)';
        ctx.lineWidth = Math.max(2, Math.round(f.s * 0.14));
        ctx.beginPath();
        ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, Math.max(2, Math.round(rx * Math.sin(L.pitch(b.y)))), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // the runner's stamina, under him, once a move has cost him some
    if (p.phase === 'run' && p.carrier && p.stamina < 0.99) {
      const c = p.carrier;
      const f = L.at(c.x, c.y);
      const w = Math.max(16, Math.round(f.s * 1.5));
      const h = Math.max(3, Math.round(f.s * 0.14));
      const x = Math.round(f.x - w / 2);
      const y = Math.round(f.y + Math.max(4, f.s * 0.45));
      ctx.fillStyle = 'rgba(6,10,8,0.8)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = p.stamina < 0.25 ? '#ff5a5a' : p.stamina < 0.5 ? '#ffd23a' : '#3ef0c0';
      ctx.fillRect(x, y, Math.max(1, Math.round(w * p.stamina)), h);
    }
    // the players, far to near
    const order = [...p.bodies].sort((a, b) => L.near(a.x, a.y) - L.near(b.x, b.y));
    const heads: Record<number, { x: number; y: number }> = {};
    let hand: { x: number; y: number; s: number } | null = null;
    for (const b of order) {
      const f = L.at(b.x, b.y);
      if (f.y < -40 || f.y > this.H + 80 || f.x < -60 || f.x > this.W + 60) continue;
      const spr = this.sprite(b, p.t, p, f.s);
      const x = Math.round(f.x - spr.ax);
      const y = Math.round(f.y - spr.ay);
      ctx.drawImage(spr.canvas, x, y);
      heads[b.id] = { x: Math.round(f.x), y: y + spr.top };
      if (b === p.carrier) {
        const hd = b.act === 'throw' || p.phase === 'pre' || p.phase === 'drop' ? spr.handR : spr.handL;
        hand = { x: x + hd.x, y: y + hd.y, s: f.s };
      }
    }
    // the ball, in the air (with its shadow) or in his hands
    const bn = ballNow(p);
    if (bn) {
      const g = L.at(bn.x, bn.y);
      ctx.fillStyle = 'rgba(8,26,8,0.45)';
      const sw = Math.max(2, Math.round(g.s * 0.3));
      ctx.fillRect(Math.round(g.x - sw / 2), Math.round(g.y), sw, Math.max(1, Math.round(sw / 2)));
      const a = L.at(bn.x, bn.y, bn.h);
      football(ctx, a.x, a.y, a.s, p.t);
    } else if (hand) football(ctx, hand.x, hand.y, hand.s, 0);
    // the slingshot: the arc (as much of it as he can see: an accurate passer all of it, a weaker one
    // or one with a rusher in his face only its start), where it lands and who it's going to
    if (o.aim && p.qb) {
      const from = p.qb;
      const len = Math.hypot(o.aim.x - from.x, o.aim.y - from.y);
      const peak = peakOf(len);
      const seen = sight(p, len);
      const n = Math.max(10, Math.round(len / 1.1));
      // the arc: bold dots with a dark edge, smaller as they go away, fading out where his sight ends
      for (let i = 1; i < n; i++) {
        if (i % 2) continue;
        const k = i / n;
        if (k > seen) break;
        const q = L.at(from.x + (o.aim.x - from.x) * k, from.y + (o.aim.y - from.y) * k, 1.8 + 4 * peak * k * (1 - k));
        const d = Math.max(3, Math.round(q.s * 0.3));
        ctx.globalAlpha = seen < 1 ? Math.max(0.15, Math.min(1, (seen - k) / 0.14)) : 1;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(Math.round(q.x - d / 2) - 1, Math.round(q.y - d / 2) - 1, d + 2, d + 2);
        ctx.fillStyle = p.fire ? '#ffc04a' : '#ffffff';
        ctx.fillRect(Math.round(q.x - d / 2), Math.round(q.y - d / 2), d, d);
      }
      ctx.globalAlpha = 1;
      const to = seen >= 1 ? this.receiverFor(p, o.aim) : null;
      if (seen >= 1 && to) {
        const g = L.at(to.at.x, to.at.y);
        const rr = Math.max(4, Math.round(g.s * 0.55));
        ctx.strokeStyle = 'rgba(255,224,138,0.95)';
        ctx.lineWidth = Math.max(1, Math.round(g.s * 0.1));
        ctx.beginPath();
        ctx.ellipse(Math.round(g.x), Math.round(g.y), rr, Math.max(2, Math.round(rr * Math.sin(L.pitch(to.at.y)))), 0, 0, Math.PI * 2);
        ctx.stroke();
        const h = heads[to.b.id];
        if (h) label(ctx, to.b.p.tag, h.x, h.y - 14, '#ffe08a', this.W);
      }
      if (seen >= 1) {
        const land = L.at(o.aim.x, o.aim.y);
        const r = Math.max(6, Math.round(land.s * throwErrorRadius(p, len)));
        ctx.strokeStyle = to ? '#3ef0a0' : '#ffffff';
        ctx.lineWidth = Math.max(2, Math.round(land.s * 0.16));
        ctx.beginPath();
        ctx.ellipse(Math.round(land.x), Math.round(land.y), r, Math.max(2, Math.round(r * Math.sin(L.pitch(o.aim.y)))), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    this.particles(ctx, p);
    // names: the receivers before the snap, the man with the ball after
    const tag = (b: Body, color: string, text = b.p.tag, up = 14) => {
      const h = heads[b.id];
      if (h) label(ctx, text, h.x, h.y - up, color, this.W);
    };
    if (o.routes) for (const b of p.bodies) if (b.side === 'O' && !isLine(b) && b !== p.qb) tag(b, '#ffffff');
    if (p.carrier && p.phase === 'run') tag(p.carrier, '#ffe08a');
    if (p.phase === 'run') for (const b of p.bodies) if (b.side === 'D' && b.windAt !== Infinity) tag(b, '#ff8a3a', '!', 32);
    ctx.restore();
    if (o.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, o.flash).toFixed(2) + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }
}

/** each receiver's route in its own color, the way the play art shows them */
const ROUTE_COLOR: Record<string, string> = { X: '#ffd23a', SL: '#ff7aa8', Z: '#5cb8ff', TE: '#7cf08c', RB: '#c7a2ff' };

/** The ball: brown with white laces, its size by the distance, turning over in flight. */
function football(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  const X = Math.round(x);
  const Y = Math.round(y);
  const w = Math.max(4, Math.round(s * 0.34));
  const h = Math.max(2, Math.round(w * 0.62));
  const turn = Math.floor(t * 12) % 2;
  ctx.fillStyle = '#2e1606';
  ctx.fillRect(X - Math.ceil(w / 2), Y - Math.ceil(h / 2), w, h);
  ctx.fillStyle = '#8b4a1f';
  ctx.fillRect(X - Math.ceil(w / 2) + 1, Y - Math.ceil(h / 2), Math.max(1, w - 2), Math.max(1, h - 1));
  ctx.fillStyle = turn ? '#f4f4f4' : '#d6d6d6';
  ctx.fillRect(X - Math.floor(w / 4), Y - Math.ceil(h / 2), Math.max(1, Math.floor(w / 2)), 1);
}

const F35: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', "'": '010010000000000', '!': '010010010000010',
};

/** A name tag: 3x5 letters doubled up, on a dark chip, kept on screen. */
function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, W: number) {
  const z = 2;
  const up = s.toUpperCase();
  const w = (up.length * 4 - 1) * z;
  const x0 = Math.max(3, Math.min(W - w - 3, Math.round(x - w / 2)));
  ctx.fillStyle = 'rgba(6,10,8,0.78)';
  ctx.fillRect(x0 - 3, y - 3, w + 6, 5 * z + 6);
  ctx.fillStyle = color;
  for (let i = 0; i < up.length; i++) {
    const g = F35[up[i]] ?? F35[' '];
    for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) if (g[r * 3 + col] === '1') ctx.fillRect(x0 + (i * 4 + col) * z, y + r * z, z, z);
  }
}
