// Implemented by Codex. See docs/CODEX-UPDATE-LOG.md for ownership, connections and validation.
import React, { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../ui/common';
import { UtCard } from './CardArt';
import { collectionRewards } from './collection';
import { cardCounts } from './registry';
import { packName } from './packs';
import { byValue, type Pool, seasonText } from './pool';
import { TIER_NAMES, TIER_ORDER } from './rate';
import type { UtState } from './state';
import type { RatedCard, Tier } from './types';

export function CollectionGallery({ pool, ut, onClaim }: { pool: Pool; ut: UtState; onClaim: (id: string) => void }) {
  const [tier, setTier] = useState<Tier | 'all'>('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rewards, setRewards] = useState(false);
  const [detail, setDetail] = useState<RatedCard | null>(null);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!detail || !['goat', 'spotlight'].includes(detail.tier)) return;
    let live = true;
    void cardCounts(pool.sport)
      .then((counts) => {
        if (live) setTotals(counts);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [detail?.line.id, pool.sport]);
  const owned = useMemo(() => new Set(ut.owned.map((c) => c.cardId)), [ut.owned]);
  const seen = useMemo(() => new Set([...(ut.collected ?? []), ...owned]), [ut.collected, owned]);
  const all = useMemo(() => [...pool.base.values()].sort(byValue), [pool]);
  const list = useMemo(
    () =>
      all.filter(
        (rc) =>
          (tier === 'all' || rc.tier === tier) &&
          (status === 'all' || (status === 'owned' ? owned.has(rc.line.id) : !owned.has(rc.line.id))) &&
          (!query.trim() || `${rc.line.name} ${rc.line.teamName} ${rc.line.season}`.toLowerCase().includes(query.trim().toLowerCase()))
      ),
    [all, tier, status, query, owned]
  );
  const validSeen = all.filter((rc) => seen.has(rc.line.id)).length;
  const goals = collectionRewards(pool, ut);
  const ready = goals.filter((g) => g.have >= g.need && !ut.collectionClaims?.includes(g.id)).length;
  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };
  return (
    <div className="page ut-gallery">
      <div className="ut-content-hero">
        <span className="eyebrow">THE COLLECTION BOOK</span>
        <h1 className="disp">Build your legacy.</h1>
        <p>Every era. Every edition. Find the missing pieces.</p>
        <div className="ut-book-progress">
          <b className="num">
            {validSeen.toLocaleString()}
            <small> / {all.length.toLocaleString()}</small>
          </b>
          <span>EDITIONS DISCOVERED</span>
          <i>
            <em style={{ width: Math.max(0.5, (100 * validSeen) / all.length) + '%' }} />
          </i>
        </div>
        <button className="btn gold" onClick={() => setRewards(true)}>
          COLLECTION REWARDS{ready ? ` · ${ready} READY` : ''}
        </button>
      </div>
      <label className="ut-gallery-search">
        <span className="eyebrow">Find a player, team or season</span>
        <input type="search" value={query} placeholder="Jordan, Bulls, 1996…" onChange={(e) => reset(() => setQuery(e.target.value))} />
      </label>
      <div className="ut-chips" aria-label="Gallery tier">
        {['all', ...TIER_ORDER.slice().reverse()].map((t) => (
          <button key={t} className={'chip' + (tier === t ? ' on' : '')} aria-pressed={tier === t} onClick={() => reset(() => setTier(t as Tier | 'all'))}>
            {t === 'all' ? 'ALL EDITIONS' : TIER_NAMES[t as Tier].toUpperCase()}
          </button>
        ))}
      </div>
      <div className="ut-chips" aria-label="Gallery ownership">
        {[
          ['all', 'ALL'],
          ['owned', 'OWNED'],
          ['missing', 'MISSING'],
        ].map(([id, label]) => (
          <button key={id} className={'chip' + (status === id ? ' on' : '')} aria-pressed={status === id} onClick={() => reset(() => setStatus(id))}>
            {label}
          </button>
        ))}
      </div>
      <span className="eyebrow">
        {list.length.toLocaleString()} editions · {owned.size.toLocaleString()} currently owned
      </span>
      <div className="ut-grid">
        {list.slice(page * 36, (page + 1) * 36).map((rc) => {
          const have = owned.has(rc.line.id),
            discovered = seen.has(rc.line.id);
          return (
            <button
              key={rc.line.id}
              className={'ut-gridcard ut-book-card' + (have ? ' owned' : ' missing')}
              onClick={() => setDetail(rc)}
              aria-label={`${rc.line.name}, ${rc.ovr} ${TIER_NAMES[rc.tier]}, ${have ? 'owned' : discovered ? 'previously collected' : 'missing'}`}
            >
              <UtCard rc={rc} w={80} mint={ut.owned.find(c=>c.cardId===rc.line.id&&c.mint)?.mint} numbered={have} />
              <small>{have ? 'OWNED' : discovered ? 'DISCOVERED' : 'MISSING'}</small>
            </button>
          );
        })}
      </div>
      {!list.length && <p className="empty">No editions match these filters.</p>}
      {list.length > 36 && (
        <div className="ut-gallery-pages">
          <button className="btn" disabled={!page} onClick={() => setPage((n) => n - 1)}>
            PREVIOUS
          </button>
          <span className="num">
            {page + 1} / {Math.ceil(list.length / 36)}
          </span>
          <button className="btn" disabled={(page + 1) * 36 >= list.length} onClick={() => setPage((n) => n + 1)}>
            NEXT
          </button>
        </div>
      )}
      <p className="note">
        Different seasons and special editions count separately. Discoveries and claimed rewards stay in your book after a sale or SBC. Stored duplicates also count as owned.
      </p>
      {rewards && (
        <Sheet label="Collection rewards" kind="bottom" onClose={() => setRewards(false)}>
          {(close) => (
            <div className="ut-book-rewards">
              <span className="eyebrow">YOUR COLLECTION, REWARDED</span>
              <h2 className="disp">The milestones.</h2>
              <p className="note">Discover editions and collect five different players from a franchise. Cards stay yours when you claim.</p>
              {goals.map((g) => {
                const done = ut.collectionClaims?.includes(g.id),
                  can = g.have >= g.need && !done;
                return (
                  <div key={g.id} className={'ut-book-goal' + (can ? ' ready' : '')}>
                    <div>
                      <b>{g.title}</b>
                      <small>
                        {Math.min(g.have, g.need)} / {g.need} · {g.coins} coins{g.pack ? ' + ' + packName(pool.sport, g.pack) : ''}
                      </small>
                      <i>
                        <em style={{ width: Math.min(100, (g.have / g.need) * 100) + '%' }} />
                      </i>
                    </div>
                    <button className={'btn' + (can ? ' gold' : '')} disabled={!can} onClick={() => onClaim(g.id)}>
                      {done ? 'CLAIMED' : can ? 'CLAIM' : 'LOCKED'}
                    </button>
                  </div>
                );
              })}
              <button className="btn" onClick={() => close()}>
                CLOSE
              </button>
            </div>
          )}
        </Sheet>
      )}
      {detail && (
        <Sheet label={detail.line.name + ' edition'} kind="bottom" onClose={() => setDetail(null)}>
          {(close) => (
            <div className="ut-catalog-detail">
              <span className={'ut-tiername t-' + detail.tier}>{TIER_NAMES[detail.tier].toUpperCase()}</span>
              <UtCard rc={detail} w={190} mint={ut.owned.find(c=>c.cardId===detail.line.id&&c.mint)?.mint} numbered={owned.has(detail.line.id)} attrs tilt />
              <h2 className="disp">{detail.line.name}</h2>
              <p>
                {seasonText(detail.line)} · {detail.line.teamName}
              </p>
              {['goat', 'spotlight'].includes(detail.tier) && (
                <p className="ut-gallery-count num">
                  {totals === null ? 'Worldwide count requires a connection' : (totals[detail.line.id] ?? 0).toLocaleString() + ' copies in circulation'}
                </p>
              )}
              <p className="note">
                {owned.has(detail.line.id)
                  ? 'You own this edition. Open it in Club or Duplicate Storage to see your copy’s level and serial.'
                  : detail.tier === 'goat'
                    ? 'GOAT editions have a 0.05% chance per Spotlight Pack.'
                    : detail.tier === 'spotlight'
                      ? 'Find this 99+ edition in Spotlight Packs or earn a Spotlight Reward in Events.'
                      : 'Find this edition in packs and eligible squad-building rewards.'}
              </p>
              <button className="btn primary" onClick={() => close()}>
                CLOSE
              </button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
