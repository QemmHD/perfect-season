// Ultimate Team Home. Claude, 2026-11-01 (UI reorganisation, docs/UI-NAVIGATION.md): an action hub in
// the FC 26 "For You" / FC 27 Campaign Hub spirit. Card materials and the Archivo / teal / gold look
// are Codex's clubhouse.
// Claude, 2026-11-16 (studio overhaul, team ut, task ut-4; Game Design V2 D.5, audit H4/M10): rebuilt
// around ONE hero, the next best action (next-action.ts, the same engine as main Home's strip and the
// One-More bar), with its single primary button. Under it, only true distances and real clocks:
// near-miss chips, the Minutes ring, Live Now with countdowns (amber under 24 h, a dot while new),
// today's three objectives, the Season Pass card with its top reward from day 1, Upcoming, then the
// club. When the day's loop is finished and nothing waits, the hero turns calm: "Done for today", with
// tomorrow's teaser and a quiet KEEP PLAYING. Every row leads to the screen where it is done.
import React, { useMemo } from 'react';
import type { Profile } from '../lib/profile';
import { perfNote } from '../ui/NextUpStrip';
import { elsewhereOf, MATCH_VIEW, readDevice } from '../ui/next-up-main';
import { UtCard } from './CardArt';
import { HQArrow } from './Clubhouse';
import { dailyStatus, STREAK_DAYS } from './content-packs';
import { weekLabel } from './editions';
import { liveNow, seasonCard, todayCard, tomorrowLine, upcomingFeed, type FeedItem } from './hub-feed';
import { IconBattles, IconBox, IconChart, IconCheck, IconDraft, IconGift, IconLeague, IconPass, IconRoute, IconStar, IconTarget } from './icons';
import { Countdown, GoChip, MinutesRing, PrimaryButton, SectionTitle } from './kit';
import { LABEL, MODE_LABEL } from './labels';
import { freshForMinutes, minutesExtras, type MinutesChip } from './minutes';
import { nearMisses, type NearExtras } from './near-miss';
import { doneAction, loopDone, nextCtxOf, nextUp, type NextAction, type Target } from './next-action';
import { hqOf, objectiveDeck } from './objectives';
import { PackArt } from './PackArt';
import { byValue, type Pool } from './pool';
import { type Lineup, type SquadRating, slotsFor } from './squad';
import type { UtState } from './state';
import { standoutProgram } from './standouts';
import type { UtSport } from './types';
import { stagger } from './ui';
import type { ClubCard, UtView } from './UltimateTeam';
import './hub.css';
export { PackArt } from './PackArt';

/** The hero's headline for each kind of action (its line under it says the true distance). */
function heroTitle(a: NextAction, sport: UtSport): string {
  const id = a.id;
  if (a.done) return 'Great session';
  if (id === 'claim') return a.cta === 'CLAIM ALL' ? 'Rewards ready' : 'Reward ready';
  if (id.startsWith('claim:')) return 'Rewards in ' + id.slice(6).toUpperCase();
  if (id === 'starter') return 'Your first squad';
  if (id.startsWith('run:')) return 'Continue ' + (MODE_LABEL[id.slice(4) as keyof typeof MODE_LABEL] ?? LABEL.play);
  if (id === 'streak') return 'Keep your streak';
  if (id.startsWith('ending:')) return 'Ends tonight';
  if (id.startsWith('milestone:') || id.startsWith('minutes:')) return 'So close';
  if (id === 'daily-play') return 'Daily Play';
  if (id === 'daily-last') return "Finish today's three";
  if (id === 'pass') return LABEL.seasonPass;
  if (id === 'wave') return 'New program';
  if (id === 'packs') return 'Packs to open';
  return sport === 'soccer' ? 'Next fixture' : 'Next match';
}

/** The hero's art: a 96 px lit medallion with the action's mark. */
function HeroArt({ a }: { a: NextAction }) {
  const id = a.id,
    s = 46;
  const mark = a.done ? (
    <IconCheck size={s} />
  ) : id === 'claim' || id.startsWith('claim:') ? (
    <IconGift size={s} />
  ) : id === 'starter' || id === 'packs' ? (
    <IconBox size={s} />
  ) : id === 'run:league' ? (
    <IconLeague size={s} />
  ) : id === 'run:draft' ? (
    <IconDraft size={s} />
  ) : id.startsWith('run:') ? (
    <IconRoute size={s} />
  ) : id === 'pass' ? (
    <IconPass size={s} />
  ) : id.startsWith('milestone:') || id.startsWith('minutes:') ? (
    <IconStar size={s} />
  ) : id === 'daily-last' || id.startsWith('ending:') || id === 'streak' ? (
    <IconTarget size={s} />
  ) : (
    <IconBattles size={s} />
  );
  return (
    <span className="uh-hero-art" aria-hidden="true">
      <i className="uh-hero-rays" />
      <span className="uh-hero-medal">{mark}</span>
    </span>
  );
}

export function Hub(props: {
  sport: UtSport;
  profile: Profile;
  club: ClubCard[];
  lineup: Lineup;
  rating: SquadRating;
  ut: UtState;
  day: string;
  week: string;
  pool: Pool;
  onGo: (v: UtView) => void;
  /** a next-best-action target (another sport, a draft, the Minutes screen are UltimateTeam's to route) */
  onTarget: (t: Target) => void;
  onStarter: () => void;
  inboxReady: number;
  onClaimAll: () => void;
  calendarReady: boolean;
  /** sets one or two cards from complete (only the pool knows), for the near-miss chips */
  sets?: NearExtras['sets'];
  /** a Live Now item was opened: its "new" dot goes */
  onSeen: (key: string, token: string) => void;
  /** ut-3 (V2 E.9.1): today's Minutes ring; tapping it opens RANKS → MINUTES */
  minutes?: MinutesChip;
  onMinutes?: () => void;
}) {
  const { ut, rating, lineup, pool, sport, profile } = props;
  const size = slotsFor(sport).length;
  // the Rewards tile never says "All caught up" while the Minutes ring above it has rungs waiting
  // (review fix: the two tiles contradicted each other); Minutes rungs are claimed on their own screen
  const minutesReady = props.minutes?.ready ?? 0,
    rewardsLine = props.inboxReady
      ? props.inboxReady + (props.inboxReady === 1 ? ' reward' : ' rewards') + ' ready to claim'
      : minutesReady
        ? 'Inbox clear · Minutes ' + (minutesReady === 1 ? 'reward' : 'rewards') + ' ready above'
        : 'All caught up · packs and picks wait in the Store';
  // every derivation of the hub in one pass, timed for QA (`ps-hub-derive`, perfNote)
  const d = useMemo(() => {
    const t0 = performance.now(),
      now = Date.now(),
      deck = objectiveDeck(ut, props.day),
      fresh = freshForMinutes(profile);
    const ctx = nextCtxOf(ut, sport, now, { ...minutesExtras(profile.playtime, now, fresh), elsewhere: [] });
    const full = { ...ctx, elsewhere: elsewhereOf(readDevice(), sport, ctx.day) },
      done = loopDone(full);
    const out = {
      action: done ? doneAction(full) : nextUp(full),
      done,
      near: nearMisses(ut, sport, now, { sets: props.sets }),
      live: liveNow(ut, sport, now),
      upcoming: upcomingFeed(ut, sport, now),
      season: seasonCard(ut, sport, now),
      today: todayCard(ut, props.day, deck),
      tomorrow: tomorrowLine(ut, now),
    };
    perfNote('ps-hub-derive', t0);
    return out;
  }, [ut, props.day, sport, profile.playtime, props.sets]);
  const starters = slotsFor(sport)
    .filter((s) => s.weight > 0)
    .map((s) => lineup[s.id])
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort(byValue)
    .slice(0, 3);
  const daily = dailyStatus(ut, props.day);
  const program = standoutProgram(pool, props.week);
  const form = hqOf(ut).history.slice(-5);
  const a = d.action;
  // the hero's one button: CLAIM ALL claims here; everything else goes where it is done
  const heroGo = () => {
    if (a.id === 'claim' && a.target.app === 'ut' && a.target.view === 'inbox' && props.inboxReady > 0) return props.onClaimAll();
    if (a.id === 'starter') return props.onStarter();
    if (a.target.app === 'match') return props.onGo(MATCH_VIEW[a.target.setup.mode]);
    if (a.target.app === 'ut' && (!a.target.sport || a.target.sport === sport)) return props.onGo(a.target.view);
    props.onTarget(a.target);
  };
  const openLive = (x: FeedItem) => {
    if (x.fresh) props.onSeen('live:' + x.id, x.token);
    props.onGo(x.view);
  };
  let i = 0;
  return (
    <div className="page ut-hub uh">
      <section className={'uh-hero rise-in' + (d.done ? ' done' : a.amber ? ' amber' : '')} style={stagger(i++)} aria-label={LABEL.nextUp}>
        <HeroArt a={a} />
        <span className="uh-hero-txt">
          <i className="uh-hero-eye">{d.done || a.done ? LABEL.doneForToday.toUpperCase() : a.amber ? 'ENDS TONIGHT' : 'NEXT BEST ACTION'}</i>
          <b className="uh-hero-title">{d.done ? 'Great session' : heroTitle(a, sport)}</b>
          <small className="uh-hero-line">{d.done ? 'Tomorrow: ' + d.tomorrow : a.done ? a.line.replace(/^Done for today · /, '') : a.line}</small>
          {a.stake && !d.done && <em className="uh-hero-stake">{a.stake}</em>}
        </span>
        <span className="uh-hero-cta">
          <PrimaryButton tone={d.done || a.done ? 'teal' : 'gold'} onClick={heroGo} ariaLabel={(d.done || a.done ? 'Keep playing: ' : a.cta + ': ') + a.line}>
            {a.cta}
          </PrimaryButton>
        </span>
      </section>
      {!ut.starterClaimed && a.id !== 'starter' && (
        // the free starter pack stays one tap away even when rewards come first in the hero
        <button className="ut-starter rise-in" style={stagger(i++)} onClick={props.onStarter}>
          <PackArt kind="starter" label="STARTER" sport={sport} small />
          <span className="ut-starter-txt">
            <span className="eyebrow">FREE · YOUR FIRST SQUAD</span>
            <b className="disp">Open your starter pack</b>
            <small>Every position filled, one gold to build around.</small>
          </span>
          <HQArrow />
        </button>
      )}
      {!d.done && d.near.length > 0 && (
        <div className="uh-near rise-in" style={stagger(i++)} role="list" aria-label="Almost there">
          {d.near.map((n) => (
            <button key={n.id} role="listitem" className="uh-near-chip" onClick={() => props.onGo(n.go.view)} aria-label={n.text + (n.stake ? ', ' + n.stake : '') + '. ' + n.go.label}>
              <b>{n.text}</b>
              {n.stake && <small>{n.stake}</small>}
              <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M5 2.5L9.5 7 5 11.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
      {props.minutes && (
        <div className="uh-mins rise-in" style={stagger(i++)}>
          <MinutesRing
            minutes={props.minutes.minutes}
            target={props.minutes.target}
            reward={props.minutes.state === 'done' ? 'Great session.' : props.minutes.reward}
            state={props.minutes.state}
            onClick={props.onMinutes}
            ariaLabel={
              LABEL.minutes +
              ': ' +
              (props.minutes.state === 'done' ? LABEL.doneForToday + '. Great session.' : props.minutes.minutes + ' of ' + props.minutes.target + ' minutes today. ' + props.minutes.reward) +
              (props.onMinutes ? '. Open Minutes' : '')
            }
          />
        </div>
      )}
      <SectionTitle title="Live now" aside={<span className="uh-sec-aside">{d.live.length} running</span>} />
      <div className="uh-live rise-in" style={stagger(i++)} role="list">
        {d.live.map((x) => (
          <button key={x.id} role="listitem" className={'uh-live-card k-' + x.id.split(':')[0]} onClick={() => openLive(x)} aria-label={x.title + ': ' + x.line}>
            {x.fresh && <i className="uh-new" aria-label="new" />}
            <i className="uh-live-eye">{x.eyebrow}</i>
            <b className="uh-live-title">{x.title}</b>
            <small className="uh-live-line">{x.line}</small>
            <Countdown to={x.endsAt} prefix="ends in" />
          </button>
        ))}
      </div>
      <button className="uh-today rise-in" style={stagger(i++)} onClick={() => props.onGo('objectives')} aria-label={"Today's objectives: " + d.today.done + ' of ' + d.today.rows.length + ' done'}>
        <span className="uh-card-head">
          <i>TODAY</i>
          <b className="num">
            {d.today.done} / {d.today.rows.length}
          </b>
          <span>{LABEL.objectives.toUpperCase()}</span>
        </span>
        <ul>
          {d.today.rows.map((r) => (
            <li key={r.id} className={r.done ? 'done' : ''}>
              <span className="uh-tick" aria-hidden="true">
                {r.done && <IconCheck size={12} />}
              </span>
              <span className="uh-today-text">{r.text}</span>
              <small className="num">{r.done ? (r.claimed ? 'CLAIMED' : 'READY') : r.progress + '/' + r.target}</small>
            </li>
          ))}
        </ul>
      </button>
      <div className="uh-season-card rise-in" style={stagger(i++)}>
        <button className="uh-season-main" onClick={() => props.onGo('season')} aria-label={LABEL.seasonPass + ': level ' + d.season.level + ' of ' + d.season.tiers + (d.season.next ? ', ' + d.season.next.levels + ' to ' + d.season.next.name : '')}>
          <span className="uh-season-top">
            <PackArt kind={d.season.top.pack} label={'LV ' + d.season.top.tier} sport={sport} small />
          </span>
          <span className="uh-season-txt">
            <i className="uh-card-eye">
              {LABEL.seasonPass.toUpperCase()} · {d.season.title.toUpperCase()}
            </i>
            <b>
              Level {d.season.level} <span>of {d.season.tiers}</span>
            </b>
            <span className="uh-season-bar" aria-hidden="true">
              <i style={{ width: Math.round((d.season.level / d.season.tiers) * 100) + '%' }} />
            </span>
            <small>
              {d.season.ready > 0
                ? d.season.ready + (d.season.ready === 1 ? ' level' : ' levels') + ' ready to claim'
                : d.season.next
                  ? d.season.next.levels + (d.season.next.levels === 1 ? ' level' : ' levels') + ' to ' + d.season.next.name
                  : 'Every level reached'}
              {' · top: ' + d.season.top.name + (d.season.top.coins ? ' + ' + d.season.top.coins + ' coins' : '')}
            </small>
          </span>
        </button>
        <span className="uh-season-foot">
          <Countdown to={d.season.endsAt} prefix="season ends in" />
          <GoChip label="PLAY" onClick={() => props.onGo('battles')} ariaLabel={'Earn Season Points: play ' + LABEL.squadBattles} />
        </span>
      </div>
      {d.upcoming.length > 0 && (
        <>
          <SectionTitle title="Upcoming" />
          <ul className="uh-upcoming rise-in" style={stagger(i++)}>
            {d.upcoming.map((u) => (
              <li key={u.id}>
                <b>{u.when}</b>
                <span>{u.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="ut-home-drops rise-in" style={stagger(i++)}>
        <button className={'ut-home-daily' + (daily.ready || props.calendarReady ? ' ready' : '')} onClick={() => props.onGo('daily')}>
          <PackArt kind="daily" label="DAILY" sport={sport} small />
          <span>
            <i className="eyebrow">{daily.ready ? 'FREE TODAY' : 'DAILY'}</i>
            <b className="disp">{daily.ready ? 'Open Day ' + daily.streak : 'Day ' + daily.streak + ' done'}</b>
            <small>
              {daily.ready
                ? daily.streak === STREAK_DAYS
                  ? 'Day 7: plus a Gold Pack'
                  : STREAK_DAYS - daily.streak + ' days to a Gold Pack'
                : props.calendarReady
                  ? 'Calendar reward ready'
                  : 'Calendar · 3 objectives'}
            </small>
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
      <SectionTitle title="Your club" />
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
      <button className="uh-form uh-rewards rise-in" style={stagger(i++)} onClick={() => props.onGo('inbox')} aria-label={LABEL.rewards + ': ' + rewardsLine}>
        <IconGift size={20} />
        <span className="uh-form-txt">
          <b>{LABEL.rewards}</b>
          <small>{rewardsLine}</small>
        </span>
        <HQArrow />
      </button>
      <button className="uh-form rise-in" style={stagger(i++)} onClick={() => props.onGo('records')}>
        <IconChart size={20} />
        <span className="uh-form-txt">
          <b>{LABEL.clubRecords}</b>
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
