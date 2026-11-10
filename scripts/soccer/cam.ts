// What the portrait camera shows (studio overhaul soccer-1, ported from the 2026-11-09 audit's
// soccer_cam.ts). It replicates SoccerRenderer's camera (render.ts camAt/target/zoom and its follow
// easing) with persp.ts' pcam/project:
//  - kick-off: each scenario's first frame (carrier position and size, pitch width visible at his
//    row, teammates on screen, goal mouth width);
//  - mid-attack: autopilot attacks drawn frame by frame at 60 fps, the share of frames the man on
//    the ball is on screen and clear of the HUD, and how often his sprite size (the zoom the eye
//    sees) changes per second.
// The HUD rectangles are the audit's browser measurements (390x844 and 320x568, CSS px).
//   bash O/heavy.sh npx vite-node scripts/soccer/cam.ts [attacks per scenario=60]
import { pcam, type PCam, project } from '../../src/game/pixel/persp';
import { decide, pilot } from '../../src/game/soccer2/autopilot';
import { GX, kickOff, PL, PW, setupAttack, step } from '../../src/game/soccer2/engine';
import { clubSquad, soccerLines, type SoccerCardsFile } from '../../src/game/soccer2/ratings';
import type { Attack, Body, Scenario } from '../../src/game/soccer2/types';
import cardsRaw from '../../src/data/cards-soccer.json';
import { arg, pairsOf, realSquads } from './lib';

const N = Number(arg(0, '60'));
const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const us = clubSquad(seasons, 'BAR', 2015);
const them = clubSquad(seasons, 'RMA', 2017);

/** render.ts camAt (portrait/landscape) with the zoom factor */
function camAt(W: number, H: number, fx: number, fy: number, zoomK: number): PCam {
  const wide = W > H;
  return pcam(W, H, fx, fy, wide ? { row: 0.66, s: Math.max(9, H / 15) * zoomK, horizon: 0.08, pitch: 0.36, fov: 0.62 } : { row: 0.6, s: Math.max(9, W / 19) * zoomK, horizon: 0.02, pitch: 0.5, fov: 0.45 });
}
/** render.ts target(): the ball, a little toward the goal, the goal in view near the box */
function target(a: Attack) {
  const o = a.ball.owner !== null ? a.bodies[a.ball.owner] : null;
  const at = o ?? a.ball;
  const sp = a.setPiece;
  let y = at.y + 2.5;
  if (sp?.kind === 'corner') return { x: GX + (a.ball.x - GX) * 0.42, y: PL - 17 };
  else if (sp?.kind === 'penalty') y = PL - 13.5;
  else if (sp) y = sp.spot.y + 2;
  y = Math.max(44, Math.min(y, PL - 12.5));
  return { x: PW / 2 + (Math.max(6, Math.min(PW - 6, at.x)) - PW / 2) * 0.6, y };
}
const zoomOf = (a: Attack) => (a.setPiece?.kind === 'corner' ? 0.68 : 1);
/** a sprite's pixel height as render.ts sizes it (even above 14 px) */
const spritePx = (b: Body, s: number) => {
  const raw = Math.max(8, Math.round((b.p.ht / 100) * s));
  return raw > 14 ? raw - (raw % 2) : raw;
};

interface Hud {
  W: number;
  H: number;
  /** the bottom of the scoreboard and attack marks */
  top: number;
  ctrls: { n: string; x: number; y: number; w: number; h: number }[];
}
const HUD: Record<string, Hud> = {
  '390x844': { W: 390, H: 844, top: 124, ctrls: [ { n: 'stick', x: 14, y: 676, w: 122, h: 122 }, { n: 'sprint', x: 304, y: 590, w: 62, h: 62 }, { n: 'pass', x: 208, y: 642, w: 70, h: 70 }, { n: 'thru', x: 176, y: 732, w: 62, h: 62 }, { n: 'shoot', x: 276, y: 698, w: 100, h: 100 } ] },
  '320x568': { W: 320, H: 568, top: 85, ctrls: [ { n: 'stick', x: 14, y: 448, w: 108, h: 108 }, { n: 'sprint', x: 242, y: 378, w: 54, h: 54 }, { n: 'pass', x: 164, y: 424, w: 60, h: 60 }, { n: 'thru', x: 138, y: 498, w: 54, h: 54 }, { n: 'shoot', x: 222, y: 472, w: 84, h: 84 } ] },
};
/** the control a screen point (a man's feet) sits under, if any */
const under = (hud: Hud, p: { x: number; y: number }) => hud.ctrls.find((r) => p.x > r.x && p.x < r.x + r.w && p.y - 10 > r.y - 20 && p.y - 10 < r.y + r.h)?.n ?? '';

for (const [tag, hud] of Object.entries(HUD)) {
  console.log('\n== ' + tag + ' portrait: kick-off ==');
  for (const sc of ['build', 'counter', 'wide', 'corner', 'freekick', 'penalty'] as Scenario[])
    for (const side of [1, -1]) {
      const a = setupAttack(sc, us, them, 'cam' + sc, { side });
      const t = target(a);
      const cam = camAt(hud.W, hud.H, t.x, t.y, zoomOf(a));
      const c = a.bodies[a.ctrl];
      const pc = project(cam, c.x, c.y);
      const mates = a.bodies.filter((b) => b.side === 'A' && b !== c);
      const vis = mates.filter((b) => {
        const p = project(cam, b.x, b.y);
        return p.x > 4 && p.x < hud.W - 4 && p.y > hud.top && p.y < hud.H;
      });
      const goal = project(cam, GX, PL);
      const gw = project(cam, GX + 3.66, PL).x - project(cam, GX - 3.66, PL).x;
      console.log(
        (sc + (side < 0 ? ' (mirrored)' : '')).padEnd(20),
        'carrier at',
        ('(' + pc.x.toFixed(0) + ',' + pc.y.toFixed(0) + ')').padEnd(11),
        (pc.x < 0 || pc.x > hud.W ? 'OFF-SCREEN ' : '') + (under(hud, pc) ? 'UNDER ' + under(hud, pc).toUpperCase() + ' ' : ''),
        '| sprite',
        (1.8 * pc.s).toFixed(0) + 'px',
        '| width at his row',
        (hud.W / pc.s).toFixed(1) + ' m of 68',
        '| teammates on screen',
        vis.length + '/' + mates.length,
        '| goal mouth',
        gw.toFixed(0) + 'px wide at y',
        goal.y.toFixed(0)
      );
    }

  console.log('\n== ' + tag + ' portrait: mid-attack, ' + N + ' real-squad autopilot attacks per scenario (60 fps camera follow) ==');
  const pairs = pairsOf(realSquads(), N, 'cam-pairs');
  for (const sc of ['build', 'counter', 'wide', 'corner', 'freekick'] as Scenario[]) {
    let frames = 0;
    let onScreen = 0;
    let clear = 0;
    let pxChanges = 0;
    let seconds = 0;
    for (let i = 0; i < N; i++) {
      const a = setupAttack(sc, pairs[i][0], pairs[i][1], 'cm' + sc + i, {});
      const pl = pilot(0.68, 'cmp' + i);
      kickOff(a);
      let follow = target(a);
      let zoomK = zoomOf(a);
      let lastPx = -1;
      let lastOwner: number | null = null;
      for (let n = 0; !a.end && n < 60 * 60; n++) {
        step(a, 1 / 60, decide(a, pl));
        const want = target(a);
        follow = { x: follow.x + (want.x - follow.x) * 0.07, y: follow.y + (want.y - follow.y) * 0.08 };
        zoomK += (zoomOf(a) - zoomK) * 0.08;
        const cam = camAt(hud.W, hud.H, follow.x, follow.y, zoomK);
        // the man on the ball (or the one the stick is on while it's loose or in flight)
        const c = a.ball.owner !== null ? a.bodies[a.ball.owner] : a.bodies[a.ctrl];
        if (c.side !== 'A') continue;
        const p = project(cam, c.x, c.y);
        frames++;
        const inFrame = p.x > 0 && p.x < hud.W && p.y > hud.top && p.y < hud.H;
        if (inFrame) onScreen++;
        if (inFrame && !under(hud, p)) clear++;
        const px = spritePx(c, p.s);
        if (lastPx >= 0 && px !== lastPx && lastOwner === c.id) pxChanges++;
        lastPx = px;
        lastOwner = c.id;
      }
      seconds += a.t;
    }
    console.log(
      ('  ' + sc).padEnd(12),
      'frames',
      String(frames).padStart(6),
      '| carrier on screen',
      ((onScreen / Math.max(1, frames)) * 100).toFixed(1).padStart(5) + '%',
      '| on screen and clear of the controls',
      ((clear / Math.max(1, frames)) * 100).toFixed(1).padStart(5) + '%',
      '| his sprite size changes',
      (pxChanges / Math.max(1e-6, seconds)).toFixed(2) + '/s'
    );
  }
}
