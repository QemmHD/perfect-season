// Implemented by Codex: regression cases for the execution problems reported by the owner.
import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/rng';
import { crossover, greenWindow, newPossession, releaseProbability, RIM, spin, step, stepback } from './engine';
import type { Hooper } from './types';
const player = (id: number): Hooper => ({
  id: 'test-' + id,
  name: 'Test Player',
  tag: 'TEST',
  num: id,
  ht: 78,
  wt: 220,
  pos: ['PG', 'SG', 'SF', 'PF', 'C'][id % 5],
  ovr: 85,
  spd: 85,
  acc: 85,
  hnd: 85,
  pas: 85,
  thr: 85,
  mid: 85,
  cls: 85,
  lay: 85,
  ft: 85,
  ddk: 50,
  sdk: 40,
  str: 85,
  vrt: 85,
  sta: 85,
  prd: 90,
  ind: 90,
  stl: 85,
  blk: 85,
  reb: 85,
  abil: [],
});
const possession = (iq = 0) => newPossession([0, 1, 2, 3, 4].map(player), [5, 6, 7, 8, 9].map(player), [1, 1, 1, 1, 1], rng(42), iq);
describe('basketball decision and motion quality', () => {
  it('rewards open perfect releases, grades nearby timing smoothly, and respects a smothering defender', () => {
    const p = possession(),
      b = p.bodies[0];
    const w = greenWindow(p, b, 'three', 'open');
    const at = (off: number) => releaseProbability(p, b, 'three', 'open', off, w);
    expect(at(0)).toBe(1);
    expect(at(w + 0.001)).toBeGreaterThan(0.95);
    expect(at(w + 0.02)).toBeGreaterThan(at(w + 0.08));
    expect(at(w + 0.08)).toBeGreaterThan(at(w + 0.2));
    expect(releaseProbability(p, b, 'layup', 'smothered', 0, w)).toBeLessThan(0.6);
    expect(releaseProbability(p, b, 'three', 'smothered', 0, w)).toBeLessThan(0.5);
  });
  it('keeps skill cooldown after the animation ends and lets a step-back/spin actually travel', () => {
    const p = possession(),
      h = p.bodies[0];
    stepback(p);
    const x = h.cx;
    for (let i = 0; i < 12; i++) step(p, 1 / 60, null);
    expect(h.cx).toBeLessThan(x - 1);
    expect(h.act).toBe('stepback');
    for (let i = 0; i < 20; i++) step(p, 1 / 60, null);
    const first = h.lastMoveAt;
    crossover(p, 1);
    expect(h.lastMoveAt).toBe(first);
    p.t = 1.5;
    spin(p, 1);
    const before = { cx: h.cx, cz: h.cz };
    for (let i = 0; i < 10; i++) step(p, 1 / 60, null);
    expect(h.act).toBe('spin');
    expect(Math.hypot(h.cx - before.cx, h.cz - before.cz)).toBeGreaterThan(0.5);
  });
  it('contains a straight head-on drive instead of retreating underneath the hoop', () => {
    const p = possession(1),
      h = p.bodies[0];
    p.scheme = 'man';
    h.cz = 0;
    p.bodies[5].cx = h.cx + 4.5;
    p.bodies[5].cz = 0;
    for (const b of p.bodies.filter((b) => b.idx !== 0 && b.idx !== 5)) b.cz = b.idx % 2 ? 22 : -22;
    for (let i = 0; i < 150 && !p.end; i++) step(p, 1 / 60, { cx: 1, cz: 0 });
    expect(RIM.cx - h.cx).toBeGreaterThan(12);
    expect(p.events).toContain('body-up');
  });
  it('changes timing tolerance by difficulty without changing any player attribute', () => {
    const easy = possession(-0.5),
      hard = possession(1);
    expect(greenWindow(easy, easy.bodies[0], 'three', 'open')).toBeGreaterThan(greenWindow(hard, hard.bodies[0], 'three', 'open'));
    expect(hard.bodies[0].p).toEqual(easy.bodies[0].p);
  });
});
