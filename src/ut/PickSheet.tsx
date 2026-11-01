// Claude, 2026-11-01: the pick sheet (Scout's Choice, Standout picks, Swap Desk): three cards face
// down, flipped one by one, then exactly one kept. The pick is saved before this opens, so closing it
// leaves it waiting in the Store under Your packs.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sfx, vibrate } from '../lib/sound';
import { reducedMotion } from '../ui/motion';
import { UtCard, UtCardBack } from './CardArt';
import type { PickState } from './content-state';
import type { Pool } from './pool';
import { seasonText } from './pool';
import { TIER_NAMES } from './rate';
import { isRare } from './rare';

export function PickSheet({ pool, pick, onKeep, onLater }: { pool: Pool; pick: PickState; onKeep: (index: number) => void; onLater: () => void }) {
  const cards = useMemo(() => pick.options.map((id) => pool.base.get(id) ?? null), [pool, pick]);
  const still = useMemo(reducedMotion, []);
  const [flipped, setFlipped] = useState(still ? cards.length : 0);
  const [chosen, setChosen] = useState<number | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  useEffect(() => modal.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (flipped === 0 || flipped >= cards.length) return;
    const t = window.setTimeout(() => {
      sfx.select();
      setFlipped((n) => n + 1);
    }, 420);
    return () => clearTimeout(t);
  }, [flipped]);
  const reveal = () => {
    if (flipped) return;
    sfx.whoosh();
    vibrate(16);
    setFlipped(1);
  };
  const all = flipped >= cards.length;
  const w = 96;
  return (
    <div className="ut-pick-screen" role="dialog" aria-modal="true" aria-label={pick.title} tabIndex={-1} ref={modal} onKeyDown={(e) => e.key === 'Escape' && onLater()}>
      <span className="eyebrow">{pick.title}</span>
      <h2 className="disp">{!flipped ? 'Three players. Keep one.' : !all ? 'Scouting…' : chosen === null ? 'Who joins your club?' : 'Keep ' + (cards[chosen]?.line.name ?? 'him') + '?'}</h2>
      <div className="ut-pick-row">
        {cards.map((rc, i) => (
          <button
            key={pick.options[i] + i}
            className={'ut-pick-card ut-flip' + (i < flipped ? ' on t-' + (rc?.tier ?? 'gold') : '') + (chosen === i ? ' chosen' : '') + (chosen !== null && chosen !== i ? ' dim' : '')}
            style={{ width: w, height: Math.round(w * 1.4) }}
            onClick={() => (!flipped ? reveal() : all && rc ? (sfx.click(), setChosen(i)) : undefined)}
            aria-label={i < flipped && rc ? 'Option ' + (i + 1) + ': ' + rc.line.name + ', ' + rc.ovr : 'Option ' + (i + 1) + ', face down'}
            aria-pressed={chosen === i}
          >
            <span className="ut-flip-in">
              <span className="ut-flip-back">
                <UtCardBack w={w} />
              </span>
              <span className="ut-flip-front">{rc && <UtCard rc={rc} w={w} />}</span>
            </span>
          </button>
        ))}
      </div>
      {all && (
        <div className="ut-pick-info rise-in" aria-live="polite">
          {cards.map((rc, i) =>
            rc ? (
              <span key={i} className={chosen === i ? 'on' : ''}>
                <b>{rc.line.name}</b>
                <small>
                  {rc.pos} · {seasonText(rc.line)} · {isRare(rc, pool) ? 'Rare Gold' : TIER_NAMES[rc.tier]}
                </small>
              </span>
            ) : null
          )}
        </div>
      )}
      <div className="ut-pick-btns">
        {!flipped ? (
          <button className="btn primary" onClick={reveal}>
            REVEAL
          </button>
        ) : (
          <button className="btn gold" disabled={chosen === null} onClick={() => chosen !== null && onKeep(chosen)}>
            {chosen === null ? 'TAP A CARD' : 'KEEP THIS PLAYER'}
          </button>
        )}
        <button className="btn" onClick={onLater}>
          LATER
        </button>
      </div>
      <p className="note">Only the player you keep joins your club. Your pick waits in the Store if you leave.</p>
    </div>
  );
}
