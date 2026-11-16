// merge: replace with nba's controls-geometry tokens (src/game/controls-geometry.css), then delete this file.
//
// The V2 A.5 controls geometry as numbers (Claude 2026-11-16, studio overhaul soccer-2): the same
// formulas as the tokens in ./geometry.css, for the tests (controls.test, hud-layout.test), for the
// gesture classifier's zones before the DOM exists, and for the one door to the action-safe box,
// `safeBox()`. In the browser soccer reads the real rects from the DOM; the QA checks those against
// these. Pure: no DOM.
import type { SafeBox } from './index';

/** Safe-area insets, CSS px: top, right, bottom, left. */
export interface Insets {
  t: number;
  r: number;
  b: number;
  l: number;
}
export interface Circle {
  cx: number;
  cy: number;
  d: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Geometry {
  W: number;
  H: number;
  a: Circle;
  b: Circle;
  c: Circle;
  d: Circle;
  /** where a thumb may start the stick */
  stickZone: Rect;
  /** the resting ring */
  stickGhost: Circle;
  bug: Rect;
  heat: Rect;
  pause: Rect;
  /** the toast line's one-line box (its bottom edge is the line) */
  toast: Rect;
  safe: SafeBox;
}

/** 0 at 320 px wide, 1 at 393 and over (the tokens' interpolation). */
const kOf = (W: number) => Math.max(0, Math.min(1, (W - 320) / 73));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Every element's place for a viewport W x H with these insets (portrait; `land`: sideways). */
export function geometryFor(W: number, H: number, ins: Insets, land = false): Geometry {
  const k = land ? 1 : kOf(W);
  const t = (a320: number, a393: number) => lerp(a320, a393, k);
  const btn = (d: number, r: number, b: number, bLand?: number): Circle => ({ cx: W - ins.r - r - d / 2, cy: H - ins.b - (land && bLand !== undefined ? bLand : b) - d / 2, d });
  const stickD = t(104, 120);
  const zoneTop = land ? H * 0.3 : H * 0.45;
  const bugW = t(200, 232);
  const bugH = t(34, 40);
  const bugTop = ins.t + t(4, 6);
  const toastH = t(24, 28);
  // the Heat bar's top is --heat-t below the safe-area edge (V2: 393 at y 108 under a bug at 65..105)
  const heatTop = ins.t + (land ? 49 : t(40, 49));
  const toastBottom = land ? heatTop + 6 + 8 + toastH : H - t(164, 234);
  return {
    W,
    H,
    a: btn(t(84, 92), t(12, 24), t(16, 34), 20),
    b: btn(t(56, 64), t(102, 123), t(4, 8)),
    c: btn(t(44, 48), t(98, 119), t(78, 100), 86),
    d: btn(t(44, 48), t(16, 29), t(110, 142), 128),
    stickZone: { x: 0, y: zoneTop, w: ins.l + W * (land ? 0.4 : 0.48), h: H - ins.b - zoneTop },
    stickGhost: { cx: ins.l + t(18, 24) + stickD / 2, cy: H - ins.b - (land ? 20 : t(20, 28)) - stickD / 2, d: stickD },
    bug: { x: (W - bugW) / 2, y: bugTop, w: bugW, h: bugH },
    heat: { x: (W - bugW) / 2, y: heatTop, w: bugW, h: t(5, 6) },
    pause: { x: ins.l + t(6, 12), y: ins.t + (land ? 6 : t(0, 4)), w: 44, h: 44 },
    toast: { x: 12, y: toastBottom - toastH, w: W - 24, h: toastH },
    safe: { x: 0, y: ins.t + (land ? 64 : 56), w: W, h: H - (land ? 24 : t(200, 284)) - (ins.t + (land ? 64 : 56)) },
  };
}

/** The circle's bounding box. */
export const rectOf = (c: Circle): Rect => ({ x: c.cx - c.d / 2, y: c.cy - c.d / 2, w: c.d, h: c.d });

/** The gap between two circles' edges (negative: they overlap). */
export const gapOf = (p: Circle, q: Circle) => Math.hypot(p.cx - q.cx, p.cy - q.cy) - (p.d + q.d) / 2;

/** Do two rects meet? */
export const meets = (p: Rect, q: Rect) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;

/**
 * The fixed action-safe box (V2 A.5): the controlled player and his target stay inside it. The one
 * function soccer reads it through (the camera in soccer-3).
 */
export function safeBox(W: number, H: number, ins: Insets, land = false): SafeBox {
  return geometryFor(W, H, ins, land).safe;
}
