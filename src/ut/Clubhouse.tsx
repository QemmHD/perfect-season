// Codex: clubhouse progression and competition surfaces in the existing Ultimate Team materials.
import React, { useState } from 'react';
import { Sheet, Confirm } from '../ui/common';
import { Coin, Trophy, Crown } from '../ui/icons';
import { IconCheck, IconPlay, IconSquad } from './icons';
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
  SEASON_STEP,
  SEASON_TIERS
} from './progression';
import {
  circuitOf,
  CIRCUIT_ENTRIES,
  CIRCUIT_GAMES,
  CIRCUIT_PRIZES
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
function ProgressBar({ value, max }: { value: number; max: number }) {
  return (
    <span
      className="hq-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <i
        style={{
          width:
            Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100)) + '%'
        }}
      />
    </span>
  );
}
export function SeasonRibbon({
  ut,
  day,
  onOpen
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
        n + Math.max(0, Math.floor(v.xp / SEASON_STEP) - v.claimed.length),
      0
    );
  return (
    <button
      className="hq-season-ribbon"
      onClick={onOpen}
      aria-label={season.title + ' rewards: ' + s.xp + ' season points'}
    >
      <span className="hq-season-number disp">
        {String(season.number).padStart(2, '0')}
      </span>
      <span>
        <b>
          {season.title.toUpperCase()} <i>FREE REWARDS</i>
        </b>
        <ProgressBar
          value={level === 25 ? 1 : s.xp % SEASON_STEP}
          max={level === 25 ? 1 : SEASON_STEP}
        />
        <small>
          LEVEL {level} / 25 ·{' '}
          {level === 25
            ? 'TRACK COMPLETE'
            : SEASON_STEP - (s.xp % SEASON_STEP) + ' SP TO NEXT REWARD'}
        </small>
      </span>
      <span className="hq-ribbon-end">
        {ready > 0 ? <b className="num">{ready}</b> : <HQArrow />}
      </span>
    </button>
  );
}
export function PlayHQ({
  onGo,
  onOnline
}: {
  onGo: (v: UtView) => void;
  onOnline: () => void;
}) {
  return (
    <div className="page hq-page">
      <div className="hq-page-heading">
        <span className="eyebrow">YOUR CLUB. YOUR COMPETITION.</span>
        <h1 className="disp">PLAY YOUR WAY.</h1>
        <p>
          Build a squad. Find your challenge. Bring home something worth
          earning.
        </p>
      </div>
      <button className="hq-mode hq-mode-gold" onClick={() => onGo('circuit')}>
        <Trophy size={42} />
        <span>
          <i className="eyebrow">SOLO · SIX-MATCH ENTRIES</i>
          <b className="disp">CHAMPIONS CIRCUIT</b>
          <small>
            Climb through tougher squads. Earn weekly best-result rewards.
          </small>
        </span>
        <HQArrow />
      </button>
      <div className="hq-mode-grid">
        <button className="hq-mode" onClick={() => onGo('moments')}>
          <span className="hq-mode-icon">
            <IconPlay size={29} />
          </span>
          <i className="eyebrow">SHORT SCENARIOS</i>
          <b className="disp">MOMENTS</b>
          <small>
            Take your own players into challenges that test your skill.
          </small>
          <span className="hq-action">
            TAKE THE STAGE <HQArrow />
          </span>
        </button>
        <button className="hq-mode" onClick={() => onGo('battles')}>
          <span className="hq-mode-icon">
            <IconSquad size={29} />
          </span>
          <i className="eyebrow">SOLO · FULL MATCHES</i>
          <b className="disp">SQUAD BATTLES</b>
          <small>
            Choose your difficulty and climb the existing weekly ladder.
          </small>
          <span className="hq-action">
            CLIMB THE LADDER <HQArrow />
          </span>
        </button>
      </div>
      <button className="hq-mode hq-mode-online" onClick={onOnline}>
        <span className="hq-online-dot" />
        <span>
          <i className="eyebrow">PLAYER MATCHMAKING</i>
          <b className="disp">HEAD TO HEAD</b>
          <small>
            Your squad against another player. Legend defense online.
          </small>
        </span>
        <HQArrow />
      </button>
      <button className="hq-mode" onClick={() => onGo('rivals')}>
        <Trophy size={28} />
        <span>
          <i className="eyebrow">ONLINE PROGRESSION</i>
          <b className="disp">DIVISION RIVALS</b>
          <small>
            Track your division, standings and earned weekly prizes.
          </small>
        </span>
        <HQArrow />
      </button>
      <button className="hq-mode" onClick={() => onGo('events')}>
        <Crown size={28} />
        <span>
          <i className="eyebrow">SOLO · SPOTLIGHT STORIES</i>
          <b className="disp">LEGENDS SERIES</b>
          <small>
            Take on the greats in themed events and earn Spotlight rewards.
          </small>
        </span>
        <HQArrow />
      </button>
      <div className="hq-footnote">
        Coins and card XP retain the existing eight-game daily limit. Your first
        sixteen UT matches can earn Season Points each day.
      </div>
    </div>
  );
}
export function SeasonView({
  ut,
  day,
  sport,
  onClaim,
  onStore
}: {
  ut: UtState;
  day: string;
  sport: UtSport;
  onClaim: (period: string, tier: number) => void;
  onStore: () => void;
}) {
  const h = hqOf(ut),
    current = seasonFor(day),
    [chosen, setChosen] = useState(current.id),
    period = chosen === current.id || h.seasons[chosen] ? chosen : current.id,
    s = h.seasons[period] ?? { xp: 0, claimed: [] },
    level = Math.min(25, Math.floor(s.xp / SEASON_STEP));
  const periods = [
    current.id,
    ...Object.keys(h.seasons)
      .filter((k) => k !== current.id)
      .reverse()
  ];
  return (
    <div className="page hq-page">
      <div className="hq-season-hero">
        <span className="eyebrow">
          EVERY REWARD IS EARNED. EVERY TIER IS FREE.
        </span>
        <h1 className="disp">
          YOUR SEASON.
          <br />
          YOUR LEGACY.
        </h1>
        <div className="hq-season-big">
          <b className="disp num">{level}</b>
          <span>
            LEVEL / 25
            <small>{s.xp.toLocaleString('en-US')} SEASON POINTS</small>
          </span>
          <Crown size={48} />
        </div>
        <ProgressBar value={s.xp} max={SEASON_TIERS * SEASON_STEP} />
        <p>
          {period === current.id
            ? 'Season ' +
              current.number +
              ' · ' +
              current.start +
              ' — ' +
              current.end
            : 'Your previously earned rewards are kept here.'}
        </p>
      </div>
      {periods.length > 1 && (
        <label className="hq-select-label">
          REWARD TRACK
          <select value={period} onChange={(e) => setChosen(e.target.value)}>
            {periods.map((p) => (
              <option key={p} value={p}>
                {p === current.id ? 'CURRENT · ' : ''}SEASON {p.split(':')[1]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="hq-section-head">
        <span className="eyebrow">25 LEVELS. NO PREMIUM TRACK.</span>
        <button className="chip" onClick={onStore}>
          YOUR PACKS <HQArrow />
        </button>
      </div>
      <div className="hq-tier-list">
        {Array.from({ length: 25 }, (_, i) => i + 1).map((tier) => {
          const reward = seasonReward(tier),
            claimed = s.claimed.includes(tier),
            unlocked = s.xp >= tier * SEASON_STEP;
          return (
            <div
              key={tier}
              className={
                'hq-tier' + (claimed ? ' claimed' : unlocked ? ' ready' : '')
              }
            >
              <span className="hq-tier-index disp num">
                {claimed ? <IconCheck /> : String(tier).padStart(2, '0')}
              </span>
              <span className="hq-tier-art">
                {reward.pack ? (
                  <PackArt
                    kind={reward.pack}
                    label={reward.pack.toUpperCase()}
                    sport={sport}
                    small
                  />
                ) : (
                  <Coin size={25} />
                )}
              </span>
              <span className="hq-tier-copy">
                <b>{rewardLabel(reward)}</b>
                <small>
                  {(tier * SEASON_STEP).toLocaleString('en-US')} SP
                  {tier === 25 ? ' · THE SEASON FINALE' : ''}
                </small>
              </span>
              <button
                className={'chip' + (unlocked && !claimed ? ' primary' : '')}
                disabled={!unlocked || claimed}
                onClick={() => onClaim(period, tier)}
              >
                {claimed ? (
                  'CLAIMED'
                ) : unlocked ? (
                  'CLAIM'
                ) : (
                  <>
                    <svg
                      width="12"
                      height="14"
                      viewBox="0 0 16 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <rect x="2" y="9" width="12" height="9" rx="2" />
                      <path d="M4 9V5a4 4 0 0 1 8 0v4" />
                    </svg>
                    <span className="sr-only">Locked</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <p className="note">
        Unlocked rewards stay claimable when the next season begins. Spotlight
        Packs retain their normal published odds; they do not guarantee a GOAT.
      </p>
    </div>
  );
}
export function ObjectivesView({
  ut,
  day,
  onClaim,
  onClaimAll
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
            : all.find((x) => x.group === 'weekly')?.period)
    );
  const rows =
    group === 'banked'
      ? banked
      : all.filter((o) => o.group === group && !banked.includes(o));
  return (
    <div className="page hq-page">
      <div className="hq-page-heading">
        <span className="eyebrow">A REASON FOR EVERY MATCH</span>
        <h1 className="disp">OBJECTIVES</h1>
        <p>
          Follow your own path. Earn coins, packs and Season Points across
          Ultimate Team.
        </p>
      </div>
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
              {o.group === 'lifetime' ? 'CLUB MILESTONE' : o.period}
            </span>
            <div className="hq-objective-title">
              <h3 className="disp">{o.title}</h3>
              {o.claimed && <IconCheck />}
            </div>
            <p>{o.text}</p>
            <div className="hq-objective-meter">
              <ProgressBar value={o.progress} max={o.target} />
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
  onEnd
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
      <div className="hq-circuit-hero">
        <Trophy size={54} />
        <span className="eyebrow">SOLO · WEEKLY COMPETITION</span>
        <h1 className="disp">
          CHAMPIONS
          <br />
          CIRCUIT
        </h1>
        <p>Six played matches. Tougher opponents. Make this your best run.</p>
        <div className="hq-circuit-stats">
          <span>
            <b className="disp num">{a?.wins ?? c.best}</b>
            <i>{a ? 'CURRENT WINS' : 'WEEKLY BEST'}</i>
          </span>
          <span>
            <b className="disp num">
              {c.entries} / {CIRCUIT_ENTRIES}
            </b>
            <i>FREE ENTRIES USED</i>
          </span>
        </div>
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
            All six matches count. A loss does not end the entry. Rewards are
            earned at two, four and six wins, once each week.
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
      <div className="hq-section-head">
        <h2 className="disp">PLAY FOR SOMETHING.</h2>
        <span className="eyebrow">BEST-RESULT REWARDS</span>
      </div>
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
                  ? 'EARNED · DEPOSITED TO YOUR CLUB'
                  : 'Beat your weekly best to unlock'}
              </small>
            </div>
            {c.claimed.includes(p.wins) && <IconCheck />}
          </div>
        ))}
      </div>
      <p className="note">
        Play all six matches on the court or field. Solo AI opponents rise toward Legend difficulty in the finale.
        First-time weekly milestones deposit automatically, including after
        reload. Your existing Squad Battles and online records remain.
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
  onSquad
}: {
  ut: UtState;
  club: ClubCard[];
  onStart: (uid: string, path: string) => void;
  onCancel: () => void;
  onClaim: () => void;
  onSquad: () => void;
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
      (c) => c.oc.level < 5 && !h.development.completed[c.uid]
    ),
    filtered = eligible.filter((c) =>
      c.rc.line.name.toLowerCase().includes(query.trim().toLowerCase())
    ),
    chosen = eligible.find((c) => c.uid === selected),
    active = club.find((c) => c.uid === a?.uid),
    ready = developmentReady(ut);
  return (
    <div className="page hq-page">
      <div className="hq-page-heading">
        <span className="eyebrow">BUILD A CLUB HERO</span>
        <h1 className="disp">DEVELOPMENT LAB</h1>
        <p>
          Choose one owned copy. Play with it in your squad. Earn a focused
          boost through the existing XP and level system.
        </p>
      </div>
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
            </span>
          </div>
          <div className="hq-goal">
            <span>
              Squad matches{' '}
              <b className="num">
                {Math.min(a.games, p.games)} / {p.games}
              </b>
            </span>
            <ProgressBar value={a.games} max={p.games} />
          </div>
          {p.wins > 0 && (
            <div className="hq-goal">
              <span>
                Wins{' '}
                <b className="num">
                  {Math.min(a.wins, p.wins)} / {p.wins}
                </b>
              </span>
              <ProgressBar value={a.wins} max={p.wins} />
            </div>
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
  onLoad
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
          {() => (
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
                    ut.owned.some((c) => c.uid === uid)
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
                            names[id] ?? p?.name ?? 'Squad ' + (id + 1)
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
      <div className="hq-page-heading">
        <span className="eyebrow">EVERY CLUB HAS A STORY</span>
        <h1 className="disp">CLUB RECORDS</h1>
        <p>
          Your existing wins and losses are retained. Recent match details and
          copy-level records begin with this clubhouse update.
        </p>
      </div>
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
      </div>
      <div className="hq-section-head">
        <h2 className="disp">RECENT FORM</h2>
        <small>LAST 20 MATCHES</small>
      </div>
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
              {m.mode === 'online'
                ? 'HEAD TO HEAD'
                : m.mode === 'circuit'
                  ? 'CHAMPIONS CIRCUIT'
                  : m.mode === 'event'
                    ? 'SPOTLIGHT SERIES'
                    : 'SQUAD BATTLES'}{' '}
              · {new Date(m.at).toLocaleDateString()}
            </small>
          </span>
          <strong className="disp num">
            {m.us}–{m.them}
          </strong>
        </div>
      ))}
      {!history.length && (
        <div className="empty">
          Your next settled Ultimate Team match starts this chapter. Existing
          records above are already yours.
        </div>
      )}
    </div>
  );
}
