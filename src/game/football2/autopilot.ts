// A player for arcade football: plays the AI's drives, sims a side, tunes the game and drives the
// tests. It reads who's open and throws him the ball in stride, picks the lane with room on a run,
// uses the runner's best move against a tackler, kicks in range and punts when it must.
import { hashString, rng } from '../../engine/rng';
import { dist, FIELD_W, flightTime, isLine, maxThrow, moveWithBall, projectRoute, sight, snap, step, throwTo, windupOf } from './engine';
import { afterPlay, fgDistance, fgInRange, type Game, kick, kickWindow, punt, startPlay } from './drive';
import type { Body, Move, Play, Pt } from './types';

export interface Pilot {
  skill: number;
  rand: () => number;
  readAt: number;
  /** the play he's on, how much pressure he feels before he hurries it, and when he felt it */
  play: Play | null;
  feel: number;
  felt: number;
  /** with the ball: the tacklers he's sized up already, and the move he's timed against one's dive */
  seen: Set<number>;
  plan: { at: number; kind: Move; dir: number } | null;
}

export function pilot(skill: number, seed: string): Pilot {
  return { skill, rand: rng(hashString('fpilot:' + seed)), readAt: 0, play: null, feel: 1, felt: Infinity, seen: new Set(), plan: null };
}

const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

export function chooseCall(g: Game, pl: Pilot): 'pass' | 'run' {
  const short = g.toGo <= 2;
  return pl.rand() < (short ? 0.55 : 0.3) ? 'run' : 'pass';
}

/** Fourth down: 'kick' in range, 'go' when it's short or there's no choice, else 'punt'. */
export function fourthDown(g: Game): 'kick' | 'go' | 'punt' {
  // the clock ran out in range: the last kick
  if (g.clock === 0) return 'kick';
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
export function decide(p: Play, g: Game, pl: Pilot): number | null {
  if (pl.play !== p) {
    // a new play: a calm passer feels the rush sooner
    pl.play = p;
    pl.feel = 0.45 + pl.rand() * 0.3 + (1 - pl.skill) * 0.3;
    pl.felt = Infinity;
    pl.seen.clear();
    pl.plan = null;
  }
  if (p.phase === 'drop' && p.call === 'pass' && p.carrier === p.qb) {
    if (p.pressure > pl.feel && pl.felt === Infinity) pl.felt = p.t;
    if (!pl.readAt) pl.readAt = 0.85 + (1 - pl.skill) * 0.6 + pl.rand() * 0.4;
    if (p.t < pl.readAt) return null;
    const options = p.bodies
      .filter((b) => b.side === 'O' && b !== p.qb && !isLine(b))
      .map((b) => ({ b, ...lead(p, b) }))
      .filter((o) => dist(p.qb, o.at) <= maxThrow(p) && o.at.y > p.los - 3);
    const need = 2.9 - pl.skill * 0.5;
    // deep and open is best, less so where he can't see the end of the arc
    const worth = (o: { at: Pt; open: number }) => {
      const len = dist(p.qb, o.at);
      return o.at.y + o.open * 2 - (1 - sight(p, len)) * len * 0.6;
    };
    // his progression: first he looks for the sticks or a shot down the field, and the longer he
    // holds it the shorter he'll take (a better passer is more patient)
    const patience = 2.2 + 0.5 * pl.skill;
    const k = Math.max(0, Math.min(1, (p.t - pl.readAt) / Math.max(0.3, patience - pl.readAt)));
    const want = (1 - k) * Math.max(g.toGo + 1, 8);
    // a deep ball wants more room (the lob hangs, and the defense breaks on it)
    const room = (o: { at: Pt }) => need + Math.max(0, dist(p.qb, o.at) - 20) * 0.03;
    const open = options.filter((o) => o.open >= room(o) && o.at.y - p.los >= want).sort((a, b) => worth(b) - worth(a));
    // he gets rid of it a beat after he feels the rush (if he's still standing)
    const hurried = p.t - pl.felt >= 0.3 - 0.2 * pl.skill;
    const bail = hurried ? options.sort((a, b) => b.open - a.open)[0] : undefined;
    let choice = open[0] ?? (bail && bail.open >= 1.4 ? bail : undefined);
    // a green passer sometimes locks onto the wrong man
    if (choice && pl.rand() < (1 - pl.skill) * 0.35) choice = options[Math.floor(pl.rand() * options.length)];
    if (choice) {
      // a little off by his skill, and a guess along the line where he can't see the arc land
      const len = Math.max(1, dist(p.qb, choice.at));
      const hidden = (1 - sight(p, len)) * len;
      const along = gauss(pl.rand) * ((1 - pl.skill) * 2.6 + hidden * (0.2 - 0.12 * pl.skill));
      const across = gauss(pl.rand) * ((1 - pl.skill) * 1.8 + hidden * 0.03);
      const ux = (choice.at.x - p.qb.x) / len;
      const uy = (choice.at.y - p.qb.y) / len;
      throwTo(p, { x: choice.at.x + ux * along - uy * across, y: choice.at.y + uy * along + ux * across });
      pl.readAt = 0;
    } else if (hurried) {
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
    // a tackler winding up to dive: once, he sizes him up and times a move against the dive (a
    // juke or a spin as he leaves his feet; a stiff arm or a truck for the man who's better at those,
    // at contact). A sharper pilot is closer to the moment.
    const w = ahead.find((d) => d.windAt < Infinity && !pl.seen.has(d.id));
    if (w) {
      pl.seen.add(w.id);
      if (pl.rand() < 0.3 + 0.5 * pl.skill) {
        const a = c.p.a;
        const moves: [Move, number][] = [
          ['juke', (a.JKM ?? 50) + 6],
          ['spin', a.SPM ?? 45],
          ['stiff', a.SFA ?? 45],
          ['truck', a.TRK ?? 45],
        ];
        moves.sort((x, y) => y[1] - x[1]);
        const kind = moves[0][0];
        const due = w.windAt + windupOf(w) + (kind === 'stiff' || kind === 'truck' ? 0.15 : -0.08);
        pl.plan = { at: due + gauss(pl.rand) * (0.26 - 0.2 * pl.skill), kind, dir: Math.sign(c.x - w.x) || Math.sign(best - c.x) || 1 };
      }
    }
    if (pl.plan && p.t >= pl.plan.at) {
      moveWithBall(p, pl.plan.kind, pl.plan.dir);
      pl.plan = null;
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
