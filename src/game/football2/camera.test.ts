// Claude (studio overhaul nfl-3): the broadcast camera and the turf overlays (camera.ts,
// overlay.ts). The framing is checked in screen pixels through the same projection the renderer
// draws with; the dynamic zoom on 20 seeded deep throws; and both modules are proven render-only:
// seeded plays come out identical whether or not the camera and every overlay run each step.
import { describe, expect, it } from 'vitest';
import { project } from '../pixel/persp';
import { decide, pilot } from './autopilot';
import { ART, FootballCamera, FRAME, inTraffic, lensFor, wantOf, ZOOM } from './camera';
import { newGame, startPlay } from './drive';
import { FIELD_W, snap, step, throwTo } from './engine';
import { airBall, ballBox, Bounce, groundRing, laneArrow, laneShown, type Lens, LineFlash, pressureArc } from './overlay';
import { fixtureTeams } from './sim-kit';
import type { Play } from './types';

/** The C15 action-safe box at the two V2 columns (shared-v2 controlGeometry: sat + 56, H - (sab + 250 / 200)). */
const PHONES = {
  A: { W: 393, H: 852, safe: { top: 59 + 56, bottom: 852 - (34 + 250) } },
  C: { W: 320, H: 568, safe: { top: 20 + 56, bottom: 568 - 200 } }
};

function playAt(seed: string, call: 'pass' | 'run' = 'pass'): Play {
  const t = fixtureTeams('gold');
  const g = newGame(t.off, t.def, seed, 4);
  return startPlay(g, call);
}

/** A recording stand-in for a 2D context: every method is a no-op, every property settable. */
function fakeCtx(): CanvasRenderingContext2D & { calls: number } {
  const state: Record<string | symbol, unknown> = { calls: 0 };
  return new Proxy(state, {
    get(t, k) {
      if (k in t) return t[k];
      return () => {
        (t.calls as number)++;
      };
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    }
  }) as unknown as CanvasRenderingContext2D & { calls: number };
}

describe('the framing (camera.ts)', () => {
  for (const [name, ph] of Object.entries(PHONES))
    it('puts the line of scrimmage at 45% and keeps the wideouts and the stands in bounds at ' + name, () => {
      const p = playAt('frame:' + name);
      const w = wantOf({ W: ph.W, H: ph.H, p, aim: null, safe: ph.safe, reduced: false });
      const cam = lensFor(ph.W, ph.H, w.fx, w.fy, w.row, w.zoom);
      const los = project(cam, p.bx, p.los).y / ph.H;
      expect(los).toBeGreaterThanOrEqual(0.43);
      expect(los).toBeLessThanOrEqual(0.47);
      // every receiver split wide stands on the screen
      for (const b of p.bodies.filter((b) => b.side === 'O')) {
        const q = project(cam, b.x, b.y);
        expect(q.x).toBeGreaterThan(0);
        expect(q.x).toBeLessThan(ph.W);
      }
      // the stands, the sky and the bug above the far wall: no more than 15% of the height from the own 25
      expect(project(cam, FIELD_W / 2, 117, 0).y / ph.H).toBeLessThanOrEqual(0.15);
      // the quarterback is drawn larger than the safeties (perspective), at the art scale
      const qb = project(cam, p.qb.x, p.qb.y).s * ART;
      const deep = Math.min(...p.bodies.filter((b) => b.side === 'D').map((b) => project(cam, b.x, b.y).s * ART));
      expect(deep / qb).toBeLessThan(0.65);
    });

  it('eases live to the 58% row, and jumps straight to each new play', () => {
    const ph = PHONES.A;
    const p = playAt('ease');
    const c = new FootballCamera();
    c.update({ ...ph, p, aim: null, reduced: false }, 0);
    expect(c.row).toBe(FRAME.preRow);
    snap(p);
    const pl = pilot(0.7, 'ease');
    const g = newGame(fixtureTeams('gold').off, fixtureTeams('gold').def, 'ease', 4);
    for (let i = 0; i < 240 && !p.end; i++) {
      step(p, 1 / 60, decide(p, g, pl));
      c.update({ ...ph, p, aim: null, reduced: false }, 1 / 60);
    }
    expect(c.row).toBeGreaterThan(FRAME.preRow);
  });
});

describe('dynamic zoom and the action-safe box', () => {
  /** Drop back, then drag the slingshot to a deep spot, and run the camera for `secs`. */
  function deepThrow(seed: string, reduced: boolean) {
    const ph = PHONES.A;
    const t = fixtureTeams('gold');
    const g = newGame(t.off, t.def, seed, 4);
    const p = startPlay(g, 'pass');
    const c = new FootballCamera();
    c.update({ ...ph, p, aim: null, reduced }, 0);
    snap(p);
    // the pocket: hold the quarterback (a centred stick) through his drop
    for (let i = 0; i < 40 && !p.end; i++) {
      step(p, 1 / 60, { x: 0, y: 0 });
      c.update({ ...ph, p, aim: null, reduced }, 1 / 60);
    }
    const z = p.bodies.find((b) => b.slot === 'Z')!;
    const aim = { x: Math.max(4, Math.min(FIELD_W - 4, z.x)), y: p.los + 32 + (seed.length % 7) };
    let minZoom = c.zoom;
    let lens = c.update({ ...ph, p, aim, reduced }, 1 / 60);
    // the drag holds for 0.6 s (the play frozen, as the thumb aims)
    for (let i = 0; i < 36; i++) {
      lens = c.update({ ...ph, p, aim, reduced }, 1 / 60);
      minZoom = Math.min(minZoom, c.zoom);
    }
    const reticle = project(lens, aim.x, aim.y).y;
    const qb = project(lens, p.qb.x, p.qb.y).y;
    // then the throw: the ball's landing spot is the target while it flies
    let maxZoom = c.zoom;
    let landingInside = true;
    if (!p.end && throwTo(p, aim)) {
      for (let i = 0; i < 90 && !p.end; i++) {
        step(p, 1 / 60, null);
        lens = c.update({ ...ph, p, aim: null, reduced }, 1 / 60);
        maxZoom = Math.max(maxZoom, c.zoom);
        minZoom = Math.min(minZoom, c.zoom);
        if (i > 20 && p.ball && !p.end) {
          const y = project(lens, p.ball.to.x, p.ball.to.y).y;
          if (y < ph.safe.top || y > ph.safe.bottom) landingInside = false;
        }
      }
    }
    return { minZoom, maxZoom, reticle, qb, landingInside, safe: ph.safe };
  }

  it('pulls back below 0.85 for a deep ball and keeps the reticle and the passer inside the safe box on 20 of 20 throws', () => {
    let inside = 0;
    let pulled = 0;
    for (let i = 0; i < 20; i++) {
      const r = deepThrow('deep:' + i, false);
      if (r.minZoom < 0.85) pulled++;
      if (r.reticle >= r.safe.top && r.reticle <= r.safe.bottom && r.qb >= r.safe.top && r.qb <= r.safe.bottom && r.landingInside) inside++;
      expect(r.minZoom).toBeGreaterThanOrEqual(ZOOM.min - 1e-9);
    }
    expect(pulled).toBe(20);
    expect(inside).toBe(20);
  });

  it('never zooms under reduced motion (it only follows), and still keeps the reticle in the box', () => {
    for (let i = 0; i < 20; i++) {
      const r = deepThrow('deep:' + i, true);
      expect(r.minZoom).toBe(1);
      expect(r.maxZoom).toBe(1);
      expect(r.reticle).toBeGreaterThanOrEqual(r.safe.top);
      expect(r.reticle).toBeLessThanOrEqual(r.safe.bottom);
    }
  });

  it('pushes in on a carrier in traffic, up to 1.15, and Clutch sits 6% tighter', () => {
    const p = playAt('traffic', 'run');
    snap(p);
    p.phase = 'run';
    p.carrier = p.rb;
    const d = p.bodies.filter((b) => b.side === 'D').slice(0, 2);
    for (const b of d) Object.assign(b, { x: p.rb.x + 1, y: p.rb.y + 1 });
    expect(inTraffic(p)).toBe(true);
    const ph = PHONES.A;
    expect(wantOf({ ...ph, p, aim: null, reduced: false }).zoom).toBeCloseTo(ZOOM.max);
    expect(wantOf({ ...ph, p, aim: null, reduced: false, clutch: true }).zoom).toBeCloseTo(ZOOM.max * ZOOM.clutch);
    expect(wantOf({ ...ph, p, aim: null, reduced: true, clutch: true }).zoom).toBe(1);
  });
});

describe('the turf overlays (overlay.ts)', () => {
  it('draws the ball at no less than 4×3 px however far away', () => {
    for (const s of [0.5, 2, 5, 8, 12, 30]) {
      const b = ballBox(s);
      expect(b.w).toBeGreaterThanOrEqual(4);
      expect(b.h).toBeGreaterThanOrEqual(3);
    }
  });

  it('shows the run lane for a run call before the snap and through the mesh only', () => {
    const run = playAt('lane', 'run');
    expect(laneShown(run)).toBe(true);
    expect(laneShown(playAt('lane', 'pass'))).toBe(false);
    snap(run);
    const g = newGame(fixtureTeams('gold').off, fixtureTeams('gold').def, 'lane', 4);
    const pl = pilot(0.7, 'lane');
    let off = false;
    for (let i = 0; i < 400 && !run.end; i++) {
      step(run, 1 / 60, decide(run, g, pl));
      if (!laneShown(run)) off = true;
      // once the back is through the line it doesn't come back
      if (off) expect(laneShown(run)).toBe(false);
    }
    expect(off).toBe(true);
  });

  it('bounces an incompletion for 0.6 s (fading in place under reduced motion), and flashes the line to gain', () => {
    const p = playAt('bounce');
    const b = new Bounce();
    p.end = { kind: 'incomplete', x: 20, y: 40, gain: 0, text: 'INCOMPLETE', caught: false, secs: 3 };
    b.watch(p, 10, { from: { x: 20, y: 20 }, to: { x: 20, y: 40 } });
    const mid = b.pose(10.2, false)!;
    expect(mid.y).toBeGreaterThan(40);
    expect(mid.h).toBeGreaterThan(0.15);
    expect(b.pose(10.5, true)!.alpha).toBeCloseTo(0.1667, 2);
    expect(b.pose(10.7, true)).toBeNull();
    expect(b.pose(11.7, false)).toBeNull();
    const f = new LineFlash();
    f.flash(35, 0);
    expect(f.level(0.1, false)).toBeGreaterThan(0);
    expect(f.level(0.5, true)).toBe(0.75);
    expect(f.level(1.2, false)).toBe(0);
  });
});

describe('render-only (the camera and the overlays never touch a play)', () => {
  function hashPlays(withRender: boolean): string {
    let h = 0x811c9dc5;
    const add = (s: string) => {
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    };
    const ctx = fakeCtx();
    for (let gi = 0; gi < 12; gi++) {
      const t = fixtureTeams(gi % 2 ? 'elite' : 'gold');
      const g = newGame(t.off, t.def, 'ro:' + gi, 4);
      const pl = pilot(0.7, 'ro:' + gi);
      for (let n = 0; n < 6 && !g.over; n++) {
        const p = startPlay(g, n % 2 ? 'run' : 'pass');
        const cam = new FootballCamera();
        const bounce = new Bounce();
        snap(p);
        pl.readAt = 0;
        for (let k = 0; k < 1500 && !p.end; k++) {
          step(p, 1 / 60, decide(p, g, pl));
          if (withRender) {
            const pc = cam.update({ ...PHONES.A, p, aim: p.aim, reduced: k % 2 === 0, clutch: n === 5 }, 1 / 60);
            const L: Lens = { at: (x, y, hh = 0) => project(pc, x, y, hh), pitch: () => 0.6 };
            laneArrow(ctx, L, p);
            pressureArc(ctx, L, p);
            if (p.carrier) groundRing(ctx, L, p.carrier, 0.6, '#f6b93b');
            if (p.ball) airBall(ctx, L, p, ART, false);
            bounce.watch(p, k / 60, p.ball ? { from: p.ball.from, to: p.ball.to } : null);
            bounce.draw(ctx, L, k / 60, ART, false);
          }
          p.events.length = 0;
        }
        const e = p.end!;
        add([e.kind, Math.round(e.gain * 1000), Math.round(e.secs * 1000), e.text].join('|'));
        for (const b of p.bodies) add([b.slot, Math.round(b.x * 1000), Math.round(b.y * 1000)].join(','));
      }
    }
    if (withRender) expect(ctx.calls).toBeGreaterThan(1000);
    return h.toString(16);
  }

  it('gives identical seeded plays with the camera and every overlay running each step', () => {
    expect(hashPlays(true)).toBe(hashPlays(false));
  });
});
