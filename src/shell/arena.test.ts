// Claude (studio overhaul, shell-4): the arena signal (arena.ts) against a fake <body>, and a static
// guard that every engine still portals its `.arcade-full` root straight into <body>.
/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from 'vitest';
import { type ArenaBody, type ArenaNode, shellWork, trackArenas } from './arena';

type Rec = { addedNodes: ArenaNode[]; removedNodes: ArenaNode[] };
const node = (...cls: string[]): ArenaNode => ({ nodeType: 1, classList: { contains: (c) => cls.includes(c) } });
const text = (): ArenaNode => ({ nodeType: 3 });

/** A <body> whose child list changes the way the DOM's does, with a MutationObserver stand-in. */
function fakeBody(initial: ArenaNode[] = []) {
  const kids = [...initial];
  const body: ArenaBody = { children: kids };
  let cb: ((r: Rec[]) => void) | null = null;
  let init: unknown = null;
  let calls = 0;
  class MO {
    constructor(f: (r: Rec[]) => void) {
      cb = (r) => (calls++, f(r));
    }
    observe(_t: ArenaBody, i: unknown) {
      init = i;
    }
    disconnect() {
      cb = null;
    }
  }
  return {
    body,
    MO,
    init: () => init,
    calls: () => calls,
    add(n: ArenaNode) {
      kids.push(n);
      cb?.([{ addedNodes: [n], removedNodes: [] }]);
    },
    remove(n: ArenaNode) {
      kids.splice(kids.indexOf(n), 1);
      cb?.([{ addedNodes: [], removedNodes: [n] }]);
    },
  };
}

describe('arena tracker', () => {
  it('watches only <body>’s own children (never the subtree)', () => {
    const f = fakeBody();
    trackArenas(f.body, f.MO);
    expect(f.init()).toEqual({ childList: true });
  });

  it('is active from the arena’s insertion to its removal', () => {
    const f = fakeBody([node('status-plate')]);
    const t = trackArenas(f.body, f.MO);
    const seen: boolean[] = [];
    t.onChange((a) => seen.push(a));
    expect(t.active()).toBe(false);
    const a = node('arcade-full', 'hg2');
    f.add(a);
    expect(t.active()).toBe(true);
    expect(t.element()).toBe(a);
    f.remove(a);
    expect(t.active()).toBe(false);
    expect(t.element()).toBe(null);
    expect(seen).toEqual([true, false]);
  });

  it('is right before the observer reports (React commits and may throw before its microtask)', () => {
    const f = fakeBody([node('status-plate')]);
    const t = trackArenas(f.body, f.MO);
    const seen: boolean[] = [];
    t.onChange((a) => seen.push(a));
    const a = node('arcade-full', 'fb2');
    // in the DOM, observer not yet run: the window an arena's first commit or mount effects run in
    (f.body.children as ArenaNode[]).push(a);
    expect(t.active()).toBe(true);
    expect(t.element()).toBe(a);
    expect(seen).toEqual([]);
    // and gone from the DOM before the observer hears of it
    (f.body.children as ArenaNode[]).pop();
    expect(t.active()).toBe(false);
    expect(t.element()).toBe(null);
  });

  it('ignores other body children (sheets, overlays, text)', () => {
    const f = fakeBody();
    const t = trackArenas(f.body, f.MO);
    const seen: boolean[] = [];
    t.onChange((a) => seen.push(a));
    const overlay = node('camp-overlay');
    f.add(overlay);
    f.add(text());
    f.remove(overlay);
    expect(t.active()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('stays active while two arenas overlap, and reports one change each way', () => {
    const f = fakeBody();
    const t = trackArenas(f.body, f.MO);
    const seen: boolean[] = [];
    t.onChange((a) => seen.push(a));
    const one = node('arcade-full');
    const two = node('arcade-full', 'sc2');
    f.add(one);
    f.add(two);
    expect(t.element()).toBe(two);
    f.remove(two);
    expect(t.active()).toBe(true);
    expect(t.element()).toBe(one);
    f.remove(one);
    expect(t.active()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('sees an arena that was already there when it started', () => {
    const a = node('arcade-full');
    const f = fakeBody([a]);
    expect(trackArenas(f.body, f.MO).element()).toBe(a);
  });

  it('unsubscribes and stops', () => {
    const f = fakeBody();
    const t = trackArenas(f.body, f.MO);
    const seen: boolean[] = [];
    const off = t.onChange((a) => seen.push(a));
    off();
    f.add(node('arcade-full'));
    expect(seen).toEqual([]);
    t.stop();
    f.add(node('arcade-full'));
    expect(f.calls()).toBe(1);
  });
});

describe('shellWork', () => {
  const g = globalThis as unknown as { window?: { __psShellWorkDuringArena?: Record<string, number> } };
  afterEach(() => {
    delete g.window;
  });

  it('runs when no match is on, and defers and counts each kind while one is', () => {
    g.window = {};
    let on = false;
    const active = () => on;
    expect(shellWork('warm', active)).toBe(true);
    expect(g.window.__psShellWorkDuringArena).toBeUndefined();
    on = true;
    expect(shellWork('warm', active)).toBe(false);
    expect(shellWork('warm', active)).toBe(false);
    expect(shellWork('prefetch', active)).toBe(false);
    expect(g.window.__psShellWorkDuringArena).toEqual({ warm: 2, prefetch: 1 });
    on = false;
    expect(shellWork('warm', active)).toBe(true);
    expect(g.window.__psShellWorkDuringArena).toEqual({ warm: 2, prefetch: 1 });
  });

  it('is a no-op outside a browser (the app’s tracker needs a document)', () => {
    expect(shellWork('warm')).toBe(true);
  });
});

describe('the engines still portal their arena to <body>', () => {
  const SOURCES = import.meta.glob<string>(['../game/hoops2/Hoops2.tsx', '../game/football2/Football2.tsx', '../game/soccer2/Soccer2.tsx'], { query: '?raw', import: 'default', eager: true });
  it('reads all three engines', () => expect(Object.keys(SOURCES).length).toBe(3));
  for (const [file, src] of Object.entries(SOURCES)) {
    it(file, () => {
      // the component returns createPortal(<div className={'arcade-full …'} …>, document.body)
      const at = src.indexOf('return createPortal(');
      expect(at).toBeGreaterThan(-1);
      const rest = src.slice(at);
      const cls = rest.search(/className=\{?['"`]arcade-full\b/);
      expect(cls).toBeGreaterThan(-1);
      expect(cls).toBeLessThan(300);
      // the portal's target, at the end of that same call
      expect(/\n\s*document\.body\s*\n?\s*\);/.test(rest)).toBe(true);
      expect(src.match(/className=\{?['"`]arcade-full\b/g)?.length).toBe(1);
    });
  }
});
