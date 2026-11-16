// The toast line (plan §4.3, V2 A.5): ONE line of text above the controls, for everything the game
// says (results, hints, calls, PERFECT). A new toast replaces the one showing unless that one has a
// higher priority and is still up. It never covers the court's centre or the rim (it sits just above
// the controls), and while the match is paused its clock stops with it.
import React, { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type ToastTone = 'gold' | 'teal' | 'red' | 'violet' | 'plain';
export interface Toast {
  text: string;
  tone?: ToastTone;
  /** default 1200 */
  ms?: number;
  /** higher replaces lower */
  priority?: number;
  /** the PERFECT 1.0 → 1.25 → 1.0 scale in 220 ms */
  pop?: boolean;
}

interface Live extends Toast {
  id: number;
}
interface Ctx {
  show(t: Toast): void;
  clear(): void;
  current: Live | null;
}

const ToastCtx = createContext<Ctx | null>(null);
const NOOP: Ctx = { show: () => undefined, clear: () => undefined, current: null };

/** The queue for one match. `paused` stops the expiry clock; `apiRef` hands `show`/`clear` to the
 * component that renders the provider (a match screen says things from its own loop). */
export function ToastProvider({ paused = false, apiRef, children }: { paused?: boolean; apiRef?: { current: { show(t: Toast): void; clear(): void } | null }; children: ReactNode }) {
  const [current, setCurrent] = useState<Live | null>(null);
  const live = useRef<{ cur: Live | null; left: number; due: number; handle: ReturnType<typeof setTimeout> | null; id: number }>({ cur: null, left: 0, due: 0, handle: null, id: 0 });
  const pausedRef = useRef(paused);
  const arm = (ms: number) => {
    const l = live.current;
    if (l.handle !== null) clearTimeout(l.handle);
    l.handle = null;
    l.due = performance.now() + ms;
    l.left = ms;
    if (pausedRef.current) return;
    const id = l.cur?.id;
    l.handle = setTimeout(() => {
      l.handle = null;
      if (l.cur?.id === id) {
        l.cur = null;
        setCurrent(null);
      }
    }, ms);
  };
  useEffect(() => {
    pausedRef.current = paused;
    const l = live.current;
    if (!l.cur) return;
    if (paused) {
      if (l.handle !== null) clearTimeout(l.handle);
      l.handle = null;
      l.left = Math.max(0, l.due - performance.now());
    } else arm(l.left);
  }, [paused]);
  useEffect(
    () => () => {
      if (live.current.handle !== null) clearTimeout(live.current.handle);
    },
    []
  );
  const show = useCallback((t: Toast) => {
    const l = live.current;
    if (l.cur && (l.cur.priority ?? 0) > (t.priority ?? 0)) return;
    l.cur = { ...t, id: ++l.id };
    setCurrent(l.cur);
    arm(t.ms ?? 1200);
  }, []);
  const clear = useCallback(() => {
    const l = live.current;
    if (l.handle !== null) clearTimeout(l.handle);
    l.handle = null;
    l.cur = null;
    setCurrent(null);
  }, []);
  if (apiRef) apiRef.current = { show, clear };
  const value = useMemo(() => ({ show, clear, current }), [current]);
  return <ToastCtx.Provider value={value}>{children}</ToastCtx.Provider>;
}

export function useToast(): { show(t: Toast): void; clear(): void } {
  const c = useContext(ToastCtx) ?? NOOP;
  return useMemo(() => ({ show: c.show, clear: c.clear }), [c.show, c.clear]);
}

/** The line itself (reads the queue from context). */
export function ToastLine() {
  const c = useContext(ToastCtx);
  const t = c?.current;
  return (
    <div className="ps-toast-slot" aria-live="polite" role="status">
      {t && (
        <div key={t.id} className={'ps-toast tone-' + (t.tone ?? 'plain') + (t.pop ? ' pop' : '')}>
          <span>{t.text}</span>
        </div>
      )}
    </div>
  );
}
