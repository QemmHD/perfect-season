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

// ---------- the pocket (Claude, studio overhaul nfl-2) ----------
import { BOX_HALF, coverBall, DROP_TIME, giveUp, moveWithBall, outsideBox, scramble, throwAway } from './engine';
import { burstAtTouch, burstHeld } from './gestures';
import { stickFrom } from './shared-v2';
import type { Play, PlayEnd, RunInput } from './types';

/** A pass play just snapped, with every defender frozen unless `live` (so nothing ends it early). */
function pocket(seed: number, live = false, call: 'pass' | 'run' = 'pass') {
  const p = lineUp(offense(), defense(), call, 'curls', 'inside', 35, 26, rng(seed), 0);
  if (!live) for (const d of p.bodies.filter((b) => b.side === 'D')) d.stunUntil = Infinity;
  snap(p);
  return p;
}
const run = (p: Play, secs: number, steer: RunInput) => {
  for (let i = 0; i < Math.round(secs * 60) && !p.end; i++) step(p, 1 / 60, steer);
};

describe('the pocket (nfl-2)', () => {
  it('moves the quarterback 1.5-5 yd in a second with the stick, and not at all beyond the drop without it', () => {
    for (const agi of [40, 70, 99])
      for (const dir of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0.7, y: 0.7 }, { x: 0, y: -1 }]) {
        const p = pocket(agi + dir.x * 10 + dir.y);
        p.qb.p.a.AGI = agi;
        run(p, DROP_TIME + 0.15, null);
        const set = { x: p.qb.x, y: p.qb.y };
        run(p, 1, dir);
        const moved = dist(p.qb, set);
        expect(moved).toBeGreaterThanOrEqual(1.5);
        expect(moved).toBeLessThanOrEqual(5);
        // no stick: he holds wherever the stick left him
        const left = { x: p.qb.x, y: p.qb.y };
        run(p, 1, null);
        expect(dist(p.qb, left)).toBeLessThan(0.6);
      }
    for (let seed = 1; seed <= 20; seed++) {
      const p = pocket(seed);
      run(p, DROP_TIME + 0.15, null);
      const set = { x: p.qb.x, y: p.qb.y };
      run(p, 1, null);
      expect(dist(p.qb, set)).toBeLessThan(0.15);
      // a resting thumb (a centred stick) is the same as none
      run(p, 1, { x: 0, y: 0 });
      expect(dist(p.qb, set)).toBeLessThan(0.15);
    }
  });

  it('takes a stick already held at the snap on the first step, and keeps the drop going backwards', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const held = pocket(seed),
        free = pocket(seed);
      step(held, 1 / 60, { x: 1, y: 0.4 });
      step(free, 1 / 60, null);
      expect(held.qb.x).toBeGreaterThan(free.qb.x);
      // still dropping: pushing up doesn't bring him forward before he's set
      const up = pocket(seed);
      const y0 = up.qb.y;
      run(up, 0.3, { x: 0, y: 1 });
      expect(up.qb.y).toBeLessThan(y0);
    }
  });

  it('refuses a throwaway inside the box, and outside it the ball is never intercepted (500 seeds)', () => {
    let thrown = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const p = pocket(seed, true);
      run(p, 0.5, null);
      if (p.end) continue;
      expect(outsideBox(p)).toBe(false);
      expect(throwAway(p)).toBe(false);
      // roll out past the tackle box, then throw it away
      const side = seed % 2 ? 1 : -1;
      for (let i = 0; i < 120 && !p.end && !outsideBox(p); i++) step(p, 1 / 60, { x: side, y: 0 });
      if (p.end) continue;
      expect(Math.abs(p.qb.x - p.bx)).toBeGreaterThan(BOX_HALF);
      expect(throwAway(p)).toBe(true);
      thrown++;
      const events: string[] = [];
      for (let i = 0; i < 300 && !p.end; i++) {
        step(p, 1 / 60, null);
        events.push(...p.events);
        p.events.length = 0;
      }
      const end = p.end as PlayEnd | null;
      expect(end?.kind).toBe('incomplete');
      expect(end?.text).toBe('THROWN AWAY');
      expect(events.some((e) => e === 'lane-int' || e === 'int' || e === 'pass-deflected')).toBe(false);
    }
    // most seeds reach it (a few are sacked rolling out, which is the point of throwing it away sooner)
    expect(thrown).toBeGreaterThan(400);
  });

  it('makes the quarterback a runner the moment the stick takes him over the line, and never before', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = pocket(seed);
      run(p, DROP_TIME, null);
      let before = true;
      for (let i = 0; i < 400 && !p.end; i++) {
        const wasY = p.qb.y;
        step(p, 1 / 60, { x: (seed % 3) - 1, y: 1 });
        if (p.events.includes('scramble')) {
          expect(before).toBe(true);
          expect(p.qb.y).toBeGreaterThan(p.los);
          expect(wasY).toBeLessThanOrEqual(p.los + 0.2);
          before = false;
        } else if (before) expect(p.phase).toBe('drop');
        p.events.length = 0;
        if (!before) break;
      }
      expect(before).toBe(false);
      expect(p.carrier).toBe(p.qb);
      // past the line he can't throw it
      expect(throwTo(p, { x: p.qb.x, y: p.qb.y + 15 })).toBe(false);
      expect(throwAway(p)).toBe(false);
    }
    // sliding along the line of scrimmage behind it never makes him a runner
    const p = pocket(3);
    run(p, 3, { x: 0.6, y: -0.1 });
    expect(p.phase).toBe('drop');
  });

  it('always ends a slide (and a dive) in a tackle with no fumble (500 seeds)', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const kind = seed % 4 === 0 ? 'dive' : 'slide';
      const p = pocket(seed, true);
      // a scramble up the middle, a few yards past the line, with the defense on him
      p.t = 1;
      scramble(p);
      Object.assign(p.qb, { x: p.bx, y: p.los + 3, vx: 0, vy: 7 });
      if (seed % 3 === 0) {
        const d = p.bodies.find((b) => b.side === 'D' && b.slot === 'MLB')!;
        Object.assign(d, { x: p.bx + 0.3, y: p.los + 4.2, vx: 0, vy: -5, stunUntil: 0, readUntil: 0, heldUntil: 0 });
      }
      expect(giveUp(p, kind)).toBe(true);
      expect(giveUp(p, kind)).toBe(false);
      const events: string[] = [];
      for (let i = 0; i < 120 && !p.end; i++) {
        step(p, 1 / 60, { x: 0, y: 1 });
        events.push(...p.events);
        p.events.length = 0;
      }
      expect(p.end?.kind).toBe('tackle');
      expect(events.some((e) => e.startsWith('fumble'))).toBe(false);
      expect(p.end!.secs - 1).toBeLessThanOrEqual(kind === 'slide' ? 0.27 : 0.34);
    }
    // a slide is a quarterback's, past the line
    const p = pocket(9);
    p.t = 1;
    scramble(p);
    Object.assign(p.qb, { y: p.los - 2 });
    expect(giveUp(p, 'slide')).toBe(false);
  });

  it('covers the ball: a step slower, no moves while covered, the same stamina', () => {
    const a = pocket(4),
      b = pocket(4);
    for (const p of [a, b]) {
      p.t = 1;
      scramble(p);
      Object.assign(p.qb, { x: 26, y: 50, vx: 0, vy: 7 });
    }
    expect(coverBall(b, true)).toBe(true);
    run(a, 1, { x: 0, y: 1 });
    run(b, 1, { x: 0, y: 1 });
    expect(b.qb.y).toBeLessThan(a.qb.y);
    moveWithBall(b, 'juke');
    expect(b.move).toBeNull();
    expect(coverBall(b, false)).toBe(false);
  });

  it('puts the sacked quarterback down and the sacker in his tackle', () => {
    let sacks = 0;
    for (let seed = 1; seed <= 40 && sacks < 5; seed++) {
      const p = pocket(seed, true);
      for (const d of p.bodies.filter((b) => b.job === 'rush')) d.winAt = 0.2;
      run(p, 6, null);
      if (p.end?.kind !== 'sack') continue;
      sacks++;
      expect(p.qb.act).toBe('down');
      const sacker = p.bodies.find((b) => b.side === 'D' && b.act === 'tackle');
      expect(sacker).toBeTruthy();
      expect(p.end.text).toContain(sacker!.p.tag);
    }
    expect(sacks).toBe(5);
  });

  it('plays the same inputs to the same end, stick, throwaway and all', () => {
    const go = (seed: number) => {
      const p = pocket(seed, true);
      const r = rng(seed * 7);
      for (let i = 0; i < 1500 && !p.end; i++) {
        const t = i / 60;
        const steer: RunInput = t < 1.4 ? { x: Math.sin(seed + t) * 0.9, y: 0.2 * Math.cos(t * 3) } : p.phase === 'run' ? { x: r() - 0.5, y: 0.9 } : null;
        if (t > 1.5 && p.phase === 'drop') {
          if (!throwAway(p)) throwTo(p, { x: p.qb.x + 4, y: p.qb.y + 12 });
        }
        step(p, 1 / 60, steer);
      }
      return JSON.stringify({ end: p.end, at: p.bodies.map((b) => [b.x, b.y, b.vx, b.vy]) });
    };
    for (let seed = 1; seed <= 25; seed++) expect(go(seed)).toBe(go(seed));
  });

  it('never reads a body\'s act: 500 seeded plays come out the same with every act swapped for a dummy (C9)', () => {
    const go = (seed: number, dummy: boolean) => {
      const p = pocket(seed, true, seed % 3 === 0 ? 'run' : 'pass');
      const r = rng(seed * 13);
      const events: string[] = [];
      for (let i = 0; i < 1500 && !p.end; i++) {
        const t = i / 60;
        if (p.phase === 'drop' && p.call === 'pass' && t > 1 + (seed % 5) * 0.3) {
          if (seed % 7 === 0) throwAway(p);
          else throwTo(p, { x: p.qb.x + (seed % 11) - 5, y: p.qb.y + 8 + (seed % 17) });
        }
        if (p.phase === 'run' && r() < 0.03) moveWithBall(p, (['juke', 'spin', 'stiff', 'truck'] as const)[seed % 4], seed % 2 ? 1 : -1);
        step(p, 1 / 60, p.phase === 'drop' && p.call === 'pass' ? { x: Math.sin(seed + t), y: -0.2 } : p.phase === 'run' ? { x: Math.cos(t + seed) * 0.5, y: 0.85 } : null);
        events.push(...p.events);
        p.events.length = 0;
        if (dummy)
          for (const b of p.bodies) {
            b.act = 'celebrate';
            b.actAt = -99;
          }
      }
      return JSON.stringify({ end: p.end, events, at: p.bodies.map((b) => [b.x, b.y, b.vx, b.vy, b.stunUntil]) });
    };
    for (let seed = 1; seed <= 500; seed++) expect(go(seed, true)).toBe(go(seed, false));
  });

  // Review fix: drive the two real sources. The ring path is a scripted thumb read through the
  // Stick's own maths (stickFrom at the 1.15 sprint ring), applied at the touch (burstAtTouch, as the
  // Stick's onMove does) and on every fixed step (burstHeld, as the frame loop does). The button path
  // is D's pointer state with the preference on, while the same stick is pushed about at random (it
  // must not count). Both feed setBurst through the same calls Football2 makes.
  const RING_O = { x: 100, y: 700 },
    RING_R = 60;
  /** one run with burst decided the way the screen decides it; `src` says where the thumb's intent shows */
  const burstTrace = (seed: number, src: 'ring' | 'button' | 'ring-ignored') => {
    const p = pocket(seed, true, 'run');
    const want = rng(seed * 31);
    const noise = rng(seed * 57);
    const pref = src !== 'ring';
    let ring = false,
      button = false;
    const out: number[] = [];
    for (let i = 0; i < 600 && !p.end; i++) {
      if (i % 20 === 0) {
        // the player's intent this stretch: burst or not, and a thumb angle
        const go = want() < 0.5;
        const ang = want() * Math.PI * 2;
        // the thumb's distance from the ring's centre: past 1.15 radii when the ring carries the intent
        const ringIntent = src === 'ring' ? go : noise() < 0.5;
        const mag = ringIntent ? 1.2 + noise() * 0.3 : 0.3 + noise() * 0.7;
        const read = stickFrom(RING_O, { x: RING_O.x + Math.cos(ang) * mag * RING_R, y: RING_O.y - Math.sin(ang) * mag * RING_R }, RING_R, 1.15);
        ring = read.sprint;
        button = src === 'button' ? go : false;
        // the touch itself (Stick onMove): the ring takes effect now, unless the preference is on
        const now = burstAtTouch(read.sprint, pref);
        if (now !== null) setBurst(p, now);
        // D's pointerdown / pointerup (Football2's BURST button sets the same flag)
        if (pref) setBurst(p, burstHeld({ ring, button, buttonPref: pref }));
      }
      setBurst(p, burstHeld({ ring, button, buttonPref: pref }));
      step(p, 1 / 60, p.phase === 'run' ? { x: 0.2, y: 0.9 } : null);
      out.push(p.stamina);
    }
    return out;
  };
  it('spends identical stamina whether burst comes from the ring or from the D button (200 seeds)', () => {
    let burned = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const viaRing = burstTrace(seed, 'ring');
      expect(burstTrace(seed, 'button')).toEqual(viaRing);
      if (Math.min(...viaRing) < 0.95) burned++;
    }
    // not vacuous: the scripted thumbs really burst on most runs
    expect(burned).toBeGreaterThan(100);
  });
  it('ignores the ring when the Burst-button preference is on (D never held: no burst at all)', () => {
    let differs = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const ignored = burstTrace(seed, 'ring-ignored');
      // with D never held the runner never bursts, so his stamina never drops below where it started
      expect(Math.min(...ignored)).toBeGreaterThanOrEqual(ignored[0] - 1e-9);
      if (JSON.stringify(ignored) !== JSON.stringify(burstTrace(seed, 'ring'))) differs++;
    }
    expect(differs).toBeGreaterThan(40);
  });
});
