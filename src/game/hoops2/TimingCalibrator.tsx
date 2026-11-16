// The 4-tap timing calibration (plan §4.4, V2 B.0.1): "tap on the beat". A gold ring closes on its
// target four times, a tick on each beat; the player taps as it lands. perfect.ts `calibrate` turns
// the taps into the phone's release offset (what the screen and the finger add, and the player's own
// habit) and the player's spread, which is shown. SAVE writes `offsetMs` to the touch prefs (shared
// by every sport); the releases are then timed against it. Offered once before the first match on
// the phone (skippable) and from the pause sheet.
import React, { useEffect, useRef, useState } from 'react';
import { sfx } from '../../lib/sound';
import { calibrate } from '../perfect';
import { savePrefs } from '../hud/prefs';
import './calibrator.css';

/** A beat every this long (ms); two count-in beats, then the four to tap. */
export const BEAT_MS = 650;
export const LEAD = 2;
export const TAPS = 4;
/** The offset a saved calibration is held within (ms). */
export const OFFSET_RANGE = [-60, 150] as const;

/** Each tap against the beat nearest it (of the ones to tap), for perfect.ts `calibrate`. */
export function beatsFor(taps: number[], start: number): number[] {
  return taps.map((t) => {
    const k = Math.round((t - start) / BEAT_MS);
    return start + Math.max(LEAD, Math.min(LEAD + TAPS - 1, k)) * BEAT_MS;
  });
}

type Phase = 'intro' | 'run' | 'done';

export function TimingCalibrator({ reduced, onClose }: { reduced: boolean; onClose: (saved: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [count, setCount] = useState(0);
  const [res, setRes] = useState<{ offsetMs: number; sdMs: number; kept: number } | null>(null);
  const start = useRef(0);
  const taps = useRef<number[]>([]);
  const ringRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const beatRef = useRef<HTMLSpanElement>(null);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    setRes(calibrate(taps.current, beatsFor(taps.current, start.current)));
    setPhase('done');
  };
  const begin = () => {
    taps.current = [];
    finished.current = false;
    setCount(0);
    setRes(null);
    start.current = performance.now() + 500;
    setPhase('run');
  };

  // the beat: the ring closes on the target at every beat (with reduced motion the target lights up)
  useEffect(() => {
    if (phase !== 'run') return;
    let raf = 0;
    let lastBeat = -1;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const k = (now - start.current) / BEAT_MS;
      const beat = Math.floor(k);
      if (beat > lastBeat && beat >= 0) {
        lastBeat = beat;
        if (beat < LEAD + TAPS) sfx.tick();
        if (beatRef.current) beatRef.current.textContent = beat < LEAD ? String(LEAD - beat) : 'TAP';
      }
      // into the next beat: 1 just after a beat, 0 on it
      const u = k < 0 ? 1 : 1 - (k - beat);
      if (ringRef.current) ringRef.current.style.setProperty('--u', reduced ? '0' : u.toFixed(3));
      if (targetRef.current) targetRef.current.dataset.hit = k >= 0 && (k - beat < 0.12 || k - beat > 0.88) ? '1' : '';
      if (k > LEAD + TAPS + 0.6) finish();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced]);

  const tap = (e: React.PointerEvent) => {
    if (phase !== 'run' || finished.current) return;
    // taps before the count-in ends aren't measurements
    if (e.timeStamp < start.current + (LEAD - 0.5) * BEAT_MS) return;
    taps.current.push(e.timeStamp);
    setCount(taps.current.length);
    if (taps.current.length >= TAPS) finish();
  };
  const save = () => {
    if (!res || res.kept < 3) return;
    savePrefs({ offsetMs: Math.round(Math.max(OFFSET_RANGE[0], Math.min(OFFSET_RANGE[1], res.offsetMs))) });
    onClose(true);
  };
  const good = !!res && res.kept >= 3;

  return (
    <div className="ps-hud-sheet-back hg2-cal-back" data-sheet-noswipe onPointerDown={(e) => e.stopPropagation()}>
      <div className="ps-hud-sheet hg2-cal" role="dialog" aria-modal="true" aria-labelledby="hg2-cal-title">
        <span className="ps-hud-sheet-eyebrow">Timing</span>
        <h2 id="hg2-cal-title">TAP ON THE BEAT</h2>
        {phase === 'intro' && <p className="ps-hud-sheet-note">Four taps as the ring lands on the target. It tunes PERFECT releases to this phone and your thumb.</p>}
        <button type="button" className={'hg2-cal-pad' + (phase === 'run' ? ' live' : '')} onPointerDown={tap} disabled={phase !== 'run'} aria-label={'Tap on the beat: ' + count + ' of ' + TAPS}>
          <span className="hg2-cal-target" ref={targetRef} />
          <span className="hg2-cal-ring" ref={ringRef} />
          <span className="hg2-cal-beat" ref={beatRef}>
            {phase === 'done' ? (good ? 'DONE' : 'AGAIN') : phase === 'intro' ? 'READY' : ''}
          </span>
          <span className="hg2-cal-pips" aria-hidden="true">
            {Array.from({ length: TAPS }, (_, i) => (
              <i key={i} className={i < count ? 'on' : ''} />
            ))}
          </span>
        </button>
        {phase === 'done' && res && (
          <p className="hg2-cal-result" role="status">
            {good ? (
              <>
                <b className="num">{Math.abs(Math.round(res.offsetMs))} ms</b> {res.offsetMs >= 0 ? 'late' : 'early'} on average · spread <b className="num">±{Math.round(res.sdMs)} ms</b>
              </>
            ) : (
              'Too few taps landed near a beat. Try again.'
            )}
          </p>
        )}
        {phase === 'intro' && (
          <button type="button" className="ps-hud-sheet-btn primary" onClick={begin}>
            START
          </button>
        )}
        {phase === 'done' && good && (
          <button type="button" className="ps-hud-sheet-btn primary" onClick={save}>
            SAVE
          </button>
        )}
        {phase === 'done' && (
          <button type="button" className="ps-hud-sheet-btn" onClick={begin}>
            TRY AGAIN
          </button>
        )}
        <button type="button" className="ps-hud-sheet-btn hg2-cal-skip" onClick={() => onClose(false)}>
          {phase === 'done' && good ? 'CANCEL' : 'SKIP'}
        </button>
      </div>
    </div>
  );
}
