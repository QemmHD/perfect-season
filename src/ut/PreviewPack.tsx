// Claude, 2026-11-01 (wave 2): the Preview Pack in the Store: see the Premium Gold pack's exact
// cards, then buy them or skip (the next preview arrives 24 hours later; packs-3).
import React, { useState } from 'react';
import { Coin } from '../ui/icons';
import { UtCard } from './CardArt';
import { packDefs } from './packs';
import type { Pool } from './pool';
import { previewCards, previewStatus, PREVIEW_KIND } from './preview-pack';
import { revealOrder } from './packs';
import type { UtState } from './state';
import { LazyOddsSheet } from './odds-lazy';
import './odds-sheet.css';

export function PreviewPack(props: { pool: Pool; ut: UtState; week: string; coins: number; now: number; onStart: () => void; onBuy: () => void; onSkip: () => void }) {
  const st = previewStatus(props.ut, props.now);
  const price = packDefs(props.pool.sport)[PREVIEW_KIND].price;
  const started = !!props.ut.content?.preview;
  const cards = st.ready ? revealOrder(previewCards(props.pool, props.ut, props.week)).reverse() : [];
  // Claude (packs-4): the odds its cards were drawn with (a Premium Gold's)
  const [odds, setOdds] = useState(false);
  return (
    <div className="ut-preview">
      <span className="ut-preview-head">
        <span>
          <span className="eyebrow">PREVIEW PACK</span>
          <b className="disp">See it before you buy it</b>
        </span>
        <span className="ut-preview-side">
          <small>Premium Gold</small>
          <button className="ps-odds-chip" onClick={() => setOdds(true)} aria-label="Preview Pack odds">
            ODDS
          </button>
        </span>
      </span>
      {odds && <LazyOddsSheet pool={props.pool} sport={props.pool.sport} source={{ type: 'pack', kind: 'preview' }} onClose={() => setOdds(false)} />}
      {!started ? (
        <>
          <p>A Premium Gold pack you can look inside first. Buy it or skip it: either way the next preview comes 24 hours later.</p>
          <button className="btn primary" onClick={props.onStart}>
            PREVIEW A PACK
          </button>
        </>
      ) : !st.ready ? (
        <p className="ut-preview-wait">Next preview in {st.minutesLeft >= 60 ? Math.floor(st.minutesLeft / 60) + ' h' + (st.minutesLeft % 60 ? ' ' + (st.minutesLeft % 60) + ' min' : '') : st.minutesLeft + ' min'}. One preview a day.</p>
      ) : (
        <>
          <div className="ut-preview-cards">
            {cards.map((rc, i) => (
              <UtCard key={rc.line.id + i} rc={rc} w={52} />
            ))}
          </div>
          <div className="ut-preview-btns">
            <button className="btn" onClick={props.onSkip}>
              SKIP
            </button>
            <button className={'btn ut-buy' + (props.coins < price ? ' short' : ' gold')} aria-disabled={props.coins < price} onClick={props.onBuy} aria-label={'Buy the previewed pack for ' + price + ' coins'}>
              BUY THESE <Coin size={14} /> <span className="num">{price.toLocaleString('en-US')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
