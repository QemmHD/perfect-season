// Is the drawing ready? (studio overhaul players-3, plan §6.7.) A match's players need two things
// before play starts: the sport's motion-capture clips (else hand-keyed stand-in poses show, then pop
// to the recorded motion) and its appearance data (else default looks show, then pop to the real
// ones). `pixelReady(sport)` loads both; select-<sport>.ts starts it (`preloadPixels`) as the game chunk
// is evaluated, long before the first frame.
//
// While the first load is still on its way, `holdPlay` tells the sport screen's loop to hold game time
// (no fixed steps run, so no clock, possession or shot clock is lost), for at most GATE_MS; the
// renderer draws every frame regardless (the venue and the players as they are), so the screen is
// never blank under a live HUD. The hold never keeps the game hostage: after GATE_MS, or once a load
// has failed (offline on a build whose chunks never reached this phone), play runs with whatever is
// there, and `wantPixels` (called by every renderer frame) tries a failed load again every RETRY_MS.
import { loadAppearance, type Sport } from './appearance';
import { preloadClips } from './mocap';
import { SPORT } from '../../engine/sport';

/** The longest play waits for the clips and looks before it starts (ms of wall-clock time). */
export const GATE_MS = 1500;
/** After a failed load, the soonest it is tried again (ms of wall-clock time). */
export const RETRY_MS = 5000;

const ready: Partial<Record<Sport, Promise<boolean>>> = {};
/** both are in */
const ok: Partial<Record<Sport, boolean>> = {};
/** a load has settled at least once (in, or failed) */
const settled: Partial<Record<Sport, boolean>> = {};
/** when `wantPixels` last started a load */
const tried: Partial<Record<Sport, number>> = {};
/** when the hold was first asked for */
const asked: Partial<Record<Sport, number>> = {};

/** Load the sport's clip bundle and looks. Resolves true when both are in, false when either failed;
 * it never rejects. Memoised while a load is on its way and once it has succeeded; a failed load is
 * forgotten, so the next call tries again (each half keeps what it already has). */
export function pixelReady(sport: Sport): Promise<boolean> {
  if (ok[sport]) return Promise.resolve(true);
  return (ready[sport] ??= Promise.all([preloadClips(sport).then(() => true, () => false), loadAppearance(sport)]).then(([clips, looks]) => {
    settled[sport] = true;
    if (clips && looks) ok[sport] = true;
    else delete ready[sport];
    return clips && looks;
  }));
}

/**
 * Start a sport's load as its selection module is evaluated, if it is this page's sport. A page plays
 * one sport (sport.ts), but the arcade screen imports every sport's game, so the others' clips and
 * looks would download for nothing; `wantPixels` still loads any sport a page does draw.
 */
export function preloadPixels(sport: Sport): void {
  if (sport === SPORT) void pixelReady(sport);
}

/** Whether the sport's clips and looks are both in. */
export function isPixelReady(sport: Sport): boolean {
  return !!ok[sport];
}

/**
 * Keep the sport's clips and looks coming (each renderer frame calls it): start the load if nothing
 * has, and after a failed one try again, at most once every RETRY_MS. Free once they're in. `now` is
 * wall-clock ms (render only: no game state reads it).
 */
export function wantPixels(sport: Sport, now: number = performance.now()): void {
  if (ok[sport] || ready[sport]) return;
  if (tried[sport] !== undefined && now - tried[sport]! < RETRY_MS) return;
  tried[sport] = now;
  void pixelReady(sport);
}

/**
 * The match-start gate (the sport screens' loops): true while game time must wait, that is while the
 * first load of the clips and looks is still on its way and GATE_MS hasn't passed since the gate was
 * first asked. False once they're in, once a load has failed, and after GATE_MS. It also starts the
 * load (wantPixels). `now` is wall-clock ms.
 */
export function holdPlay(sport: Sport, now: number = performance.now()): boolean {
  wantPixels(sport, now);
  if (ok[sport] || settled[sport]) return false;
  asked[sport] ??= now;
  return now - asked[sport]! < GATE_MS;
}
