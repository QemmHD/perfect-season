// Pause (plan §3.10): a paused match runs no timer callbacks at all, and each delayed step gets the
// time it had left when play resumes, in order.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PausableTimers } from './timers';

describe('pausable timers', () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
  };
  it('runs nothing for 10 s of pause, then each job after the time it had left', () => {
    const t = new PausableTimers(() => now);
    const fired: string[] = [];
    t.set(() => fired.push('next'), 700);
    t.set(() => fired.push('buzzer'), 1600);
    advance(500);
    t.pause();
    advance(10_000);
    expect(fired).toEqual([]);
    expect(t.fired).toBe(0);
    expect(t.pending).toBe(2);
    expect(t.resume()).toBe(10_000);
    advance(199);
    expect(fired).toEqual([]);
    advance(1);
    expect(fired).toEqual(['next']);
    advance(900);
    expect(fired).toEqual(['next', 'buzzer']);
    expect(t.fired).toBe(2);
  });
  it('a job set while paused waits for the resume; cancel and clear drop jobs', () => {
    const t = new PausableTimers(() => now);
    const fired: string[] = [];
    t.pause();
    t.set(() => fired.push('a'), 100);
    const cancel = t.set(() => fired.push('b'), 100);
    advance(1000);
    expect(fired).toEqual([]);
    cancel();
    t.resume();
    advance(100);
    expect(fired).toEqual(['a']);
    t.set(() => fired.push('c'), 50);
    t.clear();
    advance(100);
    expect(fired).toEqual(['a']);
    expect(t.pending).toBe(0);
  });
  it('pausing twice or resuming when running changes nothing', () => {
    const t = new PausableTimers(() => now);
    let n = 0;
    t.set(() => n++, 300);
    t.pause();
    advance(50);
    t.pause();
    expect(t.resume()).toBe(50);
    expect(t.resume()).toBe(0);
    advance(300);
    expect(n).toBe(1);
  });
});
