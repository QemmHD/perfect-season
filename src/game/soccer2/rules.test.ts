// Soccer rule guards (Claude 2026-11-10, studio overhaul soccer-1):
//  - R-1: a shot or parry that dies short is a loose ball again (anyone plays it, the clock runs), so
//    an attack can't hang on a dead "shot" until its 120 s hard stop;
//  - set pieces a person leaves untaken are taken for him after SET_PIECE_WAIT, with a countdown;
//  - C-4: the BEND buttons bend the free kick the way their arrows point;
//  - J-1: the bounce event is for the sound only and changes nothing.
import { describe, expect, it } from 'vitest';
import { autoplayAttack, decide, pilot } from './autopilot';
import { bendCurl, DEAD, kickOff, PL, pressShoot, releaseShoot, setAim, setCurl, setupAttack, step, TOP } from './engine';
import { SET_PIECE_WAIT, setPieceCountdown } from './match';
import { squadFor } from './squads.test-util';
import type { Attack, Scenario } from './types';

const DT = 1 / 60;
const LETTERS = 'GSWBLOT';
const A = squadFor('rules-a', 80);
const B = squadFor('rules-b', 76);

/** Open play from a spot: the man on the ball at (x, y), the shot struck on the green at the middle
 * of the goal, and stepped until it's in flight. */
function shotFrom(seed: string, x: number, y: number): Attack {
  const a = setupAttack('build', A, B, seed, { side: 1 });
  kickOff(a);
  const c = a.bodies[a.ctrl];
  c.x = x;
  c.y = y;
  c.fx = 0;
  c.fy = 1;
  a.ball.x = x;
  a.ball.y = y + 0.4;
  // nobody near him: the strike goes off clean
  for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') b.y = Math.min(b.y, y - 6);
  pressShoot(a);
  setAim(a, { x: 0, y: -0.5 });
  for (let i = 0; i < Math.round(TOP * 60); i++) step(a, DT, { x: 0, y: 0 });
  releaseShoot(a, null);
  for (let i = 0; i < 30 && a.ball.flight?.kind !== 'shot'; i++) step(a, DT, { x: 0, y: 0 });
  return a;
}

describe('R-1: a dead shot is a loose ball', () => {
  it('a shot that dies short stops being a shot within 1 s, and the attack ends within 15 s', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const a = shotFrom('dead' + i, 18 + (i % 6) * 6, 72 + (i % 4) * 4);
      expect(a.ball.flight?.kind, 'seed ' + i).toBe('shot');
      // a scuffed shot (or one that came off a boot): rolling on, slower than a walk
      a.ball.vx = (i % 3) - 1;
      a.ball.vy = 1.6;
      a.ball.vh = 0;
      a.ball.h = 0.11;
      const t0 = a.t;
      const pl = pilot(0.68, 'dead-pilot' + i);
      let converted = -1;
      while (!a.end && a.t - t0 < 30) {
        step(a, DT, decide(a, pl));
        if (converted < 0 && a.ball.flight?.kind !== 'shot') converted = a.t - t0;
      }
      expect(converted, 'seed ' + i).toBeGreaterThanOrEqual(0);
      expect(converted, 'seed ' + i).toBeLessThan(1);
      expect(a.events, 'seed ' + i).toContain('shot-dead');
      expect(a.end, 'seed ' + i).not.toBeNull();
      expect(a.t - t0, 'seed ' + i).toBeLessThan(15);
      expect(LETTERS).toContain(a.end!.kind);
      kinds.add(a.end!.kind);
    }
    // somebody actually plays it: lost to a defender, the keeper's, or put away
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('the clock runs while the dead ball sits there, so a person who leaves it can not hang the attack', () => {
    const a = shotFrom('idle-dead', 34, 78);
    a.ball.vx = 0;
    a.ball.vy = 0.5;
    a.ball.vh = 0;
    a.ball.h = 0.11;
    const used0 = a.used;
    for (let i = 0; i < 60; i++) step(a, DT, { x: 0, y: 0 });
    expect(a.ball.flight?.kind).not.toBe('shot');
    expect(a.used - used0).toBeGreaterThan(0.9);
    for (let i = 0; i < 60 * 60 && !a.end; i++) step(a, DT, { x: 0, y: 0 });
    expect(a.end).not.toBeNull();
    expect(a.t).toBeLessThan(a.clock + 15);
  });

  it('a looping ball that has bounced twice is loose; a hard, true shot stays the keeper’s', () => {
    const lob = shotFrom('lob', 34, 80);
    lob.ball.vx = 0;
    lob.ball.vy = 6;
    lob.ball.vh = 6;
    lob.ball.h = 0.2;
    let bounces = 0;
    for (let i = 0; i < 60 * 4 && lob.ball.flight?.kind === 'shot' && !lob.end; i++) {
      step(lob, DT, { x: 0, y: 0 });
      bounces = lob.events.filter((e) => e === 'bounce').length;
    }
    expect(bounces).toBe(DEAD.bounces);
    expect(lob.ball.flight?.kind).toBe('clear');
    expect(Math.hypot(lob.ball.vx, lob.ball.vy)).toBeGreaterThan(DEAD.speed);
    // a normal strike from 18 m flies as a shot until the keeper or the line settles it
    const shot = shotFrom('true', 34, PL - 18);
    let wasShot = true;
    for (let i = 0; i < 60 && !shot.end && shot.ball.flight; i++) {
      if (shot.ball.flight.kind !== 'shot' && !shot.events.includes('save-parry') && !shot.events.includes('post') && !shot.events.includes('bar')) wasShot = false;
      step(shot, DT, { x: 0, y: 0 });
    }
    expect(wasShot).toBe(true);
    expect(shot.events).not.toContain('shot-dead');
  });

  it('autopilot attacks all finish within the clock + 15 s', () => {
    const SC: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick', 'penalty'];
    for (const sc of SC)
      for (let i = 0; i < 30; i++) {
        const a = autoplayAttack(setupAttack(sc, A, B, 'clock:' + sc + i, { side: i % 2 ? 1 : -1, defIQ: (i % 3) - 0.5 }), (i % 4) / 3, 'clock-pilot' + i);
        expect(a.end, sc + i).not.toBeNull();
        expect(a.t, sc + i).toBeLessThan(a.clock + 15);
      }
  });
});

describe('set pieces left untaken', () => {
  it('count down from 5 s before the autopilot takes them, at SET_PIECE_WAIT', () => {
    expect(SET_PIECE_WAIT).toBe(12);
    expect(setPieceCountdown(0)).toBeNull();
    expect(setPieceCountdown(6.9)).toBeNull();
    expect(setPieceCountdown(7)).toBe(5);
    expect(setPieceCountdown(9.5)).toBe(3);
    expect(setPieceCountdown(11.99)).toBe(1);
    expect(setPieceCountdown(12)).toBeNull();
  });
  it('the autopilot takes a set piece a person left: the free kick, the corner and the penalty go', () => {
    for (const sc of ['freekick', 'corner', 'penalty'] as Scenario[]) {
      const a = setupAttack(sc, A, B, 'left:' + sc, { side: 1 });
      kickOff(a);
      // the person does nothing for SET_PIECE_WAIT s: the clock holds, nothing happens
      for (let i = 0; i < SET_PIECE_WAIT * 60; i++) step(a, DT, { x: 0, y: 0 });
      expect(a.setPiece?.kind, sc).toBe(sc);
      expect(a.used, sc).toBe(0);
      // then the autopilot's taker has it
      const pl = pilot(0.75, 'left-pilot:' + sc);
      for (let i = 0; i < 60 * 3 && a.setPiece; i++) step(a, DT, decide(a, pl));
      expect(a.setPiece, sc).toBeNull();
    }
  });
});

/** a kick at the middle of the goal with every defender moved off its line: where it crosses */
function bentKick(i: number, curl: number): number | null {
  const a = setupAttack('freekick', squadFor('bend-a', 92), squadFor('bend-d', 60), 'bend' + i, { side: 1 });
  for (const b of a.bodies)
    if (b.side === 'D') {
      b.x = b.role === 'gk' ? 0.5 : 1;
      b.y = b.role === 'gk' ? PL - 0.3 : 60;
      b.home = { x: b.x, y: b.y };
    }
  kickOff(a);
  setCurl(a, curl);
  pressShoot(a);
  setAim(a, { x: 0, y: 0 });
  for (let j = 0; j < Math.round(TOP * 60); j++) step(a, DT, { x: 0, y: 0 });
  releaseShoot(a, { x: 0, y: 0 });
  for (let j = 0; j < 400 && !a.end; j++) step(a, DT, { x: 0, y: 0 });
  return a.lastShot?.cross ? a.lastShot.cross.x - a.lastShot.aim.x : null;
}

describe('C-4: BEND bends the way its arrow points (x across the pitch: + right on screen)', () => {
  it('bendCurl: left is −, right is +, straight is none', () => {
    expect(bendCurl(0)).toBe(0);
    expect(bendCurl(-1)).toBeCloseTo(0.75);
    expect(bendCurl(1)).toBeCloseTo(-0.75);
    // the swipe across the pitch (Soccer2: -dx / 140) agrees: a swipe right is bendCurl's right
    expect(Math.sign(-60 / 140)).toBe(Math.sign(bendCurl(1)));
  });
  it('over 40 kicks each: Bend left ends 1.5 m+ left of the aim, Bend right 1.5 m+ right, straight within 0.5 m', () => {
    const mean = (k: number) => {
      const xs = Array.from({ length: 40 }, (_, i) => bentKick(i, bendCurl(k))).filter((v): v is number => v !== null);
      expect(xs.length).toBe(40);
      return xs.reduce((s, v) => s + v, 0) / xs.length;
    };
    expect(mean(-1)).toBeLessThan(-1.5);
    expect(mean(1)).toBeGreaterThan(1.5);
    expect(Math.abs(mean(0))).toBeLessThan(0.5);
  });
});

describe('J-1: the bounce is a sound, not a rule', () => {
  it('bounces are reported, and taking them out of the events changes no attack', () => {
    let seen = 0;
    const SC: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick'];
    for (const sc of SC)
      for (let i = 0; i < 6; i++) {
        const play = (strip: boolean) => {
          const a = setupAttack(sc, A, B, 'bounce:' + sc + i, { side: 1 });
          const pl = pilot(0.7, 'bounce-pilot' + i);
          kickOff(a);
          for (let n = 0; n < 60 * 120 && !a.end; n++) {
            step(a, DT, decide(a, pl));
            if (strip) a.events = a.events.filter((e) => e !== 'bounce');
          }
          return a;
        };
        const kept = play(false);
        const stripped = play(true);
        seen += kept.events.filter((e) => e === 'bounce').length;
        expect(stripped.end, sc + i).toEqual(kept.end);
        expect([stripped.t, stripped.ball.x, stripped.ball.y], sc + i).toEqual([kept.t, kept.ball.x, kept.ball.y]);
        expect(stripped.events, sc + i).toEqual(kept.events.filter((e) => e !== 'bounce'));
      }
    expect(seen).toBeGreaterThan(0);
  });
});
