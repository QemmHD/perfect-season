// The football broadcast camera (Claude, studio overhaul nfl-3; Game Design V2 §B.2.3). Render-only:
// it reads the play and never writes to it, so seeded results are the same with it or without it
// (camera.test.ts proves it).
//
// Upright, the camera sits behind the offense, raised, with perspective:
// - before the snap the line of scrimmage is at 45% of the height and the formation is centred on
//   the ball, so all eleven, the defensive shell and the receivers split wide stay visible above the
//   124 px play tray; live, the play's spot eases down to 58% so more of the field ahead shows;
// - the horizon is at 6%, so the stands, the sky and the score bug take no more than about an eighth
//   of the screen;
// - players are drawn ART times their projected size (V2 §C.6: "sprite scale = projected scale × a
//   per-sport constant"), which puts the quarterback and the backs at about 34 css px at 393 wide
//   while the field keeps its real proportions, so the wideouts fit;
// - dynamic zoom: it pulls back (down to 0.75) when the throw's landing spot would leave the
//   action-safe box, and pushes in (to 1.15) on a carrier in traffic or on contact; Clutch staging
//   adds 6%; under reduced motion the zoom stays at 1 and the camera only follows;
// - the controlled player and his target (the slingshot's reticle, the ball's landing spot, the man
//   with the ball) are kept inside the C15 action-safe box.
//
// Sideways (landscape) keeps the classic side-on camera (field.ts fieldCam), the audit's
// readability reference; only the follow lives here.
import { type PCam, pcam, project } from '../pixel/persp';
import type { Body, Play, Pt } from './types';

/** The field's width in yards (engine.ts FIELD_W; repeated so this module stays free of the engine). */
const FIELD_W = 53.33;

/** Players are drawn this many times their projected size (see above). */
export const ART = 1.38;

/** The framing: rows are shares of the screen's height; `scale` is pixels a yard per css px of width. */
export const FRAME = {
  /** the line of scrimmage's row before the snap */
  preRow: 0.45,
  /** the play's spot once it's live */
  liveRow: 0.58,
  horizon: 0.06,
  pitch: 0.6,
  fov: 0.75,
  /** pixels a yard at the focus, per css px of the screen's width (13.4 at 393) */
  scale: 0.034
} as const;

export const ZOOM = { min: 0.75, max: 1.15, clutch: 1.06 } as const;

/** The action-safe box, in css px from the top of the screen (C15 --safe-top and H - --safe-bottom). */
export interface SafeBox {
  top: number;
  bottom: number;
}

export interface CamInput {
  W: number;
  H: number;
  p: Play;
  /** the slingshot's landing spot while it's drawn back */
  aim: Pt | null;
  safe: SafeBox | null;
  reduced: boolean;
  /** Clutch staging (V2 §B.0.4): the camera sits 6% tighter */
  clutch?: boolean;
  /** an instant replay's spot: the camera pushes in on it */
  replay?: Pt | null;
  /** the player dragging the field before the snap to look around (yards to shift the view by) */
  look?: Pt | null;
}

/** Where the camera wants to be: the focus point on the ground, the row it sits on, the zoom. */
export interface Want {
  fx: number;
  fy: number;
  row: number;
  zoom: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A perspective camera for the screen with the ground point (fx, fy) on `row`, at `zoom`. */
export function lensFor(W: number, H: number, fx: number, fy: number, row: number, zoom: number): PCam {
  return pcam(W, H, fx, fy, { row, s: FRAME.scale * W * zoom, horizon: FRAME.horizon, pitch: FRAME.pitch, fov: FRAME.fov });
}

/** The ball's spot on the ground while it's in the air (where the throw is going). */
function landing(p: Play): Pt | null {
  return p.ball && p.phase === 'air' ? p.ball.to : null;
}

/** The man the screen is about: the passer before the throw, then whoever has it. */
export function controlled(p: Play): Body | null {
  if (p.phase === 'pre' || p.phase === 'dead') return null;
  return p.carrier ?? (p.phase === 'air' ? p.catcher : null) ?? null;
}

/** Defenders within 3 yards of the carrier, or a carrier in contact: traffic. */
export function inTraffic(p: Play): boolean {
  const c = p.carrier;
  if (!c || p.phase !== 'run') return false;
  let near = 0;
  for (const b of p.bodies) {
    if (b.side !== 'D') continue;
    if (b.act === 'tackle' && Math.hypot(b.x - c.x, b.y - c.y) < 2.2) return true;
    if (Math.hypot(b.x - c.x, b.y - c.y) < 3) near++;
  }
  return near >= 2;
}

/**
 * The framing this frame wants, before the safe box is enforced: the line of scrimmage on its row
 * before the snap (centred on the ball, so the formation is), the ball or its carrier once it's live.
 */
export function wantOf(c: CamInput): Want {
  const { p } = c;
  if (c.replay) return { fx: clamp(c.replay.x, 12, FIELD_W - 12), fy: Math.min(c.replay.y + 2, 104), row: FRAME.liveRow, zoom: 1.3 };
  const pre = p.phase === 'pre';
  if (pre) {
    const lx = c.look?.x ?? 0;
    const ly = c.look?.y ?? 0;
    return { fx: clamp(p.bx + lx, 10, FIELD_W - 10), fy: clamp(p.los + ly, p.los - 8, p.los + 30), row: FRAME.preRow, zoom: 1 };
  }
  const ball = p.ball && p.phase === 'air' ? ballSpot(p) : null;
  const at = ball ?? p.carrier ?? p.qb;
  // the pocket: hold the line of scrimmage where it was and let the drop happen under it
  const pocket = p.phase === 'drop';
  const fy = pocket ? Math.max(at.y + 2, p.los - 1) : at.y + 1;
  let zoom = 1;
  if (!c.reduced) {
    if (inTraffic(p)) zoom = ZOOM.max;
    if (c.clutch) zoom *= ZOOM.clutch;
  }
  return { fx: clamp(pocket ? p.bx + (at.x - p.bx) * 0.6 : at.x, 12, FIELD_W - 12), fy: Math.min(fy, 104), row: pocket ? (FRAME.preRow + FRAME.liveRow) / 2 : FRAME.liveRow, zoom };
}

function ballSpot(p: Play): Pt {
  const b = p.ball!;
  const k = clamp((p.t - b.t0) / (b.t1 - b.t0), 0, 1);
  return { x: b.from.x + (b.to.x - b.from.x) * k, y: b.from.y + (b.to.y - b.from.y) * k };
}

/** The points that must stay inside the action-safe box: the controlled man first, then his target. */
export function keepIn(c: CamInput): { lead: Pt | null; target: Pt | null } {
  const { p } = c;
  if (c.replay || p.phase === 'pre' || p.phase === 'dead' || p.end) return { lead: null, target: null };
  if (p.phase === 'drop' && p.carrier === p.qb && p.call === 'pass') return { lead: p.qb, target: c.aim };
  if (p.phase === 'air') return { lead: p.qb, target: landing(p) };
  return { lead: p.carrier, target: null };
}

/**
 * Fit a framing to the safe box: the target pulls the zoom back (never under ZOOM.min) until it's
 * inside, then the focus slides along the field so both are, the controlled man first. Under reduced
 * motion the zoom never changes; the focus still moves.
 */
export function fit(c: CamInput, w: Want): Want {
  const box = c.safe;
  const { lead, target } = keepIn(c);
  if (!box || (!lead && !target)) return w;
  const pad = 6;
  const top = box.top + pad;
  const bottom = box.bottom - pad;
  const inside = (zoom: number, fy: number) => {
    const cam = lensFor(c.W, c.H, w.fx, fy, w.row, zoom);
    const ys = [lead, target].filter((q): q is Pt => !!q).map((q) => project(cam, q.x, q.y).y);
    return { lo: Math.min(...ys), hi: Math.max(...ys) };
  };
  let zoom = w.zoom;
  let fy = w.fy;
  // the target above the box: pull back until it fits
  if (target && !c.reduced) {
    for (let i = 0; i < 12 && zoom > ZOOM.min; i++) {
      const r = inside(zoom, fy);
      if (r.lo >= top && r.hi <= bottom) break;
      zoom = Math.max(ZOOM.min, zoom - 0.04);
    }
  }
  // then slide the focus: the highest point down to the top, but never the lead below the bottom
  for (let i = 0; i < 16; i++) {
    const r = inside(zoom, fy);
    if (r.lo < top && r.hi < bottom) fy += Math.min(4, (top - r.lo) / 12 + 0.25);
    else if (r.hi > bottom && r.lo > top) fy -= Math.min(4, (r.hi - bottom) / 12 + 0.25);
    else break;
  }
  return { ...w, zoom, fy };
}

/**
 * The camera's state between frames: it eases toward what the play wants (the zoom quicker when
 * it's pulling back for a throw), and makes the PCam the renderer draws with.
 */
export class FootballCamera {
  fx = FIELD_W / 2;
  fy = 25;
  row: number = FRAME.preRow;
  zoom = 1;
  private seen = false;
  private wasPre = true;

  /** Jump straight to the framing (a new screen size, a new play lined up). */
  reset() {
    this.seen = false;
  }

  /** Move toward this frame's framing over `dt` seconds of real time; returns the lens to draw with. */
  update(c: CamInput, dt: number): PCam {
    const w = fit(c, wantOf(c));
    const pre = c.p.phase === 'pre';
    // each new play lines up at once (the camera doesn't sweep back across the field after a whistle)
    if (!this.seen || (pre && !this.wasPre && !c.look)) {
      this.seen = true;
      Object.assign(this, { fx: w.fx, fy: w.fy, row: w.row, zoom: c.reduced ? 1 : w.zoom });
    } else {
      const k = (rate: number) => 1 - Math.exp(-rate * Math.max(0, Math.min(0.1, dt)));
      const look = pre && c.look ? 18 : 0;
      this.fx += (w.fx - this.fx) * k(look || 4.8);
      this.fy += (w.fy - this.fy) * k(look || 6);
      this.row += (w.row - this.row) * k(3);
      if (c.reduced) this.zoom = c.replay ? 1.3 : 1;
      else this.zoom += (w.zoom - this.zoom) * k(w.zoom < this.zoom ? 7 : 2.5);
      // settle exactly once close: a still camera lets the renderer reuse its last floor
      if (Math.abs(w.fx - this.fx) < 0.004) this.fx = w.fx;
      if (Math.abs(w.fy - this.fy) < 0.004) this.fy = w.fy;
      if (Math.abs(w.row - this.row) < 0.0005) this.row = w.row;
      if (!c.reduced && Math.abs(w.zoom - this.zoom) < 0.0005) this.zoom = w.zoom;
    }
    this.wasPre = pre;
    return lensFor(c.W, c.H, this.fx, this.fy, this.row, this.zoom);
  }
}
