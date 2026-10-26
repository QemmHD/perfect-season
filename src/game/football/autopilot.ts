// A player for the arcade football game: reads who's open and throws to him, picks a lane and cuts
// for it. It plays the AI's drives in a head to head against the AI, it tunes the game (a good
// player should score about this much with this team against that defense), and it plays the
// automated tests. `skill` (0-1) is how quick and how sharp it is.
import { hashString, rng } from '../../engine/rng';
import { afterPlay, fgDistance, fgInRange, type Game, kick, startPlay } from './drive';
import { type Body, FIELD_W, juke, maxThrow, type Play, projectRoute, type Pt, snap, step, throwTo } from './play';

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export interface Pilot {
  skill: number;
  rand: () => number;
  /** when it will make up its mind on this play */
  readAt: number;
}

export function pilot(skill: number, seed: string): Pilot {
  return { skill, rand: rng(hashString('pilot:' + seed)), readAt: 0 };
}

export function chooseCall(g: Game, pl: Pilot): 'pass' | 'run' {
  const short = g.toGo <= 2;
  return pl.rand() < (short ? 0.55 : 0.28) ? 'run' : 'pass';
}

/** Go for it, or kick? */
export function chooseKick(g: Game): boolean {
  if (!fgInRange(g)) return false;
  return g.toGo > 1.5 || fgDistance(g) <= 30;
}

function gauss(r: () => number) {
  return (r() + r() + r() + r() - 2) * 1.732;
}

/** Where to throw to hit a receiver in stride, and how open he'll be when it gets there. */
function lead(p: Play, b: Body): { at: Pt; open: number } {
  const qb = p.qb;
  const speed = 17 + 8 * qb.a.arm;
  let at: Pt = { x: b.x, y: b.y };
  for (let i = 0; i < 3; i++) {
    const t = Math.max(0.42, dist(qb, at) / speed);
    at = projectRoute(b, t);
  }
  at.x = Math.max(1, Math.min(FIELD_W - 1, at.x));
  // how open he looks: his space from the nearest man in coverage, less if one sits in the lane
  let open = 99;
  for (const d of p.bodies) {
    if (d.side !== 'D' || d.job === 'rush') continue;
    open = Math.min(open, dist(d, b), dist(d, at) + 0.5);
  }
  return { at, open };
}

/** One step of decisions. Returns where the runner should steer, if anyone's running. */
export function decide(p: Play, _g: Game, pl: Pilot): number | null {
  if (p.phase === 'drop' && p.call === 'pass' && p.carrier === p.qb) {
    if (!pl.readAt) pl.readAt = 0.85 + (1 - pl.skill) * 0.6 + pl.rand() * 0.4;
    if (p.t < pl.readAt) return null;
    const options = p.bodies
      .filter((b) => b.side === 'O' && b !== p.qb && b.a.role !== 'OL')
      .map((b) => ({ b, ...lead(p, b) }))
      .filter((o) => dist(p.qb, o.at) <= maxThrow(p) && o.at.y > p.los - 3);
    // the best open man: open enough, then the most yards
    const need = 3.1 - pl.skill * 1.1;
    const open = options.filter((o) => o.open >= need).sort((a, b) => b.at.y - a.at.y + (b.open - a.open) * 2);
    const pressure = p.t > p.sackAt - 0.15;
    const choice = open[0] ?? (pressure ? options.sort((a, b) => b.open - a.open)[0] : undefined);
    if (choice) {
      const noise = (1 - pl.skill) * 1.6;
      throwTo(p, { x: choice.at.x + gauss(pl.rand) * noise, y: choice.at.y + gauss(pl.rand) * noise });
      pl.readAt = 0;
    } else if (pressure) {
      // nobody's open and he's about to be hit: throw it away
      throwTo(p, { x: p.qb.x < FIELD_W / 2 ? -3 : FIELD_W + 3, y: p.los + 6 });
      pl.readAt = 0;
    }
    return null;
  }
  if (p.phase === 'run' && p.carrier) {
    const c = p.carrier;
    // look ahead: the lane with the most room
    const ahead = p.bodies.filter((b) => b.side === 'D' && b.y > c.y - 1 && p.t >= b.stunUntil && dist(b, c) < 9);
    let best = c.x;
    let bestRoom = -1;
    for (let dx = -6; dx <= 6; dx += 1) {
      const x = Math.max(2, Math.min(FIELD_W - 2, c.x + dx));
      const spot = { x, y: c.y + 5 };
      const room = Math.min(20, ...ahead.map((d) => dist(d, spot))) - Math.abs(dx) * 0.35;
      if (room > bestRoom) {
        bestRoom = room;
        best = x;
      }
    }
    const close = ahead.find((d) => dist(d, c) < 1.9 && d.y > c.y);
    if (close && pl.rand() < 0.08 + pl.skill * 0.12) juke(p, Math.sign(best - c.x) || 1);
    return best;
  }
  return null;
}

/** Play a whole game headless; returns the final score and how each drive ended. */
export function autoplay(g: Game, skill: number, seed: string) {
  const pl = pilot(skill, seed);
  const dt = 1 / 60;
  let plays = 0;
  while (!g.over && plays < 200) {
    if (g.down === 4 && chooseKick(g)) {
      const aim = Math.abs(gauss(pl.rand)) * (0.36 - 0.24 * skill);
      kick(g, aim);
      continue;
    }
    const p = startPlay(g, chooseCall(g, pl));
    snap(p);
    pl.readAt = 0;
    for (let i = 0; i < 60 * 25 && !p.end; i++) {
      const steer = decide(p, g, pl);
      step(p, dt, steer);
      p.events.length = 0;
    }
    afterPlay(g, p.end!);
    plays++;
  }
  return { score: g.score, ends: g.ends.slice(), plays };
}
