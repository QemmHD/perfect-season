// The floating stick (plan §4.2): a ghost ring at rest; a touch anywhere in the lower-left zone
// spawns the ring under the thumb. The rules are in stick.ts (pure); this component turns pointer
// events into them, draws the ring straight to the DOM (no React render per move) and reports.
//  - non-passive native listeners, touch-action: none, pointer capture
//  - a thumb already down when the stick enables (at the whistle) is adopted at once: the stick
//    tracks its pointer while disabled and reports the moment it enables
//  - onChange fires on down and up, and at most once per animation frame in between
//  - a second finger tapping inside the zone while the stick is held is passed on (`onOtherTap`:
//    tap a teammate to pass), so the stick's own finger can never pass
import React, { useEffect, useRef } from 'react';
import { geomFrom, type StickGeom, stickDown, stickIdle, stickMove, type StickOut, stickOut, type StickState, stickUp, sprintEdge } from './stick';

const IDLE: StickOut = { x: 0, y: 0, mag: 0, sprint: false, active: false };

export function Stick({
  geom,
  disabled = false,
  floating = true,
  sprint = true,
  onChange,
  onSprintEdge,
  onOtherTap
}: {
  /** a fixed geometry (tests, previews); by default it's measured from the tokens on each touch */
  geom?: StickGeom;
  disabled?: boolean;
  floating?: boolean;
  /** false: no sprint ring (a Burst button instead) */
  sprint?: boolean;
  onChange: (o: StickOut) => void;
  onSprintEdge?: () => void;
  onOtherTap?: (x: number, y: number, t: number) => void;
}) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLElement>(null);
  const live = useRef({ geom: null as StickGeom | null, state: null as StickState | null, out: IDLE, raf: 0 });
  const props = useRef({ disabled, onChange, onSprintEdge, onOtherTap, geom, floating, sprint });
  props.current = { disabled, onChange, onSprintEdge, onOtherTap, geom, floating, sprint };

  // the stick enables (the whistle): a held thumb's direction applies on this very frame
  useEffect(() => {
    const l = live.current;
    if (!disabled && l.state && l.geom) {
      l.out = stickOut(l.state, l.geom);
      onChange(l.out);
    } else if (disabled) l.out = IDLE;
  }, [disabled]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const l = live.current;
    const others = new Map<number, { x: number; y: number; t: number }>();
    const draw = () => {
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
      // the knob rides to the sprint ring at most
      const max = g.sprintAt || g.ringR;
      const k = d > max ? max / d : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      zone.classList.add('held');
      zone.classList.toggle('sprint', l.out.sprint);
    };
    const emit = () => {
      l.raf = 0;
      if (!l.state || !l.geom) return;
      const next = stickOut(l.state, l.geom);
      const prev = l.out;
      l.out = next;
      draw();
      const p = props.current;
      if (p.disabled) return;
      if (sprintEdge(prev, next)) p.onSprintEdge?.();
      p.onChange(next);
    };
    const ptr = (e: PointerEvent) => ({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp });
    const down = (e: PointerEvent) => {
      const p = props.current;
      if (l.state && l.state.id !== null) {
        // the stick's taken: this finger is a court tap
        others.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
        return;
      }
      l.geom = p.geom ?? geomFrom(zone, { floating: p.floating, sprint: p.sprint });
      const s = stickDown(l.state ?? stickIdle(l.geom), ptr(e), l.geom);
      if (s.id === null) return;
      e.preventDefault();
      l.state = s;
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointers can't be captured */
      }
      if (l.raf) cancelAnimationFrame(l.raf);
      emit();
    };
    const move = (e: PointerEvent) => {
      if (!l.state || l.state.id !== e.pointerId || !l.geom) return;
      e.preventDefault();
      l.state = stickMove(l.state, ptr(e), l.geom);
      if (!l.raf) l.raf = requestAnimationFrame(emit);
    };
    const up = (e: PointerEvent) => {
      const o = others.get(e.pointerId);
      if (o) {
        others.delete(e.pointerId);
        if (e.type === 'pointerup' && e.timeStamp - o.t < 250 && Math.hypot(e.clientX - o.x, e.clientY - o.y) < 12) props.current.onOtherTap?.(e.clientX, e.clientY, e.timeStamp);
        return;
      }
      if (!l.state || l.state.id !== e.pointerId || !l.geom) return;
      l.state = stickUp(l.state, ptr(e), l.geom);
      if (l.raf) cancelAnimationFrame(l.raf);
      l.raf = 0;
      l.out = IDLE;
      draw();
      if (!props.current.disabled) props.current.onChange(IDLE);
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
    <div className={'ps-stick' + (disabled ? ' off' : '') + (floating ? '' : ' fixed')} ref={zoneRef} data-stick-zone aria-label="Move: drag anywhere here" role="application">
      <div className="ps-stick-ghost" data-stick-ghost aria-hidden="true">
        <i />
      </div>
      <div className="ps-stick-ring" ref={ringRef} aria-hidden="true">
        <i ref={knobRef} />
      </div>
    </div>
  );
}
