import React, { useEffect, useMemo, useState } from 'react';
import { summarize } from '../engine/collection';
import { BOOSTER_HELP, BOOSTER_NAMES, BOOSTER_PRICES, BOOSTER_UNLOCK_LEVEL, RESPIN_PRICE, levelInfo } from '../engine/economy';
import { ROUNDS } from '../engine/draft';
import { gradeFor } from '../engine/rating';
import { NFL, type SportId } from '../engine/sport';
import { type Booster, BOOSTERS, type BotLevel, type Mode } from '../engine/types';
import { bestRuns, type Profile, type RunRecord } from '../lib/profile';
import { sfx } from '../lib/sound';
import { APP_VERSION } from '../lib/update';
import { viewportInfo } from '../stage';
import type { OnlineCount } from '../net/match';
import { NET_ON } from '../net/nostr';
import { Fit, lastName, Sheet } from './common';
import { ArenaHero } from './Hero';
import { usePulse } from './motion';
import { GlobalBoard } from './Leaderboard';
import { StreakChip } from './Rewards';
import { Bolt, Calendar, Crown, Football, Home as HomeIcon, Hoop, Lock, Ranks as RanksIcon, Target, User } from './icons';
import { PERFECT_PLAYOFFS, PERFECT_RECORD, record } from './sportui';

const SPELLED = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

/** Basketball or football: the other one reloads the app into that sport. */
function SportSwitch({ onSport }: { onSport: (s: SportId) => void }) {
  const items: [SportId, string, React.ReactNode][] = [
    ['nba', 'NBA', <Hoop size={16} />],
    ['nfl', 'NFL', <Football size={16} />],
  ];
  const cur: SportId = NFL ? 'nfl' : 'nba';
  return (
    <div className={'sportswitch ' + cur} role="group" aria-label="Sport">
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

export type Tab = 'home' | 'daily' | 'ranks' | 'boosters' | 'profile';
export const TAB_ORDER: Tab[] = ['home', 'daily', 'ranks', 'boosters', 'profile'];

export function Tabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: [Tab, string, React.ReactNode][] = [
    ['home', 'HOME', <HomeIcon size={22} />],
    ['daily', 'DAILY', <Calendar size={22} />],
    ['ranks', 'RANKS', <RanksIcon size={22} />],
    ['boosters', 'BOOSTERS', <Bolt size={22} />],
    ['profile', 'PROFILE', <User size={22} />],
  ];
  return (
    <nav className="tabs" aria-label="Main">
      <span className="tab-ind" style={{ transform: 'translateX(' + TAB_ORDER.indexOf(tab) * 100 + '%)' }} aria-hidden="true" />
      {items.map(([k, label, icon]) => (
        <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => onTab(k)}>
          {icon}
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Players with the app open and players searching for a match, live: each number pops when it changes. */
function LiveCount({ online, queue }: { online: number; queue: number }) {
  const a = usePulse(online, 500);
  const b = usePulse(queue, 500);
  return (
    <span className="statchip online" role="status" aria-label={online + ' players online, ' + queue + ' in the head-to-head queue'}>
      <i className="livedot" aria-hidden="true" />
      <b className={'num' + (a ? ' tick' : '')}>{online}</b> online
      <em>
        {' · '}
        <b className={'num' + (b ? ' tick' : '')}>{queue}</b> in queue
      </em>
    </span>
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
  missions: { done: number; claimable: boolean };
  onMissions: () => void;
  onStreak: () => void;
  onSport: (s: SportId) => void;
}) {
  const [intro] = useState(() => !introPlayed);
  useEffect(() => {
    introPlayed = true;
  }, []);
  const p = props.profile;
  const playLabel = p.mode === 'daily' ? (props.dailyDone ? 'PRACTICE DAILY' : 'PLAY DAILY #' + props.dailyNo) : p.mode === '1v1' ? (NET_ON ? 'FIND A MATCH' : 'PLAY THE BOT') : 'PLAY';
  // someone to play: another player with this sport open
  const live = props.online && props.online.here > 1;
  const letters = (word: string, offset: number) =>
    word.split('').map((ch, i) => (
      <i key={i} style={{ animationDelay: offset + i * 45 + 'ms' }}>
        {ch}
      </i>
    ));
  return (
    <div className="page-view home">
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
            <span className="eyebrow">Regular season</span>
          </div>
          <span className="disp plus">+</span>
          <div className="rec">
            <b className="disp" style={{ color: 'var(--gold)' }}>
              {PERFECT_PLAYOFFS}
            </b>
            <span className="eyebrow">Playoffs</span>
          </div>
        </div>
      </ArenaHero>
      <p className="tagline">Spin a team and decade, draft {SPELLED[ROUNDS]} legends, go perfect.</p>
      <div className="statstrip">
        <StreakChip count={props.streak} onClick={props.onStreak} />
        {props.online && <LiveCount online={props.online.online} queue={props.online.searching} />}
        <button className={'statchip quests' + (props.missions.claimable ? ' ready' : '')} onClick={props.onMissions} aria-label={'Missions: ' + props.missions.done + ' of 3 done'}>
          <Target size={16} />
          <b className="num">{props.missions.done}/3</b>
          {props.missions.claimable && <i className="dot" aria-hidden="true" />}
        </button>
      </div>
      <div className="modes" role="group" aria-label="Game mode">
        {MODES.map((m) => (
          <button key={m.key} className="mode" aria-pressed={p.mode === m.key} onClick={() => props.onMode(m.key)}>
            <span className="disp">{m.key === 'daily' ? 'Daily #' + props.dailyNo : m.title}</span>
            {m.key === '1v1' && live && <span className="livebadge">LIVE</span>}
            {m.key === '1v1' && props.online && props.online.searching > 0 ? (
              <small className="queue-now" key={props.online.searching}>
                {props.online.searching} in queue right now
              </small>
            ) : (
              <small className={m.key === 'daily' && props.dailyDone ? 'done' : ''}>{m.key === 'daily' && props.dailyDone ? 'Done today · practice only' : m.sub}</small>
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
          <span>Everyone gets today’s same spins. Your first try is ranked.</span>
        ) : p.mode === 'blind' ? (
          <span>Draft from memory. Stats stay hidden until the results.</span>
        ) : (
          <span>1 free team respin and 1 free decade respin every draft.</span>
        )}
      </div>
      <div className="spacer" />
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
          {r.title ? (NFL ? ' · Super Bowl' : ' · Champions') : ''}
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

export function DailyPage(props: { profile: Profile; dailyNo: number; dailyKey: string; onPlay: () => void }) {
  const d = props.profile.daily && props.profile.daily.key === props.dailyKey ? props.profile.daily.record : null;
  const [left, setLeft] = useState(untilEasternMidnight);
  useEffect(() => {
    const t = window.setInterval(() => setLeft(untilEasternMidnight()), 20000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="page-view">
      <div className="page">
        <h1 className="disp">Daily #{props.dailyNo}</h1>
        <p className="lead">Everyone gets the same {SPELLED[ROUNDS]} spins today, in the same order. Your first try counts and you can share it. After that you can replay it for practice.</p>
        {left && (
          <div className="countdown">
            <span className="eyebrow">Next Daily in</span>
            <b className="disp num">{left}</b>
          </div>
        )}
        {d ? (
          <>
            <span className="eyebrow">Your ranked result</span>
            <HistRow r={d} />
            <p className="note">{d.playoff}</p>
          </>
        ) : (
          <div className="empty">You haven’t played today’s Daily yet.</div>
        )}
      </div>
      <div className="playbar">
        <button className="big shine" onClick={props.onPlay}>
          <Fit text={d ? 'PRACTICE TODAY’S DAILY' : 'PLAY DAILY #' + props.dailyNo} />
        </button>
      </div>
    </div>
  );
}

/** Which Ranks view was open last, for this session. */
let ranksView: 'global' | 'yours' = 'global';

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
          <h1 className="disp">{NET_ON ? (NFL ? 'NFL Ranks' : 'Ranks') : 'Your best'}</h1>
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

export function BoostersPage(props: { profile: Profile; onBuy: (b: Booster) => void }) {
  const lv = levelInfo(props.profile.xp).level;
  return (
    <div className="page-view">
      <div className="page">
        <h1 className="disp">Boosters</h1>
        <p className="lead">Buy with coins you earn by playing. One of each per draft, in Classic and Blind. Extra respins cost {RESPIN_PRICE} coins during a draft.</p>
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
                <button className="btn gold" onClick={() => props.onBuy(b)}>
                  {BOOSTER_PRICES[b]}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProfilePage(props: { profile: Profile; onName?: () => void; onBinder: () => void }) {
  const p = props.profile;
  const lv = levelInfo(p.xp);
  const best = bestRuns(p.history, 'all', 1)[0];
  const bsum = useMemo(() => summarize(p.collection ?? {}), [p.collection]);
  const stats: [string, string | number][] = [
    ['Drafts', p.stats.games],
    ['Best record', best ? record(best.wins) : '—'],
    [NFL ? 'Super Bowls' : 'Titles', p.stats.titles],
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
        {p.name && (
          <div className="namebar">
            <span>
              <b>{p.name}</b>
            </span>
            {props.onName && (
              <button className="chip" onClick={props.onName}>
                EDIT NAME
              </button>
            )}
          </div>
        )}
        <h1 className="disp">Level {lv.level}</h1>
        <span className="bar thick">
          <i style={{ width: Math.round((lv.into / lv.need) * 100) + '%' }} />
        </span>
        <span className="note">
          {lv.into}/{lv.need} XP to level {lv.level + 1}
        </span>
        <div className="statgrid">
          {stats.map(([label, v], i) => (
            <div key={label} className="rise-in" style={{ animationDelay: i * 40 + 'ms' }}>
              <b className="disp num">{v}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
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
        <span className="eyebrow">Recent drafts</span>
        {p.history.length ? p.history.slice(0, 20).map((r, i) => <HistRow key={i} r={r} i={i} />) : <div className="empty">No drafts yet. Your history shows up here.</div>}
        <p className="note">Progress is saved on this phone. The home-screen app and Safari keep separate progress.</p>
      </div>
    </div>
  );
}

export function SettingsSheet(props: { profile: Profile; onChange: (k: 'sound' | 'haptics' | 'hints', v: boolean) => void; onReset: () => void; onClose: () => void; source: string; latest: number }) {
  const [confirm, setConfirm] = useState(false);
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
            {NFL
              ? 'Every NFL quarterback, running back, receiver and tight end from 1970 through ' + props.latest + ', and every team’s defense by points allowed, from ' + props.source + '.'
              : 'Every NBA player from 1959–60 through ' + (props.latest - 1) + '–' + String(props.latest).slice(2) + ', from ' + props.source + '. Steals and blocks before 1973–74 weren’t recorded and are estimated.'}
          </p>
          <p className="note num">
            Version {APP_VERSION} · {viewportInfo()}
          </p>
          <button className="btn primary" onClick={() => close()}>
            DONE
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
          {NFL ? (
            <>
              <p>
                <b>Spin</b> for a random NFL team and decade. Pick anyone who played for them then: a quarterback, running back, receiver or tight end, or the team’s defense. Six rounds fill QB, RB, WR, TE, FLEX (any back, receiver or tight end) and DEF.
              </p>
              <p>
                Players bring their per-game yards and touchdowns from their years with that team in that decade; a defense brings the points it allowed. Your team is scored on passing, rushing, receiving and defense against a near-perfect lineup, and a weak spot drags the whole team down.
              </p>
              <p>
                <b>Every era counts the same.</b> The list shows real stats, but each player is scored against the league in his own seasons: 250 passing yards a game meant more in 1977 than it does now. Positions are scored on one scale, so an all-time tight end is worth as much as an all-time quarterback.
              </p>
              <p>
                You get <b>1 free team respin and 1 free decade respin</b> per draft. Tap two players on the field to swap their spots.
              </p>
              <p>
                Then the <b>17-game season</b> plays out, every score on the schedule. Win 10 or more to make the playoffs: four one-game rounds against real playoff teams, the better record at home and the Super Bowl on neutral ground. Tap any round to scout the other team. Go 17–0, then win all four, for a <b>Perfect Season</b>.
              </p>
            </>
          ) : (
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
          )}
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
            <b>Rarity:</b> the best player lines are Rare, Epic or Legendary{NFL ? '' : ' (about 1 in 200)'}. Draft a Legendary for the big moment.
          </p>
          <p>
            <b>After the season:</b> the draft report grades every pick against the best one there was. Then take the same team into the <b>Legends Gauntlet</b>: eight of the greatest teams ever, one live game at a time, with three lives. A new eight every week.
          </p>
          <p>
            <b>Binder:</b> every player you draft is a card you keep. Finish a team-decade’s set (its {NFL ? 'defense and five best players' : 'five best players'}) for coins. Press and hold a card on the {NFL ? 'field' : 'court'} to look closer.
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
