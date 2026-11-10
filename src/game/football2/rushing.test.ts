// Codex: run execution, physical blocking, player choice and rating/difficulty regressions.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { chooseCall, decide, pilot } from './autopilot';
import { CarryGate } from './controls';
import { afterPlay, newGame, startPlay } from './drive';
import { lineUp, snap, step } from './engine';
import { depth } from './squad';
import type { Defense, Offense, RunPlay } from './types';
const player = (pos: string, slot: string) => depth(pos, 0.5, 'rushing-regression', slot);
function teams() {
  const off: Offense = {
    qb: player('QB', 'QB'),
    rb: player('RB', 'RB'),
    wr: [player('WR', 'X'), player('WR', 'Z'), player('WR', 'SL')],
    te: player('TE', 'TE'),
    ol: ['OT', 'OG', 'C', 'OG', 'OT'].map((p, i) => player(p, 'OL' + i)) as Offense['ol'],
    k: player('K', 'K')
  };
  const def: Defense = {
    dl: ['DE', 'DT', 'DT', 'DE'].map((p, i) => player(p, 'DL' + i)) as Defense['dl'],
    lb: [0, 1, 2].map((i) => player('LB', 'LB' + i)) as Defense['lb'],
    cb: [player('CB', 'CB1'), player('CB', 'CB2')],
    s: [player('S', 'FS'), player('S', 'SS')]
  };
  return { off, def };
}
function play(run: RunPlay = 'outside', seed = 1, iq = 0) {
  const { off, def } = teams();
  const p = lineUp(off, def, 'run', 'slants', run, 35, 26.67, rng(hashString('rushing:' + seed)), iq);
  snap(p);
  return p;
}
describe('NFL runs', () => {
  it('takes an outside handoff around the edge instead of cutting into the tackle box', () => {
    const p = play();
    for (const d of p.bodies) if (d.side === 'D') d.stunUntil = Infinity;
    for (let i = 0; i < 300 && p.rb.y < p.los; i++) step(p, 1 / 60, null);
    expect(p.carrier).toBe(p.rb);
    expect(p.rb.y).toBeGreaterThanOrEqual(p.los);
    expect(p.rb.x - p.bx).toBeGreaterThan(5.5);
  });
  it('keeps the right tackle on the edge while his guard takes the defensive tackle', () => {
    const p = play('inside');
    p.rand = () => 0.5;
    const rt = p.bodies.find((b) => b.slot === 'RT')!,
      rg = p.bodies.find((b) => b.slot === 'RG')!,
      x = rt.x,
      gx = rg.x;
    for (let i = 0; i < 20; i++) step(p, 1 / 60, null);
    expect(rt.x).toBeGreaterThan(x + 0.1);
    expect(rg.x).toBeLessThan(gx);
  });
  it('lets a deliberate lateral input override the designed outside lane', () => {
    const a = play(),
      b = play();
    for (const p of [a, b]) for (const d of p.bodies) if (d.side === 'D') d.stunUntil = Infinity;
    for (let i = 0; i < 100; i++) {
      step(a, 1 / 60, null);
      step(b, 1 / 60, b.bx - 8);
    }
    expect(a.rb.x - a.bx).toBeGreaterThan(4);
    expect(b.rb.x).toBeLessThan(b.bx - 2);
  });
  it('can still be blown up by an early block shed without an invulnerable handoff window', () => {
    const { off, def } = teams();
    const p = lineUp(off, def, 'run', 'slants', 'inside', 35, 26.67, () => 0, 1);
    snap(p);
    for (let i = 0; i < 600 && !p.end; i++) step(p, 1 / 60, null);
    expect(p.end).not.toBeNull();
    expect(p.end!.gain).toBeLessThanOrEqual(0);
  });
  it('keeps 99+ backs finite on all run paths', () => {
    for (const run of ['inside', 'power', 'outside'] as RunPlay[])
      for (const rating of [99, 105, 110]) {
        const p = play(run);
        for (const k of Object.keys(p.rb.p.a)) p.rb.p.a[k] = rating;
        for (let i = 0; i < 1500 && !p.end; i++) step(p, 1 / 60, null);
        expect(p.end).not.toBeNull();
        expect(Number.isFinite(p.end!.gain)).toBe(true);
        expect(p.rb.p.a.SPD).toBe(rating);
      }
  });
});

// These tests measure actual world displacement, not a moving knob or a button state.
describe('direct human running', () => {
  function openRun() {
    const p = play('inside');
    p.phase = 'run';
    p.carrier = p.rb;
    Object.assign(p.rb, { x: 26.67, y: 45, vx: 0, vy: 0 });
    for (const d of p.bodies.filter((b) => b.side === 'D')) d.stunUntil = Infinity;
    return p;
  }
  it('ends a backward run at the rear end-zone boundary instead of running beyond the field', () => {
    const p=openRun();p.rb.y=-9.5;
    for(let i=0;i<120&&!p.end;i++)step(p,1/60,{x:0,y:-1});
    expect(p.end?.kind).toBe('out');expect(p.end!.y).toBeLessThanOrEqual(-10);expect(p.t).toBeLessThan(2);
  });
  it.each([
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1]
  ])('moves in field direction (%s,%s), including backward/lateral', (x, y) => {
    const p = openRun(),
      start = { x: p.rb.x, y: p.rb.y };
    for (let i = 0; i < 60; i++) step(p, 1 / 60, { x, y });
    const dx = p.rb.x - start.x,
      dy = p.rb.y - start.y;
    if (x) expect(dx * Math.sign(x)).toBeGreaterThan(2);
    else expect(Math.abs(dx)).toBeLessThan(0.01);
    if (y) expect(dy * Math.sign(y)).toBeGreaterThan(2);
    else expect(Math.abs(dy)).toBeLessThan(0.01);
    expect(p.move).toBeNull();
    expect(p.events.some((e) => e.startsWith('move:'))).toBe(false);
  });
  it('brakes to a stop on release instead of resuming the automatic lane', () => {
    const p = openRun();
    for (let i = 0; i < 60; i++) step(p, 1 / 60, { x: 0, y: 1 });
    for (let i = 0; i < 30; i++) step(p, 1 / 60, { x: 0, y: 0 });
    const at = { x: p.rb.x, y: p.rb.y };
    for (let i = 0; i < 60; i++) step(p, 1 / 60, { x: 0, y: 0 });
    expect(p.rb.x).toBeCloseTo(at.x);
    expect(p.rb.y).toBeCloseTo(at.y);
    expect(Math.hypot(p.rb.vx, p.rb.vy)).toBeLessThan(0.01);
  });
  it('preserves analog speed, prevents a diagonal speed bonus and reverses without skating', () => {
    const straight = openRun(),
      diagonal = openRun(),
      half = openRun();
    for (let i = 0; i < 90; i++) {
      step(straight, 1 / 60, { x: 0, y: 1 });
      step(diagonal, 1 / 60, { x: 1, y: 1 });
      step(half, 1 / 60, { x: 0, y: 0.5 });
    }
    const speed = (p: ReturnType<typeof openRun>) => Math.hypot(p.rb.vx, p.rb.vy);
    expect(speed(diagonal)).toBeCloseTo(speed(straight));
    expect(speed(half)).toBeCloseTo(speed(straight) / 2);
    for (let i = 0; i < 45; i++) step(straight, 1 / 60, { x: 0, y: -1 });
    expect(straight.rb.vy).toBeLessThan(-2);
  });
  it('does not drain burst stamina when the human stick is centered', () => {
    const p = openRun();
    p.bursting = true;
    for (let i = 0; i < 60; i++) step(p, 1 / 60, { x: 0, y: 0 });
    expect(p.stamina).toBe(1);
    for (let i = 0; i < 60; i++) step(p, 1 / 60, { x: 0, y: 1 });
    expect(p.stamina).toBeLessThan(0.8);
  });
});

// Claude (nfl-1): the momentum carry. A catch nobody is steering yet keeps running (C-1: it used to
// brake to a stop unless the stick was already held), a touched stick is still direct control, and
// the AI's own carriers never take this path.
describe('the momentum carry after a catch', () => {
  /** An in-stride catch in the open field, the receiver moving at (vx, vy) when the ball arrives. */
  function openCatch(vx: number, vy: number) {
    const { off, def } = teams();
    const p = lineUp(off, def, 'pass', 'verts', 'inside', 35, 26.67, rng(hashString('carry')));
    snap(p);
    const b = p.bodies.find((x) => x.slot === 'Z')!;
    for (const d of p.bodies.filter((x) => x.side === 'D')) Object.assign(d, { x: 2, y: 105, stunUntil: Infinity });
    Object.assign(p, { phase: 'air', carrier: null, t: 1, rand: () => 0.3 });
    Object.assign(b, { x: 30, y: 50, vx, vy, job: 'track' });
    p.ball = { from: { x: 26, y: 30 }, to: { x: 30, y: 50 }, t0: 0, t1: 1, peak: 3 };
    step(p, 1 / 60, null);
    expect(p.carrier).toBe(b);
    return { p, b, v0: Math.hypot(b.vx, b.vy), y0: b.y };
  }
  it.each([
    [0, 8],
    [5, 6],
    [-4, 7],
    [7, 3],
    [8, 0]
  ])('keeps a catch made running (%s,%s) going upfield: 0.85 of its speed at +0.5 s and 4+ yards in a second', (vx, vy) => {
    const { p, b, v0, y0 } = openCatch(vx, vy);
    for (let i = 0; i < 30; i++) step(p, 1 / 60, null);
    expect(Math.hypot(b.vx, b.vy)).toBeGreaterThanOrEqual(0.85 * v0);
    for (let i = 0; i < 30; i++) step(p, 1 / 60, null);
    expect(b.y - y0).toBeGreaterThanOrEqual(4);
    expect(p.end).toBeNull();
  });
  it.each([
    [0, -3],
    [-5, -5],
    [3, -6]
  ])('plants a receiver caught drifting back (%s,%s) and has him heading upfield within 0.3 s', (vx, vy) => {
    const { p, b } = openCatch(vx, vy);
    for (let i = 0; i < 18; i++) step(p, 1 / 60, null);
    expect(b.vy).toBeGreaterThan(0);
  });
  it('brakes a touched, centred stick to a stop', () => {
    const { p, b } = openCatch(0, 8);
    for (let i = 0; i < 60; i++) step(p, 1 / 60, { x: 0, y: 0 });
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(0.01);
  });
  it('drives a stick held upfield through the catch at once', () => {
    const { p, b } = openCatch(0, 8);
    const gate = new CarryGate();
    const held = { x: 0.6, y: 0.8 };
    // the first step with the new carrier already takes the stick
    expect(gate.input(b.id, false, held)).toEqual(held);
    for (let i = 0; i < 18; i++) step(p, 1 / 60, gate.input(b.id, false, held));
    expect(b.vx).toBeGreaterThan(2);
    expect(Math.atan2(b.vx, b.vy)).toBeCloseTo(Math.atan2(0.6, 0.8), 1);
  });
  it('never sends a receiver back-left after a pocket drift: upfield at +0.3 s in 20 of 20 seeded catches', () => {
    const drift = { x: -0.7, y: -0.7 };
    const headings: number[] = [];
    for (let seed = 1; seed < 80 && headings.length < 20; seed++) {
      const { off, def } = teams();
      const concept = (['verts', 'slants', 'smash', 'flood', 'dagger', 'mesh', 'curls', 'posts'] as const)[seed % 8];
      const p = lineUp(off, def, 'pass', concept, 'inside', 30, 26.67, rng(hashString('drift:' + seed)));
      for (const d of p.bodies.filter((x) => x.side === 'D')) d.stunUntil = Infinity;
      snap(p);
      const g = newGame(off, def, 'drift:' + seed);
      const pl = pilot(0.7, 'drift:' + seed);
      const gate = new CarryGate();
      let caughtAt = -1;
      for (let i = 0; i < 600 && !p.end; i++) {
        decide(p, g, pl);
        const c = p.phase === 'run' ? p.carrier : null;
        // the thumb has been drifting the quarterback back-left, and stays there through the catch
        step(p, 1 / 60, gate.input(c ? c.id : null, false, drift));
        if (p.phase === 'run' && caughtAt < 0) caughtAt = p.t;
        if (caughtAt >= 0 && p.t - caughtAt >= 0.3) break;
      }
      if (caughtAt < 0 || p.end || !p.carrier) continue;
      headings.push(p.carrier.vy);
    }
    expect(headings).toHaveLength(20);
    expect(headings.filter((vy) => vy > 0)).toHaveLength(20);
  });
  it('leaves the AI unchanged: the autopilot never gives the engine null for a ball carrier', () => {
    const { off, def } = teams();
    let carrierSteps = 0;
    for (let i = 0; i < 6; i++) {
      const g = newGame(off, def, 'ai-carry:' + i);
      const pl = pilot(0.68, 'ai-carry:' + i);
      for (let n = 0; n < 40 && !g.over; n++) {
        if (g.down === 4) break;
        const p = startPlay(g, chooseCall(g, pl));
        snap(p);
        pl.readAt = 0;
        for (let k = 0; k < 1500 && !p.end; k++) {
          const steer = decide(p, g, pl);
          if (p.phase === 'run' && p.carrier) {
            carrierSteps++;
            expect(typeof steer).toBe('number');
          }
          step(p, 1 / 60, steer);
        }
        afterPlay(g, p.end!);
      }
    }
    expect(carrierSteps).toBeGreaterThan(500);
  });
});
