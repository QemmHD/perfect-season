// First-time hits (Claude 2026-11-16, studio overhaul soccer-4; plan S9): a shot or a pass played
// straight off the ball is harder to keep true the more it turns the ball. ×1 straight on, ×1.2 at 90°,
// ×1.6 at 135° or more, for shots and passes alike; and turning it more than 90° first time is an
// amber ring (no gold).
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { FIRST_TIME, firstTimeMult, GX, kickOff, pass, setupAttack } from './engine';
import { squadFor } from './squads.test-util';

const A = squadFor('ft-a', 78);
const B = squadFor('ft-b', 76);

describe('S9: the first-time multiplier', () => {
  it('is exact: 1 straight on, 1.2 at 90°, 1.6 at 135° and beyond, monotone between', () => {
    expect(firstTimeMult(0)).toBe(1);
    expect(firstTimeMult(45)).toBeCloseTo(1.1, 12);
    expect(firstTimeMult(90)).toBeCloseTo(1.2, 12);
    expect(firstTimeMult(112.5)).toBeCloseTo(1.4, 12);
    expect(firstTimeMult(135)).toBeCloseTo(1.6, 12);
    expect(firstTimeMult(180)).toBeCloseTo(1.6, 12);
    // the plan's bands: ×1.15-1.25 at 90°, ×1.5-1.7 at 180°
    expect(firstTimeMult(90)).toBeGreaterThanOrEqual(1.15);
    expect(firstTimeMult(90)).toBeLessThanOrEqual(1.25);
    expect(firstTimeMult(180)).toBeGreaterThanOrEqual(1.5);
    expect(firstTimeMult(180)).toBeLessThanOrEqual(1.7);
    let prev = 0;
    for (let t = 0; t <= 180; t += 2.5) {
      expect(firstTimeMult(t)).toBeGreaterThanOrEqual(prev);
      prev = firstTimeMult(t);
    }
  });

  it('a pass played first time across the ball strays more than one played after a settling touch (drill, ±0.1 of the multiplier)', () => {
    // the pass's direction error, measured: the same pass from the same spot, with the ball having come
    // to the passer the opposite way (a 180° turn) or after he settled it (no first-time touch)
    const spread = (first: boolean) => {
      const r = rng(hashString('ft-pass' + first));
      const errs: number[] = [];
      for (let i = 0; i < 1600; i++) {
        const a = setupAttack('build', A, B, 'ftp' + (first ? 'f' : 's') + i, { side: 1 });
        kickOff(a);
        const c = a.bodies[a.ctrl];
        a.ball.owner = c.id;
        a.ball.flight = null;
        [c.x, c.y, c.vx, c.vy, c.fx, c.fy] = [GX, 60, 0, 0, 0, 1];
        [a.ball.x, a.ball.y] = [GX, 60.35];
        for (const b of a.bodies) if (b.side === 'D') [b.x, b.y, b.stunUntil] = [2, 31, Infinity];
        // one teammate straight up the pitch, the rest out of the way, so every pass is the same pass
        const mates = a.bodies.filter((b) => b.side === 'A' && b.id !== c.id);
        mates.forEach((b, k) => ([b.x, b.y, b.vx, b.vy] = k === 0 ? [GX, 80, 0, 0] : [60, 35 + k, 0, 0]));
        if (first) a.recv = { by: c.id, at: a.t - FIRST_TIME.window * r(), dx: 0, dy: -1 };
        if (!pass(a, 'ground', { x: 0, y: 1 }, false) || !a.kick) continue;
        errs.push(Math.atan2(a.kick.vx, a.kick.vy));
      }
      const m = errs.reduce((s, x) => s + x, 0) / errs.length;
      return Math.sqrt(errs.reduce((s, x) => s + (x - m) ** 2, 0) / errs.length);
    };
    const ratio = spread(true) / spread(false);
    expect(ratio).toBeGreaterThan(1.6 - 0.1);
    expect(ratio).toBeLessThan(1.6 + 0.1);
  });
});
