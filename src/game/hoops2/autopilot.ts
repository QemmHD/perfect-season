// A player for arcade basketball: plays the AI's possessions, sims a side, tunes the game and drives
// the tests. It reads the floor the way a person would: shoot when open with a shooter, drive an
// open lane with a finisher, kick to the open man, lob to a dunker on the cut, cross up a tight
// defender, move it out of a double team, and sprint (the stick at its edge) only on a drive. `skill` (0-1) is how sharp its
// reads and its release timing are.
import { hashString, rng } from '../../engine/rng';
import { crossover, dist, pass, pressShoot, releaseShoot, RIM, shotValue, step } from './engine';
import { afterPossession, type HoopsGame, startPossession } from './game';
import type { Body, Possession, Pt } from './types';

export interface Pilot {
  skill: number;
  rand: () => number;
  letGo: number | null;
  nextThink: number;
  /** where it's dribbling to */
  goal: Pt | null;
  /** a drive under way */
  driving: boolean;
  /** crossovers this possession */
  crosses: number;
  /** a double team it's seen: on whom, by whom, and when it gets the ball out */
  trap: { p: Possession; handler: number; trapper: number; at: number } | null;
}

export function pilot(skill: number, seed: string): Pilot {
  return { skill, rand: rng(hashString('p2:' + seed)), letGo: null, nextThink: 0, goal: null, driving: false, crosses: 0, trap: null };
}

const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

/** Its release timing's spread (seconds): a Legend's about as tight as a good person's thumb, a
 * Rookie's loose. */
function releaseSd(pl: Pilot): number {
  return 0.15 - 0.11 * pl.skill;
}

/** Is there a lane to the rim: no defender in a cone between him and it. */
function laneOpen(p: Possession, b: Body): boolean {
  const d = dist(b, RIM);
  const ux = (RIM.cx - b.cx) / d;
  const uz = (RIM.cz - b.cz) / d;
  for (const o of p.bodies) {
    if (o.side !== 'D' || p.t < o.stunUntil) continue;
    const dx = o.cx - b.cx;
    const dz = o.cz - b.cz;
    const along = dx * ux + dz * uz;
    if (along < 0 || along > d) continue;
    const across = Math.abs(dx * uz - dz * ux);
    if (across < 2.2 + along * 0.12) return false;
  }
  return true;
}

/** One step of decisions: returns the stick (a court direction) for the handler. */
export function decide(p: Possession, pl: Pilot): Pt | null {
  if (p.end || p.handler === null) {
    pl.letGo = null;
    pl.driving = false;
    return null;
  }
  const h = p.bodies[p.handler];
  // the shot meter: let go near the top, sharper with skill
  if (p.meter && p.meter.off === undefined) {
    pl.letGo ??= p.meter.top + gauss(pl.rand) * releaseSd(pl);
    if (p.t - p.meter.t0 >= pl.letGo) {
      releaseShoot(p);
      pl.letGo = null;
    }
    return null;
  }
  if (p.finish || p.ball) return null;
  const toRim = { cx: RIM.cx - h.cx, cz: RIM.cz - h.cz };
  const d = Math.hypot(toRim.cx, toRim.cz);
  const dir = { cx: toRim.cx / d, cz: toRim.cz / d };
  if (pl.driving) {
    if (d < 9 + pl.rand() * 2) {
      pressShoot(p);
      pl.driving = false;
      return null;
    }
    if (!laneOpen(p, h) && d > 12 && pl.rand() < 0.5) pl.driving = false;
    return dir;
  }
  // doubled: get it out to the man the second defender left (a sharper player sooner)
  if (p.trapper !== null) {
    const tr = pl.trap;
    if (!tr || tr.p !== p || tr.handler !== h.idx || tr.trapper !== p.trapper) pl.trap = { p, handler: h.idx, trapper: p.trapper, at: p.t + 0.2 + (1 - pl.skill) * 0.7 + pl.rand() * 0.2 };
    const free = p.bodies[p.bodies[p.trapper].mark];
    if (pl.trap && p.t >= pl.trap.at && free && free !== h && free.side === 'O' && p.passes < 6) {
      pl.trap.at = Infinity;
      pass(p, free.idx);
      return null;
    }
  }
  if (p.t < pl.nextThink) return pl.goal ? towards(h, pl.goal) : null;
  pl.nextThink = p.t + 0.22 + (1 - pl.skill) * 0.25;
  const a = h.p;
  const sd = releaseSd(pl);
  // the shot clock's running out: put it up
  if (p.clock < 2.2) {
    if (d < 10) pl.driving = true;
    else pressShoot(p);
    return null;
  }
  // how picky: early in the clock only a good look, late anything decent
  const used = 14 - p.clock;
  // (a sharper player waits for a better look)
  const picky = 0.7 + 0.65 * pl.skill;
  const want = used < 2 ? picky + 0.15 : picky - Math.min(0.4, (used - 2) * 0.05) - pl.rand() * 0.08;
  const shot = shotValue(p, h, sd);
  // a drive: an open lane for a finisher is worth a lot; a guard lays it in
  const finisher = Math.max(a.lay, a.ddk);
  const man = p.bodies.find((o) => o.side === 'D' && o.mark === h.idx);
  const beaten = !!man && (p.t < man.stunUntil || (man.cx - h.cx) * (RIM.cx - h.cx) + (man.cz - h.cz) * (RIM.cz - h.cz) < 0);
  const drive = d > 32 ? 0 : laneOpen(p, h) || beaten ? 0.6 + (finisher - 50) / 50 : 0.25 + (finisher - 60) / 90;
  // the open man: what his shot would be worth, a lob to a dunker on the cut most of all
  let best: Body | null = null;
  let bestVal = 0;
  for (const m of p.bodies) {
    if (m.side !== 'O' || m === h) continue;
    const cutting = m.cutUntil > p.t;
    const mm = p.bodies.find((o) => o.side === 'D' && o.mark === m.idx);
    const behind = !!mm && dist(mm, RIM) > dist(m, RIM) + 1;
    // (the lob to a cutter takes a sharp eye: a Rookie mostly misses it)
    const sees = pl.rand() < 0.3 + 0.7 * pl.skill;
    const v = sees && cutting && behind && m.p.ddk >= 74 && dist(m, RIM) < 14 ? 1.05 + (m.p.ddk - 74) / 100 : shotValue(p, m, sd).value - 0.08;
    if (v > bestVal) {
      bestVal = v;
      best = m;
    }
  }
  const top = Math.max(shot.value, drive, bestVal);
  if (top >= want || used > 9) {
    if (top === shot.value) {
      pressShoot(p);
      return null;
    }
    if (top === drive) {
      pl.driving = true;
      return dir;
    }
    if (best && p.passes < 6) {
      pass(p, best.idx);
      return null;
    }
  }
  // a tight defender and a handle: cross him to make something
  if (man && dist(man, h) < 5 && a.hnd >= 62 && pl.crosses < 2 && pl.rand() < 0.25 + (a.hnd - 62) / 100) {
    pl.crosses++;
    crossover(p, pl.rand() < 0.5 ? -1 : 1);
    return null;
  }
  // otherwise probe: dribble toward a spot, a wing or the top
  if (!pl.goal || dist(h, pl.goal) < 3 || pl.rand() < 0.2) {
    const spots: Pt[] = [
      { cx: 22, cz: 0 },
      { cx: 27, cz: -14 },
      { cx: 27, cz: 14 },
      { cx: 33, cz: -10 },
      { cx: 33, cz: 10 },
    ];
    pl.goal = spots[Math.floor(pl.rand() * spots.length)];
  }
  return towards(h, pl.goal);
}

/** Toward a spot at a probing jog (short of a sprint: the stick isn't at its edge). */
function towards(h: Body, g: Pt): Pt {
  const dx = g.cx - h.cx;
  const dz = g.cz - h.cz;
  const l = Math.hypot(dx, dz) || 1;
  return l < 1 ? { cx: 0, cz: 0 } : { cx: (dx / l) * 0.8, cz: (dz / l) * 0.8 };
}

/** Play a whole game with the autopilot. */
export function autoplay(g: HoopsGame, skill: number, seed: string): HoopsGame {
  const pl = pilot(skill, seed);
  const dt = 1 / 60;
  while (!g.over) {
    const p = startPossession(g);
    pl.letGo = null;
    pl.driving = false;
    pl.goal = null;
    pl.nextThink = 0;
    pl.crosses = 0;
    for (let i = 0; i < 60 * 40 && !p.end; i++) {
      const s = decide(p, pl);
      step(p, dt, s);
      p.events.length = 0;
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: 'SHOT CLOCK', who: -1 };
    afterPossession(g, p);
  }
  return g;
}
