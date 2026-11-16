// Claude, 2026-11-16 (studio overhaul, team ut, task ut-3; Game Design V2 E.9.1, E.9.5, D.11): the
// MINUTES pieces of the main app's first-paint chunk. The Home chip (a ring toward the next rung in
// the stat strip, so Home gains no height) and the Profile playtime panel (today and this week,
// counted and raw; lifetime hours by sport; the badge tier). Light on purpose: no UT kit, no pool;
// the Minutes screen itself (MinutesView.tsx) loads lazily.
import React from 'react';
import { SOCCER_ON, type SportId } from '../engine/sport';
import { playtimeView } from '../lib/playtime';
import type { Profile } from '../lib/profile';
import { freshForMinutes, lifeBadge, minutesChip } from '../ut/minutes';
import './playtime-ui.css';

/** "27 min", "1 h 12 min", "3 h". */
export function minText(min: number): string {
  const h = Math.floor(min / 60),
    m = min % 60;
  return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min';
}

/** A 20 px ring with a clock (or a check when the day is done) inside. */
function MiniRing({ share, state }: { share: number; state: 'next' | 'ready' | 'done' }) {
  const r = 8.5,
    c = 2 * Math.PI * r;
  return (
    <svg className="mins-mini" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r={r} className="track" />
      <circle cx="11" cy="11" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, share)))} style={{ '--c': c } as React.CSSProperties} transform="rotate(-90 11 11)" />
      {state === 'done' ? <path d="M7.6 11.2l2.3 2.3 4.4-4.6" className="mark" /> : <path d="M11 7.4V11l2.4 1.6" className="mark" />}
    </svg>
  );
}

/**
 * The Minutes ring chip on main Home's stat strip (V2 E.9.1): "27/30" toward the next rung, READY with
 * a gold dot when a rung waits, DONE at 90. The whole line ("75 coins + stamp next") is its label;
 * the Minutes screen and UT Home's wider chip show it in full.
 */
export function HomeMinutesChip({ profile, onOpen, now = Date.now() }: { profile: Profile; onOpen: () => void; now?: number }) {
  const c = minutesChip(profile.playtime, now, freshForMinutes(profile));
  const text = c.state === 'done' ? 'DONE' : c.state === 'ready' ? 'READY' : c.minutes + '/' + c.target;
  const said = c.state === 'done' ? 'done for today. Great session' : c.minutes + ' of ' + c.target + ' minutes today. ' + c.reward;
  return (
    <button className="statchip mins-chip" data-state={c.state} onClick={onOpen} aria-label={'Minutes: ' + said + '. Open Minutes'}>
      <MiniRing share={c.state === 'next' ? c.minutes / c.target : 1} state={c.state} />
      <b className="num">{text}</b>
      {c.state === 'ready' && <i className="mins-dot" aria-hidden="true" />}
    </button>
  );
}

const SPORT_NAMES: Record<SportId, string> = { nba: 'NBA', nfl: 'NFL', soccer: 'Soccer' };

/**
 * Profile's playtime panel (V2 E.9.5): today and this week, counted and raw ("You've had the app open
 * 1 h 12 min today"), lifetime hours split by sport, the badge tier, and the way into Minutes.
 */
export function PlaytimePanel({ profile, onOpen, now = Date.now() }: { profile: Profile; onOpen?: () => void; now?: number }) {
  const v = playtimeView(profile, now),
    b = lifeBadge(profile.playtime),
    sports: SportId[] = SOCCER_ON ? ['nba', 'nfl', 'soccer'] : ['nba', 'nfl'];
  return (
    <section className="pt-panel rise-in" aria-labelledby="pt-panel-title">
      <div className="pt-head">
        <span className="eyebrow" id="pt-panel-title">
          Playtime
        </span>
        <span className={'pt-badge' + (b.badge ? '' : ' none')}>{b.badge ? b.badge.toUpperCase() : 'NO BADGE YET'}</span>
      </div>
      <div className="pt-grid">
        <div>
          <small>Today</small>
          <b className="disp num">{minText(v.today.min)}</b>
          <span>active · {v.today.frozen ? 'paused today' : 'up to 90'}</span>
        </div>
        <div>
          <small>This week</small>
          <b className="disp num">{minText(v.week.min)}</b>
          <span>active · open {minText(v.week.rawMin)}</span>
        </div>
        <div>
          <small>Lifetime</small>
          <b className="disp num">{v.life.hours} h</b>
          <span>{b.next ? b.hoursToNext + ' h to ' + b.next : 'every badge earned'}</span>
        </div>
      </div>
      <p className="pt-raw">
        You’ve had the app open <b>{minText(v.today.rawMin)}</b> today. Only active play counts toward Minutes.
      </p>
      <div className="pt-sports" aria-label="Lifetime hours by sport">
        {sports.map((s) => (
          <span key={s}>
            {SPORT_NAMES[s]} <b className="num">{v.life.bySport[s]} h</b>
          </span>
        ))}
      </div>
      {onOpen && (
        <button className="pt-open" onClick={onOpen}>
          <span>MINUTES: rewards and leagues</span>
          <i aria-hidden="true">›</i>
        </button>
      )}
    </section>
  );
}
