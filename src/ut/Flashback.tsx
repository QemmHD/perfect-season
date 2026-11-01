// A Flashback, full screen: the moment (the story, the score as it stood, what it takes), then the
// game with the squads of the day, then how it went and what it paid. A first clear's Moments card
// walks out like a pack's promo. See src/ut/flashbacks.ts.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { easternDateKey } from '../engine/season';
import { SPORT } from '../engine/sport';
import { Football2 } from '../game/football2/Football2';
import { Hoops2 } from '../game/hoops2/Hoops2';
import type { Progress } from '../game/progress';
import { type BasketballKit, type FootballKit, kitsFor } from '../game/uniforms';
import { newId, type Profile } from '../lib/profile';
import { sfx, vibrate } from '../lib/sound';
import { UtCard } from './CardArt';
import { type FlashResult, flashTeams, FLASHBACKS, goalText, heroCard, PAID_REPLAYS_A_DAY, REPLAY_COINS, settleFlash } from './flashbacks';
import { PackOpening } from './PackOpening';
import { getPool, type Pool, seasonText } from './pool';
import { rateCard } from './rate';
import './match.css';

const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export default function FlashbackScreen(props: { id: string; profile: Profile; update: (fn: (p: Profile) => Profile) => void; onExit: () => void; autoplay?: boolean }) {
  const f = FLASHBACKS.find((x) => x.id === props.id && x.sport === SPORT);
  const [pool, setPool] = useState<Pool | null>(null);
  useEffect(() => {
    let live = true;
    getPool().then((p) => live && setPool(p));
    return () => {
      live = false;
    };
  }, []);
  const [stage, setStage] = useState<'intro' | 'play' | 'result'>(props.autoplay ? 'play' : 'intro');
  const [attempt, setAttempt] = useState(0);
  const [out, setOut] = useState<{ score: number; won: boolean; res: FlashResult } | null>(null);
  const [walk, setWalk] = useState(false);
  const settled = useRef(false);
  const teams = useMemo(() => (pool && f ? flashTeams(pool, f) : null), [pool]);
  const hero = useMemo(() => (pool && f ? heroCard(pool, f) : null), [pool]);
  const heroRc = useMemo(() => (hero ? rateCard(hero) : null), [hero]);
  const kits = useMemo(() => (f ? kitsFor(f.us.fr, f.them.fr, SPORT) : undefined), []);
  if (!f) return null;
  const ut = props.profile.ut;
  const cleared = (ut.flash?.done[f.id] ?? 0) > 0;
  const day = easternDateKey();
  const paidLeft = Math.max(0, PAID_REPLAYS_A_DAY - (ut.flash && ut.flash.day === day ? ut.flash.n : 0));

  const done = (p: Progress) => {
    if (settled.current) return;
    settled.current = true;
    const won = p.score >= f.need;
    const uid = newId();
    const at = Date.now();
    const res = settleFlash(props.profile.ut, f, won, day, hero, uid, at);
    props.update((p0) => {
      const r = settleFlash(p0.ut, f, won, day, hero, uid, at);
      return { ...p0, coins: p0.coins + r.coins, ut: r.ut };
    });
    if (won) {
      sfx.title();
      vibrate([30, 40, 30]);
    } else sfx.groan();
    setOut({ score: p.score, won, res });
    setStage('result');
  };
  const again = () => {
    settled.current = false;
    setOut(null);
    setAttempt((n) => n + 1);
    setStage('play');
  };

  if (stage === 'play' && teams && kits) {
    const seed = 'flash:' + f.id + ':' + attempt + ':' + day;
    const rival = { name: 'TO WIN', score: f.need, drive: f.n, done: true };
    return SPORT === 'nba' ? (
      <Hoops2 key={attempt} five={teams.five} rivalFive={teams.rivalFive} bench={teams.bench} rivalName={f.them.name} seed={seed} possessions={f.n} rival={rival} ourKit={kits.mine as BasketballKit} theirKit={kits.theirs as BasketballKit} court={kits.court} autoplayHook={props.autoplay} onProgress={() => {}} onDone={done} />
    ) : (
      <Football2 key={attempt} offense={teams.offense} rivalDefense={teams.rivalDefense} rivalName={f.them.name} seed={seed} drives={f.n} start={f.start} clock={f.clock} rival={rival} ourKit={kits.mine as FootballKit} theirKit={kits.theirs as FootballKit} field={kits.field} autoplayHook={props.autoplay} onProgress={() => {}} onDone={done} />
    );
  }

  const side = (s: typeof f.us) => s.name + ' · ' + seasonText({ sport: SPORT, season: s.season });
  return (
    <div className={'screen flash-screen' + (stage === 'result' ? (out?.won ? ' won' : ' lost') : '')}>
      <div className="flash-film" aria-hidden="true" />
      <div className="flash-body">
        {stage !== 'result' || !out ? (
          <>
            <span className="eyebrow">{f.date}</span>
            <h1 className="disp flash-title">{f.title}</h1>
            <p className="flash-story">{f.story}</p>
            <div className="flash-board">
              <span className="eyebrow">The score</span>
              <b className="disp">{f.board}</b>
            </div>
            <div className="flash-match">
              <b>{side(f.us)}</b>
              <small>vs</small>
              <b>{side(f.them)}</b>
            </div>
            <div className="flash-goal">
              <span className="eyebrow">Your moment · {STARS(f.stars)}</span>
              <b>{goalText(f)}</b>
              {f.clock && <small>{Math.floor(f.clock / 60) + ':' + String(f.clock % 60).padStart(2, '0')} on the clock</small>}
            </div>
            <div className="flash-prize">
              {heroRc && <UtCard rc={heroRc} w={92} />}
              <span>
                <span className="eyebrow">{cleared ? 'Cleared' : 'First clear'}</span>
                <b>{cleared ? 'Replays won pay ' + REPLAY_COINS + ' coins' : f.coins.toLocaleString('en-US') + ' coins'}</b>
                <small>{cleared ? paidLeft + ' paid ' + (paidLeft === 1 ? 'replay' : 'replays') + ' left today' : heroRc ? 'and ' + heroRc.line.name + '’s Moments card' : ''}</small>
              </span>
            </div>
            <div className="btnrow flash-btns">
              <button className="btn" onClick={() => (sfx.click(), props.onExit())}>
                BACK
              </button>
              <button className="btn gold" disabled={!teams} onClick={() => (sfx.click(), setStage('play'))}>
                {teams ? 'PLAY THE MOMENT' : 'LOADING…'}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="eyebrow">{f.title}</span>
            <h1 className="disp flash-title">{out.won ? 'You did it' : 'Not this time'}</h1>
            <p className="flash-story num">
              You scored {out.score}, {out.won ? 'and it took ' + f.need + '.' : 'and it took ' + f.need + '.'}
            </p>
            {out.won && (
              <div className="flash-paid">
                {out.res.coins > 0 && <b className="num">+{out.res.coins.toLocaleString('en-US')} coins</b>}
                {out.res.capped && <small>Today’s paid replays are used up: come back tomorrow.</small>}
                {out.res.card && heroRc && (
                  <button className="btn gold" onClick={() => (sfx.click(), setWalk(true))}>
                    SEE {heroRc.line.name.toUpperCase()}’S MOMENTS CARD
                  </button>
                )}
              </div>
            )}
            <div className="btnrow flash-btns">
              <button className="btn" onClick={() => (sfx.click(), props.onExit())}>
                DONE
              </button>
              <button className="btn primary" onClick={() => (sfx.click(), again())}>
                {out.won ? 'PLAY IT AGAIN' : 'TRY AGAIN'}
              </button>
            </div>
          </>
        )}
      </div>
      {walk && out?.res.card && heroRc && <PackOpening opening={{ id: 'flash:' + f.id, title: 'Moments', kind: 'reward', cards: [{ uid: out.res.card.uid, rc: heroRc }] }} onDone={() => setWalk(false)} />}
    </div>
  );
}
