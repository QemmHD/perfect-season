// One play of arcade football, eleven on eleven, stepped at a fixed rate. Units are yards and
// seconds; x across the field (0 to 53.3), y the yard line from your goal (the far end zone is
// 100 to 110). Your offense attacks up the field; the rival's defenders guard it with their ratings.
//
// Nothing is decided up front: the pass rush is each lineman's moves against his blocker (the pocket
// closes as they walk their men back), coverage is a corner's man coverage (or a zone defender's
// read) against a receiver's routes and release, a catch is the receiver's hands against the
// defender's, and a tackle is the tackler against the runner's moves, all rolled when they happen.
// A throw goes exactly where it's aimed: the passer's accuracy is how much of the arc he sees
// (Retro Bowl's rule), less with a rusher in his face. Short throws are bullets, long ones lobs.
// On a run the line drives its men away from the play's hole. A tackler winds up before he dives
// (the runner can see it coming), and a juke as he leaves his feet fakes him out.
import type { Act, Body, Call, Concept, Defense, FbPlayer, Job, Move, Offense, Play, PlayEnd, Pt, RunPlay } from './types';

export const FIELD_W = 53.33;
const HASH_L = 23.58;
const HASH_R = 29.75;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;
/** a rating (0-99) as 0-1 between two marks */
export const rt = (v: number | undefined, lo = 45, hi = 99) => clamp(((v ?? 60) - lo) / (hi - lo), 0, 1) + ((v ?? 60) > 99 ? Math.min(11, v! - 99) * .009 : 0);

/** top speed, yards a second: about 6.3 for a slow lineman to 9.6 for a burner */
export function speedOf(p: FbPlayer): number {
  return lerp(6.2, 9.6, rt(p.a.SPD, 40, 99)) + Math.max(0, Math.min(11, (p.a.SPD ?? 60) - 99)) * .045;
}

export const CONCEPTS: Concept[] = ['verts', 'slants', 'smash', 'flood', 'dagger', 'mesh', 'curls', 'posts'];
export const CONCEPT_NAMES: Record<Concept, string> = { verts: 'Four Verticals', slants: 'Slants', smash: 'Smash', flood: 'Flood', dagger: 'Dagger', mesh: 'Mesh', curls: 'Curl Flats', posts: 'Double Post' };
export const RUN_NAMES: Record<RunPlay, string> = { inside: 'Inside Zone', outside: 'Outside Zone', power: 'Power' };
/** where each run's hole is, yards to the right of the ball (toward the tight end): the A gap, off
 * tackle outside the tight end's block, the edge */
export const HOLE: Record<RunPlay, number> = { inside: 0.7, power: 3.4, outside: 6.5 };
/** where the back takes the handoff: deeper and wider the farther out the run goes */
const MESH: Record<RunPlay, Pt> = { inside: { x: 0.4, y: -3.3 }, power: { x: 0.9, y: -3.4 }, outside: { x: 1.7, y: -3.7 } };

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
  return { id, side, p, slot, x, y, vx: 0, vy: 0, job, act: 'stance', actAt: 0, route: [], sit: false, mark: null, zone: null, heldUntil: 0, readUntil: 0, misread: false, stunUntil: 0, breakAt: Infinity, winAt: Infinity, windAt: Infinity, diveAt: -Infinity, dive: null, trail: [] };
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
export function lineUp(off: Offense, def: Defense, call: Call, concept: Concept, run: RunPlay, los: number, x: number, rand: () => number, defIQ = 0): Play {
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
    // Rush wins follow the actual matchup; difficulty improves reads and coverage.
    d.winAt = Math.max(1.85, WIN_AT - edge * 2.5 + gauss(rand) * 0.45 + (i === 1 || i === 2 ? 0.25 : 0));
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
    fire: false,
    stamina: 1,
    used: {},
    hole: bx + HOLE[run],
    defIQ,
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
    // the line fires out: linemen tied up from the snap (longer by a good run blocker), driven away
    // from the hole; the linebackers read their keys a beat before they flow to the ball
    // (now and then a lineman beats his man at the snap and is in the backfield; now and then a
    // linebacker bites the wrong way and opens a cutback)
    dl.forEach((d, i) => {
      const blk = blockerOf[i];
      const edge = rt(d.p.a.BSH) - rt(blk.p.a.RBK);
      d.heldUntil = rand() < clamp(0.03 + edge * 0.2, 0.01, 0.1) ? 0.25 + rand() * 0.2 : Math.max(0.7, 1.65 - edge * 0.7 + rand() * 0.4);
      // his blocker's on him from the snap: once he's off it, it's a while before anyone gets him again
      blk.heldUntil = d.heldUntil + 1.2;
    });
    // the tight end blocks the strong-side linebacker
    TE.route = [];
    TE.job = 'block';
    for (const lb of [lbW, lbM, lbS]) {
      lb.misread = rand() < lerp(0.3, 0.06, rt(lb.p.a.PRC)) * (1 - 0.5 * defIQ);
      lb.readUntil = (lerp(0.9, 0.45, rt(lb.p.a.PRC)) + rand() * 0.3) * (1 - 0.2 * defIQ) + (lb.misread ? 0.45 : 0);
    }
    // the secondary plays the pass until it sees the handoff for what it is
    for (const db of [cb1, cb2, fs, ss]) db.readUntil = (0.45 + lerp(0.7, 0.25, rt(db.p.a.PRC)) + rand() * 0.25) * (1 - 0.2 * defIQ);
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
  return lerp(40, 64, rt(p.qb.p.a.THP, 55, 99)) + Math.max(0, Math.min(11, (p.qb.p.a.THP ?? 60) - 99)) * 0.2;
}

/** when an even pass rusher beats his man, on average (seconds after the snap) */
export const WIN_AT = 3.05;
/** how close (yards in front of the quarterback) the pocket has closed when a rusher wins */
const POCKET = 4.2;

/** The ball's speed in the air (yards a second): a strong arm gets it there sooner, On Fire sooner still. */
function throwSpeed(p: Play) {
  return (lerp(17, 26, rt(p.qb.p.a.THP, 55, 99)) + Math.max(0, Math.min(11, (p.qb.p.a.THP ?? 60) - 99)) * 0.055) * (p.fire ? 1.12 : 1);
}

/** 0 for a bullet (short and flat), 1 for a lob (long and high), blended between. */
export function loft(len: number) {
  return clamp((len - 12) / 18, 0, 1);
}

/** The flight time for a throw of this length (for the slingshot's arc and the AI's lead). */
export function flightTime(p: Play, len: number) {
  return Math.max(0.3, len / (throwSpeed(p) * lerp(1.3, 0.92, loft(len))) + len * 0.006);
}

/** How high the ball rides over its line (yards, at the middle): a bullet barely rises, a lob hangs. */
export function peakOf(len: number) {
  return lerp(0.35 + len * 0.06, Math.min(11, 2 + len * 0.2), loft(len));
}

/** The passer's accuracy (0-1) at this distance, his short, medium and deep accuracy blended. */
function accAt(qb: FbPlayer, len: number) {
  const s = rt(qb.a.SAC, 50, 99);
  const m = rt(qb.a.MAC, 50, 99);
  const d = rt(qb.a.DAC, 50, 99);
  return len <= 6 ? s : len <= 18 ? lerp(s, m, (len - 6) / 12) : len <= 34 ? lerp(m, d, (len - 18) / 16) : d;
}

/**
 * How much of the slingshot's arc the quarterback sees (0-1 of a throw this long): an accurate passer
 * sees it all the way to where it lands; a weaker one only its start (the rest is his guess), and
 * less with a rusher in his face unless he's poised under pressure. On Fire he sees all of it.
 */
export function sight(p: Play, len: number) {
  if (p.fire) return 1;
  const a = p.qb.p.a;
  const calm = 1 - p.pressure * (1 - 0.6 * rt(a.TUP, 50, 99));
  const yards = lerp(8, 56, Math.pow(accAt(p.qb.p, len), 1.1)) * lerp(0.45, 1, calm);
  return clamp(yards / Math.max(1, len), 0.18, 1);
}

/**
 * Bounded throw dispersion in yards, driven by distance accuracy, movement and pressure/poise.
 * The slingshot remains the user's intended spot; the same model drives the preview and the throw.
 */
export function throwErrorRadius(p: Play, len: number): number {
  const accuracy = clamp(accAt(p.qb.p, len), 0, 1);
  const poise = rt(p.qb.p.a.TUP, 50, 99);
  const movement = clamp(Math.hypot(p.qb.vx, p.qb.vy) / 6, 0, 1);
  const eliteTouch = Math.max(0, Math.min(11, (p.qb.p.a.SAC ?? 60) - 99)) * 0.002;
  return Math.min(4.2, 0.12 - eliteTouch + Math.pow(1 - accuracy, 1.5) * (0.65 + len * 0.035)
    + p.pressure * (1 - poise * 0.75) * (0.6 + len * 0.025)
    + movement * (1 - accuracy * 0.6) * 0.6);
}

export function throwTo(p: Play, to: Pt): boolean {
  if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== p.qb || p.t < 0.3) return false;
  const qb = p.qb;
  const r = p.rand;
  const ang = Math.atan2(to.y - qb.y, to.x - qb.x);
  const len = Math.max(1.5, Math.min(Math.hypot(to.x - qb.x, to.y - qb.y), maxThrow(p)));
  const intended = { x: qb.x + Math.cos(ang) * len, y: qb.y + Math.sin(ang) * len };
  const error = throwErrorRadius(p, len);
  // Triangular noise favors the intended spot, stays bounded and never aims the ball at a defender.
  let lateral = (r() - r()) * error, depth = (r() - r()) * error * 0.8;
  const radius = Math.hypot(lateral, depth);
  if (radius > error) { lateral *= error / radius; depth *= error / radius; }
  const land = { x: intended.x - Math.sin(ang) * lateral + Math.cos(ang) * depth, y: intended.y + Math.cos(ang) * lateral + Math.sin(ang) * depth };
  const flight = flightTime(p, len);
  p.aim = intended;
  p.ball = { from: { x: qb.x, y: qb.y + 0.3 }, to: land, t0: p.t, t1: p.t + flight, peak: peakOf(len) };
  p.carrier = null;
  p.phase = 'air';
  act(qb, 'throw', p.t);
  p.events.push(p.pressure > 0.3 ? 'throw-pressure' : 'throw');
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
    if (b.job !== 'rush') {
      // a sharp defender breaks on the ball sooner
      const read = rt(b.p.a.PRC, 45, 99) * 0.5 + rt(b.p.a.ZCV ?? b.p.a.MCV, 45, 99) * 0.5;
      b.breakAt = p.t + lerp(0.42, 0.16, read) * (1 - 0.2 * p.defIQ) + r() * 0.07 + near * 0.005;
    }
  }
  return true;
}

export function isLine(b: Body) {
  return b.slot === 'LT' || b.slot === 'LG' || b.slot === 'C' || b.slot === 'RG' || b.slot === 'RT';
}

/** what each move takes out of the runner, and how fast it comes back (a second's running) */
const DRAIN: Record<Move, number> = { juke: 0.28, spin: 0.34, stiff: 0.3, truck: 0.36 };
const STAMINA_BACK = 0.1;
/** the same move again in a play works this much as well as the last time */
const REPEAT = 0.6;

/** How long a tackler gathers before he dives: a sharp one tips it off for less time. */
export function windupOf(b: Body) {
  return lerp(0.4, 0.24, rt(b.p.a.PRC, 45, 99));
}

/**
 * A move with the ball: a juke (a cut away from the nearest tackler), a spin, a stiff arm or a
 * truck (lowering the shoulder). Each works by the runner's rating for it, less when he's tired
 * and less each time he makes the same one again.
 */
export function moveWithBall(p: Play, kind: Move, dir = 0) {
  const c = p.carrier;
  if (!c || p.phase !== 'run' || p.t < p.moveReady) return;
  const near = p.bodies.filter((b) => b.side === 'D').sort((a, b) => dist(a, c) - dist(b, c))[0];
  const away = near ? Math.sign(c.x - near.x) || 1 : 1;
  const eff = (0.35 + 0.65 * p.stamina) * Math.pow(REPEAT, p.used[kind] ?? 0);
  p.used[kind] = (p.used[kind] ?? 0) + 1;
  p.stamina = Math.max(0, p.stamina - DRAIN[kind]);
  p.move = { kind, at: p.t, until: p.t + (kind === 'juke' ? 0.32 : kind === 'spin' ? 0.42 : 0.5), dir: dir || away, eff, x: c.x, y: c.y, vx: c.vx, vy: c.vy };
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
  const acceleration = accel * lerp(0.7, 1.15, rt(b.p.a.ACC, 40, 99));
  const turn = lerp(0.7, 1.1, rt(b.p.a.AGI, 40, 99));
  const dvx = want.x - b.vx, dvy = want.y - b.vy;
  const delta = Math.hypot(dvx, dvy);
  const scale = Math.min(1, acceleration * turn * dt / Math.max(0.001, delta));
  b.vx += dvx * scale;
  b.vy += dvy * scale;
}

function move(b: Body, dt: number) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

function endPlay(p: Play, kind: PlayEnd['kind'], at: Pt, text: string) {
  if (p.end) return;
  // brought down (or out) past the goal line: the ball broke the plane
  if ((kind === 'tackle' || kind === 'out' || kind === 'fumble') && at.y >= 100) {
    kind = 'td';
    text = 'TOUCHDOWN';
  }
  const y = kind === 'td' ? 100 : at.y;
  p.end = { kind, x: at.x, y, gain: Math.round((y - p.los) * 10) / 10, text, caught: !!p.catcher && kind !== 'int', secs: p.t };
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
    if (b.trail.length > Math.ceil(0.7 / dt)) b.trail.shift();
  }
  const lagOf = (b: Body) => Math.round(lerp(18, 4, rt(b.p.a.PRC, 45, 99) * 0.4 + rt(b.p.a.MCV ?? b.p.a.ZCV, 45, 99) * 0.6) * (1 - 0.25 * p.defIQ) / (60 * dt));
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
    const mesh = MESH[p.run];
    steerTo(rb, p.bx + mesh.x, p.los + mesh.y, speedOf(rb.p) * 0.65, dt);
    steerTo(qb, p.bx - 0.4, p.los - 3.7, 4, dt);
    if (t > 0.42 && dist(rb, qb) < 1.8) {
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
    for (const b of p.bodies) if (b.side === 'D' && b.job === 'rush') near = Math.min(near, dist(b, qb) + Math.max(0, b.winAt - t) * 2);
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
      // the runner: upfield, cutting toward the finger (on a run, through the hole until he's past
      // the line, unless the finger says otherwise); a move is its own burst. Tired, he's a step slower.
      const sp = speedOf(b.p) * (t < p.slowUntil ? 0.55 : 0.94) * lerp(0.9, 1, p.stamina);
      const m = p.move && t < p.move.until ? p.move : null;
      if (!m) p.stamina = Math.min(1, p.stamina + STAMINA_BACK * dt);
      const followingRun = steer === null && p.call === 'run' && b === p.rb && b.y < p.los + 1;
      // An outside handoff stretches behind the line before turning upfield. A constant forward
      // velocity used to drag every run into the tackle box, even when its arrow pointed outside.
      const stretching = followingRun && p.run === 'outside' && b.x < p.hole - 0.8;
      const landmark = stretching ? { x: p.hole, y: p.los - 0.1 } : null;
      const aim = steer ?? (followingRun ? p.hole : null);
      if (m?.kind === 'juke') {
        b.vx = m.dir * sp * (0.8 + 0.35 * m.eff);
        b.vy = sp * 0.45;
      } else if (m?.kind === 'spin') {
        b.vx *= 0.9;
        b.vy = sp * 0.6;
      } else {
        const len = landmark ? Math.max(0.1, dist(b, landmark)) : 1;
        const wantX = landmark ? ((landmark.x - b.x) / len) * sp : aim === null ? 0 : clamp((aim - b.x) * 2.2, -sp * 0.65, sp * 0.65);
        const wantY = (landmark ? Math.max(0, ((landmark.y - b.y) / len) * sp) : Math.sqrt(Math.max(0, sp * sp - wantX * wantX))) * (m ? 0.8 : 1);
        const turn = lerp(11, 21, rt(b.p.a.AGI, 40, 99)) * dt;
        const acceleration = lerp(8, 15, rt(b.p.a.ACC, 40, 99)) * dt;
        b.vx += clamp(wantX - b.vx, -turn, turn);
        b.vy += clamp(wantY - b.vy, -acceleration, acceleration);
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
  if (p.phase === 'air' && p.ball) {
    if (t >= p.ball.t1) arrive(p);
    else playPassingLane(p, dt);
  }
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
    // linemen (and, once someone's running, everyone) block the nearest defender in front; on a run
    // the center climbs to the middle linebacker and the tight end takes the strong-side one
    const climbTo = p.call === 'run' ? (b.slot === 'C' ? 'MLB' : b.slot === 'TE' ? 'SLB' : null) : null;
    const climb = climbTo ? p.bodies.find((d) => d.slot === climbTo && t >= d.stunUntil) : undefined;
    // Keep each tackle/guard on the front defender he was assigned at the snap. Nearest-man
    // selection let both guards chase one DT while another defender escaped untouched.
    const assigned = p.call === 'run' && isLine(b) && !climbTo ? p.bodies.find(d => d.side === 'D' && d.mark === b.id && t < d.heldUntil) : undefined;
    const target = assigned ?? climb ?? p.bodies.filter((d) => d.side === 'D' && t >= d.stunUntil && d.y > b.y - 2.5).sort((a1, a2) => dist(a1, b) - dist(a2, b))[0];
    const line = isLine(b);
    if (target) {
      const d = dist(target, b);
      if (d < 1.3 && target.heldUntil < t && b.heldUntil < t && (p.call === 'run' || p.phase === 'run' || !line)) {
        // engaged: held a while by his run blocking (a lineman far longer than a receiver)
        const blk = line || b.slot === 'TE' ? rt(b.p.a.RBK) : 0.15;
        const shed = rt(target.p.a.BSH);
        const hold = Math.max(0.25, (b.slot === 'TE' ? 1.15 + blk * 1.2 - shed * 0.65 : 0.9 + blk * 1.1 - shed * 0.8) * (line || b.slot === 'TE' ? 1 : 0.5) + p.rand() * 0.3);
        target.heldUntil = t + hold;
        b.heldUntil = t + hold + 1.2;
        if (line && b.p.a.IBL >= 85 && p.rand() < 0.12) {
          target.stunUntil = t + 0.8;
          p.events.push('pancake');
        }
      }
      const passPro = p.call === 'pass' && p.phase !== 'run';
      // in pass protection he gives ground to his man, staying between him and the quarterback
      const man = passPro && line ? p.bodies.find((d) => d.mark === b.id && d.job === 'rush' && t < d.winAt) : undefined;
      if (man) steerTo(b, man.x + clamp(qb.x - man.x, -0.3, 0.3), man.y - 0.95, 2.4, dt);
      else if (passPro && line) steerTo(b, b.x + clamp(target.x - b.x, -0.4, 0.4), Math.max(p.los - 2.8, b.y - 0.02), 1.5, dt);
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
  // Before the exchange, read the run keys rather than following the back into the mesh as if
  // he were a pass route. The existing PRC/difficulty reaction window still determines the read.
  if (p.call === 'run' && p.phase === 'drop' && b.job !== 'rush' && t < b.readUntil) {
    steerTo(b, b.misread ? b.x - (p.hole - b.x) * 0.25 : b.x, b.y + 0.5, sp * 0.25, dt);
    act(b, 'backpedal', t);
    move(b, dt);
    return;
  }
  if (p.phase === 'run' && carrier) {
    if (held) {
      // locked up with a blocker (a wind-up he'd started is off): on a run the line drives him off
      // the ball and away from the hole; otherwise he fights to get off it toward the ball
      b.windAt = Infinity;
      if (p.call === 'run' && b.job === 'rush') steerTo(b, b.x + (Math.sign(b.x - p.hole) || 1) * 1.2, b.y + 0.3, 1.3, dt);
      else steerTo(b, carrier.x, carrier.y, sp, dt);
      act(b, 'block', t);
      move(b, dt);
      return;
    }
    if (b.dive) {
      // in the air, committed to where he aimed it
      if (t < b.dive.until) {
        b.vx = b.dive.vx;
        b.vy = b.dive.vy;
        move(b, dt);
        if (dist(b, carrier) < 1.15) tackle(p, b, carrier);
        return;
      }
      // he dove at air: on the turf (faked out by a move timed against his dive, or just missed)
      const m = p.move;
      const faked = m && (m.kind === 'juke' || m.kind === 'spin') && m.at >= b.diveAt - FAKE && m.at <= b.diveAt + 0.15;
      b.dive = null;
      b.stunUntil = t + 0.75;
      b.vx *= 0.3;
      b.vy *= 0.3;
      act(b, 'down', t);
      p.events.push(faked ? 'beat:' + m.kind : 'whiff');
      move(b, dt);
      return;
    }
    // everyone to the runner (a linebacker reads his keys first, shading to the hole): where he is,
    // led by the way he was heading a beat ago
    if (t < b.readUntil) {
      if (b.slot.endsWith('LB')) steerTo(b, b.misread ? b.x - (p.hole - b.x) * 0.6 : (b.x + p.hole) / 2, b.y, sp * (b.misread ? 0.45 : 0.3), dt);
      else steerTo(b, b.x, b.y + 1, sp * 0.3, dt);
      act(b, 'backpedal', t);
      move(b, dt);
      return;
    }
    const v = seenVel(carrier, b);
    const rel = dist(b, carrier);
    const tau = clamp(rel / (sp + 4), 0, 1.1) * lerp(0.7, 1, rt(b.p.a.PUR ?? b.p.a.PRC));
    const winding = b.windAt < Infinity;
    steerTo(b, carrier.x + v.x * tau, carrier.y + v.y * tau, sp * (winding ? 0.85 : 1), dt, 18);
    const closing = ((carrier.x - b.x) * (b.vx - carrier.vx) + (carrier.y - b.y) * (b.vy - carrier.vy)) / Math.max(0.3, rel);
    if (!winding) {
      // close and closing: he gathers to dive (the runner can see it)
      if (rel < WIND_R && closing > 1.5 && t > b.stunUntil) {
        b.windAt = t;
        act(b, 'windup', t);
      } else act(b, 'run', t);
    } else if (rel > WIND_R + 2.5) {
      b.windAt = Infinity;
      act(b, 'run', t);
    } else if (t >= b.windAt + windupOf(b)) {
      // he dives at where the runner's going; fooled by a juke that's just begun, at where he was going
      b.windAt = Infinity;
      const m = p.move && p.move.kind === 'juke' && t - p.move.at < FAKE ? p.move : null;
      const lead = m ? { x: m.x + m.vx * (t - m.at + 0.2), y: m.y + m.vy * (t - m.at + 0.2) } : { x: carrier.x + carrier.vx * 0.2, y: carrier.y + carrier.vy * 0.2 };
      const d = Math.max(0.3, dist(b, lead));
      const ds = lerp(7.5, 9.5, rt(b.p.a.SPD, 40, 99));
      b.dive = { vx: ((lead.x - b.x) / d) * ds, vy: ((lead.y - b.y) / d) * ds, until: t + Math.min(0.42, d / ds + 0.1) };
      b.diveAt = t;
      act(b, 'tackle', t);
      p.events.push('dive');
    }
    move(b, dt);
    // run right into him: no dive needed
    if (dist(b, carrier) < 0.8 && t > b.stunUntil) tackle(p, b, carrier);
    return;
  }
  if (p.phase === 'air' && p.ball && t >= b.breakAt) {
    steerTo(b, p.ball.to.x, p.ball.to.y, sp, dt, 22);
    act(b, 'run', t);
    move(b, dt);
    return;
  }
  if (b.job === 'rush') {
    // the pocket closes: he walks his man back toward the quarterback until he beats him, then he's
    // free; on a run he's tied up by the block
    const tx = p.carrier === qb ? qb.x : b.x;
    const ty = p.carrier === qb ? qb.y : b.y;
    const free = p.call === 'pass' ? t >= b.winAt : !held;
    if (free) steerTo(b, tx, ty, speedOf(b.p), dt);
    else if (p.call === 'pass' && p.carrier === qb) steerTo(b, b.x + clamp(tx - b.x, -0.3, 0.3), lerp(p.los + 0.6, qb.y + POCKET, clamp(t / b.winAt, 0, 1)), 1.8, dt);
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
      const cushion = Math.max(0.8, lerp(2.8, 1.2, cover) - 0.3 * p.defIQ) + (deep > 12 ? lerp(1.4, 0.5, cover) + burn * 0.8 : 0);
      let ty = Math.max(at.y + cushion, p.los + 0.5);
      // lined up off him: while he comes up the field the defender keeps his depth and backpedals,
      // never coming downhill into his man; when the route breaks, he drives on it
      if (m.vy > 2.5 && b.y > ty) ty = Math.min(b.y, at.y + cushion + 7);
      const velocity = seenVel(m, b);
      steerTo(b, at.x + velocity.x * 0.18, ty, sp, dt, lerp(12, 19, cover) + 2 * p.defIQ);
    }
    act(b, 'backpedal', t);
    move(b, dt);
    return;
  }
  if (b.job === 'zone' && b.zone) {
    // drop to the landmark, then sit on the nearest receiver who comes into the zone; a deep third
    // carries the deepest man in his third as far as he goes (nobody gets behind him)
    const z = b.zone;
    const read = clamp(rt(b.p.a.ZCV, 45, 99) + 0.15 * p.defIQ, 0, 1);
    const deep = z.y - p.los >= 15;
    const mine = p.bodies.filter((o) => o.side === 'O' && !isLine(o) && o !== qb && (deep ? Math.abs(o.x - z.x) < 10 && o.y > z.y - 9 : dist(o, z) < 9));
    const threat = deep ? mine.sort((a1, a2) => a2.y - a1.y)[0] : mine.sort((a1, a2) => dist(a1, z) - dist(a2, z))[0];
    if (threat && t > 0.6) {
      const at = seen(threat, b);
      if (deep) steerTo(b, lerp(z.x, at.x, 0.5 + 0.4 * read), Math.max(at.y + lerp(2.6, 1.4, read), z.y - 2), sp, dt);
      else steerTo(b, (at.x + z.x) / 2 + (at.x - z.x) * read * 0.4, Math.max(at.y + lerp(2.5, 1.2, read), p.los + 1), sp, dt);
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

/** a tackler starts his wind-up this close to the runner (yards) */
const WIND_R = 2.6;
/** a juke this soon before a tackler leaves his feet (seconds) fakes him out */
const FAKE = 0.3;

function tackle(p: Play, d: Body, c: Body) {
  const r = p.rand;
  const m = p.move && p.t < p.move.until + 0.15 ? p.move : null;
  d.windAt = Infinity;
  d.dive = null;
  const help = p.bodies.some((o) => o !== d && o.side === 'D' && p.t >= o.stunUntil && p.t >= o.heldUntil && dist(o, c) < 1.6);
  const tak = rt(d.p.a.TAK, 40, 99);
  const btk = rt(c.p.a.BTK, 40, 99);
  let pt = 0.76 + 0.2 * tak - 0.26 * btk + (help ? 0.16 : 0) + 0.03 * p.defIQ;
  if (m) {
    // the move against this tackler: a juke against his pursuit, a spin, a stiff arm or a truck against his tackling
    const v = m.kind === 'juke' ? c.p.a.JKM : m.kind === 'spin' ? c.p.a.SPM : m.kind === 'stiff' ? c.p.a.SFA : c.p.a.TRK;
    const vs = m.kind === 'juke' ? (d.p.a.PUR ?? d.p.a.TAK) : m.kind === 'truck' ? Math.max(d.p.a.TAK ?? 60, d.p.a.HIT ?? 60) : d.p.a.TAK;
    pt -= (0.18 + (rt(v, 40, 99) - rt(vs, 40, 99)) * 0.45) * m.eff;
    // timed against his dive (a juke or a spin as he leaves his feet): he's grabbing at air
    if ((m.kind === 'juke' || m.kind === 'spin') && m.at >= d.diveAt - FAKE && m.at <= d.diveAt + 0.15) pt -= (m.kind === 'juke' ? 0.32 : 0.2) * m.eff;
  }
  if (r() < clamp(pt, 0.15, 0.96)) {
    // a big hit can jar it loose
    const hit = rt(d.p.a.HIT, 50, 99);
    if (r() < 0.012 + 0.02 * hit - 0.02 * rt(c.p.a.CAR, 50, 99)) {
      endPlay(p, 'fumble', c, 'FUMBLE! ' + d.p.tag + ' FORCES IT');
      return;
    }
    // a big hit: a hard hitter arriving fast drives the runner back (the screen shows it in slow motion)
    const closing = Math.hypot(d.vx - c.vx, d.vy - c.vy);
    const big = hit > 0.55 && closing > 7.5 && r() < 0.35 + 0.5 * hit;
    if (big) {
      const k = 4.5 / Math.max(0.1, Math.hypot(d.vx, d.vy));
      c.vx = d.vx * k;
      c.vy = d.vy * k;
      p.events.push('bighit');
    } else {
      c.vx *= 0.3;
      c.vy *= 0.3;
    }
    act(c, 'down', p.t);
    act(d, 'tackle', p.t);
    endPlay(p, 'tackle', c, big ? 'BIG HIT BY ' + d.p.tag : 'TACKLED');
    return;
  }
  // broken: the runner goes on. Juked, the tackler dives at air; trucked or stiff-armed, he's knocked
  // onto his back; otherwise he just goes down
  d.stunUntil = p.t + (m?.kind === 'juke' ? 1.1 : 0.9);
  if (m?.kind === 'juke') {
    // he keeps his momentum into the dive, past where the runner was
    d.vx *= 0.9;
    d.vy *= 0.9;
    act(d, 'tackle', p.t);
  } else if (m?.kind === 'truck' || m?.kind === 'stiff') {
    const dx = d.x - c.x;
    const dy = d.y - c.y;
    const l = Math.max(0.1, Math.hypot(dx, dy));
    d.vx = (dx / l) * 3.2;
    d.vy = (dy / l) * 3.2;
    act(d, 'down', p.t);
  } else {
    d.vx = 0;
    d.vy = 0;
    act(d, 'down', p.t);
  }
  p.slowUntil = p.t + (m?.kind === 'truck' ? 0.2 : 0.3);
  p.events.push(m ? 'beat:' + m.kind : 'break');
}

/** A defender can touch the actual ball's swept path only after reading the throw, and within
 * arm/jump reach. High lobs clear underneath defenders; each player attempts once per pass. */
function playPassingLane(p: Play, dt: number) {
  const ball = p.ball!;
  const k = clamp((p.t - ball.t0) / (ball.t1 - ball.t0), 0, 1);
  if (k < 0.12 || k > 0.92) return; // catch-point battles are resolved by arrive()
  const at = ballNow(p)!;
  const before = clamp((p.t - dt - ball.t0) / (ball.t1 - ball.t0), 0, 1);
  const old = { x: ball.from.x + (ball.to.x - ball.from.x) * before, y: ball.from.y + (ball.to.y - ball.from.y) * before };
  const dx = at.x - old.x, dy = at.y - old.y, length2 = dx * dx + dy * dy;
  for (const b of p.bodies.filter((b) => b.side === 'D').sort((a, b) => dist(a, at) - dist(b, at))) {
    if (p.t < b.breakAt || p.t < b.stunUntil || ball.tried?.includes(b.id)) continue;
    const u = clamp(((b.x - old.x) * dx + (b.y - old.y) * dy) / Math.max(0.001, length2), 0, 1);
    const near = Math.hypot(b.x - old.x - dx * u, b.y - old.y - dy * u);
    const reach = 0.65 + rt(b.p.a.MCV ?? b.p.a.ZCV, 40, 99) * 0.4 + Math.max(0, b.p.ht - 72) * 0.02;
    const height = 2.35 + Math.max(0, b.p.ht - 72) * 0.025 + rt(b.p.a.AGI, 40, 99) * 0.5;
    if (near > reach || at.h > height) continue;
    (ball.tried ??= []).push(b.id);
    act(b, 'catch', p.t);
    const play = 0.25 + 0.48 * rt(b.p.a.PRC, 40, 99) + 0.07 * p.defIQ;
    if (p.rand() >= play) continue;
    const picked = p.rand() < 0.18 + 0.3 * rt(b.p.a.CTH, 40, 99);
    p.ball = null;
    p.events.push(picked ? 'lane-int' : 'pass-deflected');
    endPlay(p, picked ? 'int' : 'incomplete', b, (picked ? 'PICKED OFF BY ' : 'TIPPED BY ') + b.p.tag);
    return;
  }
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
      const edge = clamp((rd - ro + 0.5) / 1.2, 0, 1);
      const cit = rt(off.p.a.CIT, 45, 99);
      const db = rt(def.p.a.MCV ?? def.p.a.ZCV, 45, 99);
      pc = lerp(0.25, 0.85, edge) * (0.75 + 0.3 * cit) - 0.08 * db;
      pi = rd < ro - 0.2 ? 0.05 + 0.15 * rt(def.p.a.CTH, 40, 99) : 0.01 + 0.03 * rt(def.p.a.CTH, 40, 99);
    }
    const roll = r();
    if (roll < pi) {
      endPlay(p, 'int', at, 'PICKED OFF BY ' + (def?.p.tag ?? ''));
      return;
    }
    if (roll < pi + clamp(pc, 0.08, 0.97 - pi)) {
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
