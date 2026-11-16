// Claude (studio overhaul, shell-1, 2026-11-10): the pure parts of the shell QA harness. The page
// helpers are exercised by edge-headers.mjs / home-matrix.mjs runs (docs/studio-overhaul/shell.md).
import { describe, expect, it } from 'vitest';
import { contrastRatio, deltaE2000, deltaE2000Lab, DEVICE_IDS, DEVICES, edgeOf, expectedLayout, fitFor, homeClassFor, luma, meanLumaDiffPct, parseColor, srgbToLab, textClearOf, TEXT_CLEAR } from './edge-lib.mjs';
import { edgeOf as snippetEdgeOf } from './edge-snippet.mjs';
import { fitFor as appFitFor, stageBox, topEdge } from '../../src/stage-layout';

describe('edge-lib devices and edge', () => {
  it('lists the nine phones of the shell plan with their insets', () => {
    expect(DEVICE_IDS).toHaveLength(9);
    const table = Object.fromEntries(DEVICE_IDS.map((id) => [id, [DEVICES[id].w, DEVICES[id].h, ...DEVICES[id].insets]]));
    expect(table).toEqual({
      393: [393, 852, 59, 0, 34, 0],
      402: [402, 874, 62, 0, 34, 0],
      420: [420, 912, 68, 0, 34, 0],
      440: [440, 956, 62, 0, 34, 0],
      430: [430, 932, 59, 0, 34, 0],
      390: [390, 844, 47, 0, 34, 0],
      '375x812': [375, 812, 50, 0, 34, 0],
      375: [375, 667, 20, 0, 0, 0],
      320: [320, 568, 20, 0, 0, 0],
    });
  });

  it('gives the planned edge for each top inset (topEdge in stage-layout.ts must match)', () => {
    const table = { 0: 0, 20: 8, 47: 19, 50: 20, 59: 22, 62: 22, 68: 22, 100: 22, '-5': 0 };
    for (const [t, e] of Object.entries(table)) {
      expect(edgeOf(+t)).toBe(e);
      expect(topEdge(+t)).toBe(e);
      expect(snippetEdgeOf(+t)).toBe(e);
    }
  });

  it('keeps text clear of the band fade by the planned amount', () => {
    expect(TEXT_CLEAR).toEqual({ 59: 26, 62: 26, 68: 26, 50: 24, 47: 24, 20: 10 });
    expect([textClearOf(0), textClearOf(44), textClearOf(56), textClearOf(24)]).toEqual([0, 24, 26, 10]);
    for (const id of DEVICE_IDS) expect(textClearOf(DEVICES[id].insets[0])).toBeGreaterThan(edgeOf(DEVICES[id].insets[0]));
  });
});

describe('expectedLayout mirrors the stage', () => {
  it('uses the app’s own fit thresholds', () => {
    for (const c of [0, 649.9, 650, 729.9, 730, 799.9, 800, 900]) expect(fitFor(c)).toBe(appFitFor(c));
  });

  it('matches stageBox for every phone, portrait', () => {
    for (const id of DEVICE_IDS) {
      const d = DEVICES[id];
      const box = stageBox({ w: d.w, h: d.h, x: 0, y: 0 }, d.insets, 0);
      const e = expectedLayout(id);
      // shell-2 split the stage's height into room (between the raw insets) and content (room − edge)
      expect(e.room).toBeCloseTo(box.room, 0);
      expect(e.roomAfterEdge).toBeCloseTo(box.content, 0);
      expect(e.edge).toBeCloseTo(box.edge, 0);
      expect(e.fit).toBe(box.fit);
      expect(e.sat * e.k).toBeCloseTo(d.insets[0], 0);
    }
  });

  it('reproduces the plan’s device table (room, room after the edge, Home class)', () => {
    const plan = {
      393: [753.2, 731.4, ''],
      402: [754.8, 733.4, ''],
      420: [752.1, 731.7, ''],
      440: [762.3, 742.8, ''],
      430: [761.0, 741.0, ''],
      390: [763.0, 744.0, ''],
      '375x812': [757.1, 736.3, ''],
      375: [672.9, 664.6, 'snug'],
      320: [667.9, 658.1, 'snug'],
    };
    for (const id of DEVICE_IDS) {
      const e = expectedLayout(id);
      expect([e.room, e.roomAfterEdge, e.homeClass], id).toEqual(plan[id]);
    }
  });

  it('names Home’s classes from Pages.tsx thresholds', () => {
    expect([homeClassFor(619), homeClassFor(620), homeClassFor(729.9), homeClassFor(730), homeClassFor(815.9), homeClassFor(816)]).toEqual(['short', 'snug', 'snug', '', '', 'tall']);
  });
});

// Claude (studio overhaul, shell-3, 2026-11-16): the colour maths the plate acceptance is measured with.
describe('edge-lib colour maths (shell-3 plate probes)', () => {
  it('computes CIEDE2000 like the reference data (Sharma, Wu and Dalal 2005)', () => {
    const pairs = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
      [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
    ];
    for (const [a, b, want] of pairs) expect(deltaE2000Lab(a, b)).toBeCloseTo(want, 3);
    expect(deltaE2000([24, 38, 37], [24, 38, 37])).toBe(0);
    expect(srgbToLab([255, 255, 255])[0]).toBeCloseTo(100, 2);
  });

  it('parses colours, and gives WCAG contrast and luma', () => {
    expect(parseColor('#0b2b38')).toEqual([11, 43, 56, 1]);
    expect(parseColor('rgba(2, 8, 12, 0.78)')).toEqual([2, 8, 12, 0.78]);
    expect(parseColor('rgb(4 18 26 / 0.5)')).toEqual([4, 18, 26, 0.5]);
    expect(parseColor('none')).toBeNull();
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(luma([255, 255, 255])).toBeCloseTo(255, 6);
  });

  it('compares band luminance as a mean per-pixel difference in % of 255', () => {
    expect(meanLumaDiffPct([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(meanLumaDiffPct([0, 0], [255, 0])).toBe(50);
    expect(meanLumaDiffPct([1], [1, 2])).toBeNull();
  });
});
