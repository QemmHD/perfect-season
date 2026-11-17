// Soccer v2: the AI on the ball. Implemented by Claude (Anthropic), 2026-11-01. It plays the
// attacks a person would, with the same controls (the stick, sprint, pass, through ball, cross,
// SHOOT held and let go): it looks at the goal and the teammates every few tenths of a second,
// dribbles into space, passes to the man who's open and further on (a through ball to a runner
// who's onside), crosses from wide and shoots when it has the angle. Its skill (0-1) is how
// sharp those reads are and how close to the green it lets the meter go.
import { hashString, rng } from '../../engine/rng';
import { AIM_X, ctrlOf, dist, GX, inBox, kickOff, nearestDefender, offsideLine, ownerOf, pass, PL, pressShoot, releaseShoot, setCurl, setSprint, step, TOP } from './engine';
import { rt } from './ratings';
import type { Attack, Body, PassKind, Pt } from './types';

export interface Pilot {
  skill: number;
  rand: () => number;
  /** the next look around, and the run it's on until then */
  next: number;
  run: Pt;
  sprint: boolean;
  /** SHOOT held: let go at this meter time, aiming here */
  releaseAt: number | null;
  aim: Pt | null;
  /** a set piece waits a beat before it's taken */
  setAt: number | null;
  /** the cross it last went to meet first time */
  firstTried: number;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;
const norm = (x: number, y: number) => {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? { x: x / l, y: y / l } : { x: 0, y: 1 };
};

export function pilot(skill: number, seed: string): Pilot {
  return { skill: clamp(skill, 0, 1), rand: rng(hashString('pilot:' + seed)), next: 0, run: { x: 0, y: 1 }, sprint: false, releaseAt: null, aim: null, setAt: null, firstTried: -1 };
}

/** How open a teammate is: the nearest defender to him, and to the line of a pass to him. */
function openness(a: Attack, from: Pt, q: Body, to: Pt = q): { man: number; lane: number } {
  let man = 99;
  let lane = 99;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const L2 = dx * dx + dy * dy || 1;
  for (const d of a.bodies) {
    if (d.side !== 'D' || a.t < d.stunUntil) continue;
    man = Math.min(man, dist(d, q));
    const k = clamp(((d.x - from.x) * dx + (d.y - from.y) * dy) / L2, 0.08, 0.92);
    lane = Math.min(lane, Math.hypot(from.x + dx * k - d.x, from.y + dy * k - d.y));
  }
  return { man, lane };
}

/** A shot from here is on: close enough for him, an angle, nobody in the way. */
function shotOn(a: Attack, c: Body): boolean {
  const d = dist(c, { x: GX, y: PL });
  const range = lerp(16, 26, rt(c.p.a.SHO));
  if (d > range || c.y > PL - 1.5) return false;
  const angle = Math.abs(Math.atan2(c.x - GX, PL - c.y));
  if (angle > 1.05 && d > 7) return false;
  if (d < 10) return true;
  // a body on the line to the goal
  for (const q of a.bodies) {
    if (q.side !== 'D' || q.role === 'gk') continue;
    const ahead = q.y > c.y + 0.5;
    if (!ahead) continue;
    const k = (q.y - c.y) / Math.max(1, PL - c.y);
    const lx = c.x + (GX - c.x) * k;
    if (Math.abs(q.x - lx) < 1.1) return d < 13;
  }
  return true;
}

/** Each step: decide (every few tenths), then the stick for the man it's on. */
export function decide(a: Attack, pl: Pilot): Pt | null {
  if (a.phase === 'pre') kickOff(a);
  const c = ctrlOf(a);
  const own = ownerOf(a);
  const r = pl.rand;
  // the meter's going: let go on the planned beat
  if (a.meter && pl.releaseAt !== null && a.t - a.meter.t0 >= pl.releaseAt) {
    releaseShoot(a, pl.aim);
    pl.releaseAt = null;
  }
  if (a.meter || a.strike || a.kick) return own === c ? { x: 0, y: 0 } : null;
  // a set piece: a beat to line it up, then take it
  if (a.setPiece && a.taker === c.id) {
    if (pl.setAt === null) pl.setAt = a.t + 0.6 + r() * 0.6;
    if (a.t < pl.setAt) return { x: 0, y: 0 };
    pl.setAt = null;
    const sp = a.setPiece;
    if (sp.kind === 'corner') pass(a, 'lofted', null);
    else if (sp.kind === 'penalty') beginShot(a, pl, { x: (r() < 0.5 ? -1 : 1) * (0.55 + r() * 0.4), y: -0.8 + r() * 1.4 }, 1.15);
    else {
      const d = dist(sp.spot, { x: GX, y: PL });
      if (d < 31) {
        const gk = a.bodies.find((b) => b.role === 'gk')!;
        const sideX = gk.x >= GX ? -1 : 1;
        setCurl(a, sideX > 0 ? 0.25 : -0.25);
        beginShot(a, pl, { x: sideX * (0.6 + r() * 0.3), y: 0.55 + r() * 0.4 }, 1);
      } else pass(a, 'lofted', null);
    }
    return { x: 0, y: 0 };
  }
  if (!own || own.id !== c.id) {
    // not on the ball: run onto the pass (the engine's assist) or after the loose ball; a cross
    // coming to him in the box he meets first time (a header, a volley)
    const f = a.ball.flight;
    if (f && f.to === c.id && (f.kind === 'cross' || (f.kind === 'lofted' && inBox(c))) && !a.first && a.t - f.at > 0.3 && pl.firstTried !== f.at) {
      pl.firstTried = f.at;
      if (r() < lerp(0.4, 0.85, pl.skill)) beginShot(a, pl, null);
    }
    setSprint(a, true);
    return null;
  }
  if (a.t >= pl.next) {
    pl.next = a.t + lerp(0.36, 0.14, pl.skill) + r() * 0.08;
    think(a, pl, c);
    if (a.kick || a.meter) return { x: 0, y: 0 };
  }
  setSprint(a, pl.sprint);
  return pl.run;
}

function beginShot(a: Attack, pl: Pilot, aim: Pt | null, timing = 1) {
  if (!pressShoot(a)) return;
  const sd = lerp(0.12, 0.028, pl.skill) / timing;
  pl.releaseAt = Math.max(0.15, TOP + gauss(pl.rand) * sd);
  pl.aim = aim;
}

function think(a: Attack, pl: Pilot, c: Body) {
  const r = pl.rand;
  const goal = { x: GX, y: PL };
  const pressure = nearestDefender(a, c).d;
  const noise = (1 - pl.skill) * 0.45;
  // shoot when it's on (a sharper pilot waits for a better look)
  if (shotOn(a, c) && (dist(c, goal) < 13 || r() < lerp(0.45, 0.8, pl.skill))) {
    const gk = a.bodies.find((b) => b.role === 'gk')!;
    const s = Math.abs(gk.x - GX) > 0.3 ? Math.sign(GX - gk.x) : c.x < GX ? 1 : -1;
    // (x in the old 3.3 m aim scale, so its shots go where they did before the 2026-11-02 aim change)
    beginShot(a, pl, { x: Math.min(1, (s * lerp(0.55, 0.85, r()) * 3.3) / AIM_X), y: -0.9 + r() * lerp(1.4, 1.0, pl.skill) });
    pl.run = { x: 0, y: 0.4 };
    return;
  }
  // the options: each teammate, and carrying it on
  const line = offsideLine(a);
  let best: { q: Body; kind: PassKind; v: number } | null = null;
  const wideCross = Math.abs(c.x - GX) > 14 && c.y > PL - 24;
  for (const q of a.bodies) {
    if (q.side !== 'A' || q === c) continue;
    const through = !!q.run && q.y > c.y - 2;
    const o = openness(a, c, q, through ? { x: q.x + (GX - q.x) * 0.1, y: Math.min(PL - 4, q.y + 8) } : q);
    const offside = q.y > line + 0.1 && q.y > c.y;
    const d = dist(c, q);
    if (d < 4 || d > 42) continue;
    let kind: PassKind = 'ground';
    let v = (q.y - c.y) / 22 + Math.min(o.man, 8) / 9 + (inBox(q) ? 0.35 : 0) - d / 70;
    if (o.lane < 1.6) {
      if (d > 14) kind = 'lofted';
      else v -= 1.2;
    }
    if (wideCross && inBox(q)) {
      kind = 'lofted';
      v += 0.5 + rt(q.p.a.PHY) * 0.3;
    }
    if (through && !offside && o.lane > 1.4) {
      kind = 'through';
      v += 0.55;
    } else if (offside) v -= 3;
    v += gauss(r) * noise;
    if (!best || v > best.v) best = { q, kind, v };
  }
  // carrying it: space ahead, and a little more for a good dribbler
  let space = 99;
  for (const d of a.bodies) if (d.side === 'D' && d.role !== 'gk' && d.y > c.y - 1) space = Math.min(space, dist(d, c));
  const carry = Math.min(space, 10) / 8 + rt(c.p.a.DRI) * 0.25 + (c.y < PL - 30 ? 0.15 : 0) - (pressure < 2 ? 0.6 : 0);
  const urgency = a.used > a.clock - 8 ? 0.4 : 0;
  if (best && best.v > carry + 0.15 - urgency && (pressure < 3.4 || best.kind === 'through' || r() < 0.25)) {
    pass(a, best.kind, { x: best.q.x - c.x, y: best.q.y - c.y });
    return;
  }
  // dribble: at goal, away from the men around him, down the wing if he's out wide
  let dir = norm(goal.x - c.x, goal.y - c.y);
  if (Math.abs(c.x - GX) > 16 && c.y < PL - 20) dir = norm((goal.x - c.x) * 0.15, 1);
  let rx = dir.x;
  let ry = dir.y;
  for (const d of a.bodies) {
    if (d.side !== 'D' || a.t < d.stunUntil) continue;
    const e = dist(d, c);
    if (e > 7 || e < 0.01) continue;
    const w = (7 - e) / 7;
    rx += ((c.x - d.x) / e) * w * 1.3;
    ry += ((c.y - d.y) / e) * w * (d.y > c.y ? 0.9 : 0.2);
  }
  const n = norm(rx + gauss(r) * noise * 0.4, Math.max(-0.2, ry));
  pl.run = n;
  pl.sprint = space > 4.5 && a.stamina > 0.3;
}

/** Play an attack out with the pilot on the ball (tests, sims, the AI's attacks). */
export function autoplayAttack(a: Attack, skill: number, seed: string): Attack {
  const pl = pilot(skill, seed);
  const dt = 1 / 60;
  kickOff(a);
  let n = 0;
  while (!a.end && n++ < 60 * 120) step(a, dt, decide(a, pl));
  return a;
}
