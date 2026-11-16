// The haptic for each thing that happens on the court (plan §3.13, V2 B.0.5): a `double` on every
// PERFECT (a release or a finish in the gold), a `long` on a score, a block or a turnover against you.
// Pure mapping plus one dispatcher, so the rule is tested without a phone (feel-events.test.ts):
// nothing plays while the game is paused.
import { haptic, type HapticPattern } from '../hud/feel';

/** The engine's PERFECT events: a jumper let go in the gold, a finish timed in it. */
export const PERFECT_EVENTS: ReadonlySet<string> = new Set(['release-green', 'finish-green']);

/** The patterns a batch of engine events asks for, in order. */
export function feelOf(events: readonly string[]): HapticPattern[] {
  const out: HapticPattern[] = [];
  for (const e of events) {
    if (PERFECT_EVENTS.has(e)) out.push('double');
    else if (e === 'end:make' || e.startsWith('blocked:')) out.push('long');
    else if (e === 'end:steal' || e === 'end:int' || e === 'end:clock' || e === 'end:out') out.push('long');
  }
  return out;
}

/**
 * Play a batch's haptics. `paused`: nothing at all. `doubleDone`: the release's PERFECT already
 * played its `double` inside the touch (iOS only plays a haptic there), so the first one is skipped.
 */
export function playFeel(events: readonly string[], o: { paused: boolean; doubleDone?: boolean }): HapticPattern[] {
  if (o.paused) return [];
  let skip = !!o.doubleDone;
  const played: HapticPattern[] = [];
  for (const pat of feelOf(events)) {
    if (pat === 'double' && skip) {
      skip = false;
      continue;
    }
    haptic(pat);
    played.push(pat);
  }
  return played;
}
