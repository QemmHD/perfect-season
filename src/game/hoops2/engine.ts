// One possession of arcade basketball, stepped at a fixed rate. Court feet: cx along the court
// (0 midcourt, 47 the baseline), cz across (-25 to 25); the rim is at (41.75, 0), ten feet up.
// Your five attack, the rival's five defend with their real ratings.
//
// The shot meter works like 2K's: hold to rise, let go at the top. A green release always goes in;
// the green window is wide for a great shooter and a sliver for a poor one, and it shrinks the
// closer and longer the defender who closes out on him. Near the rim, what he can do comes from his
// ratings: a layup, a driving dunk, a standing dunk, or through a defender only for a posterizer.
//
// Getting open is the game: the stick at its edge is a sprint (on a stamina bar) that beats a slower
// man, crossovers and step-backs shake a defender by the handle, and each possession the defense
// shows a look to read (man, sagging off a poor shooter, switching, trapping the ball).
import type { Act, Body, Contest, EndKind, Hooper, Possession, Pt, Scheme, ShotKind } from './types';

export const RIM: Pt = { cx: 41.75, cz: 0 };
export const RIM_H = 10;
export const SHOT_CLOCK = 14;
const MAX_CX = 46.6;
const MAX_CZ = 24.4;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
/** a 0-99 rating as 0-1 between two marks */
const rate = (r: number, lo = 40, hi = 95) => clamp((r - lo) / (hi - lo), 0, 1);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.cx - b.cx, a.cz - b.cz);

export function has(p: Hooper, a: string): boolean {
  return p.abil.includes(a);
}

/** Where each position sets up (behind the arc for the shooters, the bigs inside). */
const SPOTS: Record<string, Pt> = {
  PG: { cx: 17.5, cz: 0 },
  SG: { cx: 30, cz: -19.5 },
  SF: { cx: 44.6, cz: 22 },
  PF: { cx: 33, cz: 10 },
  C: { cx: 40, cz: -6.5 },
};
/** spacing spots to drift to when the ball goes inside */
const DRIFT: Pt[] = [
  { cx: 44.6, cz: -22 },
  { cx: 44.6, cz: 22 },
  { cx: 30, cz: -19.5 },
  { cx: 30, cz: 19.5 },
  { cx: 17.8, cz: 0 },
];

export function isThree(p: Pt): boolean {
  if (p.cx > 41.75 - Math.cos(Math.asin(22 / 23.75)) * 23.75) return Math.abs(p.cz) >= 22;
  return dist(p, RIM) >= 23.75;
}

function body(idx: number, side: 'O' | 'D', p: Hooper, at: Pt, mark: number, energy: number): Body {
  return { idx, side, p, cx: at.cx, cz: at.cz, vx: 0, vz: 0, h: 0, vh: 0, face: 0, act: 'idle', actAt: 0, home: { ...at }, mark, cutUntil: 0, stunUntil: 0, energy, burst: 1, trail: [] };
}

/**
 * A new possession: the point guard (or whoever is first) brings it over the top, the others in
 * their spots, each guarded by the defender at the same index.
 */
export function newPossession(ours: Hooper[], theirs: Hooper[], energy: number[], rand: () => number): Possession {
  const bodies: Body[] = [];
  ours.forEach((p, i) => {
    const s = SPOTS[p.pos] ?? DRIFT[i];
    const at = i === 0 ? { cx: 12, cz: (rand() - 0.5) * 6 } : { cx: s.cx - 3, cz: s.cz };
    const b = body(i, 'O', p, at, -1, energy[i] ?? 1);
    b.home = { ...s };
    bodies.push(b);
  });
  theirs.forEach((p, i) => {
    const man = bodies[i];
    const toRim = unit({ cx: RIM.cx - man.cx, cz: RIM.cz - man.cz });
    const b = body(5 + i, 'D', p, { cx: man.cx + toRim.cx * 4.5, cz: man.cz + toRim.cz * 4.5 }, i, 1);
    b.face = Math.PI;
    bodies.push(b);
  });
  const scheme = schemeFor(ours, rand);
  return { t: 0, clock: SHOT_CLOCK, bodies, handler: 0, ball: null, meter: null, finish: null, end: null, events: ['scheme:' + scheme], rand, lastShot: null, passes: 0, fire: -1, target: null, scheme, trapper: null, sprinting: false };
}

/**
 * The defense's look for a possession, read off the five it faces: it sags off a team that can't
 * shoot, traps a star ball handler, and otherwise mixes man-to-man with switching everything.
 */
function schemeFor(ours: Hooper[], rand: () => number): Scheme {
  const shooting = ours.reduce((a, p) => a + p.thr, 0) / Math.max(1, ours.length);
  const handle = ours[0]?.hnd ?? 60;
  const w: [Scheme, number][] = [
    ['man', 0.42],
    ['sag', clamp(0.14 + (70 - shooting) / 60, 0.06, 0.4)],
    ['switch', 0.2],
    ['trap', clamp(0.1 + (handle - 72) / 80, 0.05, 0.3)],
  ];
  let x = rand() * w.reduce((a, [, v]) => a + v, 0);
  for (const [k, v] of w) {
    x -= v;
    if (x <= 0) return k;
  }
  return 'man';
}

function unit(v: Pt): Pt {
  const l = Math.hypot(v.cx, v.cz) || 1;
  return { cx: v.cx / l, cz: v.cz / l };
}

function act(b: Body, a: Act, t: number) {
  if (b.act !== a) {
    b.act = a;
    b.actAt = t;
  }
}

/** top speed in feet a second: 14 to 20.5 by speed rating, slowed by tiredness */
export function topSpeed(b: Body, withBall: boolean): number {
  const s = lerp(14, 20.5, rate(b.p.spd, 30, 99)) * lerp(0.86, 1, b.energy);
  return withBall ? s * lerp(0.86, 0.95, rate(b.p.hnd)) : s;
}

function accelOf(b: Body): number {
  return lerp(42, 78, rate(b.p.acc, 30, 99));
}

function steer(b: Body, tx: number, tz: number, speed: number, dt: number) {
  const dx = tx - b.cx;
  const dz = tz - b.cz;
  const d = Math.hypot(dx, dz);
  const want = d < 0.05 ? { x: 0, z: 0 } : { x: (dx / d) * Math.min(speed, d * 5), z: (dz / d) * Math.min(speed, d * 5) };
  const a = accelOf(b) * dt;
  b.vx += clamp(want.x - b.vx, -a, a);
  b.vz += clamp(want.z - b.vz, -a, a);
}

function move(b: Body, dt: number) {
  b.cx = clamp(b.cx + b.vx * dt, -6, MAX_CX);
  b.cz = clamp(b.cz + b.vz * dt, -MAX_CZ, MAX_CZ);
  if (b.h > 0 || b.vh > 0) {
    b.h += b.vh * dt;
    b.vh -= 34 * dt;
    if (b.h <= 0) {
      b.h = 0;
      b.vh = 0;
      if (b.bumped) {
        // the and-one: he absorbed the contact and lands off balance
        b.bumped = false;
        b.act = 'stumble';
      }
    }
  }
}

function end(p: Possession, kind: EndKind, points: number, text: string, who: number) {
  if (p.end) return;
  p.end = { kind, points, text, who };
  p.events.push('end:' + kind);
}

/** The defender nearest a point among those in front of the shooter (between him and the rim). */
function closest(p: Possession, at: Body): { d: Body; r: number } {
  let best = p.bodies[5];
  let r = 99;
  const toRim = unit({ cx: RIM.cx - at.cx, cz: RIM.cz - at.cz });
  for (const d of p.bodies) {
    if (d.side !== 'D') continue;
    const dx = d.cx - at.cx;
    const dz = d.cz - at.cz;
    const ahead = dx * toRim.cx + dz * toRim.cz;
    // a man behind him counts for less: a contest from the side or behind is weaker
    const x = Math.hypot(dx, dz) + (ahead < 0 ? 2.2 : 0);
    if (x < r) {
      r = x;
      best = d;
    }
  }
  return { d: best, r };
}

/** How open a man is: his space from the nearest defender. */
export function openness(p: Possession, b: Body): number {
  let r = 99;
  for (const d of p.bodies) if (d.side === 'D') r = Math.min(r, dist(d, b) + (p.t < d.stunUntil ? 4 : 0));
  return r;
}

/**
 * The contest on a shooter right now: the closest defender's distance, made tighter by his reach
 * over the shooter (height and leap) and his perimeter defense, looser if he's stumbling.
 */
export function contestOf(p: Possession, s: Body): Contest {
  const { d, r } = closest(p, s);
  if (p.t < d.stunUntil) return r < 3 ? 'light' : 'open';
  const reach = (d.p.ht - s.p.ht) / 12 + (d.p.vrt - s.p.vrt) / 120 + (d.h > 1 ? 0.6 : 0);
  const clampDef = has(d.p, 'clamps') ? 0.6 : 0;
  const eff = r - reach * 0.7 - clampDef - (d.p.prd - 60) / 60;
  if (eff >= 4.6) return 'open';
  if (eff >= 2.9) return 'light';
  if (eff >= 1.2) return 'heavy';
  return 'smothered';
}

const CONTESTS: Contest[] = ['open', 'light', 'heavy', 'smothered'];

/**
 * A closeout from far off arrives late: a man who had 6 feet or more when the shooter went up can
 * at most get a light hand up, 4 or more a heavy one. Catch-and-shoot and a step-back pay off.
 */
function closeoutCap(c: Contest, room: number | undefined): Contest {
  if (room === undefined) return c;
  const cap = room >= 6 ? 1 : room >= 4 ? 2 : 3;
  return CONTESTS[Math.min(CONTESTS.indexOf(c), cap)];
}

/** How much of the green window a contest leaves, and what it does to a release outside it. */
const CONTEST_WINDOW: Record<Contest, number> = { open: 1, light: 0.7, heavy: 0.4, smothered: 0.15 };
const CONTEST_MAKE: Record<Contest, number> = { open: 1, light: 0.84, heavy: 0.52, smothered: 0.3 };
/** at the rim a hand in the face matters less than on a jumper: the window shrinks less, and so
 * does a finish's chance */
const RIM_WINDOW: Record<Contest, number> = { open: 1, light: 0.85, heavy: 0.65, smothered: 0.45 };
const RIM_MAKE: Record<Contest, number> = { open: 1, light: 0.93, heavy: 0.8, smothered: 0.66 };

/** The rating that matters for a shot from here. */
function shotRating(b: Body, kind: ShotKind): number {
  const p = b.p;
  return kind === 'three' ? p.thr : kind === 'mid' ? p.mid : kind === 'close' ? p.cls : kind === 'layup' ? p.lay : p.ddk;
}

function shotKindAt(b: Body): ShotKind {
  const d = dist(b, RIM);
  if (isThree(b)) return 'three';
  if (d > 14) return 'mid';
  return 'close';
}

/** The widest jump-shot half-window (seconds), an elite shooter's when open. */
export const GREEN_W = 0.038;

/**
 * Half the green window (seconds) for this shooter on this shot under this contest. Arcade: a good
 * open shooter's window is wide; a poor shooter's is a sliver; deep threes past his range shrink it.
 */
export function greenWindow(p: Possession, b: Body, kind: ShotKind, contest: Contest): number {
  const r = shotRating(b, kind);
  // half-windows in seconds: an elite shooter's is about 36 ms each side open, an 85's about 26, a
  // 70's 13, a 55's next to nothing; layups are kinder. A green always goes in, so this is the game.
  let w = GREEN_W * Math.pow(rate(r, 50, 97), 1.3);
  if (kind === 'layup') w = 0.07 * Math.pow(rate(r, 40, 97), 1.2);
  const d = dist(b, RIM);
  if (kind === 'three' && d > 26) w *= has(b.p, 'limitless') ? 0.92 : lerp(1, 0.4, (d - 26) / 6);
  const cw = (kind === 'layup' ? RIM_WINDOW : CONTEST_WINDOW)[contest];
  w *= has(b.p, 'deadeye') ? 1 - (1 - cw) * 0.5 : cw;
  if (p.fire === b.idx) w *= 1.2;
  return Math.max(0.002, w * lerp(0.85, 1, b.energy));
}

/**
 * What a shot from here is worth to a shooter with release timing of spread `sd` (seconds): the
 * chance it goes in (green or not) times its points. For the AI's choices.
 */
export function shotValue(p: Possession, b: Body, sd: number): { kind: ShotKind; contest: Contest; value: number } {
  const kind = shotKindAt(b);
  const contest = contestOf(p, b);
  const w = greenWindow(p, b, kind, contest);
  // the chance of a green with a normal spread of release timing
  const z = w / Math.max(0.005, sd);
  const pGreen = clamp(1 - 2 * normTail(z), 0, 1);
  const d = dist(b, RIM);
  const rt = shotRating(b, kind);
  let base = kind === 'three' ? lerp(0.16, 0.47, rate(rt, 40, 97)) : kind === 'mid' ? lerp(0.24, 0.53, rate(rt, 40, 97)) : lerp(0.32, 0.6, rate(rt, 40, 97));
  if (kind === 'three' && d > 26) base *= has(b.p, 'limitless') ? 0.92 : lerp(1, 0.5, (d - 26) / 6);
  const miss = base * 0.8 * CONTEST_MAKE[contest];
  const pm = pGreen + (1 - pGreen) * miss;
  return { kind, contest, value: pm * (kind === 'three' ? 3 : 2) };
}

/** A person's thumb on the release: within about 70 ms of the top either way (the live % assumes it). */
const THUMB = 0.07;

/**
 * The live shot %: the chance a shot from here goes in with an ordinary release, as the game shows
 * it under the ball handler (and over an open teammate when you aim a pass). Near the rim, the
 * finish he'd get (layup or dunk), the block risk taken off.
 */
export function shotChance(p: Possession, b: Body): number {
  const d = dist(b, RIM);
  const speed = Math.hypot(b.vx, b.vz);
  const toward = speed > 0.5 ? (b.vx * (RIM.cx - b.cx) + b.vz * (RIM.cz - b.cz)) / (speed * Math.max(d, 0.01)) : 0;
  const contest = contestOf(p, b);
  if (d < 6 || (d < 11 && toward > 0.35 && speed > 6)) {
    const pp = b.p;
    let pm: number;
    if ((pp.ddk >= 68 && speed > 6 && d < 10.5) || (d < 5.5 && pp.sdk >= 72 && speed < 7)) pm = lerp(0.86, 0.97, rate(Math.max(pp.ddk, pp.sdk), 60, 99)) * (contest === 'smothered' ? 0.88 : 1);
    else {
      const pGreen = clamp(greenWindow(p, b, 'layup', contest) / THUMB, 0, 1);
      pm = pGreen + (1 - pGreen) * lerp(0.55, 0.88, rate(pp.lay, 40, 97)) * 0.85 * RIM_MAKE[contest];
    }
    const { d: cd, r: cr } = closest(p, b);
    const block = cr < 3.2 && p.t >= cd.stunUntil ? clamp((cd.p.blk - 50) / 250, 0, 0.3) * ((3.2 - cr) / 3.2) : 0;
    return clamp(pm * (1 - block), 0.02, 0.99);
  }
  const kind = shotKindAt(b);
  const pGreen = clamp(greenWindow(p, b, kind, contest) / THUMB, 0, 1);
  const rt = shotRating(b, kind);
  let base = kind === 'three' ? lerp(0.16, 0.47, rate(rt, 40, 97)) : kind === 'mid' ? lerp(0.24, 0.53, rate(rt, 40, 97)) : lerp(0.32, 0.6, rate(rt, 40, 97));
  if (kind === 'three' && d > 26) base *= has(b.p, 'limitless') ? 0.92 : lerp(1, 0.5, (d - 26) / 6);
  const cm = has(b.p, 'deadeye') ? 1 - (1 - CONTEST_MAKE[contest]) * 0.55 : CONTEST_MAKE[contest];
  return clamp(pGreen + (1 - pGreen) * base * 0.8 * cm, 0.01, 0.99);
}

/** the chance a normal variable is above z */
function normTail(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? q : 1 - q;
}

// ---------- actions ----------

/**
 * SHOOT pressed: a jump shot (the meter starts), or near the rim a finish. What finish is up to
 * his ratings: a dunker throws it down, a posterizer dunks through a defender in his way, anyone
 * else lays it up.
 */
export function pressShoot(p: Possession) {
  if (p.handler === null || p.ball || p.end || p.meter || p.finish) return;
  const b = p.bodies[p.handler];
  const d = dist(b, RIM);
  const speed = Math.hypot(b.vx, b.vz);
  const toward = speed > 0.5 ? (b.vx * (RIM.cx - b.cx) + b.vz * (RIM.cz - b.cz)) / (speed * Math.max(d, 0.01)) : 0;
  if (d < 6 || (d < 11 && toward > 0.35 && speed > 6)) {
    const { d: def, r } = closest(p, b);
    const inWay = r < 4.2 && p.t >= def.stunUntil;
    const pp = b.p;
    let kind: ShotKind = 'layup';
    if (d < 5.5 && pp.sdk >= 72 && speed < 7) kind = 'standdunk';
    if (pp.ddk >= 68 && speed > 6 && d < 10.5) kind = 'dunk';
    if (kind !== 'layup' && inWay) {
      const wall = def.p.blk + (def.p.ht - pp.ht) * 3 > pp.ddk + 8;
      kind = has(pp, 'posterizer') ? 'contact' : wall ? 'layup' : kind;
    }
    p.finish = { kind, t0: p.t, tUp: p.t + (kind === 'standdunk' ? 0.2 : 0.26), target: inWay ? def.idx : null };
    act(b, kind === 'layup' ? 'layup' : kind === 'contact' ? 'contact' : kind === 'standdunk' ? 'standdunk' : 'dunk', p.t);
    p.events.push('gather:' + kind);
    if (kind === 'layup') p.meter = { t0: p.t, top: LAYUP_TOP, green: greenWindow(p, b, 'layup', contestOf(p, b)), kind: 'layup', room: closest(p, b).r };
    return;
  }
  const kind = shotKindAt(b);
  const contest = contestOf(p, b);
  p.meter = { t0: p.t, top: JUMPER_TOP, green: greenWindow(p, b, kind, contest), kind, room: closest(p, b).r };
  act(b, 'shoot', p.t);
  b.vh = 12.5;
  b.h = 0.01;
  b.vx *= 0.25;
  b.vz *= 0.25;
  p.events.push('rise');
  // the nearest defender closes out and goes up with him
  const { d: cd, r } = closest(p, b);
  if (r < 8 && p.t >= cd.stunUntil) {
    act(cd, 'contest', p.t);
    cd.vh = lerp(10, 13.5, rate(cd.p.vrt));
    cd.h = 0.01;
  }
}

/** The top of a jump shot's meter (seconds after SHOOT): the green, and where the drawing puts
 * the release at the height of his jump. A layup's comes sooner. */
export const JUMPER_TOP = 0.52;
export const LAYUP_TOP = 0.42;

/** SHOOT let go: the jump shot (or layup) leaves his hands, timed against the green window. */
export function releaseShoot(p: Possession) {
  const m = p.meter;
  if (!m || p.handler === null || p.end || m.off !== undefined) return;
  const b = p.bodies[p.handler];
  const held = p.t - m.t0;
  const off = held - m.top;
  m.off = clamp(off / 0.25, -1, 1);
  m.greened = Math.abs(off) <= m.green;
  if (m.kind === 'layup') return; // the layup goes up at the top of the finish; its timing is kept
  shoot(p, b, m.kind, m.greened, off, m.green);
}

function shoot(p: Possession, b: Body, kind: ShotKind, greened: boolean, off: number, green: number) {
  const r = p.rand;
  const contest = closeoutCap(contestOf(p, b), p.meter?.room);
  const { d: cd, r: cr } = closest(p, b);
  const d = dist(b, RIM);
  const rt = shotRating(b, kind);
  let base: number;
  if (kind === 'three') base = lerp(0.16, 0.47, rate(rt, 40, 97)) * (d > 26 ? (has(b.p, 'limitless') ? 0.92 : lerp(1, 0.5, (d - 26) / 6)) : 1);
  else if (kind === 'mid') base = lerp(0.24, 0.53, rate(rt, 40, 97));
  else if (kind === 'close') base = lerp(0.32, 0.6, rate(rt, 40, 97));
  else base = lerp(0.42, 0.82, rate(rt, 40, 97));
  const timing = lerp(0.95, 0.33, (Math.abs(off) - green) / 0.22);
  const cm = has(b.p, 'deadeye') ? 1 - (1 - CONTEST_MAKE[contest]) * 0.55 : CONTEST_MAKE[contest];
  // a green always goes in; anything else is the shot's chance by how close the release was
  let pm = greened ? 1 : base * timing * cm;
  if (!greened && p.fire === b.idx) pm *= 1.12;
  pm = greened ? 1 : clamp(pm, 0.02, 0.97);
  // a block on a jump shot: only when he's right on him and long (never a green)
  const blockP = !greened && contest === 'smothered' && kind !== 'layup' ? clamp(0.04 + (cd.p.blk - 60) / 250 + (cd.p.ht - b.p.ht) / 120, 0.02, 0.22) : 0;
  if (r() < blockP && cr < 3.5) {
    act(cd, 'block', p.t);
    // swatted: he comes down off balance
    b.bumped = true;
    loose(p, b, false);
    p.lastShot = { kind, contest, greened, off: clamp(off / 0.25, -1, 1), make: false, p: pm, and1: false };
    p.events.push('blocked:' + cd.idx);
    return;
  }
  const make = r() < pm;
  p.lastShot = { kind, contest, greened, off: clamp(off / 0.25, -1, 1), make, p: pm, and1: false };
  const flight = Math.max(0.55, 0.62 + d * 0.022);
  p.ball = { kind: 'shot', from: { cx: b.cx, cz: b.cz, h: b.h + 8.2 }, to: { cx: RIM.cx, cz: RIM.cz, h: RIM_H }, t0: p.t, t1: p.t + flight, arc: 5 + d * 0.28, who: b.idx, make, points: isThree(b) ? 3 : 2, shot: kind };
  p.handler = null;
  p.meter = null;
  p.events.push(greened ? 'release-green' : 'release');
}

/** the finish at the rim, at the top of his jump */
function finishNow(p: Possession, b: Body, kind: ShotKind) {
  const r = p.rand;
  const contest = contestOf(p, b);
  const { d: cd, r: cr } = closest(p, b);
  const reach = (cd.p.ht - b.p.ht) / 12 + (cd.p.vrt - b.p.vrt) / 100;
  const protector = has(cd.p, 'rim-protector') ? 0.08 : 0;
  // blocks: the closer, the longer and the better a shot blocker he is, and only a man who's set
  // (not stumbling, not beaten a moment ago); never on a green layup
  const set = p.t >= cd.stunUntil && !(cd.beatenAt !== undefined && p.t - cd.beatenAt < 0.6);
  let blockP = cr < 3.2 && set ? clamp((cd.p.blk - 50) / 250 + reach * 0.05 + protector, 0, 0.3) * ((3.2 - cr) / 3.2) : 0;
  if (kind === 'layup' && p.meter?.greened) blockP = 0;
  if (kind === 'dunk' || kind === 'standdunk') blockP *= 0.45;
  if (kind === 'contact') blockP *= 0.3 * lerp(1.3, 0.6, rate(b.p.ddk, 80, 99));
  if (kind === 'oop') blockP *= 0.3;
  if (r() < blockP) {
    act(cd, 'block', p.t);
    cd.vh = 13;
    cd.h = 0.01;
    b.bumped = true;
    loose(p, b, false);
    p.lastShot = { kind, contest, greened: false, off: 0, make: false, p: 0, and1: false };
    p.events.push('blocked:' + cd.idx);
    return;
  }
  let pm: number;
  let greened = false;
  if (kind === 'layup') {
    const m = p.meter;
    const off = m?.off !== undefined ? m.off * 0.25 : 0.2;
    greened = !!m?.greened;
    const base = lerp(0.55, 0.88, rate(b.p.lay, 40, 97));
    pm = greened ? 1 : base * lerp(0.95, 0.55, (Math.abs(off) - (m?.green ?? 0.05)) / 0.25) * RIM_MAKE[contest];
  } else if (kind === 'contact') pm = lerp(0.74, 0.92, rate(b.p.ddk, 80, 99));
  else if (kind === 'oop') pm = lerp(0.82, 0.96, rate(b.p.ddk, 60, 99));
  else pm = lerp(0.86, 0.97, rate(kind === 'standdunk' ? b.p.sdk : b.p.ddk, 60, 99)) * (contest === 'smothered' ? 0.88 : 1);
  pm = greened ? 1 : clamp(pm, 0.05, 0.99);
  const make = r() < pm;
  // an and-one: contact on the way up, more often the stronger he is
  const contact = cr < 3 && p.t >= cd.stunUntil;
  const and1 = make && contact && r() < (kind === 'contact' ? 0.42 : lerp(0.1, 0.28, rate(b.p.str)));
  p.lastShot = { kind, contest, greened, off: 0, make, p: pm, and1 };
  const dunk = kind !== 'layup';
  p.ball = { kind: 'shot', from: { cx: b.cx, cz: b.cz, h: b.h + 8.6 }, to: { cx: RIM.cx, cz: RIM.cz, h: RIM_H }, t0: p.t, t1: p.t + (dunk ? 0.16 : 0.34), arc: dunk ? 0 : 1.5, who: b.idx, make, points: 2 + (and1 ? 1 : 0), shot: kind };
  if (and1) b.bumped = true;
  if (kind === 'contact' && make && cd) {
    // posterized: knocked back and down under the rim, then he picks himself up
    const away = unit({ cx: cd.cx - b.cx, cz: cd.cz - b.cz });
    cd.vx = away.cx * 9;
    cd.vz = away.cz * 9;
    cd.stunUntil = p.t + 2.2;
    act(cd, 'fall', p.t);
    cd.fallKind = 'posterized';
    p.events.push('posterized:' + cd.idx);
  }
  p.handler = null;
  p.meter = null;
  p.events.push('finish:' + kind + (make ? ':make' : ':miss'));
}

/**
 * Pass to a teammate (or, with none given, to the one the stick points at or the most open). To a
 * dunker cutting to the rim it's a lob: an alley-oop.
 */
export function pass(p: Possession, to: number | null) {
  if (p.handler === null || p.ball || p.end || p.meter || p.finish) return;
  const h = p.bodies[p.handler];
  const target = to ?? p.target ?? bestOpen(p, h);
  if (target === null || target === h.idx) return;
  const rcv = p.bodies[target];
  const dRim = dist(rcv, RIM);
  const cutting = rcv.cutUntil > p.t || (Math.hypot(rcv.vx, rcv.vz) > 8 && (rcv.vx * (RIM.cx - rcv.cx) + rcv.vz * (RIM.cz - rcv.cz)) > 0);
  const oop = dRim < 13 && cutting && rcv.p.ddk >= 74 && rcv.p.vrt >= 60;
  const lead = oop ? { cx: RIM.cx - 1.6 * Math.sign(RIM.cx - rcv.cx || 1), cz: rcv.cz * 0.25 } : { cx: rcv.cx + rcv.vx * 0.3, cz: rcv.cz + rcv.vz * 0.3 };
  const flight = oop ? Math.max(0.55, dist(h, lead) / 30) : Math.max(0.2, dist(h, lead) / 44);
  p.ball = { kind: oop ? 'lob' : 'pass', from: { cx: h.cx, cz: h.cz, h: 4.6 }, to: { cx: lead.cx, cz: lead.cz, h: oop ? RIM_H + 1.5 : 4.4 }, t0: p.t, t1: p.t + flight, arc: oop ? 4 : 0.8, who: target };
  act(h, 'pass', p.t);
  p.handler = null;
  p.passes++;
  p.events.push(oop ? 'lob' : 'pass');
  if (oop) {
    rcv.cutUntil = p.t + 2;
  }
}

function bestOpen(p: Possession, h: Body): number | null {
  let best: number | null = null;
  let score = -1;
  for (const m of p.bodies) {
    if (m.side !== 'O' || m === h) continue;
    const s = openness(p, m) - dist(m, RIM) * 0.08;
    if (s > score) {
      score = s;
      best = m.idx;
    }
  }
  return best;
}

/** The teammate the stick points at (screen direction already turned into court dx, dz). */
export function aimPass(p: Possession, dir: Pt | null): number | null {
  if (p.handler === null) return null;
  const h = p.bodies[p.handler];
  if (!dir || Math.hypot(dir.cx, dir.cz) < 0.3) return bestOpen(p, h);
  const d = unit(dir);
  let best: number | null = null;
  let score = -9;
  for (const m of p.bodies) {
    if (m.side !== 'O' || m === h) continue;
    const v = unit({ cx: m.cx - h.cx, cz: m.cz - h.cz });
    const s = v.cx * d.cx + v.cz * d.cz;
    if (s > score) {
      score = s;
      best = m.idx;
    }
  }
  return score > 0.2 ? best : bestOpen(p, h);
}

/**
 * A crossover: a quick shift that can leave his man stumbling (more with a great handle against a
 * poor defender; an ankle breaker can drop him). A bad handle against a thief risks the ball.
 */
export function crossover(p: Possession, dir: number) {
  if (p.handler === null || p.ball || p.end || p.meter || p.finish) return;
  const h = p.bodies[p.handler];
  if (p.t - lastMove(h) < 1.3) return;
  act(h, 'cross', p.t);
  const r = p.rand;
  const toRim = unit({ cx: RIM.cx - h.cx, cz: RIM.cz - h.cz });
  // a burst across his man
  const side = { cx: -toRim.cz * dir, cz: toRim.cx * dir };
  const burst = topSpeed(h, true) * 0.95;
  h.vx = side.cx * burst + toRim.cx * burst * 0.35;
  h.vz = side.cz * burst + toRim.cz * burst * 0.35;
  const def = p.bodies.find((d) => d.side === 'D' && d.mark === h.idx);
  if (!def || dist(def, h) > 6) return;
  const edge = (h.p.hnd - def.p.prd) / 100;
  const shake = clamp(0.12 + edge * 0.7 + (has(h.p, 'ankle-breaker') ? 0.1 : 0) - (has(def.p, 'clamps') ? 0.1 : 0), 0.04, 0.5);
  if (r() < shake) {
    const dropped = has(h.p, 'ankle-breaker') && r() < 0.22;
    def.stunUntil = p.t + (dropped ? 1.9 : 0.85);
    act(def, dropped ? 'fall' : 'stumble', p.t);
    if (dropped) def.fallKind = 'ankles';
    p.events.push(dropped ? 'ankles:' + def.idx : 'shook:' + def.idx);
  } else if (r() < clamp(0.03 + (def.p.stl - h.p.hnd) / 400, 0.01, 0.1)) {
    end(p, 'steal', 0, 'STRIPPED BY ' + def.p.tag, h.idx);
  }
}

/** The handler's last move, for the shared cool-down between crossovers, step-backs and spins. */
function lastMove(h: Body): number {
  return h.act === 'cross' || h.act === 'stepback' || h.act === 'spin' ? h.actAt : -9;
}

/** Shake his man with a move: by the handle against the defender's perimeter defense. */
function shakeMan(p: Possession, h: Body, bonus: number) {
  const def = p.bodies.find((d) => d.side === 'D' && d.mark === h.idx);
  if (!def || dist(def, h) > 6) return;
  const r = p.rand;
  const edge = (h.p.hnd - def.p.prd) / 100;
  const shake = clamp(0.1 + bonus + edge * 0.7 + (has(h.p, 'ankle-breaker') ? 0.1 : 0) - (has(def.p, 'clamps') ? 0.1 : 0), 0.04, 0.55);
  if (r() < shake) {
    const dropped = has(h.p, 'ankle-breaker') && r() < 0.22;
    def.stunUntil = p.t + (dropped ? 1.9 : 0.85);
    act(def, dropped ? 'fall' : 'stumble', p.t);
    if (dropped) def.fallKind = 'ankles';
    p.events.push(dropped ? 'ankles:' + def.idx : 'shook:' + def.idx);
  } else if (r() < clamp(0.03 + (def.p.stl - h.p.hnd) / 400, 0.01, 0.1)) {
    end(p, 'steal', 0, 'STRIPPED BY ' + def.p.tag, h.idx);
  }
}

/** A step-back: a hop away from his man and the rim, space for the jumper. */
export function stepback(p: Possession) {
  if (p.handler === null || p.ball || p.end || p.meter || p.finish) return;
  const h = p.bodies[p.handler];
  if (p.t - lastMove(h) < 1.3) return;
  act(h, 'stepback', p.t);
  const away = unit({ cx: h.cx - RIM.cx, cz: h.cz - RIM.cz });
  const burst = topSpeed(h, true) * 0.85;
  h.vx = away.cx * burst;
  h.vz = away.cz * burst;
  // his man is caught leaning in: rooted a moment (longer the better the handle against him), and
  // now and then shaken outright; the space is the point
  const def = p.bodies.find((d) => d.side === 'D' && d.mark === h.idx);
  if (def && dist(def, h) < 6 && p.t >= def.stunUntil && !has(def.p, 'clamps')) def.stunUntil = p.t + lerp(0.3, 0.5, rate(h.p.hnd - def.p.prd, -20, 20));
  shakeMan(p, h, -0.02);
}

/** A spin: around his man toward the rim, turning the way `dir` says (+1 his right). */
export function spin(p: Possession, dir: number) {
  if (p.handler === null || p.ball || p.end || p.meter || p.finish) return;
  const h = p.bodies[p.handler];
  if (p.t - lastMove(h) < 1.3) return;
  act(h, 'spin', p.t);
  const toRim = unit({ cx: RIM.cx - h.cx, cz: RIM.cz - h.cz });
  const side = { cx: -toRim.cz * dir, cz: toRim.cx * dir };
  const burst = topSpeed(h, true) * 0.9;
  h.vx = toRim.cx * burst * 0.7 + side.cx * burst * 0.5;
  h.vz = toRim.cz * burst * 0.7 + side.cz * burst * 0.5;
  // a spin beats a man who's up on him more often, and the strong ones bully through
  shakeMan(p, h, 0.04 + (h.p.str - 60) / 600);
}

// ---------- the step ----------

/** The stick past this share of its reach sprints; the stamina a second of it costs, and refills. */
export const SPRINT_AT = 0.92;
const BURST_DRAIN = 0.34;
const BURST_FILL = 0.2;

/**
 * Advance by dt. `stick` is where the handler wants to go, as a court direction (length up to 1),
 * or null to stand.
 */
export function step(p: Possession, dt: number, stick: Pt | null) {
  if (p.end) return;
  p.t += dt;
  const t = p.t;
  const r = p.rand;
  const live = !p.ball || p.ball.kind === 'pass' || p.ball.kind === 'lob';
  if (live) p.clock -= dt;
  for (const b of p.bodies) {
    b.trail.push({ cx: b.cx, cz: b.cz });
    if (b.trail.length > 30) b.trail.shift();
  }
  const handler = p.handler !== null ? p.bodies[p.handler] : null;
  const ballAt: Pt = handler ?? (p.ball ? ballPos(p) : RIM);
  const inside = handler ? dist(handler, RIM) < 14 : false;
  if (!handler) p.sprinting = false;
  // a trap: once the ball's past the top of the key, the nearest man off the ball comes to double it
  // (his own man is left open: the pass out beats it); it ends when the ball moves
  if (p.scheme === 'trap') {
    if (!handler || p.meter || p.finish || p.ball) p.trapper = null;
    else if (p.trapper === null && t > 1.4 && dist(handler, RIM) < 29) {
      let best: Body | null = null;
      for (const d of p.bodies) if (d.side === 'D' && d.mark !== handler.idx && t >= d.stunUntil && (!best || dist(d, handler) < dist(best, handler))) best = d;
      if (best && dist(best, handler) < 18) {
        p.trapper = best.idx;
        p.events.push('trap:' + best.idx);
      }
    }
  }
  // switching: two defenders whose men cross swap them
  if (p.scheme === 'switch' && Math.floor(t * 4) !== Math.floor((t - dt) * 4)) switchMarks(p);

  // the finish at the rim: gather, rise, then it goes up at the top
  if (p.finish && handler) {
    const f = p.finish;
    const b = handler;
    if (t >= f.tUp && b.h === 0 && b.vh === 0) {
      b.vh = f.kind === 'layup' ? 12 : lerp(13, 16, rate(b.p.vrt));
      b.h = 0.01;
      // carry toward the rim
      const toRim = unit({ cx: RIM.cx - b.cx, cz: RIM.cz - b.cz });
      const sp = Math.min(dist(b, RIM) / 0.45, 14);
      b.vx = toRim.cx * sp;
      b.vz = toRim.cz * sp;
      if (f.target !== null) {
        const d = p.bodies[f.target];
        if (t >= d.stunUntil) {
          act(d, 'contest', t);
          d.vh = lerp(10, 13.5, rate(d.p.vrt));
          d.h = 0.01;
        }
      }
    }
    if (b.h > 0 && b.vh <= 1.5 && !p.ball) {
      p.finish = null;
      finishNow(p, b, f.kind);
    }
  }

  for (const b of p.bodies) {
    if (t < b.stunUntil) {
      b.vx *= 0.82;
      b.vz *= 0.82;
      move(b, dt);
      continue;
    }
    if (b === handler) {
      if (p.meter && p.meter.kind !== 'layup') {
        b.vx *= 0.85;
        b.vz *= 0.85;
        // held too long: it goes up on the way down
        if (t - p.meter.t0 > p.meter.top + 0.3 && p.meter.off === undefined) releaseShoot(p);
      } else if (!p.finish) {
        const s = stick && Math.hypot(stick.cx, stick.cz) > 0.12 ? stick : null;
        // the stick at its edge: a sprint while the stamina lasts (faster for a fast man), which
        // refills when he eases off
        const mag = s ? Math.min(1, Math.hypot(s.cx, s.cz)) : 0;
        const sprint = mag >= SPRINT_AT && b.burst > 0.04;
        p.sprinting = sprint;
        b.burst = clamp(b.burst + (sprint ? -BURST_DRAIN : BURST_FILL) * dt, 0, 1);
        const sp = topSpeed(b, true) * (sprint ? lerp(1.12, 1.22, rate(b.p.spd, 30, 99)) : 1);
        const want = s ? { x: (s.cx / mag) * sp * mag, z: (s.cz / mag) * sp * mag } : { x: 0, z: 0 };
        const a = accelOf(b) * dt;
        if (b.act !== 'cross' || t - b.actAt > 0.28) {
          b.vx += clamp(want.x - b.vx, -a, a);
          b.vz += clamp(want.z - b.vz, -a, a);
        }
        const moving = Math.hypot(b.vx, b.vz) > 1.5;
        if (b.act !== 'cross' || t - b.actAt > 0.35) act(b, moving ? 'dribble' : 'dribble', t);
        if (moving) b.face = Math.atan2(b.vz, b.vx);
        else b.face = Math.atan2(RIM.cz - b.cz, RIM.cx - b.cx);
        // into the backcourt is out
        if (b.cx < -1.5) {
          end(p, 'out', 0, 'BACKCOURT', b.idx);
          return;
        }
      }
      move(b, dt);
      continue;
    }
    if (b.side === 'O') {
      offBall(p, b, handler, inside, dt);
      continue;
    }
    defend(p, b, handler, ballAt, inside, dt);
    if (p.end) return;
  }

  // nobody walks through anybody: offense gives way to a defender standing his ground
  for (let i = 0; i < 5; i++) {
    const o = p.bodies[i];
    if (o.h > 2) continue;
    for (let j = 5; j < 10; j++) {
      const d = p.bodies[j];
      if (d.h > 2 || t < d.stunUntil) continue;
      const dx = o.cx - d.cx;
      const dz = o.cz - d.cz;
      const dd = Math.hypot(dx, dz);
      const min = 1.7 * (0.85 + 0.15 * ((o.p.wt + d.p.wt) / 460));
      if (dd < min && dd > 1e-6) {
        const push = (min - dd) / dd;
        const strength = clamp(0.5 + (d.p.str - o.p.str) / 200, 0.25, 0.75);
        o.cx += dx * push * strength;
        o.cz += dz * push * strength;
        d.cx -= dx * push * (1 - strength);
        d.cz -= dz * push * (1 - strength);
      }
    }
  }

  // the ball
  const ball = p.ball;
  if (ball) {
    const k = (t - ball.t0) / (ball.t1 - ball.t0);
    if (ball.kind === 'pass' || ball.kind === 'lob') {
      const at = lerpPt(ball.from, ball.to, k);
      // a defender in the lane gets one look at it
      if (k > 0.3 && k < 0.92) {
        ball.tried ??= [];
        for (const d of p.bodies) {
          if (d.side !== 'D' || t < d.stunUntil || ball.tried.includes(d.idx)) continue;
          if (dist(d, at) < (ball.kind === 'lob' ? 1.1 : 1.4)) {
            ball.tried.push(d.idx);
            const passer = p.bodies.find((b) => b.side === 'O' && b.act === 'pass');
            const dimer = passer && has(passer.p, 'dimer') ? 0.6 : 1;
            if (r() < (0.03 + 0.16 * rate(d.p.stl, 40, 99)) * dimer * (ball.kind === 'lob' ? 0.5 : 1)) {
              end(p, 'int', 0, 'PICKED OFF BY ' + d.p.tag, ball.who);
              return;
            }
          }
        }
      }
      if (t >= ball.t1) {
        const to = p.bodies[ball.who];
        p.ball = null;
        if (ball.kind === 'lob') {
          // the alley-oop: he catches it at the rim and throws it down
          to.cx = ball.to.cx;
          to.cz = ball.to.cz;
          to.h = 5;
          to.vh = 2;
          act(to, 'dunk', t);
          p.handler = to.idx;
          p.events.push('oop-catch');
          finishNow(p, to, 'oop');
        } else {
          p.handler = to.idx;
          to.cutUntil = 0;
          act(to, 'catch', t);
          p.events.push('catch');
        }
      }
    } else if (ball.kind === 'shot' && t >= ball.t1) {
      const shooter = p.bodies[ball.who];
      if (ball.make) {
        const pts = ball.points ?? 2;
        const label = ball.shot === 'contact' ? 'POSTERIZED!' : ball.shot === 'oop' ? 'ALLEY-OOP!' : ball.shot === 'dunk' || ball.shot === 'standdunk' ? 'SLAM!' : pts >= 3 && ball.shot === 'three' ? 'SPLASH!' : 'BUCKET';
        end(p, 'make', pts, label, shooter.idx);
        return;
      }
      p.ball = null;
      loose(p, RIM, true);
    } else if (ball.kind === 'loose' && t >= ball.t1) {
      const side = ball.orb ? 'O' : 'D';
      const grab = p.bodies.filter((b) => b.side === side).sort((a, b) => dist(a, ball.to) - dist(b, ball.to))[0];
      act(grab, 'rebound', t);
      if (side === 'D') {
        end(p, 'miss', 0, 'REBOUND ' + grab.p.tag, -1);
        return;
      }
      grab.cx = ball.to.cx;
      grab.cz = ball.to.cz;
      p.ball = null;
      p.handler = grab.idx;
      p.clock = Math.max(p.clock, 10);
      p.events.push('orb:' + grab.idx);
    }
  }
  if (p.clock <= 0 && live && !p.meter && !p.finish) end(p, 'clock', 0, 'SHOT CLOCK', p.handler ?? -1);
}

function offBall(p: Possession, b: Body, handler: Body | null, inside: boolean, dt: number) {
  const t = p.t;
  const r = p.rand;
  // after a shot, crash the glass (the bigs) or get back
  if (p.ball?.kind === 'shot' || p.ball?.kind === 'loose') {
    const big = b.p.pos === 'C' || b.p.pos === 'PF';
    const tgt = p.ball.kind === 'loose' ? p.ball.to : big ? { cx: RIM.cx - 4, cz: b.cz > 0 ? 3 : -3 } : b.home;
    steer(b, tgt.cx, tgt.cz, topSpeed(b, false) * 0.9, dt);
  } else if (b.cutUntil > t) {
    steer(b, RIM.cx - 2, b.cz > 0 ? 2.5 : -2.5, topSpeed(b, false), dt);
  } else {
    const home = inside && b.p.pos !== 'C' ? nearestDrift(b) : b.home;
    steer(b, home.cx, home.cz, topSpeed(b, false) * 0.62, dt);
    const md = p.bodies.find((d) => d.side === 'D' && d.mark === b.idx);
    // his man's lost him, the ball's outside: cut
    if (md && handler && !inside && dist(handler, RIM) > 16 && (dist(md, b) > 6.5 || t < md.stunUntil) && r() < dt * 0.28 && b.p.pos !== 'PG') {
      b.cutUntil = t + 1.5;
      p.events.push('cut:' + b.idx);
    }
  }
  const moving = Math.hypot(b.vx, b.vz) > 2;
  if (b.act !== 'catch' && b.act !== 'pass' && b.act !== 'rebound') act(b, moving ? 'run' : 'idle', t);
  else if (t - b.actAt > 0.4) act(b, moving ? 'run' : 'idle', t);
  b.face = moving ? Math.atan2(b.vz, b.vx) : handler ? Math.atan2(handler.cz - b.cz, handler.cx - b.cx) : 0;
  move(b, dt);
}

function defend(p: Possession, b: Body, handler: Body | null, ballAt: Pt, inside: boolean, dt: number) {
  const t = p.t;
  const r = p.rand;
  const man = p.bodies[b.mark];
  // a weaker defender reads late
  const lag = Math.round(lerp(14, 4, rate(b.p.prd, 40, 99)) * (60 * dt));
  const seen = man.trail[Math.max(0, man.trail.length - 1 - lag)] ?? man;
  const onBall = man === handler;
  const trapping = p.trapper === b.idx && !!handler;
  const helper = handler && inside && !onBall && !trapping && b === helpDefender(p, handler);
  // beaten off the dribble: his man got by him toward the rim; he turns and chases, slower a moment
  if (onBall && handler && !p.meter && !p.finish) {
    const toRim = unit({ cx: RIM.cx - handler.cx, cz: RIM.cz - handler.cz });
    const ahead = (b.cx - handler.cx) * toRim.cx + (b.cz - handler.cz) * toRim.cz;
    if (ahead < -0.6 && (b.beatenAt === undefined || t - b.beatenAt > 1.2)) b.beatenAt = t;
  }
  const beaten = b.beatenAt !== undefined && t - b.beatenAt < 0.5;
  let target: Pt;
  if (p.ball?.kind === 'loose') target = p.ball.to;
  else if (p.ball?.kind === 'shot') target = { cx: RIM.cx - 4.5, cz: b.cz * 0.5 };
  else if (trapping && handler) {
    // the double: at his shoulder on the side away from the first man
    const side = unit({ cx: handler.cx - man.cx || 1, cz: handler.cz - man.cz });
    target = { cx: handler.cx + side.cx * 2.2 + (RIM.cx - handler.cx) * 0.06, cz: handler.cz + side.cz * 2.2 };
  } else if (helper && handler) target = { cx: handler.cx + (RIM.cx - handler.cx) * 0.4, cz: handler.cz + (RIM.cz - handler.cz) * 0.4 };
  else {
    const toRim = unit({ cx: RIM.cx - seen.cx, cz: RIM.cz - seen.cz });
    // the cushion: a sagging defense plays off a man who can't shoot and packs the paint
    const sagOff = p.scheme === 'sag' ? (onBall ? (man.p.thr < 72 ? 2.2 : 0.8) : 2.4) : 0;
    const gap = (onBall ? lerp(4.4, 2.5, rate(b.p.prd, 40, 99)) : 4.5 + Math.min(4.5, dist(seen, ballAt) * 0.13)) + sagOff;
    const sag = onBall ? { cx: 0, cz: 0 } : unit({ cx: ballAt.cx - seen.cx, cz: ballAt.cz - seen.cz });
    target = { cx: seen.cx + toRim.cx * gap + sag.cx * 1.3, cz: seen.cz + toRim.cz * gap + sag.cz * 1.3 };
  }
  const closing = p.meter && handler && closest(p, handler).d === b;
  steer(b, target.cx, target.cz, topSpeed(b, false) * (closing ? 1.15 : onBall ? 1 : 0.94) * (beaten ? 0.78 : 1), dt);
  move(b, dt);
  if (b.act === 'contest' || b.act === 'block' || b.act === 'stumble') {
    if (t - b.actAt > 0.75 && b.h === 0) act(b, 'defend', t);
  } else act(b, 'defend', t);
  b.face = Math.atan2(ballAt.cz - b.cz, ballAt.cx - b.cx);
  // reaching in on the dribble: a thief against a loose handle
  if ((onBall || trapping) && handler && !p.meter && !p.finish && !p.ball && dist(b, handler) < 2.6) {
    const chance = dt * (trapping ? 0.2 : 0.13) * rate(b.p.stl, 30, 99) * (1.15 - rate(handler.p.hnd, 30, 99));
    if (r() < chance) end(p, 'steal', 0, 'STRIPPED BY ' + b.p.tag, handler.idx);
  }
}

/** A switch: two defenders whose men have come together (a cut past, a crossing) take each other's. */
function switchMarks(p: Possession) {
  const ds = p.bodies.filter((d) => d.side === 'D' && p.t >= d.stunUntil);
  for (let i = 0; i < ds.length; i++)
    for (let j = i + 1; j < ds.length; j++) {
      const a = ds[i];
      const b = ds[j];
      const ma = p.bodies[a.mark];
      const mb = p.bodies[b.mark];
      if (dist(ma, mb) > 6) continue;
      if (dist(a, mb) + dist(b, ma) + 1 < dist(a, ma) + dist(b, mb)) {
        const k = a.mark;
        a.mark = b.mark;
        b.mark = k;
        p.events.push('switch');
      }
    }
}

/** Who steps over to help on a drive: the nearest defender off the ball, shot blockers first. */
function helpDefender(p: Possession, h: Body): Body | null {
  let best: Body | null = null;
  let score = 99;
  for (const d of p.bodies) {
    if (d.side !== 'D' || d.mark === h.idx) continue;
    const s = dist(d, h) - rate(d.p.blk, 40, 99) * 5;
    if (s < score) {
      score = s;
      best = d;
    }
  }
  return score < 12 ? best : null;
}

function nearestDrift(b: Body): Pt {
  return DRIFT.slice().sort((a1, a2) => dist(a1, b) - dist(a2, b))[0];
}

/** A miss (off the rim) or a block: the ball comes loose, and the two sides' rebounding decides whose it is. */
function loose(p: Possession, from: Pt, offRim: boolean) {
  const r = p.rand;
  const best = (side: 'O' | 'D') => Math.max(...p.bodies.filter((b) => b.side === side).map((b) => b.p.reb * (1.15 - dist(b, RIM) / 40)));
  const pOrb = clamp(0.24 + (best('O') - best('D')) / 160 - (offRim ? 0 : 0.06), 0.08, 0.45);
  const ang = (r() - 0.5) * Math.PI * 1.4;
  const len = offRim ? 4 + r() * 8 : 3 + r() * 6;
  const at = { cx: clamp(RIM.cx - Math.cos(ang) * len, 20, MAX_CX - 0.5), cz: clamp(RIM.cz + Math.sin(ang) * len, -22, 22) };
  p.ball = { kind: 'loose', from: { cx: offRim ? RIM.cx : from.cx, cz: offRim ? RIM.cz : from.cz, h: offRim ? RIM_H : 8 }, to: { ...at, h: 0 }, t0: p.t, t1: p.t + 0.8, arc: 3.5, who: -1, orb: r() < pOrb };
  p.handler = null;
  p.meter = null;
  p.finish = null;
  p.events.push(offRim ? 'rim' : 'loose');
}

function lerpPt(a: Pt, b: Pt, k: number): Pt {
  const t = clamp(k, 0, 1);
  return { cx: a.cx + (b.cx - a.cx) * t, cz: a.cz + (b.cz - a.cz) * t };
}

/** The ball's position and height now (in a flight, in a hand, or on the dribble). */
export function ballPos(p: Possession): Pt & { h: number } {
  const b = p.ball;
  if (b) {
    const k = clamp((p.t - b.t0) / (b.t1 - b.t0), 0, 1);
    const base = b.from.h + (b.to.h - b.from.h) * k;
    return { cx: b.from.cx + (b.to.cx - b.from.cx) * k, cz: b.from.cz + (b.to.cz - b.from.cz) * k, h: base + 4 * b.arc * k * (1 - k) };
  }
  if (p.handler !== null) {
    const h = p.bodies[p.handler];
    return { cx: h.cx, cz: h.cz, h: h.h + 4 };
  }
  return { ...RIM, h: RIM_H };
}

/** Is it a three from where he stands (for the HUD). */
export function threeHere(b: Body): boolean {
  return isThree(b);
}
