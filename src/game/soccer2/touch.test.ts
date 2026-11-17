// Touch dribbling and shielding (Claude 2026-11-16, studio overhaul soccer-5; V2 B.3.4, plan G7, G9).
// The ball is knocked ahead on touch beats and rolls between them: a touch every 2 strides at a jog
// with the ball 0.6-1.0 m ahead, every 3-4 at a run, every 5-6 at a sprint with it 3-5 m ahead, and a
// DRI 95 touch no more than 0.75x a DRI 60 one. Shielding (the stick back toward his own goal with a
// defender within 1.5 m) holds by the PHY difference.
import { describe, expect, it } from 'vitest';
import { kickOff, pass, pressShoot, setSprint, setupAttack, step, TOUCH } from './engine';
import { strideLen, touchOf, touchScale } from './ratings';
import type { Attack, SoccerPlayer, SoccerPos, Squad } from './types';

let uid = 0;
function player(pos: SoccerPos, v: number, over: Record<string, number> = {}): SoccerPlayer {
  const keeper = pos === 'GK';
  const keys = keeper ? ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'] : ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
  const a: Record<string, number> = Object.fromEntries(keys.map((k) => [k, v]));
  Object.assign(a, over);
  return { id: 'tp' + uid++, name: 'P', tag: 'P', num: null, ht: 182, pos, pos2: [pos], ovr: v, a, keeper };
}
function squad(v: number, over: Record<string, number> = {}): Squad {
  return {
    name: 'T',
    abbr: 'T',
    c1: '#c22',
    c2: '#fff',
    gk: player('GK', v),
    def: [player('FB', v, over), player('CB', v, over), player('CB', v, over), player('FB', v, over)],
    mid: [player('CM', v, over), player('DM', v, over), player('CM', v, over)],
    fwd: [player('W', v, over), player('ST', v, over), player('W', v, over)],
  };
}
const med = (x: number[]) => [...x].sort((p, q) => p - q)[Math.floor(x.length / 2)];

/** A counter's carrier alone in open play (every defender out of it), running straight up the pitch:
 * the strides between touches and how far ahead the ball gets between them. */
function cadence(dri: number, mode: 'jog' | 'sprint' | 'close') {
  const a = setupAttack('counter', squad(75, { DRI: dri }), squad(40), 'touch-cadence', { side: 1 });
  for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') ((b.x = 2), (b.y = 31), (b.stunUntil = 1e9));
  kickOff(a);
  const c = a.bodies[a.ctrl];
  let strides = 0;
  let at = 0;
  let last: number | undefined;
  let ahead = 0;
  const iv: number[] = [];
  const peak: number[] = [];
  for (let i = 0; i < 60 * 3.2 && !a.end; i++) {
    setSprint(a, mode === 'sprint');
    a.stamina = 1;
    step(a, 1 / 60, { x: 0, y: mode === 'close' ? 0.7 : 1 });
    const v = Math.hypot(c.vx, c.vy);
    strides += v / strideLen(Math.max(0.5, v)) / 60;
    if (a.t > 1.2) ahead = Math.max(ahead, Math.hypot(a.ball.x - c.x, a.ball.y - c.y));
    if (c.touchAt !== last) {
      if (a.t > 1.2 && last !== undefined) {
        iv.push(strides - at);
        peak.push(ahead);
      }
      at = strides;
      last = c.touchAt;
      ahead = 0;
    }
  }
  return { strides: med(iv), ahead: med(peak), n: iv.length, owner: a.ball.owner === c.id };
}

describe('touch dribbling (G7)', () => {
  it('a touch every 2 strides at a jog with the ball 0.6-1.0 m ahead, every 5-6 at a sprint with it 3-5 m ahead', () => {
    const jog = cadence(75, 'jog');
    const sprint = cadence(75, 'sprint');
    expect(jog.owner && sprint.owner).toBe(true);
    expect(jog.n).toBeGreaterThanOrEqual(3);
    expect(jog.strides).toBeGreaterThanOrEqual(1);
    expect(jog.strides).toBeLessThanOrEqual(3);
    expect(jog.ahead).toBeGreaterThanOrEqual(0.6 - 0.3);
    expect(jog.ahead).toBeLessThanOrEqual(1.0 + 0.3);
    expect(sprint.n).toBeGreaterThanOrEqual(1);
    expect(sprint.strides).toBeGreaterThanOrEqual(4);
    expect(sprint.strides).toBeLessThanOrEqual(7);
    expect(sprint.ahead).toBeGreaterThanOrEqual(3 - 0.3);
    expect(sprint.ahead).toBeLessThanOrEqual(5 + 0.3);
    // close control: the shortest touch, never exposed
    const close = cadence(75, 'close');
    expect(close.ahead).toBeLessThanOrEqual(TOUCH.exposed + 0.05);
    expect(close.strides).toBeLessThan(jog.strides);
  });

  it('every 3-4 strides at a run (pure), and DRI shortens the touch: DRI 95 at most 0.75x DRI 60', () => {
    const p = (dri: number) => player('W', 75, { DRI: dri });
    const run = touchOf(p(75), 0.87, false);
    expect(run.strides).toBeGreaterThanOrEqual(3);
    expect(run.strides).toBeLessThanOrEqual(4);
    for (const ratio of [0.7, 0.87, 1]) expect(touchOf(p(95), ratio, false).out / touchOf(p(60), ratio, false).out).toBeLessThanOrEqual(0.75);
    expect(touchScale(p(95)) / touchScale(p(60))).toBeLessThanOrEqual(0.75);
    // and on the pitch, at a sprint: the ball's run beyond the foot
    const a = cadence(60, 'sprint');
    const b = cadence(95, 'sprint');
    expect((b.ahead - TOUCH.foot) / (a.ahead - TOUCH.foot)).toBeLessThanOrEqual(0.75 + 0.05);
  });

  it('a pass or a shot asked for with the ball out ahead waits until he is back on it', () => {
    const a = setupAttack('counter', squad(75), squad(40), 'touch-pending', { side: 1 });
    for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') ((b.x = 2), (b.y = 31), (b.stunUntil = 1e9));
    kickOff(a);
    const c = a.bodies[a.ctrl];
    let i = 0;
    for (; i < 300 && !(a.ball.owner === c.id && Math.hypot(a.ball.x - c.x, a.ball.y - c.y) > TOUCH.reach + 0.5); i++) {
      setSprint(a, true);
      step(a, 1 / 60, { x: 0, y: 1 });
    }
    expect(i).toBeLessThan(300);
    expect(pass(a, 'ground', { x: 1, y: 0.4 }, true)).toBe(true);
    expect(a.pending?.kind).toBe('pass');
    expect(a.kick).toBeNull();
    expect(pressShoot(a)).toBe(false);
    for (let k = 0; k < 120 && !a.kick; k++) step(a, 1 / 60, { x: 0, y: 0 });
    expect(a.kick).not.toBeNull();
    expect(Math.hypot(a.ball.x - c.x, a.ball.y - c.y)).toBeLessThanOrEqual(TOUCH.reach + 0.3);
  });
});

/** A shield: the man on the ball with his back to one defender a metre goal-side of him, the stick back
 * toward his own goal. Held = still his ball after 2 s. */
function shieldHeld(att: number, def: number, seed: string): boolean {
  const a: Attack = setupAttack('build', squad(75, { PHY: att }), squad(75, { PHY: def }), seed, { side: 1 });
  const c = a.bodies[a.ctrl];
  let first = true;
  for (const b of a.bodies) {
    if (b.side !== 'D' || b.role === 'gk') continue;
    if (first) {
      b.x = c.x;
      b.y = c.y + 1.0;
      first = false;
    } else {
      b.x = 66;
      b.y = 100;
      b.stunUntil = 1e9;
    }
  }
  for (const b of a.bodies) if (b.side === 'A' && b !== c) ((b.x = 66), (b.y = 35));
  kickOff(a);
  for (let i = 0; i < 120 && !a.end; i++) {
    step(a, 1 / 60, { x: 0, y: -1 });
    if (a.setPiece) return true;
    if (a.ball.owner !== c.id) return false;
  }
  return !a.end || a.end.kind !== 'L';
}

describe('shielding (G9)', () => {
  it('holds 2 s in at least half the tries at PHY +10 and at most 45% at PHY -10', () => {
    const N = 60;
    let strong = 0;
    let weak = 0;
    for (let i = 0; i < N; i++) {
      if (shieldHeld(85, 75, 'shield-s' + i)) strong++;
      if (shieldHeld(65, 75, 'shield-w' + i)) weak++;
    }
    expect(strong / N).toBeGreaterThanOrEqual(0.5);
    expect(weak / N).toBeLessThanOrEqual(0.45);
    expect(strong).toBeGreaterThan(weak);
  });

  it('the shielder turns his back: act shield, the ball on the far foot from the man', () => {
    const a = setupAttack('build', squad(75), squad(75), 'shield-look', { side: 1 });
    const c = a.bodies[a.ctrl];
    const d = a.bodies.find((b) => b.side === 'D' && b.role !== 'gk')!;
    for (const b of a.bodies) if (b.side === 'D' && b !== d && b.role !== 'gk') ((b.x = 66), (b.y = 100), (b.stunUntil = 1e9));
    d.x = c.x;
    d.y = c.y + 1;
    kickOff(a);
    for (let i = 0; i < 10; i++) step(a, 1 / 60, { x: 0, y: -1 });
    expect(c.act).toBe('shield');
    // the ball is on his far side from the defender
    expect(Math.hypot(a.ball.x - d.x, a.ball.y - d.y)).toBeGreaterThan(Math.hypot(c.x - d.x, c.y - d.y));
  });
});
