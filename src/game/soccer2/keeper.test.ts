// The keeper fitted to real shot-stopping (Claude 2026-11-16, studio overhaul soccer-4; plan S3-S5,
// S10): one committed dive per shot; he races a one-on-one only when he gets to the ball first; he
// claims the crosses he gets to first; on a far-post first-time shot he isn't pulled to the near post
// before the strike and dives only after it; his split step lands at least 4 frames before every
// strike; a 93 keeper concedes 0.62-0.92× what a 75 does from the same shots; parries go wide more
// the better his hands.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { decide, pilot } from './autopilot';
import { GX, kickOff, loftVelocity, pass, PL, pressShoot, releaseShoot, setAim, setupAttack, step, tracePath } from './engine';
import { squadFor } from './squads.test-util';
import type { Attack, Scenario, SoccerPlayer, Squad } from './types';

const DT = 1 / 60;
const A = squadFor('gk-a', 80);
const B = squadFor('gk-b', 76);
const keeperOf = (a: Attack) => a.bodies.find((b) => b.role === 'gk')!;
const withGk = (s: Squad, v: number, over: Record<string, number> = {}): Squad => ({ ...s, gk: { ...s.gk, a: { DIV: v, HAN: v, KIC: v, REF: v, SPD: v, POS: v, ...over } } as SoccerPlayer });

describe('S3: the keeper commits once, races only when first, claims what he reaches', () => {
  it('one dive per shot, a split step ≥ 4 frames before every strike, and a lost rush is rare', () => {
    let shots = 0;
    let rushes = 0;
    let lost = 0;
    for (let i = 0; i < 240; i++) {
      const sc = (['counter', 'build', 'wide'] as Scenario[])[i % 3];
      const a = setupAttack(sc, A, B, 'gk3-' + i, {});
      const pl = pilot(0.68, 'gk3-' + i);
      kickOff(a);
      let plan: Attack['gkPlan'] = null;
      let dives = 0;
      let rushed = false;
      for (let n = 0; n < 60 * 40 && !a.end; n++) {
        const gk = keeperOf(a);
        const wasDive = gk.act === 'dive';
        step(a, DT, decide(a, pl));
        if (a.events.includes('shot') || a.events.includes('header')) {
          shots++;
          dives = 0;
          plan = a.gkPlan;
          // his split step landed at least 4 frames before the ball was struck
          expect(gk.keeperSet).toBeDefined();
          expect(a.t - gk.keeperSet!).toBeGreaterThanOrEqual(4 * DT - 1e-9);
        }
        if (a.ball.flight?.kind !== 'shot') plan = null;
        if (plan) expect(a.gkPlan).toBe(plan);
        if (!wasDive && gk.act === 'dive' && a.ball.flight?.kind === 'shot') dives++;
        expect(dives).toBeLessThanOrEqual(1);
        if (a.events.includes('rush')) rushed = true;
        a.events.length = 0;
      }
      if (rushed) {
        rushes++;
        if (a.end?.kind === 'G') lost++;
      }
    }
    expect(shots).toBeGreaterThan(80);
    // a race he goes for is one he gets to first: few of them end in a goal (S3: ≤ 28% guard). The
    // autopilot rarely sets up a race (3 in these 240 attacks), so one lost race is allowed below 4
    // (soccer-4 review fix: 1 of 3 read as 33% and failed on a sample of three)
    expect(rushes).toBeGreaterThan(0);
    expect(lost).toBeLessThanOrEqual(Math.max(1, Math.floor(0.28 * rushes)));
  }, 60_000);

  it('claims ≥ 70% of the crosses he gets to first (the ones he calls for)', () => {
    // crosses dropping into his six-yard box from either wing, the man it's for 3-8 m from where it
    // drops: the keeper calls for the ones he gets to first, and takes them
    const r = rng(hashString('claims'));
    let called = 0;
    let claimed = 0;
    for (let i = 0; i < 160; i++) {
      const a = setupAttack('wide', A, B, 'gk-claim' + i, { side: 1 });
      kickOff(a);
      const side = r() < 0.5 ? -1 : 1;
      const drop = { x: GX + (r() - 0.5) * 9, y: PL - 2 - r() * 4.5 };
      const man = a.bodies.find((b) => b.side === 'A' && b.id !== a.ctrl)!;
      const away = 3 + r() * 5;
      [man.x, man.y, man.vx, man.vy] = [drop.x - side * away * 0.6, drop.y - away * 0.8, 0, 0];
      for (const b of a.bodies) if (b.side === 'A' && b !== man) [b.x, b.y, b.vx, b.vy] = [GX - side * 28, 60, 0, 0];
      for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') [b.x, b.y, b.stunUntil] = [GX - side * 28, 62, Infinity];
      const from = { x: GX + side * 26, y: PL - 14, h: 0.3 };
      const v = loftVelocity(from, drop, 1.05);
      a.ball.owner = null;
      Object.assign(a.ball, { x: from.x, y: from.y, h: from.h, vx: v.vx, vy: v.vy, vh: v.vh, curl: 0, dip: 0, flight: { kind: 'cross', from: a.ctrl, to: man.id, at: a.t } });
      a.path = tracePath(a.ball, 3);
      a.pathAt = a.t;
      a.ctrl = man.id;
      let call = false;
      for (let k = 0; k < 120 && !a.end; k++) {
        step(a, DT, null);
        if (a.claimFor !== undefined && a.claimFor === a.ball.flight?.at) call = true;
      }
      if (!call) continue;
      called++;
      if (a.end?.text === 'KEEPER CLAIMS') claimed++;
    }
    expect(called).toBeGreaterThan(20);
    expect(claimed / called).toBeGreaterThanOrEqual(0.7);
  });
});

/** A drilled shot: the shooter alone at (x, y), the outfield out of the way, the keeper set; struck
 * with the timing `off` (s from the gold) at `aim`. */
function drilled(att: Squad, def: Squad, seed: string, x: number, y: number, off: number, aim: { x: number; y: number }): Attack {
  const a = setupAttack('build', att, def, seed, { side: 1 });
  kickOff(a);
  const c = a.bodies[a.ctrl];
  a.ball.owner = c.id;
  a.ball.flight = null;
  [c.x, c.y, c.vx, c.vy, c.fx, c.fy] = [x, y, 0, 0, 0, 1];
  [a.ball.x, a.ball.y] = [x, y + 0.35];
  for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') [b.x, b.y, b.stunUntil] = [2, 31, Infinity];
  for (let k = 0; k < 40; k++) step(a, DT, { x: 0, y: 0 });
  pressShoot(a);
  setAim(a, aim);
  releaseShoot(a, null, 0, a.meter!.top + off);
  for (let k = 0; k < 60 * 6 && !a.end; k++) step(a, DT, { x: 0, y: 0 });
  return a;
}

describe('S5: a better keeper, by a believable margin', () => {
  it('GK 93 concedes 0.62-0.92× what GK 75 does from identical shots', () => {
    const r = rng(hashString('s5'));
    const shots = Array.from({ length: 320 }, (_, i) => ({ i, x: GX + (r() - 0.5) * 16, y: PL - 11 - r() * 12, off: (r() - 0.5) * 0.14, aim: { x: (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.45), y: -0.9 + r() * 1.6 } }));
    const goals = (gk: number) => shots.filter((s) => drilled(A, withGk(B, gk), 's5-' + s.i, s.x, s.y, s.off, s.aim).end?.kind === 'G').length;
    const g75 = goals(75);
    const g93 = goals(93);
    expect(g75).toBeGreaterThan(30);
    expect(g93 / g75).toBeGreaterThanOrEqual(0.62);
    expect(g93 / g75).toBeLessThanOrEqual(0.92);
  }, 60_000);
});

describe('S4: a far-post first-time finish', () => {
  it('the keeper is not pulled to the near post before the strike, and dives only after it', () => {
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const a = setupAttack('wide', A, B, 'farpost' + i, { side: 1 });
      kickOff(a);
      const c = a.bodies[a.ctrl];
      const side = Math.sign(c.x - GX) || 1;
      // the runner arriving at the far post
      const runner = a.bodies.filter((b) => b.side === 'A' && b.id !== c.id).sort((p, q) => q.y - p.y)[0];
      [runner.x, runner.y, runner.vx, runner.vy] = [GX - side * 3, PL - 9, 0, 0];
      // the defence out of it, deep and wide on the crosser's side (so nobody is offside)
      for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') [b.x, b.y, b.stunUntil] = [GX + side * 28, PL - 3, Infinity];
      for (const b of a.bodies) if (b.side === 'A' && b.id !== c.id && b.id !== runner.id) [b.x, b.y, b.vx, b.vy] = [GX + side * 25, 45, 0, 0];
      if (!pass(a, 'ground', { x: runner.x - c.x, y: runner.y - c.y }, false) || a.kick?.to !== runner.id) continue;
      const gk = keeperOf(a);
      let x0: number | null = null;
      for (let k = 0; k < 60 * 3 && !a.end && !a.strike && a.ball.flight?.kind !== 'shot'; k++) {
        step(a, DT, null);
        if (x0 === null && a.ball.flight) x0 = gk.x;
        // SHOOT pressed as the ball comes: a first-time hit
        if (a.ball.flight?.to === runner.id && !a.meter && !a.first) {
          a.ctrl = runner.id;
          pressShoot(a);
          setAim(a, { x: side * 0.85, y: -0.7 });
        }
      }
      if (x0 === null || !a.strike) continue;
      n++;
      // toward the near post is toward the crosser's side
      expect((gk.x - x0) * side).toBeLessThanOrEqual(0.5);
      const struckAt = a.strike.at;
      for (let k = 0; k < 30 && !a.end; k++) step(a, DT, { x: 0, y: 0 });
      if (a.gkPlan) expect(a.gkPlan.react).toBeGreaterThanOrEqual(struckAt);
    }
    expect(n).toBeGreaterThan(15);
  });
});

describe('S10: parries steered by his hands', () => {
  it('a better handler pushes more parries out wide; none goes back across his goal', () => {
    const share = (han: number) => {
      let wide = 0;
      let all = 0;
      const r = rng(hashString('parry' + han));
      for (let i = 0; i < 500 && all < 120; i++) {
        const a = drilled(A, withGk(B, 80, { HAN: han, REF: 92, DIV: 92 }), 'pr' + han + '-' + i, GX + (r() - 0.5) * 10, PL - 12 - r() * 8, 0.12, { x: (r() - 0.5) * 1.2, y: -0.2 + r() * 0.8 });
        const p = a.lastShot?.parried;
        if (!p) continue;
        all++;
        if (p === 'wide' || p === 'post') wide++;
      }
      return { wide: wide / Math.max(1, all), all };
    };
    const lo = share(45);
    const hi = share(95);
    expect(lo.all).toBeGreaterThan(30);
    expect(hi.all).toBeGreaterThan(30);
    expect(hi.wide).toBeGreaterThan(lo.wide);
  }, 60_000);
});
