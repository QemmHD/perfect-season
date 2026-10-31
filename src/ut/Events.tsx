// Implemented by Codex. See docs/CODEX-UPDATE-LOG.md for ownership, connections and validation.
import React, { useState } from 'react';
import { eventsFor, eventRung } from './events';
import type { Pool } from './pool';
import type { UtState } from './state';
import { IconCheck, IconPlay } from './icons';
export function Events({ pool, ut, ready, onSquad, onPlay }: { pool: Pool; ut: UtState; ready: boolean; onSquad: () => void; onPlay: (id: string, node: number) => void }) {
  const [selected, setSelected] = useState('dynasty');
  const events = eventsFor(pool),
    event = events.find((e) => e.id === selected)!;
  const cleared = ut.events?.[event.id] ?? 0;
  return (
    <div className="page ut-events">
      <div className="ut-content-hero">
        <span className="eyebrow">ULTIMATE TEAM · SPOTLIGHT SERIES</span>
        <h1 className="disp">Legends are waiting.</h1>
        <p>Bring your club. Beat themed squads. Earn a guaranteed 99+ Spotlight edition.</p>
        <span className="ut-event-tag">3 SERIES · 9 MATCHUPS · UNIQUE FIRST-CLEAR REWARDS</span>
      </div>
      <div className="ut-chips" aria-label="Event series">
        {events.map((e) => (
          <button key={e.id} className={'chip' + (e.id === selected ? ' on' : '')} aria-pressed={e.id === selected} onClick={() => setSelected(e.id)}>
            {e.title.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="ut-event-header">
        <span className="eyebrow">{event.kicker}</span>
        <h2 className="disp">{event.title}</h2>
        <p>{event.blurb}</p>
        <span className="num">{cleared} / 3 CLEARED</span>
      </div>
      <div className="ut-event-path">
        {[0, 1, 2].map((node) => {
          const rung = eventRung(pool, event.id, node)!,
            done = node < cleared,
            locked = node > cleared;
          return (
            <div className={'ut-event-node' + (done ? ' complete' : '') + (node === cleared ? ' current' : '')} key={node}>
              <span className="ut-event-step num">{done ? <IconCheck /> : String(node + 1).padStart(2, '0')}</span>
              <div>
                <span className="eyebrow">{node === 2 ? 'THE BOSS MATCH' : 'THE CHALLENGE'}</span>
                <h3 className="disp">{['Opening Night', 'Rising Stakes', 'GOAT Finale'][node]}</h3>
                <p>
                  {rung.ovr} OVR · {['Silver Pack', 'Premium Gold Pack', 'Guaranteed Spotlight Reward'][node]}
                </p>
                <button className={'btn' + (!locked ? ' primary' : '')} disabled={locked} onClick={() => (ready ? onPlay(event.id, node) : onSquad())}>
                  {locked ? (
                    'LOCKED'
                  ) : !ready ? (
                    'BUILD YOUR SQUAD'
                  ) : done ? (
                    'REPLAY'
                  ) : (
                    <>
                      <IconPlay size={16} /> PLAY MATCH
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="note">
        Full matches using your own squad. Play manually or use the existing Sim option. Each stage’s pack is earned once per sport; replaying never resets rewards. A Spotlight
        Reward is not a GOAT guarantee.
      </p>
    </div>
  );
}
