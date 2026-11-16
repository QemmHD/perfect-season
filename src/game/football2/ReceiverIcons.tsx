// The passing surface's name chips and landing reticle (Claude, studio overhaul nfl-2; V2 §B.2.2).
// A chip in each eligible receiver's route colour sits over his head: touch it for an auto-led pass
// of the current type, thrown on touch-down (Football2's gestures; a slingshot starts on the open
// field around the chips). Chips are drawn over the stick zone and win a touch there (nfl-2 review
// fix: the back's chip sits in the zone on most pass plays). The landing reticle
// is always on the field in the pocket: the slingshot draws its own while you drag, and otherwise
// this one marks where a tap on the highlighted (most open) receiver would land.
//
// Everything moves by ref once a frame (`place`), so the chips never re-render the game. Chips
// whose 44×44 hit areas overlap fan out when a touch lands in the overlap, so every receiver can be
// picked even in a stack.
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Body, Pt } from './types';
import './pass-controls.css';

/** Each slot's route colour (the play art and the route lines use the same). */
export const SLOT_COLOR: Record<string, string> = { X: '#ffd23a', SL: '#ff7aa8', Z: '#5cb8ff', TE: '#7cf08c', RB: '#c7a2ff' };
/** A chip's touch area (design px). */
export const ICON_HIT = 44;
/** How long a fan-out holds (ms). */
const FAN_MS = 1400;

/** The chip's words: the surname, else the number, else the slot letter. */
export function chipLabel(b: Body): string {
  const parts = (b.p.name ?? '').trim().split(/\s+/).filter((w) => /[A-Za-z]/.test(w) && !/^(jr|sr|ii|iii|iv)\.?$/i.test(w));
  const last = parts[parts.length - 1];
  // (a fill-in's "name" is his position and number: no surname there)
  if (last && last.replace(/[^A-Za-z]/g, '').length > 2) return last.replace(/[^A-Za-z'.-]/g, '').toUpperCase().slice(0, 10);
  if (b.p.num !== null && b.p.num !== undefined) return '#' + b.p.num;
  return b.slot;
}

export interface IconPlace {
  /** the receiver's head on screen (css px), keyed by body id */
  heads: Record<number, { x: number; y: number }>;
  /** the receiver the reticle is for (highlighted), or null */
  pick: number | null;
  /** the reticle: a ground ellipse on screen (css px), or null when the slingshot draws its own */
  reticle: { x: number; y: number; rx: number; ry: number } | null;
  /** the clock now (ms), for the fan-out */
  now: number;
  /** the band the chips stay in (css px, their bottom edges): under the score bug, above the toast line (nfl-3) */
  bounds?: { top: number; bottom: number } | null;
}

export interface IconsHandle {
  place(at: IconPlace): void;
  /** the receivers a touch at a screen point is for: one, none, or several where cores overlap (fan out) */
  hits(x: number, y: number): number[];
  /** spread the chips apart for a moment (a touch landed where two overlap) */
  fan(now: number): void;
}

/** Chip boxes laid side by side where their touch areas would overlap: x positions, the same order. */
export function fanOut(xs: number[], ys: number[], width: number): number[] {
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const out = xs.slice();
  // each chip, left to right, steps right past every chip already placed that it would overlap (not
  // only its neighbour in x: a chip at another height can sit between two that overlap; review fix)
  const placed: number[] = [];
  for (const i of order) {
    let x = out[i];
    for (let moved = true; moved; ) {
      moved = false;
      for (const j of placed)
        // (the 0.5 px slack keeps a float that lands a hair short of the gap from looping forever)
        if (Math.abs(ys[i] - ys[j]) < ICON_HIT && Math.abs(x - out[j]) < ICON_HIT + 4 - 0.5) {
          x = out[j] + ICON_HIT + 4;
          moved = true;
        }
    }
    out[i] = x;
    placed.push(i);
  }
  // keep the group on screen, shifting it back as one where it ran off the right
  const over = Math.max(0, ...order.map((i) => out[i] + ICON_HIT / 2 + 4 - width));
  const under = Math.max(0, ...order.map((i) => ICON_HIT / 2 + 4 - (out[i] - over)));
  return out.map((x) => x - over + under);
}

export const ReceiverIcons = forwardRef<IconsHandle, { receivers: Body[]; show: boolean; onThrow: (id: number) => void }>(function ReceiverIcons({ receivers, show, onThrow }, ref) {
  const chips = useRef(new Map<number, HTMLButtonElement>());
  const reticle = useRef<HTMLDivElement>(null);
  const centres = useRef(new Map<number, Pt>());
  const widths = useRef(new Map<number, number>());
  /** each placed chip's half touch width: a long surname is wider than 44 px and all of it throws */
  const halves = useRef(new Map<number, number>());
  const fanUntil = useRef(0);
  useImperativeHandle(ref, () => ({
    place({ heads, pick, reticle: rt, now, bounds }) {
      const ids = receivers.map((b) => b.id).filter((id) => heads[id] && chips.current.get(id));
      const xs = ids.map((id) => heads[id].x);
      // each chip's pointer tip sits 4 px over his head; its 44×44 touch area rises from there
      const lo = bounds ? bounds.top + ICON_HIT : -Infinity;
      const hi = bounds ? bounds.bottom : Infinity;
      const ys = ids.map((id) => Math.max(lo, Math.min(hi, heads[id].y - 4)));
      const fanned = now < fanUntil.current;
      const W = window.innerWidth;
      // a chip wider than its touch area (a long surname) is kept whole on screen
      const half = ids.map((id) => {
        const el = chips.current.get(id)!;
        if (!widths.current.has(id)) widths.current.set(id, (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? ICON_HIT);
        return Math.max(ICON_HIT, widths.current.get(id)!) / 2 + 4;
      });
      const fx = (fanned ? fanOut(xs, ys, W) : xs).map((x, i) => Math.max(half[i], Math.min(W - half[i], x)));
      centres.current.clear();
      halves.current.clear();
      for (const b of receivers) {
        const el = chips.current.get(b.id);
        if (!el) continue;
        const i = ids.indexOf(b.id);
        if (i < 0) {
          el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = '';
        el.style.transform = 'translate(' + Math.round(fx[i]) + 'px,' + Math.round(ys[i]) + 'px)';
        el.classList.toggle('pick', pick === b.id);
        el.classList.toggle('fanned', fanned && Math.abs(fx[i] - xs[i]) > 1);
        centres.current.set(b.id, { x: fx[i], y: ys[i] - ICON_HIT / 2 });
        halves.current.set(b.id, half[i] - 4);
      }
      const r = reticle.current;
      if (r) {
        r.style.visibility = rt ? '' : 'hidden';
        if (rt) {
          r.style.transform = 'translate(' + Math.round(rt.x) + 'px,' + Math.round(rt.y) + 'px)';
          r.style.width = Math.round(rt.rx * 2) + 'px';
          r.style.height = Math.round(rt.ry * 2) + 'px';
          r.style.marginLeft = -Math.round(rt.rx) + 'px';
          r.style.marginTop = -Math.round(rt.ry) + 'px';
        }
      }
    },
    hits(x, y) {
      // the 44×44 cores first: two of them under the touch is a real overlap (fan out); a long
      // surname's wider label only counts where no core does, and then the nearest chip takes it
      // (labels alone never fan: fanning spaces the cores, so it couldn't separate them)
      const core: number[] = [];
      let wide: number | null = null,
        wideD = Infinity;
      for (const [id, c] of centres.current) {
        if (Math.abs(y - c.y) > ICON_HIT / 2) continue;
        const dx = Math.abs(x - c.x);
        if (dx <= ICON_HIT / 2) core.push(id);
        else if (dx <= (halves.current.get(id) ?? ICON_HIT / 2) && dx < wideD) {
          wide = id;
          wideD = dx;
        }
      }
      return core.length ? core : wide !== null ? [wide] : [];
    },
    fan(now) {
      fanUntil.current = now + FAN_MS;
    }
  }));
  if (!show) return null;
  return (
    <div className="fb2-icons" aria-label="Receivers: touch a name to throw to him at once, or drag back on the open field to aim">
      <div ref={reticle} className="fb2-reticle" aria-hidden="true" />
      {receivers.map((b) => (
        <button
          key={b.id}
          ref={(el) => {
            if (el) chips.current.set(b.id, el);
            else chips.current.delete(b.id);
          }}
          type="button"
          className="fb2-icon"
          data-icon={b.id}
          style={{ '--chip': SLOT_COLOR[b.slot] ?? '#ffffff', visibility: 'hidden' } as React.CSSProperties}
          aria-label={'Pass to ' + b.slot + ' · ' + b.p.name}
          onClick={(e) => {
            // keyboard and assistive presses; touches are read by Football2's gestures on touch-down
            if (e.detail === 0) onThrow(b.id);
          }}
        >
          <span>{chipLabel(b)}</span>
        </button>
      ))}
    </div>
  );
});
