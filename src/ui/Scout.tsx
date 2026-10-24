import React from 'react';
import { matchupOdds, ROUND_NAMES, type Series, seriesScore, seriesWinChance } from '../engine/playoffs';
import { type PlayoffTeam, SLOTS } from '../engine/types';
import { Sheet, lastName } from './common';

const pct = (x: number) => Math.round(x * 100) + '%';

/** A team's color bar: both colors, so a black primary (Spurs, Nets) still shows on the dark UI. */
export const teamBar = (t: PlayoffTeam) => 'linear-gradient(180deg,' + t.c1 + ' 0 55%,' + t.c2 + ' 55% 100%)';

/** The five names of a playoff opponent, guards first, for one-line summaries. */
export function oppNames(s: Series): string {
  return sortedFive(s)
    .map((p) => lastName(p.name))
    .join(' · ');
}

function sortedFive(s: Series) {
  const order = (pos: string) => (SLOTS.indexOf(pos as never) + 6) % 6;
  return s.opp.five.slice().sort((a, b) => order(a.pos) - order(b.pos));
}

/**
 * Scouting report on one playoff opponent: who they are, their five players by minutes,
 * and your odds. After the series it also shows how it went.
 */
export function Scout({ series, gamesShown, ours, onClose }: { series: Series; gamesShown: number; ours: { rating: number; wins: number }; onClose: () => void }) {
  const t = series.opp;
  const odds = matchupOdds(ours.rating, t);
  const chance = seriesWinChance(ours.rating, ours.wins, t);
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
                {series.round === 3 ? ' · Finals boss' : ''}
              </span>
              <h2 className="disp">
                {t.year} {t.team}
              </h2>
              <small className="num">
                {t.w}–{t.l} in the regular season{t.w + t.l !== 82 ? ' · ' + t.w82 + '–' + (82 - t.w82) + ' over 82 games' : ''}
              </small>
            </div>
          </div>

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
                <i className="num">{p.pts.toFixed(1)}</i>
                <i className="num">{p.reb.toFixed(1)}</i>
                <i className="num">{p.ast.toFixed(1)}</i>
                <i className="num">{p.stl.toFixed(1)}</i>
                <i className="num">{p.blk.toFixed(1)}</i>
              </div>
            ))}
            {est && <p className="note">Steals and blocks before 1973–74 weren’t recorded; these are estimates.</p>}
          </div>

          <div className="scout-odds">
            <div>
              <b className="disp num">{pct(odds.home)}</b>
              <span>Each home game</span>
            </div>
            <div>
              <b className="disp num">{pct(odds.road)}</b>
              <span>Each road game</span>
            </div>
            <div className={chance >= 0.5 ? 'fav' : 'dog'}>
              <b className="disp num">{pct(chance)}</b>
              <span>To win the series</span>
            </div>
          </div>
          <p className="note">
            Your {ours.wins}–{82 - ours.wins} team {ours.wins >= t.w82 ? 'has home court: games 1, 2, 5 and 7 are at home.' : 'starts on the road: games 3, 4 and 6 are at home.'}
          </p>

          {games.length > 0 && (
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
