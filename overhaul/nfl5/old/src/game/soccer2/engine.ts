// Soccer v2: one attack, simulated. Implemented by Claude (Anthropic), 2026-11-01.
//
// The ball is a 2.5D body: on the grass it rolls against grass resistance and air drag; in the air
// it falls under gravity, slows with drag (∝ v²), bends with spin (a sideways Magnus push ∝ speed)
// and bounces. Passes and shots are solved for the speed that gets them there under that physics,
// then thrown off by the passer's or shooter's error. Defenders hold a zonal back line (the
// offside line) that steps up and drops with the ball, the nearest presses and tackles (DEF
// against DRI within 1.2 m), the next covers. The keeper stands on the angle's bisector, reacts
// to a strike after his REF delay, dives as far as his DIV carries him and catches (HAN) or parries.
// Everything random comes from the attack's seeded generator, so an attack replays exactly from
// its seed and its inputs.
import { hashString, rng } from '../../engine/rng';
import {
  accelOf,
  blockChance,
  dribblePace,
  gkArm,
  gkCatch,
  gkDive,
  gkMisread,
  gkPenaltyRead,
  gkPositionError,
  gkReaction,
  gkSmother,
  greenHalf,
  headerSpeed,
  interceptChance,
  interceptReach,
  JOG,
  jumpReach,
  passError,
  rt,
  shotCone,
  shotSpeed,
  tackleWin,
  topSpeed,
} from './ratings';
import type { Act, Attack, AttackEnd, Ball, Body, PassKind, Pt, Scenario, ShotInfo, SoccerPlayer, Squad } from './types';

/* ---------- the pitch (metres) ---------- */
export const PW = 68;
export const PL = 105;
export const GX = 34;
export const GHALF = 3.66;
export const GH = 2.44;
export const BOX = 16.5;
export const BOXHALF = 20.16;
export const SIX = 5.5;
export const SIXHALF = 9.16;
export const SPOT_Y = PL - 11;
export const BALL_R = 0.11;
/** the attack's clock (seconds of open play), and stoppage time's */
export const CLOCK = 30;
export const STOPPAGE_CLOCK = 15;
/** the power meter: fills in METER s, the green sits at TOP (0.72 s until 2026-11-02: a quicker
 * wind-up gets the shot off before the man closing you down arrives) */
export const METER = 0.86;
export const TOP = 0.62;

const G = 9.81;
/** air drag, per metre: a = DRAG v² (a match ball, about 0.013) */
export const DRAG = 0.013;
/** rolling resistance on cut grass, m/s², and the share of air drag a rolling ball still feels */
export const ROLL = 1.4;
const ROLL_DRAG = 0.8 * DRAG;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;
const norm = (x: number, y: number) => {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
};
const goalC: Pt = { x: GX, y: PL };
export const inBox = (q: Pt) => q.y > PL - BOX && Math.abs(q.x - GX) < BOXHALF;

/* ---------- the ball ---------- */

/** One physics step of a free ball. */
export function stepBall(b: Ball, dt: number) {
  const sp = Math.hypot(b.vx, b.vy);
  if (b.h > 0.001 || b.vh > 0.01) {
    const s3 = Math.hypot(sp, b.vh);
    const k = DRAG * s3 * dt;
    b.vx -= k * b.vx;
    b.vy -= k * b.vy;
    b.vh -= k * b.vh + (G + b.dip) * dt;
    if (sp > 0.5 && b.curl) {
      // the Magnus push: sideways, to the left of travel for a positive curl
      const a = b.curl * sp * dt;
      b.vx += (-b.vy / sp) * a;
      b.vy += (b.vx / sp) * a;
    }
    b.curl *= Math.exp(-0.45 * dt);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.h += b.vh * dt;
    if (b.h <= 0) {
      b.h = 0;
      if (b.vh < -1.6) {
        b.vh = -b.vh * 0.55;
        b.vx *= 0.8;
        b.vy *= 0.8;
        b.curl *= 0.3;
        b.dip = 0;
      } else b.vh = 0;
    }
    return;
  }
  b.h = 0;
  b.vh = 0;
  b.dip = 0;
  if (sp > 0) {
    const dec = (ROLL + ROLL_DRAG * sp * sp) * dt;
    const k = Math.max(0, sp - dec) / sp;
    b.vx *= k;
    b.vy *= k;
    if (sp > 0.5 && b.curl) {
      const a = b.curl * 0.25 * sp * dt;
      b.vx += (-b.vy / sp) * a;
      b.vy += (b.vx / sp) * a;
    }
  }
  b.curl *= Math.exp(-3 * dt);
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

export interface PathPt {
  t: number;
  x: number;
  y: number;
  h: number;
  v: number;
}

/** Where a free ball goes: a point every 1/30 s for up to `maxT` s (stops when it's at rest). */
export function tracePath(b: Ball, maxT = 3.2): PathPt[] {
  const q: Ball = { ...b, flight: null };
  const out: PathPt[] = [{ t: 0, x: q.x, y: q.y, h: q.h, v: Math.hypot(q.vx, q.vy) }];
  const dt = 1 / 120;
  for (let i = 1; i <= maxT * 120; i++) {
    stepBall(q, dt);
    if (i % 4 === 0) {
      const v = Math.hypot(q.vx, q.vy);
      out.push({ t: i * dt, x: q.x, y: q.y, h: q.h, v });
      if (v < 0.2 && q.h < 0.01) break;
    }
  }
  return out;
}

/** The speed a pass along the grass leaves the foot at to cover `d` m and arrive at `vEnd`. */
export function groundSpeedFor(d: number, vEnd: number): number {
  const c = ROLL_DRAG;
  const v0sq = ((ROLL + c * vEnd * vEnd) * Math.exp(2 * c * d) - ROLL) / c;
  return Math.sqrt(Math.max(vEnd * vEnd, v0sq));
}

/** A ball struck from `from` (height h0) to land at `to` after about `T` s, drag included. */
export function loftVelocity(from: Pt & { h?: number }, to: Pt, T: number): { vx: number; vy: number; vh: number } {
  const h0 = from.h ?? 0;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  let horiz = d / T;
  let vh = (G * T) / 2 - h0 / T;
  for (let it = 0; it < 4; it++) {
    const q: Ball = { x: from.x, y: from.y, h: h0, vx: (dx / d) * horiz, vy: (dy / d) * horiz, vh, curl: 0, dip: 0, owner: null, last: null, flight: null };
    let tt = 0;
    while (tt < 6) {
      stepBall(q, 1 / 120);
      tt += 1 / 120;
      if (q.h <= 0 && q.vh <= 0.01 && tt > 0.05) break;
      if (q.h <= 0.0001 && tt > 0.05) break;
    }
    const got = Math.hypot(q.x - from.x, q.y - from.y);
    horiz *= clamp(d / Math.max(0.5, got), 0.7, 1.4);
    vh *= clamp(Math.sqrt(T / Math.max(0.2, tt)), 0.85, 1.2);
  }
  return { vx: (dx / d) * horiz, vy: (dy / d) * horiz, vh };
}

/** A shot from `from` at speed `v` that crosses the goal line at (tx, th). */
export function shotVelocity(from: Pt & { h?: number }, tx: number, th: number, v: number, dip = 0): { vx: number; vy: number; vh: number } {
  const h0 = from.h ?? 0.11;
  const dir = norm(tx - from.x, PL - from.y);
  const d = Math.max(1, Math.hypot(tx - from.x, PL - from.y));
  let t = d / v;
  let vh = (th - h0) / t + ((G + dip) * t) / 2;
  for (let it = 0; it < 4; it++) {
    const q: Ball = { x: from.x, y: from.y, h: h0, vx: dir.x * v, vy: dir.y * v, vh, curl: 0, dip, owner: null, last: null, flight: null };
    let tt = 0;
    let lastH = h0;
    while (q.y < PL && tt < 5) {
      lastH = q.h;
      stepBall(q, 1 / 120);
      tt += 1 / 120;
      if (q.vy <= 0.1) break;
    }
    const hm = q.y >= PL ? q.h : lastH;
    t = tt;
    vh += (th - hm) / Math.max(0.15, t);
  }
  return { vx: dir.x * v, vy: dir.y * v, vh };
}

/* ---------- bodies and set-up ---------- */

function body(id: number, side: 'A' | 'D', p: SoccerPlayer, slot: string, x: number, y: number): Body {
  return { id, side, role: side === 'A' ? 'att' : p.keeper && slot === 'GK' ? 'gk' : 'def', p, slot, x, y, vx: 0, vy: 0, h: 0, vh: 0, act: 'idle', actAt: 0, home: { x, y }, mark: null, stunUntil: 0, tackleReady: 0, commit: Infinity, run: null, fx: 0, fy: side === 'A' ? 1 : -1, tried: -1 };
}

export function act(b: Body, a: Act, t: number) {
  if (b.act === a) return;
  b.act = a;
  b.actAt = t;
}

const keeperOf = (a: Attack) => a.bodies.find((b) => b.role === 'gk')!;
export const ctrlOf = (a: Attack) => a.bodies[a.ctrl];
export const ownerOf = (a: Attack): Body | null => (a.ball.owner === null ? null : a.bodies[a.ball.owner]);

/** The offside line: the second-last defender (the keeper usually the last), never short of halfway. */
export function offsideLine(a: Attack): number {
  const ys = a.bodies
    .filter((b) => b.side === 'D')
    .map((b) => b.y)
    .sort((p, q) => q - p);
  return Math.max(PL / 2, ys[1] ?? PL / 2);
}

export interface AttackOpts {
  clock?: number;
  stoppage?: boolean;
  defIQ?: number;
  /** -1 mirrors the set-up to the right side; 1 or unset: seeded */
  side?: number;
  /** a penalty's taker (a shootout's order), else the best finisher */
  taker?: SoccerPlayer;
}

/**
 * Line up an attack: `att` attacks up the pitch at `def`'s goal. Each scenario uses the players
 * that would be there (a counter: the front three against two centre-backs and recovering
 * midfielders; a corner: the big men in the box), mirrored left or right by the seed.
 */
export function setupAttack(scenario: Scenario, att: Squad, def: Squad, seed: string, opts: AttackOpts = {}): Attack {
  const rand = rng(hashString('soccer:' + seed));
  const side = opts.side ?? (rand() < 0.5 ? 1 : -1);
  const mx = (x: number) => (side === 1 ? x : PW - x);
  const bodies: Body[] = [];
  const A = (p: SoccerPlayer, slot: string, x: number, y: number) => {
    const b = body(bodies.length, 'A', p, slot, mx(x), y);
    bodies.push(b);
    return b;
  };
  const D = (p: SoccerPlayer, slot: string, x: number, y: number) => {
    const b = body(bodies.length, 'D', p, slot, mx(x), y);
    bodies.push(b);
    return b;
  };
  const [lb, lcb, rcb] = att.def;
  const [lcm, hold, rcm] = att.mid;
  const [lw, st, rw] = att.fwd;
  // their back four as we see them: their right-back on our left
  const [dLB, dLCB, dRCB, dRB] = def.def;
  const [dLCM, dDM, dRCM] = def.mid;
  let carrier: Body;
  let setPiece: Attack['setPiece'] = null;
  const ball: Ball = { x: 0, y: 0, h: 0, vx: 0, vy: 0, vh: 0, curl: 0, dip: 0, owner: null, last: null, flight: null };
  const gk = D(def.gk, 'GK', 34, PL - 1.5);
  gk.role = 'gk';
  switch (scenario) {
    case 'counter': {
      // the quickest of the front three breaks with it
      const order = [lw, st, rw].sort((p, q) => rt(q.a.PAC) - rt(p.a.PAC));
      const runner = order[0];
      const others = [lw, st, rw].filter((p) => p !== runner);
      carrier = A(runner, runner === lw ? 'LW' : runner === st ? 'ST' : 'RW', 27, 47);
      A(others[0], others[0] === lw ? 'LW' : others[0] === st ? 'ST' : 'RW', 15, 50);
      A(others[1], others[1] === rw ? 'RW' : others[1] === st ? 'ST' : 'LW', 50, 48);
      A(rcm, 'RCM', 40, 34);
      D(dRCB, 'RCB', 29, 66);
      D(dLCB, 'LCB', 41, 64);
      // two midfielders chase back, a stride behind
      D(dDM, 'DM', 31, 41);
      D(dLCM, 'LCM', 45, 40);
      for (const b of bodies) if (b.side === 'A') b.vy = 6.2;
      for (const b of bodies) if (b.side === 'D' && b.role === 'def') b.vy = b.y < 50 ? 5.5 : -1.5;
      break;
    }
    case 'wide': {
      carrier = A(lw, 'LW', 9, 71);
      A(lb, 'LB', 5, 61);
      A(lcm, 'LCM', 22, 69);
      A(st, 'ST', 32, 82);
      A(rw, 'RW', 53, 80);
      A(hold, 'CM', 34, 60);
      D(dRB, 'RB', 12, 78);
      D(dRCB, 'RCB', 27, 86);
      D(dLCB, 'LCB', 38, 87);
      D(dLB, 'LB', 53, 85);
      D(dRCM, 'RCM', 19, 73);
      D(dDM, 'DM', 32, 76);
      break;
    }
    case 'corner': {
      const taker = [lcm, rcm, hold, lw, rw].sort((p, q) => rt(q.a.PAS) - rt(p.a.PAS))[0];
      carrier = A(taker, 'TKR', 0.9, PL - 0.9);
      const pool = [st, lcb, rcb, lw, rw, lcm, rcm, hold].filter((p) => p !== taker);
      const spots: Pt[] = [
        { x: 33, y: PL - 9 },
        { x: 37, y: PL - 11.5 },
        { x: 29, y: PL - 12.5 },
        { x: 40, y: PL - 7.5 },
        { x: 25, y: PL - 18 },
      ];
      spots.forEach((s, i) => A(pool[i], 'BX' + i, s.x, s.y));
      const zone: Pt[] = [
        { x: 30.6, y: PL - 0.8 },
        { x: 32, y: PL - 4 },
        { x: 36, y: PL - 4.4 },
        { x: 40, y: PL - 4 },
        { x: 33.5, y: PL - 9.8 },
        { x: 38, y: PL - 11 },
        { x: 29.5, y: PL - 13.5 },
      ];
      [dLB, dLCB, dRCB, dRB, dDM, dLCM, dRCM].forEach((p, i) => D(p, 'Z' + i, zone[i].x, zone[i].y));
      setPiece = { kind: 'corner', spot: { x: mx(0.5), y: PL - 0.5 }, side };
      gk.x = mx(34.6);
      gk.y = PL - 0.7;
      break;
    }
    case 'freekick': {
      const fy = 78 + rand() * 8;
      const fxRaw = 22 + rand() * 24;
      const taker = [st, lw, rw, lcm, rcm, hold].sort((p, q) => rt(q.a.SHO) - rt(p.a.SHO))[0];
      carrier = A(taker, 'TKR', fxRaw - 0.4, fy - 1.3);
      const pool = [st, lw, rw, lcm, rcm, lcb].filter((p) => p !== taker);
      const spots: Pt[] = [
        { x: 36, y: PL - 11 },
        { x: 45, y: PL - 10 },
        { x: 28, y: PL - 12 },
        { x: fxRaw + 6, y: fy + 1 },
      ];
      spots.forEach((s, i) => A(pool[i], 'BX' + i, s.x, s.y));
      // the wall: four men 9.15 m off, across the line to the middle of the goal
      const to = norm(GX - fxRaw, PL - fy);
      const wallC = { x: fxRaw + to.x * 9.15, y: fy + to.y * 9.15 };
      const across = { x: -to.y, y: to.x };
      const nearSide = fxRaw < GX ? -1 : 1;
      [dLCB, dRCB, dDM, dRCM].forEach((p, i) => {
        const o = (i - 1.5) * 0.62 + nearSide * 0.45;
        const w = D(p, 'WALL', wallC.x + across.x * o, wallC.y + across.y * o);
        w.act = 'wall';
      });
      D(dLB, 'LB', 44, PL - 9);
      D(dRB, 'RB', 30, PL - 10);
      D(dLCM, 'LCM', 37, PL - 14);
      setPiece = { kind: 'freekick', spot: { x: mx(fxRaw), y: fy }, side };
      break;
    }
    case 'penalty': {
      const taker = opts.taker ?? [st, lw, rw, lcm, rcm, hold].sort((p, q) => rt(q.a.SHO) - rt(p.a.SHO))[0];
      carrier = A(taker, 'TKR', 34, SPOT_Y - 1.6);
      [lw, rw, lcm].filter((p) => p !== taker).forEach((p, i) => A(p, 'RIM' + i, 26 + i * 8, PL - 19));
      [dLCB, dRCB, dDM].forEach((p, i) => D(p, 'RIM', 28 + i * 7, PL - 19.5));
      setPiece = { kind: 'penalty', spot: { x: GX, y: SPOT_Y }, side: 1 };
      gk.x = GX;
      gk.y = PL - 0.2;
      break;
    }
    default: {
      // build-up: from the left centre-mid, just inside their half
      carrier = A(lcm, 'LCM', 27, 51);
      A(hold, 'CM', 36, 44);
      A(rcm, 'RCM', 45, 55);
      A(lw, 'LW', 8, 65);
      A(st, 'ST', 33, 69);
      A(rw, 'RW', 60, 65);
      D(dRB, 'RB', 11, 73);
      D(dRCB, 'RCB', 27, 75);
      D(dLCB, 'LCB', 41, 75);
      D(dLB, 'LB', 57, 73);
      D(dRCM, 'RCM', 25, 62);
      D(dDM, 'DM', 35, 64);
      break;
    }
  }
  for (const b of bodies) b.home = { x: b.x, y: b.y };
  if (setPiece) {
    ball.x = setPiece.spot.x;
    ball.y = setPiece.spot.y;
  } else {
    ball.owner = carrier.id;
    ball.last = carrier.id;
    ball.x = carrier.x;
    ball.y = carrier.y + 0.5;
  }
  const a: Attack = {
    t: 0,
    used: 0,
    scenario,
    clock: opts.clock ?? CLOCK,
    stoppage: !!opts.stoppage,
    bodies,
    ball,
    ctrl: carrier.id,
    phase: 'pre',
    setPiece,
    end: null,
    rand,
    stamina: 1,
    sprinting: false,
    meter: null,
    lastShot: null,
    curl: 0,
    defIQ: clamp(opts.defIQ ?? 0, -0.5, 1),
    events: [],
    fouls: 0,
    strike: null,
    kick: null,
    path: null,
    pathAt: 0,
    chaser: null,
    offIds: [],
    gkPlan: null,
    first: null,
    taker: setPiece ? carrier.id : null,
    shotBy: null,
  };
  gk.home = keeperSpot(a, gk, 0);
  if (!setPiece || setPiece.kind === 'freekick') {
    gk.x = gk.home.x;
    gk.y = gk.home.y;
  }
  return a;
}

/** Kick off (the whistle). */
export function kickOff(a: Attack) {
  if (a.phase !== 'pre') return;
  a.phase = 'live';
  a.events.push('whistle');
}

/* ---------- ending ---------- */

function endAttack(a: Attack, kind: AttackEnd, text: string) {
  if (a.end) return;
  a.end = { kind, text, x: a.ball.x, y: a.ball.y, t: a.t };
  a.phase = 'dead';
  a.meter = null;
  a.sprinting = false;
  a.events.push('end:' + kind);
  if (kind === 'G') {
    const s = a.shotBy !== null ? a.bodies[a.shotBy] : null;
    if (s) act(s, 'celebrate', a.t);
  }
}

/* ---------- controls: the stick, sprint, pass, shoot ---------- */

/** Sprint at the cost of shared stamina (it comes back as you jog). */
export function setSprint(a: Attack, held: boolean): boolean {
  a.sprinting = held && !a.end && a.phase === 'live';
  return a.sprinting;
}

const facingOf = (b: Body): Pt => (Math.hypot(b.fx, b.fy) > 0.1 ? norm(b.fx, b.fy) : { x: 0, y: b.side === 'A' ? 1 : -1 });

/** Who a pass in direction `dir` (field vector; null: the way he faces) goes to. */
export function passTarget(a: Attack, dir: Pt | null, kind: PassKind = 'ground'): Body | null {
  const c = ownerOf(a) ?? (a.taker !== null ? a.bodies[a.taker] : null);
  if (!c) return null;
  const d = dir && Math.hypot(dir.x, dir.y) > 0.2 ? norm(dir.x, dir.y) : null;
  const f = d ?? facingOf(c);
  let best: Body | null = null;
  let bestS = -Infinity;
  for (const b of a.bodies) {
    if (b.side !== 'A' || b === c) continue;
    const v = { x: b.x - c.x, y: b.y - c.y };
    const len = Math.hypot(v.x, v.y);
    if (len < 2) continue;
    const cos = (v.x * f.x + v.y * f.y) / len;
    // a through ball looks for a man going forward; set pieces for the head in the box
    let s = cos * 1.6 - len / (kind === 'ground' ? 55 : 90);
    if (!d) s += (b.y - c.y) / 60;
    if (kind === 'through') s += (b.y - c.y) / 40;
    if (a.setPiece?.kind === 'corner') s += inBox(b) ? 0.5 + rt(b.p.a.PHY) * 0.4 : -0.5;
    if (d && cos < 0.3) s -= 2;
    if (s > bestS) {
      bestS = s;
      best = b;
    }
  }
  return best;
}

/** How long a pass of `kind` takes to cover `d` metres (the lead on a moving receiver). */
function passTime(kind: PassKind | 'cross', d: number, box = false): number {
  if (kind === 'lofted' || kind === 'cross') return box ? lerp(1.15, 1.85, d / 40) : lerp(0.95, 1.6, d / 40);
  const v0 = Math.min(26, groundSpeedFor(d, kind === 'through' ? 6 : 9));
  return (2 * d) / (v0 + (kind === 'through' ? 6 : 9));
}

/**
 * Where a pass to `to` should arrive: a through ball into the space ahead of him, the rest where his
 * run takes him by the time it gets there (solved twice: the lead changes the distance), a cross a
 * yard short of him so he attacks it.
 */
function passSpot(a: Attack, from: Pt, to: Body, kind: PassKind): Pt {
  const sp = a.setPiece;
  const lead = Math.hypot(to.vx, to.vy) > 1 ? { x: to.vx, y: to.vy } : { x: 0, y: 0 };
  const lofted = kind === 'lofted' || (sp?.kind === 'corner' && kind !== 'ground');
  if (kind === 'through') {
    const ahead = norm(GX - to.x, PL - to.y);
    const fwd = norm(ahead.x * 0.35, 1);
    return { x: clamp(to.x + fwd.x * 8 + lead.x * 0.4, 2, PW - 2), y: clamp(to.y + 8 + Math.max(0, lead.y) * 0.4, 0, PL - 3.5) };
  }
  const box = sp?.kind === 'corner' || inBox(to);
  let spot: Pt = { x: to.x, y: to.y };
  for (let i = 0; i < 2; i++) {
    const T = lofted ? lerp(0.95, 1.55, dist(from, to) / 40) * 0.8 : passTime(kind, dist(from, spot)) * 0.9;
    spot = { x: to.x + lead.x * T, y: to.y + lead.y * T };
  }
  if (lofted) {
    spot = { x: clamp(spot.x, 1, PW - 1), y: clamp(spot.y, 1, PL - 1.5) };
    // a cross aims at his head, a yard short of where he is, so he attacks it
    if (box) spot = { x: spot.x + (from.x < GX ? -0.6 : 0.6), y: spot.y - 0.8 };
  }
  return spot;
}

/** Free passing (Claude 2026-11-02): how wide (degrees) the gentle pull toward a teammate reaches. */
export const PASS_ASSIST = { ground: 22, lofted: 18, through: 30, centred: 32 };

export interface PassPlan {
  /** the teammate it's meant for (null: into space) */
  to: Body | null;
  /** where it's played to (before the passer's error) */
  spot: Pt;
  /** the stick's way (unit) */
  dir: Pt;
  /** how much the assist bent it toward him (0 none, 1 dead on) */
  w: number;
}

/**
 * A person's pass (free and directional: no lock-on). It goes the way the stick points; a teammate
 * whose run is within a narrow cone of that way pulls it gently toward him (fully when aimed right at
 * him, not at all at the cone's edge); nobody there and it goes into space along the stick, weighted
 * to be level with the nearest man that way, for whoever gets to it. Deterministic (the HUD draws it).
 */
export function passPlan(a: Attack, kind: PassKind, dir: Pt | null): PassPlan | null {
  const c = ownerOf(a) ?? (a.taker !== null ? a.bodies[a.taker] : null);
  if (!c) return null;
  const from = { x: a.ball.x, y: a.ball.y };
  const on = !!dir && Math.hypot(dir.x, dir.y) > 0.2;
  const d = on ? norm(dir!.x, dir!.y) : facingOf(c);
  const cone = ((on ? PASS_ASSIST[kind] : PASS_ASSIST.centred) * Math.PI) / 180;
  let best: { q: Body; spot: Pt; ang: number; s: number } | null = null;
  for (const q of a.bodies) {
    if (q.side !== 'A' || q === c) continue;
    const L = dist(c, q);
    if (L < 3 || L > 48) continue;
    if (kind === 'through' && q.y < c.y - 2) continue;
    const spot = passSpot(a, from, q, kind);
    const v = norm(spot.x - from.x, spot.y - from.y);
    // the nearer of his spot and where he stands now (aiming at the man counts as aiming at his run)
    const vNow = norm(q.x - from.x, q.y - from.y);
    const ang = Math.min(Math.acos(clamp(v.x * d.x + v.y * d.y, -1, 1)), Math.acos(clamp(vNow.x * d.x + vNow.y * d.y, -1, 1)));
    if (ang > cone) continue;
    const s = ang / cone + dist(from, spot) / 90;
    if (!best || s < best.s) best = { q, spot, ang, s };
  }
  if (best) {
    const w = 1 - (best.ang / cone) ** 2;
    const L = dist(from, best.spot);
    const to = norm(best.spot.x - from.x, best.spot.y - from.y);
    const bent = norm(d.x + (to.x - d.x) * w, d.y + (to.y - d.y) * w);
    return { to: best.q, spot: { x: from.x + bent.x * L, y: from.y + bent.y * L }, dir: d, w };
  }
  // into space: level with the nearest teammate that way, or a sensible length for the pass
  let L = kind === 'lofted' ? 24 : kind === 'through' ? 18 : 14;
  let near = Infinity;
  for (const q of a.bodies) {
    if (q.side !== 'A' || q === c) continue;
    const rx = q.x - from.x;
    const ry = q.y - from.y;
    const along = rx * d.x + ry * d.y;
    const off = Math.abs(rx * d.y - ry * d.x);
    if (along < 5 || off > along * 0.9) continue;
    if (off < near) {
      near = off;
      L = clamp(along + (kind === 'through' ? 5 : 1), 6, 34);
    }
  }
  const spot = { x: clamp(from.x + d.x * L, 0.5, PW - 0.5), y: clamp(from.y + d.y * L, 1, PL - 1) };
  return { to: null, spot, dir: d, w: 0 };
}

/** Start a pass. ground: along the grass to his feet; lofted: in the air (a cross from wide, or
 * from a corner); through: into the space ahead of a runner. `free` (a person's pass, Claude
 * 2026-11-02): it goes the stick's way with a gentle assist (passPlan) instead of to the teammate
 * nearest that way; the autopilot and a corner's "stick picks the man" keep the teammate pick. */
export function pass(a: Attack, kind: PassKind, dir: Pt | null, free = false): boolean {
  if (a.end || a.phase !== 'live' || a.strike || a.kick || a.meter) return false;
  const sp = a.setPiece;
  const c = ownerOf(a) ?? (sp && a.taker !== null ? a.bodies[a.taker] : null);
  if (!c || (sp && sp.kind === 'penalty')) return false;
  if (sp && dist(c, sp.spot) > 1.8) return false;
  const p = c.p;
  const from = { x: a.ball.x, y: a.ball.y };
  const corner = sp?.kind === 'corner';
  const plan = free && !corner ? passPlan(a, kind, dir) : null;
  const to = plan ? plan.to : passTarget(a, dir, kind);
  if (!plan && !to) return false;
  const lofted = kind === 'lofted' || (corner && kind !== 'ground');
  const spot = plan ? plan.spot : passSpot(a, from, to!, kind);
  if (kind === 'through' && to) to.run = { ...spot };
  let vx: number, vy: number, vh: number;
  // the passer's error: off line by PAS (worse on the run and under pressure)
  const pressed = nearestDefender(a, c).d < 2.2;
  const err = (passError(p) * (pressed ? 1.35 : 1) * (a.sprinting ? 1.15 : 1) * Math.PI) / 180;
  const ang = gauss(a.rand) * err;
  const d = dist(from, spot);
  const dirv = norm(spot.x - from.x, spot.y - from.y);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const rd = { x: dirv.x * ca - dirv.y * sa, y: dirv.x * sa + dirv.y * ca };
  const box = corner || (!!to && inBox(to));
  if (lofted) {
    const dd = d * (1 + gauss(a.rand) * err * 0.6);
    const tgt = { x: from.x + rd.x * dd, y: from.y + rd.y * dd };
    const v = loftVelocity(from, tgt, passTime('lofted', d, box));
    vx = v.vx;
    vy = v.vy;
    vh = v.vh;
  } else {
    // and the weight: a person's pass is over- or under-hit by PAS too (about 11% at PAS 40, 2.5% at 99)
    const dw = free ? d * (1 + gauss(a.rand) * passError(p) * 0.016 * (pressed ? 1.3 : 1)) : d;
    const v0 = Math.min(26, groundSpeedFor(Math.max(2, dw), kind === 'through' ? 6 : 9));
    vx = rd.x * v0;
    vy = rd.y * v0;
    vh = kind === 'through' && d > 22 ? 0.6 : 0;
  }
  const curl = lofted && corner ? (from.x < GX ? -1 : 1) * 0.12 : 0;
  a.kick = { at: a.t + 0.1, by: c.id, to: to ? to.id : null, kind: lofted ? (box ? 'cross' : 'lofted') : kind, vx, vy, vh, curl };
  act(c, 'kick', a.t);
  if (to) a.ctrl = to.id;
  a.passStick = free && dir && Math.hypot(dir.x, dir.y) > 0.2 ? { x: dir.x, y: dir.y } : free ? null : undefined;
  a.events.push('windup-pass');
  return true;
}

/** Press SHOOT: the power meter starts (on the ball, at a set piece, or for a first-time hit). */
export function pressShoot(a: Attack): boolean {
  if (a.end || a.phase !== 'live' || a.meter || a.strike || a.kick) return false;
  const c = ctrlOf(a);
  const sp = a.setPiece;
  const own = a.ball.owner === c.id;
  const taking = !!sp && a.taker === c.id && sp.kind !== 'corner';
  const incoming = !own && !sp && a.ball.flight && a.ball.flight.to === c.id;
  if (!own && !taking && !incoming) return false;
  let green = greenHalf(c.p);
  const near = nearestDefender(a, c).d;
  if (!sp && near < 2) green *= 0.75;
  // set-piece tuning (Claude 2026-11-01, docs/SOCCER.md): penalties about 75%, not 79%
  if (sp?.kind === 'penalty') green *= SP_TUNE.penGreen;
  if (sp?.kind === 'freekick') green *= SP_TUNE.fkGreen;
  if (Math.hypot(c.vx, c.vy) > topSpeed(c.p) * 0.9) green *= 0.88;
  green *= 1 - 0.12 * a.defIQ;
  a.meter = { t0: a.t, top: TOP, green: Math.max(0.012, green), first: !!incoming, assist: assistAim(a, c) };
  a.events.push('meter');
  return true;
}

/** Let go of SHOOT: the strike, timed against the green. `aim` is where in the goal (x -1 left post
 * to 1 right, y -1 low to 1 high: the drag on SHOOT, or the stick at a set piece), or null for aim
 * assist (the open side, low). `lag` (s) comes off a person's release (the screen shows the meter a
 * beat behind). */
export function releaseShoot(a: Attack, aim: Pt | null, lag = 0): boolean {
  const m = a.meter;
  if (!m || a.end) return false;
  const c = ctrlOf(a);
  const held = Math.max(0, a.t - lag - m.t0);
  const off = held - m.top;
  const greened = Math.abs(off) <= m.green;
  const power = clamp(held / m.top, 0.3, 1.35);
  a.meter = null;
  a.release = { at: a.t, off, green: m.green, top: m.top };
  if (!aim && m.aim) aim = m.aim;
  const want = aim ?? m.assist ?? null;
  if (m.first && a.ball.owner !== c.id) {
    a.first = { off, greened, power, aim, green: m.green };
    a.events.push(greened ? 'release-green' : 'release');
    return true;
  }
  strikeShot(a, c, off, greened, power, want, m.green, false, !aim);
  a.events.push(greened ? 'release-green' : 'release');
  return true;
}

/** The aim while SHOOT is held (the drag on SHOOT, already snapped; null: aim assist). A first-time
 * hit still held when the ball arrives goes where this points. */
export function setAim(a: Attack, aim: Pt | null) {
  if (a.meter) a.meter.aim = aim ? { x: clamp(aim.x, -1, 1), y: clamp(aim.y, -1, 1) } : null;
}

export function cancelShoot(a: Attack) {
  a.meter = null;
}

/** Sideways bend for the next set-piece kick (a swipe across the screen). */
export function setCurl(a: Attack, k: number) {
  a.curl = clamp(k, -1, 1);
}

/* ---------- aiming (Claude 2026-11-02, docs/SOCCER-ENGINE.md "Aim and shoot") ---------- */

/** Half the goal's width the aim spans: full aim is 0.56 m inside the post. */
export const AIM_X = 3.1;
/** Aim assist's height (aim space: low); how far across it goes depends on the range and his SHO. */
export const ASSIST = { y: -0.75 };

/**
 * Aim assist (no drag): the side of the goal the keeper leaves open, with a little preference for
 * the far post, low, and as far inside the post as his accuracy needs. Returned in aim space.
 */
export function assistAim(a: Attack, shooter: Body, was?: Pt): Pt {
  // how fine it can cut it: two of his error cones (at a good release) inside the post, so a
  // finisher's assist goes nearer the corner than a defender's
  const d = Math.hypot(GX - shooter.x, PL - shooter.y);
  const margin = clamp(2 * d * Math.tan((shotCone(shooter.p) * 0.6 * rangeCone(d) * Math.PI) / 180), 0.7, 1.6);
  const ax = clamp((GHALF - margin) / AIM_X, 0.45, 0.95);
  const o = openSide(a, shooter);
  let side = o.side;
  // hold the side it picked unless the other opens up clearly (the reticle doesn't flicker)
  if (was && Math.sign(was.x) !== side && o.edge < 0.06) side = Math.sign(was.x) || side;
  return { x: side * ax, y: ASSIST.y };
}

/**
 * The side of the goal the keeper leaves open as the shooter sees it: the bigger angle between the
 * keeper and a post (a keeper off his line covers more than his place across the goal suggests),
 * with a slight lean to the far post. `edge`: how much bigger, in radians.
 */
export function openSide(a: Attack, shooter: Pt): { side: number; edge: number } {
  const gk = keeperOf(a);
  const ang = (x: number, y: number) => Math.atan2(x - shooter.x, Math.max(0.3, y - shooter.y));
  const k = ang(gk.x, gk.y);
  const right = ang(GX + GHALF, PL) - k + (shooter.x < GX ? 0.03 : 0);
  const left = k - ang(GX - GHALF, PL) + (shooter.x >= GX ? 0.03 : 0);
  return { side: right >= left ? 1 : -1, edge: Math.abs(right - left) };
}

/** A gentle pull toward the corners (low/high, inside each post): an area-cursor style magnet, so
 * a rough drag lands on a sensible spot. Deterministic; the HUD shows the snapped aim. */
export function snapAim(v: Pt): Pt {
  const pull = (x: number, marks: number[]) => {
    let best = marks[0];
    for (const m of marks) if (Math.abs(m - x) < Math.abs(best - x)) best = m;
    const d = Math.abs(best - x);
    return d < 0.45 ? x + (best - x) * 0.55 * (1 - d / 0.45) : x;
  };
  const x = clamp(v.x, -1, 1);
  const y = clamp(v.y, -1, 1);
  return { x: pull(x, [-0.85, 0.85]), y: pull(y, [-0.75, 0.75]) };
}

/** Where in the goal an aim points (x across, h up). null: the assist. */
export function aimPoint(a: Attack, shooter: Body, aim: Pt | null): { x: number; h: number } {
  const v = aim ?? a.meter?.assist ?? assistAim(a, shooter);
  return { x: GX + clamp(v.x, -1, 1) * AIM_X, h: 0.3 + clamp((v.y + 1) / 2, 0, 1) * 1.75 };
}

/** Range makes a shot harder to place: the cone grows from 12 m (x2 at 20 m, at most x2.25 from 22 m). */
export function rangeCone(d: number): number {
  return 1 + clamp((d - 12) / 8, 0, 1.25);
}

/** A release's distance from the green's centre in green half-widths (0 dead centre, 1 the slice's edge). */
export function timingMiss(off: number, green: number): number {
  return Math.abs(off) / Math.max(0.015, green);
}
/**
 * The error cone's multiplier for a release: tightest dead in the middle of the green and growing
 * smoothly the further off it you let go (no step at the slice's edge): 0.5 at the centre, 0.85 at
 * the slice's edge, 1.3 at twice that, 1.75 at three times, capped at 3.2.
 */
export function coneMult(off: number, green: number): number {
  return Math.min(3.2, 0.5 + 0.35 * Math.pow(timingMiss(off, green), 1.15));
}
/** The read-out word for a release. */
export function timingWord(off: number, green: number): 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE' {
  const u = timingMiss(off, green);
  return u <= 1 ? 'PERFECT' : u <= 2.2 ? 'GOOD' : off < 0 ? 'EARLY' : 'LATE';
}

/** Why a shot didn't go in, in a few words for the HUD (null: nothing worth saying). */
export function shotVerdict(a: Attack): string | null {
  const s = a.lastShot;
  const e = a.end;
  if (!s || !e || e.kind === 'G') return null;
  const w = timingWord(s.off, s.green ?? 0.05);
  const at = s.cross ?? s.aim;
  if (e.kind === 'W') {
    if (w === 'LATE') return at.h > GH ? 'LATE RELEASE · IT ROSE OVER' : 'LATE RELEASE · DRAGGED WIDE';
    if (w === 'EARLY') return 'EARLY RELEASE · SCUFFED WIDE';
    if (!s.assisted && Math.abs(s.aim.x - GX) > GHALF - 0.75) return 'TOO FINE · AIM INSIDE THE POST';
    return at.h > GH ? 'JUST OVER' : 'JUST WIDE';
  }
  if (e.kind === 'S') {
    if (s.gkX !== undefined && Math.abs(s.aim.x - s.gkX) < 1.3 && s.kind !== 'pen') return 'STRAIGHT AT HIM · AIM FOR THE GAP';
    if (w === 'EARLY') return 'EARLY RELEASE · NOT ENOUGH ON IT';
    if (s.kind === 'pen') return null;
    return 'GOOD SAVE';
  }
  if (e.kind === 'B' && s.kind !== 'fk') return 'BLOCKED · GET A YARD OF SPACE';
  return null;
}

function strikeShot(a: Attack, c: Body, off: number, greened: boolean, power: number, aim: Pt | null, green: number, header = false, assisted = false) {
  const sp = a.setPiece;
  const kind: ShotInfo['kind'] = header ? 'header' : sp?.kind === 'penalty' ? 'pen' : sp?.kind === 'freekick' ? 'fk' : a.ball.h > 0.4 ? 'volley' : 'shot';
  let tgt = aimPoint(a, c, aim);
  // a header without an aim goes where his head sends it: one side or the other, any height
  if (header && (!aim || Math.hypot(aim.x, aim.y) < 0.15)) tgt = { x: GX + (a.rand() < 0.5 ? -1 : 1) * (1 + a.rand() * 1.9), h: 0.3 + a.rand() * 1.4 };
  let th = tgt.h;
  // the further from the green's centre, the worse the contact (continuous, Claude 2026-11-02): late
  // gets under it and it rises; early is weak and low
  const slack = 0.3 * green;
  const late = Math.max(0, off - slack);
  const early = Math.max(0, -off - slack);
  th += late * 8;
  if (early > 0) th = Math.max(0.15, th - early * 2);
  const base = header ? headerSpeed(c.p) : shotSpeed(c.p);
  const pf = power < 1 ? lerp(0.62, 1, (power - 0.3) / 0.7) : Math.min(1.08, 1 + (power - 1) * 0.3);
  const speed = base * pf * (kind === 'volley' ? 0.92 : 1) * (kind === 'pen' ? 0.95 : 1) * (kind === 'fk' ? 0.92 : 1);
  const pressed = !sp && nearestDefender(a, c).d < 1.6;
  let cone = shotCone(c.p) * coneMult(off, green);
  if (pressed) cone *= 1.3;
  if (kind === 'header') cone *= 2.4;
  if (kind === 'volley') cone *= 1.3;
  if (kind === 'pen') cone *= SP_TUNE.penCone;
  if (kind === 'fk') cone *= SP_TUNE.fkCone;
  // a header from a corner: under a crowd of bodies, a worse contact than an open-play cross
  if (kind === 'header' && a.scenario === 'corner') cone *= SP_TUNE.cornerHeaderCone;
  const from = { x: a.ball.x, y: a.ball.y, h: Math.max(0.11, a.ball.h) };
  // across his body: a shot well away from the way he's running is harder to keep true; and from
  // range it's harder to place (Claude 2026-11-02)
  if (kind === 'shot' || kind === 'volley') {
    cone *= rangeCone(dist(from, goalC));
    const f = facingOf(c);
    const to = norm(tgt.x - from.x, PL - from.y);
    const ang = (Math.acos(clamp(f.x * to.x + f.y * to.y, -1, 1)) * 180) / Math.PI;
    cone *= 1 + clamp((ang - 55) / 90, 0, 1) * 0.5;
  }
  // a free kick is struck with topspin: it gets up over the wall and comes down again
  const dip = kind === 'fk' ? 5 : 0;
  const v = shotVelocity(from, tgt.x, th, speed, dip);
  const eh = (gauss(a.rand) * cone * Math.PI) / 180;
  const ev = (gauss(a.rand) * cone * 0.6 * Math.PI) / 180;
  const ch = Math.cos(eh);
  const shh = Math.sin(eh);
  const vx = v.vx * ch - v.vy * shh;
  const vy = v.vx * shh + v.vy * ch;
  const vh = v.vh + ev * speed;
  // open play: a touch of finesse bend back toward the far post; a free kick: the swipe's curl
  const curl = kind === 'fk' ? a.curl * 0.3 : kind === 'shot' && greened ? -Math.sign(tgt.x - from.x) * 0.04 : 0;
  const info: ShotInfo = { by: c.id, greened, off, power, speed, aim: { x: tgt.x, h: tgt.h }, cross: null, cone, kind, green, assisted, gkX: keeperOf(a).x };
  a.strike = { at: a.t + (header ? 0.04 : 0.11), by: c.id, vx, vy, vh, curl, dip, info };
  act(c, header ? 'header' : 'kick', a.t);
  a.shotBy = c.id;
}

/* ---------- the keeper ---------- */

/**
 * Set-piece tuning (Claude 2026-11-01): the autopilot scored about a third of corners and free kicks
 * and 79% of penalties. Targets (docs/SOCCER.md): corners 8-12%, direct free kicks 10-15%, penalties
 * about 75%. Measured by src/game/soccer2/setpieces.test.ts.
 */
export const SP_TUNE = {
  penGreen: 1.06,
  penCone: 0.95,
  penRead: 0.07,
  fkGreen: 0.7,
  fkCone: 3.0,
  fkReact: 0.55,
  fkRead: 0.4,
  cornerHeaderCone: 3.8,
  cornerDuel: 0.8,
  /** how close a marker has to be to go up with the header (open-play crosses 1.5 m) */
  cornerMark: 3.2,
  cornerClaimDepth: 9.5,
};

/**
 * Keeper tuning for the aim-assist update (Claude 2026-11-02): with shots no longer going at him by
 * default, he narrows tight angles and gets across on a long shot he has time for.
 */
export const KEEP = { tightDepth: 1.3, shuffle: 3.2, tightX: 9, chargeAt: 6, narrow: 0.3, setSlow: 0.8, rushFrom: 18, spreadIn: 8, spread: [1.0, 1.12] as [number, number] };

/** Where the keeper stands: on the bisector of the angle the posts make from the ball, off his line by how far away it is. */
export function keeperSpot(a: Attack, _gk: Body, err: number): Pt {
  const b = a.ball.owner !== null ? a.bodies[a.ball.owner] : a.ball;
  const bx = clamp(b.x, 0, PW);
  const by = Math.min(b.y, PL - 0.5);
  const u1 = norm(GX - GHALF - bx, PL - by);
  const u2 = norm(GX + GHALF - bx, PL - by);
  const bis = norm(u1.x + u2.x, u1.y + u2.y);
  const far = dist({ x: bx, y: by }, goalC);
  // off his line with the range, and further at a tight angle close in (he narrows it: Claude 2026-11-02)
  const tight = clamp((Math.atan2(Math.abs(bx - GX), Math.max(0.5, PL - by)) - 0.55) / 0.6, 0, 1) * clamp((24 - far) / 10, 0, 1);
  const depth = a.setPiece ? 0.7 : clamp(far * 0.065, 0.5, 3.6) + tight * KEEP.tightDepth;
  const yk = PL - depth;
  const s = bis.y > 0.05 ? (yk - by) / bis.y : 0;
  let x = clamp(bx + bis.x * s, GX - GHALF - 0.6, GX + GHALF + 0.6);
  // a free kick: the wall has the near post, he shades toward the far one
  if (a.setPiece?.kind === 'freekick') x = GX + Math.sign(GX - a.setPiece.spot.x) * 0.35;
  return { x: clamp(x + err, GX - GHALF - 1, GX + GHALF + 1), y: Math.max(by + 1, yk) > PL ? PL - 0.3 : yk };
}

/** The keeper reads a strike: when he moves, where he goes. A penalty: he guesses at the kick. */
function planKeeper(a: Attack) {
  const gk = keeperOf(a);
  const path = a.path ?? [];
  // where the shot passes him: the nearest point of its path (his line for a shot up the pitch)
  let at: PathPt | null = null;
  let best = Infinity;
  for (const q of path) {
    const d = Math.hypot(q.x - gk.x, q.y - gk.y);
    if (d < best) {
      best = d;
      at = q;
    }
    if (q.y > PL + 0.5) break;
  }
  const cross = at ?? path[path.length - 1] ?? { t: 1, x: GX, y: PL, h: 1, v: 20 };
  if (a.setPiece?.kind === 'penalty' || a.lastShot?.kind === 'pen') {
    const real = Math.abs(cross.x - GX) < 0.9 ? 0 : Math.sign(cross.x - GX);
    const right = a.rand() < gkPenaltyRead(gk.p) + SP_TUNE.penRead;
    const others = [-1, 0, 1].filter((g) => g !== real);
    const guess = a.guess ?? (right ? real : others[Math.floor(a.rand() * others.length)]);
    a.gkPlan = { react: a.t + 0.1, x0: gk.x, tx: GX + guess * 2.1, th: 0.4 + a.rand() * 1.2, at: cross.t + a.t };
    return;
  }
  const mis = gkMisread(gk.p) * (1 + 0.6 * Math.max(0, (cross.v - 22) / 10)) * (a.lastShot?.kind === 'fk' ? SP_TUNE.fkRead : 1);
  // he goes for the point where it passes him, misread across its line (Claude 2026-11-02: across
  // the pitch as well as along his line, for a shot from near the byline)
  const s0 = path[0] ?? cross;
  const across = norm(-(cross.y - s0.y), cross.x - s0.x);
  const e = gauss(a.rand) * mis;
  a.gkPlan = {
    // a direct free kick: the keeper is set and sees it struck (he reacts a little sooner)
    react: a.t + gkReaction(gk.p) * (1 - 0.15 * a.defIQ) * (a.lastShot?.kind === 'fk' ? SP_TUNE.fkReact : 1) + a.rand() * 0.04,
    x0: gk.x,
    y0: gk.y,
    tx: cross.x + across.x * e,
    ty: Math.min(PL - 0.2, cross.y + across.y * e),
    th: clamp(cross.h + gauss(a.rand) * mis * 0.6, 0.1, 2.5),
    at: a.t + cross.t,
  };
}

/** The keeper during a shot: set, then the dive (as far and as fast as DIV takes him). */
function keeperInFlight(a: Attack, gk: Body) {
  const plan = a.gkPlan;
  if (!plan) return;
  gk.vx = 0;
  gk.vy = 0;
  if (a.t < plan.react) return;
  const dv = gkDive(gk.p);
  const y0 = plan.y0 ?? gk.y;
  const wx = plan.tx - plan.x0;
  const wy = (plan.ty ?? y0) - y0;
  const want = Math.hypot(wx, wy);
  const tau = a.t - plan.react;
  // the dive, and a quick shuffle across first if there's time for it
  const reach = dv.reach * Math.pow(Math.min(1, tau / dv.time), 0.8) + Math.max(0, tau - dv.time) * KEEP.shuffle;
  const move = want > 0.25 ? Math.min(want - (want > 0.9 ? 0.55 : 0), reach) / want : 0;
  const nx = plan.x0 + wx * move;
  const ny = y0 + wy * move;
  gk.vx = (nx - gk.x) * 60;
  gk.vy = (ny - gk.y) * 60;
  gk.x = nx;
  gk.y = ny;
  if (want > 0.9) {
    act(gk, 'dive', plan.react);
    gk.h = Math.min(plan.th, 1.6) * 0.5 * Math.sin(Math.min(1, tau / dv.time) * Math.PI);
  } else if (plan.th > 1.9) {
    act(gk, 'catch', plan.react);
    gk.h = Math.min(0.5, tau * 1.5);
  } else act(gk, 'set', plan.react);
}

/** The ball reaches the keeper's line during a shot: does he get to it? */
function keeperSave(a: Attack, gk: Body, prev: Pt & { h: number }) {
  const b = a.ball;
  // where the ball passes him: the nearest point of this step's travel (Claude 2026-11-02: it used to
  // be where it crossed his y, wrong for a shot from near the byline that runs across him)
  const ux = b.x - prev.x;
  const uy = b.y - prev.y;
  const k = clamp(((gk.x - prev.x) * ux + (gk.y - prev.y) * uy) / Math.max(1e-9, ux * ux + uy * uy), 0, 1);
  const bx = prev.x + ux * k;
  const by = prev.y + uy * k;
  const bh = prev.h + (b.h - prev.h) * k;
  if (Math.abs(bx - GX) > GHALF + 1.6 || bh > GH + 0.6) return false;
  const plan = a.gkPlan;
  const diving = gk.act === 'dive';
  const arm = gkArm(gk.p);
  // close in (struck within 9 m of him) he spreads himself, big, rather than diving (Claude
  // 2026-11-02): a one-on-one he's come out for isn't an open goal either side of him
  const o = a.path?.[0];
  const spread = !diving && !!o && Math.hypot(o.x - gk.x, o.y - gk.y) < KEEP.spreadIn && a.lastShot?.kind !== 'pen';
  const ax = diving ? arm + 0.15 : spread ? lerp(KEEP.spread[0], KEEP.spread[1], rt(gk.p.a.DIV)) : 0.9;
  const cy = diving ? clamp(plan?.th ?? 0.8, 0.35, 1.7) : spread ? 0.75 : 1.2;
  const ay = diving ? 0.9 : spread ? 1.1 : 1.4;
  // he had no time to move at all: only what comes at him
  const dx = (Math.sign(bx - gk.x) || 1) * Math.hypot(bx - gk.x, by - gk.y);
  const q = Math.sqrt((dx / ax) ** 2 + ((bh - cy) / ay) ** 2);
  if (q > 1) return false;
  const margin = 1 - q;
  const speed = Math.hypot(b.vx, b.vy, b.vh);
  if (margin < 0.12 && a.rand() > 0.45 + margin * 4) return false;
  const stretch = Math.min(1, Math.abs(dx) / (ax + 0.01));
  const held = margin >= 0.12 && a.rand() < gkCatch(gk.p, speed, stretch, bh > 1.8);
  b.curl = 0;
  if (a.lastShot) a.lastShot.cross = null;
  if (held) {
    b.owner = gk.id;
    b.last = gk.id;
    b.vx = b.vy = b.vh = 0;
    b.flight = null;
    b.x = gk.x;
    b.y = gk.y;
    b.h = Math.max(0.6, bh);
    a.path = null;
    a.events.push('save-catch');
    endAttack(a, 'S', 'SAVED · HELD BY ' + gk.p.tag);
    return true;
  }
  // a penalty saved is over (no rebounds in a shootout, none in the match either)
  if (a.lastShot?.kind === 'pen') {
    b.vx = -b.vx * 0.2 + (a.rand() - 0.5) * 6;
    b.vy = -Math.abs(b.vy) * 0.25;
    b.vh = 1.5;
    b.last = gk.id;
    b.flight = { kind: 'parry', from: gk.id, to: null, at: a.t };
    a.events.push('save-parry');
    endAttack(a, 'S', 'SAVED BY ' + gk.p.tag);
    return true;
  }
  // parried: back out into play, or round the post
  const side = Math.sign(dx) || (a.rand() < 0.5 ? -1 : 1);
  const out = a.rand() < 0.45;
  const sp = speed * lerp(0.25, 0.45, a.rand());
  const dir = out ? norm(side * 0.9, 0.45) : norm(side * (0.3 + a.rand() * 0.8), -1);
  b.x = bx;
  b.y = gk.y - 0.2;
  b.h = bh;
  b.vx = dir.x * sp;
  b.vy = dir.y * sp;
  b.vh = 1 + a.rand() * 3;
  b.last = gk.id;
  b.flight = { kind: 'parry', from: gk.id, to: null, at: a.t };
  setPath(a, tracePath(b));
  a.offIds = [];
  a.events.push('save-parry');
  return true;
}

/* ---------- helpers for the brains ---------- */

export function nearestDefender(a: Attack, q: Pt, gk = false): { b: Body | null; d: number } {
  let best: Body | null = null;
  let d = Infinity;
  for (const b of a.bodies) {
    if (b.side !== 'D' || (!gk && b.role === 'gk')) continue;
    const e = dist(b, q);
    if (e < d) {
      d = e;
      best = b;
    }
  }
  return { b: best, d };
}

function setPath(a: Attack, path: PathPt[]) {
  a.path = path;
  a.pathAt = a.t;
}

/** The first point still ahead on the ball's path he can reach in time (and play: under his reach).
 * Its t is seconds from now. */
export function meetPoint(a: Attack, b: Body, maxH = 1.7): PathPt | null {
  const path = a.path;
  if (!path) return null;
  const sp = topSpeed(b.p) * 0.95;
  const now = a.t - a.pathAt;
  let last: PathPt | null = null;
  for (const q of path) {
    if (q.t < now + 0.03) continue;
    last = q;
    if (q.h > maxH) continue;
    const need = Math.max(0, dist(b, q) - 0.6) / sp;
    if (need <= q.t - now) return { ...q, t: q.t - now };
  }
  return last && last.h <= maxH ? { ...last, t: Math.max(0, last.t - now) } : null;
}

function steer(b: Body, tx: number, ty: number, speed: number, dt: number, arrive = true) {
  const dx = tx - b.x;
  const dy = ty - b.y;
  const d = Math.hypot(dx, dy);
  const v = arrive ? Math.min(speed, d * 3) : speed;
  const want = d < 0.05 ? { x: 0, y: 0 } : { x: (dx / d) * v, y: (dy / d) * v };
  accelTo(b, want.x, want.y, dt);
}

function accelTo(b: Body, wx: number, wy: number, dt: number, scale = 1) {
  const acc = accelOf(b.p) * scale;
  const dvx = wx - b.vx;
  const dvy = wy - b.vy;
  const dl = Math.hypot(dvx, dvy);
  const braking = Math.hypot(wx, wy) < 0.3;
  const k = Math.min(1, ((braking ? acc * 1.6 : acc) * dt) / Math.max(1e-6, dl));
  b.vx += dvx * k;
  b.vy += dvy * k;
}

/* ---------- the step ---------- */

/**
 * Advance the attack by dt. `stick` is the controlled attacker's run (a field vector, length ≤ 1;
 * {0,0} stands still). null lets the brain move him (the autopilot, or an assisted run onto a pass).
 */
export function step(a: Attack, dt: number, stick: Pt | null) {
  if (a.phase !== 'live' || a.end) return;
  a.t += dt;
  const t = a.t;
  const ball = a.ball;
  if (!a.setPiece && !a.strike && !(ball.flight && ['shot', 'parry'].includes(ball.flight.kind))) a.used += dt;

  // the kick or strike lands on the ball
  if (a.kick && t >= a.kick.at) launchPass(a);
  if (a.strike && t >= a.strike.at) launchShot(a);

  // stamina: sprinting drains it, jogging brings it back
  const c = ctrlOf(a);
  const moving = stick ? Math.hypot(stick.x, stick.y) > 0.15 : Math.hypot(c.vx, c.vy) > 2;
  const sprint = a.sprinting && a.stamina > 0.05 && moving;
  a.stamina = clamp(a.stamina + (sprint ? -0.2 : 0.09) * dt, 0, 1);

  // the meter held too long: it goes anyway (and goes over)
  if (a.meter && t - a.meter.t0 > METER * 1.3) releaseShoot(a, null);
  // aim assist follows the keeper while SHOOT is held (it keeps its side unless the other opens up)
  if (a.meter) a.meter.assist = assistAim(a, ctrlOf(a), a.meter.assist);

  const owner = ownerOf(a);
  for (const b of a.bodies) {
    if (t < b.stunUntil) {
      b.vx *= Math.pow(0.04, dt);
      b.vy *= Math.pow(0.04, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      continue;
    }
    if (b.act === 'tackle' || b.act === 'down' || b.act === 'dive') act(b, 'idle', t);
    if (b.role === 'gk') keeper(a, b, dt);
    else if (b.side === 'D') defend(a, b, dt);
    else if (b.id === a.ctrl && stick && !receiving(a, b, stick)) human(a, b, stick, sprint, dt);
    else attackOffBall(a, b, dt, b.id === a.ctrl ? sprint : false);
    // nobody leaves the pitch by much (the touchline, the goal line)
    b.x = clamp(b.x + b.vx * dt, -1.5, PW + 1.5);
    b.y = clamp(b.y + b.vy * dt, 30, PL + 1.2);
    const v = Math.hypot(b.vx, b.vy);
    if (v > 0.4) {
      b.fx = b.vx / v;
      b.fy = b.vy / v;
    }
    if (b.act === 'idle' || b.act === 'run' || b.act === 'dribble') act(b, ball.owner === b.id ? 'dribble' : v > 1.2 ? 'run' : 'idle', t);
  }
  separate(a);

  // the ball at his feet, or free
  const prev = { x: ball.x, y: ball.y, h: ball.h };
  if (owner && ball.owner === owner.id) {
    const f = facingOf(owner);
    const v = Math.hypot(owner.vx, owner.vy);
    const touch = 0.32 + Math.min(0.35, v * 0.035) * (a.sprinting && owner.id === a.ctrl ? 1.4 : 1);
    ball.x = owner.x + f.x * touch;
    ball.y = owner.y + f.y * touch;
    ball.h = owner.role === 'gk' ? 0.9 : 0;
    ball.vx = owner.vx;
    ball.vy = owner.vy;
    ball.vh = 0;
    if (owner.side === 'A') tackles(a, owner);
  } else if (ball.owner === null) {
    stepBall(ball, dt);
    duringFlight(a, prev);
    // keep the predicted path fresh (a ball still running past its end, a bounce off a body)
    if (!a.end && ball.owner === null && a.t - a.pathAt > 0.5 && ball.flight?.kind !== 'shot') setPath(a, tracePath(ball));
  }
  if (a.end) return;
  if (ball.owner === null && !a.strike && !a.kick) contact(a);
  if (a.end) return;
  if (ball.x < -0.2 || ball.x > PW + 0.2) {
    endAttack(a, 'L', 'OUT OF PLAY');
    return;
  }
  // the clock (a shot in the air finishes first)
  const flying = a.strike || (ball.flight && (ball.flight.kind === 'shot' || ball.flight.kind === 'parry') && Math.hypot(ball.vx, ball.vy) > 2);
  if (a.used >= a.clock && !flying && !a.kick && !(a.meter && t - a.meter.t0 < 0.7)) endAttack(a, 'T', 'TIME UP');
  // a hard stop: nothing (an idle set piece, a ball stuck between bodies) runs an attack forever
  else if (t > a.clock * 3 + 30) endAttack(a, 'T', 'TIME UP');
}

/**
 * The pass is coming to the man the stick is on: he runs onto it himself (the meet point) while the
 * stick is centred or still held the way the pass went; moving the stick off that way takes him over
 * (Claude 2026-11-02: before, a thumb still on the stick after the pass ran the receiver off the ball).
 */
function receiving(a: Attack, b: Body, stick: Pt): boolean {
  const f = a.ball.flight;
  if (a.ball.owner === b.id || !f || f.to !== b.id || f.kind === 'shot' || f.kind === 'clear' || f.kind === 'parry') return false;
  if (Math.hypot(stick.x, stick.y) < 0.12) return true;
  const ps = a.passStick;
  if (!ps) return false;
  if (Math.hypot(stick.x - ps.x, stick.y - ps.y) < 0.6) return true;
  a.passStick = null;
  return false;
}

function launchPass(a: Attack) {
  const k = a.kick!;
  a.kick = null;
  const b = a.ball;
  const by = a.bodies[k.by];
  b.owner = null;
  b.last = by.id;
  b.vx = k.vx;
  b.vy = k.vy;
  b.vh = k.vh;
  b.curl = k.curl;
  b.flight = { kind: k.kind, from: by.id, to: k.to, at: a.t };
  // offside is judged now: who's past the second-last defender and the ball, in their half
  const line = offsideLine(a);
  a.offIds = a.bodies.filter((q) => q.side === 'A' && q.id !== by.id && q.y > line + 0.15 && q.y > b.y && q.y > PL / 2).map((q) => q.id);
  setPath(a, tracePath(b, 4));
  if (a.setPiece) {
    a.setPiece = null;
    a.taker = null;
    for (const q of a.bodies) if (q.act === 'wall') act(q, 'idle', a.t);
  }
  for (const q of a.bodies) q.tried = -1;
  const maxH = k.kind === 'ground' || k.kind === 'through' ? 0.9 : 2.4;
  // a pass into space: it's for whichever teammate gets to it first (he runs onto it)
  if (k.to === null) {
    let bt = Infinity;
    for (const q of a.bodies) {
      if (q.side !== 'A' || q.id === by.id) continue;
      const m = meetPoint(a, q, maxH);
      if (m && m.t < bt) {
        bt = m.t;
        k.to = q.id;
      }
    }
    if (k.to !== null) {
      b.flight.to = k.to;
      a.ctrl = k.to;
    }
  }
  // the defender (if any) who can get to the pass before the man it's for
  const recv = k.to !== null ? a.bodies[k.to] : null;
  const theirs = recv ? (meetPoint(a, recv, maxH)?.t ?? 9) : 9;
  a.chaser = null;
  let bestT = theirs - 0.1;
  for (const q of a.bodies) {
    if (q.side !== 'D' || q.role === 'gk') continue;
    const m = meetPoint(a, q, maxH);
    if (m && m.t + 0.25 < bestT) {
      bestT = m.t + 0.25;
      a.chaser = q.id;
    }
  }
  a.events.push(k.kind === 'cross' || k.kind === 'lofted' ? 'cross' : 'pass');
}

function launchShot(a: Attack) {
  const s = a.strike!;
  a.strike = null;
  const b = a.ball;
  b.owner = null;
  b.last = s.by;
  b.vx = s.vx;
  b.vy = s.vy;
  b.vh = s.vh;
  b.curl = s.curl;
  b.dip = s.dip;
  b.h = Math.max(0.11, b.h);
  b.flight = { kind: 'shot', from: s.by, to: null, at: a.t };
  a.lastShot = s.info;
  setPath(a, tracePath(b, 3));
  a.offIds = [];
  a.first = null;
  const wasPen = a.setPiece?.kind === 'penalty';
  if (a.setPiece) {
    a.setPiece = null;
    a.taker = null;
  }
  for (const q of a.bodies) {
    q.tried = -1;
    // the wall jumps
    if (q.act === 'wall') {
      q.vh = 2.6;
      q.h = 0.01;
    }
  }
  planKeeper(a);
  if (wasPen && a.gkPlan) a.gkPlan.react = a.t + 0.1;
  a.events.push(s.info.kind === 'header' ? 'header' : 'shot');
}

/** A ball in flight: blocks and interceptions, the keeper, the goal line and the woodwork. */
function duringFlight(a: Attack, prev: Pt & { h: number }) {
  const b = a.ball;
  const f = b.flight;
  // the wall's jump
  for (const q of a.bodies)
    if (q.act === 'wall' && (q.h > 0 || q.vh > 0)) {
      q.h = Math.max(0, q.h + q.vh / 60);
      q.vh -= G / 60;
      if (q.h <= 0) q.vh = 0;
    }
  if (f?.kind === 'shot' || f?.kind === 'parry') {
    // a body in the way: crossing his line within his reach
    for (const q of a.bodies) {
      if (q.side !== 'D' || q.role === 'gk' || q.tried === 1) continue;
      const crossed = (prev.y - q.y) * (b.y - q.y) <= 0;
      if (!crossed || f.kind !== 'shot') continue;
      const k = (q.y - prev.y) / Math.max(1e-6, b.y - prev.y);
      const bx = prev.x + (b.x - prev.x) * k;
      const bh = prev.h + (b.h - prev.h) * k;
      const wall = q.act === 'wall';
      const reachH = wall ? q.p.ht / 100 + q.h : q.p.ht / 100 - 0.05;
      if (Math.abs(bx - q.x) < (wall ? 0.42 : 0.45) && bh < reachH) {
        q.tried = 1;
        if (a.rand() < blockChance(q.p, wall)) {
          b.vx = (a.rand() - 0.5) * 8;
          b.vy = -Math.abs(b.vy) * 0.3;
          b.vh = 2 + a.rand() * 3;
          b.last = q.id;
          b.flight = { kind: 'clear', from: q.id, to: null, at: a.t };
          a.events.push('block');
          endAttack(a, 'B', 'BLOCKED BY ' + q.p.tag);
          return;
        }
      }
    }
    const gk = keeperOf(a);
    if (f.kind === 'shot') {
      keeperInFlight(a, gk);
      // the ball passes him (its travel this step goes by his position along its line)
      const ux = b.x - prev.x;
      const uy = b.y - prev.y;
      const passes = (gk.x - prev.x) * ux + (gk.y - prev.y) * uy >= 0 && (gk.x - b.x) * ux + (gk.y - b.y) * uy <= 0;
      if (passes && gk.tried !== 1) {
        gk.tried = 1;
        if (keeperSave(a, gk, prev)) return;
      }
    }
  }
  // the goal line
  if (prev.y < PL && b.y >= PL) {
    const k = (PL - prev.y) / Math.max(1e-6, b.y - prev.y);
    const x = prev.x + (b.x - prev.x) * k;
    const h = prev.h + (b.h - prev.h) * k;
    if (a.lastShot && f?.kind === 'shot') a.lastShot.cross = { x, h };
    const inside = Math.abs(x - GX) < GHALF - BALL_R && h < GH - BALL_R;
    const post = Math.abs(Math.abs(x - GX) - GHALF) < BALL_R + 0.06 && h < GH + 0.06;
    const bar = Math.abs(h - GH) < BALL_R + 0.06 && Math.abs(x - GX) < GHALF + 0.06;
    if (inside) {
      a.events.push('goal');
      b.flight = { kind: f?.kind ?? 'shot', from: f?.from ?? b.last ?? 0, to: null, at: a.t };
      endAttack(a, 'G', 'GOAL');
      return;
    }
    if (post || bar) {
      // off the woodwork: back into play
      b.y = PL - 0.05;
      b.vy = -Math.abs(b.vy) * 0.55;
      b.vx += (a.rand() - 0.5) * 5;
      if (bar) b.vh = -Math.abs(b.vh) * 0.4 - 1;
      a.events.push(post ? 'post' : 'bar');
      setPath(a, tracePath(b));
      b.flight = { kind: 'parry', from: b.last ?? 0, to: null, at: a.t };
      return;
    }
    const last = b.last !== null ? a.bodies[b.last] : null;
    if (f?.kind === 'parry' && last?.role === 'gk') endAttack(a, 'S', 'SAVED · TURNED ROUND');
    else if (last && last.side === 'D') endAttack(a, 'B', 'DEFLECTED OUT');
    else endAttack(a, 'W', h > GH ? 'OVER THE BAR' : 'WIDE');
    return;
  }
}

/** Who gets to a free ball: a pass arriving, a loose ball, a rebound. */
function contact(a: Attack) {
  const b = a.ball;
  const f = b.flight;
  // a shot in the air is the keeper's and the blockers' business (duringFlight)
  if (f?.kind === 'shot') return;
  const speed = Math.hypot(b.vx, b.vy);
  const fresh = (q: Body) => !(f && q.id === f.from && a.t - f.at < 0.3);
  const cands = a.bodies
    .filter((q) => a.t >= q.stunUntil && fresh(q) && q.act !== 'wall')
    .map((q) => ({ q, d: Math.hypot(q.x - b.x, q.y - b.y) }))
    .sort((x, y) => x.d - y.d);
  for (const { q, d } of cands) {
    if (q.role === 'gk') {
      const reach = q.h > 0.1 ? 1.4 : 1.15;
      if (d > reach || b.h > 2.55) continue;
      if (Math.abs(q.x - GX) > 22 || q.y < PL - 18) continue;
      b.owner = q.id;
      b.last = q.id;
      b.flight = null;
      a.path = null;
      a.events.push('claim');
      endAttack(a, 'S', f?.kind === 'cross' || f?.kind === 'lofted' ? 'KEEPER CLAIMS' : 'KEEPER COLLECTS');
      return;
    }
    if (q.side === 'D') {
      const reach = interceptReach(q.p);
      const high = b.h > 0.9;
      if (d > reach || b.h > (high ? jumpReach(q.p) : 0.9) || (high && b.vh > 0)) continue;
      if (f && f.kind !== 'clear' && q.tried === 0) continue;
      const loose = !f || speed < 3;
      if (!loose && q.tried === -1) {
        q.tried = 0;
        // the man pressing the passer: the pass is played around him, mostly
        const atFoot = a.t - f.at < 0.2 ? 0.22 : 1;
        if (a.rand() >= interceptChance(q.p, speed, a.defIQ) * atFoot * (high ? (f.kind === 'cross' ? 0.5 : 0.6) : 1)) continue;
      }
      b.owner = q.id;
      b.last = q.id;
      b.flight = null;
      a.path = null;
      a.events.push(b.h > 0.9 ? 'header-clear' : 'intercept');
      endAttack(a, 'L', loose ? 'CLEARED BY ' + q.p.tag : b.h > 0.9 ? 'HEADED CLEAR' : 'INTERCEPTED BY ' + q.p.tag);
      return;
    }
    // a teammate it isn't for lets a pass that's still moving run on to the man it is for (Claude
    // 2026-11-02: a cross used to stop at the first head on its line)
    if (f && f.to !== null && f.to !== q.id && f.kind !== 'clear' && f.kind !== 'parry' && speed > 7 && a.bodies[f.to]?.side === 'A') continue;
    // an attacker: in reach, at a height he can play
    const air = b.h > 1.0;
    if (d > (air ? 0.95 : 0.8) || b.h > (air ? jumpReach(q.p) : 1.0)) continue;
    // in the air, a defender close by goes up with him
    if (air) {
      const rival = nearestDefender(a, q);
      if (rival.b && rival.d < (f?.kind === 'cross' ? (a.scenario === 'corner' ? SP_TUNE.cornerMark : 1.5) : 0.9)) {
        const att = rt(q.p.a.PHY) + 0.15 * rt(q.p.a.SHO);
        const def = rt(rival.b.p.a.PHY) * 0.7 + rt(rival.b.p.a.DEF) * 0.45 + 0.06 * a.defIQ;
        // a corner: the box is marked man for man, so the defenders win more of them
        const base = a.scenario === 'corner' ? SP_TUNE.cornerDuel : 0.42;
        if (a.rand() < clamp(base + (def - att) * 0.8, 0.15, 0.85)) {
          b.owner = null;
          b.last = rival.b.id;
          b.vx = (a.rand() - 0.5) * 9;
          b.vy = -6 - a.rand() * 4;
          b.vh = 3;
          b.flight = { kind: 'clear', from: rival.b.id, to: null, at: a.t };
          act(rival.b, 'header', a.t);
          a.events.push('header-clear');
          endAttack(a, 'L', 'WON IN THE AIR BY ' + rival.b.p.tag);
          return;
        }
      }
    }
    if (f && a.offIds.includes(q.id) && f.from !== q.id) {
      a.events.push('offside');
      endAttack(a, 'O', 'OFFSIDE · ' + q.p.tag);
      return;
    }
    // a first-time hit: SHOOT was let go (or is held) as it came
    const firstGo = q.id === a.ctrl && (a.first || (a.meter && a.meter.first));
    if (firstGo) {
      let fs = a.first;
      if (!fs && a.meter) {
        const m = a.meter;
        const held = a.t - m.t0;
        fs = { off: held - m.top, greened: Math.abs(held - m.top) <= m.green, power: clamp(held / m.top, 0.3, 1.35), aim: m.aim ?? null, green: m.green };
        a.release = { at: a.t, off: fs.off, green: m.green, top: m.top };
        a.meter = null;
      }
      a.first = null;
      if (fs) {
        b.vx *= 0.2;
        b.vy *= 0.2;
        b.owner = null;
        strikeShot(a, q, fs.off, fs.greened, fs.power, fs.aim, fs.green, b.h > 1.2, !fs.aim);
        b.flight = { kind: 'shot', from: q.id, to: null, at: a.t };
        b.vx = 0;
        b.vy = 0;
        b.vh = 0;
        b.h = Math.min(b.h, jumpReach(q.p));
        return;
      }
    }
    // a hard ball is harder to kill: a poor first touch lets it run
    if (speed > 15 && a.rand() > lerp(0.55, 0.97, rt(q.p.a.DRI))) {
      const fwd = facingOf(q);
      b.vx = fwd.x * speed * 0.35 + (a.rand() - 0.5) * 3;
      b.vy = fwd.y * speed * 0.35;
      b.vh = 0;
      b.last = q.id;
      b.flight = { kind: 'clear', from: q.id, to: null, at: a.t };
      setPath(a, tracePath(b, 2));
      a.events.push('heavy-touch');
      return;
    }
    b.owner = q.id;
    b.last = q.id;
    b.flight = null;
    b.h = 0;
    b.vh = 0;
    a.path = null;
    a.offIds = [];
    a.ctrl = q.id;
    q.run = null;
    a.events.push(air ? 'chest' : 'control');
    return;
  }
}

/* ---------- the man on the ball ---------- */

function human(a: Attack, b: Body, stick: Pt, sprint: boolean, dt: number) {
  const mag = Math.min(1, Math.hypot(stick.x, stick.y));
  const owner = a.ball.owner === b.id;
  if (a.setPiece && a.taker === b.id) {
    // over the ball: the stick aims, he doesn't wander off it
    b.vx = 0;
    b.vy = 0;
    return;
  }
  const kicking = b.act === 'kick' && a.t - b.actAt < 0.3;
  let top = topSpeed(b.p) * (sprint ? 1 : JOG) * lerp(0.88, 1, a.stamina);
  if (owner) top *= dribblePace(b.p);
  // winding up a shot slows him a little (0.75 until 2026-11-02, when the stick still aimed)
  if (a.meter) top *= 0.85;
  if (kicking) top *= 0.4;
  const dir = mag > 0.01 ? { x: stick.x / Math.max(1, mag), y: stick.y / Math.max(1, mag) } : { x: 0, y: 0 };
  accelTo(b, dir.x * top, dir.y * top, dt, owner ? 1 : 1.1);
}

/** An attacker the stick isn't on: onto a pass, after a loose ball, or into his lane and his runs. */
function attackOffBall(a: Attack, b: Body, dt: number, sprint: boolean) {
  const ball = a.ball;
  const f = ball.flight;
  const top = topSpeed(b.p);
  if (a.setPiece) {
    if (a.taker === b.id) {
      b.vx = 0;
      b.vy = 0;
      return;
    }
    // jostling for the delivery: a few steps around his spot
    const wob = Math.sin(a.t * 1.3 + b.id) * 0.8;
    steer(b, b.home.x + wob, b.home.y + Math.cos(a.t + b.id) * 0.4, 2.5, dt);
    return;
  }
  if (ball.owner === b.id) {
    // the brain owns him (autopilot): it sets his velocity through dribble(); hold course
    return;
  }
  if (f && f.to === b.id && a.path) {
    const m = meetPoint(a, b, f.kind === 'ground' || f.kind === 'through' ? 1.1 : 2.6);
    if (m) {
      steer(b, m.x, m.y, top * (sprint || dist(b, m) > 4 ? 1 : 0.9), dt);
      return;
    }
  }
  if (ball.owner === null && (!f || f.kind === 'clear' || f.kind === 'parry' || Math.hypot(ball.vx, ball.vy) < 6)) {
    // the nearest two go for a loose ball
    const near = a.bodies
      .filter((q) => q.side === 'A')
      .sort((p, q) => dist(p, ball) - dist(q, ball))
      .slice(0, 2);
    if (near.includes(b) && !(f?.kind === 'shot')) {
      const m = a.path ? meetPoint(a, b, 1.8) : null;
      steer(b, m?.x ?? ball.x, m?.y ?? ball.y, top, dt);
      if (near[0] === b && b.id !== a.ctrl && a.ctrl !== b.id) a.ctrl = b.id;
      return;
    }
  }
  // his run in behind
  const line = offsideLine(a);
  if (b.run) {
    if (dist(b, b.run) < 1.2 || (f && f.to !== b.id && f.kind !== 'through') || b.run.y > PL - 2) b.run = null;
    else {
      steer(b, b.run.x, b.run.y, top, dt);
      return;
    }
  }
  const owner = ownerOf(a);
  const bx = owner ? owner.x : ball.x;
  const by = owner ? owner.y : ball.y;
  const slot = b.slot;
  const wide = slot === 'LW' || slot === 'RW' || slot === 'LB' || slot === 'RB';
  const isFwd = slot === 'LW' || slot === 'RW' || slot === 'ST' || slot.startsWith('BX');
  const lane = b.home.x;
  let tx: number;
  let ty: number;
  if (by > PL - 26 && isFwd) {
    // the ball's near the box: attack the near post, the far post, the spot
    const near = bx < GX ? -1 : 1;
    const role = slot === 'ST' ? 0 : (slot === 'LW' ? -1 : 1) * near;
    tx = GX + (role === 0 ? near * 1.5 : role < 0 ? near * 3.8 : -near * 5.5);
    ty = PL - (role === 0 ? 7 : role < 0 ? 5.5 : 9);
    if (Math.abs(bx - GX) < 12) {
      tx = lane < GX ? GX - 9 : lane > GX + 1 ? GX + 9 : GX + (bx < GX ? 4 : -4);
      ty = Math.min(PL - 10, line - 0.7);
    }
  } else if (isFwd) {
    tx = wide ? lane : GX + (bx - GX) * 0.25;
    ty = Math.min(line - 0.8, by + 16);
  } else if (wide) {
    tx = lane;
    ty = Math.min(line - 3, by + 4);
  } else {
    // a midfielder: an outlet behind the ball, and toward the side it's on
    tx = clamp(bx + (lane < GX ? -11 : 11), 8, PW - 8);
    ty = Math.min(line - 4, by - 5);
  }
  // keep onside unless running
  ty = Math.min(ty, line - 0.4);
  // spread out from teammates
  for (const q of a.bodies) {
    if (q === b || q.side !== 'A') continue;
    const d = dist(q, { x: tx, y: ty });
    if (d < 6) {
      const n = norm(tx - q.x, ty - q.y);
      tx += n.x * (6 - d) * 0.6;
      ty += n.y * (6 - d) * 0.3;
    }
  }
  // a forward times a run in behind: when the man on the ball can play it (and he's onside)
  if (isFwd && owner && owner.side === 'A' && owner !== b && b.y > by - 4 && b.y < line && line - b.y < 6 && by < PL - 22) {
    const hz = 0.35 * dt * (1 + rt(b.p.a.PAC) * 0.5);
    if (a.rand() < hz) {
      b.run = { x: clamp(b.x + (GX - b.x) * 0.3, 4, PW - 4), y: Math.min(PL - 6, line + 14) };
      a.events.push('run');
    }
  }
  steer(b, clamp(tx, 2, PW - 2), clamp(ty, 35, PL - 2), top * (sprint ? 1 : JOG), dt);
}

/** Tackles on the man with the ball: a defender inside 1.2 m gathers, then goes in. */
function tackles(a: Attack, c: Body) {
  const t = a.t;
  if (c.act === 'kick' && t - c.actAt < 0.15) return;
  for (const d of a.bodies) {
    if (d.side !== 'D' || t < d.stunUntil || d.act === 'wall') continue;
    if (d.role === 'gk') {
      // the keeper comes out to smother a one-on-one
      if (dist(d, c) < 1.35 && t >= d.tackleReady) {
        d.tackleReady = t + 1.5;
        if (a.rand() < gkSmother(d.p, c.p) * (1 + 0.1 * a.defIQ)) {
          a.ball.owner = d.id;
          a.ball.last = d.id;
          act(d, 'dive', t);
          a.events.push('smother');
          endAttack(a, 'S', 'SMOTHERED BY ' + d.p.tag);
          return;
        }
        act(d, 'dive', t);
        d.stunUntil = t + 1.1;
        a.events.push('beat');
      }
      continue;
    }
    const e = dist(d, c);
    if (e > 1.2) {
      d.commit = Infinity;
      continue;
    }
    if (t < d.tackleReady) continue;
    if (d.commit === Infinity) {
      d.commit = t + lerp(0.45, 0.16, rt(d.p.a.DEF)) * (1 - 0.25 * a.defIQ) + a.rand() * 0.2;
      continue;
    }
    if (t < d.commit) continue;
    d.commit = Infinity;
    d.tackleReady = t + 1.6;
    const sprinting = a.sprinting && c.id === a.ctrl;
    // a tackle from behind (the defender chasing) is harder to time cleanly
    const behind = (d.x - c.x) * c.fx + (d.y - c.y) * c.fy < -0.3;
    const p = tackleWin(d.p, c.p, sprinting, a.defIQ) * (behind ? 0.8 : 1);
    act(d, 'tackle', t);
    if (a.rand() < p) {
      const away = norm(c.x - d.x + (a.rand() - 0.5), -1.2);
      a.ball.owner = null;
      a.ball.last = d.id;
      a.ball.vx = away.x * 6;
      a.ball.vy = away.y * 6;
      a.ball.flight = { kind: 'clear', from: d.id, to: null, at: t };
      c.stunUntil = t + 0.8;
      act(c, 'down', t);
      a.events.push('tackle');
      endAttack(a, 'L', 'TACKLED BY ' + d.p.tag);
      return;
    }
    d.stunUntil = t + 0.95;
    d.vx *= 0.5;
    d.vy *= 0.5;
    a.events.push('beat');
    // a mistimed tackle can be a foul: in the box a penalty, near the box a free kick
    const pf = clamp(0.04 + 0.22 * (1 - Math.min(1, rt(d.p.a.DEF))) + (behind ? 0.14 : 0) + 0.08 * rt(c.p.a.DRI) - 0.05 * a.defIQ, 0.03, 0.4);
    if (a.rand() < pf) {
      a.fouls++;
      act(c, 'down', t);
      c.stunUntil = t + 0.7;
      if (inBox(c)) {
        a.events.push('foul', 'penalty');
        a.penaltyFrom = d.p.tag;
        setPieceAfterFoul(a, 'penalty', { x: GX, y: SPOT_Y });
      } else if (c.y > 70) {
        a.events.push('foul', 'freekick');
        setPieceAfterFoul(a, 'freekick', { x: c.x, y: c.y });
      } else {
        // advantage: play on
        a.events.push('foul', 'advantage');
        c.stunUntil = t + 0.25;
      }
    }
    return;
  }
}

/** A foul given: everyone lines up for the free kick or the penalty (the clock waits). */
function setPieceAfterFoul(a: Attack, kind: 'freekick' | 'penalty', at: Pt) {
  const atts = a.bodies.filter((b) => b.side === 'A');
  const defs = a.bodies.filter((b) => b.side === 'D' && b.role !== 'gk');
  const gk = keeperOf(a);
  const taker = [...atts].sort((p, q) => rt(q.p.a.SHO) - rt(p.p.a.SHO))[0];
  const spot = kind === 'penalty' ? { x: GX, y: SPOT_Y } : { x: clamp(at.x, 3, PW - 3), y: clamp(at.y, 60, PL - BOX - 1.5) };
  a.setPiece = { kind, spot, side: 1 };
  a.taker = taker.id;
  a.ctrl = taker.id;
  a.meter = null;
  a.first = null;
  const ball = a.ball;
  ball.owner = null;
  ball.flight = null;
  ball.x = spot.x;
  ball.y = spot.y;
  ball.h = 0;
  ball.vx = ball.vy = ball.vh = 0;
  a.path = null;
  const to = norm(GX - spot.x, PL - spot.y);
  taker.x = spot.x - to.x * 1.5;
  taker.y = spot.y - to.y * 1.5;
  for (const b of a.bodies) {
    b.vx = b.vy = 0;
    b.stunUntil = 0;
    b.run = null;
    b.commit = Infinity;
    if (b.act !== 'celebrate') act(b, 'idle', a.t);
  }
  if (kind === 'penalty') {
    let i = 0;
    for (const b of atts) if (b !== taker) ((b.x = 24 + (i++ % 4) * 6), (b.y = PL - 18.5), (b.home = { x: b.x, y: b.y }));
    i = 0;
    for (const b of defs) ((b.x = 27 + (i++ % 5) * 4.5), (b.y = PL - 19.2), (b.home = { x: b.x, y: b.y }));
    gk.x = GX;
    gk.y = PL - 0.2;
  } else {
    const wallC = { x: spot.x + to.x * 9.15, y: spot.y + to.y * 9.15 };
    const across = { x: -to.y, y: to.x };
    const nearSide = spot.x < GX ? -1 : 1;
    const wallN = dist(spot, goalC) < 30 ? 4 : 2;
    defs.forEach((b, i) => {
      if (i < wallN) {
        const o = (i - (wallN - 1) / 2) * 0.62 + nearSide * 0.45;
        b.x = wallC.x + across.x * o;
        b.y = wallC.y + across.y * o;
        act(b, 'wall', a.t);
      } else {
        b.x = clamp(GX + (i - wallN - 1) * 6, 20, 48);
        b.y = PL - 8 - (i % 2) * 3;
      }
      b.home = { x: b.x, y: b.y };
    });
    let i = 0;
    for (const b of atts) if (b !== taker) ((b.x = GX - 8 + (i++ % 4) * 5.5), (b.y = PL - 10.5 - (i % 2) * 2), (b.home = { x: b.x, y: b.y }));
    gk.home = keeperSpot(a, gk, 0);
    gk.x = gk.home.x;
    gk.y = gk.home.y;
  }
  taker.home = { x: taker.x, y: taker.y };
  a.events.push('whistle');
}

/* ---------- defenders ---------- */

function defend(a: Attack, d: Body, dt: number) {
  const ball = a.ball;
  const owner = ownerOf(a);
  const top = topSpeed(d.p);
  if (d.act === 'wall' && a.setPiece) {
    d.vx = d.vy = 0;
    return;
  }
  if (a.setPiece) {
    // set pieces: hold the zone, mark the man nearest it
    const m = nearestAttacker(a, d.home, 5);
    const tx = m ? m.x + (GX - m.x) * 0.1 : d.home.x;
    const ty = m ? m.y + 0.9 : d.home.y;
    steer(d, (tx + d.home.x) / 2, (ty + d.home.y) / 2, 3, dt);
    return;
  }
  const bx = owner ? owner.x : ball.x;
  const by = owner ? owner.y : ball.y;
  // what he sees: the man on the ball a beat ago (sharper defenders read it sooner)
  const lag = lerp(0.24, 0.07, rt(d.p.a.DEF)) * (1 - 0.3 * a.defIQ);
  const seen = owner ? { x: owner.x - owner.vx * lag, y: owner.y - owner.vy * lag } : { x: ball.x, y: ball.y };
  const defs = a.bodies.filter((q) => q.side === 'D' && q.role === 'def' && q.act !== 'wall');
  // the line: high while the ball's in midfield, dropping toward the box as it comes
  const lineY = clamp(by + 17 - Math.max(0, by - 50) * 0.32, 70, PL - 6);
  // pressing: the nearest to the ball goes, the next covers
  const order = defs.filter((q) => a.t >= q.stunUntil).sort((p, q) => dist(p, seen) - dist(q, seen));
  const f = ball.flight;
  if (ball.owner === null && f && a.path && f.kind !== 'shot' && f.kind !== 'clear' && f.kind !== 'parry') {
    // a pass: after his read (sharper defenders sooner), the one man who can beat the receiver to
    // it goes for it; the rest keep their shape
    if (a.t - f.at > lag + 0.12 && a.chaser === d.id) {
      const m = meetPoint(a, d, f.kind === 'ground' || f.kind === 'through' ? 0.9 : 2.4);
      if (m) {
        steer(d, m.x, m.y, top, dt);
        return;
      }
    }
  }
  if (ball.owner === null && (!f || f.kind === 'clear' || f.kind === 'parry')) {
    if (order[0] === d || order[1] === d) {
      steer(d, ball.x, ball.y, top, dt);
      return;
    }
  }
  if (owner && owner.side === 'A') {
    if (order[0] === d) {
      const g = norm(GX - seen.x, PL - seen.y);
      // chasing from behind: flat out at where he's going, no slowing to jockey
      if ((d.x - owner.x) * g.x + (d.y - owner.y) * g.y < 0) {
        steer(d, owner.x + owner.vx * 0.25, owner.y + owner.vy * 0.25, top, dt, false);
        return;
      }
      // goal-side: jockey, then close in to tackle
      const close = dist(d, owner) < 3 ? 0.9 : 1.6;
      steer(d, seen.x + g.x * close, seen.y + g.y * close, top * (dist(d, owner) > 6 ? 1 : 0.92), dt);
      return;
    }
    if (order[1] === d) {
      const g = norm(GX - seen.x, PL - seen.y);
      steer(d, seen.x + g.x * 4.5, seen.y + g.y * 4.5, top * 0.95, dt);
      return;
    }
  }
  // zonal: his slot across the line, shifted toward the ball; mark the man in his zone, goal-side
  const isBack = /^(LB|LCB|RCB|RB|Z[0-3])$/.test(d.slot);
  const zx = clamp(d.home.x + (bx - GX) * 0.45, 4, PW - 4);
  const zy = isBack ? lineY : Math.min(lineY - 9, by + 6);
  let tx = zx;
  let ty = zy;
  const m = nearestAttacker(a, { x: zx, y: zy }, isBack ? 11 : 9);
  let speed = top * JOG;
  if (m && (!owner || m !== owner)) {
    const behind = m.y > lineY - 0.3;
    tx = m.x + (GX - m.x) * 0.1;
    ty = isBack && !behind ? Math.max(lineY, Math.min(m.y + 1.5, lineY + 2)) : m.y + 1.4;
    if (behind || m.run) {
      // a runner going in behind: track him (goal-side), at full speed
      ty = Math.max(m.y + 1.2 + Math.max(0, m.vy) * 0.25, d.y);
      tx = m.x + m.vx * 0.2;
      speed = top;
    }
  }
  steer(d, tx, Math.min(ty, PL - 1), speed, dt);
}

function nearestAttacker(a: Attack, q: Pt, within: number): Body | null {
  let best: Body | null = null;
  let bd = within;
  for (const b of a.bodies) {
    if (b.side !== 'A') continue;
    const d = dist(b, q);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

function keeper(a: Attack, gk: Body, dt: number) {
  const ball = a.ball;
  const f = ball.flight;
  if (f?.kind === 'shot' && a.gkPlan) return;
  if (a.setPiece?.kind === 'penalty') {
    gk.vx = gk.vy = 0;
    gk.x = GX + Math.sin(a.t * 2.2) * 0.25;
    return;
  }
  const owner = ownerOf(a);
  // a one-on-one: no defender between the man on the ball and the goal, inside 18 m (20 before
  // 2026-11-02): come out. From
  // a tight angle (Claude 2026-11-02) he narrows it along the angle's bisector instead of running at
  // the ball, which left the far side of the goal open.
  const far = owner ? dist(owner, goalC) : 99;
  if (owner && owner.side === 'A' && far < KEEP.rushFrom && !a.setPiece) {
    const toGoal = norm(GX - owner.x, PL - owner.y);
    const blocked = a.bodies.some((d) => d.role === 'def' && a.t >= d.stunUntil && (d.x - owner.x) * toGoal.x + (d.y - owner.y) * toGoal.y > 0.5 && Math.abs((d.x - owner.x) * toGoal.y - (d.y - owner.y) * toGoal.x) < 2.2);
    if (!blocked && Math.abs(owner.x - GX) < 18) {
      const lead = 0.35;
      let tx = owner.x + owner.vx * lead;
      let ty = owner.y + owner.vy * lead + 0.9;
      if (far > KEEP.chargeAt && Math.abs(owner.x - GX) > KEEP.tightX) {
        const u1 = norm(GX - GHALF - owner.x, PL - owner.y);
        const u2 = norm(GX + GHALF - owner.x, PL - owner.y);
        const bis = norm(u1.x + u2.x, u1.y + u2.y);
        const along = bis.y > 0.05 ? (PL - owner.y) / bis.y : far;
        const out = clamp(far * KEEP.narrow, 1.2, 5);
        tx = owner.x + bis.x * (along - out);
        ty = owner.y + bis.y * (along - out);
      }
      // he sees the backlift (SHOOT held) and gets set rather than running into the shot
      steer(gk, tx, ty, topSpeed(gk.p) * (a.meter ? KEEP.setSlow : 1), dt);
      gk.y = Math.min(gk.y, PL - 0.3);
      return;
    }
  }
  // a cross or through ball he can reach first: claim it
  if (f && (f.kind === 'cross' || f.kind === 'lofted' || f.kind === 'through') && a.path) {
    const m = meetPoint(a, gk, 2.5);
    // from a corner he commands a little more of his box
    const corner = a.scenario === 'corner';
    if (m && m.y > PL - (corner ? SP_TUNE.cornerClaimDepth : 7.5) && Math.abs(m.x - GX) < (corner ? 11 : 10)) {
      const rivals = a.bodies.filter((q) => q.side === 'A').map((q) => meetPoint(a, q, 2.4)?.t ?? 9);
      const mine = Math.max(0, dist(gk, m) - 1) / topSpeed(gk.p);
      if (mine < Math.min(...rivals) - 0.05) {
        steer(gk, m.x, m.y, topSpeed(gk.p), dt);
        return;
      }
    }
  }
  // on his angle, a little off it by POS (a slow drift, not jitter)
  const err = Math.sin(a.t * 0.37 + gk.id * 1.7) * gkPositionError(gk.p) * (1 - 0.3 * a.defIQ);
  const spot = keeperSpot(a, gk, err);
  steer(gk, spot.x, spot.y, topSpeed(gk.p) * 0.85, dt);
  if (gk.act === 'catch' || gk.act === 'set') act(gk, 'idle', a.t);
  gk.h = 0;
}

/** Bodies don't stand in each other. */
function separate(a: Attack) {
  const bs = a.bodies;
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const p = bs[i];
      const q = bs[j];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d >= 0.7 || d < 1e-6) continue;
      const push = (0.7 - d) / 2;
      p.x -= (dx / d) * push;
      p.y -= (dy / d) * push;
      q.x += (dx / d) * push;
      q.y += (dy / d) * push;
    }
}

/** After the whistle: the ball runs on (into the net), the scorer wheels away, the rest slow down. */
export function settle(a: Attack, dt: number) {
  a.t += dt;
  const b = a.ball;
  if (b.owner !== null) {
    const o = a.bodies[b.owner];
    b.x = o.x + o.fx * 0.4;
    b.y = o.y + o.fy * 0.4;
  } else {
    stepBall(b, dt);
    if (a.end?.kind === 'G') {
      // the net: it stops the ball and drops it
      if (b.y > PL + 1.8) {
        b.y = PL + 1.8;
        b.vy = -Math.abs(b.vy) * 0.08;
        b.vx *= 0.3;
        b.vh = Math.min(b.vh, 0);
      }
      b.x = clamp(b.x, GX - GHALF + 0.15, GX + GHALF - 0.15);
      b.h = Math.min(b.h, GH - 0.15);
    }
  }
  for (const q of a.bodies) {
    if (q.act === 'celebrate') {
      const corner = { x: q.x < GX ? 2 : PW - 2, y: PL - 2 };
      steer(q, corner.x, corner.y, topSpeed(q.p) * 0.8, dt);
    } else {
      q.vx *= Math.pow(0.15, dt);
      q.vy *= Math.pow(0.15, dt);
    }
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.act === 'dive' || q.h > 0) q.h = Math.max(0, q.h - dt * 2);
  }
}

/** The dribbler with the brain's (autopilot's) run: a field vector, as the stick would give. */
export function brainRun(a: Attack, b: Body, run: Pt, sprint: boolean, dt: number) {
  human(a, b, run, sprint, dt);
}
