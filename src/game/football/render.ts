// Drawing arcade football: the field, the players, the ball, the routes before the snap and the
// aim while the quarterback holds it. The camera looks down the field from behind your offense.
import { footballSprite } from '../sprites';
import { type Body, FIELD_W, maxThrow, type Play, type Pt } from './play';

export interface Camera {
  x: number;
  y: number;
  /** pixels per yard */
  z: number;
  w: number;
  h: number;
}

export function toScreen(c: Camera, p: Pt): Pt {
  return { x: (p.x - c.x) * c.z + c.w / 2, y: c.h * 0.56 - (p.y - c.y) * c.z };
}

export function toWorld(c: Camera, s: Pt): Pt {
  return { x: (s.x - c.w / 2) / c.z + c.x, y: c.y - (s.y - c.h * 0.56) / c.z };
}

/** Where the camera wants to be: ahead of the ball, and across the field so it never shows past the sideline stands. */
export function cameraTarget(p: Play, c: Camera): Pt {
  const ball = p.ball ? ballPos(p) : p.carrier ?? p.qb;
  const ahead = p.phase === 'pre' ? 9 : p.phase === 'run' ? 5 : 8;
  const half = c.w / 2 / c.z;
  const x = Math.max(-4 + half, Math.min(FIELD_W + 4 - half, ball.x));
  return { x, y: Math.min(103, ball.y + ahead) };
}

export function ballPos(p: Play): Pt & { z: number } {
  const b = p.ball!;
  const k = Math.max(0, Math.min(1, (p.t - b.t0) / (b.t1 - b.t0)));
  return { x: b.from.x + (b.to.x - b.from.x) * k, y: b.from.y + (b.to.y - b.from.y) * k, z: 4 * b.peak * k * (1 - k) };
}

export interface Look {
  /** your team's color for your end zone, the rival's for theirs */
  ourColor: string;
  rivalColor: string;
  rivalTrim: string;
  rivalAbbr: string;
  /** the line to gain */
  toGain: number;
}

const GRASS_A = '#3d8c3a';
const GRASS_B = '#459843';

function field(ctx: CanvasRenderingContext2D, c: Camera, look: Look, los: number) {
  const { w, h, z } = c;
  const top = toWorld(c, { x: 0, y: 0 }).y;
  const bottom = toWorld(c, { x: 0, y: h }).y;
  // the stands and the sidelines
  ctx.fillStyle = '#20512a';
  ctx.fillRect(0, 0, w, h);
  const l = toScreen(c, { x: 0, y: 0 }).x;
  const r = toScreen(c, { x: FIELD_W, y: 0 }).x;
  // mowed stripes, five yards each
  for (let y = Math.floor(bottom / 5) * 5; y < top + 5; y += 5) {
    const a = toScreen(c, { x: 0, y: y + 5 }).y;
    const b = toScreen(c, { x: 0, y }).y;
    ctx.fillStyle = Math.floor(y / 5) % 2 === 0 ? GRASS_A : GRASS_B;
    ctx.fillRect(l, a, r - l, b - a + 1);
  }
  // the end zones
  const ez = (from: number, to: number, color: string, text: string, trim: string) => {
    const a = toScreen(c, { x: 0, y: to }).y;
    const b = toScreen(c, { x: 0, y: from }).y;
    if (b < 0 || a > h) return;
    ctx.fillStyle = color;
    ctx.fillRect(l, a, r - l, b - a);
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = z * 0.4;
    for (let x = -20; x < FIELD_W + 20; x += 3) {
      const p0 = toScreen(c, { x, y: from });
      const p1 = toScreen(c, { x: x + 10, y: to });
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = trim;
    ctx.globalAlpha = 0.9;
    ctx.font = "italic 900 " + Math.round(z * 6.5) + "px 'Archivo', 'Arial Narrow', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, (l + r) / 2, (a + b) / 2);
    ctx.globalAlpha = 1;
  };
  ez(100, 110, look.rivalColor, look.rivalAbbr, look.rivalTrim);
  ez(-10, 0, look.ourColor, 'HOME', '#ffffff');
  // the goal posts
  const gp = toScreen(c, { x: FIELD_W / 2, y: 110 });
  if (gp.y > -40) {
    ctx.strokeStyle = '#f2d23a';
    ctx.lineWidth = Math.max(2, z * 0.25);
    ctx.beginPath();
    ctx.moveTo(gp.x - z * 3, gp.y - z * 4);
    ctx.lineTo(gp.x - z * 3, gp.y);
    ctx.lineTo(gp.x + z * 3, gp.y);
    ctx.lineTo(gp.x + z * 3, gp.y - z * 4);
    ctx.moveTo(gp.x, gp.y);
    ctx.lineTo(gp.x, gp.y + z * 1.2);
    ctx.stroke();
  }
  // yard lines, hashes, numbers
  ctx.strokeStyle = 'rgba(255,255,255,0.82)';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let y = 0; y <= 100; y += 1) {
    const s = toScreen(c, { x: 0, y });
    if (s.y < -20 || s.y > h + 20) continue;
    if (y % 5 === 0) {
      ctx.lineWidth = Math.max(1.5, z * (y % 50 === 0 || y === 0 || y === 100 ? 0.28 : 0.16));
      ctx.beginPath();
      ctx.moveTo(l, s.y);
      ctx.lineTo(r, s.y);
      ctx.stroke();
    } else {
      ctx.lineWidth = Math.max(1, z * 0.1);
      for (const hx of [0.6, 23.58, 29.75, FIELD_W - 0.6]) {
        const p = toScreen(c, { x: hx, y });
        ctx.beginPath();
        ctx.moveTo(p.x - z * 0.4, p.y);
        ctx.lineTo(p.x + z * 0.4, p.y);
        ctx.stroke();
      }
    }
    if (y % 10 === 0 && y > 0 && y < 100) {
      const n = String(y <= 50 ? y : 100 - y);
      ctx.font = '800 ' + Math.round(z * 2.1) + "px 'Archivo', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const nx of [9, FIELD_W - 9]) {
        const p = toScreen(c, { x: nx, y: y - 0.1 });
        ctx.fillText(n, p.x, p.y);
      }
    }
  }
  // sideline borders
  ctx.fillStyle = '#f4f7f6';
  ctx.fillRect(l - z * 0.5, 0, z * 0.5, h);
  ctx.fillRect(r, 0, z * 0.5, h);
  // the line of scrimmage, the line to gain
  const lineAt = (y: number, color: string) => {
    const s = toScreen(c, { x: 0, y });
    ctx.fillStyle = color;
    ctx.fillRect(l, s.y - Math.max(1.5, z * 0.13), r - l, Math.max(3, z * 0.26));
  };
  lineAt(los, 'rgba(60,140,255,0.85)');
  if (look.toGain < 100) lineAt(look.toGain, 'rgba(255,220,40,0.9)');
}

function routeLines(ctx: CanvasRenderingContext2D, c: Camera, p: Play) {
  ctx.save();
  ctx.setLineDash([c.z * 0.5, c.z * 0.45]);
  ctx.lineWidth = Math.max(2, c.z * 0.22);
  ctx.lineCap = 'round';
  for (const b of p.bodies) {
    if (b.side !== 'O' || !b.route.length || b.a.role === 'OL') continue;
    ctx.strokeStyle = b === p.rb ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    const s = toScreen(c, b);
    ctx.moveTo(s.x, s.y);
    const pts = b.route.slice(0, 3);
    for (const w of pts) {
      const q = toScreen(c, w);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    // the arrow head
    const last = toScreen(c, pts[pts.length - 1]);
    const prev = pts.length > 1 ? toScreen(c, pts[pts.length - 2]) : s;
    const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(last.x - Math.cos(ang - 0.5) * c.z * 1.1, last.y - Math.sin(ang - 0.5) * c.z * 1.1);
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(last.x - Math.cos(ang + 0.5) * c.z * 1.1, last.y - Math.sin(ang + 0.5) * c.z * 1.1);
    ctx.stroke();
    ctx.setLineDash([c.z * 0.5, c.z * 0.45]);
  }
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, size: number) {
  ctx.font = '900 ' + size + "px 'Archivo', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const w = ctx.measureText(text).width + size * 0.7;
  ctx.fillStyle = 'rgba(4,18,26,0.78)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - size * 1.35, w, size * 1.3, size * 0.35);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x, y - size * 0.22);
}

export interface Overlay {
  /** where the passer is aiming, while the player holds */
  aim: Pt | null;
  showRoutes: boolean;
  /** names over the receivers before the snap */
  tags: boolean;
}

export function draw(ctx: CanvasRenderingContext2D, c: Camera, p: Play, look: Look, o: Overlay) {
  field(ctx, c, look, p.los);
  if (o.showRoutes) routeLines(ctx, c, p);
  const px = Math.max(1.4, c.z * 0.15);
  // shadows first, then the players back to front
  const order = p.bodies.slice().sort((a, b) => b.y - a.y);
  // shadows tinted by side: everyone on your team wears his own team's colors, so the ring under
  // his feet says which side he's on
  for (const b of order) {
    const s = toScreen(c, b);
    ctx.fillStyle = b.side === 'O' ? 'rgba(25,227,201,0.42)' : 'rgba(255,90,90,0.34)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, px * 5.5, px * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.imageSmoothingEnabled = false;
  for (const b of order) {
    const s = toScreen(c, b);
    const moving = Math.hypot(b.vx, b.vy) > 0.6;
    const frame = moving ? Math.floor(b.stride) : 0;
    const sprite = footballSprite(b.a.look, b.side === 'O', frame);
    const down = p.t < b.stunUntil;
    const w = sprite.width * px;
    const h = sprite.height * px;
    if (down) {
      // on the ground: lying across
      ctx.save();
      ctx.translate(s.x, s.y - px * 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(sprite, -h / 2, -w / 2, h, w);
      ctx.restore();
    } else ctx.drawImage(sprite, Math.round(s.x - w / 2), Math.round(s.y - h + px), Math.round(w), Math.round(h));
    // the ball in his hands
    if (b === p.carrier && p.phase !== 'pre') drawBall(ctx, s.x + px * 3, s.y - h * 0.45, px, 0);
  }
  // the ball in the air, its shadow on the grass
  if (p.ball) {
    const bp = ballPos(p);
    const g = toScreen(c, bp);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, px * 2.4, px * 1, 0, 0, Math.PI * 2);
    ctx.fill();
    const ang = Math.atan2(-(p.ball.to.y - p.ball.from.y), p.ball.to.x - p.ball.from.x);
    drawBall(ctx, g.x, g.y - bp.z * c.z * 0.9 - px * 6, px * 1.25, ang);
  }
  // names: the man with the ball, or everyone's before the snap
  const fs = Math.max(10, Math.round(c.z * 0.95));
  for (const b of p.bodies) {
    if (b.side !== 'O' || b.a.role === 'OL') continue;
    const show = (o.tags && b !== p.qb) || (b === p.carrier && p.phase === 'run') || (p.ball && b.job === 'track');
    if (!show) continue;
    const s = toScreen(c, b);
    label(ctx, s.x, s.y - 17 * px, b.a.tag, b === p.carrier ? '#ffe29a' : '#ffffff', fs);
  }
  // the aim: a dotted line from the passer to a ring, the ring red past his range
  if (o.aim && p.phase === 'drop' && p.carrier === p.qb) {
    const from = toScreen(c, p.qb);
    const reach = maxThrow(p);
    const d = Math.hypot(o.aim.x - p.qb.x, o.aim.y - p.qb.y);
    const k = Math.min(1, reach / Math.max(d, 1e-6));
    const to = toScreen(c, { x: p.qb.x + (o.aim.x - p.qb.x) * k, y: p.qb.y + (o.aim.y - p.qb.y) * k });
    const color = d > reach ? 'rgba(255,107,107,0.95)' : 'rgba(255,226,154,0.95)';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, c.z * 0.18);
    ctx.setLineDash([c.z * 0.6, c.z * 0.5]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y - px * 10);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - c.z * Math.min(6, d * 0.12) };
    ctx.quadraticCurveTo(mid.x, mid.y, to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(2.5, c.z * 0.22);
    ctx.beginPath();
    ctx.arc(to.x, to.y, c.z * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(to.x, to.y, c.z * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, px: number, ang: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = '#7a3e1d';
  ctx.strokeStyle = '#2a1408';
  ctx.lineWidth = Math.max(1, px * 0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, px * 2.2, px * 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2efe8';
  ctx.fillRect(-px * 0.8, -px * 0.2, px * 1.6, px * 0.4);
  ctx.restore();
}

/** Has this body got the ball (for the run's controls)? */
export function isOurs(b: Body | null) {
  return !!b && b.side === 'O';
}
