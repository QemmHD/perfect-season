// The basketball broadcast camera (nba-3, V2 B.1.3; Claude 2026-11-16). Pure: no DOM, no clock, no
// engine state is changed, so the tests drive it with synthetic frames.
//
// A high three-quarter half-court view: the camera sits up behind the play, pitched about 55° down
// and yawed 12° off the rim line, so the man guarding the ball reads as his own silhouette instead
// of hiding behind the handler. The rim is pinned at 20-24% of the height; the handler sits near the
// middle (his median 50-55%); the zoom never changes near the rim (no zoom-in pile-ups); on a shot
// the camera holds the shooter and tilts 2% toward the rim; it never lets the handler or the rim
// leave the action-safe box that the HUD's geometry leaves free (`hud/geometry.ts`).
//
// Court coordinates are the engine's: `cx` along the floor toward the rim (feet), `cz` across it
// (+ to the right as you attack), `h` up. The camera is placed by two numbers: `a`, how far along
// its own across axis it has panned, and `b`, how far along its own forward axis. Panning on its
// own axes is what keeps the zoom fixed: a pan across never changes any point's depth.
import { ballPos } from './engine';
import type { Body, Possession } from './types';

export interface Pt2 {
  cx: number;
  cz: number;
}

/** Where the HUD leaves the court free (CSS px from the top of the game; `hud/geometry.ts`). */
export interface SafeBox {
  safeTop: number;
  safeBottom: number;
  land: boolean;
  /** the lowest edge of the HUD above the court (the Heat bar; sideways the toast line under it):
   * the rim keeps rimPad below it */
  hudBottom?: number;
}

/** `up`: you always attack up the screen (the default, on both ends). `v2b`: V2 B.1.3's variant,
 * your basket at the bottom while you defend (wired to the defense with nba-6). */
export type Orient = 'up' | 'v2b';

/** The fixed shape of the view (plan §3.8 camera rows). */
export const CAM = {
  /** look-down angle at the axis: 55° */
  pitch: (55 * Math.PI) / 180,
  /** the yaw off the rim line: 12° */
  yaw: (12 * Math.PI) / 180,
  /** half the lens's angle over the safe box's height */
  fov: 0.5,
  /** the rim's centre, as a share of the safe box down from its top (22% of the height at the two V2 sizes) */
  rimRow: 0.16,
  /** the fixed zoom: feet of floor (at the focus) the safe box's height spans */
  span: 39,
  /** the camera's axis, as a share of the safe box down from its top */
  axisRow: 0.5,
  /** the rim keeps this far below the HUD (the Heat bar or the toast line), the handler this far inside the box (px) */
  rimPad: 40,
  pad: 6,
  /** a handler's head (ft) for the safe box, and a body's shoulder width (ft) for the overlap rows */
  head: 7.5,
  shoulders: 1.7,
  /** lateral dead zone (ft) and the ball's share of the follow while it's in the air */
  dead: 3,
  ballShare: 0.35,
  /** damping rates (per second) for the pan across, along, the yaw, the zoom */
  kA: 5,
  kB: 8,
  kYaw: 4,
  kZoom: 6,
  /** the zoom's rate once the ball is inside fixedWithin: a long pass into the paint brings it home
   * before the ball gets near the rim (the zoom stays fixed there; nba-4) */
  kZoomHome: 24,
  /** the shot's tilt toward the rim (share of the height), Clutch's tighten, a replay's push-in */
  shotTilt: 0.02,
  /** the zoom is fixed within this many feet of the rim; past it, out toward half court (the tip-off
   * walk), it eases back by up to farOut over farRamp feet so the man and the rim both still fit */
  fixedWithin: 26,
  farRamp: 6,
  farOut: 0.25,
  clutch: 1.06,
  replay: 1.35,
  /** the side-to-side margin the handler and the rim (its backboard too) keep from the screen's edges (px) */
  edge: 34,
  rimEdge: 60,
} as const;

/** A placed camera: projects court points to screen pixels. */
export interface Cam3 {
  W: number;
  H: number;
  f: number;
  /** the axis row */
  hy: number;
  pitch: number;
  yaw: number;
  /** forward and screen-right on the floor (cx, cz) */
  fwd: Pt2;
  across: Pt2;
  /** the camera's position (cx, cz) and height */
  pos: Pt2;
  ch: number;
  /** px per foot at the focus, and the distance to it */
  s0: number;
  D: number;
}

export interface Shot {
  x: number;
  y: number;
  /** px per foot at that depth */
  s: number;
  /** depth along the axis */
  z: number;
}

/** Build the camera for a screen, its yaw and zoom, panned to (a, b). */
export function makeCam(W: number, H: number, box: SafeBox, yaw: number, zoom: number, a: number, b: number, tilt = 0): Cam3 {
  const pitch = CAM.pitch;
  // the lens, the zoom and the axis come from the safe box, so every phone (either way up) frames
  // the same floor inside it with the same perspective
  const boxH = Math.max(120, box.safeBottom - box.safeTop);
  const f = boxH / 2 / Math.tan(CAM.fov);
  const s0 = (boxH / CAM.span) * zoom;
  const D = f / s0;
  const fwd = { cx: Math.cos(yaw), cz: Math.sin(yaw) };
  const across = { cx: -Math.sin(yaw), cz: Math.cos(yaw) };
  const F = { cx: a * across.cx + b * fwd.cx, cz: a * across.cz + b * fwd.cz };
  const back = D * Math.cos(pitch);
  return { W, H, f, hy: box.safeTop + boxH * CAM.axisRow + H * tilt, pitch, yaw, fwd, across, pos: { cx: F.cx - back * fwd.cx, cz: F.cz - back * fwd.cz }, ch: D * Math.sin(pitch), s0, D };
}

/** A court point (along, across, up) on screen. */
export function project(c: Cam3, cx: number, cz: number, h = 0): Shot {
  const rx = cx - c.pos.cx;
  const rz = cz - c.pos.cz;
  const df = rx * c.fwd.cx + rz * c.fwd.cz;
  const dx = rx * c.across.cx + rz * c.across.cz;
  const dz = h - c.ch;
  const cs = Math.cos(c.pitch);
  const sn = Math.sin(c.pitch);
  const z = Math.max(0.5, df * cs - dz * sn);
  const u = df * sn + dz * cs;
  return { x: c.W / 2 + (c.f * dx) / z, y: c.hy - (c.f * u) / z, s: c.f / z, z };
}

/** How far from the camera a court point is, along the floor (for drawing far to near). */
export const depthOf = (c: Cam3, cx: number, cz: number) => (cx - c.pos.cx) * c.fwd.cx + (cz - c.pos.cz) * c.fwd.cz;

/** The look-down angle at a court point (steep up close, shallow far away). */
export const pitchAt = (c: Cam3, cx: number, cz: number) => Math.atan2(c.ch, Math.max(1, depthOf(c, cx, cz)));

/** A screen direction (x right, y down) as a court direction: up the screen is the camera's forward. */
export function screenToCourt(c: Pick<Cam3, 'fwd' | 'across'>, x: number, y: number): Pt2 {
  return { cx: -y * c.fwd.cx + x * c.across.cx, cz: -y * c.fwd.cz + x * c.across.cz };
}

/**
 * A body's facing as the sprite sheet's direction index: 0 is facing the camera's forward, counting
 * round to the right (the drawing's own convention: atan2(-forward, right)).
 */
export function facingIndex(c: Pick<Cam3, 'fwd' | 'across'>, face: number, dirs: number): number {
  const dcx = Math.cos(face);
  const dcz = Math.sin(face);
  const f = dcx * c.fwd.cx + dcz * c.fwd.cz;
  const r = dcx * c.across.cx + dcz * c.across.cz;
  return (Math.round((Math.atan2(-f, r) / (Math.PI * 2)) * dirs) + dirs) % dirs;
}

/**
 * The forward offset of a point at height `h` from the focus that puts it on screen row `y`
 * (the inverse of `project` along the axis; the across pan doesn't enter).
 */
export function rowOffset(c: Pick<Cam3, 'f' | 'hy' | 'pitch' | 'D'>, y: number, h: number): number {
  const cs = Math.cos(c.pitch);
  const sn = Math.sin(c.pitch);
  const Y = (c.hy - y) / c.f;
  return (h * cs - Y * (c.D - h * sn)) / (Y * cs - sn);
}

/** What the camera follows this frame. */
export interface Subject {
  /** the man with the ball (or the shooter while his shot is up, or the man boxing out) */
  at: Pt2 | null;
  /** the ball on the floor (its shadow) */
  ball: Pt2;
  /** the ball's in the air (a pass or a shot): the follow leans toward it */
  flying: boolean;
  /** a jump shot's in the air: hold on the shooter, tilt toward the rim */
  shot: boolean;
}

export interface CamState {
  a: number;
  b: number;
  yaw: number;
  zoom: number;
  tilt: number;
  ready: boolean;
}

export const camStart = (): CamState => ({ a: 0, b: 0, yaw: CAM.yaw, zoom: 1, tilt: 0, ready: false });

export interface Frame {
  W: number;
  H: number;
  box: SafeBox;
  rim: Pt2 & { h: number };
  subject: Subject;
  /** the yaw wanted (± CAM.yaw by `yawFor`), the zoom (1, Clutch, replay) */
  yaw: number;
  zoom: number;
  /** a replay's spot: pinned at the middle, ignoring the rim */
  spot?: Pt2 | null;
}

/** Where the camera wants to be for a frame (a, b), and the bounds that keep the subject and the rim
 * inside the safe box and the screen whatever the follow's lag (the box is a hard anchor). */
export interface Target {
  a: number;
  b: number;
  tilt: number;
  aLo: number;
  aHi: number;
  bLo: number;
  bHi: number;
}

export function camTarget(st: CamState, fr: Frame): Target {
  const { W, H, box } = fr;
  const tilt = fr.subject.shot ? CAM.shotTilt : 0;
  // the rows are solved on the untilted camera: the tilt only slides the picture (the depth, so the
  // zoom, never moves for it)
  const c = makeCam(W, H, box, fr.yaw, fr.zoom, 0, 0, 0);
  const dot = (p: Pt2, v: Pt2) => p.cx * v.cx + p.cz * v.cz;
  if (fr.spot) {
    const b = dot(fr.spot, c.fwd) - rowOffset(c, H * 0.55, 0);
    const a = dot(fr.spot, c.across);
    return { a, b, tilt: 0, aLo: -Infinity, aHi: Infinity, bLo: -Infinity, bHi: Infinity };
  }
  const sub = fr.subject;
  const at = sub.at ?? sub.ball;
  // along: pin the rim's row; give way only to keep the subject inside the safe box (feet first)
  // looking up the floor the rim sits near the top; from behind your own basket (v2b's defense) it
  // sits near the bottom, the play coming at you
  const behind = Math.cos(fr.yaw) < 0;
  const rimRow = behind ? box.safeBottom - (box.safeBottom - box.safeTop) * CAM.rimRow : Math.max(box.safeTop + (box.safeBottom - box.safeTop) * CAM.rimRow, (box.hudBottom ?? box.safeTop) + CAM.rimPad);
  const rimF = dot(fr.rim, c.fwd);
  const bRim = rimF - rowOffset(c, rimRow, fr.rim.h);
  // (the rim never rises closer than rimPad to the box's top: the bug, the Heat bar and the toast
  // stay 40 px clear of it)
  const rimTop = Math.max(box.safeTop + CAM.pad, (box.hudBottom ?? box.safeTop) + CAM.rimPad);
  let bLo = behind ? -Infinity : rimF - rowOffset(c, rimTop, fr.rim.h);
  let bHi = behind ? rimF - rowOffset(c, box.safeBottom - CAM.pad, 0) : Infinity;
  if (sub.at) {
    // his feet above the box's bottom, his head below its top (the feet win a tie), and the rim's
    // clearance from the HUD above both: on the smallest phones, with a man near half court, his
    // feet may dip under the box rather than the rim slide under the score bug
    const f = dot(sub.at, c.fwd);
    const feet = f - rowOffset(c, box.safeBottom - CAM.pad, 0);
    const head = f - rowOffset(c, box.safeTop + CAM.pad, CAM.head);
    bHi = Math.max(Math.min(bHi, feet), bLo);
    bLo = Math.max(bLo, Math.min(head, bHi));
  } else bLo = Math.min(bLo, bRim);
  const b = Math.min(Math.max(bRim, bLo), bHi);
  // across: a dead zone round the subject, leaning toward a ball in the air
  const follow = sub.flying && !sub.shot ? dot(at, c.across) * (1 - CAM.ballShare) + dot(sub.ball, c.across) * CAM.ballShare : dot(at, c.across);
  let a = st.ready ? st.a : follow;
  if (follow > a + CAM.dead) a = follow - CAM.dead;
  else if (follow < a - CAM.dead) a = follow + CAM.dead;
  // the subject, then the rim (it's the target), inside the screen's sides
  const cb = makeCam(W, H, box, fr.yaw, fr.zoom, 0, b, 0);
  let aLo = -Infinity;
  let aHi = Infinity;
  const keep = (p: Pt2, h: number, edge: number) => {
    const pa = dot(p, c.across);
    const r = ((W / 2 - edge) * project(cb, p.cx, p.cz, h).z) / cb.f;
    aLo = Math.max(aLo, pa - r);
    aHi = Math.min(aHi, pa + r);
    if (aLo > aHi) aLo = aHi = (aLo + aHi) / 2;
  };
  keep(at, 0, CAM.edge);
  keep(fr.rim, fr.rim.h, CAM.rimEdge);
  a = Math.min(Math.max(a, aLo), aHi);
  return { a, b, tilt, aLo, aHi, bLo, bHi };
}

/** One frame of the follow: time-based damping (1 − e^(−k·dt)), the same end at 30 or 60 fps;
 * then held inside the frame's bounds. */
export function camStep(st: CamState, fr: Frame, dt: number, reduced = false): CamState {
  const clampTo = (t: Target, a: number, b: number) => ({ a: Math.min(Math.max(a, t.aLo), t.aHi), b: Math.min(Math.max(b, t.bLo), t.bHi) });
  if (!st.ready) {
    const zoom = fr.zoom * farZoom(fr);
    const t = camTarget({ ...st, yaw: fr.yaw, zoom }, { ...fr, zoom });
    return { a: t.a, b: t.b, yaw: fr.yaw, zoom, tilt: t.tilt, ready: true };
  }
  const k = reduced ? 2 : 1;
  const ease = (rate: number) => 1 - Math.exp(-rate * k * Math.max(0, Math.min(0.25, dt)));
  const yaw = st.yaw + (fr.yaw - st.yaw) * ease(CAM.kYaw);
  const ball = fr.subject.ball;
  const home = Math.hypot(ball.cx - fr.rim.cx, ball.cz - fr.rim.cz) < CAM.fixedWithin;
  const zoom = st.zoom + (fr.zoom * farZoom(fr) - st.zoom) * ease(home ? CAM.kZoomHome : CAM.kZoom);
  // a turn of the yaw orbits the camera round the rim: the rim keeps its place on screen (and its
  // size), so a turn never reads as a pan or a zoom
  const o = orbit(st, yaw, fr.rim);
  const t = camTarget({ ...st, ...o, yaw, zoom }, { ...fr, yaw, zoom });
  const held = clampTo(t, o.a + (t.a - o.a) * ease(CAM.kA), o.b + (t.b - o.b) * ease(CAM.kB));
  return { ...held, yaw, zoom, tilt: st.tilt + (t.tilt - st.tilt) * ease(CAM.kB), ready: true };
}

/** The zoom for how far out the play is: 1 within CAM.fixedWithin of the rim (the ball's distance
 * counts while it's in the air, so a pass or a shot into the paint brings the zoom home). */
export function farZoom(fr: Pick<Frame, 'subject' | 'rim' | 'spot'>): number {
  if (fr.spot) return 1;
  const sub = fr.subject;
  const from = (p: Pt2) => Math.hypot(p.cx - fr.rim.cx, p.cz - fr.rim.cz);
  let d = from(sub.at ?? sub.ball);
  if (sub.flying) d = Math.min(d, from(sub.ball));
  const k = Math.min(1, Math.max(0, (d - CAM.fixedWithin) / CAM.farRamp));
  return 1 - CAM.farOut * k * k * (3 - 2 * k);
}

/** The pan (a, b) that, at a new yaw, leaves a point exactly where it was relative to the camera. */
export function orbit(st: Pick<CamState, 'a' | 'b' | 'yaw'>, yaw: number, about: Pt2): { a: number; b: number } {
  const off = (y: number) => ({ a: -about.cx * Math.sin(y) + about.cz * Math.cos(y), b: about.cx * Math.cos(y) + about.cz * Math.sin(y) });
  const was = off(st.yaw);
  const now = off(yaw);
  return { a: now.a - (was.a - st.a), b: now.b - (was.b - st.b) };
}

/** The camera a state describes. */
export const camOf = (st: CamState, W: number, H: number, box: SafeBox) => makeCam(W, H, box, st.yaw, st.zoom, st.a, st.b, st.tilt);

/**
 * The yaw for a frame: ±12° off the base orientation, the sign chosen so the man guarding (or, on
 * defense, your man) and the man with the ball separate on screen instead of stacking. The sign
 * holds until the guard is clearly (1 ft) on the other side, so the camera doesn't swing.
 *   base 0: looking up the floor at the rim (`up`); base π: from behind your basket (`v2b` defense)
 */
export function yawFor(ball: Pt2, guard: Pt2 | null, prev: number, orient: Orient = 'up', defending = false): number {
  const base = orient === 'v2b' && defending ? Math.PI : 0;
  const was = Math.sign(prev - base) || 1;
  if (!guard) return base + was * CAM.yaw;
  // the guard's offset in the base view: ahead (toward where the camera looks) and to the right
  const dir = base === 0 ? 1 : -1;
  const ahead = (guard.cx - ball.cx) * dir;
  const right = (guard.cz - ball.cz) * dir;
  // the across axis turned by +yaw picks up −sin(yaw)·ahead: pick the sign that adds to `right`
  const want = -Math.sign(ahead * right) || was;
  const sign = want !== was && Math.abs(right) < 1 ? was : want;
  return base + sign * CAM.yaw;
}

/** A body's silhouette on screen: shoulder-wide (or `width` ft), feet to head (7.5 ft). */
export function boxOf(c: Cam3, p: Pt2, width: number = CAM.shoulders) {
  const f = project(c, p.cx, p.cz, 0);
  const hd = project(c, p.cx, p.cz, CAM.head);
  return { x0: f.x - (width / 2) * f.s, x1: f.x + (width / 2) * f.s, y0: hd.y, y1: f.y };
}

/** How much of the farther body the nearer one hides (0-1 of the farther one's silhouette). */
export function hidden(c: Cam3, a: Pt2, b: Pt2, width: number = CAM.shoulders): number {
  const [near, far] = depthOf(c, a.cx, a.cz) <= depthOf(c, b.cx, b.cz) ? [a, b] : [b, a];
  const N = boxOf(c, near, width);
  const F = boxOf(c, far, width);
  const ix = Math.max(0, Math.min(N.x1, F.x1) - Math.max(N.x0, F.x0));
  const iy = Math.max(0, Math.min(N.y1, F.y1) - Math.max(N.y0, F.y0));
  return (ix * iy) / Math.max(1e-6, (F.x1 - F.x0) * (F.y1 - F.y0));
}

/** What the camera follows in a possession: the shooter while his shot is up, else the man with the
 * ball, the man boxing out in a rebound race, or the catcher of a pass in the air. */
export function subjectOf(p: Possession): Subject {
  const bp = ballPos(p);
  const ball = { cx: bp.cx, cz: bp.cz };
  const shot = p.ball?.kind === 'shot';
  let man: Body | null = null;
  if (shot) man = p.bodies[p.ball!.who];
  else if (p.handler !== null) man = p.bodies[p.handler];
  else if (p.rebounder !== undefined) man = p.bodies[p.rebounder];
  else if (p.ball && (p.ball.kind === 'pass' || p.ball.kind === 'lob')) man = p.bodies.find((b) => b.side === 'O' && Math.hypot(b.cx - p.ball!.to.cx, b.cz - p.ball!.to.cz) < 3) ?? null;
  return { at: man ? { cx: man.cx, cz: man.cz } : null, ball, flying: !!p.ball, shot };
}

/** The man guarding a body: the nearest man on the other side (the one his silhouette can stack
 * with), else nobody. */
export function guardOf(p: Possession, idx: number): Body | null {
  const o = p.bodies[idx];
  let best: Body | null = null;
  let bd = Infinity;
  for (const d of p.bodies) {
    if (d.side === o.side) continue;
    const r = Math.hypot(d.cx - o.cx, d.cz - o.cz);
    if (r < bd) {
      bd = r;
      best = d;
    }
  }
  return best;
}
