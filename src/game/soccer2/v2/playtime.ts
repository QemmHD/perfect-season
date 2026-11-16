// merge: replace with ut's src/lib/playtime.ts (`usePlaytime('match', activity)` plus
// `setPlaytimePaused(paused)`; the host banks through `bankActivity`), then delete this file.
//
// Soccer's stand-in for the V2 E.1 time-played hook (Claude 2026-11-16, studio overhaul soccer-2).
// Soccer tells it, every render, whether the match is paused, whether only the autopilot is playing
// (Auto-defend or SIM: that time alone never counts) and whether it's a stoppage between phases (the
// only moment a break reminder may show). ut's ledger owns the counting, the caps and the pause
// sheet's "Today 27 min · next reward at 30" line; until it is in this branch there is no ledger, so
// the stand-in keeps the latest state where the tests and the lab QA can read it and offers no line.
import { useEffect } from 'react';
import type { PlaytimeInfo, PlaytimeOpts } from './index';

export type PlaytimeCtx = 'match' | 'sim';

/** The state the match last reported (read by the lab QA as `window.__psPlaytime`). */
export const playtimeState: { ctx: PlaytimeCtx | null } & PlaytimeOpts = { ctx: null, paused: false, auto: false, stoppage: false };

export function usePlaytime(ctx: PlaytimeCtx, opts: PlaytimeOpts): PlaytimeInfo {
  useEffect(() => {
    Object.assign(playtimeState, { ctx }, opts);
    (globalThis as { __psPlaytime?: typeof playtimeState }).__psPlaytime = playtimeState;
  }, [ctx, opts.paused, opts.auto, opts.stoppage]);
  useEffect(
    () => () => {
      playtimeState.ctx = null;
    },
    [],
  );
  return {};
}
