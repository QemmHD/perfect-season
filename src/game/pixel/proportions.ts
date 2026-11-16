// Broadcast Pixel proportions (Game Design V2 C.1.1, studio overhaul players-2): the "5-head hero".
// A real athlete is about 7.5 heads tall; at 34 art px that leaves a 4 px head that can't carry who he
// is, so the head is drawn bigger the smaller the sprite, limbs are drawn thicker, the height spread
// between players is exaggerated and weight drives torso width, so Shaq and Manute Bol can never share
// an outline. Render only: bone lengths (rig.ts shapeOf) are untouched, so the mocap retarget, the
// stride length (legScale) and every simulation number stay as they are.
import type { Look } from './body';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** V2's head scale on the head capsule's radius, by the sprite's height in art px. */
export function headScale(artPx: number): number {
  return clamp(1.55 - artPx / 120, 1.2, 1.45);
}

/**
 * The rig's head radius (rig.ts, 0.084 of height) is a real person's head plus a cartoon margin;
 * scaled by headScale it lands about 0.6 heads chunkier than V2's table at every size. This brings the
 * product onto the C.1.1 table (4.5 heads at 16-20 art px, 5 at 22-26, 5.5 at 32-36, 6 at 56-72;
 * proportions.test.ts measures it on the raster).
 */
export const HEAD_FIT = 0.92;

/** The head's drawn radius in art px for a rig head radius (share of height) at a sprite height. */
export function headRadiusPx(rigHeadR: number, artPx: number): number {
  return rigHeadR * headScale(artPx) * HEAD_FIT * artPx;
}

/** Limb radii are drawn this much thicker than the rig's (V2: x1.15). */
export const LIMB_SCALE = 1.15;

/** How much more the drawn heights spread around the sport's mean than the real ones (V2: x1.15). */
export const HEIGHT_SPREAD = 1.15;

/** Typical player height per sport, inches (league-wide means, rounded: NBA 6'6.5", NFL 6'2", soccer 1.82 m). */
export const MEAN_HEIGHT_IN: Record<Look['sport'], number> = { nba: 78.5, nfl: 74, soccer: 71.5 };

/** The height a player is drawn at, inches: his real height, spread x1.15 around his sport's mean. */
export function drawnHeight(sport: Look['sport'], htIn: number): number {
  const mean = MEAN_HEIGHT_IN[sport];
  return mean + (htIn - mean) * HEIGHT_SPREAD;
}

/** Body-mass index from inches and pounds. */
export function bmi(htIn: number, wtLb: number): number {
  return (wtLb / (htIn * htIn)) * 703;
}

/**
 * The torso's width face-on, in art px, for a sprite `artPx` tall: 8 px for the lightest build (BMI 18
 * and under) to 13 px for the heaviest (BMI 33 and over) at V2's 34 art px NBA size, scaled with the
 * sprite. Shaq (85 in, 325 lb, BMI 31.6) gets 12.5, Manute Bol (91 in, 200 lb, BMI 17) gets 8.
 */
export function torsoWidthPx(htIn: number, wtLb: number, artPx: number): number {
  const k = clamp((bmi(htIn, wtLb) - 18) / 15, 0, 1);
  return ((8 + 5 * k) * artPx) / 34;
}

/** Extra face-on shoulder width football pads add, art px at 34 (a lineman's pads 1.25 add more). */
export function padsWidthPx(pads: number, artPx: number): number {
  return (pads * 2.2 * artPx) / 34;
}

/**
 * His drawn shoulder width face-on, px, for a sprite `artPx` tall: the torso, the pads and the two
 * upper arms (the rig's 0.039 arm radius, drawn x1.15), for ground marks and rings that size to him.
 */
export function shoulderWidthPx(htIn: number, wtLb: number, artPx: number, pads = 0): number {
  return torsoWidthPx(htIn, wtLb, artPx) + padsWidthPx(pads, artPx) + 4 * 0.039 * LIMB_SCALE * artPx;
}
