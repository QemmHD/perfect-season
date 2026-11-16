// The football pause menu (Claude, studio overhaul nfl-2; D-5 pause, contract C4). Resume, the
// controls (the V2 map for each moment, and the Burst-button preference), sound and haptics, and,
// offline, Quit through the host's onQuit with a confirm. Online, pausing stops only your own game:
// the rival keeps playing, so the menu says so. A native modal dialog keeps the game underneath
// inert and puts focus back where it was.
import React, { useLayoutEffect, useRef, useState } from 'react';
import './pause.css';

/** The control map shown under CONTROLS (V2 §B.2.2): what each thumb does, moment by moment. */
const MAP: { state: string; rows: [string, string][] }[] = [
  { state: 'Before the snap', rows: [['A', 'SNAP'], ['B', 'AUDIBLE: flip the play between run and pass'], ['C · D', 'FIELD GOAL · PUNT on fourth down']] },
  {
    state: 'In the pocket',
    rows: [
      ['Stick', 'move the quarterback: slide, step up, roll out. Over the line he runs'],
      ['Field', 'drag back anywhere on the right and let go to throw, or tap a name over a receiver'],
      ['A', 'RUN IT inside the tackles · THROW AWAY outside them'],
      ['C', 'TOUCH, BULLET or LOB (a second finger while you aim does the same)']
    ]
  },
  {
    state: 'With the ball',
    rows: [
      ['Stick', 'steer; push past the ring to burst (it costs stamina)'],
      ['A', 'JUKE toward the stick, or swipe off A to pick the side'],
      ['B · C', 'SPIN · POWER (a truck or a stiff arm)'],
      ['D', 'DIVE near the sticks or the goal line · SLIDE for a quarterback'],
      ['Hold', 'a thumb held still on the field covers the ball up']
    ]
  }
];

export function PauseMenu({
  online,
  burstButton,
  onBurstButton,
  feedback,
  onFeedback,
  quitText,
  onQuit,
  onResume
}: {
  online: boolean;
  burstButton: boolean;
  onBurstButton: (on: boolean) => void;
  /** sound and haptics as the profile has them; without it those switches aren't offered */
  feedback?: { sound: boolean; haptics: boolean };
  onFeedback?: (key: 'sound' | 'haptics', on: boolean) => void;
  quitText?: string;
  /** offline only; without it there is no Quit */
  onQuit?: () => void;
  onResume: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<'main' | 'controls' | 'quit'>('main');
  const invoker = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useLayoutEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal?.();
    return () => {
      if (d.open) d.close?.();
      if (invoker.current?.isConnected) invoker.current.focus({ preventScroll: true });
    };
  }, []);
  const toggle = (label: string, on: boolean, set: (on: boolean) => void, note?: string) => (
    <button type="button" role="switch" aria-checked={on} className={'fb2-pm-switch' + (on ? ' on' : '')} onClick={() => set(!on)}>
      <span>
        {label}
        {note && <small>{note}</small>}
      </span>
      <i aria-hidden="true" />
    </button>
  );
  return (
    <dialog
      ref={ref}
      className="fb2-pause-shade"
      aria-label="Paused"
      onCancel={(e) => {
        e.preventDefault();
        if (page === 'main') onResume();
        else setPage('main');
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <section className="fb2-pause-menu">
        <header>
          <small>{online ? 'ONLINE · YOUR RIVAL KEEPS PLAYING' : 'GAME PAUSED'}</small>
          <b>{page === 'controls' ? 'CONTROLS' : page === 'quit' ? 'LEAVE THE GAME?' : 'PAUSED'}</b>
        </header>
        {page === 'main' && (
          <>
            <button type="button" className="fb2-pm-resume" autoFocus onClick={onResume}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M5 3.2v11.6c0 .7.8 1.1 1.4.7l8.6-5.8c.5-.3.5-1.1 0-1.4L6.4 2.5C5.8 2.1 5 2.5 5 3.2z" fill="currentColor" />
              </svg>
              RESUME
            </button>
            <button type="button" className="fb2-pm-row" onClick={() => setPage('controls')}>
              <span>
                CONTROLS<small>The stick, A B C D, and the burst layout</small>
              </span>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M5 2.5 9.5 7 5 11.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {feedback && onFeedback && (
              <div className="fb2-pm-pair">
                {toggle('SOUND', feedback.sound, (on) => onFeedback('sound', on))}
                {toggle('HAPTICS', feedback.haptics, (on) => onFeedback('haptics', on))}
              </div>
            )}
            {onQuit && !online && (
              <button type="button" className="fb2-pm-row quit" onClick={() => setPage('quit')}>
                <span>
                  QUIT<small>Leave this game</small>
                </span>
              </button>
            )}
          </>
        )}
        {page === 'controls' && (
          <div className="fb2-pm-controls">
            {MAP.map((m) => (
              <div key={m.state} className="fb2-pm-map">
                <b>{m.state}</b>
                {m.rows.map(([k, v]) => (
                  <p key={k}>
                    <kbd>{k}</kbd>
                    <span>{v}</span>
                  </p>
                ))}
              </div>
            ))}
            {toggle('BURST BUTTON', burstButton, onBurstButton, burstButton ? 'Hold D to burst; the ring does nothing' : 'Off: push the stick past its ring to burst')}
            <button type="button" className="fb2-pm-back" onClick={() => setPage('main')}>
              BACK
            </button>
          </div>
        )}
        {page === 'quit' && onQuit && (
          <div className="fb2-pm-confirm">
            <p>{quitText ?? 'Leave the game? It counts as a loss.'}</p>
            <button type="button" className="fb2-pm-row quit" onClick={onQuit}>
              <span>LEAVE GAME</span>
            </button>
            <button type="button" className="fb2-pm-back" autoFocus onClick={() => setPage('main')}>
              KEEP PLAYING
            </button>
          </div>
        )}
      </section>
    </dialog>
  );
}
