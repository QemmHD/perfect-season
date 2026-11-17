// The broadcast camera (nba-3, plan §3.8 camera rows; Claude 2026-11-16). The camera is pure, so these
// drive it with the engine's own autoplay frames at the two V2 sizes (and the six others), the
// same way the renderer does, and measure what the browser probe (scripts/audit/nba-hud.mjs) measures
// on screen: the rim's row, the handler's row, the safe box, the zoom near the rim, the on-ball
// defender at releases; plus frame-rate independence, the shooter hold and the defensive yaw rule.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { decide, pilot } from './autopilot';
import { CAM, camFollow, camOf, camStart, camStep, type CamState, depthOf, type Frame, hidden, project, type Pt2, type SafeBox, yawFor, yawStep } from './camera';
import { type PCam, pcam, project as oldProject } from '../pixel/persp';
import type { Possession } from './types';
import { ballPos, RIM, RIM_H, step } from './engine';
import { afterPossession, newHoopsGame, startPossession } from './game';
import { env, synthSquad } from './harness';

/** The safe boxes `hud/geometry.ts` reads from the tokens at each size (CSS px; nba-hud.mjs checks them live). */
export const BOXES: Record<string, { W: number; H: number; box: SafeBox }> = {
  '393': { W: 393, H: 852, box: { safeTop: 115, safeBottom: 568, land: false, hudBottom: 114 } },
  '320': { W: 320, H: 568, box: { safeTop: 76, safeBottom: 368, land: false, hudBottom: 65 } },
  '430': { W: 430, H: 932, box: { safeTop: 115, safeBottom: 932 - 284, land: false, hudBottom: 114 } },
  '375': { W: 375, H: 667, box: { safeTop: 76, safeBottom: 667 - Math.round(200 + (55 * 84) / 73), land: false, hudBottom: 69 } },
  '852land': { W: 852, H: 393, box: { safeTop: 100, safeBottom: 393 - 24, land: true, hudBottom: 94 } },
  '568land': { W: 568, H: 320, box: { safeTop: 100, safeBottom: 320 - 24, land: true, hudBottom: 94 } },
};

const DT = 1 / 60;
const rim = { ...RIM, h: RIM_H };

interface Sample {
  rimY: number;
  rimS: number;
  /** where it came from (game, possession, frame): the zoom row's outliers, NBA_CAMDBG */
  tag?: string;
  feetY: number | null;
  headY: number | null;
  dRim: number;
  /** the man with the ball's distance from the rim, null while the ball's in the air or loose (the
   * live probe's definition, nba-hud.mjs: the zoom row is about the play near the rim) */
  dHeld: number | null;
}

/** A camera under test: follows a possession frame by frame, then projects and orders points. */
interface Rig {
  frame(p: Possession, dt: number): void;
  at(cx: number, cz: number, h: number): { x: number; y: number; s: number };
  depth(cx: number, cz: number): number;
  /** the camera's yaw now, and its chosen sign (the new camera only) */
  yaw(): number;
  sign(): number;
}

/** The new camera, fed exactly as render.ts feeds it. */
function newRig(W: number, H: number, box: SafeBox): Rig {
  let st: CamState = camStart();
  let c = camOf(st, W, H, box);
  let last: Possession | null = null;
  return {
    frame(p, dt) {
      // a new possession is a cut, as in render.ts
      if (p !== last) st = { ...st, ready: false };
      last = p;
      st = camFollow(st, p, { W, H, box, rim, zoom: 1 }, dt);
      c = camOf(st, W, H, box);
    },
    at: (cx, cz, h) => project(c, cx, cz, h),
    depth: (cx, cz) => depthOf(c, cx, cz),
    yaw: () => st.yaw,
    sign: () => st.ysign ?? 1,
  };
}

/** The camera before nba-3 (render.ts at 143eee7): a per-frame drift after the ball, no yaw. */
function oldRig(W: number, H: number): Rig {
  const focus = { x: 0, y: 14 };
  let pc: PCam = pcam(W, H, 0, 14, { row: 0.68, s: W / 30, horizon: 0.1, pitch: 0.45, fov: 0.6 });
  return {
    frame(p) {
      const bp = ballPos(p);
      focus.x += (Math.max(-10, Math.min(10, bp.cz * 0.6)) - focus.x) * 0.07;
      focus.y += (Math.max(13, Math.min(30, bp.cx)) - focus.y) * 0.05;
      pc = W > H ? pcam(W, H, focus.x, focus.y, { row: 0.74, s: H / 38, horizon: -0.25, pitch: 0.5, fov: 0.55 }) : pcam(W, H, focus.x, focus.y, { row: 0.68, s: W / 30, horizon: 0.1, pitch: 0.45, fov: 0.6 });
    },
    at: (cx, cz, h) => oldProject(pc, cz, cx, h),
    depth: (cx) => cx,
    yaw: () => 0,
    sign: () => 1,
  };
}

/** Of two bodies, how much of the farther one the nearer one hides (0-1 of its silhouette): each
 * drawn where he is, in the air too (a shooter at the top of his jump, a defender up to contest). */
function hides(r: Rig, near: Pt2 & { h?: number }, far: Pt2 & { h?: number }, width: number): number {
  const box = (q: Pt2 & { h?: number }) => {
    const f = r.at(q.cx, q.cz, q.h ?? 0);
    const hd = r.at(q.cx, q.cz, (q.h ?? 0) + CAM.head);
    return { x0: f.x - (width / 2) * f.s, x1: f.x + (width / 2) * f.s, y0: hd.y, y1: f.y };
  };
  const N = box(near);
  const F = box(far);
  const ix = Math.max(0, Math.min(N.x1, F.x1) - Math.max(N.x0, F.x0));
  const iy = Math.max(0, Math.min(N.y1, F.y1) - Math.max(N.y0, F.y0));
  return (ix * iy) / ((F.x1 - F.x0) * (F.y1 - F.y0));
}

/** Autoplay games framed by a camera at one size: every frame's rows, and each release's overlap. */
function film(size: string, games: number, seed: string, which: 'new' | 'old' = 'new') {
  const { W, H, box } = BOXES[size];
  const samples: Sample[] = [];
  // at each release, with the nearest defender (nba-1's probe): `front` how much of the shooter he
  // hides when he's drawn in front; `either` either man hiding the other; `wide` the same as front
  // with nba-1's 2.4 ft box
  const front: number[] = [];
  const either: number[] = [];
  const wide: number[] = [];
  const jumpers: number[] = [];
  // the rim's motion on screen each frame (px), the yaw's sign changes a possession, and the frames
  // with the court mid-swing (|yaw| under 95% of CAM.yaw)
  const rimMove: number[] = [];
  const flips: number[] = [];
  let swing = 0;
  let poss = 0;
  for (let gi = 0; gi < games; gi++) {
    const a = synthSquad(seed + 'a' + gi);
    const b = synthSquad(seed + 'b' + gi);
    const g = newHoopsGame(a.five, b.five, seed + gi, 16, a.bench, 0);
    const pl = pilot(0.7, seed + gi);
    const rig = which === 'new' ? newRig(W, H, box) : oldRig(W, H);
    let first = true;
    while (!g.over) {
      const p = startPossession(g);
      pl.letGo = null;
      pl.driving = false;
      pl.goal = null;
      pl.nextThink = 0;
      pl.crosses = 0;
      let wasShot = false;
      let nflip = 0;
      let sign = rig.sign();
      for (let i = 0; i < 60 * 30 && !p.end; i++) {
        step(p, DT, decide(p, pl));
        p.events.length = 0;
        const was = rig.at(RIM.cx, RIM.cz, RIM_H);
        const fresh = first || i === 0;
        first = false;
        rig.frame(p, DT);
        const r = rig.at(RIM.cx, RIM.cz, RIM_H);
        if (!fresh) rimMove.push(Math.hypot(r.x - was.x, r.y - was.y));
        if (rig.sign() !== sign) nflip++;
        sign = rig.sign();
        if (Math.abs(rig.yaw()) < 0.95 * CAM.yaw) swing++;
        const rf = rig.at(RIM.cx, RIM.cz, 0);
        const h = p.handler !== null ? p.bodies[p.handler] : null;
        const bp = ballPos(p);
        samples.push({
          rimY: r.y,
          rimS: rf.s,
          feetY: h ? rig.at(h.cx, h.cz, 0).y : null,
          headY: h ? rig.at(h.cx, h.cz, CAM.head).y : null,
          dRim: Math.hypot(bp.cx - RIM.cx, bp.cz - RIM.cz),
          dHeld: h && !p.ball ? Math.hypot(h.cx - RIM.cx, h.cz - RIM.cz) : null,
          tag: env.NBA_CAMDBG ? `${gi}/${poss}/${i} ${p.ball?.kind ?? '-'} h${p.handler}` : undefined,
        });
        const isShot = p.ball?.kind === 'shot';
        if (isShot && !wasShot) {
          const sh = p.bodies[p.ball!.who];
          let gd = sh;
          let gr = Infinity;
          for (const d of p.bodies)
            if (d.side === 'D' && Math.hypot(d.cx - sh.cx, d.cz - sh.cz) < gr) {
              gr = Math.hypot(d.cx - sh.cx, d.cz - sh.cz);
              gd = d;
            }
          const inFront = rig.depth(gd.cx, gd.cz) < rig.depth(sh.cx, sh.cz);
          front.push(inFront ? hides(rig, gd, sh, CAM.shoulders) : 0);
          if (!['layup', 'dunk', 'contact', 'standdunk', 'oop'].includes(p.ball!.shot ?? '')) jumpers.push(front[front.length - 1]);
          wide.push(inFront ? hides(rig, gd, sh, 2.4) : 0);
          either.push(inFront ? hides(rig, gd, sh, CAM.shoulders) : hides(rig, sh, gd, CAM.shoulders));
        }
        wasShot = isShot;
      }
      if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
      afterPossession(g, p);
      flips.push(nflip);
      poss++;
    }
  }
  return { W, H, box, samples, front, either, wide, jumpers, rimMove, flips, swing };
}

const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s[(s.length - 1) >> 1];
};

/** The plan §3.8 numbers for one size (the same definitions as nba-hud.mjs). */
export function cameraRows(size: string, games = 6, seed = 'cam', which: 'new' | 'old' = 'new') {
  const f = film(size, games, seed, which);
  const ok = (xs: number[]) => xs.filter((x) => x <= 0.35).length / Math.max(1, xs.length);
  const withH = f.samples.filter((s) => s.feetY !== null);
  const inBox = (y: number) => y >= f.box.safeTop && y <= f.box.safeBottom;
  const near = f.samples.filter((s) => s.dRim <= 15).map((s) => s.rimS);
  const held = f.samples.filter((s) => s.dHeld !== null && s.dHeld <= 15).map((s) => s.rimS);
  const heldMean = held.reduce((a, x) => a + x, 0) / Math.max(1, held.length);
  if (env.NBA_CAMDBG) {
    const ns = f.samples.filter((s) => s.dRim <= 15).sort((a, b) => a.rimS - b.rimS);
    console.log('ZOOM', size, ns.slice(0, 5).map((s) => s.rimS.toFixed(2) + ' ' + s.tag + ' d' + s.dRim.toFixed(1)).join(' | '), ' … ', ns.slice(-5).map((s) => s.rimS.toFixed(2) + ' ' + s.tag + ' d' + s.dRim.toFixed(1)).join(' | '));
  }
  const mean = near.reduce((a, x) => a + x, 0) / Math.max(1, near.length);
  return {
    frames: f.samples.length,
    rimRow: median(f.samples.map((s) => s.rimY)) / f.H,
    handlerRow: median(withH.map((s) => s.feetY!)) / f.H,
    safe: withH.filter((s) => inBox(s.feetY!) && inBox(s.headY!) && inBox(s.rimY)).length / withH.length,
    outFeet: withH.filter((s) => !inBox(s.feetY!)).length / withH.length,
    outHead: withH.filter((s) => !inBox(s.headY!)).length / withH.length,
    outRim: withH.filter((s) => !inBox(s.rimY)).length / withH.length,
    zoomVar: near.length ? (Math.max(...near) - Math.min(...near)) / mean : 0,
    zoomVarHeld: held.length ? (Math.max(...held) - Math.min(...held)) / heldMean : 0,
    releases: f.front.length,
    overlapOk: ok(f.front),
    separateOk: ok(f.either),
    overlapOkWide: ok(f.wide),
    jumpers: f.jumpers.length,
    overlapOkJumpers: ok(f.jumpers),
    rimMoveMax: Math.max(...f.rimMove),
    rimMoveP999: f.rimMove.slice().sort((a, b) => a - b)[Math.floor(0.999 * (f.rimMove.length - 1))],
    rimMoveOver12: f.rimMove.filter((x) => x > 12).length,
    flipsPerPoss: f.flips.reduce((a, x) => a + x, 0) / Math.max(1, f.flips.length),
    flipsMax: Math.max(...f.flips),
    possWithFlip: f.flips.filter((x) => x > 0).length / Math.max(1, f.flips.length),
    midSwing: f.swing / Math.max(1, f.samples.length),
  };
}

describe('the broadcast camera (V2 B.1.3)', () => {
  it('frames the rim at 20-24% and the handler at 50-55% (median), both in the safe box, zoom fixed near the rim, at 393 and 320', () => {
    for (const size of ['393', '320']) {
      // (12 games, not 6: since nba-4 the AI takes fewer jumpers; the overlap rows want over 40 of them, and
      // the all-releases row a steady sample: 0.871 / 0.841 / 0.855 at 6 / 9 / 12 games)
      const r = cameraRows(size, 12);
      expect(r.frames, size).toBeGreaterThan(3000);
      expect(r.rimRow, size).toBeGreaterThanOrEqual(0.2);
      expect(r.rimRow, size).toBeLessThanOrEqual(0.24);
      // (nba-4 lowered this floor to 0.47 when its AI drove more; the nba-3 review's rim band, CAM.handPull,
      // brings the median back into V2's 50-55% here, 0.518 / 0.504 over 12 games, and live, 0.54 at 393)
      expect(r.handlerRow, size).toBeGreaterThanOrEqual(0.5);
      expect(r.handlerRow, size).toBeLessThanOrEqual(0.55);
      expect(r.safe, size).toBeGreaterThanOrEqual(0.98);
      // the zoom near the rim, as nba-hud.mjs measures it live: while the man with the ball is within
      // 15 ft (0.9% over 12 games). Counting a shot's flight from deep too (the ball near the rim, the
      // shooter held far out, the zoom easing home about the rim, the rim up its band): ≤ 6% (4.8%)
      expect(r.zoomVarHeld, size).toBeLessThanOrEqual(0.02);
      expect(r.zoomVar, size).toBeLessThanOrEqual(0.06);
      // the on-ball defender drawn in front of a jump shooter hides ≤ 35% of him at ≥ 90% of releases;
      // a chase-down from right behind a finish can't be split by any 12° view (recorded, not hidden)
      expect(r.jumpers, size).toBeGreaterThan(40);
      expect(r.overlapOkJumpers, size).toBeGreaterThanOrEqual(0.9);
      expect(r.overlapOk, size).toBeGreaterThanOrEqual(0.85);
      // (nba-3 review) a pass or a loose ball is panned to, never cut to: the rim moves at most 12 px in
      // any frame (a new possession is a cut and isn't counted: every man is re-placed); the yaw
      // changes sign at most once a possession on average, and the court is mid-swing ≤ 10% of the time
      expect(r.rimMoveMax, size).toBeLessThanOrEqual(12);
      expect(r.flipsPerPoss, size).toBeLessThanOrEqual(1);
      expect(r.midSwing, size).toBeLessThanOrEqual(0.1);
    }
  });

  it('keeps the handler and the rim in the safe box at the other sizes, sideways included', () => {
    for (const size of ['430', '375', '852land', '568land']) {
      const r = cameraRows(size, 3, 'cam-' + size);
      // the SE turned sideways leaves a 196 px box under the bug and the toast: a man walking up from
      // half court dips under it for a moment (recorded in nba.md); everywhere else ≥ 98%
      expect(r.safe, size).toBeGreaterThanOrEqual(size === '568land' ? 0.85 : 0.98);
      expect(r.zoomVarHeld, size).toBeLessThanOrEqual(0.02);
      expect(r.zoomVar, size).toBeLessThanOrEqual(0.07);
      expect(r.overlapOkJumpers, size).toBeGreaterThanOrEqual(0.9);
    }
  });

  it.skipIf(!env.NBA_CAM)('reports the camera rows before (143eee7) and after, every size (NBA_CAM=1)', () => {
    const j = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === 'number' ? +v.toFixed(3) : v));
    for (const size of Object.keys(BOXES)) {
      const games = size === '393' || size === '320' ? 6 : 3;
      const seed = games === 6 ? 'cam' : 'cam-' + size;
      console.log(size, 'before', j(cameraRows(size, games, seed, 'old')));
      console.log(size, 'after ', j(cameraRows(size, games, seed)));
    }
  });

  it.skipIf(!env.NBA_CAMQ)('quick camera rows at 393/320 (NBA_CAMQ=1)', () => {
    const j = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === 'number' ? +v.toFixed(3) : v));
    const M = CAM as unknown as Record<string, number>;
    for (const v of (env.NBA_CAMQ_VARS ?? '').split(';').filter(Boolean)) {
      const saved = { ...M };
      for (const kv of v.split(',')) {
        const [k, x] = kv.split('=');
        M[k] = Number(x);
      }
      for (const size of ['393', '320']) console.log('VAR', v, size, j(cameraRows(size, Number(env.NBA_CAMQ_GAMES ?? 6))));
      Object.assign(M, saved);
    }
    if (!env.NBA_CAMQ_VARS) for (const size of ['393', '320']) console.log(size, j(cameraRows(size, Number(env.NBA_CAMQ_GAMES ?? 6))));
  });

  it('settles to the same place at 30 and 60 fps (time-based damping, within 0.5 px)', () => {
    const { W, H, box } = BOXES['393'];
    const at = (t: number) => ({ cx: 14 + 18 * Math.min(1, t / 1.5), cz: -8 + 14 * Math.min(1, t / 1.2) });
    const run = (fps: number) => {
      let st = camStart();
      const dt = 1 / fps;
      for (let t = 0; t <= 3; t += dt) {
        const p = at(t);
        st = camStep(st, { W, H, box, rim, subject: { at: p, ball: p, flying: false, shot: false }, yaw: CAM.yaw, zoom: 1 }, dt);
      }
      return project(camOf(st, W, H, box), RIM.cx, RIM.cz, RIM_H);
    };
    const a = run(60);
    const b = run(30);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.5);
  });

  it('holds the shooter while his shot is up: the focus moves at most 2 ft, the tilt 2% toward the rim', () => {
    const { W, H, box } = BOXES['393'];
    const shooter = { cx: 18, cz: 9 };
    let st = camStart();
    const still = { W, H, box, rim, yaw: CAM.yaw, zoom: 1 };
    for (let i = 0; i < 120; i++) st = camStep(st, { ...still, subject: { at: shooter, ball: shooter, flying: false, shot: false } }, DT);
    const before = { ...st };
    // the ball flies to the rim over a second
    for (let i = 0; i < 60; i++) {
      const k = i / 60;
      const ball = { cx: shooter.cx + (RIM.cx - shooter.cx) * k, cz: shooter.cz * (1 - k) };
      st = camStep(st, { ...still, subject: { at: shooter, ball, flying: true, shot: true } }, DT);
    }
    expect(Math.hypot(st.a - before.a, st.b - before.b)).toBeLessThanOrEqual(2);
    expect(st.tilt).toBeGreaterThan(0.015);
    expect(st.tilt).toBeLessThanOrEqual(CAM.shotTilt);
  });

  it('the defensive yaw rule keeps the AI handler and your defender apart: overlap ≤ 35% at ≥ 90% of 1,000 releases, both orientations', () => {
    const { W, H, box } = BOXES['393'];
    const r = rng(hashString('def-yaw'));
    for (const orient of ['up', 'v2b'] as const) {
      let ok = 0;
      let okFixed = 0;
      for (let i = 0; i < 1000; i++) {
        // the AI shooter 6-26 ft out, anywhere round the arc; your man between him and the rim
        const d = 6 + 20 * r();
        const ang = (r() - 0.5) * 2.8;
        const sh = { cx: RIM.cx - d * Math.cos(ang), cz: d * Math.sin(ang) };
        const gap = 2.5 + 2.5 * r();
        const toRim = { cx: (RIM.cx - sh.cx) / d, cz: (RIM.cz - sh.cz) / d };
        const lat = (r() - 0.5) * 3;
        const me = { cx: sh.cx + toRim.cx * gap - toRim.cz * lat, cz: sh.cz + toRim.cz * gap + toRim.cx * lat };
        const fr = (yaw: number): Frame => ({ W, H, box, rim, subject: { at: sh, ball: sh, flying: false, shot: false }, yaw, zoom: 1 });
        const yaw = yawFor(sh, me, CAM.yaw, orient, true);
        const st = camStep(camStart(), fr(yaw), DT);
        if (hidden(camOf(st, W, H, box), sh, me) <= 0.35) ok++;
        const base = orient === 'v2b' ? Math.PI + CAM.yaw : CAM.yaw;
        const fixed = camStep(camStart(), fr(base), DT);
        if (hidden(camOf(fixed, W, H, box), sh, me) <= 0.35) okFixed++;
      }
      expect(ok / 1000, orient).toBeGreaterThanOrEqual(0.9);
      // the rule is what does it (with one fixed sign the man on the wrong side stacks up)
      expect(ok, orient).toBeGreaterThanOrEqual(okFixed);
    }
  });

  it('the yaw holds its sign: a guard flickering across the line, a short excursion, a ball in the air, or a recent change never turn it', () => {
    const ball = { cx: 20, cz: 0 };
    // the guard ahead and to the right wants −; ahead and to the left wants +
    const left = { cx: 23, cz: -2 };
    const right = { cx: 23, cz: 2 };
    const nearLine = { cx: 23, cz: 0.6 };
    let st: CamState = { ...camStart(), ready: true, ysign: 1, ysince: 9 };
    const run = (guard: Pt2, secs: number, frozen = false) => {
      for (let t = 0; t < secs; t += DT) st = { ...st, ...yawStep(st, ball, guard, DT, frozen) };
    };
    run(left, 1);
    expect(st.ysign).toBe(1);
    // under 1 ft to the other side: never
    run(nearLine, 2);
    expect(st.ysign).toBe(1);
    // clearly over, but for less than yawWait: no; while the ball's in the air: no
    run(right, CAM.yawWait - 0.1);
    run(left, 0.2);
    expect(st.ysign).toBe(1);
    run(right, 2, true);
    expect(st.ysign).toBe(1);
    // clearly over for yawWait: yes
    run(right, CAM.yawWait + 0.05);
    expect(st.ysign).toBe(-1);
    // and back only after yawHold
    run(left, CAM.yawWait + 0.05);
    expect(st.ysign).toBe(-1);
    run(left, CAM.yawHold);
    expect(st.ysign).toBe(1);
    // a fresh camera takes the rule's sign at once
    expect(yawStep(camStart(), ball, right, DT, false).ysign).toBe(-1);
  });

  it('keeps the whole backboard on screen when the subject is out in the corner', () => {
    for (const size of ['393', '320']) {
      const { W, H, box } = BOXES[size];
      for (const cz of [-23, 23]) {
        const corner = { cx: RIM.cx - 2, cz };
        let st = camStart();
        for (let i = 0; i < 240; i++) st = camStep(st, { W, H, box, rim, subject: { at: corner, ball: corner, flying: false, shot: false }, yaw: CAM.yaw, zoom: 1 }, DT);
        const c = camOf(st, W, H, box);
        const man = project(c, corner.cx, corner.cz, 0);
        // the board's two ends (it's 6 ft wide, 4 ft behind the rim's centre)
        for (const dz of [-3, 3]) {
          const end = project(c, RIM.cx + 1.25, RIM.cz + dz, RIM_H + 1);
          expect(end.x, size + ' board ' + cz + '/' + dz).toBeGreaterThanOrEqual(0);
          expect(end.x, size + ' board ' + cz + '/' + dz).toBeLessThanOrEqual(W);
        }
        expect(man.x, size + ' man ' + cz).toBeGreaterThanOrEqual(CAM.edge - 1);
        expect(man.x, size + ' man ' + cz).toBeLessThanOrEqual(W - CAM.edge + 1);
      }
    }
  });

  it('turns the stick with the camera: up the screen is the camera forward', async () => {
    const { screenToCourt, facingIndex, makeCam } = await import('./camera');
    const c = makeCam(393, 852, BOXES["393"].box, CAM.yaw, 1, 0, 0);
    const up = screenToCourt(c, 0, -1);
    expect(up.cx).toBeCloseTo(Math.cos(CAM.yaw), 6);
    expect(up.cz).toBeCloseTo(Math.sin(CAM.yaw), 6);
    // a man running straight up the screen faces away from the camera (index 0 of the sheet's 16 is
    // toward the camera… the drawing's convention: atan2(-forward, right) = -90° → 12 of 16)
    expect(facingIndex(c, CAM.yaw, 16)).toBe(12);
    expect(facingIndex(makeCam(393, 852, BOXES["393"].box, 0, 1, 0, 0), 0, 16)).toBe(12);
  });
});
