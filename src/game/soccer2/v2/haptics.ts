// merge: replace with ut's src/lib/haptics.ts, then delete this file.
//
// Soccer's stand-in for the three V2 haptic patterns (Claude 2026-11-16, studio overhaul soccer-2;
// ut's interface: `haptic(kind)`): tick = input accepted, double = PERFECT, long = a goal or a big
// tackle. Like ut's, a haptic plays only inside the player's own touch (iOS would otherwise queue a
// timer's vibration for the next, unrelated tap), and it goes through sound.ts `vibrate`, so the
// Haptics setting still turns it off. `hapticCount` lets the tests and the lab QA see what fired.
import { vibrate } from '../../../lib/sound';
import type { HapticKind } from './index';

export const HAPTIC_PATTERN: Readonly<Record<HapticKind, number | readonly number[]>> = { tick: 8, double: [12, 40, 12], long: 30 };
const GESTURES = new Set(['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchend', 'touchmove', 'click', 'keydown']);

export const hapticCount: Record<HapticKind, number> = { tick: 0, double: 0, long: 0 };

/** A trusted input event is being handled right now (where the engine exposes `window.event`). */
function inGesture(): boolean {
  const w = (globalThis as { window?: { event?: Event } }).window;
  if (!w || !('event' in w)) return true;
  const e = w.event;
  return !!e && e.isTrusted !== false && GESTURES.has(e.type);
}

/** Play a pattern, if the player is touching the screen right now (call it from the input handler). */
export function haptic(kind: HapticKind): void {
  if (!inGesture()) return;
  hapticCount[kind]++;
  const p = HAPTIC_PATTERN[kind];
  vibrate(typeof p === 'number' ? p : [...p]);
}
