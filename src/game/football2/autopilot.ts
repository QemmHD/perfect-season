// A player for arcade football: plays the AI's drives, sims a side, tunes the game and drives the
// tests. It reads who's open and throws him the ball in stride, picks the lane with room on a run,
// uses the runner's best move against a tackler, kicks in range and punts when it must.
import { hashString, rng } from '../../engine/rng';
import { BOX_HALF, DROP_TIME, dist, FIELD_W, flightTime, isLine, maxThrow, moveEdge, moveReady, moveWithBall, on, outsideBox, projectRoute, rt, scramble, separation, sight, snap, step, throwAway, throwTo, windupOf } from './engine';
import { afterPlay, fgDistance, fgInRange, type Game, kick, kickWindow, punt, situation, snapSeed, startPlay } from './drive';
import { dealConcepts, dealRuns, passShare } from './coach';
import type { Level } from './calls';
import type { Body, Concept, Move, Play, Pt } from './types';

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
  /** nfl-5: the AI quarterback's progression on the play he's on (aiPass) */
  reads?: Reads | null;
}

/**
 * nfl-5: how the AI quarterback works a pass play (aiPass). He reads his progression in order,
 * timed from his set: the first read 0.15-0.45 s after it (by awareness), then one every
 * lerp(0.55, 0.32, awareness) s, and never before that man's route has made its break. He sees as
 * many reads as his level allows (Rookie 1-2, Pro 2-3, Legend 2-4 by awareness), then the
 * checkdown; past that he holds it until the rush makes him throw it away, find a man late or run.
 * A throw takes a 0.35-0.45 s wind-up, through which he can be hit and the coverage can close.
 */
export interface Reads {
  play: Play;
  order: { b: Body; ready: number }[];
  check: Body | null;
  i: number;
  next: number;
  gap: number;
  cap: number;
  /** Rookie: he's locked onto his first read whatever the coverage */
  lock: boolean;
  wind: number;
  /** he'll pull it down and run when the pocket breaks with a lane (decided once a play) */
  runner: boolean;
  stage: 'reads' | 'check' | 'hold';
  release: { at: number; b: Body } | null;
  /** how much pressure he feels before he hurries it (an aware passer sooner; over 1, a hit he
   * never sees coming: the blind side) */
  feel: number;
}

/** The AI's level from its skill (Arcade AI_SKILL: Rookie 0.45, Pro 0.68, Legend 0.88). */
export const levelOfSkill = (skill: number): Level => (skill < 0.56 ? 'rookie' : skill < 0.78 ? 'pro' : 'legend');

/**
 * Each concept's progression (nfl-5): the reads in order, each with the moment (s after the snap)
 * his route has made its break, and the checkdown last. Routes by slot: CONCEPT_ROUTES in engine.ts.
 */
export const READS: Record<Concept, { reads: [string, number][]; check: string }> = {
  verts: { reads: [['SL', 1.9], ['TE', 1.9], ['X', 2.2], ['Z', 2.2]], check: 'RB' },
  slants: { reads: [['X', 0.9], ['SL', 0.9], ['Z', 1.0], ['TE', 1.6]], check: 'RB' },
  smash: { reads: [['SL', 2.0], ['X', 1.6], ['TE', 1.7], ['Z', 1.6]], check: 'RB' },
  flood: { reads: [['Z', 2.0], ['SL', 1.7], ['TE', 1.2], ['X', 2.3]], check: 'RB' },
  dagger: { reads: [['SL', 1.8], ['X', 2.1], ['Z', 1.6]], check: 'RB' },
  mesh: { reads: [['X', 1.3], ['SL', 1.3], ['Z', 2.0], ['TE', 1.6]], check: 'RB' },
  curls: { reads: [['X', 1.6], ['Z', 1.6], ['TE', 2.0], ['SL', 1.1]], check: 'RB' },
  posts: { reads: [['X', 2.0], ['Z', 2.0], ['SL', 1.6], ['TE', 1.4]], check: 'RB' }
};

/** a hurried throw's wind-up (s): a flick to get rid of it before the hit */
export const HURRIED_WIND = 0.18;
/** the AI passer's clock in his head (s after the snap, a little less for a better one) */
export const CLOCK_IN_HEAD = 3.3;

/** How many reads he gets through before the checkdown, by level (Legend by awareness). */
export function readCap(level: Level, awr01: number, u: number): number {
  if (level === 'rookie') return u < 0.5 ? 1 : 2;
  if (level === 'pro') return u < 0.5 ? 2 : 3;
  return 2 + Math.round(2 * awr01);
}

export function pilot(skill: number, seed: string): Pilot {
  return { skill, rand: rng(hashString('fpilot:' + seed)), readAt: 0, play: null, feel: 1, felt: Infinity, seen: new Set(), plan: null, laneNoise: [], laneAt: -1 };
}

const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

/**
 * The AI's play call (nfl-5): run or pass by the down and distance (coach.ts passShare: about 47% on
 * first down, 59% on second, 74% on third), and the concept and the run that fit it, dealt from the
 * snap's seed as the tray deals a person's cards.
 */
export function chooseCall(g: Game, pl: Pilot): 'pass' | 'run' {
  const s = situation(g);
  g.concept = dealConcepts(snapSeed(g), s, 1)[0];
  g.run = dealRuns(snapSeed(g), s, 1)[0];
  return pl.rand() < passShare(s) ? 'pass' : 'run';
}

/**
 * Fourth down (nfl-5, the AI's chart): the last kick when the clock's run out; go for it on a yard
 * or two from midfield on (or anywhere near the goal), and on fourth and a few deep in their end or
 * out of kicking range; kick when it's in range; punt the rest. (Before nfl-5 it never punted, as a
 * punt and a stop on downs end the drive the same way in this format; it went for it 3.3 times a
 * game, which no football team does. A punt also earns the other side's defense nothing it
 * wouldn't get for a stop.)
 */
export function fourthDown(g: Game): 'kick' | 'go' | 'punt' {
  // the clock ran out in range: the last kick
  if (g.clock === 0) return 'kick';
  const inRange = fgInRange(g);
  // the two-minute drill: a kick if it's there, else it's now or never
  if (g.clock !== null) return inRange ? 'kick' : 'go';
  if (g.toGo <= 1.5 && g.ballOn >= 38) return 'go';
  if (g.toGo <= 3 && (g.ballOn >= 55 || (inRange && fgDistance(g) <= 25))) return 'go';
  if (inRange) return 'kick';
  if (g.ballOn >= 55 && g.toGo <= 6) return 'go';
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
  // (how open he is: the same value as the halo on his chip, engine.ts separation)
  return { at, open: separation(p, b, at) };
}

/** Where he aims a throw meant for `at`: a little off by his skill, and a guess along the line where he can't see the arc land. */
function aimOf(p: Play, pl: Pilot, at: Pt): Pt {
  const len = Math.max(1, dist(p.qb, at));
  const hidden = (1 - sight(p, len)) * len;
  // (its own aim is a little off by skill; the passer's ratings throw the real error in throwTo)
  const along = gauss(pl.rand) * ((1 - pl.skill) * 1.6 + hidden * (0.2 - 0.12 * pl.skill));
  const across = gauss(pl.rand) * ((1 - pl.skill) * 1.0 + hidden * 0.03);
  const ux = (at.x - p.qb.x) / len;
  const uy = (at.y - p.qb.y) / len;
  return { x: at.x + ux * along - uy * across, y: at.y + uy * along + ux * across };
}

/** How open a man has to be for him to pull the trigger: tighter for a better passer, more room for a deep ball. */
const roomFor = (p: Play, pl: Pilot, at: Pt) => 2.9 - pl.skill * 0.5 + Math.max(0, dist(p.qb, at) - 20) * 0.03;

/** A man he can throw to (in range, not behind him): where to hit him in stride and how open he'll be. */
function option(p: Play, b: Body): { b: Body; at: Pt; open: number } | null {
  if (b.job === 'block' || isLine(b) || b === p.qb) return null;
  const o = lead(p, b);
  return dist(p.qb, o.at) <= maxThrow(p) && o.at.y > p.los - 3 ? { b, ...o } : null;
}

/** A lane to run: nobody within 1.8 yd of the five yards straight up, or up and to either side. */
export function scrambleLane(p: Play): boolean {
  const qb = p.qb;
  const defenders = p.bodies.filter((b) => b.side === 'D' && p.t >= b.stunUntil);
  return [-0.7, 0, 0.7].some((ang) => {
    const dx = Math.sin(ang),
      dy = Math.cos(ang);
    return defenders.every((d) => {
      const k = Math.max(0, Math.min(5, (d.x - qb.x) * dx + (d.y - qb.y) * dy));
      return Math.hypot(qb.x + dx * k - d.x, qb.y + dy * k - d.y) > 1.8;
    });
  });
}

/** The AI quarterback's pass play (nfl-5): reads, checkdown, wind-up, throwaway, scramble. */
function aiPass(p: Play, pl: Pilot) {
  const qb = p.qb;
  const awr = rt(qb.p.a.AWR, 45, 99);
  if (!pl.reads || pl.reads.play !== p) {
    const level = levelOfSkill(pl.skill);
    const plan = READS[p.concept];
    const at = (slot: string) => p.bodies.find((b) => b.side === 'O' && b.slot === slot) ?? null;
    const order = plan.reads.map(([slot, ready]) => ({ b: at(slot)!, ready })).filter((o) => o.b && o.b.job !== 'block');
    const check = [at(plan.check), at('TE')].find((b) => b && b.job !== 'block') ?? null;
    pl.reads = {
      play: p,
      order,
      check,
      i: 0,
      next: DROP_TIME + lerp(0.45, 0.15, awr) + pl.rand() * 0.06,
      gap: lerp(0.55, 0.32, awr),
      cap: Math.min(order.length, readCap(level, awr, pl.rand())),
      lock: level === 'rookie' && pl.rand() < 0.25,
      wind: lerp(0.45, 0.35, 0.5 * awr + 0.5 * pl.skill),
      runner: pl.rand() < lerp(0.35, 0.85, rt(qb.p.a.SPD, 50, 95)) * (on(qb, 'scrambler') ? 1.3 : 1),
      stage: 'reads',
      release: null,
      feel: 0.5 + pl.rand() * 0.3 + (1 - awr) * 0.25
    };
  }
  const r = pl.reads;
  // the wind-up: the ball leaves when it's done, to where the man is going now
  if (r.release) {
    // (a rusher in his face, a step and a half away: it comes out now, hurried)
    if (p.t >= r.release.at || p.pressure > 0.92) {
      const o = option(p, r.release.b);
      throwTo(p, aimOf(p, pl, o ? o.at : lead(p, r.release.b).at));
      r.release = null;
      r.stage = 'hold';
    }
    return;
  }
  // (hurried, he gets rid of it with a flick)
  const throwIt = (b: Body, quick = false) => {
    r.release = { at: p.t + (quick ? HURRIED_WIND : r.wind), b };
  };
  if (p.pressure > r.feel && pl.felt === Infinity) pl.felt = p.t;
  // (and his clock in his head: past it he's getting rid of it, rush or no rush)
  const hurried = p.t - pl.felt >= 0.3 - 0.2 * pl.skill || p.t >= CLOCK_IN_HEAD - 0.4 * pl.skill;
  // the pocket's breaking down and there's a lane: he takes off
  if (r.runner && p.pressure > 0.6 && p.t > DROP_TIME && scrambleLane(p) && scramble(p)) return;
  if (hurried) {
    // about to be hit: the best man open enough now; else away (only from outside the tackle box,
    // the rule a person plays under: inside it that's grounding), else a lane to run; else, with
    // the hit right on him, a tight one to the most open man, or he eats it
    const all = p.bodies.map((b) => option(p, b)).filter((o): o is NonNullable<typeof o> => !!o).sort((a, b) => b.open - a.open);
    if (all[0] && all[0].open >= 1.4) throwIt(all[0].b, true);
    else if (outsideBox(p) && throwAway(p)) r.stage = 'hold';
    else if (r.runner && p.t > DROP_TIME && scrambleLane(p) && scramble(p)) return;
    else if (p.pressure > 0.9 && all[0] && all[0].open >= 0.8) throwIt(all[0].b, true);
    return;
  }
  if (p.t < r.next || r.stage === 'hold') return;
  if (r.stage === 'reads') {
    const read = r.order[r.i];
    if (!read || r.i >= r.cap) {
      r.stage = 'check';
      return;
    }
    if (p.t < read.ready) return;
    const o = option(p, read.b);
    if (o && (o.open >= roomFor(p, pl, o.at) || (r.lock && r.i === 0))) {
      throwIt(read.b);
      return;
    }
    r.i++;
    r.next = p.t + r.gap * (0.8 + 0.4 * pl.rand());
    return;
  }
  // the checkdown, open a step is enough; else he holds it and looks for a man coming open late
  const c = r.check ? option(p, r.check) : null;
  if (c && c.open >= 1.3) {
    throwIt(c.b);
    return;
  }
  const late = r.order
    .slice(0, r.cap)
    .map((o) => option(p, o.b))
    .filter((o): o is NonNullable<typeof o> => !!o && o.open >= roomFor(p, pl, o.at) + 0.4)[0];
  if (late) throwIt(late.b);
  else r.next = p.t + r.gap;
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
  if (p.phase === 'drop' && p.call === 'pass' && p.carrier === p.qb && !pl.throwAt) {
    aiPass(p, pl);
    return null;
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
