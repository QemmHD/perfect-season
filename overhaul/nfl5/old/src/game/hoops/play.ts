// One possession of arcade basketball, stepped in fixed time. Units are feet and seconds; the half
// court runs across x (-25 to 25) and down y from the baseline (0) to half court (47). The basket is
// at (0, 5.25). Your five attack it; the rival's five guard them, man to man.
//
// What happens comes from the players: how open a shooter is (his man's quickness and reach, and
// help when you drive), whether a jump shot falls (his real shooting, the release, the contest), a
// steal (the defender's real steal rate against the handler's ball security), a block, a rebound.
import type { Rand } from '../../engine/rng';
import type { Baller } from './model';

export const RIM = { x: 0, y: 5.25 };
export const SHOT_CLOCK = 14;
const HALF_W = 25;
const HALF_L = 47;

export interface Pt {
  x: number;
  y: number;
}

export interface Body {
  id: number;
  side: 'O' | 'D';
  a: Baller;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** off the floor, feet */
  z: number;
  vz: number;
  /** offense: where he's going; defense: the man he guards */
  spot: Pt;
  mark: number;
  /** a cut to the rim until then */
  cutUntil: number;
  /** recent positions, for defenders a beat behind */
  trail: Pt[];
  stride: number;
  /** stumbled (a crossover, a block attempt that missed) until then */
  stunUntil: number;
}

export type EndKind = 'make' | 'miss' | 'steal' | 'int' | 'block' | 'clock';

export interface PossEnd {
  kind: EndKind;
  points: number;
  text: string;
}

export interface Ball {
  kind: 'pass' | 'shot' | 'loose';
  from: Pt & { z: number };
  to: Pt & { z: number };
  t0: number;
  t1: number;
  peak: number;
  /** a pass: who it's to; a shot: who shot it */
  who: number;
  /** a shot: decided at the release */
  make?: boolean;
  points?: number;
  dunk?: boolean;
  /** a miss: whose rebound it is */
  orb?: boolean;
  /** a pass: the defenders who've had their one chance at it */
  tried?: number[];
}

export interface Poss {
  t: number;
  clock: number;
  bodies: Body[];
  handler: Body | null;
  ball: Ball | null;
  /** the handler is in the air on a jump shot since then */
  jumpAt: number | null;
  /** how wide the perfect release is on this shot, seconds either side of the top: a shooter's is wider */
  window: number;
  /** a drive to the rim: layup or dunk on the way */
  attack: boolean;
  end: PossEnd | null;
  events: string[];
  rand: Rand;
  /** how the last shot's release went, for the meter: -1 early, 0 perfect, 1 late */
  release: number | null;
  /** passes and offensive rebounds, for the call */
  passes: number;
  /** every shot: what it was, how open, its chance (for tuning and the box score) */
  shots: { kind: 'three' | 'long' | 'short' | 'layup' | 'dunk'; d: number; room: number; p: number; make: boolean }[];
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Where each spot sets up, and where the bigs go. */
const SETS: Record<string, Pt> = {
  PG: { x: 0, y: 31 },
  SG: { x: -20.5, y: 20 },
  SF: { x: 22.6, y: 5 },
  PF: { x: -8.5, y: 18 },
  C: { x: 6.5, y: 7 },
};
/** spacing spots, all behind the arc, to drift to when the ball goes inside */
const DRIFT: Pt[] = [
  { x: -22.6, y: 4 },
  { x: 22.6, y: 4 },
  { x: -20.5, y: 20 },
  { x: 20.5, y: 20 },
  { x: 0, y: 30.5 },
];

export function isThree(p: Pt): boolean {
  const d = dist(p, RIM);
  if (p.y < 14) return Math.abs(p.x) >= 22;
  return d >= 23.75;
}

function body(id: number, side: 'O' | 'D', a: Baller, at: Pt, mark: number): Body {
  return { id, side, a, x: at.x, y: at.y, vx: 0, vy: 0, z: 0, vz: 0, spot: { ...at }, mark, cutUntil: 0, trail: [], stride: 0, stunUntil: 0 };
}

/** Set up a possession: the point guard brings it up, everyone in his spot, each man guarded. */
export function setUp(ours: Baller[], theirs: Baller[], rand: Rand): Poss {
  const bodies: Body[] = [];
  ours.forEach((a, i) => {
    const s = SETS[a.spot] ?? DRIFT[i];
    bodies.push(body(i, 'O', a, a.spot === 'PG' ? { x: 0, y: 36 } : { x: s.x, y: s.y + 4 }, -1));
  });
  theirs.forEach((a, i) => {
    const man = bodies[i];
    const toRim = norm({ x: RIM.x - man.x, y: RIM.y - man.y });
    bodies.push(body(5 + i, 'D', a, { x: man.x + toRim.x * 4, y: man.y + toRim.y * 4 }, man.id));
  });
  return { t: 0, clock: SHOT_CLOCK, bodies, handler: bodies[0], ball: null, jumpAt: null, window: 0.045, attack: false, end: null, events: [], rand, release: null, passes: 0, shots: [] };
}

function norm(v: Pt): Pt {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

function steer(b: Body, tx: number, ty: number, speed: number, dt: number, accel = 60) {
  const dx = tx - b.x;
  const dy = ty - b.y;
  const d = Math.hypot(dx, dy);
  const want = d < 0.05 ? { x: 0, y: 0 } : { x: (dx / d) * Math.min(speed, d * 5), y: (dy / d) * Math.min(speed, d * 5) };
  b.vx += clamp(want.x - b.vx, -accel * dt, accel * dt);
  b.vy += clamp(want.y - b.vy, -accel * dt, accel * dt);
}

function move(b: Body, dt: number) {
  b.x = clamp(b.x + b.vx * dt, -HALF_W + 0.8, HALF_W - 0.8);
  b.y = clamp(b.y + b.vy * dt, 0.6, HALF_L - 0.5);
  b.stride += Math.hypot(b.vx, b.vy) * dt * 0.55;
  if (b.z > 0 || b.vz > 0) {
    b.z += b.vz * dt;
    b.vz -= 32 * dt;
    if (b.z <= 0) {
      b.z = 0;
      b.vz = 0;
    }
  }
}

function end(p: Poss, kind: EndKind, points: number, text: string) {
  if (p.end) return;
  p.end = { kind, points, text };
  p.events.push(kind);
}

/** the defender guarding a man */
function defenderOf(p: Poss, b: Body): Body | undefined {
  return p.bodies.find((d) => d.side === 'D' && d.mark === b.id);
}

/** The closest defender to a point, and how close. */
function closestD(p: Poss, at: Pt): { d: Body; r: number } {
  let best: Body = p.bodies[5];
  let r = 99;
  for (const d of p.bodies) {
    if (d.side !== 'D') continue;
    const x = dist(d, at);
    if (x < r) {
      r = x;
      best = d;
    }
  }
  return { d: best, r };
}

/** How open a teammate is: his space from the nearest defender. */
export function openness(p: Poss, b: Body): number {
  return closestD(p, b).r;
}

// ---------- actions ----------

/** Pass to a teammate, leading him a little. A defender near the lane may pick it off. */
export function passTo(p: Poss, to: Body) {
  const h = p.handler;
  if (!h || p.ball || p.end || to === h || p.jumpAt !== null) return;
  const flight = Math.max(0.22, dist(h, to) / 42);
  const at = { x: clamp(to.x + to.vx * flight * 0.8, -HALF_W + 1, HALF_W - 1), y: clamp(to.y + to.vy * flight * 0.8, 1, HALF_L - 1) };
  p.ball = { kind: 'pass', from: { x: h.x, y: h.y, z: 4 }, to: { ...at, z: 4 }, t0: p.t, t1: p.t + Math.max(0.22, dist(h, at) / 42), peak: 1.2, who: to.id };
  p.handler = null;
  p.attack = false;
  p.passes++;
  p.events.push('pass');
}

/** The best teammate to pass to in a direction (or the most open one, with no direction). */
export function passTarget(p: Poss, dir: Pt | null): Body | null {
  const h = p.handler;
  if (!h) return null;
  const mates = p.bodies.filter((b) => b.side === 'O' && b !== h);
  if (dir && Math.hypot(dir.x, dir.y) > 0.3) {
    const d = norm(dir);
    let best: Body | null = null;
    let score = -9;
    for (const m of mates) {
      const v = norm({ x: m.x - h.x, y: m.y - h.y });
      const s = v.x * d.x + v.y * d.y;
      if (s > score) {
        score = s;
        best = m;
      }
    }
    if (best && score > 0.3) return best;
  }
  return mates.slice().sort((a, b) => openness(p, b) - openness(p, a))[0] ?? null;
}

/** Go up for a jump shot (or, close to the rim, a layup or a dunk). */
/** How good he is at the shot he's taking from here (0-1). */
function shotSkill(h: Body, d: number): number {
  const a = h.a;
  return isThree(h) ? a.three : d > 15 ? a.mid : (a.mid + a.finish) / 2;
}

export function rise(p: Poss) {
  const h = p.handler;
  if (!h || p.ball || p.end || p.jumpAt !== null) return;
  const d = dist(h, RIM);
  if (d < 7.5) {
    // at the rim: no meter, the finish is in his hands
    finishAtRim(p, h);
    return;
  }
  p.jumpAt = p.t;
  p.window = lerp(0.028, 0.066, shotSkill(h, d));
  h.vz = 13.5;
  h.z = 0.01;
  h.vx *= 0.3;
  h.vy *= 0.3;
  p.events.push('rise');
  // the nearest defender closes out and goes up with him
  const { d: cd, r } = closestD(p, h);
  if (r < 7 && p.t >= cd.stunUntil) {
    cd.vz = 12;
    cd.z = 0.01;
  }
}

/** When to let it go: the top of the jump. */
export const APEX = 13.5 / 32;

/** Let the jump shot go. `early` < 0, `late` > 0; 0 is the top of the jump. */
export function release(p: Poss) {
  const h = p.handler;
  if (!h || p.jumpAt === null || p.ball) return;
  const r = p.rand;
  const held = p.t - p.jumpAt;
  const off = held - APEX;
  p.release = clamp(off / 0.18, -1, 1);
  const perfect = Math.abs(off) < p.window;
  // a good release (just off the top) costs little; a bad one is a brick
  const timing = perfect ? 1.18 : lerp(1.04, 0.45, (Math.abs(off) - p.window) / 0.22);
  const d = dist(h, RIM);
  const three = isThree(h);
  const a = h.a;
  let base: number;
  if (three) base = lerp(0.2, 0.52, a.three) * (d > 26 ? lerp(1, 0.55, (d - 26) / 6) : 1);
  else if (d > 15) base = lerp(0.3, 0.56, a.mid);
  else base = lerp(0.36, 0.62, (a.mid + a.finish) / 2);
  const { d: cd, r: cr } = closestD(p, h);
  const reach = (cd.a.ht - a.ht) / 12;
  const contest = cr >= 5 ? 1 : cr <= 1.8 ? 0.55 - reach * 0.08 : lerp(0.62, 1, (cr - 1.8) / 3.2) - reach * 0.05;
  const moving = Math.hypot(h.vx, h.vy) > 6 ? 0.9 : 1;
  let make = clamp(base * timing * contest * moving, 0.02, 0.93);
  // a block: the closer and the longer he is, the likelier
  const blockP = cr < 3.2 ? clamp(cd.a.block * 0.22 + reach * 0.06, 0, 0.3) * (3.2 - cr) / 3.2 : 0;
  if (r() < blockP) {
    p.events.push('block');
    loose(p, h, false, 'BLOCKED BY ' + cd.a.tag);
    return;
  }
  // a perfect release with room: a shooter's is all but automatic, a big man's still a hope
  if (perfect && cr >= 4) make = Math.max(make, lerp(0.5, 0.86, shotSkill(h, d)));
  const made = r() < make;
  p.shots.push({ kind: three ? 'three' : d > 15 ? 'long' : 'short', d, room: cr, p: make, make: made });
  shootBall(p, h, made, three ? 3 : 2, false);
  p.events.push(perfect ? 'release-perfect' : 'release');
}

function finishAtRim(p: Poss, h: Body) {
  const r = p.rand;
  const a = h.a;
  const { d: cd, r: cr } = closestD(p, h);
  const reach = (cd.a.ht - a.ht) / 12;
  const canDunk = r() < a.dunk * 0.9 && dist(h, RIM) < 6;
  const contest = cr >= 5 ? 1 : lerp(0.68, 1, (cr - 1) / 4) - reach * 0.06;
  const blockP = cr < 3.5 ? clamp(cd.a.block * 0.32 + reach * 0.08, 0, 0.4) * (3.5 - cr) / 3.5 * (canDunk ? 0.4 : 1) : 0;
  h.vz = canDunk ? 15 : 12;
  h.z = 0.01;
  if (r() < blockP) {
    cd.vz = 13;
    cd.z = 0.01;
    p.events.push('block');
    loose(p, h, false, 'STUFFED BY ' + cd.a.tag);
    return;
  }
  const base = canDunk ? 0.94 : lerp(0.52, 0.86, a.finish);
  const pm = clamp(base * contest, 0.1, 0.95);
  const made = r() < pm;
  p.shots.push({ kind: canDunk ? 'dunk' : 'layup', d: dist(h, RIM), room: cr, p: pm, make: made });
  shootBall(p, h, made, 2, canDunk);
  p.events.push(canDunk ? 'dunk' : 'layup');
}

function shootBall(p: Poss, h: Body, make: boolean, points: number, dunk: boolean) {
  const d = dist(h, RIM);
  const flight = dunk ? 0.28 : Math.max(0.45, 0.55 + d * 0.022);
  p.ball = { kind: 'shot', from: { x: h.x, y: h.y, z: h.z + 7 }, to: { x: RIM.x, y: RIM.y, z: 10 }, t0: p.t, t1: p.t + flight, peak: dunk ? 0 : 5 + d * 0.25, who: h.id, make, points, dunk };
  p.handler = null;
  p.jumpAt = null;
  p.attack = false;
}

/** A miss off the rim, or a block: whose ball it is, decided by the two fives' rebounding. */
function loose(p: Poss, from: Pt, offRim: boolean, text: string) {
  const r = p.rand;
  const ourReb = Math.max(...p.bodies.filter((b) => b.side === 'O').map((b) => b.a.reb));
  const theirReb = Math.max(...p.bodies.filter((b) => b.side === 'D').map((b) => b.a.reb));
  const pOrb = clamp(0.25 + 0.3 * (ourReb - theirReb) - (offRim ? 0 : 0.08), 0.08, 0.45);
  const ang = r() * Math.PI;
  const len = offRim ? 5 + r() * 7 : 3 + r() * 6;
  const at = { x: clamp(RIM.x + Math.cos(ang) * len, -22, 22), y: clamp(RIM.y + Math.sin(ang) * len, 2, 30) };
  p.ball = { kind: 'loose', from: { x: offRim ? RIM.x : from.x, y: offRim ? RIM.y : from.y, z: offRim ? 10 : 7 }, to: { ...at, z: 0 }, t0: p.t, t1: p.t + 0.75, peak: 3, who: -1, orb: r() < pOrb };
  p.handler = null;
  p.jumpAt = null;
  p.events.push(offRim ? 'rim' : 'loose');
  if (text) p.events.push('say:' + text);
}

// ---------- the step ----------

/**
 * Advance by dt. `stick` is the joystick (x, y from -1 to 1, up the screen toward the rim is -y),
 * or null.
 */
export function step(p: Poss, dt: number, stick: Pt | null) {
  if (p.end) return;
  p.t += dt;
  const t = p.t;
  const r = p.rand;
  if (!p.ball || p.ball.kind === 'pass') p.clock -= dt;
  for (const b of p.bodies) {
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 24) b.trail.shift();
  }
  const h = p.handler;
  const ballAt: Pt = h ? h : p.ball ? lerpPt(p.ball.from, p.ball.to, (t - p.ball.t0) / (p.ball.t1 - p.ball.t0)) : RIM;
  const inside = h ? dist(h, RIM) < 13 : false;

  for (const b of p.bodies) {
    if (t < b.stunUntil) {
      b.vx *= 0.8;
      b.vy *= 0.8;
      move(b, dt);
      continue;
    }
    if (b === h) {
      if (p.jumpAt !== null) {
        b.vx *= 0.9;
        b.vy *= 0.9;
        // held too long: he has to let it go on the way down
        if (t - p.jumpAt > APEX + 0.32) release(p);
      } else {
        const sp = b.a.speed * 0.92;
        const s = stick && Math.hypot(stick.x, stick.y) > 0.15 ? stick : null;
        const want = s ? { x: s.x * sp, y: s.y * sp } : { x: 0, y: 0 };
        b.vx += clamp(want.x - b.vx, -70 * dt, 70 * dt);
        b.vy += clamp(want.y - b.vy, -70 * dt, 70 * dt);
      }
      move(b, dt);
      continue;
    }
    if (b.side === 'O') {
      // off the ball: to his spot, drifting to space when the ball goes inside; now and then a cut
      if (b.cutUntil > t) steer(b, b.x > 0 ? 2.5 : -2.5, 6.5, b.a.speed * 0.95, dt);
      else {
        const home = inside && b.a.spot !== 'C' && b.a.spot !== 'PF' ? nearestDrift(b) : (SETS[b.a.spot] ?? b.spot);
        steer(b, home.x, home.y, b.a.speed * 0.7, dt);
        const md = defenderOf(p, b);
        // his man's lost him (ball-watching or slow) and the ball's outside: cut
        if (md && h && !inside && dist(h, RIM) > 16 && dist(md, b) > 6.5 && r() < dt * 0.22 && b.a.spot !== 'PG') {
          b.cutUntil = t + 1.4;
          p.events.push('cut');
        }
      }
      move(b, dt);
      continue;
    }
    // ---- defense ----
    const man = p.bodies[b.mark];
    const lag = Math.round(lerp(14, 5, (b.a.steal + b.a.block) / 2) * (60 * dt));
    const seen = man.trail[Math.max(0, man.trail.length - 1 - lag)] ?? man;
    const onBall = man === h;
    // help: a drive into the lane draws the nearest other big off his man
    const helper = h && inside && !onBall && b === helpDefender(p, h);
    let target: Pt;
    if (p.ball?.kind === 'loose') target = p.ball.to;
    else if (helper && h) target = { x: h.x + (RIM.x - h.x) * 0.35, y: h.y + (RIM.y - h.y) * 0.35 };
    else {
      const toRim = norm({ x: RIM.x - seen.x, y: RIM.y - seen.y });
      const gap = onBall ? lerp(3.6, 2.3, (b.a.steal + b.a.block) / 2) : 4.5 + Math.min(4, dist(seen, ballAt) * 0.12);
      // off the ball he sags toward the ball a little
      const sag = onBall ? { x: 0, y: 0 } : norm({ x: ballAt.x - seen.x, y: ballAt.y - seen.y });
      target = { x: seen.x + toRim.x * gap + sag.x * 1.2, y: seen.y + toRim.y * gap + sag.y * 1.2 };
    }
    steer(b, target.x, target.y, b.a.speed * (onBall ? 1.02 : 0.95), dt);
    move(b, dt);
    // reaching in on the dribble
    if (onBall && h && p.jumpAt === null && !p.ball && dist(b, h) < 2.3) {
      const chance = dt * 0.3 * (0.2 + 0.8 * b.a.steal) * (1.2 - h.a.handle);
      if (r() < chance) {
        end(p, 'steal', 0, 'STRIPPED BY ' + b.a.tag);
        return;
      }
    }
  }

  // bodies don't pass through each other: a defender in front stands his ground, the man with the
  // ball has to go around him
  for (let i = 0; i < 5; i++) {
    const o = p.bodies[i];
    if (o.z > 2) continue;
    for (let j = 5; j < 10; j++) {
      const d = p.bodies[j];
      if (d.z > 2 || t < d.stunUntil) continue;
      const dx = o.x - d.x;
      const dy = o.y - d.y;
      const dd = Math.hypot(dx, dy);
      const min = 1.7;
      if (dd < min && dd > 1e-6) {
        const push = (min - dd) / dd;
        // the defender gives a little, the offense more (he's the one moving into him)
        o.x += dx * push * 0.75;
        o.y += dy * push * 0.75;
        d.x -= dx * push * 0.25;
        d.y -= dy * push * 0.25;
      }
    }
  }

  // the ball
  const ball = p.ball;
  if (ball) {
    if (ball.kind === 'pass') {
      // a defender in the lane gets one chance at it (not the man on the passer as it leaves his hands)
      const k = (t - ball.t0) / (ball.t1 - ball.t0);
      const at = lerpPt(ball.from, ball.to, k);
      if (k > 0.25) {
        ball.tried ??= [];
        for (const d of p.bodies) {
          if (d.side !== 'D' || t < d.stunUntil || ball.tried.includes(d.id)) continue;
          if (dist(d, at) < 1.6) {
            ball.tried.push(d.id);
            if (r() < 0.06 + 0.3 * d.a.steal) {
              end(p, 'int', 0, 'PICKED OFF BY ' + d.a.tag);
              return;
            }
          }
        }
      }
      if (t >= ball.t1) {
        const to = p.bodies[ball.who];
        p.ball = null;
        p.handler = to;
        to.cutUntil = 0;
        p.events.push('catch');
      }
    } else if (ball.kind === 'shot' && t >= ball.t1) {
      if (ball.make) {
        end(p, 'make', ball.points ?? 2, ball.dunk ? 'SLAM' : (ball.points ?? 2) === 3 ? 'THREE' : 'BUCKET');
        return;
      }
      p.ball = null;
      loose(p, RIM, true, '');
    } else if (ball.kind === 'loose' && t >= ball.t1) {
      // whoever's side it falls to: the nearest man of that side has it
      const side = ball.orb ? 'O' : 'D';
      const grab = p.bodies.filter((b) => b.side === side).sort((a, b) => dist(a, ball.to) - dist(b, ball.to))[0];
      if (side === 'D') {
        end(p, 'miss', 0, 'REBOUND ' + grab.a.tag);
        return;
      }
      grab.x = ball.to.x;
      grab.y = ball.to.y;
      p.ball = null;
      p.handler = grab;
      p.clock = Math.max(p.clock, 10);
      p.events.push('orb');
    }
  }
  if (p.clock <= 0 && (!p.ball || p.ball.kind === 'pass') && p.jumpAt === null) end(p, 'clock', 0, 'SHOT CLOCK');
}

function lerpPt(a: Pt, b: Pt, k: number): Pt {
  const t = clamp(k, 0, 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function nearestDrift(b: Body): Pt {
  return DRIFT.slice().sort((a1, a2) => dist(a1, b) - dist(a2, b))[0];
}

/** Who steps over to help on a drive: the nearest defender whose man isn't the driver, bigs first. */
function helpDefender(p: Poss, h: Body): Body | null {
  let best: Body | null = null;
  let score = 99;
  for (const d of p.bodies) {
    if (d.side !== 'D' || d.mark === h.id) continue;
    const s = dist(d, h) - (d.a.spot === 'C' || d.a.spot === 'PF' ? 3 : 0);
    if (s < score) {
      score = s;
      best = d;
    }
  }
  return score < 12 ? best : null;
}

/** For drawing: the ball's position and height now. */
export function ballNow(p: Poss): (Pt & { z: number }) | null {
  const b = p.ball;
  if (!b) return null;
  const k = clamp((p.t - b.t0) / (b.t1 - b.t0), 0, 1);
  const base = b.from.z + (b.to.z - b.from.z) * k;
  return { x: b.from.x + (b.to.x - b.from.x) * k, y: b.from.y + (b.to.y - b.from.y) * k, z: base + 4 * b.peak * k * (1 - k) };
}
