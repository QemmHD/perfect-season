import React, { useMemo, useState } from 'react';
import { type Collection, coreSet, franchises, SET_REWARD, setProgress, summarize } from '../engine/collection';
import { RARITY_COLORS, RARITY_NAMES, type Rarity } from '../engine/rarity';
import { NFL } from '../engine/sport';
import type { Player } from '../engine/types';
import { sfx } from '../lib/sound';
import { TradingCard, CardSheet } from './Card';
import { lastName, Sheet } from './common';
import { Back } from './icons';

/**
 * The binder: every card you've drafted, by franchise and decade. Each team-decade's core set
 * (its best players) is a checklist; the ones you haven't drafted show as names only.
 */
export function Binder({ collection, onClose }: { collection: Collection; onClose: () => void }) {
  const sum = useMemo(() => summarize(collection), [collection]);
  const all = useMemo(() => {
    const list = franchises().map((f) => {
      const progress = f.cells.map((c) => setProgress(collection, c));
      return { ...f, have: progress.reduce((a, p) => a + p.have, 0), size: progress.reduce((a, p) => a + p.size, 0), sets: progress.filter((p) => p.done).length };
    });
    // the ones you've started first, then by name
    return list.sort((a, b) => b.have / b.size - a.have / a.size || a.name.localeCompare(b.name));
  }, [collection]);
  const [open, setOpen] = useState<string | null>(null);
  const [inspect, setInspect] = useState<Player | null>(null);
  return (
    <>
    <Sheet label="Your binder" kind="bottom" onClose={onClose}>
      {(close) => (
        <div className="binder">
          <div className="binder-head">
            <button className="icon-btn" onClick={() => close()} aria-label="Close">
              <Back />
            </button>
            <h2 className="disp">BINDER</h2>
            <span className="binder-sport">{NFL ? 'NFL' : 'NBA'}</span>
          </div>
          <div className="binder-sum">
            <span>
              <b className="disp num">{sum.cards}</b>
              Cards
            </span>
            <span>
              <b className="disp num">{sum.sets}</b>
              Sets done
            </span>
            {(['legendary', 'epic', 'rare'] as Rarity[]).map((r) => (
              <span key={r}>
                <b className="disp num" style={{ color: RARITY_COLORS[r] }}>
                  {sum.byRarity[r] ?? 0}
                </b>
                {RARITY_NAMES[r]}
              </span>
            ))}
          </div>
          <p className="note">Every player you draft goes in. Finish a team-decade's core set, its {NFL ? 'defense and five best players' : 'five best players'}, for {SET_REWARD} coins.</p>
          <div className="binder-list">
            {all.map((f) => {
              const isOpen = open === f.fr;
              return (
                <div key={f.fr} className={'fr' + (isOpen ? ' open' : '') + (f.have ? '' : ' none')}>
                  <button
                    className="fr-row"
                    onClick={() => {
                      sfx.click();
                      setOpen(isOpen ? null : f.fr);
                    }}
                    aria-expanded={isOpen}
                  >
                    <i style={{ background: 'linear-gradient(180deg, ' + f.c1 + ', ' + f.c2 + ')' }} />
                    <span className="nm">{f.name}</span>
                    <span className="bar">
                      <i style={{ width: Math.round((100 * f.have) / Math.max(1, f.size)) + '%' }} />
                    </span>
                    <b className="num">
                      {f.have}/{f.size}
                    </b>
                  </button>
                  {isOpen &&
                    f.cells.map((c) => {
                      const set = coreSet(c);
                      const pr = setProgress(collection, c);
                      return (
                        <div key={c.id} className={'decade' + (pr.done ? ' done' : '')}>
                          <div className="dec-head">
                            <span>
                              {c.era} {c.name}
                            </span>
                            <b className="num">{pr.done ? 'COMPLETE' : pr.have + '/' + pr.size}</b>
                          </div>
                          <div className="dec-cards">
                            {set.map((p) =>
                              collection[p.id] ? (
                                <button key={p.id} className="mini" onClick={() => (sfx.click(), setInspect(p))} aria-label={p.name}>
                                  <span className="mini-in">
                                    <TradingCard p={p} tilt={false} />
                                  </span>
                                  {collection[p.id] > 1 && <span className="dupe num">×{collection[p.id]}</span>}
                                </button>
                              ) : (
                                <span key={p.id} className="mini empty" aria-label={p.name + ', not collected'}>
                                  <span className="q">?</span>
                                  <small>{lastName(p.name)}</small>
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
    {inspect && <CardSheet p={inspect} onClose={() => setInspect(null)} />}
    </>
  );
}
