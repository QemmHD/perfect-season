// The held arena's bench (plan §4.8; nba-3): ?arcade&hold plays the lab game through `Arcade` with
// `hold`, puts up a stub result sheet for 5 s at the whistle (standing in for ut's slam and tally),
// then calls `rematch()`. The flow probe (scripts/audit/nba-rematch.mjs --held) times each step and
// checks the renderer survives. Dev bench only: not reachable from the app's menus.
import React, { useEffect, useRef, useState } from 'react';
import type { Lineup } from '../../engine/types';
import { Arcade, type ArcadeHandle } from '../Arcade';
import type { Progress } from '../progress';

/** the stub sheet's stay (ut's slam 2.5 s + tally 2.5 s) */
export const STUB_SHEET_MS = 5000;

interface HeldLog {
  finishes: number[];
  rematches: number[];
  sheet: boolean;
}

export function HeldLab({ lineup, rivalLineup, seed, auto }: { lineup: Lineup; rivalLineup: Lineup; seed: string; auto: boolean }) {
  const ref = useRef<ArcadeHandle>(null);
  const [sheet, setSheet] = useState<{ us: number; them: number } | null>(null);
  const log = useRef<HeldLog>({ finishes: [], rematches: [], sheet: false });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __heldLab?: HeldLog & { rematch(): void } };
    w.__heldLab = Object.assign(log.current, { rematch: () => again() });
    return () => {
      delete w.__heldLab;
    };
  }, []);
  const timer = useRef(0);
  const again = () => {
    window.clearTimeout(timer.current);
    setSheet(null);
    log.current.sheet = false;
    log.current.rematches.push(performance.now());
    ref.current?.rematch();
  };
  const finish = (us: Progress, them: Progress) => {
    log.current.finishes.push(performance.now());
    log.current.sheet = true;
    setSheet({ us: us.score, them: them.score });
    timer.current = window.setTimeout(again, STUB_SHEET_MS);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className="screen" style={{ paddingTop: 0, paddingBottom: 0 }}>
      <Arcade
        ref={ref}
        lineup={lineup}
        rivalLineup={rivalLineup}
        rivalName="Rival"
        seed={seed}
        online={false}
        botLevel="pro"
        rivalLive={null}
        rivalGone={false}
        tookMe={null}
        autoplay={auto}
        manualOnly
        hold
        onProgress={() => undefined}
        onTakeover={() => undefined}
        onFinish={finish}
      />
      {sheet && (
        <div className="held-lab-sheet" role="dialog" aria-label="Result (stub)" onPointerDown={again}>
          <b>{sheet.us > sheet.them ? 'WIN' : sheet.us < sheet.them ? 'LOSS' : 'TIED'}</b>
          <span className="num">
            {sheet.us} – {sheet.them}
          </span>
          <small>STUB SHEET · REMATCH IN 5 S · TAP NOW</small>
        </div>
      )}
    </div>
  );
}
