// The camera's measuring tape (Claude 2026-11-16, studio overhaul soccer-3): the V1-V3 numbers of
// plan §4.6, computed through the real camera.ts and the real safe box, for camera.test.ts and the
// scripts/soccer/cam.ts harness (one copy of the maths, none replicated). Pure: no DOM.
import { project, type PCam } from '../pixel/persp';
import { decide, pilot } from './autopilot';
import { artOf, ballR, camStep, type CamView, heightK, newCamState, spriteVisible, standsShare, subjectOf, widthAt } from './camera';
import { GH, GHALF, GX, kickOff, PL, setupAttack, step } from './engine';
import { ctrlTagSpot } from './render';
import type { Attack, Body, Scenario, Squad } from './types';
import { geometryFor, type Insets, type Rect, rectOf } from './v2';

export interface Preset {
  name: string;
  W: number;
  H: number;
  ins: Insets;
}
/** The six device presets (plan §3.2). */
export const PRESETS: Preset[] = [
  { name: '393x852 sat59', W: 393, H: 852, ins: { t: 59, r: 0, b: 34, l: 0 } },
  { name: '393x852 sat81', W: 393, H: 852, ins: { t: 81, r: 0, b: 34, l: 0 } },
  { name: '390x844', W: 390, H: 844, ins: { t: 47, r: 0, b: 34, l: 0 } },
  { name: '430x932', W: 430, H: 932, ins: { t: 59, r: 0, b: 34, l: 0 } },
  { name: '375x667', W: 375, H: 667, ins: { t: 20, r: 0, b: 0, l: 0 } },
  { name: '320x568', W: 320, H: 568, ins: { t: 0, r: 0, b: 0, l: 0 } },
];
export const SCENARIOS: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick', 'penalty'];

export const viewOf = (p: Preset, clutch = false): CamView => ({ W: p.W, H: p.H, safe: geometryFor(p.W, p.H, p.ins).safe, clutch });

/** The rects no name tag may print over: the four buttons, the stick's ring, the score bug, pause. */
export function controlRects(p: Preset): Rect[] {
  const g = geometryFor(p.W, p.H, p.ins);
  return [rectOf(g.a), rectOf(g.b), rectOf(g.c), rectOf(g.d), rectOf(g.stickGhost), g.bug, g.pause];
}

const inBox = (q: { x: number; y: number }, b: Rect, m = 0) => q.x >= b.x - m && q.x <= b.x + b.w + m && q.y >= b.y - m && q.y <= b.y + b.h + m;

/** The goal mouth on screen (posts at the line, the bar lifted like the drawing). */
export function goalOnScreen(cam: PCam) {
  const hk = heightK(cam.W);
  const pts = [project(cam, GX - GHALF, PL), project(cam, GX + GHALF, PL), project(cam, GX - GHALF, PL, GH * hk), project(cam, GX + GHALF, PL, GH * hk)];
  return { width: pts[1].x - pts[0].x, pts };
}

export interface KickOffRow {
  scenario: Scenario;
  side: number;
  widthM: number;
  carrier: { x: number; y: number };
  carrierInBox: boolean;
  mates: number;
  matesOn: number;
  stands: number;
  goalPx: number;
  goalIn: boolean;
  /** the man's visible sprite height (px) */
  ctrlPx: number;
  /** the smallest visible sprite on screen */
  minPx: number;
  ballPx: number;
  goalLineY: number;
  distGoal: number;
}

/** One scenario's first frame on a preset. */
export function kickOffRow(p: Preset, a: Attack): KickOffRow {
  const view = viewOf(p);
  const cam = camStep(newCamState(), a, view, 1 / 60, a.t);
  const c = subjectOf(a);
  const pc = project(cam, c.x, c.y);
  const art = artOf(p.W);
  const mates = a.bodies.filter((b) => b.side === c.side && b.role !== 'gk' && b !== c);
  const on = (b: Body) => {
    const q = project(cam, b.x, b.y);
    return q.x >= 0 && q.x <= p.W && q.y >= p.ins.t && q.y <= p.H - p.ins.b;
  };
  const g = goalOnScreen(cam);
  let minPx = Infinity;
  for (const b of a.bodies) if (on(b)) minPx = Math.min(minPx, spriteVisible(b.p.ht / 100, project(cam, b.x, b.y).s, art));
  return {
    scenario: a.scenario,
    side: a.setPiece?.side ?? 1,
    widthM: widthAt(cam, c),
    carrier: { x: pc.x, y: pc.y },
    carrierInBox: inBox(pc, view.safe),
    mates: mates.length,
    matesOn: mates.filter(on).length,
    stands: standsShare(cam),
    goalPx: g.width,
    goalIn: g.pts.every((q) => q.x >= 0 && q.x <= p.W && q.y >= 0 && q.y <= p.H),
    ctrlPx: spriteVisible(c.p.ht / 100, pc.s, art),
    minPx,
    ballPx: 2 * (ballR(project(cam, a.ball.x, a.ball.y).s, art) + 1),
    goalLineY: project(cam, GX, PL).y,
    distGoal: Math.hypot(c.x - GX, PL - c.y),
  };
}

export interface MidStats {
  frames: number;
  inBox: number;
  nearFrames: number;
  goalIn: number;
  seconds: number;
  zoomChanges: number;
  tagFrames: number;
  tagHits: number;
  standsMax: number;
}

/** Autopilot attacks drawn at 60 fps through camStep: the V2 shares. */
export function midAttack(p: Preset, sc: Scenario, pairs: [Squad, Squad][], seedTag: string, clutch = false): MidStats {
  const view = viewOf(p, clutch);
  const ctrls = controlRects(p);
  const art = artOf(p.W);
  const out: MidStats = { frames: 0, inBox: 0, nearFrames: 0, goalIn: 0, seconds: 0, zoomChanges: 0, tagFrames: 0, tagHits: 0, standsMax: 0 };
  pairs.forEach(([us, them], i) => {
    const a = setupAttack(sc, us, them, seedTag + sc + i, {});
    const pl = pilot(0.68, seedTag + 'p' + i);
    const st = newCamState();
    kickOff(a);
    for (let n = 0; !a.end && n < 60 * 60; n++) {
      step(a, 1 / 60, decide(a, pl));
      const cam = camStep(st, a, view, 1 / 60, a.t);
      const c = subjectOf(a);
      if (c.side !== 'A') continue;
      const q = project(cam, c.x, c.y);
      out.frames++;
      if (inBox(q, view.safe, 0.5)) out.inBox++;
      out.standsMax = Math.max(out.standsMax, standsShare(cam));
      if (Math.hypot(c.x - GX, PL - c.y) <= 25) {
        out.nearFrames++;
        if (goalOnScreen(cam).pts.every((g) => g.x >= 0 && g.x <= p.W && g.y >= 0 && g.y <= p.H)) out.goalIn++;
      }
      if (!a.meter) {
        const head = q.y - spriteVisible(c.p.ht / 100, q.s, art);
        const tag = ctrlTagSpot(c.p.tag, q.x, q.y, head, q.s, p.W, ctrls);
        out.tagFrames++;
        if (ctrls.some((r) => tag.x < r.x + r.w && r.x < tag.x + tag.w && tag.y < r.y + r.h && r.y < tag.y + tag.h)) out.tagHits++;
      }
    }
    out.seconds += a.t;
    out.zoomChanges += st.changes;
  });
  return out;
}
