// The gold ring on SHOOT (Claude 2026-11-16, studio overhaul soccer-4; V2 B.0.1, B.3.5; plan G1-G5):
//  - G1: every gold half-window ≥ 30 ms on the rating grid, and the gold band drawn ≥ 8 px at 320 and 393;
//  - G2: gold never lies: (a) 1,000 seeded gold releases with the keeper and blockers out of it all cross
//    the line within 0.25 m of the reticle, (b) gold is never offered under pressure, out of range,
//    first time across the body or for a header from beyond 8 m (the ring says why);
//  - G3: SHO 95's window ≥ 1.5× SHO 70's at 16 m;
//  - G4: the wind-up is exact (0.35 s at 11 m, rising linearly to 0.62 s at 25 m);
//  - G5: a release is judged from the touches' timestamps to the millisecond, not to the frame.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { decide, pilot } from './autopilot';
import { GameClock, holdOf, holdOnClock } from './controls';
import { GX, kickOff, lineCross, nearestDefender, PL, pressShoot, releaseShoot, RING, setAim, setCurl, setupAttack, shotRing, step, tracePath, windup } from './engine';
import { greenHalf, maxRange } from './ratings';
import { squadFor } from './squads.test-util';
import type { Attack, Body, SoccerPlayer } from './types';
import { drawRing, GOLD_ARC_MIN_PX, GOLD_FLOOR_MS, goldArcPx, judge, ringWindow, windowScale } from './v2';

const DT = 1 / 60;
const A = squadFor('gold-a', 78);
const B = squadFor('gold-b', 76);

/** A man rated `sho` (all else 75). */
function withSho(c: Body, sho: number) {
  c.p = { ...c.p, a: { ...c.p.a, SHO: sho } } as SoccerPlayer;
}

/** Open play, the man on the ball alone at (x, y) facing goal: every defender (and the keeper) stunned
 * far away, so only what's asked for is near him. */
function alone(seed: string, x: number, y: number, scenario: 'build' | 'counter' = 'build'): Attack {
  const a = setupAttack(scenario, A, B, seed, { side: 1 });
  kickOff(a);
  const c = a.bodies[a.ctrl];
  if (a.ball.owner !== c.id) {
    a.ball.owner = c.id;
    a.ball.flight = null;
  }
  c.x = x;
  c.y = y;
  c.vx = c.vy = 0;
  c.fx = 0;
  c.fy = 1;
  a.ball.x = x;
  a.ball.y = y + 0.35;
  a.ball.h = 0;
  for (const b of a.bodies)
    if (b.side === 'D') {
      b.x = 2;
      b.y = 31;
      b.vx = b.vy = 0;
      b.stunUntil = Infinity;
    }
  return a;
}

describe('G4: the wind-up', () => {
  it('meter.top is 0.35 s at 11 m or nearer, 0.62 s at 25 m or further, linear between', () => {
    expect(windup(5)).toBe(0.35);
    expect(windup(11)).toBe(0.35);
    expect(windup(18)).toBeCloseTo(0.35 + 0.27 * (7 / 14), 12);
    expect(windup(25)).toBe(0.62);
    expect(windup(40)).toBe(0.62);
    for (let d = 11; d <= 25; d += 0.5) expect(windup(d)).toBeCloseTo(0.35 + (0.27 * (d - 11)) / 14, 12);
  });
  it('pressing SHOOT sets it from the shooter’s distance', () => {
    for (const [x, y] of [
      [GX, PL - 9],
      [GX + 4, PL - 16],
      [GX - 3, PL - 22],
      [GX, PL - 30],
    ]) {
      const a = alone('g4' + x + y, x, y);
      expect(pressShoot(a)).toBe(true);
      const d = Math.hypot(a.ball.x - GX, PL - a.ball.y);
      expect(a.meter!.top).toBeCloseTo(windup(d), 12);
    }
  });
});

describe('G1 and G3: the window', () => {
  it('the gold half-window is never under 30 ms anywhere on the rating grid', () => {
    expect(windowScale(1, [])).toBe(GOLD_FLOOR_MS);
    expect(windowScale(10, [{ id: 'x', mult: 0.1 }])).toBe(GOLD_FLOOR_MS);
    let n = 0;
    for (const sho of [1, 30, 40, 55, 70, 85, 95, 99, 110])
      for (const d of [6, 11, 16, 20, 25, 30])
        for (const near of [0.5, 1.9, 2.5, 4, 9])
          for (const defIQ of [-0.5, 0, 1])
            for (const sprint of [false, true]) {
              const a = alone('g1', GX + 2, PL - d);
              a.defIQ = defIQ;
              const c = a.bodies[a.ctrl];
              withSho(c, sho);
              if (sprint) c.vy = 12;
              const def = a.bodies.find((b) => b.side === 'D' && b.role !== 'gk')!;
              def.x = c.x + near;
              def.y = c.y + 0.2;
              const r = shotRing(a, c, false);
              expect(r.green * 1000, `SHO ${sho} d ${d} near ${near} defIQ ${defIQ} sprint ${sprint}`).toBeGreaterThanOrEqual(GOLD_FLOOR_MS - 1e-9);
              n++;
            }
    expect(n).toBe(1620);
  });
  it('G3: SHO 95’s window at 16 m is at least 1.5× SHO 70’s', () => {
    const at = (sho: number) => {
      const a = alone('g3', GX, PL - 16);
      withSho(a.bodies[a.ctrl], sho);
      return shotRing(a, a.bodies[a.ctrl], false);
    };
    const hi = at(95);
    const lo = at(70);
    expect(hi.state).toBe('gold');
    expect(lo.state).toBe('gold');
    expect(hi.green / lo.green).toBeGreaterThanOrEqual(1.5);
    expect(greenHalf({ ...A.fwd[1], a: { ...A.fwd[1].a, SHO: 95 } }) / greenHalf({ ...A.fwd[1], a: { ...A.fwd[1].a, SHO: 70 } })).toBeGreaterThanOrEqual(1.5);
  });
  it('the gold band is drawn at least 8 px at 320 and 393, arc and ground ring, for every window', () => {
    for (const W of [320, 393]) {
      const H = W === 320 ? 568 : 852;
      // as render.ts sizes them: the arc over his head, and the flattened ring at his feet (sprite scale 30-45 px)
      const R = Math.max(24, Math.round(Math.min(W, H) * 0.085));
      for (const top of [0.35, 0.48, 0.62])
        for (const green of [0.03, 0.045, 0.066, 0.09]) {
          const span = top + 0.35;
          const g0 = (top - green) / span;
          const g1 = (top + green) / span;
          expect(goldArcPx(R, Math.PI - 0.72, g0, g1)).toBeGreaterThanOrEqual(GOLD_ARC_MIN_PX - 1e-9);
          for (const ry of [6, 9, 13]) expect(goldArcPx(ry, Math.PI * 2, g0, g1)).toBeGreaterThanOrEqual(GOLD_ARC_MIN_PX - 1e-9);
          // and what drawRing reports drawing, through a canvas that records nothing
          const ctx = new Proxy({}, { get: (_t, k) => (k === 'save' || k === 'restore' || k === 'beginPath' || k === 'ellipse' || k === 'stroke' ? () => undefined : undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
          const px = drawRing(ctx, { x: 0, y: 0, r: 16, ry: 6, progress: 0.5, goldFrom: g0, goldTo: g1, state: 'gold', width: 3 });
          expect(px).toBeGreaterThanOrEqual(GOLD_ARC_MIN_PX - 1e-9);
        }
    }
  });
});

describe('G2: gold never lies', () => {
  // (soccer-4 review fix, wall time: 300 seeded releases here; SOCCER_G2A=1000 runs the full harness)
  const G2A = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SOCCER_G2A ?? 300);
  it(`(a) ${G2A} seeded gold releases with nobody to stop them cross the line within 0.25 m of the reticle`, () => {
    const r = rng(hashString('gold-1000'));
    let gold = 0;
    let worst = 0;
    let i = 0;
    while (gold < G2A) {
      i++;
      const kind = i % 10;
      const fk = kind === 0;
      const d = 7 + r() * 20;
      const ang = (r() - 0.5) * 1.2;
      const x = GX + Math.sin(ang) * d;
      const y = PL - Math.cos(ang) * d;
      const a = fk ? setupAttack('freekick', A, B, 'g2fk' + i, { side: 1 }) : alone('g2-' + i, x, y, i % 3 ? 'build' : 'counter');
      if (fk) {
        kickOff(a);
        for (const b of a.bodies) if (b.side === 'D') b.stunUntil = Infinity;
        for (const b of a.bodies) if (b.side === 'D') [b.x, b.y] = [2, 31];
        setCurl(a, (r() - 0.5) * 2);
      }
      const c = a.bodies[a.ctrl];
      withSho(c, 50 + r() * 49);
      if (!pressShoot(a) || a.meter!.ring !== 'gold') continue;
      const aim = { x: (r() - 0.5) * 2, y: (r() - 0.5) * 2 };
      setAim(a, aim);
      // a third of them run on while the leg swings (the strike is re-solved from where the ball is)
      const run = !fk && i % 3 === 1 ? { x: 0, y: 1 } : { x: 0, y: 0 };
      const steps = Math.round(a.meter!.top * 60) - 2;
      for (let k = 0; k < steps; k++) step(a, DT, run);
      if (!a.meter || a.meter.ring !== 'gold') continue;
      const held = a.meter.top + (r() - 0.5) * 1.6 * a.meter.green;
      releaseShoot(a, null, 0, held);
      expect(a.release!.gold).toBe(true);
      // (soccer-5: with the ball out ahead between touches he strikes it as he gets to it)
      for (let k = 0; k < 90 && !a.strike && a.pending; k++) step(a, DT, run);
      if (!a.strike) continue;
      const want = a.strike!.info.aim;
      for (let k = 0; k < 600 && !a.end && a.lastShot?.cross == null; k++) {
        step(a, DT, run);
        // nobody gets a touch: the keeper and every outfielder have had their one try
        for (const b of a.bodies) if (b.side === 'D') b.tried = 1;
      }
      const cross = a.lastShot!.cross!;
      expect(cross, 'gold release ' + i + ' never reached the line').toBeTruthy();
      const miss = Math.hypot(cross.x - want.x, cross.h - want.h);
      worst = Math.max(worst, miss);
      expect(miss, `gold release ${i} (${fk ? 'free kick' : 'open play'}, d ${d.toFixed(1)}): ${miss.toFixed(3)} m off`).toBeLessThan(0.25);
      gold++;
    }
    expect(worst).toBeLessThan(0.25);
  }, 60_000);

  it('(b) gold is never offered with a man within 2 m, out of range, first time across the body or for a header from beyond 8 m', () => {
    // pressure
    for (const near of [0.6, 1.2, 1.9]) {
      const a = alone('press' + near, GX, PL - 14);
      const c = a.bodies[a.ctrl];
      const def = a.bodies.find((b) => b.side === 'D' && b.role !== 'gk')!;
      [def.x, def.y] = [c.x + near, c.y + 0.3];
      const r = shotRing(a, c, false);
      expect(r.state).toBe('amber');
      expect([r.why, r.dial]).toEqual(['pressure', 'PRESSURE']);
    }
    // range: red past lerp(24, 34, SHO)
    for (const sho of [40, 70, 99]) {
      const a = alone('range' + sho, GX, PL - 10);
      const c = a.bodies[a.ctrl];
      withSho(c, sho);
      const far = maxRange(c.p) + 0.6;
      [c.y, a.ball.y] = [PL - far - 0.35, PL - far];
      const r = shotRing(a, c, false);
      expect([r.state, r.why, r.dial]).toEqual(['red', 'range', 'RANGE']);
      const near = maxRange(c.p) - 0.6;
      [c.y, a.ball.y] = [PL - near - 0.35, PL - near];
      expect(shotRing(a, c, false).state).toBe('gold');
    }
    // first time: a ball coming to him; across the body (turning it > 90°) is amber, straight on is gold
    const incoming = (seed: string, from: { x: number; y: number }, h0: number, recv: { x: number; y: number }) => {
      const a = alone(seed, recv.x, recv.y);
      const c = a.bodies[a.ctrl];
      a.ball.owner = null;
      a.ball.x = from.x;
      a.ball.y = from.y;
      a.ball.h = h0;
      const L = Math.hypot(recv.x - from.x, recv.y - from.y);
      a.ball.vx = ((recv.x - from.x) / L) * 16;
      a.ball.vy = ((recv.y - from.y) / L) * 16;
      a.ball.vh = h0 > 0 ? 5 : 0;
      a.ball.flight = { kind: h0 > 0 ? 'cross' : 'ground', from: 0, to: c.id, at: a.t } as Attack['ball']['flight'];
      a.path = tracePath(a.ball, 4);
      a.pathAt = a.t;
      return { a, c };
    };
    const cut = incoming('cutback', { x: GX + 6, y: PL - 4 }, 0, { x: GX, y: PL - 13 });
    const rc = shotRing(cut.a, cut.c, true);
    expect(rc.turn).toBeGreaterThan(RING.firstAcross);
    expect([rc.state, rc.why, rc.dial]).toEqual(['amber', 'first', 'TIMING']);
    const on = incoming('through', { x: GX, y: PL - 30 }, 0, { x: GX, y: PL - 14 });
    const ro = shotRing(on.a, on.c, true);
    expect(ro.turn).toBeLessThan(30);
    expect(ro.state).toBe('gold');
    // a header (met above 1.2 m) from beyond 8 m
    const hdr = incoming('header', { x: GX + 25, y: PL - 14 }, 1.5, { x: GX, y: PL - 11 });
    hdr.a.ball.vh = 4;
    hdr.a.path = tracePath(hdr.a.ball, 4);
    const rh = shotRing(hdr.a, hdr.c, true);
    if (rh.from.h > 1.2) {
      expect(rh.d).toBeGreaterThan(RING.headerFar);
      expect([rh.state, rh.why]).toEqual(['amber', 'header']);
    }
  });

  it('(b) and over 120 autopilot attacks, a gold ring never shows, and no gold strike is struck, with a man within 2 m or out of range', () => {
    let golds = 0;
    let goldStrikes = 0;
    for (let i = 0; i < 120; i++) {
      const a = setupAttack((['build', 'counter', 'wide'] as const)[i % 3], A, B, 'gauto' + i, {});
      const pl = pilot(0.68, 'gauto' + i);
      kickOff(a);
      let lastStrike: Attack['strike'] = null;
      for (let n = 0; n < 60 * 40 && !a.end; n++) {
        step(a, DT, decide(a, pl));
        // (soccer-4 review fix) G2b at the strike itself, first-time hits and headers included
        const s = a.strike;
        if (s && s !== lastStrike && s.info.greened && !a.setPiece) {
          goldStrikes++;
          const by = a.bodies[s.by];
          expect(nearestDefender(a, a.ball).d, 'gold strike under pressure, attack ' + i).toBeGreaterThanOrEqual(RING.pressure);
          expect(Math.hypot(a.ball.x - GX, PL - a.ball.y), 'gold strike out of range, attack ' + i).toBeLessThanOrEqual(maxRange(by.p) + 1e-9);
          if (s.info.kind === 'header') expect(s.info.d).toBeLessThanOrEqual(RING.headerFar);
          if (s.info.turn !== undefined && s.info.kind !== 'header') expect(s.info.turn).toBeLessThanOrEqual(RING.firstAcross);
        }
        lastStrike = s;
        const m = a.meter;
        if (!m || m.ring !== 'gold' || a.setPiece || m.first) continue;
        golds++;
        const c = a.bodies[a.ctrl];
        expect(nearestDefender(a, a.ball).d).toBeGreaterThanOrEqual(RING.pressure);
        expect(Math.hypot(a.ball.x - GX, PL - a.ball.y)).toBeLessThanOrEqual(maxRange(c.p) + 1e-9);
      }
    }
    expect(golds).toBeGreaterThan(50);
    expect(goldStrikes).toBeGreaterThan(5);
  }, 60_000);

  it('On Fire turns only an uncontested amber gold, never pressure or red', () => {
    expect(ringWindow({ baseHalfMs: 40, rating01: 0.5, contested: false, inRange: true, fire: true, amber: 'TIMING' }).state).toBe('gold');
    expect(ringWindow({ baseHalfMs: 40, rating01: 0.5, contested: true, inRange: true, fire: true }).state).toBe('amber');
    expect(ringWindow({ baseHalfMs: 40, rating01: 0.5, contested: false, inRange: false, fire: true }).state).toBe('red');
    expect(ringWindow({ baseHalfMs: 40, rating01: 0.5, contested: false, inRange: true, fire: true }).goldHalfMs).toBeCloseTo(50, 9);
  });
});

describe('G2b at the strike (soccer-4 review fix)', () => {
  /** A ball played straight up to him from 16 m further out; SHOOT pressed for a first-time hit and let
   * go on the gold before it arrives. */
  const firstTime = (seed: string) => {
    const a = alone(seed, GX, PL - 14);
    const c = a.bodies[a.ctrl];
    a.ball.owner = null;
    [a.ball.x, a.ball.y, a.ball.h] = [GX, PL - 30, 0];
    [a.ball.vx, a.ball.vy, a.ball.vh] = [0, 17, 0];
    a.ball.flight = { kind: 'ground', from: 0, to: c.id, at: a.t } as Attack['ball']['flight'];
    a.path = tracePath(a.ball, 4);
    a.pathAt = a.t;
    expect(pressShoot(a)).toBe(true);
    expect(a.meter!.first).toBe(true);
    expect(a.meter!.ring).toBe('gold');
    const steps = Math.round(a.meter!.top * 60) - 1;
    for (let k = 0; k < steps; k++) step(a, DT, null);
    releaseShoot(a, null, 0, a.meter!.top);
    expect(a.first).toBeTruthy();
    expect(a.release!.gold).toBe(true);
    return { a, c };
  };
  const strikeOf = (a: Attack, before?: (a: Attack) => void) => {
    let moved = false;
    for (let k = 0; k < 120 && !a.strike && !a.lastShot && !a.end; k++) {
      if (!moved && before && Math.hypot(a.ball.x - a.bodies[a.ctrl].x, a.ball.y - a.bodies[a.ctrl].y) < 3) {
        before(a);
        moved = true;
      }
      step(a, DT, null);
    }
    return a.strike;
  };
  it('a first-time release on gold keeps it when nothing changes before the contact', () => {
    const { a } = firstTime('g2b-ok');
    const s = strikeOf(a);
    expect(s).toBeTruthy();
    expect(s!.info.greened).toBe(true);
    expect(s!.exact).toBeTruthy();
    expect(a.release!.gold).toBe(true);
  });
  it('a defender closing to 1.5 m before the ball arrives turns it amber at the contact: no gold, no exact placement', () => {
    const { a, c } = firstTime('g2b-press');
    const perfects = a.perfects;
    const s = strikeOf(a, (q) => {
      const def = q.bodies.find((b) => b.side === 'D' && b.role !== 'gk')!;
      // beside the spot he meets it (the ball comes up to him from behind: it's met just short of him)
      [def.x, def.y] = [c.x + 1.5, c.y - 0.5];
    });
    expect(s).toBeTruthy();
    expect(s!.info.greened).toBe(false);
    expect(s!.info.ring).toBe('amber');
    expect(s!.info.why).toBe('pressure');
    expect(s!.exact).toBeUndefined();
    expect(a.release!.gold).toBe(false);
    expect(a.perfects).toBe((perfects ?? 1) - 1);
    expect(a.events.includes('gold-lost') || s!.info.cone > 0).toBe(true);
  });
  it('a deflection that brings the ball across him (more than 90°) turns it amber at the contact', () => {
    const { a, c } = firstTime('g2b-deflect');
    const s = strikeOf(a, (q) => {
      // knocked off its line: now coming back at him from the goal side (it turns more than 90° to goal)
      const from = { x: c.x + 1.0, y: c.y + 2.4 };
      [q.ball.x, q.ball.y] = [from.x, from.y];
      const L = Math.hypot(c.x - from.x, c.y - from.y);
      [q.ball.vx, q.ball.vy] = [((c.x - from.x) / L) * 9, ((c.y - from.y) / L) * 9];
      q.path = tracePath(q.ball, 4);
      q.pathAt = q.t;
    });
    expect(s, 'ends ' + a.end?.text + ' ball ' + [a.ball.x - c.x, a.ball.y - c.y, a.ball.owner].join(',')).toBeTruthy();
    expect(s!.info.greened).toBe(false);
    expect(s!.exact).toBeUndefined();
    expect(a.release!.gold).toBe(false);
  });
  it('pressed out of range, the ring stays red through the wind-up even when he runs on into range', () => {
    const a = alone('red-lock', GX, PL - 10);
    const c = a.bodies[a.ctrl];
    withSho(c, 70);
    const far = maxRange(c.p) + 1.2;
    [c.y, a.ball.y] = [PL - far - 0.35, PL - far];
    expect(pressShoot(a)).toBe(true);
    expect(a.meter!.ring).toBe('red');
    a.sprinting = true;
    const steps = Math.round(a.meter!.top * 60);
    for (let k = 0; k < steps && a.meter; k++) step(a, DT, { x: 0, y: 1 });
    expect(Math.hypot(a.ball.x - GX, PL - a.ball.y)).toBeLessThan(maxRange(c.p));
    expect(a.meter!.ring).toBe('red');
    releaseShoot(a, null, 0, a.meter!.top);
    expect(a.release!.ring).toBe('red');
    expect(a.release!.gold).toBe(false);
  });
});

describe('G5: timing from the touch', () => {
  it('a hold is judged on the game clock: slow motion and a hit-stop inside it count as the ring moved (soccer-4 review fix)', () => {
    const clock = new GameClock();
    // 60 fps frames; 300-900 ms: a 0.4× slow-motion beat; 1000-1066 ms: a hit-stop (no game time)
    let real = 0;
    const rateAt = (t: number) => (t >= 1000 && t < 1066 ? 0 : t >= 300 && t < 900 ? 0.4 : 1);
    clock.tick(0, 0);
    while (real < 2000) {
      const next = real + 1000 / 60;
      clock.tick(next, ((next - real) / 1000) * rateAt(real));
      real = next;
    }
    const gameAt = (t: number) => {
      // the exact game time at real t, integrating the rate frame by frame as the loop does
      let g = 0;
      for (let r = 0; r < t; r += 1000 / 60) g += (Math.min(1000 / 60, t - r) / 1000) * rateAt(r);
      return g;
    };
    const r = rng(hashString('g5-clock'));
    for (let i = 0; i < 200; i++) {
      const press = 100 + r() * 800;
      const release = press + 300 + r() * 600;
      const lag = r() * 40;
      const held = holdOnClock(clock, press, release, lag, 1);
      expect(Math.abs(held - (gameAt(release - lag) - gameAt(press))) * 1000).toBeLessThan(1);
    }
    // a hold of 600 real ms entirely inside the slow-motion beat is 240 ms of game time (the ring's), where
    // the real-time judge would have called it 360 ms late
    expect(Math.abs(holdOnClock(clock, 300, 900, 0, 1) - 0.24)).toBeLessThan(0.012);
    expect(holdOf(300, 900, 0, 1)).toBeCloseTo(0.6, 9);
    // past the newest frame it runs on at the rate now; at a steady 1× it is holdOf
    const steady = new GameClock();
    for (let k = 0; k <= 120; k++) steady.tick(k * (1000 / 60), k ? 1 / 60 : 0);
    expect(holdOnClock(steady, 500.3, 1890.9, 27, 1)).toBeCloseTo(holdOf(500.3, 1890.9, 27, 1), 9);
    expect(holdOnClock(steady, 1500, 2100, 0, 1)).toBeCloseTo(0.6, 9);
    expect(holdOnClock(steady, 1500, 2100, 0, 0.4)).toBeCloseTo(0.5 + 0.1 * 0.4, 9);
  });
  it('a press/release pair across frame boundaries is judged to ±1 ms of its true offset', () => {
    const r = rng(hashString('g5'));
    for (let i = 0; i < 400; i++) {
      const top = windup(8 + r() * 20);
      const lag = r() * 60;
      const off = (r() - 0.5) * 0.2;
      // touches that fall anywhere inside their frames (not on a 16.7 ms tick)
      const pressTs = 1000 + r() * 5000;
      const releaseTs = pressTs + (top + off) * 1000 + lag;
      const held = holdOf(pressTs, releaseTs, lag, 1);
      expect(Math.abs((held - top - off) * 1000)).toBeLessThan(1);
      // and the shared judge agrees on the same touches
      const j = judge(pressTs, releaseTs, top * 1000, { state: 'gold', goldHalfMs: 40 }, lag);
      expect(Math.abs(j.offMs - off * 1000)).toBeLessThan(1);
      expect(j.gold).toBe(Math.abs(off * 1000) <= 40);
    }
  });
  it('the engine takes that hold, not the frame count: a release between two steps lands to the millisecond', () => {
    for (let i = 0; i < 40; i++) {
      const a = alone('g5e' + i, GX, PL - 15);
      pressShoot(a);
      const top = a.meter!.top;
      const want = -0.035 + i * 0.0017; // -35 ms .. +31 ms in 1.7 ms steps, between frames
      const steps = Math.floor((top + want) * 60);
      for (let k = 0; k < steps; k++) step(a, DT, { x: 0, y: 0 });
      const lag = 30;
      releaseShoot(a, null, 0, holdOf(500, 500 + (top + want) * 1000 + lag, lag));
      expect(Math.abs(a.release!.off - want) * 1000).toBeLessThan(1);
    }
  });
  it('a time-scaled match (the lab at 0.5×) converts real touches to game seconds', () => {
    expect(holdOf(0, 1000, 0, 0.5)).toBeCloseTo(0.5, 12);
    expect(holdOf(0, 10, 30, 1)).toBe(0);
  });
});

describe('gold places the ball, it doesn’t guarantee a goal', () => {
  it('a gold shot straight at the keeper is saved, and lineCross agrees with the engine', () => {
    const a = setupAttack('build', A, B, 'at-him', { side: 1 });
    kickOff(a);
    const c = a.bodies[a.ctrl];
    if (a.ball.owner !== c.id) a.ball.owner = c.id;
    [c.x, c.y, a.ball.x, a.ball.y] = [GX, PL - 16, GX, PL - 15.65];
    for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') [b.x, b.y, b.stunUntil] = [2, 31, Infinity];
    pressShoot(a);
    setAim(a, { x: 0, y: -0.2 });
    releaseShoot(a, null, 0, a.meter!.top);
    expect(a.release!.gold).toBe(true);
    for (let k = 0; k < 8; k++) step(a, DT, { x: 0, y: 0 });
    const hit = lineCross({ x: a.ball.x, y: a.ball.y, h: a.ball.h }, a.ball, a.ball.curl, a.ball.dip);
    for (let k = 0; k < 300 && !a.end && !a.events.some((e) => e.startsWith('save')); k++) step(a, DT, { x: 0, y: 0 });
    expect(hit).toBeTruthy();
    expect(Math.abs(hit!.x - a.lastShot!.aim.x)).toBeLessThan(0.25);
    expect(a.events.some((e) => e === 'save-catch' || e === 'save-parry')).toBe(true);
  });
});
