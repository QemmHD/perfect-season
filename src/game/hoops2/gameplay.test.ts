// Implemented by Codex: regression cases for the execution problems reported by the owner.
import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/rng';
import { callPlay, cancelShoot, jumpRebound, pressShoot, releaseShoot, crossover, dist, greenWindow, newPossession, releaseProbability, RIM, spin, step, stepback } from './engine';
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
  abil: []
});
const possession = (iq = 0) => newPossession([0, 1, 2, 3, 4].map(player), [5, 6, 7, 8, 9].map(player), [1, 1, 1, 1, 1], rng(42), iq);
describe('basketball decision and motion quality', () => {
  it('cancels an interrupted held jumper without firing a shot or resetting the clock/ratings', () => {
    const p = possession();
    p.scheme = 'man';
    const ratings = JSON.stringify(p.bodies.map((b) => b.p));
    pressShoot(p);
    for (let i = 0; i < 8; i++) step(p, 1 / 60, null);
    const clock = p.clock,
      height = p.bodies[0].h;
    expect(cancelShoot(p)).toBe(true);
    expect(p.meter).toBeNull();
    expect(p.ball).toBeNull();
    expect(p.bodies[0].h).toBe(height);
    expect(p.clock).toBe(clock);
    for (let i = 0; i < 50; i++) step(p, 1 / 60, null);
    expect(p.ball).toBeNull();
    expect(p.lastShot).toBeNull();
    expect(p.clock).toBeLessThan(clock);
    expect(JSON.stringify(p.bodies.map((b) => b.p))).toBe(ratings);
  });
  it('does not cancel a committed shot or a finish after the player actually released', () => {
    const p = possession();
    pressShoot(p);
    p.t += 0.52;
    releaseShoot(p);
    const ball = p.ball;
    expect(cancelShoot(p)).toBe(false);
    expect(p.ball).toBe(ball);
    const close = possession();
    Object.assign(close.bodies[0], { cx: RIM.cx - 2, cz: 0 });
    pressShoot(close);
    expect(close.finish).not.toBeNull();
    expect(cancelShoot(close)).toBe(false);
  });

  it('moves the called teammate on a cut, spaces back out and enforces a persistent call cooldown', () => {
    const p = possession();
    p.scheme = 'man';
    p.target = 1;
    const cutter = p.bodies[1],
      before = dist(cutter, RIM),
      ratings = JSON.stringify(p.bodies.map((b) => b.p));
    expect(callPlay(p, 'cut')).toBe(true);
    expect(p.playCall?.actor).toBe(1);
    expect(callPlay(p, 'screen')).toBe(false);
    for (let i = 0; i < 35; i++) step(p, 1 / 60, null);
    expect(dist(cutter, RIM)).toBeLessThan(before - 2);
    expect(callPlay(p, 'space')).toBe(true);
    expect(cutter.cutUntil).toBe(0);
    expect(callPlay(p, 'cut')).toBe(false);
    expect(JSON.stringify(p.bodies.map((b) => b.p))).toBe(ratings);
    p.ball = { kind: 'pass', from: { cx: 0, cz: 0, h: 1 }, to: { cx: 1, cz: 0, h: 1 }, t0: p.t, t1: p.t + 1, arc: 1, who: 1 };
    expect(callPlay(p, 'space')).toBe(false);
  });
  it('walks a screener to his landmark, plants and rolls without teleporting or stunning defenders', () => {
    const p = possession();
    p.scheme = 'man';
    expect(callPlay(p, 'screen')).toBe(true);
    const c = p.playCall!,
      actor = p.bodies[c.actor],
      start = { cx: actor.cx, cz: actor.cz };
    // Isolate the approach, then exercise real planted contact with an on-ball defender.
    for (const d of p.bodies.filter((b) => b.side === 'D')) {
      d.cz = 23;
      d.cx = 44;
      d.stunUntil = 0;
    }
    const before = JSON.stringify(p.bodies.map((b) => b.p));
    let planted = false;
    for (let i = 0; i < 350 && !p.end; i++) {
      const last = { cx: actor.cx, cz: actor.cz };
      step(p, 1 / 60, null);
      expect(dist(actor, last)).toBeLessThan(0.8);
      if (c.plantedAt !== undefined) planted = true;
      if (c.rolling) break;
    }
    expect(dist(actor, start)).toBeGreaterThan(3);
    expect(planted).toBe(true);
    expect(c.rolling).toBe(true);
    expect(p.bodies.filter((b) => b.side === 'D').every((d) => d.stunUntil === 0)).toBe(true);
    expect(JSON.stringify(p.bodies.map((b) => b.p))).toBe(before);
    p.end = { kind: 'clock', who: 0, points: 0, text: 'CLOCK' };
    expect(callPlay(p, 'cut')).toBe(false);
  });
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

// Core overhaul: test physical outcomes, not the implementation's internal formulas.
describe('physical NBA possessions', () => {
  function looseAt(height = 0) {
    const p = possession();
    p.scheme = 'man';
    p.t = 0.3;
    p.handler = null;
    p.rebounder = 0;
    for (const b of p.bodies) {
      b.cx = 10;
      b.cz = b.idx % 2 ? 22 : -22;
      b.stunUntil = 0;
    }
    Object.assign(p.bodies[0], { cx: 35, cz: 0 });
    p.ball = { kind: 'loose', from: { cx: 35, cz: 0, h: height }, to: { cx: 35, cz: 0, h: height }, t0: 0, t1: 1, arc: 0, who: -1 };
    return p;
  }
  it('awards a loose ball to the player who reaches it without moving him to a scripted spot', () => {
    for (const side of ['O', 'D']) {
      const p = looseAt();
      const winner = p.bodies[side === 'O' ? 0 : 5];
      if (side === 'D') Object.assign(p.bodies[0], { cx: 15, cz: 20 });
      Object.assign(winner, { cx: 34.2, cz: 0 });
      const before = { cx: winner.cx, cz: winner.cz };
      step(p, 1 / 60, null);
      expect(dist(winner, before)).toBeLessThan(0.3);
      expect(dist(winner, { cx: 35, cz: 0 })).toBeGreaterThan(0.4);
      if (side === 'O') {
        expect(p.handler).toBe(winner.idx);
        expect(p.events).toContain('orb:' + winner.idx);
      } else {
        expect(p.end?.kind).toBe('miss');
        expect(p.end?.text).toContain(winner.p.tag);
      }
    }
  });
  it('requires vertical reach and allows the controlled player to time a real rebound jump', () => {
    const p = looseAt(10);
    step(p, 1 / 60, null);
    expect(p.handler).toBeNull();
    expect(jumpRebound(p)).toBe(true);
    expect(jumpRebound(p)).toBe(false);
    for (let i = 0; i < 18 && p.ball; i++) step(p, 1 / 60, null);
    expect(p.handler).toBe(0);
    expect(p.bodies[0].h).toBeGreaterThan(1);
    expect(jumpRebound(p)).toBe(false);
  });
  it('catches a reachable pass in place and gives an immediate set receiver a quicker shot rhythm', () => {
    const p = possession();
    p.scheme = 'man';
    p.t = 1;
    p.handler = null;
    const b = p.bodies[1];
    Object.assign(b, { cx: 26, cz: -18, vx: 0, vz: 0 });
    for (const d of p.bodies.filter((b) => b.side === 'D')) {
      d.cx = 44;
      d.cz = 22;
    }
    p.ball = { kind: 'pass', from: { cx: 20, cz: 0, h: 6 }, to: { cx: 28, cz: -18, h: 6 }, t0: 0, t1: 1, arc: 1, who: 1 };
    step(p, 1 / 60, null);
    expect(p.handler).toBe(1);
    expect(b.cx).toBeLessThan(26.3);
    pressShoot(p);
    expect(p.meter?.style).toBe('catch');
    expect(p.meter!.top).toBeLessThan(0.52);
    const moving = possession();
    Object.assign(moving.bodies[0], { vx: 8 });
    pressShoot(moving);
    expect(moving.meter?.style).toBe('pullup');
    expect(moving.meter!.top).toBeGreaterThan(0.52);
  });
  it('cannot turn an unreachable alley-oop into a dunk by relocating its receiver', () => {
    const p = possession();
    p.handler = null;
    p.t = 1;
    const b = p.bodies[1],
      before = { cx: b.cx, cz: b.cz };
    p.ball = { kind: 'lob', from: { cx: 20, cz: 0, h: 6 }, to: { ...RIM, h: 11.5 }, t0: 0, t1: 1, arc: 5, who: 1 };
    step(p, 1 / 60, null);
    expect(p.end?.text).toBe('MISSED LOB');
    expect(dist(b, before)).toBeLessThan(0.5);
    expect(p.events).not.toContain('oop-catch');
  });
  it('rotates a second defender to the helper’s assignment when an on-ball defender is beaten', () => {
    const p = possession();
    p.scheme = 'man';
    Object.assign(p.bodies[0], { cx: 35, cz: 0 });
    Object.assign(p.bodies[5], { cx: 25, cz: 0 });
    step(p, 1 / 60, null);
    expect(p.rotation?.helper).not.toBeNull();
    expect(p.rotation?.rotator).not.toBeNull();
    expect(p.rotation?.rotator).not.toBe(p.rotation?.helper);
    expect(p.rotation?.rotator).not.toBe(5);
    expect(p.bodies[p.rotation!.helper!].mark).toBe(p.rotation?.cover);
  });
});
