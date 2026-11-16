// The art pixel (Game Design V2 C.1.2, studio overhaul players-2): how big one pixel of a player
// sprite is on the phone, and how sprites are put on the canvas so every art pixel covers a whole
// number of the phone's device pixels (no smeared or uneven pixels).
//
// Units: a "view px" is the renderer's own unit (the canvas's CSS size: the 390 design frame's px,
// so one view px is k CSS px on screen, k the stage scale) and a "device px" is the phone's. The
// canvas backing store has `backing` canvas px per view px.
//
// Two options are built (players-2 measured them at 4x CPU and DPR 3; the numbers are in
// docs/studio-overhaul/players.md):
// - 'A': the backing store at device resolution (canvas px = device px). Sprites are rasterised at art
//   size, V2's 1 art px = 1.5 design px, rounded to a whole number of device px (devPerArt: 4 or 5 on
//   a 3x phone), and blitted at that integer scale. The floor and the HUD keep drawing in view px
//   through one setTransform(backing).
// - 'C': the backing store at view resolution (today's grain): 1 art px = 1 view px, blitted 1:1.
// A 2x backing ("B") is not offered: at DPR 3 it can't give V2's 1.5 design px art pixel a whole
// number of device px (3 canvas px = 4.5 device px), and at 1 view px it draws what 'C' draws.
import type { Sprite } from './body';

export type ArtOption = 'A' | 'C';

/** The option the game uses (players-2's measurement); `?artpx=A` or `?artpx=C` overrides it to compare on a device. */
export const ADOPTED: ArtOption = 'C';

/** V2's art pixel: 1.5 design px. */
export const DESIGN_PER_ART = 1.5;

/** Device px per art px for a stage scale `k` (CSS px per design px) and device pixel ratio: a whole number, at least 2. */
export function devPerArt(k: number, dpr: number): number {
  return Math.max(2, Math.round(DESIGN_PER_ART * k * dpr));
}

export interface ArtScale {
  option: ArtOption;
  /** canvas px per view px */
  backing: number;
  /** canvas px per art px (a whole number) */
  canvasPerArt: number;
  /** view px per art px */
  viewPerArt: number;
  /** the art px height to rasterise a sprite `viewH` view px tall at */
  artPxFor(viewH: number): number;
}

/**
 * The art scale for an option, given the device px per view px the canvas is shown at
 * (`devPerView` = k x dpr when the canvas fills its view box), the stage scale k and the DPR.
 */
export function artScaleFor(option: ArtOption, devPerView: number, k: number, dpr: number): ArtScale {
  const dpv = devPerView > 0 && isFinite(devPerView) ? devPerView : 1;
  const backing = option === 'A' ? dpv : 1;
  const canvasPerArt = option === 'A' ? devPerArt(k, dpr) : 1;
  const viewPerArt = canvasPerArt / backing;
  return { option, backing, canvasPerArt, viewPerArt, artPxFor: (viewH: number) => Math.max(6, Math.round(viewH / viewPerArt)) };
}

/** Today's grain, before a canvas is measured. */
export const ART_C: ArtScale = artScaleFor('C', 1, 1, 1);

let chosen: ArtOption | null = null;

/** The option in force: the adopted one, or `?artpx=` for a side-by-side check (read once). */
export function artOption(): ArtOption {
  if (chosen) return chosen;
  chosen = ADOPTED;
  try {
    const v = new URLSearchParams(location.search).get('artpx');
    if (v === 'A' || v === 'C') chosen = v;
  } catch {
    // no location (tests): the adopted option
  }
  return chosen;
}

/**
 * Measure a game canvas: `viewW`/`viewH` are its size in view px. Reads the device pixel ratio and
 * the canvas's on-screen box (the stage's scale and a sideways phone's quarter turn included).
 */
export function artScale(canvas: HTMLCanvasElement, viewW: number, viewH: number, option: ArtOption = artOption()): ArtScale {
  // today's grain needs no measuring (and keeps the per-frame cost at nothing)
  if (option === 'C') return ART_C;
  const dpr = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  const r = canvas.getBoundingClientRect();
  // CSS px per view px; the area keeps it right when the stage is turned a quarter
  const cssPerView = Math.sqrt((r.width * r.height) / Math.max(1, viewW * viewH)) || 1;
  // the stage scale k: CSS px per design px (the view px is the design frame's px)
  return artScaleFor(option, cssPerView * dpr, cssPerView, dpr);
}

/** Sprite sizes in art px step coarser as they grow, 1/2/4/6 px (fewer distinct drawings as players move in depth). */
export function quantPx(artPx: number): number {
  const p = Math.max(1, Math.round(artPx));
  // each band's steps start at the band's first size, so a bigger sprite is never drawn smaller
  if (p <= 14) return p;
  if (p < 30) return p - (p % 2);
  if (p < 62) return 30 + Math.floor((p - 30) / 4) * 4;
  return 62 + Math.floor((p - 62) / 6) * 6;
}

/** A sprite placed in view px: anchors and size scaled from art px, and the canvas px per art px to blit at. */
export interface ArtSprite extends Sprite {
  /** drawn size, view px */
  w: number;
  h: number;
  /** canvas px per art px */
  cpa: number;
  /** canvas px per view px it was placed for */
  backing: number;
}

/** A raster-sized sprite (anchors in art px) as one placed in view px. */
export function toView(s: Sprite, a: ArtScale): ArtSprite {
  const q = a.viewPerArt;
  return {
    canvas: s.canvas,
    ax: s.ax * q,
    ay: s.ay * q,
    top: s.top * q,
    handL: { x: s.handL.x * q, y: s.handL.y * q },
    handR: { x: s.handR.x * q, y: s.handR.y * q },
    w: s.canvas.width * q,
    h: s.canvas.height * q,
    cpa: a.canvasPerArt,
    backing: a.backing,
  };
}

/**
 * Draw a sprite with its top-left at (x, y) view px. At 1 canvas px per art px it is a plain blit;
 * otherwise the corner is snapped to a whole canvas (= device) px and the sprite drawn at its whole
 * number of canvas px per art px (times any zoom punch the context carries).
 */
export function blitSprite(ctx: CanvasRenderingContext2D, s: ArtSprite, x: number, y: number) {
  if (s.cpa === 1) {
    ctx.drawImage(s.canvas, x, y);
    return;
  }
  const m = ctx.getTransform();
  // the context's scale is the backing times any zoom punch the renderer applies
  const k = s.cpa * ((Math.hypot(m.a, m.b) || s.backing) / s.backing);
  const dx = Math.round(m.a * x + m.c * y + m.e);
  const dy = Math.round(m.b * x + m.d * y + m.f);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(s.canvas, dx, dy, Math.round(s.canvas.width * k), Math.round(s.canvas.height * k));
  ctx.setTransform(m);
}
