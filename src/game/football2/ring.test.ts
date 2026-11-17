// Claude (studio overhaul nfl-4): the gold ring (V2 §B.0.1, plan §6.2). The windows are never under
// 30 ms a side nor over 110 ms across before On Fire, at any rating, difficulty or On Fire; a touch
// is judged at its own time, so no window falls between two 60 Hz steps; gold never lies (a centre
// release on a gold sling is caught, never dropped or picked; a centre JUKE or SPIN on a gold ring
// leaves that tackler on the turf); gold is never offered in an amber or red state; and the gold
// segment a thumb sees is 8 px or more, visibly fatter for a 95 than a 70.
//
// NFL_LONG=1 runs the full 10,000 seeded centre releases of each kind (the acceptance count, about
// a minute each); the ordinary suite runs 1,000 of each with the same code.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import {
  CATCH_R,
  CONCEPTS,
  dist,
  FIELD_W,
  flightTime,
  haloNeed,
  jukeHalf,
  jukeWindow,
  lineUp,
  maxThrow,
  moveReady,
  moveWithBall,
  projectRoute,
  separation,
  SLING_SWEEP,
  slingHalf,
  slingTarget,
  slingWindow,
  snap,
  step,
  STUMBLE,
  throwTo
} from './engine';
import { JUKE_RING_R, SLING_RING_R } from './overlay';
import { FIRE_SCALE, GOLD_AT, goldArcPx, judge, MIN_HALF, ringDial, touchTime, windowHalf } from './shared-v2';
import { synthTeams } from './sim-kit';
import type { Body, FbPlayer, PassType, Play, Pt } from './types';

const DT = 1 / 60;
const LONG = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NFL_LONG === '1';
const RELEASES = LONG ? 10_000 : 1_000;
const passer = (r: number): FbPlayer => ({ id: 'q' + r, name: 'Q', tag: 'Q', num: 1, ht: 75, wt: 220, pos: 'QB', ovr: r, a: { SAC: r, MAC: r, DAC: r, THP: r, TUP: r, AWR: r }, abil: [] });
const back = (r: number): FbPlayer => ({ id: 'b' + r, name: 'B', tag: 'B', num: 2, ht: 70, wt: 210, pos: 'RB', ovr: r, a: { JKM: r, SPM: r, AGI: r, SPD: 85 }, abil: [] });

describe('gold windows', () => {
  it('stay between 30 ms a side and 110 ms across before On Fire, over ratings 40-110, every difficulty and On Fire on or off', () => {
    let checked = 0;
    for (let r = 40; r <= 110; r++)
      for (const defIQ of [-0.5, 0, 1])
        for (const fire of [false, true]) {
          // difficulty never sizes a window (it moves outcomes through what gold is offered and worth)
          void defIQ;
          for (const len of [3, 8, 14, 22, 30, 45, 60])
            for (const air of [len - 6, len]) {
              const h = slingHalf(passer(r), len, air, fire);
              const pre = fire ? h / FIRE_SCALE : h;
              expect(h).toBeGreaterThanOrEqual(MIN_HALF - 1e-12);
              expect(2 * Math.max(MIN_HALF, pre)).toBeLessThanOrEqual(0.11 + 1e-12);
              checked++;
            }
          const j = jukeHalf(back(r), fire);
          expect(j).toBeGreaterThanOrEqual(MIN_HALF - 1e-12);
          expect(2 * (fire ? j / FIRE_SCALE : j)).toBeLessThanOrEqual(0.11 + 1e-12);
        }
    expect(checked).toBeGreaterThan(5000);
    // On Fire is exactly 1.25x wider (above the floor)
    expect(slingHalf(passer(95), 10, 10, true)).toBeCloseTo(slingHalf(passer(95), 10, 10, false) * FIRE_SCALE, 10);
    // deep throws' gold is narrower
    expect(slingHalf(passer(95), 30, 25, false)).toBeLessThan(slingHalf(passer(95), 30, 15, false));
  });

  it('never fall between two 60 Hz steps unjudged: a touch is judged at its own time, and every window spans 3+ steps', () => {
    for (const half of [MIN_HALF, 0.04, 0.055, 0.055 * FIRE_SCALE]) {
      const w = { center: 3.217, half, state: 'gold' as const };
      // any moment inside the window, whatever frame it lands in, is PERFECT
      for (let u = -1; u <= 1; u += 0.01) expect(judge(w.center + u * half * 0.999, w)).toBe('perfect');
      // and at every phase of the 60 Hz step grid, at least three steps fall inside it
      for (let ph = 0; ph < DT; ph += DT / 100) {
        let n = 0;
        for (let k = Math.floor((w.center - half - ph) / DT) - 1; k * DT + ph <= w.center + half + DT; k++) if (Math.abs(k * DT + ph - w.center) <= half) n++;
        expect(n).toBeGreaterThanOrEqual(3);
      }
    }
    // the same touch through two anchors a delayed frame apart (30 ms) is the same engine time
    const a = touchTime({ timeStamp: 5000 }, { perf: 4980, engine: 2.4 }, 0);
    const b = touchTime({ timeStamp: 5000 }, { perf: 5010, engine: 2.43 }, 0);
    expect(a).toBeCloseTo(b, 9);
  });

  it('shows a gold segment of 8 px or more for 70-rated players, and 1.4x+ wider for a 95 than a 70 on the same throw or tackler', () => {
    for (const len of [4, 10, 18, 26, 40]) {
      const air = len - 4;
      const arc70 = goldArcPx({ half: slingHalf(passer(70), len, air, false) }, SLING_SWEEP, SLING_RING_R);
      expect(arc70).toBeGreaterThanOrEqual(8);
      const arc95 = goldArcPx({ half: slingHalf(passer(95), len, air, false) }, SLING_SWEEP, SLING_RING_R);
      // (deep throws sit on the 30 ms floor for both; the 1.4x shows on everything short of that)
      if (air < 20) expect(arc95 / arc70).toBeGreaterThanOrEqual(1.4);
    }
    // the slowest wind-up (0.4 s) is the longest sweep, so the thinnest segment
    for (const wind of [0.24, 0.32, 0.4]) {
      const sweep = wind / GOLD_AT;
      const a70 = goldArcPx({ half: jukeHalf(back(70), false) }, sweep, JUKE_RING_R);
      const a95 = goldArcPx({ half: jukeHalf(back(95), false) }, sweep, JUKE_RING_R);
      expect(a70).toBeGreaterThanOrEqual(8);
      expect(a95 / a70).toBeGreaterThanOrEqual(1.4);
    }
    // the dial puts the window's middle at three quarters of a turn
    const d = ringDial(1, { center: 1, half: 0.04, state: 'gold' }, SLING_SWEEP);
    expect(d.at).toBeCloseTo(GOLD_AT);
    expect(d.to - d.from).toBeCloseTo(0.08 / SLING_SWEEP);
  });
});

/** A seeded passing play, run to the moment the passer looks; null if it's over by then. */
function pocketAt(seed: string): { p: Play; r: () => number } | null {
  const r = rng(hashString('ring:' + seed));
  const teams = synthTeams(0.15 + 0.8 * r(), seed);
  const p = lineUp(teams.off, teams.def, 'pass', CONCEPTS[Math.floor(r() * CONCEPTS.length)], 'inside', 15 + Math.floor(r() * 60), 20 + r() * 13, rng(hashString('play:' + seed)), [-0.5, 0, 1][Math.floor(r() * 3)]);
  p.passType = (['touch', 'bullet', 'lob'] as PassType[])[Math.floor(r() * 3)];
  p.fire = r() < 0.3;
  snap(p);
  const look = 0.5 + r() * 1.8;
  while (p.t < look && p.phase === 'drop') step(p, DT, null);
  return p.phase === 'drop' ? { p, r } : null;
}

/** Where a sling now should land to meet `b` `wait` seconds from now. */
function aheadOf(p: Play, b: Body, wait: number): Pt {
  let at: Pt = { x: b.x, y: b.y };
  for (let i = 0; i < 3; i++) at = projectRoute(b, wait + flightTime(p, dist(p.qb, at)));
  return { x: Math.max(1, Math.min(FIELD_W - 1, at.x)), y: Math.min(109, at.y) };
}

/** Gold is honest: whenever the ring is gold, everything gold promises holds. */
function checkGold(p: Play, aim: Pt) {
  const s = slingWindow(p, aim);
  if (!s || s.w.state !== 'gold') return;
  const t = slingTarget(p, aim)!;
  expect(t.b.id).toBe(s.target);
  expect(t.miss).toBeLessThanOrEqual(CATCH_R);
  const deep = aim.y - p.los >= 20;
  expect(separation(p, t.b, aim)).toBeGreaterThanOrEqual(haloNeed(aim.y - p.los));
  expect(dist(p.qb, aim)).toBeLessThanOrEqual(maxThrow(p) + 0.01);
  // (On Fire lifts the rush's amber short of 20 air yards only: deep under pressure is never gold)
  if (deep) expect(p.pressure).toBeLessThan(0.25);
  else if (!p.fire) expect(p.pressure).toBeLessThan(0.5);
}

describe('gold never lies', () => {
  it(`slings: ${RELEASES.toLocaleString()} seeded releases on the centre of a gold ring are all caught, none dropped or picked`, () => {
    let releases = 0;
    let caught = 0;
    let picked = 0;
    let checks = 0;
    for (let i = 0; releases < RELEASES && i < RELEASES * 12; i++) {
      const s = pocketAt('sling:' + i);
      if (!s) continue;
      const { p, r } = s;
      const mates = p.bodies.filter((b) => b.side === 'O' && b !== p.qb && b.job === 'route');
      let aim: Pt | null = null;
      for (const b of mates.sort(() => r() - 0.5)) {
        for (const wait of [0.15, 0.3, 0.5]) {
          const at = aheadOf(p, b, wait);
          checkGold(p, at);
          checks++;
          const w = slingWindow(p, at);
          if (w && w.w.state === 'gold' && w.w.center > p.t + DT) aim = at;
          if (aim) break;
        }
        if (aim) break;
      }
      if (!aim) continue;
      // wait for the moment, the ring re-read each step: what's judged is the window at the release
      let released = false;
      while (p.phase === 'drop') {
        const w = slingWindow(p, aim);
        if (!w) break;
        checkGold(p, aim);
        if (p.t + DT >= w.w.center) {
          if (w.w.state !== 'gold') break;
          released = throwTo(p, aim, p.passType, { at: w.w.center });
          break;
        }
        step(p, DT, null);
      }
      if (!released) continue;
      releases++;
      expect(p.ring?.judge).toBe('perfect');
      expect(p.ball?.sure).toBeDefined();
      while (p.phase === 'air') step(p, DT, null);
      if (p.catcher && p.end?.kind !== 'int') caught++;
      if (p.end?.kind === 'int') picked++;
    }
    expect(releases).toBe(RELEASES);
    expect(checks).toBeGreaterThan(RELEASES);
    expect(caught).toBe(RELEASES);
    expect(picked).toBe(0);
  }, 600_000);

  it(`jukes and spins: ${RELEASES.toLocaleString()} seeded moves on the centre of a gold ring leave that tackler on the turf for the stumble`, () => {
    let releases = 0;
    let offered = 0;
    for (let i = 0; releases < RELEASES && i < RELEASES * 12; i++) {
      const r = rng(hashString('juke:' + i));
      const teams = synthTeams(0.15 + 0.8 * r(), 'juke:' + i);
      const p = lineUp(teams.off, teams.def, 'run', 'slants', (['inside', 'outside', 'power'] as const)[Math.floor(r() * 3)], 15 + Math.floor(r() * 60), 26.67, rng(hashString('play:juke:' + i)), [-0.5, 0, 1][Math.floor(r() * 3)]);
      p.fire = r() < 0.3;
      snap(p);
      // run until a tackler winds up at him with gold on offer, ahead of the moment
      let d: Body | null = null;
      for (let k = 0; k < 900 && !p.end && !d; k++) {
        step(p, DT, null);
        for (const b of p.bodies) {
          const w = b.side === 'D' ? jukeWindow(p, b) : null;
          if (!w) continue;
          // amber is honest: never gold without a move ready
          if (w.state === 'gold') expect(moveReady(p)).toBe(true);
          else expect(moveReady(p)).toBe(false);
          if (w.state === 'gold' && w.center > p.t + DT && b.stunUntil <= p.t) d = b;
        }
      }
      if (!d || p.end) continue;
      offered++;
      let moved = false;
      while (!p.end) {
        const w = jukeWindow(p, d);
        if (!w || w.state !== 'gold') break;
        if (p.t + DT >= w.center) {
          moveWithBall(p, r() < 0.5 ? 'juke' : 'spin', 0, w.center);
          moved = p.ring?.judge === 'perfect';
          break;
        }
        step(p, DT, null);
      }
      if (!moved) continue;
      releases++;
      expect(p.move?.perfect).toBe(true);
      // the ring judged is the tackler's whose commit was nearest the touch: he's the one beaten
      const beaten = p.events.filter((e) => e.startsWith('stumble:')).map((e) => p.bodies[Number(e.slice(8))]);
      expect(beaten).toHaveLength(1);
      d = beaten[0];
      const until = p.t + STUMBLE - 1e-6;
      // he's on the turf: he can't tackle anyone while he's down
      while (!p.end && p.t < until) {
        expect(d.act).toBe('down');
        expect(d.stunUntil).toBeGreaterThan(p.t);
        step(p, DT, null);
      }
      expect(d.act).toBe('down');
    }
    expect(offered).toBeGreaterThanOrEqual(RELEASES);
    expect(releases).toBe(RELEASES);
  }, 600_000);

  it('never offers gold in an amber or red state: pressure, a tight man, off his path or past the arm', () => {
    let golds = 0;
    let ambers = 0;
    let reds = 0;
    for (let i = 0; i < 400; i++) {
      const s = pocketAt('honest:' + i);
      if (!s) continue;
      const { p, r } = s;
      for (let k = 0; k < 12; k++) {
        const aim = { x: 2 + r() * (FIELD_W - 4), y: p.los - 3 + r() * 55 };
        const out = r() < 0.15;
        const w = slingWindow(p, aim, out);
        if (!w) continue;
        if (out) {
          expect(w.w.state).toBe('red');
          expect(w.dial).toBe('RANGE');
          // red is never PERFECT, wherever it's released
          expect(judge(w.w.center, w.w)).toBe('good');
          reds++;
          continue;
        }
        if (w.w.state === 'gold') {
          checkGold(p, aim);
          golds++;
        } else {
          expect(judge(w.w.center, w.w)).not.toBe('perfect');
          ambers++;
        }
      }
      // a real rush with nobody's fire: no gold anywhere
      p.pressure = 0.6;
      p.fire = false;
      for (const b of p.bodies.filter((b) => b.side === 'O' && b.job === 'route')) {
        const w = slingWindow(p, aheadOf(p, b, 0.3));
        if (w) expect(w.w.state).not.toBe('gold');
      }
    }
    expect(golds).toBeGreaterThan(0);
    expect(ambers).toBeGreaterThan(0);
    expect(reds).toBeGreaterThan(0);
  }, 120_000);

  it('a tap throw takes the good path: no ring, no PERFECT, the ordinary accuracy', () => {
    const s = pocketAt('tap:1') ?? pocketAt('tap:2');
    expect(s).not.toBeNull();
    const { p } = s!;
    const b = p.bodies.find((x) => x.side === 'O' && x.job === 'route')!;
    expect(throwTo(p, aheadOf(p, b, 0))).toBe(true);
    expect(p.ring).toBeUndefined();
    expect(p.ball?.sure).toBeUndefined();
    expect(p.pf ?? []).toEqual([]);
  });

  it('windows are by the player: a 95 passer and back get wider gold than a 70 one', () => {
    expect(slingHalf(passer(95), 12, 10, false)).toBeGreaterThan(slingHalf(passer(70), 12, 10, false) * 1.4);
    expect(jukeHalf(back(95), false)).toBeGreaterThan(jukeHalf(back(70), false) * 1.4);
    expect(windowHalf(0, 1, false)).toBe(MIN_HALF);
  });
});
