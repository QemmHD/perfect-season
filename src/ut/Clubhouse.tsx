// Codex: clubhouse progression and competition surfaces in the existing Ultimate Team materials.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Sheet, Confirm } from '../ui/common';
import { Coin } from '../ui/icons';
import {
  IconBattles,
  IconBolt,
  IconCheck,
  IconCrown,
  IconDraft,
  IconLeague,
  IconPass,
  IconPlay,
  IconRoute,
  IconSquad,
  IconChart,
} from './icons';
import { continueRun, playStatus, type ModeStatus } from './play-status';
import './play-hq.css';
import { ModeArt, SquadFan, useSquadCards } from './play-art';
import { pickFor } from '../engine/sport';
import { SectionHead, stagger, Lede, EmptyState } from './ui';
import { DivisionBadge } from './Rivals';
import { DIVISIONS, divisionOf, rivalsOf } from './rivals';
import { weekKey } from '../net/leaderboard';
import { easternDateKey } from '../engine/season';
import { UtCard } from './CardArt';
import { PackArt } from './PackArt';
import type { Pool } from './pool';
import type { UtState } from './state';
import type { ClubCard, UtView } from './UltimateTeam';
import {
  hqOf,
  objectiveDeck,
  rewardLabel,
  seasonFor,
  seasonReward,
  seasonReady,
  SEASON_STEP,
  SEASON_TIERS,
} from './progression';
import {
  circuitOf,
  CIRCUIT_ENTRIES,
  CIRCUIT_GAMES,
  CIRCUIT_PRIZES,
} from './circuit';
import { DEVELOPMENT_PATHS, developmentReady } from './club-management';
import type { UtSport } from './types';
export function HQArrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}
function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  return (
    <span
      className="hq-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <i
        style={{
          width:
            Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100)) + '%',
        }}
      />
    </span>
  );
}
export function SeasonRibbon({
  ut,
  day,
  onOpen,
}: {
  ut: UtState;
  day: string;
  onOpen: () => void;
}) {
  const season = seasonFor(day),
    s = hqOf(ut).seasons[season.id] ?? { xp: 0, claimed: [] },
    level = Math.min(SEASON_TIERS, Math.floor(s.xp / SEASON_STEP)),
    ready = Object.values(hqOf(ut).seasons).reduce(
      (n, v) =>
        n +
        Math.max(
          0,
          Math.min(SEASON_TIERS, Math.floor(v.xp / SEASON_STEP)) -
            v.claimed.length,
        ),
      0,
    );
  // Claude (UI reorganisation): one name, "Season Pass", for the free reward track everywhere.
  return (
    <button
      className="hq-season-ribbon"
      onClick={onOpen}
      aria-label={
        'Season Pass: level ' +
        level +
        ' of ' +
        SEASON_TIERS +
        (ready ? ', ' + ready + ' rewards ready' : '')
      }
    >
      <span className="hq-season-icon" aria-hidden="true">
        <IconPass size={20} />
      </span>
      <span>
        <b>
          SEASON PASS{' '}
          <i>
            LEVEL {level} / {SEASON_TIERS}
          </i>
        </b>
        <ProgressBar
          label="Season Points toward the next reward"
          value={level === SEASON_TIERS ? 1 : s.xp % SEASON_STEP}
          max={level === SEASON_TIERS ? 1 : SEASON_STEP}
        />
        <small>
          {level === SEASON_TIERS
            ? 'TRACK COMPLETE'
            : SEASON_STEP -
              (s.xp % SEASON_STEP) +
              ' SP TO LEVEL ' +
              (level + 1)}
        </small>
      </span>
      <span className="hq-ribbon-end">
        {ready > 0 ? <b className="num">{ready}</b> : <HQArrow />}
      </span>
    </button>
  );
}
// Codex (OpenAI), 2026-11-07: discovery by session, accurate squad/reward guidance and a useful next action.
export function PlayHQ({
  ut,
  pool,
  week,
  onGo,
  onOnline,
  onCup,
  cupStatus,
}: {
  ut: UtState;
  pool: Pool;
  week: string;
  onGo: (v: UtView) => void;
  onOnline: () => void;
  /** Root owns routing; an absent handler leaves the existing mode list unchanged. */
  onCup?: () => void;
  cupStatus?: Pick<ModeStatus, 'line' | 'live' | 'ready' | 'lastPlayedAt'>;
}) {
  const [filter, setFilter] = useState<'all' | 'quick' | 'runs' | 'online'>(
    'all',
  );
  const st = playStatus(pool, ut, week),
    recent = continueRun(st);
  const topCards = useSquadCards(pool, ut, 3),
    stars = topCards.slice(0, 2).map((rc) => rc.line);
  const modes: {
    id: string;
    title: string;
    /** Claude UI pass: the few words a tile shows (the purpose stays in its accessible name) */
    tag: string;
    purpose: string;
    session: string;
    team: string;
    difficulty: string;
    group: 'quick' | 'runs';
    icon: React.ReactNode;
    status: ModeStatus | NonNullable<typeof cupStatus>;
    go: () => void;
    tone: string;
  }[] = [
    {
      id: 'battles',
      tag: 'Climb the weekly AI ladder',
      title: 'Squad Battles',
      purpose: 'Pick your difficulty and climb the weekly AI ladder.',
      session: 'One match at a time',
      team: 'Your squad',
      difficulty: 'Rookie to Legend',
      group: 'quick',
      icon: <IconBattles size={23} />,
      status: st.battles,
      go: () => onGo('battles'),
      tone: 'teal',
    },
    ...(onCup
      ? [
          {
            id: 'cup',
            tag: 'Three-round knockout',
            title: 'Club Cups',
            purpose:
              'Win three knockout rounds to lift a trophy. A loss ends the run.',
            session: '3-match bracket',
            team: 'Your squad',
            difficulty: 'Choose difficulty',
            group: 'runs' as const,
            icon: <IconCrown size={23} />,
            status: cupStatus ?? {
              line: 'Open, Silver and Chemistry brackets',
            },
            go: onCup,
            tone: 'gold',
          },
        ]
      : []),
    ...(pool.sport !== 'soccer'
      ? [
          {
            id: 'league',
            tag: pickFor(pool.sport, {
              nba: '82 games · playoffs',
              nfl: '17 games · playoffs',
              soccer: 'Full season',
            }),
            title: 'Club Season',
            purpose: 'Build a record, scout opponents and chase the playoffs.',
            session: pickFor(pool.sport, {
              nba: '82-game season',
              nfl: '17-game season',
              soccer: 'Full season',
            }),
            team: 'Your squad',
            difficulty: 'Adaptive AI',
            group: 'runs' as const,
            icon: <IconLeague size={23} />,
            status: st.league,
            go: () => onGo('league'),
            tone: 'gold',
          },
          {
            id: 'events',
            tag: 'Beat all-time teams',
            title: 'Legends Events',
            purpose: 'Beat themed all-time teams for first-clear pack rewards.',
            session: '3-stage series',
            team: 'Your squad',
            difficulty: 'Rising challenge',
            group: 'runs' as const,
            icon: <IconCrown size={23} />,
            status: st.events,
            go: () => onGo('events'),
            tone: 'violet',
          },
          {
            id: 'moments',
            tag: 'Quick skill scenarios',
            title: 'Moments',
            purpose:
              'Practice a skill in a short scenario and earn its reward.',
            session: 'Short scenarios',
            team: 'Your squad',
            difficulty: 'Skill challenges',
            group: 'quick' as const,
            icon: <IconBolt size={23} />,
            status: st.moments,
            go: () => onGo('moments'),
            tone: 'blue',
          },
        ]
      : []),
    {
      id: 'circuit',
      tag: 'Six-game weekly run',
      title: 'Champions Circuit',
      purpose: 'Play all six games; wins build toward weekly milestone prizes.',
      session: '6-match run',
      team: 'Your squad',
      difficulty: 'Rising challenge',
      group: 'runs',
      icon: <IconRoute size={23} />,
      status: st.circuit,
      go: () => onGo('circuit'),
      tone: 'gold',
    },
    {
      id: 'draft',
      tag: 'Draft stars · win to keep going',
      title: 'UT Draft',
      purpose: 'Pick a temporary team from star cards. A loss ends the run.',
      session: 'Up to 4 matches',
      team: 'Drafted squad',
      difficulty: 'Rising challenge',
      group: 'runs',
      icon: <IconDraft size={23} />,
      status: st.draft,
      go: () => onGo('draft'),
      tone: 'teal',
    },
  ];
  const cupResume =
    onCup &&
    cupStatus?.live &&
    (!recent || (cupStatus.lastPlayedAt ?? 0) > (recent.lastPlayedAt ?? 0));
  const recommendation = !ut.starterClaimed
    ? {
        art: 'starter',
        title: 'Start with your free squad',
        line: 'Open the Starter Pack, then build your lineup before your first match.',
        action: 'OPEN STARTER PACK',
        go: () => onGo('store'),
      }
    : cupResume
      ? {
          art: 'cup',
          title: 'Continue Club Cups',
          line: cupStatus!.line,
          action: 'CONTINUE BRACKET',
          go: onCup!,
        }
      : recent
        ? {
            art: recent.view,
            title:
              'Continue ' +
              (modes.find((m) => m.id === recent.view)?.title ?? 'your run'),
            line: recent.line,
            action: 'CONTINUE RUN',
            go: () => onGo(recent.view),
          }
        : onCup && cupStatus?.ready
          ? {
              art: 'cup',
              title: 'Your Cup result is ready',
              line: cupStatus.line,
              action: 'VIEW CUP RESULT',
              go: onCup,
            }
          : st.draft.ready && st.draft.line.startsWith('Run over')
            ? {
                art: 'draft',
                title: 'Your draft rewards are ready',
                line: st.draft.line,
                action: 'CLAIM DRAFT REWARDS',
                go: () => onGo('draft'),
              }
            : {
                art: 'battles',
                title: 'Find your rhythm',
                line: 'Squad Battles is a single match with a difficulty you choose. Start here, then try a run.',
                action: 'PLAY SQUAD BATTLES',
                go: () => onGo('battles'),
              };
  const r = rivalsOf(ut.rivals, weekKey(easternDateKey())),
    division = divisionOf(r.points),
    d = DIVISIONS[division],
    next = DIVISIONS[division + 1];
  const visible = modes.filter((m) => filter === 'all' || m.group === filter);
  const filters = ['all', 'quick', 'runs', 'online'] as const;
  return (
    <div className="page hq-page up play-discovery">
      <div
        className="play-filter"
        role="group"
        aria-label="Choose a play session"
        style={{ '--i': filters.indexOf(filter) } as React.CSSProperties}
      >
        <span className="play-filter-ind" aria-hidden="true" />
        {filters.map((id) => (
          <button
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {
              {
                all: 'ALL MODES',
                quick: 'QUICK PLAY',
                runs: 'RUNS',
                online: 'ONLINE',
              }[id]
            }
          </button>
        ))}
      </div>
      {filter === 'all' && (
        <div className={'play-next rise-in art-' + recommendation.art}>
          <span className="play-next-art" aria-hidden="true">
            {recommendation.art === 'battles' && topCards.length ? (
              <SquadFan cards={topCards} />
            ) : (
              <ModeArt
                id={recommendation.art}
                stars={stars}
                sport={pool.sport}
              />
            )}
          </span>
          <span className="play-next-copy">
            <span className="eyebrow">YOUR NEXT PLAY</span>
            <b className="disp">{recommendation.title}</b>
            <p>{recommendation.line}</p>
          </span>
          <button className="btn gold" onClick={recommendation.go}>
            <IconPlay size={17} />
            {recommendation.action}
          </button>
        </div>
      )}
      {filter !== 'online' && (
        <>
          <SectionHead
            title={
              filter === 'quick'
                ? 'One game or a quick challenge'
                : filter === 'runs'
                  ? 'A run to build and come back to'
                  : 'Solo · against the AI'
            }
          />
          <div className="play-mode-list up-list">
            {visible.map((m, i) => (
              <button
                key={m.id}
                className={
                  'hq-mode ut-row play-mode rise-in tone-' +
                  m.tone +
                  ' m-' +
                  m.id +
                  (m.status.live ? ' live' : '') +
                  (m.status.ready ? ' ready' : '')
                }
                style={stagger(i)}
                onClick={m.go}
                aria-label={
                  m.title.toUpperCase() +
                  ': ' +
                  m.purpose +
                  ' ' +
                  m.session +
                  '. ' +
                  m.team +
                  '. ' +
                  m.difficulty +
                  '. ' +
                  m.status.line
                }
              >
                <span className="play-mode-art" aria-hidden="true">
                  <ModeArt id={m.id} stars={stars} sport={pool.sport} />
                </span>
                <span
                  className="play-mode-icon hq-mode-icon"
                  aria-hidden="true"
                >
                  {m.icon}
                </span>
                <span className="play-mode-copy">
                  {(m.status.live || m.status.ready) && (
                    <em className="play-mode-flag">
                      {m.status.live
                        ? 'CONTINUE'
                        : m.id === 'draft' &&
                            m.status.line.startsWith('Run over')
                          ? 'CLAIM'
                          : m.id === 'cup'
                            ? 'RESULT READY'
                            : m.id === 'draft' || m.id === 'circuit'
                              ? 'FREE ENTRY'
                              : 'REWARD READY'}
                    </em>
                  )}
                  <b className="disp">{m.title.toUpperCase()}</b>
                  <span className="play-mode-tag">{m.tag}</span>
                  {(m.status.live || m.status.ready) && (
                    <small className="play-mode-status">{m.status.line}</small>
                  )}
                </span>
                <HQArrow />
              </button>
            ))}
          </div>
        </>
      )}
      {(filter === 'all' || filter === 'online') && (
        <>
          <SectionHead title="Online · against real players" />
          <div
            className="up-rivals"
            style={{ '--division': d.color } as React.CSSProperties}
          >
            <button
              className="up-rivals-top"
              onClick={() => onGo('rivals')}
              aria-label={
                'Rivals: ' + st.rivals.line + '. Division and rewards'
              }
            >
              <DivisionBadge division={division} />
              <span>
                <i className="eyebrow">
                  RIVALS · WEEK {weekKey(easternDateKey()).split('W')[1]}
                </i>
                <b className="disp">{d.name} division</b>
                <small>
                  {r.points} RP · {r.w}W {r.l}L
                  {next
                    ? ' · ' + (next.at - r.points) + ' RP to ' + next.name
                    : ''}
                </small>
                <span className="up-rivals-meter" aria-hidden="true">
                  <i
                    style={{
                      width: next
                        ? Math.min(
                            100,
                            (100 * (r.points - d.at)) / (next.at - d.at),
                          ) + '%'
                        : '100%',
                    }}
                  />
                </span>
              </span>
              {st.rivals.ready ? (
                <em className="ut-row-pill">CLAIM</em>
              ) : (
                <HQArrow />
              )}
            </button>
            <p className="play-online-note">
              Your squad · Highest difficulty · Weekly division rewards. Only
              real-player matches earn Rivals progress.
            </p>
            <button className="btn primary up-find" onClick={onOnline}>
              <IconPlay size={18} />
              FIND MATCH
            </button>
          </div>
        </>
      )}
      <details className="play-reward-guide">
        <summary>How match rewards work</summary>
        <p>
          Your first eight standard UT matches each day pay coins and card XP;
          your first sixteen earn Season Points. Mode prizes use their own claim
          rules. UT Draft uses a temporary drafted squad, and Moments uses its
          scenario lineup.
        </p>
      </details>
    </div>
  );
}
// Claude, 2026-11-01 (UI reorganisation): the Season Pass as one compact horizontal track (was 25
// tall rows, about five screens) that opens scrolled to your current level.
export function SeasonView({
  ut,
  day,
  sport,
  onClaim,
  onClaimReady,
  onStore,
}: {
  ut: UtState;
  day: string;
  sport: UtSport;
  onClaim: (period: string, tier: number) => void;
  onClaimReady: (period: string) => void;
  onStore: () => void;
}) {
  const h = hqOf(ut),
    current = seasonFor(day),
    [chosen, setChosen] = useState<string | null>(null),
    period = chosen && h.seasons[chosen] ? chosen : current.id,
    s = h.seasons[period] ?? { xp: 0, claimed: [] },
    level = Math.min(SEASON_TIERS, Math.floor(s.xp / SEASON_STEP)),
    ready = seasonReady(ut, period),
    previousReady = Object.keys(h.seasons).filter(
      (p) => p !== current.id && seasonReady(ut, p) > 0,
    );
  const periods = [
    current.id,
    ...Object.keys(h.seasons)
      .filter((k) => k !== current.id)
      .reverse(),
  ];
  const track = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // open on the first unclaimed reward, or the next one to earn
    const el = track.current;
    if (!el) return;
    const first =
      Array.from({ length: SEASON_TIERS }, (_, i) => i + 1).find(
        (t) => !s.claimed.includes(t),
      ) ?? SEASON_TIERS;
    const target = el.querySelector<HTMLElement>(
      '[data-tier="' + Math.min(first, level + 1, SEASON_TIERS) + '"]',
    );
    if (target)
      el.scrollLeft = Math.max(
        0,
        target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2,
      );
  }, [period]);
  const fmt = (d: string) =>
    new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  return (
    <div className="page hq-page sp-page">
      <div className="sp-head rise-in">
        <span className="sp-level">
          <b className="disp num">{level}</b>
          <i>/ {SEASON_TIERS}</i>
        </span>
        <span className="sp-head-txt">
          <i className="eyebrow">
            {period === current.id
              ? 'SEASON ' +
                String(current.number).padStart(2, '0') +
                ' · ' +
                fmt(current.start) +
                ' – ' +
                fmt(current.end)
              : 'SEASON ' + period.split(':')[1] + ' · EARLIER'}
          </i>
          <ProgressBar
            value={s.xp}
            max={SEASON_TIERS * SEASON_STEP}
            label="Season Pass progress"
          />
          <small>
            {s.xp.toLocaleString('en-US')} Season Points ·{' '}
            {level === SEASON_TIERS
              ? 'track complete'
              : SEASON_STEP -
                (s.xp % SEASON_STEP) +
                ' SP to level ' +
                (level + 1)}
          </small>
        </span>
      </div>
      {ready > 0 && (
        <button
          className="btn gold hq-wide"
          onClick={() => onClaimReady(period)}
        >
          CLAIM READY ({ready})
        </button>
      )}
      {period === current.id && previousReady.length > 0 && (
        <button
          className="hq-banked-season"
          onClick={() => setChosen(previousReady[0])}
        >
          <span>
            <b>EARLIER REWARDS WAITING</b>
            <small>Your earlier Season Pass rewards never expire.</small>
          </span>
          <HQArrow />
        </button>
      )}
      <div className="ut-sechead">
        <h2 className="eyebrow">25 free levels</h2>
        {periods.length > 1 && (
          <label className="sp-select">
            <span className="sr-only">Season</span>
            <select value={period} onChange={(e) => setChosen(e.target.value)}>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p === current.id
                    ? 'This season'
                    : 'Season ' + p.split(':')[1]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div
        className="sp-track"
        ref={track}
        role="list"
        aria-label="Season Pass levels"
      >
        {Array.from({ length: SEASON_TIERS }, (_, i) => i + 1).map((tier) => {
          const reward = seasonReward(tier),
            claimed = s.claimed.includes(tier),
            unlocked = s.xp >= tier * SEASON_STEP;
          return (
            <div
              key={tier}
              role="listitem"
              data-tier={tier}
              className={
                'sp-tier' +
                (claimed ? ' claimed' : unlocked ? ' ready' : '') +
                (tier === level + 1 ? ' next' : '') +
                (tier === SEASON_TIERS ? ' finale' : '')
              }
            >
              <span className="sp-tier-n num">{tier}</span>
              <span className="sp-tier-art">
                {reward.pack ? (
                  <PackArt
                    kind={reward.pack}
                    label={reward.pack.toUpperCase()}
                    sport={sport}
                    small
                  />
                ) : (
                  <Coin size={28} />
                )}
              </span>
              <small>{rewardLabel(reward)}</small>
              <button
                className={'sp-tier-btn' + (unlocked && !claimed ? ' on' : '')}
                disabled={!unlocked || claimed}
                onClick={() => onClaim(period, tier)}
                aria-label={
                  claimed
                    ? 'Level ' + tier + ' claimed'
                    : unlocked
                      ? 'CLAIM'
                      : 'Level ' +
                        tier +
                        ' locked: ' +
                        (tier * SEASON_STEP).toLocaleString('en-US') +
                        ' SP'
                }
              >
                {claimed ? (
                  <IconCheck size={16} />
                ) : unlocked ? (
                  'CLAIM'
                ) : (
                  <span className="num">
                    {(tier * SEASON_STEP).toLocaleString('en-US')}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <button className="hq-text-button sp-store" onClick={onStore}>
        PACKS YOU’VE EARNED ARE IN THE STORE <HQArrow />
      </button>
      <p className="note">
        Every match, objective and SBC earns Season Points. Unlocked rewards
        stay claimable after the season ends. Spotlight Packs use their
        published odds and don’t guarantee a GOAT.
      </p>
    </div>
  );
}
/** "Today", "Week 44", or a short date for an earlier day (never a raw date key). */
function periodLabel(group: string, period: string, day: string): string {
  if (group === 'weekly') return 'WEEK ' + (period.split('W')[1] ?? period);
  if (period === day) return 'TODAY';
  const d = new Date(period + 'T12:00:00Z');
  return isNaN(+d)
    ? period
    : d
        .toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })
        .toUpperCase();
}
export function ObjectivesView({
  ut,
  day,
  onClaim,
  onClaimAll,
}: {
  ut: UtState;
  day: string;
  onClaim: (id: string) => void;
  onClaimAll: () => void;
}) {
  const [group, setGroup] = useState<
      'daily' | 'weekly' | 'lifetime' | 'banked'
    >('daily'),
    all = objectiveDeck(ut, day),
    ready = all.filter((o) => !o.claimed && o.progress >= o.target),
    banked = all.filter(
      (o) =>
        o.group !== 'lifetime' &&
        o.period !==
          (o.group === 'daily'
            ? day
            : all.find((x) => x.group === 'weekly')?.period),
    );
  const rows =
    group === 'banked'
      ? banked
      : all.filter((o) => o.group === group && !banked.includes(o));
  return (
    <div className="page hq-page">
      <Lede>
        Daily, weekly and club goals. Each pays coins, packs and Season Points.
      </Lede>
      <div className="hq-objective-summary">
        <span>
          <b className="disp num">{ready.length}</b> REWARDS READY
        </span>
        <button
          className="btn primary"
          disabled={!ready.length}
          onClick={onClaimAll}
        >
          CLAIM READY
        </button>
      </div>
      <div className="hq-filter" role="group" aria-label="Objective group">
        {(['daily', 'weekly', 'lifetime', 'banked'] as const).map((g) => (
          <button
            key={g}
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
          >
            {g === 'banked' ? 'SAVED' : g.toUpperCase()}
            {g === 'banked' && banked.length > 0 && <b>{banked.length}</b>}
          </button>
        ))}
      </div>
      <div className="hq-objectives">
        {rows.map((o) => (
          <div
            key={o.id}
            className={
              'hq-objective' +
              (o.claimed ? ' claimed' : o.progress >= o.target ? ' ready' : '')
            }
          >
            <span className="eyebrow">
              {o.group === 'lifetime'
                ? 'CLUB MILESTONE'
                : periodLabel(o.group, o.period, day)}
            </span>
            <div className="hq-objective-title">
              <h3 className="disp">{o.title}</h3>
              {o.claimed && <IconCheck />}
            </div>
            <p>{o.text}</p>
            <div className="hq-objective-meter">
              <ProgressBar value={o.progress} max={o.target} label={o.text} />
              <b className="num">
                {o.progress} / {o.target}
              </b>
            </div>
            <div className="hq-objective-prize">
              <small>{rewardLabel(o.reward)}</small>
              <button
                className="chip"
                disabled={o.claimed || o.progress < o.target}
                onClick={() => onClaim(o.id)}
              >
                {o.claimed
                  ? 'CLAIMED'
                  : o.progress >= o.target
                    ? 'CLAIM REWARD'
                    : 'IN PROGRESS'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && (
        <div className="empty">
          No unclaimed rewards from previous days or weeks. Completed rewards
          will stay here until you claim them.
        </div>
      )}
      <p className="note">
        Match objectives count your settled UT matches. Development programs
        require manually played matches. Completed objectives remain claimable
        after their period ends.
      </p>
    </div>
  );
}
export function CircuitView({
  ut,
  week,
  ready,
  onStart,
  onPlay,
  onSquad,
  onEnd,
}: {
  ut: UtState;
  week: string;
  ready: boolean;
  onStart: () => void;
  onPlay: (runId: string, round: number) => void;
  onSquad: () => void;
  onEnd: () => void;
}) {
  const c = circuitOf(ut, week),
    a = c.active,
    [ending, setEnding] = useState(false);
  return (
    <div className="page hq-page">
      <Lede>
        Six matches against tougher squads. All six count; rewards at 2, 4 and 6
        wins, once a week.
      </Lede>
      <div className="hq-circuit-stats compact">
        <span>
          <b className="disp num">{a?.wins ?? c.best}</b>
          <i>{a ? 'WINS THIS RUN' : 'WEEKLY BEST'}</i>
        </span>
        <span>
          <b className="disp num">
            {c.entries} / {CIRCUIT_ENTRIES}
          </b>
          <i>FREE ENTRIES USED</i>
        </span>
      </div>
      {a ? (
        <div className="hq-panel">
          <div className="hq-section-head">
            <span className="eyebrow">YOUR RUN · {a.games} / 6 PLAYED</span>
            <button className="chip" onClick={() => setEnding(true)}>
              END ENTRY
            </button>
          </div>
          <div className="hq-circuit-path">
            {Array.from({ length: CIRCUIT_GAMES }, (_, i) => (
              <span
                key={i}
                className={
                  i < a.games
                    ? a.results[i]
                      ? 'win'
                      : 'loss'
                    : i === a.games
                      ? 'current'
                      : ''
                }
              >
                <b className="num">
                  {i < a.games
                    ? a.results[i]
                      ? 'W'
                      : 'L'
                    : String(i + 1).padStart(2, '0')}
                </b>
                <small>
                  {i === 5 ? 'FINALE' : i === a.games ? 'UP NEXT' : 'MATCH'}
                </small>
              </span>
            ))}
          </div>
          <button
            className="btn primary hq-wide"
            onClick={() => (ready ? onPlay(a.id, a.games) : onSquad())}
          >
            {ready ? 'PLAY MATCH ' + (a.games + 1) : 'BUILD YOUR SQUAD'}{' '}
            <IconPlay size={17} />
          </button>
          {c.week !== week && (
            <p className="note">
              Finish your previous-week entry before opening this week’s free
              entries. Earned prizes are kept.
            </p>
          )}
        </div>
      ) : (
        <div className="hq-panel">
          <span className="eyebrow">A FRESH SHOT AT YOUR BEST</span>
          <p>
            A loss doesn’t end the entry: play all six and keep your best
            result.
          </p>
          <button
            className="btn primary hq-wide"
            disabled={c.entries >= CIRCUIT_ENTRIES}
            onClick={() => (ready ? onStart() : onSquad())}
          >
            {!ready
              ? 'BUILD YOUR SQUAD'
              : c.entries >= 3
                ? 'NEW ENTRIES NEXT WEEK'
                : 'ENTER FREE'}{' '}
            <HQArrow />
          </button>
        </div>
      )}
      <SectionHead title="Best-result rewards" />
      <div className="hq-circuit-prizes">
        {CIRCUIT_PRIZES.map((p) => (
          <div
            key={p.wins}
            className={
              'hq-objective' + (c.claimed.includes(p.wins) ? ' claimed' : '')
            }
          >
            <span className="hq-prize-number disp num">
              {p.wins}
              <small>WINS</small>
            </span>
            <div>
              <h3 className="disp">{p.title}</h3>
              <p>
                {p.coins} coins ·{' '}
                {p.pack === 'spotlight'
                  ? 'Spotlight'
                  : p.pack === 'gold'
                    ? 'Gold'
                    : 'Silver'}{' '}
                Pack
              </p>
              <small>
                {c.claimed.includes(p.wins)
                  ? 'EARNED · IN YOUR CLUB'
                  : 'Beat your weekly best to unlock'}
              </small>
            </div>
            {c.claimed.includes(p.wins) && <IconCheck />}
          </div>
        ))}
      </div>
      <p className="note">
        AI opponents rise toward Legend difficulty in the finale. Each weekly
        milestone pays once and lands in your club automatically.
      </p>
      {ending && (
        <Confirm
          title="End this Circuit entry?"
          body="Your earned milestone prizes are kept. This free entry remains used; starting another needs an available weekly entry."
          yes="END ENTRY"
          no="KEEP PLAYING"
          onNo={() => setEnding(false)}
          onYes={() => {
            setEnding(false);
            onEnd();
          }}
        />
      )}
    </div>
  );
}
export function DevelopmentView({
  ut,
  club,
  onStart,
  onCancel,
  onClaim,
  onSquad,
  onUseCopy,
  onEvolutions,
}: {
  ut: UtState;
  club: ClubCard[];
  onStart: (uid: string, path: string) => void;
  onCancel: () => void;
  onClaim: () => void;
  onSquad: () => void;
  onUseCopy: (uid: string) => void;
  /** Claude wave 2: the Evolutions lab (stat upgrades) next to these XP programs */
  onEvolutions?: () => void;
}) {
  const h = hqOf(ut),
    [query, setQuery] = useState(''),
    [limit, setLimit] = useState(60),
    a = h.development.active,
    p = DEVELOPMENT_PATHS.find((p) => p.id === a?.path),
    [path, setPath] = useState('breakout'),
    [selected, setSelected] = useState<string | null>(null),
    [cancel, setCancel] = useState(false),
    eligible = club.filter(
      (c) => !c.storage && c.oc.level < 5 && !h.development.completed[c.uid],
    ),
    filtered = eligible.filter((c) =>
      c.rc.line.name.toLowerCase().includes(query.trim().toLowerCase()),
    ),
    chosen = eligible.find((c) => c.uid === selected),
    active = club.find((c) => c.uid === a?.uid),
    ready = developmentReady(ut);
  return (
    <div className="page hq-page">
      <Lede>
        Pick one of your cards and play with it: a program pays card XP, an
        Evolution raises its ratings for good.
      </Lede>
      {onEvolutions && (
        <button className="hq-mode hq-mode-draft" onClick={onEvolutions}>
          <IconSquad size={30} />
          <span>
            <i className="eyebrow">STAT UPGRADES · UP TO 3 AT ONCE</i>
            <b className="disp">EVOLUTIONS LAB</b>
            <small>
              Play with a card to raise its overall and attributes for good.
            </small>
          </span>
          <HQArrow />
        </button>
      )}
      {a && p ? (
        <div className="hq-development-active">
          <div className="hq-development-card">
            {active && (
              <UtCard
                rc={active.rc}
                w={116}
                level={active.oc.level}
                mint={active.oc.mint}
                numbered
              />
            )}
            <span>
              <i className="eyebrow">{p.title.toUpperCase()} PROGRAM</i>
              <h2 className="disp">
                {active?.rc.line.name ?? 'Your selected player'}
              </h2>
              <small>
                Manually played squad matches · {p.xp} card XP + {p.sp} SP
              </small>
              <b
                className={
                  'hq-copy-status' +
                  (Object.values(ut.squad).includes(a.uid) ? ' equipped' : '')
                }
              >
                {active?.storage
                  ? 'COPY IN DUPLICATE STORAGE'
                  : Object.values(ut.squad).includes(a.uid)
                    ? 'IN YOUR MATCH SQUAD'
                    : 'ADD THIS COPY TO YOUR SQUAD'}
              </b>
            </span>
          </div>
          <div className="hq-goal">
            <span>
              Squad matches{' '}
              <b className="num">
                {Math.min(a.games, p.games)} / {p.games}
              </b>
            </span>
            <ProgressBar
              value={a.games}
              max={p.games}
              label="Development played matches"
            />
          </div>
          {p.wins > 0 && (
            <div className="hq-goal">
              <span>
                Wins{' '}
                <b className="num">
                  {Math.min(a.wins, p.wins)} / {p.wins}
                </b>
              </span>
              <ProgressBar
                value={a.wins}
                max={p.wins}
                label="Development wins"
              />
            </div>
          )}
          {active?.storage && (
            <button className="btn hq-wide" onClick={() => onUseCopy(a.uid)}>
              RETURN THIS COPY TO CLUB <HQArrow />
            </button>
          )}
          <button
            className="btn primary hq-wide"
            onClick={ready ? onClaim : onSquad}
          >
            {ready ? 'CLAIM DEVELOPMENT BOOST' : 'MANAGE SQUAD'} <HQArrow />
          </button>
          <button className="hq-text-button" onClick={() => setCancel(true)}>
            CANCEL PROGRAM
          </button>
          <p className="note">
            Keep this exact copy in your match squad. Simulated matches do not
            advance the program. Normal rating caps and maximum level 5 still
            apply.
          </p>
        </div>
      ) : (
        <>
          <div
            className="hq-paths"
            role="group"
            aria-label="Development program"
          >
            {DEVELOPMENT_PATHS.map((p) => (
              <button
                key={p.id}
                aria-pressed={path === p.id}
                onClick={() => setPath(p.id)}
              >
                <b className="disp">{p.title}</b>
                <small>
                  {p.games} played matches
                  {p.wins ? ' · ' + p.wins + ' wins' : ''}
                </small>
                <span className="num">+{p.xp} XP</span>
              </button>
            ))}
          </div>
          <div className="hq-section-head">
            <span className="eyebrow">SELECT YOUR OWNED COPY</span>
            <small>{eligible.length} eligible</small>
          </div>
          <label className="hq-player-search">
            FIND A PLAYER
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(60);
              }}
              placeholder="Search your club"
            />
          </label>
          <div className="hq-development-choices">
            {filtered.slice(0, limit).map((c) => (
              <button
                key={c.uid}
                aria-pressed={selected === c.uid}
                onClick={() => setSelected(c.uid)}
                aria-label={
                  'Develop ' + c.rc.line.name + ', level ' + c.oc.level
                }
              >
                <UtCard
                  rc={c.rc}
                  w={72}
                  level={c.oc.level}
                  mint={c.oc.mint}
                  numbered
                />
                <small>{c.rc.line.name}</small>
              </button>
            ))}
          </div>
          {filtered.length > limit && (
            <button className="chip" onClick={() => setLimit((n) => n + 60)}>
              SHOW MORE PLAYERS
            </button>
          )}
          {eligible.length > 0 && !filtered.length && (
            <div className="empty">No players match that search.</div>
          )}
          {!eligible.length && (
            <div className="empty">
              Your current club copies are at maximum level or have completed
              their program. New eligible copies can join when you earn them.
            </div>
          )}
          <button
            className="btn primary hq-wide"
            disabled={!chosen}
            onClick={() => chosen && onStart(chosen.uid, path)}
          >
            {chosen
              ? 'START WITH ' + chosen.rc.line.name.toUpperCase()
              : 'CHOOSE A PLAYER'}{' '}
            <HQArrow />
          </button>
        </>
      )}
      <p className="note">
        One completed program per owned copy. Selling or using the selected copy
        in an SBC ends its unfinished program without changing your other cards.
      </p>
      {cancel && (
        <Confirm
          title="Cancel this program?"
          body="The card and its earned XP stay in your club. This program’s unfinished objectives start again if you re-enroll."
          yes="CANCEL PROGRAM"
          no="KEEP PROGRAM"
          onNo={() => setCancel(false)}
          onYes={() => {
            setCancel(false);
            onCancel();
          }}
        />
      )}
    </div>
  );
}
export function SquadPresets({
  ut,
  pool,
  onSave,
  onLoad,
}: {
  ut: UtState;
  pool: Pool;
  onSave: (id: number, name: string) => void;
  onLoad: (id: number) => void;
}) {
  const [open, setOpen] = useState(false),
    [names, setNames] = useState<Record<number, string>>({}),
    h = hqOf(ut);
  return (
    <>
      <button className="chip" onClick={() => setOpen(true)}>
        LINEUPS
      </button>
      {open && (
        <Sheet label="Saved lineups" onClose={() => setOpen(false)}>
          {(close) => (
            <div className="hq-preset-sheet">
              <span className="eyebrow">YOUR SQUAD, READY WHEN YOU ARE</span>
              <h2 className="disp">SAVED LINEUPS</h2>
              <p>
                Save three combinations of your owned cards. Loading a lineup
                never creates or consumes a copy.
              </p>
              {[0, 1, 2].map((id) => {
                const p = h.presets.find((p) => p.id === id),
                  uids = p ? Object.values(p.squad) : [],
                  count = uids.filter((uid) =>
                    ut.owned.some((c) => c.uid === uid),
                  ).length;
                return (
                  <div className="hq-preset" key={id}>
                    <span className="hq-preset-id disp num">0{id + 1}</span>
                    <div>
                      <label>
                        LINEUP NAME
                        <input
                          maxLength={22}
                          value={names[id] ?? p?.name ?? 'Squad ' + (id + 1)}
                          onChange={(e) =>
                            setNames((n) => ({ ...n, [id]: e.target.value }))
                          }
                        />
                      </label>
                      <small>
                        {p
                          ? count + ' owned cards · ' + pool.sport.toUpperCase()
                          : 'Empty preset'}
                      </small>
                    </div>
                    <div className="hq-preset-actions">
                      <button
                        className="chip"
                        disabled={!Object.keys(ut.squad).length}
                        onClick={() =>
                          onSave(
                            id,
                            names[id] ?? p?.name ?? 'Squad ' + (id + 1),
                          )
                        }
                      >
                        SAVE CURRENT
                      </button>
                      <button
                        className="chip primary"
                        disabled={!p || !count}
                        onClick={() => {
                          onLoad(id);
                          setOpen(false);
                        }}
                      >
                        LOAD
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="note">
                Saving replaces that preset’s saved selection. Sold or
                SBC-consumed copies are removed from presets; incomplete lineups
                can be finished in the squad builder.
              </p>
              <button className="btn" onClick={() => close()}>
                CLOSE
              </button>
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
export function ClubRecords({ ut }: { ut: UtState }) {
  const h = hqOf(ut),
    history = [...h.history].reverse();
  return (
    <div className="page hq-page">
      <Lede>
        Every Ultimate Team result your club has played, newest first.
      </Lede>
      <div className="hq-record-totals">
        <span>
          <b className="disp num">{ut.record.w + ut.record.h2hW}</b>
          <small>WINS</small>
        </span>
        <span>
          <b className="disp num">{ut.record.l + ut.record.h2hL}</b>
          <small>LOSSES</small>
        </span>
        <span>
          <b className="disp num">{ut.packsOpened}</b>
          <small>PACKS OPENED</small>
        </span>
        <span>
          <b className="disp num">{ut.sold.coins.toLocaleString('en-US')}</b>
          <small>QUICK-SELL COINS</small>
        </span>
      </div>
      <SectionHead title="Recent form" />
      <div className="hq-form">
        {history.slice(0, 10).map((m) => (
          <i key={m.id} className={m.won ? 'win' : 'loss'}>
            {m.won ? 'W' : 'L'}
          </i>
        ))}
      </div>
      {history.map((m) => (
        <div className="hq-history" key={m.id}>
          <span className={'hq-result ' + (m.won ? 'win' : 'loss')}>
            {m.won ? 'W' : 'L'}
          </span>
          <span>
            <b>{m.opponent}</b>
            <small>
              {(
                {
                  league: 'CLUB SEASON',
                  online: 'RIVALS',
                  circuit: 'CHAMPIONS CIRCUIT',
                  event: 'LEGENDS EVENTS',
                  draft: 'UT DRAFT',
                  cup: 'CLUB CUPS',
                } as Record<string, string>
              )[m.mode] ?? 'SQUAD BATTLES'}{' '}
              · {new Date(m.at).toLocaleDateString()}
            </small>
          </span>
          <strong className="disp num">
            {m.us}–{m.them}
          </strong>
        </div>
      ))}
      {!history.length && (
        <EmptyState icon={<IconChart size={26} />} title="No matches yet">
          Your next Ultimate Team result shows up here.
        </EmptyState>
      )}
    </div>
  );
}
