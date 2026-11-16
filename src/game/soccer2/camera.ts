// The soccer broadcast camera (Claude 2026-11-16, studio overhaul soccer-3; Game Design V2 B.3.3, audit
// V-1/V-2). Pure: no DOM, no clocks, no randomness. render.ts draws through it, scripts/soccer/cam.ts
// measures it and camera.test.ts holds it to the V1-V3 targets.
//
// Portrait is a high, steep, long-lens broadcast view:
//  - about 34 m across at the carrier's row (32 m on a 320 px phone), looking down at 0.9 rad;
//  - the lens's anchor is a ground point that glides after the man on the ball (never cut: a pass's
//    receiver or a new taker takes over without the picture jumping; soccer-3 review fix). The anchor
//    sits on the lens axis, so moving the framing up or down the screen is a rigid shift (a shift
//    lens) and every constraint below is a simple interval;
//  - the frame follows 85% of the ball's x and looks ahead (velocity × 0.6 s, at most 6 m, plus 3 m
//    toward the goal);
//  - the framing pass keeps the carrier, the stands (≤ 12% of the height) and, inside 30 m, the goal
//    mouth in V2's action-safe box (y 115-568 at 393×852) as hard limits, then fits his two nearest
//    options and as many other teammates as it can across;
//  - zoom eases out (at most 15%) only for a through ball's target, in 0.05 steps, at most four
//    changes a second (one cut under reduced motion); the stoppage attack (Clutch) sits 6% tighter;
//  - corners are framed from the flag's side: the taker 20 px inside his edge, the whole goal mouth and
//    four of his five box men on screen, the goal line in the upper third. That needs about 40 m across
//    at the flag's row (zoom 0.75-0.85; the waiver in the team doc), since the flag and the far post are
//    36.8 m apart; penalties put the goal in the upper third.
// Landscape keeps the earlier camera (it is not the default: the app is portrait-locked).
//
// The lens is long (half-angle 0.2 rad) for a measured reason: the goal mouth must stay ≥ 60 px wide
// from 30 m out on a 320 px phone, which a wide lens (more perspective) cannot give at 32-36 m across.
// The players' sprites are drawn larger than the ground scale (`ART`) and seen less steeply
// (`SPRITE_TILT`) so the controlled man is 34 px tall at 393 (V2 C.1.2); the goal frame, the ball's height
// and anything else with a height are lifted by the same factor (`HEIGHT_K`), so a keeper still fits
// under his crossbar.
import { type PCam, pcam, project } from '../pixel/persp';
import { GH, GHALF, GX, PL, PW } from './engine';
import type { Attack, Body, Pt } from './types';

/** A screen rectangle (canvas px = CSS px). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CAM = {
  /** metres across at the carrier's row: 34 at 393 px and wider phones, 32 at 320 (V1 allows 32-36) */
  across: 34,
  acrossSmall: 32,
  /** the look-down angle at the carrier (radians) */
  pitch: 0.9,
  /** the lens's half-angle across the screen (radians): a long broadcast lens */
  fov: 0.2,
  /** the share of the ball's x the frame follows (85-100%) */
  follow: 0.85,
  /** look-ahead: velocity × lookT seconds, at most lookMax m, plus lookGoal m toward goal */
  lookT: 0.6,
  lookMax: 6,
  lookGoal: 3,
  /** how far (share of the width) the frame may pan off the ball's line to fit one more teammate */
  panFor: 0.16,
  /** the carrier's resting row inside the safe box (0 top, 1 bottom) */
  row: 0.7,
  /** zoom: out to 0.85 at most (15%), in 0.05 steps, at most one change per zoomGap s */
  zoomMin: 0.85,
  zoomStep: 0.05,
  zoomGap: 0.25,
  /** the stoppage attack (Clutch, V2 B.0.4): 6% tighter */
  clutch: 1.06,
  /** the stands (and sky) may take at most this share of the height */
  stands: 0.12,
  /** the goal mouth is framed while the carrier is inside this distance (m) */
  goalNear: 30,
  /** the follow's easing per 60 Hz frame (x, y) */
  ease: { x: 0.08, y: 0.09 },
  /** margins inside the safe box for the carrier's feet: above (his body), below, either side (px) */
  feet: { top: 34, bottom: 6, side: 14 },
  /**
   * The lens's ground anchor follows the man on the ball, eased (share per 60 Hz frame, at most `anchorMax`
   * m a frame), and is never cut: when the subject changes (a pass's receiver, a set piece's taker) the
   * picture stays where it is and the anchor glides over (soccer-3 review fix: a pass used to jump the
   * picture by the pass's length).
   */
  anchorEase: 0.2,
  anchorMax: 1.2,
  /** the hard framing limits pull the frame at most this many px per 60 Hz frame (no cut on a switch) */
  clampRate: 14,
  /** and the anchor's screen spot moves at most this many px per 60 Hz frame in all (the picture glides) */
  maxMove: 15,
  /**
   * Corners: the flag's row is framed this many metres across (about 40, a zoom of 0.80-0.85), because
   * the taker at the flag and the far post are 36.8 m apart: at 32-36 m across the taker and the whole
   * goal mouth cannot both be on screen (team doc, soccer-3 review fixes: the corner width waiver).
   */
  cornerZoomMin: 0.75,
  /** the corner taker's distance from his screen edge (px) */
  cornerEdge: 20,
} as const;

/** The far stand's base (pitch metres along): the texture's wall in render.ts stands here. */
export const WALL_Y = 111.5;
/** The controlled man's height on screen at 393 px and at 320 px (V2 C.1.2; V3 asks 34 ± 2 and ≥ 30). */
export const CTRL_PX = { wide: 34, small: 35 } as const;
/** The sprites' own look-down angle: they read as today's (C.1), not as the steep ground. */
export const SPRITE_TILT = 0.6;
/** A sprite drawn `px` tall stands about this share of `px` on screen at SPRITE_TILT (the rig's foreshortening). */
export const SPRITE_VISIBLE = 0.78;
/** the reference height (m) the controlled man's size is set for */
const REF_HT = 1.8;

/** 0 at 320 px wide, 1 at 393 and over. */
const kW = (W: number) => Math.max(0, Math.min(1, (W - 320) / 73));

/** The ground scale at the carrier (px per metre) before zoom and Clutch. */
export const baseScale = (W: number) => W / (CAM.acrossSmall + (CAM.across - CAM.acrossSmall) * kW(W));

/**
 * The sprites' size factor: a man of REF_HT stands CTRL_PX tall at the carrier's row (the "per-sport
 * constant" of V2 C.6). It is fixed per screen width, so a zoom shrinks the players with the pitch.
 */
export function artOf(W: number): number {
  const target = CTRL_PX.small + (CTRL_PX.wide - CTRL_PX.small) * kW(W);
  return target / (REF_HT * baseScale(W) * SPRITE_VISIBLE);
}

/** How much a world height is lifted when drawn, so the goal frame and the ball's height match the sprites. */
export function heightK(W: number): number {
  return (artOf(W) * Math.cos(SPRITE_TILT)) / Math.cos(CAM.pitch);
}

/**
 * The sprites' scale (px per metre of body) at ground scale `s`, snapped to steps of SPRITE_STEP so
 * men at nearly the same depth share sprite sizes (V2 C.6 "snapped to quarter steps"): far fewer
 * sprites to rasterise, so the per-frame build budget is rarely spent and stale frames stay rare.
 */
export const SPRITE_STEP = 2.5;
export const spriteScale = (s: number, art: number) => Math.max(SPRITE_STEP, Math.round((s * art) / SPRITE_STEP) * SPRITE_STEP);

/** The sprite's size argument (`drawBody`'s px) for a man `htM` tall at ground scale `s`. */
export const spritePxFor = (htM: number, s: number, art: number) => {
  const raw = Math.max(8, Math.round(htM * spriteScale(s, art)));
  return raw > 14 ? raw - (raw % 2) : raw;
};
/** About how tall that sprite stands on screen (px). */
export const spriteVisible = (htM: number, s: number, art: number) => Math.round(spritePxFor(htM, s, art) * SPRITE_VISIBLE);

/** The ball's radius on screen (its dark outline adds 1 px round it): ≥ 2, so the ball is ≥ 6 px across. */
export const ballR = (s: number, art: number) => Math.max(2, Math.round(s * art * 0.12));

/**
 * The camera with the ground point `a` on the lens axis at screen (ax, ay), `s` px per metre there.
 * Moving (ax, ay) shifts the whole picture rigidly in y; in x it pans the camera across.
 */
export function anchoredCam(W: number, H: number, a: Pt, ax: number, ay: number, s: number): PCam {
  const f = W / 2 / Math.tan(CAM.fov);
  const z = f / s;
  const cs = Math.cos(CAM.pitch);
  const sn = Math.sin(CAM.pitch);
  // the screen's x centre is the ground x the anchor's row shows there
  const cx = a.x - (ax - W / 2) / s;
  return { W, H, cx, cy: a.y - z * cs, ch: z * sn, pitch: CAM.pitch, f, hy: ay };
}

/** The earlier camera, kept for landscape (pcam with today's parameters). */
function landscapeCam(W: number, H: number, fx: number, fy: number, zoom: number): PCam {
  return pcam(W, H, fx, fy, { row: 0.66, s: Math.max(9, H / 15) * zoom, horizon: 0.08, pitch: 0.36, fov: 0.62 });
}
/** The earlier camera's aim (landscape): the ball, a little toward the goal. */
function landscapeTarget(a: Attack): Pt {
  const o = a.ball.owner !== null ? a.bodies[a.ball.owner] : null;
  const at = o ?? a.ball;
  const sp = a.setPiece;
  let y = at.y + 2.5;
  if (sp?.kind === 'corner') return { x: GX + (a.ball.x - GX) * 0.42, y: PL - 17 };
  else if (sp?.kind === 'penalty') y = PL - 13.5;
  else if (sp) y = sp.spot.y + 2;
  y = Math.max(44, Math.min(y, PL - 12.5));
  return { x: PW / 2 + (Math.max(6, Math.min(PW - 6, at.x)) - PW / 2) * 0.6, y };
}

/** What the camera is told each frame besides the attack. */
export interface CamView {
  W: number;
  H: number;
  /** V2's action-safe box (v2/geometry safeBox), canvas px */
  safe: Box;
  /** the stoppage attack: 6% tighter */
  clutch?: boolean;
  /** reduced motion: zoom steps cut at once (one change) */
  reduced?: boolean;
  /** an instant replay: push in on this spot */
  replay?: Pt | null;
}

/** The camera's memory between frames. */
export interface CamState {
  /** the anchor's screen spot, eased */
  ax: number;
  ay: number;
  /** the zoom in effect (a multiple of zoomStep) and when it last changed (attack seconds) */
  zoom: number;
  zoomAt: number;
  /** zoom changes so far (the harness counts them) */
  changes: number;
  /** the attack this state framed last (a new attack starts framed, not eased) */
  key: unknown;
  /** the lens's ground anchor (pitch m), eased toward the subject; and the scale used last frame */
  gx: number;
  gy: number;
  s: number;
  /** the subject the frame is on (a body id), and how many times it has changed (a pass, a new taker) */
  subj: number;
  switches: number;
  /** landscape's eased aim */
  land: Pt | null;
  landZoom: number;
}

export const newCamState = (): CamState => ({ ax: 0, ay: 0, zoom: 1, zoomAt: -Infinity, changes: 0, key: null, gx: 0, gy: 0, s: 0, subj: -1, switches: 0, land: null, landZoom: 1 });

/** The man the camera frames: the one on the ball, else the set-piece taker, else the one the stick has. */
export function subjectOf(a: Attack): Body {
  if (a.ball.owner !== null) return a.bodies[a.ball.owner];
  if (a.taker !== null) return a.bodies[a.taker];
  return a.bodies[a.ctrl];
}

/** A through ball's (or lofted through ball's) man while it is struck or in the air. */
export function throughTarget(a: Attack): Body | null {
  const k = a.kick;
  if (k && k.to !== null && (k.kind === 'through' || k.loftedThrough)) return a.bodies[k.to];
  const f = a.ball.flight;
  if (f && f.to !== null && f.kind === 'through') return a.bodies[f.to];
  return null;
}

/** His two nearest teammates ahead of or level with him (his options), nearest first. */
export function optionsOf(a: Attack, c: Body): Body[] {
  return a.bodies
    .filter((b) => b.side === c.side && b.role !== 'gk' && b !== c && b.y > c.y - 12)
    .map((b) => ({ b, d: Math.hypot(b.x - c.x, b.y - c.y) }))
    .sort((p, q) => p.d - q.d)
    .slice(0, 2)
    .map((o) => o.b);
}

/** The goal mouth's corners (posts at the line, the crossbar's ends lifted like everything with a height). */
const goalPts = (hk: number) => [
  { x: GX - GHALF, y: PL, h: 0 },
  { x: GX + GHALF, y: PL, h: 0 },
  { x: GX - GHALF, y: PL, h: GH * hk },
  { x: GX + GHALF, y: PL, h: GH * hk },
];

/** An interval [lo, hi]; empty when lo > hi. */
type Span = [number, number];
const meet = (p: Span, q: Span): Span => [Math.max(p[0], q[0]), Math.min(p[1], q[1])];
const clampTo = (v: number, s: Span) => Math.max(s[0], Math.min(s[1], v));
const ok = (s: Span) => s[0] <= s[1];

interface Want {
  x: number;
  y: number;
  h?: number;
  /** keep inside [x0, x1] × [y0, y1] (screen) */
  box: Box;
}

/**
 * The anchor's screen spans (x, y) that keep a ground point inside `w.box`, for a camera with the
 * anchor at the ground point `a` and scale `s`. The picture shifts rigidly in y with the anchor's row;
 * in x the screen offset of a point is (s_p / s) × the anchor's shift plus a constant.
 */
function spansFor(W: number, H: number, a: Pt, s: number, w: Want): { x: Span; y: Span } {
  // a reference camera with the anchor in the middle of the screen
  const ref = anchoredCam(W, H, a, W / 2, H / 2, s);
  const p = project(ref, w.x, w.y, w.h ?? 0);
  const oy = p.y - H / 2;
  // x: the point's screen x = W/2 + (ax - W/2) * (p.s / s) + (p.x - W/2)
  const k = p.s / s;
  const x0 = W / 2 + (w.box.x - p.x) / k;
  const x1 = W / 2 + (w.box.x + w.box.w - p.x) / k;
  return { x: [Math.min(x0, x1), Math.max(x0, x1)], y: [w.box.y - oy, w.box.y + w.box.h - oy] };
}

/** The scale the frame wants now (zoom 1, before Clutch): 1, or out to 0.85 for a through ball or a corner. */
export function zoomWanted(a: Attack, view: CamView): number {
  if (a.setPiece?.kind === 'corner') return cornerZoom(a, view);
  const t = throughTarget(a);
  if (!t) return 1;
  const c = subjectOf(a);
  const s0 = baseScale(view.W) * (view.clutch ? CAM.clutch : 1);
  // the widest zoom step that frames both him and the target
  for (let z = 1; z >= CAM.zoomMin - 1e-9; z -= CAM.zoomStep) {
    const s = s0 * z;
    const box = view.safe;
    const sc = spansFor(view.W, view.H, c, s, { x: c.x, y: c.y, box: inner(box) });
    const st = spansFor(view.W, view.H, c, s, { x: t.x, y: t.y, box: inner(box) });
    if (ok(meet(sc.x, st.x)) && ok(meet(sc.y, st.y))) return Math.round(z / CAM.zoomStep) * CAM.zoomStep;
  }
  return CAM.zoomMin;
}

/**
 * A corner's zoom: the tightest step (from 1 out to cornerZoomMin) at which the taker stands
 * cornerEdge px or more inside his edge of the screen, the whole goal mouth is on screen and at least
 * four of his five teammates in the box are too.
 */
export function cornerZoom(a: Attack, view: CamView): number {
  const c = subjectOf(a);
  const s0 = baseScale(view.W) * (view.clutch ? CAM.clutch : 1);
  const { W, H } = view;
  const scr: Box = { x: 2, y: 0, w: W - 4, h: H };
  const mates = a.bodies.filter((b) => b.side === c.side && b.role !== 'gk' && b !== c);
  const need = Math.min(4, mates.length);
  let z = 1;
  for (; z >= CAM.cornerZoomMin - 1e-9; z -= CAM.zoomStep) {
    const s = s0 * z;
    let xs = spansFor(W, H, c, s, { x: c.x, y: c.y, box: { x: CAM.cornerEdge, y: 0, w: W - 2 * CAM.cornerEdge, h: H } }).x;
    for (const g of goalPts(heightK(W))) xs = meet(xs, spansFor(W, H, c, s, { ...g, box: scr }).x);
    if (!ok(xs)) continue;
    // the teammates the span can still take, nearest the taker's side first
    const order = mates.map((b) => ({ b, q: spansFor(W, H, c, s, { x: b.x, y: b.y, box: scr }).x })).sort((p, q) => Math.abs(p.b.x - c.x) - Math.abs(q.b.x - c.x));
    let n = 0;
    for (const { q } of order) {
      const m = meet(xs, q);
      if (ok(m)) {
        xs = m;
        n++;
      }
    }
    if (n >= need) break;
  }
  return Math.round(Math.max(CAM.cornerZoomMin, z) / CAM.zoomStep) * CAM.zoomStep;
}

/** The carrier's feet stay this far inside the safe box. */
const inner = (b: Box): Box => ({ x: b.x + CAM.feet.side, y: b.y + CAM.feet.top, w: Math.max(1, b.w - 2 * CAM.feet.side), h: Math.max(1, b.h - CAM.feet.top - CAM.feet.bottom) });

/**
 * The framing pass: where the lens's anchor `g` (a ground point near the man on the ball; the man
 * himself when omitted) should sit on screen this frame, at scale `s`. Priority: the carrier (always),
 * the stands (≤ 12%), the goal mouth inside 30 m and at every set piece, then his options (and a
 * through ball's man). The resting spot is the look-ahead's.
 */
export function frameFor(a: Attack, view: CamView, s: number, g?: Pt): { ax: number; ay: number; hard: { x: Span; y: Span }; stands: number } {
  const { W, H, safe } = view;
  const c = subjectOf(a);
  const at = g ?? c;
  const hk = heightK(W);
  const box = safe;
  const sp = a.setPiece;
  const corner = sp?.kind === 'corner';
  // a corner's taker stands cornerEdge px inside his edge (the zoom made room for the goal and the box)
  const mustBox = corner ? { ...inner(box), x: Math.max(box.x, CAM.cornerEdge), w: Math.min(box.x + box.w, W - CAM.cornerEdge) - Math.max(box.x, CAM.cornerEdge) } : inner(box);
  const must = spansFor(W, H, at, s, { x: c.x, y: c.y, box: mustBox });
  // where he rests: the look-ahead point on the carrier's row, the frame centred on 85% of its x
  const v = Math.hypot(c.vx, c.vy);
  const k = v * CAM.lookT > CAM.lookMax ? CAM.lookMax / (v * CAM.lookT) : 1;
  const toGoal = Math.max(1e-6, Math.hypot(GX - c.x, PL - c.y));
  const look = { x: c.x + c.vx * CAM.lookT * k + ((GX - c.x) / toGoal) * CAM.lookGoal, y: c.y + c.vy * CAM.lookT * k + ((PL - c.y) / toGoal) * CAM.lookGoal };
  const centre = GX + (look.x - GX) * CAM.follow;
  // a reference camera with the anchor in the middle of the screen: a point's screen x moves by
  // (its scale / s) × the anchor's x, and every screen y moves with the anchor's y
  const ref = anchoredCam(W, H, at, W / 2, H / 2, s);
  const pc = project(ref, c.x, c.y);
  const kc = pc.s / s;
  const axFor = (want: number) => W / 2 + (want - pc.x) / kc;
  let ax = axFor(W / 2 + (c.x - centre) * pc.s);
  // the look-ahead point sits on the resting row; he sits that much below it
  const rest = box.y + box.h * CAM.row;
  const lookOff = project(ref, look.x, look.y).y - H / 2;
  let ay = rest - lookOff;
  const goalLine = project(ref, GX, PL).y - H / 2;
  if (corner) {
    // from the flag's side: the taker near his edge, the goal line as low in the upper third as the
    // stands allow (the stands' limit below holds it)
    ax = axFor(sp.spot.x < GX ? CAM.cornerEdge + 2 : W - CAM.cornerEdge - 2);
    ay = H * 0.3 - goalLine;
  } else if (sp?.kind === 'penalty') ay = Math.max(box.y + 40, H * 0.25) - goalLine;
  // the stands: the far wall's base at most CAM.stands of the height down
  const wallOff = project(ref, GX, WALL_Y).y - H / 2;
  const stands: Span = [-Infinity, H * CAM.stands - wallOff];
  // the stands win over his feet's top margin (the man on the goal line at a corner): then only his
  // feet need be inside the box
  let yHard = meet(must.y, stands);
  if (!ok(yHard)) yHard = meet(spansFor(W, H, at, s, { x: c.x, y: c.y, box: { ...box, h: box.h - CAM.feet.bottom } }).y, stands);
  const standsHold = ok(yHard);
  if (!ok(yHard)) yHard = must.y;
  // the goal mouth inside 30 m (and at every set piece near it)
  const dGoal = Math.hypot(c.x - GX, PL - c.y);
  let xs = must.x;
  let ys = yHard;
  if (dGoal <= CAM.goalNear || sp) {
    let gx = xs;
    let gy = ys;
    // at a corner the mouth may use the whole screen across (the box is the action, not the HUD's sides)
    const gBox = corner ? { x: 2, y: box.y, w: W - 4, h: box.h } : box;
    for (const q0 of goalPts(hk)) {
      const q = spansFor(W, H, at, s, { ...q0, box: gBox });
      gx = meet(gx, q.x);
      gy = meet(gy, q.y);
    }
    if (ok(gx)) xs = gx;
    if (ok(gy)) ys = gy;
  }
  const hard = { x: xs, y: ys };
  // a through ball's man and his two options (across and along), then every other teammate ahead of
  // him (across only): each kept if he still fits
  const opts = optionsOf(a, c);
  const tt = throughTarget(a);
  const wants: { b: Body; both: boolean }[] = [...(tt && tt !== c ? [tt] : []), ...opts].map((b) => ({ b, both: true }));
  for (const b of a.bodies)
    if (b.side === c.side && b.role !== 'gk' && b !== c && b !== tt && !opts.includes(b) && b.y > c.y - 12) wants.push({ b, both: false });
  wants.sort((p, q) => Number(q.both) - Number(p.both) || Math.hypot(p.b.x - c.x, p.b.y - c.y) - Math.hypot(q.b.x - c.x, q.b.y - c.y));
  // at a corner the box's men may stand anywhere across the screen
  const mBox = corner ? { x: 2, y: box.y, w: W - 4, h: box.h } : box;
  for (const { b, both } of wants) {
    const q = spansFor(W, H, at, s, { x: b.x, y: b.y, box: mBox });
    const nx = meet(xs, q.x);
    // another teammate is worth a small pan only: the frame keeps following the ball
    if (ok(nx) && (both || corner || Math.abs(clampTo(ax, nx) - ax) <= W * CAM.panFor)) xs = nx;
    if (!both) continue;
    const ny = meet(ys, q.y);
    if (ok(ny)) ys = ny;
  }
  return { ax: clampTo(ax, xs), ay: clampTo(ay, ys), hard, stands: standsHold ? stands[1] : Infinity };
}

/** The scale in effect (px per metre at the carrier): base × zoom × Clutch. */
export const scaleOf = (view: CamView, zoom: number) => baseScale(view.W) * zoom * (view.clutch ? CAM.clutch : 1);

/**
 * One frame of the camera: the zoom (quantised, rate-limited), the eased framing, the carrier held
 * inside the box. `dt` is the real frame time (s); `t` the attack's clock (s) for the zoom's rate limit.
 * Returns the camera to draw with; `st` is updated.
 */
export function camStep(st: CamState, a: Attack, view: CamView, dt: number, t: number): PCam {
  const { W, H } = view;
  if (W > H) {
    // landscape: the earlier camera, eased
    const want = landscapeTarget(a);
    const zt = view.replay ? 1.3 : a.setPiece?.kind === 'corner' ? 0.68 : 1;
    st.landZoom += (zt - st.landZoom) * 0.08;
    if (!st.land || st.key !== a) st.land = want;
    st.key = a;
    st.land = { x: st.land.x + (want.x - st.land.x) * 0.07, y: st.land.y + (want.y - st.land.y) * 0.08 };
    return landscapeCam(W, H, st.land.x, st.land.y, st.landZoom);
  }
  if (view.replay) {
    // an instant replay: in on the spot, 1.3x, the spot a little above the middle
    const s = baseScale(W) * 1.3;
    const p = { x: Math.max(14, Math.min(PW - 14, view.replay.x)), y: Math.min(view.replay.y, PL - 4) };
    return anchoredCam(W, H, p, W / 2, view.safe.y + view.safe.h * 0.55, s);
  }
  const fresh = st.key !== a;
  const c = subjectOf(a);
  // the zoom: whole steps toward what the frame wants, one step at most every zoomGap s (a new attack
  // or reduced motion: straight there, one change)
  const want = Math.round(zoomWanted(a, view) / CAM.zoomStep) * CAM.zoomStep;
  if (fresh) {
    st.zoom = want;
    st.zoomAt = t;
  } else if (Math.abs(want - st.zoom) > 1e-6 && t - st.zoomAt >= CAM.zoomGap) {
    st.zoom = view.reduced ? want : st.zoom + Math.sign(want - st.zoom) * CAM.zoomStep;
    st.zoom = Math.round(st.zoom / CAM.zoomStep) * CAM.zoomStep;
    st.zoomAt = t;
    st.changes++;
  }
  const s = scaleOf(view, st.zoom);
  const n = Math.max(0, Math.min(6, dt * 60));
  if (fresh) {
    st.gx = c.x;
    st.gy = c.y;
  } else {
    // the anchor glides toward the man on the ball, and the anchor's screen spot is re-expressed so the
    // picture does not move with it: last frame's camera shows the new anchor where (ax, ay) now are
    if (c.id !== st.subj) st.switches++;
    const prev = anchoredCam(W, H, { x: st.gx, y: st.gy }, st.ax, st.ay, st.s || s);
    const dx = c.x - st.gx;
    const dy = c.y - st.gy;
    const d = Math.hypot(dx, dy);
    const e = 1 - Math.pow(1 - CAM.anchorEase, n);
    const m = Math.min(d * e, CAM.anchorMax * Math.max(1, n));
    if (d > 1e-9) {
      st.gx += (dx / d) * m;
      st.gy += (dy / d) * m;
      const q = project(prev, st.gx, st.gy);
      st.ax = q.x;
      st.ay = q.y;
    }
  }
  st.subj = c.id;
  // a zoom step scales the picture about the screen's middle, not the anchor (at a corner the anchor is
  // the taker at the screen's edge, and the far side would swing by twice as much)
  if (!fresh && st.s && Math.abs(s - st.s) > 1e-9) {
    const k = s / st.s;
    st.ax = W / 2 + (st.ax - W / 2) * k;
    st.ay = H / 2 + (st.ay - H / 2) * k;
  }
  const g = { x: st.gx, y: st.gy };
  const goal = frameFor(a, view, s, g);
  if (fresh) {
    st.ax = clampTo(goal.ax, goal.hard.x);
    st.ay = clampTo(goal.ay, goal.hard.y);
    st.key = a;
  } else {
    const x0 = st.ax;
    const y0 = st.ay;
    st.ax += (goal.ax - st.ax) * (1 - Math.pow(1 - CAM.ease.x, n));
    st.ay += (goal.ay - st.ay) * (1 - Math.pow(1 - CAM.ease.y, n));
    // the easing never lets the man on the ball leave the safe box, the stands grow past 12% or (inside
    // 30 m) the goal mouth leave the frame; after a switch the limits pull the frame in at clampRate px a
    // frame, so the picture glides rather than cuts
    const r = CAM.clampRate * Math.max(1, n);
    const pull = (v: number, span: Span) => v + Math.max(-r, Math.min(r, clampTo(v, span) - v));
    st.ax = pull(st.ax, goal.hard.x);
    st.ay = pull(st.ay, goal.hard.y);
    const mv = Math.hypot(st.ax - x0, st.ay - y0);
    const cap = CAM.maxMove * Math.max(1, n);
    if (mv > cap) {
      st.ax = x0 + ((st.ax - x0) * cap) / mv;
      st.ay = y0 + ((st.ay - y0) * cap) / mv;
    }
    // the stands' 12% holds every frame (the anchor's glide keeps that limit's own motion to a pixel or two)
    st.ay = Math.min(st.ay, goal.stands);
  }
  st.s = s;
  return anchoredCam(W, H, g, st.ax, st.ay, s);
}

/** The stands' share of the screen height for a camera: the far wall's base row over the height. */
export const standsShare = (cam: PCam) => Math.max(0, Math.min(1, project(cam, cam.cx, WALL_Y).y / cam.H));

/** Metres across the screen at a ground point's row. */
export const widthAt = (cam: PCam, p: Pt) => cam.W / project(cam, p.x, p.y).s;
