import { ArrowMark } from '../evolution/Marks';
import React, { useEffect, useState } from 'react';
import { DIVISIONS, divisionOf, rivalsOf } from './rivals';
import { weekKey } from '../net/leaderboard';
import { easternDateKey } from '../engine/season';
import { SPORT } from '../engine/sport';
import { type Profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { Confetti } from '../ui/common';
import { fetchRivals, publishRivals, type RivalsEntry } from './rivals-net';

export function DivisionBadge({
  division,
  large = false,
}: {
  division: number;
  large?: boolean;
}) {
  return (
    <span
      className={'division-badge' + (large ? ' large' : '')}
      style={{ '--division': DIVISIONS[division].color } as React.CSSProperties}
    >
      <svg viewBox="0 0 120 140" aria-hidden="true">
        <path d="M60 4 112 25 105 91 60 135 15 91 8 25Z" />
        <path d="M60 15 101 32 95 85 60 121 25 85 19 32Z" />
        <path d="m60 35 8 18 20 2-15 14 4 21-17-11-17 11 4-21-15-14 20-2Z" />
        {Array.from({ length: division + 1 }, (_, i) => (
          <path key={i} d={`m${40 + i * 10} 103 4 4-4 4-4-4Z`} />
        ))}
      </svg>
      <b>{['V', 'IV', 'III', 'II', 'I'][division]}</b>
    </span>
  );
}
export function RivalsTeaser({
  profile,
  onOpen,
}: {
  profile: Profile;
  onOpen: () => void;
}) {
  const r = rivalsOf(profile.ut.rivals, weekKey(easternDateKey())),
    d = divisionOf(r.points);
  return (
    <button className="rivals-entry" onClick={onOpen}>
      <DivisionBadge division={d} />
      <span>
        <small className="eyebrow">ULTIMATE TEAM RIVALS</small>
        <b className="disp">{DIVISIONS[d].name.toUpperCase()} DIVISION</b>
        <em>
          {r.points} RP · {r.w}W {r.l}L{' '}
          {r.rewards.some((x) => !r.claimed.includes(x.id))
            ? '· REWARD READY'
            : ''}
        </em>
      </span>
      <i>›</i>
    </button>
  );
}
export function Rivals({
  profile,
  update,
  onPlay,
  onToast,
}: {
  profile: Profile;
  update: (fn: (p: Profile) => Profile) => void;
  onPlay: () => void;
  onToast: (s: string) => void;
}) {
  const week = weekKey(easternDateKey()),
    r = rivalsOf(profile.ut.rivals, week),
    division = divisionOf(r.points),
    d = DIVISIONS[division],
    next = DIVISIONS[division + 1];
  const [celebrate, setCelebrate] = useState(false),
    [board, setBoard] = useState<RivalsEntry[]>([]),
    [status, setStatus] = useState('Connecting to the Rivals board…'),
    [pending, setPending] = useState(false);
  const load = () => {
    setStatus('Updating board…');
    fetchRivals(week)
      .then((rows) => {
        setBoard(rows);
        setStatus(
          rows.length
            ? 'Live this week'
            : 'No entries received yet. Be the first on the board.'
        );
      })
      .catch(() =>
        setStatus('Board unavailable. Your progress is saved on this phone.')
      );
  };
  useEffect(() => {
    let live = true;
    publishRivals(profile, week).then((sent) => {
      if (live) {
        setPending(!sent && r.w + r.l > 0);
        load();
      }
    });
    return () => {
      live = false;
    };
  }, [week]);
  const claim = (id: string) => {
    const available =
      r.rewards.some((x) => x.id === id) && !r.claimed.includes(id);
    if (!available) return;
    update((p) => {
      const now = rivalsOf(p.ut.rivals, week),
        reward = now.rewards.find((x) => x.id === id);
      if (!reward || now.claimed.includes(id)) return p;
      return {
        ...p,
        coins: p.coins + reward.coins,
        ut: {
          ...p.ut,
          rivals: { ...now, claimed: [...now.claimed, id] },
          packs: [
            ...p.ut.packs,
            {
              id: 'rivals:' + SPORT + ':' + id,
              kind: reward.pack,
              at: Date.now(),
            },
          ],
        },
      };
    });
    if (available) {
      setCelebrate(true);
      sfx.title();
      setTimeout(() => setCelebrate(false), 3000);
      onToast('Reward claimed. Your pack is waiting in the Store.');
    }
  };
  return (
    <div
      className="page rivals-page"
      style={{ '--division': d.color } as React.CSSProperties}
    >
      <div className="rivals-hero">
        <span className="eyebrow">
          SEASON {week.split('W')[1]} · {SPORT.toUpperCase()}
        </span>
        <DivisionBadge division={division} large />
        <h1 className="disp">{d.name.toUpperCase()}</h1>
        <p>{d.title}</p>
        <div className="rivals-rp">
          <b className="disp">{r.points}</b>
          <span>
            RIVALS POINTS
            <br />
            {r.w} WINS · {r.l} LOSSES
          </span>
        </div>
        <div className="rivals-meter">
          <i
            style={{
              width: next
                ? Math.min(100, (100 * (r.points - d.at)) / (next.at - d.at)) +
                  '%'
                : '100%',
            }}
          />
        </div>
        <small>
          {next
            ? next.at - r.points + ' RP TO ' + next.name.toUpperCase()
            : 'THE TOP DIVISION. KEEP YOUR CROWN.'}
        </small>
      </div>
      <button className="big gold" onClick={onPlay}>
        TAKE THE SPOTLIGHT <ArrowMark />
      </button>
      <p className="rivals-rules">
        +30 RP for a win · −12 for a loss · Real opponents only.
        <br />
        Weekly reset. Earned rewards stay yours until claimed.
      </p>
      <div className="evo-section-label">
        <span>THE CLIMB</span>
        <b>{r.best} RP SEASON BEST</b>
      </div>
      <div className="rivals-ladder">
        {DIVISIONS.map((v, i) => {
          const reward = r.rewards.find(
              (x) => x.week === week && x.division === i
            ),
            claimed = reward && r.claimed.includes(reward.id);
          return (
            <div
              className={'rivals-rung' + (i === division ? ' current' : '')}
              key={v.name}
            >
              <DivisionBadge division={i} />
              <span>
                <b className="disp">{v.name}</b>
                <small>
                  {v.at} RP · {v.wins} wins ·{' '}
                  {v.pack === 'premium'
                    ? 'Premium Gold'
                    : v.pack[0].toUpperCase() + v.pack.slice(1)}{' '}
                  pack + {v.coins} coins
                </small>
              </span>
              {reward && !claimed ? (
                <button onClick={() => claim(reward.id)}>CLAIM</button>
              ) : (
                <i>{claimed ? '✓' : i === division ? 'YOU' : '◇'}</i>
              )}
            </div>
          );
        })}
      </div>
      {r.rewards
        .filter((x) => x.week !== week && !r.claimed.includes(x.id))
        .map((x) => (
          <button className="btn gold" key={x.id} onClick={() => claim(x.id)}>
            CLAIM {x.week} {DIVISIONS[x.division].name.toUpperCase()} REWARD
          </button>
        ))}
      <div className="evo-section-label">
        <span>WEEKLY LEADERBOARD</span>
        <button onClick={load} aria-label="Refresh Rivals leaderboard">
          ↻
        </button>
      </div>
      <p className="note" role="status">
        {pending
          ? 'Your progress is saved on this phone. Board submission pending. '
          : ''}
        {status}
      </p>
      <div className="rivals-board">
        {board.map((e, i) => (
          <div key={e.key}>
            <b>{i + 1}</b>
            <DivisionBadge division={divisionOf(e.points)} />
            <span>
              {e.name}
              <small>
                {e.w}W · {e.l}L
              </small>
            </span>
            <strong>{e.points} RP</strong>
          </div>
        ))}
      </div>
      {celebrate && <Confetti />}
    </div>
  );
}
export function Promotion({
  division,
  onDone,
}: {
  division: number;
  onDone: () => void;
}) {
  useEffect(() => {
    sfx.title();
  }, []);
  return (
    <div
      className="promotion"
      role="dialog"
      aria-modal="true"
      aria-label="Division promotion"
    >
      <span className="eyebrow">YOU EARNED THIS</span>
      <DivisionBadge division={division} large />
      <h1 className="disp">PROMOTED.</h1>
      <p>WELCOME TO {DIVISIONS[division].name.toUpperCase()}</p>
      <button className="big gold" onClick={onDone}>
        LET’S KEEP CLIMBING <ArrowMark />
      </button>
      <Confetti />
    </div>
  );
}
