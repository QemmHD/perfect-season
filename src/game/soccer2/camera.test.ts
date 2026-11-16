// The portrait camera holds its V1-V3 targets (Claude 2026-11-16, studio overhaul soccer-3; plan §4.6,
// V2 B.3.3). The tight numbers over 200 attacks a scenario live in scripts/soccer/cam.ts; this keeps
// guards with small samples so later tuning can't quietly undo the framing.
import { describe, expect, it } from 'vitest';
import { project } from '../pixel/persp';
import { artOf, ballR, baseScale, CAM, camStep, newCamState, spriteVisible, zoomWanted } from './camera';
import { controlRects, kickOffRow, midAttack, PRESETS, SCENARIOS, viewOf } from './camera.test-util';
import { setupAttack } from './engine';
import { arrowFor, placeArrows } from './render';
import { squadFor } from './squads.test-util';
import type { Scenario, Squad } from './types';

const US = squadFor('cam-us', 82);
const THEM = squadFor('cam-them', 80);
const MATES: Record<Scenario, number> = { build: 3, counter: 2, wide: 3, corner: 4, freekick: 4, penalty: 0 };

describe('V1: the kick-off frame on the six presets', () => {
  for (const p of PRESETS)
    it(p.name, () => {
      for (const sc of SCENARIOS)
        for (const side of [1, -1]) {
          const r = kickOffRow(p, setupAttack(sc, US, THEM, 'v1:' + sc, { side }));
          const where = p.name + ' ' + sc + ' ' + side;
          // the man on the ball inside the action-safe box, always
          expect(r.carrierInBox, where).toBe(true);
          // 32-36 m across at his row; a corner is framed out 15% from the flag's side (40 m at 393)
          if (sc === 'corner') expect(r.widthM, where).toBeLessThanOrEqual(CAM.across / CAM.zoomMin + 0.5);
          else {
            expect(r.widthM, where).toBeGreaterThanOrEqual(32 - 0.05);
            expect(r.widthM, where).toBeLessThanOrEqual(36);
          }
          // the stands never more than 12% of the height
          expect(r.stands, where).toBeLessThanOrEqual(CAM.stands + 0.001);
          // the goal mouth at least 60 px wide inside 30 m
          if (r.distGoal <= 30) expect(r.goalPx, where).toBeGreaterThanOrEqual(60);
          // teammates on screen (a corner on the 320 phone shows 3 of 5: the one miss, see the team doc)
          const want = sc === 'corner' && p.W < 340 ? 3 : MATES[sc];
          expect(r.matesOn, where).toBeGreaterThanOrEqual(want);
          if (sc === 'corner') {
            // the taker from the flag's side, on screen and big enough; the goal line in the upper third
            expect(r.carrier.x, where).toBeGreaterThanOrEqual(14);
            expect(r.carrier.x, where).toBeLessThanOrEqual(p.W - 14);
            expect(r.ctrlPx, where).toBeGreaterThanOrEqual(22);
          }
          if (sc === 'corner' || sc === 'penalty') expect(r.goalLineY, where).toBeLessThanOrEqual(p.H / 3);
        }
    });
});

describe('V3: sizes', () => {
  it('a 1.80 m man under control is 34 ± 2 px at 393 and at least 30 px at 320; far men 22 px; the ball 5 px', () => {
    for (const p of PRESETS) {
      const px = spriteVisible(1.8, baseScale(p.W), artOf(p.W));
      if (p.W >= 390) expect(Math.abs(px - 34), p.name).toBeLessThanOrEqual(2);
      expect(px, p.name).toBeGreaterThanOrEqual(30);
      expect(2 * (ballR(baseScale(p.W), artOf(p.W)) + 1), p.name).toBeGreaterThanOrEqual(5);
    }
    // a man 45 m up the pitch from the carrier, on the 393 phone
    const p = PRESETS[0];
    const a = setupAttack('build', US, THEM, 'v3');
    const cam = camStep(newCamState(), a, viewOf(p), 1 / 60, 0);
    const c = a.bodies[a.ctrl];
    const far = project(cam, c.x, c.y + 45);
    expect(spriteVisible(1.8, far.s, artOf(p.W))).toBeGreaterThanOrEqual(22);
  });
});

describe('edge arrows', () => {
  it('every teammate off the screen, under the bug or under the thumbs gets one, inside the box, none overlapping', () => {
    for (const p of PRESETS)
      for (const sc of SCENARIOS) {
        const a = setupAttack(sc, US, THEM, 'arrows:' + sc);
        const view = viewOf(p);
        const cam = camStep(newCamState(), a, view, 1 / 60, 0);
        const c = a.bodies[a.ctrl];
        const mates = a.bodies.filter((b) => b.side === 'A' && b !== c && b.role !== 'gk').map((b) => ({ id: b.id, ...project(cam, b.x, b.y) }));
        const arrows = placeArrows(mates, view.safe, p.W);
        const hidden = mates.filter((m) => arrowFor(m, view.safe, p.W));
        expect(arrows.map((r) => r.id).sort()).toEqual(hidden.map((m) => m.id).sort());
        for (const r of arrows) {
          // a 44 px target: its centre at least 20 px inside the screen
          expect(r.x).toBeGreaterThanOrEqual(view.safe.x + 19);
          expect(r.x).toBeLessThanOrEqual(view.safe.x + view.safe.w - 19);
          expect(r.y).toBeGreaterThanOrEqual(view.safe.y - 30);
          expect(r.y).toBeLessThanOrEqual(view.safe.y + view.safe.h + 30);
        }
        for (let i = 0; i < arrows.length; i++)
          for (let j = i + 1; j < arrows.length; j++) expect(Math.abs(arrows[i].x - arrows[j].x) >= 30 || Math.abs(arrows[i].y - arrows[j].y) >= 24).toBe(true);
      }
  });
});

describe('zoom', () => {
  it('eases out at most 15%, in 0.05 steps, for a corner; open play stays at 1', () => {
    const v = viewOf(PRESETS[0]);
    expect(zoomWanted(setupAttack('build', US, THEM, 'z1'), v)).toBe(1);
    expect(zoomWanted(setupAttack('corner', US, THEM, 'z2'), v)).toBeCloseTo(CAM.zoomMin, 6);
  });
});

describe('V2: mid-attack framing over autopilot attacks', () => {
  const pairs: [Squad, Squad][] = Array.from({ length: 6 }, (_, i) => [squadFor('v2a' + i, 66 + (i % 5) * 6), squadFor('v2b' + i, 64 + ((i * 3) % 5) * 6)]);
  for (const p of [PRESETS[0], PRESETS[5]])
    it(p.name, () => {
      for (const sc of ['build', 'counter', 'wide', 'corner', 'freekick'] as Scenario[]) {
        const m = midAttack(p, sc, pairs, 'v2');
        const where = p.name + ' ' + sc;
        expect(m.inBox / m.frames, where).toBeGreaterThanOrEqual(0.98);
        if (m.nearFrames > 0) expect(m.goalIn / m.nearFrames, where).toBeGreaterThanOrEqual(0.95);
        expect(m.zoomChanges / m.seconds, where).toBeLessThanOrEqual(4);
        expect(m.tagHits, where).toBe(0);
        expect(m.standsMax, where).toBeLessThanOrEqual(CAM.stands + 0.001);
      }
    });
  it('the control rects are the four buttons, the stick, the bug and pause', () => {
    expect(controlRects(PRESETS[0])).toHaveLength(7);
  });
});

// Wave 1 (soccer-3 review fix): a pass moves the anchor to the receiver without a cut. A fixed point
// on the pitch moves only as far as the easing (and the safe-box clamp) carries it in one frame.
describe('no cut when the ball changes hands', () => {
  it('a fixed pitch point never jumps between frames at a change of man (zoom steps aside)', async () => {
    const { decide, pilot } = await import('./autopilot');
    const { kickOff, step, PL: L, GX: X } = await import('./engine');
    const { subjectOf } = await import('./camera');
    const p = PRESETS[0];
    const view = viewOf(p);
    const jumps: number[] = [];
    let changes = 0;
    for (let i = 0; i < 12; i++) {
      const a = setupAttack((['build', 'counter', 'wide'] as Scenario[])[i % 3], squadFor('cut-a' + i, 72 + (i % 4) * 4), squadFor('cut-b' + i, 70), 'cut' + i, {});
      const pl = pilot(0.68, 'cutp' + i);
      const st = newCamState();
      kickOff(a);
      let prev: { x: number; y: number } | null = null;
      let prevSub = subjectOf(a);
      let prevZoom = st.zoom;
      for (let n = 0; !a.end && n < 60 * 60; n++) {
        step(a, 1 / 60, decide(a, pl));
        const cam = camStep(st, a, view, 1 / 60, a.t);
        const q = project(cam, X, L - 11);
        const sub = subjectOf(a);
        if (prev && sub !== prevSub && st.zoom === prevZoom) {
          changes++;
          jumps.push(Math.hypot(q.x - prev.x, q.y - prev.y));
        }
        prev = { x: q.x, y: q.y };
        prevSub = sub;
        prevZoom = st.zoom;
      }
    }
    jumps.sort((a, b) => a - b);
    if (process.env.CAM_PROBE) console.log('CAMPROBE', changes, [0.5, 0.75, 0.9, 0.99, 1].map((k) => jumps[Math.min(jumps.length - 1, Math.floor(jumps.length * k))].toFixed(1)).join(' '));
    expect(changes).toBeGreaterThan(20);
    // before the fix (anchor handed to the receiver's spot): median 135 px, p90 270, max 298 at 393 wide;
    // with it: median 11.6, p90 41.6, max 64.5 (the rest is the row clamp that keeps the stands and the goal in)
    expect(jumps[Math.floor(jumps.length / 2)]).toBeLessThanOrEqual(16);
    expect(jumps[Math.floor(jumps.length * 0.9)]).toBeLessThanOrEqual(50);
    expect(jumps[jumps.length - 1]).toBeLessThanOrEqual(80);
  });
});
