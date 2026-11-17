// Implemented by Codex: actual throws and physical passing lanes, using synthetic fixture teams.
import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/rng';
import { ballNow, flightTime, peakOf, receiverLead, setBurst, pursuitTarget, dist, flipPlay, lineUp, maxThrow, snap, step, throwErrorRadius, throwTo } from './engine';
import type { Defense, FbPlayer, Offense } from './types';
const player = (id: string, pos: string): FbPlayer => ({
  id,
  name: id,
  tag: id,
  num: 1,
  ht: 74,
  wt: 220,
  pos,
  ovr: 85,
  abil: [],
  a: Object.fromEntries(
    [
      'SPD',
      'ACC',
      'AGI',
      'STR',
      'AWR',
      'THP',
      'SAC',
      'MAC',
      'DAC',
      'TUP',
      'CTH',
      'CIT',
      'RTE',
      'REL',
      'PMV',
      'FMV',
      'PBK',
      'RBK',
      'TAK',
      'PRC',
      'MCV',
      'ZCV',
      'PRS',
      'PUR',
      'CAR',
      'BTK'
    ].map((k) => [k, 85])
  )
});
const offense = (): Offense => ({
  qb: player('QB', 'QB'),
  rb: player('RB', 'RB'),
  wr: [player('X', 'WR'), player('Z', 'WR'), player('SL', 'WR')],
  te: player('TE', 'TE'),
  ol: [0, 1, 2, 3, 4].map((i) => player('OL' + i, 'OT')) as Offense['ol'],
  k: player('K', 'K')
});
const defense = (): Defense => ({
  dl: [0, 1, 2, 3].map((i) => player('DL' + i, 'DE')) as Defense['dl'],
  lb: [0, 1, 2].map((i) => player('LB' + i, 'LB')) as Defense['lb'],
  cb: [player('CB1', 'CB'), player('CB2', 'CB')],
  s: [player('FS', 'S'), player('SS', 'S')]
});
function play(seed = 1) {
  const p = lineUp(offense(), defense(), 'pass', 'slants', 'inside', 35, 26, rng(seed), 1);
  snap(p);
  p.t = 0.6;
  return p;
}
describe('football accuracy and credible defense', () => {
  it('mirrors routes, coverage, personnel and landmarks together, and locks the call at the snap', () => {
    const p = lineUp(offense(), defense(), 'pass', 'flood', 'outside', 35, 26, rng(5), 1);
    const before = p.bodies.map((b) => ({ x: b.x, y: b.y, route: b.route.map((a) => ({ ...a })), zone: b.zone ? { ...b.zone } : null, mark: b.mark, p: JSON.stringify(b.p) })),
      hole = p.hole;
    expect(flipPlay(p)).toBe(true);
    p.bodies.forEach((b, i) => {
      expect(b.x).toBeCloseTo(2 * p.bx - before[i].x);
      expect(b.y).toBe(before[i].y);
      expect(b.mark).toBe(before[i].mark);
      expect(JSON.stringify(b.p)).toBe(before[i].p);
      b.route.forEach((a, j) => expect(a.x).toBeCloseTo(2 * p.bx - before[i].route[j].x));
      if (b.zone) expect(b.zone.x).toBeCloseTo(2 * p.bx - before[i].zone!.x);
    });
    expect(p.hole).toBeCloseTo(2 * p.bx - hole);
    expect(flipPlay(p)).toBe(true);
    p.bodies.forEach((b, i) => expect(b.x).toBeCloseTo(before[i].x));
    snap(p);
    const xs = p.bodies.map((b) => b.x);
    expect(flipPlay(p)).toBe(false);
    expect(p.bodies.map((b) => b.x)).toEqual(xs);
  });
  it('executes a mirrored outside handoff and follows the left landmark at a matching pace', () => {
    const normal = lineUp(offense(), defense(), 'run', 'slants', 'outside', 35, 26, rng(40), 0),
      flipped = lineUp(offense(), defense(), 'run', 'slants', 'outside', 35, 26, rng(40), 0);
    flipPlay(flipped);
    for (const p of [normal, flipped]) {
      for (const d of p.bodies.filter((b) => b.side === 'D')) d.stunUntil = Infinity;
      snap(p);
    }
    for (let i = 0; i < 210; i++) {
      step(normal, 1 / 60, null);
      step(flipped, 1 / 60, null);
    }
    expect(normal.events).toContain('handoff');
    expect(flipped.events).toContain('handoff');
    expect(normal.rb.x).toBeGreaterThan(normal.bx + 3);
    expect(flipped.rb.x).toBeLessThan(flipped.bx - 3);
    expect(normal.rb.x + flipped.rb.x).toBeCloseTo(2 * normal.bx, 1);
    expect(normal.rb.y).toBeCloseTo(flipped.rb.y, 1);
    expect(normal.bodies.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y))).toBe(true);
  });
  it('makes actual high-accuracy throws tighter than weak throws, with bounded error', () => {
    let good = 0,
      bad = 0;
    for (let seed = 1; seed <= 100; seed++)
      for (const rating of [60, 95]) {
        const p = play(seed);
        for (const code of ['SAC', 'MAC', 'DAC', 'TUP']) p.qb.p.a[code] = rating;
        const target = { x: p.qb.x + 3, y: p.qb.y + 25 };
        expect(throwTo(p, target)).toBe(true);
        const error = dist(p.ball!.to, p.aim!);
        expect(error).toBeLessThanOrEqual(throwErrorRadius(p, Math.hypot(3, 25)) + 1e-9);
        if (rating === 95) good += error;
        else bad += error;
      }
    expect(good).toBeLessThan(bad * 0.5);
  });
  it('gives above-99 arm strength a bounded real range advantage', () => {
    const p = play();
    p.qb.p.a.THP = 99;
    const normal = maxThrow(p);
    p.qb.p.a.THP = 110;
    expect(maxThrow(p)).toBeGreaterThan(normal);
    expect(maxThrow(p)).toBeLessThan(normal + 3);
  });
  it('shows the same larger uncertainty for pressure and off-platform throws', () => {
    const p = play(),
      clear = throwErrorRadius(p, 25);
    p.pressure = 1;
    p.qb.vx = 5;
    expect(throwErrorRadius(p, 25)).toBeGreaterThan(clear * 1.5);
  });
  it('keeps every 99+ GOAT throw finite at short, medium and deep distances', () => {
    for (const rating of [99, 100, 105, 110])
      for (const yards of [5, 15, 25, 45]) {
        const p = play();
        for (const key of Object.keys(p.qb.p.a)) p.qb.p.a[key] = rating;
        expect(Number.isFinite(throwErrorRadius(p, yards))).toBe(true);
        throwTo(p, { x: p.qb.x, y: p.qb.y + yards });
        expect(Number.isFinite(p.ball!.to.x) && Number.isFinite(p.ball!.to.y)).toBe(true);
      }
  });
  it('allows a defender to play a low ball in his lane without teleporting to its endpoint', () => {
    const p = play();
    p.rand = () => 0;
    throwTo(p, { x: p.qb.x, y: p.qb.y + 13 });
    const db = p.bodies.find((b) => b.side === 'D' && b.p.pos === 'LB')!;
    for (const b of p.bodies) if (b.side === 'D') b.stunUntil = Infinity;
    db.stunUntil = 0;
    db.breakAt = p.t;
    db.x = p.qb.x;
    db.y = p.qb.y + 3.5;
    const start = { x: db.x, y: db.y };
    for (let i = 0; i < 40 && !p.end; i++) step(p, 1 / 60, null);
    expect(p.events.some((e) => e === 'lane-int' || e === 'pass-deflected')).toBe(true);
    expect(dist(db, start)).toBeLessThan(3);
  });
  it('does not let an underneath defender swat a high lob at its apex', () => {
    const p = play();
    p.rand = () => 0;
    throwTo(p, { x: p.qb.x, y: p.qb.y + 40 });
    p.t = (p.ball!.t0 + p.ball!.t1) / 2;
    const at = ballNow(p)!;
    expect(at.h).toBeGreaterThan(6);
    for (const b of p.bodies.filter((b) => b.side === 'D')) {
      b.x = at.x;
      b.y = at.y;
      b.breakAt = 0;
      b.stunUntil = 0;
    }
    step(p, 1 / 60, null);
    expect(p.end).toBeNull();
    expect(p.ball?.tried ?? []).toHaveLength(0);
  });
});

describe('core football play mechanics', () => {
  it('makes a bullet arrive sooner and lower than touch or lob at the same intended distance', () => {
    const p = play();
    expect(flightTime(p, 25, 'bullet')).toBeLessThan(flightTime(p, 25, 'touch'));
    expect(flightTime(p, 25, 'touch')).toBeLessThan(flightTime(p, 25, 'lob'));
    expect(peakOf(25, 'bullet')).toBeLessThan(peakOf(25, 'touch'));
    expect(peakOf(25, 'touch')).toBeLessThan(peakOf(25, 'lob'));
    const strong = flightTime(p, 25, 'bullet');
    p.qb.p.a.THP = 55;
    expect(flightTime(p, 25, 'bullet')).toBeGreaterThan(strong);
  });
  it('leads an eligible receiver along his route and uses the selected trajectory on the actual throw', () => {
    const p = play(),
      b = p.bodies.find((b) => b.slot === 'X')!;
    b.route = [
      { x: b.x + 12, y: b.y + 12 },
      { x: b.x + 25, y: b.y + 15 }
    ];
    p.passType = 'lob';
    const at = receiverLead(p, b);
    expect(dist(at, b)).toBeGreaterThan(3);
    expect(throwTo(p, at)).toBe(true);
    expect(p.ball?.type).toBe('lob');
    expect(p.ball!.peak).toBeGreaterThan(peakOf(dist(p.qb, at), 'bullet'));
  });
  it('keeps an open catch in stride without snapping a receiver to the ball', () => {
    const p = play(),
      b = p.bodies.find((b) => b.slot === 'X')!;
    p.phase = 'air';
    p.carrier = null;
    p.t = 1;
    p.rand = () => 0.3;
    Object.assign(b, { x: 15, y: 50, vx: 0, vy: 7, job: 'track' });
    const before = { x: b.x, y: b.y };
    for (const d of p.bodies.filter((b) => b.side === 'D')) {
      d.x = 45;
      d.y = 90;
    }
    p.ball = { from: { x: 15, y: 40 }, to: { x: 15.8, y: 50.2 }, t0: 0, t1: 1, peak: 3 };
    step(p, 1 / 60, null);
    expect(p.carrier).toBe(b);
    expect(dist(b, before)).toBeLessThan(0.3);
    expect(dist(b, { x: 15.8, y: 50.2 })).toBeGreaterThan(0.5);
    expect(b.vy).toBeGreaterThan(5);
    expect(p.slowUntil - p.t).toBeLessThan(0.1);
    for (let i = 0; i < 8; i++) step(p, 1 / 60, null);
    expect(b.act).toBe('catch');
    expect(b.y).toBeGreaterThan(before.y + 0.6);
  });
  it('spends stamina for a bounded burst and recovers when released, without changing ratings', () => {
    const normal = play(),
      fast = play();
    for (const p of [normal, fast]) {
      p.phase = 'run';
      p.carrier = p.rb;
      Object.assign(p.rb, { x: 26, y: 45, vx: 0, vy: 6 });
      for (const d of p.bodies.filter((b) => b.side === 'D')) d.stunUntil = Infinity;
    }
    const rating = JSON.stringify(fast.rb.p);
    expect(setBurst(fast, true)).toBe(true);
    for (let i = 0; i < 90; i++) {
      step(normal, 1 / 60, null);
      step(fast, 1 / 60, null);
    }
    expect(fast.rb.y).toBeGreaterThan(normal.rb.y + 0.5);
    expect(fast.rb.y - normal.rb.y).toBeLessThan(4);
    expect(fast.stamina).toBeLessThan(0.7);
    const energy = fast.stamina;
    setBurst(fast, false);
    for (let i = 0; i < 60; i++) step(fast, 1 / 60, null);
    expect(fast.stamina).toBeGreaterThan(energy);
    expect(JSON.stringify(fast.rb.p)).toBe(rating);
    fast.phase = 'dead';
    expect(setBurst(fast, true)).toBe(false);
  });
  it('does not freeze a defender whose blocking timer remains but whose blocker is far away', () => {
    const p = play();
    p.phase = 'run';
    p.carrier = p.rb;
    Object.assign(p.rb, { x: 26, y: 55 });
    const d = p.bodies.find((b) => b.side === 'D')!;
    Object.assign(d, { x: 22, y: 50, heldUntil: 100, readUntil: 0 });
    for (const o of p.bodies.filter((b) => b.side === 'O' && b !== p.rb)) {
      o.x = 5;
      o.y = 25;
    }
    const before = { x: d.x, y: d.y };
    for (let i = 0; i < 12 && !p.end; i++) step(p, 1 / 60, null);
    expect(dist(d, before)).toBeGreaterThan(0.3);
    expect(d.act).not.toBe('block');
  });
  it('takes a finite intercept angle from observed motion and gives pursuit ratings a meaningful role', () => {
    const p = play(),
      d = p.bodies.find((b) => b.side === 'D')!;
    Object.assign(d, { x: 20, y: 40 });
    d.p.a.PUR = 99;
    const good = pursuitTarget(d, { x: 26, y: 45 }, { x: 3, y: 5 }, 8);
    d.p.a.PUR = 45;
    const weak = pursuitTarget(d, { x: 26, y: 45 }, { x: 3, y: 5 }, 8);
    expect(good.y).toBeGreaterThan(weak.y);
    expect(good.x).toBeGreaterThan(26);
    expect(Number.isFinite(pursuitTarget(d, { x: 26, y: 45 }, { x: 0, y: 8 }, 8).y)).toBe(true);
    expect(pursuitTarget(d, { x: 52, y: 45 }, { x: 20, y: 8 }, 8).x).toBeLessThan(53.33);
  });
});
