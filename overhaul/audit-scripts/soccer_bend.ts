// Audit probe (read-only): which way does the free kick bend for each BEND button value?
import { GX, kickOff, PL, setupAttack, step, pressShoot, releaseShoot, setAim, setCurl, TOP } from '/home/user/ps-studio/src/game/soccer2/engine';
import type { SoccerPlayer, SoccerPos, Squad } from '/home/user/ps-studio/src/game/soccer2/types';
const OUT = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
const GKK = ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'];
let uid = 0;
const P = (pos: SoccerPos, v: number): SoccerPlayer => ({ id: 'p' + uid++, name: 'P', tag: 'P', num: null, ht: 182, pos, pos2: [pos], ovr: v, a: Object.fromEntries((pos === 'GK' ? GKK : OUT).map((k) => [k, v])), keeper: pos === 'GK' });
const S = (v: number): Squad => ({ name: 'T', abbr: 'T', c1: '#c22', c2: '#fff', gk: P('GK', 40), def: [P('FB', v), P('CB', v), P('CB', v), P('FB', v)], mid: [P('CM', v), P('DM', v), P('CM', v)], fwd: [P('W', v), P('ST', v), P('W', v)] });
for (const k of [-1, 0, 1]) {
  let sum = 0, n = 0;
  for (let i = 0; i < 40; i++) {
    const a = setupAttack('freekick', S(99), S(60), 'bend' + i, { side: 1 });
    // move the wall out of the way: we only want the ball's path
    for (const b of a.bodies) if (b.act === 'wall') { b.x = 1; b.y = 60; }
    kickOff(a);
    setCurl(a, k * 0.75);
    pressShoot(a);
    setAim(a, { x: 0, y: 0 });
    for (let j = 0; j < Math.round(TOP * 60); j++) step(a, 1 / 60, { x: 0, y: 0 });
    releaseShoot(a, { x: 0, y: 0 });
    let x0 = 0, xs: number[] = [];
    for (let j = 0; j < 400 && !a.end; j++) { step(a, 1 / 60, { x: 0, y: 0 }); if (a.ball.flight?.kind === 'shot') xs.push(a.ball.x); }
    const s = a.lastShot;
    if (s?.cross) { sum += s.cross.x - s.aim.x; n++; }
    else if (xs.length > 5) { /* use the path's sideways drift beyond a straight line */ }
  }
  console.log('BEND button k=' + k + ' (' + (k < 0 ? 'left arrow, aria "Bend left"' : k > 0 ? 'right arrow, aria "Bend right"' : 'STRAIGHT') + '): mean (crossing x - aimed x) = ' + (sum / Math.max(1, n)).toFixed(2) + ' m over ' + n + ' kicks (+ = to the RIGHT on screen)');
}
