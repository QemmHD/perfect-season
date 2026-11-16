// The gold ring on canvas (plan §4.4, V2 B.0.1 / C.3): every sport draws its skill moments with this
// one call. Two looks, one geometry:
//  - 'ground': a ring round the player's feet that closes on an inner target ring. The band round the
//    target is the window: gold on a gold ring, amber on an amber one, none on a red one.
//  - 'arc': the short arc meter above his head (the mockup's), filling left to right; the band sits
//    where the ideal lands.
// Both are drawn at the window's true size and position in time, and the gold band is never thinner
// than MIN_GOLD_PX: when a window is narrow the ring's time-to-pixel scale is stretched, never the
// window. With reduced motion nothing shrinks or slides: the target fills and brightens while the
// release is inside the window (the timing is the same).
//
// Render only: it reads a RingSpec and draws. No game state, no randomness that matters.
import type { RingSpec, RingState } from '../perfect';

/** The gold band's least thickness on screen (design px, plan §3.3). */
export const MIN_GOLD_PX = 8;

export const RING_COLOR: Record<RingState, string> = { gold: '#f6b93b', amber: '#ff9f43', red: '#ff5d5d' };
const GOLD_HOT = '#ffe08a';
const INK = 'rgba(7,21,33,0.85)';

export interface RingDraw {
  x: number;
  y: number;
  /** the target ring's radii (the arc uses rx as its radius) */
  rx: number;
  ry: number;
  /** time since the touch-down over the ideal: 1 is the perfect moment (it runs on past 1) */
  t: number;
  spec: RingSpec;
  /** the ring's natural closing speed, design px per ms (stretched so gold is ≥ MIN_GOLD_PX) */
  px: number;
  reduced: boolean;
  mode?: 'ground' | 'arc';
  /** after the release: where it landed (ms from the ideal) and whether it was PERFECT */
  result?: { offMs: number; inGold: boolean; age: number } | null;
}

/** The ring's px per ms: the natural speed, or faster so the gold band is at least MIN_GOLD_PX thick. */
export function ringScale(spec: RingSpec, px: number): number {
  return Math.max(px, MIN_GOLD_PX / (2 * Math.max(1, spec.goldMs)));
}

/** The window band's thickness on screen (px). */
export function bandPx(spec: RingSpec, px: number): number {
  return 2 * spec.goldMs * ringScale(spec, px);
}

/** The arc meter's sweep (radians), its start, and where on it the ideal lands (a share of the sweep). */
export const ARC = { a0: Math.PI + 0.36, sweep: Math.PI - 0.72, ideal: 1 / 1.3 } as const;

/** The arc meter's natural speed (px per ms) for a radius and an ideal: the whole arc spans 1.3 × ideal. */
export function arcPx(r: number, idealMs: number): number {
  return (r * ARC.sweep) / Math.max(1, idealMs * 1.3);
}

export function drawRing(ctx: CanvasRenderingContext2D, o: RingDraw): void {
  if (o.mode === 'arc') drawArc(ctx, o);
  else drawGround(ctx, o);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
}

function drawGround(ctx: CanvasRenderingContext2D, o: RingDraw) {
  const { spec } = o;
  const k = ringScale(spec, o.px);
  const ideal = spec.idealMs;
  const elapsed = o.t * ideal;
  const half = spec.goldMs * k;
  const squash = o.ry / Math.max(1, o.rx);
  const col = RING_COLOR[spec.state];
  const inside = Math.abs(elapsed - ideal) <= spec.goldMs;
  ctx.save();
  ctx.lineCap = 'round';
  // the window band round the target: gold or amber; a red ring has none
  if (spec.state !== 'red') {
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2 * half + 2;
    ellipse(ctx, o.x, o.y, o.rx, o.ry);
    ctx.stroke();
    ctx.globalAlpha = inside && !o.result ? 1 : 0.85;
    ctx.strokeStyle = inside && !o.result && spec.state === 'gold' ? GOLD_HOT : col;
    ctx.lineWidth = 2 * half;
    ellipse(ctx, o.x, o.y, o.rx, o.ry);
    ctx.stroke();
  }
  // the target ring itself
  ctx.globalAlpha = 1;
  ctx.strokeStyle = spec.state === 'red' ? col : '#ffffff';
  ctx.lineWidth = spec.state === 'red' ? 2.5 : 1.25;
  ellipse(ctx, o.x, o.y, o.rx, o.ry);
  ctx.stroke();
  if (o.result) {
    // where the release landed: a ring at that radius, bright gold and bursting on a PERFECT
    const r = Math.max(2, o.rx + -o.result.offMs * k);
    const fade = Math.max(0, 1 - o.result.age / 0.7);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = o.result.inGold ? GOLD_HOT : spec.state === 'red' ? col : '#ffffff';
    ctx.lineWidth = o.result.inGold ? 3 : 2;
    ellipse(ctx, o.x, o.y, r, r * squash);
    ctx.stroke();
    if (o.result.inGold && !o.reduced) {
      const burst = o.rx + half + 4 + o.result.age * 60;
      ctx.globalAlpha = fade * 0.8;
      ctx.lineWidth = 2;
      ctx.strokeStyle = GOLD_HOT;
      ellipse(ctx, o.x, o.y, burst, burst * squash);
      ctx.stroke();
    }
  } else if (o.reduced) {
    // reduced motion: no closing ring; the target fills, and lights up while the release is in the window
    ctx.globalAlpha = inside ? 0.75 : 0.22;
    ctx.fillStyle = inside ? (spec.state === 'gold' ? GOLD_HOT : col) : '#ffffff';
    ellipse(ctx, o.x, o.y, o.rx - half, o.ry - half * squash);
    ctx.fill();
  } else {
    // the closing ring: on the target at the ideal moment, inside it after
    const r = Math.max(2, o.rx + (ideal - elapsed) * k);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ellipse(ctx, o.x, o.y, r, r * squash);
    ctx.stroke();
    ctx.strokeStyle = inside ? (spec.state === 'gold' ? GOLD_HOT : col) : '#ffffff';
    ctx.lineWidth = 2;
    ellipse(ctx, o.x, o.y, r, r * squash);
    ctx.stroke();
  }
  ctx.restore();
}

function drawArc(ctx: CanvasRenderingContext2D, o: RingDraw) {
  const { spec } = o;
  const R = o.rx;
  const k = ringScale(spec, o.px);
  const a0 = ARC.a0;
  const a1 = ARC.a0 + ARC.sweep;
  const aIdeal = a0 + ARC.sweep * ARC.ideal;
  /** the angle of a moment `u` ms after the touch */
  const at = (u: number) => aIdeal + ((u - spec.idealMs) * k) / R;
  const th = Math.max(7, Math.round(R * 0.22));
  const band = (from: number, to: number, r: number, w: number, color: string) => {
    const s = Math.max(a0, from);
    const e = Math.min(a1, to);
    if (e <= s) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r, s, e);
    ctx.stroke();
  };
  const elapsed = o.t * spec.idealMs;
  const inside = Math.abs(elapsed - spec.idealMs) <= spec.goldMs;
  const col = RING_COLOR[spec.state];
  ctx.save();
  ctx.lineCap = 'butt';
  // the case: a dark edge, a glassy rim, a deep track
  band(a0 - 0.05, a1 + 0.05, R, th + 5, '#05070d');
  band(a0 - 0.03, a1 + 0.03, R, th + 2, 'rgba(232,236,245,0.9)');
  band(a0, a1, R, th, '#1a2235');
  // the window at its true place and size (gold only on a gold ring; amber's own colour; red: none)
  const g0 = at(spec.idealMs - spec.goldMs);
  const g1 = at(spec.idealMs + spec.goldMs);
  if (spec.state !== 'red') {
    band(g0, g1, R, th, inside && !o.result && spec.state === 'gold' ? GOLD_HOT : col);
    band(g0, g1, R + th / 2 + 2, 2, col);
    band(g0, g1, R - th / 2 - 2, 2, col);
  } else band(at(spec.idealMs - 6 / k), at(spec.idealMs + 6 / k), R + th / 2 + 2, 2, col);
  if (o.result) {
    // the result: the fill to where it was let go, gold on a PERFECT, the arch lit for a moment
    const fade = Math.max(0, 1 - o.result.age / 0.7);
    const end = at(spec.idealMs + o.result.offMs);
    band(a0, end, R, th - 2, o.result.inGold ? '#ffd35a' : Math.abs(o.result.offMs) <= spec.goldMs + 40 ? '#f4f4f4' : '#ff5a5a');
    band(end - 0.04, end, R, th + 4, '#ffffff');
    if (o.result.inGold) {
      ctx.globalAlpha = 0.9 * fade;
      band(a0, a1, R, th, 'rgba(255,224,138,0.85)');
      if (!o.reduced) band(a0 - 0.1, a1 + 0.1, R + 4 + o.result.age * R * 0.8, 3 * fade + 1, GOLD_HOT);
      ctx.globalAlpha = 1;
    }
  } else if (o.reduced) {
    // reduced motion: no sliding fill; the track lights while the release is in the window
    band(a0, a1, R, th - 4, inside ? (spec.state === 'gold' ? GOLD_HOT : col) : 'rgba(255,255,255,0.18)');
  } else {
    const fillTo = at(elapsed);
    band(a0, fillTo, R, th - 2, inside ? (spec.state === 'gold' ? GOLD_HOT : col) : '#ffd35a');
    band(a0, fillTo, R - th / 2 + 2, 1, 'rgba(255,255,255,0.55)');
    if (fillTo > a0 + 0.01) band(fillTo - 0.035, fillTo, R, th + 4, '#ffffff');
  }
  ctx.restore();
}
