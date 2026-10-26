// A head to head played out: after the draft each side plays its own offense against the other's
// defense, on its own phone, at the same time. Your progress goes to the other phone over the
// match channel; theirs comes back the same way (against the AI, its drives are played by the
// autopilot and shown as you finish yours). The higher score wins; a tie goes to the better team.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NFL } from '../engine/sport';
import type { BotLevel, Lineup, Player } from '../engine/types';
import { sfx } from '../lib/sound';
import { type Attrs, loadAttrs } from './attrs';
import { aiDrives, Football, type Progress, type RivalLive } from './football/Football';
import { type DriveEnd, DRIVES } from './football/drive';

const DRIVE_ENDS: Record<DriveEnd, true> = { TD: true, FG: true, MISS: true, INT: true, DOWNS: true };
import { squadOf } from './football/model';

export type { Progress };

const POINTS: Record<string, number> = { TD: 7, FG: 3 };

/** points scored in the first `n` drives */
function pointsThrough(p: Progress, n: number) {
  return p.ends.slice(0, n).reduce((a, e) => a + (POINTS[e] ?? 0), 0);
}

/** How sharp the AI plays its drives, by its level. */
export const AI_SKILL: Record<BotLevel, number> = { rookie: 0.45, pro: 0.68, legend: 0.88 };

export function arcadeAvailable(): boolean {
  return NFL;
}

export function Arcade({
  lineup,
  rivalLineup,
  rivalName,
  seed,
  online,
  botLevel,
  rivalLive: wire,
  rivalGone,
  autoplay,
  onProgress,
  onFinish,
}: {
  lineup: Lineup;
  rivalLineup: Lineup;
  rivalName: string;
  seed: string;
  online: boolean;
  botLevel: BotLevel;
  /** online: the other phone's progress, as last heard (from the wire: its drive ends are checked here) */
  rivalLive: { score: number; drive: number; done: boolean; ends: string[] } | null;
  /** online: the other phone has gone quiet (or left) */
  rivalGone: boolean;
  autoplay?: boolean;
  onProgress: (p: Progress) => void;
  onFinish: (us: Progress, them: Progress, how: 'played' | 'sim', takenOver: boolean) => void;
}) {
  const [stage, setStage] = useState<'kickoff' | 'play'>(autoplay ? 'play' : 'kickoff');
  const [mine, setMine] = useState<Progress | null>(null);
  const [attrs, setAttrs] = useState<((p: Player) => Attrs | null) | null>(null);
  useEffect(() => {
    let live = true;
    loadAttrs().then((f) => live && setAttrs(() => f));
    return () => {
      live = false;
    };
  }, []);
  const rivalLive: Progress | null = useMemo(
    () => (wire ? { ...wire, ends: wire.ends.filter((e): e is DriveEnd => e in DRIVE_ENDS) } : null),
    [wire?.score, wire?.drive, wire?.done, wire?.ends.join()]
  );
  const rivalDef = (rivalLineup.DEF as Player | null) ?? null;
  const myDef = (lineup.DEF as Player | null) ?? null;
  // the AI's drives, played up front (its offense against your defense)
  const ai = useMemo(() => (!online && attrs ? aiDrives(rivalLineup, myDef, seed, AI_SKILL[botLevel], attrs) : null), [attrs]);
  // the other phone went quiet: the AI finishes its drives from where it was
  const [takeover, setTakeover] = useState<Progress | null>(null);
  const goneSince = useRef<number | null>(null);
  useEffect(() => {
    if (!online || !attrs || takeover || rivalLive?.done) return;
    if (!rivalGone) {
      goneSince.current = null;
      return;
    }
    goneSince.current ??= Date.now();
    const t = window.setTimeout(() => {
      const known = rivalLive ?? { score: 0, drive: 0, done: false, ends: [] };
      const sim = aiDrives(rivalLineup, myDef, seed + ':takeover', AI_SKILL.pro, attrs);
      const ends = known.ends.concat(sim.ends.slice(known.ends.length));
      setTakeover({ score: pointsThrough({ ...sim, ends }, DRIVES), drive: DRIVES, done: true, ends });
    }, Math.max(0, 25000 - (Date.now() - goneSince.current)));
    return () => clearTimeout(t);
  }, [rivalGone, attrs, rivalLive?.done]);

  // what the screen shows of the rival
  const shown: RivalLive | null = useMemo(() => {
    if (online) {
      const r = takeover ?? rivalLive;
      return r ? { name: rivalName, score: r.score, drive: r.drive, done: r.done } : { name: rivalName, score: 0, drive: 0, done: false };
    }
    if (!ai) return null;
    // the AI's drives come in as you finish yours, all of them once you're done
    const n = mine?.done ? DRIVES : (mine?.drive ?? 0);
    return { name: rivalName, score: pointsThrough(ai, n), drive: n, done: n >= DRIVES };
  }, [online, rivalLive, takeover, ai, mine]);

  const them: Progress | null = online ? (takeover ?? (rivalLive?.done ? rivalLive : null)) : ai;
  const sent = useRef(false);
  const how = useRef<'played' | 'sim'>('played');
  useEffect(() => {
    if (sent.current || !mine?.done || !them) return;
    sent.current = true;
    window.setTimeout(() => onFinish(mine, them, how.current, !!takeover), 1600);
  }, [mine, them]);

  const progress = (p: Progress) => {
    setMine(p);
    onProgress(p);
  };

  // sim: the autopilot plays your drives at a middling level
  const sim = () => {
    if (!attrs) return;
    sfx.click();
    how.current = 'sim';
    const p = aiDrives(lineup, rivalDef, seed + ':sim', 0.6, attrs);
    progress(p);
    setStage('play');
  };

  if (stage === 'kickoff') {
    const sq = attrs ? squadOf(lineup, rivalDef, attrs) : null;
    return (
      <div className="arc-kick">
        <span className="eyebrow">Head to head · kickoff</span>
        <h1 className="disp">YOUR OFFENSE VS {(rivalDef?.teamName ?? rivalName).toUpperCase()}</h1>
        <p>
          {DRIVES} drives each, from your own 25. {rivalName} plays theirs against your defense at the same time. Most points wins; a tie goes to the better team.
        </p>
        {sq && (
          <div className="arc-roster">
            {[sq.qb, sq.rb, sq.wr, sq.te, sq.flex].map((a) => (
              <span key={a.name}>
                <b>{a.role === 'FLEX' ? 'FLX' : a.role}</b>
                <i>{a.player?.name}</i>
                <small className="num">
                  {a.role === 'QB' ? 'ACC ' + Math.round(a.acc * 99) + ' · ARM ' + Math.round(a.arm * 99) : 'SPD ' + Math.round(((a.speed - 7) / 2.4) * 99) + ' · HND ' + Math.round(a.hands * 99)}
                </small>
              </span>
            ))}
          </div>
        )}
        <div className="arc-how">
          <span>Pass: hold and drag to aim, let go to throw</span>
          <span>Run: drag to steer, tap to juke</span>
        </div>
        <div className="arc-btns">
          <button className="big ghost small" onClick={sim} disabled={!attrs}>
            <span>SIM MY DRIVES</span>
          </button>
          <button className="big shine" onClick={() => (sfx.whistle(), setStage('play'))} disabled={!attrs}>
            <span>PLAY</span>
          </button>
        </div>
      </div>
    );
  }
  if (how.current === 'sim' && mine) {
    return (
      <div className="arc-kick">
        <span className="eyebrow">Your drives, simmed</span>
        <h1 className="disp num">{mine.score}</h1>
        <p>{mine.ends.join(' · ')}</p>
        <p className="arc-wait">{shown && !shown.done ? 'Waiting for ' + rivalName + ': drive ' + Math.min(shown.drive + 1, DRIVES) + ' of ' + DRIVES + ' · ' + shown.score + ' pts' : 'Final whistle…'}</p>
      </div>
    );
  }
  return <Football lineup={lineup} rivalDef={rivalDef} rivalName={rivalName} seed={seed} rival={shown} autoplayHook={autoplay} onProgress={progress} onDone={progress} />;
}
