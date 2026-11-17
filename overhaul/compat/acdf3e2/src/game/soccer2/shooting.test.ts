// Claude 2026-11-02: the aim-and-shoot and passing update (docs/SOCCER-ENGINE.md "Aim and shoot").
// Aim assist and the drag's snap are deterministic and pick the open side; accuracy falls off
// smoothly with the distance of the release from the green's centre (cone, miss and goal rate are
// monotone in it); ratings still decide (higher SHO scores more, a better keeper concedes fewer);
// a person's pass goes the stick's way with only a gentle pull toward a teammate; a receiver whose
// stick is still held the way of the pass runs onto it; a shootout kick goes where it's dragged.
import { describe, expect, it } from 'vitest';
import { assistAim, coneMult, GX, kickOff, openSide, pass, PASS_ASSIST, passPlan, PL, pressShoot, releaseShoot, setAim, setupAttack, snapAim, step, timingMiss, timingWord, TOP } from './engine';
import { greenHalf } from './ratings';
import { kickAttack, newShootout } from './shootout';
import type { Attack, Body, SoccerPlayer, SoccerPos, Squad } from './types';

const OUT = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
const GK = ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'];
let uid = 0;
function player(pos: SoccerPos, v = 75, over: Record<string, number> = {}): SoccerPlayer {
  const keeper = pos === 'GK';
  const a: Record<string, number> = Object.fromEntries((keeper ? GK : OUT).map((k) => [k, v]));
  Object.assign(a, over);
  const id = 's' + uid++;
  return { id, name: id, tag: id.toUpperCase(), num: null, ht: 182, pos, pos2: [pos], ovr: v, a, keeper };
}
function squad(v = 75, over: Partial<Record<'gk' | 'def' | 'mid' | 'fwd', Record<string, number>>> = {}): Squad {
  return {
    name: 'T',
    abbr: 'T',
    c1: '#cc2222',
    c2: '#ffffff',
    gk: player('GK', v, over.gk),
    def: [player('FB', v, over.def), player('CB', v, over.def), player('CB', v, over.def), player('FB', v, over.def)],
    mid: [player('CM', v, over.mid), player('DM', v, over.mid), player('CM', v, over.mid)],
    fwd: [player('W', v, over.fwd), player('ST', v, over.fwd), player('W', v, over.fwd)],
  };
}
const rate = (n: number, f: (i: number) => boolean) => {
  let k = 0;
  for (let i = 0; i < n; i++) if (f(i)) k++;
  return k / n;
};
const keeperOf = (a: Attack): Body => a.bodies.find((b) => b.role === 'gk')!;

/**
 * Through on goal (the drill scripts/audit_soccer_shots.ts uses): the outfield defenders out of it,
 * held 9 m further out while the keeper sets on the angle, then a sprint in to 13-16 m out.
 */
function oneOnOne(att: Squad, def: Squad, seed: string, i: number): Attack {
  const a = setupAttack('build', att, def, seed, { side: 1 });
  kickOff(a);
  const c = a.bodies[a.ctrl];
  const side = i % 2 ? 1 : -1;
  const spot = { x: GX + side * ((i * 0.37) % 4), y: PL - 13 - ((i * 0.53) % 3) };
  for (const b of a.bodies) if (b.side === 'D' && b.role === 'def') ((b.x = b.x < GX ? 1 : 67), (b.y = spot.y + 1), (b.stunUntil = 1e9));
  a.ball.owner = c.id;
  const k = 9 / Math.hypot(GX - spot.x, PL - spot.y);
  const pin = { x: spot.x - (GX - spot.x) * k, y: spot.y - (PL - spot.y) * k };
  for (let f = 0; f < 60; f++) {
    step(a, 1 / 60, { x: 0, y: 0 });
    c.x = pin.x;
    c.y = pin.y;
    c.vx = c.vy = 0;
  }
  const want = Math.hypot(GX - spot.x, PL - spot.y);
  for (let f = 0; f < 240 && Math.hypot(GX - c.x, PL - c.y) > want && !a.end; f++) {
    a.sprinting = true;
    const d = Math.hypot(spot.x - c.x, spot.y - c.y) || 1;
    step(a, 1 / 60, { x: (spot.x - c.x) / d, y: (spot.y - c.y) / d });
  }
  a.sprinting = false;
  return a;
}
/** A person's shot: run on at goal, SHOOT held for TOP + off, dragged to the open side's low corner (or assist). */
function shot(a: Attack, off: number, drag: boolean): Attack {
  const c = a.bodies[a.ctrl];
  if (!pressShoot(a)) return a;
  if (drag) setAim(a, snapAim({ x: openSide(a, c).side * 0.95, y: -0.85 }));
  const hold = Math.max(1, Math.round((TOP + off) * 60));
  for (let i = 0; i < hold && a.meter && !a.end; i++) step(a, 1 / 60, { x: 0, y: 1 });
  if (a.meter) releaseShoot(a, null);
  for (let i = 0; i < 60 * 8 && !a.end && !(a.lastShot && a.lastShot.cross); i++) step(a, 1 / 60, { x: 0, y: 0 });
  return a;
}
const gaussian = (i: number) => (((i * 7919) % 13) - 6) / 6;

describe('aim assist and the drag', () => {
  it('assist picks the side the keeper leaves open, low, deterministically', () => {
    const a = setupAttack('build', squad(), squad(), 'assist', { side: 1 });
    kickOff(a);
    const c = a.bodies[a.ctrl];
    c.x = GX;
    c.y = PL - 16;
    const gk = keeperOf(a);
    gk.x = GX - 1.5;
    gk.y = PL - 1;
    const r1 = assistAim(a, c);
    expect(r1.x).toBeGreaterThan(0.4);
    expect(r1.y).toBeLessThan(0);
    expect(assistAim(a, c)).toEqual(r1);
    gk.x = GX + 1.5;
    expect(assistAim(a, c).x).toBeLessThan(-0.4);
    // it keeps its side while the keeper's near the middle (no flicker), switches when the other opens
    gk.x = GX + 0.05;
    expect(Math.sign(assistAim(a, c, { x: 0.8, y: -0.75 }).x)).toBe(1);
    gk.x = GX + 2;
    expect(Math.sign(assistAim(a, c, { x: 0.8, y: -0.75 }).x)).toBe(-1);
    // a finisher's assist goes nearer the post than a poor one's from the same spot
    const fine = assistAim(a, { ...c, p: player('ST', 95) });
    const poor = assistAim(a, { ...c, p: player('ST', 50) });
    expect(Math.abs(fine.x)).toBeGreaterThan(Math.abs(poor.x));
  });
  it('the drag snaps gently toward the corners, stays in range and is deterministic', () => {
    for (const v of [
      { x: 0.7, y: -0.6 },
      { x: -0.95, y: 0.9 },
      { x: 0.1, y: 0 },
      { x: 3, y: -3 },
    ]) {
      const s = snapAim(v);
      expect(snapAim(v)).toEqual(s);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(1);
    }
    // near a corner it moves toward it; far from one it's left alone
    expect(Math.abs(snapAim({ x: 0.7, y: 0 }).x - 0.85)).toBeLessThan(Math.abs(0.7 - 0.85));
    expect(snapAim({ x: 0.1, y: 0 }).x).toBeCloseTo(0.1, 6);
  });
});

describe('timing: the closer to the green, the truer', () => {
  it('the cone grows smoothly with the distance from the green (no step at its edge)', () => {
    const g = 0.05;
    let prev = 0;
    for (let off = 0; off <= 0.4; off += 0.005) {
      const k = coneMult(off, g);
      expect(k).toBeGreaterThanOrEqual(prev);
      expect(coneMult(-off, g)).toBeCloseTo(k, 9);
      prev = k;
    }
    expect(coneMult(0, g)).toBeCloseTo(0.5, 9);
    expect(Math.abs(coneMult(g + 1e-4, g) - coneMult(g - 1e-4, g))).toBeLessThan(0.01);
    expect(coneMult(10, g)).toBeLessThanOrEqual(3.2);
    expect(timingWord(0, g)).toBe('PERFECT');
    expect(timingWord(0.08, g)).toBe('GOOD');
    expect(timingWord(-0.2, g)).toBe('EARLY');
    expect(timingWord(0.2, g)).toBe('LATE');
    expect(timingMiss(0.1, g)).toBeCloseTo(2, 9);
  });
  it('miss distance and goal rate are monotone in |release − green|', () => {
    const g = greenHalf(player('ST', 75));
    const levels = [0, 1.5, 3, 5];
    const miss: number[] = [];
    const goals: number[] = [];
    for (const u of levels) {
      let m = 0;
      let n = 0;
      // no keeper (out of the picture): how far from its aim it crosses the line
      for (let i = 0; i < 70; i++) {
        const a = oneOnOne(squad(75), squad(75), 'tm' + i, i);
        const gk = keeperOf(a);
        gk.x = -40;
        gk.stunUntil = 1e9;
        shot(a, (i % 2 ? 1 : -1) * u * g, true);
        const s = a.lastShot;
        if (s?.cross) {
          m += Math.hypot(s.cross.x - s.aim.x, s.cross.h - s.aim.h);
          n++;
        }
      }
      miss.push(m / Math.max(1, n));
      goals.push(rate(120, (i) => shot(oneOnOne(squad(75), squad(75), 'tg' + i, i), (i % 2 ? 1 : -1) * u * g, true).end?.kind === 'G'));
    }
    for (let k = 1; k < levels.length; k++) {
      expect(miss[k], 'miss ' + miss.map((x) => x.toFixed(2))).toBeGreaterThan(miss[k - 1]);
      expect(goals[k], 'goals ' + goals.map((x) => x.toFixed(2))).toBeLessThanOrEqual(goals[k - 1] + 0.04);
    }
    expect(goals[0]).toBeGreaterThan(goals[levels.length - 1] + 0.12);
  });
});

describe('ratings still decide', () => {
  const finish = (att: Squad, def: Squad, tag: string, drag = true) =>
    rate(150, (i) => shot(oneOnOne(att, def, tag + i, i), gaussian(i) * 0.06, drag).end?.kind === 'G');
  it('a better finisher scores more one on one; aim assist too', () => {
    const at = (sho: number) => squad(75, { fwd: { SHO: sho }, mid: { SHO: sho } });
    const lo = finish(at(55), squad(75), 'sho55-');
    const mid = finish(at(75), squad(75), 'sho75-');
    const hi = finish(at(95), squad(75), 'sho95-');
    expect(mid).toBeGreaterThan(lo + 0.05);
    expect(hi).toBeGreaterThan(mid);
    expect(hi).toBeGreaterThan(lo + 0.12);
    // the assist (no drag) is a fair shot, not a giveaway: between a poor and an elite finisher's aimed
    const assisted = finish(at(75), squad(75), 'sho75-', false);
    expect(assisted).toBeGreaterThan(0.3);
    expect(assisted).toBeLessThan(0.75);
  });
  it('a better keeper concedes fewer of the same chances', () => {
    const keeper = (v: number) => squad(75, { gk: { DIV: v, HAN: v, REF: v, POS: v, SPD: v } });
    const weak = finish(squad(75), keeper(52), 'gk-');
    const avg = finish(squad(75), keeper(75), 'gk-');
    const elite = finish(squad(75), keeper(93), 'gk-');
    expect(weak).toBeGreaterThan(avg + 0.08);
    expect(avg).toBeGreaterThan(elite + 0.08);
  });
});

describe('free passing', () => {
  /** A build-up with the defenders out of the way, the carrier on the ball. */
  const open = (seed: string) => {
    const a = setupAttack('build', squad(), squad(), seed, { side: 1 });
    kickOff(a);
    for (const b of a.bodies) if (b.side === 'D') b.stunUntil = 1e9;
    return a;
  };
  it('goes the stick way: a gentle pull to a man near that way, none to a man well off it', () => {
    const a = open('fp1');
    const c = a.bodies[a.ctrl];
    const to = a.bodies.find((b) => b.slot === 'ST')!;
    const base = Math.atan2(to.x - c.x, to.y - c.y);
    const at = (deg: number) => ({ x: Math.sin(base + (deg * Math.PI) / 180), y: Math.cos(base + (deg * Math.PI) / 180) });
    const near = passPlan(a, 'ground', at(4))!;
    expect(near.to?.id).toBe(to.id);
    expect(near.w).toBeGreaterThan(0.9);
    expect(passPlan(a, 'ground', at(4))).toEqual(near);
    const edge = passPlan(a, 'ground', at(16))!;
    if (edge.to?.id === to.id) expect(edge.w).toBeLessThan(near.w);
    // well off anyone: it goes into space along the stick (no lock-on)
    const away = { x: -Math.cos(base), y: Math.sin(base) };
    const free = passPlan(a, 'ground', away)!;
    const v = { x: free.spot.x - a.ball.x, y: free.spot.y - a.ball.y };
    const cos = (v.x * away.x + v.y * away.y) / Math.hypot(v.x, v.y);
    // into space dead along the stick; or (a teammate inside the cone) bent at most the cone's width
    if (free.to === null) expect(cos).toBeGreaterThan(0.999);
    else expect(cos).toBeGreaterThan(Math.cos((PASS_ASSIST.ground * Math.PI) / 180) - 1e-6);
  });
  it('a receiver whose stick is still held the way of the pass runs onto it', () => {
    let got = 0;
    for (let i = 0; i < 20; i++) {
      const a = open('fp-r' + i);
      const c = a.bodies[a.ctrl];
      const to = a.bodies.find((b) => b.slot === (i % 2 ? 'LW' : 'RCM'))!;
      const dir = { x: to.x - c.x, y: to.y - c.y };
      const l = Math.hypot(dir.x, dir.y);
      const d = { x: dir.x / l, y: dir.y / l };
      const plan = passPlan(a, 'lofted', d)!;
      pass(a, 'lofted', d, true);
      // he gets to it (his first touch is DRI's business, a hard ball can still get away from him)
      let near = Infinity;
      for (let k = 0; k < 60 * 4 && !a.end; k++) {
        step(a, 1 / 60, d);
        if (plan.to) near = Math.min(near, Math.hypot(plan.to.x - a.ball.x, plan.to.y - a.ball.y));
        if (k > 10 && a.ball.owner !== null) break;
      }
      if (plan.to && near < 1) got++;
    }
    expect(got).toBeGreaterThanOrEqual(18);
  });
  it('a weak passer misses his man more than a strong one (direction and weight)', () => {
    const spread = (pas: number) => {
      let sum = 0;
      for (let i = 0; i < 60; i++) {
        const a = setupAttack('build', squad(75, { mid: { PAS: pas } }), squad(75), 'fpw' + i, { side: 1 });
        kickOff(a);
        for (const b of a.bodies) if (b.side === 'D') b.stunUntil = 1e9;
        const c = a.bodies[a.ctrl];
        const to = a.bodies.find((b) => b.slot === 'LW')!;
        const plan = passPlan(a, 'ground', { x: to.x - c.x, y: to.y - c.y })!;
        pass(a, 'ground', { x: to.x - c.x, y: to.y - c.y }, true);
        for (let k = 0; k < 12; k++) step(a, 1 / 60, { x: 0, y: 0 });
        const want = Math.atan2(plan.spot.x - c.x, plan.spot.y - c.y);
        sum += Math.abs(Math.atan2(a.ball.vx, a.ball.vy) - want);
      }
      return sum / 60;
    };
    expect(spread(95)).toBeLessThan(spread(45) * 0.6);
  });
});

describe('the shootout with the new aim', () => {
  it('a kick dragged to a corner goes that way; the assist picks a side; both finish', () => {
    let left = 0;
    for (let i = 0; i < 12; i++) {
      const so = newShootout(squad(80), squad(80), 'so-aim' + i);
      const a = kickAttack(so);
      kickOff(a);
      for (let k = 0; k < 40; k++) step(a, 1 / 60, { x: 0, y: 0 });
      expect(pressShoot(a)).toBe(true);
      setAim(a, snapAim({ x: -0.9, y: -0.8 }));
      for (let k = 0; k < Math.round(TOP * 60); k++) step(a, 1 / 60, { x: 0, y: 0 });
      releaseShoot(a, null);
      for (let k = 0; k < 600 && !a.end; k++) step(a, 1 / 60, { x: 0, y: 0 });
      expect(a.end).not.toBeNull();
      expect(a.lastShot?.kind).toBe('pen');
      expect(a.lastShot?.assisted).toBe(false);
      if (a.lastShot!.aim.x < GX - 2) left++;
    }
    expect(left).toBe(12);
  });
});
