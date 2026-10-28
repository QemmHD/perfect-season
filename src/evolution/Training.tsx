import { ArrowMark, DrillMark, MedalMark } from './Marks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CELLS } from '../engine/data';
import { NFL, SPORT } from '../engine/sport';
import { SLOTS, type Lineup } from '../engine/types';
import { Hoops2, kitsFor } from '../game/hoops2/Hoops2';
import { Football2, fbKitsFor } from '../game/football2/Football2';
import type { Profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { ArenaHero } from '../ui/Hero';
import { Confetti } from '../ui/common';
import { getPool } from '../ut/pool';
import { lineupOf, teamsOf, type Teams } from '../ut/teams';
import { startersComplete } from '../ut/squad';
import { NFL as IS_NFL } from '../engine/sport';
import {
  HOOPS_DRILLS,
  FOOTBALL_DRILLS,
  type Attempt,
  type DrillDef,
} from './training';

const DRILLS = IS_NFL ? FOOTBALL_DRILLS : HOOPS_DRILLS;
const STORE = 'perfect-season:training:' + SPORT;
function bests(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}');
  } catch {
    return {};
  }
}
function sample(): Lineup {
  const all = CELLS.flatMap((c) => c.players).sort((a, b) => a.val - b.val),
    used = new Set<string>();
  return Object.fromEntries(
    SLOTS.map((slot) => {
      const pool = all.filter((p) => p.pos.includes(slot) && !used.has(p.pid));
      const p = pool[Math.floor((pool.length - 1) * 0.94)];
      used.add(p.pid);
      return [slot, p];
    })
  );
}
export function Training({
  profile,
  onExit,
  autoplay = false,
}: {
  profile: Profile;
  onExit: () => void;
  autoplay?: boolean;
}) {
  const [drill, setDrill] = useState<DrillDef | null>(null),
    [round, setRound] = useState(0),
    [results, setResults] = useState<Attempt[]>([]),
    [pressure, setPressure] = useState(0),
    [owned, setOwned] = useState(false),
    [teams, setTeams] = useState<Teams | null>(null),
    [records, setRecords] = useState(bests),
    [playing, setPlaying] = useState(false),
    [brief, setBrief] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );
  const lineup = useMemo(sample, []),
    successes = results.filter((r) => r.success).length,
    done = results.length >= 10;
  useEffect(() => {
    if (!done || !drill) return;
    const next = {
      ...records,
      [drill.id]: Math.max(records[drill.id] ?? 0, successes),
    };
    setRecords(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {}
    sfx.seriesWin();
  }, [done]);
  const start = async (d: DrillDef, skipBrief = false) => {
    setLoading(true);
    setError('');
    try {
      let t: Teams | null = null;
      if (owned) {
        const p = await getPool();
        const cards = Object.fromEntries(
          Object.entries(profile.ut.squad).flatMap(([slot, uid]) => {
            const o = profile.ut.owned.find((c) => c.uid === uid),
              line = o && p.byId.get(o.cardId);
            return line ? [[slot, { line, level: o!.level }]] : [];
          })
        );
        const sq = lineupOf(cards);
        if (!startersComplete(SPORT, sq))
          throw new Error(
            'Fill your Ultimate Team starters first, or use the camp squad.'
          );
        t = teamsOf(SPORT, cards, cards, 'camp');
      }
      if (!alive.current) return;
      setTeams(t);
      setDrill(d);
      setResults([]);
      setRound((n) => n + 1);
      setBrief(!skipBrief);
      setPlaying(skipBrief);
      sfx.select();
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : 'Couldn’t load your squad.');
    } finally {
      if (alive.current) setLoading(false);
    }
  };
  const attempt = (a: Attempt) =>
    setResults((r) => (r.length < 10 ? [...r, a] : r));
  if (brief && drill) {
    const tips = NFL
      ? drill.id === 'kick'
        ? [
            'Tap KICK to start the meter.',
            'Tap as the needle crosses the center.',
            'Each kick moves a little farther out.',
          ]
        : drill.id === 'run'
          ? [
              'Choose your run, then tap SNAP.',
              'Drag to steer. Swipe sideways to juke.',
              'Swipe up to spin. Double-tap to truck.',
            ]
          : [
              'Choose a route concept, then tap SNAP.',
              'Drag back and release to throw.',
              'Read the coverage. Throw before the rush.',
            ]
      : [
          'Use the left stick to move. Push to sprint.',
          drill.id === 'pass'
            ? 'Point the stick at a teammate, then PASS.'
            : 'Hold SHOOT to rise; release in the green.',
          drill.id === 'finish'
            ? 'Attack the rim before you hold SHOOT.'
            : drill.id === 'pass'
              ? 'Make a pass before you score.'
              : 'Match timing to the top of your jump.',
        ];
    return (
      <div className="screen evo-screen camp-results camp-brief">
        <span className="eyebrow">TEN REPS. YOUR NEXT LEVEL.</span>
        <div className="camp-medal">
          <DrillMark drill={drill.id} />
        </div>
        <h1 className="disp">{drill.title}</h1>
        <p>
          {drill.goal} · {owned ? 'Your Ultimate Team' : 'Camp squad'}
        </p>
        <div className="camp-instructions">
          {tips.map((tip, i) => (
            <p key={tip}>
              <b>0{i + 1}</b>
              {tip}
            </p>
          ))}
        </div>
        <button
          className="big gold"
          onClick={() => {
            setBrief(false);
            setPlaying(true);
            sfx.select();
          }}
        >
          LET’S WORK <ArrowMark />
        </button>
        <button className="btn ghost" onClick={() => setBrief(false)}>
          BACK TO CAMP
        </button>
      </div>
    );
  }
  if (playing && drill && !done) {
    const common = {
      seed: 'camp:' + drill.id + ':' + round,
      rivalName: 'TRAINING',
      rival: null,
      defIQ: pressure,
      autoplayHook: autoplay,
      timeScale: autoplay && import.meta.env.DEV ? 5 : 1,
      onProgress: () => {},
      onDone: () => {},
      practice: { drill: drill.id, onAttempt: attempt },
    };
    return (
      <>
        {NFL ? (
          <Football2
            key={round}
            {...common}
            lineup={teams ? undefined : lineup}
            rivalLineup={lineup}
            offense={teams?.offense}
            rivalDefense={teams?.rivalDefense}
            drives={10}
            ourKit={fbKitsFor('#082f38', '#19e3c9').home}
            theirKit={fbKitsFor('#8e6c32', '#f5b83d').away}
            field={{
              homeC1: '#082f38',
              homeC2: '#19e3c9',
              homeName: 'TRAIN',
              awayC1: '#8e6c32',
              awayC2: '#f5b83d',
              awayName: 'CAMP',
            }}
          />
        ) : (
          <Hoops2
            key={round}
            {...common}
            lineup={teams ? undefined : lineup}
            rivalLineup={lineup}
            five={teams?.five}
            rivalFive={teams?.rivalFive}
            possessions={10}
            ourKit={kitsFor('#082f38', '#19e3c9').home}
            theirKit={kitsFor('#8e6c32', '#f5b83d').away}
            court={{ c1: '#082f38', c2: '#19e3c9', abbr: 'CAMP' }}
          />
        )}
        {createPortal(
          <div className="camp-overlay">
            <button
              aria-label="Leave training"
              onClick={() => setPlaying(false)}
            >
              ← CAMP
            </button>
            <span>
              <b>{drill.title}</b>
              <small>
                {results.length}/10 · {successes} successful
              </small>
            </span>
            <button
              aria-label="Restart drill"
              onClick={() => start(drill, true)}
            >
              ↻
            </button>
            {results.length > 0 && (
              <div className="camp-feedback" key={results.length}>
                <b>{results[results.length - 1]!.detail}</b>
                <small>
                  {results[results.length - 1]!.offset !== undefined
                    ? `${Math.abs(results[results.length - 1]!.offset!)} ms ${results[results.length - 1]!.offset! < 0 ? 'early' : 'late'} · ${results[results.length - 1]!.contest}`
                    : results[results.length - 1]!.yards !== undefined
                      ? `${results[results.length - 1]!.yards} yards`
                      : ''}
                </small>
              </div>
            )}
          </div>,
          document.body
        )}
      </>
    );
  }
  if (done && drill && playing)
    return (
      <div className="screen evo-screen camp-results">
        <div className="camp-medal">
          <MedalMark />
        </div>
        <span className="eyebrow">
          {successes >= drill.target ? 'DRILL CONQUERED' : 'KEEP BUILDING'}
        </span>
        <h1 className="disp">
          {successes >= 8
            ? 'DIALED IN.'
            : successes >= drill.target
              ? 'GAME READY.'
              : 'ONE MORE REP.'}
        </h1>
        <div className="camp-score disp">
          {successes}
          <small>/10</small>
        </div>
        <p>
          {drill.title} · Personal best {records[drill.id] ?? successes}/10
        </p>
        <div className="camp-attempts">
          {results.map((r, i) => (
            <span key={i} className={r.success ? 'good' : ''}>
              {r.green ? '✦' : r.success ? '✓' : '·'}
            </span>
          ))}
        </div>
        <p className="note">
          {results.filter((r) => r.green).length > 0
            ? results.filter((r) => r.green).length +
              ' green releases. That timing travels with you.'
            : 'Take what you learned into your next game.'}
        </p>
        <button className="big gold" onClick={() => start(drill, true)}>
          RUN IT BACK ↻
        </button>
        <button className="btn ghost" onClick={() => setPlaying(false)}>
          BACK TO CAMP
        </button>
        {successes >= drill.target && <Confetti />}
      </div>
    );
  return (
    <div className="screen evo-screen camp-screen">
      <header className="evo-top">
        <button onClick={onExit} aria-label="Leave Training Camp">
          ← HOME
        </button>
        <span>THE WORK BEFORE THE WIN</span>
        <b>{NFL ? 'NFL' : 'NBA'}</b>
      </header>
      <div className="evo-scroll">
        <ArenaHero>
          <div className="camp-hero">
            <span className="eyebrow">WELCOME TO THE LAB</span>
            <h1 className="disp">
              GREATNESS
              <br />
              <em>STARTS HERE.</em>
            </h1>
            <p>No record. No pressure. Just your next level.</p>
            <span className="camp-stamp">
              TRAINING
              <br />
              <b>CAMP</b>
            </span>
          </div>
        </ArenaHero>
        <div className="camp-controls">
          <div>
            <span className="eyebrow">YOUR ROSTER</span>
            <div className="evo-segment">
              <button aria-pressed={!owned} onClick={() => setOwned(false)}>
                CAMP SQUAD
              </button>
              <button aria-pressed={owned} onClick={() => setOwned(true)}>
                MY ULTIMATE TEAM
              </button>
            </div>
          </div>
          <div>
            <span className="eyebrow">DEFENSIVE PRESSURE</span>
            <div className="evo-segment">
              {['RELAXED', 'GAME DAY', 'INTENSE'].map((v, i) => (
                <button
                  key={v}
                  aria-pressed={pressure === [-0.6, 0, 0.8][i]}
                  onClick={() => setPressure([-0.6, 0, 0.8][i])}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="camp-drills">
          {DRILLS.map((d, i) => (
            <button
              key={d.id}
              className="camp-drill"
              disabled={loading}
              onClick={() => start(d)}
              style={{ '--drill-index': i } as React.CSSProperties}
            >
              <div className="drill-visual" aria-hidden="true">
                <div className={'drill-court ' + (NFL ? 'football' : '')} />
                <b>
                  <DrillMark drill={d.id} />
                </b>
                <span>0{i + 1}</span>
              </div>
              <div className="drill-copy">
                <small className="eyebrow">{d.goal}</small>
                <h2 className="disp">{d.title}</h2>
                <p>{d.subtitle}</p>
                <div>
                  <span>
                    {records[d.id] !== undefined
                      ? 'BEST ' + records[d.id] + '/10'
                      : 'SET YOUR FIRST BEST'}
                  </span>
                  <b>
                    ENTER <ArrowMark />
                  </b>
                </div>
              </div>
            </button>
          ))}
        </div>
        {error && (
          <p className="note err" role="alert">
            {error}
          </p>
        )}
        <p className="camp-footnote">
          Ten attempts. Real match controls. Unlimited retries.
        </p>
      </div>
    </div>
  );
}
