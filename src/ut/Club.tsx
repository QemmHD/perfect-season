// The club: every card you own. Filter by position, tier, team and decade; sort by overall, newest,
// position or any rating (speed, three-point shot, dunk...); tap one for its details (and to
// quick-sell it).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SPORT } from '../engine/sport';
import { Confirm } from '../ui/common';
import { UtCard } from './CardArt';
import { quickSellValue } from './packs';
import { NFL_KEYS } from '../game/football2/ratings';
import { byValue, decadeOf } from './pool';
import { attrName, NBA_ATTRS } from './rate';
import { POSITIONS } from './squad';
import type { ClubCard } from './UltimateTeam';

/** Overall, newest, position, or a rating's code ('SPD', '3PT', ...). */
type Sort = string;

/** The ratings to sort by, speed first. */
const SORT_ATTRS: string[] =
  SPORT === 'nba' ? NBA_ATTRS.map(([c]) => c) : Array.from(new Set(['SPD', 'ACC', ...Object.values(NFL_KEYS).flatMap((ks) => ks.map(([c]) => c))]));
type TierF = 'all' | 'bronze' | 'silver' | 'gold' | 'special' | 'spotlight' | 'goat';

/** Cards put on the page at a time: more come as you scroll down to them. */
const PAGE = 48;

/** The filters stay as they were for the rest of the visit. */
let saved: { pos: string; tier: TierF; team: string; dec: string; sort: Sort } = { pos: 'all', tier: 'all', team: 'all', dec: 'all', sort: 'ovr' };

export function Club({ club, storage = false, onInspect, onSell }: { club: ClubCard[]; storage?: boolean; onInspect: (uid: string) => void; onSell: (uids: string[]) => void }) {
  const [f, setF] = useState(saved);
  const set = (k: Partial<typeof f>) => {
    const next = { ...f, ...k };
    saved = next;
    setF(next);
  };
  const [sellDupes, setSellDupes] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const moreRef = useRef<HTMLDivElement>(null);
  const teams = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of club) m.set(c.rc.line.fr, c.rc.line.teamName);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [club]);
  const decades = useMemo(() => Array.from(new Set(club.map((c) => decadeOf(c.rc.line.season)))).sort(), [club]);
  const posOrder = POSITIONS[SPORT];
  const list = useMemo(() => {
    const out = club.filter(
      (c) =>
        (f.pos === 'all' || c.rc.line.pos.includes(f.pos)) &&
        (f.tier === 'all' || (f.tier === 'special' ? ['promo','spotlight','legend','goat'].includes(c.rc.tier) : c.rc.tier === f.tier)) &&
        (f.team === 'all' || c.rc.line.fr === f.team) &&
        (f.dec === 'all' || decadeOf(c.rc.line.season) === f.dec)
    );
    if (f.sort === 'new') out.sort((a, b) => b.oc.at - a.oc.at);
    else if (f.sort === 'pos') out.sort((a, b) => posOrder.indexOf(a.rc.line.pos[0]) - posOrder.indexOf(b.rc.line.pos[0]) || byValue(a.rc, b.rc));
    else if (f.sort === 'ovr' || !SORT_ATTRS.includes(f.sort)) out.sort((a, b) => byValue(a.rc, b.rc) || b.oc.at - a.oc.at);
    // a rating, best first (cards without it, like a lineman's throw power, go last)
    else out.sort((a, b) => (b.rc.attrs[f.sort] ?? -1) - (a.rc.attrs[f.sort] ?? -1) || byValue(a.rc, b.rc));
    return out;
  }, [club, f]);
  const dupes = storage ? club : [];
  const dupeCoins = dupes.reduce((a, c) => a + quickSellValue(c.rc), 0);
  // a new filter or sort starts from the top; nearing the end of what's shown brings the next page
  useEffect(() => setShown(PAGE), [f]);
  useEffect(() => {
    const el = moreRef.current;
    if (!el || shown >= list.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setShown((n) => n + PAGE), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, list.length]);
  const byAttr = SORT_ATTRS.includes(f.sort);
  const filtered = f.pos !== 'all' || f.tier !== 'all' || f.team !== 'all' || f.dec !== 'all';

  return (
    <div className="page ut-club">
      {storage && <div className="ut-storage-intro">
        <span className="eyebrow">ROOM FOR EVERY PULL</span>
        <h2 className="disp">Duplicate Storage</h2>
        <p>Extra copies go here automatically. Use them in SBCs, quick-sell them, or swap a copy into your club.</p>
        <small>Every copy keeps its own level and XP. Different seasons and editions stay in your club.</small>
      </div>}
      <div className="ut-filters">
        <div className="ut-chips" role="group" aria-label="Position">
          {['all', ...posOrder].map((p) => (
            <button key={p} className={'chip' + (f.pos === p ? ' on' : '')} aria-pressed={f.pos === p} onClick={() => set({ pos: p })}>
              {p === 'all' ? 'ALL' : p}
            </button>
          ))}
        </div>
        <div className="ut-chips" role="group" aria-label="Tier">
          {(['all', 'bronze', 'silver', 'gold', 'special', 'spotlight', 'goat'] as TierF[]).map((t) => (
            <button key={t} className={'chip ut-tf tf-' + t + (f.tier === t ? ' on' : '')} aria-pressed={f.tier === t} onClick={() => set({ tier: t })}>
              {t === 'all' ? 'ANY TIER' : t === 'special' ? 'SPECIAL' : t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="ut-selects">
          <label className="ut-select">
            <span className="eyebrow">Team</span>
            <select value={f.team} onChange={(e) => set({ team: e.target.value })}>
              <option value="all">All teams</option>
              {teams.map(([fr, name]) => (
                <option key={fr} value={fr}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="ut-select">
            <span className="eyebrow">Decade</span>
            <select value={f.dec} onChange={(e) => set({ dec: e.target.value })}>
              <option value="all">All</option>
              {decades.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="ut-select">
            <span className="eyebrow">Sort</span>
            <select value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
              <option value="ovr">Overall</option>
              <option value="new">Newest</option>
              <option value="pos">Position</option>
              <optgroup label="Ratings">
                {SORT_ATTRS.map((c) => (
                  <option key={c} value={c}>
                    {attrName(c)}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        </div>
      </div>
      <div className="ut-club-head">
        <span className="eyebrow">
          {list.length} {list.length === 1 ? 'card' : 'cards'}
          {filtered ? ' of ' + club.length : ''}
        </span>
        {filtered && (
          <button className="ut-link" onClick={() => set({ pos: 'all', tier: 'all', team: 'all', dec: 'all' })}>
            CLEAR FILTERS
          </button>
        )}
        {!filtered && dupes.length > 0 && (
          <button className="ut-link" onClick={() => setSellDupes(true)}>
            SELL {dupes.length} SPARE {dupes.length === 1 ? 'COPY' : 'COPIES'}
          </button>
        )}
      </div>
      {list.length ? (
        <div className="ut-grid">
          {list.slice(0, typeof IntersectionObserver === 'undefined' ? list.length : shown).map((c) => (
            <button key={c.uid} className="ut-gridcard" onClick={() => onInspect(c.uid)} aria-label={c.rc.line.name + ', ' + c.rc.ovr + (c.slot ? ', in your squad at ' + c.slot : '')}>
              <UtCard rc={c.rc} w={80} level={c.oc.level} />
              {byAttr && c.rc.attrs[f.sort] !== undefined && (
                <i className="ut-attrtag num">
                  {f.sort} {c.rc.attrs[f.sort]}
                </i>
              )}
              {c.slot && <i className="ut-insquad">{c.slot}</i>}
            </button>
          ))}
          {shown < list.length && <div ref={moreRef} className="ut-more" aria-hidden="true" />}
        </div>
      ) : (
        <div className="empty">{club.length ? 'No cards match these filters.' : storage ? 'All clear. Your next duplicate will be stored here automatically.' : 'No cards yet. Open your starter pack in the Store.'}</div>
      )}
      {sellDupes && (
        <Confirm
          title="Sell all stored copies?"
          body={'Quick-sell ' + dupes.length + ' spare ' + (dupes.length === 1 ? 'copy' : 'copies') + ' (your club copies stay safe) for ' + dupeCoins.toLocaleString('en-US') + ' coins. This can’t be undone.'}
          yes={'SELL · ' + dupeCoins.toLocaleString('en-US')}
          no="KEEP"
          tone="gold"
          onYes={() => {
            setSellDupes(false);
            onSell(dupes.map((d) => d.uid));
          }}
          onNo={() => setSellDupes(false)}
        />
      )}
    </div>
  );
}

