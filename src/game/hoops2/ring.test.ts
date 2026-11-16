// The gold ring in the NBA engine (nba-4; plan §3.3 and §4.4): the closed-form gold and make rates
// a median (σ 50 ms) and a skilled (σ 35 ms) release get, the range gate, the states, On Fire through
// windowScale, the honesty rule (a release in gold is a make, never blocked) and the release timed
// from the touch itself. Closed form: every rate integrates the engine's own make chance over the
// Gaussian release (no sampling).
import { rng } from '../../engine/rng';
import { gameTimeAt, goldBase } from '../perfect';
import { ARC_STEP, greenWindow, newPossession, pressShoot, rangeFt, releaseProbability, releaseShoot, RIM, ringState, step } from './engine';
import { afterPossession, newHoopsGame, startPossession } from './game';
import type { Body, Contest, Hooper, Meter, Possession, ShotKind } from './types';

function man(v: number, extra: Partial<Hooper> = {}): Hooper {
  return { id: 'x' + v, name: 'X ' + v, tag: 'X', num: 1, ht: 78, wt: 215, pos: 'SG', ovr: v, spd: 75, acc: 75, hnd: 75, pas: 75, thr: v, mid: v, cls: v, lay: v, ft: v, ddk: 60, sdk: 60, str: 70, vrt: 70, sta: 80, prd: 75, ind: 70, stl: 70, blk: 60, reb: 60, abil: [], ...extra };
}
const five = (h: Hooper) => [h, man(75), man(75), man(75), man(75)];

/** A shooter `ft` from the rim straight out, the defense parked far away. */
function poss(shooter: Hooper, ft: number, defIQ = 0): Possession {
  const p = newPossession(five(shooter), five(man(75)), [1, 1, 1, 1, 1], rng(1), defIQ);
  const b = p.bodies[0];
  Object.assign(b, { cx: RIM.cx - ft, cz: 0, vx: 0, vz: 0 });
  for (const d of p.bodies) if (d.side === 'D') Object.assign(d, { cx: -5, cz: 20 });
  for (const o of p.bodies) if (o.side === 'O' && o !== b) Object.assign(o, { cx: 5, cz: -20 });
  return p;
}

/** ∫ f(off) φ(off; bias, σ) d off on a 0.25 ms grid out to ±6σ. */
function integrate(sd: number, f: (off: number) => number, bias = 0): number {
  let s = 0;
  let m = 0;
  for (let x = -6 * sd; x <= 6 * sd + 1e-12; x += 0.00025) {
    const w = Math.exp(-(x * x) / (2 * sd * sd));
    s += w * f(x + bias);
    m += w;
  }
  return s / m;
}

/** A person's gold rate and make rate on this shot (σ seconds), gold only counted on a gold ring. */
function rates(p: Possession, kind: ShotKind, contest: Contest, sd: number, style: Meter['style'] = 'set', bias = 0) {
  const b = p.bodies[0];
  const w = greenWindow(p, b, kind, contest, style);
  const gold = ringState(p, b, kind, contest).state === 'gold';
  return {
    half: w * 1000,
    gold: gold ? integrate(sd, (off) => (Math.abs(off) <= w ? 1 : 0), bias) : 0,
    make: integrate(sd, (off) => releaseProbability(p, b, kind, contest, off, w, style), bias)
  };
}

const THR_AVG = 73;

describe('NBA gold ring: the closed-form rates at σ 50 ms (plan §3.3)', () => {
  const cases: [string, number, number, ShotKind, Contest, [number, number] | null, [number, number] | null, number | null][] = [
    // name, rating, feet, kind, contest, gold band at σ50, make band at σ50, make ceiling at σ35
    ['THR 55 open (a mid-range jumper, in his 16 ft range)', 55, 15, 'mid', 'open', [0.4, 0.5], null, null],
    ['THR_avg open three', THR_AVG, 24, 'three', 'open', [0.55, 0.65], null, 0.8],
    ['THR 95 open three', 95, 24, 'three', 'open', [0.7, 0.8], null, 0.92],
    ['THR_avg light three', THR_AVG, 24, 'three', 'light', [0.42, 0.52], null, null],
    ['THR_avg heavy three (amber)', THR_AVG, 24, 'three', 'heavy', [0, 0], [0.22, 0.3], 0.34],
    ['smothered three (red)', THR_AVG, 24, 'three', 'smothered', [0, 0], [0, 0.15], 0.15],
    ['THR 99 smothered (red)', 99, 24, 'three', 'smothered', [0, 0], [0, 0.15], 0.15]
  ];
  for (const [name, r, ft, kind, contest, goldBand, makeBand, ceil35] of cases)
    it(name, () => {
      const p = poss(man(r), ft);
      const at50 = rates(p, kind, contest, 0.05);
      if (goldBand) {
        expect(at50.gold).toBeGreaterThanOrEqual(goldBand[0]);
        expect(at50.gold).toBeLessThanOrEqual(goldBand[1]);
      }
      if (makeBand) {
        expect(at50.make).toBeGreaterThanOrEqual(makeBand[0]);
        expect(at50.make).toBeLessThanOrEqual(makeBand[1]);
      } else {
        // open and light: gold is a make, and off the gold adds little (≤ 8 points; ≤ 6 for THR 95)
        expect(at50.make).toBeGreaterThanOrEqual(at50.gold - 1e-9);
        expect(at50.make - at50.gold).toBeLessThanOrEqual(r >= 95 ? 0.06 : 0.08);
      }
      if (ceil35 !== null) expect(rates(p, kind, contest, 0.035).make).toBeLessThanOrEqual(ceil35);
    });

  it('the half-widths follow goldBase: 30 / 42 / 57 ms at THR 55 / THR_avg / 95, light ×0.75', () => {
    expect(rates(poss(man(55), 15), 'mid', 'open', 0.05).half).toBeCloseTo(goldBase(55), 6);
    expect(rates(poss(man(THR_AVG), 24), 'three', 'open', 0.05).half).toBeCloseTo(goldBase(THR_AVG), 6);
    expect(rates(poss(man(95), 24), 'three', 'open', 0.05).half).toBeCloseTo(goldBase(95), 6);
    expect(rates(poss(man(THR_AVG), 24), 'three', 'light', 0.05).half).toBeCloseTo(goldBase(THR_AVG) * 0.75, 6);
  });

  it('a pull-up makes at most 0.90 × the catch-and-shoot (×0.88 window, 10 ms later, a steeper miss)', () => {
    const p = poss(man(THR_AVG), 24);
    const cs = rates(p, 'three', 'open', 0.05).make;
    // the person releases on his usual rhythm, 10 ms before the pull-up's later centre
    const pu = rates(p, 'three', 'open', 0.05, 'pullup', -0.01).make;
    const puCentred = rates(p, 'three', 'open', 0.05, 'pullup').make;
    expect(pu / cs).toBeLessThanOrEqual(0.9);
    expect(puCentred / cs).toBeLessThanOrEqual(0.9);
  });

  it('a better shooter makes more at every contest, and above 99 stays finite', () => {
    for (const c of ['open', 'light', 'heavy', 'smothered'] as Contest[]) {
      let last = -1;
      for (const r of [60, 70, 80, 90, 99, 110]) {
        const v = rates(poss(man(r), 22), 'three', c, 0.05).make;
        expect(Number.isFinite(v)).toBe(true);
        expect(v + 1e-9).toBeGreaterThanOrEqual(last);
        last = v;
      }
    }
  });
});

describe('NBA gold ring: states and the range gate', () => {
  it('range by THR: 27.75 ft at 85+, 25.75 at 70-84, the arc (and the step behind it) at 60-69, 16 ft under 60', () => {
    expect([rangeFt(99), rangeFt(85), rangeFt(84), rangeFt(70), rangeFt(69), rangeFt(60), rangeFt(59)]).toEqual([27.75, 27.75, 25.75, 25.75, 23.75 + ARC_STEP, 23.75 + ARC_STEP, 16]);
    const st = (thr: number, ft: number, c: Contest = 'open') => {
      const p = poss(man(thr), ft);
      return ringState(p, p.bodies[0], ft > 23.75 ? 'three' : 'mid', c);
    };
    expect(st(90, 27).state).toBe('gold');
    expect(st(75, 27)).toMatchObject({ state: 'amber', dial: 'RANGE' });
    expect(st(65, 23.5).state).toBe('gold');
    expect(st(65, 24.5).state).toBe('gold');
    expect(st(65, 25.5)).toMatchObject({ state: 'amber', dial: 'RANGE' });
    expect(st(55, 15).state).toBe('gold');
    expect(st(55, 18)).toMatchObject({ state: 'amber', dial: 'RANGE' });
    // more than 4 ft past it: red
    expect(st(55, 21)).toMatchObject({ state: 'red', dial: 'RANGE' });
    expect(st(75, 30)).toMatchObject({ state: 'red', dial: 'RANGE' });
    // heavy is amber, smothered red, whatever the range
    expect(st(99, 20, 'heavy')).toMatchObject({ state: 'amber', dial: 'PRESSURE' });
    expect(st(99, 20, 'smothered')).toMatchObject({ state: 'red', dial: 'PRESSURE' });
  });

  it('Legend: a light contest is amber (open stays gold); a finish the same', () => {
    const p = poss(man(80), 22, 1);
    const b = p.bodies[0];
    expect(ringState(p, b, 'three', 'light')).toMatchObject({ state: 'amber', dial: 'PRESSURE' });
    expect(ringState(p, b, 'three', 'open').state).toBe('gold');
    expect(ringState(p, b, 'layup', 'light').state).toBe('amber');
    const pro = poss(man(80), 22, 0);
    expect(ringState(pro, pro.bodies[0], 'three', 'light').state).toBe('gold');
  });

  it('0 gold states on heavy or smothered: 4,000 random spots, ratings, rungs, On Fire or not', () => {
    const r = rng(42);
    let golds = 0;
    for (let i = 0; i < 4000; i++) {
      const p = poss(man(40 + Math.floor(r() * 70)), 1 + r() * 32, -0.5 + r() * 1.5);
      const b = p.bodies[0];
      b.cz = (r() - 0.5) * 40;
      p.heat = r() < 0.5 ? 'fire' : 'cold';
      for (const kind of ['three', 'mid', 'close', 'layup'] as ShotKind[])
        for (const c of ['heavy', 'smothered'] as Contest[]) if (ringState(p, b, kind, c).state === 'gold') golds++;
    }
    expect(golds).toBe(0);
  });

  it('the red ring never makes more than 15%, even timed perfectly', () => {
    for (const r of [60, 80, 99, 110]) {
      const p = poss(man(r, { abil: ['deadeye'] }), 22);
      const w = greenWindow(p, p.bodies[0], 'three', 'smothered');
      expect(releaseProbability(p, p.bodies[0], 'three', 'smothered', 0, w)).toBeLessThanOrEqual(0.15);
      const far = poss(man(r), 34);
      expect(ringState(far, far.bodies[0], 'three', 'open').state).toBe('red');
      expect(releaseProbability(far, far.bodies[0], 'three', 'open', 0, 0.05)).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('NBA gold ring: On Fire through windowScale (game.ts Heat)', () => {
  it('On Fire widens the gold by exactly ×1.25 (under the caps)', () => {
    for (const r of [55, 65, 73, 80]) {
      const p = poss(man(r), 22);
      const b = p.bodies[0];
      const cold = greenWindow(p, b, 'three', 'open', 'set');
      p.heat = 'fire';
      expect(greenWindow(p, b, 'three', 'open', 'set') / cold).toBeCloseTo(1.25, 9);
    }
  });

  it('On Fire turns amber gold only for an uncontested look (range, Legend-light): heavy stays amber, red stays red', () => {
    const deep = poss(man(75), 27);
    deep.heat = 'fire';
    expect(ringState(deep, deep.bodies[0], 'three', 'open').state).toBe('gold');
    expect(ringState(deep, deep.bodies[0], 'three', 'heavy').state).toBe('amber');
    expect(ringState(deep, deep.bodies[0], 'three', 'smothered').state).toBe('red');
    const tooFar = poss(man(75), 31);
    tooFar.heat = 'fire';
    expect(ringState(tooFar, tooFar.bodies[0], 'three', 'open').state).toBe('red');
    const legend = poss(man(75), 22, 1);
    legend.heat = 'fire';
    expect(ringState(legend, legend.bodies[0], 'three', 'light').state).toBe('gold');
  });

  it('the game puts the side On Fire at 100 Heat for two possessions, and the possession carries it', () => {
    const g = newHoopsGame(five(man(80)), five(man(75)), 'heat-game', 16);
    let fired = -1;
    for (let i = 0; i < 6; i++) {
      const p = startPossession(g);
      if (i > 0 && fired >= 0 && i - fired <= 2) expect(p.heat).toBe('fire');
      // a PERFECT three each time: +12 +10
      p.perfects.push(0);
      p.end = { kind: 'make', points: 3, text: '', who: 0 };
      afterPossession(g, p);
      if (fired < 0 && g.heat.us.fire > 0) fired = i;
    }
    // 22 a possession: 22, 44, 66, 88, 100 → On Fire after the 5th
    expect(fired).toBe(4);
    expect(g.heat.us.fires).toBe(1);
    expect(g.heat.us.peak).toBe(100);
  });

  it('half-time resets the bar', () => {
    const g = newHoopsGame(five(man(80)), five(man(75)), 'heat-half', 4);
    for (let i = 0; i < 2; i++) {
      const p = startPossession(g);
      p.perfects.push(0);
      p.end = { kind: 'make', points: 3, text: '', who: 0 };
      afterPossession(g, p);
    }
    expect(g.heat.us.v).toBe(0);
    expect(g.heat.us.peak).toBe(44);
  });
});

describe('NBA gold ring: gold never lies (plan §4.4)', () => {
  /** A person's release `offMs` from the ideal, through the engine; null if the ring wasn't gold at the release. */
  function goldRelease(seed: number, finish: boolean): { make: boolean; blocked: boolean } | null {
    const r = rng(seed);
    const shooter = man(45 + Math.floor(r() * 60), { ddk: 50, sdk: 50, abil: r() < 0.3 ? ['deadeye'] : [] });
    const def = man(45 + Math.floor(r() * 55), { blk: 40 + Math.floor(r() * 59), ind: 40 + Math.floor(r() * 59), ht: 72 + Math.floor(r() * 14) });
    const p = newPossession(five(shooter), [def, man(75), man(75), man(75), man(75)], [1, 1, 1, 1, 1], rng(seed + 1), -0.5 + r() * 1.5);
    p.person = true;
    p.heat = r() < 0.2 ? 'fire' : 'cold';
    const b = p.bodies[0];
    const d = p.bodies[5];
    for (const o of p.bodies) if (o !== b && o !== d) Object.assign(o, o.side === 'D' ? { cx: -4, cz: 20 } : { cx: 4, cz: -20 });
    if (finish) {
      // a drive at the rim with a defender beside or behind the lane
      Object.assign(b, { cx: RIM.cx - 4.5 - r() * 1.4, cz: (r() - 0.5) * 3, vx: 0, vz: 0 });
      Object.assign(d, { cx: b.cx + (r() - 0.5) * 6, cz: b.cz + (r() < 0.5 ? -1 : 1) * (1.5 + r() * 4) });
    } else {
      const ft = 8 + r() * 17;
      const a = (r() - 0.5) * 2.4;
      Object.assign(b, { cx: RIM.cx - Math.cos(a) * ft, cz: Math.sin(a) * ft, vx: 0, vz: 0 });
      const gap = 1 + r() * 7;
      const toRim = { cx: (RIM.cx - b.cx) / ft, cz: (RIM.cz - b.cz) / ft };
      Object.assign(d, { cx: b.cx + toRim.cx * gap + (r() - 0.5) * 2, cz: b.cz + toRim.cz * gap + (r() - 0.5) * 2 });
    }
    pressShoot(p);
    const m = p.meter;
    if (!m || (finish && m.kind !== 'layup') || (!finish && m.kind === 'layup')) return null;
    const off = (r() - 0.5) * 2 * 0.95;
    let at = 0;
    while (!p.end && p.meter === m && m.off === undefined) {
      at = m.t0 + m.top + off * m.green;
      if (p.t + 1 / 60 >= at) break;
      step(p, 1 / 60, null);
    }
    if (p.end || p.meter !== m) return null;
    releaseShoot(p, 0, at);
    if (!m.greened) return null;
    for (let i = 0; i < 200 && !p.end && !(p.ball?.kind === 'shot' && p.ball.make !== undefined && p.lastShot); i++) step(p, 1 / 60, null);
    const blocked = p.events.some((e) => e.startsWith('blocked:'));
    return { make: !!p.lastShot?.make && !!p.lastShot.greened, blocked };
  }

  it('10,000 seeded gold releases (jumpers and finishes) are 10,000 makes and 0 blocks', () => {
    let n = 0;
    let makes = 0;
    let blocks = 0;
    let jumpers = 0;
    let finishes = 0;
    for (let seed = 1; n < 10000 && seed < 200000; seed++) {
      const fin = seed % 2 === 0;
      const g = goldRelease(seed, fin);
      if (!g) continue;
      n++;
      if (fin) finishes++;
      else jumpers++;
      if (g.make) makes++;
      if (g.blocked) blocks++;
    }
    expect(n).toBe(10000);
    expect(jumpers).toBeGreaterThan(3000);
    expect(finishes).toBeGreaterThan(1000);
    expect(makes).toBe(10000);
    expect(blocks).toBe(0);
  }, 120_000);
});

describe('NBA gold ring: the release is timed from the touch', () => {
  it('a press and a release between two 60 Hz steps land within 1 ms of where they were', () => {
    let worst = 0;
    for (let i = 0; i < 400; i++) {
      const p = poss(man(75), 24);
      step(p, 1 / 60, null);
      step(p, 1 / 60, null);
      const b: Body = p.bodies[0];
      // the frame's touch clock: this frame at real 5000 ms, the stepped game time, a part step not yet run
      const acc = ((i % 7) / 7) * (1 / 60);
      const clock = { real: 5000, game: p.t, acc, rate: 1 };
      const phase = (i + 0.5) / 400;
      const pressTs = 5000 + phase * 16.6;
      pressShoot(p, { at: gameTimeAt(clock, pressTs, pressTs + 2) });
      const m = p.meter!;
      expect(b.h).toBeGreaterThan(0);
      const want = 0.0137 * ((i % 5) - 2);
      // the person lets go exactly `top` + want after the press, between two steps
      const releaseGame = m.t0 + m.top + want;
      while (p.t + 1 / 60 < releaseGame) step(p, 1 / 60, null);
      const rClock = { real: 9000, game: p.t, acc: 0.003, rate: 1 };
      const releaseTs = 9000 + (releaseGame - p.t - 0.003) * 1000;
      releaseShoot(p, 0, gameTimeAt(rClock, releaseTs, releaseTs + 3));
      worst = Math.max(worst, Math.abs((p.lastShot?.offMs ?? 99) - want * 1000));
    }
    expect(worst).toBeLessThan(1);
  });
});
