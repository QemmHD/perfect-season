// Draws arcade basketball as fine pixel art through the broadcast camera (camera.ts: high, three-
// quarter, yawed 12° off the rim line, framed inside the HUD's action-safe box; the same either way
// up): the court drawn a row at a time, the arena's stands behind the basket, ten rigged players in
// their moves, the ball, the backboard, rim and net, the shot meter arched over the shooter and the
// contest grade, and the name chips (labels.ts) placed so none covers another.
// What each player looks like and which clip or pose he shows is chosen in pixel/select-nba.ts.
import { drawBody, type Look, SpriteCache, CanvasOut, freeCanvas } from '../pixel/body';
import { type CourtTheme, text } from '../pixel/court';
import { frameAt, mocapJoints, mocapKey } from '../pixel/mocap';
import { drawGate } from '../pixel/ready';
import { type ArtScale, ART_C, type ArtSprite, blitSprite, quantPx, toView } from '../pixel/art-scale';
import { drawGroundMark } from '../pixel/ground';
import { courtTexture, type FieldTex } from '../pixel/persp';
import { drawnHeight, shoulderWidthPx } from '../pixel/proportions';
import * as P from '../pixel/poses';
import type { Pose } from '../pixel/rig';
import { AT_RIM, type Anim, animOf, dribbleArm, hangOf, lookFor, type Memo, spins360 } from '../pixel/select-nba';
import { heaviness, leanForward, sprintLean, widen } from '../pixel/style';
import { type Juice, squashStretch } from '../juice';
import { ballPos, contestOf, RIM, RIM_H, shotChance, topSpeed } from './engine';
import { catchChance } from './autopilot';
import { type Cam3, CAM, camOf, camStart, camStep, type CamState, depthOf, facingIndex, guardOf, pitchAt, project, type SafeBox, screenToCourt, subjectOf, yawFor } from './camera';
import { drawCourtFloor } from './floor';
import { drawChip, foldName, type LabelReq, layoutLabels } from './labels';
import type { Body, Contest, Possession } from './types';

/** moved to pixel/select-nba.ts (players-2); re-exported for the screens and tools that import them here */
export { dunkStyle, spins360 } from '../pixel/select-nba';

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

const CONTEST_COLOR: Record<Contest, string> = { open: '#3ee08f', light: '#f4d03f', heavy: '#ff8c3a', smothered: '#ff4d5e' };
const CONTEST_TEXT: Record<Contest, string> = { open: 'OPEN', light: 'LIGHT', heavy: 'HEAVY', smothered: 'SMOTHERED' };

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
  private sprites = new SpriteCache<ArtSprite>(360);
  private last = new Map<string, ArtSprite>();
  /** the art pixel (pixel/art-scale.ts), set by the screen from its canvas each frame */
  art: ArtScale = ART_C;

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
    this.meterShown = null;
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
  /** the last shot meter, kept a moment after the release to show how it went */
  private meterShown: { idx: number; t0: number; top: number; green: number; until: number; frac: number; greened: boolean | null } | null = null;

  constructor(
    private theme: CourtTheme,
    private kits: [Kit, Kit]
  ) {}

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
  private sprite(b: Body, t: number, carrying: boolean, kit: Kit, s: number, ball: Possession['ball'], over?: { key: string; pose: Pose }): { spr: ArtSprite; ownLift: boolean } {
    // facing on screen, relative to the camera (it's yawed: camera.ts facingIndex); a 360 dunk
    // turns him all the way round on the way up
    const turn = spins360(b) ? Math.PI * 2 * Math.min(1, Math.max(0, (t - b.actAt - 0.12) / 0.42)) : 0;
    // drawn with V2's height spread around the league mean (render only: the engine keeps b.p.ht)
    // rasterised at its own art size (far players natively, never scaled down from a bigger drawing)
    const raw = Math.max(10, this.art.artPxFor((drawnHeight('nba', b.p.ht) / 12) * s));
    const px = quantPx(raw, this.art.viewPerArt);
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
    const k = who + '|' + key + '|' + fb + '/' + dirs + '|' + px + '|' + pitch + this.art.keySuffix;
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
        spr = toView(make(), this.art);
      } catch (e) {
        if (!(e instanceof CanvasOut)) throw e;
        // the phone is out of canvas memory: let go of every old drawing and try once more; failing
        // that, he keeps last frame's
        this.sprites.dispose(this.last.values());
        try {
          spr = toView(make(), this.art);
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
  private drawRim(ctx: CanvasRenderingContext2D, half: 'back' | 'front', swish: number) {
    const r = 0.75;
    const ring = (a: number, h = RIM_H) => this.at(RIM.cx + Math.cos(a) * r, RIM.cz + Math.sin(a) * r, h);
    const c = this.at(RIM.cx, RIM.cz, RIM_H);
    const lw = Math.max(1, Math.round(c.s * 0.14));
    // back half: away from the camera (along its forward, which is yawed); front: toward it
    const a0 = (half === 'back' ? -Math.PI / 2 : Math.PI / 2) + this.cs.yaw;
    if (half === 'front') {
      // the net: strands from the rim down to a narrower ring, swaying after a swish
      const len = 1.5 * (1 - swish * 0.25);
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
    // the first frame waits for the clips and looks (players-3, pixel/ready.ts)
    if (!drawGate('nba')) return;
    ctx.setTransform(this.art.backing, 0, 0, this.art.backing, 0, 0);
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
    // shadows on the floor (pixel/ground.ts: V2's soft contact shadow, shrinking as he rises)
    const t = p.t;
    for (const b of p.bodies) {
      const f = this.at(b.cx, b.cz);
      const tall = (drawnHeight('nba', b.p.ht) / 12) * f.s;
      drawGroundMark(ctx, { x: f.x, y: f.y, shoulderPx: shoulderWidthPx(b.p.ht, b.p.wt, tall), pitch: pitchAt(this.c3, b.cx, b.cz), lift: b.h / (b.p.ht / 12) });
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
              blitSprite(ctx, s, Math.round(g.x - s.ax), Math.round(g.y - s.ay));
            }
            ctx.globalAlpha = a0;
          }
          blitSprite(ctx, s, x, y);
          headOf[b.idx] = { x: Math.round(f.x), y: y + s.top, right: x + s.w };
          if (carrying) handSpot = { x: x + s.handR.x, y: y + s.handR.y, s: f.s };
        },
      });
    }
    items.push({ depth: depthOf(this.c3, RIM.cx, RIM.cz) + 0.4, draw: () => this.drawRim(ctx, 'back', fx.swish) });
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
    // sweat, sparks and confetti
    fx.juice?.draw(ctx);
    // the shot meter and the contest on the shooter
    this.drawMeter(ctx, p, real, headOf);
    // the pass target (NBA-16): a teal ring at his feet, his name and his shot as it will be when the
    // ball gets there (his man closing out while it's in the air: catchChance), not as he stands now
    if (p.target !== null && p.handler !== null && !p.meter && !p.finish) {
      const m = p.bodies[p.target];
      const h = headOf[p.target];
      if (h && m) {
        const f = this.at(m.cx, m.cz);
        ctx.strokeStyle = '#19e3c9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(Math.round(f.x), Math.round(f.y), Math.max(7, f.s * 1.5), Math.max(3, f.s * 1.5 * Math.sin(pitchAt(this.c3, m.cx, m.cz))), 0, 0, Math.PI * 2);
        ctx.stroke();
        const c = this.showOdds ? catchChance(p, p.bodies[p.handler], m) : null;
        this.chip(m.p.tag + (c !== null ? ' ' + Math.round(c * 100) + '%' : ''), h.x, h.y - 18, c !== null ? oddsColor(c) : '#88f6da', 3);
      }
    }
    // the handler's name over his head (the contest grade takes its place while he shoots); at his
    // feet his sprint's stamina while it isn't full, and his shot % from here
    if (p.handler !== null && !p.ball && !p.meter) {
      const b = p.bodies[p.handler];
      const h = headOf[b.idx];
      if (h) this.chip(b.p.tag, h.x, h.y - 18, p.fire === b.idx ? '#ffb02e' : '#ffffff', 4);
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
          this.chip(Math.round(c * 100) + '%', f.x, y, oddsColor(c), 2, 0);
        }
      }
    }
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
      this.chip(CONTEST_TEXT[grade], head.x, cy - R - th - 18, CONTEST_COLOR[grade], 6);
      if (p.meter.style) this.chip(p.meter.style === 'catch' ? 'CATCH & SHOOT' : p.meter.style === 'pullup' ? 'MOVING SHOT' : 'SET SHOT', head.x, cy - R - th - 34, '#d6e5ed', 5);
    } else if (result && p.lastShot) {
      const shot = p.lastShot;
      const text = shot.greened ? (shot.contest === 'heavy' || shot.contest === 'smothered' ? 'PERFECT / ' + CONTEST_TEXT[shot.contest] : 'PERFECT') : Math.abs(shot.off) < 0.22 ? 'GOOD RELEASE' : shot.off < 0 ? 'EARLY' : 'LATE';
      this.chip(text, head.x, cy - R - th - 18, shot.greened ? '#3ef07a' : '#ffd35a', 6);
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

export { text };
