// The floating stick, shared by every sport (plan §4.2, V2 A.5). Pure: no DOM, no timers, so every
// rule is unit-tested (stick.test.ts). Stick.tsx feeds it pointer events and reads `stickOut`.
//
// The left thumb lands anywhere in the zone (the lower-left of the screen) and the ring is born under
// it. Pushing it moves the player: nothing inside the 12% dead zone, then a linear rescale to 1 at the
// ring's edge. Past 1.15 x the ring's radius he sprints (one tick haptic on the way in), and past
// 1.6 x the ring follows the thumb, so it never runs out of travel. The output is never null: a
// centred stick is { x: 0, y: 0, mag: 0 } (football's "never turn centred human input into null").
// `floating: false` is a permanent stick fixed at the ghost ring (nfl's preference).

export interface StickGeom {
  /** where a touch may start the stick (client px) */
  zone: { x: number; y: number; w: number; h: number };
  /** the ring's radius (px) */
  ringR: number;
  /** the ghost ring's centre at rest (client px) */
  ghost: { x: number; y: number };
  /** share of the radius that counts as centred (0.12) */
  deadZone: number;
  /** px from the origin where sprint turns on (1.15 x ringR); 0 = no sprint ring (a Burst button instead) */
  sprintAt: number;
  /** px from the origin past which the ring follows the thumb (1.6 x ringR) */
  followAt: number;
  /** false: a permanent stick at the ghost ring */
  floating: boolean;
  /** px above the zone's bottom edge where a touch never starts the stick (the home-bar swipe) */
  homeBand: number;
}

export interface StickPointer {
  id: number;
  x: number;
  y: number;
  /** PointerEvent.timeStamp */
  t: number;
}

export interface StickState {
  id: number | null;
  origin: { x: number; y: number };
  pos: { x: number; y: number };
  /** when the pointer went down (its timeStamp), or null at rest */
  since: number | null;
}

export interface StickOut {
  /** screen direction (x right, y down), scaled by mag */
  x: number;
  y: number;
  /** 0..1 after the dead-zone rescale */
  mag: number;
  sprint: boolean;
  /** a thumb is on the stick */
  active: boolean;
}

export const DEAD_ZONE = 0.12;
export const SPRINT_RING = 1.15;
export const FOLLOW_RING = 1.6;

/** The geometry from the ring's size and the zone (the defaults every sport uses). */
export function stickGeom(zone: StickGeom['zone'], ghost: StickGeom['ghost'], ringR: number, opts: { floating?: boolean; sprint?: boolean; homeBand?: number } = {}): StickGeom {
  return {
    zone,
    ringR,
    ghost,
    deadZone: DEAD_ZONE,
    sprintAt: opts.sprint === false ? 0 : SPRINT_RING * ringR,
    followAt: FOLLOW_RING * ringR,
    floating: opts.floating ?? true,
    homeBand: opts.homeBand ?? 8
  };
}

export const stickIdle = (g: StickGeom): StickState => ({ id: null, origin: { ...g.ghost }, pos: { ...g.ghost }, since: null });

const inZone = (g: StickGeom, x: number, y: number) => x >= g.zone.x && x <= g.zone.x + g.zone.w && y >= g.zone.y && y <= g.zone.y + g.zone.h - g.homeBand;

/** A pointer goes down: it takes the stick if it's free and the touch is in the zone (out of the home band). */
export function stickDown(s: StickState, p: StickPointer, g: StickGeom): StickState {
  if (s.id !== null) return s;
  if (g.floating) {
    if (!inZone(g, p.x, p.y)) return s;
    return { id: p.id, origin: { x: p.x, y: p.y }, pos: { x: p.x, y: p.y }, since: p.t };
  }
  // a permanent stick: a touch on the ring (or anywhere in the zone) pushes from the fixed centre
  if (!inZone(g, p.x, p.y) && Math.hypot(p.x - g.ghost.x, p.y - g.ghost.y) > g.followAt) return s;
  return { id: p.id, origin: { ...g.ghost }, pos: { x: p.x, y: p.y }, since: p.t };
}

/** The thumb moves: past followAt the ring is dragged along behind it (kept on screen). */
export function stickMove(s: StickState, p: StickPointer, g: StickGeom): StickState {
  if (s.id === null || p.id !== s.id) return s;
  const pos = { x: p.x, y: p.y };
  let origin = s.origin;
  if (g.floating) {
    const dx = pos.x - origin.x;
    const dy = pos.y - origin.y;
    const d = Math.hypot(dx, dy);
    if (d > g.followAt) {
      const k = (d - g.followAt) / d;
      origin = { x: origin.x + dx * k, y: origin.y + dy * k };
    }
    // the ring stays on screen: its centre never leaves the zone's box (widened to the right by a radius)
    origin = {
      x: Math.min(Math.max(origin.x, g.zone.x), g.zone.x + g.zone.w + g.ringR),
      y: Math.min(Math.max(origin.y, g.zone.y), g.zone.y + g.zone.h)
    };
  }
  return { ...s, origin, pos };
}

/** The thumb lifts (or the system cancels it): back to the ghost ring. */
export function stickUp(s: StickState, p: StickPointer, g: StickGeom): StickState {
  if (s.id === null || p.id !== s.id) return s;
  return stickIdle(g);
}

/** What the stick says right now. Never null. */
export function stickOut(s: StickState, g: StickGeom): StickOut {
  if (s.id === null) return { x: 0, y: 0, mag: 0, sprint: false, active: false };
  const dx = s.pos.x - s.origin.x;
  const dy = s.pos.y - s.origin.y;
  const d = Math.hypot(dx, dy);
  const r = d / g.ringR;
  if (r <= g.deadZone || d === 0) return { x: 0, y: 0, mag: 0, sprint: false, active: true };
  const mag = Math.min(1, (r - g.deadZone) / (1 - g.deadZone));
  return { x: (dx / d) * mag, y: (dy / d) * mag, mag, sprint: g.sprintAt > 0 && d >= g.sprintAt, active: true };
}

/** True once, as sprint turns on (the haptic tick). */
export function sprintEdge(prev: StickOut, next: StickOut): boolean {
  return !prev.sprint && next.sprint;
}

/**
 * The geometry from the page (DOM helper, never called by the pure functions above): `el` is the
 * stick's root, holding the zone (`[data-stick-zone]`) and the ghost ring (`[data-stick-ghost]`),
 * both sized by the §4.1 tokens.
 */
export function geomFrom(el: Element, opts: { floating?: boolean; sprint?: boolean } = {}): StickGeom {
  const zoneEl = el.matches('[data-stick-zone]') ? el : (el.querySelector('[data-stick-zone]') ?? el);
  const ghostEl = el.querySelector('[data-stick-ghost]');
  const z = zoneEl.getBoundingClientRect();
  const gr = ghostEl ? ghostEl.getBoundingClientRect() : { left: z.left + 24, top: z.bottom - 148, width: 120, height: 120 };
  const ringR = gr.width / 2;
  return stickGeom({ x: z.left, y: z.top, w: z.width, h: z.height }, { x: gr.left + ringR, y: gr.top + gr.height / 2 }, ringR, opts);
}
