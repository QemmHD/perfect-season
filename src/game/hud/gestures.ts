// Gestures on a button (plan §4.3): a tap, a hold or a swipe, from the points one finger drew. Pure;
// gestures.test.ts throws 200 jittered gestures of each kind at it.
//  - swipe: the finger travels >= 36 px from where it went down within 250 ms (direction by the
//    larger axis, so a diagonal flick counts for its stronger side)
//  - tap: lifted within 120 ms, never more than 12 px from the start
//  - hold: anything else that lifts, or a finger still down at 120 ms within 12 px
// While the finger is still down and none of those is certain yet, the answer is null.

export type Gesture = { kind: 'tap' | 'hold' | 'swipe'; dir?: 'L' | 'R' | 'U' | 'D'; heldMs: number };
export interface GPoint {
  x: number;
  y: number;
  t: number;
}

export const TAP_MS = 120;
export const TAP_PX = 12;
export const SWIPE_PX = 36;
export const SWIPE_MS = 250;

export function classify(points: GPoint[], tDown: number, tUp: number | null): Gesture | null {
  if (!points.length) return null;
  const o = points[0];
  let far = 0;
  for (const q of points) {
    const d = Math.hypot(q.x - o.x, q.y - o.y);
    if (q.t - tDown <= SWIPE_MS && d >= SWIPE_PX) {
      const dx = q.x - o.x;
      const dy = q.y - o.y;
      const dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : dy < 0 ? 'U' : 'D';
      return { kind: 'swipe', dir, heldMs: q.t - tDown };
    }
    far = Math.max(far, d);
  }
  const last = points[points.length - 1];
  if (tUp !== null) {
    const held = tUp - tDown;
    return held < TAP_MS && far < TAP_PX ? { kind: 'tap', heldMs: held } : { kind: 'hold', heldMs: held };
  }
  const held = last.t - tDown;
  if (held >= TAP_MS && far < TAP_PX) return { kind: 'hold', heldMs: held };
  return null;
}

/** How far a finger has moved from where it went down. */
export function travel(points: GPoint[]): number {
  if (!points.length) return 0;
  const o = points[0];
  let far = 0;
  for (const q of points) far = Math.max(far, Math.hypot(q.x - o.x, q.y - o.y));
  return far;
}

/**
 * The pointer bookkeeping behind Cluster.tsx, kept pure so it is tested without a DOM: each slot
 * owns at most one pointer; several slots (and the stick) are tracked at once; 'down' is delivered on
 * the pointer's down; a swipe is delivered once, on the move that makes it one; the gesture lands with
 * 'up'.
 */
export type Slot = 'A' | 'B' | 'C' | 'D';
export interface ClusterInput {
  slot: Slot;
  phase: 'down' | 'move' | 'up' | 'cancel';
  /** PointerEvent.timeStamp */
  t: number;
  gesture?: Gesture;
  /** (added 2026-11-16) px travelled from the down point, and where the finger is (client px) */
  dist?: number;
  x?: number;
  y?: number;
}

export class ClusterTracker {
  private live = new Map<number, { slot: Slot; tDown: number; pts: GPoint[]; swiped: boolean }>();
  constructor(private swipes: (slot: Slot) => boolean) {}

  /** pointers currently held, by slot */
  held(): Slot[] {
    return [...this.live.values()].map((v) => v.slot);
  }

  down(slot: Slot, id: number, x: number, y: number, t: number): ClusterInput | null {
    for (const v of this.live.values()) if (v.slot === slot) return null;
    this.live.set(id, { slot, tDown: t, pts: [{ x, y, t }], swiped: false });
    return { slot, phase: 'down', t, dist: 0, x, y };
  }

  move(id: number, x: number, y: number, t: number): ClusterInput | null {
    const v = this.live.get(id);
    if (!v) return null;
    v.pts.push({ x, y, t });
    const dist = travel(v.pts);
    if (this.swipes(v.slot) && !v.swiped) {
      const g = classify(v.pts, v.tDown, null);
      if (g?.kind === 'swipe') {
        v.swiped = true;
        return { slot: v.slot, phase: 'move', t, gesture: g, dist, x, y };
      }
    }
    return { slot: v.slot, phase: 'move', t, dist, x, y };
  }

  up(id: number, x: number, y: number, t: number, cancelled = false): ClusterInput | null {
    const v = this.live.get(id);
    if (!v) return null;
    this.live.delete(id);
    if (cancelled) return { slot: v.slot, phase: 'cancel', t, x, y };
    v.pts.push({ x, y, t });
    const g = v.swiped ? null : classify(v.pts, v.tDown, t);
    // a swipe already went out on its move: the lift carries no second gesture
    return { slot: v.slot, phase: 'up', t, gesture: g && this.swipes(v.slot) ? g : g?.kind === 'swipe' ? { kind: 'hold', heldMs: t - v.tDown } : (g ?? undefined), dist: travel(v.pts), x, y };
  }

  /** everything let go (the OS took the touch, the match paused) */
  clear(t: number): ClusterInput[] {
    const out = [...this.live.values()].map((v) => ({ slot: v.slot, phase: 'cancel' as const, t }));
    this.live.clear();
    return out;
  }
}
