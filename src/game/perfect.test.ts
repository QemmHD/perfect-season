// perfect.ts, the shared gold ring (plan §4.4): the window maths, the judging, the touch clock and the
// 4-tap calibration. The engine's own rows (gold rates, honesty, range) are in hoops2/ring.test.ts.
import { calibrate, difficultyPart, fatigueOf, GOLD_FLOOR_MS, gameTimeAt, goldBase, judge, PART, STEP_WORDS, windowScale, WINDOW_CAP, type WindowPart } from './perfect';

const part = (id: string, mult: number): WindowPart => ({ id, mult });

describe('perfect.ts: the gold window', () => {
  it('the base runs 30 ms at 55 to 60 ms at 99, about 42 at THR_avg, +0.4 a point above 99 (at most +5)', () => {
    expect(goldBase(55)).toBe(30);
    expect(goldBase(40)).toBe(30);
    expect(goldBase(73)).toBeCloseTo(42.27, 2);
    expect(goldBase(85)).toBeCloseTo(50.45, 2);
    expect(goldBase(95)).toBeCloseTo(57.27, 2);
    expect(goldBase(99)).toBe(60);
    expect(goldBase(104)).toBeCloseTo(62, 6);
    expect(goldBase(150)).toBe(65);
  });

  it('windowScale is the product of the parts, capped at ×1.45 and ±90 ms, floored at ±30 ms last', () => {
    expect(windowScale(42, [])).toBe(42);
    expect(windowScale(40, [part('a', 1.2), part('b', 1.1)])).toBeCloseTo(52.8, 9);
    // the product caps at 1.45 before the base is applied
    expect(windowScale(50, [part('a', 2), part('b', 1.5)])).toBeCloseTo(72.5, 9);
    // and the half-width itself at 90
    expect(windowScale(65, [part('a', 1.4)])).toBe(WINDOW_CAP.ms);
    // the floor wins over any shrink
    expect(windowScale(30, [part('a', 0.1)])).toBe(GOLD_FLOOR_MS);
    expect(windowScale(0, [])).toBe(GOLD_FLOOR_MS);
  });

  it('the worst grow stack (THR 99, rhythm, On Fire, meter Off, Rookie) lands on ±87-90 ms and never past ×1.45', () => {
    const parts = [part('rhythm', PART.rhythm), part('fire', PART.fire), part('meterOff', PART.meterOff), difficultyPart(-0.5)];
    const w = windowScale(goldBase(99), parts);
    expect(w).toBeGreaterThanOrEqual(87);
    expect(w).toBeLessThanOrEqual(90);
    expect(w / goldBase(99)).toBeLessThanOrEqual(WINDOW_CAP.mult + 1e-9);
    // above 99 too: the ms cap holds
    expect(windowScale(goldBase(120), parts)).toBeLessThanOrEqual(90);
  });

  it('the floor holds after the worst shrink stack (Legend, light, pull-up, the most tired legs)', () => {
    const parts = [part('light', PART.light), difficultyPart(1), part('pullup', PART.pullup), fatigueOf(0.4).part, fatigueOf(0).part];
    for (const thr of [0, 40, 55, 73, 99]) expect(windowScale(goldBase(thr), parts)).toBe(GOLD_FLOOR_MS);
    // a strong shooter's shrunk window still sits on or above the floor
    expect(windowScale(goldBase(99), parts)).toBeGreaterThanOrEqual(GOLD_FLOOR_MS);
  });

  it('difficulty: ×1.25 / 1 / 0.9 / 0.8 for Rookie / Pro / All-Star / Legend, linear between, clamped', () => {
    expect(difficultyPart(-0.5).mult).toBe(1.25);
    expect(difficultyPart(0).mult).toBe(1);
    expect(difficultyPart(0.5).mult).toBeCloseTo(0.9, 9);
    expect(difficultyPart(1).mult).toBeCloseTo(0.8, 9);
    expect(difficultyPart(-3).mult).toBe(1.25);
    expect(difficultyPart(9).mult).toBeCloseTo(0.8, 9);
    expect(difficultyPart(0.25).mult).toBeCloseTo(0.95, 9);
  });

  it('fatigue: +15 ms later at 60% energy, +25 ms at 40%, none fresh; narrower down to ×0.85', () => {
    expect(fatigueOf(1)).toEqual({ part: { id: 'fatigue', mult: 1 }, lateMs: 0 });
    expect(fatigueOf(0.6).lateMs).toBeCloseTo(15, 9);
    expect(fatigueOf(0.4).lateMs).toBeCloseTo(25, 9);
    expect(fatigueOf(0.1).lateMs).toBe(25);
    expect(fatigueOf(0.4).part.mult).toBeCloseTo(0.85, 9);
    expect(fatigueOf(0.8).part.mult).toBeCloseTo(0.95, 9);
    let last = -1;
    for (let e = 1; e >= 0; e -= 0.05) {
      expect(fatigueOf(e).lateMs).toBeGreaterThanOrEqual(last);
      last = fatigueOf(e).lateMs;
    }
  });
});

describe('perfect.ts: judging a release', () => {
  const gold = { idealMs: 520, goldMs: 42, state: 'gold' as const };
  it('in gold only inside the half-width on a gold ring; the seven steps by how far past its edge', () => {
    expect(judge(gold, 0)).toMatchObject({ step: 0, inGold: true, word: 'PERFECT' });
    expect(judge(gold, -42)).toMatchObject({ inGold: true });
    expect(judge(gold, 42.5)).toMatchObject({ step: 1, inGold: false, word: 'SLIGHTLY LATE', dial: 'TIMING' });
    expect(judge(gold, -80)).toMatchObject({ step: -1, word: 'SLIGHTLY EARLY' });
    expect(judge(gold, -100)).toMatchObject({ step: -2, word: 'EARLY' });
    expect(judge(gold, 200)).toMatchObject({ step: 3, word: 'VERY LATE' });
    expect(STEP_WORDS[3]).toBe('PERFECT');
  });
  it('an amber or red ring is never PERFECT: a timed release reads ON TIME and names its dial', () => {
    expect(judge({ ...gold, state: 'amber', dial: 'PRESSURE' }, 0)).toMatchObject({ step: 0, inGold: false, word: 'ON TIME', dial: 'PRESSURE' });
    expect(judge({ ...gold, state: 'red', dial: 'RANGE' }, 5)).toMatchObject({ inGold: false, dial: 'RANGE' });
    expect(judge({ ...gold, state: 'amber' }, 0).dial).toBe('PRESSURE');
  });
});

describe('perfect.ts: the touch clock', () => {
  it('a touch between two frames is placed at its own time; a far-off stamp falls back to now', () => {
    const c = { real: 1000, game: 3.5, acc: 0.004, rate: 1 };
    expect(gameTimeAt(c, 1010, 1012)).toBeCloseTo(3.514, 9);
    expect(gameTimeAt(c, 995, 1012)).toBeCloseTo(3.499, 9);
    // slow motion and a hit-stop
    expect(gameTimeAt({ ...c, rate: 0.35 }, 1010, 1012)).toBeCloseTo(3.5075, 9);
    expect(gameTimeAt({ ...c, rate: 0 }, 1010, 1012)).toBeCloseTo(3.504, 9);
    // a stamp on another clock (more than a second away): taken as now
    expect(gameTimeAt(c, 1e9, 1012)).toBeCloseTo(3.516, 9);
  });
});

describe('perfect.ts: the 4-tap calibration', () => {
  it('the mean offset and spread of the taps, outliers past 150 ms dropped', () => {
    const beats = [1000, 1650, 2300, 2950];
    const r = calibrate([1030, 1670, 2330, 2970], beats);
    expect(r.offsetMs).toBeCloseTo(25, 9);
    expect(r.sdMs).toBeCloseTo(5.7735, 3);
    expect(r.kept).toBe(4);
    const o = calibrate([1030, 1670, 2600, 2970], beats);
    expect(o.kept).toBe(3);
    expect(o.offsetMs).toBeCloseTo(23.333, 2);
    expect(calibrate([], [])).toEqual({ offsetMs: 0, sdMs: 0, kept: 0 });
    expect(calibrate([1500], [1000])).toEqual({ offsetMs: 0, sdMs: 0, kept: 0 });
    expect(calibrate([990], [1000])).toEqual({ offsetMs: -10, sdMs: 0, kept: 1 });
  });
});
