// The venue palette (studio overhaul players-4, V2 C.2 "calmer venues", the V2 grant to players for
// persp.ts, court.ts, field.ts and pitch.ts): the colours the court, field and pitch textures are
// painted in, and the light baked into them. Colour only: no line, stand or camera moves.
//
// - Surfaces: planks, mow stripes and lines from fixed tokens, the grain held to 4% contrast so the
//   floor never competes with the players on it; team paint at 85% saturation.
// - Light: soft pools baked into the floor (a brighter pool under the rim), the far end of the surface
//   6% darker than the near end (depth), and a vignette darkening the screen's corners by 18%.
// - The crowd: crowd.ts.
// The textures are made once per match and the vignette is one cached canvas, so none of this costs
// anything per frame beyond one blit.
import { mix, type RGB, rgb, saturate } from './color';

/** The surface tokens, per sport. */
export const VENUE = {
  nba: {
    /** the two plank tones, a plank every PLANK texels across the court */
    planks: ['#c98f52', '#bf8548'] as const,
    plank: 6,
    lines: '#f4ead8',
    /** the pool of light under the rim: +8% */
    rimPool: 0.08,
  },
  nfl: {
    /** mow stripes every 5 yards */
    mow: ['#2f8f46', '#2a8240'] as const,
    lines: '#eaf5ea',
    /** the yard numbers painted at 60% */
    numbers: 0.6,
  },
  soccer: {
    /** mow stripes every 5.5 m */
    mow: ['#2e9a4a', '#288a41'] as const,
    stripe: 5.5,
    lines: '#f2fff2',
    /** lines at 85% over the grass */
    lineAlpha: 0.85,
  },
} as const;

/** Team colour on the floor (the paint, the centre circle, end zones) at 85% saturation. */
export const TEAM_PAINT = 0.85;
/** The surface's far end this much darker than its near end. */
export const DEPTH_DARKEN = 0.06;
/** The screen's corners this much darker than its centre. */
export const VIGNETTE = 0.18;
/** The light pools: the warm light they lift the surface toward, and how far (a share). */
const POOL_LIGHT: RGB = [255, 246, 214];
export const POOL = 0.05;

/** A team colour as floor paint. */
export function teamPaint(c: RGB | string): RGB {
  return saturate(typeof c === 'string' ? rgb(c) : c, TEAM_PAINT);
}

/** A team's dark (the apron, the run-off): its paint deep in shadow. */
export function teamDark(c: RGB | string): RGB {
  return mix(teamPaint(c), [10, 10, 16], 0.55);
}

/** The NBA plank colour for plank `i` (across the court): the two tokens' blend, varied per plank and held
 * to the grain limit (V2: the floor's grain at 4% at most). */
export function plankColor(i: number, n: number): RGB {
  const [a, b] = VENUE.nba.planks.map(rgb);
  // planks alternate between the light token and a blend part way to the dark one, each a touch
  // different; the grain inside a plank is a whisper
  const t = (((i % 2) + 2) % 2) * 0.32 + n * 0.12;
  return mix(a, b, t);
}

/** A grass colour: the mow stripe it is in, the faintest texture. */
export function grass(mow: readonly [string, string], stripe: number, n: number): RGB {
  const c = rgb(mow[((stripe % 2) + 2) % 2]);
  return mix(c, n > 0 ? [170, 214, 150] : [16, 44, 22], Math.abs(n) * 0.25);
}

/** A light pool: where it is on the surface (the surface's own units), its radius and its strength. */
export interface Pool {
  x: number;
  y: number;
  r: number;
  k: number;
}

/**
 * The light at a surface point: the pools lift it toward warm light, and the far end is darker
 * (`along` 0 at the near end, 1 at the far). Applied to the texture once, never per frame.
 */
export function lit(c: RGB, x: number, y: number, pools: readonly Pool[], along: number): RGB {
  let k = 0;
  for (const p of pools) {
    const d = Math.hypot(x - p.x, y - p.y) / p.r;
    if (d < 1) k += p.k * (1 - d * d) * (1 - d * d);
  }
  const lifted = k > 0 ? mix(c, POOL_LIGHT, Math.min(0.3, k)) : c;
  const dark = DEPTH_DARKEN * Math.max(0, Math.min(1, along));
  return dark > 0 ? mix(lifted, [0, 0, 0], dark) : lifted;
}

/** A line colour laid over a surface at `alpha`. */
export function lineOver(surface: RGB, line: string, alpha: number): RGB {
  return mix(surface, rgb(line), alpha);
}

const vignettes = new Map<string, HTMLCanvasElement>();

/**
 * Darken the screen's corners (VIGNETTE at the very corner, nothing in the middle): one cached canvas
 * per size, drawn over the venue and under the players, so the eye settles on the play.
 */
export function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const key = W + 'x' + H;
  let c = vignettes.get(key);
  if (!c) {
    if (vignettes.size > 4) vignettes.clear();
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W));
    c.height = Math.max(1, Math.round(H));
    const g = c.getContext('2d');
    if (!g) return;
    const r = Math.hypot(W, H) / 2;
    const grad = g.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,' + VIGNETTE + ')');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    vignettes.set(key, c);
  }
  ctx.drawImage(c, 0, 0, W, H);
}
