// One play of arcade football, eleven on eleven, stepped at a fixed rate. Units are yards and
// seconds; x across the field (0 to 53.3), y the yard line from your goal (the far end zone is
// 100 to 110). Your offense attacks up the field; the rival's defenders guard it with their ratings.
//
// Nothing is decided up front: the pass rush is each lineman's moves against his blocker, coverage
// is a corner's man coverage (or a zone defender's read) against a receiver's routes and release, a
// throw's accuracy is the passer's at that distance (worse with a rusher in his face), a catch is
// the receiver's hands against the defender's, and a tackle is the tackler against the runner's
// moves, all rolled when they happen.
import type { Act, Body, Call, Concept, Defense, FbPlayer, Job, Offense, Play, PlayEnd, Pt, RunPlay } from './types';

export const FIELD_W = 53.33;
const HASH_L = 23.58;
const HASH_R = 29.75;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;
/** a rating (0-99) as 0-1 between two marks */
export const rt = (v: number | undefined, lo = 45, hi = 99) => clamp(((v ?? 60) - lo) / (hi - lo), 0, 1);

/** top speed, yards a second: about 6.3 for a slow lineman to 9.6 for a burner */
export function speedOf(p: FbPlayer): number {
  return lerp(6.2, 9.6, rt(p.a.SPD, 40, 99));
}

export const CONCEPTS: Concept[] = ['verts', 'slants', 'smash', 'flood', 'dagger', 'mesh', 'curls', 'posts'];
export const CONCEPT_NAMES: Record<Concept, string> = { verts: 'Four Verticals', slants: 'Slants', smash: 'Smash', flood: 'Flood', dagger: 'Dagger', mesh: 'Mesh', curls: 'Curl Flats', posts: 'Double Post' };
export const RUN_NAMES: Record<RunPlay, string> = { inside: 'Inside Zone', outside: 'Outside Zone', power: 'Power' };

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
    case 'block':
      return { pts: [], sit: true };
    default:
      return { pts: [{ x: 0, y: 6 }] };
  }
}

/** Routes for X (wide left), slot, Z (wide right), the tight end and the back. */
const CONCEPT_ROUTES: Record<Concept, [string, string, string, string, string]> = {
  verts: ['go', 'seam', 'go', 'seam', 'check'],
  slants: ['slant', 'slant', 'slant', 'curl', 'swing'],
  smash: ['curl', 'corner', 'curl', 'out', 'flat'],
  flood: ['go', 'out', 'corner', 'flat', 'check'],
  dagger: ['dig', 'seam', 'curl', 'check', 'flat'],
  mesh: ['drag', 'drag', 'corner', 'curl', 'swing'],
  curls: ['curl', 'flat', 'curl', 'seam', 'flat'],
  posts: ['post', 'curl', 'post', 'drag', 'check'],
};

function body(id: number, side: 'O' | 'D', p: FbPlayer, slot: string, x: number, y: number, job: Job): Body {
  return { id, side, p, slot, x, y, vx: 0, vy: 0, job, act: 'stance', actAt: 0, route: [], sit: false, mark: null, zone: null, heldUntil: 0, stunUntil: 0, breakAt: Infinity, winAt: Infinity, trail: [] };
}

function act(b: Body, a: Act, t: number) {
  if (b.act !== a) {
    b.act = a;
    b.actAt = t;
  }
}

/**
 * Line up a play at the line of scrimmage `los`, the ball at `x` (back to the near hash after a
 * play ends wide). The defense calls man (Cover 1) or zone (Cover 3).
 */
export function lineUp(off: Offense, def: Defense, call: Call, concept: Concept, run: RunPlay, los: number, x: number, rand: () => number): Play {
  const bx = clamp(x, HASH_L, HASH_R);
  const bodies: Body[] = [];
  let id = 0;
  const add = (side: 'O' | 'D', p: FbPlayer, slot: string, px: number, py: number, job: Job) => {
    const b = body(id++, side, p, slot, clamp(px, 1, FIELD_W - 1), py, job);
    b.act = side === 'D' && (job === 'man' || job === 'zone') ? 'backpedal' : 'stance';
    bodies.push(b);
    return b;
  };
  // offense: the line, the tight end on the right, the receivers, the quarterback in the gun
  const OLX = [-2.7, -1.35, 0, 1.35, 2.7];
  const ol = off.ol.map((p, i) => add('O', p, ['LT', 'LG', 'C', 'RG', 'RT'][i], bx + OLX[i], los - 0.6, 'block'));
  const qb = add('O', off.qb, 'QB', bx, los - 5, 'qb');
  const rb = add('O', off.rb, 'RB', bx - 1.7, los - 5.2, 'route');
  // the receivers split wide but inside the numbers, so the camera holds the whole formation
  const X = add('O', off.wr[0], 'X', Math.max(4, bx - 13), los - 0.5, 'route');
  const SL = add('O', off.wr[2], 'SL', bx - 7.5, los - 0.9, 'route');
  const Z = add('O', off.wr[1], 'Z', Math.min(FIELD_W - 4, bx + 13), los - 0.5, 'route');
  const TE = add('O', off.te, 'TE', bx + 4.2, los - 0.8, 'route');
  // defense
  const zone = rand() < 0.4;
  const dl = [
    add('D', def.dl[0], 'LE', bx - 3.9, los + 1, 'rush'),
    add('D', def.dl[1], 'LDT', bx - 0.9, los + 1, 'rush'),
    add('D', def.dl[2], 'RDT', bx + 0.9, los + 1, 'rush'),
    add('D', def.dl[3], 'RE', bx + 4.6, los + 1, 'rush'),
  ];
  const lbW = add('D', def.lb[0], 'WLB', bx - 4.2, los + 4.8, zone ? 'zone' : 'man');
  const lbM = add('D', def.lb[1], 'MLB', bx + 0.3, los + 5.2, 'spy');
  const lbS = add('D', def.lb[2], 'SLB', bx + 4.6, los + 4.6, zone ? 'zone' : 'man');
  const press = (cb: FbPlayer) => (rt(cb.a.PRS) > 0.5 && !zone ? 1.5 : lerp(7.5, 5, rt(cb.a.MCV)));
  const cb1 = add('D', def.cb[0], 'CB1', X.x, los + press(def.cb[0]), zone ? 'zone' : 'man');
  const cb2 = add('D', def.cb[1], 'CB2', Z.x, los + press(def.cb[1]), zone ? 'zone' : 'man');
  const fs = add('D', def.s[0], 'FS', bx, los + 14, 'zone');
  const ss = add('D', def.s[1], 'SS', SL.x + 1, los + 8, zone ? 'zone' : 'man');
  // who covers whom (man), or the zones (Cover 3: corners and the free safety deep thirds, the rest under)
  if (zone) {
    cb1.zone = { x: Math.max(6, X.x - 1), y: los + 18 };
    cb2.zone = { x: Math.min(FIELD_W - 6, Z.x + 1), y: los + 18 };
    fs.zone = { x: FIELD_W / 2, y: los + 20 };
    lbW.zone = { x: bx - 9, y: los + 8 };
    lbS.zone = { x: bx + 9, y: los + 8 };
    ss.zone = { x: SL.x, y: los + 10 };
  } else {
    cb1.mark = X.id;
    cb2.mark = Z.id;
    ss.mark = SL.id;
    lbS.mark = TE.id;
    lbW.mark = rb.id;
    fs.zone = { x: FIELD_W / 2, y: los + 18 };
  }
  lbM.mark = rb.id;
  // the rush: each lineman against his blocker; when he beats him depends on his moves against the pass block
  const blockerOf = [ol[0], ol[1], ol[3], ol[4]];
  dl.forEach((d, i) => {
    const blk = blockerOf[i];
    d.mark = blk.id;
    const move = Math.max(d.p.a.PMV ?? 55, d.p.a.FMV ?? 55);
    const edge = (move - (blk.p.a.PBK ?? 60)) / 100;
    d.winAt = Math.max(1.1, 2.4 - edge * 3 + gauss(rand) * 0.45 + (i === 1 || i === 2 ? 0.25 : 0));
  });
  const play: Play = {
    t: 0,
    call,
    concept,
    run,
    coverage: zone ? 'zone' : 'man',
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
    move: null,
    moveReady: 0,
    slowUntil: 0,
    pressure: 0,
    events: [],
    catcher: null,
    caughtAt: null,
    aim: null,
  };
  // routes (drawn before the snap so the player can read the play)
  const routes = CONCEPT_ROUTES[concept];
  const give = (b: Body, kind: string) => {
    const s = b.x > bx ? 1 : -1;
    const r = routeOf(kind, s, -s);
    b.route = r.pts.map((p) => ({ x: clamp(b.x + p.x, 1.5, FIELD_W - 1.5), y: b.y + p.y }));
    b.sit = !!r.sit;
  };
  give(X, routes[0]);
  give(SL, routes[1]);
  give(Z, routes[2]);
  give(TE, routes[3]);
  give(rb, routes[4]);
  if (call === 'run') {
    for (const b of [X, SL, Z, TE]) {
      b.route = [{ x: b.x, y: b.y + 4 }];
      b.sit = true;
    }
    rb.route = [];
    rb.job = 'handoff';
    // the line fires out: linemen tied up from the snap (longer by a good run blocker)
    dl.forEach((d, i) => {
      const blk = blockerOf[i];
      d.heldUntil = Math.max(0.5, 1.2 + (rt(blk.p.a.RBK) - rt(d.p.a.BSH)) * 1.4 + rand() * 0.4);
    });
    for (const lb of [lbW, lbM, lbS]) lb.heldUntil = lerp(1.0, 0.35, rt(lb.p.a.PRC)) + rand() * 0.3;
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

/** Where a receiver will be in `t` seconds if he runs his route at full speed. */
export function projectRoute(b: Body, t: number): Pt {
  let x = b.x;
  let y = b.y;
  let left = t * speedOf(b.p);
  const pts = b.route;
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

/** How far the quarterback can throw it: 40 yards for a weak arm, 64 for a cannon. */
export function maxThrow(p: Play) {
  return lerp(40, 64, rt(p.qb.p.a.THP, 55, 99));
}

/** The ball's speed in the air (yards a second): a strong arm gets it there sooner. */
function throwSpeed(p: Play) {
  return lerp(17, 26, rt(p.qb.p.a.THP, 55, 99));
}

/** The flight time for a throw of this length (for the slingshot's arc and the AI's lead). */
export function flightTime(p: Play, len: number) {
  return Math.max(0.45, len / throwSpeed(p) + len * 0.006);
}

/**
 * The quarterback throws to a spot (the slingshot's aim). It sails off line by his accuracy at that
 * distance (short, medium, deep), much more with a rusher in his face (unless he's poised under
 * pressure). Whoever can get there goes for it.
 */
export function throwTo(p: Play, to: Pt): boolean {
  if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== p.qb || p.t < 0.3) return false;
  const qb = p.qb;
  const r = p.rand;
  const dx = to.x - qb.x;
  const dy = to.y - qb.y;
  let d = Math.hypot(dx, dy);
  const ang0 = Math.atan2(dy, dx);
  d = Math.min(d, maxThrow(p));
  const a = qb.p.a;
  const accR = d < 12 ? a.SAC : d < 24 ? a.MAC : a.DAC;
  const acc = rt(accR, 50, 99);
  const pressure = p.pressure * (1 - 0.6 * rt(a.TUP, 50, 99));
  const sdAng = (lerp(4.4, 0.9, acc) * (1 + pressure * 1.6) * Math.PI) / 180;
  const sdLen = d * lerp(0.07, 0.022, acc) * (1 + pressure);
  const ang = ang0 + gauss(r) * sdAng;
  const len = Math.max(1.5, d + gauss(r) * sdLen);
  const land = { x: qb.x + Math.cos(ang) * len, y: qb.y + Math.sin(ang) * len };
  const flight = flightTime(p, len);
  p.aim = { x: qb.x + Math.cos(ang0) * d, y: qb.y + Math.sin(ang0) * d };
  p.ball = { from: { x: qb.x, y: qb.y + 0.3 }, to: land, t0: p.t, t1: p.t + flight, peak: Math.min(10, 1.4 + len * 0.18) };
  p.carrier = null;
  p.phase = 'air';
  act(qb, 'throw', p.t);
  p.events.push(pressure > 0.3 ? 'throw-pressure' : 'throw');
  // who goes for it: of the receivers who can get there in time, the one whose route takes him closest
  const eligible = p.bodies.filter((b) => b.side === 'O' && b !== qb && !isLine(b) && dist(b, land) / speedOf(b.p) <= flight + 0.45);
  const target = eligible.sort((x, y) => dist(projectRoute(x, flight), land) - dist(projectRoute(y, flight), land))[0];
  if (target) {
    target.job = 'track';
    target.route = [land];
  }
  for (const b of p.bodies) {
    if (b.side !== 'D') continue;
    const near = dist(b, land);
    if (near < 15 && b.job !== 'rush') {
      // a sharp defender breaks on the ball sooner
      const read = rt(b.p.a.PRC, 45, 99) * 0.5 + rt(b.p.a.ZCV ?? b.p.a.MCV, 45, 99) * 0.5;
      b.breakAt = p.t + lerp(0.55, 0.16, read) + r() * 0.15 + near * 0.012;
    }
  }
  return true;
}

export function isLine(b: Body) {
  return b.slot === 'LT' || b.slot === 'LG' || b.slot === 'C' || b.slot === 'RG' || b.slot === 'RT';
}

/**
 * A move with the ball: a juke (a cut away from the nearest tackler), a spin, a stiff arm or a
 * truck (lowering the shoulder). Each works by the runner's rating for it.
 */
export function moveWithBall(p: Play, kind: 'juke' | 'spin' | 'stiff' | 'truck', dir = 0) {
  const c = p.carrier;
  if (!c || p.phase !== 'run' || p.t < p.moveReady) return;
  const near = p.bodies.filter((b) => b.side === 'D').sort((a, b) => dist(a, c) - dist(b, c))[0];
  const away = near ? Math.sign(c.x - near.x) || 1 : 1;
  p.move = { kind, until: p.t + (kind === 'juke' ? 0.32 : kind === 'spin' ? 0.42 : 0.5), dir: dir || away };
  p.moveReady = p.t + (kind === 'juke' ? 1 : 1.3);
  act(c, kind === 'juke' ? 'juke' : kind === 'spin' ? 'spin' : kind === 'stiff' ? 'stiff' : 'truck', p.t);
  p.events.push('move:' + kind);
}

/** The quarterback tucks it and runs (no throwing after): everyone on defense comes for him. */
export function scramble(p: Play) {
  if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== p.qb || p.t < 0.3) return false;
  const qb = p.qb;
  qb.job = 'carry';
  p.phase = 'run';
  act(qb, 'carry', p.t);
  for (const b of p.bodies) if (b.side === 'D') b.job = 'pursue';
  p.events.push('scramble');
  return true;
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
}

function endPlay(p: Play, kind: PlayEnd['kind'], at: Pt, text: string) {
  if (p.end) return;
  // brought down (or out) past the goal line: the ball broke the plane
  if ((kind === 'tackle' || kind === 'out') && at.y >= 100) {
    kind = 'td';
    text = 'TOUCHDOWN';
  }
  const y = kind === 'td' ? 100 : at.y;
  p.end = { kind, x: at.x, y, gain: Math.round((y - p.los) * 10) / 10, text };
  p.phase = 'dead';
  p.events.push(kind === 'tackle' ? 'tackle' : kind);
}

/**
 * Advance the play by dt. `steer` is where the runner heads across the field (the player's finger),
 * or null to run straight up.
 */
export function step(p: Play, dt: number, steer: number | null) {
  if (p.phase === 'pre' || p.phase === 'dead') return;
  p.t += dt;
  const t = p.t;
  const r = p.rand;
  const qb = p.qb;
  for (const b of p.bodies) {
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 40) b.trail.shift();
  }
  const lagOf = (b: Body) => Math.round(lerp(18, 4, rt(b.p.a.PRC, 45, 99) * 0.4 + rt(b.p.a.MCV ?? b.p.a.ZCV, 45, 99) * 0.6) * (60 * dt));
  const seen = (b: Body, by: Body): Pt => b.trail[Math.max(0, b.trail.length - 1 - lagOf(by))] ?? b;
  const seenVel = (b: Body, by: Body): Pt => {
    const i = Math.max(1, b.trail.length - 1 - lagOf(by));
    const a1 = b.trail[i];
    const a0 = b.trail[i - 1];
    return a1 && a0 ? { x: (a1.x - a0.x) / dt, y: (a1.y - a0.y) / dt } : { x: b.vx, y: b.vy };
  };

  // the handoff
  if (p.call === 'run' && p.carrier === qb) {
    const rb = p.rb;
    const lane = p.run === 'outside' ? (p.rand() < 0.5 ? -1 : 1) : 0;
    steerTo(rb, p.bx + 0.4 + lane * 0.6, p.los - 3.3, speedOf(rb.p) * 0.65, dt);
    steerTo(qb, p.bx - 0.4, p.los - 3.7, 4, dt);
    if (t > 0.42 && dist(rb, qb) < 1.6) {
      p.carrier = rb;
      rb.job = 'carry';
      qb.job = 'idle';
      p.phase = 'run';
      p.events.push('handoff');
      for (const b of p.bodies) if (b.side === 'D') b.job = b.job === 'rush' ? 'rush' : 'pursue';
    }
  }

  // pressure: the nearest free rusher to the quarterback
  if (p.carrier === qb && p.phase === 'drop') {
    let near = 99;
    for (const b of p.bodies) if (b.side === 'D' && b.job === 'rush' && t >= b.winAt) near = Math.min(near, dist(b, qb));
    p.pressure = clamp(1 - (near - 1.2) / 4, 0, 1);
  } else p.pressure = 0;

  const carrier = p.carrier;
  for (const b of p.bodies) {
    if (t < b.stunUntil) {
      b.vx *= 0.85;
      b.vy *= 0.85;
      move(b, dt);
      continue;
    }
    if (b === carrier && p.phase === 'run') {
      // the runner: upfield, cutting toward the finger; a move is its own burst
      const sp = speedOf(b.p) * (t < p.slowUntil ? 0.55 : 0.9);
      const m = p.move && t < p.move.until ? p.move : null;
      if (m?.kind === 'juke') {
        b.vx = m.dir * sp * 1.15;
        b.vy = sp * 0.45;
      } else if (m?.kind === 'spin') {
        b.vx *= 0.9;
        b.vy = sp * 0.6;
      } else {
        const wantX = steer === null ? 0 : clamp((steer - b.x) * 2.2, -sp * 0.65, sp * 0.65);
        const wantY = Math.sqrt(Math.max(0, sp * sp - wantX * wantX)) * (m ? 0.8 : 1);
        b.vx += clamp(wantX - b.vx, -18 * dt, 18 * dt);
        b.vy += clamp(wantY - b.vy, -12 * dt, 12 * dt);
      }
      act(b, m ? (m.kind === 'juke' ? 'juke' : m.kind === 'spin' ? 'spin' : m.kind === 'stiff' ? 'stiff' : 'truck') : 'carry', t);
      move(b, dt);
      continue;
    }
    if (b.side === 'O') {
      offense(p, b, dt);
      continue;
    }
    defense(p, b, dt, seen, seenVel);
    if (p.end) return;
  }

  if (p.phase === 'run' && carrier) {
    if (carrier.y >= 100) endPlay(p, 'td', carrier, 'TOUCHDOWN');
    else if (carrier.x < 0.2 || carrier.x > FIELD_W - 0.2) endPlay(p, 'out', carrier, 'OUT OF BOUNDS');
  }
  if (p.phase === 'air' && p.ball && t >= p.ball.t1) arrive(p);
  if (!p.end && t > 22) endPlay(p, 'tackle', p.carrier ?? qb, 'DOWN');
  void r;
}

function offense(p: Play, b: Body, dt: number) {
  const t = p.t;
  const qb = p.qb;
  if (b === qb) {
    if (p.call === 'pass' && p.carrier === qb) {
      // the drop, then a step up or away from pressure
      steerTo(qb, p.bx, p.los - 6.5, 3, dt);
      act(qb, 'stance', t);
    } else if (p.phase === 'run') steerTo(qb, qb.x, qb.y, 0, dt);
    move(b, dt);
    return;
  }
  if (b.job === 'block' || (p.phase === 'run' && b !== p.carrier && b.job !== 'handoff')) {
    // linemen (and, once someone's running, everyone) block the nearest defender in front
    const target = p.bodies.filter((d) => d.side === 'D' && t >= d.stunUntil && d.y > b.y - 2.5).sort((a1, a2) => dist(a1, b) - dist(a2, b))[0];
    const line = isLine(b);
    if (target) {
      const d = dist(target, b);
      if (d < 1.3 && target.heldUntil < t && b.heldUntil < t && (p.call === 'run' || p.phase === 'run' || !line)) {
        // engaged: held a while by his run blocking (a lineman far longer than a receiver)
        const blk = line ? rt(b.p.a.RBK) : b.slot === 'TE' ? rt(b.p.a.RBK) * 0.7 : 0.15;
        const shed = rt(target.p.a.BSH);
        const hold = Math.max(0.25, (0.9 + blk * 1.1 - shed * 0.8) * (line ? 1 : 0.5) + p.rand() * 0.3);
        target.heldUntil = t + hold;
        b.heldUntil = t + hold + 1.2;
        if (line && b.p.a.IBL >= 85 && p.rand() < 0.12) {
          target.stunUntil = t + 0.8;
          p.events.push('pancake');
        }
      }
      const passPro = p.call === 'pass' && p.phase !== 'run';
      if (passPro && line) steerTo(b, b.x + clamp(target.x - b.x, -0.4, 0.4), Math.max(p.los - 2.8, b.y - 0.02), 1.5, dt);
      else steerTo(b, target.x, target.y - 0.6, speedOf(b.p) * 0.8, dt);
    } else steerTo(b, b.x, b.y + 1, 3, dt);
    act(b, 'block', t);
    move(b, dt);
    return;
  }
  if (b.job === 'handoff') {
    move(b, dt);
    return;
  }
  // receivers: run the route; pressed at the line, a good release gets off clean
  const next = b.route[0];
  const pressed = p.bodies.find((d) => d.side === 'D' && d.mark === b.id && dist(d, b) < 1.6 && t < 1.2);
  const jam = pressed ? lerp(0.55, 0.95, rt(b.p.a.REL) - rt(pressed.p.a.PRS) * 0.6 + 0.5) : 1;
  if (b.job === 'track' && p.ball) {
    const left = Math.max(0.05, p.ball.t1 - t);
    const d = dist(b, p.ball.to);
    steerTo(b, p.ball.to.x, p.ball.to.y, Math.min(speedOf(b.p), Math.max(d / left, speedOf(b.p) * 0.6)), dt, 20);
  } else if (next) {
    steerTo(b, next.x, next.y, speedOf(b.p) * jam, dt, lerp(13, 22, rt(b.p.a.RTE)));
    if (dist(b, next) < 0.8 && (b.route.length > 1 || !b.sit)) {
      const prev = b.route.shift()!;
      if (!b.route.length && !b.sit) {
        const dx = prev.x - b.x;
        const dy = prev.y - b.y;
        const l = Math.hypot(b.vx, b.vy) || 1;
        b.route.push({ x: clamp(b.x + (b.vx / l) * 30 + dx, 1.5, FIELD_W - 1.5), y: b.y + (b.vy / l) * 30 + dy });
      }
    }
  } else steerTo(b, b.x, b.y, 0, dt);
  act(b, Math.hypot(b.vx, b.vy) > 1 ? 'run' : 'stance', t);
  move(b, dt);
}

function defense(p: Play, b: Body, dt: number, seen: (b: Body, by: Body) => Pt, seenVel: (b: Body, by: Body) => Pt) {
  const t = p.t;
  const qb = p.qb;
  const carrier = p.carrier;
  const held = t < b.heldUntil;
  const sp = speedOf(b.p) * (held ? 0.12 : 1);
  if (p.phase === 'run' && carrier) {
    // everyone to the runner: where he is, led by the way he was heading a beat ago
    const v = seenVel(carrier, b);
    const rel = dist(b, carrier);
    const tau = clamp(rel / (sp + 4), 0, 1.1) * lerp(0.7, 1, rt(b.p.a.PUR ?? b.p.a.PRC));
    const lunge = rel < 2 && !held ? 1.3 : 1;
    steerTo(b, carrier.x + v.x * tau, carrier.y + v.y * tau, sp * lunge, dt, 18);
    act(b, held ? 'block' : 'run', t);
    move(b, dt);
    if (!held && dist(b, carrier) < 1.15 && t > b.stunUntil) tackle(p, b, carrier);
    return;
  }
  if (p.phase === 'air' && p.ball && t >= b.breakAt) {
    steerTo(b, p.ball.to.x, p.ball.to.y, sp * 1.05, dt, 22);
    act(b, 'run', t);
    move(b, dt);
    return;
  }
  if (b.job === 'rush') {
    // the pocket holds until he beats his man; on a run he's tied up by the block
    const tx = p.carrier === qb ? qb.x : b.x;
    const ty = p.carrier === qb ? qb.y : b.y;
    const free = p.call === 'pass' ? t >= b.winAt : !held;
    if (free) steerTo(b, tx, ty, speedOf(b.p), dt);
    else steerTo(b, b.x + clamp(tx - b.x, -0.3, 0.3), Math.max(p.los - 1.4, b.y - 0.4), 0.7, dt);
    act(b, free ? 'rush' : 'block', t);
    move(b, dt);
    if (p.carrier === qb && dist(b, qb) < 0.8 && p.phase === 'drop' && p.call === 'pass') {
      endPlay(p, 'sack', qb, 'SACKED BY ' + b.p.tag);
      return;
    }
    return;
  }
  if (b.job === 'man') {
    const m = byId(p, b.mark);
    if (m) {
      // on top of the route, a beat late (less for a shutdown corner), a cushion so he isn't beaten deep
      const at = seen(m, b);
      const deep = at.y - p.los;
      const cover = rt(b.p.a.MCV, 45, 99);
      const burn = clamp((speedOf(m.p) - speedOf(b.p)) / 2.5, -0.5, 1);
      const cushion = lerp(2.8, 1.2, cover) + (deep > 12 ? lerp(1.4, 0.5, cover) + burn * 0.8 : 0);
      steerTo(b, at.x + m.vx * 0.22, Math.max(at.y + cushion, p.los + 0.5), sp, dt, lerp(12, 19, cover));
    }
    act(b, 'backpedal', t);
    move(b, dt);
    return;
  }
  if (b.job === 'zone' && b.zone) {
    // drop to the landmark, then sit on the nearest receiver who comes into the zone
    const z = b.zone;
    const threat = p.bodies.filter((o) => o.side === 'O' && !isLine(o) && o !== qb && dist(o, z) < 9).sort((a1, a2) => dist(a1, z) - dist(a2, z))[0];
    const read = rt(b.p.a.ZCV, 45, 99);
    if (threat && t > 0.6) {
      const at = seen(threat, b);
      steerTo(b, (at.x + z.x) / 2 + (at.x - z.x) * read * 0.4, Math.max(at.y + lerp(2.5, 1.2, read), p.los + 1), sp, dt);
    } else steerTo(b, z.x, z.y, sp * 0.85, dt);
    act(b, 'backpedal', t);
    move(b, dt);
    return;
  }
  if (b.job === 'spy') {
    const m = byId(p, b.mark);
    if (m && m.y > p.los - 1) {
      const at = seen(m, b);
      steerTo(b, at.x, at.y + 1, sp, dt);
    } else steerTo(b, qb.x + (p.bx - qb.x) * 0.5, p.los + 4.5, sp * 0.5, dt);
    act(b, 'backpedal', t);
    move(b, dt);
    return;
  }
  move(b, dt);
}

function tackle(p: Play, d: Body, c: Body) {
  const r = p.rand;
  const m = p.move && p.t < p.move.until + 0.15 ? p.move : null;
  const help = p.bodies.some((o) => o !== d && o.side === 'D' && p.t >= o.stunUntil && p.t >= o.heldUntil && dist(o, c) < 1.6);
  const tak = rt(d.p.a.TAK, 40, 99);
  const btk = rt(c.p.a.BTK, 40, 99);
  let pt = 0.76 + 0.2 * tak - 0.26 * btk + (help ? 0.16 : 0);
  if (m) {
    // the move against this tackler: a juke against his pursuit, a spin, a stiff arm or a truck against his tackling
    const v = m.kind === 'juke' ? c.p.a.JKM : m.kind === 'spin' ? c.p.a.SPM : m.kind === 'stiff' ? c.p.a.SFA : c.p.a.TRK;
    const vs = m.kind === 'juke' ? (d.p.a.PUR ?? d.p.a.TAK) : m.kind === 'truck' ? Math.max(d.p.a.TAK ?? 60, d.p.a.HIT ?? 60) : d.p.a.TAK;
    pt -= 0.18 + (rt(v, 40, 99) - rt(vs, 40, 99)) * 0.45;
  }
  if (r() < clamp(pt, 0.15, 0.96)) {
    // a big hit can jar it loose
    const hit = rt(d.p.a.HIT, 50, 99);
    if (r() < 0.012 + 0.02 * hit - 0.02 * rt(c.p.a.CAR, 50, 99)) {
      endPlay(p, 'fumble', c, 'FUMBLE! ' + d.p.tag + ' FORCES IT');
      return;
    }
    act(c, 'down', p.t);
    act(d, 'tackle', p.t);
    endPlay(p, 'tackle', c, 'TACKLED');
    return;
  }
  // broken: the tackler goes down, the runner stumbles and keeps going
  d.stunUntil = p.t + 0.9;
  d.vx = 0;
  d.vy = 0;
  act(d, 'down', p.t);
  p.slowUntil = p.t + (m?.kind === 'truck' ? 0.2 : 0.3);
  p.events.push(m ? 'beat:' + m.kind : 'break');
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
  const off = p.bodies.filter((b) => b.side === 'O' && b !== p.qb && !isLine(b)).sort((a, b) => dist(a, at) - dist(b, at))[0];
  const def = p.bodies.filter((b) => b.side === 'D' && p.t >= b.stunUntil).sort((a, b) => dist(a, at) - dist(b, at))[0];
  const ro = off ? dist(off, at) : 99;
  const rd = def ? dist(def, at) : 99;
  const hands = rt(off?.p.a.CTH, 45, 99);
  const reach = 1.2 + 0.45 * hands + (off ? (off.p.ht - 72) * 0.03 : 0);
  const dReach = 0.85 + 0.4 * rt(def?.p.a.CTH ?? def?.p.a.MCV, 40, 99);
  if (off && ro <= reach) {
    let pc = 0.78 + 0.19 * hands - (ro > 1 ? 0.12 : 0);
    let pi = 0;
    if (def && rd <= dReach) {
      // contested: the receiver's catch in traffic against the defender's coverage and hands
      const edge = clamp((rd - ro + 0.6) / 1.4, 0, 1);
      const cit = rt(off.p.a.CIT, 45, 99);
      const db = rt(def.p.a.MCV ?? def.p.a.ZCV, 45, 99);
      pc = lerp(0.22, 0.75, edge) * (0.7 + 0.35 * cit) - 0.1 * db;
      pi = rd < ro ? 0.07 + 0.15 * rt(def.p.a.CTH, 40, 99) : 0.02 + 0.05 * rt(def.p.a.CTH, 40, 99);
    }
    const roll = r();
    if (roll < pi) {
      endPlay(p, 'int', at, 'PICKED OFF BY ' + (def?.p.tag ?? ''));
      return;
    }
    if (roll < pi + clamp(pc, 0.08, 0.97)) {
      p.carrier = off;
      off.job = 'carry';
      off.x = at.x;
      off.y = at.y;
      p.catcher = off;
      p.caughtAt = { x: at.x, y: at.y };
      p.phase = 'run';
      p.slowUntil = p.t + 0.33;
      off.vx *= 0.5;
      off.vy *= 0.5;
      act(off, 'catch', p.t);
      p.events.push(def && rd < 1.3 ? 'catch-contested' : 'catch');
      for (const b of p.bodies) if (b.side === 'D') b.job = 'pursue';
      if (off.y >= 100) endPlay(p, 'td', off, 'TOUCHDOWN');
      return;
    }
    endPlay(p, 'incomplete', at, def && rd < 1.6 ? 'BROKEN UP BY ' + def.p.tag : 'DROPPED');
    return;
  }
  if (def && rd <= dReach * 0.9 && r() < 0.2 + 0.25 * rt(def.p.a.CTH, 40, 99)) {
    endPlay(p, 'int', at, 'PICKED OFF BY ' + def.p.tag);
    return;
  }
  endPlay(p, 'incomplete', at, 'INCOMPLETE');
}

/** For drawing: the ball now (position and height in yards). */
export function ballNow(p: Play): (Pt & { h: number }) | null {
  const b = p.ball;
  if (!b) return null;
  const k = clamp((p.t - b.t0) / (b.t1 - b.t0), 0, 1);
  return { x: b.from.x + (b.to.x - b.from.x) * k, y: b.from.y + (b.to.y - b.from.y) * k, h: 1.8 + 4 * b.peak * k * (1 - k) };
}
