// Ground marks under the players (Game Design V2 C.1.3 and C.5, studio overhaul players-2): a soft
// contact shadow under every sprite, and, when a HUD owner asks for one, a 2 px ring in the colour
// that means something on every field: gold for the player you control, teal for your pass target,
// a red arc for the defender pressing you, violet for your rival. Nothing else on a field uses these
// four colours. The sport renderers draw the shadow; the rings are the HUD owners' call (the cross-
// team contract, docs/studio-overhaul/players.md section 4.4).

export type Mark = 'you' | 'target' | 'pressure' | 'rival';

export const MARK_COLOR: Record<Mark, string> = { you: '#f6b93b', target: '#4fe3c1', pressure: '#ff5d5d', rival: '#8b7cf6' };

/** The shadow's darkness where it is solid (V2: rgba(0,0,0,0.32)). */
export const SHADOW_ALPHA = 0.32;

/**
 * The ground ellipse under a player: 70% of his shoulder width across, squashed by how steeply the
 * camera looks down at that spot (`pitch`, radians below horizontal). Others drawing a ring around
 * his feet use this aspect so their ring sits on the same ground.
 */
export function groundEllipse(shoulderPx: number, pitch: number): { rx: number; ry: number } {
  const rx = Math.max(2, shoulderPx * 0.35);
  return { rx, ry: Math.max(1, rx * Math.max(0.22, Math.sin(pitch))) };
}

export interface GroundMarkOpts {
  /** where his feet are on screen */
  x: number;
  y: number;
  /** his drawn shoulder width, screen px */
  shoulderPx: number;
  /** the camera's pitch at his spot (radians below horizontal); default a broadcast 0.5 */
  pitch?: number;
  /** a ring as well as the shadow */
  mark?: Mark;
  /** the ring in another colour (ut's cosmetic ring reward) */
  color?: string;
  /** off the floor (in the sport's height units, per body height): the shadow shrinks and fades */
  lift?: number;
}

/** The soft shadow at his feet and, with `mark`, the 2 px ring. */
export function drawGroundMark(ctx: CanvasRenderingContext2D, o: GroundMarkOpts) {
  const { rx, ry } = groundEllipse(o.shoulderPx, o.pitch ?? 0.5);
  const k = 1 / (1 + Math.max(0, o.lift ?? 0) * 0.6);
  const x = Math.round(o.x);
  const y = Math.round(o.y);
  // a one-pixel halo, then the core, so the edge is soft and the middle reads 0.32 over the floor
  const halo = 0.14 * k;
  const core = 1 - (1 - SHADOW_ALPHA * k) / (1 - halo);
  ctx.fillStyle = 'rgba(0,0,0,' + halo.toFixed(3) + ')';
  ctx.beginPath();
  ctx.ellipse(x, y, rx * k + 1, ry * k + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,' + core.toFixed(3) + ')';
  ctx.beginPath();
  ctx.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!o.mark) return;
  const rr = Math.max(rx * 1.9, rx + 4);
  ctx.strokeStyle = o.color ?? MARK_COLOR[o.mark];
  ctx.lineWidth = 2;
  ctx.beginPath();
  // the pressure mark is an arc on the near side only (the side he is pressed from reads as a bracket)
  if (o.mark === 'pressure') ctx.ellipse(x, y, rr, (ry * rr) / rx, 0, 0.15 * Math.PI, 0.85 * Math.PI);
  else ctx.ellipse(x, y, rr, (ry * rr) / rx, 0, 0, Math.PI * 2);
  ctx.stroke();
}
