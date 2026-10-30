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
    k: player('K', 'K'),
  };
  const def: Defense = {
    dl: ['DE', 'DT', 'DT', 'DE'].map((p, i) => player(p, 'DL' + i)) as Defense['dl'],
    lb: [0, 1, 2].map((i) => player('LB', 'LB' + i)) as Defense['lb'],
    cb: [player('CB', 'CB1'), player('CB', 'CB2')],
    s: [player('S', 'FS'), player('S', 'SS')],
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
