// Claude (studio overhaul, shell-6, 2026-11-16): the arena curtain's logic, apart from its look
// (ArenaCurtain.tsx), so it can be tested without a browser.
//
// A match's `.arcade-full` arrives in <body> (arena.ts sees it) long before its first real frame: the
// match files, the attribute file, the motion clips and, in basketball, the 700 ms before the first
// possession. Today that is up to 1.2 s of black court. The curtain covers it:
//
//  - From the arena's insertion until it is ready, the curtain's backdrop (the lit arena, no words)
//    is up, so no frame is ever an empty court.
//  - The title card itself (matchup, crests, tip) joins only when the arena still isn't ready 150 ms
//    after insertion. An arena that is ready sooner lifts the backdrop and never shows a title card.
//  - Ready = the arena said so (`ps:arena-ready`, which the engines may dispatch after their first
//    real frame) or the motion clips are in, AND the canvas is drawn, then 2 more frames.
//  - Hard cap 2,500 ms from insertion: the curtain never holds a playable match back longer.
//  - No minimum time. It fades out in 150 ms (0 under reduced motion).
//
// The curtain never pauses or slows anything: it only covers the picture. It adds no listener to the
// arena (its taps are blocked by covering it, and the cover stops taking taps as it starts to fade).

/** The title card waits this long after the arena arrives: a quick arena never flashes one. */
export const SHOW_AFTER_MS = 150;
/** The curtain never stays longer than this after the arena arrives. */
export const CAP_MS = 2500;
/** The fade out (0 under reduced motion). */
export const FADE_MS = 150;
/** Frames drawn after "ready" before the cover lifts (the first real frame is on screen, settled). */
export const SETTLE_FRAMES = 2;

export type CurtainPhase = 'off' | 'cover' | 'card' | 'lifting';

export interface CurtainInput {
  /** ms since the arena arrived */
  elapsed: number;
  /** the arena's canvas holds a picture */
  drawn: boolean;
  /** the arena said it is ready, or the motion clips are in */
  motion: boolean;
  /** frames counted since drawn && motion first held (0 until then) */
  settled: number;
  /** a curtain was already on screen when the arena arrived (the match's files were loading under it) */
  handover: boolean;
}

/**
 * What the curtain shows at this moment: 'off' (the arena is ready and no title card was shown: the
 * backdrop just goes), 'cover' (the backdrop only), 'card' (the full title card) or 'lifting' (fading out).
 * `shown` is whether the title card has already been shown during this arena's load.
 */
export function curtainPhase(i: CurtainInput, shown: boolean): CurtainPhase {
  const ready = (i.drawn && i.motion && i.settled >= SETTLE_FRAMES) || i.elapsed >= CAP_MS;
  if (ready) return shown || i.handover ? 'lifting' : 'off';
  if (shown || i.handover || i.elapsed >= SHOW_AFTER_MS) return 'card';
  // the first 150 ms: the backdrop only, so neither an empty court nor a half-ready one is ever seen
  return 'cover';
}

/** One side of the matchup: its name and its kit colours (no team logos: crests are drawn from these). */
export interface ArenaSide {
  name: string;
  /** a 2–4 letter mark on the crest; the name's initials when absent */
  abbr?: string;
  c1: string;
  c2: string;
}
export interface ArenaInfo {
  us: ArenaSide;
  them: ArenaSide;
  /** a small line above the title, e.g. "Head to Head" or "Squad Battles" */
  mode?: string;
}

let info: ArenaInfo | null = null;
const infoListeners = new Set<() => void>();
/**
 * Optional: the screen that opens a match may name it, for the curtain's matchup. Cleared when the
 * arena leaves. Without it the curtain shows a title for the sport (TIP-OFF / KICKOFF / KICK-OFF).
 */
export function setArenaInfo(next: ArenaInfo | null): void {
  info = next;
  infoListeners.forEach((cb) => cb());
}
export const arenaInfo = (): ArenaInfo | null => info;
export function onArenaInfo(cb: () => void): () => void {
  infoListeners.add(cb);
  return () => {
    infoListeners.delete(cb);
  };
}

/** A crest's letters: the given abbreviation, else the name's initials (2–3 letters). */
export function crestLetters(side: Pick<ArenaSide, 'name' | 'abbr'>): string {
  if (side.abbr) return side.abbr.slice(0, 4).toUpperCase();
  const words = side.name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** A safe CSS colour from kit data (anything else falls back): crests are drawn with it inline. */
export function kitColor(c: unknown, fallback: string): string {
  return typeof c === 'string' && HEX.test(c.trim()) ? c.trim() : fallback;
}

// ---------- "the arena said it's ready" ----------
// Engines may dispatch `ps:arena-ready` on window after their first real frame (NFL and soccer do on
// their branches). It is recorded from the start, so an event that fires before the curtain looks is
// never missed; the curtain compares its time with the arena's arrival.
let lastReady = -Infinity;
if (typeof window !== 'undefined') window.addEventListener('ps:arena-ready', () => (lastReady = performance.now()));
/** Did an arena say it was ready at or after `since` (performance.now() ms)? */
export const arenaSaidReady = (since: number): boolean => lastReady >= since;
