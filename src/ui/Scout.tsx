import React from 'react';
import { matchupOdds, ROUND_NAMES, type Series, seriesScore, seriesWinChance } from '../engine/playoffs';
import { GAMES } from '../engine/rating';
import { pick } from '../engine/sport';

/** Claude 2026-11-01: soccer's cup ties are one game, like football's; each branch names all three. */
const ONE_GAME = pick({ nba: false, nfl: true, soccer: true });
const SOCCER = pick({ nba: false, nfl: false, soccer: true });
const SOCCER_ORDER = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
import { type OppPlayer, type PlayoffTeam, SLOTS } from '../engine/types';
import { Sheet, lastName } from './common';
import { honorLabel, oppCols, record } from './sportui';

const pct = (x: number) => Math.round(x * 100) + '%';

/** A team's color bar: both colors, so a black primary (Spurs, Nets) still shows on the dark UI. */
export const teamBar = (t: PlayoffTeam) => 'linear-gradient(180deg,' + t.c1 + ' 0 55%,' + t.c2 + ' 55% 100%)';

/** The five names of a playoff opponent, guards first, for one-line summaries. */
export function oppNames(s: Series): string {
  // soccer: the eleven's five best, a line can't hold eleven
  if (SOCCER)
    return s.opp.five
      .slice()
      .sort((a, b) => (b.s.ovr ?? 0) - (a.s.ovr ?? 0))
      .slice(0, 5)
      .map((p) => lastName(p.name))
      .join(' · ');
  return sortedFive(s)
    .map((p) => lastName(p.name))
    .join(' · ');
}

function sortedFive(s: Series) {
  const order = (pos: string) => (SOCCER ? SOCCER_ORDER.indexOf(pos.split('/')[0]) : (SLOTS.indexOf(pos as never) + SLOTS.length) % SLOTS.length);
  return s.opp.five.slice().sort((a, b) => order(a.pos) - order(b.pos));
}

/** A key player's row: position, name (a defender's honor beside it) and three stats. */
function KeyRow({ p }: { p: OppPlayer }) {
  const honor = honorLabel(p);
  return (
    <div className="scout-row">
      <span>
        <b className="pos">{p.pos}</b>
        <span className="nm">{p.name}</span>
        {honor && <em className="honor">{honor}</em>}
      </span>
      {oppCols(p)
        .slice(0, 3)
        .map((c) => (
          <i className="num" key={c.key}>
            <small>{c.label}</small>
            {c.text}
          </i>
        ))}
    </div>
  );
}

/**
 * Scouting report on one playoff opponent: who they are, their five players by minutes,
 * and your odds. After the series it also shows how it went.
 */
export function Scout({ series, gamesShown, ours, onClose }: { series: Series; gamesShown: number; ours: { rating: number; wins: number }; onClose: () => void }) {
  const t = series.opp;
  const odds = matchupOdds(ours.rating, t);
  const chance = seriesWinChance(ours.rating, ours.wins, t, series.round);
  const played = t.w + t.l + t.t;
  const games = series.games.slice(0, gamesShown);
  const finished = series.played && gamesShown >= series.games.length;
  const [w, l] = seriesScore(games);
  const est = t.five.some((p) => p.est);
  return (
    <Sheet label={'Scouting the ' + t.year + ' ' + t.team} onClose={onClose}>
      {(close) => (
        <>
          <div className="scout-head">
            <i style={{ background: teamBar(t) }} aria-hidden="true" />
            <div>
              <span className="eyebrow">
                {ROUND_NAMES[series.round]}
                {series.round === 3 ? ' · Final boss' : ''}
              </span>
              <h2 className="disp">
                {t.year} {t.team}
              </h2>
              <small className="num">
                {SOCCER ? t.w + '–' + t.t + '–' + t.l + ' in the league' : t.w + '–' + t.l + (t.t ? '–' + t.t : '') + ' in the regular season'}
                {played !== GAMES ? ' · ' + record(t.wFull) + ' over ' + GAMES + ' games' : ''}
              </small>
              {pick({
                nba: null,
                nfl: (
                  <small className="num">
                    Scored {t.pf?.toFixed(1)}, allowed {t.pa?.toFixed(1)} a game{t.champ ? ' · won the Super Bowl' : ''}
                  </small>
                ),
                soccer: (
                  <small className="num">
                    {t.pf?.toFixed(2)} goals for, {t.pa?.toFixed(2)} against a game{t.champ ? ' · league champions' : ''}
                    {t.ucl ? ' · won the Champions League' : ''}
                  </small>
                ),
              })}
            </div>
          </div>

          {SOCCER ? (
            <div className="scout-five nfl">
              <div className="scout-row hd">
                <span>Their eleven</span>
              </div>
              {sortedFive(series).map((p) => (
                <KeyRow p={p} key={p.name} />
              ))}
              <p className="note">Goals and assists in that league season, and each player’s rating.</p>
            </div>
          ) : ONE_GAME ? (
            <div className="scout-five nfl">
              <div className="scout-row hd">
                <span>Their key players</span>
              </div>
              {sortedFive(series).map((p) => (
                <KeyRow p={p} key={p.name} />
              ))}
              {!!t.def?.length && (
                <>
                  <div className="scout-row hd">
                    <span>Their defense</span>
                  </div>
                  {t.def.map((p) => (
                    <KeyRow p={p} key={p.name} />
                  ))}
                </>
              )}
              <p className="note">Offense per game, defense that season (– not kept then). They allowed {t.pa?.toFixed(1)} points a game.</p>
            </div>
          ) : (
            <div className="scout-five">
              <div className="scout-row hd">
                <span>Their 5 by minutes</span>
                <i>PTS</i>
                <i>REB</i>
                <i>AST</i>
                <i>STL</i>
                <i>BLK</i>
              </div>
              {sortedFive(series).map((p) => (
                <div className="scout-row" key={p.name}>
                  <span>
                    <b className="pos">{p.pos}</b>
                    <span className="nm">{p.name}</span>
                  </span>
                  <i className="num">{p.s.pts.toFixed(1)}</i>
                  <i className="num">{p.s.reb.toFixed(1)}</i>
                  <i className="num">{p.s.ast.toFixed(1)}</i>
                  <i className="num">{p.s.stl.toFixed(1)}</i>
                  <i className="num">{p.s.blk.toFixed(1)}</i>
                </div>
              ))}
              {est && <p className="note">Steals and blocks before 1973–74 weren’t recorded; these are estimates.</p>}
            </div>
          )}

          <div className="scout-odds">
            <div>
              <b className="disp num">{pct(odds.home)}</b>
              <span>{ONE_GAME ? 'At home' : 'Each home game'}</span>
            </div>
            <div>
              <b className="disp num">{pct(ONE_GAME && series.round === 3 ? odds.neutral : odds.road)}</b>
              <span>{ONE_GAME ? (series.round === 3 ? 'Neutral site' : 'On the road') : 'Each road game'}</span>
            </div>
            <div className={chance >= 0.5 ? 'fav' : 'dog'}>
              <b className="disp num">{pct(chance)}</b>
              <span>{pick({ nba: 'To win the series', nfl: 'To win this game', soccer: 'To go through' })}</span>
            </div>
          </div>
          <p className="note">
            {ONE_GAME
              ? series.round === 3
                ? 'The ' + pick({ nba: 'Finals are', nfl: 'Super Bowl is', soccer: 'Final is' }) + ' on neutral ground: ' + pct(odds.neutral) + ' to win it' + (SOCCER ? ', penalties included.' : '.')
                : 'Your ' + record(ours.wins) + ' team ' + (ours.wins >= t.wFull ? 'has home field: the game is at your place.' : 'is on the road: the game is at their place.') + (SOCCER ? ' Level after 90 minutes: penalties.' : '')
              : 'Your ' + record(ours.wins) + ' team ' + (ours.wins >= t.wFull ? 'has home court: games 1, 2, 5 and 7 are at home.' : 'starts on the road: games 3, 4 and 6 are at home.')}
          </p>

          {games.length > 0 && ONE_GAME && series.scores && (
            <div className="scout-result">
              <span className={'status ' + (series.won ? 'teal' : 'red')}>
                {(series.won ? 'You won ' : 'You lost ') + series.scores[0][0] + '–' + series.scores[0][1] + (series.pens ? ', ' + series.pens[0] + '–' + series.pens[1] + ' on penalties' : '')}
              </span>
            </div>
          )}
          {games.length > 0 && !ONE_GAME && (
            <div className="scout-result">
              <span className={'status ' + (finished ? (series.won ? 'teal' : 'red') : 'gold')}>
                {finished ? (series.won ? 'You won ' : 'You lost ') + w + '–' + l : 'Series ' + w + '–' + l}
              </span>
              <div className="games">
                {[0, 1, 2, 3, 4, 5, 6].map((j) => (
                  <span key={j} className={j < games.length ? (games[j] === 1 ? 'w' : 'l') : finished && j >= 4 ? 'na' : ''}>
                    {j < games.length ? (games[j] === 1 ? 'W' : 'L') : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button className="btn primary" onClick={() => close()}>
            DONE
          </button>
        </>
      )}
    </Sheet>
  );
}
