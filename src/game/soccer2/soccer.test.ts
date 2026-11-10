// Arcade soccer engine (Claude, 2026-11-01): physics, determinism, rating effects over seeded
// attacks, whole matches on the autopilot, penalties, and no NaN or endless attacks.
import cardsText from '../../data/cards-soccer.json?raw';
import { describe, expect, it } from 'vitest';
import { autoplayAttack, decide, pilot } from './autopilot';
import { groundSpeedFor, GX, kickOff, loftVelocity, pass, PL, pressShoot, releaseShoot, setupAttack, shotVelocity, step, stepBall, TOP, tracePath } from './engine';
import { autoplayMatch, dealOf, newMatch, recordAttack, totalOf } from './match';
import { clubSquad, gkDive, gkReaction, greenHalf, passError, rateSoccerLine, rt, shotCone, soccerLines, squadFrom, tackleWin, topSpeed, type SoccerCardsFile } from './ratings';
import { newShootout, recordKick, simShootout, score, takers } from './shootout';
import type { Attack, Ball, Scenario, SoccerPlayer, SoccerPos, Squad } from './types';

const OUT = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
const GK = ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'];
let uid = 0;
function player(pos: SoccerPos, v = 75, over: Record<string, number> = {}): SoccerPlayer {
  const keeper = pos === 'GK';
  const a: Record<string, number> = Object.fromEntries((keeper ? GK : OUT).map((k) => [k, v]));
  Object.assign(a, over);
  const id = 'p' + uid++;
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
const ball = (o: Partial<Ball>): Ball => ({ x: 34, y: 50, h: 0, vx: 0, vy: 0, vh: 0, curl: 0, dip: 0, owner: null, last: null, flight: null, ...o });
const finite = (a: Attack) => a.bodies.every((b) => [b.x, b.y, b.vx, b.vy, b.h].every(Number.isFinite)) && [a.ball.x, a.ball.y, a.ball.h, a.ball.vx, a.ball.vy, a.ball.vh].every(Number.isFinite);

describe('ball physics', () => {
  it('a lofted ball comes down, bounces lower and comes to rest', () => {
    const b = ball({ vx: 0, vy: 12, vh: 8 });
    let peak = 0;
    let landed = -1;
    for (let i = 0; i < 60 * 12; i++) {
      stepBall(b, 1 / 60);
      peak = Math.max(peak, b.h);
      if (landed < 0 && i > 5 && b.h === 0) landed = i;
    }
    expect(peak).toBeGreaterThan(2.5);
    expect(peak).toBeLessThan(8 * 8 / (2 * 9.81) + 0.01);
    expect(landed).toBeGreaterThan(0);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(0.05);
    expect(b.h).toBe(0);
  });
  it('a pass along the grass covers the distance it was hit for', () => {
    for (const d of [8, 15, 25, 35]) {
      const v0 = groundSpeedFor(d, 6);
      const b = ball({ vy: v0 });
      let t = 0;
      while (b.y - 50 < d && t < 10) {
        stepBall(b, 1 / 240);
        t += 1 / 240;
      }
      expect(Math.abs(Math.hypot(b.vx, b.vy) - 6)).toBeLessThan(0.6);
    }
  });
  it('a lofted pass lands near its target; a shot crosses the line at its aim', () => {
    const from = { x: 10, y: 70 };
    const to = { x: 34, y: 95 };
    const v = loftVelocity(from, to, 1.4);
    const path = tracePath(ball({ ...from, ...v }), 4);
    const land = path.find((q, i) => i > 3 && q.h <= 0.05 && path[i - 1].h > q.h)!;
    expect(Math.hypot(land.x - to.x, land.y - to.y)).toBeLessThan(1.5);
    const s = shotVelocity({ x: 30, y: 85, h: 0.11 }, 36, 1.5, 26);
    const sp = tracePath(ball({ x: 30, y: 85, h: 0.11, ...s }), 3);
    const cross = sp.find((q) => q.y >= PL)!;
    expect(Math.abs(cross.x - 36)).toBeLessThan(0.3);
    expect(Math.abs(cross.h - 1.5)).toBeLessThan(0.3);
  });
  it('spin bends the ball: positive curl to the left of its travel', () => {
    const left = tracePath(ball({ vy: 25, vh: 3, curl: 0.25 }), 1);
    const straight = tracePath(ball({ vy: 25, vh: 3 }), 1);
    expect(left[left.length - 1].x).toBeLessThan(straight[straight.length - 1].x - 1);
  });
});

describe('ratings', () => {
  it('every card line rates to finite, bounded players; elevens build from real clubs', () => {
    const f = JSON.parse(cardsText) as SoccerCardsFile;
    const { seasons, specials } = soccerLines(f);
    expect(seasons.length).toBe(f.n);
    let bad = 0;
    for (const l of [...seasons, ...specials]) {
      const p = rateSoccerLine(l);
      const nums = [topSpeed(p), passError(p), shotCone(p), greenHalf(p), ...Object.values(p.a)];
      if (!nums.every(Number.isFinite)) bad++;
      if (topSpeed(p) < 5 || topSpeed(p) > 10) bad++;
    }
    expect(bad).toBe(0);
    const bar = clubSquad(seasons, 'BAR', 2015);
    expect(bar.fwd.map((p) => p.name)).toContain('Lionel Messi');
    expect(bar.gk.keeper).toBe(true);
    expect(new Set([bar.gk, ...bar.def, ...bar.mid, ...bar.fwd].map((p) => p.id)).size).toBe(11);
  });
  it('effects run the right way, stay bounded, and stay finite above 99', () => {
    const at = (k: string, v: number) => player('W', 75, { [k]: v });
    expect(topSpeed(at('PAC', 95))).toBeGreaterThan(topSpeed(at('PAC', 60)) + 1.2);
    expect(topSpeed(at('PAC', 40))).toBeCloseTo(6.8, 5);
    expect(topSpeed(at('PAC', 99))).toBeCloseTo(9.4, 5);
    expect(passError(at('PAS', 40))).toBeCloseTo(7, 5);
    expect(passError(at('PAS', 99))).toBeCloseTo(1.5, 5);
    expect(shotCone(at('SHO', 95))).toBeLessThan(shotCone(at('SHO', 55)) / 2);
    expect(greenHalf(at('SHO', 95))).toBeGreaterThan(greenHalf(at('SHO', 55)) * 1.8);
    const k = (v: number) => player('GK', v);
    expect(gkReaction(k(92))).toBeLessThan(gkReaction(k(55)));
    expect(gkDive(k(92)).reach).toBeGreaterThan(gkDive(k(55)).reach + 0.5);
    expect(tackleWin(player('CB', 90), player('W', 60), false, 0)).toBeGreaterThan(0.75);
    expect(tackleWin(player('CB', 60), player('W', 90), false, 0)).toBeLessThan(0.25);
    expect(tackleWin(player('CB', 99), player('W', 1), false, 1)).toBeLessThanOrEqual(0.9);
    // a promo past 99: a little more, never runaway
    const hi = at('PAC', 130);
    expect(Number.isFinite(topSpeed(hi))).toBe(true);
    expect(topSpeed(hi)).toBeGreaterThan(topSpeed(at('PAC', 99)));
    expect(topSpeed(hi)).toBeLessThan(9.4 + 0.3);
    expect(rt(Infinity)).toBeLessThan(1.2);
    expect(rt(NaN)).toBeGreaterThan(0);
    expect(passError(player('CM', 130))).toBeGreaterThan(0.4);
  });
});

/** A clean look at goal: the carrier on the edge of the box, the outfield defenders sent away. */
function shootingDrill(att: Squad, def: Squad, seed: string, x: number, y: number): Attack {
  const a = setupAttack('build', att, def, seed, { side: 1 });
  kickOff(a);
  const c = a.bodies[a.ctrl];
  c.x = x;
  c.y = y;
  c.fx = 0;
  c.fy = 1;
  for (const b of a.bodies) if (b.side === 'D' && b.role === 'def') ((b.x = b.x < GX ? 2 : 66), (b.y = 40), (b.stunUntil = 1e9));
  for (let i = 0; i < 30; i++) step(a, 1 / 60, { x: 0, y: 0 });
  return a;
}
/** Shoot with this timing (seconds off the green's centre) and let the shot play out. */
function shoot(a: Attack, off: number, aim: { x: number; y: number } | null): Attack {
  pressShoot(a);
  const hold = Math.round((TOP + off) * 60);
  for (let i = 0; i < hold; i++) step(a, 1 / 60, { x: 0, y: 0 });
  releaseShoot(a, aim);
  for (let i = 0; i < 60 * 40 && !a.end; i++) step(a, 1 / 60, { x: 0, y: 0 });
  return a;
}
const rate = (n: number, f: (i: number) => boolean) => {
  let k = 0;
  for (let i = 0; i < n; i++) if (f(i)) k++;
  return k / n;
};

describe('ratings decide attacks', () => {
  it('a fast winger outruns the men chasing him back (caught less often, further up the pitch)', () => {
    const run = (pac: number) => {
      let caught = 0;
      let gain = 0;
      const n = 30;
      for (let s = 0; s < n; s++) {
        const att = squad(75, { fwd: { PAC: pac, DRI: 75 } });
        const def = squad(75, { mid: { PAC: 76 }, def: { PAC: 76 } });
        const a = setupAttack('counter', att, def, 'race' + s, { side: 1 });
        kickOff(a);
        // the centre-backs are out of it: a straight race with the midfielders chasing back
        for (const b of a.bodies) if (b.slot === 'RCB' || b.slot === 'LCB') ((b.x = 2), (b.y = 40), (b.stunUntil = 1e9));
        const c = a.bodies[a.ctrl];
        // the holding midfielder three metres behind him, already running
        const dm = a.bodies.find((b) => b.slot === 'DM')!;
        dm.x = c.x + 1;
        dm.y = c.y - 3;
        dm.vy = 6.2;
        const y0 = c.y;
        let got = false;
        for (let i = 0; i < 60 * 4 && !a.end && !got; i++) {
          a.sprinting = true;
          step(a, 1 / 60, { x: 0, y: 1 });
          for (const b of a.bodies) if (b.side === 'D' && b.role === 'def' && Math.hypot(b.x - c.x, b.y - c.y) < 1.2) got = true;
        }
        if (got || a.end) caught++;
        gain += c.y - y0;
      }
      return { caught: caught / n, gain: gain / n };
    };
    const fast = run(95);
    const slow = run(58);
    expect(fast.caught).toBeLessThan(slow.caught - 0.3);
    expect(fast.gain).toBeGreaterThan(slow.gain + 3);
  });
  it('a good finisher scores more from the same chances (wider green, tighter cone)', () => {
    const goals = (sho: number) =>
      rate(160, (i) => {
        const att = squad(75, { fwd: { SHO: sho }, mid: { SHO: sho } });
        // a little human timing error around the green
        const off = ((i % 9) - 4) * 0.022;
        const a = shoot(shootingDrill(att, squad(75), 'fin' + i, 26 + (i % 5) * 4, 84), off, { x: (i % 2 ? 1 : -1) * 0.9, y: -0.3 });
        return a.end?.kind === 'G';
      });
    const elite = goals(95);
    const poor = goals(55);
    expect(elite).toBeGreaterThan(poor + 0.12);
  });
  it('an elite keeper saves more of the same shots', () => {
    const saved = (v: number) =>
      rate(160, (i) => {
        const a = shoot(shootingDrill(squad(80), squad(75, { gk: { DIV: v, HAN: v, REF: v, POS: v, SPD: v } }), 'gk' + i, 26 + (i % 5) * 4, 86), 0, { x: (i % 3) - 1, y: i % 2 ? -0.6 : 0.3 });
        return a.end?.kind === 'S';
      });
    const elite = saved(93);
    const poor = saved(52);
    expect(elite).toBeGreaterThan(poor + 0.12);
  });
  it('a strong passer is more accurate (less miss at the receiver)', () => {
    const miss = (pas: number) => {
      let sum = 0;
      const n = 80;
      for (let i = 0; i < n; i++) {
        const att = squad(75, { mid: { PAS: pas } });
        const a = setupAttack('build', att, squad(75), 'pass' + i, { side: 1 });
        kickOff(a);
        for (const b of a.bodies) if (b.side === 'D') b.stunUntil = 1e9;
        const c = a.bodies[a.ctrl];
        const to = a.bodies.find((b) => b.slot === 'LW')!;
        pass(a, 'ground', { x: to.x - c.x, y: to.y - c.y });
        for (let k = 0; k < 12; k++) step(a, 1 / 60, { x: 0, y: 0 });
        const v = Math.atan2(a.ball.vx, a.ball.vy);
        const want = Math.atan2(to.x - c.x, to.y - c.y);
        sum += Math.abs(v - want);
      }
      return sum / n;
    };
    expect(miss(95)).toBeLessThan(miss(50) * 0.55);
  });
  it('better teams score more over seeded matches', () => {
    const goals = (v: number) => {
      let g = 0;
      for (let s = 0; s < 6; s++) g += autoplayMatch(newMatch(squad(v), squad(72), 'm' + v + ':' + s), 0.75).goals;
      return g;
    };
    expect(goals(90)).toBeGreaterThan(goals(60));
  });
});

describe('determinism and safety', () => {
  it('the same seed and inputs replay exactly', () => {
    const A = squad(80);
    const B = squad(78);
    const run = (seed: string) => {
      const a = setupAttack('build', A, B, seed);
      autoplayAttack(a, 0.7, 'p' + seed);
      return JSON.stringify({ end: a.end, x: a.ball.x, y: a.ball.y, t: a.t, ctrl: a.ctrl });
    };
    expect(run('d1')).toBe(run('d1'));
    expect(run('d2')).toBe(run('d2'));
    expect(new Set(['d1', 'd2', 'd3', 'd4'].map(run)).size).toBeGreaterThan(1);
  });
  it('every scenario ends, every value finite, no endless attacks', () => {
    const kinds: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick', 'penalty'];
    const seen = new Set<string>();
    for (const sc of kinds)
      for (let i = 0; i < 25; i++) {
        const a = setupAttack(sc, squad(60 + (i % 5) * 8), squad(70 + (i % 3) * 8), sc + i, { defIQ: (i % 3) - 0.5 });
        autoplayAttack(a, (i % 4) / 3, 'q' + i);
        expect(a.end, sc + i).not.toBeNull();
        expect(finite(a), sc + i).toBe(true);
        // within its clock and a little more for set pieces and shots in the air (studio overhaul
        // soccer-1: this allowed the 120 s hard stop, which a dead "shot" used to hang on: R-1)
        expect(a.t, sc + i).toBeLessThan(a.clock + 15);
        seen.add(a.end!.kind);
      }
    expect([...seen].every((k) => 'GSWBLOT'.includes(k))).toBe(true);
    expect(seen.has('G')).toBe(true);
    expect(seen.has('S')).toBe(true);
  });
  it('an attack the human leaves alone runs out of time (or is lost), never hangs', () => {
    const a = setupAttack('build', squad(75), squad(75), 'idle');
    kickOff(a);
    for (let i = 0; i < 60 * 200 && !a.end; i++) step(a, 1 / 60, { x: 0, y: 0 });
    expect(a.end).not.toBeNull();
    expect(['T', 'L']).toContain(a.end!.kind);
  });
  it('the autopilot completes whole matches: six attacks, stoppage time, valid ends', () => {
    const m = autoplayMatch(newMatch(squad(85), squad(80), 'full'), 0.8);
    expect(m.over).toBe(true);
    expect(m.ends.length).toBe(totalOf(m));
    expect(m.goals).toBe(m.ends.filter((e) => e === 'G').length);
    expect(dealOf('x').length).toBe(7);
    expect(new Set(dealOf('x').slice(0, 6))).toEqual(new Set(['build', 'counter', 'wide', 'corner', 'freekick']));
    // a match recorded twice doesn't count past its end
    const a = setupAttack('build', squad(80), squad(80), 'extra');
    autoplayAttack(a, 0.5, 'x');
    recordAttack(m, a);
    expect(m.ends.length).toBe(totalOf(m));
  });
  it('the human controls run straight through the engine: a stick moves the man both ways', () => {
    const a = setupAttack('build', squad(80), squad(80), 'stick', { side: 1 });
    kickOff(a);
    for (const b of a.bodies) if (b.side === 'D') b.stunUntil = 1e9;
    const c = a.bodies[a.ctrl];
    const y0 = c.y;
    for (let i = 0; i < 60; i++) step(a, 1 / 60, { x: 0, y: 1 });
    expect(c.y - y0).toBeGreaterThan(3);
    const x0 = c.x;
    for (let i = 0; i < 60; i++) step(a, 1 / 60, { x: -1, y: 0 });
    expect(c.x).toBeLessThan(x0 - 2);
    for (let i = 0; i < 40; i++) step(a, 1 / 60, { x: 0, y: 0 });
    expect(Math.hypot(c.vx, c.vy)).toBeLessThan(0.3);
  });
});

describe('penalties', () => {
  it('stops as soon as one side cannot catch up, and plays sudden death', () => {
    const so = newShootout(squad(80), squad(80), 's');
    for (const [us, them] of [
      [true, false],
      [true, false],
      [true, false],
    ])
      recordKick(recordKick(so, us), them);
    expect(so.done).toBe(true);
    expect(so.winner).toBe('us');
    expect(score(so)).toEqual({ us: 3, them: 0, usTaken: 3, themTaken: 3 });
    const sd = newShootout(squad(80), squad(80), 'sd');
    for (let i = 0; i < 5; i++) recordKick(recordKick(sd, true), true);
    expect(sd.done).toBe(false);
    recordKick(sd, false);
    expect(sd.done).toBe(false);
    recordKick(sd, true);
    expect(sd.done).toBe(true);
    expect(sd.winner).toBe('them');
    // the best finishers step up first, the keeper last
    const t = takers(squad(80, { fwd: { SHO: 95 } }));
    expect(t[0].pos === 'W' || t[0].pos === 'ST').toBe(true);
    expect(t[t.length - 1].keeper).toBe(true);
  });
  it('simulated shootouts always finish with a winner, deterministically', () => {
    for (let i = 0; i < 6; i++) {
      const a = simShootout(squad(82), squad(80), 'pk' + i);
      const b = simShootout(squad(82), squad(80), 'pk' + i);
      expect(a.done).toBe(true);
      expect(a.winner).not.toBeNull();
      expect(a.kicks.map((k) => k.scored)).toEqual(b.kicks.map((k) => k.scored));
    }
  });
  it('the AI pilot takes set pieces and penalties on its own', () => {
    const a = setupAttack('penalty', squad(85), squad(80), 'pen');
    const pl = pilot(0.8, 'pen');
    kickOff(a);
    for (let i = 0; i < 600 && !a.end; i++) step(a, 1 / 60, decide(a, pl));
    expect(a.lastShot?.kind).toBe('pen');
    expect(['G', 'S', 'W']).toContain(a.end?.kind);
  });
});

/** A real squad from the cards keeps working (squadFrom with gaps falls back). */
it('squadFrom fills a short-handed club from nearby positions', () => {
  const ps = [player('GK'), player('CB'), player('CB'), player('CB'), player('ST'), player('ST'), player('W'), player('CM'), player('CM'), player('DM'), player('AM'), player('FB')];
  const s = squadFrom(ps, { name: 'X', abbr: 'X', c1: '#000000', c2: '#ffffff' });
  expect([s.gk, ...s.def, ...s.mid, ...s.fwd].length).toBe(11);
});
