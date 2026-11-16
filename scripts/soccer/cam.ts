// What the portrait camera shows (studio overhaul soccer-1, ported from the 2026-11-09 audit's
// soccer_cam.ts; soccer-3 2026-11-16: it measures the real camera.ts through camera.test-util.ts, with
// no maths of its own). Plan §4.6:
//  - V1, kick-off on the six device presets: metres across at the carrier's row, the carrier in the
//    V2 action-safe box, teammates on screen, the stands' share of the height, the goal mouth's width
//    (inside 30 m), the corner taker's size and place;
//  - V2, mid-attack over N autopilot attacks per scenario at 60 fps: the carrier in the safe box, the
//    goal fully in frame inside 25 m, zoom changes a second, the name tag over a control, and the
//    per-frame screen motion of fixed pitch points (p50 / p99 / p99.9 / max px, with the subject
//    switches it glided over: soccer-3 review fix, a pass used to cut the picture);
//  - V3: the controlled man's height, the smallest man on screen, the ball.
//   bash O/heavy.sh npx vite-node scripts/soccer/cam.ts [attacks per scenario=200] [presets: all|main]
import { kickOffRow, midAttack, PRESETS, quantile, SCENARIOS } from '../../src/game/soccer2/camera.test-util';
import { setupAttack } from '../../src/game/soccer2/engine';
import { clubSquad, soccerLines, type SoccerCardsFile } from '../../src/game/soccer2/ratings';
import type { Scenario } from '../../src/game/soccer2/types';
import cardsRaw from '../../src/data/cards-soccer.json';
import { arg, pairsOf, realSquads } from './lib';

const N = Number(arg(0, '200'));
const which = arg(1, 'all');
const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const us = clubSquad(seasons, 'BAR', 2015);
const them = clubSquad(seasons, 'RMA', 2017);
const pct = (a: number, b: number) => ((a / Math.max(1, b)) * 100).toFixed(1).padStart(5) + '%';

for (const p of PRESETS) {
  console.log('\n== ' + p.name + ': kick-off ==');
  for (const sc of SCENARIOS)
    for (const side of [1, -1]) {
      const r = kickOffRow(p, setupAttack(sc, us, them, 'cam' + sc, { side }));
      console.log(
        (sc + (side < 0 ? ' (mirrored)' : '')).padEnd(20),
        'carrier (' + r.carrier.x.toFixed(0) + ',' + r.carrier.y.toFixed(0) + ')' + (r.carrierInBox ? '' : ' OUT OF THE BOX'),
        '| ' + r.widthM.toFixed(1) + ' m across',
        '| mates on screen ' + r.matesOn + '/' + r.mates,
        '| stands ' + (r.stands * 100).toFixed(1) + '%',
        '| goal ' + r.goalPx.toFixed(0) + ' px' + (r.goalIn ? '' : ' (not all on screen)') + ' at ' + r.distGoal.toFixed(0) + ' m, line y ' + r.goalLineY.toFixed(0),
        '| man ' + r.ctrlPx + ' px, smallest ' + r.minPx + ' px, ball ' + r.ballPx + ' px'
      );
    }
}

const pairs = pairsOf(realSquads(), N, 'cam-pairs');
for (const p of which === 'main' ? PRESETS.filter((q) => q.name.startsWith('393') || q.name.startsWith('320')) : PRESETS) {
  console.log('\n== ' + p.name + ': mid-attack, ' + N + ' real-squad autopilot attacks per scenario (60 fps) ==');
  for (const sc of ['build', 'counter', 'wide', 'corner', 'freekick'] as Scenario[]) {
    const m = midAttack(p, sc, pairs, 'cm');
    console.log(
      ('  ' + sc).padEnd(12),
      'frames ' + String(m.frames).padStart(6),
      '| carrier in the safe box ' + pct(m.inBox, m.frames),
      '| goal in frame inside 25 m ' + pct(m.goalIn, m.nearFrames) + ' of ' + m.nearFrames,
      '| zoom changes ' + (m.zoomChanges / Math.max(1e-6, m.seconds)).toFixed(2) + '/s',
      '| tag over a control ' + pct(m.tagHits, m.tagFrames),
      '| stands max ' + (m.standsMax * 100).toFixed(1) + '%',
      '| motion px/frame p50 ' + quantile(m.moves, 0.5).toFixed(1) + ' p99 ' + quantile(m.moves, 0.99).toFixed(1) + ' p99.9 ' + quantile(m.moves, 0.999).toFixed(1) + ' max ' + quantile(m.moves, 1).toFixed(1) + ' over ' + m.switches + ' switches'
    );
  }
}
