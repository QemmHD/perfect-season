// Ultimate Team Home. Claude, 2026-11-01 (UI reorganisation, docs/UI-NAVIGATION.md): an action hub
// in the FC 26 "For You" / FC 27 Campaign Hub spirit. It only shows what to do next — the run to
// continue, rewards to claim, this season's drops and the daily loop, your squad — and every row
// leads to the one place that thing lives (Play, Challenges, Club, Store). Card materials and the
// Archivo / teal / gold look are Codex's clubhouse; nothing here changes state except CLAIM ALL.
import React from 'react';
import { UtCard, GoatCrown } from './CardArt';
import { byValue } from './pool';
import { type Lineup, type SquadRating, slotsFor } from './squad';
import type { UtState } from './state';
import type { UtSport } from './types';
import type { ClubCard, UtView } from './UltimateTeam';
import { PackArt } from './PackArt';
import { HQArrow, SeasonRibbon } from './Clubhouse';
import { hqOf } from './progression';
import { dailyStatus, lightningWindow, STREAK_DAYS } from './content-packs';
import { standoutProgram } from './standouts';
import { weekLabel } from './editions';
import type { Pool } from './pool';
import { NEW_ERA_COINS, newEraReady } from './new-era';
import { SeasonBanner } from './SeasonBanner';
import { continueRun, MODE_NAME, playStatus } from './play-status';
import { IconBattles, IconChart, IconDraft, IconGift, IconLeague, IconPlay, IconRoute } from './icons';
import { previewId } from './preview-pack';
import { SectionHead, stagger } from './ui';
export { PackArt } from './PackArt';

const CONTINUE_ICON: Partial<Record<UtView, React.ReactNode>> = {
  league: <IconLeague size={30} />,
  circuit: <IconRoute size={30} />,
  draft: <IconDraft size={30} />,
};

export function Hub(props: {
  sport: UtSport;
  club: ClubCard[];
  lineup: Lineup;
  rating: SquadRating;
  ut: UtState;
  day: string;
  week: string;
  pool: Pool;
  onGo: (v: UtView) => void;
  onStarter: () => void;
  onNewEra: () => void;
  inboxReady: number;
  onClaimAll: () => void;
  calendarReady: boolean;
}) {
  const { ut, rating, lineup, pool } = props;
  const h = hqOf(ut);
  const size = slotsFor(props.sport).length;
  const starters = slotsFor(props.sport)
    .filter((s) => s.weight > 0)
    .map((s) => lineup[s.id])
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort(byValue)
    .slice(0, 3);
  const daily = dailyStatus(ut, props.day);
  const program = standoutProgram(pool, props.week);
  const status = playStatus(pool, ut, props.week);
  const run = continueRun(status);
  const lw = lightningWindow(Date.now());
  const form = h.history.slice(-5);
  let i = 0;
  return (
    <div className="page ut-hub uh">
      {!ut.starterClaimed && (
        <button className="ut-starter rise-in" style={stagger(i++)} onClick={props.onStarter}>
          <PackArt kind="starter" label="STARTER" sport={props.sport} small />
          <span className="ut-starter-txt">
            <span className="eyebrow">FREE · YOUR FIRST SQUAD</span>
            <b className="disp">Open your starter pack</b>
            <small>Every position filled, one gold to build around.</small>
          </span>
          <HQArrow />
        </button>
      )}
      {newEraReady(ut) && (
        <div className="ut-new-era rise-in" style={stagger(i++)}>
          <GoatCrown className="ut-new-era-crown" />
          <span className="eyebrow">THANK YOU FOR PLAYING</span>
          <b className="disp">The New Era is here.</b>
          <p>
            Ratings are rebuilt and everything you own stays yours. As a thank-you: an Icon pick (1 of 3 Legends) and {NEW_ERA_COINS.toLocaleString('en-US')} coins.
          </p>
          <button className="btn gold" onClick={props.onNewEra}>
            CLAIM YOUR NEW ERA BUNDLE
          </button>
          <small>One per player. The coins are paid once across both sports.</small>
        </div>
      )}
      {run ? (
        <button className="uh-continue rise-in" style={stagger(i++)} onClick={() => props.onGo(run.view)} aria-label={'Continue ' + MODE_NAME[run.view] + ': ' + run.line}>
          <span className="uh-continue-icon" aria-hidden="true">
            {CONTINUE_ICON[run.view]}
          </span>
          <span className="uh-continue-txt">
            <i className="eyebrow">CONTINUE</i>
            <b className="disp">{MODE_NAME[run.view]}</b>
            <small>{run.line}</small>
          </span>
          <span className="uh-continue-go" aria-hidden="true">
            <IconPlay size={20} />
          </span>
        </button>
      ) : (
        ut.starterClaimed && (
          <button className="uh-continue idle rise-in" style={stagger(i++)} onClick={() => props.onGo('play')} aria-label="Play: choose a mode">
            <span className="uh-continue-icon" aria-hidden="true">
              <IconBattles size={30} />
            </span>
            <span className="uh-continue-txt">
              <i className="eyebrow">READY WHEN YOU ARE</i>
              <b className="disp">Play</b>
              <small>Club Season, Squad Battles, Rivals and more</small>
            </span>
            <span className="uh-continue-go" aria-hidden="true">
              <IconPlay size={20} />
            </span>
          </button>
        )
      )}
      <div className={'uh-inbox rise-in' + (props.inboxReady ? ' ready' : '')} style={stagger(i++)}>
        <button className="ut-home-inbox" onClick={() => props.onGo('inbox')} aria-label={props.inboxReady ? 'Rewards: ' + props.inboxReady + ' ready to claim' : 'Rewards: all caught up'}>
          <span className="uh-inbox-icon" aria-hidden="true">
            <IconGift size={22} />
            {props.inboxReady > 0 && <i className="num">{props.inboxReady}</i>}
          </span>
          <span className="uh-inbox-txt">
            <b>Rewards</b>
            <small>{props.inboxReady ? props.inboxReady + (props.inboxReady === 1 ? ' reward' : ' rewards') + ' ready to claim' : 'All caught up · packs and picks wait in the Store'}</small>
          </span>
          {!props.inboxReady && <HQArrow />}
        </button>
        {props.inboxReady > 0 && (
          <button className="btn gold uh-claim" onClick={props.onClaimAll}>
            CLAIM ALL
          </button>
        )}
      </div>
      <div className="uh-season rise-in" style={stagger(i++)}>
        <SeasonBanner day={props.day} sport={props.sport} onStore={() => props.onGo('store')} compact />
        <SeasonRibbon ut={ut} day={props.day} onOpen={() => props.onGo('season')} />
      </div>
      <div className="ut-home-drops rise-in" style={stagger(i++)}>
        <button className={'ut-home-daily' + (daily.ready || props.calendarReady ? ' ready' : '')} onClick={() => props.onGo('daily')}>
          <PackArt kind="daily" label="DAILY" sport={props.sport} small />
          <span>
            <i className="eyebrow">{daily.ready ? 'FREE TODAY' : 'DAILY'}</i>
            <b className="disp">{daily.ready ? 'Open Day ' + daily.streak : 'Day ' + daily.streak + ' done'}</b>
            <small>{daily.ready ? (daily.streak === STREAK_DAYS ? 'Day 7: plus a Gold Pack' : STREAK_DAYS - daily.streak + ' days to a Gold Pack') : props.calendarReady ? 'Calendar reward ready' : 'Calendar · 3 objectives'}</small>
          </span>
          {(daily.ready || props.calendarReady) && <i className="uh-dot" aria-hidden="true" />}
        </button>
        <button className="ut-home-so" onClick={() => props.onGo('standouts')}>
          {program.featured && <UtCard rc={program.featured} w={44} />}
          <span>
            <i className="eyebrow">STANDOUTS · {weekLabel(props.week)}</i>
            <b className="disp">{program.featured ? program.featured.line.name.split(' ').slice(-1)[0] + ' ' + program.featured.ovr : 'This week'}</b>
            <small>+{Math.max(0, program.cards.length - 1)} more this week</small>
          </span>
        </button>
      </div>
      {lw ? (
        <button className="uh-promo lightning rise-in" style={stagger(i++)} onClick={() => props.onGo('store')}>
          <PackArt kind="lightning" label="LIGHTNING" sport={props.sport} small />
          <span>
            <i className="eyebrow">STORE · LIGHTNING · 25% OFF</i>
            <b className="disp">Lightning Standout</b>
            <small>A Weekly Standout guaranteed · {lw.minutesLeft >= 60 ? Math.floor(lw.minutesLeft / 60) + 'h ' : ''}{lw.minutesLeft % 60}m left</small>
          </span>
          <HQArrow />
        </button>
      ) : (
        <button className="uh-promo rise-in" style={stagger(i++)} onClick={() => props.onGo('store')}>
          <PackArt kind="premium" label="PREVIEW" sport={props.sport} small />
          <span>
            <i className="eyebrow">STORE · PREVIEW PACK</i>
            <b className="disp">See it before you buy</b>
            <small>{previewId(ut) ? 'Your preview is ready: buy it or skip it' : 'Peek at a Premium Gold pack’s exact cards'}</small>
          </span>
          <HQArrow />
        </button>
      )}
      <SectionHead title="Your club" />
      <button
        className="uh-squad rise-in"
        style={stagger(i++)}
        onClick={() => props.onGo('squad')}
        aria-label={'Your squad: ' + rating.ovr + ' overall, ' + rating.chem + ' chemistry, ' + rating.filled + ' of ' + size + ' spots filled'}
      >
        <span className="uh-squad-nums">
          <span>
            <b className="disp num">{rating.filled ? rating.ovr : '—'}</b>
            <i>OVR</i>
          </span>
          <span>
            <b className="disp num">{rating.filled ? rating.chem : '—'}</b>
            <i>CHEM</i>
          </span>
          <small>{rating.complete ? 'Matchday squad ready' : rating.filled + ' of ' + size + ' spots filled'}</small>
        </span>
        <span className={'uh-fan n' + starters.length} aria-hidden="true">
          {starters.map((rc, k) => (
            <span key={rc.line.id} style={{ '--i': k - (starters.length - 1) / 2 } as React.CSSProperties}>
              <UtCard rc={rc} w={56} />
            </span>
          ))}
        </span>
      </button>
      <button className="uh-form rise-in" style={stagger(i++)} onClick={() => props.onGo('records')}>
        <IconChart size={20} />
        <span className="uh-form-txt">
          <b>Club Records</b>
          <small>
            {ut.record.w + ut.record.h2hW}W {ut.record.l + ut.record.h2hL}L · {ut.packsOpened} {ut.packsOpened === 1 ? 'pack' : 'packs'} opened
          </small>
        </span>
        {form.length > 0 && (
          <span className="uh-form-pips" aria-label={'Recent form: ' + form.map((m) => (m.won ? 'W' : 'L')).join(' ')}>
            {form.map((m) => (
              <i key={m.id} className={m.won ? 'win' : 'loss'}>
                {m.won ? 'W' : 'L'}
              </i>
            ))}
          </span>
        )}
        <HQArrow />
      </button>
    </div>
  );
}
