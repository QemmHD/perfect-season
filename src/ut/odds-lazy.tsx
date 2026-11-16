// Claude (packs-4, 2026-11-16): the odds sheet, loaded lazily (packs-plan §1 Performance: OddsSheet loads
// with React.lazy and its numbers are computed only when it opens). Any screen (the Store, the pick sheet,
// SBCs, ut's Scout Drop screen and reward rows) renders <LazyOddsSheet …/>; `preloadOdds()` fetches the
// chunk in an idle moment after a screen's first paint, so a tap opens the sheet without waiting.
import React, { lazy, type MutableRefObject, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { OddsSheetProps, OddsSource } from './OddsSheet';
import type { Pool } from './pool';
import type { UtSport } from './types';

export type { OddsSheetProps, OddsSource } from './OddsSheet';

type SheetModule = typeof import('./OddsSheet');
/** The sheet's module once loaded: then it renders at once, with no Suspense round trip on the first tap. */
let loaded: SheetModule | null = null;
const load = () => import('./OddsSheet').then((m) => ((loaded = m), m));
const Sheet = lazy(load);

/** Fetch the sheet's code now (idempotent: the module loads once). */
export function preloadOdds(): void {
  void load();
}

/** Preload the sheet once this screen has painted and the page is idle. */
export function useOddsPreload(): void {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(preloadOdds, { timeout: 2000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(preloadOdds, 600);
    return () => clearTimeout(t);
  }, []);
}

/** The odds sheet (pack, pick, reward or Scout Drop), loaded on first use. */
export function LazyOddsSheet(props: OddsSheetProps) {
  if (loaded) return <loaded.default {...props} />;
  return (
    <Suspense fallback={null}>
      <Sheet {...props} />
    </Suspense>
  );
}

type Open = { source: OddsSource; at?: number } | null;

/** Holds the open sheet's state by itself, so opening a sheet re-renders only this (never the whole screen). */
function OddsHost({ pool, sport, bind }: { pool: Pool | null; sport: UtSport; bind: MutableRefObject<((v: Open) => void) | null> }) {
  const [open, setOpen] = useState<Open>(null);
  useLayoutEffect(() => {
    bind.current = setOpen;
    return () => {
      bind.current = null;
    };
  }, [bind]);
  return open ? <LazyOddsSheet pool={pool} sport={sport} source={open.source} at={open.at} onClose={() => setOpen(null)} /> : null;
}

/**
 * A screen's odds sheet: `open(source)` shows it, `host` is placed once in the screen. A long screen (the
 * Store) opens a sheet without re-rendering itself, so a tap shows the sheet quickly on a slow phone.
 */
export function useOddsHost(pool: Pool | null, sport: UtSport): { open: (source: OddsSource, at?: number) => void; host: React.ReactNode } {
  const bind = useRef<((v: Open) => void) | null>(null);
  const open = useCallback((source: OddsSource, at?: number) => bind.current?.({ source, at }), []);
  return { open, host: <OddsHost pool={pool} sport={sport} bind={bind} /> };
}
