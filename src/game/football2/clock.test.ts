// Claude (nfl-2): the pause-aware clock. Paused, time stands still and nothing scheduled fires.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameClock } from './clock';

describe('GameClock', () => {
  let real = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    real = 1000;
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) => {
    real += ms;
    vi.advanceTimersByTime(ms);
  };

  it('stands still while paused and carries on from where it stopped', () => {
    const c = new GameClock(() => real);
    advance(500);
    expect(c.now()).toBe(1000 + 500 - 0);
    const before = c.now();
    expect(c.pause()).toBe(true);
    expect(c.pause()).toBe(false);
    advance(3000);
    expect(c.now()).toBe(before);
    expect(c.resume()).toBe(true);
    advance(200);
    expect(c.now()).toBe(before + 200);
  });

  it('holds a pending timer through a pause, firing it only after its remaining time', () => {
    const c = new GameClock(() => real);
    const fn = vi.fn();
    c.after(1000, fn);
    advance(600);
    c.pause();
    advance(5000);
    expect(fn).not.toHaveBeenCalled();
    c.resume();
    advance(399);
    expect(fn).not.toHaveBeenCalled();
    advance(2);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels, survives repeated pause and resume, and fires nothing after dispose', () => {
    const c = new GameClock(() => real);
    const a = vi.fn(),
      b = vi.fn();
    const ta = c.after(100, a);
    c.after(300, b);
    c.cancel(ta);
    for (let i = 0; i < 5; i++) {
      advance(40);
      c.pause();
      advance(1000);
      c.resume();
    }
    expect(b).not.toHaveBeenCalled();
    advance(101);
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    const d = vi.fn();
    c.after(50, d);
    c.dispose();
    advance(500);
    expect(d).not.toHaveBeenCalled();
    expect(c.resume()).toBe(false);
  });

  it('schedules from inside a timer, on the paused-aware clock', () => {
    const c = new GameClock(() => real);
    const order: number[] = [];
    c.after(100, () => {
      order.push(c.now());
      c.after(100, () => order.push(c.now()));
    });
    advance(100);
    c.pause();
    advance(1000);
    c.resume();
    advance(100);
    expect(order).toEqual([1100, 1200]);
  });
});
