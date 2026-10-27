// Sim or play: before a head to head both players vote, with a countdown, each seeing the other's
// vote live and free to change his own until it runs out. The same vote decides it; otherwise a
// coin toss read off the match does (src/net/vote.ts has the rule and how two phones agree on it).
// Against the AI there's nothing to settle: it goes with your pick (no pick: play).
import React, { useEffect, useRef, useState } from 'react';
import { NFL } from '../engine/sport';
import { sfx, vibrate } from '../lib/sound';
import { type Ballot, byToss, type Choice, RESEND_MS, VOTE_MS, VoteMachine, type VoteWire } from '../net/vote';
import { initials } from './common';
import { reducedMotion } from './motion';
import './vote.css';

/** the coin in the air */
const TOSS_MS = 1800;
/** the result on screen before the game starts */
const SHOW_MS = 1500;

const label = (c: Choice) => (c === 'play' ? 'PLAY' : 'SIM');

function PadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M11 13h18a8 8 0 0 1 7.7 10.1l-1.6 6.2a4.2 4.2 0 0 1-7.3 1.5L24 26h-8l-3.8 4.8a4.2 4.2 0 0 1-7.3-1.5l-1.6-6.2A8 8 0 0 1 11 13Z" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M12 18v6M9 21h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="27" cy="19" r="1.9" fill="currentColor" />
      <circle cx="30.5" cy="23" r="1.9" fill="currentColor" />
    </svg>
  );
}

function CastIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="4" y="9" width="32" height="22" rx="4" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="2.2" />
      <path d="M9 25l6-6 5 4 9-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 35h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Vote({
  rivalName,
  online,
  seed,
  rival,
  rivalGone,
  waitFor = 'to finish the draft',
  simText = 'Watch the game: win odds, play by play',
  onWire,
  onDone,
}: {
  rivalName: string;
  online: boolean;
  /** the match's id online, the game's seed against the AI: the coin comes from it */
  seed: string;
  /** online: the other phone's vote, as last heard */
  rival: VoteWire | null;
  /** online: the other phone has gone quiet (or left) */
  rivalGone: boolean;
  /** online: what the rival is still doing before they reach the vote ("Waiting for Sam to finish the draft…") */
  waitFor?: string;
  /** what SIM means here */
  simText?: string;
  /** online: put this phone's vote on the wire */
  onWire?: (w: VoteWire) => void;
  onDone: (outcome: Choice) => void;
}) {
  const mRef = useRef<VoteMachine | null>(null);
  mRef.current ??= new VoteMachine(seed, Date.now());
  const m = mRef.current;
  const [, render] = useState(0);
  const [phase, setPhase] = useState<'vote' | 'toss' | 'result'>('vote');
  const sent = useRef({ key: '', at: 0 });
  const lastLeft = useRef<number | null>(null);
  const goneRef = useRef(rivalGone);
  goneRef.current = rivalGone;
  const wireRef = useRef(onWire);
  wireRef.current = onWire;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  /** The AI as the other phone: here from the start, it takes whatever you pick, locks with you and
   * echoes your vote, so your pick decides (never the coin). */
  const aiWire = (): VoteWire => {
    const v: Ballot = m.mine;
    return m.lockedAt !== null ? { vote: v, at: m.lockedAt, saw: m.mine } : { vote: v, at: null, saw: null };
  };

  const step = () => {
    const now = Date.now();
    if (!online) m.receive(aiWire(), now);
    m.tick(now, goneRef.current);
    if (online && wireRef.current) {
      const w = m.wire();
      const key = JSON.stringify(w);
      // every change at once, and again every second while this screen is up: a lost message costs a second
      if (key !== sent.current.key || now - sent.current.at >= RESEND_MS) {
        sent.current = { key, at: now };
        wireRef.current(w);
      }
    }
    const left = m.left(now);
    if (left !== lastLeft.current) {
      if (left !== null && left > 0 && left <= 3 && phase === 'vote') sfx.tick();
      lastLeft.current = left;
    }
    render((n) => n + 1);
  };

  // the other phone's vote, as it comes in
  const rivalKey = rival ? JSON.stringify(rival) : '';
  useEffect(() => {
    if (!online || !rival) return;
    m.receive(rival, Date.now());
    step();
  }, [rivalKey]);

  useEffect(() => {
    step();
    const t = window.setInterval(step, 100);
    return () => clearInterval(t);
  }, []);

  // decided: the coin when it's the coin's call, then the game
  const d = m.decision;
  useEffect(() => {
    if (!d) return;
    const timers: number[] = [];
    const finish = () => timers.push(window.setTimeout(() => doneRef.current(d.outcome), SHOW_MS));
    if (byToss(d)) {
      setPhase('toss');
      sfx.whoosh();
      timers.push(
        window.setTimeout(
          () => {
            setPhase('result');
            sfx.coin();
            vibrate(20);
            finish();
          },
          reducedMotion() ? 300 : TOSS_MS
        )
      );
    } else {
      setPhase('result');
      sfx.seriesWin();
      finish();
    }
    return () => timers.forEach(clearTimeout);
  }, [!!d]);

  const pick = (c: Choice) => {
    if (m.mine === c) return;
    if (!m.choose(c)) return;
    sfx.select();
    vibrate(10);
    step();
  };

  const now = Date.now();
  const left = m.left(now);
  const locked = m.lockedAt !== null;
  const r = online ? m.rival : aiWire();
  const rv = r?.vote ?? null;
  const rLocked = r?.at != null;
  const frac = m.deadline === null ? 1 : locked ? 0 : Math.max(0, Math.min(1, (m.deadline - now) / VOTE_MS));
  const status =
    rv === null
      ? rivalGone
        ? rivalName + ' isn’t answering'
        : 'Waiting for ' + rivalName + ' ' + waitFor + '…'
      : rv === 'none'
        ? rLocked
          ? rivalName + ' didn’t vote'
          : online
            ? rivalName + ' hasn’t voted yet'
            : rivalName + ' is thinking…'
        : rivalName + (rLocked ? ' is locked in: ' : ' wants to ') + label(rv);
  const why = !d
    ? ''
    : d.how === 'lost'
      ? 'Couldn’t hear ' + rivalName + '’s vote, so the coin decides.'
      : m.mine === 'none' && m.theirFinal === 'none'
        ? ''
        : m.mine === 'none'
          ? 'You didn’t vote, ' + rivalName + ' said ' + label(m.theirFinal as Choice) + '.'
          : m.theirFinal === 'none'
            ? 'You said ' + label(m.mine) + ', ' + rivalName + ' didn’t vote.'
            : 'You said ' + label(m.mine as Choice) + ', ' + rivalName + ' said ' + label(m.theirFinal as Choice) + '.';
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className={'screen vote' + (phase !== 'vote' ? ' decided' : '')}>
      <div className="vote-head">
        <span className="eyebrow wide">Head to head · {NFL ? 'kickoff' : 'tip-off'}</span>
        <h1 className="disp">SIM OR PLAY?</h1>
        <p>
          You and {rivalName} vote. The same vote decides it; a split goes to a coin toss.
        </p>
      </div>
      <div className={'vote-clock' + (left !== null && left <= 3 && !locked ? ' low' : '') + (left === null ? ' waiting' : '')} role="timer" aria-label={left === null ? 'Waiting for ' + rivalName : locked ? 'Votes are in' : left + ' seconds to vote'}>
        <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
          <circle cx="52" cy="52" r={R} className="track" />
          <circle cx="52" cy="52" r={R} className="fill" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        <b className="disp num">{left === null ? '…' : left}</b>
        <small>{left === null ? 'WAITING' : locked ? 'VOTES IN' : 'SECONDS'}</small>
      </div>
      <div className="vote-opts" role="group" aria-label="Your vote">
        {(['play', 'sim'] as Choice[]).map((c) => (
          <button key={c} className={'vote-opt ' + c + (m.mine === c ? ' on' : '') + (rv === c ? ' theirs' : '')} aria-pressed={m.mine === c} aria-disabled={locked} onClick={() => pick(c)}>
            <span className="vote-ico">{c === 'play' ? <PadIcon /> : <CastIcon />}</span>
            <b className="disp">{label(c)}</b>
            <small>{c === 'play' ? 'Run your offense ' + (NFL ? 'down the field' : 'on the court') + ', live' : simText}</small>
            <span className="vote-who" aria-hidden="true">
              {m.mine === c && <i className="you">YOU</i>}
              {rv === c && <i className="them">{online ? initials(rivalName) || '?' : 'AI'}</i>}
            </span>
          </button>
        ))}
      </div>
      <p className={'vote-rival' + (rv === 'play' || rv === 'sim' ? ' voted' : '')} role="status" key={status}>
        {status}
      </p>
      <p className="vote-rule">{locked && !d ? 'Votes are in. Hearing from ' + rivalName + '…' : 'Nobody votes: PLAY. You can change your vote until the clock runs out.'}</p>
      {d && byToss(d) && (
        <div className={'vote-toss' + (phase === 'result' ? ' landed' : '')} role="status">
          <div className="coin-wrap">
            <div className={'coin ' + d.toss + (reducedMotion() ? ' still' : '')}>
              <span className="face heads">
                <small>HEADS</small>
                <b className="disp">PLAY</b>
              </span>
              <span className="face tails">
                <small>TAILS</small>
                <b className="disp">SIM</b>
              </span>
            </div>
          </div>
          <h2 className="disp">{phase === 'result' ? (d.toss === 'play' ? 'HEADS: PLAY' : 'TAILS: SIM') : 'COIN TOSS'}</h2>
          <p>{why}</p>
        </div>
      )}
      {d && !byToss(d) && phase === 'result' && (
        <div className="vote-toss agreed" role="status">
          <h2 className="disp">{d.how === 'none' ? 'NO VOTES: PLAY' : (online ? 'YOU BOTH SAID ' : 'YOU PICKED ') + label(d.outcome)}</h2>
          <p>{d.outcome === 'play' ? (NFL ? 'Grab the ball: you’re on offense.' : 'Take the floor: you’re on offense.') : 'To the broadcast booth.'}</p>
        </div>
      )}
    </div>
  );
}
