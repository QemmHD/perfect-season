// Do card ratings matter for a person's attacks? (studio overhaul soccer-1, ported from the
// 2026-11-09 audit's soccer_ratings_human.ts, same seeds.) The same no-skill run (sprint at goal,
// SHOOT at 16 m, no aim, timing sd 0.06 s) with attackers rated 60-99 against a 78 defence, a
// PAC-only row (only pace moves, every other stat 78), the keeper's effect, the autopilot for
// comparison, and the dead-shot rate by scenario.
//   bash O/heavy.sh npx vite-node scripts/soccer/ratings-human.ts [n=300]
import { autoplayAttack } from '../../src/game/soccer2/autopilot';
import { setupAttack } from '../../src/game/soccer2/engine';
import { hashString, rng } from '../../src/engine/rng';
import type { Scenario, Squad } from '../../src/game/soccer2/types';
import { arg, beeline, squad, type Strat } from './lib';

const N = Number(arg(0, '300'));
const RUN: Strat = { name: 'beeline', shootAt: 16, drag: false, sd: 0.06, sprint: true, setPiece: 'low' };
const goalRate = (n: number, f: (i: number) => string) => {
  let g = 0;
  for (let i = 0; i < n; i++) if (f(i) === 'G') g++;
  return ((g / n) * 100).toFixed(1) + '%';
};
const run = (sc: Scenario, att: Squad, def: Squad, seed: string, r: () => number) => beeline(setupAttack(sc, att, def, seed, {}), RUN, r).end?.kind ?? 'T';
const VS = [60, 70, 80, 90, 99];

console.log('== person, no-skill beeline (sprint, SHOOT at 16 m, no aim), vs a 78-rated defence and keeper ==');
for (const sc of ['counter', 'build', 'wide'] as Scenario[])
  console.log(sc.padEnd(8), VS.map((v) => 'att ' + v + ': ' + goalRate(N, (i) => run(sc, squad(v), squad(78), 'rh' + sc + i, rng(hashString('rr' + sc + v + i))))).join('   '));
console.log('== PAC only: the same run, every attacker stat 78 except PAC (60-99), vs 78 ==');
for (const sc of ['counter', 'build', 'wide'] as Scenario[])
  console.log(sc.padEnd(8), VS.map((v) => 'PAC ' + v + ': ' + goalRate(N, (i) => run(sc, squad(78, 78, { PAC: v }), squad(78), 'rh' + sc + i, rng(hashString('rr' + sc + v + i))))).join('   '));
console.log('== same, attackers 80 vs keeper 55 / 78 / 95 (defence 78) ==');
for (const sc of ['counter', 'build'] as Scenario[])
  console.log(sc.padEnd(8), [55, 78, 95].map((gk) => 'gk ' + gk + ': ' + goalRate(N, (i) => run(sc, squad(80), squad(78, gk), 'rk' + sc + i, rng(hashString('rk' + sc + gk + i))))).join('   '));
console.log('== the autopilot (0.68) for comparison, att 60 / 80 / 99 vs 78 ==');
for (const sc of ['counter', 'build'] as Scenario[])
  console.log(sc.padEnd(8), [60, 80, 99].map((v) => 'att ' + v + ': ' + goalRate(N, (i) => autoplayAttack(setupAttack(sc, squad(v), squad(78), 'ra' + sc + i, {}), 0.68, 'pa' + i).end?.kind ?? 'T')).join('   '));
console.log('== attacks still going past the clock + 15 s, or on the 120 s hard stop with a dead "shot" (autopilot 0.68, 75 v 75) ==');
for (const sc of ['build', 'counter', 'wide', 'corner', 'freekick'] as Scenario[]) {
  let over = 0;
  let stuck = 0;
  const M = N * 3;
  for (let i = 0; i < M; i++) {
    const a = autoplayAttack(setupAttack(sc, squad(75), squad(75), 'st' + sc + i, {}), 0.68, 'ps' + i);
    if (a.t > a.clock + 15) over++;
    if (a.t > a.clock + 60 && a.ball.flight?.kind === 'shot') stuck++;
  }
  console.log(sc.padEnd(8), 'over clock+15: ' + over + ' of ' + M, '  dead shot: ' + stuck + ' of ' + M, ((stuck / M) * 100).toFixed(2) + '%');
}
