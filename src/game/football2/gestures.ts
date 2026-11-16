// Pointer ownership and gestures for the football screen (Claude, studio overhaul nfl-2; the V2
// control grammar, docs/studio-overhaul/nfl.md "Pointer ownership and gestures"). Pure: no DOM, no
// clock, no random numbers. Football2 feeds it pointer events with their own timestamps and acts on
// what comes back, and gestures.test.ts drives it with synthetic sequences.
//
// Ownership is decided on pointerdown, in this order: a control (A/B/C/D, pause) → that control;
// the stick zone (left 48%, lower 55%) → the stick until it lifts; a receiver icon → the icon;
// anywhere else on the right two thirds → the slingshot (in the pocket) or the cover-ball hold
// (carrying). Everything fires on pointerdown except holds and the slingshot's release: a receiver
// icon throws on touch-down (an aim that starts on a chip would throw, so the slingshot starts on
// the open field around them; the chips are only their 44 px touch areas over the heads).
import type { PassType } from './types';

/** A tap moves less than this (design px) and lasts less than TAP_MS; the slingshot starts at it. */
export const TAP_PX = 10;
export const TAP_MS = 250;
/** A swipe off A: this far sideways (px) within SWIPE_MS. */
export const SWIPE_PX = 36;
export const SWIPE_MS = 250;
/** The cover-ball hold: the right thumb still (under TAP_PX) on the field this long while carrying. */
export const COVER_MS = 300;

/** What the screen is doing, as far as touches go. */
export type GestureState = 'pre' | 'pocket' | 'air' | 'carrier' | 'idle';

/** The stick zone (C15): `w` px from the left edge, from `top` px down to the bottom. */
export interface StickZone {
  w: number;
  top: number;
}

export interface Ctx {
  /** the screen's width (px) */
  w: number;
  state: GestureState;
  zone: StickZone;
}

/** A pointerdown as Football2 sees it: where, when (ms, the event's timeStamp) and what it landed on. */
export interface Down {
  id: number;
  x: number;
  y: number;
  t: number;
  /** a control's id (A, B, C, D, pause) when the touch landed on one */
  ctl?: string | null;
  /** a receiver icon's body id when it landed on one */
  icon?: number | null;
}

export type Owner = { kind: 'control'; ctl: string } | { kind: 'stick' } | { kind: 'icon'; icon: number } | { kind: 'sling' } | { kind: 'hold' } | { kind: 'none' };

/** The stick zone, from the C15 rule: the left 48% of the width and the lower 55% of the height. */
export function stickZone(w: number, h: number): StickZone {
  return { w: Math.round(w * 0.48), top: Math.round(h * 0.45) };
}

/** Who owns a new touch (the order above). Receiver icons only take touches in the pocket. */
export function ownerOf(d: Down, c: Ctx): Owner {
  if (d.ctl) return { kind: 'control', ctl: d.ctl };
  if (c.state !== 'idle' && d.x <= c.zone.w && d.y >= c.zone.top) return { kind: 'stick' };
  if (c.state === 'pocket' && d.icon !== null && d.icon !== undefined) return { kind: 'icon', icon: d.icon };
  if (d.x < c.w / 3) return { kind: 'none' };
  if (c.state === 'pocket') return { kind: 'sling' };
  if (c.state === 'carrier') return { kind: 'hold' };
  return { kind: 'none' };
}

/** A touch that lifted after moving `px` over `ms`: a tap or not. */
export function isTap(px: number, ms: number): boolean {
  return px < TAP_PX && ms < TAP_MS;
}

/** A sideways swipe off A: -1 left, 1 right, 0 none (too short, too slow, or more up than across). */
export function swipeDir(dx: number, dy: number, ms: number): -1 | 0 | 1 {
  if (ms > SWIPE_MS || Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? -1 : 1;
}

/** The C chip and the second finger: TOUCH → BULLET → LOB → TOUCH. */
export function nextPassType(t: PassType): PassType {
  return t === 'touch' ? 'bullet' : t === 'bullet' ? 'lob' : 'touch';
}

/**
 * Burst: pushing the stick past the sprint ring, or (with the Burst-button preference) holding D.
 * One source counts at a time, so the stamina maths sees the same "held" either way.
 */
export function burstHeld(src: { ring: boolean; button: boolean; buttonPref: boolean }): boolean {
  return src.buttonPref ? src.button : src.ring;
}

/** What a tracked touch turned into, for Football2 to act on. */
export type Gesture =
  | { kind: 'stick-down'; id: number }
  | { kind: 'stick-up'; id: number }
  | { kind: 'icon-throw'; icon: number }
  | { kind: 'sling-start'; id: number; x0: number; y0: number }
  | { kind: 'sling-release'; id: number }
  | { kind: 'sling-cancel'; id: number }
  | { kind: 'cycle' }
  | { kind: 'cover'; on: boolean }
  | { kind: 'swipe'; dir: -1 | 1 }
  | { kind: 'a-tap' };

interface Track {
  owner: Owner;
  x0: number;
  y0: number;
  t0: number;
  x: number;
  y: number;
  /** a touch on the sling surface passed TAP_PX: it's drawing the slingshot */
  slinging: boolean;
  /** the cover hold is on */
  covering: boolean;
  /** a pending A press that is waiting to see if it's a swipe */
  aPending: boolean;
}

/**
 * The pointers on the screen and what each one owns. `down`, `move`, `up` and `cancel` take the
 * event's own timestamp (ms); `tick(now)` runs the time-based parts (the cover-ball hold and a
 * pending A press) once a frame. Each returns the gestures that just happened.
 */
export class Gestures {
  private tracks = new Map<number, Track>();

  /** The pointer that owns the stick, if any. */
  stickId(): number | null {
    for (const [id, t] of this.tracks) if (t.owner.kind === 'stick') return id;
    return null;
  }

  /** The pointer drawing a slingshot, if any. */
  slingId(): number | null {
    for (const [id, t] of this.tracks) if (t.slinging) return id;
    return null;
  }

  owner(id: number): Owner | null {
    return this.tracks.get(id)?.owner ?? null;
  }

  /**
   * A new touch. `pendingA` says A is waiting for a possible swipe (a carrier's JUKE with no stick
   * direction): the press resolves as a swipe, or as a plain JUKE on lift or after SWIPE_MS.
   */
  down(d: Down, c: Ctx, opts: { pendingA?: boolean } = {}): Gesture[] {
    const out: Gesture[] = [];
    // a second finger during a slingshot drag cycles the throw type, like C (never the stick's finger)
    const sling = this.slingId();
    let owner = ownerOf(d, c);
    if (sling !== null && sling !== d.id && owner.kind !== 'stick' && owner.kind !== 'control') {
      out.push({ kind: 'cycle' });
      owner = { kind: 'none' };
    }
    // one stick: a second touch in the zone while it's held owns nothing
    if (owner.kind === 'stick' && this.stickId() !== null) owner = { kind: 'none' };
    // one slingshot or icon at a time
    if (owner.kind === 'sling' && [...this.tracks.values()].some((t) => t.owner.kind === 'sling')) owner = { kind: 'none' };
    // an icon throws the moment it's touched (once: the finger then owns nothing)
    if (owner.kind === 'icon') {
      out.push({ kind: 'icon-throw', icon: owner.icon });
      owner = { kind: 'none' };
    }
    this.tracks.set(d.id, { owner, x0: d.x, y0: d.y, t0: d.t, x: d.x, y: d.y, slinging: false, covering: false, aPending: owner.kind === 'control' && owner.ctl === 'A' && !!opts.pendingA });
    if (owner.kind === 'stick') out.push({ kind: 'stick-down', id: d.id });
    return out;
  }

  move(id: number, x: number, y: number, t: number): Gesture[] {
    const k = this.tracks.get(id);
    if (!k) return [];
    k.x = x;
    k.y = y;
    const out: Gesture[] = [];
    const px = Math.hypot(x - k.x0, y - k.y0);
    if (k.owner.kind === 'sling' && !k.slinging && px >= TAP_PX) {
      k.slinging = true;
      out.push({ kind: 'sling-start', id, x0: k.x0, y0: k.y0 });
    }
    if (k.owner.kind === 'hold' && k.covering && px >= TAP_PX) {
      k.covering = false;
      out.push({ kind: 'cover', on: false });
    }
    if (k.aPending) {
      const dir = swipeDir(x - k.x0, y - k.y0, t - k.t0);
      if (dir) {
        k.aPending = false;
        out.push({ kind: 'swipe', dir });
      }
    }
    return out;
  }

  up(id: number, x: number, y: number, t: number): Gesture[] {
    const k = this.tracks.get(id);
    if (!k) return [];
    const out = this.move(id, x, y, t);
    this.tracks.delete(id);
    if (k.owner.kind === 'stick') out.push({ kind: 'stick-up', id });
    else if (k.slinging) out.push({ kind: 'sling-release', id });
    if (k.covering) out.push({ kind: 'cover', on: false });
    if (k.aPending) out.push({ kind: 'a-tap' });
    return out;
  }

  /** The touch was taken away (a system gesture, a call): nothing it was doing fires. */
  cancel(id: number): Gesture[] {
    const k = this.tracks.get(id);
    if (!k) return [];
    this.tracks.delete(id);
    const out: Gesture[] = [];
    if (k.owner.kind === 'stick') out.push({ kind: 'stick-up', id });
    if (k.slinging) out.push({ kind: 'sling-cancel', id });
    if (k.covering) out.push({ kind: 'cover', on: false });
    return out;
  }

  /** Time-based gestures at `now` (ms, the same clock as the events): the cover hold and a lapsed A press. */
  tick(now: number): Gesture[] {
    const out: Gesture[] = [];
    for (const k of this.tracks.values()) {
      if (k.owner.kind === 'hold' && !k.covering && now - k.t0 >= COVER_MS && Math.hypot(k.x - k.x0, k.y - k.y0) < TAP_PX) {
        k.covering = true;
        out.push({ kind: 'cover', on: true });
      }
      if (k.aPending && now - k.t0 > SWIPE_MS) {
        k.aPending = false;
        out.push({ kind: 'a-tap' });
      }
    }
    return out;
  }

  /** Forget every touch (a new play, the game paused): the stick and any hold let go. */
  clear(): Gesture[] {
    const out: Gesture[] = [];
    for (const id of [...this.tracks.keys()]) out.push(...this.cancel(id));
    return out;
  }
}
