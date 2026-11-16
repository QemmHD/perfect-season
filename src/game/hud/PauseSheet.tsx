// The pause sheet (V2 A.5, NBA-09): RESUME, the sport's own items, and QUIT. Offline, Quit asks once
// ("it counts as a loss") and then calls onQuit. Online the match can't stop, so the sheet says the
// game keeps going and offers Resume (and Forfeit, with its own confirm, once a sport wires it).
import React, { type ReactNode, useEffect, useRef, useState } from 'react';

export function PauseSheet({
  open,
  online,
  onResume,
  onQuit,
  onForfeit,
  children
}: {
  open: boolean;
  online: boolean;
  onResume: () => void;
  /** offline: confirm, then a loss */
  onQuit?: () => void;
  /** online: confirm, then a forfeit */
  onForfeit?: () => void;
  /** sport items: controls help, calibrate, Auto-defend, sound */
  children?: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  const resumeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) setConfirm(false);
    else resumeRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (confirm ? setConfirm(false) : onResume());
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, confirm]);
  if (!open) return null;
  const leave = online ? onForfeit : onQuit;
  return (
    <div className="ps-hud-sheet-back" data-sheet-noswipe onPointerDown={(e) => e.stopPropagation()}>
      <div className="ps-hud-sheet" role="dialog" aria-modal="true" aria-labelledby="ps-pause-title">
        {!confirm ? (
          <>
            <span className="ps-hud-sheet-eyebrow">{online ? 'Online match' : 'Match paused'}</span>
            <h2 id="ps-pause-title">{online ? 'THE GAME KEEPS GOING' : 'PAUSED'}</h2>
            {online && <p className="ps-hud-sheet-note">Online: the game keeps going. Your rival is still playing.</p>}
            <button ref={resumeRef} type="button" className="ps-hud-sheet-btn primary" onClick={onResume}>
              RESUME
            </button>
            {children && <div className="ps-hud-sheet-items">{children}</div>}
            {leave && (
              <button type="button" className="ps-hud-sheet-btn danger" onClick={() => setConfirm(true)}>
                {online ? 'FORFEIT' : 'QUIT GAME'}
              </button>
            )}
          </>
        ) : (
          <>
            <span className="ps-hud-sheet-eyebrow">{online ? 'Forfeit' : 'Quit'}</span>
            <h2 id="ps-pause-title">{online ? 'FORFEIT THIS MATCH?' : 'QUIT THIS GAME?'}</h2>
            <p className="ps-hud-sheet-note">It counts as a loss. Possessions you haven’t played score nothing.</p>
            <button type="button" className="ps-hud-sheet-btn danger solid" onClick={leave}>
              {online ? 'FORFEIT · TAKE THE LOSS' : 'QUIT · TAKE THE LOSS'}
            </button>
            <button type="button" className="ps-hud-sheet-btn" onClick={() => setConfirm(false)}>
              KEEP PLAYING
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** A two-way switch row for the sheet (e.g. Controls: Gestures / Buttons). */
export function SheetToggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="ps-hud-toggle" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
