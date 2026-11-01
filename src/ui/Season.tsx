import React, { useEffect, useMemo, useRef, useState } from 'react';
import { castGame, seasonHeadlines } from '../engine/broadcast';
import { gameOdds, homeGame, isPerfect, PLAYOFF_MIN_WINS, playoffOutcome, ROUND_NAMES, type Series, seriesScore } from '../engine/playoffs';
import { BALANCE_FLOOR, GAMES, gradeFor } from '../engine/rating';
import { DRAW, type GameScore, lineupKey, type Season } from '../engine/season';
import { pick } from '../engine/sport';
import { type Lineup, type Player, SLOTS } from '../engine/types';
import { sfx } from '../lib/sound';
import { Confetti, Fit, TeamChips } from './common';
import { type CastGame, GameCast } from './GameCast';
import { Flame } from './icons';
import { CountUp, reducedMotion } from './motion';
import { oppNames, Scout, teamBar } from './Scout';
import { cardName, CHAMPS, FINAL_NAME, PERFECT_PLAYOFFS, PERFECT_RECORD, record } from './sportui';

/** Delay before each game of the reveal: quick through the middle, slower at the end, and
    one beat per game when an unbeaten season gets close. Football's 17 games each get a moment. */
function revealDelays(seq: number[]): number[] {
  const out: number[] = [];
  let unbeaten = true;
  for (let i = 0; i < GAMES; i++) {
    let d: number;
    if (SOCCER) {
      // Claude 2026-11-01: soccer's 38 matchdays, between football's beats and basketball's ticker
      d = i < 3 ? 220 - i * 25 : 105;
      if (i >= 30) d = 150 + (i - 30) * 20;
      if (unbeaten && i >= 30) d = 320 + (i - 30) * 60;
    } else if (FOOTBALL) {
      d = i < 3 ? 300 - i * 30 : 190;
      if (i >= 13) d = 230 + (i - 13) * 30;
      if (unbeaten && i >= 13) d = 420 + (i - 13) * 90;
    } else {
      d = i < 8 ? 92 - i * 8 : 30;
      if (i >= 72) d = 42 + (i - 72) * 9;
      if (unbeaten && i >= 75) d = 280 + (i - 75) * 45;
    }
    out.push(d);
    if (seq[i] === 0) unbeaten = false;
  }
  return out;
}

/** A milestone to pop after a win: the win that clinches the playoffs, and round numbers on the way. */
function milestone(wins: number): { text: string; clinch: boolean } | null {
  if (wins === PLAYOFF_MIN_WINS) return { text: pick({ nba: 'PLAYOFFS CLINCHED', nfl: 'PLAYOFFS CLINCHED', soccer: 'CUP PLACE SECURED' }), clinch: true };
  if (wins % pick({ nba: 10, nfl: 5, soccer: 10 }) === 0) return { text: wins + ' WINS', clinch: false };
  return null;
}

/** Claude 2026-11-01: soccer is the third sport; these name every sport's answer. */
const SOCCER = pick({ nba: false, nfl: false, soccer: true });
const FOOTBALL = pick({ nba: false, nfl: true, soccer: false });
/** one game a round, with a score (football and soccer) */
const ONE_GAME = pick({ nba: false, nfl: true, soccer: true });

/** Football's season, game by game: result, score and opponent. */
function Schedule({ scores, tick }: { scores: GameScore[]; tick: number }) {
  return (
    <div className={'sched' + (SOCCER ? ' soccer' : '')} aria-hidden="true">
      {scores.map((g, i) => {
        const shown = i < tick;
        const won = g.us > g.them;
        const drew = g.us === g.them;
        return (
          <span key={i} className={shown ? (won ? 'w' : drew ? 'd' : 'l') : ''}>
            <i>
              {g.home ? 'vs' : '@'} {g.opp}
            </i>
            <b className="num">{shown ? (won ? 'W ' : drew ? 'D ' : 'L ') + g.us + '–' + g.them : pick({ nba: 'G ', nfl: 'WK ', soccer: 'MD ' }) + (i + 1)}</b>
          </span>
        );
      })}
    </div>
  );
}
/** A game slow enough to get a beat of its own: the close of an unbeaten season (football's every game is a beat, so only that finish). */
const SLOW = pick({ nba: 200, nfl: 420, soccer: 320 });

export function Reveal({ season, lineup, label, onDone }: { season: Season; lineup: Lineup; label: string; onDone: () => void }) {
  const [tick, setTick] = useState(0);
  const done = tick >= GAMES;
  const timer = useRef<number | null>(null);
  const delays = useMemo(() => revealDelays(season.seq), [season]);
  /** milestone pops: every 10 wins, and the 50th win that clinches a playoff spot */
  const [pop, setPop] = useState<{ id: number; text: string; clinch: boolean } | null>(null);

  // first the team rating, built player by player, then the balance it gets
  const players = useMemo(() => SLOTS.map((k) => lineup[k]).filter(Boolean) as Player[], [lineup]);
  const n = players.length;
  const [build, setBuild] = useState(() => (reducedMotion() ? n + 1 : 0));
  const built = build > n;
  useEffect(() => {
    if (built) return;
    const t = window.setTimeout(
      () => {
        const next = build + 1;
        setBuild(next);
        if (next <= n) sfx.count(next);
        else sfx.stamp();
      },
      build === 0 ? 450 : build === n ? 560 : 340
    );
    return () => clearTimeout(t);
  }, [build]);
  const mult = BALANCE_FLOOR + (1 - BALANCE_FLOOR) * season.balance;
  const running = build <= n ? players.slice(0, build).reduce((a, p) => a + p.val, 0) : season.rating;

  // a few games get a headline, credited to your players
  const headlines = useMemo(() => seasonHeadlines(lineup, season.seq, season.scores, lineupKey(lineup)), [season, lineup]);
  const [hl, setHl] = useState<{ text: string; until: number } | null>(null);

  // SKIP ends the reveal for good: the ticker mustn't start again once the build is done
  const skipped = useRef(false);
  useEffect(() => {
    if (!built || skipped.current) return;
    if (reducedMotion()) {
      setTick(GAMES);
      return;
    }
    let i = 0;
    let wins = 0;
    const step = () => {
      i++;
      setTick(i);
      const won = season.seq[i - 1] === 1;
      if (won) {
        wins++;
        const m = milestone(wins);
        if (m) {
          setPop({ id: i, ...m });
          (m.clinch ? sfx.seriesWin : sfx.coin)();
        }
      }
      const h = headlines.find((x) => x.i === i - 1);
      if (h) setHl({ text: h.text, until: Date.now() + pick({ nba: 1500, nfl: 1300, soccer: 1300 }) });
      if (FOOTBALL || delays[i - 1] >= SLOW) (won ? sfx.gameWin : sfx.gameLoss)();
      else (won ? sfx.tickerWin : sfx.tickerLoss)();
      if (i >= GAMES) return;
      if (delays[i] >= SLOW) sfx.heartbeat();
      timer.current = window.setTimeout(step, delays[i]);
    };
    timer.current = window.setTimeout(step, 750);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [season, built]);

  const g = gradeFor(season.wins);
  useEffect(() => {
    if (!done) return;
    sfx.stamp();
    const t = window.setTimeout(() => sfx.result(g.letter), 160);
    return () => clearTimeout(t);
  }, [done]);

  const shown = season.seq.slice(0, tick);
  const w = shown.filter((x) => x === 1).length;
  // soccer's draws (Claude 2026-11-01): the board is W–D–L
  const d = shown.filter((x) => x === DRAW).length;
  const l = shown.length - w - d;
  let streak = 0;
  for (let i = shown.length - 1; i >= 0 && shown[i] === 1; i--) streak++;
  const slowBeat = tick > 0 && tick < GAMES && delays[tick - 1] >= SLOW;
  const skip = () => {
    skipped.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setBuild(n + 1);
    setTick(GAMES);
  };
  const showBuild = tick === 0 && !done;
  const headline = hl && !done && Date.now() < hl.until ? hl.text : null;
  const unbeaten = done && season.wins === GAMES;
  const madeIt = season.wins >= PLAYOFF_MIN_WINS;

  return (
    <div className="screen reveal">
      <span className="eyebrow wide">Regular season · {label}</span>
      <TeamChips players={SLOTS.map((s) => lineup[s])} stagger lit={showBuild ? build - 1 : -1} on={showBuild ? build : 99} />
      {showBuild ? (
        <div className={'board build' + (built ? ' done' : '')} aria-live="polite" aria-label={'Team rating ' + running.toFixed(1)}>
          <span className="lbl">TEAM RATING</span>
          <b className="disp num">
            <CountUp value={running} from={0} ms={300} format={(v) => v.toFixed(1)} />
          </b>
          <span className={'add' + (built ? ' mult' : '')} key={build}>
            {build === 0 ? 'Your starters…' : build <= n ? '+' + players[build - 1].val.toFixed(1) + ' ' + cardName(players[build - 1]) : '× ' + mult.toFixed(2) + ' balance'}
          </span>
        </div>
      ) : (
      <div className={'board' + (slowBeat ? ' tense' : '') + (unbeaten ? ' gold' : '') + (SOCCER ? ' three' : '')} aria-live="polite" aria-label={'Record ' + w + (SOCCER ? ', ' + d + ' draws' : '') + ' and ' + l}>
        {!done && streak >= 3 && (
          <span className={'winstreak' + (streak >= 10 ? ' hot' : '')} key={'s' + streak} aria-hidden="true">
            <Flame size={14} /> {streak} STRAIGHT
          </span>
        )}
        <div className="side">
          <b className={'disp num w' + (slowBeat ? ' beat' : '')} key={slowBeat ? 'w' + w : 'w'}>
            {w}
          </b>
          <span>WINS</span>
        </div>
        <span className="disp dash">–</span>
        {SOCCER && (
          <>
            <div className="side">
              <b className="disp num d">{d}</b>
              <span>DRAWS</span>
            </div>
            <span className="disp dash">–</span>
          </>
        )}
        <div className="side">
          <b className={'disp num l' + (slowBeat && shown[shown.length - 1] === 0 ? ' beat' : '')} key={slowBeat ? 'l' + l : 'l'}>
            {l}
          </b>
          <span>LOSSES</span>
        </div>
      </div>
      )}
      {pop && !done && (
        <span className={'milestone' + (pop.clinch ? ' clinch' : '')} key={pop.id} aria-hidden="true">
          {pop.text}
        </span>
      )}
      {headline ? (
        <span className="eyebrow gameno headline" key={headline}>
          {headline}
        </span>
      ) : (
        <span className="eyebrow gameno">
          {done
            ? pick({ nba: 'Final record', nfl: 'Final record', soccer: 'Final record · ' + (season.points ?? 0) + ' points' })
            : tick === 0
              ? pick({ nba: 'Tip-off', nfl: 'Kickoff', soccer: 'Kickoff' })
              : pick({ nba: 'Game ', nfl: 'Week ', soccer: 'Matchday ' }) + tick + ' of ' + GAMES + (streak >= 5 ? ' · ' + streak + ' straight wins' : '')}
        </span>
      )}
      {ONE_GAME && season.scores ? (
        <Schedule scores={season.scores} tick={tick} />
      ) : (
        <div className="dots" aria-hidden="true">
          {season.seq.map((x, i) => (
            <i key={i} className={i < tick ? (x === 1 ? 'w' : x === DRAW ? 'd' : 'l') : ''} />
          ))}
        </div>
      )}
      {done && (
        <div className="verdict">
          {unbeaten && <div className="unbeaten disp">UNDEFEATED · {PERFECT_RECORD}</div>}
          <div className="gradeline">
            <span className="stampwrap">
              <i className="shock" style={{ borderColor: g.color }} />
              <span className="gradebadge disp stamp" style={{ borderColor: g.color, color: g.color }}>
                {g.letter}
              </span>
            </span>
            <span className="disp tier" style={{ color: g.color }}>
              {g.tier}
            </span>
          </div>
          <div className="pills">
            <span className="pill rise-in" style={{ animationDelay: '380ms' }}>
              Longest win streak <b className="num">{season.longestWin}</b>
            </span>
            {SOCCER ? (
              <span className="pill rise-in" style={{ animationDelay: '460ms' }}>
                Goals a game{' '}
                <b className="num">
                  {(season.pf ?? 0).toFixed(1)}–{(season.pa ?? 0).toFixed(1)}
                </b>
              </span>
            ) : FOOTBALL ? (
              <span className="pill rise-in" style={{ animationDelay: '460ms' }}>
                Points a game{' '}
                <b className="num">
                  {(season.pf ?? 0).toFixed(1)}–{(season.pa ?? 0).toFixed(1)}
                </b>
              </span>
            ) : (
              <span className="pill rise-in" style={{ animationDelay: '460ms' }}>
                First half{' '}
                <b className="num">
                  {season.firstHalfWins}–{41 - season.firstHalfWins}
                </b>
              </span>
            )}
            <span className="pill rise-in" style={{ animationDelay: '540ms' }}>
              Team rating <b className="num">{season.rating.toFixed(1)}</b>
            </span>
          </div>
          {/* an unbeaten season's banner already says it, and the screen needs the room */}
          {!unbeaten && (
            <span className={'qualify rise-in' + (madeIt ? ' in' : '')} style={{ animationDelay: '640ms' }}>
              {madeIt ? pick({ nba: 'Made the playoffs', nfl: 'Made the playoffs', soccer: 'Into the cup' }) : pick({ nba: 'Missed the playoffs · ', nfl: 'Missed the playoffs · ', soccer: 'Missed the cup · ' }) + PLAYOFF_MIN_WINS + ' wins get you in'}
            </span>
          )}
        </div>
      )}
      {done && g.letter.startsWith('S') && <Confetti density={1.2} />}
      <div className="spacer" />
      <div className="actionbar">
        <button className={done ? (madeIt ? 'big gold shine' : 'big shine') : 'big ghost'} onClick={done ? onDone : skip}>
          <Fit text={done ? (madeIt ? pick({ nba: 'START THE PLAYOFFS', nfl: 'START THE PLAYOFFS', soccer: 'START THE CUP' }) : 'SEE RESULTS') : 'SKIP'} />
        </button>
      </div>
    </div>
  );
}

export function Playoffs({ season, bracket, lineup, ourName, onDone }: { season: Season; bracket: Series[]; lineup: Lineup; ourName: string; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  /** the round being watched live */
  const [watching, setWatching] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const [champ, setChamp] = useState(false);
  const [scout, setScout] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  useEffect(() => {
    cardRefs.current[idx]?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [idx]);
  const cur = bracket[idx];
  const curDone = shown >= cur.games.length;
  const out = playoffOutcome(bracket);

  // every game of every round, told as it happens (the results are already decided)
  const casts = useMemo(
    () =>
      bracket.map((ser, round): CastGame[] => {
        const highSeed = season.wins >= ser.opp.wFull;
        const key = lineupKey(lineup);
        return ser.games.map((won, j) => ({
          cast: castGame({
            lineup,
            opp: ser.opp,
            won: won === 1,
            score: ONE_GAME && ser.scores ? ser.scores[j] : null,
            pens: ser.pens,
            pre: gameOdds(season.rating, season.wins, ser.opp, round, j),
            seed: key + ':' + round + ':' + j + ':' + ser.opp.year + ser.opp.team,
          }),
          n: j + 1,
          where: ONE_GAME ? (round === 3 ? 'NEUTRAL' : highSeed ? 'HOME' : 'AWAY') : homeGame(j, highSeed) ? 'HOME' : 'AWAY',
          decider: ONE_GAME || j === ser.games.length - 1,
        }));
      }),
    [bracket, lineup]
  );

  const play = (round: number) => {
    setRunning(true);
    setShown(0);
    setWatching(round);
  };

  /** the round is over: show it on the bracket */
  const watched = () => {
    const round = watching;
    if (round === null) return;
    const ser = bracket[round];
    setWatching(null);
    setShown(ser.games.length);
    setRunning(false);
    if (ser.won) {
      if (round === 3) {
        sfx.title();
        timer.current = window.setTimeout(() => setChamp(true), 650);
      } else sfx.seriesWin();
    } else sfx.seriesLoss();
  };

  const action = () => {
    if (running) return;
    if (!curDone) return play(idx);
    if (cur.won && idx < 3) {
      setIdx(idx + 1);
      play(idx + 1);
      return;
    }
    if (cur.won && idx === 3 && !champ) {
      setChamp(true);
      return;
    }
    onDone();
  };

  let label = 'SEE RESULTS';
  if (running) label = 'PLAYING…';
  else if (!curDone) label = 'PLAY THE ' + ROUND_NAMES[idx].toUpperCase();
  else if (cur.won && idx < 3) label = 'NEXT: ' + ROUND_NAMES[idx + 1].toUpperCase();

  const [pw, pl] = bracket.slice(0, idx + 1).reduce(
    (acc, b, i) => {
      const [a, c] = seriesScore(i < idx ? b.games : b.games.slice(0, shown));
      return [acc[0] + a, acc[1] + c];
    },
    [0, 0]
  );

  // while a game is on, the screen under it can't be reached (React 18 has no inert prop)
  const under = (watching !== null ? { inert: '' } : {}) as React.HTMLAttributes<HTMLDivElement>;
  return (
    <div className="screen playoffs">
      <div className="po-head" {...under}>
        <span className="disp po-title">{pick({ nba: 'PLAYOFFS', nfl: 'PLAYOFFS', soccer: 'THE CUP' })}</span>
        <span className="po-sub">
          {pick({
            nba: 'Your ' + record(season.wins) + ' team vs the all-time greats. Go 16–0 for a Perfect Season.',
            nfl: 'Your ' + record(season.wins) + ' team vs the all-time greats. One game a round: win four for the Super Bowl.',
            soccer: 'Your ' + record(season.wins) + ' side vs the great champions. One game a round, penalties if level: win four for the cup.',
          })}
        </span>
        <span className="po-rec num" aria-label={'Playoff record ' + pw + ' and ' + pl}>
          {pw}–{pl}
        </span>
      </div>
      <div className="series-list" {...under}>
        {bracket.map((b, i) => {
          const isCur = i === idx;
          const n = i < idx ? b.games.length : isCur ? shown : 0;
          const g = b.games.slice(0, n);
          const [w, l] = seriesScore(g);
          const finished = i < idx || (isCur && curDone);
          let status = 'LOCKED';
          let tone = 'sub';
          let dim = false;
          const sc = ONE_GAME && b.scores && n > 0 ? b.scores[0] : null;
          // soccer: a level game's shootout, "1–1 · 4–3 PENS"
          const pens = sc && b.pens ? ' · ' + b.pens[0] + '–' + b.pens[1] + ' PENS' : '';
          if (finished) {
            status = (b.won ? 'WON ' : 'LOST ') + (sc ? sc[0] + '–' + sc[1] + pens : w + '–' + l);
            tone = b.won ? 'teal' : 'red';
          } else if (isCur) {
            status = n === 0 ? (ONE_GAME && running ? 'LIVE' : 'UP NEXT') : 'LIVE · ' + w + '–' + l;
            tone = 'gold';
          } else if (curDone && !cur.won) {
            status = 'ELIMINATED';
            dim = true;
          } else if (i === idx + 1 && curDone) {
            status = 'UP NEXT';
            tone = 'gold';
          } else dim = true;
          const next = (isCur && !finished) || (i === idx + 1 && curDone && cur.won);
          const open = () => {
            sfx.click();
            setScout(i);
          };
          return (
            <div
              key={i}
              ref={(el) => (cardRefs.current[i] = el)}
              role="button"
              tabIndex={0}
              aria-label={'Scout the ' + b.opp.year + ' ' + b.opp.team + ', ' + ROUND_NAMES[i] + ', ' + status.toLowerCase()}
              onClick={open}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
              className={'series' + (isCur && !finished ? ' cur' : '') + (dim ? ' dim' : '') + (finished ? (b.won ? ' won' : ' lost') : '') + (isCur && running ? ' live' : '')}
            >
              <div className="hd">
                <span className="eyebrow">{ROUND_NAMES[i]}</span>
                <b className={'status ' + tone} key={status}>
                  {status}
                </b>
              </div>
              <div className="opp">
                <i style={{ background: teamBar(b.opp) }} />
                <div>
                  <strong>
                    {b.opp.year} {b.opp.team}
                  </strong>
                  <small>
                    {SOCCER ? b.opp.w + '–' + b.opp.t + '–' + b.opp.l : b.opp.w + '–' + b.opp.l + (b.opp.t ? '–' + b.opp.t : '')}
                    {b.opp.star ? ' · led by ' + b.opp.star : ''}
                    {i === 3 ? ' · Final boss' : ''}
                  </small>
                </div>
                <span className="scout-go" aria-hidden="true">
                  SCOUT
                  <svg width="7" height="11" viewBox="0 0 7 11">
                    <path d="M1.5 1.5 5.5 5.5 1.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
              {next && <div className="five">{oppNames(b)}</div>}
              {ONE_GAME ? (
                <div className={'games one' + (isCur && running ? ' live' : '')} aria-label={sc ? (b.won ? 'Won ' : 'Lost ') + sc[0] + ' to ' + sc[1] + pens : 'Not played'}>
                  <span className={sc ? (b.won ? 'w' : 'l') : ''}>{sc ? (b.won ? 'W ' : 'L ') + sc[0] + '–' + sc[1] + pens : isCur && running ? 'IN PROGRESS' : i === 3 ? 'NEUTRAL SITE' : season.wins >= b.opp.wFull ? 'AT HOME' : 'ON THE ROAD'}</span>
                </div>
              ) : (
                <div className="games" aria-label={'Games: ' + w + ' wins, ' + l + ' losses'}>
                  {[0, 1, 2, 3, 4, 5, 6].map((j) => (
                    <span key={j} className={j < g.length ? (g[j] === 1 ? 'w' : 'l') : j < 4 || !finished ? '' : 'na'}>
                      {j < g.length ? (g[j] === 1 ? 'W' : 'L') : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="spacer" />
      <div className="actionbar" {...under}>
        <button className={label === 'SEE RESULTS' ? 'big gold shine' : 'big' + (running ? ' busy' : '')} aria-disabled={running} onClick={action}>
          <Fit text={label} />
        </button>
      </div>
      {scout !== null && (
        <Scout series={bracket[scout]} gamesShown={scout < idx ? bracket[scout].games.length : scout === idx ? shown : 0} ours={season} onClose={() => setScout(null)} />
      )}
      {watching !== null && <GameCast games={casts[watching]} round={ROUND_NAMES[watching]} opp={bracket[watching].opp} ourName={ourName} onDone={watched} />}
      {champ && out.title && <Champions season={season} bracket={bracket} onGo={onDone} />}
    </div>
  );
}

function Champions({ season, bracket, onGo }: { season: Season; bracket: Series[]; onGo: () => void }) {
  const out = playoffOutcome(bracket);
  const perfect = isPerfect(season.wins, out);
  const [w, l] = ONE_GAME && out.finals.scores ? out.finals.scores[0] : seriesScore(out.finals.games);
  const finalPens = out.finals.pens ? ' (' + out.finals.pens[0] + '–' + out.finals.pens[1] + ' on penalties)' : '';
  const total = bracket.reduce((acc, b) => {
    const [a, c] = seriesScore(b.games);
    return [acc[0] + a, acc[1] + c];
  }, [0, 0]);
  return (
    <div className={'champ' + (perfect ? ' perfect' : '')} role="dialog" aria-modal="true" aria-label={perfect ? 'Perfect Season' : 'Champions'}>
      <div className="rays" aria-hidden="true" />
      <div className="champ-body">
        {pick({ nba: () => <TrophyArt />, nfl: () => <LombardiArt />, soccer: () => <TrophyArt /> })()}
        <span className="eyebrow champ-eyebrow">{perfect ? PERFECT_RECORD + ' · ' + PERFECT_PLAYOFFS : CHAMPS}</span>
        <h1 className="disp champ-title">{perfect ? 'PERFECT SEASON' : pick({ nba: 'CHAMPIONS', nfl: 'SUPER BOWL CHAMPS', soccer: 'CUP WINNERS' })}</h1>
        <p className="champ-line">
          Beat the {out.finals.opp.year} {out.finals.opp.team} {w}–{l}
          {finalPens} in the {FINAL_NAME}
        </p>
        <div className="champ-stats">
          <span>
            <b className="disp num">{record(season.wins)}</b>
            Regular season
          </span>
          <span>
            <b className="disp num">
              {total[0]}–{total[1]}
            </b>
            Playoffs
          </span>
        </div>
      </div>
      <div className="actionbar">
        <button className="big gold shine" onClick={onGo}>
          <span>SEE RESULTS</span>
        </button>
      </div>
      <Confetti density={perfect ? 3 : 2} colors={['#F5B83D', '#FFD36B', '#FFFFFF', '#19E3C9', '#FFE9A8']} />
    </div>
  );
}

/** The Lombardi Trophy: a football in kicking position on a tapered stand. */
function LombardiArt() {
  return (
    <svg className="trophy-art" width="132" height="168" viewBox="0 0 132 168" aria-hidden="true">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8E9AA3" />
          <stop offset="0.35" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#D3DBE0" />
          <stop offset="1" stopColor="#7C8891" />
        </linearGradient>
        <radialGradient id="lg2" cx="38%" cy="34%" r="75%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#D8E0E5" />
          <stop offset="1" stopColor="#7C8891" />
        </radialGradient>
      </defs>
      <g transform="rotate(-28 66 34)">
        <ellipse cx="66" cy="34" rx="34" ry="20" fill="url(#lg2)" />
        <path d="M40 34 H92" stroke="#6E7A83" strokeOpacity="0.6" strokeWidth="1.6" />
        <path d="M54 28 V40 M60 27 V41 M66 26.5 V41.5 M72 27 V41 M78 28 V40" stroke="#6E7A83" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M58 56 L74 56 L71 66 L61 66 Z" fill="url(#lg1)" />
      <path d="M61 66 H71 L84 140 H48 Z" fill="url(#lg1)" />
      <path d="M64 70 L56 136" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 140 H88 L92 160 H40 Z" fill="url(#lg1)" />
      <rect x="40" y="156" width="52" height="8" rx="2" fill="#5E6A73" />
    </svg>
  );
}

function TrophyArt() {
  return (
    <svg className="trophy-art" width="132" height="168" viewBox="0 0 132 168" aria-hidden="true">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B8801A" />
          <stop offset="0.35" stopColor="#FFE29A" />
          <stop offset="0.55" stopColor="#F5B83D" />
          <stop offset="1" stopColor="#9A6610" />
        </linearGradient>
        <radialGradient id="tb" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#FFF1C4" />
          <stop offset="0.5" stopColor="#F5B83D" />
          <stop offset="1" stopColor="#A86F12" />
        </radialGradient>
      </defs>
      <circle cx="66" cy="30" r="24" fill="url(#tb)" />
      <path d="M44 28 Q66 40 88 28 M66 6 V54 M47 16 Q66 26 85 16" stroke="#8A5A0C" strokeOpacity="0.55" strokeWidth="2" fill="none" />
      <path d="M40 58 H92 L82 116 Q66 124 50 116 Z" fill="url(#tg)" />
      <path d="M50 62 L56 112" stroke="#FFF6D8" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
      <rect x="58" y="118" width="16" height="16" fill="url(#tg)" />
      <path d="M36 134 H96 L102 160 H30 Z" fill="url(#tg)" />
      <rect x="30" y="156" width="72" height="8" rx="2" fill="#8A5A0C" />
    </svg>
  );
}
