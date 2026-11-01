// A promo campaign's launch: once, the first time Ultimate Team opens after it goes live. Its name
// comes in in its own colors, its cards fan out, and a way to where they're earned.
import React from 'react';
import { reducedMotion } from '../ui/motion';
import { UtCard } from './CardArt';
import type { Campaign } from './campaigns';
import type { RatedCard } from './types';

export function CampaignLaunch({ c, cards, onClose, onGo }: { c: Campaign; cards: RatedCard[]; onClose: () => void; onGo?: () => void }) {
  const still = reducedMotion();
  const fan = cards.slice(0, 5);
  return (
    <div className={'ut-launch th-' + c.theme + (still ? ' still' : '')} role="dialog" aria-modal="true" aria-label={'New promo: ' + c.name}>
      <span className="ut-walk-fx" aria-hidden="true" />
      <div className="ut-launch-body">
        <span className="eyebrow">New promo</span>
        <h1 className="disp ut-launch-name">{c.name.toUpperCase()}</h1>
        <div className="ut-launch-fan">
          {fan.map((rc, i) => (
            <span key={rc.line.id} className="ut-launch-card" style={{ '--i': i - (fan.length - 1) / 2, '--d': i * 0.12 + 's' } as React.CSSProperties}>
              <UtCard rc={rc} w={i === Math.floor(fan.length / 2) ? 124 : 96} />
            </span>
          ))}
        </div>
        <p>{c.blurb}</p>
        <div className="btnrow">
          <button className="btn" onClick={onClose}>
            LATER
          </button>
          {onGo && (
            <button className="btn gold" onClick={onGo}>
              PLAY FLASHBACKS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
