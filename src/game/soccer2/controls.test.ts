// The V2 control grammar and its geometry (Claude 2026-11-16, studio overhaul soccer-2; plan §5.8,
// acceptance C1 and C3): the cluster sits where V2 A.5 puts it on the owner's phone and the smallest,
// every touch lands where it should, taps are told from swipes, a tap finds the nearest teammate, the
// cluster never offers more than four targets, and the stand-in stick keeps nba's contract.
import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/rng';
import { classify, LOFT_HOLD, nearestWithin, nextBend, slotsFor, SWIPE_MS, SWIPE_PX, TAP_MS, TAP_PLAYER_PX, TAP_PX, targetsOf, zoneAt, type ControlPhase, type Slots } from './controls';
import { gapOf, geometryFor, type Insets, inStickZone, meets, rectOf, SPRINT_OFF, SPRINT_RING, STICK_IDLE, stickDown, stickGeom, stickIdle, stickMove, stickOut, stickUp, sprintEdge } from './v2';

/** The six QA presets (scripts/soccer/qa-isolate.mjs), plus the owner's phone with shell's 22 px edge. */
const PRESETS: { tag: string; W: number; H: number; ins: Insets }[] = [
  { tag: '393x852-sat59', W: 393, H: 852, ins: { t: 59, r: 0, b: 34, l: 0 } },
  { tag: '393x852-sat81', W: 393, H: 852, ins: { t: 81, r: 0, b: 34, l: 0 } },
  { tag: '390x844', W: 390, H: 844, ins: { t: 47, r: 0, b: 34, l: 0 } },
  { tag: '430x932', W: 430, H: 932, ins: { t: 59, r: 0, b: 34, l: 0 } },
  { tag: '375x667', W: 375, H: 667, ins: { t: 20, r: 0, b: 0, l: 0 } },
  { tag: '320x568', W: 320, H: 568, ins: { t: 0, r: 0, b: 0, l: 0 } },
];
const PHASES: ControlPhase[] = ['attack', 'freekick', 'corner', 'penalty'];

describe('V2 A.5 geometry (C1)', () => {
  it("puts A, B, C and D where V2 says on the owner's phone (393x852, insets 59/34)", () => {
    const g = geometryFor(393, 852, { t: 59, r: 0, b: 34, l: 0 });
    const want = { a: [92, 323, 738], b: [64, 238, 778], c: [48, 250, 694], d: [48, 340, 652] } as const;
    for (const [k, [d, x, y]] of Object.entries(want)) {
      const c = g[k as 'a'];
      expect(c.d).toBeCloseTo(d, 5);
      expect(Math.abs(c.cx - x)).toBeLessThanOrEqual(2);
      expect(Math.abs(c.cy - y)).toBeLessThanOrEqual(2);
    }
    expect(g.stickZone.x).toBe(0);
    expect(g.stickZone.x + g.stickZone.w).toBeCloseTo(188.6, 0);
    expect(g.stickZone.y).toBeCloseTo(383.4, 0);
    expect(g.stickZone.y + g.stickZone.h).toBe(818);
    expect(g.toast.y + g.toast.h).toBe(618);
    expect(g.bug.y).toBe(59 + 6);
    expect(g.bug.w).toBe(232);
    expect(g.heat).toMatchObject({ x: 80.5, y: 108, w: 232, h: 6 });
    expect(g.bug.y + g.bug.h).toBeLessThan(g.heat.y);
    expect(g.pause).toMatchObject({ w: 44, h: 44, x: 12, y: 63 });
    expect(g.safe.y).toBe(115);
    expect(g.safe.y + g.safe.h).toBe(568);
  });
  it('and at 320x568', () => {
    const g = geometryFor(320, 568, { t: 0, r: 0, b: 0, l: 0 });
    const want = { a: [84, 266, 510], b: [56, 190, 536], c: [44, 200, 468], d: [44, 282, 436] } as const;
    for (const [k, [d, x, y]] of Object.entries(want)) {
      const c = g[k as 'a'];
      expect(c.d).toBeCloseTo(d, 5);
      expect(Math.abs(c.cx - x)).toBeLessThanOrEqual(2);
      expect(Math.abs(c.cy - y)).toBeLessThanOrEqual(2);
    }
    expect(g.stickZone.x + g.stickZone.w).toBeCloseTo(153.6, 0);
    expect(g.stickZone.y).toBeCloseTo(255.6, 0);
    expect(g.toast.y + g.toast.h).toBe(404);
    expect(g.bug.y).toBe(4);
  });
  it('keeps every gap 10-18 px around A, every target at least 44 px, and the buttons out of the stick zone and the top two thirds', () => {
    for (const p of PRESETS) {
      const g = geometryFor(p.W, p.H, p.ins);
      for (const k of ['b', 'c', 'd'] as const) {
        const gap = gapOf(g.a, g[k]);
        expect(gap, p.tag + ' A-' + k).toBeGreaterThanOrEqual(10 - 0.5);
        expect(gap, p.tag + ' A-' + k).toBeLessThanOrEqual(18 + 0.5);
      }
      expect(gapOf(g.b, g.c)).toBeGreaterThanOrEqual(10);
      expect(gapOf(g.b, g.d)).toBeGreaterThanOrEqual(10);
      expect(gapOf(g.c, g.d)).toBeGreaterThanOrEqual(10);
      for (const k of ['a', 'b', 'c', 'd'] as const) {
        const r = rectOf(g[k]);
        expect(g[k].d, p.tag + ' ' + k).toBeGreaterThanOrEqual(44);
        expect(meets(r, g.stickZone), p.tag + ' ' + k + ' in the stick zone').toBe(false);
        expect(r.y, p.tag + ' ' + k + ' in the top two thirds').toBeGreaterThan(p.H / 3);
        expect(r.x + r.w).toBeLessThanOrEqual(p.W);
      }
      expect(g.pause.w).toBeGreaterThanOrEqual(44);
      expect(meets(g.pause, g.bug)).toBe(false);
      expect(g.bug.y).toBeGreaterThanOrEqual(p.ins.t);
    }
  });
});

describe('where a touch lands (C3)', () => {
  it('classifies 2,000 synthetic touches per preset into the right zone, in every phase', () => {
    for (const p of PRESETS) {
      const g = geometryFor(p.W, p.H, p.ins);
      const r = rng(7 + p.W + p.ins.t);
      for (const phase of PHASES) {
        const slots = slotsFor(phase);
        let n = 0;
        let wrong = 0;
        const check = (x: number, y: number, want: string) => {
          n++;
          if (zoneAt(g, slots, x, y) !== want) wrong++;
        };
        while (n < 2000) {
          // a thumb on each button that holds something (anywhere inside 92% of its radius)
          for (const id of targetsOf(slots)) {
            const c = g[id.toLowerCase() as 'a'];
            const ang = r() * Math.PI * 2;
            const rad = Math.sqrt(r()) * c.d * 0.46;
            check(c.cx + Math.cos(ang) * rad, c.cy + Math.sin(ang) * rad, id);
          }
          // the stick zone (above its home-bar band), and the pitch above it
          const z = g.stickZone;
          check(z.x + r() * z.w, z.y + r() * (z.h - 8), 'stick');
          check(r() * p.W, r() * (z.y - 1), 'pitch');
          // an empty slot is pitch, not a dead button
          for (const id of ['A', 'B', 'C', 'D'] as const) if (!slots[id]) check(g[id.toLowerCase() as 'a'].cx, g[id.toLowerCase() as 'a'].cy, 'pitch');
        }
        expect(wrong, p.tag + ' ' + phase).toBe(0);
      }
    }
  });
  it('tells a tap from a swipe: a tap-to-pass is misread under 2% of the time, a swipe never as a tap', () => {
    const r = rng(42);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    let taps = 0;
    let misread = 0;
    let swipes = 0;
    let swipeMiss = 0;
    for (let i = 0; i < 2000; i++) {
      // a real tap: the thumb wobbles a few px (sd 2.5) and lifts in 40-180 ms
      const tdx = gauss() * 2.5;
      const tdy = gauss() * 2.5;
      taps++;
      if (classify(tdx, tdy, 40 + r() * 140) !== 'tap') misread++;
      // a swipe: 50-160 px in 70-240 ms
      const L = 50 + r() * 110;
      const ang = r() * Math.PI * 2;
      swipes++;
      if (classify(Math.cos(ang) * L, Math.sin(ang) * L, 70 + r() * 170) !== 'swipe') swipeMiss++;
    }
    expect(misread / taps).toBeLessThanOrEqual(0.02);
    expect(swipeMiss).toBe(0);
    expect(classify(TAP_PX - 1, 0, TAP_MS - 1)).toBe('tap');
    expect(classify(0, 0, TAP_MS + 50)).toBe('hold');
    expect(classify(SWIPE_PX, 0, SWIPE_MS)).toBe('swipe');
    expect(classify(SWIPE_PX, 0, SWIPE_MS + 100)).toBe('drag');
    expect(LOFT_HOLD).toBeCloseTo(0.22, 5);
  });
  it('resolves a tap on the pitch to the nearest teammate inside the radius', () => {
    const pts = [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 120, y: 100 },
      { id: 3, x: 300, y: 300 },
    ];
    expect(nearestWithin(pts, 108, 100)?.id).toBe(1);
    expect(nearestWithin(pts, 112, 101)?.id).toBe(2);
    expect(nearestWithin(pts, 300 + TAP_PLAYER_PX - 1, 300)?.id).toBe(3);
    expect(nearestWithin(pts, 300 + TAP_PLAYER_PX + 1, 300)).toBeNull();
    expect(TAP_PLAYER_PX).toBeGreaterThanOrEqual(22);
  });
});

describe('the cluster', () => {
  it('never offers more than four targets; A is always SHOOT when it holds anything; D is empty in open play (TRICK is soccer-6)', () => {
    for (const phase of PHASES) {
      const s: Slots = slotsFor(phase);
      expect(targetsOf(s).length).toBeLessThanOrEqual(4);
      if (s.A) expect(s.A.act).toBe('shoot');
    }
    expect(slotsFor('attack').D).toBeNull();
    expect(slotsFor('attack').C?.act).toBe('thru');
    expect(slotsFor('attack').B?.act).toBe('pass');
    expect(slotsFor('penalty').B).toBeNull();
    expect(slotsFor('freekick').D?.act).toBe('bend');
  });
  it('cycles the free-kick bend straight, left, right and back', () => {
    expect(nextBend(0)).toBe(-1);
    expect(nextBend(-1)).toBe(1);
    expect(nextBend(1)).toBe(0);
  });
});

describe('the stand-in stick keeps the shared contract (plan §5.0.2)', () => {
  const g = stickGeom({ x: 0, y: 383, w: 189, h: 435 }, { x: 84, y: 730 }, 60);
  const at = (x: number, y: number, id = 1, t = 0) => ({ id, x, y, t });
  it('floats to the first touch in the zone, and only there', () => {
    const s = stickDown(stickIdle(g), at(100, 600), g);
    expect(s.origin).toEqual({ x: 100, y: 600 });
    expect(stickDown(stickIdle(g), at(300, 600), g).id).toBeNull();
    expect(stickDown(stickIdle(g), at(100, 300), g).id).toBeNull();
    expect(inStickZone(g, 100, 818 - 2)).toBe(false);
  });
  it('gives a two-axis vector of length at most 1, and {0, 0} on release (release-to-stop)', () => {
    let s = stickDown(stickIdle(g), at(100, 600), g);
    s = stickMove(s, at(100 - 30, 600 + 30), g);
    const o = stickOut(s, g);
    expect(o.x).toBeLessThan(0);
    expect(o.y).toBeGreaterThan(0);
    expect(Math.hypot(o.x, o.y)).toBeLessThanOrEqual(1 + 1e-9);
    s = stickMove(s, at(100 + 500, 600), g);
    expect(Math.hypot(stickOut(s, g).x, stickOut(s, g).y)).toBeCloseTo(1, 6);
    s = stickUp(s, at(0, 0), g);
    expect(stickOut(s, g)).toEqual(STICK_IDLE);
  });
  it('sprints past 1.15x the ring and keeps sprinting until back under 1.0x (hysteresis), with one edge', () => {
    let s = stickDown(stickIdle(g), at(100, 600), g);
    let o = stickOut(s, g);
    s = stickMove(s, at(100 + 60 * 1.1, 600), g);
    let n = stickOut(s, g, o);
    expect(n.sprint).toBe(false);
    o = n;
    s = stickMove(s, at(100 + 60 * (SPRINT_RING + 0.02), 600), g);
    n = stickOut(s, g, o);
    expect(n.sprint).toBe(true);
    expect(sprintEdge(o, n)).toBe(true);
    o = n;
    s = stickMove(s, at(100 + 60 * (SPRINT_OFF + 0.05), 600), g);
    n = stickOut(s, g, o);
    expect(n.sprint).toBe(true);
    expect(sprintEdge(o, n)).toBe(false);
    o = n;
    s = stickMove(s, at(100 + 60 * (SPRINT_OFF - 0.05), 600), g);
    n = stickOut(s, g, o);
    expect(n.sprint).toBe(false);
  });
  it('a thumb resting in the zone before the whistle already says where to go when it is read at the whistle', () => {
    // the stick tracks the pointer while the match is still at the line-up; the first read is live
    let s = stickDown(stickIdle(g), at(90, 650, 7, 1000), g);
    s = stickMove(s, at(90, 650 - 50, 7, 1200), g);
    const o = stickOut(s, g);
    expect(o.active).toBe(true);
    expect(o.y).toBeLessThan(-0.7);
  });
  it('one pointer per stick: a second finger neither takes nor moves it', () => {
    let s = stickDown(stickIdle(g), at(100, 600, 1), g);
    s = stickDown(s, at(50, 700, 2), g);
    expect(s.id).toBe(1);
    const before = stickOut(s, g);
    s = stickMove(s, at(10, 10, 2), g);
    expect(stickOut(s, g)).toEqual(before);
  });
  it('drags the ring along past 1.6x and keeps it where the whole ring shows', () => {
    let s = stickDown(stickIdle(g), at(70, 800), g);
    s = stickMove(s, at(-200, 900), g);
    expect(s.origin.x).toBeGreaterThanOrEqual(g.zone.x + g.ringR);
    expect(s.origin.y).toBeLessThanOrEqual(g.zone.y + g.zone.h);
  });
});
