// Claude (studio overhaul nfl-4): football's hit-stop budget (feel.ts, V2 §B.0.5): a PERFECT juke
// holds the picture 50 ms, every stop is 33-120 ms (30 under reduced motion), and no more than 150 ms
// of them land in any second of real time.
import { describe, expect, it } from 'vitest';
import { Juice } from '../juice';
import { FEEL, HITSTOP_BUDGET, impact } from './feel';

describe('hit-stop (feel.ts)', () => {
  it('holds a PERFECT juke 50 ms, and every kind inside 33-120 ms', () => {
    const j = new Juice({ seed: 1 });
    expect(impact('juke', j, 1000, [])).toBe(50);
    expect(j.freezeUntil).toBe(1050);
    for (const ms of Object.values(FEEL)) {
      expect(ms).toBeGreaterThanOrEqual(33);
      expect(ms).toBeLessThanOrEqual(120);
    }
  });

  it('keeps to 150 ms in any second: a stop that would break it is cut to fit, or skipped', () => {
    const j = new Juice({ seed: 1 });
    const log: { at: number; ms: number }[] = [];
    expect(impact('truck', j, 0, log)).toBe(90);
    // 60 left: the big hit's 80 is cut to 60
    expect(impact('bighit', j, 100, log)).toBe(60);
    // nothing left in this second
    expect(impact('juke', j, 200, log)).toBe(0);
    // a second after the first stop, its 90 ms are back
    expect(impact('juke', j, 1000, log)).toBe(50);
    // never more than the budget in any 1,000 ms window
    let t = 2000;
    const live: { at: number; ms: number }[] = [];
    const held: { at: number; ms: number }[] = [];
    for (let i = 0; i < 200; i++, t += 37) {
      const ms = impact((['juke', 'truck', 'bighit', 'int'] as const)[i % 4], j, t, live);
      if (ms) held.push({ at: t, ms });
    }
    expect(held.length).toBeGreaterThan(10);
    for (let s = 2000; s < t; s += 10) {
      const inWindow = held.filter((h) => h.at >= s && h.at < s + 1000).reduce((n, h) => n + h.ms, 0);
      expect(inWindow).toBeLessThanOrEqual(HITSTOP_BUDGET);
    }
  });

  it('under reduced motion keeps the beat at 30 ms or less', () => {
    const j = new Juice({ reducedMotion: true, seed: 1 });
    expect(impact('juke', j, 0, [])).toBe(30);
    expect(impact('truck', j, 5000, [])).toBe(30);
  });
});
