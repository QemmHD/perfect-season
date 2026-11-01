// Codex clubhouse home: connected play, progression and club management; original card materials.
import React from 'react';
import { Coin, Trophy } from '../ui/icons';
import { UtCard } from './CardArt';
import { IconClub, IconSbc, IconStore } from './icons';
import { byValue } from './pool';
import type { Sbc } from './sbc';
import { type Lineup, type SquadRating, slotsFor } from './squad';
import type { UtState } from './state';
import type { UtSport } from './types';
import type { ClubCard, UtView } from './UltimateTeam';
import { PackArt } from './PackArt';
import { HQArrow, SeasonRibbon } from './Clubhouse';
import { hqOf, objectiveDeck } from './progression';
import { dailyStatus, STREAK_DAYS } from './content-packs';
import { standoutProgram } from './standouts';
import { weekLabel } from './editions';
import type { Pool } from './pool';
import { setsFor } from './sets';
import { NEW_ERA_COINS, newEraReady } from './new-era';
import { GoatCrown } from './CardArt';
import { SeasonBanner } from './SeasonBanner';
export { PackArt } from './PackArt';
export function Hub(props: {
  sport: UtSport;
  club: ClubCard[];
  lineup: Lineup;
  rating: SquadRating;
  ut: UtState;
  sbcTodo: number;
  sbcs: Sbc[];
  day: string;
  onGo: (v: UtView) => void;
  onStarter: () => void;
  onInspect: (uid: string) => void;
  // Claude: content drop 2
  onDaily: () => void;
  onNewEra: () => void;
  onInbox: () => void;
  inboxReady: number;
  calendarReady: boolean;
  week: string;
  pool: Pool;
}) {
  const { ut, rating, lineup } = props,
    h = hqOf(ut),
    starters = slotsFor(props.sport)
      .filter((s) => s.weight > 0)
      .map((s) => lineup[s.id])
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort(byValue)
      .slice(0, 5),
    best = props.club.slice().sort((a, b) => byValue(a.rc, b.rc)),
    fan = starters.length ? starters : best.length ? [best[0].rc] : [],
    size = slotsFor(props.sport).length,
    rewards = objectiveDeck(ut, props.day).filter(
      (o) => !o.claimed && o.progress >= o.target
    ).length;
  const daily = dailyStatus(ut, props.day);
  const program = standoutProgram(props.pool, props.week);
  const setsReady = setsFor(props.pool, ut).filter((s) => !s.claimed && s.have >= s.need).length;
  return (
    <div className="page ut-hub hq-home">
      <SeasonBanner day={props.day} sport={props.sport} onStore={() => props.onGo('store')} />
      <SeasonRibbon
        ut={ut}
        day={props.day}
        onOpen={() => props.onGo('season')}
      />
      {!ut.starterClaimed && (
        <button className="ut-starter rise-in" onClick={props.onStarter}>
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
        <div className="ut-new-era rise-in">
          <GoatCrown className="ut-new-era-crown" />
          <span className="eyebrow">THANK YOU FOR PLAYING</span>
          <b className="disp">The New Era is here.</b>
          <p>
            Ratings are rebuilt. Every card, coin and level you own stays yours. As a thank-you: an Icon pick (choose 1 of 3 Legends) and {NEW_ERA_COINS.toLocaleString('en-US')} coins.
          </p>
          <button className="btn gold" onClick={props.onNewEra}>
            CLAIM YOUR NEW ERA BUNDLE
          </button>
          <small>One per player. The coins are paid once across both sports.</small>
        </div>
      )}
      <button className={'ut-home-inbox' + (props.inboxReady ? ' ready' : '')} onClick={props.onInbox}>
        <span>
          <i className="eyebrow">REWARDS INBOX</i>
          <b className="disp">{props.inboxReady ? props.inboxReady + ' ready to claim' : 'All caught up'}</b>
        </span>
        {props.inboxReady > 0 ? <b className="num ut-home-inbox-n">{props.inboxReady}</b> : <HQArrow />}
      </button>
      <div className="ut-home-drops">
        <button className={'ut-home-daily' + (daily.ready ? ' ready' : '')} onClick={() => (daily.ready ? props.onDaily() : props.onGo('store'))}>
          <PackArt kind="daily" label="DAILY" sport={props.sport} small />
          <span>
            <i className="eyebrow">{daily.ready ? 'FREE DAILY DROP' : 'DAILY DROP'}</i>
            <b className="disp">{daily.ready ? 'Open Day ' + daily.streak : 'Day ' + daily.streak + ' claimed'}</b>
            <small>{daily.ready ? (daily.streak === STREAK_DAYS ? 'Day 7: plus a Gold Pack' : STREAK_DAYS - daily.streak + ' days to a Gold Pack') : props.calendarReady ? 'Calendar reward ready' : 'Calendar · objectives'}</small>
          </span>
        </button>
        <button className="ut-home-so" onClick={() => props.onGo('standouts')}>
          {program.featured && <UtCard rc={program.featured} w={46} />}
          <span>
            <i className="eyebrow">STANDOUTS · {weekLabel(props.week)}</i>
            <b className="disp">{program.featured ? program.featured.line.name.split(' ').slice(-1)[0] + ' ' + program.featured.ovr : 'This week'}</b>
            <small>+{program.cards.length - 1} more this week</small>
          </span>
        </button>
      </div>
      <div className="hq-home-hero">
        <span className="eyebrow">PERFECT SEASON · ULTIMATE TEAM</span>
        <h1 className="disp">
          BUILD YOUR
          <br />
          <em>DYNASTY.</em>
        </h1>
        <p>
          Your players. Your playbook.
          <br />
          Your next chapter.
        </p>
        <div
          className={'ut-fan n' + fan.length + ' hq-hero-fan'}
          aria-hidden="true"
        >
          {fan.map((rc, i) => (
            <span
              key={rc.line.id}
              className="ut-fan-card"
              style={{ '--i': i - (fan.length - 1) / 2 } as React.CSSProperties}
            >
              <UtCard rc={rc} w={72} />
            </span>
          ))}
        </div>
        <button className="btn primary" onClick={() => props.onGo('play')}>
          PLAY HQ <HQArrow />
        </button>
        <span className="hq-hero-sport">
          {props.sport === 'nfl' ? 'GRIDIRON' : 'HARDWOOD'} / YOUR CLUB
        </span>
      </div>
      <div className="hq-home-actions">
        <button onClick={() => props.onGo('objectives')}>
          <IconSbc size={19} />
          <span>OBJECTIVES</span>
          {rewards > 0 ? <b className="num">{rewards}</b> : <HQArrow />}
        </button>
        <button onClick={() => props.onGo('development')}>
          <IconClub size={19} />
          <span>DEVELOPMENT</span>
          <HQArrow />
        </button>
      </div>
      <div className="hq-home-double">
        <button className="hq-small-mode" onClick={() => props.onGo('club')}>
          <i className="eyebrow">YOUR PLAYERS · YOUR COLLECTION</i>
          <b className="disp">MY CLUB</b>
          <small>Organize your cards and duplicate storage.</small>
          <HQArrow />
        </button>
        <button className="hq-small-mode" onClick={() => props.onGo('season')}>
          <i className="eyebrow">25 FREE REWARD LEVELS</i>
          <b className="disp">SEASON PASS</b>
          <small>Turn every session into progress.</small>
          <HQArrow />
        </button>
      </div>
      <button
        className="ut-squadcard hq-squad-summary"
        onClick={() => props.onGo('squad')}
        aria-label={
          'Your squad: ' +
          rating.ovr +
          ' overall, ' +
          rating.chem +
          ' chemistry, ' +
          rating.filled +
          ' of ' +
          size +
          ' spots filled'
        }
      >
        <span className="ut-sq-stats">
          <span className="eyebrow">YOUR MATCHDAY SQUAD</span>
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
          <small>
            {rating.complete
              ? 'Full squad · manage saved lineups'
              : rating.filled + ' of ' + size + ' spots filled'}
          </small>
        </span>
        <span className="hq-squad-arrow">
          <HQArrow />
        </span>
      </button>
      <button className="ut-book-launch" onClick={() => props.onGo('gallery')}>
        <IconClub size={24} />
        <span>
          <b>Collection Gallery</b>
          <small>Complete sets. Keep the memories. Claim the rewards.</small>
        </span>
        <b className="num">
          {
            new Set([...(ut.collected ?? []), ...ut.owned.map((c) => c.cardId)])
              .size
          }
        </b>
      </button>
      <div className="ut-tiles">
        <button className="ut-tile" onClick={() => props.onGo('store')}>
          <IconStore size={24} />
          <b>Store</b>
          <small>
            {ut.packs.length
              ? ut.packs.length + ' packs to open'
              : 'Packs from 150'}
          </small>
          {ut.packs.length > 0 && (
            <i className="ut-dot num">{ut.packs.length}</i>
          )}
        </button>
        <button className="ut-tile" onClick={() => props.onGo('sbc')}>
          <IconSbc size={24} />
          <b>Challenges</b>
          <small>{props.sbcTodo ? props.sbcTodo + ' to do' : 'All done'}</small>
        </button>
        <button className="ut-tile" onClick={() => props.onGo('sets')}>
          <IconClub size={24} />
          <b>Sets</b>
          <small>{setsReady ? setsReady + ' ready to claim' : 'Collect. Complete. Claim.'}</small>
          {setsReady > 0 && <i className="ut-dot num">{setsReady}</i>}
        </button>
        <button className="ut-tile" onClick={() => props.onGo('records')}>
          <Trophy size={24} />
          <b>Club Records</b>
          <small>Your form. Your story.</small>
        </button>
      </div>
      {h.history.length > 0 && (
        <div className="hq-mini-form">
          <span className="eyebrow">RECENT FORM</span>
          <span>
            {h.history.slice(-5).map((m) => (
              <i key={m.id} className={m.won ? 'win' : 'loss'}>
                {m.won ? 'W' : 'L'}
              </i>
            ))}
          </span>
          <button
            className="hq-text-button"
            onClick={() => props.onGo('records')}
          >
            VIEW RECORDS <HQArrow />
          </button>
        </div>
      )}
      {best.length > 0 && (
        <div className="ut-hub-sec">
          <span className="eyebrow">THE STARS IN YOUR CLUB</span>
          <div className="ut-hub-best">
            {best.slice(0, 8).map((c) => (
              <button
                key={c.uid}
                className="ut-gridcard small"
                onClick={() => props.onInspect(c.uid)}
                aria-label={c.rc.line.name + ', ' + c.rc.ovr}
              >
                <UtCard
                  rc={c.rc}
                  w={66}
                  level={c.oc.level}
                  mint={c.oc.mint}
                  numbered
                />
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
          <Coin size={13} />
          <b className="num">{ut.sold.coins.toLocaleString('en-US')}</b> from
          quick-sells
        </span>
      </div>
    </div>
  );
}
