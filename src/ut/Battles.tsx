// Squad Battles: this week's ladder of AI squads (battles.ts), harder every rung. The next rung to
// beat stands out; cleared ones can be played again (for coins and XP), the ones above wait.
import React, { useEffect, useMemo, useRef } from 'react';
import { sfx } from '../lib/sound';
import { Check, Lock } from '../ui/icons';
import { battlesThisWeek, RUNGS, skillName, weekLadder } from './battles';
import { packName } from './packs';
import { COINS_WIN } from './play';
import type { Pool } from './pool';
import type { SquadRating } from './squad';
import type { UtState } from './state';
import type { UtSport } from './types';
import './match.css';

export function Battles(props: {
  pool: Pool;
  sport: UtSport;
  week: string;
  battles: UtState['battles'];
  rating: SquadRating;
  /** every starting spot filled */
  ready: boolean;
  onPlay: (rung: number) => void;
  onSquad: () => void;
  onToast: (t: string) => void;
}) {
  const rungs = useMemo(() => weekLadder(props.pool, props.week), [props.pool, props.week]);
  const { cleared } = battlesThisWeek(props.battles, props.week);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    try {
      nextRef.current?.scrollIntoView({ block: 'center' });
    } catch {
      // older browsers: the top of the list is fine
    }
  }, []);

  const tap = (i: number) => {
    if (i > cleared) {
      sfx.nope();
      props.onToast('Beat rung ' + (cleared + 1) + ' first: the ladder goes one rung at a time.');
      return;
    }
    if (!props.ready) {
      sfx.nope();
      props.onToast('Fill every starting spot in your squad first.');
      return;
    }
    sfx.click();
    props.onPlay(i);
  };

  return (
    <div className="page utb">
      <div className="utb-head">
        <span className="utb-head-txt">
          <span className="eyebrow">This week’s ladder</span>
          <b className="disp">{cleared >= RUNGS ? 'Ladder cleared!' : 'Rung ' + (cleared + 1) + ' of ' + RUNGS}</b>
          <small>{RUNGS} AI squads, each one tougher. A new ladder every Monday.</small>
          <span className="utb-pips" aria-label={cleared + ' of ' + RUNGS + ' cleared'}>
            {rungs.map((r) => (
              <i key={r.i} className={r.i < cleared ? 'on' : ''} />
            ))}
          </span>
        </span>
        <span className="utb-mine" aria-label={'Your squad: ' + props.rating.ovr + ' overall'}>
          <b className="disp num">{props.rating.filled ? props.rating.ovr : '—'}</b>
          <i>YOUR OVR</i>
        </span>
      </div>

      {!props.ready && (
        <div className="utb-warn" role="note">
          <span>Every starting spot in your squad needs a card before it can play.</span>
          <button className="btn primary" onClick={props.onSquad}>
            SQUAD
          </button>
        </div>
      )}

      <div className="utb-list">
        {rungs.map((r) => {
          const state = r.i < cleared ? 'cleared' : r.i === cleared ? 'next' : 'locked';
          const reward = r.pack && r.i >= cleared ? packName(props.sport, r.pack) : '+' + COINS_WIN + ' coins a win';
          return (
            <button
              key={r.i}
              ref={state === 'next' ? nextRef : undefined}
              className={'utb-rung ' + state}
              onClick={() => tap(r.i)}
              aria-label={'Rung ' + (r.i + 1) + ': ' + r.title + ', ' + r.ovr + ' overall, ' + skillName(r.skill) + ' AI' + (state === 'cleared' ? ', cleared' : state === 'locked' ? ', locked' : '')}
            >
              <span className="utb-num disp num">{state === 'cleared' ? <Check size={16} /> : r.i + 1}</span>
              <span className="utb-txt">
                <b>{r.title}</b>
                <small>
                  {skillName(r.skill)} AI · {reward}
                </small>
              </span>
              <span className="utb-ovr">
                <b className="disp num">{r.ovr}</b>
                <i>OVR</i>
              </span>
              <span className="utb-go" aria-hidden="true">
                {state === 'locked' ? <Lock size={14} /> : state === 'next' ? 'PLAY' : 'AGAIN'}
              </span>
            </button>
          );
        })}
      </div>
      <p className="utb-foot">A win pays {COINS_WIN} coins and XP for every card in your squad; the first clear of a rung each week can pay a pack.</p>
    </div>
  );
}
