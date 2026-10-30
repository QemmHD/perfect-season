// Ultimate Team's home: the free starter (until it's opened), your squad at a glance, play, and the
// way to the store, the club and the challenges.
import React from 'react';
import './pack-art.css';
import { Coin } from '../ui/icons';
import { UtCard } from './CardArt';
import { IconClub, IconSbc, IconStore } from './icons';
import { packName } from './packs';
import { byValue } from './pool';
import { rewardText, type Sbc } from './sbc';
import { type Lineup, type SquadRating, slotsFor } from './squad';
import type { UtState } from './state';
import type { UtSport } from './types';
import type { ClubCard, UtView } from './UltimateTeam';

/** A pack as a picture: foil, a tier's colors, the sport. */
export function PackArt({ kind, label, sport, small }: { kind: string; label: string; sport: UtSport; small?: boolean }) {
  const k = kind.startsWith('position') ? 'position' : kind;
  return (
    <span className={'ut-pack p-' + k + (small ? ' small' : '')} aria-hidden="true">
      <span className="ut-pack-crimp" />
      <span className="ut-pack-body">
        <i className="ut-pack-sport">{sport === 'nfl' ? 'NFL' : 'NBA'}</i>
        <b className="disp">UT</b>
        <i className="ut-pack-label">{label}</i>
      </span>
      <span className="ut-pack-crimp bottom" />
      <span className="ut-pack-foil" />
    </span>
  );
}

export function Hub(props: {
  rivals?: React.ReactNode;
  sport: UtSport;
  club: ClubCard[];
  lineup: Lineup;
  rating: SquadRating;
  ut: UtState;
  sbcTodo: number;
  sbcs: Sbc[];
  onGo: (v: UtView) => void;
  onStarter: () => void;
  onInspect: (uid: string) => void;
  onPlay: (mode: 'ai' | 'online') => void;
}) {
  const { ut, rating, lineup } = props;
  // the squad's best five, fanned out
  const starters = slotsFor(props.sport)
    .filter((s) => s.weight > 0)
    .map((s) => lineup[s.id])
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort(byValue)
    .slice(0, 5);
  const best = props.club.slice().sort((a, b) => byValue(a.rc, b.rc))[0];
  const fan = starters.length ? starters : best ? [best.rc] : [];
  const size = slotsFor(props.sport).length;
  return (
    <div className="page ut-hub">
      {!ut.starterClaimed && (
        <button className="ut-starter rise-in" onClick={props.onStarter}>
          <PackArt kind="starter" label="STARTER" sport={props.sport} small />
          <span className="ut-starter-txt">
            <span className="eyebrow">Free · once</span>
            <b className="disp">Open your starter pack</b>
            <small>A card for every spot in your squad, and one gold to start.</small>
          </span>
        </button>
      )}

      <button
        className="ut-squadcard"
        onClick={() => props.onGo('squad')}
        aria-label={'Your squad: ' + rating.ovr + ' overall, ' + rating.chem + ' chemistry, ' + rating.filled + ' of ' + size + ' spots filled'}
      >
        <span className="ut-sq-stats">
          <span className="eyebrow">Your squad</span>
          <span className="ut-sq-nums">
            <span>
              <b className="disp num">{rating.filled ? rating.ovr : '—'}</b>
              <i>OVR</i>
            </span>
            <span>
              <b className="disp num">{rating.filled ? rating.chem : '—'}</b>
              <i>CHEM</i>
            </span>
          </span>
          <small>{rating.complete ? 'Full squad' : rating.filled + ' of ' + size + ' spots filled'}</small>
        </span>
        <span className={'ut-fan n' + fan.length} aria-hidden="true">
          {fan.map((rc, i) => (
            <span key={rc.line.id} className="ut-fan-card" style={{ '--i': i - (fan.length - 1) / 2 } as React.CSSProperties}>
              <UtCard rc={rc} w={64} />
            </span>
          ))}
          {!fan.length && <span className="ut-fan-empty">No cards yet</span>}
        </span>
      </button>

      {props.rivals}
      <div className="ut-play">
        <button className="big shine" onClick={() => props.onPlay('ai')}>
          <span>Squad Battles</span>
        </button>
        <button className="big ghost small" onClick={() => props.onPlay('online')}>
          <span>Head to Head</span>
        </button>
      </div>

      <button className="ut-content-launch" onClick={() => props.onGo('events')}>
        <span className="eyebrow">SPOTLIGHT SERIES · NEW</span>
        <b className="disp">Take on the greats.</b>
        <small>Three themed series. Earn a guaranteed 99+ Spotlight reward.</small>
        <span className="ut-launch-action">
          EXPLORE EVENTS{' '}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
        </span>
      </button>
      <button className="ut-book-launch" onClick={() => props.onGo('gallery')}>
        <IconClub size={24} />
        <span>
          <b>Collection Gallery</b>
          <small>Track every edition and claim collection rewards.</small>
        </span>
        <b className="num">{new Set([...(ut.collected ?? []), ...ut.owned.map((c) => c.cardId)]).size}</b>
      </button>
      <div className="ut-tiles">
        <button className="ut-tile" onClick={() => props.onGo('store')}>
          <IconStore size={24} />
          <b>Store</b>
          <small>{ut.packs.length ? ut.packs.length + (ut.packs.length === 1 ? ' pack' : ' packs') + ' to open' : 'Packs from 150'}</small>
          {ut.packs.length > 0 && <i className="ut-dot num">{ut.packs.length}</i>}
        </button>
        <button className="ut-tile" onClick={() => props.onGo('sbc')}>
          <IconSbc size={24} />
          <b>Challenges</b>
          <small>{props.sbcTodo ? props.sbcTodo + ' to do' : 'All done'}</small>
          {props.sbcTodo > 0 && <i className="ut-dot num">{props.sbcTodo}</i>}
        </button>
        <button className="ut-tile" onClick={() => props.onGo('club')}>
          <IconClub size={24} />
          <b>Club</b>
          <small>{props.club.length} cards</small>
        </button>
      </div>

      {props.sbcs.length > 0 && (
        <div className="ut-hub-sec">
          <span className="eyebrow">Today’s challenges</span>
          {props.sbcs
            .filter((s) => s.kind === 'daily')
            // the ones still to do first, three of them
            .sort((a, b) => Number(!!ut.sbc.done[a.id]) - Number(!!ut.sbc.done[b.id]))
            .slice(0, 3)
            .map((s) => (
              <button key={s.id} className={'ut-hub-sbc' + (ut.sbc.done[s.id] ? ' done' : '')} onClick={() => props.onGo('sbc')}>
                <b>{s.title}</b>
                <small>{ut.sbc.done[s.id] ? 'Done' : rewardText(s.reward, props.sport, packName)}</small>
              </button>
            ))}
        </div>
      )}

      {props.club.length > 0 && (
        <div className="ut-hub-sec">
          <span className="eyebrow">Best in your club</span>
          <div className="ut-hub-best">
            {props.club
              .slice()
              .sort((a, b) => byValue(a.rc, b.rc))
              .slice(0, 8)
              .map((c) => (
                <button key={c.uid} className="ut-gridcard small" onClick={() => props.onInspect(c.uid)} aria-label={c.rc.line.name + ', ' + c.rc.ovr}>
                  <UtCard rc={c.rc} w={66} level={c.oc.level} mint={c.oc.mint} numbered />
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="ut-statline">
        <span>
          <b className="num">{ut.packsOpened}</b> packs opened
        </span>
        <span>
          <Coin size={13} /> <b className="num">{ut.sold.coins.toLocaleString('en-US')}</b> from quick-sells
        </span>
      </div>
    </div>
  );
}
