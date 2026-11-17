import React, { useEffect, useState } from 'react';
import { ALL_MISSIONS_BONUS, missionsFor, rewardFor } from '../engine/missions';
import type { Profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { Confetti, Sheet } from './common';
import { Check, Coin, Flame } from './icons';
import { CountUp, reducedMotion } from './motion';

/** The chest you open once a day. Coming back on consecutive days makes it bigger. */
export function DailyReward({ streakDay, onClaim, onClose }: { streakDay: number; onClaim: () => void; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const reward = rewardFor(streakDay);
  const tap = () => {
    if (open) return;
    setOpen(true);
    sfx.levelUp();
    window.setTimeout(() => sfx.coin(), 380);
    onClaim();
  };
  return (
    <Sheet label="Daily reward" kind="center" onClose={onClose}>
      {(close) => (
        <div className="reward">
          <span className="eyebrow wide">Daily reward</span>
          <h2 className="disp">{streakDay > 1 ? streakDay + '-day streak!' : 'Day 1 reward'}</h2>
          <div className="streak-dots" aria-label={'Day ' + Math.min(7, streakDay) + ' of 7'}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <span key={d} className={d < Math.min(7, streakDay) ? 'done' : d === Math.min(7, streakDay) ? 'now' : ''}>
                <i>{d === 7 ? '★' : d}</i>
                <small>{rewardFor(d).coins}</small>
              </span>
            ))}
          </div>
          <button className={'chest' + (open ? ' open' : '')} onClick={tap} aria-label={open ? 'Opened' : 'Open the chest'}>
            <ChestArt />
            {open && (
              <span className="chest-pay" aria-live="polite">
                <b className="disp num">
                  +<CountUp value={reward.coins} from={0} ms={700} />
                </b>
                <Coin size={22} />
                <small>+{reward.xp} XP</small>
              </span>
            )}
          </button>
          <p className="note">{open ? 'Come back tomorrow for ' + rewardFor(streakDay + 1).coins + ' coins.' : 'Tap the chest to open it.'}</p>
          {open ? (
            <button className="btn primary" onClick={() => close()}>
              COLLECT
            </button>
          ) : (
            <button className="btn gold" onClick={tap}>
              OPEN
            </button>
          )}
          {open && !reducedMotion() && <Confetti density={1.2} colors={['#F5B83D', '#FFD36B', '#FFFFFF', '#19E3C9']} />}
        </div>
      )}
    </Sheet>
  );
}

function ChestArt() {
  return (
    <svg className="chest-art" width="150" height="120" viewBox="0 0 150 120" aria-hidden="true">
      <defs>
        <linearGradient id="chestBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a2b" />
          <stop offset="1" stopColor="#5b3818" />
        </linearGradient>
        <linearGradient id="chestBand" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f5b83d" />
          <stop offset="0.5" stopColor="#ffe29a" />
          <stop offset="1" stopColor="#e9a21f" />
        </linearGradient>
        <radialGradient id="chestGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#ffe29a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffe29a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="chest-light" cx="75" cy="52" rx="70" ry="44" fill="url(#chestGlow)" />
      <g className="chest-base">
        <rect x="22" y="56" width="106" height="54" rx="8" fill="url(#chestBody)" stroke="#2b1a0a" strokeWidth="3" />
        <rect x="22" y="70" width="106" height="8" fill="url(#chestBand)" />
        <rect x="67" y="64" width="16" height="22" rx="3" fill="url(#chestBand)" stroke="#7a4f12" strokeWidth="2" />
      </g>
      <g className="chest-lid">
        <path d="M22 58 Q22 22 75 22 Q128 22 128 58 Z" fill="url(#chestBody)" stroke="#2b1a0a" strokeWidth="3" />
        <path d="M70 22 h10 v36 h-10z" fill="url(#chestBand)" />
      </g>
    </svg>
  );
}

/** Today's three missions, with progress and claim buttons. */
export function MissionsSheet({ profile, day, onClaim, onClose }: { profile: Profile; day: string; onClaim: (i: number) => void; onClose: () => void }) {
  const list = missionsFor(day);
  const st = profile.missions && profile.missions.day === day ? profile.missions : { day, progress: [0, 0, 0], claimed: [false, false, false] };
  const claimedAll = st.claimed.every(Boolean);
  const [left, setLeft] = useState(untilMidnight());
  useEffect(() => {
    const t = window.setInterval(() => setLeft(untilMidnight()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <Sheet label="Missions" onClose={onClose}>
      {(close) => (
        <>
          <div className="missions-head">
            <h2 className="disp">Missions</h2>
            <small>New ones in {left}</small>
          </div>
          <div className="missions">
            {list.map((m, i) => {
              const p = Math.min(m.goal, st.progress[i] ?? 0);
              const done = p >= m.goal;
              const claimed = st.claimed[i];
              return (
                <div key={m.id} className={'mission rise-in' + (done ? ' done' : '') + (claimed ? ' claimed' : '')} style={{ animationDelay: i * 70 + 'ms' }}>
                  <div className="mission-main">
                    <strong>{m.text}</strong>
                    <span className="bar">
                      <i style={{ width: (p / m.goal) * 100 + '%' }} className={done ? 'full' : ''} />
                    </span>
                    <small className="num">
                      {p}/{m.goal} · +{m.coins} coins · +{m.xp} XP
                    </small>
                  </div>
                  {claimed ? (
                    <span className="claimed-mark" aria-label="Claimed">
                      <Check size={18} />
                    </span>
                  ) : done ? (
                    <button className="btn gold claim shine" onClick={() => onClaim(i)}>
                      CLAIM
                    </button>
                  ) : (
                    <span className={'mission-tier t' + i}>{['EASY', 'MEDIUM', 'HARD'][i]}</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="note">{claimedAll ? 'All done for today, including the +' + ALL_MISSIONS_BONUS + ' bonus. Come back tomorrow.' : 'Claim all three for a +' + ALL_MISSIONS_BONUS + ' coin bonus.'}</p>
          <button className="btn primary" onClick={() => close()}>
            DONE
          </button>
        </>
      )}
    </Sheet>
  );
}

/** "5h 12m" until the next Eastern midnight. */
function untilMidnight(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const left = 1440 - (get('hour') * 60 + get('minute'));
    return Math.floor(left / 60) + 'h ' + String(left % 60).padStart(2, '0') + 'm';
  } catch {
    return 'a few hours';
  }
}

/** Streak flame chip for the home screen. */
export function StreakChip({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button className={'statchip streak' + (count >= 3 ? ' hot' : '')} onClick={onClick} aria-label={count + '-day streak'}>
      <Flame size={16} />
      <b className="num">{count}</b>
    </button>
  );
}
