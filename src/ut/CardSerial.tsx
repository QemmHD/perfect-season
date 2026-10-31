// Implemented by Codex. Fixed issue number / live copies still in circulation.
import React from 'react';
import { useCirculation } from './circulation';
import type { CardMint, UtSport } from './types';
export function MintNumber({ mint, cardId, sport }: { mint: CardMint; cardId: string; sport: UtSport }) {
  const { total } = useCirculation(mint, cardId, sport);
  return (
    <>
      {mint.serial}
      <i>/</i>
      {total}
    </>
  );
}
export function CardStamp({ mint, cardId, sport }: { mint: CardMint; cardId: string; sport: UtSport }) {
  const { total, fresh } = useCirculation(mint, cardId, sport);
  return (
    <span
      className={'utc-stamp' + (fresh ? '' : ' cached')}
      title={`Issue #${mint.serial} · ${total} copies in circulation${fresh ? '' : ' · last confirmed count'}`}
      aria-label={`Issue ${mint.serial}, ${total} copies in circulation`}
    >
      <b>{mint.serial}</b>
      <i>/</i>
      <b>{total}</b>
    </span>
  );
}
export function CardSerial({ mint, cardId, sport }: { mint: CardMint; cardId: string; sport: UtSport }) {
  const { total, fresh } = useCirculation(mint, cardId, sport);
  return (
    <div className="ut-card-serial">
      <span className="eyebrow">WORLDWIDE EDITION NUMBER</span>
      <b className="disp num">
        {mint.serial}
        <i> / </i>
        {total}
      </b>
      <small>
        Your copy is #{mint.serial}. {fresh ? 'Live copies in circulation.' : 'Last confirmed circulation. Reconnect to refresh.'} Your
        number stays fixed; sold and SBC copies leave the total.
      </small>
    </div>
  );
}
