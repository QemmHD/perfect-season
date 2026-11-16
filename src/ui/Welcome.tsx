import React, { useState } from 'react';
import { pick } from '../engine/sport';
import { type Favorites, markFavoritesAsked, readFavorites, saveFavorites } from '../lib/favorites';
import { nameProblem, randomName } from '../lib/names';
import { sfx } from '../lib/sound';
import { Fit } from './common';
import { FavPicker } from './Favorites';
import { NameField } from './Leaderboard';
import { nextStreak, rewardFor } from '../engine/missions';
import type { Profile } from '../lib/profile';
import { LABEL } from '../ut/labels';
import { Sheet } from './common';
import { Check, Coin } from './icons';
import { CountUp, reducedMotion } from './motion';
import { ChestArt } from './Rewards';
import './first-run.css';

/** First launch of the web app: pick the name everyone else will see, then your NBA and NFL teams. */
export function Welcome({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState(randomName);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'name' | 'teams'>('name');
  const [favs, setFavs] = useState<Favorites>(readFavorites);
  const letters = (word: string, offset: number) =>
    word.split('').map((ch, i) => (
      <i key={i} style={{ animationDelay: offset + i * 45 + 'ms' }}>
        {ch}
      </i>
    ));
  const go = () => {
    const problem = nameProblem(name);
    if (problem) {
      setErr(problem);
      sfx.nope();
      return;
    }
    sfx.select();
    setStep('teams');
  };
  // the teams the first launch asks for: basketball's and football's (a soccer player: his club)
  // this sport's first, matching the picker's open tab (Claude, final QA)
  const need = pick<(keyof Favorites)[]>({ nba: ['nba', 'nfl'], nfl: ['nfl', 'nba'], soccer: ['soccer'] });
  const missing = need.find((k) => !favs[k]);
  const PICK_TEXT: Record<keyof Favorites, string> = { nba: 'PICK AN NBA TEAM', nfl: 'PICK AN NFL TEAM', soccer: 'PICK A CLUB' };
  const finish = (skip: boolean) => {
    if (!skip && missing) {
      sfx.nope();
      return;
    }
    // skipping keeps a pick already made; the rest can be picked in Profile
    if (favs.nba || favs.nfl || favs.soccer) saveFavorites(favs);
    markFavoritesAsked();
    sfx.seriesWin();
    onDone(name.trim());
  };
  if (step === 'teams')
    return (
      <form
        className="screen welcome fav-step"
        onSubmit={(e) => {
          e.preventDefault();
          finish(false);
        }}
      >
        <div className="welcome-card rise-in">
          <span className="eyebrow wide">Welcome, {name.trim()}</span>
          <h2 className="disp">Pick your teams</h2>
          <p>Your players wear their colors when you play head to head.</p>
          <FavPicker value={favs} onChange={setFavs} />
        </div>
        <div className="spacer" />
        <div className="actionbar">
          <button type="submit" className="big shine" aria-disabled={!!missing}>
            <Fit text={missing ? PICK_TEXT[missing] : 'LET’S GO'} />
          </button>
          <button type="button" className="fav-skip" onClick={() => finish(true)}>
            Skip for now
          </button>
        </div>
      </form>
    );
  return (
    <form
      className="screen welcome"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <h1 className="logo intro" aria-label="Perfect Season">
        <span className="disp l1" aria-hidden="true">
          {letters('PERFECT', 80)}
        </span>
        <span className="disp l2" aria-hidden="true">
          {letters('SEASON', 300)}
        </span>
      </h1>
      <div className="welcome-card rise-in" style={{ animationDelay: '500ms' }}>
        <span className="eyebrow wide">Welcome, rookie</span>
        <h2 className="disp">Pick your name</h2>
        <p>It goes on the global leaderboards and shows up when you play real people head to head.</p>
        <NameField
          value={name}
          onChange={(v) => {
            setName(v);
            setErr(null);
          }}
          error={err}
        />
        {err ? (
          <p className="note err" role="alert">
            {err}
          </p>
        ) : (
          <p className="note">2–16 letters or numbers. Tap the dice for a random one. You can change it later.</p>
        )}
      </div>
      <ul className="welcome-perks rise-in" style={{ animationDelay: '650ms' }}>
        <li>
          <b>Draft</b> {pick({ nba: 'five', nfl: 'eight', soccer: 'eight' })} players from random {pick({ nba: 'NBA teams', nfl: 'NFL teams', soccer: 'clubs' })} and decades
        </li>
        <li>
          <b>Climb</b> the daily, weekly and all-time leaderboards
        </li>
        <li>
          <b>Battle</b> real players live in Head to Head
        </li>
        <li>
          <b>Build</b> your {LABEL.ultimateTeam}: a free starter pack is waiting
        </li>
      </ul>
      <div className="spacer" />
      <div className="actionbar">
        <button type="submit" className="big shine">
          <Fit text="NEXT" />
        </button>
      </div>
    </form>
  );
}

// ---------- ut-4: the first run (audit M7, Game Design V2 D.15) ----------
// The testers' gift and the Day 1 chest used to arrive as two sheets, one after the other. Now one
// welcoming sheet holds both: COLLECT ALL pays them in one tap (the same receipts as before: the gift's
// id in `gifts`, `rewardDay` and the streak), then "OPEN YOUR FREE STARTER PACK" leads to Ultimate
// Team's Home, where the starter pack waits.

export interface FirstRunGift {
  id: string;
  coins: number;
}
export interface FirstRunPlan {
  gift: FirstRunGift;
  /** today's chest, when not opened yet today: its streak day and what it pays */
  chest: { day: number; coins: number; xp: number } | null;
  /** the free starter pack waits in Ultimate Team */
  starter: boolean;
}

/** What the first-run sheet offers, or null when the gift is already collected (the usual daily chest applies). */
export function firstRunPlan(p: Profile, today: string, gift: FirstRunGift): FirstRunPlan | null {
  if ((p.gifts ?? []).includes(gift.id)) return null;
  const st = nextStreak(p.streak, today);
  return {
    gift,
    chest: p.rewardDay === today ? null : { day: st.count, ...rewardFor(st.count) },
    starter: !p.ut.starterClaimed,
  };
}

/** Pay everything the sheet offers, once: a second call (or a stale plan) pays nothing more. */
export function collectFirstRun(p: Profile, today: string, gift: FirstRunGift): Profile {
  let out = p;
  if (!(out.gifts ?? []).includes(gift.id)) out = { ...out, coins: out.coins + gift.coins, gifts: [...(out.gifts ?? []), gift.id] };
  if (out.rewardDay !== today) {
    const st = nextStreak(out.streak, today),
      rw = rewardFor(st.count);
    out = { ...out, streak: st, rewardDay: today, coins: out.coins + rw.coins, xp: out.xp + rw.xp };
  }
  return out;
}

/** The one welcoming sheet: the gift and today's chest, COLLECT ALL, then the starter pack. */
export function FirstRunSheet({ plan, onCollect, onStarter, onClose }: { plan: FirstRunPlan; onCollect: () => void; onStarter: () => void; onClose: () => void }) {
  const [done, setDone] = useState(false);
  const total = plan.gift.coins + (plan.chest?.coins ?? 0);
  const collect = () => {
    if (done) return;
    setDone(true);
    sfx.levelUp();
    window.setTimeout(() => sfx.coin(), 380);
    onCollect();
  };
  return (
    // closing it any other way still collects: nothing offered here is lost
    <Sheet label="Welcome gifts" kind="center" onClose={() => (done || onCollect(), onClose())}>
      {(close) => (
        <div className="first-run">
          <span className="eyebrow wide">Welcome to Perfect Season</span>
          <h2 className="disp">{done ? 'All yours' : 'Your welcome gifts'}</h2>
          <ul className={'fr-gifts' + (done ? ' done' : '')}>
            <li>
              <span className="fr-art coin" aria-hidden="true">
                <Coin size={34} />
              </span>
              <span className="fr-txt">
                <small>THANK YOU FOR TESTING</small>
                <b className="num">{plan.gift.coins.toLocaleString('en-US')} coins</b>
              </span>
              {done && <Check size={20} />}
            </li>
            {plan.chest && (
              <li>
                <span className="fr-art chest" aria-hidden="true">
                  <ChestArt />
                </span>
                <span className="fr-txt">
                  <small>DAILY CHEST · DAY {Math.min(7, plan.chest.day)} OF 7</small>
                  <b className="num">
                    {plan.chest.coins} coins · {plan.chest.xp} XP
                  </b>
                </span>
                {done && <Check size={20} />}
              </li>
            )}
          </ul>
          {done ? (
            <>
              <p className="fr-total" aria-live="polite">
                <b className="disp num">
                  +<CountUp value={total} from={0} ms={reducedMotion() ? 0 : 700} />
                </b>
                <Coin size={22} />
              </p>
              {plan.starter ? (
                <>
                  <button className="btn gold shine fr-go" onClick={() => close(onStarter)}>
                    OPEN YOUR FREE STARTER PACK
                  </button>
                  <small className="fr-note">A full squad to start your {LABEL.ultimateTeam}, with one gold to build around.</small>
                </>
              ) : (
                <button className="btn primary fr-go" onClick={() => close()}>
                  LET’S PLAY
                </button>
              )}
            </>
          ) : (
            <>
              <p className="note">Come back every day: the chest grows for 7 days.</p>
              <button className="btn gold shine fr-go" onClick={collect}>
                COLLECT ALL
              </button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
