// Draws arcade basketball as pixel art: the court (cached), the stands and ticker, ten rigged players
// in their moves, the ball, the hoop, the 2K-style shot meter and the contest grade. Everything is
// drawn at the game's own low resolution onto one canvas the page scales up by a whole number.
import { DEFAULT_HAIR, DEFAULT_SKIN, beardFor, drawBody, hairFor, type Look, type Sprite } from '../pixel/body';
import { at, type CourtCam, courtCam, type CourtTheme, drawCourt, drawHoopBack, drawHoopFront, drawStands, facingOn, nearness, text, textWidth, wallOf } from '../pixel/court';
import { PixBuf } from '../pixel/pixbuf';
import * as P from '../pixel/poses';
import type { Pose } from '../pixel/rig';
import { ballPos, contestOf, RIM } from './engine';
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

/** The pose and its cache key for what a body is doing right now. */
function poseOf(b: Body, t: number, carrying: boolean): { key: string; pose: Pose } {
  const since = t - b.actAt;
  const speed = Math.hypot(b.vx, b.vz);
  const timed = (dur: number, frames = 10) => Math.min(frames, Math.floor((since / dur) * frames)) / frames;
  const cycle = (hz: number, frames: number) => Math.floor((((t * hz) % 1) + 1) % 1 * frames) / frames;
  switch (b.act) {
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
  cam!: CourtCam;
  W = 0;
  H = 0;
  zoom = 2;
  private court: HTMLCanvasElement | null = null;
  private courtCam: CourtCam | null = null;
  private stands!: PixBuf;
  private standsCanvas = document.createElement('canvas');
  private sprites = new Map<string, Sprite>();
  private last = new Map<string, Sprite>();
  private budget = 0;
  private standsTick = -1;
  private looks = new Map<string, Look>();
  private hoopFront = new Map<number, HTMLCanvasElement>();
  private balls: HTMLCanvasElement[] = [];
  private focusCz = 0;
  /** the last shot meter, kept a moment after the release to show how it went */
  private meterShown: { idx: number; t0: number; top: number; green: number; until: number; frac: number; greened: boolean | null } | null = null;

  constructor(
    private theme: CourtTheme,
    private kits: [Kit, Kit]
  ) {}

  /** Fit the screen: a whole-number zoom so every game pixel is the same size. */
  resize(cssW: number, cssH: number) {
    const wide = cssW > cssH;
    const target = wide ? 440 : 210;
    this.zoom = Math.max(1, Math.round(cssW / target));
    const W = Math.ceil(cssW / this.zoom);
    const H = Math.ceil(cssH / this.zoom);
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.cam = courtCam(W, H, 30, 0);
    this.sprites.clear();
    this.hoopFront.clear();
    this.court = null;
    this.stands = new PixBuf(W, Math.max(1, wallOf(this.cam)));
    this.standsCanvas.width = W;
    this.standsCanvas.height = this.stands.h;
    this.standsTick = -1;
    this.balls = [];
  }

  /** The static court, drawn wide enough to pan across (upright, the camera follows the ball sideways). */
  private courtCanvas(): { canvas: HTMLCanvasElement; cam: CourtCam } {
    if (this.court && this.courtCam) return { canvas: this.court, cam: this.courtCam };
    const c = this.cam;
    const extra = c.mode === 'end' ? Math.ceil(8 * c.k) : 0;
    const wide: CourtCam = { ...c, W: c.W + extra * 2, origin: c.mode === 'end' ? Math.round((c.W + extra * 2) / 2) : c.origin };
    const buf = new PixBuf(wide.W, wide.H);
    // see-through above the floor: the stands are drawn underneath, every frame
    drawCourt(buf, wide, this.theme, 0, 0, false);
    drawHoopBack(buf, wide, this.theme);
    const canvas = document.createElement('canvas');
    canvas.width = wide.W;
    canvas.height = wide.H;
    buf.put(canvas.getContext('2d')!);
    this.court = canvas;
    this.courtCam = wide;
    return { canvas, cam: wide };
  }

  private ballSprite(frame: number, fire: boolean): HTMLCanvasElement {
    const key = frame + (fire ? 4 : 0);
    if (this.balls[key]) return this.balls[key];
    const r = Math.max(2.5, this.cam.k * 0.42);
    const n = Math.ceil(r * 2 + 3);
    const buf = new PixBuf(n, n);
    const c = n / 2;
    const base: [number, number, number] = fire ? [255, 120, 30] : [222, 104, 34];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const d = Math.hypot(dx, dy);
        if (d > r + 0.6) continue;
        if (d > r - 0.4) {
          buf.set(x, y, PixBuf.pack([60, 24, 10]));
          continue;
        }
        const light = (-dx - dy) / (r * 1.4);
        let col: [number, number, number] = light > 0.35 ? [248, 150, 70] : light < -0.35 ? [168, 66, 20] : base;
        // the seams turn as it spins
        const a = (frame * Math.PI) / 8;
        const sx = dx * Math.cos(a) - dy * Math.sin(a);
        const sy = dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.abs(sx) < 0.5 || Math.abs(sy) < 0.5) col = [70, 28, 12];
        buf.set(x, y, PixBuf.pack(col));
      }
    const cv = document.createElement('canvas');
    cv.width = n;
    cv.height = n;
    buf.put(cv.getContext('2d')!);
    this.balls[key] = cv;
    return cv;
  }

  private sprite(b: Body, t: number, carrying: boolean, kit: Kit): Sprite {
    const facing = facingOn(this.cam, Math.cos(b.face), Math.sin(b.face));
    // 16 directions
    const fb = Math.round((facing / (Math.PI * 2)) * 16);
    const px = Math.round((b.p.ht / 12) * this.cam.k);
    const { key, pose } = poseOf(b, t, carrying);
    const k = b.p.id + '|' + b.side + '|' + key + '|' + fb + '|' + px;
    const who = b.p.id + '|' + b.side;
    let s = this.sprites.get(k);
    if (!s) {
      // a few new drawings a frame (the man with the ball always gets his): the rest keep last frame's
      const last = this.last.get(who);
      if (this.budget <= 0 && last && !carrying) return last;
      this.budget--;
      let look = this.looks.get(who);
      if (!look) {
        look = lookFor(b, kit);
        this.looks.set(who, look);
      }
      s = drawBody(look, { ...pose, lift: 0 }, { facing: (fb / 16) * Math.PI * 2, pitch: this.cam.pitch }, px);
      if (this.sprites.size > 3000) this.sprites.clear();
      this.sprites.set(k, s);
    }
    this.last.set(who, s);
    return s;
  }

  /** The rim and net, drawn on the wide court's camera (blitted with the same pan offset as the court). */
  private rim(swish: number): HTMLCanvasElement {
    const q = Math.round(swish * 8);
    let cv = this.hoopFront.get(q);
    if (!cv) {
      const { cam } = this.courtCanvas();
      const buf = new PixBuf(cam.W, cam.H);
      drawHoopFront(buf, cam, q / 8);
      cv = document.createElement('canvas');
      cv.width = cam.W;
      cv.height = cam.H;
      buf.put(cv.getContext('2d')!);
      this.hoopFront.set(q, cv);
    }
    return cv;
  }

  /** One frame. `now` is the possession clock; `real` keeps the crowd and ticker moving between plays. */
  draw(ctx: CanvasRenderingContext2D, p: Possession, real: number, fx: Fx) {
    this.budget = 4;
    // the net's swish frames, all made up front (the first make would stall on them otherwise)
    if (!this.hoopFront.size) for (let q = 0; q <= 8; q++) this.rim(q / 8);
    const c = this.cam;
    ctx.imageSmoothingEnabled = false;
    // the camera: upright, it pans across with the ball
    if (c.mode === 'end') {
      const want = ballPos(p).cz;
      this.focusCz += (want - this.focusCz) * 0.08;
      const pan = Math.max(-7, Math.min(7, this.focusCz * 0.6));
      c.origin = Math.round(c.W / 2 - pan * c.k);
    }
    const sx = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake * 2) : 0;
    const sy = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake * 2) : 0;
    ctx.save();
    ctx.translate(sx, sy);
    // the stands, then the court (and the hoop standing in front of them)
    // the crowd moves at 20 frames a second: plenty for a bounce, a third of the work
    const tick = Math.floor(real * 20);
    if (tick !== this.standsTick) {
      this.standsTick = tick;
      drawStands(this.stands, c, this.theme, fx.crowd, real);
      this.stands.put(this.standsCanvas.getContext('2d')!);
    }
    ctx.fillStyle = '#0e121e';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.drawImage(this.standsCanvas, 0, 0);
    const court = this.courtCanvas();
    const panX = c.mode === 'end' ? Math.round(c.origin - court.cam.origin) : 0;
    ctx.drawImage(court.canvas, panX, 0);
    // shadows on the floor
    const t = p.t;
    const sp = Math.sin(c.pitch);
    for (const b of p.bodies) {
      const f = at(c, b.cx, b.cz);
      const shrink = 1 / (1 + b.h * 0.12);
      ctx.fillStyle = 'rgba(30,14,6,' + (0.42 * shrink).toFixed(2) + ')';
      const rx = Math.round(c.k * 1.05 * shrink);
      const ry = Math.max(1, Math.round(rx * sp));
      ctx.fillRect(Math.round(f.x - rx), Math.round(f.y - ry / 2), rx * 2, ry);
      ctx.fillRect(Math.round(f.x - rx + 1), Math.round(f.y - ry / 2) - 1, rx * 2 - 2, ry + 2);
    }
    // the ball's shadow
    const bp = ballPos(p);
    const bs = at(c, bp.cx, bp.cz);
    ctx.fillStyle = 'rgba(30,14,6,0.35)';
    ctx.fillRect(Math.round(bs.x - c.k * 0.35), Math.round(bs.y - 1), Math.round(c.k * 0.7), 2);
    // the players, far to near
    const order = [...p.bodies].sort((a, b) => nearness(c, a.cx, a.cz) - nearness(c, b.cx, b.cz));
    let handSpot: { x: number; y: number } | null = null;
    let headOf: Record<number, { x: number; y: number; right: number }> = {};
    for (const b of order) {
      const carrying = p.handler === b.idx;
      const s = this.sprite(b, t, carrying, this.kits[b.side === 'O' ? 0 : 1]);
      const f = at(c, b.cx, b.cz, b.h);
      const x = Math.round(f.x - s.ax);
      const y = Math.round(f.y - s.ay);
      ctx.drawImage(s.canvas, x, y);
      headOf[b.idx] = { x: Math.round(f.x), y: y + s.top, right: x + s.canvas.width };
      if (carrying) handSpot = { x: x + s.handR.x, y: y + s.handR.y };
    }
    void headOf;
    // the ball: in a flight, on the dribble, or in his hands
    const fire = p.fire >= 0 && (p.handler === p.fire || p.ball?.who === p.fire);
    const frame = Math.floor(real * 10) % 4;
    const ball = this.ballSprite(frame, fire);
    let ballXY: { x: number; y: number };
    if (p.ball) {
      const s = at(c, bp.cx, bp.cz, bp.h);
      ballXY = s;
    } else if (handSpot && p.handler !== null) {
      const h = p.bodies[p.handler];
      if (h.act === 'dribble' && !p.meter && !p.finish) {
        const speed = Math.hypot(h.vx, h.vz);
        const up = P.dribbleBall((t * (speed > 1.8 ? 1.5 + speed / 18 : 1.6)) % 1, speed > 1.8 ? 1 : 0);
        const floor = at(c, h.cx, h.cz).y;
        ballXY = { x: handSpot.x, y: floor + (handSpot.y + 2 - floor) * up };
      } else ballXY = { x: handSpot.x, y: handSpot.y - 1 };
    } else ballXY = at(c, bp.cx, bp.cz, bp.h);
    ctx.drawImage(ball, Math.round(ballXY.x - ball.width / 2), Math.round(ballXY.y - ball.height / 2));
    if (fire) {
      // flames trailing the ball
      for (let i = 0; i < 6; i++) {
        const a = real * 9 + i * 1.7;
        ctx.fillStyle = i % 2 ? '#ffd23a' : '#ff6a1a';
        ctx.fillRect(Math.round(ballXY.x + Math.sin(a) * 3), Math.round(ballXY.y - 3 - ((real * 30 + i * 3) % 7)), 1, 2);
      }
    }
    // the rim and net in front of the ball
    ctx.drawImage(this.rim(fx.swish), panX, 0);
    // the shot meter and the contest on the shooter
    this.drawMeter(ctx, p, real, headOf);
    // the pass target: a marker over the man the stick points at
    if (p.target !== null && p.handler !== null && !p.meter && !p.finish) {
      const h = headOf[p.target];
      if (h) {
        ctx.fillStyle = '#19e3c9';
        const ty = h.y - 6;
        ctx.fillRect(h.x - 2, ty, 5, 1);
        ctx.fillRect(h.x - 1, ty + 1, 3, 1);
        ctx.fillRect(h.x, ty + 2, 1, 1);
      }
    }
    // the handler's name over his head (the contest grade takes its place while he shoots)
    if (p.handler !== null && !p.ball && !p.meter) {
      const b = p.bodies[p.handler];
      const h = headOf[b.idx];
      if (h) label(ctx, b.p.tag, h.x, h.y - 10, p.fire === b.idx ? '#ffb02e' : '#ffffff');
    }
    ctx.restore();
    if (fx.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, fx.flash).toFixed(2) + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    void textWidth;
    void RIM;
  }

  private drawMeter(ctx: CanvasRenderingContext2D, p: Possession, real: number, heads: Record<number, { x: number; y: number; right: number }>) {
    const m = p.meter;
    if (m && p.handler !== null) {
      const span = m.top * 1.3;
      const frac = Math.min(1, (p.t - m.t0) / span);
      this.meterShown = { idx: p.handler, t0: m.t0, top: m.top, green: m.green, until: Infinity, frac, greened: m.off !== undefined ? !!m.greened : null };
    } else if (this.meterShown && this.meterShown.until === Infinity) {
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
    // a 2K-style meter beside him: a tall bar that fills as he rises, the green window near the top
    const hgt = Math.max(26, Math.round(this.cam.k * 4.6));
    const w = 6;
    const x = Math.min(this.W - w - 3, head.right + 2);
    const y = Math.max(3, head.y - 4);
    const span = ms.top * 1.3;
    // the frame: a dark case with a light rim
    ctx.fillStyle = '#05070d';
    ctx.fillRect(x - 2, y - 2, w + 4, hgt + 4);
    ctx.fillStyle = '#e8ecf5';
    ctx.fillRect(x - 1, y - 1, w + 2, hgt + 2);
    ctx.fillStyle = '#1a2235';
    ctx.fillRect(x, y, w, hgt);
    // the green window, around the top of the jump
    const gy = y + hgt - Math.round((ms.top / span) * hgt);
    const gh = Math.max(1, Math.round(((ms.green * 2) / span) * hgt));
    ctx.fillStyle = '#1f9e4c';
    ctx.fillRect(x, gy - Math.floor(gh / 2), w, gh);
    ctx.fillStyle = '#3ef07a';
    ctx.fillRect(x - 2, gy - Math.floor(gh / 2), 1, gh);
    ctx.fillRect(x + w + 1, gy - Math.floor(gh / 2), 1, gh);
    // the fill: warm while rising, then green, white (close) or red (off)
    const fh = Math.round(ms.frac * hgt);
    const off = p.lastShot && ms.greened !== null ? Math.abs(p.lastShot.off) : 1;
    ctx.fillStyle = ms.greened === null ? '#ffd35a' : ms.greened ? '#3ef07a' : off < 0.32 ? '#f4f4f4' : '#ff5a5a';
    ctx.fillRect(x + 1, y + hgt - fh, w - 2, fh);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + 1, y + hgt - fh, w - 2, 1);
    // the contest grade over his head while he rises
    if (p.meter && p.handler === ms.idx) {
      const grade = contestOf(p, p.bodies[ms.idx]);
      label(ctx, CONTEST_TEXT[grade], head.x, head.y - 10, CONTEST_COLOR[grade]);
    }
  }
}

/** A small pixel label with a dark backing, centered at x. */
function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string) {
  const w = s.length * 4 + 1;
  ctx.fillStyle = 'rgba(8,10,18,0.78)';
  ctx.fillRect(Math.round(x - w / 2) - 1, y - 1, w + 2, 7);
  tiny(ctx, s, Math.round(x - w / 2) + 1, y, color);
}

// a 3x5 font for labels
const F35: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', "'": '010010000000000', '!': '010010010000010',
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
