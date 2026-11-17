// Claude, 2026-11-16 (studio overhaul, team ut, task ut-3; Game Design V2 D.11): the break reminder.
// After 60 minutes of continuous active play it waits for the next stoppage (a menu, a result or
// reward screen: never a match, a draft pick or a queue) and shows one line: "Good time for a
// stretch. Your progress is saved." One tap dismisses it; the next one needs another 60 active
// minutes. Ten minutes with nothing counted (the app away, or put down) is a break and starts the
// hour again. The Session reminder setting turns it off (the count still resets at each stoppage,
// so turning it back on never fires a backlog). It reads the ticker (src/lib/playtime.ts) once a
// second and writes nothing.
// Review fix (ut-3): the ten-minute gap is measured on the wall clock (Date.now), not the ticker's
// performance.now(): on iOS that is an uptime clock that stands still while the phone sleeps, so a
// 30-minute lock read as a few seconds and never started the hour again.
import React, { useEffect, useRef, useState } from 'react';
import { type PlayCtx, watchPlaytime } from '../lib/playtime';
import { Sheet } from './common';
import './playtime-ui.css';

/** Active seconds before a reminder is due. */
export const BREAK_AFTER = 3600;
/** A gap this long (ms) with nothing counted is a break: the hour starts again. */
export const BREAK_GAP = 10 * 60_000;
/** The screens where it may appear: menus and result/reward screens. */
export const STOPPAGES: readonly PlayCtx[] = ['menu', 'replay'];
export const BREAK_LINE = 'Good time for a stretch. Your progress is saved.';

export interface BreakState {
  /** active seconds since the last reminder or break */
  active: number;
  /** when a second last counted (wall-clock time, ms: Date.now, which keeps running while the phone sleeps) */
  lastAt: number;
}

/** One ticker second at wall-clock time `t` (ms): the new state, and whether the reminder is due on this screen now. */
export function breakStep(s: BreakState, sec: number, ctx: PlayCtx | undefined, t: number): { s: BreakState; due: boolean } {
  let active = t - s.lastAt > BREAK_GAP ? 0 : s.active,
    lastAt = s.lastAt;
  if (sec > 0) (active += sec), (lastAt = t);
  const due = active >= BREAK_AFTER && !!ctx && STOPPAGES.includes(ctx);
  return { s: { active: due ? 0 : active, lastAt }, due };
}

const held = new Set<string>();
/**
 * A screen the ticker counts as a menu that is really play or has a clock on it is not a stoppage:
 * UT's match handshake (found, VS, the 10-second vote), the draft vote, the Legends Gauntlet and
 * Training Camp. Each host holds the reminder under its own name until it is over.
 */
export function holdBreak(who: string, on: boolean): void {
  if (on) held.add(who);
  else held.delete(who);
}

/**
 * A ticker watcher that calls `onDue` once per reminder (for watchPlaytime). The ticker's own time
 * (performance.now) is ignored: the break gap is wall-clock time.
 */
export function breakWatcher(onDue: () => void, wall: () => number = () => Date.now()): (sec: number, ctx: PlayCtx | undefined, t: number) => void {
  let s: BreakState = { active: 0, lastAt: -Infinity };
  return (sec, ctx) => {
    const r = breakStep(s, sec, held.size ? undefined : ctx, wall());
    s = r.s;
    if (r.due) onDue();
  };
}

/** Mounted once at the app root; `on` is the Session reminder setting (default on). */
export function BreakReminder({ on }: { on: boolean }) {
  const [show, setShow] = useState(false);
  const onRef = useRef(on);
  onRef.current = on;
  useEffect(() => watchPlaytime(breakWatcher(() => onRef.current && setShow(true))), []);
  if (!show) return null;
  return (
    <Sheet label="Break reminder" onClose={() => setShow(false)}>
      {(close) => (
        <div className="break-sheet">
          <span className="break-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="4.2" r="1.9" />
              <path d="M12 6.8v6.4M12 13.2l-3.4 6.6M12 13.2l3.4 6.6M5 8.6l7 1.6 7-1.6" />
            </svg>
          </span>
          <p role="status">{BREAK_LINE}</p>
          <button className="btn primary" onClick={() => close()}>
            OK
          </button>
        </div>
      )}
    </Sheet>
  );
}
