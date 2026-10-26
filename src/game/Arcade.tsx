// A head to head played out: after the draft each side plays its own offense against the other's
// defense, on its own phone, at the same time. Your progress goes to the other phone over the
// match channel; theirs comes back the same way (against the AI, its drives are played by the
// autopilot and shown as you finish yours). The higher score wins; a tie goes to the better team.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NFL } from '../engine/sport';
import type { BotLevel, Lineup, Player } from '../engine/types';
import { sfx } from '../lib/sound';
import { type Attrs, loadAttrs } from './attrs';
import { aiDrives, Football } from './football/Football';
import type { RivalLive } from './progress';
import { DRIVES } from './football/drive';
import { squadOf } from './football/model';
import { POSSESSIONS } from './hoops/game';
import { aiPossessions, Hoops } from './hoops/Hoops';
import { fiveOf } from './hoops/model';

import type { Progress } from './progress';

export type { Progress };

/** what each way a drive or possession can end is worth, and the ones the wire may carry */
const POINTS: Record<string, number> = NFL ? { TD: 7, FG: 3, MISS: 0, INT: 0, DOWNS: 0 } : { '2': 2, '3': 3, X: 0, TO: 0 };
/** drives or possessions each */
const TOTAL = NFL ? DRIVES : POSSESSIONS;
const UNIT = NFL ? 'drive' : 'possession';

/** points scored in the first `n` drives or possessions */
function pointsThrough(p: Progress, n: number) {
  return p.ends.slice(0, n).reduce((a, e) => a + (POINTS[e] ?? 0), 0);
}

/** How sharp the AI plays its drives, by its level. */
export const AI_SKILL: Record<BotLevel, number> = { rookie: 0.45, pro: 0.68, legend: 0.88 };

export function arcadeAvailable(): boolean {
  return true;
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
    () => (wire ? { ...wire, ends: wire.ends.filter((e) => e in POINTS) } : null),
    [wire?.score, wire?.drive, wire?.done, wire?.ends.join()]
  );
  const rivalDef = (rivalLineup.DEF as Player | null) ?? null;
  // the AI's side, played up front (its offense against your defense)
  const aiPlay = (off: Lineup, def: Lineup, s: string, skill: number, a: (p: Player) => Attrs | null): Progress =>
    NFL ? aiDrives(off, (def.DEF as Player | null) ?? null, s, skill, a) : aiPossessions(off, def, s, skill, a);
  const ai = useMemo(() => (!online && attrs ? aiPlay(rivalLineup, lineup, seed, AI_SKILL[botLevel], attrs) : null), [attrs]);
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
      const sim = aiPlay(rivalLineup, lineup, seed + ':takeover', AI_SKILL.pro, attrs);
      const ends = known.ends.concat(sim.ends.slice(known.ends.length));
      setTakeover({ score: pointsThrough({ ...sim, ends }, TOTAL), drive: TOTAL, done: true, ends });
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
    // the AI's come in as you finish yours, all of them once you're done
    const n = mine?.done ? TOTAL : (mine?.drive ?? 0);
    return { name: rivalName, score: pointsThrough(ai, n), drive: n, done: n >= TOTAL };
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
    progress(aiPlay(lineup, rivalLineup, seed + ':sim', 0.6, attrs));
    setStage('play');
  };

  if (stage === 'kickoff' && !NFL) {
    const five = attrs ? fiveOf(lineup, attrs) : null;
    const r = (x: number) => Math.round(x * 99);
    return (
      <div className="arc-kick">
        <span className="eyebrow">Head to head · tip-off</span>
        <h1 className="disp">YOUR FIVE VS {rivalName.toUpperCase()}’S FIVE</h1>
        <p>
          {TOTAL} possessions each on offense, {rivalName} guarding you with the five they drafted, while they play theirs against yours. Most points wins; a tie goes to the better team.
        </p>
        {five && (
          <div className="arc-roster">
            {five.map((a) => (
              <span key={a.spot}>
                <b>{a.spot}</b>
                <i>{a.name}</i>
                <small className="num">
                  3PT {r(a.three)} · FIN {r(a.finish)} · PAS {r(a.pass)}
                </small>
              </span>
            ))}
          </div>
        )}
        <div className="arc-how">
          <span>Stick: move · PASS to the man you point at (or the open one)</span>
          <span>Hold SHOOT and let go at the top of the jump · near the rim it’s a layup, or a dunk</span>
        </div>
        <div className="arc-btns">
          <button className="big ghost small" onClick={sim} disabled={!attrs}>
            <span>SIM IT</span>
          </button>
          <button className="big shine" onClick={() => (sfx.whistle(), setStage('play'))} disabled={!attrs}>
            <span>PLAY</span>
          </button>
        </div>
      </div>
    );
  }
  if (stage === 'kickoff') {
    const sq = attrs ? squadOf(lineup, rivalDef, attrs) : null;
    return (
      <div className="arc-kick">
        <span className="eyebrow">Head to head · kickoff</span>
        <h1 className="disp">YOUR OFFENSE VS {(rivalDef?.teamName ?? rivalName).toUpperCase()}</h1>
        <p>
          {TOTAL} drives each, from your own 25. {rivalName} plays theirs against your defense at the same time. Most points wins; a tie goes to the better team.
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
        <span className="eyebrow">Your {UNIT}s, simmed</span>
        <h1 className="disp num">{mine.score}</h1>
        <p>{mine.ends.join(' · ')}</p>
        <p className="arc-wait">{shown && !shown.done ? 'Waiting for ' + rivalName + ': ' + UNIT + ' ' + Math.min(shown.drive + 1, TOTAL) + ' of ' + TOTAL + ' · ' + shown.score + ' pts' : 'Final whistle…'}</p>
      </div>
    );
  }
  if (!NFL) return <Hoops lineup={lineup} rivalLineup={rivalLineup} rivalName={rivalName} seed={seed} rival={shown} autoplayHook={autoplay} onProgress={progress} onDone={progress} />;
  return <Football lineup={lineup} rivalDef={rivalDef} rivalName={rivalName} seed={seed} rival={shown} autoplayHook={autoplay} onProgress={progress} onDone={progress} />;
}
