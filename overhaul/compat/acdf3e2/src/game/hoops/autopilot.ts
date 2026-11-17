// A player for arcade basketball: attacks a lane when there is one, kicks it to the open man, takes
// the open shot it's good at and lets it go near the top of the jump. It plays the AI's possessions
// in a head to head against the AI, tunes the game, and plays the automated tests.
import { hashString, rng } from '../../engine/rng';
import { afterPoss, type HoopGame, startPoss } from './game';
import { APEX, dist, isThree, openness, passTarget, passTo, type Poss, type Pt, release, rise, RIM, step } from './play';

export interface HoopPilot {
  skill: number;
  rand: () => number;
  /** when to let the jump shot go */
  letGo: number | null;
  /** don't decide every frame */
  nextLook: number;
}

export function hoopPilot(skill: number, seed: string): HoopPilot {
  return { skill, rand: rng(hashString('hpilot:' + seed)), letGo: null, nextLook: 0 };
}

const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

/** One step of decisions: returns the stick. */
export function hoopDecide(p: Poss, pl: HoopPilot): Pt | null {
  const h = p.handler;
  if (!h || p.end) return null;
  if (p.jumpAt !== null) {
    pl.letGo ??= APEX + gauss(pl.rand) * (0.11 - 0.08 * pl.skill);
    if (p.t - p.jumpAt >= pl.letGo) {
      release(p);
      pl.letGo = null;
    }
    return null;
  }
  const toRim = { x: RIM.x - h.x, y: RIM.y - h.y };
  const d = Math.hypot(toRim.x, toRim.y);
  const room = openness(p, h);
  if (p.t < pl.nextLook) return { x: toRim.x / d, y: toRim.y / d };
  pl.nextLook = p.t + 0.25;
  const a = h.a;
  // at the rim: finish
  if (d < 7) {
    rise(p);
    return null;
  }
  const three = isThree(h);
  const good = three ? a.three > 0.4 : d > 15 ? a.mid > 0.4 : true;
  const clockUp = p.clock < 2.5;
  if (clockUp || (room > 5.2 - pl.skill && good && (three || d < 20)) || (room > 8 && d < 23)) {
    rise(p);
    return null;
  }
  // an open man who can hit from there: kick it (more often the sharper it plays, and after a
  // couple of seconds of looking)
  const mate = passTarget(p, null);
  if (mate && p.t > 1 && pl.rand() < 0.35 + 0.45 * pl.skill) {
    const o = openness(p, mate);
    const md = dist(mate, RIM);
    const fits = md < 8 ? o > 3.5 : isThree(mate) ? mate.a.three > 0.35 && o > 5 : mate.a.mid > 0.4 && o > 5.5;
    if (fits) {
      passTo(p, mate);
      return null;
    }
  }
  // a lane to the rim: take it; else probe sideways
  const lane = p.bodies.filter((b) => b.side === 'D' && dist(b, { x: h.x + (toRim.x / d) * 4, y: h.y + (toRim.y / d) * 4 }) < 3).length === 0;
  if (lane || pl.rand() < 0.5) return { x: toRim.x / d, y: toRim.y / d };
  const side = h.x > 0 ? -1 : 1;
  return { x: side * 0.9, y: 0.2 };
}

/** Play a whole game headless; returns the final score and how each possession went. */
export function hoopsAutoplay(g: HoopGame, skill: number, seed: string) {
  const pl = hoopPilot(skill, seed);
  const dt = 1 / 60;
  while (!g.over) {
    const p = startPoss(g);
    pl.letGo = null;
    pl.nextLook = 0;
    for (let i = 0; i < 60 * 30 && !p.end; i++) {
      const s = hoopDecide(p, pl);
      step(p, dt, s);
      p.events.length = 0;
    }
    afterPoss(g, p.end ?? { kind: 'clock', points: 0, text: '' });
  }
  return { score: g.score, marks: g.marks.slice() };
}
