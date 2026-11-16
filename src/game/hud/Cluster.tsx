// The right-thumb cluster (plan §4.3, V2 A.5 / C.3): A gold, B teal, C and D dark glass, each at its
// §4.1 token position. Every 'down' is delivered on pointerdown (actions start on touch-down); swipes
// on A arrive with the move that makes them; the gesture lands with 'up'. The bookkeeping is the pure
// ClusterTracker (gestures.ts). `Radial` is the CALL menu that opens above a slot.
import React, { type ReactNode, useEffect, useRef } from 'react';
import { type ClusterInput, ClusterTracker, type Slot } from './gestures';

export type { ClusterInput, Slot } from './gestures';

export interface SlotSpec {
  label: string;
  icon?: ReactNode;
  hidden?: boolean;
  disabled?: boolean;
  tone: 'gold' | 'teal' | 'glass';
  /** A only: swipes off the button are moves */
  swipes?: boolean;
  /** the small direction labels drawn around the button (SPIN / CROSS / STEP) */
  hints?: { up?: string; side?: string; down?: string };
  pips?: number;
  /** what a screen reader says */
  aria?: string;
}

const SLOTS: Slot[] = ['A', 'B', 'C', 'D'];
/** the pointer id a keyboard press is tracked under */
const KEYBOARD = -1;

/** The SVG labels around A: ▲ up, ◀ side ▶, ▼ down (V2 C.3). Never a target. */
function SwipeHints({ hints }: { hints: NonNullable<SlotSpec['hints']> }) {
  const tri = (x: number, y: number, rot: number) => <path d="M0 -4 L4 3 L-4 3 Z" transform={`translate(${x} ${y}) rotate(${rot})`} />;
  return (
    <svg className="ps-ctl-hints" viewBox="-80 -80 160 160" aria-hidden="true">
      {hints.up && (
        <g>
          {tri(0, -66, 0)}
          <text x="0" y="-53">{hints.up}</text>
        </g>
      )}
      {hints.side && (
        <g>
          {tri(-74, 0, -90)}
          <text x="-60" y="-8" className="side">{hints.side}</text>
        </g>
      )}
      {hints.down && (
        // arrow and word side by side in the band just under A: with no bottom inset (320×568) the
        // screen edge is only ~17 units below A's rim, so a word stacked over the arrow ran off it
        <g>
          {tri(-24, 54, 180)}
          <text x="-16" y="58" className="down">
            {hints.down}
          </text>
        </g>
      )}
    </svg>
  );
}

export function Cluster({
  slots,
  onInput,
  buttonsOnly = false,
  arc,
  arcOff = false,
  onArc
}: {
  slots: Record<Slot, SlotSpec>;
  onInput: (e: ClusterInput) => void;
  buttonsOnly?: boolean;
  /** Buttons-only mode: the swipes as small buttons in an arc above A, firing on down */
  arc?: { id: string; label: string }[];
  /** hide the arc for now (NBA: while the CALL radial is open, it fans out over the arc's spot) */
  arcOff?: boolean;
  onArc?: (id: string, t: number) => void;
}) {
  const props = useRef({ slots, onInput, buttonsOnly });
  props.current = { slots, onInput, buttonsOnly };
  const tracker = useRef<ClusterTracker | null>(null);
  tracker.current ??= new ClusterTracker((s) => !!props.current.slots[s].swipes && !props.current.buttonsOnly);
  // the OS takes the touch (a call, the app switcher): everything held is let go
  useEffect(() => {
    const drop = () => tracker.current!.clear(performance.now()).forEach((e) => props.current.onInput(e));
    window.addEventListener('blur', drop);
    return () => window.removeEventListener('blur', drop);
  }, []);

  const handlers = (slot: Slot) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const out = tracker.current!.down(slot, e.pointerId, e.clientX, e.clientY, e.timeStamp);
      if (!out) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointer */
      }
      props.current.onInput(out);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const out = tracker.current!.move(e.pointerId, e.clientX, e.clientY, e.timeStamp);
      if (out) props.current.onInput(out);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const out = tracker.current!.up(e.pointerId, e.clientX, e.clientY, e.timeStamp);
      if (out) props.current.onInput(out);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      const out = tracker.current!.up(e.pointerId, e.clientX, e.clientY, e.timeStamp, true);
      if (out) props.current.onInput(out);
    },
    onLostPointerCapture: (e: React.PointerEvent) => {
      const out = tracker.current!.up(e.pointerId, e.clientX, e.clientY, e.timeStamp, true);
      if (out) props.current.onInput(out);
    },
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
    // a keyboard (or switch control) press is a finger that never moves: down, then a tap or a hold
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      const out = tracker.current!.down(slot, KEYBOARD, r.x + r.width / 2, r.y + r.height / 2, e.timeStamp);
      if (out) props.current.onInput(out);
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      const out = tracker.current!.up(KEYBOARD, r.x + r.width / 2, r.y + r.height / 2, e.timeStamp);
      if (out) props.current.onInput(out);
    },
    onBlur: () => {
      const out = tracker.current!.up(KEYBOARD, 0, 0, performance.now(), true);
      if (out) props.current.onInput(out);
    }
  });

  return (
    <div className="ps-ctl" data-mode={buttonsOnly ? 'buttons' : 'gestures'}>
      {SLOTS.map((slot) => {
        const s = slots[slot];
        if (s.hidden) return null;
        return (
          <button
            key={slot}
            type="button"
            className={'ps-ctl-btn ps-ctl-' + slot.toLowerCase() + ' tone-' + s.tone + (s.disabled ? ' off' : '')}
            aria-label={s.aria ?? s.label}
            aria-disabled={s.disabled || undefined}
            data-slot={slot}
            {...handlers(slot)}
          >
            {s.icon && <span className="ps-ctl-icon" aria-hidden="true">{s.icon}</span>}
            <span className="ps-ctl-label">{s.label}</span>
            {!!s.pips && (
              <span className="ps-ctl-pips" aria-hidden="true">
                {Array.from({ length: s.pips }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
            )}
          </button>
        );
      })}
      {!buttonsOnly && slots.A.swipes && slots.A.hints && !slots.A.hidden && (
        <div className="ps-ctl-hintwrap" aria-hidden="true">
          <SwipeHints hints={slots.A.hints} />
        </div>
      )}
      {buttonsOnly && arc && !arcOff && !slots.A.hidden && (
        <div className="ps-ctl-arc">
          {arc.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={'ps-ctl-arcbtn n' + i}
              data-arc={m.id}
              onPointerDown={(e) => {
                e.preventDefault();
                onArc?.(m.id, e.timeStamp);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The radial item under a point (slide from the slot and lift on an item), or null. */
export function radialAt(x: number, y: number): string | null {
  if (typeof document === 'undefined' || !document.elementsFromPoint) return null;
  for (const el of document.elementsFromPoint(x, y)) {
    const id = (el as HTMLElement).closest?.('[data-radial-id]')?.getAttribute('data-radial-id');
    if (id) return id;
  }
  return null;
}

/** The CALL menu: up to three ≥ 44 px items in an arc above the slot. Tap one (it fires on down), or
 * slide to it from the slot and lift (the host passes the lift point to `radialAt`). */
export function Radial({ items, at, open, onPick, onClose }: { items: { id: string; label: string }[]; at: Slot; open: boolean; onPick: (id: string, t: number) => void; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [open]);
  return (
    <div className={'ps-radial at-' + at.toLowerCase() + (open ? ' open' : '')} aria-hidden={!open} role="menu">
      {items.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="menuitem"
          tabIndex={open ? 0 : -1}
          className={'ps-radial-item n' + i + ' of' + items.length}
          data-radial-id={m.id}
          onPointerDown={(e) => {
            if (!open) return;
            e.preventDefault();
            e.stopPropagation();
            onPick(m.id, e.timeStamp);
          }}
          onKeyDown={(e) => {
            if (!open || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
            e.preventDefault();
            onPick(m.id, e.timeStamp);
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
