// NBA's controls (plan §5, V2 B.1.2): the shared stick and cluster, with one meaning per gesture in
// each context. This file maps the contexts to slot specs and draws them; Hoops2.tsx owns the loop
// and turns the inputs into engine calls.
//
// | Context            | A (gold)                                   | B (teal)            | C (glass)                 |
// | Offense, ball      | SHOOT: hold and let go · tap = pump fake ·  | PASS: 120 ms wind-up | CALL: SCREEN / CUT / ISO  |
// |                    | swipe = cross / step-back / spin (euro)     | held = lob          |                           |
// | Rebound race       | BOARD: jump on down                         | hidden              | hidden                    |
// | Dead ball          | tap: skip the replay                        | dimmed              | dimmed                    |
// D is hidden in NBA. A teammate on the court is a pass target (tap him).
import React from 'react';
import { Cluster, type ClusterInput, Radial, type Slot, type SlotSpec } from '../hud/Cluster';
import { Stick } from '../StickPad';
import type { StickOut } from '../stick';
import { PUMP_EVERY, pumpFake, unrise } from './engine';
import type { Possession } from './types';

export type HoopsCtx = 'offense' | 'board' | 'dead';

/** The CALL radial's items. ISO clears a side for the top-usage card (NBA-03). */
export const CALLS: { id: 'screen' | 'cut' | 'iso'; label: string }[] = [
  { id: 'screen', label: 'SCREEN' },
  { id: 'cut', label: 'CUT' },
  { id: 'iso', label: 'ISO' }
];

/** Buttons-only: the three moves above A (D's spot and around it). */
export const MOVE_ARC: { id: 'step' | 'cross' | 'spin'; label: string }[] = [
  { id: 'step', label: 'STEP' },
  { id: 'cross', label: 'CROSS' },
  { id: 'spin', label: 'SPIN' }
];

const svg = (children: React.ReactNode, vb = '0 0 24 24') => (
  <svg viewBox={vb} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
/** a ball with its seams */
const BALL = svg(
  <>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M2.8 12h18.4M12 2.8v18.4M5.6 5.4c3 2.4 3 10.8 0 13.2M18.4 5.4c-3 2.4-3 10.8 0 13.2" />
  </>
);
const PASS = svg(<path d="M6 18 18 6M9 6h9v9" />);
/** X to O with the run between them: a play */
const CALL = svg(
  <>
    <path d="M3 4l5 5M8 4 3 9" />
    <circle cx="18" cy="17" r="3.2" />
    <path d="M8.5 12.5c2.5 0 4 1 5.5 3" strokeDasharray="2 2.4" />
  </>
);
const BOARD = svg(
  <>
    <circle cx="12" cy="14" r="7" />
    <path d="M12 2v5M8.5 4.5 12 1.8l3.5 2.7" />
  </>
);

/** The four slots for a context (pure: tested). */
export function slotsFor(ctx: HoopsCtx): Record<Slot, SlotSpec> {
  const hidden: SlotSpec = { label: '', tone: 'glass', hidden: true };
  if (ctx === 'board')
    return {
      A: { label: 'BOARD', icon: BOARD, tone: 'gold', aria: 'Board: jump for the rebound' },
      B: hidden,
      C: hidden,
      D: hidden
    };
  return {
    A: {
      label: 'SHOOT',
      icon: BALL,
      tone: 'gold',
      swipes: true,
      hints: { up: 'SPIN', side: 'CROSS', down: 'STEP' },
      disabled: ctx === 'dead',
      aria: 'Shoot: hold and let go at the top. Tap to pump fake. Swipe for a move.'
    },
    B: { label: 'PASS', icon: PASS, tone: 'teal', disabled: ctx === 'dead', aria: 'Pass to the man you aim at. Hold for a lob.' },
    C: { label: 'CALL', icon: CALL, tone: 'glass', disabled: ctx === 'dead', aria: 'Call a play: screen, cut or isolation' },
    D: hidden
  };
}

/**
 * Which slots are dimmed right now, as the `data-off` value the loop writes every frame (NBA-18: the
 * old buttons kept the state of their last React render). A: nobody to shoot or jump for; B: no ball
 * in hand to pass; C: no ball in hand, or the call still recharging.
 */
/**
 * SHOOT lifted (nba-2 fix): the gesture decides, never the engine's clock. A tap is a pump fake while
 * he hasn't left the floor, and still one when the gather rose at most UNRISE_S before the lift got
 * here (the lift arrives a frame or three after the finger left the glass): that rise is taken back.
 * Anything else lets the shot go; the caller times it from the lift's own timestamp.
 *   'pump' a fake went up · 'wait' a tap, but too soon after the last fake · 'release' shoot · 'none'
 */
export function liftShoot(p: Possession, tap: boolean): 'pump' | 'wait' | 'release' | 'none' {
  const gathering = !!p.meter?.gather || (!!p.finish && p.t < p.finish.tUp && !p.ball);
  if (tap && (gathering || unrise(p))) {
    const h = p.handler !== null ? p.bodies[p.handler] : null;
    const tooSoon = !!h && p.t - (h.pumpAt ?? -9) < PUMP_EVERY;
    if (pumpFake(p)) return 'pump';
    return tooSoon ? 'wait' : 'none';
  }
  return p.meter && p.meter.off === undefined ? 'release' : 'none';
}

export function offOf(p: Possession | null, replaying: boolean): string {
  const dead = !p || !!p.end || replaying;
  const out: string[] = [];
  if (dead || (p.handler === null && p.ball?.kind !== 'loose') || p.meter?.off !== undefined) out.push('a');
  if (dead || p.handler === null || !!p.ball || !!p.meter || !!p.finish) out.push('b');
  if (dead || p.handler === null || !!p.ball || (!!p.meter && !p.meter.gather) || !!p.finish || p.t < (p.callReadyAt ?? 0)) out.push('c');
  return out.join(' ');
}

export function HoopsControls({
  ctx,
  buttonsOnly,
  callOpen,
  rootRef,
  onStick,
  onSprintEdge,
  onCourtTap,
  onInput,
  onArc,
  onCall,
  onCallClose
}: {
  ctx: HoopsCtx;
  buttonsOnly: boolean;
  callOpen: boolean;
  /** the loop toggles `data-off` on this element as the possession changes (NBA-18) */
  rootRef: React.RefObject<HTMLDivElement>;
  onStick: (o: StickOut) => void;
  onSprintEdge: () => void;
  onCourtTap: (x: number, y: number) => void;
  onInput: (e: ClusterInput) => void;
  onArc: (id: string, t: number) => void;
  onCall: (id: string, t: number) => void;
  onCallClose: () => void;
}) {
  return (
    <div className="hg2-controls" ref={rootRef}>
      <div className="ps-scrim" aria-hidden="true" />
      <Stick onChange={onStick} onSprintEdge={onSprintEdge} onOtherTap={(x, y) => onCourtTap(x, y)} />
      <Cluster slots={slotsFor(ctx)} onInput={onInput} buttonsOnly={buttonsOnly} arc={ctx === 'offense' ? MOVE_ARC : undefined} arcOff={callOpen} onArc={onArc} />
      <Radial items={CALLS} at="C" open={callOpen && ctx === 'offense'} onPick={onCall} onClose={onCallClose} />
    </div>
  );
}
