// Conversion by distance (Claude 2026-11-16, studio overhaul soccer-4; plan S1). Guards, not the fit:
// the xG curve (display data) is real football's and monotone; and the engine's own conversion from a
// seeded drill (one shooter with an AI-like Pro timing and aim, the nearest defender closing him from
// 1.5-5 m, the real keeper) falls with distance from 6 m out, with the long range kept as rare as real
// football's. The drill has no back line in the lane, so its close and middle bands sit above a
// match's; the plan's tight match bands (35-55 / 18-32 / 8-15 / 4-8 / 1.5-4 / ≤ 1.5%) are measured on
// whole AI-vs-AI matches by scripts/soccer/sim.ts and recorded in the team doc.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { AIM_X, GX, kickOff, PL, pressShoot, releaseShoot, setAim, setupAttack, step } from './engine';
import { squadFor } from './squads.test-util';
import { xgOf } from './xg';

const A = squadFor('xg-a', 76);
const B = squadFor('xg-b', 76);
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

describe('xG (display only)', () => {
  it('falls with distance, a header is worth less than a foot, a wide angle less than central', () => {
    let prev = 1;
    for (let d = 1; d <= 40; d += 0.5) {
      const v = xgOf({ d, ang: 0, kind: 'shot' });
      expect(v).toBeLessThanOrEqual(prev + 1e-12);
      expect(v).toBeGreaterThan(0);
      prev = v;
    }
    for (const d of [6, 10, 14]) expect(xgOf({ d, ang: 0, kind: 'header' })).toBeLessThan(xgOf({ d, ang: 0, kind: 'shot' }));
    expect(xgOf({ d: 15, ang: 0.9, kind: 'shot' })).toBeLessThan(xgOf({ d: 15, ang: 0.1, kind: 'shot' }));
    expect(xgOf({ d: 11, ang: 0, kind: 'pen' })).toBeCloseTo(0.76, 9);
    expect(xgOf({ d: 22, ang: 0, kind: 'fk' })).toBeCloseTo(0.064, 9);
    // StatsBomb open play: 16-18 yd (14.6-16.5 m) foot about 10.9%, 25-30 yd about 2.5%
    expect(xgOf({ d: 15.5, ang: 0, kind: 'shot' })).toBeGreaterThan(0.09);
    expect(xgOf({ d: 15.5, ang: 0, kind: 'shot' })).toBeLessThan(0.14);
    expect(xgOf({ d: 25, ang: 0, kind: 'shot' })).toBeLessThan(0.035);
  });
});

/** One drilled shot from `d` m: the back line where the attack set-up puts it, the shooter's timing
 * and aim as the Pro pilot's. Returns whether it went in. */
function drill(i: number, d: number, r: () => number): boolean {
  const a = setupAttack('build', A, B, 'xgd' + i, { side: 1 });
  kickOff(a);
  const c = a.bodies[a.ctrl];
  const ang = (r() - 0.5) * 1.1;
  const x = GX + Math.sin(ang) * d;
  const y = PL - Math.cos(ang) * d;
  a.ball.owner = c.id;
  a.ball.flight = null;
  [c.x, c.y, c.vx, c.vy, c.fx, c.fy] = [x, y - 0.35, 0, 0, 0, 1];
  [a.ball.x, a.ball.y] = [x, y];
  // the nearest defender closing him from 1.5-5 m (sometimes inside the 2 m that turns the ring
  // amber), the rest of the defence where the set-up put it
  const defs = a.bodies.filter((b) => b.side === 'D' && b.role !== 'gk');
  const near = defs.reduce((p, q) => (Math.hypot(q.x - x, q.y - y) < Math.hypot(p.x - x, p.y - y) ? q : p));
  const t = r() * Math.PI * 2;
  const rr = 1.5 + r() * 3.5;
  [near.x, near.y] = [x + Math.cos(t) * rr, Math.min(PL - 0.5, y + Math.abs(Math.sin(t)) * rr)];
  if (!pressShoot(a)) return false;
  const s = r() < 0.5 ? -1 : 1;
  setAim(a, { x: Math.min(1, (s * (0.55 + r() * 0.3) * 3.3) / AIM_X), y: -0.9 + r() * 1.1 });
  const top = a.meter!.top;
  for (let k = 0; k < Math.round(top * 60) - 1 && a.meter; k++) step(a, 1 / 60, { x: 0, y: 0 });
  if (!a.meter) return a.end?.kind === 'G';
  releaseShoot(a, null, 0, Math.max(0.15, top + gauss(r) * 0.057));
  for (let k = 0; k < 60 * 6 && !a.end; k++) step(a, 1 / 60, { x: 0, y: 0 });
  return a.end?.kind === 'G';
}

describe('S1 guard: conversion falls with distance', () => {
  it('drilled shots by band: falling with distance, long range as rare as real', () => {
    const r = rng(hashString('s1-bands'));
    const bands: [number, number, number, number][] = [
      // [lo m, hi m, min, max]
      [3, 6, 0.1, 0.6],
      [6, 11, 0.25, 0.6],
      [11, 16.5, 0.15, 0.45],
      [16.5, 22, 0, 0.15],
      [22, 30, 0, 0.08],
      [30, 36, 0, 0.05],
    ];
    const rates: number[] = [];
    let i = 0;
    for (const [lo, hi, min, max] of bands) {
      const n = 100;
      let g = 0;
      for (let k = 0; k < n; k++) if (drill(i++, lo + r() * (hi - lo), r)) g++;
      const rate = g / n;
      rates.push(rate);
      expect(rate, `${lo}-${hi} m: ${g}/${n}`).toBeGreaterThanOrEqual(min);
      expect(rate, `${lo}-${hi} m: ${g}/${n}`).toBeLessThanOrEqual(max);
    }
    // monotone from 6 m out (a 3-6 m drilled shot is mostly from a tight angle)
    for (let k = 2; k < rates.length; k++) expect(rates[k], 'band ' + k + ' ' + rates.join(' ')).toBeLessThanOrEqual(rates[k - 1] + 0.03);
  }, 60_000);
});
