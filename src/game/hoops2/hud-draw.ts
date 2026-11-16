// The court's HUD layer for basketball (plan §6.1, V2 B.0.1 / C.3), drawn by render.ts through two
// calls: `under` before the players (the rings on the floor) and `over` after them (the arc meter
// and its words).
//  - the gold ground ring under the man you control
//  - the teal ring on the pass target, with his name and his shot as it will be on the catch
//  - the red arc in front of the man guarding the ball
//  - the shot's ring at the shooter's feet, closing on its target, and the arc meter over his head
//    (hud/ring-draw.ts): gold, amber or red as the engine's live ring says; held a moment after the
//    release to show where it landed
//  - Heat on the ball: a trail while HEATING UP, flames ON FIRE
// Render only: it reads the possession and draws; it never changes it.
import { judge, type RingSpec } from '../perfect';
import { arcPx, drawRing, RING_COLOR } from '../hud/ring-draw';
import { catchChance } from './autopilot';
import { contestOf, shotChance } from './engine';
import type { Contest, Possession } from './types';

/** What the renderer lends the HUD: its size, its camera and its chip list. */
export interface HudView {
  W: number;
  H: number;
  reduced: boolean;
  showOdds: boolean;
  replaying: boolean;
  at(cx: number, cz: number, h?: number): { x: number; y: number; s: number };
  /** sin of the camera's look-down angle at a floor point (an ellipse's ry over rx) */
  pitch(cx: number, cz: number): number;
  chip(text: string, x: number, y: number, color: string, pri: number, slack?: number): void;
}

const CONTEST_COLOR: Record<Contest, string> = { open: '#3ee08f', light: '#f4d03f', heavy: '#ff8c3a', smothered: '#ff4d5e' };
const CONTEST_TEXT: Record<Contest, string> = { open: 'OPEN', light: 'LIGHT', heavy: 'HEAVY', smothered: 'SMOTHERED' };
const TEAL = '#4fe3c1';
const GOLD = '#f6b93b';
/** How long the ring shows the release after it (s). */
const HOLD = 0.7;
/** The arc meter's radius: this share of the screen's short side (plan §3.3). */
export const ARC_R = 0.13;

/** The live shot % colour: green a good look, yellow a fair one, orange a poor one. */
export function oddsColor(c: number): string {
  return c >= 0.5 ? '#3ef07a' : c >= 0.35 ? '#ffd35a' : '#ff8c5a';
}

interface Shown {
  idx: number;
  t0: number;
  spec: RingSpec;
  /** the release (ms from the ideal, PERFECT or not) and when it was seen (real s) */
  result: { offMs: number; inGold: boolean; at: number } | null;
  style?: string;
  /** the possession's last shot when this one started (a result is only ever this shot's) */
  before: Possession['lastShot'];
}

export class HoopsHud {
  /** the meter on show: live while the shot's held, then a moment more with its result */
  private shown: Shown | null = null;
  /** the ball's last positions on screen (the Heat trail) */
  private trail: { x: number; y: number }[] = [];
  /** meter Off (the touch prefs): only the ground ring's colour, no closing ring or arc */
  meterOff = false;

  reset() {
    this.shown = null;
    this.trail = [];
  }

  /** Follow the engine's meter: live, then its result held for HOLD. */
  private track(p: Possession, real: number) {
    const m = p.meter;
    if (m && p.handler !== null && m.off === undefined) {
      const before = this.shown && this.shown.idx === p.handler && this.shown.t0 === m.t0 && !this.shown.result ? this.shown.before : p.lastShot;
      this.shown = { idx: p.handler, t0: m.t0, spec: { idealMs: m.top * 1000, goldMs: m.green * 1000, state: m.state, ...(m.dial ? { dial: m.dial } : {}) }, result: null, style: m.style, before };
      return;
    }
    const s = this.shown;
    if (!s) return;
    if (!s.result) {
      // released (or the layup went up): its result, once the engine has it
      const ls = p.lastShot !== s.before ? p.lastShot : null;
      const off = m?.offMs ?? ls?.offMs;
      if (off === undefined) {
        // a hold taken back (a tap, a swipe, an interruption): nothing to show
        if (!m && !p.ball && !p.finish) this.shown = null;
        return;
      }
      s.result = { offMs: off, inGold: m ? !!m.greened : !!ls?.greened, at: real };
      if (ls?.state && !m) s.spec = { ...s.spec, state: ls.state, goldMs: ls.goldMs ?? s.spec.goldMs };
    } else if (real - s.result.at > HOLD) this.shown = null;
  }

  /** The rings on the floor, under the players. */
  under(ctx: CanvasRenderingContext2D, v: HudView, p: Possession, real: number) {
    this.track(p, real);
    if (v.replaying || p.end) return;
    const h = p.handler !== null ? p.bodies[p.handler] : null;
    ctx.save();
    // the man guarding the ball: a red arc in front of him
    if (h && !p.ball) {
      const d = p.bodies.find((b) => b.side === 'D' && b.mark === h.idx);
      const gap = d ? Math.sqrt((d.cx - h.cx) * (d.cx - h.cx) + (d.cz - h.cz) * (d.cz - h.cz)) : 99;
      if (d && gap < 8) {
        const f = v.at(d.cx, d.cz);
        const rx = Math.max(8, f.s * 1.35);
        ctx.globalAlpha = 0.45 + 0.5 * (1 - gap / 8);
        ctx.strokeStyle = RING_COLOR.red;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, rx, Math.max(3, rx * v.pitch(d.cx, d.cz)), 0, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // the pass target: a teal ring at his feet
    if (h && p.target !== null && !p.meter && !p.finish && !p.ball) {
      const m = p.bodies[p.target];
      const f = v.at(m.cx, m.cz);
      const rx = Math.max(7, f.s * 1.5);
      ctx.strokeStyle = TEAL;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, Math.max(3, rx * v.pitch(m.cx, m.cz)), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // the man you control: a gold ring at his feet (the shot's own ring replaces it)
    const s = this.shown;
    if (h && !(s && s.idx === h.idx)) {
      const f = v.at(h.cx, h.cz);
      const rx = Math.max(8, f.s * 1.25);
      const ry = Math.max(3, rx * v.pitch(h.cx, h.cz));
      ctx.strokeStyle = 'rgba(7,21,33,0.7)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // the shot's ring at the shooter's feet
    if (s) {
      const b = p.bodies[s.idx];
      const f = v.at(b.cx, b.cz);
      const rx = Math.max(10, f.s * 1.6);
      const ry = Math.max(4, rx * v.pitch(b.cx, b.cz));
      const t = (p.t - s.t0) / Math.max(0.001, s.spec.idealMs / 1000);
      const result = s.result ? { ...s.result, age: real - s.result.at } : null;
      if (this.meterOff) {
        // meter Off: the ring's colour only, at the target
        ctx.strokeStyle = RING_COLOR[s.spec.state];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else drawRing(ctx, { x: f.x, y: f.y, rx, ry, t, spec: s.spec, px: (rx * 1.6) / Math.max(1, s.spec.idealMs), reduced: v.reduced, mode: 'ground', result });
    }
    ctx.restore();
  }

  /** The arc meter over the shooter's head and the chips: the contest while he rises, the word after. */
  over(ctx: CanvasRenderingContext2D, v: HudView, p: Possession, real: number, heads: Record<number, { x: number; y: number }>) {
    if (v.replaying) return;
    const s = this.shown;
    if (s && !this.meterOff) {
      const head = heads[s.idx];
      if (head) {
        const R = Math.max(26, Math.round(Math.min(v.W, v.H) * ARC_R));
        const th = Math.max(7, Math.round(R * 0.22));
        // centred low enough that the arch frames his head (it reads as his), high enough to stay on screen
        const cy = Math.max(R + th + 24, head.y + Math.round(R * 0.3));
        const t = (p.t - s.t0) / Math.max(0.001, s.spec.idealMs / 1000);
        const result = s.result ? { ...s.result, age: real - s.result.at } : null;
        drawRing(ctx, { x: head.x, y: cy, rx: R, ry: R, t, spec: s.spec, px: arcPx(R, s.spec.idealMs), reduced: v.reduced, mode: 'arc', result });
        if (!s.result && p.meter && p.handler === s.idx) {
          const grade = contestOf(p, p.bodies[s.idx]);
          v.chip(CONTEST_TEXT[grade], head.x, cy - R - th - 18, CONTEST_COLOR[grade], 6);
          if (s.style) v.chip(s.style === 'catch' ? 'CATCH & SHOOT' : s.style === 'pullup' ? 'MOVING SHOT' : 'SET SHOT', head.x, cy - R - th - 34, '#d6e5ed', 5);
        } else if (s.result) {
          const j = judge(s.spec, s.result.offMs);
          v.chip(j.word, head.x, cy - R - th - 18, j.inGold ? '#ffe08a' : s.spec.state === 'red' ? RING_COLOR.red : '#ffd35a', 6);
        }
      }
    }
    // the pass target's name and his shot as it will be on the catch (NBA-16)
    if (p.target !== null && p.handler !== null && !p.meter && !p.finish && !p.ball && !p.end) {
      const m = p.bodies[p.target];
      const h = heads[p.target];
      if (h && m) {
        const c = v.showOdds ? catchChance(p, p.bodies[p.handler], m) : null;
        v.chip(m.p.tag + (c !== null ? ' ' + Math.round(c * 100) + '%' : ''), h.x, h.y - 18, c !== null ? oddsColor(c) : '#88f6da', 3);
      }
    }
    // the handler's name over his head; at his feet his sprint's stamina and his shot % from here
    if (p.handler !== null && !p.ball && !p.meter && !p.end) {
      const b = p.bodies[p.handler];
      const h = heads[b.idx];
      if (h) this.chipName(v, b.p.tag, h.x, h.y - 18, p.heat);
      if (!p.finish) {
        const f = v.at(b.cx, b.cz);
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
        if (v.showOdds) {
          const c = shotChance(p, b);
          v.chip(Math.round(c * 100) + '%', f.x, y, oddsColor(c), 2, 0);
        }
      }
    }
  }

  private chipName(v: HudView, tag: string, x: number, y: number, heat: Possession['heat']) {
    v.chip(tag, x, y, heat === 'fire' ? '#ffb02e' : heat === 'heating' ? '#ffd35a' : '#ffffff', 4);
  }

  /**
   * Heat on the ball (after it's drawn): a short gold trail while HEATING UP, flames ON FIRE. With
   * reduced motion a static tint ring instead.
   */
  ball(ctx: CanvasRenderingContext2D, v: HudView, x: number, y: number, s: number, heat: Possession['heat'], real: number) {
    this.trail.push({ x, y });
    if (this.trail.length > 8) this.trail.shift();
    if (heat === 'cold' || v.replaying) return;
    ctx.save();
    if (v.reduced) {
      ctx.strokeStyle = heat === 'fire' ? '#ff6a1a' : '#ffd35a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, s * 0.45), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    // the trail: the last few spots, fading
    const n = this.trail.length;
    for (let i = 0; i < n - 1; i++) {
      const q = this.trail[i];
      const k = (i + 1) / n;
      ctx.globalAlpha = 0.45 * k;
      ctx.fillStyle = heat === 'fire' ? '#ff8a2a' : '#ffd35a';
      const r = Math.max(1, s * 0.28 * k);
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (heat === 'fire') {
      // flames licking up off the ball
      for (let i = 0; i < 8; i++) {
        const a = real * 9 + i * 1.7;
        ctx.fillStyle = i % 2 ? '#ffd23a' : '#ff6a1a';
        const d = Math.max(1, Math.round(s * 0.18));
        ctx.fillRect(Math.round(x + Math.sin(a) * s * 0.4), Math.round(y - s * 0.4 - ((real * 30 + i * 3) % (s * 1.2))), d, d * 2);
      }
    }
    ctx.restore();
  }
}
