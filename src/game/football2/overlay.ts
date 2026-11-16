// What the football field shows on the turf and in the air besides the players (Claude, studio
// overhaul nfl-3; Game Design V2 §B.2.3, §B.2.7, §C.1.3): the ground rings (gold under the man you
// control, teal under your pass target, a red arc on the side the rush comes from), the run lane
// before the snap and through the mesh, the ball (never under 4×3 px, with a shadow ring on the
// turf and a short trail), the incompletion's bounce, and the line to gain flashing on a conversion.
//
// Render-only: these read the play and the clock and never write to the play, so seeded results
// are the same with them drawn or not (overlay.test.ts). The colours are the V2 ring palette: gold,
// teal and red mean only these things on the field.
import type { Body, Play, Pt } from './types';

export const RING = { you: '#f6b93b', target: '#4fe3c1', pressure: '#ff5d5d' } as const;

/** What drawing on the turf needs from a camera: a field point on screen (and px a yard there), and the look-down angle. */
export interface Lens {
  at(x: number, y: number, h?: number): { x: number; y: number; s: number };
  pitch(y: number): number;
}

/** The ball's drawn size at `s` px a yard: never under 4×3 px (V2 §C.1.2). */
export function ballBox(s: number): { w: number; h: number } {
  const w = Math.max(4, Math.round(s * 0.34));
  return { w, h: Math.max(3, Math.round(w * 0.62)) };
}

/** An ellipse lying on the turf around (x, y), `r` yards across its half-width. */
function ellipseOn(ctx: CanvasRenderingContext2D, L: Lens, x: number, y: number, r: number) {
  const f = L.at(x, y);
  const rx = Math.max(5, r * f.s);
  const ry = Math.max(2, rx * Math.sin(L.pitch(y)) * 0.9);
  ctx.beginPath();
  ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, ry, 0, 0, Math.PI * 2);
  return { f, rx, ry };
}

/**
 * A 2 px ground ring (V2 §C.1.3) with a dark keyline under it so it reads on any grass, drawn
 * under the sprites. `r` is in yards (the drawing scales with the camera and the art scale).
 */
export function groundRing(ctx: CanvasRenderingContext2D, L: Lens, at: Pt, r: number, color: string, alpha = 1) {
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  const { f } = ellipseOn(ctx, L, at.x, at.y, r);
  const lw = Math.max(2, Math.round(f.s * 0.12));
  ctx.strokeStyle = 'rgba(6,12,10,0.55)';
  ctx.lineWidth = lw + 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.globalAlpha = a0;
}

/**
 * Where the rush is coming from: the bearing (radians, field axes) from the quarterback to the
 * nearest rusher who's free or close, and how close (0-1), or null when nobody's on him.
 */
export function rushFrom(p: Play): { angle: number; heat: number } | null {
  const qb = p.qb;
  if (p.phase !== 'drop' || p.carrier !== qb || p.call !== 'pass') return null;
  let best: Body | null = null;
  let bd = 99;
  for (const b of p.bodies) {
    if (b.side !== 'D') continue;
    const d = Math.hypot(b.x - qb.x, b.y - qb.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  if (!best || bd > 5.5) return null;
  const heat = Math.max(p.pressure, Math.min(1, (5.5 - bd) / 4));
  if (heat < 0.15) return null;
  return { angle: Math.atan2(best.y - qb.y, best.x - qb.x), heat };
}

/** The red pressure arc on the rush's side of the quarterback (V2 §B.2.4). */
export function pressureArc(ctx: CanvasRenderingContext2D, L: Lens, p: Play) {
  const r = rushFrom(p);
  if (!r) return;
  const qb = p.qb;
  const R = 1.25;
  // the arc on the turf, 110° wide, facing the rusher
  const span = 0.96;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = r.angle - span + (i / 12) * span * 2;
    const q = L.at(qb.x + Math.cos(a) * R, qb.y + Math.sin(a) * R);
    pts.push(q);
  }
  const s = L.at(qb.x, qb.y).s;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * (0.45 + 0.55 * r.heat);
  ctx.lineCap = 'round';
  for (const [color, w] of [
    ['rgba(40,6,6,0.6)', Math.max(4, s * 0.22) + 2],
    [RING.pressure, Math.max(3, s * 0.22)]
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
  }
  ctx.globalAlpha = a0;
}

/** The run's path for a run call: from the back, through the hole, a few yards past the line. */
export function lanePath(p: Play): Pt[] {
  const rb = p.rb;
  const dir = p.direction ?? 1;
  const { hole, los } = p;
  if (p.run === 'outside') return [{ x: rb.x, y: rb.y }, { x: hole - 0.8 * dir, y: los - 0.6 }, { x: hole + 0.4 * dir, y: los + 3 }, { x: hole + 0.6 * dir, y: los + 7 }];
  if (p.run === 'power') return [{ x: rb.x, y: rb.y }, { x: hole - 0.9 * dir, y: los - 1.2 }, { x: hole, y: los + 2.5 }, { x: hole, y: los + 7 }];
  return [{ x: rb.x, y: rb.y }, { x: hole, y: los - 1.2 }, { x: hole, y: los + 2.5 }, { x: hole, y: los + 8 }];
}

/** Whether the lane shows: a run call before the snap and through the mesh (until the back is past the line). */
export function laneShown(p: Play): boolean {
  if (p.call !== 'run' || p.end) return false;
  if (p.phase === 'pre') return true;
  // through the mesh: the quarterback still has it on his drop, or the back has it short of the line
  const mesh = p.carrier === p.rb || (p.carrier === p.qb && p.phase === 'drop');
  return (p.phase === 'drop' || p.phase === 'run') && mesh && p.rb.y < p.los + 0.5 && p.t < 1.6;
}

/** The faint lane arrow on the turf (V2 §B.2.4 "runs need tails": the crease you're blocked for). */
export function laneArrow(ctx: CanvasRenderingContext2D, L: Lens, p: Play, alpha = 1) {
  if (!laneShown(p)) return;
  const pts = lanePath(p);
  // fade out as the back reaches the line
  const fade = p.phase === 'pre' ? 1 : Math.max(0, Math.min(1, (p.los + 0.5 - p.rb.y) / 3));
  const scr = pts.map((q) => L.at(q.x, q.y));
  // (sized by the turf at the line, capped: the back can stand right under the camera)
  const w = Math.max(6, Math.min(26, L.at(p.hole, p.los).s * 0.9));
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha * fade;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // a soft wide band, then a brighter core
  for (const [color, width] of [
    ['rgba(242,247,250,0.16)', w],
    ['rgba(242,247,250,0.38)', Math.max(2, w * 0.28)]
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    scr.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
  }
  // the arrowhead, sized by the turf where it ends
  const a = scr[scr.length - 2];
  const e = scr[scr.length - 1];
  const ang = Math.atan2(e.y - a.y, e.x - a.x);
  const hl = Math.max(9, Math.min(30, e.s * 1.1));
  ctx.fillStyle = 'rgba(242,247,250,0.5)';
  ctx.beginPath();
  ctx.moveTo(e.x + Math.cos(ang) * hl * 0.7, e.y + Math.sin(ang) * hl * 0.7);
  ctx.lineTo(e.x + Math.cos(ang + 2.4) * hl * 0.6, e.y + Math.sin(ang + 2.4) * hl * 0.6);
  ctx.lineTo(e.x + Math.cos(ang - 2.4) * hl * 0.6, e.y + Math.sin(ang - 2.4) * hl * 0.6);
  ctx.fill();
  ctx.globalAlpha = a0;
}

/** The ball in flight at play time `t` (its spot and height), the engine's own path. */
export function ballAt(p: Play, t: number): (Pt & { h: number }) | null {
  const b = p.ball;
  if (!b) return null;
  const k = Math.max(0, Math.min(1, (t - b.t0) / (b.t1 - b.t0)));
  return { x: b.from.x + (b.to.x - b.from.x) * k, y: b.from.y + (b.to.y - b.from.y) * k, h: 1.8 + 4 * b.peak * k * (1 - k) };
}

/** The ball itself: dark seam outline, brown leather, white laces; it turns over in flight. */
export function football(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, alpha = 1) {
  const X = Math.round(x);
  const Y = Math.round(y);
  const { w, h } = ballBox(s);
  const turn = Math.floor(t * 12) % 2;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  ctx.fillStyle = '#2e1606';
  ctx.fillRect(X - Math.ceil(w / 2), Y - Math.ceil(h / 2), w, h);
  ctx.fillStyle = '#8b4a1f';
  ctx.fillRect(X - Math.ceil(w / 2) + 1, Y - Math.ceil(h / 2), Math.max(1, w - 2), Math.max(1, h - 1));
  ctx.fillStyle = '#b8743a';
  ctx.fillRect(X - Math.ceil(w / 2) + 1, Y - Math.ceil(h / 2), Math.max(1, w - 3), 1);
  ctx.fillStyle = turn ? '#f4f4f4' : '#d6d6d6';
  ctx.fillRect(X - Math.floor(w / 4), Y - Math.ceil(h / 2), Math.max(1, Math.floor(w / 2)), 1);
  ctx.globalAlpha = a0;
}

/** The ball's shadow on the turf: a dark ring that tightens as the ball comes down (height you can read). */
export function ballShadow(ctx: CanvasRenderingContext2D, L: Lens, at: Pt, h: number, alpha = 1) {
  const g = L.at(at.x, at.y);
  const up = Math.min(1, Math.max(0, (h - 0.2) / 6));
  const rx = Math.max(3, g.s * (0.22 + 0.22 * up));
  const ry = Math.max(1.5, rx * Math.sin(L.pitch(at.y)) * 0.9);
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  ctx.fillStyle = 'rgba(6,20,8,' + (0.42 - 0.18 * up).toFixed(2) + ')';
  ctx.beginPath();
  ctx.ellipse(Math.round(g.x), Math.round(g.y), rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(6,20,8,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = a0;
}

/** The ball in the air: its shadow ring on the turf, a three-dot trail behind it, the ball. */
export function airBall(ctx: CanvasRenderingContext2D, L: Lens, p: Play, art: number, reduced: boolean) {
  const now = ballAt(p, p.t);
  if (!now) return;
  ballShadow(ctx, L, now, now.h);
  if (!reduced) {
    for (let i = 3; i >= 1; i--) {
      const q = ballAt(p, p.t - i * 0.045);
      if (!q || p.t - i * 0.045 < p.ball!.t0) continue;
      const a = L.at(q.x, q.y, q.h);
      const d = Math.max(2, Math.round(a.s * art * 0.14));
      ctx.fillStyle = 'rgba(255,240,214,' + (0.5 - i * 0.13).toFixed(2) + ')';
      ctx.fillRect(Math.round(a.x - d / 2), Math.round(a.y - d / 2), d, d);
    }
  }
  const a = L.at(now.x, now.y, now.h);
  football(ctx, a.x, a.y, a.s * art, p.t);
}

/**
 * The incompletion: the ball comes down where it was going, bounces twice and rolls over 0.6 s of
 * real time (V2 §B.2.6); under reduced motion it fades out where it landed.
 */
export class Bounce {
  private from: Pt | null = null;
  private dir: Pt = { x: 0, y: 1 };
  private at = 0;
  private seen: Play | null = null;
  static readonly SECS = 0.6;

  /** Watch the play: the frame a pass falls incomplete, the bounce starts. `now` is real seconds. */
  watch(p: Play, now: number, lastBall: { from: Pt; to: Pt } | null) {
    if (p === this.seen) return;
    if (p.end?.kind === 'incomplete' && lastBall) {
      this.seen = p;
      this.from = { x: p.end.x, y: p.end.y };
      const dx = lastBall.to.x - lastBall.from.x;
      const dy = lastBall.to.y - lastBall.from.y;
      const n = Math.hypot(dx, dy) || 1;
      this.dir = { x: dx / n, y: dy / n };
      this.at = now;
    } else if (!p.end && this.seen) {
      this.seen = null;
      this.from = null;
    }
  }

  /** Where the ball is (field point and height) and how visible, `k` into the bounce; null when it's over. */
  pose(now: number, reduced: boolean): { x: number; y: number; h: number; alpha: number; spin: number } | null {
    if (!this.from) return null;
    const k = (now - this.at) / Bounce.SECS;
    if (k < 0 || k > 1.6) return null;
    if (reduced) return k > 1 ? null : { ...this.from, h: 0.15, alpha: 1 - k, spin: 0 };
    // two hops (the second lower) then a short roll, carried on along the throw
    const travel = 2.6 * (1 - Math.pow(1 - Math.min(1, k), 2));
    const hop = k < 0.45 ? Math.sin((k / 0.45) * Math.PI) * 0.9 : k < 0.75 ? Math.sin(((k - 0.45) / 0.3) * Math.PI) * 0.35 : 0;
    const alpha = k <= 1 ? 1 : Math.max(0, 1 - (k - 1) / 0.6);
    return { x: this.from.x + this.dir.x * travel, y: this.from.y + this.dir.y * travel, h: 0.15 + hop, alpha, spin: k };
  }

  draw(ctx: CanvasRenderingContext2D, L: Lens, now: number, art: number, reduced: boolean) {
    const q = this.pose(now, reduced);
    if (!q) return;
    ballShadow(ctx, L, q, q.h, q.alpha);
    const a = L.at(q.x, q.y, q.h);
    football(ctx, a.x, a.y, a.s * art, q.spin * 3, q.alpha);
  }
}

/** The line to gain, flashing when a play reaches it (V2 §B.2.7); a steady highlight under reduced motion. */
export class LineFlash {
  private y: number | null = null;
  private at = 0;
  static readonly SECS = 0.9;

  flash(y: number, now: number) {
    this.y = y;
    this.at = now;
  }

  /** How bright the flash is at `now` (0 when it's over). */
  level(now: number, reduced: boolean): number {
    if (this.y === null) return 0;
    const k = (now - this.at) / LineFlash.SECS;
    if (k < 0 || k > 1) return 0;
    if (reduced) return 0.75;
    return (0.55 + 0.45 * Math.cos(k * Math.PI * 6)) * (1 - k * 0.5);
  }

  draw(ctx: CanvasRenderingContext2D, L: Lens, width: number, now: number, reduced: boolean) {
    const lv = this.level(now, reduced);
    if (!lv || this.y === null) return;
    const a = L.at(0, this.y);
    const b = L.at(width, this.y);
    const a0 = ctx.globalAlpha;
    ctx.lineCap = 'butt';
    for (const [color, w, al] of [
      ['#ffd23a', Math.max(6, a.s * 0.7), 0.35 * lv],
      ['#fff3c4', Math.max(2, a.s * 0.2), lv]
    ] as const) {
      ctx.globalAlpha = a0 * al;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(Math.round(a.x), Math.round(a.y) + 0.5);
      ctx.lineTo(Math.round(b.x), Math.round(b.y) + 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = a0;
  }
}
