// Drawing arcade basketball: a half court seen from behind your offense, the basket at the top.
// The floor is squashed a little for depth; a player's height off the floor lifts his sprite.
import { hoopSprite } from '../sprites';
import { APEX, type Body, ballNow, type Poss, type Pt, RIM } from './play';

export interface View {
  /** pixels per foot across */
  z: number;
  /** the screen's center x, and where the baseline is */
  cx: number;
  top: number;
  w: number;
  h: number;
}

const SQUASH = 0.82;

export function viewFor(w: number, h: number, top: number): View {
  const z = Math.min(w / 53, (h - top - 200) / (47 * SQUASH));
  return { z, cx: w / 2, top, w, h };
}

export function scr(v: View, p: Pt, up = 0): Pt {
  return { x: v.cx + p.x * v.z, y: v.top + p.y * v.z * SQUASH - up * v.z * 0.92 };
}

export interface CourtLook {
  paint: string;
  trim: string;
  abbr: string;
}

function court(ctx: CanvasRenderingContext2D, v: View, look: CourtLook) {
  const { z } = v;
  ctx.fillStyle = '#0d1c22';
  ctx.fillRect(0, 0, v.w, v.h);
  // the floor and its planks
  const a = scr(v, { x: -25, y: 0 });
  const b = scr(v, { x: 25, y: 47 });
  const floor = ctx.createLinearGradient(0, a.y, 0, b.y);
  floor.addColorStop(0, '#b97a43');
  floor.addColorStop(1, '#d09056');
  ctx.fillStyle = floor;
  ctx.fillRect(a.x - z * 2, a.y - z * 3, b.x - a.x + z * 4, b.y - a.y + z * 6);
  ctx.strokeStyle = 'rgba(80,40,10,0.18)';
  ctx.lineWidth = 1;
  for (let x = -27; x <= 27; x += 1.5) {
    const p = scr(v, { x, y: 0 });
    ctx.beginPath();
    ctx.moveTo(p.x, a.y - z * 3);
    ctx.lineTo(p.x, b.y + z * 3);
    ctx.stroke();
  }
  // the paint, in the home team's color
  const k0 = scr(v, { x: -8, y: 0 });
  const k1 = scr(v, { x: 8, y: 19 });
  ctx.fillStyle = look.paint;
  ctx.globalAlpha = 0.82;
  ctx.fillRect(k0.x, k0.y, k1.x - k0.x, k1.y - k0.y);
  ctx.globalAlpha = 1;
  // lines
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1.5, z * 0.22);
  ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.strokeRect(k0.x, k0.y, k1.x - k0.x, k1.y - k0.y);
  const ell = (c: Pt, rx: number, ry: number, from: number, to: number) => {
    const s = scr(v, c);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, rx * z, ry * z * SQUASH, 0, from, to);
    ctx.stroke();
  };
  ell({ x: 0, y: 19 }, 6, 6, 0, Math.PI * 2);
  ell(RIM, 4, 4, 0, Math.PI);
  // the three-point line: the corners, then the arc
  const ang = Math.acos(22 / 23.75);
  const c0 = scr(v, { x: -22, y: 0 });
  const c1 = scr(v, { x: -22, y: RIM.y + Math.sin(ang) * 23.75 });
  ctx.beginPath();
  ctx.moveTo(c0.x, c0.y);
  ctx.lineTo(c1.x, c1.y);
  ctx.moveTo(scr(v, { x: 22, y: 0 }).x, c0.y);
  ctx.lineTo(scr(v, { x: 22, y: 0 }).x, c1.y);
  ctx.stroke();
  ell(RIM, 23.75, 23.75, ang, Math.PI - ang);
  // half court and the center circle, with the logo
  const hc = scr(v, { x: 0, y: 47 });
  ctx.fillStyle = look.paint;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(hc.x, hc.y, 6 * z, 6 * z * SQUASH, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ell({ x: 0, y: 47 }, 6, 6, Math.PI, Math.PI * 2);
  ctx.fillStyle = look.trim;
  ctx.font = "italic 900 " + Math.round(z * 3.2) + "px 'Archivo', 'Arial Narrow', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(look.abbr, hc.x, hc.y - z * 0.8);
}

/** The basket: stanchion, backboard, rim and net. `front` draws only the front of the rim and the net. */
function basket(ctx: CanvasRenderingContext2D, v: View, front: boolean, swish: number) {
  const { z } = v;
  const rim = scr(v, RIM, 10);
  if (!front) {
    // the stanchion behind the baseline, the backboard
    const post = scr(v, { x: 0, y: -4 });
    ctx.fillStyle = '#2a3238';
    ctx.fillRect(post.x - z * 0.5, scr(v, { x: 0, y: -4 }, 12).y, z, post.y - scr(v, { x: 0, y: -4 }, 12).y);
    const bb0 = scr(v, { x: -3, y: 4 }, 13.5);
    const bb1 = scr(v, { x: 3, y: 4 }, 10);
    ctx.fillStyle = 'rgba(240,248,255,0.92)';
    ctx.strokeStyle = '#1b2329';
    ctx.lineWidth = Math.max(1.5, z * 0.2);
    ctx.fillRect(bb0.x, bb0.y, bb1.x - bb0.x, bb1.y - bb0.y);
    ctx.strokeRect(bb0.x, bb0.y, bb1.x - bb0.x, bb1.y - bb0.y);
    const sq0 = scr(v, { x: -1, y: 4 }, 11.5);
    const sq1 = scr(v, { x: 1, y: 4 }, 10.2);
    ctx.strokeStyle = '#e2512d';
    ctx.strokeRect(sq0.x, sq0.y, sq1.x - sq0.x, sq1.y - sq0.y);
    // the back of the rim
    ctx.strokeStyle = '#e2512d';
    ctx.lineWidth = Math.max(2, z * 0.28);
    ctx.beginPath();
    ctx.ellipse(rim.x, rim.y, z * 0.95, z * 0.95 * 0.45, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    return;
  }
  // the net: swings when the ball goes through
  const sway = swish > 0 ? Math.sin(swish * 30) * swish * z * 0.4 : 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, z * 0.1);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(rim.x + (i / 3) * z * 0.95, rim.y);
    ctx.lineTo(rim.x + (i / 3) * z * 0.55 + sway, rim.y + z * 1.7);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(rim.x - z * 0.75 + sway * 0.5, rim.y + z * 0.85);
  ctx.lineTo(rim.x + z * 0.75 + sway * 0.5, rim.y + z * 0.85);
  ctx.stroke();
  ctx.strokeStyle = '#ff5a2a';
  ctx.lineWidth = Math.max(2, z * 0.3);
  ctx.beginPath();
  ctx.ellipse(rim.x, rim.y, z * 0.95, z * 0.95 * 0.45, 0, 0, Math.PI);
  ctx.stroke();
}

function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#e8762b';
  ctx.strokeStyle = '#3a1a08';
  ctx.lineWidth = Math.max(1, r * 0.25);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
}

export interface HoopOverlay {
  /** the controlled player gets a ring and his name */
  tagHandler: boolean;
  /** seconds since the net was hit (for its swing) */
  swish: number;
  /** a pass preview: who the PASS button would throw to */
  passTo: Body | null;
}

export function drawHoops(ctx: CanvasRenderingContext2D, v: View, p: Poss, look: CourtLook, o: HoopOverlay) {
  court(ctx, v, look);
  basket(ctx, v, false, o.swish);
  const px = Math.max(1.2, (v.z * 6.6) / 27);
  const order = p.bodies.slice().sort((a, b) => a.y - b.y);
  // shadows, tinted by side
  for (const b of order) {
    const s = scr(v, b);
    ctx.fillStyle = b.side === 'O' ? 'rgba(25,227,201,0.45)' : 'rgba(255,90,90,0.35)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, px * 6, px * 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // the man with the ball: a ring
  if (p.handler && o.tagHandler) {
    const s = scr(v, p.handler);
    ctx.strokeStyle = '#ffe29a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, px * 8, px * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (o.passTo) {
    const s = scr(v, o.passTo);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, px * 8, px * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.imageSmoothingEnabled = false;
  const bn = ballNow(p);
  for (const b of order) {
    const shooting = b.z > 0.5;
    const moving = Math.hypot(b.vx, b.vy) > 2;
    const pose = shooting ? 2 : moving ? Math.floor(b.stride) % 2 : 0;
    const sprite = hoopSprite({ c1: b.a.c1, c2: b.a.c2, ht: b.a.ht, wt: b.a.wt, initials: b.a.initials }, b.side === 'O', pose);
    const s = scr(v, b, b.z);
    const w = sprite.width * px;
    const h = sprite.height * px;
    ctx.drawImage(sprite, Math.round(s.x - w / 2), Math.round(s.y - h + px), Math.round(w), Math.round(h));
    // the dribble
    if (b === p.handler && !bn) {
      if (shooting) ball(ctx, s.x, s.y - h - px * 2, px * 2.6);
      else {
        const bounce = Math.abs(Math.sin(p.t * 9)) * h * 0.42;
        const side = b.vx < -1 ? -1 : 1;
        ball(ctx, s.x + side * (w / 2 + px), s.y - px * 2 - bounce, px * 2.4);
      }
    }
  }
  basket(ctx, v, true, o.swish);
  // the ball in the air, and its shadow
  if (bn) {
    const g = scr(v, bn);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, px * 2.6, px * 1, 0, 0, Math.PI * 2);
    ctx.fill();
    const a = scr(v, bn, bn.z);
    ball(ctx, a.x, a.y, px * 2.6);
  }
  // names over the man with the ball (and the pass target)
  const fs = Math.max(10, Math.round(v.z * 1.5));
  for (const b of [p.handler, o.passTo]) {
    if (!b) continue;
    const s = scr(v, b, b.z);
    const top = s.y - hoopSprite({ c1: b.a.c1, c2: b.a.c2, ht: b.a.ht, wt: b.a.wt, initials: b.a.initials }, true, 0).height * px - 4;
    ctx.font = '900 ' + fs + "px 'Archivo', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const wv = ctx.measureText(b.a.tag).width + fs * 0.7;
    ctx.fillStyle = 'rgba(4,18,26,0.8)';
    ctx.beginPath();
    ctx.roundRect(s.x - wv / 2, top - fs * 1.3, wv, fs * 1.25, fs * 0.35);
    ctx.fill();
    ctx.fillStyle = b === p.handler ? '#ffe29a' : '#ffffff';
    ctx.fillText(b.a.tag, s.x, top - fs * 0.2);
  }
  // the shot meter: fills to the top of the jump
  if (p.jumpAt !== null && p.handler) {
    const b = p.handler;
    const s = scr(v, b, b.z);
    const held = p.t - p.jumpAt;
    const k = Math.min(1, held / (APEX * 1.6));
    const mh = v.z * 7;
    const mx = s.x + v.z * 3.2;
    const my = s.y - mh;
    ctx.fillStyle = 'rgba(4,18,26,0.85)';
    ctx.fillRect(mx, my, v.z * 1.1, mh);
    const perfectAt = my + mh - (APEX / (APEX * 1.6)) * mh;
    ctx.fillStyle = 'rgba(25,227,201,0.95)';
    ctx.fillRect(mx - 3, perfectAt - 3, v.z * 1.1 + 6, 6);
    ctx.fillStyle = k * APEX * 1.6 > APEX + 0.06 ? '#ff6b6b' : '#ffe29a';
    ctx.fillRect(mx + 2, my + mh - mh * k, v.z * 1.1 - 4, mh * k);
  }
}
