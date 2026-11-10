// AUDIT ONLY: per-game scoring concentration from the engine's own box (points by slot).
import { getPool } from '/home/user/ps-studio/src/ut/pool';
import { aiOpponent } from '/home/user/ps-studio/src/ut/battles';
import { fiveOfSquad, squadFromWire } from '/home/user/ps-studio/src/ut/teams';
import { autoplay } from '/home/user/ps-studio/src/game/hoops2/autopilot';
import { newHoopsGame } from '/home/user/ps-studio/src/game/hoops2/game';
it('concentration', async () => {
  const pool = await getPool();
  let share = 0, n = 0, shooters = 0, starShare = 0;
  const dist: number[] = [];
  for (let i = 0; i < 60; i++) {
    const A = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 78, 'c' + (i % 15)).squad));
    const B = fiveOfSquad(squadFromWire(pool, aiOpponent(pool, 78, 'd' + (i % 15)).squad));
    const g = autoplay(newHoopsGame(A.five, B.five, 'conc' + i), 0.68, 'cp' + i);
    if (!g.score) continue;
    const mx = Math.max(...g.box);
    share += mx / g.score; n++;
    shooters += g.box.filter((x) => x > 0).length;
    const star = A.five.map((h, k) => [h.ovr, k]).sort((a, b) => b[0] - a[0])[0][1];
    starShare += g.box[star] / g.score;
    dist.push(+(mx / g.score).toFixed(2));
  }
  console.log('games', n, 'avg top-scorer share', (share / n).toFixed(3), 'avg players who scored', (shooters / n).toFixed(2), 'star (top ovr) share', (starShare / n).toFixed(3), 'sample', dist.slice(0, 20).join(','));
}, 600000);
