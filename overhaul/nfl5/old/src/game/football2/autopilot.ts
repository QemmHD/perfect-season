// A player for arcade football: plays the AI's drives, sims a side, tunes the game and drives the
// tests. It reads who's open and throws him the ball in stride, picks the lane with room on a run,
// uses the runner's best move against a tackler, kicks in range and punts when it must.
import { hashString, rng } from '../../engine/rng';
import { BOX_HALF, DROP_TIME, dist, FIELD_W, flightTime, isLine, maxThrow, moveEdge, moveReady, moveWithBall, outsideBox, projectRoute, rt, separation, sight, snap, step, throwAway, throwTo, windupOf } from './engine';
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
  /** how the runner misjudges each lane right now (yards, by his ball-carrier vision), and when it's re-read */
  laneNoise: number[];
  laneAt: number;
  /** nfl-2: a person in the pocket, who can only throw it away outside the tackle box (the human
   * proxy with `pocket`); the AI keeps its old sideline throw, so its drives are unchanged */
  legalOnly?: boolean;
  /**
   * nfl-4, the calibration kit's human proxy only (the AI never sets these, so its drives are
   * unchanged): `throwAt` takes the pass he's chosen (the man, where a throw now would meet him, and
   * the spot he'd aim at) and slings it on the ring in its own time; `ringSigma` (s) is how far his
   * JUKE or SPIN lands from a tackler's commit, a person's timing spread, judged at that instant
   * rather than at the next step.
   */
  throwAt?: (p: Play, b: Body, lead: Pt, spot: Pt) => boolean;
  ringSigma?: number;
  /** how often he goes for a gold JUKE/SPIN ring he's shown (0-1); unset, the AI's old reaction */
  ringTry?: number;
}

export function pilot(skill: number, seed: string): Pilot {
  return { skill, rand: rng(hashString('fpilot:' + seed)), readAt: 0, play: null, feel: 1, felt: Infinity, seen: new Set(), plan: null, laneNoise: [], laneAt: -1 };
}

const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

export function chooseCall(g: Game, pl: Pilot): 'pass' | 'run' {
  const short = g.toGo <= 2;
  return pl.rand() < (short ? 0.55 : 0.3) ? 'run' : 'pass';
}

/**
 * Fourth down: 'kick' in range, otherwise 'go'. In this format a punt is worth nothing: the drive
 * ends with no points either way and the other side's drives start from their own kickoff, so a
 * turnover on downs costs exactly what a punt does (Claude 2026-11-01; the AI used to punt from its
 * own half on fourth and long, which threw away the weaker side's last chance on ~40% of drives).
 * ('punt' stays in the type for the player's button.)
 */
export function fourthDown(g: Game): 'kick' | 'go' | 'punt' {
  // the clock ran out in range: the last kick
  if (g.clock === 0) return 'kick';
  if (fgInRange(g) && (g.toGo > 1.5 || fgDistance(g) <= 30)) return 'kick';
  return 'go';
}

/** Where to throw to hit a receiver in stride, and how open he'll be when it gets there. */
function lead(p: Play, b: Body): { at: Pt; open: number } {
  const qb = p.qb;
  let at: Pt = { x: b.x, y: b.y };
  for (let i = 0; i < 3; i++) at = projectRoute(b, flightTime(p, dist(qb, at)));
  at.x = Math.max(1, Math.min(FIELD_W - 1, at.x));
  // the back of the end zone is the end of the field
  at.y = Math.min(at.y, 109);
  // (how open he is: the same value as the halo on his chip, engine.ts separation)
  return { at, open: separation(p, b, at) };
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
    pl.laneAt = -1;
  }
  if (p.phase === 'drop' && p.call === 'pass' && p.carrier === p.qb) {
    if (p.pressure > pl.feel && pl.felt === Infinity) pl.felt = p.t;
    // an aware quarterback reads it sooner (up to 0.3 s)
    if (!pl.readAt) pl.readAt = Math.max(0.5, 0.85 + (1 - pl.skill) * 0.6 + pl.rand() * 0.4 - 0.3 * rt(p.qb.p.a.AWR, 45, 99));
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
    // a person outside the tackle box throws it away rather than force a tight one
    if (pl.legalOnly && hurried && !open[0] && outsideBox(p) && (!choice || choice.open < 2.2) && throwAway(p)) {
      pl.readAt = 0;
      return null;
    }
    // a green passer sometimes locks onto the wrong man
    if (choice && pl.rand() < (1 - pl.skill) * 0.35) choice = options[Math.floor(pl.rand() * options.length)];
    if (choice) {
      // a little off by his skill, and a guess along the line where he can't see the arc land
      const len = Math.max(1, dist(p.qb, choice.at));
      const hidden = (1 - sight(p, len)) * len;
      // (its own aim is a little off by skill; the passer's ratings throw the real error in throwTo)
      const along = gauss(pl.rand) * ((1 - pl.skill) * 1.6 + hidden * (0.2 - 0.12 * pl.skill));
      const across = gauss(pl.rand) * ((1 - pl.skill) * 1.0 + hidden * 0.03);
      const ux = (choice.at.x - p.qb.x) / len;
      const uy = (choice.at.y - p.qb.y) / len;
      const spot = { x: choice.at.x + ux * along - uy * across, y: choice.at.y + uy * along + ux * across };
      if (!pl.throwAt || !pl.throwAt(p, choice.b, choice.at, spot)) throwTo(p, spot);
      pl.readAt = 0;
    } else if (hurried) {
      // nobody's open and he's about to be hit: throw it away (a person only can from outside the
      // tackle box; inside it he keeps moving and looking)
      if (!pl.legalOnly) {
        throwTo(p, { x: p.qb.x < FIELD_W / 2 ? -3 : FIELD_W + 3, y: p.los + 6 });
        pl.readAt = 0;
      } else if (throwAway(p)) pl.readAt = 0;
    }
    return null;
  }
  if (p.phase === 'run' && p.carrier) {
    const c = p.carrier;
    const ahead = p.bodies.filter((b) => b.side === 'D' && b.y > c.y - 1 && p.t >= b.stunUntil && dist(b, c) < 9);
    let best = c.x;
    let bestRoom = -1;
    // ball-carrier vision: a poor one misreads the lanes by up to 3 yards, a great one by half a yard
    if (p.t >= pl.laneAt) {
      const blur = 3 - 2.5 * rt(c.p.a.BCV ?? 60, 45, 99);
      pl.laneNoise = Array.from({ length: 13 }, () => (pl.rand() * 2 - 1) * blur);
      pl.laneAt = p.t + 0.3;
    }
    for (let dx = -6; dx <= 6; dx += 1) {
      const x = Math.max(2, Math.min(FIELD_W - 2, c.x + dx));
      const spot = { x, y: c.y + 5 };
      const room = Math.min(20, ...ahead.map((d) => dist(d, spot))) - Math.abs(dx) * 0.35 + (pl.laneNoise[dx + 6] ?? 0);
      if (room > bestRoom) {
        bestRoom = room;
        best = x;
      }
    }
    // a tackler winding up to dive: once, he sizes him up and times a move against the dive (a
    // juke or a spin as he leaves his feet; a stiff arm or a truck for the man who's better at those,
    // at contact). A sharper pilot is closer to the moment.
    // (a person on the rings sizes up each wind-up, a tackler who winds up again included; the AI
    // each man once a play)
    const key = (d: Body) => (pl.ringTry !== undefined ? d.id * 4096 + Math.round((d.ringAt ?? 0) * 60) : d.id);
    // (a person busy with one ring finishes it before he looks at the next, and sizes one up once
    // it turns gold: while his last move is still on, its ring is amber and he keeps running)
    // (and sees the ring on any tackler closing on him, a pursuer from behind included; the AI
    // watches the men in front)
    const look = pl.ringTry === undefined || (!pl.plan && moveReady(p));
    const near = pl.ringTry === undefined ? ahead : p.bodies.filter((b) => b.side === 'D' && p.t >= b.stunUntil && dist(b, c) < 9);
    const w = look ? near.find((d) => d.windAt < Infinity && !pl.seen.has(key(d))) : undefined;
    if (w) {
      pl.seen.add(key(w));
      // a person goes for a gold ring this often, with his better ring move (JUKE or SPIN)
      const onRing = pl.ringTry !== undefined && pl.rand() < pl.ringTry;
      if (onRing || (pl.ringTry === undefined && pl.rand() < 0.3 + 0.5 * pl.skill)) {
        // the move that beats this man: its edge against him plus what timing it right is worth
        // (a juke against the dive the most, a spin, then a stiff arm or a truck at contact)
        const timing: Record<Move, number> = { juke: 0.32, spin: 0.2, stiff: 0.18, truck: 0.18 };
        const moves = ((onRing ? ['juke', 'spin'] : ['juke', 'spin', 'stiff', 'truck']) as Move[]).map((k) => [k, moveEdge(k, c, w) + timing[k] * (0.4 + 0.5 * pl.skill)] as [Move, number]);
        moves.sort((x, y) => y[1] - x[1]);
        const kind = moves[0][0];
        // a juke just before he leaves his feet; a stiff arm or a truck as he leaves them, so it's
        // still on when he arrives (it lasts half a second; 0.15 s after the dive was often too late)
        const due = w.windAt + windupOf(w) + (kind === 'stiff' || kind === 'truck' ? -0.02 : -0.08);
        // (a person on the ring: a JUKE or SPIN aimed at the commit itself, spread by his timing)
        const ring = pl.ringSigma !== undefined && (kind === 'juke' || kind === 'spin');
        pl.plan = { at: ring ? w.windAt + windupOf(w) + gauss(pl.rand) * pl.ringSigma! : due + gauss(pl.rand) * (0.26 - 0.2 * pl.skill), kind, dir: Math.sign(c.x - w.x) || Math.sign(best - c.x) || 1 };
      }
    }
    if (pl.plan && p.t >= pl.plan.at) {
      // (the human proxy's touch is judged at its own instant; the AI's at the step)
      moveWithBall(p, pl.plan.kind, pl.plan.dir, pl.ringSigma !== undefined ? pl.plan.at : p.t);
      pl.plan = null;
    }
    return best;
  }
  return null;
}

/**
 * A person's left thumb in the pocket (Claude, nfl-2), for the calibration kit's human proxy: when
 * a rusher has beaten his man, the thumb reacts a beat later (0.25-0.5 s) and takes the
 * quarterback away from him: sideways out of the pocket (stepping up from an edge rusher, backing
 * off an inside one, never up to the line), then drifting once he's clear of the tackle box. Out
 * there, with the rush still on him or a second gone, half the time he throws it away rather than
 * wait. On one dropback in ten he rolls out on purpose once he's set. Seeded; the AI's own
 * quarterback never uses it (it holds his spot, so the AI's drives are unchanged).
 */
export function pocketThumb(seed: string) {
  const r = rng(hashString('thumb:' + seed));
  let play: Play | null = null;
  let seenAt = Infinity;
  let react = 0;
  let side = 0;
  let bail = 0;
  let rollout = false;
  return (p: Play): { steer: Pt | null; away: boolean } => {
    if (p !== play) {
      play = p;
      seenAt = Infinity;
      react = 0.25 + r() * 0.25;
      side = 0;
      bail = r();
      // now and then he rolls out on purpose once he's set, to buy time and a throwing lane
      rollout = r() < 0.1;
      if (rollout) side = r() < 0.5 ? -1 : 1;
    }
    const qb = p.qb;
    if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== qb) return { steer: null, away: false };
    let near: Body | null = null;
    for (const b of p.bodies) if (b.side === 'D' && b.job === 'rush' && p.t >= b.winAt && (!near || dist(b, qb) < dist(near, qb))) near = b;
    if (rollout && seenAt === Infinity && p.t >= DROP_TIME) seenAt = p.t - react;
    if (!near && seenAt === Infinity) return { steer: null, away: false };
    if (seenAt === Infinity) seenAt = p.t;
    if (p.t - seenAt < react) return { steer: null, away: false };
    // away from him, and once he's picked a side he keeps it (unless the sideline is there): out of
    // the pocket and past the tackle box, then drifting while he looks
    if (!side) side = Math.sign(qb.x - (near?.x ?? p.bx)) || (qb.x < p.bx ? -1 : 1);
    if ((side < 0 && qb.x < 5) || (side > 0 && qb.x > FIELD_W - 5)) side = -side;
    // an edge rusher is beaten by stepping up into the pocket; an inside one by backing off him
    const up = near && Math.abs(near.x - qb.x) > 1.5 ? 0.45 : -0.25;
    const clear = Math.abs(qb.x - p.bx) > BOX_HALF + 1;
    const steer = { x: side * (clear ? 0.45 : 1), y: qb.y > p.los - 2.5 ? -0.3 : clear ? 0 : up };
    return { steer, away: outsideBox(p) && (p.pressure > 0.4 || p.t - seenAt > 1.1) && bail < 0.5 };
  };
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
