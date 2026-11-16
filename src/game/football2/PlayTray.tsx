// The play-call tray (Claude, studio overhaul nfl-3; audit P-1, Game Design V2 §B.2.2): at most
// 124 px tall, docked above the A/B cluster, so the formation, the backfield and the line of
// scrimmage stay in view above it at every phone size. Three suggested cards; swipe the strip on
// into the rest of the book (FLIP and the full PLAYBOOK sit at the seam). On fourth down the first
// three are [the best play] [FIELD GOAL] [PUNT], and A says what the picked one does. Its header is
// one line: the down and distance, then whatever the toast line has to say before the snap, or the
// LAST PLAY (tap it for the breakdown). Dragging the field to look around collapses it to a 44 px
// bar; a tap brings it back. SNAP and AUDIBLE stay on A and B.
import React, { useEffect, useRef, useState } from 'react';
import type { PlayFeedback } from '../play-feedback';
import { CONCEPT_NAMES, RUN_NAMES } from './engine';
import type { ToastView } from './shared-v2';
import type { Concept, Play, RunPlay } from './types';
import './play-tray.css';

export interface CallCard {
  call: 'pass' | 'run';
  concept: Concept;
  run: RunPlay;
}

export interface TrayEntry {
  choice: CallCard;
  play: Play;
}

/** Fourth down: the picked choice ('go' runs the picked play) and what the kick can do. */
export interface Fourth {
  pick: 'go' | 'fg' | 'punt';
  fg: { ok: boolean; yards: number };
  /** punting is on the table (not when the clock has run out) */
  punt: boolean;
  /** only the kick is left (time's up, or the kicking drill) */
  kickOnly: boolean;
}

/** How deep each concept attacks, for the card's second line. */
const DEPTH: Record<Concept, string> = { verts: 'DEEP', posts: 'DEEP', dagger: 'MID', flood: 'MID', smash: 'MID', curls: 'SHORT', slants: 'QUICK', mesh: 'QUICK' };

export const keyOf = (c: CallCard) => (c.call === 'pass' ? 'p:' + c.concept : 'r:' + c.run);
export const nameOf = (c: CallCard) => (c.call === 'pass' ? CONCEPT_NAMES[c.concept] : RUN_NAMES[c.run]);
export const kindOf = (c: CallCard) => (c.call === 'pass' ? DEPTH[c.concept] + ' PASS' : c.run.toUpperCase() + ' RUN');

export function PlayTray({
  suggested,
  book,
  picked,
  fourth,
  down,
  notice,
  last,
  flipped,
  collapsed,
  onPick,
  onBook,
  onFourth,
  onFlip,
  onPlaybook,
  onExpand,
  onInput
}: {
  suggested: TrayEntry[];
  /** the rest of the book, after the seam */
  book: TrayEntry[];
  /** the lined-up play's key */
  picked: string | null;
  fourth: Fourth | null;
  /** '3RD & 4 · OWN 32' */
  down: string;
  /** what the toast line would say right now (docked here while the tray is up) */
  notice: ToastView | null;
  last: PlayFeedback | null;
  flipped: boolean;
  collapsed: boolean;
  onPick: (i: number) => void;
  onBook: (c: CallCard) => void;
  onFourth: (pick: 'go' | 'fg' | 'punt') => void;
  onFlip: () => void;
  onPlaybook: () => void;
  onExpand: () => void;
  /** any touch on the tray (the playtime meter counts it) */
  onInput: () => void;
}) {
  const [open, setOpen] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  // a new down: the strip back at its start, the breakdown closed
  useEffect(() => {
    setOpen(false);
    if (strip.current) strip.current.scrollLeft = 0;
  }, [down]);
  const stop = (e: React.PointerEvent) => {
    e.stopPropagation();
    onInput();
  };
  if (collapsed)
    return (
      <div className="fb2-tray collapsed" data-sheet-noswipe onPointerDown={stop}>
        <button type="button" className="fb2-tray-bar" onClick={onExpand} aria-label={'Show the plays: ' + down}>
          <b>{down}</b>
          <span>PLAYS</span>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    );
  const four = fourth;
  const card = (o: TrayEntry, on: boolean, act: () => void, extra = '') => (
    <button type="button" key={keyOf(o.choice) + extra} className={'fb2-card ' + o.choice.call + (on ? ' on' : '')} data-call={o.choice.call} role="radio" aria-checked={on} onClick={act} aria-label={nameOf(o.choice) + ', ' + kindOf(o.choice).toLowerCase()}>
      <PlayArt play={o.play} />
      <small>{kindOf(o.choice)}</small>
      <b>{nameOf(o.choice)}</b>
    </button>
  );
  const goPlay = four ? suggested[Math.max(0, suggested.findIndex((o) => keyOf(o.choice) === picked))] ?? suggested[0] : null;
  return (
    <div className={'fb2-tray' + (four ? ' fourth' : '')} data-sheet-noswipe onPointerDown={stop}>
      <header className="fb2-tray-head">
        <b className="fb2-tray-down">{down}</b>
        {notice ? (
          <span className={'fb2-tray-note ' + notice.tone} role="status">
            {notice.text}
            {notice.sub ? <i> · {notice.sub}</i> : null}
          </span>
        ) : last ? (
          <button type="button" className="fb2-tray-last" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <small>LAST PLAY</small>
            <span>{last.result}</span>
          </button>
        ) : null}
      </header>
      {open && last && !notice && (
        <section className="fb2-tray-breakdown" aria-label="Last play breakdown">
          <b>{last.result}</b>
          <dl>
            {last.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p>{last.next}</p>
        </section>
      )}
      <div className="fb2-tray-strip" ref={strip} role="radiogroup" aria-label={four ? 'Fourth down: go for it, kick or punt' : 'Pick a play (swipe for the playbook)'}>
        {four ? (
          <>
            {!four.kickOnly && goPlay && card(goPlay, four.pick === 'go', () => onFourth('go'), ':go')}
            <button type="button" className={'fb2-card special fg' + (four.pick === 'fg' ? ' on' : '')} role="radio" aria-checked={four.pick === 'fg'} disabled={!four.fg.ok} onClick={() => onFourth('fg')} aria-label={four.fg.ok ? 'Field goal from ' + four.fg.yards + ' yards' : 'Field goal: out of range'}>
              <svg className="fb2-art" viewBox="0 0 100 64" aria-hidden="true">
                <path d="M34 50V22M66 50V22M34 34h32M50 34v24" fill="none" stroke="#f6c531" strokeWidth="4" strokeLinecap="round" />
                <path d="M50 58c6-10 10-18 10-28" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" strokeDasharray="2 4" />
              </svg>
              <small>{four.fg.ok ? four.fg.yards + ' YARDS' : 'OUT OF RANGE'}</small>
              <b>Field Goal</b>
            </button>
            {four.punt && !four.kickOnly && (
              <button type="button" className={'fb2-card special punt' + (four.pick === 'punt' ? ' on' : '')} role="radio" aria-checked={four.pick === 'punt'} onClick={() => onFourth('punt')} aria-label="Punt: give them the ball deep">
                <svg className="fb2-art" viewBox="0 0 100 64" aria-hidden="true">
                  <path d="M18 54C34 8 66 8 82 54" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="3" strokeDasharray="3 5" strokeLinecap="round" />
                  <ellipse cx="50" cy="20" rx="7" ry="4.5" fill="#8b4a1f" stroke="#2e1606" strokeWidth="1.5" />
                </svg>
                <small>FLIP FIELD</small>
                <b>Punt</b>
              </button>
            )}
          </>
        ) : (
          suggested.map((o, i) => card(o, keyOf(o.choice) === picked, () => onPick(i)))
        )}
        {!four?.kickOnly && (
          <>
            <span className="fb2-tray-seam" aria-hidden="true" />
            <button type="button" className="fb2-card tool" onClick={onFlip} aria-pressed={flipped} aria-label={'FLIP PLAY: the formation is now ' + (flipped ? 'LEFT' : 'RIGHT')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8h13l-3-3M20 16H7l3 3" />
              </svg>
              <b>FLIP</b>
              <small>{flipped ? 'LEFT' : 'RIGHT'}</small>
            </button>
            <button type="button" className="fb2-card tool" data-book onClick={onPlaybook} aria-label="FULL PLAYBOOK: every play">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 5h6a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4zM20 5h-6a3 3 0 0 0-3 3v11a2 2 0 0 1 2-2h7z" />
              </svg>
              <b>BOOK</b>
              <small>ALL PLAYS</small>
            </button>
            {book.map((o) => card(o, keyOf(o.choice) === picked, () => onBook(o.choice), ':book'))}
          </>
        )}
      </div>
    </div>
  );
}

const ART_COLOR: Record<string, string> = { X: '#ffd23a', SL: '#ff7aa8', Z: '#5cb8ff', TE: '#7cf08c', RB: '#c7a2ff' };

/** A play card's drawing: the line, the backs, and each route (or the run's path) in its colour. */
export function PlayArt({ play }: { play: Play }) {
  const { bx, los } = play;
  const X = (x: number) => 50 + (x - bx) * 2.3;
  const Y = (y: number) => 52 - (y - los) * 1.55;
  const paths: { color: string; pts: [number, number][] }[] = [];
  if (play.call === 'pass') {
    for (const b of play.bodies) {
      if (b.side !== 'O' || !b.route.length || !ART_COLOR[b.slot]) continue;
      paths.push({ color: ART_COLOR[b.slot], pts: [[X(b.x), Y(b.y)], ...b.route.map((w) => [X(w.x), Y(w.y)] as [number, number])] });
    }
  } else {
    // the back's path: up the middle, bounced outside, or off tackle behind a pulling guard
    const rb = play.rb;
    const direction = play.direction ?? 1;
    const pts: [number, number][] =
      play.run === 'outside'
        ? [
            [X(rb.x), Y(rb.y)],
            [X(play.hole - 0.8 * direction), Y(los - 0.1)],
            [X(play.hole), Y(los + 7)]
          ]
        : play.run === 'power'
          ? [
              [X(rb.x), Y(rb.y)],
              [X(play.hole - 0.9 * direction), Y(los - 1)],
              [X(play.hole), Y(los + 7)]
            ]
          : [
              [X(rb.x), Y(rb.y)],
              [X(play.hole), Y(los)],
              [X(play.hole), Y(los + 8)]
            ];
    paths.push({ color: ART_COLOR.RB, pts });
  }
  const end = (pts: [number, number][]) => {
    const [ax, ay] = pts[pts.length - 2];
    const [ex, ey] = pts[pts.length - 1];
    const a = Math.atan2(ey - ay, ex - ax);
    return [ex + Math.cos(a) * 3, ey + Math.sin(a) * 3, ex + Math.cos(a + 2.4) * 3, ey + Math.sin(a + 2.4) * 3, ex + Math.cos(a - 2.4) * 3, ey + Math.sin(a - 2.4) * 3].join(',');
  };
  return (
    <svg className="fb2-art" viewBox="0 0 100 64" aria-hidden="true">
      <line x1="0" y1={Y(los)} x2="100" y2={Y(los)} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      {play.bodies
        .filter((b) => b.side === 'O')
        .map((b) =>
          b.slot === 'LT' || b.slot === 'LG' || b.slot === 'C' || b.slot === 'RG' || b.slot === 'RT' ? (
            <rect key={b.id} x={X(b.x) - 1.6} y={Y(b.y) - 1.6} width="3.2" height="3.2" fill="#d8dee8" />
          ) : (
            <circle key={b.id} cx={X(b.x)} cy={Y(b.y)} r="1.9" fill={ART_COLOR[b.slot] ?? '#ffffff'} />
          )
        )}
      {paths.map((pa, i) => (
        <g key={i}>
          <polyline points={pa.pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={pa.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          <polygon points={end(pa.pts)} fill={pa.color} />
        </g>
      ))}
    </svg>
  );
}
