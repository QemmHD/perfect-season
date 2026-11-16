// Codex: screen-relative, full two-axis movement. Field y increases toward the far end zone.
import type { Pt } from './types';

/** Radial dead zone removes thumb jitter; full deflection retains the full speed budget. */
export function screenRunInput(x: number, y: number, view: 'end' | 'side'): Pt {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 0.12) return { x: 0, y: 0 };
  const strength = (Math.min(1, length) - 0.12) / 0.88;
  const sx = (x / length) * strength,
    sy = (y / length) * strength;
  return view === 'side' ? { x: -sy, y: sx } : { x: sx, y: -sy };
}

/** A held stick counts for a new carrier when its upfield share is at least this (or on a designed handoff). */
export const CARRY_UPFIELD = 0.3;
/** An uncounted stick takes over once it has moved this far from where it was when the ball changed hands. */
export const CARRY_MOVE = 0.25;

/**
 * The momentum carry (Claude, nfl-1): what the screen sends the engine for the ball carrier. When
 * the ball changes hands (a catch, a handoff, a scramble), a stick that is already held counts only
 * on a designed handoff, or when it points upfield (at least CARRY_UPFIELD of its length). Otherwise
 * the new carrier runs on his momentum (`null`) until a new touch of the stick (or a key press), or
 * until the held stick moves CARRY_MOVE from where it was. From then on the stick is direct control:
 * its vector, and {0,0} (a brake) when it is centred or let go. So a thumb drifting the quarterback
 * back-left never sends the receiver back-left after the catch, and a late thumb never stops him.
 * A touch made while the ball is in the air (`touch(true)`: nobody carries it, and the stick can only
 * be there for whoever catches it) is deliberate, so a stick it holds at the catch counts whatever
 * its direction; a touch in the pocket (`touch()`) stays gated, so a drifting thumb never carries over.
 */
export class CarryGate {
  private carrier: number | null = null;
  private steering = false;
  private at: Pt | null = null;
  /** a touch made while the ball was in the air, waiting for the catch (Claude, nfl-1 review fix) */
  private fresh = false;

  /**
   * A new touch of the stick, or a key press: the player has the carrier from now on. `inAir`:
   * made while the ball is in the air, so it is meant for the receiver who catches it.
   */
  touch(inAir = false) {
    this.steering = true;
    if (inAir && this.carrier === null) this.fresh = true;
  }

  /** A new play: nobody has the ball yet. */
  reset() {
    this.carrier = null;
    this.steering = false;
    this.at = null;
    this.fresh = false;
  }

  /**
   * This step's input. `carrier` is the ball carrier's id while he runs (null otherwise),
   * `handoff` whether he got it on a designed run, `stick` the held stick as a field vector
   * (after the dead zone), or null when nothing is held.
   */
  input(carrier: number | null, handoff: boolean, stick: Pt | null): Pt | null {
    if (carrier !== this.carrier) {
      this.carrier = carrier;
      this.at = stick;
      const len = stick ? Math.hypot(stick.x, stick.y) : 0;
      this.steering = !!stick && len > 0 && (handoff || this.fresh || stick.y >= CARRY_UPFIELD * len);
      this.fresh = false;
    } else if (!this.steering && stick && this.at && Math.hypot(stick.x - this.at.x, stick.y - this.at.y) >= CARRY_MOVE) this.steering = true;
    if (carrier === null) return stick ?? { x: 0, y: 0 };
    return this.steering ? (stick ?? { x: 0, y: 0 }) : null;
  }
}
