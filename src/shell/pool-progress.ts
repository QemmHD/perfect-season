// Claude (studio overhaul, shell-6, 2026-11-16): how far Ultimate Team's card pool has got, for its
// loading screen's label ("Preparing your club · 64%"). A tiny store with no imports, so the loading
// screen in the first-paint bundle can read it without pulling in the pool (src/ut/pool.ts writes it,
// and re-exports `poolProgress` / `onPoolProgress`).
//
// While a load is on, a 200 ms heartbeat re-sends the state (its `ms` grows), so a listener hears at
// least every 250 ms even through the card file's download, where there is nothing to count. Long
// tasks still block it: a task that holds the page holds every update (shell-7 slices them).

export type PoolPhase = 'idle' | 'fetch' | 'expand' | 'rate' | 'cache' | 'done' | 'failed';
export interface PoolProgress {
  phase: PoolPhase;
  /** cards handled in this phase, of `total` (0 while unknown) */
  done: number;
  total: number;
  /** ms since this load started */
  ms: number;
}

export const HEARTBEAT_MS = 200;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
let phase: PoolPhase = 'idle';
let done = 0;
let total = 0;
let since = 0;
/** who started the load: the loading screen (while UT's own code downloads) or the pool itself */
let owner: 'screen' | 'pool' | null = null;
let beat: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(p: PoolProgress) => void>();

export const poolProgress = (): PoolProgress => ({ phase, done, total, ms: phase === 'idle' ? 0 : Math.round(now() - since) });

const emit = () => {
  const p = poolProgress();
  listeners.forEach((cb) => cb(p));
};
const stopBeat = () => {
  if (beat !== null) clearInterval(beat);
  beat = null;
};
const loading = () => phase !== 'idle' && phase !== 'done' && phase !== 'failed';

/**
 * A load starts. The pool calls it when it starts fetching; the loading screen calls it while UT's code
 * downloads (that wait is part of the same load). A load already on keeps its start time, so the
 * label never steps back when the pool takes over from the screen.
 */
export function poolLoadStarted(by: 'screen' | 'pool'): void {
  if (!loading()) {
    since = now();
    phase = 'fetch';
    done = total = 0;
  }
  if (by === 'pool' || owner === null) owner = by;
  if (typeof setInterval !== 'undefined') beat ??= setInterval(emit, HEARTBEAT_MS);
  emit();
}

/**
 * The loading screen went away. When UT's code arrived, the pool takes the load over in the same
 * commit (its effect runs right after this one), so this looks a moment later and ends the load only
 * when nobody took it: UT was closed while its code downloaded.
 */
export function poolLoadAbandoned(): void {
  const check = () => {
    if (owner !== 'screen' || !loading()) return;
    phase = 'idle';
    owner = null;
    stopBeat();
    emit();
  };
  if (typeof setTimeout !== 'undefined') setTimeout(check, 0);
  else check();
}

/** The pool reports a phase and its count. `done` and `failed` end the load and the heartbeat. */
export function reportPool(next: PoolPhase, n = 0, of = 0): void {
  phase = next;
  done = n;
  total = of;
  if (!loading()) {
    owner = null;
    stopBeat();
  }
  emit();
}

/** Calls `cb` on every change while the pool loads (at least every 250 ms); returns the unsubscribe. */
export function onPoolProgress(cb: (p: PoolProgress) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * The percentage the label shows. The download has no count, so it creeps towards 30% on a curve (it
 * keeps moving and never claims to be done); expanding fills 30–40%, rating 40–97% by count, caching
 * 97–99%, and only `done` reads 100%.
 */
export function poolPercent(p: PoolProgress): number {
  const frac = (a: number, b: number) => (b > 0 ? Math.min(1, Math.max(0, a / b)) : 0);
  switch (p.phase) {
    case 'idle':
    case 'failed':
      return 0;
    case 'fetch':
      return Math.min(29, Math.round(30 * (1 - Math.exp(-p.ms / 1400))));
    case 'expand':
      return 30 + Math.round(10 * frac(p.done, p.total));
    case 'rate':
      return 40 + Math.round(57 * frac(p.done, p.total));
    case 'cache':
      return 97 + Math.round(2 * frac(p.done, p.total));
    case 'done':
      return 100;
  }
}
