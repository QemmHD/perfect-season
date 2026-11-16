// Gestures on SHOOT (plan §3.8): 200 jittered gestures of each kind, misread at most 2% of the time,
// fed through the same tracker the cluster uses; and the tracker keeps several fingers apart.
import { describe, expect, it } from 'vitest';
import { classify, ClusterTracker, type ClusterInput, type Gesture } from './gestures';

/** a small seeded generator (mulberry32) so the jitter is the same every run */
function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Kind = 'tap' | 'hold' | 'L' | 'R' | 'U' | 'D';
/** one finger's touch: the points it reports (every 8-17 ms, like a phone's touch stream) */
function gesture(kind: Kind, r: () => number) {
  const x0 = 300 + r() * 40;
  const y0 = 720 + r() * 40;
  const pts: { x: number; y: number; t: number }[] = [{ x: x0, y: y0, t: 0 }];
  const tick = () => 8 + r() * 9;
  if (kind === 'tap' || kind === 'hold') {
    const dur = kind === 'tap' ? 25 + r() * 80 : 170 + r() * 600;
    const wob = kind === 'tap' ? 7 : 9;
    for (let t = tick(); t < dur; t += tick()) pts.push({ x: x0 + (r() - 0.5) * wob, y: y0 + (r() - 0.5) * wob, t });
    return { pts, up: dur };
  }
  // a flick: a short settle, then 45-110 px in 60-200 ms, up to 30° off its axis
  const ang = { R: 0, D: 90, L: 180, U: 270 }[kind] + (r() - 0.5) * 60;
  const len = 45 + r() * 65;
  const settle = r() * 40;
  const dur = 60 + r() * 140;
  for (let t = tick(); t < settle + dur; t += tick()) {
    const k = Math.max(0, Math.min(1, (t - settle) / dur));
    const e = k * k * (3 - 2 * k);
    pts.push({ x: x0 + Math.cos((ang * Math.PI) / 180) * len * e + (r() - 0.5) * 3, y: y0 + Math.sin((ang * Math.PI) / 180) * len * e + (r() - 0.5) * 3, t });
  }
  return { pts, up: settle + dur + tick() };
}
/** through the tracker: the swipe from its move, else the gesture on the lift */
function read(kind: Kind, r: () => number): Gesture | undefined {
  const { pts, up } = gesture(kind, r);
  const tr = new ClusterTracker(() => true);
  tr.down('A', 7, pts[0].x, pts[0].y, 1000);
  let got: Gesture | undefined;
  for (const q of pts.slice(1)) {
    const e = tr.move(7, q.x, q.y, 1000 + q.t);
    if (e?.gesture && !got) got = e.gesture;
  }
  const last = pts[pts.length - 1];
  const e = tr.up(7, last.x, last.y, 1000 + up);
  return got ?? e?.gesture;
}
const right = (k: Kind, g: Gesture | undefined) => (k === 'tap' || k === 'hold' ? g?.kind === k : g?.kind === 'swipe' && g.dir === k);

describe('gestures on a button', () => {
  it('reads 200 jittered gestures of each kind at least 98% right', () => {
    const wrong: Record<string, number> = {};
    for (const k of ['tap', 'hold', 'L', 'R', 'U', 'D'] as Kind[]) {
      const r = rand(k.charCodeAt(0) * 7919);
      let miss = 0;
      for (let i = 0; i < 200; i++) if (!right(k, read(k, r))) miss++;
      wrong[k] = miss;
    }
    for (const [k, n] of Object.entries(wrong)) expect(n, k + ' misread ' + n + '/200').toBeLessThanOrEqual(4);
  });
  it('a tap is quick and still; a long or drifting press is a hold; 36 px in 250 ms is a swipe', () => {
    expect(classify([{ x: 0, y: 0, t: 0 }], 0, 80)?.kind).toBe('tap');
    expect(classify([{ x: 0, y: 0, t: 0 }], 0, 130)?.kind).toBe('hold');
    expect(classify([{ x: 0, y: 0, t: 0 }, { x: 14, y: 0, t: 40 }], 0, 90)?.kind).toBe('hold');
    expect(classify([{ x: 0, y: 0, t: 0 }, { x: -40, y: 5, t: 120 }], 0, null)).toEqual({ kind: 'swipe', dir: 'L', heldMs: 120 });
    expect(classify([{ x: 0, y: 0, t: 0 }, { x: 0, y: 40, t: 300 }], 0, 320)?.kind).toBe('hold'); // too slow
    // still down: undecided until 120 ms, then a hold
    expect(classify([{ x: 0, y: 0, t: 0 }, { x: 1, y: 0, t: 60 }], 0, null)).toBeNull();
    expect(classify([{ x: 0, y: 0, t: 0 }, { x: 1, y: 0, t: 125 }], 0, null)?.kind).toBe('hold');
  });
});

describe('the cluster tracker', () => {
  it("delivers 'down' on the finger's down, before any gesture is known", () => {
    const tr = new ClusterTracker(() => true);
    expect(tr.down('A', 1, 300, 700, 50)).toEqual({ slot: 'A', phase: 'down', t: 50, dist: 0, x: 300, y: 700 });
  });
  it('tracks two fingers (and the stick) at once, each on its own slot', () => {
    const tr = new ClusterTracker((s) => s === 'A');
    const out: ClusterInput[] = [];
    const push = (e: ClusterInput | null) => e && out.push(e);
    push(tr.down('A', 11, 320, 740, 0));
    push(tr.down('B', 12, 238, 778, 5));
    expect(tr.held().sort()).toEqual(['A', 'B']);
    push(tr.move(11, 321, 739, 30));
    push(tr.up(12, 238, 778, 60));
    push(tr.up(11, 321, 739, 400));
    expect(out.map((e) => e.slot + e.phase + (e.gesture?.kind ?? ''))).toEqual(['Adown', 'Bdown', 'Amove', 'Buptap', 'Auphold']);
    // a second finger on a held slot is not a second press
    tr.down('A', 21, 320, 740, 500);
    expect(tr.down('A', 22, 330, 745, 510)).toBeNull();
  });
  it('a swipe goes out once, on the move that makes it; the lift then carries no gesture', () => {
    const tr = new ClusterTracker(() => true);
    tr.down('A', 1, 300, 700, 0);
    expect(tr.move(1, 310, 700, 20)?.gesture).toBeUndefined();
    expect(tr.move(1, 340, 700, 60)?.gesture).toEqual({ kind: 'swipe', dir: 'R', heldMs: 60 });
    expect(tr.move(1, 380, 700, 90)?.gesture).toBeUndefined();
    expect(tr.up(1, 380, 700, 120)?.gesture).toBeUndefined();
  });
  it('a slot without swipes never reports one; the OS taking the touch cancels everything held', () => {
    const tr = new ClusterTracker(() => false);
    tr.down('B', 1, 200, 700, 0);
    expect(tr.move(1, 260, 700, 50)?.gesture).toBeUndefined();
    expect(tr.up(1, 260, 700, 80)?.gesture?.kind).toBe('hold');
    tr.down('B', 2, 200, 700, 100);
    tr.down('C', 3, 250, 690, 100);
    expect(tr.clear(200).map((e) => e.slot + e.phase)).toEqual(['Bcancel', 'Ccancel']);
    expect(tr.held()).toEqual([]);
  });
});
