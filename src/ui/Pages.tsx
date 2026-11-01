import { ArrowMark, DrillMark } from '../evolution/Marks';
import React, { useEffect, useMemo, useState } from 'react';
import { summarize } from '../engine/collection';
import { BOOSTER_HELP, BOOSTER_NAMES, BOOSTER_PRICES, BOOSTER_UNLOCK_LEVEL, RESPIN_PRICE, levelInfo } from '../engine/economy';
import { ROUNDS } from '../engine/draft';
import { gradeFor } from '../engine/rating';
import { pick, SOCCER_ON, SPORT, SPORT_LABEL, SPORT_NAME, type SportId } from '../engine/sport';
import { type Booster, BOOSTERS, type BotLevel, type Mode } from '../engine/types';
import { bestRuns, type Profile, type RunRecord } from '../lib/profile';
import { sfx } from '../lib/sound';
import { clearErrors, loggedErrors } from '../lib/errlog';
import { APP_VERSION } from '../lib/update';
import { useLayout, viewportInfo } from '../stage';
import type { OnlineCount } from '../net/match';
import { NET_ON } from '../net/nostr';
import { Fit, lastName, Sheet } from './common';
import { ArenaHero } from './Hero';
import { usePulse } from './motion';
import { GlobalBoard } from './Leaderboard';
import { StreakChip } from './Rewards';
import { FavoritesCard } from './Favorites';
import { Crown, Football, Home as HomeIcon, Hoop, Lock, Ranks as RanksIcon, SoccerBall, Target, User } from './icons';
import { FLOOR, PERFECT_PLAYOFFS, PERFECT_RECORD, record } from './sportui';

const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/** Basketball, football or soccer (Claude 2026-11-01): another one reloads the app into that sport. */
function SportSwitch({ onSport }: { onSport: (s: SportId) => void }) {
  const items: [SportId, string, React.ReactNode][] = [
    ['nba', 'NBA', <Hoop size={16} />],
    ['nfl', 'NFL', <Football size={16} />],
    ...(SOCCER_ON ? [['soccer', 'SOCCER', <SoccerBall size={16} />] as [SportId, string, React.ReactNode]] : []),
  ];
  const cur: SportId = SPORT;
  return (
    <div className={'sportswitch ' + cur + (items.length === 3 ? ' three' : '')} role="group" aria-label="Sport">
      <span className="ind" aria-hidden="true" />
      {items.map(([k, label, icon]) => (
        <button key={k} aria-pressed={cur === k} onClick={() => cur !== k && onSport(k)}>
          {icon}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

// Claude, 2026-11-01 (UI reorganisation, docs/UI-NAVIGATION.md): four main tabs. ULTIMATE TEAM opens
// the mode's own screen (it has its own tabs and an EXIT back here). The Daily lives on Home's Daily
// tile, Boosters in Profile, Missions and the Legends Gauntlet are sheets from Home's stat strip.
export type Tab = 'home' | 'ranks' | 'profile';
const TAB_ORDER: (Tab | 'ut')[] = ['home', 'ut', 'ranks', 'profile'];

export function Tabs({ tab, onTab, onUltimate, utNew }: { tab: Tab; onTab: (t: Tab) => void; onUltimate?: () => void; utNew?: boolean }) {
  const items: [Tab | 'ut', string, React.ReactNode][] = [
    ['home', 'HOME', <HomeIcon size={22} />],
    ['ut', 'ULTIMATE TEAM', <UtMark />],
    ['ranks', 'RANKS', <RanksIcon size={22} />],
    ['profile', 'PROFILE', <User size={22} />],
  ];
  return (
    <nav className="tabs" aria-label="Main">
      <span className="tab-ind" style={{ transform: 'translateX(' + TAB_ORDER.indexOf(tab) * 100 + '%)' }} aria-hidden="true" />
      {items
        .filter(([k]) => k !== 'ut' || onUltimate)
        .map(([k, label, icon]) =>
          k === 'ut' ? (
            <button key={k} className="tab-ut" onClick={onUltimate} aria-label={'Ultimate Team: ' + SPORT_NAME[SPORT] + ' packs, squads and challenges'}>
              {icon}
              <span>{label}</span>
              {utNew && <i className="tab-new">FREE</i>}
            </button>
          ) : (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => onTab(k)}>
              {icon}
              <span>{label}</span>
            </button>
          )
        )}
    </nav>
  );
}

/** Three fanned cards: Ultimate Team's mark in the main tab bar. */
function UtMark() {
  return (
    <svg width="24" height="22" viewBox="0 0 26 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.2" y="5" width="9" height="13" rx="1.6" transform="rotate(-14 6.7 11.5)" />
      <rect x="14.8" y="5" width="9" height="13" rx="1.6" transform="rotate(14 19.3 11.5)" />
      <rect x="8.5" y="3" width="9" height="14" rx="1.6" fill="var(--bg-2)" />
      <path d="M11 8.5h4M11 11.5h4" />
    </svg>
  );
}

/** Players with the app open and players searching for a match, live: each number pops when it changes. */
function LiveCount({ online, queue, onClick }: { online: number; queue: number; onClick?: () => void }) {
  const a = usePulse(online, 500);
  const b = usePulse(queue, 500);
  return (
    <button className="statchip online" onClick={onClick} aria-label={online + ' players online, ' + queue + ' in the head-to-head queue: see who'}>
      <i className="livedot" aria-hidden="true" />
      <b className={'num' + (a ? ' tick' : '')}>{online}</b> online
      <em>
        {' · '}
        <b className={'num' + (b ? ' tick' : '')}>{queue}</b> in queue
      </em>
    </button>
  );
}

const MODES: { key: Mode; title: string; sub: string }[] = [
  { key: 'classic', title: 'Classic', sub: 'Stats visible' },
  { key: 'blind', title: 'Blind', sub: 'Stats hidden · +50% rewards' },
  { key: 'daily', title: 'Daily', sub: 'Same spins for everyone' },
  { key: '1v1', title: NET_ON ? 'Head to Head' : '1 vs 1', sub: NET_ON ? 'Live vs real players' : 'Snake draft vs the AI' },
];

/** The logo letters fly in once per visit, not on every tab switch. */
let introPlayed = false;

export function HomePage(props: {
  profile: Profile;
  dailyNo: number;
  dailyDone: boolean;
  onMode: (m: Mode) => void;
  onBot: (b: BotLevel) => void;
  onPlay: () => void;
  onToast: (t: string) => void;
  streak: number;
  online: OnlineCount | null;
  /** the online count tapped: who's online */
  onOnline: () => void;
  missions: { done: number; claimable: boolean };
  onMissions: () => void;
  onStreak: () => void;
  onSport: (s: SportId) => void;
  /** this week's Legends Gauntlet: your best climb, and who waits at the top */
  gauntlet: { best: number; boss: string };
  /** Claude (UI reorganisation): the Gauntlet chip opens its sheet */
  onGauntlet: () => void;
  /** today's ranked Daily result, once played */
  dailyResult: RunRecord | null;
  onTraining: () => void;
  onResume: () => void;
  checkpoint: {count: number; mode: string; screen: string; wins?: number; at: number} | null;
}) {
  const [intro] = useState(() => !introPlayed);
  useEffect(() => {
    introPlayed = true;
  }, []);
  const p = props.profile;
  // the rows that give way on shorter screens (styles.css "home")
  const { content } = useLayout();
  const playLabel = p.mode === 'daily' ? (props.dailyDone ? 'PRACTICE DAILY' : 'PLAY DAILY #' + props.dailyNo) : p.mode === '1v1' ? (NET_ON ? 'FIND A MATCH' : 'PLAY THE BOT') : 'PLAY';
  // someone to play: another player with this sport open
  const live = props.online && props.online.here > 1;
  const letters = (word: string, offset: number) =>
    word.split('').map((ch, i) => (
      <i key={i} style={{ animationDelay: offset + i * 45 + 'ms' }}>
        {ch}
      </i>
    ));
  // Claude (UI reorganisation): the Daily's countdown, for its tile and the line under the modes
  const [left, setLeft] = useState(untilEasternMidnight);
  useEffect(() => {
    const t = window.setInterval(() => setLeft(untilEasternMidnight()), 30000);
    return () => clearInterval(t);
  }, []);
  // Claude (UI reorganisation): everything above the PLAY button scrolls when it can't fit (320x568
  // with a saved run used to push PLAY off the screen); PLAY itself never moves.
  return (
    <div className={'page-view home' + (content < 620 ? ' short' : content < 730 ? ' snug' : '') + (content >= 816 ? ' tall' : '')}>
      <div className="home-scroll">
        <h1 className={'logo' + (intro ? ' intro' : '')} aria-label="Perfect Season">
          <span className="disp l1" aria-hidden="true">
            {letters('PERFECT', 80)}
          </span>
          <span className="disp l2" aria-hidden="true">
            {letters('SEASON', 300)}
          </span>
        </h1>
        <SportSwitch onSport={props.onSport} />
        <ArenaHero>
          <div className="jumbo">
            <div className="rec">
              <b className="disp" style={{ color: 'var(--teal)' }}>
                {PERFECT_RECORD}
              </b>
              <span className="eyebrow">{pick({ nba: 'Regular season', nfl: 'Regular season', soccer: 'League season' })}</span>
            </div>
            <span className="disp plus">+</span>
            <div className="rec">
              <b className="disp" style={{ color: 'var(--gold)' }}>
                {PERFECT_PLAYOFFS}
              </b>
              <span className="eyebrow">{pick({ nba: 'Playoffs', nfl: 'Playoffs', soccer: 'Cup' })}</span>
            </div>
          </div>
        </ArenaHero>
        <p className="tagline">Spin a team and decade, draft {SPELLED[ROUNDS]} legends, go perfect.</p>
        <div className="statstrip">
          <StreakChip count={props.streak} onClick={props.onStreak} />
          {props.online && <LiveCount online={props.online.online} queue={props.online.searching} onClick={props.onOnline} />}
          <button className={'statchip quests' + (props.missions.claimable ? ' ready' : '')} onClick={props.onMissions} aria-label={'Missions: ' + props.missions.done + ' of 3 done'}>
            <Target size={16} />
            <b className="num">{props.missions.done}/3</b>
            {props.missions.claimable && <i className="dot" aria-hidden="true" />}
          </button>
          <button className={'statchip gauntlet-chip' + (props.gauntlet.best >= 8 ? ' cleared' : '')} onClick={props.onGauntlet} aria-label={'Legends Gauntlet: your best this week is ' + props.gauntlet.best + ' of 8'}>
            <Crown size={15} />
            <b className="num">{props.gauntlet.best}/8</b>
          </button>
        </div>
        <div className="evo-home-actions">
          {props.checkpoint && <button className="continue-card" onClick={props.onResume} aria-label="Continue saved run"><span className="continue-orbit" aria-hidden="true"><ArrowMark/></span><span><small className="eyebrow">YOUR RUN IS WAITING</small><b className="disp">PICK UP THE LEGACY</b><em>{props.checkpoint.screen === 'draft' ? props.checkpoint.count + '/' + ROUNDS + ' drafted' : props.checkpoint.wins + ' wins · ' + (props.checkpoint.screen === 'playoffs' ? pick({ nba: 'Playoffs', nfl: 'Playoffs', soccer: 'Cup' }) : 'Season')} · {props.checkpoint.mode}</em></span><i>›</i></button>}
          {pick({ nba: true, nfl: true, soccer: false }) && <button className="training-entry" onClick={props.onTraining}><span className="training-crosshair" aria-hidden="true"><DrillMark drill="shoot"/></span><span><b className="disp">TRAINING CAMP</b><small>Find your rhythm. Own the game.</small></span><i><ArrowMark/></i></button>}
        </div>
        <div className="modes" role="group" aria-label="Game mode">
          {MODES.map((m) => (
            <button key={m.key} className="mode" aria-pressed={p.mode === m.key} onClick={() => props.onMode(m.key)}>
              <span className="disp">
                <Fit text={m.key === 'daily' ? 'Daily #' + props.dailyNo : m.title} />
              </span>
              {m.key === '1v1' && live && <span className="livebadge">LIVE</span>}
              {m.key === 'daily' && !props.dailyDone && <span className="livebadge daily-new">NEW</span>}
              {m.key === '1v1' && props.online && props.online.searching > 0 ? (
                <small className="queue-now" key={props.online.searching}>
                  {props.online.searching} in queue right now
                </small>
              ) : (
                <small className={m.key === 'daily' && props.dailyDone ? 'done' : ''}>
                  {m.key === 'daily' ? (props.dailyResult ? 'Done · ' + record(props.dailyResult.wins) + ' · next in ' + left : props.dailyDone ? 'Done today · next in ' + left : 'Same spins for everyone') : m.sub}
                </small>
              )}
            </button>
          ))}
        </div>
        <div className="under" key={p.mode}>
          {p.mode === '1v1' ? (
            <>
              <span className="eyebrow">{NET_ON ? 'AI backup' : 'AI'}</span>
              {(['rookie', 'pro', 'legend'] as BotLevel[]).map((b) => (
                <button key={b} className={'chip rival' + (p.botLevel === b ? ' on' : '')} aria-pressed={p.botLevel === b} onClick={() => props.onBot(b)}>
                  {b.toUpperCase()}
                </button>
              ))}
            </>
          ) : p.mode === 'daily' ? (
            <span>{props.dailyDone ? 'Your ranked try is in. Replays are practice. New spins in ' + left + '.' : 'Everyone gets today’s same spins. Your first try is ranked.'}</span>
          ) : p.mode === 'blind' ? (
            <span>Draft from memory. Stats stay hidden until the results.</span>
          ) : (
            <span>1 free team respin and 1 free decade respin every draft.</span>
          )}
        </div>
        <div className="spacer" />
      </div>
      <div className="playbar">
        <button className="big shine" onClick={props.onPlay}>
          <Fit text={playLabel} />
        </button>
      </div>
    </div>
  );
}

function HistRow({ r, i = 0 }: { r: RunRecord; i?: number }) {
  const g = gradeFor(r.wins);
  return (
    <div className="histrow rise-in" style={{ animationDelay: Math.min(i, 8) * 40 + 'ms' }}>
      <span className="g disp" style={{ borderColor: g.color, color: g.color }}>
        {r.grade}
      </span>
      <div>
        <strong className="num">
          {record(r.wins)}
          {r.title ? pick({ nba: ' · Champions', nfl: ' · Super Bowl', soccer: ' · Cup' }) : ''}
          {r.vs ? (r.vs.won ? ' · beat ' + (r.online ? r.online.opp : 'AI') : r.vs.won === false ? ' · lost to ' + (r.online ? r.online.opp : 'AI') : ' · tied') : ''}
        </strong>
        <small>{r.lineup.map((x) => lastName(x.name)).join(' · ')}</small>
      </div>
      <small className="mode-tag">{r.mode === '1v1' ? (r.online ? 'H2H' : 'vs AI') : r.mode}</small>
    </div>
  );
}

/** Time left until the next Daily (midnight US Eastern). */
function untilEasternMidnight(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const left = 86400 - (get('hour') * 3600 + get('minute') * 60 + get('second'));
    const h = Math.floor(left / 3600);
    const m = Math.floor((left % 3600) / 60);
    return h + 'h ' + String(m).padStart(2, '0') + 'm';
  } catch {
    return '';
  }
}

/** Which Ranks view was open last, for this session. */
let ranksView: 'global' | 'yours' = 'global';
/** Show the global boards next time Ranks opens (a link to a board, or to who's online). */
export function showGlobalRanks() {
  ranksView = 'global';
}

export function RanksPage(props: { profile: Profile; dailyKey: string; dailyNo: number; onName: () => void }) {
  const [view, setView] = useState<'global' | 'yours'>(NET_ON ? ranksView : 'yours');
  const [mode, setMode] = useState<Mode | 'all'>('all');
  const runs = bestRuns(props.profile.history, mode);
  const pickView = (v: 'global' | 'yours') => {
    if (v === view) return;
    sfx.click();
    ranksView = v;
    setView(v);
  };
  return (
    <div className="page-view">
      <div className="page">
        <div className="ranks-head">
          <h1 className="disp">{NET_ON ? pick({ nba: 'Ranks', nfl: 'NFL Ranks', soccer: 'Soccer Ranks' }) : 'Your best'}</h1>
          {NET_ON && (
            <span className="seg" role="group" aria-label="Leaderboard">
              {(['global', 'yours'] as const).map((v) => (
                <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => pickView(v)}>
                  {v === 'global' ? 'GLOBAL' : 'YOURS'}
                </button>
              ))}
            </span>
          )}
        </div>
        {view === 'global' ? (
          <GlobalBoard profile={props.profile} dailyKey={props.dailyKey} dailyNo={props.dailyNo} onName={props.onName} />
        ) : (
          <>
            <div className="chiprow">
              {(['all', 'classic', 'blind', 'daily', '1v1'] as const).map((m) => (
                <button key={m} className={'chip' + (mode === m ? ' on' : '')} aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m === 'all' ? 'ALL' : m === '1v1' ? '1 VS 1' : m.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="list" key={mode}>
              {runs.length ? runs.map((r, i) => <HistRow key={i} r={r} i={i} />) : <div className="empty">Finish a draft to put a team on your board.</div>}
            </div>
            <p className="note">Your best on this device, ranked by regular-season wins, then titles, then team rating.</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Claude (UI reorganisation): the draft boosters, now in Profile (was its own tab). */
function BoostersSection(props: { profile: Profile; onBuy: (b: Booster) => void }) {
  const lv = levelInfo(props.profile.xp).level;
  return (
    <div className="boosters-sec">
      <div className="sec-head">
        <span className="eyebrow">Draft boosters</span>
        <small>One of each per draft · Classic &amp; Blind</small>
      </div>
      {BOOSTERS.map((b, i) => {
        const locked = lv < BOOSTER_UNLOCK_LEVEL[b];
        return (
          <div key={b} className={'storeitem rise-in' + (locked ? ' locked' : '')} style={{ animationDelay: i * 60 + 'ms' }}>
            <span className="level-ring store">
              {locked ? <Lock size={16} /> : b === 'prime' ? <Crown size={16} /> : <b>{props.profile.inventory[b]}</b>}
            </span>
            <div>
              <strong>
                {BOOSTER_NAMES[b]} {locked ? '' : '· you have ' + props.profile.inventory[b]}
              </strong>
              <small>{BOOSTER_HELP[b]}</small>
            </div>
            {locked ? (
              <button className="btn" aria-disabled="true" onClick={() => {}}>
                LV {BOOSTER_UNLOCK_LEVEL[b]}
              </button>
            ) : (
              <button className="btn gold" onClick={() => props.onBuy(b)} aria-label={'Buy ' + BOOSTER_NAMES[b] + ' for ' + BOOSTER_PRICES[b] + ' coins'}>
                {BOOSTER_PRICES[b]}
              </button>
            )}
          </div>
        );
      })}
      <p className="note">Extra respins cost {RESPIN_PRICE} coins during a draft.</p>
    </div>
  );
}

export function ProfilePage(props: { profile: Profile; onName?: () => void; onBinder: () => void; onFavs?: () => void; onBuy: (b: Booster) => void; onUltimate?: () => void }) {
  const p = props.profile;
  const lv = levelInfo(p.xp);
  const best = bestRuns(p.history, 'all', 1)[0];
  const bsum = useMemo(() => summarize(p.collection ?? {}), [p.collection]);
  const stats: [string, string | number][] = [
    ['Drafts', p.stats.games],
    ['Best record', best ? record(best.wins) : '—'],
    [pick({ nba: 'Titles', nfl: 'Super Bowls', soccer: 'Cups' }), p.stats.titles],
    [PERFECT_RECORD + ' seasons', p.stats.undefeated],
    ['Perfect seasons', p.stats.perfect],
    ['Legends drafted', p.stats.legends],
    [p.gauntlet?.clears ? 'Gauntlet · ' + p.gauntlet.clears + ' clear' + (p.gauntlet.clears > 1 ? 's' : '') : 'Gauntlet best', (p.gauntlet?.allBest ?? 0) + '/8'],
  ];
  if (NET_ON) stats.push(['Head to head', p.h2h.w + '–' + p.h2h.l], ['Best H2H streak', p.h2h.best], ['Best day streak', p.streak.best]);
  else stats.push(['1v1 wins', p.stats.vsWins]);
  return (
    <div className="page-view">
      <div className="page">
        <div className="profile-head rise-in">
          <span className="level-ring xl" style={{ '--p': lv.into / lv.need } as React.CSSProperties} aria-hidden="true">
            <span>LV</span>
            <b>{lv.level}</b>
          </span>
          <span className="profile-id">
            <b className="disp">{p.name ?? 'Player'}</b>
            <span className="bar thick">
              <i style={{ width: Math.round((lv.into / lv.need) * 100) + '%' }} />
            </span>
            <small className="num">
              Level {lv.level} · {lv.into}/{lv.need} XP to level {lv.level + 1}
            </small>
          </span>
          {p.name && props.onName && (
            <button className="icon-btn profile-edit" onClick={props.onName} aria-label="Edit name">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
            </button>
          )}
        </div>
        <span className="eyebrow">Draft</span>
        <div className="statgrid">
          {stats.map(([label, v], i) => (
            <div key={label} className="rise-in" style={{ animationDelay: i * 40 + 'ms' }}>
              <b className="disp num">{v}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {props.onUltimate && (
          <button className="profile-ut rise-in" onClick={props.onUltimate} aria-label="Open Ultimate Team">
            <span className="profile-ut-mark" aria-hidden="true">
              <UtMark />
            </span>
            <span className="profile-ut-txt">
              <i className="eyebrow">ULTIMATE TEAM · {SPORT_LABEL[SPORT]}</i>
              <span className="profile-ut-stats">
                <span>
                  <b className="num">{p.ut.owned.length}</b> cards
                </span>
                <span>
                  <b className="num">
                    {p.ut.record.w + p.ut.record.h2hW}–{p.ut.record.l + p.ut.record.h2hL}
                  </b>{' '}
                  record
                </span>
                <span>
                  <b className="num">{p.ut.packsOpened}</b> {p.ut.packsOpened === 1 ? 'pack' : 'packs'} opened
                </span>
              </span>
            </span>
            <i className="go" aria-hidden="true">
              ›
            </i>
          </button>
        )}
        {props.onFavs && <FavoritesCard onEdit={props.onFavs} />}
        <button className="binder-card rise-in" onClick={props.onBinder}>
          <span className="stack" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="txt">
            <b className="disp">BINDER</b>
            <small>
              {bsum.cards} card{bsum.cards === 1 ? '' : 's'} · {bsum.sets} set{bsum.sets === 1 ? '' : 's'} complete
            </small>
          </span>
          <span className="go" aria-hidden="true">
            ›
          </span>
        </button>
        <BoostersSection profile={p} onBuy={props.onBuy} />
        <span className="eyebrow">Recent drafts</span>
        {p.history.length ? p.history.slice(0, 20).map((r, i) => <HistRow key={i} r={r} i={i} />) : <div className="empty">No drafts yet. Your history shows up here.</div>}
        <p className="note">Progress is saved on this phone. The home-screen app and Safari keep separate progress.</p>
      </div>
    </div>
  );
}

export function SettingsSheet(props: { profile: Profile; onChange: (k: 'sound' | 'haptics' | 'hints', v: boolean) => void; onReset: () => void; onLocker: () => void; onAdmin: () => void; onClose: () => void; source: string; latest: number }) {
  const [confirm, setConfirm] = useState(false);
  const [errs, setErrs] = useState(loggedErrors);
  const row = (k: 'sound' | 'haptics' | 'hints', label: string) => (
    <div className="toggle">
      <span>{label}</span>
      <button role="switch" aria-checked={props.profile.settings[k]} aria-label={label} onClick={() => props.onChange(k, !props.profile.settings[k])} />
    </div>
  );
  return (
    <Sheet label="Settings" onClose={props.onClose}>
      {(close) => (
        <>
          <h2 className="disp">Settings</h2>
          <div>
            {row('sound', 'Sound')}
            {row('haptics', 'Vibration')}
            {row('hints', 'Booster hints')}
          </div>
          <button className="locker-entry" onClick={() => close(props.onLocker)}><span aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 17a4 4 0 0 1-.5-7.97 6.5 6.5 0 0 1 12.5-.8A4.5 4.5 0 0 1 18 17"/><path d="m8 16 3 3 5-6"/></svg></span><span><b className="disp">CLOUD SAVE</b><small>Automatic server saves. Keep your legacy.</small></span><i>›</i></button>
          {confirm ? (
            <div className="btnrow">
              <button className="btn" onClick={() => setConfirm(false)}>
                KEEP MY PROGRESS
              </button>
              <button className="btn danger" onClick={() => close(props.onReset)}>
                ERASE EVERYTHING
              </button>
            </div>
          ) : (
            <button className="btn" onClick={() => setConfirm(true)}>
              RESET PROGRESS
            </button>
          )}
          <p className="note">
            {pick({
              soccer: 'Forty big clubs of the Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Eredivisie and Primeira Liga, 1950s to ' + props.latest + ': ' + props.source + '. From 2012–13 every player with 900+ league minutes, with real goals and assists; earlier lines are club spells and estimated ratings.',
              nfl: 'Every NFL quarterback, running back, receiver and tight end from 1970 through ' + props.latest + ', and every team’s best defensive linemen, linebackers and defensive backs, from ' + props.source + '. Defenders’ stats run from 1999, and before that where a career table kept them; an earlier defender is judged by his All-Pro and Pro Bowl years, his career and those stats.',
              nba: 'Every NBA player from 1959–60 through ' + (props.latest - 1) + '–' + String(props.latest).slice(2) + ', from ' + props.source + '. Steals and blocks before 1973–74 weren’t recorded and are estimated.',
            })}
          </p>
          <p className="note num">
            Version {APP_VERSION} · {viewportInfo()}
          </p>
          {errs.length > 0 && (
            <div className="errlog">
              <span className="eyebrow">Problems on this phone</span>
              {errs.map((e, i) => (
                <p key={i} className="note num">
                  {new Date(e.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {e.where}
                  {e.n > 1 ? ' ×' + e.n : ''} · {e.msg} · {e.v}
                </p>
              ))}
              <button className="ut-link" onClick={() => (clearErrors(), setErrs([]))}>
                CLEAR
              </button>
            </div>
          )}
          <button className="btn primary" onClick={() => close()}>
            DONE
          </button>
          <button className="ut-link settings-admin" onClick={() => close(props.onAdmin)}>
            ADMIN
          </button>
        </>
      )}
    </Sheet>
  );
}

export function HowToSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet label="How to play" onClose={onClose}>
      {(close) => (
        <>
          <h2 className="disp">How to play</h2>
          {pick({
            nfl: (
            <>
              <p>
                <b>Spin</b> for a random NFL team and decade. Pick anyone who played for them then: a quarterback, running back, receiver or tight end, or a defender. Eight rounds fill QB, RB, WR, TE, FLEX (any back, receiver or tight end) and the defense: DL (a lineman), LB (a linebacker) and DB (a corner or a safety).
              </p>
              <p>
                Players bring their per-game yards and touchdowns from their years with that team in that decade; defenders their sacks, tackles and interceptions a season, Pro Bowls and All-Pro years. Your team is scored on passing, rushing, receiving and defense against a near-perfect lineup, and a weak spot drags the whole team down.
              </p>
              <p>
                <b>Every era counts the same.</b> The list shows real stats, but each player is scored against the league in his own seasons: 250 passing yards a game meant more in 1977 than it does now, and a defender is ranked among the defenders of his own seasons. Positions are scored on one scale, so an all-time tight end or linebacker is worth as much as an all-time quarterback.
              </p>
              <p>
                You get <b>1 free team respin and 1 free decade respin</b> per draft. Tap two players on the field to swap their spots.
              </p>
              <p>
                Then the <b>17-game season</b> plays out, every score on the schedule. Win 10 or more to make the playoffs: four one-game rounds against real playoff teams, the better record at home and the Super Bowl on neutral ground. Tap any round to scout the other team. Go 17–0, then win all four, for a <b>Perfect Season</b>.
              </p>
            </>
            ),
            nba: (
            <>
              <p>
                <b>Spin</b> for a random NBA team and decade. Pick any player who played for them then, and place him at a position he actually played. Five rounds fill PG, SG, SF, PF and C.
              </p>
              <p>
                Each player brings his per-game points, rebounds, assists, steals and blocks from his years with that team in that decade. Your team is scored against a near-perfect lineup, and a weak category drags the whole team down.
              </p>
              <p>
                <b>Every era counts the same.</b> The list shows real stats, but your team is scored on how each player compared with the league in his own seasons. Games in the 1960s were faster, with far more rebounds to grab, so 25 rebounds then is worth less than 25 today. A player who appeared in only a few games for a team is valued closer to his usual level, not his best night.
              </p>
              <p>
                You get <b>1 free team respin and 1 free decade respin</b> per draft. Tap two players on the court to swap their spots.
              </p>
              <p>
                Then the <b>82-game season</b> plays out. Win 50 or more to make the playoffs: four best-of-7 series against real all-time great teams, each game a little more likely to go to the better team, with home court to the better record. Tap any series to scout the other team’s five and your odds. Go 82–0, then 16–0, for a <b>Perfect Season</b>.
              </p>
            </>
            ),
            soccer: (
            <>
              <p>
                <b>Spin</b> for a random club and decade. Pick anyone who played for them then, at a position he actually played. Eight rounds fill GK, CB, FB, DM/CM (a holder or a central midfielder), CM/AM, W, ST and a FLEX (any outfielder).
              </p>
              <p>
                Each player brings his goals and assists a season (a keeper his clean sheets) and his rating for that club in that decade. Your team is scored on attack, midfield, defense and goalkeeping against a near-perfect lineup, and a weak area drags the whole team down.
              </p>
              <p>
                <b>Every era counts the same.</b> Ratings compare each player with his league in his own seasons. From 2012–13 the stats are real league numbers; before that a line is the player’s club spell and an estimated rating.
              </p>
              <p>
                You get <b>1 free club respin and 1 free decade respin</b> per draft. Tap two players on the pitch to swap their spots.
              </p>
              <p>
                Then the <b>38-game league season</b> plays out: three points a win, one a draw. Win 22 or more to reach the cup: four one-game knockout rounds against the great sides of the last fourteen years, level after 90 minutes goes to penalties, and the Final on neutral ground. Go 38–0, then win all four inside 90 minutes, for a <b>Perfect Season</b>.
              </p>
            </>
            ),
          })}
          {NET_ON ? (
            <>
              <p>
                <b>Head to Head:</b> you and a real player draft from the same team and decade each round, taking turns going first, with 25 seconds a pick. The better team wins. If no one is searching after 30 seconds, you play the AI instead. To play a friend, make a code and send it.
              </p>
              <p>
                <b>Ranks:</b> your best Classic, Blind and first Daily run, plus your head-to-head wins, go on the global leaderboards automatically.
              </p>
            </>
          ) : (
            <p>
              <b>1 vs 1:</b> you and the AI pick from the same team and decade each round and take turns going first. You always start against Rookie, a coin flip decides against Pro, and Legend always starts.
            </p>
          )}
          <p>
            <b>Rarity:</b> the best player lines are Rare, Epic or Legendary{pick({ nba: ' (about 1 in 200)', nfl: '', soccer: '' })}. Draft a Legendary for the big moment.
          </p>
          <p>
            <b>After the season:</b> the draft report grades every pick against the best one there was. Then take the same team into the <b>Legends Gauntlet</b>: eight of the greatest teams ever, one live game at a time, with three lives. A new eight every week.
          </p>
          <p>
            <b>Binder:</b> every player you draft is a card you keep. Finish a team-decade’s set (its {pick({ nba: 'five best players', nfl: 'five best on offense and best DL, LB and DB', soccer: 'best keeper and seven best outfielders' })}) for coins. Press and hold a card on the {FLOOR} to look closer.
          </p>
          <p>
            <b>Every day:</b> open the daily chest (it grows for 7 days in a row) and finish three missions for coins and XP.
          </p>
          <p>
            <b>Boosters</b> (from level 2): Double Pick takes two players from one team, Trade swaps a teammate for someone better, Prime upgrades a player to his best-ever decade.
          </p>
          <button className="btn primary" onClick={() => close()}>
            GOT IT
          </button>
        </>
      )}
    </Sheet>
  );
}

/** Claude (UI reorganisation): the Legends Gauntlet chip on Home opens this (it used to be a toast). */
export function GauntletSheet(props: { teams: string[]; best: number; coins: number[]; clear: number; onClose: () => void }) {
  return (
    <Sheet label="Legends Gauntlet" onClose={props.onClose}>
      {(close) => (
        <div className="gauntlet-sheet">
          <span className="eyebrow">THIS WEEK · {props.best} OF {props.teams.length} BEATEN</span>
          <h2 className="disp">Legends Gauntlet</h2>
          <p className="note">After any finished draft, take your team up this week’s eight from the results screen: one live game at a time, three lives. A new eight every week.</p>
          <ol className="gauntlet-list">
            {props.teams.map((t, i) => (
              <li key={t + i} className={i < props.best ? 'beaten' : i === props.best ? 'next' : ''}>
                <b className="num">{i + 1}</b>
                <span>{t}</span>
                <small className="num">+{props.coins[i] + (i === props.teams.length - 1 ? props.clear : 0)}</small>
              </li>
            ))}
          </ol>
          <button className="btn primary" onClick={() => close()}>
            GOT IT
          </button>
        </div>
      )}
    </Sheet>
  );
}
