// Audit (read-only): what the portrait camera shows at each scenario's kick-off. Replicates
// SoccerRenderer.camAt/target (render.ts:214-234) with persp.ts' pcam/project.
import cardsRaw from '/home/user/ps-studio/src/data/cards-soccer.json';
import { pcam, project } from '/home/user/ps-studio/src/game/pixel/persp';
import { GX, PL, PW, setupAttack } from '/home/user/ps-studio/src/game/soccer2/engine';
import { clubSquad, soccerLines, type SoccerCardsFile } from '/home/user/ps-studio/src/game/soccer2/ratings';
import type { Attack, Scenario } from '/home/user/ps-studio/src/game/soccer2/types';

const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const us = clubSquad(seasons, 'BAR', 2015);
const them = clubSquad(seasons, 'RMA', 2017);
function camAt(W: number, H: number, fx: number, fy: number, zoomK: number) {
  const wide = W > H;
  return pcam(W, H, fx, fy, wide ? { row: 0.66, s: Math.max(9, H / 15) * zoomK, horizon: 0.08, pitch: 0.36, fov: 0.62 } : { row: 0.6, s: Math.max(9, W / 19) * zoomK, horizon: 0.02, pitch: 0.5, fov: 0.45 });
}
function target(a: Attack) {
  const o = a.ball.owner !== null ? a.bodies[a.ball.owner] : null;
  const at = o ?? a.ball;
  const sp = a.setPiece;
  let y = at.y + 2.5;
  if (sp?.kind === 'corner') return { x: GX + (a.ball.x - GX) * 0.42, y: PL - 17 };
  else if (sp?.kind === 'penalty') y = PL - 13.5;
  else if (sp) y = sp.spot.y + 2;
  y = Math.max(44, Math.min(y, PL - 12.5));
  const x = PW / 2 + (Math.max(6, Math.min(PW - 6, at.x)) - PW / 2) * 0.6;
  return { x, y };
}
// HUD rectangles measured in the browser (audit-shots/soccer/report-build.json), CSS px
const HUD: Record<string, { W: number; H: number; top: number; ctrls: { n: string; x: number; y: number; w: number; h: number }[] }> = {
  '390x844': { W: 390, H: 844, top: 124, ctrls: [ { n: 'stick', x: 14, y: 676, w: 122, h: 122 }, { n: 'sprint', x: 304, y: 590, w: 62, h: 62 }, { n: 'pass', x: 208, y: 642, w: 70, h: 70 }, { n: 'thru', x: 176, y: 732, w: 62, h: 62 }, { n: 'shoot', x: 276, y: 698, w: 100, h: 100 } ] },
  '320x568': { W: 320, H: 568, top: 85, ctrls: [ { n: 'stick', x: 14, y: 448, w: 108, h: 108 }, { n: 'sprint', x: 242, y: 378, w: 54, h: 54 }, { n: 'pass', x: 164, y: 424, w: 60, h: 60 }, { n: 'thru', x: 138, y: 498, w: 54, h: 54 }, { n: 'shoot', x: 222, y: 472, w: 84, h: 84 } ] },
};
for (const [tag, hud] of Object.entries(HUD)) {
  console.log('\n== ' + tag + ' portrait ==');
  for (const sc of ['build', 'counter', 'wide', 'corner', 'freekick', 'penalty'] as Scenario[])
    for (const side of [1, -1]) {
      const a = setupAttack(sc, us, them, 'cam' + sc, { side });
      const t = target(a);
      const cam = camAt(hud.W, hud.H, t.x, t.y, sc === 'corner' ? 0.68 : 1);
      const c = a.bodies[a.ctrl];
      const pc = project(cam, c.x, c.y);
      const att = a.bodies.filter((b) => b.side === 'A' && b !== c);
      const vis = att.filter((b) => {
        const p = project(cam, b.x, b.y);
        return p.x > 4 && p.x < hud.W - 4 && p.y > hud.top && p.y < hud.H;
      });
      const under = (p: { x: number; y: number }) => hud.ctrls.find((r) => p.x > r.x && p.x < r.x + r.w && p.y - 10 > r.y - 20 && p.y - 10 < r.y + r.h)?.n ?? '';
      const wM = hud.W / pc.s;
      const goal = project(cam, GX, PL);
      const gw = project(cam, GX + 3.66, PL).x - project(cam, GX - 3.66, PL).x;
      console.log(
        (sc + (side < 0 ? ' (mirrored)' : '')).padEnd(22),
        'carrier at', ('(' + pc.x.toFixed(0) + ',' + pc.y.toFixed(0) + ')').padEnd(11),
        (pc.x < 0 || pc.x > hud.W ? 'OFF-SCREEN ' : '') + (under(pc) ? 'UNDER ' + under(pc).toUpperCase() + ' ' : ''),
        '| his sprite', (1.8 * pc.s).toFixed(0) + 'px tall',
        '| pitch width visible at his row', wM.toFixed(1) + ' m of 68',
        '| teammates on screen', vis.length + '/' + att.length,
        '| goal mouth', gw.toFixed(0) + 'px wide at y', goal.y.toFixed(0)
      );
    }
}
