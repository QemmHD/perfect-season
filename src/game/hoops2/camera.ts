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
  /** the rim's centre, as a share of the safe box down from its top, when nobody has the ball (22% of
   * the height at the two V2 sizes) */
  rimRow: 0.165,
  /** (nba-3 review) the band the rim floats in with a man on the ball (share of the safe box from its
   * top: 20-24% of the height at 393 and 320), the row it puts him on (51-53% of the height), and how far
   * it goes there (0: pinned at rimRow). The handler's median then sits in V2's 50-55% whether the
   * play is out at the top of the key or in the paint */
  rimBandLo: 0.13,
  rimBandHi: 0.19,
  handRow: 0.735,
  handPull: 1,
  /** within this many feet of the rim (and 4 ft more, eased) the rim sits at the band's bottom */
  handNear: 16,
  /** the fixed zoom: feet of floor (at the focus) the safe box's height spans */
  span: 39,
  /** the camera's axis, as a share of the safe box down from its top (0.5 → 0.48 in the nba-3 review:
   * a slightly steeper look at the floor in front; it splits a release's shooter and defender a little more) */
  axisRow: 0.48,
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
  kYaw: 5,
  kZoom: 6,
  /** (nba-3 review) the follow's top speed: the rim (or the subject) never moves more than this many
   * safe-box heights a second on screen, so a new subject (a pass's catcher, a shot gone loose) is
   * panned to, never cut to (≤ 10 px a frame at 393×852, 60 fps) */
  vmax: 1.3,
  /** how fast the follow eases back inside the safe box's bounds when they jump (per second): the
   * bounds are a damped anchor; only the screen's own edges are a hard one */
  kClamp: 14,
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
  /** the yaw's sign changes only once the other side has been wanted clearly (the guard over 1.5 ft
   * ahead or behind and over 1 ft to the side) for yawWait seconds, and at least yawHold seconds
   * after the last change; never while the ball is in the air (nba-3 review: no swaying court) */
  yawAhead: 1.5,
  yawRight: 1,
  yawWait: 0.45,
  yawHold: 1.5,
  clutch: 1.06,
  replay: 1.35,
  /** the side-to-side margin the handler and the rim (its backboard too) keep from the screen's edges (px) */
  edge: 34,
  rimEdge: 60,
  /** the backboard's half-width (ft; it's 6 ft wide): kept on screen when the rim has to give up
   * rimEdge for the subject */
  board: 3,
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
  /** the yaw's chosen sign (+1/−1 of CAM.yaw off the base), how long the other sign has been wanted
   * (s), and how long since the sign last changed (s): `yawStep`'s hysteresis */
  ysign?: number;
  ypend?: number;
  ysince?: number;
}

export const camStart = (): CamState => ({ a: 0, b: 0, yaw: CAM.yaw, zoom: 1, tilt: 0, ready: false, ysign: 1, ypend: 0, ysince: 0 });

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
  /** the last-resort bounds: the subject (and the rim) actually inside the screen */
  hard: { aLo: number; aHi: number; bLo: number; bHi: number };
}

const NO_BOUNDS = { aLo: -Infinity, aHi: Infinity, bLo: -Infinity, bHi: Infinity };

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
    return { a, b, tilt: 0, ...NO_BOUNDS, hard: NO_BOUNDS };
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
  // (nba-3 review) the rim floats inside its band (CAM.rimBandLo-Hi of the box) toward the frame that
  // puts the man with the ball on CAM.handRow: a man out at the top of the key lifts the picture a
  // little, a man at the rim lowers it, so his median sits mid-screen whoever has the ball
  let bWant = bRim;
  if (!behind && sub.at && CAM.handPull > 0) {
    const boxH = box.safeBottom - box.safeTop;
    const top = Math.max(box.safeTop + boxH * CAM.rimBandLo, (box.hudBottom ?? box.safeTop) + CAM.rimPad);
    const bot = Math.max(box.safeTop + boxH * CAM.rimBandHi, top);
    const bA = rimF - rowOffset(c, top, fr.rim.h);
    const bB = rimF - rowOffset(c, bot, fr.rim.h);
    const bH = dot(sub.at, c.fwd) - rowOffset(c, box.safeTop + boxH * CAM.handRow, 0);
    // near the rim the play keeps one framing (the band's bottom, where a man in the paint wants it):
    // the zoom there never moves, not even by the rim's float (V2's fixed zoom near the rim)
    const near = Math.min(1, Math.max(0, (Math.hypot(sub.at.cx - fr.rim.cx, sub.at.cz - fr.rim.cz) - CAM.handNear) / 4));
    const want = bB + (Math.min(Math.max(bH, Math.min(bA, bB)), Math.max(bA, bB)) - bB) * near;
    bWant = bRim + (want - bRim) * CAM.handPull;
  }
  const b = Math.min(Math.max(bWant, bLo), bHi);
  // across: a dead zone round the subject, leaning toward a ball in the air
  const follow = sub.flying && !sub.shot ? dot(at, c.across) * (1 - CAM.ballShare) + dot(sub.ball, c.across) * CAM.ballShare : dot(at, c.across);
  let a = st.ready ? st.a : follow;
  if (follow > a + CAM.dead) a = follow - CAM.dead;
  else if (follow < a - CAM.dead) a = follow + CAM.dead;
  // the subject, then the rim (it's the target), inside the screen's sides
  const cb = makeCam(W, H, box, fr.yaw, fr.zoom, 0, b, 0);
  const side = (p: Pt2, h: number, edge: number) => {
    const pa = dot(p, c.across);
    const r = ((W / 2 - edge) * project(cb, p.cx, p.cz, h).z) / cb.f;
    return [pa - r, pa + r] as const;
  };
  const [sLo, sHi] = side(at, 0, CAM.edge);
  const [rLo, rHi] = side(fr.rim, fr.rim.h, CAM.rimEdge);
  let aLo = Math.max(sLo, rLo);
  let aHi = Math.min(sHi, rHi);
  if (aLo > aHi) {
    // both can't keep their margins (a man in the far corner): the subject keeps his, and the rim
    // with its whole backboard stays on screen (its margin given up first, never the board itself;
    // nba-3 review: the board was cut at the edge when the two split the difference)
    const [bdLo, bdHi] = side(fr.rim, fr.rim.h, CAM.board * project(cb, fr.rim.cx, fr.rim.cz, fr.rim.h).s + 4);
    aLo = Math.max(sLo, bdLo);
    aHi = Math.min(sHi, bdHi);
    // (still no room: the subject wins, the board as near on screen as he allows)
    if (aLo > aHi) aLo = aHi = sLo > bdHi ? sLo : sHi;
  }
  a = Math.min(Math.max(a, aLo), aHi);
  // the last resort: the subject's whole body, and the rim, on the screen at all
  const [hLo, hHi] = side(at, 0, 2);
  const [hrLo, hrHi] = side(fr.rim, fr.rim.h, 0);
  const hard = { aLo: Math.max(hLo, hrLo), aHi: Math.min(hHi, hrHi), bLo: -Infinity, bHi: Infinity };
  if (hard.aLo > hard.aHi) hard.aLo = hard.aHi = (hLo + hHi) / 2;
  // (a pass or a loose ball's new man is panned to: the hard bounds hold only a man with the ball)
  if (sub.flying) {
    hard.aLo = hrLo;
    hard.aHi = hrHi;
  } else if (sub.at) {
    const f = dot(sub.at, c.fwd);
    hard.bHi = f - rowOffset(c, H - 2, 0);
    hard.bLo = Math.min(hard.bHi, f - rowOffset(c, 2, CAM.head));
  }
  return { a, b, tilt, aLo, aHi, bLo, bHi, hard };
}

/** One frame of the follow: time-based damping (1 − e^(−k·dt)), the same end at 30 or 60 fps;
 * eased back inside the frame's bounds (CAM.kClamp), never faster than CAM.vmax on screen, and held
 * hard only inside the screen itself. */
export function camStep(st: CamState, fr: Frame, dt: number, reduced = false): CamState {
  const clampTo = (t: { aLo: number; aHi: number; bLo: number; bHi: number }, a: number, b: number) => ({ a: Math.min(Math.max(a, t.aLo), t.aHi), b: Math.min(Math.max(b, t.bLo), t.bHi) });
  if (!st.ready) {
    const zoom = fr.zoom * farZoom(fr);
    const t = camTarget({ ...st, yaw: fr.yaw, zoom }, { ...fr, zoom });
    return { ...st, a: t.a, b: t.b, yaw: fr.yaw, zoom, tilt: t.tilt, ready: true };
  }
  const k = reduced ? 2 : 1;
  const sdt = Math.max(0, Math.min(0.25, dt));
  const ease = (rate: number) => 1 - Math.exp(-rate * k * sdt);
  const yaw = st.yaw + (fr.yaw - st.yaw) * ease(CAM.kYaw);
  const ball = fr.subject.ball;
  const home = Math.hypot(ball.cx - fr.rim.cx, ball.cz - fr.rim.cz) < CAM.fixedWithin;
  const zoom = st.zoom + (fr.zoom * farZoom(fr) - st.zoom) * ease(home ? CAM.kZoomHome : CAM.kZoom);
  // a turn of the yaw orbits the camera round the rim: the rim keeps its place on screen (and its
  // size), so a turn never reads as a pan or a zoom
  const o = orbit(st, yaw, fr.rim);
  const t = camTarget({ ...st, ...o, yaw, zoom }, { ...fr, yaw, zoom });
  // the follow, then eased (not snapped) back inside the bounds: a new subject's bounds jump, and
  // the camera pans to them
  const free = { a: o.a + (t.a - o.a) * ease(CAM.kA), b: o.b + (t.b - o.b) * ease(CAM.kB) };
  const inside = clampTo(t, free.a, free.b);
  const kc = ease(CAM.kClamp);
  let da = free.a + (inside.a - free.a) * kc - o.a;
  let db = free.b + (inside.b - free.b) * kc - o.b;
  // never faster than vmax on screen: the rim's own motion this frame, measured (the pan that keeps it
  // pinned while the zoom eases is part of the step, so it's the rim on screen that's capped, not the pan)
  const tilt = st.tilt + (t.tilt - st.tilt) * ease(CAM.kB);
  const was = project(camOf(st, fr.W, fr.H, fr.box), fr.rim.cx, fr.rim.cz, fr.rim.h);
  // where the pan holds the rim exactly where it was under this frame's zoom and tilt (a zoom easing
  // home is a push-in about the rim, never a jolt of it); the capped step starts from there
  const c0 = makeCam(fr.W, fr.H, fr.box, yaw, zoom, 0, 0, tilt);
  const dot = (p: Pt2, v: Pt2) => p.cx * v.cx + p.cz * v.cz;
  const kb = dot(fr.rim, c0.fwd) - rowOffset(c0, was.y, fr.rim.h);
  const kz = project(makeCam(fr.W, fr.H, fr.box, yaw, zoom, 0, kb, tilt), fr.rim.cx, fr.rim.cz, fr.rim.h).z;
  const ka = dot(fr.rim, c0.across) - ((was.x - fr.W / 2) * kz) / c0.f;
  const keep = Number.isFinite(kb) && Number.isFinite(ka) ? { a: ka, b: kb } : { a: o.a, b: o.b };
  da += o.a - keep.a;
  db += o.b - keep.b;
  const moved = (l: number) => {
    const q = project(makeCam(fr.W, fr.H, fr.box, yaw, zoom, keep.a + da * l, keep.b + db * l, tilt), fr.rim.cx, fr.rim.cz, fr.rim.h);
    return Math.hypot(q.x - was.x, q.y - was.y);
  };
  const cap = CAM.vmax * Math.max(120, fr.box.safeBottom - fr.box.safeTop) * k * sdt;
  if (moved(1) > cap) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 8; i++) {
      const m = (lo + hi) / 2;
      if (moved(m) <= cap) lo = m;
      else hi = m;
    }
    da *= lo;
    db *= lo;
  }
  const held = clampTo(t.hard, keep.a + da, keep.b + db);
  return { ...st, ...held, yaw, zoom, tilt, ready: true };
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

/**
 * The yaw for this frame with its hysteresis kept in the camera state (nba-3 review): `yawFor`'s sign,
 * but changed only once the guard has been clearly on the other side on both axes (CAM.yawAhead,
 * CAM.yawRight) for CAM.yawWait seconds, at least CAM.yawHold seconds after the last change, and
 * never while `frozen` (a shot up or a pass in the air). A fresh camera takes `yawFor`'s sign at once.
 * Returns the yaw to aim at and the state's new hysteresis fields.
 */
export function yawStep(st: CamState, ball: Pt2, guard: Pt2 | null, dt: number, frozen: boolean, orient: Orient = 'up', defending = false): { yaw: number; ysign: number; ypend: number; ysince: number } {
  const base = orient === 'v2b' && defending ? Math.PI : 0;
  if (!st.ready) {
    const y = yawFor(ball, guard, base + (st.ysign ?? 1) * CAM.yaw, orient, defending);
    const ysign = Math.sign(y - base) || 1;
    return { yaw: y, ysign, ypend: 0, ysince: 0 };
  }
  let ysign = st.ysign ?? (Math.sign(st.yaw - base) || 1);
  let ypend = st.ypend ?? 0;
  let ysince = (st.ysince ?? 0) + Math.max(0, dt);
  let wanted = false;
  if (guard && !frozen) {
    const dir = base === 0 ? 1 : -1;
    const ahead = (guard.cx - ball.cx) * dir;
    const right = (guard.cz - ball.cz) * dir;
    const want = -Math.sign(ahead * right);
    wanted = want !== 0 && want !== ysign && Math.abs(ahead) >= CAM.yawAhead && Math.abs(right) >= CAM.yawRight;
  }
  ypend = wanted ? ypend + Math.max(0, dt) : 0;
  if (wanted && ypend >= CAM.yawWait && ysince >= CAM.yawHold) {
    ysign = -ysign;
    ypend = 0;
    ysince = 0;
  }
  return { yaw: base + ysign * CAM.yaw, ysign, ypend, ysince };
}

/**
 * One frame of the camera following a possession, exactly as the renderer does it (render.ts
 * follow; camera.test.ts films with this): the subject, the yaw with its hysteresis, the step.
 * `hold`: keep the yaw where it is (a replay).
 */
export function camFollow(st: CamState, p: Possession, view: { W: number; H: number; box: SafeBox; rim: Pt2 & { h: number }; zoom: number; spot?: Pt2 | null }, dt: number, reduced = false, hold = false): CamState {
  const sub = subjectOf(p);
  const ref = p.ball?.kind === 'shot' ? p.ball.who : p.handler;
  const man = ref !== null ? p.bodies[ref] : null;
  let ys: { yaw: number; ysign?: number; ypend?: number; ysince?: number } = { yaw: st.yaw };
  if (!hold && man) ys = yawStep(st, man, guardOf(p, man.idx), dt, !!p.ball);
  const next = camStep({ ...st, ...ys, yaw: st.ready ? st.yaw : ys.yaw }, { ...view, subject: sub, yaw: ys.yaw }, dt, reduced);
  return next;
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
