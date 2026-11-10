// Which way does a free kick bend for each BEND button? (studio overhaul soccer-1, ported from the
// 2026-11-09 audit's soccer_bend.ts.) A 99-rated taker aimed at the middle of the goal, struck on the
// green, with every defender (the wall, the markers and the keeper) moved off the ball's line, so all
// 40 kicks per button reach the goal line (the audit's run let the keeper and the markers stop most of
// them: n 11 / 3 / 24); the mean of (where it crosses the line − where it was aimed). + is to the right
// on screen (x across the pitch, as the portrait camera looks up it).
//   bash O/heavy.sh npx vite-node scripts/soccer/bend.ts
import { kickOff, PL, pressShoot, releaseShoot, setAim, setCurl, setupAttack, step, TOP } from '../../src/game/soccer2/engine';
import { player, squad } from './lib';

/** the BEND buttons' curl, as Soccer2.tsx's handler sets it (setCurl(a, k * 0.75)) */
const button = (k: number) => k * 0.75;
for (const k of [-1, 0, 1]) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < 40; i++) {
    const att = squad(99);
    const def = squad(60);
    def.gk = player('GK', 40);
    const a = setupAttack('freekick', att, def, 'bend' + i, { side: 1 });
    for (const b of a.bodies)
      if (b.side === 'D') {
        b.x = b.role === 'gk' ? 0.5 : 1;
        b.y = b.role === 'gk' ? PL - 0.3 : 60;
        b.home = { x: b.x, y: b.y };
      }
    kickOff(a);
    setCurl(a, button(k));
    pressShoot(a);
    setAim(a, { x: 0, y: 0 });
    for (let j = 0; j < Math.round(TOP * 60); j++) step(a, 1 / 60, { x: 0, y: 0 });
    releaseShoot(a, { x: 0, y: 0 });
    for (let j = 0; j < 400 && !a.end; j++) step(a, 1 / 60, { x: 0, y: 0 });
    const s = a.lastShot;
    if (s?.cross) {
      sum += s.cross.x - s.aim.x;
      n++;
    }
  }
  const label = k < 0 ? 'Bend left (left arrow)' : k > 0 ? 'Bend right (right arrow)' : 'STRAIGHT';
  console.log(('BEND ' + label).padEnd(32), 'curl ' + button(k).toFixed(2).padStart(5), ' mean (crossing x − aimed x) ' + (sum / Math.max(1, n)).toFixed(2).padStart(6) + ' m over ' + n + ' kicks (+ = right)');
}
