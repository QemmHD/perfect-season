// The near-first sprite budget (studio overhaul players-5, A-1; V2 F.2 #3). A match redraws only so
// many player sprites a frame; the rest show last frame's drawing. Before this, the budget was spent
// in depth order, far players first, so the big near players froze and slid (41% of NFL draws stale).
// Now every frame the renderer asks for all its bodies first, and the budget spends on them in
// priority order:
//   1. the must set, always fresh: the ball carrier or handler, the pass target, his nearest defender,
//      the body the human controls (in any phase), and any body `pin()`ned this frame (HUD rings,
//      name chips);
//   2. then by size and staleness, px + 24 * frames stale; a body of 32 art px or more that has been
//      stale 2 frames is forced.
// The number of new drawings a frame comes from what drawings cost on this phone: an EWMA of the
// per-draw cost (each frame's drawing time over its draws, robust to iOS's 1 ms timer clamp),
// floor(3 ms / cost) clamped to [3, 14] (2 ms after a frame over 20 ms). After a snap, kickoff,
// inbound or rematch the budget's leftover draws (2 at most a frame) pre-draw the next frames of the
// six nearest bodies. All sprite caches of a match share one area cap (6 Mpx of art pixels) that
// outlives a rematch. Render only: nothing here reads or writes the simulation.
import { type AreaAccount, CanvasOut, type Sprite, SpriteCache } from './body';

export const BUDGET_MS = 5;
export const BUDGET_MS_SLOW = 3;
/** for the 30 frames after a snap, kickoff, inbound or rematch: the camera re-frames the play then
 * (an NBA replay's zoom easing back, the follow cam swinging to the new ball), so every body changes
 * size and pitch each frame and needs a new drawing; the budget covers them */
export const BUDGET_MS_START = 10;
export const SLOW_FRAME_MS = 20;
export const MIN_DRAWS = 3;
export const MAX_DRAWS = 14;
/** what one frame stale weighs against one art px of size */
export const STALE_WEIGHT = 24;
export const FORCE_PX = 32;
export const FORCE_FRAMES = 2;
export const PREWARM_DRAWS = 2;
export const PREWARM_FRAMES = 30;
export const PREWARM_BODIES = 6;
/** every match sprite cache together holds at most this many art pixels */
export const AREA_CAP = 6_000_000;
/** the EWMA's weight for each new frame */
const EWMA = 0.15;
/** the guess before anything is measured (a mid-range phone): 6 draws in the 3 ms */
const FIRST_COST_MS = 0.5;

/** One body's request this frame. `staleFor` and `must` are filled in by the budget's `order`. */
export interface DrawReq {
  who: string;
  /** sprite height, art px */
  px: number;
  must: boolean;
  staleFor: number;
  /** nearer the camera is bigger (the depth order's key, for ties) */
  near: number;
}

/** The shared area account of a match's sprite caches. */
export class AreaPool implements AreaAccount {
  used = 0;
  peak = 0;
  constructor(public cap = AREA_CAP) {}
  add(a: number) {
    this.used += a;
    if (this.used > this.peak) this.peak = this.used;
  }
  sub(a: number) {
    this.used = Math.max(0, this.used - a);
  }
}

/** The one pool every match renderer's cache draws on (module-level: it outlives a rematch). */
export const MATCH_AREA = new AreaPool();

export class SpriteBudget {
  private ewmaMs = 0;
  private ewmaDraws = 0;
  private limitNow = Math.floor(BUDGET_MS / FIRST_COST_MS);
  private made = 0;
  private forcedMade = 0;
  private warmMade = 0;
  private warmLeft = 0;
  private staleRun = new Map<string, number>();
  private pins = new Set<string>();
  private pinsNext = new Set<string>();

  /** Start a frame. `frameMs` is the time since the last frame began (a slow frame tightens the budget). */
  begin(frameMs: number) {
    const start = this.warmLeft > 0;
    const budgetMs = frameMs > SLOW_FRAME_MS ? (start ? BUDGET_MS : BUDGET_MS_SLOW) : start ? BUDGET_MS_START : BUDGET_MS;
    const cost = this.costMs();
    this.limitNow = Math.max(MIN_DRAWS, Math.min(MAX_DRAWS, Math.floor(budgetMs / cost)));
    // the first frame of a snap, kickoff, inbound or rematch: every body is somewhere new, so it may
    // draw the most a frame ever does (one heavier frame, then the pre-warm keeps up)
    if (this.warmLeft === PREWARM_FRAMES) this.limitNow = MAX_DRAWS;
    this.made = 0;
    this.forcedMade = 0;
    this.warmMade = 0;
    // pins asked for before this frame's draw (the HUD, between frames) count now
    for (const w of this.pinsNext) this.pins.add(w);
    this.pinsNext.clear();
  }

  /** The measured cost of one new drawing (ms). */
  costMs(): number {
    return this.ewmaDraws > 0 ? Math.max(0.05, this.ewmaMs / this.ewmaDraws) : FIRST_COST_MS;
  }
  /** How many non-must drawings this frame may make. */
  get limit() {
    return this.limitNow;
  }

  /** Force a body fresh: this frame if its draw hasn't run yet, else the next. */
  pin(who: string) {
    this.pinsNext.add(who);
  }

  /** How many frames in a row this body has shown an old drawing. */
  staleFor(who: string) {
    return this.staleRun.get(who) ?? 0;
  }

  /** Whether a request must be fresh: the must set, a pin, or a big body stale too long. */
  forced(r: DrawReq) {
    return r.must || this.pins.has(r.who) || (r.px >= FORCE_PX && this.staleFor(r.who) >= FORCE_FRAMES);
  }

  /** The requests in the order the budget spends on them. */
  order(reqs: DrawReq[]): DrawReq[] {
    for (const r of reqs) r.staleFor = this.staleFor(r.who);
    const score = (r: DrawReq) => r.px + STALE_WEIGHT * r.staleFor;
    return [...reqs].sort((a, b) => Number(this.forced(b)) - Number(this.forced(a)) || score(b) - score(a) || b.near - a.near);
  }

  /** Whether this request may make a new drawing now (call `drew` when it does). The must set and the
   * forced are drawn on top of the count; the count is for everyone else, nearest first. */
  allow(r: DrawReq): boolean {
    return this.forced(r) || this.made < this.limitNow;
  }
  drew(who: string, forced = false) {
    if (!forced) this.made++;
    this.forcedMade += forced ? 1 : 0;
    this.staleRun.set(who, 0);
  }
  /** A cache hit: fresh at no cost. */
  hit(who: string) {
    this.staleRun.set(who, 0);
  }
  stale(who: string) {
    this.staleRun.set(who, this.staleFor(who) + 1);
  }

  /** A snap, kickoff, inbound or rematch: pre-draw the next frames for a while. */
  warmUp() {
    this.warmLeft = PREWARM_FRAMES;
  }
  /** Pre-warm draws still allowed this frame (from what the budget left; 2 at most). */
  warmSlots(): number {
    if (this.warmLeft <= 0) return 0;
    return Math.max(0, Math.min(PREWARM_DRAWS - this.warmMade, this.limitNow - this.made));
  }
  warmed() {
    this.warmMade++;
    this.made++;
  }

  /** End the frame: `ms` spent making `draws` new drawings (pre-warm included) feeds the EWMA. */
  spent(ms: number, draws: number) {
    if (draws > 0) {
      if (this.ewmaDraws === 0) {
        this.ewmaMs = ms;
        this.ewmaDraws = draws;
      } else {
        this.ewmaMs += (ms - this.ewmaMs) * EWMA;
        this.ewmaDraws += (draws - this.ewmaDraws) * EWMA;
      }
    }
    if (this.warmLeft > 0) this.warmLeft--;
    this.pins.clear();
    // the dev harness's counters (scripts/qa: it sets window.__pixelDebug first; nothing in the app does)
    const dbg = (globalThis as { __pixelDebug?: Record<string, number> }).__pixelDebug;
    if (dbg) {
      dbg.frames = (dbg.frames ?? 0) + 1;
      dbg.draws = (dbg.draws ?? 0) + draws;
      dbg.forced = (dbg.forced ?? 0) + this.forcedMade;
      dbg.limitSum = (dbg.limitSum ?? 0) + this.limitNow;
      dbg.costMs = this.costMs();
      dbg.drawMs = (dbg.drawMs ?? 0) + ms;
    }
  }

  /** Forget who was stale (a rematch, a discontinuity); the measured cost is the phone's and stays. */
  resetStale() {
    this.staleRun.clear();
  }
}

/** One body's sprite this frame: its cache key, how to draw it, and (for pre-warm) its next frame. */
export interface SpritePlan<S extends Sprite> {
  req: DrawReq;
  key: string;
  make: () => S;
  next?: { key: string; make: () => S };
}

/**
 * Resolve a frame's sprites in budget order: a cache hit, a new drawing the budget allows, or last
 * frame's drawing (stale). Then pre-warm the six nearest bodies' next frames from what is left. Out of
 * canvas memory, every old drawing goes and the drawing is tried once more. `now` times the drawing
 * for the EWMA (performance.now in the app; a fake clock in tests).
 */
export function resolveSprites<S extends Sprite>(plans: SpritePlan<S>[], cache: SpriteCache<S>, last: Map<string, S>, budget: SpriteBudget, now: () => number): Map<string, { spr: S; fresh: boolean }> {
  const out = new Map<string, { spr: S; fresh: boolean }>();
  const byWho = new Map(plans.map((p) => [p.req.who, p]));
  let ms = 0;
  let draws = 0;
  const draw = (k: string, make: () => S): S | null => {
    const t0 = now();
    let spr: S;
    try {
      spr = make();
    } catch (e) {
      if (!(e instanceof CanvasOut)) throw e;
      // the phone is out of canvas memory: let go of every old drawing and try once more
      cache.dispose(last.values());
      try {
        spr = make();
      } catch {
        ms += now() - t0;
        return null;
      }
    }
    ms += now() - t0;
    draws++;
    cache.set(k, spr, last.values());
    return spr;
  };
  for (const r of budget.order(plans.map((p) => p.req))) {
    const p = byWho.get(r.who)!;
    const old = last.get(r.who);
    let spr = cache.get(p.key);
    let fresh = true;
    if (spr) budget.hit(r.who);
    else if (budget.allow(r) || !old) {
      const forced = budget.forced(r);
      spr = draw(p.key, p.make) ?? undefined;
      if (spr) budget.drew(r.who, forced);
    }
    if (!spr) {
      if (!old) continue;
      spr = old;
      fresh = false;
      budget.stale(r.who);
    }
    last.set(r.who, spr);
    out.set(r.who, { spr, fresh });
  }
  // pre-warm: the next frames of the nearest bodies, while the budget has draws left
  if (budget.warmSlots() > 0) {
    const near = [...plans].filter((p) => p.next).sort((a, b) => b.req.px - a.req.px).slice(0, PREWARM_BODIES);
    for (const p of near) {
      if (budget.warmSlots() <= 0) break;
      const n = p.next!;
      if (cache.has(n.key)) continue;
      if (draw(n.key, n.make)) budget.warmed();
    }
  }
  budget.spent(ms, draws);
  return out;
}

/**
 * A body's drawn size and camera pitch, held through small changes (half a step of hysteresis): a
 * camera easing after the ball moves every body's size and angle a little each frame, and without
 * this each crossing of a size or pitch step would be a new drawing for every body at once. A body is
 * drawn at most 6% off his exact size, or 0.1 off his exact pitch, before he steps.
 */
export class Steady {
  private held = new Map<string, { px: number; pitch: number }>();
  at(who: string, rawPx: number, px: number, rawPitch: number): { px: number; pitch: number } {
    const was = this.held.get(who);
    const pitch = Math.round(Math.min(0.9, rawPitch) / 0.15) * 0.15;
    const out = {
      px: was && px !== was.px && Math.abs(rawPx / was.px - 1) < 0.06 ? was.px : px,
      pitch: was && pitch !== was.pitch && Math.abs(Math.min(0.9, rawPitch) - was.pitch) < 0.1 ? was.pitch : pitch,
    };
    this.held.set(who, out);
    return out;
  }
  clear() {
    this.held.clear();
  }
}
