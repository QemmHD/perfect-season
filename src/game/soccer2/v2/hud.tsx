// merge: replace with nba's src/game/Stick.tsx and src/game/hud/* (ScoreBug, ToastLine, PauseButton),
// then delete this file and its CSS block in ../soccer2-controls.css ("v2 stand-ins").
//
// Soccer's stand-ins for the V2 shared HUD kit (Claude 2026-11-16, studio overhaul soccer-2; plan
// §5.0.2): the floating stick, the score bug with its progress line and the Heat bar's slot, the toast
// line and the pause button. Same props as nba's pieces where nba has published them, so the swap at
// merge touches only ./index.ts.
import React, { useEffect, useRef } from 'react';
import { classify } from '../controls';
import { haptic } from './haptics';
import type { HeatState, PauseButtonProps, ToastProps } from './index';
import { STICK_IDLE, type StickGeom, stickDown, stickGeom, stickIdle, stickMove, type StickOut, stickOut, type StickState, stickUp, sprintEdge } from './stick';

/* ---------- the floating stick ---------- */

/** The stick's geometry from the page: the zone element and its ghost ring (sized by the tokens). */
function geomFrom(zone: HTMLElement): StickGeom {
  const z = zone.getBoundingClientRect();
  const gEl = zone.querySelector('[data-stick-ghost]');
  const g = gEl ? gEl.getBoundingClientRect() : { left: z.left + 24, top: z.bottom - 148, width: 120, height: 120 };
  const r = g.width / 2;
  return stickGeom({ x: z.left, y: z.top, w: z.width, h: z.height }, { x: g.left + r, y: g.top + g.height / 2 }, r);
}

/**
 * The left thumb's stick. A touch anywhere in the lower-left zone spawns the ring under it; past the
 * ring is sprint (a tick as it turns on). A thumb already resting there while `disabled` (before the
 * whistle) is tracked, and its push applies the moment the stick enables. A quick tap that never moved
 * the stick, and any second finger in the zone, are handed to `onTap` (tap a teammate to pass).
 * Output is computed inside the pointer handler (no frame of latency); the ring is drawn on the next
 * animation frame, straight to the DOM (no React render per move).
 */
export function Stick({ disabled = false, onChange, onTap }: { disabled?: boolean; onChange: (o: StickOut) => void; onTap?: (x: number, y: number) => void }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLElement>(null);
  const live = useRef({ geom: null as StickGeom | null, state: null as StickState | null, out: STICK_IDLE, raf: 0, down: null as { x: number; y: number; t: number } | null });
  const props = useRef({ disabled, onChange, onTap });
  props.current = { disabled, onChange, onTap };

  // the whistle: a thumb that was already down drives the player on this very frame
  useEffect(() => {
    const l = live.current;
    if (!disabled && l.state && l.state.id !== null && l.geom) {
      l.out = stickOut(l.state, l.geom, l.out);
      onChange(l.out);
    }
  }, [disabled]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const l = live.current;
    const others = new Map<number, { x: number; y: number; t: number }>();
    const draw = () => {
      l.raf = 0;
      const ring = ringRef.current;
      const knob = knobRef.current;
      if (!ring || !knob) return;
      const s = l.state;
      const g = l.geom;
      if (!s || s.id === null || !g) {
        ring.style.opacity = '0';
        zone.classList.remove('held', 'sprint');
        return;
      }
      const z = zone.getBoundingClientRect();
      ring.style.opacity = '1';
      ring.style.width = ring.style.height = g.ringR * 2 + 'px';
      ring.style.transform = `translate(${s.origin.x - z.left - g.ringR}px, ${s.origin.y - z.top - g.ringR}px)`;
      const dx = s.pos.x - s.origin.x;
      const dy = s.pos.y - s.origin.y;
      const d = Math.hypot(dx, dy);
      const max = g.sprintAt || g.ringR;
      const k = d > max ? max / d : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      zone.classList.add('held');
      zone.classList.toggle('sprint', l.out.sprint);
    };
    const paint = () => {
      if (!l.raf) l.raf = requestAnimationFrame(draw);
    };
    const report = () => {
      if (!l.state || !l.geom) return;
      const next = stickOut(l.state, l.geom, l.out);
      const prev = l.out;
      l.out = next;
      paint();
      const p = props.current;
      if (p.disabled) return;
      if (sprintEdge(prev, next)) haptic('tick');
      if (next.x !== prev.x || next.y !== prev.y || next.sprint !== prev.sprint || next.active !== prev.active) p.onChange(next);
    };
    const ptr = (e: PointerEvent) => ({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp });
    const down = (e: PointerEvent) => {
      e.stopPropagation();
      if (l.state && l.state.id !== null) {
        // the stick is taken: this finger is a tap on the pitch
        others.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
        return;
      }
      l.geom = geomFrom(zone);
      const s = stickDown(l.state ?? stickIdle(l.geom), ptr(e), l.geom);
      if (s.id === null) return;
      e.preventDefault();
      l.state = s;
      l.down = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {
        /* a synthetic pointer can't be captured */
      }
      report();
    };
    const move = (e: PointerEvent) => {
      if (!l.state || l.state.id !== e.pointerId || !l.geom) return;
      e.preventDefault();
      e.stopPropagation();
      l.state = stickMove(l.state, ptr(e), l.geom);
      report();
    };
    const up = (e: PointerEvent) => {
      e.stopPropagation();
      const o = others.get(e.pointerId);
      if (o) {
        others.delete(e.pointerId);
        if (e.type === 'pointerup' && classify(e.clientX - o.x, e.clientY - o.y, e.timeStamp - o.t) === 'tap') props.current.onTap?.(e.clientX, e.clientY);
        return;
      }
      if (!l.state || l.state.id !== e.pointerId || !l.geom) return;
      const d0 = l.down;
      l.state = stickUp(l.state, ptr(e), l.geom);
      l.down = null;
      const was = l.out;
      l.out = STICK_IDLE;
      paint();
      if (!props.current.disabled && was.active) props.current.onChange(STICK_IDLE);
      if (e.type === 'pointerup' && d0 && classify(e.clientX - d0.x, e.clientY - d0.y, e.timeStamp - d0.t) === 'tap') props.current.onTap?.(e.clientX, e.clientY);
    };
    zone.addEventListener('pointerdown', down, { passive: false });
    zone.addEventListener('pointermove', move, { passive: false });
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('lostpointercapture', up);
    return () => {
      zone.removeEventListener('pointerdown', down);
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerup', up);
      zone.removeEventListener('pointercancel', up);
      zone.removeEventListener('lostpointercapture', up);
      if (l.raf) cancelAnimationFrame(l.raf);
    };
  }, []);

  return (
    <div className={'ps-stick' + (disabled ? ' off' : '')} ref={zoneRef} data-stick-zone role="application" aria-label="Move: put your thumb down anywhere here and push; past the ring to sprint">
      <div className="ps-stick-ghost" data-stick-ghost aria-hidden="true">
        <i />
      </div>
      <div className="ps-stick-ring" ref={ringRef} aria-hidden="true">
        <i ref={knobRef} />
      </div>
    </div>
  );
}

/* ---------- the score bug ---------- */

/**
 * "YOU 1 · 67' · 5/7 · 1 RIV": both scores in the sides' colours, the match minute and the attack
 * count in the middle, a 3 px progress line along the bottom (the attack's clock, written by the host
 * through `lineRef` so it costs no render per frame), and the Heat bar's slot under it (hidden until
 * Heat arrives in soccer-7).
 */
export function ScoreBug({ you, rival, rivalTag, minute, count, mid, heat, clutch, pulse = 0, lineRef, label }: { you: number; rival: number | null; rivalTag: string; minute: string; count: string | null; mid?: React.ReactNode; heat: HeatState | null; clutch: boolean; /** bumped on the rival's goal: the bug's violet pulse plays once */ pulse?: number; lineRef?: React.Ref<HTMLElement>; label: string }) {
  return (
    <div className={'sc2-bug' + (clutch ? ' clutch' : '')} role="status" aria-label={label}>
      {pulse > 0 && <span key={pulse} className="sc2-bug-pulse" aria-hidden="true" />}
      <span className="sc2-bug-side us">
        <i>YOU</i>
        <b className="num">{you}</b>
      </span>
      <span className="sc2-bug-mid">
        {mid ?? (
          <>
            <b className="num">{minute}</b>
            {count && <small className="num">{count}</small>}
          </>
        )}
      </span>
      <span className="sc2-bug-side them">
        <b className="num">{rival ?? '–'}</b>
        <i>{rivalTag}</i>
      </span>
      <em className="sc2-bug-line" aria-hidden="true">
        <i ref={lineRef} />
      </em>
      <span className="sc2-heat" hidden={!heat} aria-hidden={!heat}>
        <i style={heat ? { width: heat.v + '%' } : undefined} />
      </span>
    </div>
  );
}

/* ---------- the toast line ---------- */

/** One line in a glass capsule, its bottom edge on the toast line; the word before " · " is the keyword. */
export function ToastLine({ text, kind, timer }: ToastProps & { timer?: boolean }) {
  const cut = text.indexOf(' · ');
  const key = cut > 0 ? text.slice(0, cut) : text;
  const rest = cut > 0 ? text.slice(cut) : '';
  return (
    <div className="sc2-toast-slot" aria-live="polite" role={timer ? 'timer' : 'status'}>
      <div key={text} className={'sc2-toast tone-' + kind}>
        <b>{key}</b>
        {rest && <span>{rest}</span>}
      </div>
    </div>
  );
}

/* ---------- the pause button ---------- */

export function PauseButton({ onPress }: PauseButtonProps) {
  return (
    <button
      type="button"
      className="sc2-pause"
      aria-label="Pause"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress();
      }}
      onKeyDown={(e) => {
        if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onPress();
        }
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="4.5" y="3.5" width="4" height="13" rx="1.4" />
        <rect x="11.5" y="3.5" width="4" height="13" rx="1.4" />
      </svg>
    </button>
  );
}
