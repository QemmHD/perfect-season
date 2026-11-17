// Codex (OpenAI): Cups share the existing club materials, mode rows and pack art.
// Claude (Anthropic), 2026-11-08, UI pass: the same states and handlers, presented as a Cup screen
// from FC / 2K: a trophy per Cup with its own colour, a QF → SF → Final bracket with your club in it,
// clear entry rules and eligibility, the prize as pack art and a title moment with confetti.
// Presentation only: every button, label and callback below is the one Codex wired.
import React, { useState } from 'react';
import { Confirm, Confetti } from '../ui/common';
import { Coin } from '../ui/icons';
import { LEVELS, LEVEL_NAME, type Level } from './battles';
import { IconCheck, IconPlay, IconX } from './icons';
import { PackArt } from './PackArt';
import { packName } from './packs';
import type { Pool } from './pool';
import type { UtState } from './state';
import { Lede, SectionHead } from './ui';
import { CUP_KINDS } from './cup-state';
import { CUP_TONE, CupTrophy, PixelPlayer, useSquadStars } from './play-art';
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

const KIND_LABEL: Record<CupKind, string> = {
  open: 'OPEN',
  silver: 'SILVER',
  chemistry: 'CHEMISTRY',
};
const ROUND_SHORT = ['QF', 'SF', 'FINAL'];

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
  const stars = useSquadStars(pool, ut, 2);
  const champion =
    !!a?.done && a.results.length === 3 && a.results.every((r) => r.won);
  const total = Object.values(c.trophies).reduce((n, x) => n + x, 0);
  const prizeName = packName(pool.sport, prize.pack);
  const facts = (
    <ul className="cup-facts" aria-label="Cup rules">
      <li>
        <FactIcon d="M4 6h5v4H4zM4 14h5v4H4zM9 8h4v8H9M13 12h7" />
        <span>
          <b>3 ROUNDS</b>
          <small>Lose once, you're out</small>
        </span>
      </li>
      <li>
        <FactIcon d="M5 12l4 4 10-10" />
        <span>
          <b>FREE ENTRY</b>
          <small>No cards used up</small>
        </span>
      </li>
      <li>
        <FactIcon d="M8 5l11 7-11 7z" />
        <span>
          <b>PLAYED</b>
          <small>Manual matches only</small>
        </span>
      </li>
    </ul>
  );
  const finishPanel = (a: NonNullable<typeof c.active>) => (
    <div className={'cup-finish' + (champion ? ' champion' : ' out')}>
      {champion && (
        <>
          <i className="cup-finish-rays" aria-hidden="true" />
          <span className="cup-confetti" aria-hidden="true">
            <Confetti
              density={2}
              colors={[
                CUP_TONE[kind],
                '#FFD36B',
                '#FFFFFF',
                '#19E3C9',
                '#FFE9A8',
              ]}
            />
          </span>
        </>
      )}
      <span className="cup-finish-stage" aria-hidden="true">
        {champion && stars[0] && (
          <PixelPlayer
            line={stars[0]}
            pose="cheer"
            className="cup-finish-hero"
          />
        )}
        <CupTrophy
          kind={kind}
          size={champion ? 112 : 72}
          className="cup-finish-trophy"
        />
      </span>
      <span className="eyebrow">
        {champion
          ? CUP_NAMES[kind].toUpperCase() +
            ' · ' +
            LEVEL_NAME[a.level].toUpperCase()
          : 'KNOCKED OUT IN THE ' +
            (CUP_ROUNDS[a.results.length - 1] ?? 'CUP').toUpperCase()}
      </span>
      <h3 className="disp">
        {champion ? 'CUP CHAMPIONS' : 'THE NEXT RUN STARTS HERE'}
      </h3>
      <p>
        {champion
          ? paid
            ? 'You have already earned this bracket’s weekly prize. Your run still joins the record.'
            : 'A title for your cabinet. Your pack and coins are ready.'
          : 'Every knockout run teaches you something. Adjust your squad and come back stronger.'}
      </p>
      {champion && !paid && (
        <span className="cup-finish-prize" aria-hidden="true">
          <PackArt
            kind={prize.pack}
            label={prize.pack.toUpperCase()}
            sport={pool.sport}
          />
          <span className="cup-finish-chips">
            <i>
              <Coin size={15} /> <b className="num">+{prize.coins}</b>
            </i>
            <i>
              <b className="num">+{prize.sp}</b> SP
            </i>
          </span>
        </span>
      )}
      <button
        className={'btn ' + (champion ? 'gold' : 'primary')}
        onClick={() => {
          setSelected(kind);
          setLevel(a.level);
          onClaim();
        }}
      >
        {champion && !paid ? 'COLLECT TITLE REWARD' : 'SAVE RESULT & RETURN'}
      </button>
    </div>
  );
  return (
    <div
      className={'page cup-page k-' + kind}
      style={{ '--cup': CUP_TONE[kind] } as React.CSSProperties}
    >
      <Lede>
        Win three knockout rounds with your own club. One loss ends the run.
      </Lede>
      <div
        className="cup-trophies"
        aria-label={
          total +
          ' weekly titles: ' +
          c.trophies.open +
          ' Open, ' +
          c.trophies.silver +
          ' Silver, ' +
          c.trophies.chemistry +
          ' Chemistry'
        }
      >
        <span className="cup-cab-total">
          <b className="disp num">{total}</b>
          <small>WEEKLY TITLES</small>
        </span>
        {CUP_KINDS.map((k) => (
          <span
            key={k}
            className={'cup-cab k-' + k + (c.trophies[k] ? ' won' : '')}
          >
            <CupTrophy kind={k} size={26} />
            <b className="num">{c.trophies[k]}</b>
          </span>
        ))}
      </div>
      {!a && (
        <div className="cup-picker" role="group" aria-label="Cup bracket">
          {CUP_KINDS.map((k) => (
            <button
              className={'cup-pick k-' + k + (selected === k ? ' on' : '')}
              key={k}
              aria-pressed={selected === k}
              aria-label={KIND_LABEL[k]}
              onClick={() => setSelected(k)}
              style={{ '--cup': CUP_TONE[k] } as React.CSSProperties}
            >
              <CupTrophy kind={k} size={40} />
              <b className="disp">{KIND_LABEL[k]}</b>
              <small>
                {CUP_PRIZES[k].pack === 'premium'
                  ? 'PREMIUM PRIZE'
                  : 'GOLD PRIZE'}
              </small>
            </button>
          ))}
        </div>
      )}
      {a?.done && finishPanel(a)}
      {!a?.done && (
        <>
          <div className="cup-feature">
            <i className="cup-feature-rays" aria-hidden="true" />
            <span className="cup-feature-copy">
              <span className="eyebrow">
                {period === week ? 'THIS WEEK' : 'SAVED CUP · ' + period} · FREE
                ENTRY
              </span>
              <h2 className="disp">{CUP_NAMES[kind]}</h2>
              <span className="cup-rule-label">ENTRY RULE</span>
              <p>{rule.text}</p>
            </span>
            <CupTrophy kind={kind} size={92} className="cup-feature-trophy" />
            {!a?.done && (
              <div
                className={'cup-eligibility' + (eligible.ok ? ' ready' : '')}
                role="status"
              >
                <span className="cup-elig-mark" aria-hidden="true">
                  {eligible.ok ? <IconCheck size={16} /> : <IconX size={16} />}
                </span>
                <span className="cup-elig-txt">
                  <b>{eligible.ok ? 'ELIGIBLE' : 'NOT ELIGIBLE YET'}</b>
                  <span>{eligible.reason}</span>
                </span>
                {!eligible.ok && eligible.need > 0 && (
                  <span className="cup-elig-meter" aria-hidden="true">
                    <i
                      style={{
                        width:
                          Math.min(
                            100,
                            (100 * eligible.progress) / eligible.need,
                          ) + '%',
                      }}
                    />
                  </span>
                )}
              </div>
            )}
            {a && period !== week && (
              <p className="note">
                Your entry keeps its original rules and reward. Finish it
                whenever you are ready.
              </p>
            )}
          </div>
          {!a && facts}
        </>
      )}
      {a && (
        <CupBracket
          a={a}
          champion={champion}
          nextOvr={next?.rung.ovr}
          kind={kind}
        />
      )}
      {a ? (
        a.done ? null : (
          <>
            <div className="cup-opponent">
              <span className="cup-vs-side cv-you">
                {stars[0] ? (
                  <PixelPlayer line={stars[0]} />
                ) : (
                  <i className="cup-crest">YOU</i>
                )}
                <b>YOUR CLUB</b>
              </span>
              <span className="cup-vs-mid">
                <span className="eyebrow">UP NEXT · {LEVEL_NAME[a.level]}</span>
                <b className="disp">{CUP_ROUNDS[a.round].toUpperCase()}</b>
                <i className="disp" aria-hidden="true">
                  VS
                </i>
                {next && (
                  <small>{LEVEL_NAME[a.level]} defense · full match</small>
                )}
              </span>
              <span className="cup-vs-side cv-them">
                {stars[1] || stars[0] ? (
                  <PixelPlayer line={stars[1] ?? stars[0]} ghost />
                ) : (
                  <i className="cup-crest">?</i>
                )}
                <b>{next ? next.rung.ovr + ' OVR' : 'RIVAL'}</b>
              </span>
              <span className="sr-only">
                {next?.rung.title ?? CUP_ROUNDS[a.round]}
              </span>
            </div>
            <button
              className="btn primary cup-go"
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
        )
      ) : (
        <>
          <label className="cup-difficulty">
            <span>
              <b>DIFFICULTY</b>
              <small>Harder AI, same title prize</small>
            </span>
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
            className={'btn cup-go ' + (eligible.ok ? 'primary' : 'gold')}
            onClick={() => (eligible.ok ? onStart(selected, level) : onSquad())}
          >
            <IconPlay size={17} />
            {eligible.ok
              ? 'ENTER ' + CUP_NAMES[selected].toUpperCase()
              : 'BUILD AN ELIGIBLE SQUAD'}
          </button>
          <CupBracket a={a} champion={false} kind={kind} />
        </>
      )}
      {!(champion && !paid) && (
        <div className={'cup-prize' + (paid ? ' paid' : '')}>
          <span className="cup-prize-art">
            <i className="cup-prize-glow" aria-hidden="true" />
            <PackArt
              kind={prize.pack}
              label={prize.pack.toUpperCase()}
              sport={pool.sport}
              small
            />
          </span>
          <span className="cup-prize-txt">
            <span className="eyebrow">
              {paid ? 'WEEKLY PRIZE EARNED' : 'CHAMPION’S PRIZE'}
            </span>
            <b>{paid ? 'Weekly prize earned' : 'Win all three matches'}</b>
            <span className="cup-prize-chips">
              <i>
                <Coin size={13} /> <b className="num">{prize.coins}</b>
              </i>
              <i>{prizeName}</i>
              <i>
                <b className="num">{prize.sp}</b> SP
              </i>
            </span>
            <small>
              {paid
                ? 'Replay freely for the challenge; no extra completion prize.'
                : 'Once per bracket each week. No entry fee or cards consumed.'}
            </small>
          </span>
          {paid && (
            <span className="cup-prize-check" aria-hidden="true">
              <IconCheck size={18} />
            </span>
          )}
        </div>
      )}
      {a && !a.done && facts}
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
                <div key={h.id} className={'o-' + h.outcome}>
                  <CupTrophy kind={h.kind} size={22} />
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
        Match coins and card XP use the normal daily limits; the once-weekly
        title reward is separate. Chemistry rules and opponents rotate by week.
        You can change cards between rounds if they remain eligible.
      </p>
      {retiring && (
        <Confirm
          title="Retire this Cup?"
          body="This entry will end with its current result. Your cards, earlier trophies and rewards stay yours. You can enter another Cup for free."
          yes="RETIRE ENTRY"
          no="KEEP PLAYING"
          onYes={() => {
            setRetiring(false);
            if (a) {
              setSelected(a.kind);
              setLevel(a.level);
            }
            onRetire();
          }}
          onNo={() => setRetiring(false)}
        />
      )}
    </div>
  );
}

function FactIcon({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/** QF → SF → Final with your club's path lit. The other quarterfinal and semifinal are drawn as
 * ghosts so it reads as a bracket; results come from the saved run only. */
function CupBracket({
  a,
  champion,
  nextOvr,
  kind,
}: {
  a: ReturnType<typeof cupOf>['active'];
  champion: boolean;
  nextOvr?: number;
  kind: CupKind;
}) {
  const state = (i: number) =>
    a?.results[i]
      ? a.results[i].won
        ? 'won'
        : 'lost'
      : a && a.round === i && !a.done
        ? 'next'
        : 'tbd';
  const match = (i: number) => {
    const r = a?.results[i],
      s = state(i),
      opp = r ? 'Rival' : s === 'next' && nextOvr ? nextOvr + ' OVR' : 'TBD';
    return (
      <div
        className={'cb-match ' + s}
        aria-label={
          CUP_ROUNDS[i] +
          ': ' +
          (r
            ? (r.won ? 'won ' : 'lost ') + r.us + ' to ' + r.them
            : s === 'next'
              ? 'up next'
              : 'to be played')
        }
      >
        <span className={'cb-team cb-you' + (r?.won ? ' cb-win' : '')}>
          <i className="cb-crest" />
          <em>You</em>
          <b className="num">{r ? r.us : ''}</b>
        </span>
        <span className={'cb-team cb-opp' + (r && !r.won ? ' cb-win' : '')}>
          <i className="cb-crest" />
          <em>{opp}</em>
          <b className="num">{r ? r.them : ''}</b>
        </span>
        {s === 'next' && <i className="cb-next">NEXT</i>}
      </div>
    );
  };
  return (
    <div
      className={'cup-bracket cup-path' + (champion ? ' champion' : '')}
      aria-label="Cup knockout rounds"
    >
      <div className="cb-col">
        <span className="cb-round">{ROUND_SHORT[0]}</span>
        {match(0)}
        <div className="cb-match ghost" aria-hidden="true">
          <span className="cb-team" />
          <span className="cb-team" />
        </div>
      </div>
      <span className="cb-link qf" aria-hidden="true" />
      <div className="cb-col">
        <span className="cb-round">{ROUND_SHORT[1]}</span>
        {match(1)}
      </div>
      <span className="cb-link sf" aria-hidden="true" />
      <div className="cb-col final">
        <span className="cb-round">
          <CupTrophy kind={kind} size={13} /> {ROUND_SHORT[2]}
        </span>
        {match(2)}
      </div>
    </div>
  );
}
