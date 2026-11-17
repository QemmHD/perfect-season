// Instant replay for the arcade games: each frame of play is kept for a few seconds (a snapshot of
// what the drawing needs), and after a highlight the last moments play again in slow motion from a
// closer camera. Nothing here touches the game itself: a replay only redraws what was recorded.

export interface Frame<S> {
  t: number;
  s: S;
}

export class Recorder<S> {
  frames: Frame<S>[] = [];
  constructor(private keep = 5) {}

  /** Keep this frame; frames older than `keep` seconds go. */
  push(t: number, s: S) {
    const f = this.frames;
    if (f.length && t < f[f.length - 1].t) f.length = 0;
    f.push({ t, s });
    let drop = 0;
    while (drop < f.length && f[drop].t < t - this.keep) drop++;
    if (drop) f.splice(0, drop);
  }

  clear() {
    this.frames = [];
  }

  /** The frames from `from` to `to` (play time), for a replay. */
  clip(from: number, to: number): Frame<S>[] {
    return this.frames.filter((f) => f.t >= from && f.t <= to);
  }
}

/** The recorded frame for a moment of a replay: the last one at or before `t`. */
export function frameAt<S>(frames: Frame<S>[], t: number): S | null {
  if (!frames.length) return null;
  let lo = 0;
  let hi = frames.length - 1;
  if (t <= frames[0].t) return frames[0].s;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo].s;
}

/** A replay under way: its frames, where it is in them, the spot to look at, how fast it runs. */
export interface Replay<S> {
  frames: Frame<S>[];
  t0: number;
  t1: number;
  start: number;
  speed: number;
  focus: { a: number; b: number };
  done: () => void;
}

/** The play time a replay has reached at wall-clock `now` (ms), or null once it's over. */
export function replayTime<S>(r: Replay<S>, now: number): number | null {
  const t = r.t0 + ((now - r.start) / 1000) * r.speed;
  return t > r.t1 ? null : t;
}

/** How long (seconds of play) a replay shows before and after the moment, and how slow it runs. */
export const REPLAY_BEFORE = 1.3;
export const REPLAY_AFTER = 0.9;
export const REPLAY_SPEED = 0.6;

/** tests: ?replays shows replays even when the autopilot plays (normally they're skipped there) */
export const REPLAYS_IN_AUTOPLAY = typeof location !== 'undefined' && new URLSearchParams(location.search).has('replays');
