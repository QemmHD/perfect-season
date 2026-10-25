import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CastEvent, GameCast as Cast } from '../engine/broadcast';
import { NFL } from '../engine/sport';
import type { PlayoffTeam } from '../engine/types';
import { crowd, sfx } from '../lib/sound';
import { Fit } from './common';
import { reducedMotion } from './motion';

/** How long a game takes to watch, in ms, at normal speed. */
const GAME_MS = NFL ? 17000 : 5200;
/** a series-deciding basketball game gets the full treatment */
const DECIDER_MS = 10500;

export interface CastGame {
  cast: Cast;
  /** basketball: game number in the series */
  n: number;
  where: 'HOME' | 'AWAY' | 'NEUTRAL';
  /** this game decides the series (or it's football's only game) */
  decider: boolean;
}

/** A team color that shows up on the dark board: the brighter of the two. */
export function brightOf(c1: string, c2: string): string {
  const lum = (c: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(c);
    if (!m) return 0.5;
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  return lum(c1) >= 0.18 ? c1 : lum(c2) >= lum(c1) ? c2 : c1;
}

function shortName(name: string): string {
  const letters = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return letters.slice(0, 4) || 'YOU';
}

/**
 * A playoff game (football) or a series (basketball) as it happens: the scoreboard and clock,
 * a win-probability chart that swings with every score, and the play-by-play of your players.
 */
export function GameCast({
  games,
  round,
  opp,
  ourName,
  seriesBefore,
  onDone,
}: {
  games: CastGame[];
  round: string;
  opp: PlayoffTeam;
  ourName: string;
  /** basketball: the series score before these games (always 0-0 today) */
  seriesBefore?: [number, number];
  onDone: () => void;
}) {
  // a basketball playoff round is a series; a single game (head to head) isn't
  const series = !NFL && games.length > 1;
  const reduced = reducedMotion();
  const [gi, setGi] = useState(0);
  const [p, setP] = useState(0);
  const [fast, setFast] = useState(false);
  const [phase, setPhase] = useState<'live' | 'final' | 'done'>('live');
  const rootRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<{ id: number; text: string; side: 'us' | 'them' } | null>(null);
  const g = games[gi];
  const cast = g.cast;
  const fastRef = useRef(fast);
  fastRef.current = fast;
  const seen = useRef(0);
  const flashId = useRef(0);
  const usColor = '#19E3C9';
  const themColor = brightOf(opp.c1, opp.c2);

  // the clock: game time runs with real time, slower in the last minutes of a close game
  useEffect(() => {
    if (phase !== 'live') return;
    seen.current = 0;
    setP(0);
    sfx.whistle();
    crowd.start(0.3);
    let heard = 0.3;
    const total = reduced ? 1200 : !NFL && g.decider ? DECIDER_MS : GAME_MS;
    let last = performance.now();
    let pos = 0;
    let raf = 0;
    let beat = 0;
    const tick = (now: number) => {
      const dt = Math.min(80, now - last);
      last = now;
      const shown = cast.events.filter((e) => e.t <= pos);
      const lastE = shown[shown.length - 1];
      const lead = lastE ? lastE.us - lastE.them : 0;
      const close = Math.abs(lead) <= (NFL ? 8 : 5);
      const slow = pos > (NFL ? 0.9 : 0.9) && close && !fastRef.current && !reduced;
      const rate = (fastRef.current ? 4 : 1) * (slow ? 0.45 : 1);
      pos = Math.min(1, pos + (dt / total) * rate);
      if (slow && now - beat > 1300) {
        beat = now;
        sfx.heartbeat();
      }
      // the crowd: on edge late in a close game, quiet in a blowout
      const want = close ? 0.3 + Math.max(0, pos - 0.7) * 2.2 : Math.abs(lead) > (NFL ? 21 : 18) ? 0.16 : 0.26;
      if (Math.abs(want - heard) > 0.06) {
        heard = want;
        crowd.level(want);
      }
      setP(pos);
      if (pos >= 1) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gi, phase === 'live']);

  // the plays as they happen: sounds, the big ones flash up
  const visible = useMemo(() => cast.events.filter((e) => e.t <= p), [cast, p]);
  useEffect(() => {
    const fresh = visible.slice(seen.current);
    if (!fresh.length) return;
    seen.current = visible.length;
    const scoring = fresh.filter((e) => e.side);
    const headline = [...fresh].reverse().find((e) => e.big || e.clutch);
    if (scoring.length) {
      const ours = scoring.some((e) => e.side === 'us');
      // basketball scores constantly: only the big plays get a sound
      if (NFL || headline) ours ? sfx.scoreUs(!!headline?.clutch || (NFL && scoring.some((e) => e.pts >= 6))) : sfx.scoreThem();
      // whose crowd it is decides who gets the roar
      const big = !!headline?.clutch || scoring.some((e) => e.pts >= 6) || !!headline?.big;
      const home = g.where === 'HOME' ? ours : g.where === 'AWAY' ? !ours : true;
      if (NFL || big) crowd.swell((big ? 0.9 : 0.45) * (home ? 1 : 0.35));
    }
    if (headline && (NFL ? headline.pts >= 6 || headline.clutch : headline.clutch)) {
      const text = headline.clutch ? (headline.side === 'us' ? (NFL ? 'GAME-WINNER!' : 'BUZZER-BEATER!') : 'DAGGER') : headline.pts >= 6 ? 'TOUCHDOWN' : headline.pts === 2 ? 'SAFETY' : 'SCORE';
      setFlash({ id: ++flashId.current, text, side: headline.side ?? 'us' });
      // the screen jolts, harder for a game-winner
      const k = headline.clutch ? 7 : 4;
      if (!reduced)
        rootRef.current?.animate?.([{ transform: 'none' }, { transform: 'translate(' + -k + 'px,' + k / 2 + 'px)' }, { transform: 'translate(' + k + 'px,' + -k / 2 + 'px)' }, { transform: 'translate(' + -k / 2 + 'px,0)' }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
    }
  }, [visible]);

  // the final whistle
  const atGame = useRef(-1);
  useEffect(() => {
    if (phase !== 'live' || p < 1 || atGame.current === gi) return;
    atGame.current = gi;
    sfx.buzzer();
    setPhase('final');
    window.setTimeout(() => (cast.won ? sfx.roar() : sfx.gameLoss()), 250);
    // the crowd goes up for a win; after the last game it files out
    crowd.swell(cast.won === (g.where !== 'AWAY') ? 1 : 0.2);
    if (gi === games.length - 1) filesOut.current = window.setTimeout(() => crowd.stop(2.5), 1800);
    else crowd.level(0.15);
  }, [p >= 1, phase]);

  // leaving the game takes the crowd with it (and the next game's crowd is its own)
  const filesOut = useRef(0);
  useEffect(
    () => () => {
      clearTimeout(filesOut.current);
      crowd.stop(0.4);
    },
    []
  );
  // the dialog takes focus, so a screen reader starts here
  useEffect(() => rootRef.current?.focus({ preventScroll: true }), []);
  // the final whistle's button lands where SKIP was: it arms a moment later, so the second tap of
  // a double tap on SKIP isn't a CONTINUE
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (phase !== 'final') return setArmed(false);
    const t = window.setTimeout(() => setArmed(true), 400);
    return () => clearTimeout(t);
  }, [phase]);

  // basketball: on to the next game of the series
  useEffect(() => {
    if (phase !== 'final' || gi === games.length - 1) return;
    const t = window.setTimeout(
      () => {
        // the new game starts at its own tip-off, never at the last one's final buzzer
        setP(0);
        setGi(gi + 1);
        setPhase('live');
        setFlash(null);
      },
      reduced ? 500 : 1700
    );
    return () => clearTimeout(t);
  }, [phase, gi]);

  const skip = () => {
    sfx.click();
    // to the end of the last game
    seen.current = games[games.length - 1].cast.events.length;
    setGi(games.length - 1);
    setP(1);
    setPhase('final');
    setFlash(null);
    sfx.buzzer();
    if (games[games.length - 1].cast.won) window.setTimeout(() => sfx.roar(), 250);
    crowd.stop(1.5);
  };

  const lastE: CastEvent | undefined = visible[visible.length - 1];
  const us = phase === 'live' ? (lastE?.us ?? 0) : cast.us;
  const them = phase === 'live' ? (lastE?.them ?? 0) : cast.them;
  const period = Math.min(4, Math.floor(Math.min(0.9999, p) * 4) + 1);
  const left = Math.max(0, (period - Math.min(1, p) * 4) * (NFL ? 15 : 12));
  const clock = p >= 1 ? 'FINAL' : Math.floor(left) + ':' + String(Math.floor((left % 1) * 60)).padStart(2, '0');
  const wpNow = lastE ? lastE.wp : (cast.wp[0]?.[1] ?? 0.5);
  const wpShown = p >= 1 ? (cast.won ? 1 : 0) : wpNow;

  // series score so far (basketball)
  const done = games.slice(0, gi + (phase === 'live' ? 0 : 1));
  const sw = (seriesBefore?.[0] ?? 0) + done.filter((x) => x.cast.won).length;
  const sl = (seriesBefore?.[1] ?? 0) + done.filter((x) => !x.cast.won).length;

  // the chart: our side above the middle, theirs below
  const pts = cast.wp.filter(([t]) => t <= p);
  const tip: [number, number] = [Math.min(p, 1), wpShown];
  const steps: string[] = [];
  // a stepped line: the probability holds between plays, then jumps
  [...pts, tip].forEach(([t, w], i, a) => {
    const x = (t * 300).toFixed(1);
    const y = ((1 - w) * 96 + 2).toFixed(1);
    if (i === 0) steps.push('M' + x + ',' + y);
    else {
      const py = ((1 - a[i - 1][1]) * 96 + 2).toFixed(1);
      steps.push('L' + x + ',' + py, 'L' + x + ',' + y);
    }
  });
  const area = steps.join(' ') + ' L' + (tip[0] * 300).toFixed(1) + ',50 L0,50 Z';

  const minWp = Math.min(...cast.wp.map(([, w]) => w));
  const maxWp = Math.max(...cast.wp.map(([, w]) => w));
  const tag =
    phase === 'live'
      ? null
      : cast.won && minWp < 0.15
        ? 'COMEBACK'
        : cast.won && cast.wp[0][1] < 0.4
          ? 'UPSET'
          : !cast.won && maxWp > 0.85
            ? 'COLLAPSE'
            : cast.events.some((e) => e.clutch)
              ? cast.won
                ? 'CLUTCH'
                : 'HEARTBREAKER'
              : null;

  const feed = visible.filter((e) => e.big || (NFL && e.side)).slice(-4).reverse();
  const last = gi === games.length - 1;
  const ourAbbr = shortName(ourName);
  const ourStar = cast.stars.find((s) => s.side === 'us');
  const theirStar = cast.stars.find((s) => s.side === 'them');

  return (
    <div className="cast" ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={round + ' against ' + (opp.year ? 'the ' + opp.year + ' ' + opp.team : opp.team)}>
      <div className="cast-head">
        <span className="eyebrow">
          {round}
          {series ? ' · Game ' + g.n : ''}
        </span>
        <span className="cast-opp">vs {opp.year ? opp.year + ' ' + opp.team : opp.team}</span>
        {series && (
          <span className="cast-series num" aria-label={'Series ' + sw + ' to ' + sl}>
            SERIES {sw}–{sl}
          </span>
        )}
      </div>

      <div className={'cast-board' + (Math.max(us, them) >= 100 ? ' wide' : '')} style={{ '--us': usColor, '--them': themColor } as React.CSSProperties}>
        <div className={'side us' + (us > them ? ' ahead' : '')}>
          <i />
          <span className="abbr">{ourAbbr}</span>
          <b className="disp num" key={'u' + us}>
            {us}
          </b>
        </div>
        <div className="mid">
          <span className={'per' + (p >= 1 ? ' fin' : '')}>{p >= 1 ? 'FINAL' : 'Q' + period}</span>
          {p < 1 && <span className="clk num">{clock}</span>}
          <span className="where">{g.where}</span>
        </div>
        <div className={'side them' + (them > us ? ' ahead' : '')}>
          <b className="disp num" key={'t' + them}>
            {them}
          </b>
          <span className="abbr">{opp.abbr}</span>
          <i />
        </div>
      </div>

      <div className="cast-quarters num" aria-hidden="true">
        {[0, 1, 2, 3].map((q) => {
          const live = q + 1 <= period || p >= 1;
          const qs = visible.filter((e) => e.period === q + 1);
          const a = qs.reduce((x, e) => x + (e.side === 'us' ? e.pts : 0), 0);
          const b = qs.reduce((x, e) => x + (e.side === 'them' ? e.pts : 0), 0);
          return (
            <span key={q} className={live ? '' : 'off'}>
              <i>Q{q + 1}</i>
              {live ? a + '–' + b : '–'}
            </span>
          );
        })}
      </div>

      <div className="cast-wp">
        <div className="wp-head">
          <span>WIN PROBABILITY</span>
          <b className="num" style={{ color: wpShown >= 0.5 ? usColor : themColor }}>
            {Math.round((wpShown >= 0.5 ? wpShown : 1 - wpShown) * 100)}% {wpShown >= 0.5 ? ourAbbr : opp.abbr}
          </b>
        </div>
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <clipPath id="wp-top">
              <rect x="0" y="0" width="300" height="50" />
            </clipPath>
            <clipPath id="wp-bot">
              <rect x="0" y="50" width="300" height="50" />
            </clipPath>
          </defs>
          {[75, 150, 225].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="100" className="qline" />
          ))}
          <line x1="0" y1="50" x2="300" y2="50" className="midline" />
          <path d={area} fill={usColor} fillOpacity="0.22" clipPath="url(#wp-top)" />
          <path d={area} fill={themColor} fillOpacity="0.22" clipPath="url(#wp-bot)" />
          <path d={steps.join(' ')} fill="none" stroke="#fff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <circle cx={tip[0] * 300} cy={(1 - tip[1]) * 96 + 2} r="3.2" fill={wpShown >= 0.5 ? usColor : themColor} className="tipdot" />
        </svg>
      </div>

      <ol className="cast-feed" aria-live="polite">
        {feed.map((e) => (
          <li key={e.t + e.text} className={(e.side ?? '') + (e.clutch ? ' clutch' : '')}>
            <span className="when num">
              Q{e.period} {e.clock}
            </span>
            <span className="what">{e.text}</span>
            {e.side && (
              <b className="num">
                {e.us}–{e.them}
              </b>
            )}
          </li>
        ))}
        {!feed.length && <li className="pre">{NFL ? 'Kickoff. Your offense takes the field.' : 'Tip-off. Here we go.'}</li>}
      </ol>

      {flash && phase === 'live' && (
        <div className={'cast-flash ' + flash.side} key={flash.id} aria-hidden="true">
          <span className="disp">{flash.text}</span>
        </div>
      )}

      {phase !== 'live' && (
        <div className={'cast-final ' + (cast.won ? 'won' : 'lost')}>
          <span className="stamp disp">{cast.won ? 'WIN' : 'LOSS'}</span>
          {tag && <span className="tag">{tag}</span>}
          {ourStar && (
            <div className="star">
              <span className="eyebrow">{cast.won ? 'Player of the game' : 'Your best'}</span>
              <strong>{ourStar.name}</strong>
              <small className="num">{ourStar.line}</small>
            </div>
          )}
          {theirStar && (
            <div className="star them">
              <span className="eyebrow">{opp.abbr}</span>
              <strong>{theirStar.name}</strong>
              <small className="num">{theirStar.line}</small>
            </div>
          )}
        </div>
      )}

      <div className="spacer" />
      <div className="actionbar cast-actions">
        {phase === 'live' || !last ? (
          <>
            <button className={'btn ghost' + (fast ? ' on' : '')} onClick={() => (sfx.click(), setFast(!fast))} aria-pressed={fast}>
              {fast ? '4× FAST' : '1× SPEED'}
            </button>
            <button className="btn ghost" onClick={skip}>
              {series ? 'SKIP SERIES' : 'SKIP TO FINAL'}
            </button>
          </>
        ) : (
          <button className={'big' + (cast.won ? ' gold shine' : '') + (armed ? '' : ' arming')} aria-disabled={!armed} onClick={() => {
            if (!armed) return;
            sfx.click();
            setPhase('done');
            onDone();
          }}>
            <Fit text="CONTINUE" />
          </button>
        )}
      </div>
    </div>
  );
}
