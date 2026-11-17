// The football screen's pause-aware clock (Claude, studio overhaul nfl-2). Everything that waits on
// real time between and around plays (the next play-call tray, a replay's lead-in, the kick's
// result, a banner's lifetime) goes through `after()`, and everything that reads real time while a
// play is live (the frame loop, the kick needle, slow motion, replays) reads `now()`. Pausing stops
// both: `now()` stands still and every pending timer keeps its remaining time until `resume()`.
// It never touches a play's result: the engine steps on its own fixed time, fed from here.

export interface Timer {
  id: number;
}

interface Pending {
  due: number;
  fn: () => void;
  native: ReturnType<typeof setTimeout> | null;
}

export class GameClock {
  private offset = 0;
  private pausedAt: number | null = null;
  private seq = 0;
  private timers = new Map<number, Pending>();
  private disposed = false;

  constructor(private real: () => number = () => performance.now()) {}

  /** Milliseconds of unpaused time (a performance.now() reading less every paused span). */
  now(): number {
    return (this.pausedAt ?? this.real()) - this.offset;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  /** Run `fn` after `ms` of unpaused time. */
  after(ms: number, fn: () => void): Timer {
    const id = ++this.seq;
    const t: Pending = { due: this.now() + Math.max(0, ms), fn, native: null };
    this.timers.set(id, t);
    if (!this.paused && !this.disposed) this.arm(id, t);
    return { id };
  }

  cancel(timer: Timer | null | undefined) {
    if (!timer) return;
    const t = this.timers.get(timer.id);
    if (t?.native) clearTimeout(t.native);
    this.timers.delete(timer.id);
  }

  /** Stop the clock: `now()` freezes and no timer fires. Returns false when it already was. */
  pause(): boolean {
    if (this.paused || this.disposed) return false;
    this.pausedAt = this.real();
    for (const t of this.timers.values()) {
      if (t.native) clearTimeout(t.native);
      t.native = null;
    }
    return true;
  }

  /** Start it again: the paused span never happened, as far as the game can tell. */
  resume(): boolean {
    if (this.pausedAt === null || this.disposed) return false;
    this.offset += this.real() - this.pausedAt;
    this.pausedAt = null;
    for (const [id, t] of this.timers) this.arm(id, t);
    return true;
  }

  /** The screen is closing: nothing pending may fire afterwards. */
  dispose() {
    this.disposed = true;
    for (const t of this.timers.values()) if (t.native) clearTimeout(t.native);
    this.timers.clear();
  }

  private arm(id: number, t: Pending) {
    t.native = setTimeout(
      () => {
        // a resume can re-arm before the real timeout lands: only the latest arming fires it
        if (this.timers.get(id) !== t || this.paused) return;
        if (this.now() + 0.5 < t.due) {
          this.arm(id, t);
          return;
        }
        this.timers.delete(id);
        t.fn();
      },
      Math.max(0, t.due - this.now())
    );
  }
}
