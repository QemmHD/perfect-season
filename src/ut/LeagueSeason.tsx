// Codex (OpenAI): a full-season competition in the existing clubhouse materials.
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Trophy } from '../ui/icons';
import { HQArrow } from './Clubhouse';
import { LEVELS, LEVEL_NAME, type Level } from './battles';
import {
  leagueBoost,
  leagueOpponent,
  leagueOverall,
  leagueRequest,
  leagueSchedule,
  leagueStandings,
  leagueSummary,
  nextLeagueGame,
  seasonGames,
  type LeagueRequest
} from './league';
import { withLeagueForm } from './league-form';
import { rateCard } from './rate';
import type { Pool } from './pool';
import { slotsFor } from './squad';
import type { UtState } from './state';
import './league.css';
export function LeagueSeasonView({
  ut,
  pool,
  ready,
  clubOvr,
  onStart,
  onPlay,
  onSquad
}: {
  ut: UtState;
  pool: Pool;
  ready: boolean;
  clubOvr: number;
  onStart: (level: Level) => void;
  onPlay: (req: LeagueRequest) => void;
  onSquad: () => void;
}) {
  const [level, setLevel] = useState<Level>('pro'),
    [creating, setCreating] = useState(false),
    [tab, setTab] = useState('Season'),
    [selected, setSelected] = useState(1),
    [shown, setShown] = useState(10);
  const pageRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const body = pageRef.current?.closest('.ut-body');
    if (body) body.scrollTop = 0;
  }, [ut.league?.active.id, tab, creating]);
  const s = ut.league?.active,
    standing = useMemo(() => (s ? leagueStandings(s) : []), [s]),
    total = seasonGames(pool.sport);
  if (!s || creating)
    return (
      <div ref={pageRef} className="page hq-page league-page">
        <div className="hq-page-heading">
          <span className="eyebrow">YOUR SQUAD. A WHOLE LEAGUE.</span>
          <h1 className="disp">
            MAKE THIS
            <br />
            YOUR SEASON.
          </h1>
          <p>
            Take your Ultimate Team through a full schedule. Build a record.
            Chase the championship.
          </p>
        </div>
        <div className="league-intro hq-panel">
          <Trophy size={38} />
          <b className="disp">
            {total} GAMES.
            <br />
            ONE DYNASTY.
          </b>
          <div className="league-intro-nums">
            <span>
              <b className="num">{pool.sport === 'nba' ? 30 : 32}</b> CLUBS
            </span>
            <span>
              <b className="num">8</b> PLAYOFF SPOTS
            </span>
          </div>
          <p>
            AI clubs play each other after every game you finish. Follow their
            records, roster form and league leaders all season.
          </p>
        </div>
        <div>
          <span className="eyebrow">CHOOSE YOUR STARTING DIFFICULTY</span>
          <div
            className="utb-levels"
            role="radiogroup"
            aria-label="Season difficulty"
          >
            {LEVELS.map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={l === level}
                className={'utb-level' + (l === level ? ' on' : '')}
                onClick={() => setLevel(l)}
              >
                {LEVEL_NAME[l]}
              </button>
            ))}
          </div>
        </div>
        <div className="hq-panel">
          <h2 className="disp">A LEAGUE THAT EVOLVES.</h2>
          <p>
            Hot teams and breakout players improve. Struggling teams cool off.
            The challenge follows your results gradually between games; your own
            cards keep their ratings.
          </p>
          <p>
            Top eight qualify.{' '}
            {pool.sport === 'nba'
              ? 'Three rounds of best-of-seven series.'
              : 'Three single-elimination playoff rounds.'}{' '}
            Matches use the game’s existing arcade length. Difficulty is set for
            this season.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            if (!ready) {
              onSquad();
              return;
            }
            setCreating(false);
            setTab('Season');
            onStart(level);
          }}
        >
          {ready
            ? s
              ? 'START NEXT SEASON'
              : 'START SEASON'
            : 'COMPLETE YOUR SQUAD'}{' '}
          <HQArrow />
        </button>
        {s && (
          <button className="btn" onClick={() => setCreating(false)}>
            BACK TO SEASON RESULTS
          </button>
        )}
      </div>
    );
  const team = s.teams[0],
    rank = standing.findIndex((t) => t.id === 0) + 1,
    fixture = nextLeagueGame(s),
    request = leagueRequest(s),
    opponent = request ? leagueOpponent(pool, ut, request) : null,
    done = s.phase === 'complete';
  const results = s.results.filter((g) => g.h === 0 || g.a === 0),
    lastRound = s.results.length
      ? s.results.filter(
          (g) =>
            g.phase === s.results[s.results.length - 1].phase &&
            g.round === s.results[s.results.length - 1].round
        )
      : [];
  const schedule = leagueSchedule(s.sport).map((games, i) => {
    const [h, a] = games.find(([h, a]) => h === 0 || a === 0)!;
    return { h, a, round: i, key: s.id + ':r:' + i + ':' + h + ':' + a };
  });
  const roster = s.teams[selected] ?? s.teams[1],
    summary = leagueSummary(s),
    leaders = s.teams
      .slice(1)
      .flatMap((t) =>
        t.players
          .filter((p) =>
            s.sport === 'nba'
              ? !p.slot.startsWith('B')
              : /^(QB|RB|WR|TE)/.test(p.slot)
          )
          .map((p) => ({
            p,
            t,
            value:
              (s.sport === 'nba' ? p.stats.points : p.stats.yards) /
              Math.max(1, p.stats.games)
          }))
      )
      .filter((x) => x.p.stats.games > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  return (
    <div ref={pageRef} className="page hq-page league-page">
      <div className="league-scorecard">
        <span className="eyebrow">
          CLUB SEASON {String(s.number).padStart(2, '0')} ·{' '}
          {LEVEL_NAME[s.level]}
        </span>
        <div className="league-record">
          <b className="disp num">
            {team.w}
            <i>–</i>
            {team.l}
          </b>
          <span>
            <b className="num">#{rank}</b> OF {s.teams.length}
            <small>
              {done
                ? 'FINAL STANDING'
                : s.phase === 'playoffs'
                  ? 'PLAYOFFS'
                  : 'REGULAR SEASON'}
            </small>
          </span>
        </div>
        <div
          className="hq-progress"
          role="progressbar"
          aria-label="Regular season progress"
          aria-valuenow={s.round}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <i style={{ width: (s.round / total) * 100 + '%' }} />
        </div>
        <small>
          {s.round} / {total} games ·{' '}
          {rank <= 8 ? 'In the playoff places' : 'Chasing the top eight'}
        </small>
      </div>
      <div
        className="hq-filter league-tabs"
        role="group"
        aria-label="Season sections"
      >
        {['Season', 'Standings', 'Schedule', 'Stats'].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Season' && (
        <>
          {done ? (
            <div className="hq-panel league-finale">
              <Trophy size={44} />
              <span className="eyebrow">
                {s.champion === 0
                  ? 'THE TITLE IS YOURS.'
                  : 'A SEASON IN THE BOOKS.'}
              </span>
              <h2 className="disp">
                {s.champion === 0
                  ? 'CHAMPIONS.'
                  : s.teams[s.champion ?? 0].name}
              </h2>
              <p>
                {s.champion === 0
                  ? 'Your club won the championship.'
                  : 'League champions · ' + s.teams[s.champion ?? 0].abbr}{' '}
                Your {team.w}–{team.l} season and final standing are saved.
              </p>
              <button className="btn primary" onClick={() => setCreating(true)}>
                NEXT SEASON <HQArrow />
              </button>
            </div>
          ) : (
            <div className="hq-panel league-next">
              <span className="eyebrow">
                {s.phase === 'playoffs'
                  ? 'PLAYOFF ROUND ' + (s.playoffRound + 1)
                  : 'GAME ' + (s.round + 1) + ' OF ' + total}{' '}
                · {fixture?.h === 0 ? 'HOME' : 'AWAY'}
              </span>
              <h2 className="disp">
                {opponent?.team.name ?? 'Opponent unavailable'}
              </h2>
              {opponent && (
                <>
                  <div className="league-matchup">
                    <span>
                      <b className="disp num">{Math.round(clubOvr)}</b>
                      <small>YOUR OVR</small>
                    </span>
                    <i className="disp">VS</i>
                    <span>
                      <b className="disp num">{opponent.rating.ovr}</b>
                      <small>AI OVR</small>
                    </span>
                  </div>
                  <div className="league-opponent-meta">
                    <span>
                      {opponent.team.w}–{opponent.team.l} RECORD
                    </span>
                    <span
                      className={
                        opponent.team.form >= 0 ? 'league-hot' : 'league-cold'
                      }
                    >
                      {opponent.team.form >= 0.5
                        ? 'HOT FORM'
                        : opponent.team.form <= -0.5
                          ? 'COLD FORM'
                          : 'STEADY FORM'}
                    </span>
                  </div>
                  {s.phase === 'playoffs' && (
                    <p>
                      {s.bracket
                        .filter((b) => b.h === 0 || b.a === 0)
                        .map(
                          (b) =>
                            'Series ' +
                            (b.h === 0 ? b.hw : b.aw) +
                            '–' +
                            (b.h === 0 ? b.aw : b.hw)
                        )
                        .join('')}{' '}
                      ·{' '}
                      {s.sport === 'nba'
                        ? 'First to four wins'
                        : 'Win or go home'}
                    </p>
                  )}
                </>
              )}
              <button
                className="btn primary"
                disabled={!request || !opponent}
                onClick={() => (ready ? request && onPlay(request) : onSquad())}
              >
                {ready
                  ? 'PLAY ' +
                    (s.phase === 'playoffs'
                      ? 'PLAYOFF GAME'
                      : 'GAME ' + (s.round + 1))
                  : 'COMPLETE YOUR SQUAD'}{' '}
                <HQArrow />
              </button>
              <button className="hq-text-button" onClick={onSquad}>
                MANAGE SQUAD <HQArrow />
              </button>
            </div>
          )}
          <div className="league-summary">
            <span>
              <b className="num">
                {team.w + team.l
                  ? (team.pf / (team.w + team.l)).toFixed(1)
                  : '—'}
              </b>{' '}
              POINTS FOR / GAME
            </span>
            <span>
              <b className="num">
                {team.w + team.l
                  ? (team.pa / (team.w + team.l)).toFixed(1)
                  : '—'}
              </b>{' '}
              POINTS AGAINST / GAME
            </span>
          </div>
          <details className="hq-panel league-explainer">
            <summary>How the league adapts</summary>
            <p>
              Results and scoring margins move the league’s challenge gradually.
              AI player form and team overalls develop through their own
              simulated results. Ratings lock before tip-off or kickoff; they
              never change during a game. Your own card stats stay intact.
            </p>
            <p>
              Regular-season ties in the table use point differential, then
              points scored. Tied match scores use the existing match tiebreak.
              The top eight qualify for this season’s championship bracket.
            </p>
          </details>
          {lastRound.length > 0 ? (
            <details className="hq-panel league-around" open>
              <summary>AROUND THE LEAGUE · LATEST RESULTS</summary>
              {lastRound.map((g) => (
                <div
                  className={
                    'league-result' + (g.h === 0 || g.a === 0 ? ' yours' : '')
                  }
                  key={g.key}
                >
                  <span>{g.h === 0 ? 'YOU' : s.teams[g.h].abbr}</span>
                  <b className="num">
                    {g.hs} – {g.as}
                  </b>
                  <span>{g.a === 0 ? 'YOU' : s.teams[g.a].abbr}</span>
                </div>
              ))}
            </details>
          ) : (
            <div className="hq-panel">
              <p>
                The league tips off with your first game. Every club’s results
                and stats will appear here as the season unfolds.
              </p>
            </div>
          )}
          {results.length > 0 && (
            <div className="league-form">
              <span className="eyebrow">YOUR LAST FIVE</span>
              {results.slice(-5).map((g) => (
                <i className={g.winner === 0 ? 'win' : 'loss'} key={g.key}>
                  {g.winner === 0 ? 'W' : 'L'}
                </i>
              ))}
            </div>
          )}
          {!!ut.league?.history.length && (
            <div className="hq-panel">
              <h2 className="disp">YOUR SEASON HISTORY</h2>
              {ut.league.history
                .slice()
                .reverse()
                .map((h) => (
                  <div className="league-history" key={h.id}>
                    <b>SEASON {h.number}</b>
                    <span>
                      {h.w}–{h.l} · #{h.rank}
                    </span>
                    <small>
                      {h.title ? 'CHAMPIONS' : h.champion + ' won the title'}
                    </small>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
      {tab === 'Standings' && (
        <>
          <div className="league-table-wrap">
            <table className="league-table">
              <caption>REGULAR SEASON · TOP EIGHT QUALIFY</caption>
              <thead>
                <tr>
                  <th scope="col"># / CLUB</th>
                  <th scope="col">W</th>
                  <th scope="col">L</th>
                  <th scope="col">DIFF</th>
                  <th scope="col">OVR</th>
                </tr>
              </thead>
              <tbody>
                {standing.map((t, i) => (
                  <tr
                    key={t.id}
                    className={
                      (t.id === 0 ? 'yours ' : '') +
                      (i === 7 ? 'league-cut' : '')
                    }
                  >
                    <th scope="row">
                      <button
                        onClick={() => {
                          if (t.id) {
                            setSelected(t.id);
                            setTab('Stats');
                          }
                        }}
                        disabled={t.id === 0}
                      >
                        <i className="num">{i + 1}</i>{' '}
                        {t.id === 0 ? 'YOUR CLUB' : t.abbr}
                      </button>
                    </th>
                    <td>{t.w}</td>
                    <td>{t.l}</td>
                    <td>
                      {t.pf - t.pa > 0 ? '+' : ''}
                      {t.pf - t.pa}
                    </td>
                    <td>
                      {t.id === 0
                        ? Math.round(clubOvr)
                        : leagueOverall(s, t, pool)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hq-footnote">
            Tap an AI club to see its roster and player stats. Line marks the
            eight-team playoff cut.
          </p>
        </>
      )}
      {tab === 'Schedule' && (
        <>
          <h2 className="disp">THE ROAD AHEAD.</h2>
          {schedule.slice(0, shown).map((f) => {
            const g = s.results.find((g) => g.key === f.key),
              opp = s.teams[f.h === 0 ? f.a : f.h];
            return (
              <div
                className={
                  'league-schedule-row' +
                  (f.round === s.round && !done ? ' next' : '')
                }
                key={f.key}
              >
                <span className="num">{f.round + 1}</span>
                <span>
                  <b>
                    {f.h === 0 ? 'vs' : 'at'} {opp.name}
                  </b>
                  <small>{f.h === 0 ? 'HOME' : 'AWAY'}</small>
                </span>
                <b
                  className={
                    g ? (g.winner === 0 ? 'league-hot' : 'league-cold') : 'num'
                  }
                >
                  {g
                    ? (g.winner === 0 ? 'W ' : 'L ') +
                      (f.h === 0 ? g.hs : g.as) +
                      '–' +
                      (f.h === 0 ? g.as : g.hs)
                    : '—'}
                </b>
              </div>
            );
          })}
          {shown < total && (
            <button
              className="btn"
              onClick={() => setShown((n) => Math.min(total, n + 20))}
            >
              SHOW MORE GAMES ({total - shown})
            </button>
          )}
          {s.seeds.length > 0 && (
            <div className="hq-panel">
              <h3 className="disp">PLAYOFF BRACKET</h3>
              {s.bracket.map((b) => (
                <div className="league-result" key={b.h + ':' + b.a}>
                  <span>{s.teams[b.h].abbr}</span>
                  <b className="num">
                    {b.hw} – {b.aw}
                  </b>
                  <span>{s.teams[b.a].abbr}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {tab === 'Stats' && (
        <>
          <div className="hq-panel">
            <h2 className="disp">AI LEAGUE LEADERS</h2>
            <p>
              {s.sport === 'nba'
                ? 'Points per game'
                : 'Yards per game · passing, rushing or receiving'}{' '}
              · regular-season AI box scores.
            </p>
            {leaders.length ? (
              leaders.map(({ p, t, value }, i) => (
                <div className="league-player" key={t.id + ':' + p.slot}>
                  <i className="num">{i + 1}</i>
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {t.abbr} · {p.slot} · {p.stats.games} GP
                    </small>
                  </span>
                  <b className="num">{value.toFixed(1)}</b>
                </div>
              ))
            ) : (
              <p>Play your opening game to start the league’s stat race.</p>
            )}
          </div>
          <label className="league-select">
            <span className="eyebrow">SCOUT A CLUB</span>
            <select
              value={roster.id}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {s.teams.slice(1).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="hq-panel">
            <h2 className="disp">{roster.name}</h2>
            <p>
              {roster.w}–{roster.l} · {roster.pf} PF / {roster.pa} PA ·{' '}
              {leagueOverall(s, roster, pool)} OVR
            </p>
            {roster.players.map((p) => {
              const rc = withLeagueForm(
                rateCard(
                  pool.byId.get(p.cardId)!,
                  1,
                  slotsFor(s.sport).find((slot) => slot.id === p.slot)?.pos ??
                    undefined
                ),
                leagueBoost(s, roster, p)
              );
              return (
                <div className="league-player" key={p.slot}>
                  <span className="league-pos">{p.slot}</span>
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {s.sport === 'nba'
                        ? `${p.stats.points} PTS · ${p.stats.rebounds} REB · ${p.stats.assists} AST`
                        : /^(QB|RB|WR|TE)/.test(p.slot)
                          ? `${p.stats.yards} ${p.slot === 'QB' ? 'PASS' : p.slot === 'RB' ? 'RUSH' : 'REC'} YDS · ${p.stats.touchdowns} TD`
                          : p.slot === 'K'
                            ? `${p.stats.points} KICKING PTS`
                            : /^(LT|LG|C|RG|RT)$/.test(p.slot)
                              ? 'OFFENSIVE LINE'
                              : `${p.stats.tackles} TKL · ${p.stats.sacks} SACKS`}{' '}
                      · {p.stats.games} GP
                    </small>
                  </span>
                  <span className="league-player-ovr">
                    <b className="num">{rc.ovr}</b>
                    <small
                      className={
                        rc.ovr >= p.base ? 'league-hot' : 'league-cold'
                      }
                    >
                      {rc.ovr > p.base ? '+' : ''}
                      {rc.ovr - p.base}
                    </small>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="hq-footnote">
        Your played matches earn the usual coins, card XP and Season Points
        within existing daily limits. AI-only games pay no rewards.{' '}
        {done
          ? 'Final place #' + summary.rank + '.'
          : 'Your season saves automatically.'}
      </p>
    </div>
  );
}
