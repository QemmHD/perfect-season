// Codex: short manual scenarios played by the real NBA/NFL engines with the owner's existing squad.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Back, Trophy } from '../ui/icons';
import { IconCheck, IconPlay } from './icons';
import { Hoops2 } from '../game/hoops2/Hoops2';
import { Football2 } from '../game/football2/Football2';
import { kitsFor } from '../game/uniforms';
import type { Kit as BasketKit } from '../game/hoops2/render';
import type { FbKit } from '../game/football2/render';
import type { Attempt } from '../evolution/training';
import { teamsOf, type SquadCards } from './teams';
import { momentsFor, momentScore, type Moment } from './moments';
import { hqOf, rewardLabel } from './progression';
import type { Pool } from './pool';
import type { UtState } from './state';
import { HQArrow } from './Clubhouse';
function MomentArena({
  m,
  pool,
  ut,
  onExit,
  onFinish
}: {
  m: Moment;
  pool: Pool;
  ut: UtState;
  onExit: () => void;
  onFinish: (attempts: Attempt[]) => void;
}) {
  const [attempts, setAttempts] = useState<Attempt[]>([]),
    held = useRef<Attempt[]>([]),
    [teams] = useState(() => {
      const sq: SquadCards = {};
      for (const [slot, uid] of Object.entries(ut.squad)) {
        const oc = ut.owned.find((c) => c.uid === uid),
          line = oc && pool.byId.get(oc.cardId);
        if (oc && line) sq[slot] = { line, level: oc.level };
      }
      return teamsOf(pool.sport, sq, sq, 'moment:' + m.id);
    }),
    [seed] = useState(() => m.id + ':' + Date.now()),
    [kit] = useState(() => kitsFor(null, null, pool.sport));
  useEffect(() => {
    document.body.classList.add('ut-moment-playing');
    return () => document.body.classList.remove('ut-moment-playing');
  }, []);
  const attempt = (a: Attempt) => {
    if (held.current.length >= m.attempts) return;
    const next = [...held.current, a];
    held.current = next;
    setAttempts(next);
    if (next.length === m.attempts) onFinish(next);
  };
  const common = {
    seed,
    rivalName: 'MOMENT',
    rival: null,
    defIQ: m.difficulty,
    practice: { drill: m.drill, onAttempt: attempt },
    onProgress: () => {},
    onDone: () => {}
  };
  return (
    <>
      {pool.sport === 'nba' ? (
        <Hoops2
          {...common}
          five={teams.five!}
          rivalFive={teams.rivalFive!}
          possessions={12}
          ourKit={kit.mine as BasketKit}
          theirKit={kit.theirs as BasketKit}
          court={kit.court}
        />
      ) : (
        <Football2
          {...common}
          offense={teams.offense!}
          rivalDefense={teams.rivalDefense!}
          drives={12}
          ourKit={kit.mine as FbKit}
          theirKit={kit.theirs as FbKit}
          field={kit.field}
        />
      )}{' '}
      {createPortal(
        <div className="hq-moment-overlay">
          <button onClick={onExit} aria-label="Leave Moment">
            <Back size={16} />
          </button>
          <span>
            <b>{m.title.toUpperCase()}</b>
            <strong className="num">
              {momentScore(m, attempts)} / {m.target}{' '}
              {m.measure === 'yards'
                ? 'YARDS'
                : m.measure === 'green'
                  ? 'GREEN'
                  : 'MAKES'}
            </strong>
            <small>
              {attempts.length} / {m.attempts} ATTEMPTS
              {attempts[attempts.length - 1]
                ? ' · ' + attempts[attempts.length - 1]!.detail
                : ''}
            </small>
          </span>
        </div>,
        document.body
      )}
    </>
  );
}
export function Moments({
  pool,
  ut,
  ready,
  onSquad,
  onFinish,
  onClaim
}: {
  pool: Pool;
  ut: UtState;
  ready: boolean;
  onSquad: () => void;
  onFinish: (m: Moment, attempts: Attempt[]) => void;
  onClaim: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Moment | null>(null),
    [playing, setPlaying] = useState(false),
    [results, setResults] = useState<Attempt[] | null>(null),
    list = momentsFor(pool.sport),
    h = hqOf(ut),
    cleared = list.filter((m) => h.moments[m.id]?.completedAt).length;
  if (playing && selected)
    return (
      <MomentArena
        m={selected}
        pool={pool}
        ut={ut}
        onExit={() => setPlaying(false)}
        onFinish={(a) => {
          onFinish(selected, a);
          setResults(a);
          setPlaying(false);
        }}
      />
    );
  if (selected) {
    const p = h.moments[selected.id],
      score = results ? momentScore(selected, results) : null,
      won = score !== null && score >= selected.target,
      claimable = !!p?.completedAt && !p.claimed;
    return (
      <div className="page hq-page">
        <button
          className="hq-back"
          onClick={() => {
            setSelected(null);
            setResults(null);
          }}
        >
          <Back size={16} /> ALL MOMENTS
        </button>
        <div className={'hq-moment-brief' + (won ? ' complete' : '')}>
          <span className="hq-moment-emblem">
            <Trophy size={56} />
          </span>
          <span className="eyebrow">{selected.kicker}</span>
          <h1 className="disp">{selected.title}</h1>
          <p>{selected.story}</p>
          <div className="hq-moment-goal">
            <b className="disp num">
              {score === null ? selected.target : score}
            </b>
            <span>
              {score === null
                ? 'YOUR TARGET'
                : won
                  ? 'MOMENT COMPLETE'
                  : 'KEEP BUILDING'}
              <small>
                {selected.attempts} attempts ·{' '}
                {selected.difficulty === 1
                  ? 'Legend'
                  : selected.difficulty < 0
                    ? 'Rookie'
                    : 'Pro'}{' '}
                defense
              </small>
            </span>
          </div>
          <div className="hq-moment-reward">
            <span className="eyebrow">FIRST-CLEAR REWARD</span>
            <b>{rewardLabel(selected.reward)}</b>
          </div>
          {claimable ? (
            <button
              className="btn primary hq-wide"
              onClick={() => onClaim(selected.id)}
            >
              CLAIM REWARD <HQArrow />
            </button>
          ) : (
            <button
              className="btn primary hq-wide"
              onClick={() => {
                if (!ready) return onSquad();
                setResults(null);
                setPlaying(true);
              }}
            >
              {!ready
                ? 'BUILD YOUR SQUAD'
                : results
                  ? 'PLAY AGAIN'
                  : 'PLAY MOMENT'}{' '}
              <IconPlay size={17} />
            </button>
          )}
          {p?.claimed && (
            <p className="hq-earned">
              <IconCheck /> FIRST-CLEAR REWARD CLAIMED
            </p>
          )}
          <p className="note">
            Played manually with your owned squad. Replays can improve your best
            without awarding the same reward again.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="page hq-page">
      <div className="hq-page-heading">
        <span className="eyebrow">SMALL STAGE. BIG STATEMENT.</span>
        <h1 className="disp">MOMENTS</h1>
        <p>
          Put your own squad into short skill challenges. Earn every first-clear
          reward once.
        </p>
      </div>
      <div className="hq-moment-count">
        <b className="disp num">
          {cleared} / {list.length}
        </b>
        <span>MOMENTS CONQUERED</span>
      </div>
      <div className="hq-moment-list">
        {list.map((m, i) => {
          const p = h.moments[m.id];
          return (
            <button
              className={'hq-moment-tile' + (p?.completedAt ? ' complete' : '')}
              key={m.id}
              onClick={() => {
                setSelected(m);
                setResults(null);
              }}
            >
              <span className="hq-moment-index disp num">
                {p?.completedAt ? (
                  <IconCheck />
                ) : (
                  String(i + 1).padStart(2, '0')
                )}
              </span>
              <span>
                <i className="eyebrow">{m.kicker}</i>
                <b className="disp">{m.title}</b>
                <small>
                  {m.attempts} attempts · {rewardLabel(m.reward)}
                </small>
                {p?.completedAt && (
                  <em>{p.claimed ? 'REWARD CLAIMED' : 'REWARD READY'}</em>
                )}
              </span>
              <HQArrow />
            </button>
          );
        })}
      </div>
      <p className="note">
        Your club keeps all owned cards and XP. Attempts cost no coins. Leaving
        before the final attempt ends that try; completed Moment progress stays
        in your club.
      </p>
    </div>
  );
}
