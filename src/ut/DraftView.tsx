// Claude, 2026-11-01: UT Draft (Play → Draft). Enter, pick a captain from five, then one of five per
// spot, then play up to four real matches; a loss ends the run. Rewards by wins, claimed once.
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Coin } from '../ui/icons';
import { UtCard } from './CardArt';
import { contentOf } from './content-state';
import { DRAFT_GAMES, DRAFT_PRICE, DRAFT_REWARDS, draftComplete, draftRating, draftRung, draftSlots, tokenReady } from './draft-mode';
import { packName } from './packs';
import type { Pool } from './pool';
import { seasonText } from './pool';
import { shortName } from './battles';
import type { UtState } from './state';
import type { RatedCard } from './types';

function rewardText(i: number, sport: Pool['sport']): string {
  const r = DRAFT_REWARDS[i];
  return [r.pack ? packName(sport, r.pack) : '', r.coins ? r.coins + ' coins' : ''].filter(Boolean).join(' + ');
}

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Options({ cards, onPick }: { cards: RatedCard[]; onPick: (i: number) => void }) {
  const [ref, width] = useWidth();
  const w = Math.max(48, Math.min(78, Math.floor((width - 4 * 6) / 5)));
  return (
    <div className="ut-draft-opts" ref={ref}>
      {cards.map((rc, i) => (
        <button key={rc.line.id} className="ut-draft-opt" onClick={() => onPick(i)} aria-label={'Draft ' + rc.line.name + ', ' + rc.ovr + ' ' + rc.pos}>
          <UtCard rc={rc} w={w} />
          <small>{rc.line.name.split(' ').slice(-1)[0]}</small>
        </button>
      ))}
    </div>
  );
}

export function DraftView(props: {
  pool: Pool;
  ut: UtState;
  week: string;
  coins: number;
  onStart: (paid: 'coins' | 'token') => void;
  onCaptain: (i: number) => void;
  onPick: (i: number) => void;
  onAuto: () => void;
  onPlay: (runId: string, game: number) => void;
  onRetire: () => void;
  onClaim: () => void;
}) {
  const { pool, ut } = props;
  const run = contentOf(ut).draft?.active;
  const slots = draftSlots(pool.sport);
  const rating = useMemo(() => (run ? draftRating(pool, run) : null), [pool, run]);
  // while drafting, the picks' average (an empty spot would count as 0 in the squad overall)
  const avg = useMemo(() => {
    const ovrs = run ? Object.values(run.squad).map((id) => pool.base.get(id)?.ovr ?? 0) : [];
    return ovrs.length ? Math.round(ovrs.reduce((a, b) => a + b, 0) / ovrs.length) : 0;
  }, [pool, run]);
  const rc = (id: string) => pool.base.get(id) ?? null;
  const history = contentOf(ut).draft?.history ?? [];

  if (!run)
    return (
      <div className="page ut-draft">
        <div className="hq-page-heading">
          <span className="eyebrow">SOLO · DRAFT A SQUAD FROM SCRATCH</span>
          <h1 className="disp">UT DRAFT.</h1>
          <p>Pick a captain from five, then one of five for every spot. Then win up to {DRAFT_GAMES} straight. One loss ends the run. Your club is never touched.</p>
        </div>
        <div className="ut-draft-rewards">
          <span className="eyebrow">REWARDS BY WINS</span>
          {DRAFT_REWARDS.map((_, i) => (
            <span key={i}>
              <b className="num">{i}</b>
              <small>{rewardText(i, pool.sport)}</small>
            </span>
          ))}
        </div>
        <div className="ut-draft-entry">
          {tokenReady(ut, props.week) && (
            <button className="btn primary" onClick={() => props.onStart('token')}>
              FREE WEEKLY ENTRY
            </button>
          )}
          <button className={'btn gold' + (props.coins < DRAFT_PRICE ? ' short' : '')} onClick={() => props.onStart('coins')}>
            ENTER <Coin size={14} /> <span className="num">{DRAFT_PRICE}</span>
          </button>
        </div>
        <p className="note">Drafted players are for this run only: no card joins or leaves your club and no card XP. Matches are real Squad Battles-style games against a rising AI ladder (play or sim).</p>
        {history.length > 0 && (
          <div className="ut-draft-history">
            <span className="eyebrow">RECENT RUNS</span>
            <span>
              {history
                .slice()
                .reverse()
                .map((h) => (
                  <i key={h.id} className="num">
                    {h.wins}W
                  </i>
                ))}
            </span>
          </div>
        )}
      </div>
    );

  const filled = Object.keys(run.squad).length;
  // the captain
  if (!filled)
    return (
      <div className="page ut-draft">
        <span className="eyebrow">STEP 1 · YOUR CAPTAIN</span>
        <h2 className="disp ut-draft-h">Pick your captain</h2>
        <p className="lead">Legends and Hot Seasons. He takes a spot he plays.</p>
        <Options cards={run.captains.map(rc).filter((x): x is RatedCard => !!x)} onPick={props.onCaptain} />
      </div>
    );

  const squadGrid = (
    <div className="ut-draft-squad">
      {slots.map((s) => {
        const c = run.squad[s.id] ? rc(run.squad[s.id]) : null;
        return (
          <span key={s.id} className={'ut-draft-slot' + (run.pick?.slot === s.id ? ' now' : '')}>
            {c ? <UtCard rc={c} w={40} slot={s.id} /> : <i style={{ width: 40, height: 56 }}>{s.id}</i>}
          </span>
        );
      })}
    </div>
  );

  if (run.pick) {
    const slot = slots.find((s) => s.id === run.pick!.slot);
    return (
      <div className="page ut-draft">
        <div className="ut-draft-bar">
          <span>
            <span className="eyebrow">
              SPOT {filled + 1} / {slots.length}
            </span>
            <b className="disp">{slot?.pos ? 'Draft your ' + slot.id : 'Draft a bench player (' + slot?.id + ')'}</b>
          </span>
          <span className="ut-draft-ovr">
            <b className="disp num">{avg}</b>
            <small>AVG OF PICKS</small>
          </span>
        </div>
        <Options cards={run.pick.options.map(rc).filter((x): x is RatedCard => !!x)} onPick={props.onPick} />
        <button className="btn" onClick={props.onAuto}>
          AUTO-DRAFT THE REST
        </button>
        {squadGrid}
      </div>
    );
  }

  const complete = draftComplete(pool.sport, run);
  const next = !run.done && complete ? draftRung(pool, run, run.games) : null;
  const reward = rewardText(Math.min(DRAFT_GAMES, run.wins), pool.sport);
  return (
    <div className="page ut-draft">
      <div className="ut-draft-bar">
        <span>
          <span className="eyebrow">YOUR DRAFT</span>
          <b className="disp">{run.done ? (run.wins >= DRAFT_GAMES ? 'Perfect run!' : 'Run over') : 'Game ' + (run.games + 1) + ' of ' + DRAFT_GAMES}</b>
        </span>
        <span className="ut-draft-ovr">
          <b className="disp num">{rating?.ovr ?? 0}</b>
          <small>OVR · {rating?.chem ?? 0} CHEM</small>
        </span>
      </div>
      <div className="ut-draft-results" aria-label={run.wins + ' wins'}>
        {Array.from({ length: DRAFT_GAMES }, (_, i) => (
          <i key={i} className={i < run.results.length ? (run.results[i] ? 'win' : 'loss') : ''}>
            {i < run.results.length ? (run.results[i] ? 'W' : 'L') : i + 1}
          </i>
        ))}
      </div>
      {run.done ? (
        <div className="ut-draft-claim">
          <span>
            <b>
              {run.wins} {run.wins === 1 ? 'win' : 'wins'}
            </b>
            <small>Reward: {reward}</small>
          </span>
          <button className="btn gold" onClick={props.onClaim}>
            CLAIM REWARDS
          </button>
        </div>
      ) : (
        next && (
          <div className="ut-draft-next">
            <span>
              <i className="eyebrow">NEXT OPPONENT</i>
              <b>{shortName(next)}</b>
              <small>
                {next.ovr} OVR · win now for {rewardText(Math.min(DRAFT_GAMES, run.wins + 1), pool.sport)}
              </small>
            </span>
            <button className="btn primary" onClick={() => props.onPlay(run.id, run.games)}>
              PLAY
            </button>
          </div>
        )
      )}
      {squadGrid}
      {!run.done && (
        <button className="btn ut-draft-retire" onClick={props.onRetire}>
          END RUN NOW ({run.wins} {run.wins === 1 ? 'WIN' : 'WINS'})
        </button>
      )}
      <p className="note">
        Captain: {(() => {
          const c = rc(Object.values(run.squad)[0]);
          return c ? c.line.name + ', ' + seasonText(c.line) : '';
        })()}
      </p>
    </div>
  );
}
