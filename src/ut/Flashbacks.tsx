// Flashbacks, the list: each moment with its story's first line, what it takes, how hard, what its
// first clear pays (the hero's Moments card), and whether it's been cleared.
import React from 'react';
import { SPORT } from '../engine/sport';
import { sfx } from '../lib/sound';
import { UtCard } from './CardArt';
import { flashbacksFor, goalText, heroCard, REPLAY_COINS } from './flashbacks';
import type { Pool } from './pool';
import { rateCard } from './rate';
import type { UtState } from './state';

export function Flashbacks({ pool, ut, onPlay }: { pool: Pool; ut: UtState; onPlay: (id: string) => void }) {
  const list = flashbacksFor(SPORT);
  const cleared = list.filter((f) => (ut.flash?.done[f.id] ?? 0) > 0).length;
  return (
    <div className="page ut-flash">
      <p className="lead">
        Replay the games no one forgets, with the squads that played them. Each first clear pays coins and its hero’s Moments card; a replay won pays {REPLAY_COINS}.
      </p>
      <span className="eyebrow">
        {cleared} of {list.length} cleared
      </span>
      {list.map((f) => {
        const done = (ut.flash?.done[f.id] ?? 0) > 0;
        const hero = heroCard(pool, f);
        return (
          <button key={f.id} className={'ut-flash-row' + (done ? ' done' : '')} onClick={() => (sfx.click(), onPlay(f.id))}>
            <span className="ut-flash-txt">
              <i className="eyebrow">{f.date}</i>
              <b className="disp">{f.title}</b>
              <small>{goalText(f)}</small>
              <span className="ut-flash-meta">
                <i className="ut-flash-stars" aria-label={f.stars + ' of 3 stars'}>
                  {'★'.repeat(f.stars)}
                  <s>{'★'.repeat(3 - f.stars)}</s>
                </i>
                <i>{done ? '✓ Cleared' : f.coins.toLocaleString('en-US') + ' coins'}</i>
              </span>
            </span>
            {hero && <UtCard rc={rateCard(hero)} w={58} />}
          </button>
        );
      })}
    </div>
  );
}
