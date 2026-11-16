// merge: replace with nba's src/game/stick.ts, then delete this file.
//
// The floating stick, pure (Claude 2026-11-16, studio overhaul soccer-2; the interface is nba's,
// plan §5.0.2 and V2 A.5). No DOM and no timers, so every rule is unit-tested (controls.test.ts);
// `Stick` in ./hud.tsx feeds it pointer events.
//
// The left thumb lands anywhere in the zone and the ring is born under it. Pushing moves the player:
// nothing inside the 12% dead zone, then a linear rescale to 1 at the ring's edge. Past 1.15x the
// ring's radius he sprints, and he keeps sprinting until the thumb comes back under 1.0x (the
// hysteresis, so a thumb resting on the line does not flicker). Past 1.6x the ring follows the thumb,
// so it never runs out of travel, and it is kept on screen. The output is never null: a centred
// stick is { x: 0, y: 0, mag: 0 } (release-to-stop).

export interface StickGeom {
  /** where a touch may start the stick (client px) */
  zone: { x: number; y: number; w: number; h: number };
  /** the ring's radius (px) */
  ringR: number;
  /** the ghost ring's centre at rest (client px) */
  ghost: { x: number; y: number };
  /** share of the radius that counts as centred */
  deadZone: number;
  /** px from the origin where sprint turns on (1.15 x ringR); 0: no sprint ring */
  sprintAt: number;
  /** px from the origin under which a sprint turns off again (1.0 x ringR) */
  sprintOff: number;
  /** px from the origin past which the ring follows the thumb (1.6 x ringR) */
  followAt: number;
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
export const SPRINT_OFF = 1.0;
export const FOLLOW_RING = 1.6;
export const STICK_IDLE: StickOut = { x: 0, y: 0, mag: 0, sprint: false, active: false };

/** The geometry from the ring's size and the zone (the defaults every sport uses). */
export function stickGeom(zone: StickGeom['zone'], ghost: StickGeom['ghost'], ringR: number, opts: { sprint?: boolean; homeBand?: number } = {}): StickGeom {
  const sprint = opts.sprint !== false;
  return { zone, ringR, ghost, deadZone: DEAD_ZONE, sprintAt: sprint ? SPRINT_RING * ringR : 0, sprintOff: sprint ? SPRINT_OFF * ringR : 0, followAt: FOLLOW_RING * ringR, homeBand: opts.homeBand ?? 8 };
}

export const stickIdle = (g: StickGeom): StickState => ({ id: null, origin: { ...g.ghost }, pos: { ...g.ghost }, since: null });

/** Is a point where a thumb may start the stick (in the zone, above the home band)? */
export const inStickZone = (g: StickGeom, x: number, y: number) => x >= g.zone.x && x <= g.zone.x + g.zone.w && y >= g.zone.y && y <= g.zone.y + g.zone.h - g.homeBand;

/** A pointer goes down: it takes the stick if the stick is free and the touch is in the zone. */
export function stickDown(s: StickState, p: StickPointer, g: StickGeom): StickState {
  if (s.id !== null || !inStickZone(g, p.x, p.y)) return s;
  return { id: p.id, origin: { x: p.x, y: p.y }, pos: { x: p.x, y: p.y }, since: p.t };
}

/** The thumb moves: past followAt the ring is dragged along behind it, and kept on screen. */
export function stickMove(s: StickState, p: StickPointer, g: StickGeom): StickState {
  if (s.id === null || p.id !== s.id) return s;
  const pos = { x: p.x, y: p.y };
  let origin = s.origin;
  const dx = pos.x - origin.x;
  const dy = pos.y - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > g.followAt) {
    // dragged along, and kept where the whole ring can be seen
    const k = (d - g.followAt) / d;
    origin = {
      x: Math.min(Math.max(origin.x + dx * k, g.zone.x + g.ringR), g.zone.x + g.zone.w + g.ringR),
      y: Math.min(Math.max(origin.y + dy * k, g.zone.y), g.zone.y + g.zone.h - g.ringR * 0.5),
    };
  }
  return { ...s, origin, pos };
}

/** The thumb lifts (or the system cancels it): back to the ghost ring. */
export function stickUp(s: StickState, p: StickPointer, g: StickGeom): StickState {
  if (s.id === null || p.id !== s.id) return s;
  return stickIdle(g);
}

/** What the stick says now; `prev` (the last output) carries the sprint hysteresis. Never null. */
export function stickOut(s: StickState, g: StickGeom, prev?: StickOut): StickOut {
  if (s.id === null) return STICK_IDLE;
  const dx = s.pos.x - s.origin.x;
  const dy = s.pos.y - s.origin.y;
  const d = Math.hypot(dx, dy);
  const r = d / g.ringR;
  if (r <= g.deadZone || d === 0) return { x: 0, y: 0, mag: 0, sprint: false, active: true };
  const mag = Math.min(1, (r - g.deadZone) / (1 - g.deadZone));
  const sprint = g.sprintAt > 0 && (d >= g.sprintAt || (!!prev?.sprint && d >= g.sprintOff));
  return { x: (dx / d) * mag, y: (dy / d) * mag, mag, sprint, active: true };
}

/** True once, as sprint turns on (the haptic tick). */
export const sprintEdge = (prev: StickOut, next: StickOut) => !prev.sprint && next.sprint;
