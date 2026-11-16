// Claude, 2026-11-16 (studio overhaul, team ut): haptics.ts lets a haptic through only inside the
// player's own input event, with the three V2 patterns, and never from a timer (on iOS a vibrate from
// a timer is replayed on the next, unrelated tap). The real sound.ts `vibrate` sits underneath, so the
// Haptics setting is tested end to end.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (e: Event) => void;
/** A minimal browser window: `event` is set only while an event is dispatched, as browsers do. */
const fakeWindow = {
  event: undefined as Event | undefined,
  listeners: new Map<string, Listener[]>(),
  addEventListener(type: string, fn: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  },
};
const vibrateSpy = vi.fn((_p: number | number[]) => true);
const fakeNavigator: { userAgent: string; platform: string; vibrate?: typeof vibrateSpy; userActivation?: { isActive: boolean } } = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130',
  platform: 'Linux armv8l',
  vibrate: vibrateSpy,
};

/** Dispatch one input event the way a browser does: capture listeners, then the app's handler. */
function dispatch(type: string, handler: () => void, trusted = true) {
  const e = { type, isTrusted: trusted } as Event;
  fakeWindow.event = e;
  try {
    for (const fn of fakeWindow.listeners.get(type) ?? []) fn(e);
    handler();
  } finally {
    fakeWindow.event = undefined;
  }
}

let h: typeof import('./haptics');
let sound: typeof import('./sound');

beforeAll(async () => {
  vi.stubGlobal('window', fakeWindow);
  vi.stubGlobal('navigator', fakeNavigator);
  sound = await import('./sound');
  h = await import('./haptics');
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
beforeEach(() => {
  vibrateSpy.mockClear();
  sound.setFeedback(false, true);
  fakeNavigator.vibrate = vibrateSpy;
  fakeNavigator.userActivation = undefined;
  fakeNavigator.userAgent = 'Mozilla/5.0 (Linux; Android 14) Chrome/130';
  fakeNavigator.platform = 'Linux armv8l';
  if (!('event' in fakeWindow)) (fakeWindow as { event?: Event }).event = undefined;
});

describe('the three patterns, from inside an input handler', () => {
  it('tick 8 ms, double 12-40-12, long 30 ms', () => {
    dispatch('pointerdown', () => h.haptic('tick'));
    dispatch('click', () => h.haptic('double'));
    dispatch('keydown', () => h.haptic('long'));
    expect(vibrateSpy.mock.calls).toEqual([[8], [[12, 40, 12]], [30]]);
  });
  it('every gesture event type a control answers counts', () => {
    for (const t of ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'keydown']) dispatch(t, () => h.haptic('tick'));
    expect(vibrateSpy).toHaveBeenCalledTimes(8);
  });
  it('the pattern table is the one V2 B.0.5 asks for and cannot be changed by a caller', () => {
    expect(h.HAPTIC_PATTERN).toEqual({ tick: 8, double: [12, 40, 12], long: 30 });
    dispatch('click', () => h.haptic('double'));
    (vibrateSpy.mock.calls[0][0] as number[]).push(99);
    expect(h.HAPTIC_PATTERN.double).toEqual([12, 40, 12]);
  });
});

describe('never from a timer', () => {
  it('0 vibrate calls across 100 timer callbacks, even ones scheduled from inside a tap', () => {
    vi.useFakeTimers();
    let fired = 0;
    const later = (kind: 'tick' | 'double' | 'long') => () => {
      fired++;
      h.haptic(kind);
    };
    // 40 timeouts scheduled by a tap handler (0-390 ms later, well inside any "recent touch" window)
    dispatch('pointerdown', () => {
      for (let i = 0; i < 40; i++) setTimeout(later(i % 3 ? 'tick' : 'long'), i * 10);
    });
    expect(vibrateSpy).not.toHaveBeenCalled();
    // an interval (a count-up's beat) for 30 ticks, and 30 animation-frame-like callbacks
    const iv = setInterval(later('tick'), 16);
    for (let i = 0; i < 30; i++) setTimeout(later('double'), 500 + i * 16);
    vi.advanceTimersByTime(480);
    clearInterval(iv);
    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
    expect(fired).toBe(100);
    expect(vibrateSpy).not.toHaveBeenCalled();
  });
  it('before haptics.ts: the same 100 timer callbacks through sound.ts vibrate directly vibrate 100 times', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 100; i++) setTimeout(() => sound.vibrate(8), i * 10);
    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
    expect(vibrateSpy).toHaveBeenCalledTimes(100);
  });
  it('a promise that settles after the tap is not part of the tap', async () => {
    let p: Promise<void> = Promise.resolve();
    dispatch('click', () => {
      p = Promise.resolve().then(() => h.haptic('long'));
    });
    await p;
    expect(vibrateSpy).not.toHaveBeenCalled();
  });
  it('synthetic (untrusted) events and non-input events do nothing', () => {
    dispatch('click', () => h.haptic('tick'), false);
    for (const t of ['scroll', 'visibilitychange', 'message', 'animationend', 'transitionend', 'load']) dispatch(t, () => h.haptic('tick'));
    h.haptic('tick');
    expect(vibrateSpy).not.toHaveBeenCalled();
  });
});

describe('the Haptics setting (sound.ts setFeedback) turns every pattern off', () => {
  it('off: 0 calls inside a real tap; on again: the tap ticks', () => {
    sound.setFeedback(false, false);
    dispatch('pointerdown', () => (h.haptic('tick'), h.haptic('double'), h.haptic('long')));
    expect(vibrateSpy).not.toHaveBeenCalled();
    sound.setFeedback(false, true);
    dispatch('pointerdown', () => h.haptic('tick'));
    expect(vibrateSpy).toHaveBeenCalledTimes(1);
  });
});

describe('engines without window.event: the recent-input window and user activation', () => {
  const withoutEvent = (fn: () => void) => {
    const w = fakeWindow as { event?: Event };
    delete w.event;
    try {
      fn();
    } finally {
      w.event = undefined;
    }
  };
  it('allowed within GESTURE_WINDOW_MS of an input, dropped after it', () => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout'] });
    withoutEvent(() => {
      for (const fn of fakeWindow.listeners.get('pointerdown') ?? []) fn({ type: 'pointerdown', isTrusted: true } as Event);
      h.haptic('tick');
      vi.advanceTimersByTime(h.GESTURE_WINDOW_MS + 1);
      h.haptic('tick');
    });
    vi.useRealTimers();
    expect(vibrateSpy).toHaveBeenCalledTimes(1);
  });
  it('a pointerup or touchend also opens the window (the click after a long press counts)', () => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout'] });
    withoutEvent(() => {
      for (const fn of fakeWindow.listeners.get('pointerdown') ?? []) fn({ type: 'pointerdown', isTrusted: true } as Event);
      vi.advanceTimersByTime(h.GESTURE_WINDOW_MS + 500);
      for (const t of ['pointerup', 'touchend']) for (const fn of fakeWindow.listeners.get(t) ?? []) fn({ type: t, isTrusted: true } as Event);
      h.haptic('tick');
    });
    vi.useRealTimers();
    expect(vibrateSpy).toHaveBeenCalledTimes(1);
  });
  it('an inactive user-activation flag vetoes it', () => {
    fakeNavigator.userActivation = { isActive: false };
    withoutEvent(() => {
      for (const fn of fakeWindow.listeners.get('pointerdown') ?? []) fn({ type: 'pointerdown', isTrusted: true } as Event);
      h.haptic('tick');
    });
    expect(vibrateSpy).not.toHaveBeenCalled();
  });
  it('the window sits inside sound.ts iOS gesture window (900 ms), so iOS never queues a tick', () => {
    expect(h.GESTURE_WINDOW_MS).toBeLessThan(900);
  });
});

describe('hapticsAvailable', () => {
  it('a vibration API, or an iPhone/iPad (switch tick), or nothing', () => {
    expect(h.hapticsAvailable()).toBe(true);
    fakeNavigator.vibrate = undefined;
    expect(h.hapticsAvailable()).toBe(false);
    fakeNavigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)';
    expect(h.hapticsAvailable()).toBe(true);
  });
});

describe('source rules', () => {
  it('haptics.ts never calls navigator.vibrate itself: it goes through sound.ts vibrate', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync(p: URL, e: 'utf8'): string };
    const src = fs.readFileSync(new URL('./haptics.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/navigator\.vibrate\(|\.vibrate\(/);
    expect(src).toMatch(/import \{ vibrate \} from '\.\/sound'/);
  });
});
