// Timers that stop while the match is paused (Claude 2026-11-16, studio overhaul soccer-2, C-5):
// the beat after a whistle, the next attack's line-up, a replay's start, the shootout's next kick.
// While paused, each keeps the time it had left and runs it out on resume, so a pause never skips a
// beat or fires one behind the pause sheet. Wall-clock only (presentation, never the engine).

interface Pending {
  fn: () => void;
  left: number;
  at: number;
  id: number;
}

export class PausableTimers {
  private items = new Set<Pending>();
  private paused = false;
  private now: () => number;
  private set: (fn: () => void, ms: number) => number;
  private clear: (id: number) => void;

  constructor(now = () => performance.now(), set = (fn: () => void, ms: number) => window.setTimeout(fn, ms), clear = (id: number) => window.clearTimeout(id)) {
    this.now = now;
    this.set = set;
    this.clear = clear;
  }

  /** Run `fn` after `ms` of unpaused time. */
  later(fn: () => void, ms: number): void {
    const p: Pending = { fn, left: Math.max(0, ms), at: this.now(), id: 0 };
    this.items.add(p);
    if (!this.paused) this.arm(p);
  }

  private arm(p: Pending) {
    p.at = this.now();
    p.id = this.set(() => {
      this.items.delete(p);
      p.fn();
    }, p.left);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const t = this.now();
    for (const p of this.items) {
      this.clear(p.id);
      p.left = Math.max(0, p.left - (t - p.at));
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const p of this.items) this.arm(p);
  }

  /** Drop everything (the match is over or unmounting). */
  dispose(): void {
    for (const p of this.items) this.clear(p.id);
    this.items.clear();
  }
}
