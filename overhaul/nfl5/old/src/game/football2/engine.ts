// One play of arcade football, eleven on eleven, stepped at a fixed rate. Units are yards and
// seconds; x across the field (0 to 53.3), y the yard line from your goal (the far end zone is
// 100 to 110). Your offense attacks up the field; the rival's defenders guard it with their ratings.
//
// Nothing is decided up front: the pass rush is each lineman's moves against his blocker (the pocket
// closes as they walk their men back), coverage is a corner's man coverage (or a zone defender's
// read) against a receiver's routes and release, a catch is the receiver's hands against the
// defender's, and a tackle is the tackler against the runner's moves, all rolled when they happen.
// Throws use bounded rating/pressure/movement error around the intended target. The selected
// bullet/touch/lob trajectory drives the real flight, lane defense, receiver lead and aim preview.
// On a run the line drives its men away from the play's hole. A tackler winds up before he dives
// (the runner can see it coming), and a juke as he leaves his feet fakes him out.
import { GOLD_AT, type Judgement, judge, type Ring, type RingWindow, windowHalf } from './shared-v2';
import type { Act, Body, Call, Concept, Defense, Dial, FbPlayer, Flag, Job, Move, Offense, PassType, Play, PlayEnd, Pt, RunInput, RunPlay } from './types';

export const FIELD_W = 53.33;
const HASH_L = 23.58;
const HASH_R = 29.75;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;
/** a rating (0-99) as 0-1 between two marks */
export const rt = (v: number | undefined, lo = 45, hi = 99) => clamp(((v ?? 60) - lo) / (hi - lo), 0, 1) + ((v ?? 60) > 99 ? Math.min(11, v! - 99) * 0.009 : 0);

/**
 * Abilities (Madden-style, Claude 2026-11-01): a card's ability is "in the zone" on about half of
 * the plays (a seeded roll at the snap, the same on every phone), and only then does it work. The
 * moment it changes something the play reports `ability:<id>:<body>` (the HUD pops its icon).
 */
export const ABILITY_ON = 0.5;
export function on(b: Body | null | undefined, id: string): boolean {
  return !!b && !!b.on && b.on.includes(id);
}
function used(p: Play, b: Body, id: string) {
  const e = 'ability:' + id + ':' + b.id;
  if (!(p.fired ??= []).includes(e)) {
    p.fired.push(e);
    p.events.push(e);
  }
}

/** top speed, yards a second: about 6.3 for a slow lineman to 9.6 for a burner */
export function speedOf(p: FbPlayer): number {
  return lerp(6.2, 9.6, rt(p.a.SPD, 40, 99)) + Math.max(0, Math.min(11, (p.a.SPD ?? 60) - 99)) * 0.045;
}

export const CONCEPTS: Concept[] = ['verts', 'slants', 'smash', 'flood', 'dagger', 'mesh', 'curls', 'posts'];
export const CONCEPT_NAMES: Record<Concept, string> = {
  verts: 'Four Verticals',
  slants: 'Slants',
  smash: 'Smash',
  flood: 'Flood',
  dagger: 'Dagger',
  mesh: 'Mesh',
  curls: 'Curl Flats',
  posts: 'Double Post'
};
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
      return {
        pts: [
          { x: i * 2, y: 12 },
          { x: i * 3, y: 45 }
        ]
      };
    case 'slant':
      return {
        pts: [
          { x: 0, y: 3 },
          { x: i * 9, y: 11 },
          { x: i * 22, y: 24 }
        ]
      };
    case 'out':
      return {
        pts: [
          { x: 0, y: 9 },
          { x: s * 16, y: 9.5 }
        ]
      };
    case 'flat':
      return {
        pts: [
          { x: s * 5, y: 1.5 },
          { x: s * 14, y: 4 }
        ]
      };
    case 'swing':
      return {
        pts: [
          { x: s * 4, y: -1 },
          { x: s * 13, y: 3 },
          { x: s * 15, y: 12 }
        ]
      };
    case 'dig':
      return {
        pts: [
          { x: 0, y: 13 },
          { x: i * 26, y: 14 }
        ]
      };
    case 'curl':
      return {
        pts: [
          { x: 0, y: 11 },
          { x: i * 1.2, y: 9 }
        ],
        sit: true
      };
    case 'post':
      return {
        pts: [
          { x: 0, y: 12 },
          { x: i * 13, y: 34 }
        ]
      };
    case 'corner':
      return {
        pts: [
          { x: 0, y: 11 },
          { x: s * 11, y: 25 }
        ]
      };
    case 'drag':
      return {
        pts: [
          { x: i * 3, y: 2.5 },
          { x: i * 30, y: 5 }
        ]
      };
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
  posts: ['post', 'curl', 'post', 'drag', 'check']
};

function body(id: number, side: 'O' | 'D', p: FbPlayer, slot: string, x: number, y: number, job: Job): Body {
  return {
    id,
    side,
    p,
    slot,
    x,
    y,
    vx: 0,
    vy: 0,
    job,
    act: 'stance',
    actAt: 0,
    route: [],
    sit: false,
    mark: null,
    zone: null,
    heldUntil: 0,
    readUntil: 0,
    misread: false,
    stunUntil: 0,
    breakAt: Infinity,
    winAt: Infinity,
    windAt: Infinity,
    diveAt: -Infinity,
    dive: null,
    trail: []
  };
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
    add('D', def.dl[3], 'RE', bx + 4.6, los + 1, 'rush')
  ];
  const lbW = add('D', def.lb[0], 'WLB', bx - 4.2, los + 4.8, zone ? 'zone' : 'man');
  const lbM = add('D', def.lb[1], 'MLB', bx + 0.3, los + 5.2, 'spy');
  const lbS = add('D', def.lb[2], 'SLB', bx + 4.6, los + 4.6, zone ? 'zone' : 'man');
  // press man: a corner presses more often the better he is at it (no cliff at a rating)
  const press = (cb: FbPlayer) => (!zone && rand() < rt(cb.a.PRS, 60, 99) ? 1.5 : lerp(7.5, 5, rt(cb.a.MCV)));
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
    d.blocker = blk.id;
    d.winAt = rushWinAt(d.p, blk.p, rand, i === 1 || i === 2);
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
    defIQ
  };
  // abilities in the zone this play
  for (const b of bodies) if (b.p.abil.length) b.on = b.p.abil.filter(() => rand() < ABILITY_ON);
  // pass protection / edge rushers: the win comes later against a wall, sooner for an edge threat
  dl.forEach((d, i) => {
    const blk = blockerOf[i];
    if (on(blk, 'pocket-wall')) d.winAt += 0.35;
    if (on(d, 'edge-threat')) d.winAt = Math.max(1.6, d.winAt - 0.35);
  });
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
      const edge = rt(d.p.a.BSH) + (on(d, 'run-stopper') ? 0.2 : 0) - rt(blk.p.a.RBK) - (on(blk, 'road-grader') ? 0.2 : 0);
      d.heldUntil = rand() < clamp(0.04 + edge * 0.15, 0.01, 0.1) ? 0.25 + rand() * 0.2 : Math.max(0.6, 1.35 - edge * 0.45 + rand() * 0.4);
      // his blocker's on him from the snap: once he's off it, it's a while before anyone gets him again
      blk.heldUntil = d.heldUntil + 1.2;
    });
    // the tight end blocks the strong-side linebacker
    TE.route = [];
    TE.job = 'block';
    for (const lb of [lbW, lbM, lbS]) {
      lb.misread = rand() < lerp(0.3, 0.06, rt(lb.p.a.PRC)) * (1 - 0.5 * defIQ);
      lb.readUntil = (lerp(0.68, 0.42, rt(lb.p.a.PRC)) + rand() * 0.25) * (1 - 0.2 * defIQ) + (lb.misread ? 0.45 : 0);
    }
    // the secondary plays the pass until it sees the handoff for what it is
    for (const db of [cb1, cb2, fs, ss]) db.readUntil = (0.3 + lerp(0.6, 0.2, rt(db.p.a.PRC)) + rand() * 0.25) * (1 - 0.2 * defIQ);
  } else {
    // A blown coverage (Claude 2026-11-01): now and then one man in coverage busts the call, the
    // classic miscommunication. In man he thinks it's zone and squats short, leaving his man free;
    // in Cover 3 a deep defender jumps the underneath route and vacates his third. Smarter
    // secondaries (AWR, PRC) bust less, and so does a harder defense, but never not at all: it's a
    // real source of big plays for any offense (the weaker one included), and the pilot or the
    // player still has to see it and hit it.
    const cover = zone ? [cb1, cb2, fs] : [cb1, cb2, ss, lbS, lbW];
    const smarts = (b: Body) => 0.5 * rt(b.p.a.AWR, 45, 99) + 0.5 * rt(b.p.a.PRC, 45, 99);
    const iq = cover.reduce((n, b) => n + smarts(b), 0) / cover.length;
    if (rand() < clamp(lerp(0.075, 0.025, iq) * (1 - 0.4 * defIQ), 0.012, 0.1)) {
      // the weakest reader is the likeliest to bust
      const w = cover.map((b) => 1.25 - smarts(b));
      let u = rand() * w.reduce((n, x) => n + x, 0);
      let who = cover[cover.length - 1];
      for (let i = 0; i < cover.length; i++) if ((u -= w[i]) <= 0) { who = cover[i]; break; }
      who.job = 'zone';
      who.mark = null;
      who.zone = { x: clamp(zone ? who.x + (bx - who.x) * 0.4 : who.x, 4, FIELD_W - 4), y: los + (zone ? 8 : 7) };
      play.bust = who.id;
    }
  }
  return play;
}

/** Mirror a complete formation before the snap, retaining players, assignments and ratings. */
export function flipPlay(p: Play): boolean {
  if (p.phase !== 'pre' || p.end) return false;
  const mirror = (x: number) => 2 * p.bx - x;
  for (const b of p.bodies) {
    b.x = mirror(b.x);
    b.vx = -b.vx;
    b.route = b.route.map((at) => ({ x: mirror(at.x), y: at.y }));
    if (b.zone) b.zone = { x: mirror(b.zone.x), y: b.zone.y };
    b.trail = b.trail.map((at) => ({ x: mirror(at.x), y: at.y }));
  }
  p.hole = mirror(p.hole);
  p.direction = p.direction === -1 ? 1 : -1;
  return true;
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
  return lerp(40, 64, rt(p.qb.p.a.THP, 55, 99)) + Math.max(0, Math.min(11, (p.qb.p.a.THP ?? 60) - 99)) * 0.2 + (on(p.qb, 'cannon') ? 4 : 0);
}

/**
 * When a pass rusher beats his blocker: his best of a power rush (moves and strength against the
 * block and strength) and a finesse rush (moves and agility against the block and agility). Ten
 * points of edge is about 0.45 s. (Before, only the higher move counted, and gently.)
 */
export function rushWinAt(d: FbPlayer, blk: FbPlayer, rand: () => number, inside: boolean): number {
  const a = (k: string, v = 60) => d.a[k] ?? v,
    o = (k: string, v = 60) => blk.a[k] ?? v;
  const power = (a('PMV', 55) + a('STR', 70)) / 2 - (o('PBK') + o('STR', 75)) / 2;
  const finesse = (a('FMV', 55) + a('AGI', 65)) / 2 - (o('PBK') + o('AGI', 50)) / 2;
  const edge = Math.max(power, finesse) / 100;
  return Math.max(1.75, WIN_AT - edge * 3.5 + gauss(rand) * 0.45 + (inside ? 0.25 : 0));
}

/** when an even pass rusher beats his man, on average (seconds after the snap) */
export const WIN_AT = 3.05;
/** how close (yards in front of the quarterback) the pocket has closed when a rusher wins */
const POCKET = 4.2;

/** The ball's speed in the air (yards a second): a strong arm gets it there sooner. (On Fire used to
 * make it quicker still; since nfl-4 ON FIRE is Heat's wider gold instead.) */
function throwSpeed(p: Play) {
  // 19 yd/s for a weak arm, 25 for a strong one (the throw power that matters most is the speed)
  return (lerp(19, 25, rt(p.qb.p.a.THP, 50, 99)) + Math.max(0, Math.min(11, (p.qb.p.a.THP ?? 60) - 99)) * 0.055) * (on(p.qb, 'cannon') ? 1.06 : 1);
}

/** 0 for a bullet (short and flat), 1 for a lob (long and high), blended between. */
export function loft(len: number) {
  return clamp((len - 12) / 18, 0, 1);
}

/** The flight time for a throw of this length (for the slingshot's arc and the AI's lead). */
export function flightTime(p: Play, len: number, type = p.passType) {
  const lift = type === 'bullet' ? 0 : type === 'touch' ? 0.55 : type === 'lob' ? 1 : loft(len);
  return Math.max(0.3, len / (throwSpeed(p) * lerp(1.3, 0.92, lift)) + len * 0.006 + (type === 'lob' ? 0.12 : 0));
}

/** How high the ball rides over its line (yards, at the middle): a bullet barely rises, a lob hangs. */
export function peakOf(len: number, type?: PassType) {
  const lift = type === 'bullet' ? 0 : type === 'touch' ? 0.55 : type === 'lob' ? 1 : loft(len);
  return lerp(0.35 + len * 0.06, Math.min(11, 2 + len * 0.2), lift);
}

/** Lead along the actual remaining route, iterating flight time rather than aiming at old feet. */
export function receiverLead(p: Play, receiver: Body, type = p.passType): Pt {
  let at: Pt = receiver;
  for (let i = 0; i < 4; i++) at = projectRoute(receiver, flightTime(p, Math.min(maxThrow(p), dist(p.qb, at)), type));
  return { x: clamp(at.x, 0.5, FIELD_W - 0.5), y: Math.min(109.5, at.y) };
}
export function throwToReceiver(p: Play, id: number): boolean {
  const receiver = p.bodies.find((b) => b.id === id && b.side === 'O' && b !== p.qb && !isLine(b));
  return !!receiver && throwTo(p, receiverLead(p, receiver));
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
 * less with a rusher in his face unless he's poised under pressure. (On Fire no longer shows him all
 * of it: nfl-4's ON FIRE widens the gold instead.)
 */
export function sight(p: Play, len: number) {
  const a = p.qb.p.a;
  const calm = 1 - p.pressure * (1 - 0.6 * rt(a.TUP, 50, 99));
  // on the move in the pocket (nfl-2) he sees less of it: up to a fifth less at full tilt
  const yards = lerp(8, 56, Math.pow(accAt(p.qb.p, len), 1.1)) * lerp(0.45, 1, calm) * (p.roll ? lerp(1, 0.8, p.roll) : 1);
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
  // (the accuracy term was 0.65 + 0.035/yd: a 60 and a 90 passer threw almost the same ball)
  const r = Math.min(
    4.6,
    0.12 - eliteTouch + Math.pow(1 - accuracy, 1.5) * (1.0 + len * 0.06) + p.pressure * (1 - poise * 0.75) * (0.6 + len * 0.025) + movement * (1 - accuracy * 0.6) * 0.6
  );
  return on(p.qb, 'surgeon') && len <= 15 ? r * 0.7 : r;
}

// ---------- the gold ring (Claude, studio overhaul nfl-4; V2 §B.0.1, §B.2.5) ----------

/** A rating's gold half-window (s), before On Fire: 22 ms + 33 ms over the rating's 50-99 range,
 * so it never passes 55 ms (110 ms across) and windowHalf's 30 ms floor holds the low end. A 95
 * gets about 1.47x the gold of a 70. */
const RING_LO = 0.022;
const RING_SPAN = 0.033;
export function ringBase(rating01: number): number {
  return RING_LO + RING_SPAN * clamp(Number.isFinite(rating01) ? rating01 : 0, 0, 1);
}
/** The sling's dial goes round once in this long (s); see shared-v2 ringDial. */
export const SLING_SWEEP = 0.8;
/** A receiver this open (yards, the AI's own openness measure) wears a green halo; less is tight
 * (amber). A ball 20+ yards in the air hangs, so a deep man needs a step more (G-2). */
export const HALO_OPEN = 2.4;
export const HALO_DEEP = 3.4;
/** The separation a green halo needs for a throw `air` yards downfield. */
export const haloNeed = (air: number) => (air >= 20 ? HALO_DEEP : HALO_OPEN);
/** The spot within this of his path (yards): a ball there is in stride. Up to RING_NEAR the ring
 * still shows (amber: he isn't getting there in stride); farther, there's no ring, only the reticle. */
export const CATCH_R = 1.2;
export const RING_NEAR = 3;
/** Pressure from which the sling can't be gold: deep (20+ air yards) any real pressure. */
const PRESSURE_AMBER = 0.5;
const PRESSURE_AMBER_DEEP = 0.25;
/** Deep throws' gold is this much narrower (G-2). */
const DEEP_RING = 0.7;
/** A perfect move leaves the tackler on the turf this long (s). */
export const STUMBLE = 0.8;

/** The sling's gold half-window (s) for a passer, a throw this long, its air yards and On Fire. */
export function slingHalf(qb: FbPlayer, len: number, air: number, fire: boolean): number {
  return windowHalf(ringBase(accAt(qb, len)) * (air >= 20 ? DEEP_RING : 1), 1, fire);
}
/** The JUKE/SPIN gold half-window (s) for a carrier, On Fire or not. */
export function jukeHalf(c: FbPlayer, fire: boolean): number {
  return windowHalf(ringBase(rt(moveRating(c), 50, 99)), 1, fire);
}

/**
 * How open a receiver is at a spot: the nearest man in coverage to him now, or to the spot (with half
 * a yard of grace). The same value the autopilot reads to pick its man, and the halo on his chip.
 */
export function separation(p: Play, b: Body, at: Pt): number {
  let open = 99;
  for (const d of p.bodies) {
    if (d.side !== 'D' || d.job === 'rush') continue;
    open = Math.min(open, dist(d, b), dist(d, at) + 0.5);
  }
  return open;
}

/** The receiver a sling to `aim` is for: whose route passes closest to the spot (`miss`, yards),
 * when he gets there (`tau`, seconds from now), and whether he stops there (`stops`: the end of a
 * curl or a check-down). Null when nobody's route comes within RING_NEAR. */
export function slingTarget(p: Play, aim: Pt): { b: Body; tau: number; miss: number; stops: boolean } | null {
  let best: { b: Body; tau: number; miss: number; stops: boolean } | null = null;
  for (const b of p.bodies) {
    if (b.side !== 'O' || b === p.qb || isLine(b) || b.job === 'block' || b.job === 'handoff') continue;
    // coarse along his route; where it comes back near the spot more than once (a curl or a
    // comeback passes the spot going out), the last time counts; at a stop, his arrival there
    const ds: number[] = [];
    for (let k = 0; k <= 64; k++) ds.push(k ? dist(projectRoute(b, k * 0.05), aim) : dist(b, aim));
    const low = Math.min(...ds);
    let k0 = ds.length - 1;
    while (k0 > 0 && ds[k0] > low + 0.15) k0--;
    while (k0 > 0 && ds[k0 - 1] <= low + 0.15) k0--;
    let kk = k0;
    for (let k = k0; k < ds.length && ds[k] <= low + 0.15; k++) if (ds[k] < ds[kk] - 1e-9) kk = k;
    let tau = kk * 0.05,
      miss = ds[kk];
    // then fine around it
    for (let k = -10; k <= 10; k++) {
      const t = tau + k * 0.005;
      if (t < 0 || t < k0 * 0.05 - 0.05) continue;
      const d = dist(projectRoute(b, t), aim);
      if (d < miss - 1e-9) {
        miss = d;
        tau = t;
      }
    }
    // on the last leg to where he sits (a curl's settle, a check-down), the moment that counts is his
    // arrival there: a ball after it meets a man standing still
    const last = b.route[b.route.length - 1];
    const stops = b.sit && b.route.length <= 1;
    if (stops && last) tau = Math.max(tau, dist(b, last) / speedOf(b.p));
    if (miss <= RING_NEAR && (!best || miss < best.miss - 1e-9)) best = { b, tau, miss, stops: stops || dist(projectRoute(b, tau + 0.25), projectRoute(b, tau)) < 0.1 };
  }
  return best;
}

export interface SlingRing {
  /** the window in engine seconds, and whether gold is on offer */
  w: RingWindow;
  /** what a non-PERFECT release names: RANGE (red), PRESSURE (amber: the rush or tight coverage), TIMING */
  dial: Dial | null;
  /** the receiver it's for (a body id) */
  target: number;
}

/**
 * The sling's ring for a throw to `aim` now (V2 §6.2): its window is centred on the release that has
 * the ball arrive as the receiver does (release when his break lines up), half-width by the
 * passer's accuracy at that distance (x0.7 deep), x1.25 On Fire. Gold is offered only when the
 * outcome can be guaranteed: the spot within his catch radius, in bounds and in the arm's range, his
 * halo green (open) and the rush under 0.5 (under 0.25 deep). Otherwise amber (PRESSURE, or TIMING
 * when he isn't getting there in stride), and red past the arm (RANGE). On Fire an amber that is
 * only the rush's (an open man, in stride, in range) is gold, short of 20 air yards: a deep ball
 * under pressure is never gold. `out`: the drag asked for more than the arm has (slingNow clamps
 * the spot to it). Pure: reads the play, changes nothing.
 */
export function slingWindow(p: Play, aim: Pt, out = false, type = p.passType): SlingRing | null {
  if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== p.qb) return null;
  const qb = p.qb;
  const max = maxThrow(p);
  const raw = dist(qb, aim);
  const len = Math.max(1.5, Math.min(raw, max));
  const air = aim.y - p.los;
  // past his arm: the whole ring is red (RANGE) whoever it's for, and there's no moment to time (its
  // needle rests at the top)
  if (out || raw > max + 0.01) return { w: { center: p.t + SLING_SWEEP * GOLD_AT, half: slingHalf(qb.p, len, air, p.fire), state: 'red' }, dial: 'RANGE', target: slingTarget(p, aim)?.b.id ?? -1 };
  const tgt = slingTarget(p, aim);
  if (!tgt) return null;
  const deep = air >= 20;
  const center = p.t + tgt.tau - flightTime(p, len, type);
  // a man who'll have stopped there (the end of a curl, a check-down) before any throw now could
  // arrive has no break left to time: a ball to him is just a pass (no ring; a tap's accuracy)
  if (tgt.stops && center <= p.t) return null;
  const half = slingHalf(qb.p, len, air, p.fire);
  const inBounds = aim.x >= 0.5 && aim.x <= FIELD_W - 0.5 && aim.y <= 109.5;
  const open = separation(p, tgt.b, aim) >= haloNeed(air);
  const rushed = p.pressure >= (deep ? PRESSURE_AMBER_DEEP : PRESSURE_AMBER);
  let state: Ring = 'gold';
  let dial: Dial | null = null;
  if (!inBounds || tgt.miss > CATCH_R) {
    state = 'amber';
    dial = 'TIMING';
  } else if (!open || (rushed && (deep || !p.fire))) {
    state = 'amber';
    dial = 'PRESSURE';
  }
  return { w: { center, half, state }, dial, target: tgt.b.id };
}

/** The rating a carrier's JUKE and SPIN ring is sized by: his better move with his agility. */
export function moveRating(c: FbPlayer): number {
  return (Math.max(c.a.JKM ?? 50, c.a.SPM ?? 45) + (c.a.AGI ?? 70)) / 2;
}
/** The carrier can make a move right now (the ring is gold only then). */
export function moveReady(p: Play): boolean {
  return p.phase === 'run' && !!p.carrier && p.t >= p.moveReady && !p.covered && !p.down;
}

/**
 * The JUKE/SPIN ring on a tackler (V2 §B.2.5 #3): his wind-up is the ring, its window centred on
 * the moment he commits to the dive, half-width by the carrier's moves and agility (x1.25 On Fire).
 * Gold while the carrier has a move ready, amber otherwise. Null when he isn't winding up (or his
 * dive is long gone). Pure.
 */
export function jukeWindow(p: Play, d: Body): RingWindow | null {
  const c = p.carrier;
  if (!c || p.phase !== 'run' || d.side !== 'D' || d.ringAt === undefined) return null;
  if (d.windAt === Infinity && !d.dive && p.t > d.ringAt + 0.05) return null;
  if (p.t > d.ringAt + 0.4) return null;
  return { center: d.ringAt, half: jukeHalf(c.p, p.fire), state: moveReady(p) ? 'gold' : 'amber' };
}

/** A gold ring the offense was offered (counted once each: a sling release, a tackler's wind-up). */
function offered(p: Play, kind: 'sling' | 'move') {
  p.chances = (p.chances ?? 0) + 1;
  p.events.push('gold:' + kind);
}

/** A PERFECT moment by `who` (one entry each; Heat and the grade read them off the play's end). */
function perfect(p: Play, who: Body, kind: 'sling' | 'juke' | 'spin') {
  (p.pf ??= []).push(who.p.id);
  p.events.push('perfect:' + kind);
}

/**
 * A pass. `sling` is the player's slingshot released at engine time `at` (from the touch's own
 * timestamp, shared-v2 touchTime): it is judged on the ring (slingWindow). A PERFECT on gold puts the
 * ball exactly on the spot, and the receiver catches it in stride (no play on it in the lane, no
 * drop, no interception); early or late throws 1.3x the error; amber and red can't be PERFECT. A
 * tap on a receiver's chip and the AI's throws (no `sling`) take the 'good' path, today's accuracy,
 * so a tap never beats a PERFECT sling.
 */
export function throwTo(p: Play, to: Pt, type = p.passType, sling?: { at: number; out?: boolean }): boolean {
  if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== p.qb || p.t < 0.3) return false;
  const qb = p.qb;
  const r = p.rand;
  const ang = Math.atan2(to.y - qb.y, to.x - qb.x);
  const len = Math.max(1.5, Math.min(Math.hypot(to.x - qb.x, to.y - qb.y), maxThrow(p)));
  const intended = { x: qb.x + Math.cos(ang) * len, y: qb.y + Math.sin(ang) * len };
  const ring = sling ? slingWindow(p, intended, !!sling.out || Math.hypot(to.x - qb.x, to.y - qb.y) > maxThrow(p) + 0.01, type) : null;
  // (a red ring has no timing: a ball past his arm is an ordinary throw at the edge of it)
  const j: Judgement = ring && ring.w.state !== 'red' ? judge(sling!.at, ring.w) : 'good';
  if (ring) {
    if (ring.w.state === 'gold') offered(p, 'sling');
    p.ring = { kind: 'sling', judge: j, state: ring.w.state, dial: j === 'perfect' ? null : ring.dial ?? 'TIMING' };
    p.events.push('ring:sling:' + j + ':' + ring.w.state);
  }
  const sure = j === 'perfect' && ring ? ring.target : undefined;
  let land: Pt = intended;
  if (sure === undefined) {
    const error = throwErrorRadius(p, len) * (j === 'early' || j === 'late' ? 1.3 : 1);
    // Triangular noise favors the intended spot, stays bounded and never aims the ball at a defender.
    let lateral = (r() - r()) * error,
      depth = (r() - r()) * error * 0.8;
    const radius = Math.hypot(lateral, depth);
    if (radius > error) {
      lateral *= error / radius;
      depth *= error / radius;
    }
    land = { x: intended.x - Math.sin(ang) * lateral + Math.cos(ang) * depth, y: intended.y + Math.cos(ang) * lateral + Math.sin(ang) * depth };
  } else perfect(p, qb, 'sling');
  const flight = flightTime(p, len, type);
  p.aim = intended;
  p.ball = { from: { x: qb.x, y: qb.y + 0.3 }, to: land, t0: p.t, t1: p.t + flight, peak: peakOf(len, type), type, sure };
  p.carrier = null;
  p.phase = 'air';
  act(qb, 'throw', p.t);
  p.events.push(p.pressure > 0.3 ? 'throw-pressure' : 'throw');
  if (on(qb, 'cannon') && len > 20) used(p, qb, 'cannon');
  if (on(qb, 'surgeon') && len <= 15) used(p, qb, 'surgeon');
  // who goes for it: of the receivers who can get there in time, the one whose route takes him
  // closest (a PERFECT sling's is the man the ring was for)
  const eligible = p.bodies.filter((b) => b.side === 'O' && b !== qb && !isLine(b) && dist(b, land) / speedOf(b.p) <= flight + 0.45);
  const target = sure !== undefined ? p.bodies[sure] : eligible.sort((x, y) => dist(projectRoute(x, flight), land) - dist(projectRoute(y, flight), land))[0];
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
      // awareness: a heady defender is on it a beat sooner
      b.breakAt = p.t + lerp(0.4, 0.2, read) * (1 - 0.2 * p.defIQ) + r() * 0.07 + near * 0.005 - 0.05 * rt(b.p.a.AWR, 45, 99);
    }
  }
  return true;
}

export function isLine(b: Body) {
  return b.slot === 'LT' || b.slot === 'LG' || b.slot === 'C' || b.slot === 'RG' || b.slot === 'RT';
}

// ---------- the pocket (Claude, studio overhaul nfl-2) ----------

/** The quarterback's drop: this many yards behind the line, over this long (s). */
export const DROP_DEPTH = 6.5;
export const DROP_TIME = 0.75;
/** While he's still dropping, the stick can't bring him forward faster than this backpedal (yd/s, negative = back). */
const DROP_BACK = -2.6;
/** The tackle box: this far either side of where the ball was snapped (yards). */
export const BOX_HALF = 4.5;
/** A stick shorter than this in the pocket is a resting thumb: he holds his spot. */
const POCKET_DEAD = 0.05;

/** Outside the tackle box: where a quarterback may throw it away. */
export function outsideBox(p: Play): boolean {
  return Math.abs(p.qb.x - p.bx) > BOX_HALF;
}

/** How fast the stick moves a quarterback in the pocket (yd/s): 3.6 for a statue, 5.0 for an agile one. */
export function pocketSpeed(qb: FbPlayer): number {
  return lerp(3.6, 5.0, rt(qb.a.AGI, 40, 99));
}

/** The stick's pull on a quarterback in the pocket this step, or null when the drop or his spot has him. */
function pocketPull(p: Play, steer: RunInput): Pt | null {
  if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== p.qb) return null;
  if (typeof steer !== 'object' || steer === null) return null;
  const len = Math.hypot(steer.x, steer.y);
  if (!Number.isFinite(len) || len < POCKET_DEAD) return null;
  return len > 1 ? { x: steer.x / len, y: steer.y / len } : steer;
}

/**
 * Throw it away (nfl-2): only from outside the tackle box (inside it, there's no throwaway: he has
 * to make a play). The ball sails three yards past the near sideline beyond the line, nobody plays
 * it, it can't be intercepted, and the down is an incompletion.
 */
export function throwAway(p: Play): boolean {
  if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== p.qb || p.t < 0.3 || !outsideBox(p)) return false;
  const qb = p.qb;
  const to = { x: qb.x < p.bx ? -3 : FIELD_W + 3, y: Math.max(p.los + 2, qb.y + 5) };
  const len = dist(qb, to);
  p.aim = null;
  p.ball = { from: { x: qb.x, y: qb.y + 0.3 }, to, t0: p.t, t1: p.t + flightTime(p, len, 'touch'), peak: peakOf(len, 'touch') + 1, type: 'touch', away: true };
  p.carrier = null;
  p.phase = 'air';
  act(qb, 'throw', p.t);
  p.events.push('throwaway');
  return true;
}

/** How long a quarterback's slide takes to bring him down, and a dive's flight (s). */
export const SLIDE_TIME = 0.25;
export const DIVE_TIME = 0.32;

/**
 * Give himself up (nfl-2): a quarterback past the line slides (feet first, 0.25 s of slowing, then
 * down where he stops); any carrier dives forward for the line (a yard and a bit, more for a fast
 * man). Either way the play ends as a tackle with no fumble, at the end of it or at the first
 * contact.
 */
export function giveUp(p: Play, kind: 'slide' | 'dive'): boolean {
  const c = p.carrier;
  if (!c || p.phase !== 'run' || p.end || p.down) return false;
  if (kind === 'slide' && (c !== p.qb || c.y <= p.los)) return false;
  if (p.move && p.t < p.move.until) return false;
  p.covered = false;
  if (kind === 'dive') {
    const v = Math.hypot(c.vx, c.vy);
    // the way he's going, if that's forward at all; otherwise straight up the field
    const ux = v > 0.5 && c.vy > 0 ? c.vx / v : 0;
    const uy = v > 0.5 && c.vy > 0 ? c.vy / v : 1;
    const reach = lerp(1.2, 2.0, rt(c.p.a.SPD, 40, 99));
    c.vx = (ux * reach) / DIVE_TIME;
    c.vy = (uy * reach) / DIVE_TIME;
    act(c, 'tackle', p.t);
  } else act(c, 'down', p.t);
  p.down = { kind, at: p.t, until: p.t + (kind === 'slide' ? SLIDE_TIME : DIVE_TIME) };
  p.bursting = false;
  p.events.push(kind);
  return true;
}

/** Cover the ball up (nfl-2): both arms round it, a step slower and no moves, and a hit seldom jars it loose. */
export function coverBall(p: Play, on: boolean): boolean {
  p.covered = on && p.phase === 'run' && !!p.carrier && !p.down && !p.end;
  return p.covered;
}
/** A covered ball comes loose this much as often. */
const COVERED_FUMBLE = 0.3;

/** the momentum carry: how long a new carrier nobody is steering turns gently (s), and how gently
 * (a share of his turn rate) */
const CARRY_HOLD = 0.35;
const CARRY_TURN = 0.6;

/** what each move takes out of the runner, and how fast it comes back (a second's running) */
const DRAIN: Record<Move, number> = { juke: 0.28, spin: 0.34, stiff: 0.3, truck: 0.36 };
const STAMINA_BACK = 0.1;

/** Sprint at the cost of the same stamina used by skill moves; release to recover. */
export function setBurst(p: Play, held: boolean): boolean {
  p.bursting = held && !p.end && (p.phase === 'run' || (p.phase === 'drop' && p.call === 'run'));
  return p.bursting;
}

/** Read a runner's observed velocity, then take a bounded intercept angle. No input prediction. */
export function pursuitTarget(defender: Body, runner: Pt, velocity: Pt, speed: number): Pt {
  const dx = runner.x - defender.x,
    dy = runner.y - defender.y;
  const a = velocity.x ** 2 + velocity.y ** 2 - speed ** 2,
    b = 2 * (dx * velocity.x + dy * velocity.y),
    c = dx * dx + dy * dy;
  const roots =
    Math.abs(a) < 0.001
      ? b < -0.001
        ? [-c / b]
        : []
      : b * b - 4 * a * c >= 0
        ? [(-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a), (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)]
        : [];
  const intercept = roots.filter((t) => t > 0).sort((x, y) => x - y)[0] ?? Math.sqrt(c) / Math.max(1, speed);
  const anticipation = lerp(0.62, 0.95, rt(defender.p.a.PUR ?? defender.p.a.PRC));
  // Far away, take the angle; close down, attack the runner's body. A full intercept horizon at
  // arm's length steers a tackler past the runner and creates repeated cartoon fly-bys.
  const horizon = lerp(0.1, 0.85, clamp((Math.sqrt(c) - 1.5) / 12, 0, 1));
  const tau = clamp(intercept, 0, horizon) * anticipation;
  return { x: clamp(runner.x + velocity.x * tau, 0.2, FIELD_W - 0.2), y: runner.y + velocity.y * tau };
}
/** the same move again in a play works this much as well as the last time */
const REPEAT = 0.6;

/** How long a tackler gathers before he dives: a sharp one tips it off for less time. */
export function windupOf(b: Body) {
  // his tackling and pursuit (not his play recognition, which reads the play instead)
  return lerp(0.4, 0.24, rt(((b.p.a.TAK ?? 60) + (b.p.a.PUR ?? b.p.a.TAK ?? 60)) / 2, 45, 99));
}

/**
 * A move with the ball: a juke (a cut away from the nearest tackler), a spin, a stiff arm or a
 * truck (lowering the shoulder). Each works by the runner's rating for it, less when he's tired
 * and less each time he makes the same one again.
 *
 * A JUKE or SPIN is also judged on the ring of the tackler winding up at him (nfl-4, jukeWindow),
 * at `at`: the player's touch time (shared-v2 touchTime), or now. PERFECT on gold: that tackler
 * grabs at air and stumbles for STUMBLE seconds (`stumble:<id>`), and the runner keeps 90% of his
 * speed. Early, good or late: as before, where the dive's own timing decides it (a cut made well
 * before he leaves his feet is the slow, easily read one it always was).
 */
export function moveWithBall(p: Play, kind: Move, dir = 0, at = p.t) {
  const c = p.carrier;
  if (!c || p.phase !== 'run' || p.t < p.moveReady || p.covered || p.down) return;
  const near = p.bodies.filter((b) => b.side === 'D').sort((a, b) => dist(a, c) - dist(b, c))[0];
  const away = near ? Math.sign(c.x - near.x) || 1 : 1;
  const eff = (0.35 + 0.65 * p.stamina) * Math.pow(REPEAT, p.used[kind] ?? 0);
  // the ring it's judged on: the tackler whose commit is nearest the touch
  let ring: { d: Body; w: RingWindow } | null = null;
  if (kind === 'juke' || kind === 'spin')
    for (const d of p.bodies) {
      const w = d.side === 'D' ? jukeWindow(p, d) : null;
      if (w && Math.abs(at - w.center) < 0.6 && (!ring || Math.abs(at - w.center) < Math.abs(at - ring.w.center))) ring = { d, w };
    }
  p.used[kind] = (p.used[kind] ?? 0) + 1;
  p.stamina = Math.max(0, p.stamina - DRAIN[kind]);
  p.move = { kind, at: p.t, until: p.t + (kind === 'juke' ? 0.32 : kind === 'spin' ? 0.42 : 0.5), dir: dir || away, eff, x: c.x, y: c.y, vx: c.vx, vy: c.vy };
  p.moveReady = p.t + (kind === 'juke' ? 1 : 1.3);
  act(c, kind === 'juke' ? 'juke' : kind === 'spin' ? 'spin' : kind === 'stiff' ? 'stiff' : 'truck', p.t);
  p.events.push('move:' + kind);
  if (ring && (kind === 'juke' || kind === 'spin')) {
    const j = judge(at, ring.w);
    if (ring.w.state === 'gold' && !ring.d.ringSeen) {
      ring.d.ringSeen = true;
      offered(p, 'move');
    }
    p.ring = { kind, judge: j, state: ring.w.state, dial: j === 'perfect' ? null : ring.w.state === 'gold' ? 'TIMING' : 'PRESSURE' };
    p.events.push('ring:' + kind + ':' + j + ':' + ring.w.state);
    if (j === 'perfect') {
      // he grabs at air: off his feet and on the turf, out of this play for a moment
      const d = ring.d;
      d.windAt = Infinity;
      d.dive = null;
      d.ringAt = undefined;
      d.stunUntil = p.t + STUMBLE;
      d.vx *= 0.4;
      d.vy *= 0.4;
      act(d, 'down', p.t);
      p.move.perfect = true;
      perfect(p, c, kind);
      p.events.push('stumble:' + d.id);
    }
  }
}

/** The quarterback tucks it and runs (no throwing after): everyone on defense comes for him. */
export function scramble(p: Play) {
  if (p.phase !== 'drop' || p.call !== 'pass' || p.carrier !== p.qb || p.t < 0.3) return false;
  const qb = p.qb;
  qb.job = 'carry';
  p.phase = 'run';
  p.carrierAt = p.t;
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
  const dvx = want.x - b.vx,
    dvy = want.y - b.vy;
  const delta = Math.hypot(dvx, dvy);
  const scale = Math.min(1, (acceleration * turn * dt) / Math.max(0.001, delta));
  b.vx += dvx * scale;
  b.vy += dvy * scale;
}

function move(b: Body, dt: number) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

/**
 * Flags (Claude 2026-11-01): the NFL calls about six accepted penalties a team a game (~65 snaps);
 * a drive-killing hold or a free first down are some of the commonest ways a drive turns. Rates per
 * snap here: offensive holding 2.2% on a pass (1.4% on a run), defensive holding / illegal contact
 * 1.2% of passes, offside 0.8% of snaps, and pass interference on a contested incompletion down
 * the field (arrive()). A disciplined unit (AWR) flags a little less (±20%). Never on a touchdown:
 * a flag shouldn't take away the moment, and the AI and the player get the same rules.
 */
function flagFor(p: Play, kind: PlayEnd['kind']): Flag | undefined {
  if (kind === 'td') return undefined;
  const r = p.rand;
  const pass = p.call === 'pass';
  const awr = (side: 'O' | 'D', line: boolean) => {
    const xs = p.bodies.filter((b) => b.side === side && (side === 'D' || isLine(b) === line));
    return xs.reduce((n, b) => n + rt(b.p.a.AWR, 45, 99), 0) / Math.max(1, xs.length);
  };
  const pickOf = (xs: Body[]) => xs[Math.floor(r() * xs.length)] ?? xs[0];
  const u = r();
  const hold = (pass ? 0.022 : 0.014) * lerp(1.2, 0.8, awr('O', true));
  if (u < hold) return { by: 'O', kind: 'holding', tag: pickOf(p.bodies.filter(isLine)).p.tag };
  const dHold = pass ? 0.012 * lerp(1.2, 0.8, awr('D', false)) : 0;
  const front = (b: Body) => b.slot === 'LE' || b.slot === 'LDT' || b.slot === 'RDT' || b.slot === 'RE';
  if (u < hold + dHold) return { by: 'D', kind: 'def-holding', tag: pickOf(p.bodies.filter((b) => b.side === 'D' && !front(b))).p.tag };
  if (u < hold + dHold + 0.008) return { by: 'D', kind: 'offside', tag: pickOf(p.bodies.filter(front)).p.tag };
  return undefined;
}

function endPlay(p: Play, kind: PlayEnd['kind'], at: Pt, text: string, flag?: Flag) {
  if (p.end) return;
  // brought down (or out) past the goal line: the ball broke the plane
  if ((kind === 'tackle' || kind === 'out' || kind === 'fumble') && at.y >= 100) {
    kind = 'td';
    text = 'TOUCHDOWN';
  }
  const y = kind === 'td' ? 100 : at.y;
  p.end = { kind, x: at.x, y, gain: Math.round((y - p.los) * 10) / 10, text, caught: !!p.catcher && kind !== 'int', secs: p.t, perfects: p.pf?.slice() ?? [], chances: p.chances ?? 0 };
  const f = flag ?? flagFor(p, kind);
  if (f) {
    p.end.flag = f;
    p.events.push('flag:' + f.by + ':' + f.kind);
  }
  p.phase = 'dead';
  p.events.push(kind === 'tackle' ? 'tackle' : kind);
}

/**
 * Advance the play by dt. A vector directly controls both field axes, including stopping/backward.
 * A numeric across-field target is the pilot's lane. Null follows a designed run's lane, and carries
 * any other ball carrier on his momentum (see RunInput).
 */
export function step(p: Play, dt: number, steer: RunInput) {
  if (p.phase === 'pre' || p.phase === 'dead') return;
  p.t += dt;
  const t = p.t;
  const r = p.rand;
  const qb = p.qb;
  for (const b of p.bodies) {
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > Math.ceil(0.7 / dt)) b.trail.shift();
  }
  // how many frames behind his man a defender reacts: coverage and recognition, three frames
  // sooner for a Shutdown corner in the zone, six later right after a receiver wins his break
  const lagOf = (b: Body) =>
    Math.max(
      1,
      Math.round(
        (lerp(13, 6.5, rt(b.p.a.PRC, 45, 99) * 0.4 + rt(b.p.a.MCV ?? b.p.a.ZCV, 45, 99) * 0.6) * (1 - 0.25 * p.defIQ) - (b.job === 'man' && on(b, 'shutdown') ? 3 : 0) + (t < (b.brokenUntil ?? 0) ? 6 : 0)) /
          (60 * dt)
      )
    );
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
    const direction = p.direction ?? 1;
    steerTo(rb, p.bx + mesh.x * direction, p.los + mesh.y, speedOf(rb.p) * 0.65, dt);
    steerTo(qb, p.bx - 0.4 * direction, p.los - 3.7, 4, dt);
    if (t > 0.42 && dist(rb, qb) < 1.8) {
      p.carrier = rb;
      p.carrierAt = t;
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
  const pull = pocketPull(p, steer);
  p.roll = pull ? Math.min(1, Math.hypot(pull.x, pull.y)) : 0;
  for (const b of p.bodies) {
    if (t < b.stunUntil) {
      b.vx *= 0.85;
      b.vy *= 0.85;
      move(b, dt);
      continue;
    }
    if (b === carrier && p.phase === 'run' && p.down) {
      // giving himself up: a slide bleeds off his speed, a dive flies on, and then he's down
      if (p.down.kind === 'slide') {
        const k = Math.max(0, 1 - dt / Math.max(dt, p.down.until - t + dt));
        b.vx *= k;
        b.vy *= k;
      }
      move(b, dt);
      continue;
    }
    if (b === carrier && p.phase === 'run') {
      const manual = typeof steer === 'object' && steer !== null;
      const magnitude = manual ? Math.hypot(steer.x, steer.y) : 1;
      const strength = Number.isFinite(magnitude) ? Math.min(1, magnitude) : 0;
      const m = p.move && t < p.move.until ? p.move : null;
      const burst = !!p.bursting && strength > 0.1 && p.stamina > 0.06 && !m && t >= p.slowUntil;
      if (!m) p.stamina = clamp(p.stamina + (burst ? -0.27 : STAMINA_BACK) * dt, 0, 1);
      const scrambler = b === qb && on(b, 'scrambler');
      if (scrambler) used(p, b, 'scrambler');
      const sp = speedOf(b.p) * (t < p.slowUntil ? 0.65 : burst ? 1.09 : 0.94) * lerp(0.9, 1, p.stamina) * (scrambler ? 1.04 : 1) * (p.covered ? 0.96 : 1);
      const followingRun = steer === null && p.call === 'run' && b === p.rb && b.y < p.los + 1;
      // An outside handoff stretches behind the line before turning upfield. A constant forward
      // velocity used to drag every run into the tackle box, even when its arrow pointed outside.
      const stretching = followingRun && p.run === 'outside' && (p.direction ?? 1) * (p.hole - b.x) > 0.8;
      const landmark = stretching ? { x: p.hole, y: p.los - 0.1 } : null;
      const aim = typeof steer === 'number' ? steer : followingRun ? p.hole : null;
      if (m?.kind === 'juke') {
        // (a PERFECT cut keeps 90% of his speed: three quarters of it across, half of it on upfield)
        b.vx = m.dir * sp * (m.perfect ? 0.75 : 0.8 + 0.35 * m.eff);
        b.vy = sp * (m.perfect ? 0.5 : 0.45);
      } else if (m?.kind === 'spin') {
        b.vx *= 0.9;
        b.vy = sp * (m.perfect ? 0.88 : 0.6);
      } else if (manual) {
        const divisor = Math.max(1, magnitude);
        const wantX = strength ? (steer.x / divisor) * sp : 0,
          wantY = strength ? (steer.y / divisor) * sp : 0;
        const dx = wantX - b.vx,
          dy = wantY - b.vy,
          delta = Math.hypot(dx, dy);
        const braking = strength === 0;
        const reversing = b.vx * wantX + b.vy * wantY < 0;
        const acceleration = braking ? lerp(26, 38, rt(b.p.a.AGI, 40, 99)) : reversing ? lerp(18, 30, rt(b.p.a.AGI, 40, 99)) : lerp(16, 26, rt(b.p.a.ACC, 40, 99));
        const amount = Math.min(1, (acceleration * dt) / Math.max(0.001, delta));
        b.vx += dx * amount;
        b.vy += dy * amount;
      } else if (steer === null && !(p.call === 'run' && b === p.rb)) {
        // The momentum carry (nfl-1): a receiver or a scrambling quarterback nobody is steering yet
        // keeps his speed and bends his run upfield. For the first moment of the carry he turns at
        // CARRY_TURN of his rate (nobody snaps square the instant he has the ball); drifting back
        // toward his own goal, he plants and comes back.
        const early = t - (p.carrierAt ?? 0) < CARRY_HOLD;
        const want = sp * (m && m.kind !== 'truck' ? 0.8 : 1);
        const acceleration = lerp(8, 15, rt(b.p.a.ACC, 40, 99)) * dt;
        if (b.vy < 0) {
          const plant = lerp(26, 38, rt(b.p.a.AGI, 40, 99)) * dt;
          b.vx += clamp(-b.vx, -plant * 0.5, plant * 0.5);
          b.vy += plant;
        } else {
          const heading = Math.atan2(b.vx, b.vy);
          const rate = lerp(2.4, 3.8, rt(b.p.a.AGI, 40, 99)) * (early ? CARRY_TURN : 1) * dt;
          const turned = heading - clamp(heading, -rate, rate);
          const speed = Math.hypot(b.vx, b.vy);
          const v = speed + clamp(want - speed, -acceleration * 2, acceleration);
          b.vx = Math.sin(turned) * v;
          b.vy = Math.cos(turned) * v;
        }
      } else {
        const len = landmark ? Math.max(0.1, dist(b, landmark)) : 1;
        const wantX = landmark ? ((landmark.x - b.x) / len) * sp : aim === null ? 0 : clamp((aim - b.x) * 2.2, -sp * 0.65, sp * 0.65);
        // (a truck drives straight on through the man; the other moves give up a little speed)
        const wantY = (landmark ? Math.max(0, ((landmark.y - b.y) / len) * sp) : Math.sqrt(Math.max(0, sp * sp - wantX * wantX))) * (m && m.kind !== 'truck' ? 0.8 : 1);
        const turn = lerp(11, 21, rt(b.p.a.AGI, 40, 99)) * dt;
        const acceleration = lerp(8, 15, rt(b.p.a.ACC, 40, 99)) * dt;
        b.vx += clamp(wantX - b.vx, -turn, turn);
        b.vy += clamp(wantY - b.vy, -acceleration, acceleration);
      }
      // Finish bringing the catch into the body while still moving; one frame of 'catch' made
      // the recorded catch-in-stride clip disappear before the hands reached the ball.
      if (m || b.act !== 'catch' || t - b.actAt > 0.24) act(b, m ? (m.kind === 'juke' ? 'juke' : m.kind === 'spin' ? 'spin' : m.kind === 'stiff' ? 'stiff' : 'truck') : 'carry', t);
      move(b, dt);
      continue;
    }
    if (b.side === 'O') {
      offense(p, b, dt, pull);
      continue;
    }
    defense(p, b, dt, seen, seenVel);
    if (p.end) return;
  }

  // Real engaged bodies keep separate feet. Leverage and weight determine who gives ground;
  // small fixed-step corrections cannot turn a distant blocking timer into ghost contact.
  if (p.phase === 'run')
    for (const d of p.bodies) {
      if (d.side !== 'D' || t >= d.heldUntil || t < d.stunUntil) continue;
      const o = p.bodies.find((o) => o.id === d.blocker && o.side === 'O' && o !== carrier && o !== qb);
      if (!o) continue;
      const dx = d.x - o.x,
        dy = d.y - o.y,
        dd = Math.hypot(dx, dy);
      if (dd > 0.001 && dd < 0.95) {
        const shift = Math.min(0.95 - dd, dt * 2.5),
          leverage = clamp(0.5 + (o.p.wt - d.p.wt) / 600 + ((o.p.a.STR ?? 70) - (d.p.a.STR ?? 70)) / 200 + (rt(o.p.a.RBK) - rt(d.p.a.BSH)) * 0.15, 0.3, 0.7);
        d.x += (dx / dd) * shift * leverage;
        d.y += (dy / dd) * shift * leverage;
        o.x -= (dx / dd) * shift * (1 - leverage);
        o.y -= (dy / dd) * shift * (1 - leverage);
      }
    }
  // the quarterback the stick took past the line of scrimmage is a runner now (no button needed)
  if (p.phase === 'drop' && p.call === 'pass' && p.carrier === qb && p.spot && qb.y > p.los) scramble(p);
  if (p.phase === 'run' && carrier && p.down && t >= p.down.until && carrier.y < 100) endPlay(p, 'tackle', carrier, p.down.kind === 'slide' ? 'QB SLIDES' : 'DIVES FORWARD');
  if (p.phase === 'run' && carrier) {
    if (carrier.y >= 100) endPlay(p, 'td', carrier, 'TOUCHDOWN');
    else if (carrier.y <= -10) endPlay(p, 'out', carrier, 'OUT OF END ZONE');
    else if (carrier.x < 0.2 || carrier.x > FIELD_W - 0.2) endPlay(p, 'out', carrier, 'OUT OF BOUNDS');
  }
  if (p.phase === 'air' && p.ball) {
    if (t >= p.ball.t1) arrive(p);
    else playPassingLane(p, dt);
  }
  if (!p.end && t > 22) endPlay(p, 'tackle', p.carrier ?? qb, 'DOWN');
  void r;
}

function offense(p: Play, b: Body, dt: number, pull: Pt | null) {
  const t = p.t;
  const qb = p.qb;
  if (b === qb) {
    if (p.call === 'pass' && p.carrier === qb && pull) {
      // the stick moves him in the pocket (nfl-2): slide, step up, roll out, by his agility
      // live from the first step (a thumb already on the stick at the snap counts), but until he's
      // at his drop depth he keeps backpedalling: the stick can drift him, not bring him forward
      const sp = pocketSpeed(qb.p);
      const dropping = t < DROP_TIME && qb.y > p.los - DROP_DEPTH + 0.2;
      const dvx = pull.x * sp - qb.vx,
        dvy = (dropping ? Math.min(pull.y * sp, DROP_BACK) : pull.y * sp) - qb.vy;
      const delta = Math.hypot(dvx, dvy);
      const amount = Math.min(1, (lerp(14, 22, rt(qb.p.a.ACC, 40, 99)) * dt) / Math.max(0.001, delta));
      qb.vx += dvx * amount;
      qb.vy += dvy * amount;
      p.spot = { x: qb.x + qb.vx * dt, y: qb.y + qb.vy * dt };
      act(qb, dropping ? 'backpedal' : Math.hypot(qb.vx, qb.vy) > 1 ? 'run' : 'stance', t);
    } else if (p.call === 'pass' && p.carrier === qb) {
      // the drop (backpedalling), then he sets; once the stick has moved him he holds where it left him
      if (p.spot) steerTo(qb, p.spot.x, p.spot.y, 3, dt);
      else steerTo(qb, p.bx, p.los - DROP_DEPTH, 3, dt);
      act(qb, !p.spot && t < DROP_TIME && qb.y > p.los - DROP_DEPTH + 0.2 ? 'backpedal' : 'stance', t);
    } else if (p.phase === 'run' || p.spot) steerTo(qb, qb.x, qb.y, 0, dt);
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
    const assigned = p.call === 'run' && isLine(b) && !climbTo ? p.bodies.find((d) => d.side === 'D' && d.mark === b.id && t < d.heldUntil) : undefined;
    const target = assigned ?? climb ?? p.bodies.filter((d) => d.side === 'D' && t >= d.stunUntil && d.y > b.y - 2.5).sort((a1, a2) => dist(a1, b) - dist(a2, b))[0];
    const line = isLine(b);
    if (target) {
      const d = dist(target, b);
      if (d < 1.3 && target.heldUntil < t && b.heldUntil < t && (p.call === 'run' || p.phase === 'run' || !line)) {
        // engaged: held a while by his run blocking (a lineman far longer than a receiver)
        const blk = line || b.slot === 'TE' ? rt(b.p.a.RBK) : 0.15;
        const stopper = on(target, 'run-stopper');
        const shed = rt(target.p.a.BSH) + (stopper ? 0.2 : 0);
        const grader = (line || b.slot === 'TE') && on(b, 'road-grader');
        const hold = Math.max(0.25, (b.slot === 'TE' ? 1.15 + blk * 1.2 - shed * 0.65 : 0.9 + blk * 1.1 - shed * 0.8) * (line || b.slot === 'TE' ? 1 : 0.5) + p.rand() * 0.3 + (grader ? 0.25 : 0));
        if (stopper) used(p, target, 'run-stopper');
        if (grader) used(p, b, 'road-grader');
        target.heldUntil = t + hold;
        target.blocker = b.id;
        b.heldUntil = t + hold + 1.2;
        // a pancake: a good impact blocker more often (no cliff at 85)
        if (line && p.rand() < 0.12 * rt(b.p.a.IBL, 70, 99)) {
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
    // he runs to where the throw was meant to go and reads the ball itself only late in its flight
    // (a sharper receiver sooner): an off-target throw makes him adjust, reach, or miss it. (He used
    // to run straight to where it would land, so a passer's accuracy never showed.)
    const k = (t - p.ball.t0) / Math.max(0.05, p.ball.t1 - p.ball.t0);
    const reads = k > lerp(0.62, 0.42, rt(b.p.a.CTH, 50, 99)) || !p.aim;
    const goal = reads ? p.ball.to : p.aim!;
    const left = Math.max(0.05, p.ball.t1 - t);
    const d = dist(b, goal);
    steerTo(b, goal.x, goal.y, Math.min(speedOf(b.p), Math.max(d / left, speedOf(b.p) * 0.6)), dt, 20);
  } else if (next) {
    steerTo(b, next.x, next.y, speedOf(b.p) * jam, dt, lerp(13, 22, rt(b.p.a.RTE)));
    if (dist(b, next) < 0.8 && (b.route.length > 1 || !b.sit)) {
      if (b.route.length > 1) breakRoute(p, b);
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

/**
 * A receiver breaks off his stem: his route running and agility against his man's coverage and
 * agility. Win it and his man reacts six frames late and runs at 80% for a quarter second.
 */
export function routeWinChance(o: FbPlayer, d: FbPlayer): number {
  return clamp(0.5 + ((o.a.RTE ?? 60) - (d.a.MCV ?? 60)) / 60 + ((o.a.AGI ?? 70) - (d.a.AGI ?? 70)) / 150, 0.1, 0.9);
}
function breakRoute(p: Play, b: Body) {
  const d = p.bodies.find((x) => x.side === 'D' && x.job === 'man' && x.mark === b.id && dist(x, b) < 6);
  if (!d || p.phase !== 'drop') return;
  if (p.rand() < routeWinChance(b.p, d.p)) {
    d.brokenUntil = p.t + 0.25;
    p.events.push('route-win:' + b.id);
  }
}

function defense(p: Play, b: Body, dt: number, seen: (b: Body, by: Body) => Pt, seenVel: (b: Body, by: Body) => Pt) {
  const t = p.t;
  const qb = p.qb;
  const carrier = p.carrier;
  // A timer cannot pin a defender to an invisible blocker across the field.
  const blocker = p.bodies.find((o) => o.id === b.blocker && o.side === 'O' && o !== carrier && o !== qb && t >= o.stunUntil);
  const held = t < b.heldUntil && !!blocker && dist(blocker, b) < 2.8;
  const sp = speedOf(b.p) * (held ? 0.12 : 1) * (t < (b.brokenUntil ?? 0) ? 0.8 : 1);
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
      if (b.windAt !== Infinity) b.ringAt = undefined;
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
        if (dist(b, carrier) < 1.0 + 0.4 * rt(b.p.a.TAK, 40, 99)) tackle(p, b, carrier);
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
    // the last few yards of a pursuit: he finds a little more (by his pursuit), so a runner a step
    // faster than him is no longer gone for good (it was a pure race: a two-point edge in speed
    // turned every run into a touchdown or a stop); a clearly faster man still pulls away
    const closingBurst = rel < 5 ? 1 + 0.04 + 0.04 * rt(b.p.a.PUR ?? b.p.a.TAK, 45, 99) : 1;
    const intercept = pursuitTarget(b, carrier, v, sp * closingBurst);
    const winding = b.windAt < Infinity;
    steerTo(b, intercept.x, intercept.y, sp * closingBurst * (winding ? 0.85 : 1), dt, 18);
    const closing = ((carrier.x - b.x) * (b.vx - carrier.vx) + (carrier.y - b.y) * (b.vy - carrier.vy)) / Math.max(0.3, rel);
    if (!winding) {
      // close and closing: he gathers to dive (the runner can see it)
      if (rel < WIND_R && closing > 1.5 && t > b.stunUntil) {
        b.windAt = t;
        // the ring (nfl-4): its window is centred on the moment he commits
        b.ringAt = t + windupOf(b);
        b.ringSeen = false;
        act(b, 'windup', t);
      } else act(b, 'run', t);
    } else if (rel > WIND_R + 2.5) {
      b.windAt = Infinity;
      b.ringAt = undefined;
      act(b, 'run', t);
    } else if (t >= b.windAt + windupOf(b)) {
      // a gold ring the carrier had on offer, whether or not he took it
      if (!b.ringSeen && moveReady(p)) {
        b.ringSeen = true;
        offered(p, 'move');
      }
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
      act(qb, 'down', t);
      act(b, 'tackle', t);
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
      const threat = deep > 15 && on(m, 'deep-threat');
      if (threat) used(p, m, 'deep-threat');
      const cushion = Math.max(0.8, lerp(2.5, 1.5, cover) - 0.3 * p.defIQ) + (deep > 12 ? lerp(1.2, 0.6, cover) + burn * 0.8 : 0) - (threat ? 0.5 : 0);
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
      if (deep) steerTo(b, lerp(z.x, at.x, 0.55 + 0.3 * read), Math.max(at.y + lerp(2.4, 1.6, read), z.y - 2), sp, dt);
      else steerTo(b, (at.x + z.x) / 2 + (at.x - z.x) * (0.1 + read * 0.25), Math.max(at.y + lerp(2.3, 1.5, read), p.los + 1), sp, dt);
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
  if (p.down) {
    // he gave himself up: down by contact, nothing to roll
    d.windAt = Infinity;
    d.dive = null;
    act(d, 'tackle', p.t);
    endPlay(p, 'tackle', c, p.down.kind === 'slide' ? 'QB SLIDES' : 'DOWN BY CONTACT');
    return;
  }
  const r = p.rand;
  const m = p.move && p.t < p.move.until + 0.15 ? p.move : null;
  d.windAt = Infinity;
  d.dive = null;
  const help = p.bodies.some((o) => o !== d && o.side === 'D' && p.t >= o.stunUntil && p.t >= o.heldUntil && dist(o, c) < 1.6);
  const tak = rt(d.p.a.TAK, 40, 99);
  const btk = rt(c.p.a.BTK, 40, 99);
  let pt = 0.9 + 0.16 * tak - 0.2 * btk + (help ? 0.2 : 0) + 0.03 * p.defIQ;
  if (m) {
    const timed = m.at >= d.diveAt - FAKE && m.at <= d.diveAt + 0.15;
    const at = p.t <= m.until;
    let cut = moveEdge(m.kind, c, d) * m.eff;
    // timed against his dive (a juke or a spin as he leaves his feet) he grabs at air; a stiff arm
    // or a truck works at contact, the moment he arrives
    if ((m.kind === 'juke' || m.kind === 'spin') && timed) cut += (m.kind === 'juke' ? 0.32 : 0.2) * m.eff;
    if ((m.kind === 'stiff' || m.kind === 'truck') && at) cut += 0.18 * m.eff;
    if (m.kind === 'juke' && on(c, 'juke-box')) {
      cut *= 1.15;
      used(p, c, 'juke-box');
    }
    if (m.kind === 'truck' && on(c, 'truck-stick')) {
      cut += 0.12 * m.eff;
      used(p, c, 'truck-stick');
    }
    pt -= cut;
  }
  if (r() < clamp(pt, 0.15, 0.96)) {
    // a big hit can jar it loose (an Enforcer a point more often)
    const hit = rt(d.p.a.HIT, 50, 99);
    const enforcer = on(d, 'enforcer');
    if (r() < (0.012 + 0.02 * hit - 0.02 * rt(c.p.a.CAR, 50, 99) + (enforcer ? 0.01 : 0)) * (p.covered ? COVERED_FUMBLE : 1)) {
      if (enforcer) used(p, d, 'enforcer');
      // the ball's loose: who falls on it is close to a coin flip (the offense keeps about 45% of
      // its fumbles), so a jarring hit isn't always a turnover (Claude 2026-11-01; it always was)
      if (r() < 0.45) {
        act(c, 'down', p.t);
        act(d, 'tackle', p.t);
        p.events.push('fumble-kept');
        endPlay(p, 'tackle', c, 'FUMBLE! ' + c.p.tag + ' FALLS ON IT');
        return;
      }
      endPlay(p, 'fumble', c, 'FUMBLE! ' + d.p.tag + ' FORCES IT');
      return;
    }
    // a big hit: a hard hitter arriving fast drives the runner back (the screen shows it in slow
    // motion). Smooth in HIT (it was off below 77, then jumped); an Enforcer can always land one.
    const closing = Math.hypot(d.vx - c.vx, d.vy - c.vy);
    const big = closing > (enforcer ? 6 : 7.5) && r() < Math.max(0.3 * hit, enforcer ? 0.3 : 0);
    if (big && enforcer) used(p, d, 'enforcer');
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

/**
 * How much a move takes off a tackler's chance (before stamina, repeats and timing): the runner's
 * move rating against what beats it. A juke beats pursuit, a spin the tackle; a stiff arm is the
 * stiff-arm rating with strength against tackling and strength; a truck is trucking with strength
 * and the weight he carries into the man against hit power and strength. (Before, a truck was
 * judged against the better of TAK and HIT and got no timing bonus, so the AI and the numbers both
 * steered every runner to the juke whatever his ratings.)
 */
export function moveEdge(kind: Move, c: Body, d: Body): number {
  const ca = c.p.a,
    da = d.p.a;
  const str = (a: Record<string, number>) => a.STR ?? 70;
  let v: number, vs: number;
  if (kind === 'juke') {
    v = ca.JKM ?? 50;
    vs = da.PUR ?? da.TAK ?? 60;
  } else if (kind === 'spin') {
    v = ca.SPM ?? 45;
    vs = da.TAK ?? 60;
  } else if (kind === 'stiff') {
    v = 0.7 * (ca.SFA ?? 45) + 0.3 * str(ca);
    vs = 0.7 * (da.TAK ?? 60) + 0.3 * str(da);
  } else {
    v = 0.7 * (ca.TRK ?? 45) + 0.3 * str(ca) + (c.p.wt - d.p.wt) / 8;
    vs = 0.7 * Math.max(da.TAK ?? 60, da.HIT ?? 60) + 0.3 * str(da);
  }
  return 0.18 + (rt(v, 40, 99) - rt(vs, 40, 99)) * 0.45;
}

/** A defender can touch the actual ball's swept path only after reading the throw, and within
 * arm/jump reach. High lobs clear underneath defenders; each player attempts once per pass. */
function playPassingLane(p: Play, dt: number) {
  const ball = p.ball!;
  // (a PERFECT sling is a catchable ball in stride: nobody gets a hand on it on the way)
  if (ball.away || ball.sure !== undefined) return;
  const k = clamp((p.t - ball.t0) / (ball.t1 - ball.t0), 0, 1);
  if (k < 0.12 || k > 0.92) return; // catch-point battles are resolved by arrive()
  const at = ballNow(p)!;
  const before = clamp((p.t - dt - ball.t0) / (ball.t1 - ball.t0), 0, 1);
  const old = { x: ball.from.x + (ball.to.x - ball.from.x) * before, y: ball.from.y + (ball.to.y - ball.from.y) * before };
  const dx = at.x - old.x,
    dy = at.y - old.y,
    length2 = dx * dx + dy * dy;
  for (const b of p.bodies.filter((b) => b.side === 'D').sort((a, b) => dist(a, at) - dist(b, at))) {
    if (p.t < b.breakAt || p.t < b.stunUntil || ball.tried?.includes(b.id)) continue;
    const u = clamp(((b.x - old.x) * dx + (b.y - old.y) * dy) / Math.max(0.001, length2), 0, 1);
    const near = Math.hypot(b.x - old.x - dx * u, b.y - old.y - dy * u);
    const reach = 0.65 + rt(b.p.a.MCV ?? b.p.a.ZCV, 40, 99) * 0.4 + Math.max(0, b.p.ht - 72) * 0.02;
    const height = 2.35 + Math.max(0, b.p.ht - 72) * 0.025 + rt(b.p.a.AGI, 40, 99) * 0.5;
    if (near > reach || at.h > height) continue;
    (ball.tried ??= []).push(b.id);
    act(b, 'catch', p.t);
    // a play on the ball in the lane: half recognition, half coverage
    const play = 0.28 + 0.36 * (0.5 * rt(b.p.a.PRC, 40, 99) + 0.5 * rt(b.p.a.ZCV ?? b.p.a.MCV, 40, 99)) + 0.07 * p.defIQ;
    if (p.rand() >= play) continue;
    const hawk = on(b, 'ballhawk');
    const picked = p.rand() < 0.18 + 0.3 * rt(b.p.a.CTH, 40, 99) + (hawk ? 0.15 : 0);
    if (hawk && picked) used(p, b, 'ballhawk');
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
  if (ball.away) {
    endPlay(p, 'incomplete', at, 'THROWN AWAY');
    return;
  }
  if (at.x < 0 || at.x > FIELD_W || at.y > 110) {
    endPlay(p, 'incomplete', at, 'INCOMPLETE');
    return;
  }
  // a PERFECT sling's ball is his (gold is offered only when he's getting there in stride)
  const sure = ball.sure !== undefined ? p.bodies[ball.sure] : undefined;
  const off = sure ?? p.bodies.filter((b) => b.side === 'O' && b !== p.qb && !isLine(b)).sort((a, b) => dist(a, at) - dist(b, at))[0];
  const def = p.bodies.filter((b) => b.side === 'D' && p.t >= b.stunUntil).sort((a, b) => dist(a, at) - dist(b, at))[0];
  const ro = off ? dist(off, at) : 99;
  const rd = def ? dist(def, at) : 99;
  const hands = rt(off?.p.a.CTH, 45, 99);
  // a high ball (a lob, or one riding high) is a spectacular catch: SPC adds reach
  const high = ball.type === 'lob' || ball.peak > 2.6;
  const reach = 1.2 + 0.45 * hands + (off ? (off.p.ht - 72) * 0.03 : 0) + (off && high ? 0.35 * rt(off.p.a.SPC, 45, 99) : 0);
  const dReach = 0.95 + 0.25 * rt(def?.p.a.CTH ?? def?.p.a.MCV, 40, 99);
  if (off && (ro <= reach || sure)) {
    // reaching for it costs more the further it is from him
    let pc = 0.78 + 0.19 * hands - clamp((ro - 0.7) * 0.22, 0, 0.3);
    let pi = 0;
    const contested = !!def && rd <= dReach;
    if (!contested && on(off, 'sure-hands')) {
      pc = Math.max(pc, 0.96);
      used(p, off, 'sure-hands');
    }
    if (def && contested) {
      // contested: the receiver's catch in traffic against the defender's coverage and hands
      const edge = clamp((rd - ro + 0.5) / 1.2, 0, 1);
      const cit = rt(off.p.a.CIT, 45, 99);
      const db = rt(def.p.a.MCV ?? def.p.a.ZCV, 45, 99);
      pc = lerp(0.25, 0.85, edge) * (0.7 + 0.4 * cit) - 0.12 * db;
      if (at.y >= 80 && on(off, 'red-zone')) {
        pc += 0.15;
        used(p, off, 'red-zone');
      }
      const hawk = on(def, 'ballhawk') ? 0.15 : 0;
      pi = (rd < ro - 0.2 ? 0.05 + 0.15 * rt(def.p.a.CTH, 40, 99) : 0.01 + 0.03 * rt(def.p.a.CTH, 40, 99)) + hawk * (rd < ro ? 1 : 0.3);
    }
    if (sure) {
      // in stride: no drop, no pick
      pc = 1;
      pi = 0;
    }
    const roll = r();
    if (roll < pi) {
      if (def && on(def, 'ballhawk')) used(p, def, 'ballhawk');
      endPlay(p, 'int', at, 'PICKED OFF BY ' + (def?.p.tag ?? ''));
      return;
    }
    if (roll < pi + (sure ? 1 : clamp(pc, 0.08, 0.97 - pi))) {
      p.carrier = off;
      p.carrierAt = p.t;
      off.job = 'carry';
      p.catcher = off;
      p.catchInfo = { ro, high, contested };
      p.caughtAt = { x: at.x, y: at.y };
      p.phase = 'run';
      const traffic = !!def && rd < 1.8,
        reaching = ro > 1;
      p.slowUntil = p.t + (traffic ? 0.3 : reaching ? 0.2 : 0.06);
      const momentum = traffic ? 0.55 : reaching ? 0.72 : 0.96;
      off.vx *= momentum;
      off.vy *= momentum;
      act(off, 'catch', p.t);
      p.events.push(def && rd < 1.3 ? 'catch-contested' : 'catch');
      for (const b of p.bodies) if (b.side === 'D') b.job = 'pursue';
      if (off.y >= 100) endPlay(p, 'td', off, 'TOUCHDOWN');
      return;
    }
    // a defender all over him on a ball down the field: now and then the flag comes out
    const dpi = def && rd < 1.3 && at.y - p.los >= 12 && r() < 0.14 ? ({ by: 'D', kind: 'dpi', tag: def.p.tag, spot: Math.min(99, at.y) } as Flag) : undefined;
    endPlay(p, 'incomplete', at, def && rd < 1.6 ? 'BROKEN UP BY ' + def.p.tag : 'DROPPED', dpi);
    return;
  }
  if (def && rd <= dReach * 0.9 && r() < 0.2 + 0.25 * rt(def.p.a.CTH, 40, 99) + (on(def, 'ballhawk') ? 0.15 : 0)) {
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
