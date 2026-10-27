import React, { useState } from 'react';
import { NFL } from '../engine/sport';
import { type Favorites, markFavoritesAsked, readFavorites, saveFavorites } from '../lib/favorites';
import { nameProblem, randomName } from '../lib/names';
import { sfx } from '../lib/sound';
import { Fit } from './common';
import { FavPicker } from './Favorites';
import { NameField } from './Leaderboard';

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
  const finish = (skip: boolean) => {
    if (!skip && (!favs.nba || !favs.nfl)) {
      sfx.nope();
      return;
    }
    // skipping keeps a pick already made; the rest can be picked in Profile
    if (favs.nba || favs.nfl) saveFavorites(favs);
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
          <button type="submit" className="big shine" aria-disabled={!favs.nba || !favs.nfl}>
            <Fit text={!favs.nba ? 'PICK AN NBA TEAM' : !favs.nfl ? 'PICK AN NFL TEAM' : 'LET’S GO'} />
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
          <b>Draft</b> {NFL ? 'eight' : 'five'} players from random {NFL ? 'NFL' : 'NBA'} teams and decades
        </li>
        <li>
          <b>Climb</b> the daily, weekly and all-time leaderboards
        </li>
        <li>
          <b>Battle</b> real players live in Head to Head
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
