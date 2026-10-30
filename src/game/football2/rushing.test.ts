// Codex: run execution, physical blocking, player choice and rating/difficulty regressions.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
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
