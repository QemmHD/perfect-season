// Claude, 2026-11-01: ratings must matter, in the right direction (docs/GAMEPLAY-RATINGS.md).
import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/rng';
import { decide, pilot } from './autopilot';
import { badgeMult, badgeTier } from './badges';
import { canOop, contestOf, freeThrow, greenWindow, newPossession, releaseProbability, RIM, shotQ, step, stonewallChance } from './engine';
import { afterPossession, clutchOf, fireAt, newHoopsGame, startPossession } from './game';
import type { Hooper } from './types';

const HT: Record<string, number> = { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 };
const WT: Record<string, number> = { PG: 190, SG: 205, SF: 220, PF: 240, C: 255 };
const SP = ['PG', 'SG', 'SF', 'PF', 'C'];
const mk = (pos: string, base = 75, o: Partial<Hooper> = {}): Hooper => ({
  id: pos + base,
  name: pos,
  tag: pos,
  num: null,
  ht: HT[pos],
  wt: WT[pos],
  pos,
  ovr: base,
  spd: base,
  acc: base,
  hnd: base,
  pas: base,
  thr: base,
  mid: base,
  cls: base,
  lay: base,
  ft: base,
  ddk: base,
  sdk: base,
  str: base,
  vrt: base,
  sta: base,
  prd: base,
  ind: base,
  stl: base,
  blk: base,
  reb: base,
  abil: [],
  ...o
});

/** Points per possession for five with `o` against an even 75 defense (with `d`), fixed seeds, the Pro AI. */
function ppp(o: Partial<Hooper>, games = 60, d: Partial<Hooper> = {}): number {
  const O = SP.map((s) => mk(s, 75, o));
  const D = SP.map((s) => mk(s, 75, d));
  let pts = 0,
    poss = 0;
  for (let i = 0; i < games; i++) {
    const g = newHoopsGame(O, D, 'mono' + i);
    const pl = pilot(0.68, 'mp' + i);
    while (!g.over) {
      const p = startPossession(g);
      pl.letGo = null;
      pl.driving = false;
      pl.goal = null;
      pl.nextThink = 0;
      pl.crosses = 0;
      for (let k = 0; k < 60 * 40 && !p.end; k++) {
        step(p, 1 / 60, decide(p, pl));
        p.events.length = 0;
      }
      if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
      afterPossession(g, p);
      poss++;
    }
    pts += g.score;
  }
  return pts / poss;
}

describe('NBA: better offensive ratings never score less', () => {
  it('elite shooters score more than average ones, and average more than poor (the autopilot stall)', () => {
    const lo = ppp({ thr: 60, mid: 60 });
    const mid = ppp({});
    const hi = ppp({ thr: 90, mid: 90 });
    expect(hi).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(lo - 0.03);
    expect(hi).toBeGreaterThan(lo + 0.1);
  }, 120000);
  it('is monotone across the other offensive attributes (90 never clearly below 75)', () => {
    const base = ppp({});
    for (const k of ['hnd', 'pas', 'lay', 'ddk', 'spd', 'acc', 'str', 'ft', 'cls', 'sdk'] as const) {
      const v = ppp({ [k]: 90 });
      expect(v, k).toBeGreaterThan(base - 0.06);
    }
  }, 300000);
});

describe('NBA: better defensive ratings never concede more', () => {
  // Claude, 2026-11-01 (second pass): with the AI attacking the rim, interior defense, strength and
  // the rest show; raising any one of them on all five never raises the offense's PPP (beyond the
  // noise of 60 fixed-seed games), and the sum of them clearly lowers it.
  it('raising any defensive attribute to 90 never raises the opponent’s PPP', () => {
    const base = ppp({});
    for (const k of ['prd', 'ind', 'blk', 'stl', 'str', 'spd', 'acc', 'reb', 'vrt'] as const) {
      const v = ppp({}, 60, { [k]: 90 });
      expect(v, k).toBeLessThan(base + 0.05);
    }
    const all = ppp({}, 60, { prd: 90, ind: 90, blk: 90, stl: 90, str: 90, spd: 90, acc: 90, reb: 90, vrt: 90 });
    expect(all).toBeLessThan(base - 0.15);
  }, 600000);
});

describe('NBA shot selection (the AI attacks the rim with finishers, shoots with shooters)', () => {
  // the shot mix of a five, Pro AI against an even 75 defense
  function mix(o: Partial<Hooper>, games = 40) {
    const O = SP.map((s) => mk(s, 75, o));
    const D = SP.map((s) => mk(s));
    const c = { rim: 0, three: 0, jump: 0, ppp: 0, poss: 0, and1: 0 };
    for (let i = 0; i < games; i++) {
      const g = newHoopsGame(O, D, 'mix' + i);
      const pl = pilot(0.68, 'mx' + i);
      while (!g.over) {
        const p = startPossession(g);
        pl.letGo = null;
        pl.driving = false;
        pl.goal = null;
        pl.nextThink = 0;
        pl.crosses = 0;
        for (let k = 0; k < 60 * 40 && !p.end; k++) {
          step(p, 1 / 60, decide(p, pl));
          p.events.length = 0;
        }
        if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
        const k = p.lastShot?.kind;
        if (k === 'three') c.three++;
        else if (k === 'mid' || k === 'close') c.jump++;
        else if (k) c.rim++;
        if (p.lastShot?.and1) c.and1++;
        afterPossession(g, p);
        c.poss++;
      }
      c.ppp += g.score;
    }
    const shots = c.rim + c.three + c.jump;
    return { rim: c.rim / shots, three: c.three / shots, ppp: c.ppp / c.poss, and1: c.and1 };
  }
  it('even teams take a real mix (not ~85% contested threes) and score 1.0-1.15 a trip', () => {
    const m = mix({});
    expect(m.rim).toBeGreaterThan(0.25);
    expect(m.three).toBeGreaterThan(0.25);
    expect(m.three).toBeLessThan(0.6);
    expect(m.ppp).toBeGreaterThan(0.95);
    expect(m.ppp).toBeLessThan(1.18);
  }, 300000);
  it('elite slashers attack the rim more and score more; elite shooters shoot more threes', () => {
    const base = mix({});
    const slash = mix({ ddk: 92, lay: 92, spd: 88, acc: 88, hnd: 88 });
    const shoot = mix({ thr: 92, mid: 90 });
    expect(slash.rim, 'slashers at the rim').toBeGreaterThan(base.rim + 0.1);
    expect(slash.ppp, 'slashers score').toBeGreaterThan(base.ppp + 0.1);
    expect(shoot.three, 'shooters shoot').toBeGreaterThan(base.three + 0.15);
    expect(shoot.ppp, 'shooters score').toBeGreaterThan(base.ppp);
  }, 300000);
});

describe('NBA shot curve (plan curve, measured: GAMEPLAY-RATINGS.md)', () => {
  const p = newPossession(SP.map((s) => mk(s)), SP.map((s) => mk(s)), [1, 1, 1, 1, 1], rng(1));
  const b = p.bodies[0];
  // expected make with a 45 ms (σ) human release, an open/heavy three
  const exp = (r: number, contest: 'open' | 'heavy') => {
    b.p = mk('PG', 75, { thr: r });
    b.cx = RIM.cx - 24.5;
    b.cz = 0;
    const w = greenWindow(p, b, 'three', contest);
    let s = 0,
      n = 0;
    for (let i = -300; i <= 300; i++) {
      const off = i / 1000,
        k = Math.exp(-(off * off) / (2 * 0.045 * 0.045));
      s += k * releaseProbability(p, b, 'three', contest, off, w);
      n += k;
    }
    return s / n;
  };
  it('open threes 45/60/75/90/99 land near 36/51/68/82/87%', () => {
    const want = [36, 51, 68, 82, 87];
    [45, 60, 75, 90, 99].forEach((r, i) => expect(Math.abs(exp(r, 'open') * 100 - want[i])).toBeLessThan(3.5));
  });
  it('heavy contests 45/60/75/90/99 land near 12/20/29/39/44%', () => {
    const want = [12, 20, 29, 39, 44];
    [45, 60, 75, 90, 99].forEach((r, i) => expect(Math.abs(exp(r, 'heavy') * 100 - want[i])).toBeLessThan(3.5));
  });
  it('above 99 is finite and only slightly better', () => {
    expect(shotQ(110)).toBeLessThan(1.25);
    expect(exp(110, 'open')).toBeGreaterThan(exp(99, 'open'));
    expect(exp(110, 'open') - exp(99, 'open')).toBeLessThan(0.05);
    expect(Number.isFinite(exp(150, 'open'))).toBe(true);
  });
});

describe('NBA contact, defense and the dead attributes', () => {
  it('strength decides a drive into a set defender (it was a flat 96% stop)', () => {
    const strong = mk('PF', 75, { str: 95 }),
      weak = mk('PG', 75, { str: 55 });
    expect(stonewallChance(weak, strong)).toBeLessThan(0.15);
    expect(stonewallChance(strong, weak)).toBeGreaterThan(0.85);
    expect(stonewallChance(mk('SF'), mk('SF'))).toBeCloseTo(0.5, 5);
  });
  it('perimeter defense tightens the contest', () => {
    const p = newPossession(SP.map((s) => mk(s)), SP.map((s) => mk(s)), [1, 1, 1, 1, 1], rng(3));
    const b = p.bodies[0],
      d = p.bodies[5];
    for (const o of p.bodies) if (o !== d && o.side === 'D') o.cx = -5;
    b.cx = 20;
    b.cz = 0;
    d.cx = 23.4;
    d.cz = 0;
    d.p = mk('PG', 75, { prd: 50 });
    const loose = contestOf(p, b);
    d.p = mk('PG', 75, { prd: 99 });
    const tight = contestOf(p, b);
    const order = ['open', 'light', 'heavy', 'smothered'];
    expect(order.indexOf(tight)).toBeGreaterThan(order.indexOf(loose));
  });
  it('free throws (and-ones) follow the FT rating', () => {
    expect(freeThrow(mk('PG', 75, { ft: 40 }))).toBeCloseTo(0.45, 2);
    expect(freeThrow(mk('PG', 75, { ft: 97 }))).toBeCloseTo(0.92, 2);
    expect(freeThrow(mk('PG', 75, { ft: 120 }))).toBeLessThan(0.98);
  });
  it('the defense tires by its stamina too', () => {
    const fresh = SP.map((s) => mk(s, 75, { sta: 99 })),
      tired = SP.map((s) => mk(s, 75, { sta: 45 }));
    const a = newHoopsGame(SP.map((s) => mk(s)), fresh, 'sta'),
      b = newHoopsGame(SP.map((s) => mk(s)), tired, 'sta');
    for (let i = 0; i < 6; i++) {
      for (const g of [a, b]) {
        const p = startPossession(g);
        p.end = { kind: 'miss', points: 0, text: '', who: -1 };
        afterPossession(g, p);
      }
    }
    expect(a.theirEnergy![0]).toBeGreaterThan(b.theirEnergy![0]);
  });
});

describe('NBA badges: tiers, Lob City, Heat Check, Icon', () => {
  it('tiers follow the 2K26 thresholds and Deadeye only counts for the matching shot', () => {
    const p = mk('SG', 75, { thr: 92, mid: 70, abil: ['deadeye', 'limitless'] });
    expect(badgeTier(p, 'deadeye', p.thr)).toBe(3);
    expect(badgeTier(p, 'deadeye', p.mid)).toBe(0);
    expect(badgeTier(p, 'limitless')).toBe(2);
    expect(badgeMult(p, 'deadeye', 99)).toBe(1);
    expect(badgeTier(mk('SG'), 'deadeye', 99)).toBe(0);
  });
  it('Lob City lowers the alley-oop bar from 80 to 74 dunk', () => {
    expect(canOop(mk('SF', 75, { ddk: 76 }))).toBe(false);
    expect(canOop(mk('SF', 75, { ddk: 76, abil: ['lob-city'] }))).toBe(true);
    expect(canOop(mk('SF', 75, { ddk: 82 }))).toBe(true);
  });
  it('Heat Check gets hot after two; Icon plays +3 in the clutch', () => {
    expect(fireAt(mk('SG', 75, { abil: ['heat-check'] }))).toBe(2);
    expect(fireAt(mk('SG'))).toBe(3);
    const icon = clutchOf(mk('SG', 75, { abil: ['icon'] }));
    expect(icon.thr).toBe(78);
    expect(clutchOf(mk('SG')).thr).toBe(75);
    const g = newHoopsGame(SP.map((s, i) => mk(s, 75, i === 0 ? { abil: ['icon'] } : {})), SP.map((s) => mk(s)), 'icon', 6);
    for (let i = 0; i < 2; i++) {
      const p = startPossession(g);
      expect(p.bodies[0].p.thr).toBe(75);
      p.end = { kind: 'miss', points: 0, text: '', who: -1 };
      afterPossession(g, p);
    }
    const late = startPossession(g);
    expect(late.bodies[0].p.thr).toBe(78);
    expect(late.events).toContain('clutch:icon');
  });
});
