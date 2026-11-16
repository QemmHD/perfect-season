// nba-2's engine side of the controls (plan §5): the provisional gather on SHOOT, the pump fake and
// "make him land", a swipe that takes the gather back for free, the euro-step on a drive, PASS held
// for a lob, and ISO getting the ball to the top-usage card. Plus the guard that none of it touches
// the AI's race: the autopilot's games come out byte-identical to before nba-2.
import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/rng';
import { autoplay } from './autopilot';
import { callPlay, cancelGather, contestOf, crossover, driving, euroStep, GATHER_S, isoStar, newPossession, pass, PUMP_EVERY, pressShoot, pumpFake, releaseShoot, RIM, step, UNRISE_S, unrise } from './engine';
import { newHoopsGame, POSSESSIONS } from './game';
import { synthSquad } from './harness';
import { liftShoot, offOf, slotsFor } from './HoopsControls';
import type { Hooper, Possession } from './types';

const DT = 1 / 60;
const man = (id: number, o: Partial<Hooper> = {}): Hooper => ({
  id: 't' + id,
  name: 'Test ' + id,
  tag: 'T' + id,
  num: id,
  ht: 78,
  wt: 215,
  pos: ['PG', 'SG', 'SF', 'PF', 'C'][id % 5],
  ovr: 80,
  spd: 80,
  acc: 80,
  hnd: 80,
  pas: 80,
  thr: 80,
  mid: 80,
  cls: 80,
  lay: 80,
  ft: 80,
  ddk: 60,
  sdk: 50,
  str: 75,
  vrt: 75,
  sta: 85,
  prd: 75,
  ind: 75,
  stl: 70,
  blk: 70,
  reb: 70,
  abil: [],
  ...o
});
const poss = (seed = 1, off: Partial<Hooper>[] = [], def: Partial<Hooper>[] = []) => {
  const p = newPossession(
    [0, 1, 2, 3, 4].map((i) => man(i, off[i])),
    [5, 6, 7, 8, 9].map((i) => man(i, def[i - 5])),
    [1, 1, 1, 1, 1],
    rng(seed)
  );
  p.scheme = 'man';
  return p;
};
/** the handler at the top of the key with his man a step off him */
const squareUp = (p: Possession, gap = 3) => {
  const h = p.bodies[p.handler!];
  Object.assign(h, { cx: RIM.cx - 22, cz: 0, vx: 0, vz: 0 });
  const d = p.bodies.find((b) => b.side === 'D' && b.mark === h.idx)!;
  Object.assign(d, { cx: RIM.cx - 22 + gap, cz: 0, vx: 0, vz: 0 });
  for (let i = 0; i < 6; i++) step(p, DT, null);
  return { h, d };
};

describe('the provisional gather (SHOOT down)', () => {
  it('runs the meter from the touch but stays on the floor until GATHER_S, then rises', () => {
    const p = poss();
    const { h } = squareUp(p);
    const at = p.t - 0.03;
    pressShoot(p, { at, provisional: true });
    expect(p.meter?.gather).toBe(true);
    expect(p.meter?.t0).toBeCloseTo(at, 9);
    for (let i = 0; i < 4; i++) step(p, DT, null);
    expect(h.h).toBe(0);
    // he rises GATHER_S after the touch was heard (the handler's clock), not after the backdated t0
    while (p.t - p.meter!.gatherAt! < GATHER_S + DT) step(p, DT, null);
    expect(p.meter?.gather).toBeUndefined();
    expect(h.h).toBeGreaterThan(0);
  });
  it('a swipe takes the gather back for free: no shot, no time, and the move goes at once', () => {
    const p = poss(3);
    const { h } = squareUp(p, 6);
    const clock = p.clock;
    pressShoot(p, { at: p.t, provisional: true });
    step(p, DT, null);
    step(p, DT, null);
    expect(cancelGather(p)).toBe(true);
    expect(p.meter).toBeNull();
    expect(h.h).toBe(0);
    expect(p.lastShot).toBeNull();
    crossover(p, 1);
    expect(h.act).toBe('cross');
    expect(h.lastMoveAt).toBe(p.t);
    // only the two frames that passed: the cancel itself cost nothing
    expect(clock - p.clock).toBeCloseTo(2 * DT, 6);
  });
  it('letting go before he even left the floor still shoots (an early release), never a free cancel', () => {
    const p = poss(4);
    squareUp(p, 8);
    pressShoot(p, { at: p.t, provisional: true });
    step(p, DT, null);
    releaseShoot(p);
    expect(p.lastShot?.off).toBeLessThan(-0.5);
    expect(p.ball?.kind === 'shot' || p.ball?.kind === 'loose').toBe(true);
  });
});

describe('a tap is a pump fake even when its lift is heard late (review fix)', () => {
  // The real timeline: the finger goes down at T; the page hears it L ms later (the down handler
  // starts the gather, its meter backdated to T); the finger lifts at T + tap; the page hears the
  // lift a frame or three later than it heard the down. Before the fix the jumper rose at T + 125 ms
  // on the meter's backdated clock, and a 90-115 ms tap heard 35 ms late found him in the air: a shot.
  const run = (seed: number, tapMs: number, lagMs: number, lateFrames: number) => {
    const p = poss(seed);
    const { h, d } = squareUp(p);
    const heardDown = p.t;
    pressShoot(p, { at: heardDown - lagMs / 1000, provisional: true });
    const heardUp = heardDown + tapMs / 1000 + lateFrames * DT; // same lag on the lift, plus the late frames
    while (p.t < heardUp - 1e-9) step(p, DT, null);
    const out = liftShoot(p, true);
    return { p, h, d, out };
  };
  it('90-115 ms taps heard 1-3 frames late, with 35 ms of handler lag: always a pump fake, never a shot', () => {
    let n = 0;
    for (const tapMs of [90, 95, 100, 105, 110, 113, 115])
      for (const late of [0, 1, 2, 3])
        for (const lagMs of [0, 35, 60]) {
          const { p, h, d, out } = run(40 + n++, tapMs, lagMs, late);
          expect(out).toBe('pump');
          expect(p.ball).toBeNull();
          expect(p.lastShot).toBeNull();
          expect(p.meter).toBeNull();
          expect(h.h).toBe(0);
          expect(h.act).toBe('pump');
          // the man who closed out with the rise came back down with it (he may still bite the fake)
          if (!p.events.some((e) => e.startsWith('pump:bit:'))) expect(d.h).toBe(0);
        }
  });
  it('the rise waits GATHER_S on the handler clock, not on the backdated meter', () => {
    const p = poss(7);
    const { h } = squareUp(p);
    pressShoot(p, { at: p.t - 0.06, provisional: true });
    // 7 frames = 117 ms of handler time: still on the floor, though the meter is already 177 ms old
    for (let i = 0; i < Math.floor(GATHER_S / DT); i++) step(p, DT, null);
    expect(h.h).toBe(0);
    expect(p.meter?.gather).toBe(true);
    step(p, DT, null);
    expect(p.meter?.gather).toBeUndefined();
    expect(h.h).toBeGreaterThan(0);
  });
  it('a hold still shoots; a lift heard after UNRISE_S, or once the shot is away, is never taken back', () => {
    const hold = (() => {
      const p = poss(8);
      squareUp(p);
      pressShoot(p, { at: p.t, provisional: true });
      for (let i = 0; i < 18; i++) step(p, DT, null);
      return liftShoot(p, false);
    })();
    expect(hold).toBe('release');
    const p = poss(9);
    squareUp(p);
    pressShoot(p, { at: p.t, provisional: true });
    while (p.meter?.gather) step(p, DT, null);
    const rose = p.t;
    while (p.t - rose <= UNRISE_S + DT) step(p, DT, null);
    expect(unrise(p)).toBe(false);
    expect(liftShoot(p, true)).toBe('release');
    releaseShoot(p);
    expect(unrise(p, 9)).toBe(false);
  });
});

describe('the pump fake (SHOOT tapped)', () => {
  it('never shoots, and one per 0.8 s', () => {
    const p = poss(5);
    const { h } = squareUp(p);
    pressShoot(p, { at: p.t, provisional: true });
    expect(pumpFake(p)).toBe(true);
    expect(p.meter).toBeNull();
    expect(p.ball).toBeNull();
    expect(h.act).toBe('pump');
    for (let i = 0; i < 20; i++) step(p, DT, null);
    expect(p.lastShot).toBeNull();
    expect(pumpFake(p)).toBe(false); // too soon
    while (p.t - h.pumpAt! < PUMP_EVERY) step(p, DT, null);
    expect(pumpFake(p)).toBe(true);
    expect(p.ball).toBeNull();
  });
  it('baits by rating: a great shooter on a poor defender draws far more bites than the reverse', () => {
    const bites = (thr: number, prd: number) => {
      let n = 0;
      for (let s = 0; s < 400; s++) {
        const p = poss(1000 + s, [{ thr, mid: thr }], [{ prd }]);
        squareUp(p);
        pumpFake(p);
        if (p.events.some((e) => e.startsWith('pump:bit:'))) n++;
      }
      return n / 400;
    };
    const hot = bites(95, 60);
    const cold = bites(55, 95);
    expect(hot).toBeGreaterThan(0.45);
    expect(cold).toBeLessThan(0.12);
  });
  it('makes him land: a man who bit and is in the air contests a tier lighter', () => {
    let checked = 0;
    for (let s = 0; s < 200 && checked < 20; s++) {
      const p = poss(2000 + s, [{ thr: 95, mid: 95 }], [{ prd: 60 }]);
      const { h, d } = squareUp(p, 1.6);
      const standing = contestOf(p, h);
      pumpFake(p);
      if (!p.events.some((e) => e.startsWith('pump:bit:'))) continue;
      for (let i = 0; i < 3; i++) step(p, DT, null);
      expect(d.h).toBeGreaterThan(0.2);
      const order = ['open', 'light', 'heavy', 'smothered'];
      const flying = contestOf(p, h);
      expect(order.indexOf(flying), standing + ' -> ' + flying).toBeLessThan(Math.max(1, order.indexOf(standing)));
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe('moves, the lob and ISO', () => {
  it('a swipe while driving at the rim is a euro-step', () => {
    const p = poss(7);
    const h = p.bodies[p.handler!];
    Object.assign(h, { cx: RIM.cx - 18, cz: 2, vx: 16, vz: -1 });
    expect(driving(p)).toBe(true);
    euroStep(p, 1);
    expect(h.act).toBe('euro');
    expect(h.lastMoveAt).toBe(p.t);
    expect(h.vx).toBeGreaterThan(5); // still going at the rim
  });
  it('PASS held is a lob: an alley-oop to a dunker near the rim, a lofted pass to anyone else', () => {
    const p = poss(8, [{}, { ddk: 92, vrt: 90 }, {}, {}, {}]);
    const big = p.bodies[1];
    Object.assign(big, { cx: RIM.cx - 8, cz: 4, vx: 0, vz: 0 });
    pass(p, 1, true);
    expect(p.ball?.kind).toBe('lob');
    const q = poss(9);
    pass(q, 2, true);
    expect(q.ball?.kind).toBe('pass');
    expect(q.ball?.high).toBe(true);
    for (let i = 0; i < 120 && q.ball; i++) step(q, DT, null);
    expect([2, null]).toContain(q.end ? null : q.handler); // caught, or (rarely) picked off
  });
  it('ISO gets the ball to the top-usage card within 2 s, and the other four clear out', () => {
    let got = 0;
    let cleared = 0;
    const N = 120;
    for (let s = 0; s < N; s++) {
      const off: Partial<Hooper>[] = [{}, {}, {}, {}, {}];
      const star = 1 + (s % 4);
      off[star] = { ovr: 94, thr: 90, mid: 92 };
      const p = poss(3000 + s, off);
      p.bodies[p.handler!].cx = RIM.cx - 26;
      expect(isoStar(p).idx).toBe(star);
      expect(callPlay(p, 'iso')).toBe(true);
      const t0 = p.t;
      while (p.t - t0 < 2 && !p.end && p.handler !== star) step(p, DT, null);
      if (p.handler !== star) continue;
      got++;
      // a second and a half on, the other four have cleared to the weak side (or the middle)
      const side = p.playCall?.side ?? 1;
      while (p.t - t0 < 3 && !p.end && p.handler === star && !p.ball) step(p, DT, null);
      const four = p.bodies.filter((b) => b.side === 'O' && b.idx !== star);
      if (four.filter((b) => Math.sign(b.cz) !== side || Math.abs(b.cz) < 4).length >= 3) cleared++;
    }
    expect(got / N).toBeGreaterThan(0.95);
    expect(cleared / got).toBeGreaterThan(0.8);
  });
});

describe('the NBA slots (plan §5)', () => {
  it('offense: A gold SHOOT with swipes and its labels, B teal PASS, C glass CALL, D hidden', () => {
    const s = slotsFor('offense');
    expect([s.A.label, s.A.tone, s.A.swipes, s.B.label, s.B.tone, s.C.label, s.C.tone, s.D.hidden]).toEqual(['SHOOT', 'gold', true, 'PASS', 'teal', 'CALL', 'glass', true]);
    expect(s.A.hints).toEqual({ up: 'SPIN', side: 'CROSS', down: 'STEP' });
  });
  it('a rebound race: A is BOARD, the rest hidden; dead ball: dimmed', () => {
    const b = slotsFor('board');
    expect([b.A.label, b.B.hidden, b.C.hidden, b.D.hidden]).toEqual(['BOARD', true, true, true]);
    const d = slotsFor('dead');
    expect([d.A.disabled, d.B.disabled, d.C.disabled]).toEqual([true, true, true]);
  });
  it('the dimmed state follows the play every frame', () => {
    const p = poss(11);
    expect(offOf(p, false)).toBe('');
    pass(p, 2);
    expect(offOf(p, false)).toBe('a b c');
    expect(offOf(null, false)).toBe('a b c');
  });
});

describe("the AI's race is untouched", () => {
  it('autopilot games come out exactly as before nba-2 (18 seeded games)', () => {
    // recorded from the engine at 0e788b1 (nba-1), before any nba-2 change; re-recorded at nba-4, whose gold
    // ring changes how shots go in (protocol bump needed: NBA draft + UT). nba-2's controls still change none of it.
    const GOLDEN =
      'a0.75:15:222XTOTO2X2XX2XXX3|a0.9:11:2TO3TOXXX2X2XTOXTO2TO|a0.5:15:XTO22TOX2TO322XXTO2X|b0.75:22:A2XTO22222A2XX2XTO|b0.9:16:X2TO2X2XTOX2X222TO2|b0.5:22:22222XX2222XXX22|c0.75:25:ATO223XTO23TOXX3232|c0.9:13:3XXXXTOX22TOX2X2TO2|c0.5:26:2TO2223222TO223TOX2|d0.75:22:222232XX222ATOTOTOX|d0.9:17:232TOXTO222X2TOXXX2|d0.5:21:X2X2X3222X222XTO2|e0.75:14:2XX22TOXX2XXX22TO2|e0.9:13:TOXXTOXTO23X2XX222TO|e0.5:14:2X22XTOXTOXXXX2222|f0.75:22:2TOTO2TO222222TOX222|f0.9:4:TOXTO2TOXTOTOXTO2TOXXXX|f0.5:16:22XXTOXTO2XX2222TO2';
    const out: string[] = [];
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const A = synthSquad('A' + seed);
      const B = synthSquad('B' + seed);
      for (const [skill, iq] of [
        [0.75, 0],
        [0.9, 0.6],
        [0.5, -0.3]
      ]) {
        const g = newHoopsGame(A.five, B.five, 'ai:' + seed, POSSESSIONS, A.bench, iq);
        autoplay(g, skill, 'ai:' + seed);
        out.push(seed + skill + ':' + g.score + ':' + g.marks.join(''));
      }
    }
    expect(out.join('|')).toBe(GOLDEN);
  });
});
