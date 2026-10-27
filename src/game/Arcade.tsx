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
import { WaitLine } from './Wait';
import { DRIVES } from './football/drive';
import { squadOf } from './football/model';
import { POSSESSIONS } from './hoops2/game';
import { aiPossessions2, Hoops2 } from './hoops2/Hoops2';
import { fiveOf } from './hoops/model';
import { type BasketballKit, type Kits, kitsFor } from './uniforms';

import type { Progress } from './progress';

export type { Progress };

/** what each way a drive or possession can end is worth, and the ones the wire may carry */
const POINTS: Record<string, number> = NFL ? { TD: 7, FG: 3, MISS: 0, INT: 0, DOWNS: 0 } : { '2': 2, '3': 3, A: 3, X: 0, TO: 0 };
/** drives or possessions each */
const TOTAL = NFL ? DRIVES : POSSESSIONS;
const UNIT = NFL ? 'drive' : 'possession';

/** a way a drive can end (and not something else off the wire, like "toString") */
const owns = (e: string) => Object.prototype.hasOwnProperty.call(POINTS, e);

/** points scored in the first `n` drives or possessions */
function pointsThrough(p: Progress, n: number) {
  return p.ends.slice(0, n).reduce((a, e) => a + (owns(e) ? POINTS[e] : 0), 0);
}

/** A game the AI finished from drive `k` on: the drives played up to there, then the AI's. */
function finishedFrom(played: Progress, k: number, sim: Progress): Progress {
  const ends = played.ends.slice(0, k).concat(sim.ends.slice(k)).slice(0, TOTAL);
  return { score: pointsThrough({ ...sim, ends }, TOTAL), drive: TOTAL, done: true, ends, plays: played.plays };
}

/** How sharp the AI plays its drives, by its level. */
export const AI_SKILL: Record<BotLevel, number> = { rookie: 0.45, pro: 0.68, legend: 0.88 };

/** the other phone silent this long (after the match channel calls it gone): the AI finishes for it */
const GONE_MS = 25000;
/** you're done and the other phone is connected but hasn't run a play in this long: the AI finishes for it */
const STALL_MS = 60000;

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
  tookMe,
  autoplay,
  kits,
  onProgress,
  onTakeover,
  onFinish,
}: {
  lineup: Lineup;
  rivalLineup: Lineup;
  rivalName: string;
  seed: string;
  online: boolean;
  botLevel: BotLevel;
  /** online: the other phone's progress, as last heard (from the wire: checked here) */
  rivalLive: { score: number; drive: number; done: boolean; ends: string[]; plays?: number } | null;
  /** online: the other phone has gone quiet (or left) */
  rivalGone: boolean;
  /** online: the other phone gave up on this one and let the AI finish its drives from this one on */
  tookMe: number | null;
  autoplay?: boolean;
  /** basketball: what each side wears, and the court (the rival's) */
  kits?: Kits<BasketballKit>;
  onProgress: (p: Progress) => void;
  /** this phone let the AI finish the rival's drives from drive `k` on: tell the other phone */
  onTakeover: (k: number) => void;
  onFinish: (us: Progress, them: Progress, how: 'played' | 'sim', took: { them: boolean; us: boolean }) => void;
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
  // the rival as the wire has it, its score counted here from its drive ends (never taken on trust)
  const rivalLive: Progress | null = useMemo(() => {
    if (!wire) return null;
    const ends = wire.ends.filter((e) => owns(e)).slice(0, TOTAL);
    return { score: pointsThrough({ score: 0, drive: 0, done: false, ends }, TOTAL), drive: ends.length, done: wire.done && ends.length >= TOTAL, ends, plays: wire.plays ?? 0 };
  }, [wire?.done, wire?.plays, wire?.ends.join()]);
  const rivalDef = (rivalLineup.DEF as Player | null) ?? null;
  // the AI's side, played up front (its offense against your defense)
  const aiPlay = (off: Lineup, def: Lineup, s: string, skill: number, a: (p: Player) => Attrs | null): Progress =>
    NFL ? aiDrives(off, (def.DEF as Player | null) ?? null, s, skill, a) : aiPossessions2(off, def, s, skill, a);
  const ai = useMemo(() => (!online && attrs ? aiPlay(rivalLineup, lineup, seed, AI_SKILL[botLevel], attrs) : null), [attrs]);

  // Online, the AI can finish the other side's drives: when that phone goes quiet, or when you're
  // done and it stops playing. Both phones work it out the same way (same seed, same drives played
  // up to there), so they agree on the score: the phone that gives up says from which drive on.
  const [takeover, setTakeover] = useState<Progress | null>(null);
  const goneSince = useRef<number | null>(null);
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState(() => Date.now());
  useEffect(() => setLastMove(Date.now()), [rivalLive?.plays, rivalLive?.drive]);
  useEffect(() => {
    if (mine?.done && doneAt === null) setDoneAt(Date.now());
  }, [mine?.done]);
  const takeOver = () => {
    if (!attrs) return;
    const known = rivalLive ?? { score: 0, drive: 0, done: false, ends: [] };
    const k = known.ends.length;
    setTakeover(finishedFrom(known, k, aiPlay(rivalLineup, lineup, seed + ':takeover', AI_SKILL.pro, attrs)));
    onTakeover(k);
  };
  // the deadline for a rival who's connected but not playing, once you're done (one who hasn't
  // kicked off yet gets longer: they may be reading the rules)
  const stallAt = online && doneAt !== null ? Math.max(doneAt, lastMove) + (rivalLive ? STALL_MS : 2 * STALL_MS) : null;
  const cantTake = !online || !attrs || !!takeover || !!rivalLive?.done || tookMe !== null;
  useEffect(() => {
    if (cantTake) return;
    if (!rivalGone) {
      goneSince.current = null;
      return;
    }
    goneSince.current ??= Date.now();
    const t = window.setTimeout(takeOver, Math.max(0, GONE_MS - (Date.now() - goneSince.current)));
    return () => clearTimeout(t);
  }, [rivalGone, cantTake]);
  useEffect(() => {
    if (cantTake || stallAt === null) return;
    const t = window.setTimeout(takeOver, Math.max(0, stallAt - Date.now()));
    return () => clearTimeout(t);
  }, [stallAt, cantTake]);

  // the other phone gave up on this one: the AI finished your drives from where it last heard you
  const taken: Progress | null = useMemo(() => {
    if (tookMe === null || !attrs) return null;
    const played = mine ?? { score: 0, drive: 0, done: false, ends: [] };
    return finishedFrom(played, Math.min(tookMe, played.ends.length), aiPlay(lineup, rivalLineup, seed + ':takeover', AI_SKILL.pro, attrs));
  }, [tookMe, attrs]);

  // what the screen shows of the rival
  const shown: RivalLive | null = useMemo(() => {
    if (online) {
      const r = takeover ?? rivalLive;
      const base = r ? { name: rivalName, score: r.score, drive: r.drive, done: r.done } : { name: rivalName, score: 0, drive: 0, done: false };
      return { ...base, deadline: base.done ? null : stallAt };
    }
    if (!ai) return null;
    // the AI's come in as you finish yours, all of them once you're done
    const n = mine?.done ? TOTAL : (mine?.drive ?? 0);
    return { name: rivalName, score: pointsThrough(ai, n), drive: n, done: n >= TOTAL };
  }, [online, rivalLive, takeover, ai, mine, stallAt]);

  const us: Progress | null = taken ?? (mine?.done ? mine : null);
  const them: Progress | null = online ? (takeover ?? (rivalLive?.done ? rivalLive : null)) : ai;
  const sent = useRef(false);
  const how = useRef<'played' | 'sim'>('played');
  useEffect(() => {
    if (sent.current || !us || !them) return;
    sent.current = true;
    window.setTimeout(() => onFinish(us, them, how.current, { them: !!takeover, us: !!taken }), 1600);
  }, [us, them]);

  const progress = (p: Progress) => {
    if (taken) return;
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
          <span>Stick: move · PASS to the man you point at · CROSS breaks your man down</span>
          <span>Hold SHOOT and let go in the green · near the rim it’s a layup, or a dunk</span>
        </div>
        {online && rivalLive?.done && (
          <p className="arc-wait">
            {rivalName} has finished with {rivalLive.score}: {NFL ? 'kick' : 'tip'} off, they’re waiting.
          </p>
        )}
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
        {online && rivalLive?.done && (
          <p className="arc-wait">
            {rivalName} has finished with {rivalLive.score}: {NFL ? 'kick' : 'tip'} off, they’re waiting.
          </p>
        )}
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
  if (taken) {
    return (
      <div className="arc-kick">
        <span className="eyebrow">You were away too long</span>
        <h1 className="disp num">{taken.score}</h1>
        <p>
          {rivalName}’s phone lost you, so the AI finished your {UNIT}s from {UNIT} {Math.min(tookMe ?? 0, TOTAL - 1) + 1}: {taken.ends.join(' · ')}
        </p>
        <p className="arc-wait">{shown && !shown.done ? <WaitLine rival={shown} unit={UNIT} total={TOTAL} className="" /> : 'Final whistle…'}</p>
      </div>
    );
  }
  if (how.current === 'sim' && mine) {
    return (
      <div className="arc-kick">
        <span className="eyebrow">Your {UNIT}s, simmed</span>
        <h1 className="disp num">{mine.score}</h1>
        <p>{mine.ends.join(' · ')}</p>
        <p className="arc-wait">{shown && !shown.done ? <WaitLine rival={shown} unit={UNIT} total={TOTAL} className="" /> : 'Final whistle…'}</p>
      </div>
    );
  }
  if (!NFL) {
    const k = kits ?? kitsFor(null, null, 'nba');
    return <Hoops2 lineup={lineup} rivalLineup={rivalLineup} rivalName={rivalName} seed={seed} rival={shown} ourKit={k.mine} theirKit={k.theirs} court={k.court} autoplayHook={autoplay} onProgress={progress} onDone={progress} />;
  }
  return <Football lineup={lineup} rivalDef={rivalDef} rivalName={rivalName} seed={seed} rival={shown} autoplayHook={autoplay} onProgress={progress} onDone={progress} />;
}
