// One play of arcade football, stepped in fixed time. Units are yards and seconds. The field runs
// across x (0 to 53.3, the sidelines) and up y (the yard line from your own goal; the far end zone
// is 100 to 110). Your offense goes up the field.
//
// The game decides nothing up front: who's open comes from routes against man coverage that reacts
// a beat late (later against a weak defense), the pass rush from how good the defense is, and a
// throw's accuracy, a catch and a tackle from the players' ratings, rolled at the moment they happen.
import type { Rand } from '../../engine/rng';
import { type Athlete, defenders, type Squad } from './model';

export const FIELD_W = 53.33;
const HASH_L = 23.58;
const HASH_R = 29.75;

export interface Pt {
  x: number;
  y: number;
}

export type Job = 'block' | 'route' | 'rush' | 'man' | 'zone' | 'spy' | 'carry' | 'pursue' | 'qb' | 'idle' | 'track' | 'handoff';

export interface Body {
  id: number;
  side: 'O' | 'D';
  a: Athlete;
  x: number;
  y: number;
  vx: number;
  vy: number;
  job: Job;
  /** route waypoints still to run */
  route: Pt[];
  /** sits at the end of the route (a curl) instead of running on */
  sit: boolean;
  /** the one he covers or blocks */
  mark: number | null;
  /** tied up in a block until then */
  heldUntil: number;
  /** on the ground until then (a missed tackle, a juke) */
  stunUntil: number;
  /** turns to the ball (after a throw) from then */
  breakAt: number;
  stride: number;
  /** recent positions, for defenders reacting to where a receiver was a beat ago */
  trail: Pt[];
}

export type Call = 'pass' | 'run';

export interface Ball {
  from: Pt;
  to: Pt;
  t0: number;
  t1: number;
  peak: number;
}

export type EndKind = 'tackle' | 'incomplete' | 'td' | 'int' | 'sack' | 'out';

export interface PlayEnd {
  kind: EndKind;
  x: number;
  y: number;
  gain: number;
  text: string;
}

export type Concept = 'verts' | 'slants' | 'smash' | 'flood' | 'dagger' | 'mesh';
export const CONCEPTS: Concept[] = ['verts', 'slants', 'smash', 'flood', 'dagger', 'mesh'];
export const CONCEPT_NAMES: Record<Concept, string> = { verts: 'Four Verticals', slants: 'Slants', smash: 'Smash', flood: 'Flood', dagger: 'Dagger', mesh: 'Mesh' };

export interface Play {
  t: number;
  call: Call;
  concept: Concept;
  los: number;
  bx: number;
  bodies: Body[];
  qb: Body;
  rb: Body;
  carrier: Body | null;
  ball: Ball | null;
  phase: 'pre' | 'drop' | 'air' | 'run' | 'dead';
  end: PlayEnd | null;
  rand: Rand;
  /** the defense, 0-1 */
  q: number;
  /** when the rush gets home if the ball's still in the quarterback's hands */
  sackAt: number;
  jukeUntil: number;
  jukeReady: number;
  jukeDir: number;
  slowUntil: number;
  /** what happened this step, for sounds and pop-ups: snap, throw, catch, drop, int, tackle, break, juke, td, sack, out, handoff, deflect */
  events: string[];
  /** who caught it, for the pop-up, and where */
  catcher: Body | null;
  caughtAt: Pt | null;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** a normal-ish random number, mean 0, sd 1 */
const gauss = (r: Rand) => (r() + r() + r() + r() - 2) * 1.732;

/** Route shapes: waypoints from where the receiver lines up. `s` is his side (+1 right), `i` inward. */
function routeOf(kind: string, s: number, i: number): { pts: Pt[]; sit?: boolean } {
  switch (kind) {
    case 'go':
      return { pts: [{ x: 0, y: 45 }] };
    case 'seam':
      return { pts: [{ x: i * 2, y: 12 }, { x: i * 3, y: 45 }] };
    case 'slant':
      return { pts: [{ x: 0, y: 3 }, { x: i * 9, y: 11 }, { x: i * 22, y: 24 }] };
    case 'out':
      return { pts: [{ x: 0, y: 9 }, { x: s * 16, y: 9.5 }] };
    case 'flat':
      return { pts: [{ x: s * 5, y: 1.5 }, { x: s * 14, y: 4 }] };
    case 'swing':
      return { pts: [{ x: s * 4, y: -1 }, { x: s * 13, y: 3 }, { x: s * 15, y: 12 }] };
    case 'dig':
      return { pts: [{ x: 0, y: 13 }, { x: i * 26, y: 14 }] };
    case 'curl':
      return { pts: [{ x: 0, y: 11 }, { x: i * 1.2, y: 9 }], sit: true };
    case 'post':
      return { pts: [{ x: 0, y: 12 }, { x: i * 13, y: 34 }] };
    case 'corner':
      return { pts: [{ x: 0, y: 11 }, { x: s * 11, y: 25 }] };
    case 'drag':
      return { pts: [{ x: i * 3, y: 2.5 }, { x: i * 30, y: 5 }] };
    case 'check':
      return { pts: [{ x: s * 3, y: 4 }], sit: true };
    default:
      return { pts: [{ x: 0, y: 6 }] };
  }
}

/** Each concept's route for the wide receiver, the flex, the tight end and the back. */
const CONCEPT_ROUTES: Record<Concept, [string, string, string, string]> = {
  verts: ['go', 'seam', 'seam', 'flat'],
  slants: ['slant', 'slant', 'curl', 'swing'],
  smash: ['curl', 'corner', 'out', 'flat'],
  flood: ['go', 'out', 'corner', 'flat'],
  dagger: ['dig', 'seam', 'curl', 'check'],
  mesh: ['drag', 'drag', 'corner', 'swing'],
};

function body(id: number, side: 'O' | 'D', a: Athlete, x: number, y: number, job: Job): Body {
  return { id, side, a, x, y, vx: 0, vy: 0, job, route: [], sit: false, mark: null, heldUntil: 0, stunUntil: 0, breakAt: Infinity, stride: 0, trail: [] };
}

/**
 * Line up a play. `los` is the line of scrimmage, `x` where the ball is (it goes back to the near
 * hash after a play ends wide).
 */
export function lineUp(sq: Squad, call: Call, concept: Concept, los: number, x: number, rand: Rand): Play {
  const bx = clamp(x, HASH_L, HASH_R);
  const flexIsBack = sq.flex.role === 'FLEX' && sq.flex.player?.pos[0] === 'RB';
  const bodies: Body[] = [];
  let id = 0;
  const add = (side: 'O' | 'D', a: Athlete, px: number, py: number, job: Job) => {
    const b = body(id++, side, a, clamp(px, 1, FIELD_W - 1), py, job);
    bodies.push(b);
    return b;
  };
  // offense: three linemen, the quarterback in the shotgun, a back beside him, the receivers
  sq.ol.forEach((o, i) => add('O', o, bx + (i - 1) * 1.6, los - 0.6, 'block'));
  const qb = add('O', sq.qb, bx, los - 4.5, 'qb');
  const rb = add('O', sq.rb, bx - 1.6, los - 4.6, 'route');
  const wr = add('O', sq.wr, 7.5, los - 0.5, 'route');
  const te = add('O', sq.te, bx + 4.2, los - 0.8, 'route');
  const flex = flexIsBack ? add('O', sq.flex, bx + 1.6, los - 4.6, 'route') : add('O', sq.flex, FIELD_W - 11, los - 0.6, 'route');
  // defense: three down linemen, a linebacker, two corners, two safeties
  const q = sq.def;
  const d = defenders(sq);
  const dl = [0, 1, 2].map((i) => add('D', d[i], bx + (i - 1) * 2.1, los + 1, 'rush'));
  const lb = add('D', d[3], bx + 0.5, los + 5, 'spy');
  const cb1 = add('D', d[4], wr.x, los + lerp(7, 4, q), 'man');
  const cb2 = add('D', d[5], flexIsBack ? te.x + 1 : flex.x, los + lerp(7, 4.5, q), 'man');
  const s1 = add('D', d[6], flexIsBack ? flex.x : te.x, los + 7.5, 'man');
  add('D', d[7], bx, los + 15, 'zone');
  cb1.mark = wr.id;
  cb2.mark = flexIsBack ? te.id : flex.id;
  s1.mark = flexIsBack ? flex.id : te.id;
  lb.mark = rb.id;
  dl.forEach((x, i) => (x.mark = bodies[i].id));

  const play: Play = {
    t: 0,
    call,
    concept,
    los,
    bx,
    bodies,
    qb,
    rb,
    carrier: qb,
    ball: null,
    phase: 'pre',
    end: null,
    rand,
    q,
    sackAt: lerp(2.7, 1.6, q) + rand() * 0.5,
    jukeUntil: 0,
    jukeReady: 0,
    jukeDir: 0,
    slowUntil: 0,
    events: [],
    catcher: null,
    caughtAt: null,
  };
  // routes (drawn before the snap, so the player can read the play)
  const [rw, rf, rt, rr] = CONCEPT_ROUTES[concept];
  const give = (b: Body, kind: string) => {
    const s = b.x > bx ? 1 : -1;
    const r = routeOf(kind, s, -s);
    b.route = r.pts.map((p) => ({ x: clamp(b.x + p.x, 1.5, FIELD_W - 1.5), y: b.y + p.y }));
    b.sit = !!r.sit;
  };
  give(wr, rw);
  give(flexIsBack ? te : flex, flexIsBack ? rt : rf);
  give(flexIsBack ? flex : te, flexIsBack ? 'check' : rt);
  give(rb, rr);
  if (call === 'run') {
    // receivers run off their men and block; the back takes the handoff
    for (const b of [wr, te, flex]) {
      b.route = [{ x: b.x, y: b.y + 5 }];
      b.sit = true;
    }
    rb.route = [];
    rb.job = 'handoff';
    // the line fires off the ball: the linemen are tied up from the snap, the linebacker a beat later
    for (const d of dl) d.heldUntil = lerp(1.7, 0.85, q) + rand() * 0.45;
    lb.heldUntil = lerp(0.9, 0.3, q) + rand() * 0.3;
  }
  return play;
}

export function snap(p: Play) {
  if (p.phase !== 'pre') return;
  p.phase = 'drop';
  p.events.push('snap');
}

export function byId(p: Play, id: number | null): Body | null {
  return id === null ? null : (p.bodies[id] ?? null);
}

/** Where a receiver will be in `t` seconds if he keeps running his route at full speed. */
export function projectRoute(b: Body, t: number): Pt {
  let x = b.x;
  let y = b.y;
  let left = t * b.a.speed;
  const pts = b.route.length ? b.route : [];
  for (const w of pts) {
    const d = Math.hypot(w.x - x, w.y - y);
    if (d >= left) return { x: x + ((w.x - x) / Math.max(d, 1e-6)) * left, y: y + ((w.y - y) / Math.max(d, 1e-6)) * left };
    left -= d;
    x = w.x;
    y = w.y;
    if (b.sit && w === pts[pts.length - 1]) return { x, y };
  }
  const v = Math.hypot(b.vx, b.vy);
  return v > 0.5 ? { x: x + (b.vx / v) * left, y: y + (b.vy / v) * left } : { x, y };
}

/** How far the quarterback can throw it. */
export function maxThrow(p: Play) {
  return lerp(40, 62, p.qb.a.arm);
}

/**
 * The quarterback throws to a spot. The ball goes a little off line (more for a less accurate
 * passer, and much more with a rusher in his face) and arrives after a flight that depends on his
 * arm. Receivers and defenders who can get there go for it.
 */
export function throwTo(p: Play, to: Pt): boolean {
  if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== p.qb || p.t < 0.25) return false;
  const qb = p.qb;
  const r = p.rand;
  const dx = to.x - qb.x;
  const dy = to.y - qb.y;
  let d = Math.hypot(dx, dy);
  const ang0 = Math.atan2(dy, dx);
  d = Math.min(d, maxThrow(p));
  const pressured = p.bodies.some((b) => b.side === 'D' && b.job === 'rush' && dist(b, qb) < 2.6);
  const acc = qb.a.acc;
  const sdAng = (lerp(4.6, 1.1, acc) * (pressured ? 1.8 : 1) * Math.PI) / 180;
  const sdLen = d * lerp(0.07, 0.025, acc) * (pressured ? 1.5 : 1);
  const ang = ang0 + gauss(r) * sdAng;
  const len = Math.max(1.5, d + gauss(r) * sdLen);
  const land = { x: qb.x + Math.cos(ang) * len, y: qb.y + Math.sin(ang) * len };
  const speed = lerp(17, 25, qb.a.arm);
  const flight = Math.max(0.42, len / speed);
  p.ball = { from: { x: qb.x, y: qb.y + 0.3 }, to: land, t0: p.t, t1: p.t + flight, peak: Math.min(9, 1.2 + len * 0.17) };
  p.carrier = null;
  p.phase = 'air';
  p.events.push(pressured ? 'throw-pressure' : 'throw');
  // who goes for it: of the receivers who can get there in time, the one whose route takes him
  // closest to it
  const eligible = p.bodies.filter((b) => b.side === 'O' && b !== qb && b.a.role !== 'OL' && dist(b, land) / b.a.speed <= flight + 0.4);
  const target = eligible.sort((a, b) => dist(projectRoute(a, flight), land) - dist(projectRoute(b, flight), land))[0];
  if (target) {
    target.job = 'track';
    target.route = [land];
  }
  for (const b of p.bodies) {
    if (b.side !== 'D') continue;
    const near = dist(b, land);
    if (near < 14 && b.job !== 'rush') {
      // a good defense breaks on the ball sooner
      b.breakAt = p.t + lerp(0.55, 0.18, p.q) + r() * 0.15 + near * 0.012;
    }
  }
  return true;
}

/** A quick cut away from the nearest tackler: beats him more often the quicker the runner. */
export function juke(p: Play, dir: number) {
  const c = p.carrier;
  if (!c || p.phase !== 'run' || p.t < p.jukeReady) return;
  const near = p.bodies.filter((b) => b.side === 'D').sort((a, b) => dist(a, c) - dist(b, c))[0];
  p.jukeDir = dir !== 0 ? Math.sign(dir) : near ? Math.sign(c.x - near.x) || 1 : 1;
  p.jukeUntil = p.t + 0.32;
  p.jukeReady = p.t + 1.1;
  p.events.push('juke');
}

function steerTo(b: Body, tx: number, ty: number, speed: number, dt: number, accel = 14) {
  const dx = tx - b.x;
  const dy = ty - b.y;
  const d = Math.hypot(dx, dy);
  const want = d < 0.05 ? { x: 0, y: 0 } : { x: (dx / d) * Math.min(speed, d * 6), y: (dy / d) * Math.min(speed, d * 6) };
  b.vx += clamp(want.x - b.vx, -accel * dt, accel * dt);
  b.vy += clamp(want.y - b.vy, -accel * dt, accel * dt);
}

function move(b: Body, dt: number) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const sp = Math.hypot(b.vx, b.vy);
  b.stride += sp * dt * 1.6;
}

function endPlay(p: Play, kind: EndKind, at: Pt, text: string) {
  if (p.end) return;
  const y = kind === 'td' ? 100 : at.y;
  p.end = { kind, x: at.x, y, gain: Math.round((y - p.los) * 10) / 10, text };
  p.phase = 'dead';
  p.events.push(kind === 'tackle' ? 'tackle' : kind);
}

/**
 * Advance the play by dt. `steer` is where the runner should head across the field (the player's
 * finger), or null to run straight.
 */
export function step(p: Play, dt: number, steer: number | null) {
  if (p.phase === 'pre' || p.phase === 'dead') return;
  p.t += dt;
  const t = p.t;
  const r = p.rand;
  const q = p.q;
  const qb = p.qb;
  for (const b of p.bodies) {
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 40) b.trail.shift();
  }
  // a beat ago, as a defender sees it: a weak defense reads late
  const lagSteps = Math.round(lerp(18, 5, q) * (60 * dt));
  const seen = (b: Body): Pt => b.trail[Math.max(0, b.trail.length - 1 - lagSteps)] ?? b;
  const seenVel = (b: Body): Pt => {
    const i = Math.max(1, b.trail.length - 1 - lagSteps);
    const a1 = b.trail[i];
    const a0 = b.trail[i - 1];
    return a1 && a0 ? { x: (a1.x - a0.x) / dt, y: (a1.y - a0.y) / dt } : { x: b.vx, y: b.vy };
  };

  // the handoff on a run: the back comes across, the quarterback hands it to him
  if (p.call === 'run' && p.carrier === qb) {
    const rb = p.rb;
    steerTo(rb, p.bx + 0.3, p.los - 3.2, rb.a.speed * 0.7, dt);
    steerTo(qb, p.bx - 0.4, p.los - 3.6, 4, dt);
    if (t > 0.42 && dist(rb, qb) < 1.6) {
      p.carrier = rb;
      rb.job = 'carry';
      qb.job = 'idle';
      p.phase = 'run';
      p.events.push('handoff');
      for (const b of p.bodies) if (b.side === 'D') b.job = b.job === 'rush' ? 'rush' : 'pursue';
    }
  }

  const carrier = p.carrier;
  for (const b of p.bodies) {
    if (t < b.stunUntil) {
      b.vx *= 0.85;
      b.vy *= 0.85;
      move(b, dt);
      continue;
    }
    if (b === carrier && p.phase === 'run') {
      // the runner: upfield, cutting toward the player's finger; a juke is a hard sideways burst
      // with the ball he's a step slower than running free
      const slow = t < p.slowUntil ? 0.55 : 0.93;
      const sp = b.a.speed * slow;
      if (t < p.jukeUntil) {
        b.vx = p.jukeDir * sp * 1.15;
        b.vy = sp * 0.45;
      } else {
        // a cut takes him across at most about 40 degrees: a runner keeps going north
        const wantX = steer === null ? 0 : clamp((steer - b.x) * 2.2, -sp * 0.65, sp * 0.65);
        const wantY = Math.sqrt(Math.max(0, sp * sp - wantX * wantX));
        b.vx += clamp(wantX - b.vx, -18 * dt, 18 * dt);
        b.vy += clamp(wantY - b.vy, -12 * dt, 12 * dt);
      }
      move(b, dt);
      continue;
    }
    if (b.side === 'O') {
      if (b === qb) {
        if (p.call === 'pass' && p.carrier === qb) steerTo(qb, p.bx, p.los - 6.5, 3, dt); // the drop
        else if (p.phase === 'run') steerTo(qb, qb.x, qb.y, 0, dt);
        move(b, dt);
        continue;
      }
      if (b.job === 'block' || (p.phase === 'run' && b !== carrier && b.job !== 'handoff')) {
        // linemen (and, once someone's running, everyone) block the nearest defender in front
        const target = p.bodies
          .filter((d) => d.side === 'D' && t >= d.stunUntil && d.y > b.y - 2)
          .sort((a1, a2) => dist(a1, b) - dist(a2, b))[0];
        if (target) {
          const d = dist(target, b);
          if (d < 1.3 && target.heldUntil < t && b.heldUntil < t) {
            // engaged: the defender is held a while (less long by a good defense, and much less by
            // a receiver than a lineman); then the blocker needs a moment to find someone else
            const hold = lerp(1.5, 0.6, q) * (b.a.role === 'OL' ? 1 : 0.45) + r() * 0.3;
            target.heldUntil = t + hold;
            b.heldUntil = t + hold + 1.4;
          }
          const pass = p.call === 'pass' && p.phase !== 'run';
          if (pass && b.a.role === 'OL') steerTo(b, b.x, Math.max(p.los - 2.5, b.y - 0.02), 1.5, dt);
          else steerTo(b, target.x, target.y - 0.6, b.a.speed * 0.8, dt);
        } else steerTo(b, b.x, b.y + 1, 3, dt);
        move(b, dt);
        continue;
      }
      if (b.job === 'handoff') {
        move(b, dt);
        continue;
      }
      // receivers: run the route; on a throw, go get the ball
      const next = b.route[0];
      if (b.job === 'track' && p.ball) {
        const left = Math.max(0.05, p.ball.t1 - t);
        const d = dist(b, p.ball.to);
        steerTo(b, p.ball.to.x, p.ball.to.y, Math.min(b.a.speed, Math.max(d / left, b.a.speed * 0.6)), dt, 20);
      } else if (next) {
        steerTo(b, next.x, next.y, b.a.speed, dt);
        if (dist(b, next) < 0.8) {
          if (b.route.length > 1 || !b.sit) {
            const prev = b.route.shift()!;
            if (!b.route.length && !b.sit) {
              // keep going the way the route was heading
              const dx = prev.x - b.x;
              const dy = prev.y - b.y;
              const l = Math.hypot(b.vx, b.vy) || 1;
              b.route.push({ x: clamp(b.x + (b.vx / l) * 30 + dx, 1.5, FIELD_W - 1.5), y: b.y + (b.vy / l) * 30 + dy });
            }
          }
        }
      } else steerTo(b, b.x, b.y, 0, dt);
      move(b, dt);
      continue;
    }

    // ---- defense ----
    const held = t < b.heldUntil;
    const sp = b.a.speed * (held ? 0.12 : 1);
    if (p.phase === 'run' && carrier) {
      // everyone chases the runner: where he is, led by the way he was heading a beat ago (so a
      // cut fools them for that beat), and a lunge at the end
      const v = seenVel(carrier);
      const rel = dist(b, carrier);
      const tau = clamp(rel / (sp + 4), 0, 1.1) * (0.6 + 0.4 * q);
      const lunge = rel < 1.8 && !held ? 1.25 : 1;
      steerTo(b, carrier.x + v.x * tau, carrier.y + v.y * tau, sp * lunge, dt, 18);
      move(b, dt);
      // the tackle
      if (!held && dist(b, carrier) < 1 && t > b.stunUntil) tackle(p, b, carrier);
      if (p.end) return;
      continue;
    }
    if (p.phase === 'air' && p.ball && t >= b.breakAt) {
      // on the ball
      steerTo(b, p.ball.to.x, p.ball.to.y, sp * 1.05, dt, 22);
      move(b, dt);
      continue;
    }
    if (b.job === 'rush') {
      // the rush: on a pass the line holds the pocket until one rusher beats his man (the middle
      // one first, the others a beat later); on a run the linemen tie them up
      const tx = p.carrier === qb ? qb.x : b.x;
      const ty = p.carrier === qb ? qb.y : b.y;
      const free = p.call === 'pass' ? t >= p.sackAt + (b.mark === 1 ? 0 : 0.45) : !held;
      if (free) steerTo(b, tx, ty, b.a.speed, dt);
      else steerTo(b, b.x + clamp(tx - b.x, -0.3, 0.3), Math.max(p.los - 1.4, b.y - 0.4), 0.7, dt);
      move(b, dt);
      if (p.carrier === qb && dist(b, qb) < 0.8 && p.phase === 'drop' && p.call === 'pass') {
        endPlay(p, 'sack', qb, 'SACKED');
        return;
      }
      continue;
    }
    if (b.job === 'man') {
      // stay with his man, reacting to where he was a beat ago; play a little deeper than him
      const m = byId(p, b.mark);
      if (m) {
        // off coverage: on top of the route, a cushion deep enough not to get beaten over the top
        const at = seen(m);
        const deep = at.y - p.los;
        const cushion = lerp(2.6, 1.3, q) + (deep > 12 ? lerp(1.2, 0.6, q) : 0);
        steerTo(b, at.x + m.vx * 0.22, Math.max(at.y + cushion, p.los + 0.5), sp, dt, lerp(12, 18, q));
      }
      move(b, dt);
      continue;
    }
    if (b.job === 'spy') {
      // the linebacker: on the back if he goes out, else reading the quarterback
      const m = byId(p, b.mark);
      if (m && m.y > p.los - 1) {
        const at = seen(m);
        steerTo(b, at.x, at.y + 1, sp, dt);
      } else steerTo(b, qb.x + (p.bx - qb.x) * 0.5, p.los + 4.5, sp * 0.5, dt);
      move(b, dt);
      continue;
    }
    // the deep safety: over the top of the deepest receiver
    const deep = p.bodies.filter((o) => o.side === 'O' && o.a.role !== 'OL' && o !== qb).sort((a1, a2) => a2.y - a1.y)[0];
    if (deep) steerTo(b, b.x + (seen(deep).x - b.x) * 0.6, Math.max(p.los + 13, seen(deep).y + 4.5), sp * 0.9, dt);
    move(b, dt);
  }

  // out of bounds, the end zone
  if (p.phase === 'run' && carrier) {
    if (carrier.y >= 100) endPlay(p, 'td', carrier, 'TOUCHDOWN');
    else if (carrier.x < 0.2 || carrier.x > FIELD_W - 0.2) endPlay(p, 'out', carrier, 'OUT OF BOUNDS');
  }
  // the ball arrives
  if (p.phase === 'air' && p.ball && t >= p.ball.t1) arrive(p);
  // nobody plays forever
  if (!p.end && t > 22) endPlay(p, 'tackle', p.carrier ?? qb, 'DOWN');
}

function tackle(p: Play, d: Body, c: Body) {
  const r = p.rand;
  const juking = p.t < p.jukeUntil;
  // help: a second defender close by makes the tackle surer
  const help = p.bodies.some((o) => o !== d && o.side === 'D' && p.t >= o.stunUntil && p.t >= o.heldUntil && dist(o, c) < 1.6);
  let pt = 0.66 + 0.26 * p.q - 0.4 * (c.a.power - 0.5) + (help ? 0.18 : 0);
  if (juking) pt -= 0.2 + 0.25 * ((c.a.speed - 7.5) / 2);
  if (r() < clamp(pt, 0.2, 0.95)) {
    endPlay(p, 'tackle', c, 'TACKLED');
    return;
  }
  // broken: the tackler goes down, the runner stumbles and keeps going
  d.stunUntil = p.t + 0.9;
  d.vx = 0;
  d.vy = 0;
  p.slowUntil = p.t + 0.3;
  p.events.push(juking ? 'juke-beat' : 'break');
}

function arrive(p: Play) {
  const ball = p.ball!;
  const r = p.rand;
  const at = ball.to;
  p.ball = null;
  if (at.x < 0 || at.x > FIELD_W || at.y > 110) {
    endPlay(p, 'incomplete', at, 'INCOMPLETE');
    return;
  }
  const off = p.bodies.filter((b) => b.side === 'O' && b !== p.qb && b.a.role !== 'OL').sort((a, b) => dist(a, at) - dist(b, at))[0];
  const def = p.bodies.filter((b) => b.side === 'D' && p.t >= b.stunUntil).sort((a, b) => dist(a, at) - dist(b, at))[0];
  const ro = off ? dist(off, at) : 99;
  const rd = def ? dist(def, at) : 99;
  const reach = 1.25 + 0.45 * (off?.a.hands ?? 0.5);
  const dReach = 0.9 + 0.35 * p.q;
  if (off && ro <= reach) {
    let pc = 0.8 + 0.17 * off.a.hands - (ro > 1 ? 0.12 : 0);
    let pi = 0;
    if (def && rd <= dReach) {
      // contested: the closer the defender, the worse the odds, and he may take it away
      const edge = clamp((rd - ro + 0.6) / 1.4, 0, 1);
      pc = lerp(0.25, 0.75, edge) * (0.75 + 0.3 * off.a.hands) - 0.12 * p.q;
      pi = rd < ro ? 0.18 + 0.22 * p.q : 0.05 + 0.08 * p.q;
    }
    const roll = r();
    if (roll < pi) {
      endPlay(p, 'int', at, 'INTERCEPTED');
      return;
    }
    if (roll < pi + clamp(pc, 0.1, 0.97)) {
      p.carrier = off;
      off.job = 'carry';
      off.x = at.x;
      off.y = at.y;
      p.catcher = off;
      p.caughtAt = { x: at.x, y: at.y };
      p.phase = 'run';
      // securing it and turning upfield takes a moment
      p.slowUntil = p.t + 0.35;
      off.vx *= 0.5;
      off.vy *= 0.5;
      p.events.push(def && rd < 1.3 ? 'catch-contested' : 'catch');
      for (const b of p.bodies) if (b.side === 'D') b.job = 'pursue';
      if (off.y >= 100) endPlay(p, 'td', off, 'TOUCHDOWN');
      return;
    }
    endPlay(p, 'incomplete', at, def && rd < 1.6 ? 'BROKEN UP' : 'DROPPED');
    return;
  }
  if (def && rd <= dReach * 0.9 && r() < 0.32 + 0.3 * p.q) {
    endPlay(p, 'int', at, 'INTERCEPTED');
    return;
  }
  endPlay(p, 'incomplete', at, 'INCOMPLETE');
}
