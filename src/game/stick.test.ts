// The floating stick's rules (plan §4.2, §3.8): the dead zone and its rescale, sprint at 1.15 R with
// one edge per push, the ring following past 1.6 R, the home band, a second finger ignored, a fixed
// stick, and an output that is never null.
import { describe, expect, it } from 'vitest';
import { DEAD_ZONE, FOLLOW_RING, SPRINT_RING, stickDown, stickGeom, stickIdle, stickMove, stickOut, stickUp, sprintEdge, type StickOut } from './stick';

// the 393 x 852 phone: zone x 0-189, y 383-818; ghost ring Ø120 at (84, 730)
const G = stickGeom({ x: 0, y: 383, w: 189, h: 435 }, { x: 84, y: 730 }, 60);
const at = (x: number, y: number, id = 1, t = 0) => ({ id, x, y, t });
const held = (dx: number, dy: number, g = G) => {
  let s = stickDown(stickIdle(g), at(100, 600), g);
  s = stickMove(s, at(100 + dx, 600 + dy), g);
  return { s, o: stickOut(s, g) };
};

describe('the floating stick', () => {
  it('spawns under the thumb anywhere in the zone, and nowhere else', () => {
    const s = stickDown(stickIdle(G), at(120, 500), G);
    expect(s.id).toBe(1);
    expect(s.origin).toEqual({ x: 120, y: 500 });
    expect(stickDown(stickIdle(G), at(250, 600), G).id).toBeNull(); // right of the zone
    expect(stickDown(stickIdle(G), at(100, 300), G).id).toBeNull(); // above it
    expect(stickDown(stickIdle(G), at(100, 815), G).id).toBeNull(); // the home band
  });
  it('a second finger never takes a held stick', () => {
    const s = stickDown(stickIdle(G), at(100, 600, 1), G);
    expect(stickDown(s, at(60, 700, 2), G)).toBe(s);
    expect(stickMove(s, at(160, 600, 2), G)).toBe(s);
  });
  it('has a 12% dead zone, then rescales linearly to 1 at the ring', () => {
    expect(DEAD_ZONE).toBe(0.12);
    expect(held(7, 0).o).toEqual({ x: 0, y: 0, mag: 0, sprint: false, active: true });
    const just = held(8, 0).o;
    expect(just.mag).toBeGreaterThan(0);
    expect(just.mag).toBeCloseTo((8 / 60 - 0.12) / 0.88, 6);
    expect(held(0.56 * 60, 0).o.mag).toBeCloseTo(0.5, 6);
    expect(held(60, 0).o.mag).toBeCloseTo(1, 6);
    const up = held(0, -45).o;
    expect(up.x).toBeCloseTo(0, 9);
    expect(up.y).toBeLessThan(0);
  });
  it('sprints from 1.15 x the ring, and the edge fires once per push', () => {
    expect(SPRINT_RING).toBe(1.15);
    expect(held(68.9, 0).o.sprint).toBe(false);
    expect(held(69.1, 0).o.sprint).toBe(true);
    // one push out, wobble out there, back in, out again: two edges
    let s = stickDown(stickIdle(G), at(100, 600), G);
    let prev: StickOut = stickOut(s, G);
    let edges = 0;
    for (const dx of [20, 50, 70, 75, 80, 72, 90, 50, 30, 71, 80]) {
      s = stickMove(s, at(100 + dx, 600), G);
      const o = stickOut(s, G);
      if (sprintEdge(prev, o)) edges++;
      prev = o;
    }
    expect(edges).toBe(2);
  });
  it('no sprint ring when the sport asks for a Burst button instead', () => {
    const g = stickGeom(G.zone, G.ghost, 60, { sprint: false });
    expect(held(110, 0, g).o.sprint).toBe(false);
  });
  it('the ring follows the thumb past 1.6 R, so it never runs out of travel', () => {
    expect(FOLLOW_RING).toBe(1.6);
    const { s } = held(150, 0);
    const d = Math.hypot(s.pos.x - s.origin.x, s.pos.y - s.origin.y);
    expect(d).toBeCloseTo(96, 6);
    // and turning back the other way responds at once, from the dragged ring
    const back = stickOut(stickMove(s, at(s.origin.x - 30, 600), G), G);
    expect(back.x).toBeLessThan(0);
  });
  it('is never null: idle and centred are zero vectors', () => {
    expect(stickOut(stickIdle(G), G)).toEqual({ x: 0, y: 0, mag: 0, sprint: false, active: false });
    const s = stickDown(stickIdle(G), at(100, 600), G);
    expect(stickOut(s, G)).toEqual({ x: 0, y: 0, mag: 0, sprint: false, active: true });
    expect(stickOut(stickUp(s, at(100, 600), G), G).active).toBe(false);
  });
  it('a held thumb keeps its direction for the whistle (nothing resets it between possessions)', () => {
    // the component tracks the pointer while disabled and reports it the moment it enables; the
    // pure state carries the push unchanged
    const { s } = held(-50, 0);
    const later = stickOut({ ...s }, G);
    expect(later.x).toBeLessThan(-0.7);
    expect(later.active).toBe(true);
  });
  it('a fixed (permanent) stick pushes from the ghost ring and never moves', () => {
    const g = stickGeom(G.zone, G.ghost, 60, { floating: false });
    let s = stickDown(stickIdle(g), at(114, 730), g);
    expect(s.origin).toEqual({ x: 84, y: 730 });
    expect(stickOut(s, g).mag).toBeCloseTo((0.5 - 0.12) / 0.88, 6);
    s = stickMove(s, at(300, 730), g);
    expect(s.origin).toEqual({ x: 84, y: 730 });
    expect(stickOut(s, g).sprint).toBe(true);
  });
});
