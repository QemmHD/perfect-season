// Claude, 2026-11-16 (studio overhaul, team ut, task ut-4; Game Design V2 D.5, audit H4/L1): the main
// app's bridge to the next best action. Three light pieces for the first-paint chunk:
//   - useHomeNext: loads the engine (next-up-main.ts) with a dynamic import once Home has painted
//     (requestIdleCallback, 1 s fallback), then computes the action and the badge numbers, memoised
//     per profile and minute. It records this sport's UT claimables in the device cache so the other
//     sports' Homes can name them, and it times itself (`ps-nextup-import`, `ps-nextup-compute`:
//     perfNote, read by QA).
//   - NextUpStrip: the gold "Next up" strip. Before the engine answers it holds its place with a quiet
//     placeholder, so nothing moves when the line arrives.
//   - TabBadge: the UT tab's count (#c62828 with white 11 px bold, 5.6:1; an amber clock when the Daily
//     Drop streak ends tonight with its claim waiting).
// Plus the app-icon badge (navigator.setAppBadge, never a permission prompt) and the hand-off that opens
// another sport's Ultimate Team after the sport switch reloads the app.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SportId } from '../engine/sport';
import type { Profile } from '../lib/profile';
import type { UtView } from '../ut/UltimateTeam';
import type { HomeAction, HomeInputs, HomeNext } from './next-up-main';
import './next-up.css';

/**
 * Time a step for QA: a performance measure where the engine records one, and the newest 40 in
 * `window.__psPerf` (QA's fixtures run on Playwright's fake clock, which records no measures).
 */
export function perfNote(name: string, t0: number): void {
  const end = performance.now();
  try {
    performance.measure(name, { start: t0, end });
  } catch {
    // an engine without measure options: the list below still has it
  }
  const w = window as Window & { __psPerf?: [string, number][] };
  (w.__psPerf ??= []).push([name, Math.round((end - t0) * 100) / 100]);
  if (w.__psPerf.length > 40) w.__psPerf.shift();
}

type Engine = typeof import('./next-up-main');
let engine: Engine | null = null;
let loading: Promise<Engine> | null = null;
/** The engine module, loaded once (later Homes get it at once). */
export function loadNextUp(): Promise<Engine> {
  if (engine) return Promise.resolve(engine);
  if (!loading) {
    const t0 = performance.now();
    loading = import('./next-up-main').then((m) => {
      engine = m;
      perfNote('ps-nextup-import', t0);
      return m;
    });
  }
  return loading;
}

/** After first paint: on an idle moment, or after 1 s at the latest. */
function afterPaint(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 1000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 1000);
  return () => clearTimeout(t);
}

/** The minute, refreshed every 30 s and when the app comes back into view (countdowns, the day). */
function useMinute(): number {
  const [m, setM] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => {
    const tick = () => setM(Math.floor(Date.now() / 60000));
    const t = window.setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return m;
}

/**
 * The next best action and the badge numbers for this sport; null until the engine has loaded. With
 * `on` false (a match, a draft, Ultimate Team on screen) it keeps its last answer and computes nothing.
 */
export function useHomeNext(profile: Profile, sport: SportId, inputs: HomeInputs, on = true): HomeNext | null {
  const last = useRef<HomeNext | null>(null);
  const [mod, setMod] = useState<Engine | null>(engine);
  useEffect(() => {
    if (mod) return;
    let live = true;
    const cancel = afterPaint(() => void loadNextUp().then((m) => live && setMod(() => m)));
    return () => {
      live = false;
      cancel();
    };
  }, []);
  const minute = useMinute();
  const next = useMemo(() => {
    if (!mod) return null;
    if (!on) return last.current;
    const t0 = performance.now();
    const r = mod.homeNext(profile, sport, minute * 60000 + 30000, inputs);
    perfNote('ps-nextup-compute', t0);
    last.current = r;
    return r;
    // `profile` only matters while on: off, the last answer stands
  }, [mod, on, on ? profile : null, sport, minute, inputs.missions, inputs.daily.no, inputs.daily.done]);
  // this sport's count, for the other sports' Homes (written only when it changes)
  useEffect(() => {
    if (!mod || !next || next.approx) return;
    mod.writeDeviceCount(sport, next.count, next.day);
  }, [mod, next?.count, next?.approx, sport, minute]);
  return next;
}

/** The app icon's badge: everything claimable on this phone. Never asks for a permission. */
export function useAppBadge(total: number | null): void {
  useEffect(() => {
    if (total === null) return;
    const n = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try {
      const p = total > 0 ? n.setAppBadge?.(total) : n.clearAppBadge?.();
      p?.catch(() => undefined);
    } catch {
      // not supported, or not allowed without a notification permission: the in-app badge is enough
    }
  }, [total]);
}

// ---------- another sport's UT, across the reload ----------

const OPEN_KEY = 'perfect-season:ut-open';
/** Ask the next launch (after the sport switch reloads the app) to open that sport's UT at `view`. */
export function requestUtOpen(sport: SportId, view: UtView): void {
  try {
    sessionStorage.setItem(OPEN_KEY, JSON.stringify({ sport, view, at: Date.now() }));
  } catch {
    // the switch still lands on that sport's Home, where the strip names the same rewards
  }
}
/** The UT view this launch was asked to open (once, within a minute, in this sport only). */
export function takeUtOpen(sport: SportId): UtView | null {
  try {
    const raw = sessionStorage.getItem(OPEN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(OPEN_KEY);
    const v = JSON.parse(raw) as { sport?: string; view?: string; at?: number };
    return v.sport === sport && typeof v.view === 'string' && Date.now() - (v.at ?? 0) < 60000 ? (v.view as UtView) : null;
  } catch {
    return null;
  }
}

// ---------- the pieces ----------

/** Gold chevron (SVG, no glyphs). */
const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M5 2.5L9.5 7 5 11.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The "Next up" strip: an eyebrow, one line with the true distance and the action's word. The whole
 * strip is one button (≥ 44 px). A clock (amber) or the calm Done state change its tone, never its size.
 */
export function NextUpStrip({ action, onGo }: { action: HomeAction | null; onGo: (a: HomeAction) => void }) {
  if (!action)
    return (
      <div className="nu-strip nu-wait" aria-hidden="true">
        <span className="nu-text">
          <small>NEXT UP</small>
          <b className="nu-ghost" />
        </span>
      </div>
    );
  const tone = action.done ? 'done' : action.amber ? 'amber' : 'gold';
  const eyebrow = action.done ? 'DONE FOR TODAY' : action.amber ? 'ENDS TONIGHT' : 'NEXT UP';
  const line = action.done ? action.line.replace(/^Done for today · /, '') : action.line;
  return (
    <button
      type="button"
      className="nu-strip"
      data-tone={tone}
      data-action={action.id}
      aria-label={eyebrow.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) + ': ' + line + (action.stake ? ' (' + action.stake + ')' : '') + '. ' + action.cta}
      onClick={() => onGo(action)}
    >
      <span className="nu-text">
        <small>{eyebrow}</small>
        <b>{line}</b>
      </span>
      <span className="nu-cta">
        {action.cta}
        <Chevron />
      </span>
    </button>
  );
}

/** The UT tab's badge: the count of UT HOME's rewards, with an amber clock when the streak ends tonight. */
export function TabBadge({ count, amber }: { count: number; amber: boolean }) {
  if (count <= 0) return null;
  return (
    <i className={'tab-badge num' + (amber ? ' amber' : '')} aria-hidden="true">
      {amber && (
        <svg width="9" height="9" viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6 3.4V6l1.8 1.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      {count > 99 ? '99+' : count}
    </i>
  );
}
