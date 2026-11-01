// Claude, 2026-11-01: Set Collections (Club → Collection → Sets, and Home): program, All-Decade and
// franchise-era sets with progress and a one-time claim, and the Landmark Seasons archive.
import React, { useMemo, useState } from 'react';
import { Coin } from '../ui/icons';
import { UtCard } from './CardArt';
import { landmarkCards } from './content-sbc';
import { packName } from './packs';
import type { Pool } from './pool';
import { setsFor, type CardSet, type SetKind } from './sets';
import type { UtState } from './state';
import type { UtSport } from './types';

const KIND: [SetKind | 'landmarks', string][] = [
  ['program', 'Programs'],
  ['decade', 'All-Decade'],
  ['era', 'Franchise eras'],
  ['landmarks', 'Landmarks'],
];

function SetRow({ s, sport, onClaim }: { s: CardSet; sport: UtSport; onClaim: () => void }) {
  const ready = !s.claimed && s.have >= s.need;
  return (
    <div className={'ut-set' + (s.claimed ? ' claimed' : ready ? ' ready' : '')}>
      <span className="ut-set-txt">
        <b>{s.title}</b>
        <small>{s.blurb}</small>
        <span className="bar">
          <i style={{ width: (100 * s.have) / s.need + '%' }} />
        </span>
        <small className="ut-set-reward">
          <Coin size={11} /> {s.coins.toLocaleString('en-US')}
          {s.pack ? ' + ' + packName(sport, s.pack) : ''}
        </small>
      </span>
      {s.claimed ? (
        <i className="ut-set-state">DONE</i>
      ) : ready ? (
        <button className="btn gold ut-set-claim" onClick={onClaim}>
          CLAIM
        </button>
      ) : (
        <i className="ut-set-state num">
          {s.have}/{s.need}
        </i>
      )}
    </div>
  );
}

export function SetsView(props: { pool: Pool; ut: UtState; onClaim: (id: string) => void; onSbc: () => void }) {
  const [tab, setTab] = useState<SetKind | 'landmarks'>('program');
  const [all, setAll] = useState(false);
  const sets = useMemo(() => setsFor(props.pool, props.ut), [props.pool, props.ut.collected, props.ut.owned, props.ut.content?.claims]);
  const landmarks = useMemo(() => (tab === 'landmarks' ? landmarkCards(props.pool) : []), [tab, props.pool]);
  const owned = new Set([...(props.ut.collected ?? []), ...props.ut.owned.map((c) => c.cardId)]);
  const list = sets
    .filter((s) => s.kind === tab)
    .sort((a, b) => Number(a.claimed) - Number(b.claimed) || Number(b.have >= b.need) - Number(a.have >= a.need) || b.have / b.need - a.have / a.need);
  const ready = sets.filter((s) => !s.claimed && s.have >= s.need).length;
  return (
    <div className="page ut-sets">
      <p className="lead">Discover cards to complete sets. Every set pays once, and selling a card never undoes your progress.{ready ? ' ' + ready + ' ready to claim.' : ''}</p>
      <div className="ut-seg" role="group" aria-label="Set type">
        {KIND.map(([k, label]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => (setTab(k), setAll(false))}>
            {label}
            {k !== 'landmarks' && sets.some((s) => s.kind === k && !s.claimed && s.have >= s.need) && <i className="ut-seg-dot" />}
          </button>
        ))}
      </div>
      {tab === 'landmarks' ? (
        <>
          <p className="note">Landmark Seasons are real statistical landmarks from the record books: +5 overall (top 99), the landmark skill +6. Three Landmark SBCs each week.</p>
          <button className="btn primary" onClick={props.onSbc}>
            THIS WEEK’S LANDMARK SBCS
          </button>
          <div className="ut-lm-grid">
            {landmarks.slice(0, all ? 400 : 24).map((rc) => (
              <span key={rc.line.id} className={'ut-lm-cell' + (owned.has(rc.line.id) ? ' have' : '')}>
                <UtCard rc={rc} w={74} />
              </span>
            ))}
          </div>
          {!all && landmarks.length > 24 && (
            <button className="btn" onClick={() => setAll(true)}>
              SHOW ALL {landmarks.length}
            </button>
          )}
        </>
      ) : (
        <>
          {list.slice(0, all ? list.length : 30).map((s) => (
            <SetRow key={s.id} s={s} sport={props.pool.sport} onClaim={() => props.onClaim(s.id)} />
          ))}
          {!all && list.length > 30 && (
            <button className="btn" onClick={() => setAll(true)}>
              SHOW ALL {list.length}
            </button>
          )}
        </>
      )}
    </div>
  );
}
