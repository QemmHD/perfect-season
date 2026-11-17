// players-5: locomotion without skating (A-5, research R4-R6). Pure: the stride picker, the planted
// foot, the turns, the lean and the head's bob, on the recorded clips' real metadata.
import { clipMeta } from './mocap';
import { ANCHOR_CAP, anchorStep, bodyMotion, freshLoco, headBob, inContact, leanOf, pickGait, RATE_MAX, RATE_MIN, SLIDE_TOL, stepClock, strideVelocity, turnToward, type GaitOption } from './locomotion';

const deg = Math.PI / 180;
// a 6'6" guard's forward strides in ft/s (legScale ≈ 0.42 for the sprite's legs)
const FT = 0.42 * 6.5;
const forward: GaitOption[] = ['walk', 'jog', 'run', 'sprint'].map((c) => ({ clip: c, speed: clipMeta(c).root.speed * FT }));

describe('the stride for a speed', () => {
  it('plays every stride at 0.8-1.25x, and the feet cover the ground within 15% from a slow drift to a sprint', () => {
    const lo = forward[0].speed * RATE_MIN * 0.25;
    const hi = forward[3].speed * RATE_MAX;
    let n = 0;
    for (let v = lo * 1.01; v <= hi; v *= 1.02) {
      const g = pickGait(v, forward);
      expect(g.rate).toBeGreaterThanOrEqual(RATE_MIN);
      expect(g.rate).toBeLessThanOrEqual(RATE_MAX);
      expect(Math.abs(Math.log(g.match))).toBeLessThanOrEqual(SLIDE_TOL);
      n++;
    }
    expect(n).toBeGreaterThan(100);
  });
  it('walks below the jog and shortens the step only below the walk', () => {
    expect(pickGait(forward[0].speed, forward)).toMatchObject({ clip: 'walk', rate: 1, stride: 1 });
    expect(pickGait(forward[1].speed * 0.95, forward).clip).toBe('jog');
    const slow = pickGait(forward[0].speed * 0.4, forward);
    expect(slow.clip).toBe('walk');
    expect(slow.rate).toBe(RATE_MIN);
    expect(slow.stride).toBeLessThan(1);
  });
});

describe('the planted foot', () => {
  const H = 6.5;
  const artPerUnit = 34 / H;
  it('holds within 1 art px at 34 art px through each contact beat, and never strays more than 5% of his height', () => {
    const meta = clipMeta('jog');
    for (const mismatch of [0.9, 0.97, 1.1, 1.14]) {
      const s = freshLoco(0);
      const speed = meta.root.speed * FT * mismatch;
      const pick = pickGait(meta.root.speed * FT, forward);
      let frac = 0;
      let beatSlide = 0;
      let wasContact = false;
      let worstBeat = 0;
      for (let f = 0; f < 600; f++) {
        const dt = 1 / 60;
        frac = (frac + dt / meta.duration) % 1;
        const ct = frac * meta.duration;
        const contact = inContact(meta, ct);
        if (contact && !wasContact) beatSlide = 0;
        wasContact = contact;
        const sv = strideVelocity(0, { meta, ct, pick, unitsPerLeg: FT });
        beatSlide += anchorStep(s, speed - sv.x, -sv.y, Math.hypot(sv.x, sv.y) * dt, dt, contact, false, ANCHOR_CAP * H);
        if (contact) worstBeat = Math.max(worstBeat, beatSlide);
        expect(Math.hypot(s.ox, s.oy)).toBeLessThanOrEqual(ANCHOR_CAP * H + 1e-9);
      }
      expect(worstBeat * artPerUnit).toBeLessThanOrEqual(1);
    }
  });
  it('lets go in the air: the offset decays to nothing', () => {
    const s = freshLoco(0);
    s.ox = 0.3;
    for (let f = 0; f < 60; f++) anchorStep(s, 0, 0, 0, 1 / 60, false, true, 0.33);
    expect(Math.abs(s.ox)).toBeLessThan(1e-3);
  });
  it('finds the contact beats from the clips\' footfalls', () => {
    const m = clipMeta('walk');
    expect(m.beats?.stepL?.length).toBe(1);
    expect(m.beats?.stepR?.length).toBe(1);
    expect(inContact(m, m.beats!.stepR![0] + 0.02)).toBe(true);
  });
});

describe('turns', () => {
  const run = (to: number) => {
    const s = freshLoco(0);
    let t = 0;
    const out: { face: number; cls: string; dip: boolean; lead: number }[] = [];
    for (let f = 0; f < 40; f++) {
      t += 1 / 60;
      s.t = t;
      out.push(turnToward(s, to, 1 / 60, t));
    }
    return out;
  };
  const doneAt = (fr: { face: number }[], to: number) => fr.findIndex((f) => Math.abs(f.face - to) < 1e-6) + 1;
  it('glides under 45°, plants 45-120° with a dip, chops and plants past 120°', () => {
    expect(run(30 * deg)[0].cls).toBe('glide');
    expect(run(30 * deg).some((f) => f.dip)).toBe(false);
    const plant = run(90 * deg);
    expect(plant[0].cls).toBe('plant');
    expect(plant.filter((f) => f.dip).length).toBeGreaterThanOrEqual(5);
    expect(plant.filter((f) => f.dip).length).toBeLessThanOrEqual(7);
    expect(run(170 * deg)[0].cls).toBe('shuffle');
  });
  it('takes 80-120 ms per 90°, and never more than one of 16 facings a frame', () => {
    const ms90 = (doneAt(run(90 * deg), 90 * deg) / 60) * 1000;
    expect(ms90).toBeGreaterThanOrEqual(80);
    expect(ms90).toBeLessThanOrEqual(120);
    const ms180 = (doneAt(run(Math.PI - 1e-3), Math.PI - 1e-3) / 60) * 1000;
    expect(ms180).toBeGreaterThan(ms90 * 2 * 0.95);
    const fr = run(170 * deg);
    for (let i = 1; i < fr.length; i++) expect(Math.abs(fr[i].face - fr[i - 1].face)).toBeLessThanOrEqual((2 * Math.PI) / 16 + 1e-9);
  });
  it('leads with the head by one frame while a real turn is left (over 20°)', () => {
    const to = 90 * deg;
    const fr = run(to);
    let led = 0;
    for (let i = 0; i + 1 < fr.length && fr[i + 1].face !== fr[i].face; i++) {
      if (to - fr[i].face > 20 * deg) {
        expect(fr[i].face + fr[i].lead).toBeCloseTo(fr[i + 1].face, 9);
        led++;
      } else expect(fr[i].lead).toBe(0);
    }
    expect(led).toBeGreaterThanOrEqual(3);
  });
});

describe('lean and bob', () => {
  it('leans back 6° for 4-6 frames on a hard brake, forward up to 12° into a burst', () => {
    const s = freshLoco(0);
    let t = 0;
    const top = 20;
    leanOf(s, 18, 0, 0, 1 / 60, (t += 1 / 60), 0, top);
    const back: number[] = [];
    for (let f = 0; f < 12; f++) back.push(leanOf(s, f === 0 ? 4 : 4, 0, 0, 1 / 60, (t += 1 / 60), 0, top).fwd);
    const n = back.filter((a) => Math.abs(a + 6 * deg) < 1e-9).length;
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(6);
    // a burst: 0 to 20 ft/s in a third of a second leans him in, never past 12°
    const s2 = freshLoco(0);
    let most = 0;
    for (let f = 0; f <= 20; f++) most = Math.max(most, leanOf(s2, f, 0, 0, 1 / 60, 0.1 + f / 60, 0, top).fwd);
    expect(most).toBeGreaterThan(5 * deg);
    expect(most).toBeLessThanOrEqual(12 * deg + 1e-9);
  });
  it('bobs the head -1, -1, +2 art px through a stride at 34 art px', () => {
    expect([0.1, 0.45, 0.8].map((f) => headBob(f, 34))).toEqual([-1, -1, 2]);
    expect(headBob(0.8, 20)).toBe(0);
  });
});

describe('the motion clock', () => {
  it('starts again on a step back or a jump over 0.25 s, holds on a frozen frame', () => {
    const s = freshLoco(0);
    expect(stepClock(s, 1, 0).reset).toBe(true);
    expect(stepClock(s, 1 + 1 / 60, 0)).toEqual({ dt: expect.closeTo(1 / 60, 9), reset: false });
    expect(stepClock(s, 1 + 1 / 60, 0)).toEqual({ dt: 0, reset: false });
    s.ox = 0.2;
    expect(stepClock(s, 0.5, 1).reset).toBe(true);
    expect(s.ox).toBe(0);
    expect(s.face).toBe(1);
    expect(stepClock(s, 0.9, 2).reset).toBe(true);
  });
  it('keeps the drawn body within 5% of his height whatever the stride', () => {
    const s = freshLoco(0);
    const meta = clipMeta('jog');
    let t = 0;
    for (let f = 0; f < 300; f++) {
      t += 1 / 60;
      const ct = (t % meta.duration);
      stepClock(s, t, 0);
      const m = bodyMotion(s, { t, dt: f ? 1 / 60 : 0, vx: 20, vy: 3, face: 0, turnRate: 0, top: 20, height: 6.5, airborne: false, stride: { meta, ct, pick: { clip: 'jog', rate: 0.8, stride: 1, reverse: false, match: 1 }, unitsPerLeg: FT } });
      expect(Math.hypot(m.ox, m.oy)).toBeLessThanOrEqual(ANCHOR_CAP * 6.5 + 1e-9);
    }
  });
});
