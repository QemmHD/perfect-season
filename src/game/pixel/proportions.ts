// Broadcast Pixel proportions (Game Design V2 C.1.1, studio overhaul players-2): the "5-head hero".
// A real athlete is about 7.5 heads tall; at 34 art px that leaves a 4 px head that can't carry who he
// is, so the head is drawn bigger the smaller the sprite, limbs are drawn thicker, the height spread
// between players is exaggerated and weight drives torso width, so Shaq and Manute Bol can never share
// an outline. Render only: bone lengths (rig.ts shapeOf) are untouched, so the mocap retarget, the
// stride length (legScale) and every simulation number stay as they are.
import type { Look } from './body';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** V2 C.1.1's head table: heads tall by figure height in art px (a band's value across the band). */
export const HEAD_TABLE: readonly (readonly [lo: number, hi: number, heads: number])[] = [
  [16, 20, 4.5],
  [22, 26, 5],
  [32, 36, 5.5],
  [56, 72, 6],
];

/** Heads tall for a figure `fig` art px tall: the table's band, linear between bands, held past the ends. */
export function targetHeads(fig: number): number {
  const t = HEAD_TABLE;
  if (fig <= t[0][1]) return t[0][2];
  for (let i = 0; i < t.length; i++) {
    const [lo, hi, h] = t[i];
    if (fig <= hi) {
      if (fig >= lo) return h;
      const [, phi, ph] = t[i - 1];
      return ph + ((h - ph) * (fig - phi)) / (lo - phi);
    }
  }
  return t[t.length - 1][2];
}

/**
 * A standing player's figure height in art px (feet to crown, hair and outline excluded) for a grid
 * `artPx` tall: the idle pose and the broadcast camera's pitch (0.45) shorten him. A line fitted on the
 * raster over 14-100 px (within about 1 px; proportions.test.ts sweeps it).
 */
export function figurePx(artPx: number): number {
  return 0.8 * artPx + 1.8;
}

/** The rig's head radius (rig.ts) for a 6'6" player without pads: the head the table is set for. */
export const RIG_HEAD_R = 0.084;

/**
 * The head's height in whole art px for a sprite `artPx` tall (V2 C.1.1, the 5-head hero). The head is
 * sized in rows, not by a scale on the rig's radius, so every height in a band lands on the band's
 * heads-tall (a radius scaled by one constant was only right at the band centres, and drifted to 5.1
 * heads at near and replay sizes). A taller player's smaller rig head (rig.ts) still shows.
 */
export function headRows(rigHeadR: number, artPx: number): number {
  const fig = figurePx(artPx);
  return Math.max(3, Math.round((fig / targetHeads(fig)) * (rigHeadR / RIG_HEAD_R)));
}

/**
 * The head's width in whole art px for a head `rows` tall: as wide as tall up to 6 rows (a small head
 * reads as a round block, V2's 5x5 and 6x6 boxes), 0.9 as wide above.
 */
export function headCols(rows: number): number {
  return rows;
}

/**
 * Where a head of `count` whole pixels across (or down) centres so the grid gives it exactly that
 * many: on a pixel edge for an even count, a pixel centre for an odd one. `c` is in grid px.
 */
export function snapCentre(c: number, count: number): number {
  return count % 2 ? Math.floor(c) + 0.5 : Math.round(c);
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
