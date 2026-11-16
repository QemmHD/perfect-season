// Feel (plan §3.13, §4.6): the haptic patterns and the PERFECT chime every sport calls. These are
// shims with the signatures ut's src/lib/haptics.ts and soccer's sound.ts additions will have; the
// lead swaps the imports at integration. Each call is also counted (`feelCount`), so tests and the
// dev-server probes can see that, say, the sprint edge fired exactly one tick.
import { sfx, tapHaptic, vibrate } from '../../lib/sound';

export type HapticPattern = 'tick' | 'double' | 'long' | 'heartbeat';

const PATTERN: Record<HapticPattern, number | number[]> = {
  tick: 8,
  double: [14, 60, 14],
  long: 45,
  heartbeat: [22, 110, 32]
};

export const feelCount: Record<HapticPattern | 'chime' | 'ringTick', number> = { tick: 0, double: 0, long: 0, heartbeat: 0, chime: 0, ringTick: 0 };

/**
 * A haptic. `inTouch`: called from inside the pointer handler itself, where iOS plays its tick
 * (outside a touch iOS queues it for the next one).
 */
export function haptic(p: HapticPattern, inTouch = false): void {
  feelCount[p]++;
  if (inTouch) tapHaptic(typeof PATTERN[p] === 'number' ? (PATTERN[p] as number) : 12);
  else vibrate(PATTERN[p]);
}

/** The PERFECT chime: until soccer's two-note `sfx.perfect(streak)` lands, the swish. */
export function chime(streak: number): void {
  feelCount.chime++;
  void streak;
  sfx.swish();
}

/** The ring-fill tick in the last 200 ms. */
export function ringTick(): void {
  feelCount.ringTick++;
  sfx.tick();
}
