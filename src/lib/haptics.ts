// Claude, 2026-11-16 (studio overhaul, team ut, Game Design V2 B.0.5; docs/studio-overhaul/ut.md W2):
// three haptic patterns with one meaning each, and a gate that lets a haptic through only while the
// player's own touch, click or key press is being handled.
//
//   tick   = input accepted (a claim, a button, a pass)
//   double = PERFECT
//   long   = a score, a big hit, a pack
//
// Why the gate: iOS has no vibration API. sound.ts plays a tick by toggling a hidden switch, which
// WebKit only honours inside a real touch, so a vibrate asked for by a timer is queued and played on
// the player's NEXT touch, which is usually an unrelated tap. Here a haptic asked for outside an input
// event (a timer, a promise, an animation frame, a count-up) is simply dropped, never queued: timer-
// driven beats use sound only. It wraps sound.ts's `vibrate` unchanged, so the Haptics setting
// (sound.ts `setFeedback`) still turns every pattern off.
import { vibrate } from './sound';

export type Haptic = 'tick' | 'double' | 'long';

/** The vibration patterns, in ms (Android and desktop; iOS plays one tick for any of them). */
export const HAPTIC_PATTERN: Readonly<Record<Haptic, number | readonly number[]>> = {
  tick: 8,
  double: [12, 40, 12],
  long: 30,
};

/** The input events a haptic may answer (the ones browsers treat as the player's own gesture). */
const GESTURES = new Set(['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'keydown']);
/**
 * Where an engine has no `window.event`: a haptic counts as part of a gesture for this long after
 * the last input. Kept inside sound.ts's own 900 ms gesture window, so iOS plays the tick at once and
 * never queues it for a later touch.
 */
export const GESTURE_WINDOW_MS = 800;

interface Win {
  event?: Event;
  addEventListener?: (type: string, fn: (e: Event) => void, opts: AddEventListenerOptions) => void;
}
const win = (): Win | undefined => (globalThis as { window?: Win }).window;
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

let lastInput = -Infinity;
let listening = false;
function listen() {
  const w = win();
  if (listening || !w?.addEventListener) return;
  listening = true;
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown'])
    w.addEventListener(
      type,
      (e) => {
        if (e.isTrusted !== false) lastInput = clock();
      },
      { capture: true, passive: true },
    );
}
listen();

/**
 * True only while a trusted input event is being dispatched (the code runs inside the handler of
 * the player's touch, click or key press). In an engine without `window.event`, the fallback is the
 * user-activation flag where present and an input in the last GESTURE_WINDOW_MS.
 */
export function gestureActive(): boolean {
  const w = win();
  if (!w) return false;
  listen();
  if ('event' in w) {
    const e = w.event;
    return !!e && e.isTrusted !== false && GESTURES.has(e.type);
  }
  const ua = (globalThis.navigator as (Navigator & { userActivation?: { isActive: boolean } }) | undefined)?.userActivation;
  if (ua && !ua.isActive) return false;
  return clock() - lastInput <= GESTURE_WINDOW_MS;
}

/** Whether this device can play a haptic at all (a vibration API, or an iPhone's switch tick). */
export function hapticsAvailable(): boolean {
  const nav = globalThis.navigator as (Navigator & { maxTouchPoints?: number }) | undefined;
  if (!nav) return false;
  if (typeof nav.vibrate === 'function') return true;
  return /iP(hone|ad|od)/.test(nav.userAgent ?? '') || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
}

/**
 * Play one of the three patterns, if the player is touching the screen right now and has haptics
 * on. Call it from the input handler itself, never from a timer; from anywhere else it does
 * nothing. For a button, call it from onClick (a finished tap), not onPointerDown: a pointerdown may
 * be the start of a scroll, and a scroll must never buzz.
 */
export function haptic(kind: Haptic): void {
  if (!gestureActive()) return;
  const p = HAPTIC_PATTERN[kind];
  vibrate(typeof p === 'number' ? p : [...p]);
}
