// Soccer rule guards (Claude 2026-11-10, studio overhaul soccer-1):
//  - R-1: a shot or parry that dies short is a loose ball again (anyone plays it, the clock runs), so
//    an attack can't hang on a dead "shot" until its 120 s hard stop;
//  - set pieces a person leaves untaken are taken for him after SET_PIECE_WAIT, with a countdown;
//  - C-4: the BEND buttons bend the free kick the way their arrows point;
//  - J-1: the bounce event is for the sound only and changes nothing;
//  - R-2 (2026-11-16): a parry goes away from the goal line (round the post only from outside
//    ±(GHALF − 0.3)) and, from a keeper with HAN 55+, never back across his goal; a ball over the
//    byline off a defender or the keeper is a corner played in the same attack, off an attacker a
//    goal kick; over the touchline off a defender in the final third a quick throw-in for us, off us
//    a throw-in for them; at most two restarts an attack.
//  - soccer-2 (2026-11-16): the lofted through ball is a person's pass only.
//  - soccer-4 (2026-11-16): holds go to the meter's own wind-up (meter.top by distance, not the old
//    constant TOP), and BEND is measured on gold kicks by the path's bow (a gold kick lands on the aim).
import { describe, expect, it } from 'vitest';
import { autoplayAttack, decide, pilot } from './autopilot';
import { bendCurl, CORNER, cornerLayout, DEAD, GHALF, GX, kickOff, PARRY, pass, PL, pressShoot, PW, releaseShoot, RESTARTS, setAim, setCurl, setupAttack, step, THROW } from './engine';
import { SET_PIECE_WAIT, setPieceCountdown } from './match';
import { squadFor } from './squads.test-util';
import type { Attack, Body, Scenario, Squad } from './types';

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
  for (let i = 0, n = Math.round(a.meter!.top * 60); i < n; i++) step(a, DT, { x: 0, y: 0 });
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
    // (a set piece won meanwhile is taken for him after SET_PIECE_WAIT, as the match screen's AUTO KICK
    // does; soccer-4: this seed now wins a free kick on the loose ball)
    const pl = pilot(0.68, 'idle-dead-auto');
    let waiting = 0;
    for (let i = 0; i < 60 * 60 && !a.end; i++) {
      waiting = a.setPiece ? waiting + DT : 0;
      step(a, DT, a.setPiece && waiting >= SET_PIECE_WAIT ? decide(a, pl) : { x: 0, y: 0 });
    }
    expect(a.end).not.toBeNull();
    expect(a.t).toBeLessThan(a.clock + 15 + SET_PIECE_WAIT);
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

/**
 * A kick at the middle of the goal with every defender moved off its line, released on the gold
 * (soccer-4: a gold release now lands on the reticle, bend included, so the bend shows in its path):
 * how far it crosses from the aim, and its bow, the ball's distance across from the straight line
 * between where it was struck and where it crossed, halfway there (+ right on screen). A ball that
 * bends left has to start out right of that line: Bend left bows right, Bend right bows left.
 */
function bentKick(i: number, curl: number): { miss: number; bow: number } | null {
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
  const top = a.meter!.top;
  for (let j = 0; j < Math.round(top * 60) - 1; j++) step(a, DT, { x: 0, y: 0 });
  releaseShoot(a, { x: 0, y: 0 }, 0, top);
  const path: { x: number; y: number }[] = [];
  for (let j = 0; j < 400 && !a.end; j++) {
    step(a, DT, { x: 0, y: 0 });
    if (a.ball.flight?.kind === 'shot') path.push({ x: a.ball.x, y: a.ball.y });
  }
  const cross = a.lastShot?.cross;
  if (!cross || path.length < 4 || !a.lastShot?.greened) return null;
  const s0 = path[0];
  const midY = (s0.y + PL) / 2;
  const m = path.reduce((p, q) => (Math.abs(q.y - midY) < Math.abs(p.y - midY) ? q : p));
  const chord = s0.x + ((cross.x - s0.x) * (m.y - s0.y)) / (PL - s0.y);
  return { miss: Math.abs(cross.x - a.lastShot.aim.x), bow: m.x - chord };
}

describe('C-4: BEND bends the way its arrow points (x across the pitch: + right on screen)', () => {
  it('bendCurl: left is −, right is +, straight is none', () => {
    expect(bendCurl(0)).toBe(0);
    expect(bendCurl(-1)).toBeCloseTo(0.75);
    expect(bendCurl(1)).toBeCloseTo(-0.75);
    // the swipe across the pitch (Soccer2: -dx / 140) agrees: a swipe right is bendCurl's right
    expect(Math.sign(-60 / 140)).toBe(Math.sign(bendCurl(1)));
  });
  it('over 40 gold kicks each: on the aim, Bend left bending left (bowing right), Bend right bending right, straight straight', () => {
    const run = (k: number) => {
      const ks = Array.from({ length: 40 }, (_, i) => bentKick(i, bendCurl(k))).filter((v): v is { miss: number; bow: number } => v !== null);
      expect(ks.length).toBe(40);
      for (const q of ks) expect(q.miss).toBeLessThan(0.25);
      return ks.reduce((s, v) => s + v.bow, 0) / ks.length;
    };
    expect(run(-1)).toBeGreaterThan(0.3);
    expect(run(1)).toBeLessThan(-0.3);
    expect(Math.abs(run(0))).toBeLessThan(0.1);
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

/** The same eleven with its keeper's HAN set (a parry's direction reads it). */
const withHan = (sq: Squad, han: number): Squad => ({ ...sq, gk: { ...sq.gk, a: { ...sq.gk.a, HAN: han } } });

/** Every parry in `n` clean strikes at the keeper from 10–20 m: where it left his hands, and how. */
function parries(def: Squad, n: number, tag: string) {
  const out: { x: number; vx: number; vy: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = setupAttack('build', A, def, tag + i, { side: 1 });
    kickOff(a);
    const c = a.bodies[a.ctrl];
    c.x = GX - 12 + (i % 9) * 3;
    c.y = PL - 10 - (i % 5) * 2.5;
    c.fx = 0;
    c.fy = 1;
    a.ball.x = c.x;
    a.ball.y = c.y + 0.4;
    for (const b of a.bodies) if (b.side === 'D' && b.role !== 'gk') b.y = Math.min(b.y, c.y - 6);
    pressShoot(a);
    // across the goal, low to high: the keeper gets to most of them, and parries some
    setAim(a, { x: -0.8 + ((i * 7) % 17) / 10, y: -0.9 + ((i * 3) % 13) / 8 });
    // let go a little late, off the gold (soccer-4: a gold release lands exactly on its aim, and none of
    // these aims is within a ball of the post, so only an off-gold strike can be parried round it)
    for (let k = 0, n = Math.round(a.meter!.top * 60); k < n; k++) step(a, DT, { x: 0, y: 0 });
    releaseShoot(a, null, 0, a.meter!.top + 1.6 * a.meter!.green);
    for (let k = 0; k < 180 && !a.end; k++) {
      const before = a.events.length;
      step(a, DT, { x: 0, y: 0 });
      if (a.events.indexOf('save-parry', before) >= 0 && a.ball.flight?.kind === 'parry') {
        out.push({ x: a.ball.x, vx: a.ball.vx, vy: a.ball.vy });
        break;
      }
    }
  }
  return out;
}

describe('R-2: a parry goes away from goal', () => {
  it('leaves his hands going away from the goal line, unless pushed round the post from outside ±(GHALF − 0.3)', () => {
    let roundPost = 0;
    const all = [...parries(withHan(B, 60), 160, 'parry-a'), ...parries(withHan(B, 42), 160, 'parry-b')];
    expect(all.length).toBeGreaterThan(40);
    for (const p of all) {
      if (p.vy > 0) {
        expect(Math.abs(p.x - GX)).toBeGreaterThan(GHALF - PARRY.postIn);
        roundPost++;
      }
    }
    // pushing it round the post does happen, from out there
    expect(roundPost).toBeGreaterThan(0);
  });

  it('from a keeper with sound hands (HAN 55+) it goes to the side it came, never back across his goal', () => {
    const sure = parries(withHan(B, 70), 200, 'parry-sure').filter((p) => Math.abs(p.x - GX) > 0.05);
    expect(sure.length).toBeGreaterThan(20);
    for (const p of sure) expect(Math.sign(p.vx)).toBe(Math.sign(p.x - GX));
    expect(PARRY.fumbleHan).toBe(55);
  });
});

/** An attack in play with the ball running over a line, last touched by `who`. */
function overTheLine(seed: string, who: 'gk' | 'def' | 'att', ball: { x: number; y: number; vx: number; vy: number }): Attack {
  const a = setupAttack('build', A, B, seed, { side: 1 });
  kickOff(a);
  step(a, DT, { x: 0, y: 0 });
  sendOver(a, who, ball);
  return a;
}
function sendOver(a: Attack, who: 'gk' | 'def' | 'att', ball: { x: number; y: number; vx: number; vy: number }) {
  const by: Body = who === 'gk' ? a.bodies.find((b) => b.role === 'gk')! : who === 'def' ? a.bodies.find((b) => b.side === 'D' && b.role !== 'gk')! : a.bodies[a.ctrl];
  a.setPiece = null;
  a.taker = null;
  a.kick = null;
  Object.assign(a.ball, { owner: null, h: 0.3, vh: 0, curl: 0, dip: 0, last: by.id, ...ball });
  a.ball.flight = { kind: who === 'gk' ? 'parry' : who === 'def' ? 'clear' : 'ground', from: by.id, to: null, at: a.t };
  const from = a.events.length;
  for (let i = 0; i < 90 && !a.end && !a.events.slice(from).some((e) => e === 'corner-won' || e === 'throw-in'); i++) step(a, DT, { x: 0, y: 0 });
}
const finish = (a: Attack, seed: string) => {
  const pl = pilot(0.7, seed);
  for (let i = 0; i < 60 * 60 && !a.end; i++) step(a, DT, decide(a, pl));
  return a;
};

describe('R-2: the restarts', () => {
  it('a corner layout has one source: a dealt corner lines up on cornerLayout', () => {
    for (const side of [1, -1]) {
      const a = setupAttack('corner', A, B, 'layout' + side, { side });
      const L = cornerLayout(side);
      expect(a.setPiece!.spot).toEqual(L.spot);
      const taker = a.bodies[a.taker!];
      expect({ x: taker.x, y: taker.y }).toEqual(L.taker);
      expect(a.bodies.filter((b) => b.slot.startsWith('BX')).map((b) => ({ x: b.x, y: b.y }))).toEqual(L.box);
      expect(a.bodies.filter((b) => b.slot.startsWith('Z')).map((b) => ({ x: b.x, y: b.y }))).toEqual(L.zone);
      expect(CORNER.box).toHaveLength(5);
    }
  });

  it('a parry over the byline is a corner in the same attack, from the flag on its side', () => {
    for (const [i, x] of [GX + 7, GX - 8].entries()) {
      const a = overTheLine('parry-corner' + i, 'gk', { x, y: PL - 0.6, vx: Math.sign(x - GX) * 1.5, vy: 6 });
      expect(a.end, 'case ' + i).toBeNull();
      expect(a.events).toContain('corner-won');
      expect(a.setPiece?.kind).toBe('corner');
      const L = cornerLayout(x < GX ? 1 : -1);
      expect(a.setPiece!.spot).toEqual(L.spot);
      expect(a.ball.x).toBeCloseTo(L.spot.x, 6);
      expect(a.restarts).toBe(1);
      expect(a.ctrl).toBe(a.taker);
      expect(a.bodies[a.taker!].side).toBe('A');
      // the clock leaves time to take it, and the attack plays on to a proper end
      expect(a.clock - a.used).toBeGreaterThanOrEqual(RESTARTS.play - 1e-9);
      finish(a, 'parry-corner-pilot' + i);
      expect(LETTERS).toContain(a.end!.kind);
      expect(a.t).toBeLessThan(a.clock + 15);
    }
  });

  it('off a defender too; and no more than two restarts in an attack', () => {
    const a = overTheLine('two-restarts', 'def', { x: GX + 9, y: PL - 0.6, vx: 1, vy: 6 });
    expect(a.events).toContain('corner-won');
    sendOver(a, 'gk', { x: GX - 9, y: PL - 0.6, vx: -1, vy: 6 });
    expect(a.restarts).toBe(2);
    expect(a.setPiece?.kind).toBe('corner');
    // a third: the keeper's save stands, no third restart
    sendOver(a, 'gk', { x: GX + 9, y: PL - 0.6, vx: 1, vy: 6 });
    expect(a.restarts).toBe(2);
    expect(a.end).toMatchObject({ kind: 'S', text: 'SAVED · TURNED ROUND' });
    // and a quick throw-in counts toward the two
    const b = overTheLine('two-restarts-throw', 'def', { x: PW - 0.4, y: 90, vx: 3, vy: 0 });
    expect(b.events).toContain('throw-in');
    sendOver(b, 'gk', { x: GX - 9, y: PL - 0.6, vx: -1, vy: 6 });
    expect(b.restarts).toBe(2);
    sendOver(b, 'def', { x: 0.4, y: 92, vx: -3, vy: 0 });
    expect(b.end).toMatchObject({ kind: 'L', text: 'OUT OF PLAY' });
  });

  it('over the byline off an attacker: a goal kick, the attack over', () => {
    const a = overTheLine('goal-kick', 'att', { x: GX + 12, y: PL - 0.6, vx: 0, vy: 6 });
    expect(a.end).toMatchObject({ kind: 'W', text: 'GOAL KICK' });
    expect(a.restarts ?? 0).toBe(0);
  });

  it('over the touchline: off a defender in the final third a quick throw-in to the nearest man; off us theirs', () => {
    const a = overTheLine('throw-ours', 'def', { x: PW - 0.4, y: 88, vx: 4, vy: 0.5 });
    expect(a.end).toBeNull();
    expect(a.events).toContain('throw-in');
    expect(a.kick?.kind).toBe('throw');
    const thrower = a.bodies[a.kick!.by];
    expect(thrower.side).toBe('A');
    expect(thrower.x).toBeGreaterThan(PW);
    // the nearest other attacker is the man it's for, and the stick is on him
    const others = a.bodies.filter((b) => b.side === 'A' && b !== thrower);
    const near = others.reduce((m, b) => (Math.hypot(b.x - thrower.x, b.y - thrower.y) < Math.hypot(m.x - thrower.x, m.y - thrower.y) ? b : m));
    expect(a.kick!.to).toBe(near.id);
    expect(a.ctrl).toBe(near.id);
    // held overhead for the beat, then thrown: no offside from a throw-in
    const at = a.kick!.at;
    while (a.t < at - DT) {
      step(a, DT, { x: 0, y: 0 });
      expect(a.ball.h).toBeCloseTo(THROW.hold, 6);
    }
    for (let i = 0; i < 3; i++) step(a, DT, { x: 0, y: 0 });
    expect(a.events).toContain('throw');
    expect(a.ball.flight?.kind === 'throw' || a.ball.owner !== null).toBe(true);
    expect(a.offIds).toEqual([]);
    expect(thrower.passKind).toBe('throw');
    finish(a, 'throw-ours-pilot');
    expect(LETTERS).toContain(a.end!.kind);

    // short of the final third (y ≤ 75) it isn't a quick restart
    const deep = overTheLine('throw-deep', 'def', { x: 0.4, y: 70, vx: -4, vy: 0 });
    expect(deep.end).toMatchObject({ kind: 'L', text: 'OUT OF PLAY' });
    expect(deep.events).not.toContain('throw-in');
    // off us: their throw, the attack lost
    const theirs = overTheLine('throw-theirs', 'att', { x: 0.4, y: 90, vx: -4, vy: 0 });
    expect(theirs.end).toMatchObject({ kind: 'L', text: 'THROW-IN · THEIRS' });
  });

  it('across seeded autopilot attacks: never more than two restarts, every wide end a goal kick, all inside the clock + 15 s', () => {
    const SC: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick'];
    const weak = withHan(B, 45);
    let restarted = 0;
    let corners = 0;
    for (const sc of SC)
      for (let i = 0; i < 60; i++) {
        const a = autoplayAttack(setupAttack(sc, A, weak, 'restarts:' + sc + i, { side: i % 2 ? 1 : -1 }), 0.55 + (i % 4) * 0.12, 'restarts-pilot' + i);
        expect(a.restarts ?? 0, sc + i).toBeLessThanOrEqual(RESTARTS.max);
        if (a.restarts) restarted++;
        corners += a.events.filter((e) => e === 'corner-won').length;
        if (a.end!.kind === 'W') expect(a.end!.text, sc + i).toMatch(/GOAL KICK$/);
        expect(a.t, sc + i).toBeLessThan(a.clock + 15);
      }
    expect(restarted).toBeGreaterThan(0);
    expect(corners).toBeGreaterThan(0);
  });
});

// soccer-2 (2026-11-16): THRU held plays the lofted through ball, a person's pass only (the autopilot
// never plays it, so no AI simulation and no golden hash moves): the through ball's runner and space,
// in the air over the line, and the action contract's `passKind: 'loftedThrough'` for players.
describe('the lofted through ball (THRU held)', () => {
  const lineUp = (seed: string) => {
    const a = setupAttack('build', A, B, seed, { side: 1 });
    kickOff(a);
    for (let i = 0; i < 20; i++) step(a, DT, { x: 0, y: 0 });
    return a;
  };
  it('goes up and over, toward a runner going forward, and is marked for the players', () => {
    let lofted = 0;
    for (let s = 0; s < 20; s++) {
      const a = lineUp('loft-' + s);
      const c = a.bodies[a.ball.owner ?? a.ctrl];
      if (!pass(a, 'loftedThrough', { x: 0, y: 1 }, true)) continue;
      expect(a.kick?.kind).toBe('lofted');
      expect(a.kick?.loftedThrough).toBe(true);
      expect(a.kick!.vh).toBeGreaterThan(2);
      expect(a.kick!.vy).toBeGreaterThan(0);
      for (let i = 0; i < 12 && a.kick; i++) step(a, DT, { x: 0, y: 0 });
      expect(c.passKind).toBe('loftedThrough');
      expect(a.ball.flight?.kind).toBe('lofted');
      lofted++;
    }
    expect(lofted).toBeGreaterThan(10);
  });
  it('a ground THRU stays on the grass and carries no lofted mark', () => {
    const a = lineUp('thru-ground');
    const c = a.bodies[a.ball.owner ?? a.ctrl];
    expect(pass(a, 'through', { x: 0, y: 1 }, true)).toBe(true);
    expect(a.kick?.loftedThrough).toBeUndefined();
    for (let i = 0; i < 12 && a.kick; i++) step(a, DT, { x: 0, y: 0 });
    expect(c.passKind).toBe('through');
  });
  it('the autopilot never plays it', () => {
    for (let s = 0; s < 30; s++) {
      const a = setupAttack((['build', 'counter', 'wide'] as const)[s % 3], A, B, 'auto-' + s, { side: 1 });
      autoplayAttack(a, 0.75, 'auto-' + s);
      expect(a.bodies.every((b) => b.passKind !== 'loftedThrough')).toBe(true);
    }
  });
});
