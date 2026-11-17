// The players' action contract (docs/studio-overhaul/soccer.md §5.5; Claude 2026-11-16, soccer-4):
// the render-only fields soccer-4 writes (kickFoot, passKind, shotKind, power, contact, diveHeight,
// keeperSet, slide) are written from deterministic geometry and never read by the engine. Scribbling
// over them every step changes nothing, the engine doesn't import the players' looks, and they are
// actually written in play.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { decide, pilot } from './autopilot';
import { GX, kickOff, PL, pressShoot, releaseShoot, setupAttack, step } from './engine';
import { squadFor } from './squads.test-util';
import type { Attack, Body, Scenario } from './types';

const A = squadFor('rf-a', 79);
const B = squadFor('rf-b', 77);
const SCEN: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick', 'penalty'];

/** Play an attack with the autopilot; `scribble` overwrites every render field each step. */
function play(seed: string, sc: Scenario, scribble: (() => number) | null, careless = false) {
  const a = setupAttack(sc, A, B, seed, {});
  // (a careless pilot on half of them: it shoots through bodies, so block lunges are written too)
  const pl = pilot(careless ? 0.25 : 0.7, seed);
  kickOff(a);
  const seen = new Set<string>();
  for (let n = 0; n < 60 * 60 && !a.end; n++) {
    step(a, 1 / 60, decide(a, pl));
    for (const b of a.bodies) {
      for (const k of ['kickFoot', 'passKind', 'shotKind', 'power', 'contact', 'diveHeight', 'keeperSet', 'slide', 'touchAt', 'look'] as const) if (b[k] !== undefined) seen.add(k);
      if (scribble) scribbleOn(b, scribble);
    }
  }
  return { a, seen };
}
function scribbleOn(b: Body, r: () => number) {
  b.kickFoot = r() < 0.5 ? 'L' : 'R';
  b.passKind = (['ground', 'lofted', 'through', 'cross', 'shot', 'header', 'clear'] as const)[Math.floor(r() * 7)];
  b.shotKind = r() < 0.5 ? 'placed' : 'power';
  b.power = r();
  b.contact = (['foot', 'head', 'volley'] as const)[Math.floor(r() * 3)];
  b.diveHeight = (['low', 'mid', 'high'] as const)[Math.floor(r() * 3)];
  b.keeperSet = r() * 30;
  b.slide = { at: r() * 30, dx: r() - 0.5, dy: r() - 0.5 };
  // soccer-5: the dribble touch's time and a jockeying defender's look
  b.touchAt = r() * 30;
  b.look = { x: r() * 68, y: r() * 105 };
}
const fingerprint = (a: Attack) => JSON.stringify([a.end, a.t.toFixed(6), a.ball.x.toFixed(6), a.ball.y.toFixed(6), a.bodies.map((b) => [b.x.toFixed(5), b.y.toFixed(5)])]);

describe('render-only fields (§5.5)', () => {
  it('randomising them every step gives identical outcomes', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 72; i++) {
      const sc = SCEN[i % SCEN.length];
      const plain = play('rf' + i, sc, null, i % 2 === 1);
      const noisy = play('rf' + i, sc, rng(hashString('scribble' + i)), i % 2 === 1);
      expect(fingerprint(noisy.a), 'attack ' + i + ' ' + sc).toBe(fingerprint(plain.a));
      for (const k of plain.seen) seen.add(k);
    }
    // (soccer-5: the AI shoots past a man less often now, so a block lunge is set up on purpose: a shot
    // from 16 m with one defender 0.9 m off its line, 6 m out)
    for (let k = 0; k < 6 && !seen.has('slide'); k++) {
      const a = setupAttack('build', A, B, 'rf-lunge' + k, { side: 1 });
      kickOff(a);
      const c = a.bodies[a.ctrl];
      [c.x, c.y, c.vx, c.vy] = [GX, PL - 16, 0, 0];
      [a.ball.x, a.ball.y, a.ball.vx, a.ball.vy] = [GX, PL - 15.65, 0, 0];
      const ds = a.bodies.filter((b) => b.side === 'D' && b.role !== 'gk');
      ds.forEach((b, j) => ([b.x, b.y, b.stunUntil] = j === 0 ? [GX + 0.9 + k * 0.1, PL - 10, 1e9] : [2, 31, 1e9]));
      if (!pressShoot(a)) continue;
      for (let n = 0; n < Math.round(a.meter!.top * 60); n++) step(a, 1 / 60, { x: 0, y: 0 });
      releaseShoot(a, { x: 0, y: -0.9 });
      for (let n = 0; n < 60 && !a.end; n++) step(a, 1 / 60, { x: 0, y: 0 });
      if (ds[0].slide) seen.add('slide');
    }
    // and the engine does write them in play
    for (const k of ['kickFoot', 'passKind', 'shotKind', 'power', 'contact', 'diveHeight', 'keeperSet', 'slide', 'touchAt', 'look']) expect(seen.has(k), k).toBe(true);
  });

  it('the engine never imports the players’ looks (appearance*)', () => {
    const SRC = import.meta.glob<string>(['./engine.ts', './autopilot.ts', './ratings.ts', './types.ts', './xg.ts', './v2/perfect.ts'], { query: '?raw', import: 'default', eager: true });
    expect(Object.keys(SRC).length).toBe(6);
    for (const [f, src] of Object.entries(SRC)) expect(src, f).not.toMatch(/from ['"][^'"]*appearance/);
    // nor the HUD or the sound: only the pure window maths from v2
    const eng = SRC['./engine.ts'];
    expect(eng).not.toMatch(/^import (?!type )[^;]*from ['"]\.\/v2['"]/m);
    expect(eng).not.toMatch(/from ['"][^'"]*(hud|sound|haptics|render)['"]/);
  });
});
