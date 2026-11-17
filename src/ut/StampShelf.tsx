// Claude (packs-6, 2026-11-17): the stamp shelf page (UT view `stamps`, packs-plan §5 packs-6 item 1).
// Loaded lazily from UltimateTeam. The balance and the next pick in reach, the four rungs with their own
// progress and odds, and where stamps come from. Redeeming spends the stamps exactly once
// (stamp-shelf.ts redeemStamps) and opens the pick sheet; nothing here is ever sold for coins.
import React, { useEffect, useMemo, useState } from 'react';
import { pickFor } from '../engine/sport';
import { fcToDisplay } from './fc-scale';
import { useOddsHost, useOddsPreload } from './odds-lazy';
import { PackArt } from './PackArt';
import type { Pool } from './pool';
import { COINS_PER_STAMP, DUPLICATE_SPECIAL_STAMPS, type ShelfItem, STAMP_GRANT, STAMP_SHELF, stampsBalance, stampsToNext } from './scout-stamps';
import { SHELF_FLOOR, shelfLabel, shelfStatus } from './stamp-shelf';
import { StampIcon } from './Store';
import './stamp-shelf.css';
import type { UtState } from './state';
import type { UtSport } from './types';
import { SectionHead } from './ui';

/** What each rung hands out, in words, for this sport. */
function blurb(item: ShelfItem, sport: UtSport): string {
  if (item === 'g82' || item === 'scout85') return 'Three golds ' + fcToDisplay(SHELF_FLOOR[sport][item], sport) + '+ face down, any position. Keep one.';
  if (item === 'standouts') return 'Three of this week’s ' + pickFor(sport, { nba: 'Weekly', nfl: 'Weekly', soccer: 'Matchday' }) + ' Standouts. Keep one.';
  return 'Three released cards of the program live now. Keep one.';
}

const ART: Record<ShelfItem, { kind: string; label: string }> = {
  g82: { kind: 'gold', label: 'PICK 1 OF 3' },
  scout85: { kind: 'premium', label: 'STAMP SCOUT' },
  standouts: { kind: 'standout', label: 'STANDOUT' },
  program: { kind: 'live-pick', label: 'PROGRAM' },
};

/** The ring around the balance: progress toward the next rung (full when every rung is in reach). */
function Ring({ have, need }: { have: number; need: number | null }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const p = need === null ? 1 : Math.max(0, Math.min(1, have / need));
  return (
    <span className="ps-stamps-ring" aria-hidden="true">
      <svg viewBox="0 0 100 100" width="104" height="104">
        <defs>
          <linearGradient id="psStampRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffe58c" />
            <stop offset="0.55" stopColor="#f6b93b" />
            <stop offset="1" stopColor="#c27c0e" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ffffff14" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#psStampRing)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90 50 50)" />
      </svg>
      <b className="disp num">{have.toLocaleString('en-US')}</b>
      <small>STAMPS</small>
    </span>
  );
}

export interface StampShelfProps {
  pool: Pool;
  ut: UtState;
  sport: UtSport;
  /** the Eastern day (the Standout week and the live program come from it) */
  day: string;
  /** spend the stamps on an item (the host redeems, saves and opens the pick sheet) */
  onRedeem: (item: ShelfItem) => void;
}

export default function StampShelf({ pool, ut, sport, day, onRedeem }: StampShelfProps) {
  const { open: setOdds, host } = useOddsHost(pool, sport);
  useOddsPreload();
  const have = stampsBalance(ut);
  const next = stampsToNext(ut);
  const nextItem = next ? STAMP_SHELF.find((s) => s.label === next.item) : undefined;
  const status = useMemo(() => Object.fromEntries(STAMP_SHELF.map((s) => [s.item, shelfStatus(pool, s.item, day)])) as Record<ShelfItem, { open: boolean; why?: string }>, [pool, day]);
  // a redemption asks once: the first tap arms the button for a few seconds, the second spends
  const [armed, setArmed] = useState<ShelfItem | null>(null);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  const ready = STAMP_SHELF.filter((s) => s.cost <= have && status[s.item].open).length;
  return (
    <div className="page ut-stamps">
      <section className="ps-stamps-hero" aria-label={'Scout Stamps: ' + have}>
        <Ring have={have} need={next ? next.have + next.need : null} />
        <span className="ps-stamps-hero-txt">
          <span className="eyebrow">SCOUT STAMPS · NEVER EXPIRE</span>
          {next && nextItem ? (
            <b className="disp">
              {next.need.toLocaleString('en-US')} to your {shelfLabel(nextItem.item, sport)}
            </b>
          ) : (
            <b className="disp">Every pick is in reach</b>
          )}
          <small>
            {ready ? ready + (ready === 1 ? ' pick is' : ' picks are') + ' ready below. ' : ''}
            Bad-luck protection: every pack you open moves you closer.
          </small>
        </span>
      </section>

      <SectionHead title="The shelf" />
      <div className="ps-shelf">
        {STAMP_SHELF.map((s) => {
          const st = status[s.item];
          const short = have < s.cost;
          const can = st.open && !short;
          const label = shelfLabel(s.item, sport);
          const floor = s.item === 'g82' || s.item === 'scout85' ? ' ' + fcToDisplay(SHELF_FLOOR[sport][s.item], sport) + '+' : '';
          return (
            <article key={s.item} className={'ps-shelf-tile i-' + s.item + (can ? ' ready' : '') + (st.open ? '' : ' closed')}>
              <PackArt kind={ART[s.item].kind} label={ART[s.item].label} sport={sport} small />
              <div className="ps-shelf-txt">
                <strong>
                  {label}
                  {floor}
                </strong>
                <small>{blurb(s.item, sport)}</small>
                <span className="ps-shelf-bar" role="progressbar" aria-label={label + ' progress'} aria-valuemin={0} aria-valuemax={s.cost} aria-valuenow={Math.min(have, s.cost)}>
                  <i style={{ width: Math.min(100, (100 * have) / s.cost) + '%' }} />
                </span>
                <span className="ps-shelf-meta">
                  <span className="ps-shelf-cost">
                    <StampIcon size={13} />
                    <b className="num">{s.cost}</b>
                  </span>
                  {st.open ? (
                    <button className="ps-odds-chip" onClick={() => setOdds({ type: 'pick', kind: 'shelf:' + s.item })} aria-label={label + floor + ' odds'}>
                      ODDS
                    </button>
                  ) : (
                    <em className="ps-shelf-why">{st.why}</em>
                  )}
                </span>
              </div>
              <button
                className={'btn ps-shelf-btn' + (can ? (armed === s.item ? ' armed' : ' gold') : ' short')}
                aria-disabled={!can}
                aria-label={can ? (armed === s.item ? 'Confirm: spend ' + s.cost + ' stamps on ' + label + floor : 'Redeem ' + label + floor + ' for ' + s.cost + ' stamps') : label + floor + ': ' + (st.open ? s.cost - have + ' more stamps needed' : st.why)}
                onClick={() => {
                  if (!can) return;
                  if (armed !== s.item) return setArmed(s.item);
                  setArmed(null);
                  onRedeem(s.item);
                }}
              >
                {!st.open ? 'LOCKED' : short ? (s.cost - have).toLocaleString('en-US') + ' MORE' : armed === s.item ? 'CONFIRM' : 'REDEEM'}
              </button>
            </article>
          );
        })}
      </div>

      <SectionHead title="Where stamps come from" />
      <ul className="ps-stamps-src">
        <li>
          <b>Packs</b>
          <span>1 stamp for every {COINS_PER_STAMP} coins a pack costs. A reward pack counts at its Store price; SBC packs, the Daily Drop and picks earn none.</span>
        </li>
        <li>
          <b>Minutes</b>
          <span>{STAMP_GRANT.minutes30} stamps when you reach 30 active minutes in a day.</span>
        </li>
        <li>
          <b>Scout Drops</b>
          <span>{STAMP_GRANT.drop} stamps on an Epic drop.</span>
        </li>
        <li>
          <b>Repeats</b>
          <span>+{DUPLICATE_SPECIAL_STAMPS} for each special edition you already had.</span>
        </li>
      </ul>
      <p className="note">Stamps are never sold for coins, and they stay with this sport’s club. A pick you redeem waits under Your packs until you choose.</p>
      {host}
    </div>
  );
}
