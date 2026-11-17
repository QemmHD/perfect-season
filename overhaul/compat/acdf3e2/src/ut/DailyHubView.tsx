// Claude, 2026-11-01 (wave 2): the Daily hub (Home → Daily). The Daily Drop and its 7-day streak,
// the 5-day login calendar, and today's three objectives with the all-three bonus.
import React from 'react';
import { Coin } from '../ui/icons';
import { PackArt } from './PackArt';
import { dailyStatus, STREAK_DAYS } from './content-packs';
import { CALENDAR, calendarStatus, DAILY_BONUS, dailyBonusReady, dailyObjectives } from './daily-hub';
import { rewardLabel } from './progression';
import type { UtState } from './state';
import type { UtSport } from './types';

export function DailyHubView(props: { ut: UtState; day: string; sport: UtSport; onDrop: () => void; onCalendar: () => void; onObjective: (id: string) => void; onBonus: () => void }) {
  const { ut, day } = props;
  const drop = dailyStatus(ut, day);
  const cal = calendarStatus(ut, day);
  const objectives = dailyObjectives(ut, day);
  const bonusReady = dailyBonusReady(ut, day);
  const bonusDone = !bonusReady && objectives.length > 0 && objectives.every((o) => o.claimed) && !!ut.content?.claims?.includes('daily-bonus:' + day);
  return (
    <div className="page ut-dailyhub">
      <div className={'ut-daily' + (drop.ready ? ' ready' : '')}>
        <PackArt kind="daily" label="DAILY" sport={props.sport} small />
        <span className="ut-daily-txt">
          <span className="eyebrow">{drop.ready ? 'FREE · DAILY DROP' : 'DAILY DROP · CLAIMED'}</span>
          <b className="disp">{drop.ready ? 'Day ' + drop.streak + ' is ready' : 'Back tomorrow'}</b>
          <span className="ut-streak" aria-label={'Streak day ' + drop.streak + ' of ' + STREAK_DAYS}>
            {Array.from({ length: STREAK_DAYS }, (_, i) => (
              <i key={i} className={(i < drop.streak - (drop.ready ? 1 : 0) ? 'on' : '') + (i === STREAK_DAYS - 1 ? ' gold' : '') + (drop.ready && i === drop.streak - 1 ? ' next' : '')}>
                {i + 1}
              </i>
            ))}
          </span>
          <small>Day 7 adds a Gold Pack. Miss a day and the streak starts over.</small>
        </span>
        {drop.ready && (
          <button className="btn gold ut-daily-btn" onClick={props.onDrop}>
            OPEN
          </button>
        )}
      </div>

      <span className="eyebrow">LOGIN CALENDAR · DAY {cal.step} OF 5</span>
      <div className="ut-calendar">
        {CALENDAR.map((r) => {
          const done = cal.ready ? r.day < cal.step : r.day <= cal.step;
          const now = cal.ready && r.day === cal.step;
          return (
            <div key={r.day} className={'ut-cal-day' + (done ? ' done' : '') + (now ? ' now' : '')}>
              <b className="disp">D{r.day}</b>
              <small>{r.label}</small>
            </div>
          );
        })}
      </div>
      <button className="btn primary ut-cal-claim" disabled={!cal.ready} onClick={props.onCalendar}>
        {cal.ready ? 'CLAIM DAY ' + cal.step + ' · ' + CALENDAR[cal.step - 1].label.toUpperCase() : 'CALENDAR CLAIMED TODAY'}
      </button>
      <p className="note">The calendar moves on every day you claim. Missed days don’t reset it.</p>

      <span className="eyebrow">TODAY’S OBJECTIVES</span>
      {objectives.map((o) => {
        const ready = !o.claimed && o.progress >= o.target;
        return (
          <div key={o.id} className={'ut-dobj' + (o.claimed ? ' done' : ready ? ' ready' : '')}>
            <span>
              <b>{o.title}</b>
              <small>
                {o.text} · {rewardLabel(o.reward)}
              </small>
              <span className="bar">
                <i style={{ width: (100 * o.progress) / o.target + '%' }} />
              </span>
            </span>
            {o.claimed ? (
              <i className="ut-dobj-state">DONE</i>
            ) : ready ? (
              <button className="btn gold" onClick={() => props.onObjective(o.id)}>
                CLAIM
              </button>
            ) : (
              <i className="ut-dobj-state num">
                {o.progress}/{o.target}
              </i>
            )}
          </div>
        );
      })}
      <div className={'ut-dbonus' + (bonusReady ? ' ready' : bonusDone ? ' done' : '')}>
        <span>
          <b>All three bonus</b>
          <small>
            <Coin size={11} /> {DAILY_BONUS.coins} + Silver Pack for finishing today’s three
          </small>
        </span>
        {bonusDone ? (
          <i className="ut-dobj-state">DONE</i>
        ) : (
          <button className="btn gold" disabled={!bonusReady} onClick={props.onBonus}>
            CLAIM
          </button>
        )}
      </div>
    </div>
  );
}
