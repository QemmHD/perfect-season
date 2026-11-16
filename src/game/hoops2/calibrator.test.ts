// The 4-tap calibration (TimingCalibrator.tsx on perfect.ts `calibrate`): taps matched to their
// beats, the offset and the spread, strays dropped.
import { calibrate } from '../perfect';
import { BEAT_MS, beatsFor, LEAD, TAPS } from './TimingCalibrator';

describe('timing calibration', () => {
  const start = 10_000;
  const beat = (k: number) => start + (LEAD + k) * BEAT_MS;
  it('each tap goes against the beat nearest it, of the four to tap', () => {
    expect(TAPS).toBe(4);
    const taps = [beat(0) + 20, beat(1) - 15, beat(2) + 35, beat(3) + 8];
    expect(beatsFor(taps, start)).toEqual([beat(0), beat(1), beat(2), beat(3)]);
    // a tap in the count-in still goes against the first beat; a late one the last
    expect(beatsFor([start + 10, beat(3) + BEAT_MS * 2], start)).toEqual([beat(0), beat(3)]);
  });
  it('a steady thumb: its offset and spread', () => {
    const taps = [beat(0) + 30, beat(1) + 20, beat(2) + 40, beat(3) + 30];
    const r = calibrate(taps, beatsFor(taps, start));
    expect(r.offsetMs).toBeCloseTo(30, 9);
    expect(r.sdMs).toBeCloseTo(8.165, 2);
    expect(r.kept).toBe(4);
  });
  it('a stray tap (over 150 ms off its beat) is dropped', () => {
    const taps = [beat(0) - 10, beat(1) + 260, beat(2) - 10, beat(3) - 10];
    const r = calibrate(taps, beatsFor(taps, start));
    expect(r.kept).toBe(3);
    expect(r.offsetMs).toBeCloseTo(-10, 9);
    expect(r.sdMs).toBeCloseTo(0, 9);
  });
});
