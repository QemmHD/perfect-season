// A player for arcade football: plays the AI's drives, sims a side, tunes the game and drives the
// tests. It reads who's open and throws him the ball in stride, picks the lane with room on a run,
// uses the runner's best move against a tackler, kicks in range and punts when it must.
import { hashString, rng } from '../../engine/rng';
import { dist, FIELD_W, flightTime, isLine, maxThrow, moveWithBall, projectRoute, snap, step, throwTo } from './engine';
import { afterPlay, fgDistance, fgInRange, type Game, kick, kickWindow, punt, startPlay } from './drive';
import type { Body, Play, Pt } from './types';

export interface Pilot {
  skill: number;
  rand: () => number;
  readAt: number;
}

export function pilot(skill: number, seed: string): Pilot {
  return { skill, rand: rng(hashString('fpilot:' + seed)), readAt: 0 };
}

const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

export function chooseCall(g: Game, pl: Pilot): 'pass' | 'run' {
  const short = g.toGo <= 2;
  return pl.rand() < (short ? 0.55 : 0.3) ? 'run' : 'pass';
}

/** Fourth down: 'kick' in range, 'go' when it's short or there's no choice, else 'punt'. */
export function fourthDown(g: Game): 'kick' | 'go' | 'punt' {
  if (fgInRange(g) && (g.toGo > 1.5 || fgDistance(g) <= 30)) return 'kick';
  if (g.toGo <= 2 || g.ballOn >= 60) return 'go';
  // the last drive with nothing to lose: go for it
  if (g.drive === g.drives - 1) return 'go';
  return 'punt';
}

/** Where to throw to hit a receiver in stride, and how open he'll be when it gets there. */
function lead(p: Play, b: Body): { at: Pt; open: number } {
  const qb = p.qb;
  let at: Pt = { x: b.x, y: b.y };
  for (let i = 0; i < 3; i++) at = projectRoute(b, flightTime(p, dist(qb, at)));
  at.x = Math.max(1, Math.min(FIELD_W - 1, at.x));
  // the back of the end zone is the end of the field
  at.y = Math.min(at.y, 109);
  let open = 99;
  for (const d of p.bodies) {
    if (d.side !== 'D' || d.job === 'rush') continue;
    open = Math.min(open, dist(d, b), dist(d, at) + 0.5);
  }
  return { at, open };
}

/** One step of decisions. Returns where the runner steers, if anyone's running. */
export function decide(p: Play, _g: Game, pl: Pilot): number | null {
  if (p.phase === 'drop' && p.call === 'pass' && p.carrier === p.qb) {
    if (!pl.readAt) pl.readAt = 0.85 + (1 - pl.skill) * 0.6 + pl.rand() * 0.4;
    if (p.t < pl.readAt) return null;
    const options = p.bodies
      .filter((b) => b.side === 'O' && b !== p.qb && !isLine(b))
      .map((b) => ({ b, ...lead(p, b) }))
      .filter((o) => dist(p.qb, o.at) <= maxThrow(p) && o.at.y > p.los - 3);
    const need = 3.1 - pl.skill * 1.1;
    const open = options.filter((o) => o.open >= need).sort((a, b) => b.at.y - a.at.y + (b.open - a.open) * 2);
    const hurried = p.pressure > 0.55;
    const choice = open[0] ?? (hurried ? options.sort((a, b) => b.open - a.open)[0] : undefined);
    if (choice) {
      const noise = (1 - pl.skill) * 1.6;
      throwTo(p, { x: choice.at.x + gauss(pl.rand) * noise, y: choice.at.y + gauss(pl.rand) * noise });
      pl.readAt = 0;
    } else if (hurried && p.pressure > 0.85) {
      // nobody's open and he's about to be hit: throw it away
      throwTo(p, { x: p.qb.x < FIELD_W / 2 ? -3 : FIELD_W + 3, y: p.los + 6 });
      pl.readAt = 0;
    }
    return null;
  }
  if (p.phase === 'run' && p.carrier) {
    const c = p.carrier;
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
    if (close && pl.rand() < 0.08 + pl.skill * 0.12) {
      // his best move
      const a = c.p.a;
      const moves: ['juke' | 'spin' | 'stiff' | 'truck', number][] = [
        ['juke', a.JKM ?? 50],
        ['spin', a.SPM ?? 45],
        ['stiff', a.SFA ?? 45],
        ['truck', a.TRK ?? 45],
      ];
      moves.sort((x, y) => y[1] - x[1]);
      moveWithBall(p, moves[0][0], Math.sign(best - c.x) || 1);
    }
    return best;
  }
  return null;
}

/** Play a whole game headless. */
export function autoplay(g: Game, skill: number, seed: string) {
  const pl = pilot(skill, seed);
  const dt = 1 / 60;
  let plays = 0;
  while (!g.over && plays < 220) {
    if (g.down === 4) {
      const d = fourthDown(g);
      if (d === 'kick') {
        const aim = Math.abs(gauss(pl.rand)) * (0.36 - 0.24 * skill);
        kick(g, aim);
        continue;
      }
      if (d === 'punt') {
        punt(g);
        continue;
      }
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
  void kickWindow;
  return { score: g.score, ends: g.ends.slice(), plays };
}
