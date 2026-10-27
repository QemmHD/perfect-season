// Draws arcade football as pixel art. Sideways it's the classic side-on look (the whole field drawn
// once, blitted under a camera that follows the ball); upright it's a broadcast camera from behind
// the offense with perspective, the grass drawn a row at a time. On top: twenty-two rigged players
// in their kits, the ball, the posts, the lines, the routes before the snap and the slingshot's arc.
import { DEFAULT_HAIR, DEFAULT_SKIN, drawBody, type Look, type Sprite } from '../pixel/body';
import { drawField, type FieldCam, fieldAt, fieldCam, fieldFacing, type FieldTheme } from '../pixel/field';
import { drawFloor, type FieldTex, fieldTexture, type PCam, pcam, pitchAt, project } from '../pixel/persp';
import * as P from '../pixel/poses';
import type { Pose } from '../pixel/rig';
import { ballNow, dist, FIELD_W, flightTime, isLine, maxThrow, projectRoute, speedOf } from './engine';
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
      const ph = timed(0.35, 5);
      return { key: 'tk' + ph, pose: P.dive(ph) };
    }
    case 'down':
      return { key: 'dn', pose: P.grounded() };
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
  private sprites = new Map<string, Sprite>();
  private looks = new Map<string, Look>();
  private follow: Pt | null = null;
  /** each player's drawing last frame, and how many new drawings this frame may still make */
  private last = new Map<string, Sprite>();
  private budget = 0;
  /** turf kicked up and confetti: field position and height, speed, life left, color, size */
  private bits: { x: number; y: number; h: number; vx: number; vy: number; vh: number; life: number; color: string; size: number }[] = [];
  /** what each player was doing last frame, to see a tackle or a move start */
  private acts = new Map<number, string>();
  private playSeen: Play | null = null;
  private lastNow = 0;
  private lens!: Lens;

  constructor(
    private theme: FieldTheme,
    private kits: [FbKit, FbKit]
  ) {}

  /** Game pixels are screen pixels (crisp on any phone); upright gets the perspective camera. */
  resize(cssW: number, cssH: number) {
    const W = Math.max(1, Math.round(cssW));
    const H = Math.max(1, Math.round(cssH));
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.mode = W > H ? 'side' : 'end';
    this.field = null;
    this.floor = null;
    this.follow = null;
    this.sprites.clear();
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
    return pcam(this.W, this.H, fx, fy, { row: 0.68, s: Math.max(11, this.W / 26), horizon: 0.13, pitch: 0.5, fov: 0.42 });
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
    const b = ballNow(p);
    const c = p.carrier ?? p.qb;
    const at = b ?? c;
    const pre = p.phase === 'pre' || p.phase === 'drop';
    let y = at.y + (pre ? (this.mode === 'side' ? 9 : 1) : this.mode === 'side' ? 3 : -1);
    if (aim && p.phase === 'drop') y = Math.max(y, (p.qb.y + aim.y) / 2 + (this.mode === 'side' ? 2 : -6));
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
    const moving = Math.hypot(b.vx, b.vy) > 0.6;
    // facing: where he's going, or (set) up the field for the offense, down it for the defense
    const dir = moving ? { x: b.vx, y: b.vy } : b.side === 'O' ? { x: 0, y: 1 } : { x: 0, y: -1 };
    // sizes, angles and (for small, far players) facings in steps, so a player moving up the field
    // reuses his drawings
    const raw = Math.max(8, Math.round((b.p.ht / 36) * s));
    const px = raw > 14 ? raw - (raw % 2) : raw;
    const dirs = px < 22 ? 8 : 16;
    const fb = (Math.round((L.facing(dir.x, dir.y) / (Math.PI * 2)) * dirs) + dirs) % dirs;
    // seen from high up close: the rig reads best no steeper than this
    const pitch = Math.round(Math.min(0.9, L.pitch(b.y)) / 0.15) * 0.15;
    const { key, pose } = poseOf(b, t, p);
    const who = b.p.id + '|' + b.side;
    const k = who + '|' + key + '|' + fb + '/' + dirs + '|' + px + '|' + pitch;
    let spr = this.sprites.get(k);
    if (!spr) {
      // a few new drawings a frame at most: past that, he keeps his last one a frame longer
      const last = this.last.get(who);
      if (this.budget <= 0 && last) return last;
      this.budget--;
      let look = this.looks.get(who);
      if (!look) {
        look = lookFor(b, this.kits[b.side === 'O' ? 0 : 1]);
        this.looks.set(who, look);
      }
      spr = drawBody(look, { ...pose, lift: 0 }, { facing: (fb / dirs) * Math.PI * 2, pitch }, px);
      if (this.sprites.size > 3000) this.sprites.clear();
      this.sprites.set(k, spr);
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
    const L = this.lens;
    this.bits = this.bits.filter((q) => (q.life -= dt) > 0);
    for (const q of this.bits) {
      const conf = q.size > 0.2;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.h = Math.max(0, q.h + q.vh * dt);
      // confetti flutters down; turf drops
      q.vh -= (conf ? 3.2 : 14) * dt;
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
    // follow the play
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
    // the man with the ball, ringed so the eye finds him
    const lead = p.carrier && p.phase !== 'pre' ? p.carrier : null;
    if (lead) {
      const f = L.at(lead.x, lead.y);
      const rx = Math.max(4, Math.round(f.s * 0.62));
      ctx.strokeStyle = 'rgba(255,224,138,0.85)';
      ctx.lineWidth = Math.max(1, Math.round(f.s * 0.08));
      ctx.beginPath();
      ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, Math.max(2, Math.round(rx * Math.sin(L.pitch(lead.y)) * 0.85)), 0, 0, Math.PI * 2);
      ctx.stroke();
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
    // the slingshot: the arc, where it lands and who it's going to
    if (o.aim && p.qb) {
      const from = p.qb;
      const len = Math.hypot(o.aim.x - from.x, o.aim.y - from.y);
      const peak = Math.min(10, 1.4 + len * 0.18);
      const n = Math.max(10, Math.round(len / 1.1));
      // the arc: bold dots with a dark edge, smaller as they go away
      for (let i = 1; i < n; i++) {
        if (i % 2) continue;
        const k = i / n;
        const q = L.at(from.x + (o.aim.x - from.x) * k, from.y + (o.aim.y - from.y) * k, 1.8 + 4 * peak * k * (1 - k));
        const d = Math.max(3, Math.round(q.s * 0.3));
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(Math.round(q.x - d / 2) - 1, Math.round(q.y - d / 2) - 1, d + 2, d + 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(q.x - d / 2), Math.round(q.y - d / 2), d, d);
      }
      const to = this.receiverFor(p, o.aim);
      if (to) {
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
      const land = L.at(o.aim.x, o.aim.y);
      const r = Math.max(9, Math.round(land.s * 1.1));
      ctx.strokeStyle = to ? '#3ef0a0' : '#ffffff';
      ctx.lineWidth = Math.max(2, Math.round(land.s * 0.16));
      ctx.beginPath();
      ctx.ellipse(Math.round(land.x), Math.round(land.y), r, Math.max(2, Math.round(r * Math.sin(L.pitch(o.aim.y)))), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.particles(ctx, p);
    // names: the receivers before the snap, the man with the ball after
    const tag = (b: Body, color: string) => {
      const h = heads[b.id];
      if (h) label(ctx, b.p.tag, h.x, h.y - 14, color, this.W);
    };
    if (o.routes) for (const b of p.bodies) if (b.side === 'O' && !isLine(b) && b !== p.qb) tag(b, '#ffffff');
    if (p.carrier && p.phase === 'run') tag(p.carrier, '#ffe08a');
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
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', "'": '010010000000000',
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
