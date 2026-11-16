// Claude (studio overhaul, shell-1, 2026-11-10): the pure parts of the shell QA harness. The page
// helpers are exercised by edge-headers.mjs / home-matrix.mjs runs (docs/studio-overhaul/shell.md).
import { describe, expect, it } from 'vitest';
import { DEVICE_IDS, DEVICES, edgeOf, expectedLayout, fitFor, homeClassFor, textClearOf, TEXT_CLEAR } from './edge-lib.mjs';
import { edgeOf as snippetEdgeOf } from './edge-snippet.mjs';
import { fitFor as appFitFor, stageBox } from '../../src/stage-layout';

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
      expect(e.room).toBeCloseTo(box.content, 0);
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
