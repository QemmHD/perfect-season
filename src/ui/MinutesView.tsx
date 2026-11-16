// Claude, 2026-11-16 (studio overhaul, team ut, task ut-3; Game Design V2 E.9.4 and E.9.6; visual
// target: mockups-v2 "MINUTES · tracks, chests and the league"): the Minutes screen, the MINUTES
// segment of RANKS. Loaded lazily (React.lazy in Pages.tsx), so nothing here reaches first paint.
//
// - A hero with the big ring toward the next rung and the one thing to know: "3 minutes to your next
//   reward", the rewards ready to CLAIM, or the calm "Done for today" state at 90.
// - Today, This week and Career rails: chests per rung (opened when claimed, glowing when ready, the
//   next one enlarged, the rest locked), the fill between them, and what each pays.
// - The league tile with the six tier shields and the board tabs, which say "Leagues start next week"
//   until the leagues land (ut-8).
// - The explainer sheet in V2 E.9.6's words.
// Claiming is `claimMinutes` (src/ut/minutes.ts): pure and idempotent, so a second tap grants nothing.
import React, { useEffect, useState } from 'react';
import { SPORT } from '../engine/sport';
import { etDay } from '../lib/playtime';
import type { Profile } from '../lib/profile';
import { NET_ON } from '../net/nostr';
import { ClaimButton } from '../ut/kit';
import { MINUTES_DONE_LINE } from '../ut/next-action';
import {
  claimMinutes,
  freshForMinutes,
  LEAGUE_TIERS,
  LIFE_BADGES,
  lifeBadge,
  minutesView,
  rewardText,
  type MinutesReward,
  type RungView,
  type TrackView,
} from '../ut/minutes';
import { Sheet } from './common';
import { minText } from './playtime-ui';
import './minutes.css';

type ChestKind = 'wood' | 'silver' | 'gold' | 'premium' | 'status' | 'done';
const chestOf = (r: MinutesReward): ChestKind => (r.done ? 'done' : r.pack ?? (r.pick ? 'gold' : r.coins ? 'wood' : 'status'));
const CHEST: Record<ChestKind, [string, string, string]> = {
  // body light, body dark, band
  wood: ['#b77c4a', '#6d4122', '#e3b25c'],
  silver: ['#eef3f6', '#7f909b', '#c9d4db'],
  gold: ['#ffdc7a', '#c9861a', '#fff1bf'],
  premium: ['#c3b2ff', '#5534c2', '#f6b93b'],
  status: ['#7af0d4', '#1c8f78', '#e8fffa'],
  done: ['#7af0d4', '#1c8f78', '#e8fffa'],
};

/** A reward chest in SVG: closed, glowing or opened (lid raised, a check inside). */
function Chest({ kind, open, size = 34 }: { kind: ChestKind; open: boolean; size?: number }) {
  const [a, b, band] = CHEST[kind];
  const id = 'mvc-' + kind;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="mv-chest-art">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <ellipse cx="20" cy="36.5" rx="15" ry="2.6" fill="rgba(0,0,0,.45)" />
      <rect x="5" y="18" width="30" height="17" rx="3" fill={'url(#' + id + ')'} />
      <rect x="5" y="18" width="30" height="17" rx="3" fill="none" stroke="rgba(0,0,0,.35)" />
      {open ? (
        <>
          <path d="M7 18 L9 7 Q20 3 31 7 L33 18 Z" fill={'url(#' + id + ')'} opacity=".75" />
          <path d="M14 24.5l4 4 8-8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M5 18 Q5 9 20 8 Q35 9 35 18 Z" fill={'url(#' + id + ')'} />
          <path d="M5 18 Q5 9 20 8 Q35 9 35 18" fill="none" stroke="rgba(255,255,255,.35)" />
          <rect x="17" y="8.5" width="6" height="26.5" fill={band} opacity=".9" />
          <rect x="15.5" y="16" width="9" height="7" rx="1.5" fill={band} stroke="rgba(0,0,0,.35)" />
          {kind === 'done' && <path d="M15 27.5l3.4 3.4 6.4-6.6" fill="none" stroke="#063a30" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        </>
      )}
    </svg>
  );
}

/** The short label under a chest: "25", "75 + STAMP", "SILVER", "DONE"; a status-only career rung names its badge. */
function nodeLabel(r: MinutesReward, badge?: string): string {
  if (r.done) return 'DONE';
  const head = r.pack ? r.pack.toUpperCase() : r.pick ? 'PLAYER PICK' : r.coins ? r.coins.toLocaleString('en-US') : (badge ?? r.flair ?? '').toUpperCase();
  return head + (r.stamp ? ' + STAMP' : '');
}

const LIFE_AT = (min: number) => min / 60 + ' H';

/** Where `min` sits on a rail of evenly spaced rungs (0..1), so the fill meets each chest on time. */
function railShare(rungs: RungView[], min: number, from = 0): number {
  const n = rungs.length,
    x = (i: number) => (i + 0.5) / n;
  if (!n) return 0;
  if (min < rungs[0].at) return Math.max(0, ((min - from) / Math.max(1, rungs[0].at - from)) * x(0));
  for (let i = 0; i < n - 1; i++)
    if (min < rungs[i + 1].at) return x(i) + ((min - rungs[i].at) / (rungs[i + 1].at - rungs[i].at)) * (x(i + 1) - x(i));
  return 1;
}

function Rail(props: { title: string; value: string; aside: string; track: TrackView; window?: [number, number]; atText?: (m: number) => string; capped?: boolean }) {
  const all = props.track.rungs,
    [lo, hi] = props.window ?? [0, all.length],
    rungs = all.slice(lo, hi),
    next = props.track.next,
    share = railShare(rungs, props.track.min, lo ? all[lo - 1].at : 0);
  return (
    <section className="mv-rail" aria-label={props.title + ': ' + props.value}>
      <div className="mv-rail-head">
        <span>
          {props.title} · <b className="num">{props.value}</b>
        </span>
        <em>{props.aside}</em>
      </div>
      <div className="mv-track">
        <span className="mv-bar" aria-hidden="true">
          <i style={{ '--s': share } as React.CSSProperties} />
        </span>
        <ol>
          {rungs.map((r) => {
            const state = r.claimed ? 'claimed' : r.reached ? 'ready' : next && r.i === next.i && !props.capped ? 'next' : 'locked';
            return (
              <li key={r.i} className="mv-node" data-state={state} aria-label={(props.atText ?? String)(r.at) + ': ' + rewardText(r.reward) + ' · ' + (state === 'claimed' ? 'claimed' : state === 'ready' ? 'ready to claim' : r.minutesLeft + ' min to go')}>
                <small className="num">{(props.atText ?? String)(r.at)}</small>
                <span className="mv-chest">
                  <Chest kind={chestOf(r.reward)} open={state === 'claimed'} size={state === 'next' ? 40 : 34} />
                </span>
                <b>{state === 'ready' ? 'READY' : nodeLabel(r.reward, r.track === 'life' ? LIFE_BADGES[r.i] : undefined)}</b>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** The hero's ring: today's minutes toward the next rung (gold when it is reached). */
function BigRing({ min, target, done }: { min: number; target: number; done: boolean }) {
  const r = 40,
    c = 2 * Math.PI * r,
    share = done ? 1 : Math.max(0, Math.min(1, min / Math.max(1, target)));
  return (
    <span className="mv-ring" data-full={share >= 1 ? '' : undefined} role="img" aria-label={done ? 'Done for today: 90 minutes' : min + ' of ' + target + ' minutes'}>
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r={r} className="track" />
        <circle cx="48" cy="48" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - share)} style={{ '--c': c } as React.CSSProperties} transform="rotate(-90 48 48)" />
      </svg>
      <b className="disp num" aria-hidden="true">
        {done ? 90 : min}
      </b>
      <small aria-hidden="true">{done ? 'MIN TODAY' : 'OF ' + target + ' MIN'}</small>
    </span>
  );
}

const SHIELD: [string, string][] = [
  ['#5f6f7c', '#2b3640'],
  ['#3b6fd8', '#1b326b'],
  ['#2fd3aa', '#0d6150'],
  ['#8b6cf0', '#3b2486'],
  ['#d99a2b', '#6d4210'],
  ['#d86fae', '#6b2252'],
];
const SHORT = ['RK', 'ST', 'PRO', 'AS', 'MVP', 'HOF'];
function TierShield({ i, cur }: { i: number; cur: boolean }) {
  const [a, b] = SHIELD[i];
  return (
    <span className="mv-shield" data-cur={cur ? '' : undefined} title={LEAGUE_TIERS[i]}>
      <svg width="40" height="44" viewBox="0 0 40 44" aria-hidden="true">
        <defs>
          <linearGradient id={'mvs' + i} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        </defs>
        <path d="M20 2 L37 8 V22 C37 32 29 39 20 42 C11 39 3 32 3 22 V8 Z" fill={'url(#mvs' + i + ')'} stroke="rgba(255,255,255,.35)" />
        <path d="M20 5 L34 10" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" />
      </svg>
      <b>{SHORT[i]}</b>
    </span>
  );
}

type Board = 'league' | 'week' | 'all';
const BOARD_LABEL: Record<Board, string> = { league: 'LEAGUE', week: 'THIS WEEK', all: 'HALL OF FAME' };

function LeagueTile({ profile, weekMin }: { profile: Profile; weekMin: number }) {
  const [board, setBoard] = useState<Board>('league');
  const tier = Math.max(0, Math.min(LEAGUE_TIERS.length - 1, profile.playtime?.league.tier ?? 0));
  const hidden = !!profile.settings.hideBoards;
  const line: Record<Board, string> = {
    league: 'You start in the ' + LEAGUE_TIERS[tier] + ' League. Divisions of about 30 players, ranked by active minutes. The top 20% move up a tier each Monday.',
    week: 'This week’s minutes board opens with the leagues. You have ' + minText(weekMin) + ' this week.',
    all: 'Lifetime hours, from the day the leagues open. Badges you earn here stay yours.',
  };
  return (
    <section className="mv-league" aria-labelledby="mv-league-title">
      <div className="mv-tiers" aria-hidden="true">
        {LEAGUE_TIERS.map((_, i) => (
          <TierShield key={i} i={i} cur={i === tier} />
        ))}
      </div>
      <h3 id="mv-league-title" className="disp">
        Leagues start next week
      </h3>
      <span className="seg mv-boards" role="group" aria-label="Minutes boards">
        {(Object.keys(BOARD_LABEL) as Board[]).map((b) => (
          <button key={b} className={board === b ? 'on' : ''} aria-pressed={board === b} onClick={() => setBoard(b)}>
            {BOARD_LABEL[b]}
          </button>
        ))}
      </span>
      <p className="mv-board-note">{line[board]}</p>
      {NET_ON && hidden && <p className="mv-board-note dim">You’re hidden from public boards (Settings). Your minutes and rewards still count here.</p>}
    </section>
  );
}

function Explainer({ onClose }: { onClose: () => void }) {
  return (
    <Sheet label="How Minutes work" onClose={onClose}>
      {(close) => (
        <div className="mv-explain">
          <span className="eyebrow">MINUTES</span>
          <h2 className="disp">How Minutes work</h2>
          <p>We count time you’re actually playing, up to 90 minutes a day. Menus count a little. Idle time doesn’t. Rewards stop at 90 minutes so you can do other things. Matches still pay coins as usual.</p>
          <ul>
            <li>
              <b>Today:</b> rewards at 5, 15, 30, 60 and 90 minutes. The ladder resets at midnight Eastern.
            </li>
            <li>
              <b>This week:</b> rewards at 60, 150, 300, 450 and 600 minutes, Monday to Sunday.
            </li>
            <li>
              <b>Career:</b> badges from 1 hour to 1,000. Packs and coins stop at 25 hours; after that it’s all status.
            </li>
            <li>
              <b>Back after a break?</b> After 3 or more days away, your first three rewards that day are doubled.
            </li>
            <li>Packs land in the Ultimate Team of the sport you claim them in. Scout Stamps and Player Picks are kept for you until their screens open.</li>
          </ul>
          <button className="btn primary" onClick={() => close()}>
            GOT IT
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** What the hero says, by state. */
function heroText(v: ReturnType<typeof minutesView>, headStart: boolean): { title: string; line: string } {
  if (v.ready.length) {
    const one = v.ready[0];
    return {
      title:
        v.ready.length === 1
          ? 'Your ' + (one.track === 'life' ? one.at / 60 + '-hour career' : one.at + (one.track === 'week' ? '-minute week' : '-minute')) + ' reward is ready'
          : v.ready.length + ' rewards ready',
      line: v.ready.map((r) => rewardText(r.reward)).join(' · ') + '.',
    };
  }
  if (v.frozen) return { title: 'Minutes are paused today', line: 'Your phone’s date went back, so today can’t count. Minutes start again tomorrow.' };
  const next = v.day.capped ? null : v.day.next;
  if (!next) return { title: 'Done for today. Great session.', line: MINUTES_DONE_LINE + '. The ladder resets at midnight Eastern.' };
  const silver = v.day.rungs.find((r) => r.reward.pack && !r.reached);
  const teaser = v.rested
    ? ' Welcome back: today’s first three rewards are doubled.'
    : headStart && next.i === 0
      ? ' Your first 3 minutes are on us.'
      : silver && silver.i !== next.i
        ? ' An hour today earns a Silver Pack.'
        : '';
  return {
    title: next.minutesLeft + (next.minutesLeft === 1 ? ' minute' : ' minutes') + ' to your next reward',
    line: rewardText(next.reward) + '.' + teaser,
  };
}

/** The Minutes screen. `update` is the app's profile update; claims go through it. */
export default function MinutesView({ profile, update, now: nowProp }: { profile: Profile; update: (fn: (p: Profile) => Profile) => void; now?: number }) {
  const [explain, setExplain] = useState(false);
  const [claimed, setClaimed] = useState<string | null>(null);
  // the minute on screen: the ladder resets at midnight Eastern without a reload
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const now = nowProp ?? tick;
  const fresh = freshForMinutes(profile),
    v = minutesView(profile.playtime, now, fresh),
    done = v.day.capped && !v.ready.length,
    target = v.ready.find((r) => r.track === 'day')?.at ?? (done ? 90 : (v.day.next?.at ?? 90)),
    hero = heroText(v, fresh || profile.playtime?.endowed === etDay(now)),
    badge = lifeBadge(profile.playtime),
    lifeMin = v.life.min,
    // the career rail shows five of its nine rungs, starting one before the first one not yet claimed
    first = Math.max(0, v.life.rungs.findIndex((r) => !r.claimed)),
    lo = Math.max(0, Math.min(v.life.rungs.length - 5, first - 1)),
    weekNext = v.week.rungs.find((r) => !r.reached && r.reward.pack) ?? v.week.next;
  const claim = () => {
    const at = Date.now();
    const r = claimMinutes(profile, at, SPORT);
    if (!r.granted.length) return;
    update((p) => claimMinutes(p, at, SPORT).profile);
    setClaimed(r.granted.map(rewardText).join(' · '));
  };
  return (
    <div className="mv ps-v2">
      <div className="mv-sub">
        <p>Active play only · up to 90 a day · resets midnight ET</p>
        <button className="mv-info" onClick={() => setExplain(true)} aria-label="How Minutes work">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7.5v.01" />
          </svg>
        </button>
      </div>
      <section className="mv-hero" data-state={v.ready.length ? 'ready' : done ? 'done' : v.frozen ? 'frozen' : 'next'}>
        <BigRing min={v.day.min} target={target} done={done} />
        <div className="mv-hero-text">
          <h2 className="disp">{hero.title}</h2>
          <p>{hero.line}</p>
          {v.ready.length > 0 && (
            <ClaimButton
              onClaim={claim}
              pack={v.ready.some((r) => !!r.reward.pack)}
              label={v.ready.length > 1 ? 'CLAIM ALL' : 'CLAIM'}
              ariaLabel={'Claim ' + v.ready.map((r) => rewardText(r.reward)).join(', ')}
            />
          )}
          {claimed && !v.ready.length && (
            <p className="mv-claimed" role="status">
              Claimed: {claimed}
            </p>
          )}
        </div>
      </section>
      <Rail title="TODAY" value={minText(v.day.min)} aside={v.frozen ? 'PAUSED TODAY' : 'DONE AT 90'} track={v.day} capped={v.day.capped} />
      <Rail
        title="THIS WEEK"
        value={minText(v.week.min)}
        aside={weekNext ? nodeLabel(weekNext.reward).replace(' + STAMP', '') + (weekNext.reward.pack ? ' PACK' : '') + ' AT ' + weekNext.at : 'WEEK COMPLETE'}
        track={v.week}
      />
      <Rail
        title="CAREER"
        value={Math.floor(lifeMin / 6) / 10 + ' H'}
        aside={badge.badge ? badge.badge.toUpperCase() + (badge.next ? ' · ' + badge.next.toUpperCase() + ' NEXT' : '') : 'ROOKIE AT 1 H'}
        track={v.life}
        window={[lo, lo + 5]}
        atText={LIFE_AT}
      />
      <LeagueTile profile={profile} weekMin={v.week.min} />
      <p className="mv-foot">Rewards stop at 90 minutes a day so you can do other things. Matches still pay coins as usual.</p>
      {explain && <Explainer onClose={() => setExplain(false)} />}
    </div>
  );
}
