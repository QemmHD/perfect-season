// The club: every card you own. Filter by position, tier, team and decade; sort by overall, newest
// or position; tap one for its details (and to quick-sell it).
import React, { useMemo, useState } from 'react';
import { SPORT } from '../engine/sport';
import { Confirm } from '../ui/common';
import { UtCard } from './CardArt';
import { quickSellValue } from './packs';
import { byValue, decadeOf } from './pool';
import { POSITIONS } from './squad';
import type { ClubCard } from './UltimateTeam';

type Sort = 'ovr' | 'new' | 'pos';
type TierF = 'all' | 'bronze' | 'silver' | 'gold' | 'special';

/** The filters stay as they were for the rest of the visit. */
let saved: { pos: string; tier: TierF; team: string; dec: string; sort: Sort } = { pos: 'all', tier: 'all', team: 'all', dec: 'all', sort: 'ovr' };

export function Club({ club, onInspect, onSell }: { club: ClubCard[]; onInspect: (uid: string) => void; onSell: (uids: string[]) => void }) {
  const [f, setF] = useState(saved);
  const set = (k: Partial<typeof f>) => {
    const next = { ...f, ...k };
    saved = next;
    setF(next);
  };
  const [sellDupes, setSellDupes] = useState(false);
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
        (f.tier === 'all' || (f.tier === 'special' ? c.rc.tier === 'promo' || c.rc.tier === 'legend' : c.rc.tier === f.tier)) &&
        (f.team === 'all' || c.rc.line.fr === f.team) &&
        (f.dec === 'all' || decadeOf(c.rc.line.season) === f.dec)
    );
    if (f.sort === 'new') out.sort((a, b) => b.oc.at - a.oc.at);
    else if (f.sort === 'pos') out.sort((a, b) => posOrder.indexOf(a.rc.line.pos[0]) - posOrder.indexOf(b.rc.line.pos[0]) || byValue(a.rc, b.rc));
    else out.sort((a, b) => byValue(a.rc, b.rc) || b.oc.at - a.oc.at);
    return out;
  }, [club, f]);
  // spare copies: a second card of the same player-season, not in the squad (the better level stays)
  const dupes = useMemo(() => {
    const best = new Map<string, ClubCard>();
    const spare: ClubCard[] = [];
    for (const c of club.slice().sort((a, b) => (b.slot ? 1 : 0) - (a.slot ? 1 : 0) || b.oc.level - a.oc.level || b.oc.xp - a.oc.xp)) {
      if (!best.has(c.oc.cardId)) best.set(c.oc.cardId, c);
      else if (!c.slot) spare.push(c);
    }
    return spare;
  }, [club]);
  const dupeCoins = dupes.reduce((a, c) => a + quickSellValue(c.rc), 0);
  const filtered = f.pos !== 'all' || f.tier !== 'all' || f.team !== 'all' || f.dec !== 'all';

  return (
    <div className="page ut-club">
      <div className="ut-filters">
        <div className="ut-chips" role="group" aria-label="Position">
          {['all', ...posOrder].map((p) => (
            <button key={p} className={'chip' + (f.pos === p ? ' on' : '')} aria-pressed={f.pos === p} onClick={() => set({ pos: p })}>
              {p === 'all' ? 'ALL' : p}
            </button>
          ))}
        </div>
        <div className="ut-chips" role="group" aria-label="Tier">
          {(['all', 'bronze', 'silver', 'gold', 'special'] as TierF[]).map((t) => (
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
          <span className="seg ut-sort" role="group" aria-label="Sort">
            {(['ovr', 'new', 'pos'] as Sort[]).map((s) => (
              <button key={s} className={f.sort === s ? 'on' : ''} aria-pressed={f.sort === s} onClick={() => set({ sort: s })}>
                {s === 'ovr' ? 'OVR' : s === 'new' ? 'NEW' : 'POS'}
              </button>
            ))}
          </span>
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
          {list.map((c) => (
            <button key={c.uid} className="ut-gridcard" onClick={() => onInspect(c.uid)} aria-label={c.rc.line.name + ', ' + c.rc.ovr + (c.slot ? ', in your squad at ' + c.slot : '')}>
              <UtCard rc={c.rc} w={80} level={c.oc.level} />
              {c.slot && <i className="ut-insquad">{c.slot}</i>}
            </button>
          ))}
        </div>
      ) : (
        <div className="empty">{club.length ? 'No cards match these filters.' : 'No cards yet. Open your starter pack in the Store.'}</div>
      )}
      {sellDupes && (
        <Confirm
          title="Sell spare copies?"
          body={'Quick-sell ' + dupes.length + ' spare ' + (dupes.length === 1 ? 'copy' : 'copies') + ' (the same player and season as a card you keep) for ' + dupeCoins.toLocaleString('en-US') + ' coins.'}
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

