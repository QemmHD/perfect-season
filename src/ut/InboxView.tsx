// Claude, 2026-11-01 (wave 2): the Rewards inbox (Home → Rewards): every reward ready to claim, one
// CLAIM ALL, and shortcuts to packs and picks waiting in the Store.
import { EmptyState, Lede } from './ui';
import { IconGift } from './icons';
import React from 'react';
import { HQArrow } from './Clubhouse';
import type { InboxItem } from './inbox';

export function InboxView(props: { items: InboxItem[]; onClaimAll: () => void; onStore: () => void; onDaily: () => void }) {
  const claimable = props.items.filter((i) => i.claimable);
  const rest = props.items.filter((i) => !i.claimable);
  return (
    <div className="page ut-inbox">
      <Lede>Everything you’ve earned in one place. Coins go to your wallet; packs and picks wait in the Store.</Lede>
      {claimable.length > 0 && (
        <button className="btn gold ut-claim-all" onClick={props.onClaimAll}>
          CLAIM ALL ({claimable.length})
        </button>
      )}
      {claimable.map((i) => (
        <div key={i.id} className="ut-inbox-item ready">
          <span>
            <b>{i.title}</b>
            <small>{i.detail}</small>
          </span>
          <i className="ut-inbox-dot" aria-hidden="true" />
        </div>
      ))}
      {rest.map((i) => (
        <button key={i.id} className="ut-inbox-item" onClick={props.onStore}>
          <span>
            <b>{i.title}</b>
            <small>{i.detail}</small>
          </span>
          <HQArrow />
        </button>
      ))}
      {!props.items.length && (
        <EmptyState icon={<IconGift size={24} />} title="All caught up">
          Play matches, open your Daily Drop and finish objectives to fill it.
        </EmptyState>
      )}
      <button className="btn" onClick={props.onDaily}>
        OPEN DAILY
      </button>
    </div>
  );
}
