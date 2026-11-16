// Is the drawing ready? (studio overhaul players-3, plan §6.7.) A match's players need two things
// before the first frame: the sport's motion-capture clips (else hand-keyed stand-in poses show, then
// pop to the recorded motion) and its appearance data (else default looks show, then pop to the real
// ones). `pixelReady(sport)` loads both; select-<sport>.ts starts it (`preloadPixels`) as the game chunk
// is evaluated, long before the renderer's first frame, and `drawGate` holds the renderer's first
// frame until it's in. The gate never holds the game hostage: after GATE_MS, or if a load fails
// (offline on a build whose chunks never reached this phone), the frame draws with whatever is there.
import { loadAppearance, type Sport } from './appearance';
import { preloadClips } from './mocap';
import { SPORT } from '../../engine/sport';

/** The longest the first frame waits for the clips and looks (ms of wall-clock time). */
export const GATE_MS = 1500;

const ready: Partial<Record<Sport, Promise<boolean>>> = {};
const done: Partial<Record<Sport, boolean>> = {};
const asked: Partial<Record<Sport, number>> = {};

/** Load the sport's clip bundle and looks (once). Resolves true when both are in, false when either
 * failed; it never rejects. */
export function pixelReady(sport: Sport): Promise<boolean> {
  return (ready[sport] ??= Promise.all([preloadClips(sport).then(() => true, () => false), loadAppearance(sport)]).then(([clips, looks]) => {
    done[sport] = true;
    if (!clips || !looks) delete ready[sport];
    return clips && looks;
  }));
}

/**
 * Start a sport's load as its selection module is evaluated, if it is this page's sport. A page plays
 * one sport (sport.ts), but the arcade screen imports every sport's game, so the others' clips and
 * looks would download for nothing; `drawGate` still loads any sport a page does draw.
 */
export function preloadPixels(sport: Sport): void {
  if (sport === SPORT) void pixelReady(sport);
}

/** Whether `pixelReady(sport)` has settled (both in, or given up on). */
export function isPixelReady(sport: Sport): boolean {
  return !!done[sport];
}

/**
 * The renderer's first-frame gate: false while the clips and looks are still on their way (draw
 * nothing yet), true once they're in, after GATE_MS from the first time it was asked, or if they
 * failed. `now` is wall-clock ms (render only: no game state reads it).
 */
export function drawGate(sport: Sport, now: number = performance.now()): boolean {
  if (done[sport]) return true;
  void pixelReady(sport);
  asked[sport] ??= now;
  return now - asked[sport]! >= GATE_MS;
}
