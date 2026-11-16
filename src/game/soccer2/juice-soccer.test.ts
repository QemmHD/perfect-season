// Soccer's juice and Clutch staging are render only (Claude 2026-11-16, studio overhaul soccer-3; plan
// §5.6, R1, G19): a seeded attack ends exactly the same through an app-like frame loop with hit-stop,
// shake, slow motion and the Clutch camera running as stepped plainly; the hit-stop cap holds; reduced
// motion clamps it all.
import { describe, expect, it } from 'vitest';
import { decide, pilot } from './autopilot';
import { camStep, newCamState } from './camera';
import { viewOf, PRESETS } from './camera.test-util';
import { kickOff, setupAttack, step } from './engine';
import { HIT, hitStopFor, momentOf, POWER_SHOT, SLOW, type SoccerHit, SoccerFx } from './fx';
import { squadFor } from './squads.test-util';
import type { Attack, Scenario } from './types';

const DT = 1 / 60;
const US = squadFor('juice-us', 80);
const THEM = squadFor('juice-them', 78);
const n4 = (x: number) => (Object.is(x, -0) ? 0 : x).toFixed(4);
const print = (a: Attack) => [a.end?.kind, a.end?.text, n4(a.end?.t ?? -1), n4(a.t), n4(a.used), n4(a.ball.x), n4(a.ball.y), n4(a.ball.h), a.bodies.map((b) => n4(b.x) + ',' + n4(b.y)).join(';')].join('|');

/** uneven frames, 8-34 ms */
function frames(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return 8 + (s % 27);
  };
}

function plain(sc: Scenario, seed: string, stoppage: boolean): string {
  const a = setupAttack(sc, US, THEM, seed, { stoppage });
  const pl = pilot(0.7, seed + ':p');
  kickOff(a);
  for (let n = 0; n < 60 * 60 && !a.end; n++) {
    step(a, DT, decide(a, pl));
    a.events.length = 0;
  }
  return print(a);
}

/** Soccer2's loop: real frames through SoccerFx into the fixed-step accumulator, events to the juice,
 * the camera framed every frame (Clutch on in the stoppage attack). */
function juiced(sc: Scenario, seed: string, stoppage: boolean, reduced: boolean): { print: string; granted: number } {
  const a = setupAttack(sc, US, THEM, seed, { stoppage });
  const pl = pilot(0.7, seed + ':p');
  const fx = new SoccerFx({ reduced, seed: 7 });
  const cam = newCamState();
  const view = { ...viewOf(PRESETS[0], stoppage), reduced };
  const next = frames(seed.length * 31 + 3);
  kickOff(a);
  let now = 0;
  let acc = 0;
  for (let f = 0; f < 60 * 240 && !a.end; f++) {
    const ms = next();
    now += ms;
    const elapsed = ms / 1000;
    fx.update(elapsed);
    acc += fx.gameTime(now, elapsed);
    while (acc >= DT && !a.end) {
      acc -= DT;
      step(a, DT, decide(a, pl));
      for (const e of a.events) {
        const m = momentOf(e, a);
        if (m) fx.apply(m, now);
      }
      a.events.length = 0;
    }
    camStep(cam, a, view, elapsed, a.t);
    fx.view();
  }
  return { print: print(a), granted: fx.granted };
}

describe('soccer juice is render only', () => {
  const cases: [Scenario, string][] = [];
  for (const sc of ['build', 'counter', 'wide', 'corner', 'freekick', 'penalty'] as Scenario[]) for (let i = 0; i < 4; i++) cases.push([sc, 'juice:' + sc + ':' + i]);
  it('the same ends, times, ball and players with and without juice and Clutch (24 attacks)', () => {
    let granted = 0;
    for (const [sc, seed] of cases) {
      const stoppage = seed.endsWith('3');
      const base = plain(sc, seed, stoppage);
      const j = juiced(sc, seed, stoppage, false);
      expect(j.print, seed).toBe(base);
      expect(juiced(sc, seed, stoppage, true).print, seed + ' reduced').toBe(base);
      granted += j.granted;
    }
    // the juice actually ran (hit-stops were granted on shots, saves, goals or the woodwork)
    expect(granted).toBeGreaterThan(0);
  });
});

describe('hit-stop', () => {
  it('each moment is 33-120 ms (power 33, goal 66, save 60, woodwork 80); ≤ 30 ms under reduced motion', () => {
    const want: Record<SoccerHit, number> = { power: 33, goal: 66, save: 60, woodwork: 80 };
    for (const k of Object.keys(want) as SoccerHit[]) {
      expect(hitStopFor(k)).toBe(want[k]);
      expect(hitStopFor(k)).toBeGreaterThanOrEqual(HIT.min);
      expect(hitStopFor(k)).toBeLessThanOrEqual(HIT.max);
      expect(hitStopFor(k, true)).toBeLessThanOrEqual(30);
    }
  });
  it('never more than 150 ms of hit-stop in any second', () => {
    const fx = new SoccerFx();
    let t = 0;
    const log: [number, number][] = [];
    for (let i = 0; i < 400; i++) {
      t += 7 + (i % 13) * 9;
      const ms = fx.hitStop((['woodwork', 'goal', 'save', 'power'] as SoccerHit[])[i % 4], t);
      if (ms > 0) log.push([t, ms]);
    }
    for (const [at] of log) {
      const inSecond = log.filter(([b]) => b >= at && b < at + 1000).reduce((n, [, ms]) => n + ms, 0);
      expect(inSecond).toBeLessThanOrEqual(HIT.capPerS);
    }
    expect(log.length).toBeGreaterThan(20);
  });
});

describe('reduced motion and the moments', () => {
  it('reduced motion: no shake, no slow motion, hit-stop ≤ 30 ms', () => {
    const fx = new SoccerFx({ reduced: true });
    fx.apply({ hit: 'woodwork', trauma: 1, slow: 'near' }, 1000);
    fx.update(0.016);
    expect(fx.view()).toEqual({ x: 0, y: 0 });
    expect(fx.scale(1100)).toBe(1);
    expect(fx.granted).toBeLessThanOrEqual(30);
    expect(fx.gameTime(1000 + 31, 0.016)).toBeCloseTo(0.016, 9);
  });
  it('slow motion: a near miss at 0.4x for 0.6 s, once an attack; a pause shifts it', () => {
    const fx = new SoccerFx();
    fx.slow('near', 0);
    expect(fx.scale(100)).toBe(SLOW.nearK);
    expect(fx.scale(SLOW.nearMs + 1)).toBe(1);
    fx.slow('goal', 700);
    expect(fx.scale(800)).toBe(1);
    fx.newAttack();
    fx.slow('goal', 1000);
    fx.shift(5000);
    expect(fx.scale(5000 + 1000 + SLOW.goalMs - 10)).toBe(SLOW.goalK);
  });
  it('a hard shot is a power shot; a goal, a save and the woodwork have their moments', () => {
    const a = setupAttack('build', US, THEM, 'moments');
    a.ball.vx = 0;
    a.ball.vy = POWER_SHOT + 1;
    expect(momentOf('shot', a)?.hit).toBe('power');
    a.ball.vy = 12;
    expect(momentOf('shot', a)).toBeNull();
    expect(momentOf('goal', a)?.hit).toBe('goal');
    expect(momentOf('save-parry', a)?.hit).toBe('save');
    expect(momentOf('post', a)).toMatchObject({ hit: 'woodwork', post: true, slow: 'near' });
    expect(momentOf('pass', a)).toBeNull();
  });
});
