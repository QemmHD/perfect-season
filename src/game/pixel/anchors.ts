// HUD anchors (studio overhaul players-5, the team doc's section 6.3): where each body was actually
// drawn this frame, so name chips, the PerfectRing, ground marks and tap-to-pass sit on the drawn
// player and never on the engine's spot or height (the drawing is ×1.15 taller than the simulation and
// the planted foot may hold the body up to 5% of his height off it). Each renderer records one Anchor
// per drawn body and answers drawnOffset / headTop / feetAt / groundEllipse / handAnchor from them.
import type { ArtSprite } from './art-scale';

/** A screen point (the renderer's canvas px, before the screen's own scale). */
export interface HudPoint {
  x: number;
  y: number;
}

/** One body as drawn this frame. */
export interface Anchor {
  /** the sprite's top-left as blitted */
  x: number;
  y: number;
  spr: ArtSprite;
  /** the drawn feet on the ground */
  feet: HudPoint;
  /** the drawn feet minus the engine's spot (screen px; at most 5% of his drawn height) */
  dx: number;
  dy: number;
  /** his ground ellipse's radii at that depth (pixel/ground.ts `groundEllipse`) */
  rx: number;
  ry: number;
}

/** A named point of an anchor: the top of the drawn head, the feet, or a hand (the ball's spot). */
export function anchorOf(a: Anchor | undefined, part: 'head' | 'feet' | 'handL' | 'handR'): HudPoint | null {
  if (!a) return null;
  switch (part) {
    case 'head':
      return { x: a.feet.x, y: a.y + a.spr.top };
    case 'feet':
      return { x: a.feet.x, y: a.feet.y };
    case 'handL':
      return { x: a.x + a.spr.handL.x, y: a.y + a.spr.handL.y };
    case 'handR':
      return { x: a.x + a.spr.handR.x, y: a.y + a.spr.handR.y };
  }
}
