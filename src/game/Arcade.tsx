// A head to head played out: after the draft each side plays its own offense against the other's
// defense, on its own phone, at the same time. Your progress goes to the other phone over the
// match channel; theirs comes back the same way (against the AI, its drives are played by the
// autopilot and shown as you finish yours). The higher score wins; a tie goes to the better team.
import { defenseDifficulty } from './difficulty';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pick } from '../engine/sport';
import { loadSoccerGame, type SoccerGame } from '../soccer-lazy';
import type { Squad } from './soccer2/types';
import type { CardForPitch } from './soccer2/arcade';
import type { BotLevel, Lineup, Player } from '../engine/types';
import { sfx } from '../lib/sound';
import { type Attrs, loadAttrs } from './attrs';
import { aiDrives2, aiDrivesOf, Football2 } from './football2/Football2';
import type { RivalLive } from './progress';
import { WaitLine } from './Wait';
import { DRIVES } from './football2/drive';
import { offenseOf } from './football2/squad';
import { POSSESSIONS } from './hoops2/game';
import { aiPossessions2, aiPossessionsOf, fiveOf, Hoops2 } from './hoops2/Hoops2';
import type { Defense, Offense } from './football2/types';
import type { Hooper } from './hoops2/types';
import { type BasketballKit, type FootballKit, type Kits, kitsFor } from './uniforms';

import type { Progress } from './progress';

export type { Progress };

/** Claude 2026-11-01: soccer is the third sport (its engine loads when it's played: soccer-lazy.ts). */
const SOCCER = pick({ nba: false, nfl: false, soccer: true });
const FOOTBALL = pick({ nba: false, nfl: true, soccer: false });
/** what each way a drive, possession or attack can end is worth, and the ones the wire may carry */
const POINTS: Record<string, number> = pick<Record<string, number>>({
  nba: { '2': 2, '3': 3, A: 3, X: 0, TO: 0 },
  nfl: { TD: 7, FG: 3, MISS: 0, INT: 0, DOWNS: 0, PUNT: 0, FUM: 0, SAF: 0, TIME: 0 },
  // soccer: a goal, or saved, wide, blocked, lost, offside, time (soccer2/match.ts)
  soccer: { G: 1, S: 0, W: 0, B: 0, L: 0, O: 0, T: 0 },
});
/** drives, possessions or attacks each (soccer: six and one in stoppage time) */
const TOTAL = pick({ nba: POSSESSIONS, nfl: DRIVES, soccer: 7 });
const UNIT = pick({ nba: 'possession', nfl: 'drive', soccer: 'attack' });

/** A level soccer match's penalties: the shootout's score, yours first, and who won it. */
export interface Pens {
  us: number;
  them: number;
  won: boolean;
}

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

/**
 * Both sides' teams, built already (Ultimate Team squads) instead of drafted lineups: basketball's
 * fives (and benches), football's offenses and defenses.
 */
export interface ArcadeTeams {
  five?: Hooper[];
  bench?: Hooper[];
  rivalFive?: Hooper[];
  rivalBench?: Hooper[];
  offense?: Offense;
  defense?: Defense;
  rivalOffense?: Offense;
  rivalDefense?: Defense;
  /** soccer: both elevens (Ultimate Team squads), or their cards (built into elevens once the engine loads) */
  soccer?: { us: Squad; them: Squad };
  soccerCards?: { us: CardForPitch[]; them: CardForPitch[] };
}

export function Arcade({
  lineup,
  rivalLineup,
  teams,
  rivalName,
  seed,
  online,
  botLevel,
  aiSkill,
  aiDefense,
  rivalLive: wire,
  rivalGone,
  tookMe,
  autoplay,
  manualOnly = false,
  kits,
  soccerFavs,
  host = true,
  onProgress,
  onTakeover,
  onFinish,
}: {
  /** the two drafted lineups; or `teams`, built already */
  lineup?: Lineup;
  rivalLineup?: Lineup;
  teams?: ArcadeTeams;
  rivalName: string;
  seed: string;
  online: boolean;
  botLevel: BotLevel;
  /** against the AI: how sharp it plays (0-1), in place of its level's */
  aiSkill?: number;
  /** against the AI: how well its defense plays beyond its ratings (Squad Battles' difficulty; 0 standard) */
  aiDefense?: number;
  /** online: the other phone's progress, as last heard (from the wire: checked here) */
  rivalLive: { score: number; drive: number; done: boolean; ends: string[]; plays?: number } | null;
  /** online: the other phone has gone quiet (or left) */
  rivalGone: boolean;
  /** online: the other phone gave up on this one and let the AI finish its drives from this one on */
  tookMe: number | null;
  autoplay?: boolean;
  /** Solo challenges can require an actual played match instead of the instant sim. */
  manualOnly?: boolean;
  /** what each side wears, and the court or the end zones */
  kits?: Kits;
  /** soccer: each side's favorite club (their colors are the kits) */
  soccerFavs?: { mine: string | null; theirs: string | null };
  /** online: this phone is the match's host (a level soccer match's agreed penalties start with the host) */
  host?: boolean;
  onProgress: (p: Progress) => void;
  /** this phone let the AI finish the rival's drives from drive `k` on: tell the other phone */
  onTakeover: (k: number) => void;
  /** `pens`: soccer, a level match settled on penalties */
  onFinish: (us: Progress, them: Progress, how: 'played' | 'sim', took: { them: boolean; us: boolean }, pens?: Pens) => void;
}) {
  const defenseIQ = defenseDifficulty(online, botLevel, aiDefense);
  const [stage, setStage] = useState<'kickoff' | 'play'>(autoplay || manualOnly ? 'play' : 'kickoff');
  const [mine, setMine] = useState<Progress | null>(null);
  const [attrs, setAttrs] = useState<((p: Player) => Attrs | null) | null>(null);
  // soccer: the engine, loaded on first use; its elevens (Ultimate Team's, or from the drafts)
  const [sg, setSg] = useState<SoccerGame | null>(null);
  useEffect(() => {
    let live = true;
    if (SOCCER)
      loadSoccerGame().then((m) => {
        if (!live) return;
        setSg(m);
        // soccer plays from the lines themselves: no attribute file to wait for
        setAttrs(() => () => null);
      });
    else loadAttrs().then((f) => live && setAttrs(() => f));
    return () => {
      live = false;
    };
  }, []);
  const squads = useMemo(() => {
    if (!sg) return null;
    if (teams?.soccer) return teams.soccer;
    if (teams?.soccerCards) return { us: sg.cardSquad(teams.soccerCards.us, { name: 'You', abbr: 'YOU', c1: '#19E3C9', c2: '#0B2631' }), them: sg.cardSquad(teams.soccerCards.them, { name: rivalName, abbr: rivalName.slice(0, 3).toUpperCase(), c1: '#9B7BFF', c2: '#5B3FD1' }) };
    return { us: sg.draftSquad(lineup!, { name: 'You', abbr: 'YOU', c1: '#19E3C9', c2: '#0B2631' }), them: sg.draftSquad(rivalLineup!, { name: rivalName, abbr: rivalName.slice(0, 3).toUpperCase(), c1: '#9B7BFF', c2: '#5B3FD1' }) };
  }, [sg]);
  // the rival as the wire has it, its score counted here from its drive ends (never taken on trust)
  const rivalLive: Progress | null = useMemo(() => {
    if (!wire) return null;
    const ends = wire.ends.filter((e) => owns(e)).slice(0, TOTAL);
    return { score: pointsThrough({ score: 0, drive: 0, done: false, ends }, TOTAL), drive: ends.length, done: wire.done && ends.length >= TOTAL, ends, plays: wire.plays ?? 0 };
  }, [wire?.done, wire?.plays, wire?.ends.join()]);
  // one side's offense played by the autopilot against the other's defense: the rival's (`rival`), or yours
  const aiPlay = (rival: boolean, s: string, skill: number, a: (p: Player) => Attrs | null): Progress => {
    if (SOCCER) {
      const q = squads!;
      return rival ? sg!.aiProgressFor(q.them, q.us, s, skill, defenseIQ, { rival, online }) : sg!.aiProgressFor(q.us, q.them, s, skill, defenseIQ, { rival, online });
    }
    if (teams) {
      const t = teams;
      if (FOOTBALL) return rival ? aiDrivesOf(t.rivalOffense!, t.defense!, s, skill, DRIVES, defenseIQ) : aiDrivesOf(t.offense!, t.rivalDefense!, s, skill, DRIVES, defenseIQ);
      return rival ? aiPossessionsOf(t.rivalFive!, t.five!, s, skill, POSSESSIONS, t.rivalBench, defenseIQ) : aiPossessionsOf(t.five!, t.rivalFive!, s, skill, POSSESSIONS, t.bench, defenseIQ);
    }
    const [off, def] = rival ? [rivalLineup!, lineup!] : [lineup!, rivalLineup!];
    return FOOTBALL ? aiDrives2(off, def, s, skill, a, DRIVES, defenseIQ) : aiPossessions2(off, def, s, skill, a, POSSESSIONS, defenseIQ);
  };
  const ai = useMemo(() => (!online && attrs ? aiPlay(true, seed, aiSkill ?? AI_SKILL[botLevel], attrs) : null), [attrs]);

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
    setTakeover(finishedFrom(known, k, aiPlay(true, seed + ':takeover', (online ? AI_SKILL.legend : AI_SKILL[botLevel]), attrs)));
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
    return finishedFrom(played, Math.min(tookMe, played.ends.length), aiPlay(false, seed + ':takeover', (online ? AI_SKILL.legend : AI_SKILL[botLevel]), attrs));
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
  // soccer: a level match goes to penalties. Online, sims and taken-over games use the shootout both
  // phones work out the same way (the host's eleven kicks first); a match played against the AI has
  // its shootout played out on the pitch (Soccer2's onShootout).
  const [pens, setPens] = useState<Pens | null>(null);
  const level = SOCCER && !!us && !!them && us.score === them.score;
  const agreed = useMemo(() => (SOCCER && sg && squads ? sg.agreedShootout(squads.us, squads.them, seed, online ? host : true) : null), [sg, squads]);
  const onPitch = !taken && how.current === 'played';
  useEffect(() => {
    if (!level || pens || !agreed) return;
    if (onPitch) return;
    setPens({ us: agreed.us, them: agreed.them, won: agreed.winner === 'us' });
  }, [level, pens, agreed, onPitch]);
  useEffect(() => {
    if (sent.current || !us || !them) return;
    if (level && !pens) return;
    sent.current = true;
    window.setTimeout(() => onFinish(us, them, how.current, { them: !!takeover, us: !!taken }, level && pens ? pens : undefined), level ? 2600 : 1600);
  }, [us, them, pens]);

  const progress = (p: Progress) => {
    if (taken) return;
    setMine(p);
    onProgress(p);
  };

  // sim: the autopilot plays your drives at a middling level
  const sim = () => {
    if (!attrs || manualOnly) return;
    sfx.click();
    how.current = 'sim';
    progress(aiPlay(false, seed + ':sim', 0.6, attrs));
    setStage('play');
  };

  if (stage === 'kickoff' && SOCCER) {
    const xi = squads ? [...squads.us.fwd, ...squads.us.mid, ...squads.us.def, squads.us.gk].filter((p) => !p.id.startsWith('squad-')) : null;
    return (
      <div className="arc-kick">
        <span className="eyebrow">{online ? 'Online · Legend defense' : 'Head to head · kick-off'}</span>
        <h1 className="disp">
          YOUR ELEVEN VS {rivalName.toUpperCase()}
          {/s$/i.test(rivalName) ? '’' : '’S'}
        </h1>
        <p>
          {TOTAL - 1} attacks each and one in stoppage time, against {rivalName}’s {teams ? 'eleven' : 'drafted eleven'}, while they attack yours. Most goals wins; level goes to penalties.
        </p>
        {xi && (
          <div className="arc-roster">
            {xi.slice(0, 6).map((a) => (
              <span key={a.id}>
                <b>{a.pos}</b>
                <i>{a.name}</i>
                <small className="num">{a.keeper ? 'OVR ' + a.ovr + ' · REF ' + a.a.REF + ' · DIV ' + a.a.DIV : 'OVR ' + a.ovr + ' · PAC ' + a.a.PAC + ' · SHO ' + a.a.SHO}</small>
              </span>
            ))}
          </div>
        )}
        <div className="arc-how">
          <span>Stick: run · SPRINT · PASS goes where you point (hold to cross) · THRU into a runner</span>
          <span>Hold SHOOT, drag it to aim (or let it pick the open side) · let go in the green</span>
        </div>
        {online && rivalLive?.done && (
          <p className="arc-wait">
            {rivalName} has finished with {rivalLive.score}: kick off, they’re waiting.
          </p>
        )}
        <div className="arc-btns">
          {!manualOnly && (
            <button className="big ghost small" onClick={sim} disabled={!attrs}>
              <span>SIM MY ATTACKS</span>
            </button>
          )}
          <button className="big shine" onClick={() => (sfx.whistle(), setStage('play'))} disabled={!attrs}>
            <span>PLAY</span>
          </button>
        </div>
      </div>
    );
  }
  if (stage === 'kickoff' && !FOOTBALL) {
    const five = teams?.five ?? (attrs ? fiveOf(lineup!, attrs) : null);
    return (
      <div className="arc-kick">
        <span className="eyebrow">{online ? 'Online · Legend defense' : 'Head to head · tip-off'}</span>
        <h1 className="disp">
          YOUR FIVE VS {rivalName.toUpperCase()}
          {/s$/i.test(rivalName) ? '’' : '’S'} FIVE
        </h1>
        <p>
          {TOTAL} possessions each on offense, {rivalName} guarding you with {teams ? 'their five' : 'the five they drafted'}, while they play theirs against yours. Most points wins; a tie goes to the better team.
        </p>
        {five && (
          <div className="arc-roster">
            {five.map((a) => (
              <span key={a.id}>
                <b>{a.pos}</b>
                <i>{a.name}</i>
                <small className="num">
                  OVR {a.ovr} · 3PT {a.thr} · DNK {a.ddk}
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
            {rivalName} has finished with {rivalLive.score}: {pick({ nba: 'tip', nfl: 'kick', soccer: 'kick' })} off, they’re waiting.
          </p>
        )}
        <div className="arc-btns">
          {!manualOnly && <button className="big ghost small" onClick={sim} disabled={!attrs}>
            <span>SIM IT</span>
          </button>}
          <button className="big shine" onClick={() => (sfx.whistle(), setStage('play'))} disabled={!attrs}>
            <span>PLAY</span>
          </button>
        </div>
      </div>
    );
  }
  if (stage === 'kickoff') {
    const off = teams?.offense ?? (attrs ? offenseOf(lineup!, attrs, seed) : null);
    return (
      <div className="arc-kick">
        <span className="eyebrow">{online ? 'Online · Legend defense' : 'Head to head · kickoff'}</span>
        <h1 className="disp">YOUR OFFENSE VS {rivalName.toUpperCase()}</h1>
        <p>
          {TOTAL} drives each, from your own 25. {rivalName} plays theirs against your defense at the same time. Most points wins; a tie goes to the better team.
        </p>
        {off && (
          <div className="arc-roster">
            {[off.qb, off.rb, off.wr[0], off.wr[1], off.te].map((a) => (
              <span key={a.id}>
                <b>{a.pos}</b>
                <i>{a.name}</i>
                <small className="num">
                  OVR {a.ovr} · {a.pos === 'QB' ? 'THP ' + a.a.THP + ' · ACC ' + Math.round(((a.a.SAC ?? 0) + (a.a.MAC ?? 0) + (a.a.DAC ?? 0)) / 3) : 'SPD ' + a.a.SPD + ' · CTH ' + a.a.CTH}
                </small>
              </span>
            ))}
          </div>
        )}
        <div className="arc-how">
          <span>Pass: drag back anywhere, let go to throw · the arc shows who it’s going to</span>
          <span>Run: drag to steer · JUKE, SPIN or POWER at a tackler</span>
        </div>
        {online && rivalLive?.done && (
          <p className="arc-wait">
            {rivalName} has finished with {rivalLive.score}: {pick({ nba: 'tip', nfl: 'kick', soccer: 'kick' })} off, they’re waiting.
          </p>
        )}
        <div className="arc-btns">
          {!manualOnly && <button className="big ghost small" onClick={sim} disabled={!attrs}>
            <span>SIM MY DRIVES</span>
          </button>}
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
        {pens && <p className="arc-wait">{'Level: ' + (pens.won ? 'won ' : 'lost ') + pens.us + '–' + pens.them + ' on penalties'}</p>}
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
        {pens && <p className="arc-wait">{'Level: ' + (pens.won ? 'won ' : 'lost ') + pens.us + '–' + pens.them + ' on penalties'}</p>}
      </div>
    );
  }
  if (SOCCER) {
    if (!sg || !squads) return <div className="arc-kick"><p className="arc-wait">Walking out…</p></div>;
    const k = sg.soccerKitsFor(soccerFavs?.mine ?? null, soccerFavs?.theirs ?? null);
    return (
      <sg.Soccer2
        us={squads.us}
        them={squads.them}
        rivalName={rivalName}
        seed={seed}
        defIQ={defenseIQ}
        rival={shown}
        kits={k}
        autoplayHook={autoplay}
        fixedShootout={online && agreed ? { first: agreed.first, scored: agreed.scored } : undefined}
        onProgress={progress}
        onDone={progress}
        onShootout={(r) => setPens({ us: r.us, them: r.them, won: r.winner === 'us' })}
      />
    );
  }
  if (!FOOTBALL) {
    const k = kits ?? kitsFor(null, null, 'nba');
    return <Hoops2 lineup={lineup} rivalLineup={rivalLineup} five={teams?.five} rivalFive={teams?.rivalFive} bench={teams?.bench} rivalName={rivalName} seed={seed} defIQ={defenseIQ} rival={shown} ourKit={k.mine as BasketballKit} theirKit={k.theirs as BasketballKit} court={k.court} autoplayHook={autoplay} onProgress={progress} onDone={progress} />;
  }
  const k = kits ?? kitsFor(null, null, 'nfl');
  return <Football2 lineup={lineup} rivalLineup={rivalLineup} offense={teams?.offense} rivalDefense={teams?.rivalDefense} rivalName={rivalName} seed={seed} defIQ={defenseIQ} rival={shown} ourKit={k.mine as FootballKit} theirKit={k.theirs as FootballKit} field={k.field} autoplayHook={autoplay} onProgress={progress} onDone={progress} />;
}
