import React, { useEffect, useMemo, useRef, useState } from 'react';
import { castGame } from '../engine/broadcast';
import { climb, clearChance, CLEAR_COINS, coinsFor, GAUNTLET_SIZE, type GauntletGame, LIVES, RUNG_COINS, rungsWon } from '../engine/gauntlet';
import type { TeamRating } from '../engine/rating';
import { NFL } from '../engine/sport';
import type { Lineup, PlayoffTeam } from '../engine/types';
import { sfx } from '../lib/sound';
import { CoinChip, Confirm } from './common';
import { GameCast } from './GameCast';
import { Back, Crown, Lock } from './icons';
import { reducedMotion } from './motion';

/** a chance as a percent, never a flat 0% or 100% */
export function pct(x: number): string {
  return x < 0.005 ? '<1%' : x > 0.995 ? '>99%' : Math.round(x * 100) + '%';
}

/**
 * The Legends Gauntlet: a tower of eight great teams, the best at the top. Each game is played
 * live; a loss costs a life and means a rematch. Every game was decided when the climb began
 * (from the run), so watching only shows it.
 */
export function Gauntlet({
  lineup,
  team,
  ladder,
  seed,
  week,
  ourName,
  coins,
  best,
  onGame,
  onAgain,
  onHome,
}: {
  lineup: Lineup;
  team: TeamRating & { pf?: number; pa?: number };
  ladder: PlayoffTeam[];
  seed: string;
  /** "2026-W43" */
  week: string;
  ourName: string;
  coins: number;
  /** your best climb this week, before this one */
  best: number;
  /** a game was watched: credit it */
  onGame: (g: GauntletGame, index: number, all: GauntletGame[]) => void;
  onAgain: () => void;
  onHome: () => void;
}) {
  const games = useMemo(() => climb(team, ladder, seed), [team, ladder, seed]);
  const casts = useMemo(
    () =>
      games.map((g, i) =>
        castGame({ lineup, opp: g.opp, won: g.won, score: g.score, pre: g.chance, seed: 'gauntlet:' + seed + ':' + i + ':' + g.opp.year + g.opp.team })
      ),
    [games, lineup, seed]
  );
  // how many games have been watched, and which one is on
  const [seen, setSeen] = useState(0);
  const [live, setLive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [earned, setEarned] = useState(0);
  const watched = games.slice(0, seen);
  const won = rungsWon(watched);
  const lost = watched.length - won;
  const lives = LIVES - lost;
  const done = seen === games.length;
  const cleared = done && won === GAUNTLET_SIZE;
  const next = games[seen];
  const last = watched[watched.length - 1];
  // the chance of reaching the top from here, with the lives left
  const odds = done ? (cleared ? 1 : 0) : clearChance(team.rating, ladder.slice(next!.rung), lives);
  const towerRef = useRef<HTMLDivElement>(null);

  // keep the rung you're on in view
  useEffect(() => {
    const el = towerRef.current?.querySelector('.rung.here, .rung.just');
    el?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [seen, live]);

  // back on the tower after a game: how it went
  useEffect(() => {
    if (live || !last) return;
    if (done && cleared) sfx.title();
    else if (last.won) sfx.seriesWin();
    else sfx.seriesLoss();
  }, [seen, live]);

  const play = () => {
    sfx.click();
    setLive(true);
  };
  const watchedOne = () => {
    const i = seen;
    const g = games[i];
    onGame(g, i, games);
    if (g.won) setEarned((e) => e + RUNG_COINS[g.rung] + (g.rung === GAUNTLET_SIZE - 1 ? CLEAR_COINS : 0));
    setSeen(i + 1);
    setLive(false);
  };

  if (live && next) {
    return (
      <div className="screen showdown">
        <GameCast
          games={[{ cast: casts[seen], n: 1, where: 'NEUTRAL', decider: true }]}
          round={'Gauntlet · Rung ' + (next.rung + 1) + ' of ' + GAUNTLET_SIZE + (lives === 1 ? ' · Last life' : '')}
          opp={next.opp}
          ourName={ourName}
          onDone={watchedOne}
        />
      </div>
    );
  }

  const rungs = ladder.map((opp, i) => {
    const plays = watched.filter((g) => g.rung === i);
    const beat = plays.find((g) => g.won);
    return { opp, i, plays, beat, castOf: (g: GauntletGame) => casts[games.indexOf(g)] };
  });
  const at = next ? next.rung : -1;
  const label = NFL ? 'KICK OFF' : 'TIP OFF';

  return (
    <div className="screen gauntlet">
      <div className="topbar">
        <button className="icon-btn pill-btn" onClick={() => (done ? onHome() : setLeaving(true))}>
          <Back size={16} /> {done ? 'HOME' : 'LEAVE'}
        </button>
        <span className="eyebrow">WEEK {week.split('-W')[1]}</span>
        <CoinChip coins={coins} from={coins - earned} delay={200} />
      </div>
      <div className="g-head">
        <h1 className="disp">THE GAUNTLET</h1>
        <span className="g-sub">Eight of the greatest teams ever · {LIVES} lives · a loss means a rematch</span>
        <div className="g-stats">
          <span className="g-lives" aria-label={lives + ' lives left'}>
            {Array.from({ length: LIVES }, (_, k) => (
              <i key={k} className={k < lives ? 'on' : k === lives && last && !last.won && !live ? 'off broke' : 'off'} aria-hidden="true" />
            ))}
          </span>
          <span>
            <b className="num">
              {won}/{GAUNTLET_SIZE}
            </b>
            rungs
          </span>
          <span>
            <b className="num">{done ? (cleared ? 'DONE' : '—') : pct(odds)}</b>
            to clear
          </span>
          <span>
            <b className="num">{Math.max(best, done ? won : 0)}</b>
            week best
          </span>
        </div>
      </div>

      <div className="tower" ref={towerRef}>
        {rungs
          .slice()
          .reverse()
          .map(({ opp, i, plays, beat, castOf }) => {
            const boss = i === GAUNTLET_SIZE - 1;
            const here = i === at && !done;
            const just = !!last && last.rung === i && !live;
            const failed = done && !cleared && i === last?.rung;
            const cls = ['rung', boss ? 'boss' : '', beat ? 'won' : '', here ? 'here' : '', just ? 'just' : '', failed ? 'fell' : '', !beat && !here && !failed ? 'locked' : ''].filter(Boolean).join(' ');
            const score = (g: GauntletGame) => {
              const c = castOf(g);
              return c.us + '–' + c.them;
            };
            return (
              <div key={i} className={cls} style={{ '--c1': opp.c1, '--c2': opp.c2 } as React.CSSProperties}>
                <span className="r-no disp num">{boss ? <Crown size={18} /> : i + 1}</span>
                <span className="r-team">
                  <strong>
                    {opp.year} {opp.team}
                  </strong>
                  <small>
                    {opp.w}–{opp.l}
                    {opp.t ? '–' + opp.t : ''} · {opp.star}
                    {boss ? ' · THE GREATEST' : ''}
                  </small>
                </span>
                <span className="r-state">
                  {beat ? (
                    <b className="w num">W {score(beat)}</b>
                  ) : here ? (
                    <b className="num chance">{Math.round(next!.chance * 100)}%</b>
                  ) : failed ? (
                    <b className="l num">L {score(plays[plays.length - 1])}</b>
                  ) : (
                    <Lock size={14} />
                  )}
                  {plays.filter((g) => !g.won).length > 0 && (beat || here || failed) && (
                    <small className="num">
                      {plays.filter((g) => !g.won).length} loss{plays.filter((g) => !g.won).length > 1 ? 'es' : ''}
                    </small>
                  )}
                  {!beat && !failed && <small className="num">+{RUNG_COINS[i] + (boss ? CLEAR_COINS : 0)}</small>}
                </span>
              </div>
            );
          })}
        <div className="tower-base">
          <span className="disp">{ourName.toUpperCase()}</span>
          <small>
            Team rating {team.rating.toFixed(1)} · {coinsFor(GAUNTLET_SIZE)} coins for the top
          </small>
        </div>
      </div>

      {done ? (
        <div className={'g-end' + (cleared ? ' cleared' : '')} role="status">
          <span className="g-stamp disp">{cleared ? 'LEGENDS BEATEN' : won + ' OF ' + GAUNTLET_SIZE}</span>
          <small>
            {cleared
              ? 'You climbed all eight. ' + (NFL ? 'Nobody does that.' : 'Even the ’96 Bulls didn’t.')
              : won === 0
                ? 'The legends were too much this time.'
                : 'Out of lives against the ' + last!.opp.year + ' ' + last!.opp.team + '.'}
            {earned ? ' +' + earned + ' coins.' : ''}
            {won > best ? ' A new best this week!' : ''}
          </small>
        </div>
      ) : null}

      <div className="foot">
        {done ? (
          <>
            <button className="big ghost small" onClick={onHome}>
              <span>HOME</span>
            </button>
            <button className="big small shine" onClick={onAgain}>
              <span>DRAFT AGAIN</span>
            </button>
          </>
        ) : (
          <button className={'big' + (next!.rung === GAUNTLET_SIZE - 1 ? ' gold' : '') + ' shine'} onClick={play}>
            <span>
              {last && !last.won ? 'REMATCH' : label} · {next!.opp.year.length > 4 ? next!.opp.year.slice(2) : next!.opp.year} {next!.opp.abbr}
              {lives === 1 ? ' · LAST LIFE' : ''}
            </span>
          </button>
        )}
      </div>
      {leaving && (
        <Confirm
          title="Leave the Gauntlet?"
          body="Your climb ends here. The coins you've won are yours."
          yes="LEAVE"
          no="KEEP CLIMBING"
          onNo={() => setLeaving(false)}
          onYes={() => {
            setLeaving(false);
            onHome();
          }}
        />
      )}
    </div>
  );
}
