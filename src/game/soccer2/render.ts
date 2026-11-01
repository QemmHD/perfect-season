// Soccer v2 drawn as pixel art: implemented by Claude (Anthropic), 2026-11-01, in the style of the
// football field (football2/render.ts). A broadcast camera with perspective sits behind the attack
// looking at the goal; the pitch is drawn a row at a time from its top-down picture (persp.ts'
// "mode 7" floor) with the far stand behind the goal. On it: the goal frame and its net, the rigged
// players in their kits playing the motion-capture clips (the CMU kick for passes and shots, the dive
// for a keeper's save and a slide tackle), the ball and its shadow, and the HUD drawn in the world:
// the ring on the man you control, his stamina, the pass he'd play, the power meter's arch with its
// green slice and the aim in the goal mouth with the shot's error cone.
import { DEFAULT_HAIR, DEFAULT_SKIN, drawBody, freeCanvas, hairFor, beardFor, type Look, type Sprite, SpriteCache, CanvasOut } from '../pixel/body';
import { clipMeta, frameAt, getClip, legScale, loadClips, mocapJoints, mocapKey, warp } from '../pixel/mocap';
import { drawFloor, type FieldTex, type PCam, pcam, pitchAt, project } from '../pixel/persp';
import { pitchTexture, type PitchTheme } from '../pixel/pitch';
import * as P from '../pixel/poses';
import type { Pose } from '../pixel/rig';
import { aimPoint, GH, GHALF, GX, METER, PL, PW, ctrlOf } from './engine';
import { topSpeed } from './ratings';
import type { Attack, Body, Pt } from './types';

export interface SoccerKit {
  jersey: string;
  trim: string;
  shorts: string;
  socks: string;
  shoes: string;
  /** a keeper's */
  gloves?: string;
}

export interface SoccerOverlay {
  /** the teammate a pass would go to now (the stick's choice) */
  target: number | null;
  /** the stick's aim in the goal while SHOOT is held (x, y -1..1), or null (assisted) */
  aim: Pt | null;
  shake: number;
  flash: number;
  /** names over everyone (before kick-off) */
  names: boolean;
}

const CLIPS = ['ready', 'jog', 'run', 'sprint', 'kick', 'dive', 'fall_forward', 'fall_forward_m', 'fall_back', 'catch', 'jump', 'celebrate', 'shuffle', 'shuffle_l', 'backpedal'];
/** the kick: the boot through the ball when the engine strikes it (0.11 s after the swing starts) */
const KICK = warp(clipMeta('kick'), { contact: 0.11 });
/** a slide tackle or a keeper's dive: off his feet at once, down 0.45 s later */
const DIVE = warp(clipMeta('dive'), { takeoff: 0.02, impact: 0.42, ground: 0.6 });
const FALL = warp(clipMeta('fall_forward'), { impact: 0.3, ground: 0.5 });
/** a header: the jump's top at contact */
const JUMP = warp(clipMeta('jump'), { takeoff: 0.0, apex: 0.18 });

interface Anim {
  key: string;
  pose: Pose;
  clip?: string;
  ct?: number;
  step?: number;
}

interface Memo {
  gait: { t: number; frac: number };
  face: { x: number; y: number };
  faceAt: number;
}

const has = (name: string) => !!getClip(name);
const heightM = (b: Body) => b.p.ht / 100;

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
function gait(b: Body, t: number, look: Look, m: Memo, speed: number): { clip: string; ct: number } | null {
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

function animOf(b: Body, t: number, look: Look, m: Memo): Anim {
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

export class SoccerRenderer {
  W = 0;
  H = 0;
  zoom = 1;
  private cam: PCam | null = null;
  private tex: FieldTex | null = null;
  private floor: { canvas: HTMLCanvasElement; img: ImageData; px: Uint32Array } | null = null;
  private sprites = new SpriteCache(700);
  private looks = new Map<string, Look>();
  private memos = new Map<string, Memo>();
  private last = new Map<string, Sprite>();
  private budget = 0;
  private follow: Pt | null = null;
  private bits: { x: number; y: number; h: number; vx: number; vy: number; vh: number; life: number; color: string; size: number }[] = [];
  private acts = new Map<string, string>();
  private lastNow = 0;
  private goalAt: number | null = null;
  /** an instant replay: push the camera in on this spot */
  replay: Pt | null = null;
  private zoomK = 1;

  constructor(
    private theme: PitchTheme,
    private kits: { us: SoccerKit; them: SoccerKit; usGk: SoccerKit; themGk: SoccerKit },
  ) {
    loadClips(CLIPS).catch(() => {
      // the hand-keyed poses carry on
    });
  }

  dispose() {
    this.sprites.dispose();
    for (const s of this.last.values()) freeCanvas(s.canvas);
    this.last.clear();
    freeCanvas(this.floor?.canvas);
    this.floor = null;
  }

  /** a new attack (or a shootout kick by the other side): the kits swap with the sides */
  sidesSwapped = false;

  resize(cssW: number, cssH: number) {
    const W = Math.max(1, Math.round(cssW));
    const H = Math.max(1, Math.round(cssH));
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    freeCanvas(this.floor?.canvas);
    this.floor = null;
    this.follow = null;
    this.cam = this.camAt(PW / 2, 70);
  }

  private camAt(fx: number, fy: number): PCam {
    const wide = this.W > this.H;
    // portrait: the play two thirds down, the goal and the far stand under the scoreboard
    return pcam(this.W, this.H, fx, fy, wide ? { row: 0.66, s: Math.max(9, this.H / 15) * this.zoomK, horizon: 0.08, pitch: 0.36, fov: 0.62 } : { row: 0.6, s: Math.max(9, this.W / 19) * this.zoomK, horizon: 0.02, pitch: 0.5, fov: 0.45 });
  }

  /** where the camera looks: the ball, a little toward the goal, the goal in view near the box */
  private target(a: Attack): Pt {
    if (this.replay) return { x: Math.max(18, Math.min(PW - 18, this.replay.x)), y: Math.min(this.replay.y, PL - 10) };
    const o = a.ball.owner !== null ? a.bodies[a.ball.owner] : null;
    const at = o ?? a.ball;
    const sp = a.setPiece;
    let y = at.y + 2.5;
    // a corner: back from the box, toward the flag, so the taker and the box both show
    if (sp?.kind === 'corner') return { x: GX + (a.ball.x - GX) * 0.42, y: PL - 23 };
    else if (sp?.kind === 'penalty') y = PL - 13.5;
    else if (sp) y = sp.spot.y + 2;
    y = Math.max(44, Math.min(y, PL - 12.5));
    const x = PW / 2 + (Math.max(6, Math.min(PW - 6, at.x)) - PW / 2) * 0.6;
    return { x, y };
  }

  private lens(x: number, y: number, h = 0) {
    return project(this.cam!, x, y, h);
  }

  private sprite(b: Body, t: number, s: number, kitSide: 'us' | 'them'): Sprite {
    const who = b.p.id + '|' + b.side + '|' + kitSide;
    let memo = this.memos.get(who);
    if (!memo) {
      memo = { gait: { t, frac: (b.id * 0.29) % 1 }, face: { x: b.fx, y: b.fy }, faceAt: t };
      this.memos.set(who, memo);
    }
    const grounded = b.act === 'tackle' || b.act === 'down' || b.act === 'dive';
    let dir = { x: b.fx, y: b.fy };
    if (b.role === 'gk' && b.act === 'dive') dir = { x: Math.sign(b.vx) || 1, y: 0 };
    if (!grounded || b.role === 'gk') {
      const target = Math.atan2(dir.y, dir.x);
      const old = Math.atan2(memo.face.y, memo.face.x);
      const delta = Math.atan2(Math.sin(target - old), Math.cos(target - old));
      const k = b.act === 'dive' || b.act === 'kick' ? 1 : Math.min(1, Math.max(0, t - memo.faceAt) * 12);
      const f = old + delta * k;
      memo.face = { x: Math.cos(f), y: Math.sin(f) };
    }
    memo.faceAt = t;
    dir = memo.face;
    const raw = Math.max(8, Math.round(heightM(b) * s));
    const px = raw > 14 ? raw - (raw % 2) : raw;
    const dirs = px < 22 ? 8 : 16;
    const facing = Math.atan2(-dir.y, dir.x);
    const fb = (Math.round((facing / (Math.PI * 2)) * dirs) + dirs) % dirs;
    const pitch = Math.round(Math.min(0.9, pitchAt(this.cam!, b.y)) / 0.15) * 0.15;
    let look = this.looks.get(who);
    if (!look) {
      const kit = kitSide === 'us' ? this.kits.us : this.kits.them;
      const gk = kitSide === 'us' ? this.kits.usGk : this.kits.themGk;
      look = lookFor(b, kit, gk);
      this.looks.set(who, look);
    }
    const an = animOf(b, t, look, memo);
    const step = an.clip ? (px < 22 ? Math.max(3, an.step ?? 2) : (an.step ?? 2)) : 1;
    const frame = an.clip ? frameAt(an.clip, an.ct ?? 0, step) : 0;
    const key = an.clip ? mocapKey(an.clip, frame, 'clip') : an.key;
    const k = who + '|' + key + '|' + fb + '/' + dirs + '|' + px + '|' + pitch;
    let spr = this.sprites.get(k);
    if (!spr) {
      const last = this.last.get(who);
      if (this.budget <= 0 && last) return last;
      this.budget--;
      const view = { facing: (fb / dirs) * Math.PI * 2, pitch };
      const make = () => (an.clip ? drawBody(look!, mocapJoints(an.clip, frame, look!, { ground: 'clip' }), view, px) : drawBody(look!, { ...an.pose, lift: 0 }, view, px));
      try {
        spr = make();
      } catch (e) {
        if (!(e instanceof CanvasOut)) throw e;
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
    if (!this.tex) this.tex = pitchTexture(this.theme);
    const q = 2;
    if (!this.floor) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(this.W / q);
      canvas.height = Math.ceil(this.H / q);
      const img = canvas.getContext('2d')!.createImageData(canvas.width, canvas.height);
      this.floor = { canvas, img, px: new Uint32Array(img.data.buffer) };
    }
    const fl = this.floor;
    drawFloor(this.cam!, this.tex, fl.px, q);
    fl.canvas.getContext('2d')!.putImageData(fl.img, 0, 0);
    ctx.drawImage(fl.canvas, 0, 0, fl.canvas.width * q, fl.canvas.height * q);
  }

  /** The net (behind the frame): its back, sides and roof, in a mesh, bulging where the ball hit. */
  private net(ctx: CanvasRenderingContext2D, a: Attack) {
    const D = 2.1;
    const backH = 1.95;
    const bulge = this.goalAt !== null ? Math.max(0, 1 - (a.t - this.goalAt) / 1.2) : 0;
    const bx = a.ball.x;
    const back = (x: number, h: number) => {
      const near = Math.max(0, 1 - Math.hypot(x - bx, h - Math.min(a.ball.h, 1.5)) / 1.6);
      return this.lens(x, PL + D + bulge * near * 0.6, h);
    };
    ctx.save();
    // the shadow inside the goal
    ctx.fillStyle = 'rgba(8,18,10,0.35)';
    const g0 = this.lens(GX - GHALF, PL);
    const g1 = this.lens(GX + GHALF, PL);
    const g2 = this.lens(GX + GHALF, PL + D);
    const g3 = this.lens(GX - GHALF, PL + D);
    ctx.beginPath();
    ctx.moveTo(g0.x, g0.y);
    ctx.lineTo(g1.x, g1.y);
    ctx.lineTo(g2.x, g2.y);
    ctx.lineTo(g3.x, g3.y);
    ctx.fill();
    // the back net, a light film
    const c0 = back(GX - GHALF, 0);
    const c1 = back(GX + GHALF, 0);
    const c2 = back(GX + GHALF, backH);
    const c3 = back(GX - GHALF, backH);
    ctx.fillStyle = 'rgba(235,240,245,0.12)';
    ctx.beginPath();
    ctx.moveTo(c0.x, c0.y);
    ctx.lineTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.fill();
    const s = this.lens(GX, PL).s;
    ctx.strokeStyle = 'rgba(240,244,248,0.42)';
    ctx.lineWidth = Math.max(1, Math.round(s * 0.035));
    ctx.beginPath();
    const mesh = s > 14 ? 0.35 : 0.55;
    // the back: verticals and rows
    for (let x = GX - GHALF; x <= GX + GHALF + 1e-6; x += mesh) {
      const p0 = back(x, 0);
      const p1 = back(x, backH);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    for (let h = 0; h <= backH + 1e-6; h += mesh) {
      ctx.moveTo(back(GX - GHALF, h).x, back(GX - GHALF, h).y);
      for (let x = GX - GHALF + mesh; x <= GX + GHALF + 1e-6; x += mesh) {
        const p = back(x, h);
        ctx.lineTo(p.x, p.y);
      }
    }
    // the roof: from the crossbar back to the top of the back net
    for (let x = GX - GHALF; x <= GX + GHALF + 1e-6; x += mesh) {
      const p0 = this.lens(x, PL, GH);
      const p1 = back(x, backH);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    // the sides
    for (const sx of [GX - GHALF, GX + GHALF]) {
      for (let d = 0; d <= D + 1e-6; d += mesh) {
        const hgt = GH + (backH - GH) * (d / D);
        const p0 = this.lens(sx, PL + d, 0);
        const p1 = this.lens(sx, PL + d, hgt);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
      for (let h = 0; h <= GH; h += mesh) {
        const p0 = this.lens(sx, PL, h);
        const p1 = back(sx, Math.min(h, backH));
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /** The frame: two white posts and the bar, 7.32 by 2.44, with a shaded edge. */
  private frame(ctx: CanvasRenderingContext2D) {
    const base = this.lens(GX, PL);
    const w = Math.max(2, Math.round(base.s * 0.12));
    const pts = [this.lens(GX - GHALF, PL), this.lens(GX - GHALF, PL, GH), this.lens(GX + GHALF, PL, GH), this.lens(GX + GHALF, PL)];
    ctx.save();
    ctx.lineJoin = 'miter';
    for (const [color, lw, dy] of [
      ['rgba(0,0,0,0.35)', w + 2, 1],
      ['#c9ccd2', w, 0],
      ['#fbfbf7', Math.max(1, w - 1), -0.5],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(Math.round(pts[0].x), Math.round(pts[0].y + dy));
      for (let i = 1; i < 4; i++) ctx.lineTo(Math.round(pts[i].x), Math.round(pts[i].y + dy));
      ctx.stroke();
    }
    ctx.restore();
  }

  private ball(ctx: CanvasRenderingContext2D, a: Attack) {
    const b = a.ball;
    const g = this.lens(b.x, b.y);
    const r = Math.max(2, Math.round(g.s * 0.17));
    // the shadow on the grass, smaller and fainter as it rises
    const lift = Math.min(1, b.h / 4);
    ctx.fillStyle = 'rgba(8,26,8,' + (0.45 - lift * 0.25).toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(Math.round(g.x), Math.round(g.y), Math.max(1.5, r * (1 - lift * 0.4)), Math.max(1, r * 0.45 * (1 - lift * 0.4)), 0, 0, Math.PI * 2);
    ctx.fill();
    const at = this.lens(b.x, b.y, b.h + 0.11);
    const R = Math.max(2, Math.round(at.s * 0.17));
    const X = Math.round(at.x);
    const Y = Math.round(at.y);
    ctx.fillStyle = '#1a1c22';
    ctx.beginPath();
    ctx.arc(X, Y, R + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6f6f2';
    ctx.beginPath();
    ctx.arc(X, Y, R, 0, Math.PI * 2);
    ctx.fill();
    // the panels, turning with the ball's travel
    const spin = (b.x * 1.7 + b.y * 1.3) % 2;
    ctx.fillStyle = '#2a2d35';
    const d = Math.max(1, Math.round(R * 0.5));
    if (R >= 3) {
      ctx.fillRect(X - (spin < 1 ? d : 0), Y - Math.round(d / 2), d, d);
      if (R >= 4) ctx.fillRect(X + Math.round(R * 0.35), Y + (spin < 1 ? 0 : -d), Math.max(1, d - 1), Math.max(1, d - 1));
    } else ctx.fillRect(X - 1 + (spin < 1 ? 0 : 1), Y - 1, 1, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(X - Math.round(R * 0.5), Y - Math.round(R * 0.6), 1, 1);
  }

  private burst(x: number, y: number, n: number, kind: 'turf' | 'confetti') {
    const turf = ['#3c7a2c', '#58993c', '#6b4a2a', '#8a6a3c'];
    const conf = [this.kits.us.jersey, this.kits.us.trim, '#ffffff', '#ffd23a'];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = kind === 'turf' ? 1.5 + Math.random() * 2.5 : 2 + Math.random() * 5;
      this.bits.push({ x, y, h: kind === 'turf' ? 0.1 : 2 + Math.random() * 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, vh: kind === 'turf' ? 2 + Math.random() * 3 : 4 + Math.random() * 6, life: kind === 'turf' ? 0.5 : 1.6 + Math.random() * 0.8, color: (kind === 'turf' ? turf : conf)[Math.floor(Math.random() * 4)], size: kind === 'turf' ? 0.14 : 0.24 });
    }
    if (this.bits.length > 400) this.bits.splice(0, this.bits.length - 400);
  }

  private particles(ctx: CanvasRenderingContext2D, a: Attack) {
    const now = performance.now() / 1000;
    const dt = this.lastNow ? Math.min(0.05, now - this.lastNow) : 0;
    this.lastNow = now;
    for (const b of a.bodies) {
      const k = b.p.id + b.side;
      const was = this.acts.get(k);
      if (was !== b.act) {
        if (was !== undefined && (b.act === 'tackle' || b.act === 'down' || b.act === 'dive')) this.burst(b.x, b.y, 9, 'turf');
        if (b.act === 'celebrate') this.burst(b.x, b.y, 70, 'confetti');
        this.acts.set(k, b.act);
      }
    }
    this.bits = this.bits.filter((q) => (q.life -= dt) > 0);
    for (const q of this.bits) {
      const conf = q.size > 0.2;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.h = Math.max(0, q.h + q.vh * dt);
      q.vh -= (conf ? 3.2 : 14) * dt;
      if (conf) {
        q.vh = Math.max(q.vh, -1.6);
        q.vx *= 0.98;
        q.vy *= 0.98;
      }
      const p = this.lens(q.x, q.y, q.h);
      const d = Math.max(1, Math.round(p.s * q.size));
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(p.x - d / 2), Math.round(p.y - d / 2), d, d);
    }
  }

  /** The power meter: an arch over the shooter, filling as SHOOT is held, the green slice at its top. */
  private meter(ctx: CanvasRenderingContext2D, a: Attack, head: { x: number; y: number }) {
    const m = a.meter;
    if (!m) return;
    const span = METER * 1.3;
    const frac = Math.min(1, (a.t - m.t0) / span);
    const R = Math.max(24, Math.round(Math.min(this.W, this.H) * 0.085));
    const th = Math.max(7, Math.round(R * 0.27));
    const cx = head.x;
    const cy = Math.max(R + th + 30, head.y + Math.round(R * 0.25));
    const A0 = Math.PI + 0.36;
    const SW = Math.PI - 0.72;
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
    band(A0 - 0.05, A0 + SW + 0.05, R, th + 5, '#05070d');
    band(A0 - 0.03, A0 + SW + 0.03, R, th + 2, '#e8ecf5');
    band(A0, A0 + SW, R, th, '#1a2235');
    const gc = A0 + (m.top / span) * SW;
    const gw = Math.max(0.006, (m.green / span) * SW);
    const glow = Math.max(0, 1 - Math.abs(frac * span - m.top) / 0.12);
    band(Math.max(A0, gc - gw), Math.min(A0 + SW, gc + gw), R, th, glow > 0 ? mixHex('#1f9e4c', '#7dffab', glow) : '#1f9e4c');
    band(gc - gw, gc + gw, R + th / 2 + 2, 2, '#3ef07a');
    band(gc - gw, gc + gw, R - th / 2 - 2, 2, '#3ef07a');
    const fillTo = A0 + frac * SW;
    const over = frac * span > m.top + m.green;
    band(A0, fillTo, R, th - 2, over ? '#ff7a4a' : '#ffd35a');
    band(A0, fillTo, R - th / 2 + 2, 1, 'rgba(255,255,255,0.55)');
    if (frac > 0.01) band(fillTo - 0.035, fillTo, R, th + 4, '#ffffff');
    ctx.restore();
    label(ctx, m.first ? 'FIRST TIME' : a.setPiece?.kind === 'penalty' ? 'PENALTY' : a.setPiece ? 'FREE KICK' : 'POWER', cx, cy - R - th - 16, '#d6e5ed', this.W);
  }

  /** Where the shot is going: a ring in the goal mouth as big as his error cone (a finisher's is tight). */
  private aim(ctx: CanvasRenderingContext2D, a: Attack, aim: Pt | null, cone: number) {
    const c = ctrlOf(a);
    const tp = aimPoint(a, c, aim);
    const p = this.lens(tp.x, PL, tp.h);
    const dist = Math.hypot(tp.x - a.ball.x, PL - a.ball.y);
    const rM = Math.max(0.25, dist * Math.tan((cone * 0.55 * Math.PI) / 180) * 1.6);
    const r = Math.max(4, Math.round(rM * p.s));
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(Math.round(p.x), Math.round(p.y), r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(Math.round(p.x), Math.round(p.y), r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
    ctx.restore();
  }

  goalScored(t: number) {
    this.goalAt = t;
  }

  draw(ctx: CanvasRenderingContext2D, a: Attack, o: SoccerOverlay, kitOf: (b: Body) => 'us' | 'them', cone: number) {
    ctx.imageSmoothingEnabled = false;
    this.zoomK += ((this.replay ? 1.3 : 1) - this.zoomK) * 0.08;
    const want = this.target(a);
    if (!this.follow) this.follow = want;
    this.follow = { x: this.follow.x + (want.x - this.follow.x) * 0.07, y: this.follow.y + (want.y - this.follow.y) * 0.08 };
    this.cam = this.camAt(this.follow.x, this.follow.y);
    if (a.end?.kind === 'G' && this.goalAt === null) this.goalAt = a.t;
    if (!a.end) this.goalAt = null;
    this.budget = 5;
    const shx = o.shake ? Math.round((Math.random() - 0.5) * o.shake * 2) : 0;
    const shy = o.shake ? Math.round((Math.random() - 0.5) * o.shake * 2) : 0;
    ctx.save();
    ctx.translate(shx, shy);
    this.drawGround(ctx);
    this.net(ctx, a);
    const ballBehind = a.ball.y > PL + 0.05;
    if (ballBehind) this.ball(ctx, a);
    this.frame(ctx);
    // shadows
    for (const b of a.bodies) {
      const f = this.lens(b.x, b.y);
      const rx = Math.max(2, Math.round(f.s * 0.36));
      ctx.fillStyle = 'rgba(8,26,8,0.4)';
      ctx.beginPath();
      ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, Math.max(1, Math.round(rx * Math.sin(pitchAt(this.cam!, b.y)) * 0.8)), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const c = ctrlOf(a);
    const ring = (b: Body, color: string, k = 0.58, w = 0.08) => {
      const f = this.lens(b.x, b.y);
      const rx = Math.max(5, Math.round(f.s * k));
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, Math.round(f.s * w));
      ctx.beginPath();
      ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, Math.max(2, Math.round(rx * Math.sin(pitchAt(this.cam!, b.y)) * 0.85)), 0, 0, Math.PI * 2);
      ctx.stroke();
    };
    if (!a.end) {
      ring(c, 'rgba(255,224,138,0.95)');
      if (o.target !== null && a.bodies[o.target]) ring(a.bodies[o.target], 'rgba(62,240,192,0.9)', 0.5, 0.06);
    }
    // the players and the ball, far to near
    const items: { y: number; draw: () => void }[] = [];
    const heads: Record<number, { x: number; y: number }> = {};
    for (const b of a.bodies) {
      items.push({
        y: b.y,
        draw: () => {
          const f = this.lens(b.x, b.y, b.h);
          if (f.y < -60 || f.y > this.H + 90 || f.x < -60 || f.x > this.W + 60) return;
          const spr = this.sprite(b, a.t, this.lens(b.x, b.y).s, kitOf(b));
          const x = Math.round(f.x - spr.ax);
          const y = Math.round(f.y - spr.ay);
          ctx.drawImage(spr.canvas, x, y);
          heads[b.id] = { x: Math.round(f.x), y: y + spr.top };
        },
      });
    }
    if (!ballBehind) items.push({ y: a.ball.y - 0.25, draw: () => this.ball(ctx, a) });
    items.sort((p, q) => q.y - p.y);
    for (const it of items) it.draw();
    this.particles(ctx, a);
    // the man you're on: his name; his stamina once sprinting has cost some
    const h = heads[c.id];
    if (h && !a.end) {
      if (a.stamina < 0.99) {
        const f = this.lens(c.x, c.y);
        const w = Math.max(18, Math.round(f.s * 1.4));
        const hh = Math.max(3, Math.round(f.s * 0.13));
        const x = Math.round(f.x - w / 2);
        const y = Math.round(f.y + Math.max(5, f.s * 0.42));
        ctx.fillStyle = 'rgba(6,10,8,0.8)';
        ctx.fillRect(x - 1, y - 1, w + 2, hh + 2);
        ctx.fillStyle = a.stamina < 0.25 ? '#ff5a5a' : a.stamina < 0.5 ? '#ffd23a' : '#3ef0c0';
        ctx.fillRect(x, y, Math.max(1, Math.round(w * a.stamina)), hh);
      }
      // his name under his feet (over his head it would hide the ball he's about to play)
      if (!a.meter) {
        const f = this.lens(c.x, c.y);
        label(ctx, c.p.tag, f.x, Math.round(f.y + Math.max(10, f.s * 0.42) + 6), '#ffe08a', this.W);
      }
    }
    if (o.target !== null && heads[o.target] && !a.end && !a.meter) {
      const t = a.bodies[o.target];
      label(ctx, t.p.tag, heads[o.target].x, heads[o.target].y - 15, '#7ff5d6', this.W);
    }
    if (o.names) for (const b of a.bodies) if (b.side === 'A' && b !== c && heads[b.id]) label(ctx, b.p.tag, heads[b.id].x, heads[b.id].y - 15, '#ffffff', this.W);
    if (a.meter && h) {
      this.aim(ctx, a, o.aim, cone);
      this.meter(ctx, a, h);
    }
    // a free kick's bend: an arrow over the ball the way it will swing
    if (a.setPiece?.kind === 'freekick' && Math.abs(a.curl) > 0.05 && !a.end) {
      const p0 = this.lens(a.ball.x, a.ball.y, 1.6);
      const dir = a.curl > 0 ? -1 : 1;
      const len = Math.max(14, Math.round(p0.s * 1.4 * Math.abs(a.curl)));
      ctx.strokeStyle = '#ffd23a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p0.x + dir * len * 0.2, p0.y + len * 0.8, len, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
      ctx.stroke();
      label(ctx, 'BEND', p0.x, p0.y - 22, '#ffd23a', this.W);
    }
    ctx.restore();
    if (o.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, o.flash).toFixed(2) + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  /** The teammate nearest a screen point (for tap-to-pass), within `r` pixels. */
  bodyAt(a: Attack, sx: number, sy: number, r: number): number | null {
    let best: number | null = null;
    let bd = r;
    for (const b of a.bodies) {
      if (b.side !== 'A') continue;
      const f = this.lens(b.x, b.y, 0.9);
      const d = Math.hypot(f.x - sx, f.y - sy);
      if (d < bd) {
        bd = d;
        best = b.id;
      }
    }
    return best;
  }
}

/** Is the speed the man is moving near his top (for the drawing's sprint dust)? */
export const sprinting = (b: Body) => Math.hypot(b.vx, b.vy) > topSpeed(b.p) * 0.92;

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) + ((((pb >> s) & 255) - ((pa >> s) & 255)) * k));
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

const F35: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', "'": '010010000000000', '!': '010010010000010',
};

/** A name tag: 3x5 letters doubled up, on a dark chip, kept on screen (the football field's). */
export function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, W: number) {
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
