// A player for arcade basketball: plays the AI's possessions, sims a side, tunes the game and drives
// the tests. It reads the floor the way a person would: shoot when open with a shooter, drive an
// open lane with a finisher, kick to the open man, lob to a dunker on the cut, cross up a tight
// defender, move it out of a double team, and sprint (the stick at its edge) only on a drive. `skill` (0-1) is how sharp its
// reads and its release timing are.
import { hashString, rng } from '../../engine/rng';
import { callPlay, canOop, crossover, dist, freeThrow, spacingHelp, stonewallChance, isThree, jumpRebound, ballPos, pass, pressShoot, releaseShoot, RIM, shotValue, step, stepback, topSpeed } from './engine';
import { afterPossession, type HoopsGame, startPossession } from './game';
import type { Body, Possession, Pt } from './types';

/** the most passes it makes in a possession before it plays with the ball */
export const MAX_PASSES = 6;
const rate01 = (r: number) => Math.max(0, Math.min(1, (r - 40) / 59));

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
  /** when the drive under way started */
  driveAt?: number;
}

export function pilot(skill: number, seed: string): Pilot {
  return { skill, rand: rng(hashString('p2:' + seed)), letGo: null, nextThink: 0, goal: null, driving: false, crosses: 0, trap: null };
}

const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

/** Its release timing's spread (seconds): a Legend's about as tight as a good person's thumb, a
 * Rookie's loose. */
function releaseSd(pl: Pilot): number {
  // Rookie 84 ms, Pro 66 ms, Legend 50 ms (a good thumb is about 45). It was 120/95/73 ms, which
  // the rating-scaled shot curve punished far harder than any person's release.
  return 0.12 - 0.08 * pl.skill;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const rate = (r: number, lo: number, hi: number) => clamp((r - lo) / (hi - lo), 0, 1);
const quick = (h: Body['p']) => (h.spd + h.acc) / 2;

/**
 * What attacking the rim from here is worth (expected points), as a coach reads it (Claude
 * 2026-11-01). Before, a drive was worth a flat number by the finish rating and it only started
 * when no defender stood anywhere in the lane, so the AI settled for contested threes (about 85% of
 * its shots) and elite slashers, interior defense and free throws barely showed.
 *  - getting by his man: quickness (SPD+ACC) and handle against the man's quickness and perimeter
 *    D, the room he's given, and strength for the bump (a beaten or stumbling man: he's by)
 *  - the help waiting in the lane, weighted by how close it is to his line, a shot blocker most
 *  - the finish he'd get: a dunk for a dunker (DNK 75+ through traffic), else a layup, less
 *    against a rim protector (IND, BLK)
 *  - the and-one: contact more likely into help and for a strong finisher, then his FT
 *  - walled off, he kicks it out or takes a tougher look (~0.6)
 */
export function attackValue(p: Possession, h: Body): number {
  const a = h.p;
  const d = dist(h, RIM);
  if (d > 30) return 0;
  const ux = (RIM.cx - h.cx) / Math.max(d, 0.01),
    uz = (RIM.cz - h.cz) / Math.max(d, 0.01);
  const man = p.bodies.find((o) => o.side === 'D' && o.mark === h.idx);
  let by = 0.95;
  let contested = false;
  if (man && p.t >= man.stunUntil) {
    const ahead = (man.cx - h.cx) * ux + (man.cz - h.cz) * uz;
    const lateral = Math.abs((man.cx - h.cx) * uz - (man.cz - h.cz) * ux);
    const room = dist(man, h);
    if (ahead < -0.5) by = 0.92;
    else if (d < 12) {
      // on the block: a post-up, backing him down by strength and size
      by = clamp(0.45 + (a.str - man.p.str) / 80 + (a.ht - man.p.ht) / 24, 0.15, 0.88);
      contested = true;
    } else if (ahead > 0.8 && lateral < 2.6) {
      // square in front of him: a straight drive is a bump, through it only by strength (or a quick
      // first step on a man playing off him); beating him takes a move first
      by = clamp((1 - stonewallChance(man.p, a)) * 0.75 + (quick(a) - quick(man.p)) / 120 + (room - 3) * 0.05, 0.05, 0.75);
      contested = true;
    } else {
      // a shoulder on him: a lane to turn the corner, by quickness and handle against his feet
      by = clamp(0.55 + (quick(a) - quick(man.p)) / 60 + (a.hnd - man.p.prd) / 150 + (room - 3) * 0.05, 0.15, 0.9);
    }
  }
  let help = 0,
    prot = 0;
  for (const o of p.bodies) {
    if (o.side !== 'D' || o === man || p.t < o.stunUntil) continue;
    const dx = o.cx - h.cx,
      dz = o.cz - h.cz;
    const along = dx * ux + dz * uz;
    if (along < 0 || along > d + 3) continue;
    const near = clamp(1 - Math.abs(dx * uz - dz * ux) / 6, 0, 1);
    if (!near) continue;
    help += near;
    prot = Math.max(prot, near * (0.5 * rate(o.p.ind, 50, 99) + 0.5 * rate(o.p.blk, 40, 99)));
  }
  const reach = by * clamp(1 - 0.3 * help, 0.3, 1);
  const dunk = a.ddk >= 75 || (a.ddk >= 68 && help < 0.3) ? lerp(0.72, 0.95, rate(a.ddk, 60, 99)) : 0;
  const lay = lerp(0.4, 0.78, rate(a.lay, 40, 97));
  // through the man still on him (a bump or a post-up) it's a contested finish
  // (and a crowd at the rim takes its toll: each man in the lane makes it harder, as it does there)
  const finish = Math.max(dunk, lay) * (1 - 0.35 * prot) * (contested ? 0.85 : 1) * Math.pow(0.9, Math.min(2, help) + spacingHelp(p, h));
  const and1 = (0.08 + 0.16 * rate(a.str, 40, 99)) * (0.6 + 0.4 * Math.min(1, help)) * freeThrow(a);
  // barrelling into traffic risks the strip
  const strip = 0.12 * Math.min(1.5, help) * (1.1 - rate(a.hnd, 30, 99));
  return reach * (2 * finish + and1) + (1 - reach) * 0.55 - strip;
}

const CONTEST_F: Record<string, number> = { open: 1, light: 0.95, heavy: 0.86, smothered: 0.6 };
const CONTESTS = ['open', 'light', 'heavy', 'smothered'];
const THREE_REAL = 0.95;

/**
 * A catch-and-shoot look for a teammate as it will be when the ball gets there (Claude
 * 2026-11-01): his man closes out while the pass is in the air and he rises, so a man with three
 * feet now is heavily contested by the release. (It read the room as it was when it passed, and
 * swung the ball to "open" men who were contested by the time they let go: most of its shots were
 * contested threes.)
 */
export function catchValue(p: Possession, from: Body, m: Body, sd: number): number {
  const v = shotValue(p, m, sd);
  const md = p.bodies.find((o) => o.side === 'D' && o.mark === m.idx);
  if (!md || p.t < md.stunUntil) return v.value;
  const flight = Math.max(0.2, dist(from, m) / lerp(36, 50, rate(from.p.pas, 40, 99))) + 0.3;
  const room = dist(md, m) - topSpeed(md, false) * 0.45 * Math.max(0, flight - 0.1);
  const cap = room >= 5 ? 0 : room >= 3 ? 1 : room >= 1.5 ? 2 : 3;
  const now = CONTESTS.indexOf(v.contest);
  const then = Math.max(now, cap);
  // (caught in rhythm, a set shooter's window is a little wider)
  return v.value * (CONTEST_F[CONTESTS[then]] / CONTEST_F[v.contest]) * (v.kind === 'three' ? 1.08 * THREE_REAL : 1);
}

/**
 * His own jumper from in close or the mid-range, as it will be at the release: the man on him rises
 * with him (a contest one step worse when he's within four feet), and a hand on a smothered one can
 * block it. (Read as it stood, the floater looked better than it was: a higher close-shot rating
 * made the AI settle for more of them and score less.)
 */
function ownValue(p: Possession, h: Body, sd: number): { kind: string; contest: string; value: number } {
  const s = shotValue(p, h, sd);
  // (the curve's read of an open three runs ahead of what falls once the defense recovers: about
  // 0.88 of it, measured, so a scrambled defense gets attacked instead of shot over)
  if (s.kind === 'three') {
    // (and a man within four feet gets a hand up as he rises: one contest worse)
    let r3 = 99;
    for (const o of p.bodies) if (o.side === 'D' && p.t >= o.stunUntil) r3 = Math.min(r3, dist(o, h));
    const i3 = CONTESTS.indexOf(s.contest);
    const j3 = r3 < 4 ? Math.min(3, i3 + 1) : i3;
    return { ...s, value: s.value * THREE_REAL * (CONTEST_F[CONTESTS[j3]] / CONTEST_F[s.contest]) };
  }
  // (a floater in traffic is the last resort, not the plan, and a contested long two is the worst
  // shot in the game: about 0.8 points a shot in the NBA)
  const v = s.kind === 'close' ? { ...s, value: s.value * 0.7 } : s.kind === 'mid' ? { ...s, value: s.value * (s.contest === 'open' ? 0.85 : 0.75) } : s;
  let r = 99;
  for (const o of p.bodies) if (o.side === 'D' && p.t >= o.stunUntil) r = Math.min(r, dist(o, h));
  // (off the dribble from the mid-range he closes from further: he has the whole rise to get there)
  if (r >= (v.kind === 'mid' ? 9 : 4)) return v;
  const now = CONTESTS.indexOf(v.contest);
  const then = Math.min(3, now + (v.kind === 'mid' && r < 5.5 ? 2 : 1));
  return { ...v, value: v.value * (CONTEST_F[CONTESTS[then]] / CONTEST_F[v.contest]) * (then === 3 ? 0.9 : 1) };
}

/** One step of decisions: returns the stick (a court direction) for the handler. */
export function decide(p: Possession, pl: Pilot): Pt | null {
  if (!p.end && p.ball?.kind === 'loose' && p.rebounder !== undefined) {
    const b = p.bodies[p.rebounder],
      at = ballPos(p);
    if (dist(b, at) < 3 && p.t - p.ball.t0 > 0.2 + (1 - pl.skill) * 0.15) jumpRebound(p);
    return towards(b, p.ball.to);
  }
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
    const speed = Math.hypot(h.vx, h.vz);
    const toward = speed > 0.5 ? (h.vx * dir.cx + h.vz * dir.cz) / speed : 0;
    // at the rim, or going at it in stride from the edge of the paint: the finish
    if (d < 6 || (d < 10 + pl.rand() * 1.5 && speed > 5.5 && toward > 0.5)) {
      pressShoot(p);
      pl.driving = false;
      return null;
    }
    // walled off (stonewalled, or slowed to a crawl): in the paint a floater or a kick-out, outside
    // it pull it out and read again (it used to give up the moment anyone stood in the lane, which
    // was nearly every drive)
    if (p.t - (pl.driveAt ?? p.t) > 0.35 && speed < 5) {
      pl.driving = false;
      pl.goal = null;
      pl.nextThink = p.t + 0.12;
      if (d < 12) {
        const sd = releaseSd(pl);
        let best: Body | null = null,
          bestVal = shotValue(p, h, sd).value + 0.05;
        if (p.passes < MAX_PASSES)
          for (const m of p.bodies) {
            if (m.side !== 'O' || m === h) continue;
            const v = catchValue(p, h, m, sd) - 0.1;
            if (v > bestVal) {
              bestVal = v;
              best = m;
            }
          }
        if (best) pass(p, best.idx);
        else pressShoot(p);
      }
      return null;
    }
    // the help comes over: kick it to the man it left (drive and kick), a sharper player more often
    if (p.t >= pl.nextThink && p.passes < MAX_PASSES) {
      pl.nextThink = p.t + 0.15;
      const man = p.bodies.find((o) => o.side === 'D' && o.mark === h.idx);
      const helpIn = p.bodies.some((o) => o.side === 'D' && o !== man && p.t >= o.stunUntil && dist(o, h) < 5 && (o.cx - h.cx) * dir.cx + (o.cz - h.cz) * dir.cz > 0);
      if (helpIn && pl.rand() < 0.35 + 0.5 * pl.skill) {
        const sd = releaseSd(pl);
        let best: Body | null = null,
          bestVal = attackValue(p, h) + 0.15;
        for (const m of p.bodies) {
          if (m.side !== 'O' || m === h) continue;
          const v = catchValue(p, h, m, sd) - 0.1;
          if (v > bestVal) {
            bestVal = v;
            best = m;
          }
        }
        if (best) {
          pl.driving = false;
          pass(p, best.idx);
          return null;
        }
      }
    }
    return dir;
  }
  // doubled: get it out to the man the second defender left (a sharper player sooner)
  if (p.trapper !== null) {
    const tr = pl.trap;
    if (!tr || tr.p !== p || tr.handler !== h.idx || tr.trapper !== p.trapper)
      pl.trap = { p, handler: h.idx, trapper: p.trapper, at: p.t + 0.2 + (1 - pl.skill) * 0.7 + pl.rand() * 0.2 };
    const free = p.bodies[p.bodies[p.trapper].mark];
    if (pl.trap && p.t >= pl.trap.at && free && free !== h && free.side === 'O' && p.passes < MAX_PASSES) {
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
    if (d < 10) {
      pl.driving = true;
      pl.driveAt = p.t;
    }
    else pressShoot(p);
    return null;
  }
  // how picky: early in the clock only a good look, late anything decent
  const used = 14 - p.clock;
  // the pick and roll: bring a big up to set a screen once a possession (a sharper player more
  // often), come off it, and the roll man dives to the rim
  if (p.callReadyAt === undefined && used > 0.8 && used < 5 && pl.rand() < 0.25 + 0.35 * pl.skill && callPlay(p, 'screen')) return null;
  const call = p.playCall && p.playCall.kind === 'screen' && p.playCall.until > p.t ? p.playCall : null;
  if (call && call.plantedAt !== undefined && !call.rolling) {
    const s = p.bodies[call.actor];
    const off = { cx: s.cx - h.cx, cz: s.cz - h.cz };
    const l = Math.hypot(off.cx, off.cz) || 1;
    pl.goal = { cx: s.cx + (off.cx / l) * 4, cz: s.cz + (off.cz / l) * 4 + (s.cz >= 0 ? -1.5 : 1.5) };
  }
  // (a sharper player waits for a better look)
  const picky = 0.7 + 0.65 * pl.skill;
  const want = used < 2 ? picky + 0.15 : picky - Math.min(0.4, (used - 2) * 0.05) - pl.rand() * 0.08;
  const shot = ownValue(p, h, sd);
  // a drive: what attacking the rim is worth from here (see attackValue)
  const man = p.bodies.find((o) => o.side === 'D' && o.mark === h.idx);
  // (from the perimeter a touch conservative, which keeps the catch-and-shoot three in the mix;
  // inside, going to the rim beats settling for a floater)
  const drive = attackValue(p, h) * (d > 14 ? 0.92 : 1.15);
  // the open man: what his shot would be worth, a lob to a dunker on the cut most of all. A pass
  // costs something (a beat of the clock, the risk in the lane, the defense recovering), more with
  // each extra pass and less for a good passer; after MAX_PASSES the ball stops moving and he plays.
  // (Without the cost an all-shooter five swung it around forever while everyone looked as good as
  // the handler, and elite shooters scored less than average ones: see GAMEPLAY-RATINGS.md.)
  let best: Body | null = null;
  let bestVal = 0;
  const tax = (0.15 + 0.05 * p.passes) * (1 - 0.4 * rate01(a.pas));
  if (p.passes < MAX_PASSES)
    for (const m of p.bodies) {
      if (m.side !== 'O' || m === h) continue;
      const cutting = m.cutUntil > p.t;
      const mm = p.bodies.find((o) => o.side === 'D' && o.mark === m.idx);
      const behind = !!mm && dist(mm, RIM) > dist(m, RIM) + 1;
      // (the lob to a cutter takes a sharp eye: a Rookie mostly misses it)
      const sees = pl.rand() < 0.3 + 0.7 * pl.skill;
      const oop = canOop(m.p);
      // inside, a big's catch is worth what he can do with it there (a post-up, a finish)
      const inside = dist(m, RIM) < 12 ? attackValue(p, m) * 0.92 : 0;
      const v = sees && cutting && behind && oop && dist(m, RIM) < 14 ? 1.05 + (m.p.ddk - 74) / 100 : Math.max(catchValue(p, h, m, sd), inside) - tax;
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
      pl.driveAt = p.t;
      return dir;
    }
    if (best) {
      pass(p, best.idx);
      return null;
    }
  }
  // a shooter crowded behind the arc: a step-back for room
  const man0 = man && dist(man, h) < 4.2 && p.t >= man.stunUntil;
  if (man0 && a.thr >= 72 && isThree(h) && dist(h, RIM) < 25.5 && p.t - (h.lastMoveAt ?? -9) > 1.3 && pl.rand() < 0.2 + 0.25 * pl.skill) {
    stepback(p);
    pl.nextThink = p.t + 0.3;
    return null;
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
      { cx: 33, cz: 10 }
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
