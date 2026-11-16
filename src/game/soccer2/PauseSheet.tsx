// The pause sheet (Claude 2026-11-16, studio overhaul soccer-2; audit C-5, V2 A.5): RESUME, HOW TO
// PLAY, CONTROLS and the playtime line, then QUIT (solo: ut contract B, the host decides what a quit
// means) or FORFEIT (online: your rival wins at once). Each way out asks once more. Glass panel, no
// backdrop blur (V2 C.3's in-match cost rule), no slide under reduced motion.
import React, { useEffect, useRef, useState } from 'react';

type View = 'main' | 'how' | 'controls' | 'quit' | 'forfeit';

export function PauseSheet({ online, rivalName, quitNote = 'It counts as a loss.', todayLine, onResume, onQuit, onForfeit }: { online: boolean; rivalName: string; quitNote?: string; todayLine?: string; onResume: () => void; onQuit?: () => void; onForfeit?: () => void }) {
  const [view, setView] = useState<View>('main');
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [view]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (view === 'main') onResume();
      else setView('main');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [view]);
  const back = (
    <button type="button" className="sc2-sheet-btn" onClick={() => setView('main')}>
      BACK
    </button>
  );
  return (
    <div className="sc2-sheet-back" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sc2-sheet" role="dialog" aria-modal="true" aria-labelledby="sc2-sheet-title">
        {view === 'main' && (
          <>
            <span className="sc2-sheet-eyebrow">{online ? 'Online · ' + rivalName : 'Paused'}</span>
            <h2 id="sc2-sheet-title">PAUSED</h2>
            {online && <p className="sc2-sheet-note">Your attacks wait for you. {rivalName} plays on.</p>}
            <button type="button" ref={first} className="sc2-sheet-btn primary" onClick={onResume}>
              RESUME
            </button>
            <button type="button" className="sc2-sheet-btn" onClick={() => setView('how')}>
              HOW TO PLAY
            </button>
            <button type="button" className="sc2-sheet-btn" onClick={() => setView('controls')}>
              CONTROLS
            </button>
            {todayLine && <p className="sc2-sheet-line num">{todayLine}</p>}
            {online && onForfeit && (
              <button type="button" className="sc2-sheet-btn danger" onClick={() => setView('forfeit')}>
                FORFEIT
              </button>
            )}
            {!online && onQuit && (
              <button type="button" className="sc2-sheet-btn danger" onClick={() => setView('quit')}>
                QUIT MATCH
              </button>
            )}
          </>
        )}
        {view === 'how' && (
          <>
            <span className="sc2-sheet-eyebrow">How to play</span>
            <h2 id="sc2-sheet-title">ONE-TOUCH FLOW</h2>
            <ul className="sc2-sheet-list">
              <li>
                <b>Attacks.</b> Seven each: six and one in stoppage time. Most goals wins; level goes to penalties.
              </li>
              <li>
                <b>Each attack</b> has its own clock along the bottom of the score bug. Score before it runs out.
              </li>
              <li>
                <b>Shoot.</b> Hold SHOOT, drag your thumb on it to aim, let go as the meter hits the green. No drag: it picks the open side.
              </li>
              <li>
                <b>Pass.</b> PASS goes where the stick points; hold it to lob or cross. THRU plays a runner in; hold it to loft it over the line.
              </li>
              <li>
                <b>Set pieces.</b> Swipe on the pitch to bend a free kick, or tap BEND. Leave one and it is taken for you after 12 s.
              </li>
            </ul>
            {back}
          </>
        )}
        {view === 'controls' && (
          <>
            <span className="sc2-sheet-eyebrow">Controls</span>
            <h2 id="sc2-sheet-title">TWO THUMBS</h2>
            <dl className="sc2-sheet-map">
              <dt>Left thumb</dt>
              <dd>Down anywhere low on the left: run. Push past the ring: sprint.</dd>
              <dt className="gold">A · SHOOT</dt>
              <dd>Hold, drag to aim, let go in the green.</dd>
              <dt className="teal">B · PASS</dt>
              <dd>Tap: along the grass. Hold: lob or cross.</dd>
              <dt>C · THRU</dt>
              <dd>Tap: into a runner's path. Hold: lofted over the line.</dd>
              <dt>Tap a teammate</dt>
              <dd>Pass straight to him.</dd>
              <dt>Free kick</dt>
              <dd>B crosses, C plays it short, D or a swipe bends it.</dd>
              <dt>Keyboard</dt>
              <dd>Arrows run, Shift sprints, Space shoots, J passes, K plays it through, Esc pauses.</dd>
            </dl>
            {back}
          </>
        )}
        {view === 'quit' && (
          <>
            <span className="sc2-sheet-eyebrow">Leave the match</span>
            <h2 id="sc2-sheet-title">QUIT?</h2>
            <p className="sc2-sheet-note">{quitNote}</p>
            <button type="button" ref={first} className="sc2-sheet-btn primary" onClick={() => setView('main')}>
              KEEP PLAYING
            </button>
            <button type="button" className="sc2-sheet-btn danger solid" onClick={onQuit}>
              QUIT
            </button>
          </>
        )}
        {view === 'forfeit' && (
          <>
            <span className="sc2-sheet-eyebrow">Online · {rivalName}</span>
            <h2 id="sc2-sheet-title">FORFEIT?</h2>
            <p className="sc2-sheet-note">Your rival wins, and the match ends on both phones now.</p>
            <button type="button" ref={first} className="sc2-sheet-btn primary" onClick={() => setView('main')}>
              KEEP PLAYING
            </button>
            <button type="button" className="sc2-sheet-btn danger solid" onClick={onForfeit}>
              FORFEIT
            </button>
          </>
        )}
      </div>
    </div>
  );
}
