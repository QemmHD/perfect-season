// Favorite teams: a grid of team chips in each team's colors, one NBA and one NFL pick. Asked at
// first launch (Welcome), once on the home screen for players who don't have them yet, and
// changeable from Profile. Your players wear your team's colors in head to head.
import React, { useState } from 'react';
import { type TeamInfo, teamOf, teamsOf } from '../data/teams';
import { SPORT, type SportId } from '../engine/sport';
import { type Favorites, markFavoritesAsked, saveFavorites, useFavorites } from '../lib/favorites';
import { sfx, vibrate } from '../lib/sound';
import { hex, onColor, rgb } from '../game/pixel/color';
import { Sheet } from './common';
import { Football, Hoop } from './icons';
import './favorites.css';

const SPORT_NAME: Record<SportId, string> = { nba: 'NBA', nfl: 'NFL' };

/** "Golden State Warriors" → "Warriors", "Portland Trail Blazers" → "Blazers" */
export function nickname(t: TeamInfo): string {
  return t.name.split(' ').pop() ?? t.abbr;
}

/** Team colors for a chip: the team's color, with letters in a color that reads on it. */
function chipStyle(t: TeamInfo): React.CSSProperties {
  const ink = hex(onColor(rgb(t.c1), [rgb(t.c2), [255, 255, 255]]));
  return { '--c1': t.c1, '--c2': t.c2, '--ink': ink } as React.CSSProperties;
}

/** One team as a small badge, or an empty slot. */
export function TeamBadge({ sport, abbr }: { sport: SportId; abbr: string | null }) {
  const t = teamOf(sport, abbr);
  return (
    <span className={'fav-badge' + (t ? '' : ' unset')} style={t ? chipStyle(t) : undefined}>
      <b>{t ? t.abbr : '?'}</b>
    </span>
  );
}

export function TeamGrid({ sport, value, onPick }: { sport: SportId; value: string | null; onPick: (abbr: string) => void }) {
  return (
    <div className="fav-grid" role="radiogroup" aria-label={'Favorite ' + SPORT_NAME[sport] + ' team'} key={sport}>
      {teamsOf(sport).map((t, i) => {
        const on = value === t.abbr;
        return (
          <button type="button" key={t.abbr} role="radio" aria-checked={on} aria-label={t.name} className={'fav-chip' + (on ? ' on' : '')} style={{ ...chipStyle(t), animationDelay: Math.min(i, 30) * 12 + 'ms' }} onClick={() => onPick(t.abbr)}>
            <b>{t.abbr}</b>
            <small>{nickname(t)}</small>
          </button>
        );
      })}
    </div>
  );
}

/** Both picks: a tab per sport, the grid, and the pick's full name. Picking one moves on to the other sport if it's still open. */
export function FavPicker({ value, onChange }: { value: Favorites; onChange: (f: Favorites) => void }) {
  const other: SportId = SPORT === 'nba' ? 'nfl' : 'nba';
  const [tab, setTab] = useState<SportId>(() => (value[SPORT] || !value[other] ? SPORT : other));
  const pick = (abbr: string) => {
    sfx.select();
    vibrate(8);
    const next = { ...value, [tab]: abbr };
    onChange(next);
    const rest: SportId = tab === 'nba' ? 'nfl' : 'nba';
    if (!next[rest]) window.setTimeout(() => setTab(rest), 380);
  };
  const cur = teamOf(tab, value[tab]);
  return (
    <div className="favpick">
      <div className="fav-tabs" role="tablist" aria-label="Sport">
        {(['nba', 'nfl'] as SportId[]).map((s) => (
          <button type="button" key={s} role="tab" aria-selected={tab === s} className={tab === s ? 'on' : ''} onClick={() => (sfx.click(), setTab(s))}>
            {s === 'nba' ? <Hoop size={15} /> : <Football size={15} />}
            <span>{SPORT_NAME[s]}</span>
            <TeamBadge sport={s} abbr={value[s]} />
          </button>
        ))}
      </div>
      <TeamGrid sport={tab} value={value[tab]} onPick={pick} />
      <p className={'fav-name' + (cur ? ' on' : '')} style={cur ? chipStyle(cur) : undefined} key={tab + (cur?.abbr ?? '')}>
        {cur ? cur.name : 'Tap your ' + SPORT_NAME[tab] + ' team'}
      </p>
    </div>
  );
}

/** The sheet: on the home screen (asked once) and from Profile. */
export function FavSheet({ onClose, first = false }: { onClose: () => void; first?: boolean }) {
  const saved = useFavorites();
  const [f, setF] = useState<Favorites>(saved);
  const any = !!(f.nba || f.nfl);
  return (
    <Sheet
      label="Favorite teams"
      onClose={() => {
        markFavoritesAsked();
        onClose();
      }}
    >
      {(close) => (
        <>
          <span className="eyebrow">{first ? 'New: favorite teams' : 'Favorite teams'}</span>
          <h2 className="disp">Your teams</h2>
          <p>Your players wear your team’s colors in head to head, and rivals visit your home court.</p>
          <FavPicker value={f} onChange={setF} />
          <div className="btnrow">
            <button className="btn" onClick={() => close()}>
              {first ? 'NOT NOW' : 'CANCEL'}
            </button>
            <button
              className="btn primary"
              aria-disabled={!any}
              onClick={() => {
                if (!any) return;
                saveFavorites(f);
                sfx.coin();
                close();
              }}
            >
              SAVE
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Profile: your two teams, tap to change. */
export function FavoritesCard({ onEdit }: { onEdit: () => void }) {
  const f = useFavorites();
  const names = (['nba', 'nfl'] as SportId[]).map((s) => teamOf(s, f[s]));
  return (
    <button className="fav-card rise-in" onClick={onEdit} aria-label={'Favorite teams: ' + names.map((t) => t?.name ?? 'none').join(' and ') + '. Change'}>
      <span className="fav-pair" aria-hidden="true">
        <TeamBadge sport="nba" abbr={f.nba} />
        <TeamBadge sport="nfl" abbr={f.nfl} />
      </span>
      <span className="txt">
        <b className="disp">FAVORITE TEAMS</b>
        <small>{names.every((t) => !t) ? 'Pick your NBA and NFL teams' : names.map((t, i) => (t ? nickname(t) : 'no ' + (i ? 'NFL' : 'NBA') + ' team')).join(' · ')}</small>
      </span>
      <span className="chip">CHANGE</span>
    </button>
  );
}
