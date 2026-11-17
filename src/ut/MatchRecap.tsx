// Claude, 2026-11-17 (studio overhaul, team ut, task ut-5; Game Design V2 D.1, mockups "Post-match,
// 5 seconds"): the end of every Ultimate Team match, in five seconds.
//   0.0–2.5 s  the result slam: WIN / LOSS / DRAW with the score counting up, the opponent, the match
//              GRADE, PERFECTS, BEST HEAT and FLAWLESS (when the sport reports a grade) and the man of
//              the match (when there is a box score)
//   2.5–5.0 s  the tally: coins, Career XP, card XP, the Season Pass, objectives, Rivals and Active
//              Minutes all count up together with a rising tick; whatever completed pops; one CLAIM ALL
//   5.0 s      the One-More bar where the A button sits, the next match already chosen
// A tap anywhere jumps to the final state (that tap never presses anything); reduced motion starts
// there. The bar never starts a match by itself and has no countdown. Timer-driven beats use sound
// only: the only haptics are the CLAIM ALL and One-More taps themselves (kit.tsx).
//
// Count-ups run in one requestAnimationFrame loop that writes text and transforms straight to the DOM:
// React renders three times (slam, tally, done), never per frame. Styles: match-recap.css.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '../lib/sound';
import { Sheet } from '../ui/common';
import { reducedMotion } from '../ui/motion';
import { IconCheck, IconCoins, IconPass, IconStar } from './icons';
import { ClaimButton, GoldBar } from './kit';
import { heatText } from './match-box';
import { endLabel, endPoints, endSpoken, type Recap } from './match-recap';
import { ratingText, statLine } from './match-ratings';
import { MatchDebrief } from './MatchDebrief';
import type { NextAction } from './next-action';
import { SEASON_STEP } from './objectives';
import { DIVISIONS } from './rivals';
import type { UtSport } from './types';
import './match-recap.css';

/** The beats, in ms from the result's first frame (V2 D.1). */
/** The bar lands just inside the 5-second mark (a frame of slack, so it is never late). */
export const RECAP_MS = { slam: 2500, tallyRun: 1600, bar: 4900 } as const;
type Phase = 'slam' | 'tally' | 'done';

/** useLayoutEffect in the browser; plain useEffect where there is no DOM (server render in tests) */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const ease = (p: number) => 1 - Math.pow(1 - p, 3);
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtPlus = (n: number) => '+' + fmtInt(n);
const frac = (n: number, d: number) => (d > 0 ? Math.max(0, Math.min(1, n / d)) : 0);

interface Anim {
  el: HTMLElement;
  bar: boolean;
  from: number;
  to: number;
  at: number;
  dur: number;
  fmt: (n: number) => string;
}

/** Count-ups and bar fills for one recap: registered by ref, driven by one clock. */
function useCountUps() {
  const anims = useRef(new Map<string, Anim>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const spec = useRef(new Map<string, Omit<Anim, 'el'>>());
  /** a number that counts from `from` to `to` starting at `at` ms */
  const reg = (key: string, a: Omit<Anim, 'el' | 'bar' | 'fmt'> & { bar?: boolean; fmt?: (n: number) => string }) => {
    spec.current.set(key, { bar: !!a.bar, fmt: a.fmt ?? fmtInt, from: a.from, to: a.to, at: a.at, dur: a.dur });
    let r = refs.current.get(key);
    if (!r) {
      r = (el) => {
        const s = spec.current.get(key);
        if (el && s) anims.current.set(key, { ...s, el });
        else anims.current.delete(key);
      };
      refs.current.set(key, r);
    }
    return r;
  };
  const apply = (t: number) => {
    for (const a of anims.current.values()) {
      const p = a.dur > 0 ? ease(Math.max(0, Math.min(1, (t - a.at) / a.dur))) : t >= a.at ? 1 : 0;
      const v = a.from + (a.to - a.from) * p;
      if (a.bar) a.el.style.transform = 'scaleX(' + v.toFixed(4) + ')';
      else a.el.textContent = a.fmt(v);
    }
  };
  return { reg, apply };
}

export interface MatchRecapProps {
  sport: UtSport;
  eyebrow: string;
  me: string;
  rival: string;
  us: number;
  them: number;
  ends: [string[], string[]];
  simulated: boolean;
  recap: Recap;
  /** the One-More bar: the action (next-action.ts after-mode) and the title it shows */
  next: { action: NextAction; title: string; line: string };
  /** paid game number today after this one, for the coins row */
  paidToday: { n: number; of: number };
  /** rewards waiting to claim right now (the Rewards inbox and Minutes rungs) */
  claimable: number;
  onClaimAll: () => void;
  onOneMore: () => void;
  onHome: () => void;
  onStore?: () => void;
  onPractice?: () => void;
}

export function MatchRecap(p: MatchRecapProps) {
  const { recap: r, sport } = p;
  const rm = useMemo(() => reducedMotion(), []);
  const [phase, setPhase] = useState<Phase>(rm ? 'done' : 'slam');
  const [box, setBox] = useState(false);
  const { reg, apply } = useCountUps();
  const raf = useRef(0);
  const t0 = useRef(0);
  const swallow = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const finishNow = () => {
    cancelAnimationFrame(raf.current);
    apply(Infinity);
    if (phaseRef.current !== 'done') setPhase('done');
  };

  // before the first paint: every count-up at its start (the DOM was rendered with final values)
  useBeforePaint(() => {
    if (rm) return;
    apply(0);
    t0.current = performance.now();
    let tick = 0;
    const counting = r.coins > 0 || !!r.career || r.cards.xp > 0 || !!r.sp || r.objectives.length > 0 || !!r.rivals || (r.minutes?.plus ?? 0) > 0;
    const loop = (now: number) => {
      const t = now - t0.current;
      apply(t);
      if (t >= RECAP_MS.slam && phaseRef.current === 'slam') setPhase('tally');
      // a rising tick while the tally counts (sound only: never a timer-driven vibration)
      if (counting && t >= RECAP_MS.slam && t < RECAP_MS.slam + RECAP_MS.tallyRun) {
        const n = Math.floor((t - RECAP_MS.slam) / 130);
        if (n >= tick) {
          sfx.count(Math.min(12, tick));
          tick = n + 1;
        }
      }
      if (t >= RECAP_MS.bar) {
        finishNow();
        if (r.cards.ups.length || r.career?.gain.levelUps.length) sfx.levelUp();
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  // a tap anywhere jumps to the end; that tap then presses nothing (the bar appears under the thumb)
  const onDown = () => {
    if (phaseRef.current === 'done') return;
    swallow.current = true;
    window.setTimeout(() => (swallow.current = false), 700);
    finishNow();
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallow.current) return;
    swallow.current = false;
    e.stopPropagation();
    e.preventDefault();
  };
  useEffect(() => {
    // keyboard: any key skips too
    const k = () => phaseRef.current !== 'done' && finishNow();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const T = RECAP_MS.slam,
    run = RECAP_MS.tallyRun;
  const v = r.verdict;
  const g = r.grade;
  const heat = g ? heatText(g) : null;
  const action = p.next.action;
  const calm = !!action.done;

  // ---- the tally rows ----
  const rows: React.ReactNode[] = [];
  rows.push(
    <li key="coins" className="mr-row" data-kind="coins">
      <i className="mr-ico mr-ico-coin" aria-hidden="true">
        <IconCoins size={18} />
      </i>
      <span className="mr-row-text">
        <b>Coins</b>
        <small>
          {r.capped
            ? 'Today’s ' + p.paidToday.of + ' paid games are played: games pay again tomorrow'
            : 'Paid game ' + Math.min(p.paidToday.n, p.paidToday.of) + ' of ' + p.paidToday.of + (r.cards.xp > 0 && !r.cards.ups.length ? ' · +' + r.cards.xp + ' card XP' : ' today')}
        </small>
      </span>
      <b className="mr-val num" ref={reg('coins', { from: 0, to: r.coins, at: T, dur: run, fmt: fmtPlus })}>
        {fmtPlus(r.coins)}
      </b>
    </li>,
  );
  if (r.career) {
    const { from, to, gain } = r.career;
    const up = gain.levelUps.length > 0;
    rows.push(
      <li key="career" className="mr-row" data-kind="career" data-pop={up ? '' : undefined}>
        <i className="mr-lv" aria-hidden="true">
          <b className="num">{to.level}</b>
          <small>LV</small>
        </i>
        <span className="mr-row-text">
          <b>{up ? 'LEVEL ' + to.level + ' · +' + gain.coins + ' coins' : 'Career XP'}</b>
          <span className="mr-bar" aria-hidden="true">
            <i ref={reg('career-bar', { bar: true, from: up ? 0 : frac(from.into, from.need), to: frac(to.into, to.need), at: T, dur: run })} style={{ transform: 'scaleX(' + frac(to.into, to.need) + ')' }} />
          </span>
        </span>
        <b className="mr-val num" ref={reg('career', { from: 0, to: gain.xp, at: T, dur: run, fmt: (n) => fmtPlus(n) + ' XP' })}>
          {fmtPlus(gain.xp)} XP
        </b>
      </li>,
    );
  }
  if (r.cards.ups.length > 0)
    rows.push(
      <li key="cards" className="mr-row" data-kind="cards" data-pop={r.cards.ups.length ? '' : undefined}>
        <i className="mr-ico" aria-hidden="true">
          <IconStar size={17} />
        </i>
        <span className="mr-row-text">
          <b>{r.cards.ups.length === 1 ? r.cards.ups[0].name + ' · LV ' + r.cards.ups[0].level : r.cards.ups.length + ' cards levelled up'}</b>
          <small>{r.cards.ups.length > 1 ? r.cards.ups.slice(0, 3).map((u) => u.name.split(' ').pop() + ' LV ' + u.level).join(' · ') : '+' + r.cards.xp + ' XP to every card in your squad'}</small>
        </span>
        <b className="mr-val num" ref={reg('cards', { from: 0, to: r.cards.xp, at: T, dur: run, fmt: (n) => fmtPlus(n) + ' XP' })}>
          {fmtPlus(r.cards.xp)} XP
        </b>
      </li>,
    );
  if (r.sp) {
    const s = r.sp,
      up = s.levelTo > s.levelFrom;
    const at = (x: number) => frac(x % SEASON_STEP, SEASON_STEP);
    rows.push(
      <li key="sp" className="mr-row" data-kind="sp" data-pop={up ? '' : undefined}>
        <i className="mr-ico mr-ico-sp" aria-hidden="true">
          <IconPass size={17} />
        </i>
        <span className="mr-row-text">
          <b>{up ? 'Season Pass level ' + s.levelTo : 'Season Pass'}</b>
          <span className="mr-bar" aria-hidden="true">
            <i ref={reg('sp-bar', { bar: true, from: up ? 0 : at(s.from), to: at(s.to), at: T, dur: run })} style={{ transform: 'scaleX(' + at(s.to) + ')' }} />
          </span>
          {s.next && <small>{SEASON_STEP - (s.to % SEASON_STEP)} SP to {s.next}</small>}
        </span>
        <b className="mr-val num" ref={reg('sp', { from: 0, to: s.gained, at: T, dur: run, fmt: (n) => fmtPlus(n) + ' SP' })}>
          {fmtPlus(s.gained)} SP
        </b>
      </li>,
    );
  }
  for (const o of r.objectives.slice(0, 2))
    rows.push(
      <li key={'o:' + o.id} className="mr-row" data-kind="objective" data-pop={o.done ? '' : undefined}>
        <i className={'mr-ico' + (o.done ? ' mr-ico-done' : '')} aria-hidden="true">
          {o.done ? <IconCheck size={16} /> : <span className="num">{o.to}</span>}
        </i>
        <span className="mr-row-text">
          <b>{o.title}</b>
          <span className="mr-bar" aria-hidden="true">
            <i ref={reg('o-bar:' + o.id, { bar: true, from: frac(o.from, o.target), to: frac(o.to, o.target), at: T, dur: run })} style={{ transform: 'scaleX(' + frac(o.to, o.target) + ')' }} />
          </span>
        </span>
        <b className="mr-val num">{o.done ? 'DONE' : o.target - o.to + ' to go'}</b>
      </li>,
    );
  if (r.rivals) {
    const x = r.rivals,
      d = DIVISIONS[x.divTo],
      nx = DIVISIONS[x.divTo + 1];
    const f = (pts: number) => (nx ? frac(pts - d.at, nx.at - d.at) : 1);
    rows.push(
      <li key="rivals" className="mr-row" data-kind="rivals" data-pop={x.promoted ? '' : undefined}>
        <i className="mr-ico mr-ico-rp" aria-hidden="true">
          <b>RP</b>
        </i>
        <span className="mr-row-text">
          <b>{x.promoted ? 'PROMOTED · ' + x.name : x.name + ' division'}</b>
          <span className="mr-bar" aria-hidden="true">
            <i ref={reg('rp-bar', { bar: true, from: x.promoted ? 0 : f(x.from), to: f(x.to), at: T, dur: run })} style={{ transform: 'scaleX(' + f(x.to) + ')' }} />
          </span>
        </span>
        <b className="mr-val num" ref={reg('rp', { from: 0, to: x.to - x.from, at: T, dur: run, fmt: (n) => (n >= 0 ? fmtPlus(n) : '−' + fmtInt(-n)) + ' RP' })}>
          {(x.to >= x.from ? fmtPlus(x.to - x.from) : '−' + fmtInt(x.from - x.to)) + ' RP'}
        </b>
      </li>,
    );
  }
  if (r.minutes && (r.minutes.plus > 0 || r.minutes.now > 0 || r.minutes.frozen)) {
    const m = r.minutes;
    rows.push(
      <li key="minutes" className="mr-row mr-row-min" data-kind="minutes">
        <i className="mr-ico mr-ico-min" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2M9 2h6" />
          </svg>
        </i>
        <span className="mr-row-text">
          <b>
            {m.frozen ? 'Minutes paused today' : (m.plus > 0 ? '+' + m.plus + ' min · ' : '') + m.now + ' today'}
          </b>
          {m.at !== null && (
            <span className="mr-bar" aria-hidden="true">
              <i ref={reg('min-bar', { bar: true, from: frac(m.now - m.plus, m.at), to: frac(m.now, m.at), at: T, dur: run })} style={{ transform: 'scaleX(' + frac(m.now, m.at) + ')' }} />
            </span>
          )}
          <small>{m.frozen ? 'The date changed: counting resumes tomorrow' : m.capped ? 'Done for today: 90 active minutes' : (m.next ?? 'Active Minutes')}</small>
        </span>
      </li>,
    );
  }

  const motm = r.box?.motm;
  return (
    <div className="mr" data-phase={phase} data-tone={v.tone} onPointerDownCapture={onDown} onClickCapture={onClickCapture}>
      <div className="mr-bg" aria-hidden="true">
        <i className="mr-beam a" />
        <i className="mr-beam b" />
        <i className="mr-crowd" />
      </div>
      <div className="mr-scroll">
        <span className="mr-eyebrow">{p.eyebrow}</span>
        <div className="mr-slam" role="status" aria-label={v.word + (v.tag ? ' ' + v.tag : '') + '. ' + p.me + ' ' + p.us + ', ' + p.rival + ' ' + p.them + (v.note ? '. ' + v.note : '')}>
          <h1 className="mr-word" aria-hidden="true">
            {v.word}
          </h1>
          {v.tag && (
            <span className="mr-tag" aria-hidden="true">
              {v.tag}
            </span>
          )}
          <div className="mr-score" aria-hidden="true">
            <span className="mr-name me">{p.me}</span>
            <b className="num" ref={reg('us', { from: 0, to: p.us, at: 80, dur: 600 })}>
              {p.us}
            </b>
            <i>–</i>
            <b className="num them" ref={reg('them', { from: 0, to: p.them, at: 80, dur: 600 })}>
              {p.them}
            </b>
            <span className="mr-name them">{p.rival}</span>
          </div>
          {(v.note || p.simulated) && (
            <p className="mr-note" aria-hidden="true">
              {p.simulated ? 'Simmed' + (v.note ? ' · ' : '') : ''}
              {v.note}
            </p>
          )}
        </div>
        {g && (
          <div className="mr-tiles">
            <span className="mr-grade" data-letter={g.letter} role="img" aria-label={'Grade ' + g.letter}>
              <b>{g.letter}</b>
              <small>GRADE</small>
            </span>
            <span className="mr-tile">
              <small>PERFECTS</small>
              <b className="num">
                {g.perfects}
                {g.chances ? <em>/{g.chances}</em> : null}
              </b>
            </span>
            {heat && (
              <span className="mr-tile mr-heat" data-fire={g.fires > 0 ? '' : undefined}>
                <small>BEST HEAT</small>
                <b>{heat}</b>
              </span>
            )}
            {g.flawless && <span className="mr-flawless">FLAWLESS</span>}
          </div>
        )}
        {motm && (
          <div className="mr-motm" data-side={motm.side}>
            <span className="mr-motm-rate num">{ratingText(motm.rating)}</span>
            <span className="mr-motm-text">
              <small>{motm.side === 'us' ? 'MAN OF THE MATCH' : 'MAN OF THE MATCH · ' + p.rival}</small>
              <b>{motm.name}</b>
              <em>{statLine(sport, motm) || (motm.pos ?? '')}</em>
            </span>
          </div>
        )}
        <ul className="mr-tally" aria-label="What this match earned">
          {rows}
        </ul>
        {r.milestones.length > 0 && (
          <div className="mr-miles">
            {r.milestones.map((m) => (
              <span key={m.id} className="mr-mile">
                <b>{m.title}</b>
                <small>{m.line}</small>
              </span>
            ))}
          </div>
        )}
        {(p.claimable > 0 || (p.onStore && r.milestones.some((m) => m.store))) && (
          <div className="mr-claims">
            {p.claimable > 0 && <ClaimButton pack label={'CLAIM ALL · ' + p.claimable} ariaLabel={'Claim all ' + p.claimable + ' rewards'} onClaim={p.onClaimAll} />}
            {p.onStore && r.milestones.some((m) => m.store) && (
              <button type="button" className="mr-link" onClick={p.onStore}>
                OPEN IN STORE
              </button>
            )}
          </div>
        )}
      </div>
      <div className="mr-dock">
        <div className="mr-onemore" data-calm={calm ? '' : undefined}>
          {phase === 'done' && (
            <GoldBar
              primary
              eyebrow={calm ? 'DONE FOR TODAY · ONE TAP AWAY' : 'NEXT UP · LOADED'}
              title={p.next.title}
              stake={p.next.line}
              onClick={p.onOneMore}
              art={
                <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
                </svg>
              }
            />
          )}
        </div>
        <div className="mr-sec">
          <button type="button" onClick={() => setBox(true)}>
            BOX SCORE
          </button>
          <button type="button" onClick={p.onHome}>
            HOME
          </button>
        </div>
      </div>
      {box && (
        <Sheet label="Box score" kind="bottom" onClose={() => setBox(false)}>
          {(close) => (
            <div className="mr-box">
              <div className="mr-box-head">
                <h2 className="disp">BOX SCORE</h2>
                <button type="button" className="mr-link" onClick={() => close()}>
                  CLOSE
                </button>
              </div>
              <div
                className="mr-ends"
                aria-label={
                  'Yours: ' +
                  p.ends[0].map((e) => endSpoken(sport, e)).join(', ') +
                  '; theirs: ' +
                  p.ends[1].map((e) => endSpoken(sport, e)).join(', ')
                }
              >
                {p.ends.map((ends, k) => (
                  <span key={k} className={k ? 'them' : 'us'}>
                    <small>{k ? p.rival : p.me}</small>
                    <span>
                      {ends.map((e, i) => (
                        <i key={i} className={endPoints(sport, e) ? 'pts' : undefined}>
                          {endLabel(sport, e)}
                        </i>
                      ))}
                    </span>
                  </span>
                ))}
              </div>
              {r.box && (
                <div className="mr-ratings">
                  <span className="eyebrow">PLAYER RATINGS</span>
                  {r.box.lines
                    .filter((l) => l.side === 'us')
                    .map((l) => (
                      <span key={l.id} className="mr-rating-row">
                        <b className="num">{ratingText(l.rating)}</b>
                        <span>{l.name}</span>
                        <small>{statLine(sport, l)}</small>
                      </span>
                    ))}
                </div>
              )}
              <MatchDebrief sport={sport} ends={p.ends[0]} simulated={p.simulated} onPractice={p.onPractice} />
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
