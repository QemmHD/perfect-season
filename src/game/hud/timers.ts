// Timers that stop with the match (plan §3.10): a paused game runs no callbacks at all, and on resume
// each timer gets the time it had left. Every delayed step of a match (the next possession, the
// replay, the final whistle) goes through one of these instead of window.setTimeout.

type Clock = () => number;
interface Job {
  fn: () => void;
  due: number;
  left: number;
  handle: ReturnType<typeof setTimeout> | null;
}

export class PausableTimers {
  private jobs = new Set<Job>();
  private pausedAt: number | null = null;
  /** callbacks run (tests read it) */
  fired = 0;
  constructor(private now: Clock = () => performance.now()) {}

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  /** Run `fn` after `ms` of unpaused time. Returns a cancel. */
  set(fn: () => void, ms: number): () => void {
    const job: Job = { fn, due: this.now() + ms, left: ms, handle: null };
    this.jobs.add(job);
    if (this.pausedAt === null) this.arm(job, ms);
    return () => this.drop(job);
  }

  pause(): void {
    if (this.pausedAt !== null) return;
    const t = this.now();
    this.pausedAt = t;
    for (const j of this.jobs) {
      if (j.handle !== null) clearTimeout(j.handle);
      j.handle = null;
      j.left = Math.max(0, j.due - t);
    }
  }

  /** Resume; returns how long the pause lasted (ms). */
  resume(): number {
    if (this.pausedAt === null) return 0;
    const t = this.now();
    const span = t - this.pausedAt;
    this.pausedAt = null;
    for (const j of this.jobs) {
      j.due = t + j.left;
      this.arm(j, j.left);
    }
    return span;
  }

  clear(): void {
    for (const j of this.jobs) if (j.handle !== null) clearTimeout(j.handle);
    this.jobs.clear();
  }

  get pending(): number {
    return this.jobs.size;
  }

  private arm(j: Job, ms: number) {
    j.handle = setTimeout(() => {
      this.jobs.delete(j);
      this.fired++;
      j.fn();
    }, ms);
  }

  private drop(j: Job) {
    if (j.handle !== null) clearTimeout(j.handle);
    this.jobs.delete(j);
  }
}
