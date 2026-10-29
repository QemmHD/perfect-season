// Implemented by Codex. See docs/CODEX-UPDATE-LOG.md for ownership, connections and validation.
import React, { useEffect, useState } from 'react';
import { cardCounts } from './registry';
import type { CardMint, UtSport } from './types';
export function CardSerial({ mint, cardId, sport }: { mint: CardMint; cardId: string; sport: UtSport }) {
  const [total, setTotal] = useState(mint.totalAtPull),
    [fresh, setFresh] = useState(false);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void cardCounts(sport, mint.namespace)
        .then((counts) => {
          if (live) {
            setTotal((n) => Math.max(n, counts[cardId] ?? n));
            setFresh(typeof counts[cardId] === 'number' && counts[cardId] >= mint.serial);
          }
        })
        .catch(() => {
          if (live) setFresh(false);
        });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [mint.namespace, cardId, sport]);
  return (
    <div className="ut-card-serial">
      <span className="eyebrow">WORLDWIDE EDITION NUMBER</span>
      <b className="disp num">
        {mint.serial}
        <i> / </i>
        {total}
      </b>
      <small>
        Your copy is #{mint.serial}. {fresh ? 'Total registered worldwide.' : 'Last confirmed total. Reconnect to refresh.'} Your number stays fixed as the total grows.
      </small>
    </div>
  );
}
