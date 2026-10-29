// Opening a pack, full screen: the pack tears open, and its best card (a gold, a Hot Season or a
// Legend) walks out: the lights go down to his team's colors, then his position, then his team and
// season, then the man himself with his overall counting up. Then every card in the pack turns
// over, worst to best. A tap skips ahead; reduced motion shows it all at once.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sfx, vibrate } from '../lib/sound';
import { Confetti } from '../ui/common';
import { CountUp, reducedMotion } from '../ui/motion';
import './pack-reveal.css';
import { GoatCrown, UtCard, UtCardBack } from './CardArt';
import { PackArt } from './Hub';
import { revealOrder, walkoutLevel } from './packs';
import { seasonText } from './pool';
import { TIER_NAMES } from './rate';
import type { Opening, UtView } from './UltimateTeam';

type Phase = 'pack' | 'tear' | 'walkout' | 'reveal';

/** Card width in the reveal grid, by how many there are. */
function gridFor(n: number): { cols: number; w: number } {
  if (n <= 3) return { cols: n, w: 104 };
  if (n <= 6) return { cols: 3, w: 96 };
  if (n <= 12) return { cols: 4, w: 76 };
  if (n <= 16) return { cols: 4, w: 70 };
  return { cols: 5, w: 60 };
}

export function PackOpening({ opening, onDone }: { opening: Opening; onDone: (to?: UtView) => void }) {
  const still = useMemo(reducedMotion, []);
  const order = useMemo(() => revealOrder(opening.cards.map((c) => c.rc)), [opening]);
  const star = order[order.length - 1];
  const special = star?.tier === 'goat' || star?.tier === 'spotlight';
  const level = star ? walkoutLevel(star) : 0;
  // a challenge's reward card has no pack to tear
  const reward = opening.kind === 'reward';
  const [phase, setPhase] = useState<Phase>(reward ? (level ? 'walkout' : 'reveal') : 'pack');
  const [step, setStep] = useState(still ? 4 : 0);
  const [flipped, setFlipped] = useState(still ? order.length : 0);
  const timers = useRef<number[]>([]);
  const walkoutSkipped = useRef(false);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const tear = () => {
    if (phase !== 'pack') return;
    sfx.whoosh();
    vibrate(20);
    setPhase('tear');
    later(still ? 0 : 720, () => setPhase(level ? 'walkout' : 'reveal'));
  };

  // the walkout, step by step: lights, position, team and season, the player
  const pace = level === 4 ? 1.5 : level >= 3 ? 1.25 : level === 2 ? 1 : 0.7;
  useEffect(() => {
    if (phase !== 'walkout' || still || walkoutSkipped.current) return;
    sfx.heartbeat();
    const at = [0, 800, 1650, 2600].map((t) => t * pace);
    later(at[1], () => (setStep(1), sfx.stamp()));
    later(at[2], () => (setStep(2), sfx.stamp(), level >= 2 && sfx.heartbeat()));
    later(at[3], () => {
      setStep(3);
      sfx.place();
      if (level >= 3) sfx.title();
      else if (level === 2) sfx.roar();
      else sfx.seriesWin();
    });
    later(at[3] + Math.max(1300, 1100 * pace + 100), () => setStep(4));
  }, [phase]);

  // the reveal: one card at a time
  useEffect(() => {
    if (phase !== 'reveal' || still || flipped >= order.length) return;
    const t = window.setTimeout(
      () => {
        const c = order[flipped];
        if (c.tier === 'bronze' || c.tier === 'silver') sfx.tick();
        else sfx.select();
        setFlipped((n) => n + 1);
      },
      flipped === 0 ? 260 : order.length > 12 ? 90 : 170
    );
    return () => clearTimeout(t);
  }, [phase, flipped]);

  const skip = () => {
    if (phase !== 'reveal') walkoutSkipped.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (phase === 'pack' || phase === 'tear') {
      walkoutSkipped.current = true;
      setPhase(level ? 'walkout' : 'reveal');
      if (level) setStep(4);
    } else if (phase === 'walkout') {
      if (step < 4) setStep(4);
      else setPhase('reveal');
    } else setFlipped(order.length);
  };

  const g = gridFor(order.length);
  const done = phase === 'reveal' && flipped >= order.length;
  const golds = order.filter((c) => c.tier !== 'bronze' && c.tier !== 'silver').length;
  const l = star?.line;
  const packLabel = opening.title.replace(/ Pack$/, '').toUpperCase();

  return (
    <div
      className={
        'ut-open-screen' +
        (special ? ' ut-rare-reveal edition-' + star.tier : '') +
        (walkoutSkipped.current ? ' is-skipped' : '') +
        ' ph-' +
        phase +
        (phase === 'walkout' ? ' wl-' + level + ' st-' + step + ' t-' + star.tier : '')
      }
      style={l ? ({ '--c1': l.c1, '--c2': l.c2 } as React.CSSProperties) : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={'Opening ' + opening.title}
      onClick={() => (phase === 'pack' ? tear() : phase === 'walkout' && step >= 4 ? setPhase('reveal') : undefined)}
    >
      {(phase === 'pack' || phase === 'tear') && (
        <div className="ut-tear">
          <span className="ut-tear-glow" aria-hidden="true" />
          <span className={'ut-tear-pack' + (phase === 'tear' ? ' torn' : '')}>
            {/* the same pack twice, cut along the tear: the top flies off, the bottom drops away */}
            <span className="ut-half top">
              <PackArt kind={opening.kind} label={packLabel} sport={l?.sport ?? 'nba'} />
            </span>
            <span className="ut-half bottom">
              <PackArt kind={opening.kind} label={packLabel} sport={l?.sport ?? 'nba'} />
            </span>
            <span className="ut-tear-burst" aria-hidden="true" />
          </span>
          <b className="disp ut-tear-name">{opening.title}</b>
          <span className="ut-tear-hint">{phase === 'pack' ? 'TAP TO OPEN' : ''}</span>
        </div>
      )}

      {phase === 'walkout' && star && l && (
        <div className="ut-walk" aria-live="assertive">
          <span className="ut-walk-beams" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="ut-walk-floor" aria-hidden="true" />
          {special && (
            <div className="ut-rare-scenery" aria-hidden="true">
              <i className="ut-rare-orbit outer" />
              <i className="ut-rare-orbit inner" />
              <span className="ut-rare-rail left">PERFECT SEASON / {star.tier === 'goat' ? 'GREATEST OF ALL TIME' : 'SPOTLIGHT SERIES'}</span>
              <span className="ut-rare-rail right">PERFECT SEASON / {star.tier === 'goat' ? 'GREATEST OF ALL TIME' : 'SPOTLIGHT SERIES'}</span>
              <span className="ut-rare-scan" />
            </div>
          )}
          {special && step < 3 && (
            <div className="ut-rare-prologue">
              {star.tier === 'goat' ? (
                <GoatCrown className="ut-rare-crown" />
              ) : (
                <span className="ut-spotlight-mark" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              <span className="eyebrow">{star.tier === 'goat' ? 'AN ALL-TIME MOMENT' : 'IN A DIFFERENT LIGHT'}</span>
            </div>
          )}
          {step >= 1 && step < 3 && (
            <span className="ut-walk-pos" key="pos">
              <i className="eyebrow">Position</i>
              <b className="disp">{star.pos}</b>
            </span>
          )}
          {step === 2 && (
            <span className="ut-walk-team" key="team">
              <i className="ut-walk-badge">{l.abbr}</i>
              <b>{seasonText(l)}</b>
              <small>{l.teamName}</small>
            </span>
          )}
          {step >= 3 && (
            <>
              {special && <span className="ut-rare-edition eyebrow">{star.tier === 'goat' ? 'GREATEST OF ALL TIME' : 'SPOTLIGHT EDITION'}</span>}
              <b className={'disp ut-walk-tier t-' + star.tier}>{star.tier === 'gold' ? (level >= 2 ? 'GOLD STAR' : 'GOLD') : TIER_NAMES[star.tier].toUpperCase()}</b>
              <span className="ut-walk-card">
                <UtCard rc={star} w={190} attrs pose={level >= 2 ? 'cheer' : 'stand'} tilt={step >= 4} />
              </span>
              <span className="ut-walk-ovr">
                <b className="disp num">
                  <CountUp value={star.ovr} from={still || walkoutSkipped.current ? star.ovr : 40} ms={1100 * pace} />
                </b>
                <span>
                  <strong>{l.name}</strong>
                  <small>
                    {star.pos} · {seasonText(l)} {l.teamName}
                  </small>
                </span>
              </span>
              {special && opening.mint && (
                <div className="ut-rare-number">
                  <span className="eyebrow">YOUR REGISTERED COPY</span>
                  <strong className="disp num">
                    #{opening.mint.serial}
                    <i> / {opening.mint.total}</i>
                  </strong>
                  <small>Worldwide total grows. Your number stays yours.</small>
                </div>
              )}
              {level >= 2 && !still && !walkoutSkipped.current && (
                <Confetti
                  density={level === 4 ? 2 : 1}
                  colors={special ? (star.tier === 'goat' ? ['#f5d88d', '#fff2c7', '#19e3c9'] : ['#19e3c9', '#b79aea', '#f5d88d']) : [l.c1, l.c2, '#ffffff', '#FFD36B']}
                />
              )}
            </>
          )}
          {step >= 4 && <span className="ut-tear-hint">TAP TO CONTINUE</span>}
        </div>
      )}

      {phase === 'reveal' && (
        <div className="ut-reveal">
          <span className="eyebrow">{opening.title}</span>
          <h2 className="disp">
            {!done
              ? 'Opening…'
              : star?.tier === 'goat'
                ? 'Greatest of all time.'
                : star?.tier === 'spotlight'
                  ? 'In the Spotlight!'
                  : star?.tier === 'legend'
                    ? 'A Legend!'
                    : star?.tier === 'promo'
                      ? 'A Hot Season!'
                      : golds
                        ? golds + (golds === 1 ? ' gold' : ' golds')
                        : order.length + ' new cards'}
          </h2>
          {done && opening.mint && (
            <p className="ut-mint-receipt">
              YOUR COPY #{opening.mint.serial} · {opening.mint.total} REGISTERED WORLDWIDE
            </p>
          )}
          {done && !!opening.stored && (
            <p className="ut-storage-receipt">
              {opening.stored} duplicate {opening.stored === 1 ? 'copy was' : 'copies were'} saved to Duplicate Storage.
            </p>
          )}
          <div className="ut-reveal-grid" style={{ gridTemplateColumns: 'repeat(' + g.cols + ', ' + g.w + 'px)' }}>
            {order.map((rc, i) => (
              <span key={rc.line.id + i} className={'ut-flip' + (i < flipped ? ' on t-' + rc.tier : '')} style={{ width: g.w, height: Math.round(g.w * 1.4) }}>
                <span className="ut-flip-in">
                  <span className="ut-flip-back">
                    <UtCardBack w={g.w} />
                  </span>
                  <span className="ut-flip-front">
                    <UtCard rc={rc} w={g.w} />
                  </span>
                </span>
              </span>
            ))}
          </div>
          {done && (
            <div className="ut-reveal-btns rise-in">
              <button className="btn" onClick={() => (sfx.click(), onDone('club'))}>
                SEE CLUB
              </button>
              <button className="btn primary" onClick={() => (sfx.click(), onDone())}>
                DONE
              </button>
            </div>
          )}
        </div>
      )}

      {!done && phase !== 'pack' && (
        <button
          className="ut-skip"
          onClick={(e) => {
            e.stopPropagation();
            skip();
          }}
        >
          SKIP
        </button>
      )}
    </div>
  );
}
