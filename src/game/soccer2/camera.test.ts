// The portrait camera holds its V1-V3 targets (Claude 2026-11-16, studio overhaul soccer-3; plan §4.6,
// V2 B.3.3). The tight numbers over 200 attacks a scenario live in scripts/soccer/cam.ts; this keeps
// guards with small samples so later tuning can't quietly undo the framing.
import { describe, expect, it } from 'vitest';
import { project } from '../pixel/persp';
import { anchoredCam, artOf, ballR, baseScale, CAM, camStep, newCamState, spriteVisible, zoomWanted } from './camera';
import { controlRects, kickOffRow, midAttack, PRESETS, quantile, SCENARIOS, viewOf } from './camera.test-util';
import { setupAttack } from './engine';
import { arrowFor, arrowRects, floorShift, layoutLabels, placeArrows, tagBox } from './render';
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
          // 32-36 m across at his row. A corner is the waiver (team doc, soccer-3 review fixes): the flag and
          // the far post are 36.8 m apart, so the taker and the whole goal need about 40 m at his row
          if (sc === 'corner') expect(r.widthM, where).toBeLessThanOrEqual(43);
          else {
            expect(r.widthM, where).toBeGreaterThanOrEqual(32 - 0.05);
            expect(r.widthM, where).toBeLessThanOrEqual(36);
          }
          // the stands never more than 12% of the height
          expect(r.stands, where).toBeLessThanOrEqual(CAM.stands + 0.001);
          // the goal mouth at least 60 px wide inside 30 m
          if (r.distGoal <= 30) expect(r.goalPx, where).toBeGreaterThanOrEqual(60);
          // teammates on screen: four of five at a corner on every phone
          expect(r.matesOn, where).toBeGreaterThanOrEqual(MATES[sc]);
          if (sc === 'corner') {
            // the taker from the flag's side, 20 px or more inside his edge and big enough; the whole goal
            // mouth on screen; the goal line in the upper third
            expect(r.carrier.x, where).toBeGreaterThanOrEqual(20);
            expect(r.carrier.x, where).toBeLessThanOrEqual(p.W - 20);
            expect(r.ctrlPx, where).toBeGreaterThanOrEqual(22);
            expect(r.goalIn, where).toBe(true);
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
        const ctrls = controlRects(p);
        const arrows = placeArrows(mates, view.safe, p.W, p.H, ctrls);
        const hidden = mates.filter((m) => arrowFor(m, view.safe, p.W, p.H, ctrls));
        // nobody in plain view gets one: each is off the screen, above the box or under a control
        for (const m of hidden)
          expect(m.x < 6 || m.x > p.W - 6 || m.y < view.safe.y - 10 || m.y > p.H - 6 || ctrls.some((r) => m.x + 8 > r.x && m.x - 8 < r.x + r.w && m.y > r.y && m.y - 30 < r.y + r.h)).toBe(true);
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

describe('edge arrows and the label pass (soccer-3 review fix)', () => {
  it('no tag prints over an arrow or its chip when the arrows are keep-outs', () => {
    const W = 393;
    const r = { x: 30, y: 300, ang: Math.PI };
    const keep = arrowRects('N11', r, W);
    // three tags whose natural spot is right on the chevron and the chip
    const tags = ['NEYMAR', 'PIQUE', 'MESSI'].map((s, i) => ({ s, x: 30 + i * 12, y: 296 + i * 4, color: '#fff', prio: 1 }));
    for (const t of layoutLabels(tags, W, 852, keep)) {
      const b = tagBox(t.s, t.x, t.y, W);
      for (const k of keep) expect(b.x < k.x + k.w && k.x < b.x + b.w && b.y < k.y + k.h && k.y < b.y + b.h, t.s).toBe(false);
    }
  });
});

describe('the floor blit (soccer-3 review fix: the floor reused while the picture only shifts)', () => {
  const W = 393;
  const H = 852;
  const s = baseScale(W);
  const at = { x: 30, y: 60 };
  it('a still camera reuses it exactly', () => {
    const c = anchoredCam(W, H, at, 196, 400, s);
    expect(floorShift(c, c)).toEqual({ dx: 0, dy: 0, err: 0 });
  });
  it('the shift lens (the anchor row moving) is a pure vertical blit', () => {
    const r = floorShift(anchoredCam(W, H, at, 196, 400, s), anchoredCam(W, H, at, 196, 412.4, s));
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(12);
    expect(r.err).toBeLessThanOrEqual(0.5);
  });
  it('a small pan is a blit within a pixel; a long move or a zoom is a redraw', () => {
    const c0 = anchoredCam(W, H, at, 196, 400, s);
    const pan = floorShift(c0, anchoredCam(W, H, { x: at.x + 0.05, y: at.y }, 196, 400, s));
    expect(pan.err).toBeLessThanOrEqual(1);
    expect(floorShift(c0, anchoredCam(W, H, { x: at.x, y: at.y + 3 }, 196, 400, s)).err).toBeGreaterThan(1.5);
    expect(floorShift(c0, anchoredCam(W, H, at, 196, 400, s * 0.95)).err).toBeGreaterThan(1.5);
  });
});

describe('zoom', () => {
  it('open play stays at 1; a corner eases out in 0.05 steps, no further than cornerZoomMin', () => {
    const v = viewOf(PRESETS[0]);
    expect(zoomWanted(setupAttack('build', US, THEM, 'z1'), v)).toBe(1);
    for (const p of PRESETS) {
      const z = zoomWanted(setupAttack('corner', US, THEM, 'z2'), viewOf(p));
      expect(z).toBeGreaterThanOrEqual(CAM.cornerZoomMin - 1e-9);
      expect(z).toBeLessThan(1);
      expect(Math.abs(z / CAM.zoomStep - Math.round(z / CAM.zoomStep))).toBeLessThan(1e-6);
    }
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
        // no cut on a pass (soccer-3 review fix): fixed pitch points move at most ~20 px a frame, over
        // every subject switch (the old camera jumped a median 151 px, up to 415, on each)
        expect(m.switches, where).toBeGreaterThan(0);
        expect(quantile(m.moves, 0.999), where).toBeLessThanOrEqual(20);
        expect(quantile(m.moves, 1), where).toBeLessThanOrEqual(30);
      }
    });
  it('the control rects are the four buttons, the stick, the bug and pause', () => {
    expect(controlRects(PRESETS[0])).toHaveLength(7);
  });
});
