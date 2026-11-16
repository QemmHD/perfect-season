// Claude (studio overhaul, shell-4, 2026-11-16): "a match is on screen", for the whole app.
//
// Every arena (draft and UT matches through Arcade, Training Camp, Moments, and any new solo mount
// point) portals its `.arcade-full` root straight into <body> (Hoops2, Football2, Soccer2). So one
// MutationObserver on <body> with `childList` only, NOT `subtree`, sees each arena arrive and leave,
// and no in-game DOM change ever reaches it: its callback runs a handful of times per match.
// `arena.test.ts` checks that the engines still portal to <body>; if one ever renders inline, this
// needs a subtree observer scoped to #root instead.
//
// `active()` reads `<body>`'s children synchronously (review fix), so it is right from the moment
// React inserts the arena, before the observer's microtask: a crash in the arena's first commit or
// mount effects is labelled "This match stopped" too. The observer only drives `onArenaChange`.
//
// Shell work (timers, sliced parsing, cache warming, prefetch) asks `shellWork(kind)` first and
// defers while a match is on: the match keeps the phone's whole frame budget. A call made during an
// arena is counted in `window.__psShellWorkDuringArena[kind]`, so QA can prove none slipped through.

export const ARENA_CLASS = 'arcade-full';

/** The parts of a DOM node this module reads (a fake in tests). */
export interface ArenaNode {
  nodeType: number;
  classList?: { contains(c: string): boolean };
}
export interface ArenaBody {
  children: ArrayLike<ArenaNode>;
}
type Observer = { observe(target: ArenaBody, init: { childList: boolean }): void; disconnect(): void };
type ObserverCtor = new (cb: (records: { addedNodes: ArrayLike<ArenaNode>; removedNodes: ArrayLike<ArenaNode> }[]) => void) => Observer;

export interface ArenaTracker {
  active(): boolean;
  element(): ArenaNode | null;
  onChange(cb: (active: boolean) => void): () => void;
  stop(): void;
}

const isArena = (n: ArenaNode) => n.nodeType === 1 && !!n.classList?.contains(ARENA_CLASS);
const touchesArena = (nodes: ArrayLike<ArenaNode>) => {
  for (let i = 0; i < nodes.length; i++) if (isArena(nodes[i])) return true;
  return false;
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/** The observer's own cost (callbacks and total ms, listeners included), for QA: window.__psArenaObserver. */
export const cost = { calls: 0, ms: 0 };
if (typeof window !== 'undefined') (window as unknown as { __psArenaObserver?: typeof cost }).__psArenaObserver = cost;

/** Tracks the `.arcade-full` children of `body`. Exported for the unit test; the app uses the singleton below. */
export function trackArenas(body: ArenaBody, Ctor: ObserverCtor): ArenaTracker {
  let el: ArenaNode | null = null;
  const listeners = new Set<(active: boolean) => void>();
  // the newest arena wins when two overlap for a moment (one leaving as the next arrives)
  const scan = () => {
    const kids = body.children;
    for (let i = kids.length - 1; i >= 0; i--) if (isArena(kids[i])) return kids[i];
    return null;
  };
  const observer = new Ctor((records) => {
    const t0 = now();
    let hit = false;
    for (const r of records) if (touchesArena(r.addedNodes) || touchesArena(r.removedNodes)) hit = true;
    if (hit) {
      const was = el !== null;
      el = scan();
      if (was !== (el !== null)) listeners.forEach((cb) => cb(el !== null));
    }
    cost.calls++;
    cost.ms += now() - t0;
  });
  el = scan();
  observer.observe(body, { childList: true });
  return {
    // read from <body> itself, not from `el`: the observer reports in a microtask after the DOM
    // changes, and React commits a portal, runs its layout effects and may throw (an arena crashing on
    // its first commit) before that microtask. A scan of body's few children costs well under 1 us.
    // `el` stays the observer's view, for the onChange notifications only.
    active: () => scan() !== null,
    element: () => scan(),
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    stop: () => observer.disconnect(),
  };
}

const tracker: ArenaTracker | null =
  typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && document.body
    ? trackArenas(document.body as unknown as ArenaBody, MutationObserver as unknown as ObserverCtor)
    : null;

/** True while a match's `.arcade-full` is in the page. */
export const arenaActive = (): boolean => tracker?.active() ?? false;
/** The arena's root element while one is on screen. */
export const arenaElement = (): HTMLElement | null => (tracker?.element() as HTMLElement | null) ?? null;
/** Calls `cb(active)` each time a match starts or ends; returns the unsubscribe. */
export const onArenaChange = (cb: (active: boolean) => void): (() => void) => tracker?.onChange(cb) ?? (() => undefined);

type WorkCounts = Record<string, number>;
/**
 * May shell work of this kind run now? False while a match is on screen: the caller defers (for
 * example until `onArenaChange` reports false). Each refusal is counted for QA.
 */
export function shellWork(kind: string, active: () => boolean = arenaActive): boolean {
  if (!active()) return true;
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __psShellWorkDuringArena?: WorkCounts };
    const counts = (w.__psShellWorkDuringArena ??= {});
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return false;
}
