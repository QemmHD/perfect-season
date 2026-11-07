// Codex (OpenAI): Cups share the existing club materials, mode rows and pack art.
import React, { useState } from 'react';
import { Confirm } from '../ui/common';
import { LEVELS, LEVEL_NAME, type Level } from './battles';
import { IconCheck, IconCrown, IconPlay, IconX } from './icons';
import { PackArt } from './PackArt';
import type { Pool } from './pool';
import type { UtState } from './state';
import { Lede, SectionHead } from './ui';
import { CUP_KINDS } from './cup-state';
import {
  CUP_NAMES,
  CUP_PRIZES,
  CUP_ROUNDS,
  cupClaimId,
  cupEligibility,
  cupOf,
  cupOpponent,
  cupRule,
  type CupKind,
  type CupRequest,
} from './cup';
import './cup.css';
export function CupView({
  ut,
  pool,
  week,
  onStart,
  onPlay,
  onClaim,
  onRetire,
  onSquad,
}: {
  ut: UtState;
  pool: Pool;
  week: string;
  onStart: (kind: CupKind, level: Level) => void;
  onPlay: (req: CupRequest) => void;
  onClaim: () => void;
  onRetire: () => void;
  onSquad: () => void;
}) {
  const [selected, setSelected] = useState<CupKind>('open'),
    [level, setLevel] = useState<Level>('rookie'),
    [retiring, setRetiring] = useState(false);
  const c = cupOf(ut),
    a = c.active,
    kind = a?.kind ?? selected,
    period = a?.week ?? week,
    rule = cupRule(pool.sport, period, kind),
    eligible = cupEligibility(pool, ut, kind, period),
    prize = CUP_PRIZES[kind],
    paid = c.claims.includes(cupClaimId(pool.sport, period, kind));
  const next =
    a && !a.done
      ? cupOpponent(pool, ut, { runId: a.id, round: a.round })
      : null;
  return (
    <div className="page cup-page">
      <Lede>
        Your club in three-match knockout Cups. Build to the rules, win a title,
        then try a different squad.
      </Lede>
      <div className="cup-trophies">
        <IconCrown size={21} />
        <span>
          <b className="disp num">
            {Object.values(c.trophies).reduce((n, x) => n + x, 0)}
          </b>
          <small>WEEKLY TITLES</small>
        </span>
        <small>
          {c.trophies.open} OPEN · {c.trophies.silver} SILVER ·{' '}
          {c.trophies.chemistry} CHEMISTRY
        </small>
      </div>
      {!a && (
        <div className="ut-chips" role="group" aria-label="Cup bracket">
          {CUP_KINDS.map((k) => (
            <button
              className={'chip' + (selected === k ? ' on' : '')}
              key={k}
              aria-pressed={selected === k}
              onClick={() => setSelected(k)}
            >
              {k === 'open' ? 'OPEN' : k === 'silver' ? 'SILVER' : 'CHEMISTRY'}
            </button>
          ))}
        </div>
      )}
      <div className="cup-feature">
        <span className="eyebrow">
          {period === week ? 'THIS WEEK' : 'SAVED CUP · ' + period} · FREE ENTRY
        </span>
        <h2 className="disp">{CUP_NAMES[kind]}</h2>
        <p>{rule.text}</p>
        {!a?.done && (
          <div className={'cup-eligibility' + (eligible.ok ? ' ready' : '')}>
            {eligible.ok ? <IconCheck size={16} /> : <IconX size={16} />}
            <span>{eligible.reason}</span>
          </div>
        )}
        {a && period !== week && (
          <p className="note">
            Your entry keeps its original rules and reward. Finish it whenever
            you are ready.
          </p>
        )}
      </div>
      {a ? (
        <>
          <div className="cup-path" aria-label="Cup knockout rounds">
            {CUP_ROUNDS.map((name, i) => (
              <div
                key={name}
                className={
                  a.results[i]
                    ? a.results[i].won
                      ? 'won'
                      : 'lost'
                    : a.round === i && !a.done
                      ? 'next'
                      : ''
                }
              >
                <b className="num">
                  {a.results[i] ? (a.results[i].won ? 'W' : 'L') : i + 1}
                </b>
                <small>{name}</small>
                {a.results[i] && (
                  <span className="num">
                    {a.results[i].us}–{a.results[i].them}
                  </span>
                )}
              </div>
            ))}
          </div>
          {a.done ? (
            <div className="cup-finish">
              <IconCrown size={30} />
              <h3 className="disp">
                {a.results.every((r) => r.won)
                  ? 'CUP CHAMPIONS'
                  : 'THE NEXT RUN STARTS HERE'}
              </h3>
              <p>
                {a.results.every((r) => r.won)
                  ? paid
                    ? 'You have already earned this bracket’s weekly prize. Your run still joins the record.'
                    : 'A title for your cabinet. Your pack and coins are ready.'
                  : 'Every knockout run teaches you something. Adjust your squad and come back stronger.'}
              </p>
              <button className="btn gold" onClick={() => { setSelected(kind); setLevel(a.level); onClaim(); }}>
                {a.results.every((r) => r.won) && !paid
                  ? 'COLLECT TITLE REWARD'
                  : 'SAVE RESULT & RETURN'}
              </button>
            </div>
          ) : (
            <>
              <div className="cup-opponent">
                <span className="eyebrow">UP NEXT · {LEVEL_NAME[a.level]}</span>
                <b>{next?.rung.title ?? CUP_ROUNDS[a.round]}</b>
                {next && (
                  <small>
                    {next.rung.ovr} OVR · {LEVEL_NAME[a.level]} defense · play
                    the full match
                  </small>
                )}
              </div>
              <button
                className="btn primary"
                onClick={() =>
                  eligible.ok
                    ? onPlay({ runId: a.id, round: a.round })
                    : onSquad()
                }
              >
                <IconPlay size={17} />
                {eligible.ok
                  ? 'PLAY ' + CUP_ROUNDS[a.round].toUpperCase()
                  : 'ADJUST YOUR SQUAD'}
              </button>
              <button className="cup-text" onClick={() => setRetiring(true)}>
                RETIRE THIS ENTRY
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <label className="cup-difficulty">
            <span>Difficulty</span>
            <select
              aria-label="Cup difficulty"
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
            >
              {LEVELS.map((l) => (
                <option value={l} key={l}>
                  {LEVEL_NAME[l]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn primary"
            onClick={() => (eligible.ok ? onStart(selected, level) : onSquad())}
          >
            <IconPlay size={17} />
            {eligible.ok
              ? 'ENTER ' + CUP_NAMES[selected].toUpperCase()
              : 'BUILD AN ELIGIBLE SQUAD'}
          </button>
        </>
      )}
      <div className="cup-prize">
        <PackArt
          kind={prize.pack}
          label={prize.pack.toUpperCase()}
          sport={pool.sport}
          small
        />
        <span>
          <b>{paid ? 'Weekly prize earned' : 'Win all three matches'}</b>
          <small>
            {prize.coins} coins ·{' '}
            {prize.pack === 'premium' ? 'Premium Gold' : 'Gold'} Pack ·{' '}
            {prize.sp} SP
          </small>
          <small>
            {paid
              ? 'Replay freely for the challenge; no extra completion prize.'
              : 'Once per bracket each week. No entry fee or cards consumed.'}
          </small>
        </span>
      </div>
      <button className="cup-text" onClick={onSquad}>
        OPEN MY SQUAD
      </button>
      {!!c.history.length && (
        <>
          <SectionHead title="Recent Cup runs" />
          <div className="cup-history">
            {c.history
              .slice(-5)
              .reverse()
              .map((h) => (
                <div key={h.id}>
                  <IconCrown size={17} />
                  <span>
                    <b>{CUP_NAMES[h.kind]}</b>
                    <small>
                      {h.outcome === 'champion'
                        ? 'Champion'
                        : h.outcome === 'retired'
                          ? 'Retired'
                          : 'Knocked out'}{' '}
                      · {LEVEL_NAME[h.level]} · {h.week}
                    </small>
                  </span>
                  <strong className="num">{h.wins}W</strong>
                </div>
              ))}
          </div>
        </>
      )}
      <p className="note">
        Cups require manual matches. Match coins and card XP use the normal
        daily limits; the once-weekly title reward is separate. Chemistry rules
        and opponents rotate by week. You can change cards between rounds if
        they remain eligible.
      </p>
      {retiring && (
        <Confirm
          title="Retire this Cup?"
          body="This entry will end with its current result. Your cards, earlier trophies and rewards stay yours. You can enter another Cup for free."
          yes="RETIRE ENTRY"
          no="KEEP PLAYING"
          onYes={() => {
            setRetiring(false);
            if (a) { setSelected(a.kind); setLevel(a.level); }
            onRetire();
          }}
          onNo={() => setRetiring(false)}
        />
      )}
    </div>
  );
}
