// players-5: the near-first sprite budget (A-1). A synthetic 22-body match: the must set and pinned
// bodies are always fresh, no big body stays stale more than 2 frames in a row under a budget the
// size of the old 4 draws, the EWMA reads the true per-draw cost through a 1 ms timer within 30
// frames, the draw count stays in [3, 14], and the shared area cap is never exceeded, rematches
// included. Pure: no canvas (fake sprites with a size), no engine.
import { AreaPool, AREA_CAP, BUDGET_MS, BUDGET_MS_SLOW, BUDGET_MS_START, FORCE_FRAMES, FORCE_FRAMES_TIGHT, MAX_DRAWS, MIN_DRAWS, PREWARM_DRAWS, PREWARM_FRAMES, resolveSprites, SpriteBudget, type SpritePlan } from './sprite-budget';
import { SpriteCache, type Sprite } from './body';

const fake = (w: number, h: number): Sprite => ({ canvas: { width: w, height: h } as HTMLCanvasElement, ax: 0, ay: 0, top: 0, handL: { x: 0, y: 0 }, handR: { x: 0, y: 0 } });

/** a seeded generator (test only) */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

interface Body {
  who: string;
  px: number;
  frame: number;
  cycle: number;
}

/** 22 bodies 14-72 art px; each changes pose every frame (a 30 fps clip at 60 fps changes every other) */
function bodies(): Body[] {
  return Array.from({ length: 22 }, (_, i) => ({ who: 'b' + i, px: 14 + Math.round((i / 21) * 58), frame: 0, cycle: 20 + (i % 5) }));
}

function plansFor(bs: Body[], must: Set<string>, frameNo: number): SpritePlan<Sprite>[] {
  return bs.map((b) => {
    // every body asks for a pose it has never had (a camera move, a new clip): the worst case
    const key = b.who + ':' + frameNo;
    return { req: { who: b.who, px: b.px, must: must.has(b.who), staleFor: 0, near: b.px }, key, make: () => fake(Math.ceil(b.px * 1.25) + 6, Math.ceil(b.px * 1.7) + 6), next: { key: key + 'n', make: () => fake(b.px, b.px) } };
  });
}

describe('the near-first sprite budget', () => {
  it('keeps the must set and pinned bodies fresh, and no body of 32 art px or more stale over 2 frames', () => {
    const budget = new SpriteBudget();
    const cache = new SpriteCache<Sprite>(2000);
    const last = new Map<string, Sprite>();
    const bs = bodies();
    const must = new Set(['b3', 'b11', 'b20']);
    const run = new Map<string, number>();
    let maxBigRun = 0;
    let t = 0;
    // the old budget's size: a draw costs 2/9 of the budget, so it buys 4 (+ the must set and the
    // forced)
    const now = () => t;
    for (let f = 0; f < 400; f++) {
      if (f % 7 === 0) budget.pin('b1');
      budget.begin(16.7);
      const plans = plansFor(bs, must, f);
      const got = resolveSprites(plans, cache, last, budget, () => {
        t += BUDGET_MS / 4.5;
        return now();
      });
      for (const b of bs) {
        const r = got.get(b.who)!;
        if (must.has(b.who)) expect(r.fresh).toBe(true);
        if (f % 7 === 0) expect(got.get('b1')!.fresh).toBe(true);
        const n = r.fresh ? 0 : (run.get(b.who) ?? 0) + 1;
        run.set(b.who, n);
        if (b.px >= 32) maxBigRun = Math.max(maxBigRun, n);
      }
    }
    expect(budget.limit).toBe(4);
    expect(maxBigRun).toBeLessThanOrEqual(FORCE_FRAMES);
  });

  it('spends on near bodies first: the biggest non-must bodies are fresh before the far ones', () => {
    const budget = new SpriteBudget();
    const reqs = bodies().map((b) => ({ who: b.who, px: b.px, must: false, staleFor: 0, near: b.px }));
    const order = budget.order(reqs);
    expect(order[0].px).toBe(72);
    expect(order[order.length - 1].px).toBe(14);
    // a far body stale long enough outranks a nearer fresh one (px + 24 per stale frame)
    for (let i = 0; i < 3; i++) budget.stale('b0');
    expect(budget.order(reqs).findIndex((r) => r.who === 'b0')).toBeLessThan(budget.order(reqs).findIndex((r) => r.who === 'b14'));
  });

  it('reads the per-draw cost through a 1 ms clock within 30 frames (±20%) and keeps the count in [3, 14]', () => {
    for (const cost of [0.12, 0.35, 0.9]) {
      const budget = new SpriteBudget();
      const rnd = lcg(Math.round(cost * 1000));
      let real = rnd() * 1000;
      // iOS clamps the timer: whole milliseconds
      const clamp = () => Math.floor(real);
      for (let f = 0; f < 30; f++) {
        budget.begin(16.7);
        const draws = 3 + Math.floor(rnd() * 8);
        const t0 = clamp();
        real += draws * cost;
        const t1 = clamp();
        budget.spent(t1 - t0, draws);
        // the rest of the frame
        real += 16.7 - draws * cost + rnd() * 0.3;
      }
      expect(Math.abs(budget.costMs() - cost) / cost).toBeLessThanOrEqual(0.2);
      budget.begin(16.7);
      expect(budget.limit).toBeGreaterThanOrEqual(MIN_DRAWS);
      expect(budget.limit).toBeLessThanOrEqual(MAX_DRAWS);
      expect(budget.limit).toBe(Math.max(MIN_DRAWS, Math.min(MAX_DRAWS, Math.floor(BUDGET_MS / budget.costMs()))));
      // a frame over 20 ms tightens it
      budget.begin(34);
      expect(budget.limit).toBe(Math.max(MIN_DRAWS, Math.min(MAX_DRAWS, Math.floor(BUDGET_MS_SLOW / budget.costMs()))));
    }
  });

  it('pre-warms from leftover budget only, at most 2 extra draws a frame, for 30 frames after a start', () => {
    const budget = new SpriteBudget();
    const cache = new SpriteCache<Sprite>(4000);
    const last = new Map<string, Sprite>();
    const bs = bodies().slice(0, 4);
    let t = 0;
    budget.warmUp();
    const warmPerFrame: number[] = [];
    for (let f = 0; f < 40; f++) {
      budget.begin(16.7);
      const before = cache.size;
      // every body asks for the same pose each frame after the first (a hit): the whole budget is left
      resolveSprites(plansFor(bs, new Set(), f < 1 ? 0 : 1).map((p) => ({ ...p, next: { key: p.key + 'n' + f, make: p.next!.make } })), cache, last, budget, () => (t += 0.05));
      warmPerFrame.push(cache.size - before - (f < 2 ? bs.length : 0));
    }
    expect(Math.max(...warmPerFrame)).toBeLessThanOrEqual(PREWARM_DRAWS);
    expect(warmPerFrame.slice(2, 30).every((n) => n === PREWARM_DRAWS)).toBe(true);
    expect(warmPerFrame.slice(31).every((n) => n === 0)).toBe(true);
  });

  it('after a start draws every body on the first frame, then spends the start budget for 30 frames', () => {
    const budget = new SpriteBudget();
    // a measured cost of 1 ms a drawing
    budget.begin(16.7);
    budget.spent(4, 4);
    budget.begin(16.7);
    expect(budget.limit).toBe(Math.floor(BUDGET_MS / 1));
    budget.spent(4, 4);
    budget.warmUp();
    budget.begin(16.7);
    expect(budget.limit).toBe(MAX_DRAWS);
    budget.spent(4, 4);
    for (let f = 1; f < PREWARM_FRAMES; f++) {
      budget.begin(16.7);
      expect(budget.limit).toBe(Math.min(MAX_DRAWS, Math.floor(BUDGET_MS_START / 1)));
      budget.spent(4, 4);
    }
    budget.begin(16.7);
    expect(budget.limit).toBe(Math.floor(BUDGET_MS / 1));
  });

  it('on a phone that cannot keep up, drops the extras: no start budget, big bodies forced after 4 stale frames', () => {
    const budget = new SpriteBudget();
    // a drawing costs 2 ms: the 5 ms budget buys 2, under 3
    budget.begin(16.7);
    budget.spent(8, 4);
    budget.warmUp();
    budget.begin(16.7);
    expect(budget.tight).toBe(true);
    expect(budget.limit).toBe(MIN_DRAWS);
    const big = { who: 'b', px: 60, must: false, staleFor: 0, near: 0 };
    for (let i = 0; i < FORCE_FRAMES_TIGHT; i++) {
      expect(budget.forced(big)).toBe(false);
      budget.stale('b');
    }
    expect(budget.forced(big)).toBe(true);
    expect(FORCE_FRAMES_TIGHT).toBeGreaterThan(FORCE_FRAMES);
    // the must set is drawn regardless, and on a tight frame it counts: once it has used the count,
    // nobody else draws
    for (let i = 0; i < MIN_DRAWS; i++) {
      expect(budget.allow({ ...big, who: 'm' + i, must: true })).toBe(true);
      budget.drew('m' + i, true);
    }
    expect(budget.allow({ ...big, who: 'x', px: 20 })).toBe(false);
    budget.spent(8, 4);
    // a cheap phone after a slow frame is tight for that frame only
    const quick = new SpriteBudget();
    quick.begin(16.7);
    quick.spent(1, 4);
    quick.begin(40);
    expect(quick.tight).toBe(true);
    quick.spent(1, 4);
    quick.begin(16.7);
    expect(quick.tight).toBe(false);
    quick.spent(1, 4);
    // ... but inside the 30 frames after a start, which are heavy on purpose, a slow frame keeps the
    // start budget
    quick.warmUp();
    quick.begin(16.7);
    quick.spent(1, 4);
    quick.begin(40);
    expect(quick.tight).toBe(false);
    expect(quick.limit).toBe(Math.min(MAX_DRAWS, Math.floor(BUDGET_MS_START / quick.costMs())));
  });

  it('never lets the shared area pass the cap, across 3 rematches', () => {
    const pool = new AreaPool(AREA_CAP);
    let peak = 0;
    // the arena held through two rematches (the cache and its drawings kept, the motion reset), then a
    // fresh mount after the old renderer let go of everything
    let cache = new SpriteCache<Sprite>(100000, pool);
    let last = new Map<string, Sprite>();
    const budget = new SpriteBudget();
    for (let match = 0; match < 4; match++) {
      if (match === 3) {
        cache.dispose();
        expect(pool.used).toBe(0);
        cache = new SpriteCache<Sprite>(100000, pool);
        last = new Map();
      }
      budget.resetStale();
      budget.warmUp();
      const bs = bodies();
      for (let f = 0; f < 900; f++) {
        budget.begin(16.7);
        // big sprites (the 4x zoom of a replay): 120 art px, every frame new
        const plans = plansFor(bs, new Set(['b21']), match * 1000 + f).map((p) => ({ ...p, make: () => fake(156, 210) }));
        resolveSprites(plans, cache, last, budget, () => 0);
        peak = Math.max(peak, pool.used);
        expect(pool.used).toBeLessThanOrEqual(AREA_CAP);
      }
    }
    expect(pool.peak).toBeLessThanOrEqual(AREA_CAP);
    expect(peak).toBeGreaterThan(AREA_CAP * 0.9);
  });
});
