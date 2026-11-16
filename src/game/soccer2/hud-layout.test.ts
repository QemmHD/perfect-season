// The HUD keeps out of its own way (Claude 2026-11-16, studio overhaul soccer-2; audit V-3, plan C1):
// tags on the pitch never print over each other ("FBENDICK"), the toast line stays below the action-
// safe box that holds the goal mouth and the reticle, and the bug, pause button, toast and cluster
// never meet, at every width the app is checked at.
import { describe, expect, it } from 'vitest';
import { rng } from '../../engine/rng';
import { layoutLabels, type Tag, TAG, tagBox } from './render';
import { geometryFor, meets, rectOf } from './v2';

const WIDTHS = [320, 375, 390, 393, 430];
const HEIGHT: Record<number, number> = { 320: 568, 375: 667, 390: 844, 393: 852, 430: 932 };
const SAT: Record<number, number[]> = { 320: [0, 20], 375: [20], 390: [47], 393: [59, 81], 430: [59] };

const overlaps = (tags: Tag[], W: number) => {
  const boxes = tags.map((t) => tagBox(t.s, t.x, t.y, W));
  let n = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (meets(boxes[i], boxes[j])) n++;
  return n;
};

describe('tags on the pitch (V-3)', () => {
  it('"FREE KICK" over the meter and "BEND" over the ball read as two words, never FBENDICK', () => {
    for (const W of WIDTHS) {
      const H = HEIGHT[W];
      // the audit's case: the meter's word and the bend arrow's word at almost the same spot
      const tags: Tag[] = [
        { s: 'FREE KICK', x: W / 2, y: H * 0.55, color: TAG.word, prio: 3 },
        { s: 'BEND', x: W / 2 + 6, y: H * 0.55 + 4, color: '#ffd23a', prio: 2 },
        { s: 'MESSI', x: W / 2, y: H * 0.55 + 10, color: TAG.ours, prio: 5 },
      ];
      const out = layoutLabels(tags, W, H);
      expect(overlaps(out, W), String(W)).toBe(0);
      // the most important keeps his spot
      expect(out.find((t) => t.s === 'MESSI')!.y).toBe(H * 0.55 + 10);
    }
  });
  it('no two tags overlap and every one stays on screen, over 400 random crowds at each width', () => {
    for (const W of WIDTHS) {
      const H = HEIGHT[W];
      const r = rng(W * 31);
      for (let k = 0; k < 400; k++) {
        const n = 2 + Math.floor(r() * 7);
        const cx = r() * W;
        const cy = 40 + r() * (H - 80);
        const tags: Tag[] = Array.from({ length: n }, (_, i) => ({ s: ['KANE', 'FREE KICK', 'BEND', 'AUTO', 'VAN DIJK', 'POWER', 'PERFECT'][i % 7], x: cx + (r() - 0.5) * 60, y: cy + (r() - 0.5) * 30, color: TAG.white, prio: Math.floor(r() * 5) }));
        const out = layoutLabels(tags, W, H);
        expect(out.length).toBe(n);
        expect(overlaps(out, W), W + ' crowd ' + k).toBe(0);
        for (const t of out) {
          const b = tagBox(t.s, t.x, t.y, W);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(W);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.y + b.h).toBeLessThanOrEqual(H + 0.5);
        }
      }
    }
  });
  it('no tag prints under the toast line: it drops just below the band (or above it at the bottom of the screen)', () => {
    for (const W of WIDTHS) {
      const H = HEIGHT[W];
      const band = { x: 12, y: H * 0.7, w: W - 24, h: 28 };
      const out = layoutLabels([{ s: 'XAVI', x: W / 2, y: band.y + 2, color: TAG.ours, prio: 5 }, { s: 'MESSI', x: W / 2, y: band.y - 10, color: TAG.mate, prio: 2 }], W, H, [band]);
      expect(out).toHaveLength(2);
      for (const t of out) expect(meets(tagBox(t.s, t.x, t.y, W), band), W + ' ' + t.s).toBe(false);
      expect(overlaps(out, W)).toBe(0);
      const low = layoutLabels([{ s: 'KANE', x: W / 2, y: H - 20, color: TAG.ours, prio: 5 }], W, H, [{ x: 0, y: H - 30, w: W, h: 30 }]);
      expect(tagBox('KANE', W / 2, low[0].y, W).y + 16).toBeLessThanOrEqual(H - 30);
    }
  });
  it('tags are readable: 10 px letters on a 16 px chip', () => {
    expect(tagBox('KANE', 100, 100, 390).h).toBe(16);
  });
});

describe('the HUD pieces never meet (C1)', () => {
  it('the toast line is under the action-safe box (where the goal mouth and the reticle are framed), above the cluster, and on screen', () => {
    for (const W of WIDTHS) {
      for (const sat of SAT[W]) {
        const H = HEIGHT[W];
        const sab = W === 320 || W === 375 ? 0 : 34;
        const g = geometryFor(W, H, { t: sat, r: 0, b: sab, l: 0 });
        const tag = W + 'x' + H + ' sat ' + sat;
        expect(meets(g.toast, { x: g.safe.x, y: g.safe.y, w: g.safe.w, h: g.safe.h }), tag + ' toast in the safe box').toBe(false);
        for (const k of ['a', 'b', 'c', 'd'] as const) expect(meets(g.toast, rectOf(g[k])), tag + ' toast on ' + k).toBe(false);
        expect(meets(g.toast, g.bug), tag).toBe(false);
        expect(meets(g.toast, g.pause), tag).toBe(false);
        expect(g.toast.x).toBeGreaterThanOrEqual(0);
        expect(g.toast.x + g.toast.w).toBeLessThanOrEqual(W);
        expect(g.toast.h).toBeGreaterThanOrEqual(24);
        // the bug and its Heat bar sit above the safe box; the bug's top is sat + 4..6
        expect(g.heat.y + g.heat.h).toBeLessThanOrEqual(g.safe.y);
        expect(g.bug.y - sat).toBeGreaterThanOrEqual(4);
        expect(g.bug.y - sat).toBeLessThanOrEqual(6);
      }
    }
  });
  it('sideways the toast line moves under the score bug, clear of the cluster', () => {
    const g = geometryFor(844, 390, { t: 0, r: 47, b: 21, l: 47 }, true);
    expect(g.toast.y).toBeGreaterThan(g.heat.y + g.heat.h);
    for (const k of ['a', 'b', 'c', 'd'] as const) expect(meets(g.toast, rectOf(g[k]))).toBe(false);
  });
});
