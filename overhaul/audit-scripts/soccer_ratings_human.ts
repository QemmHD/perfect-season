// Audit (read-only): do card ratings matter for a person's attacks? The same no-skill strategy
// (sprint at goal, SHOOT at 16 m, no aim, timing sd 0.06 s) with weak vs strong attackers, and the
// frozen-ball rate by scenario.
import { autoplayAttack } from '/home/user/ps-studio/src/game/soccer2/autopilot';
import { GX, kickOff, PL, setupAttack, step, pressShoot, releaseShoot, setSprint, TOP, ctrlOf, ownerOf, setAim, snapAim } from '/home/user/ps-studio/src/game/soccer2/engine';
import type { Pt, Scenario, SoccerPlayer, SoccerPos, Squad } from '/home/user/ps-studio/src/game/soccer2/types';
import { rng, hashString } from '/home/user/ps-studio/src/engine/rng';
const OUT = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
const GKK = ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'];
let uid = 0;
function player(pos: SoccerPos, v: number): SoccerPlayer {
  const keeper = pos === 'GK';
  const a = Object.fromEntries((keeper ? GKK : OUT).map((k) => [k, v]));
  return { id: 'p' + uid++, name: 'P', tag: 'P', num: null, ht: 182, pos, pos2: [pos], ovr: v, a, keeper };
}
const squad = (v: number, gk = v): Squad => ({ name: 'T', abbr: 'T', c1: '#c22', c2: '#fff', gk: player('GK', gk), def: [player('FB', v), player('CB', v), player('CB', v), player('FB', v)], mid: [player('CM', v), player('DM', v), player('CM', v)], fwd: [player('W', v), player('ST', v), player('W', v)] });
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;
function beeline(sc: Scenario, att: Squad, def: Squad, seed: string, r: () => number) {
  const a = setupAttack(sc, att, def, seed, {});
  kickOff(a);
  let hold = -1;
  let n = 0;
  while (!a.end && n++ < 60 * 150) {
    const c = ctrlOf(a);
    const own = ownerOf(a);
    let stick: Pt | null = { x: 0, y: 0 };
    if (a.setPiece && a.taker === c.id && !a.meter && !a.strike) {
      if (pressShoot(a)) {
        hold = a.t + TOP + gauss(r) * 0.06;
        setAim(a, snapAim({ x: r() < 0.5 ? -0.9 : 0.9, y: -0.8 }));
      }
    } else if (own && own.id === c.id) {
      const l = Math.hypot(GX - c.x, PL - 1 - c.y) || 1;
      stick = { x: (GX - c.x) / l, y: (PL - 1 - c.y) / l };
      setSprint(a, a.stamina > 0.08);
      if (!a.meter && hold < 0 && Math.hypot(GX - c.x, PL - c.y) <= 16 && pressShoot(a)) hold = a.t + TOP + gauss(r) * 0.06;
    } else stick = null;
    if (a.meter && hold > 0 && a.t >= hold) {
      releaseShoot(a, null);
      hold = -2;
    }
    step(a, 1 / 60, stick);
  }
  return a.end?.kind ?? 'T';
}
const N = Number(process.argv[2] ?? 300);
console.log('== person, no-skill beeline (sprint, SHOOT at 16 m, no aim), vs a 78-rated defence and keeper ==');
for (const sc of ['counter', 'build', 'wide'] as Scenario[]) {
  const row: string[] = [];
  for (const v of [60, 70, 80, 90, 99]) {
    let g = 0;
    for (let i = 0; i < N; i++) if (beeline(sc, squad(v), squad(78), 'rh' + sc + i, rng(hashString('rr' + sc + v + i))) === 'G') g++;
    row.push('att ' + v + ': ' + ((g / N) * 100).toFixed(1) + '%');
  }
  console.log(sc.padEnd(8), row.join('   '));
}
console.log('== same, attackers 80 vs keeper 55 / 78 / 95 (defence 78) ==');
for (const sc of ['counter', 'build'] as Scenario[]) {
  const row: string[] = [];
  for (const gk of [55, 78, 95]) {
    let g = 0;
    for (let i = 0; i < N; i++) if (beeline(sc, squad(80), squad(78, gk), 'rk' + sc + i, rng(hashString('rk' + sc + gk + i))) === 'G') g++;
    row.push('gk ' + gk + ': ' + ((g / N) * 100).toFixed(1) + '%');
  }
  console.log(sc.padEnd(8), row.join('   '));
}
console.log('== the autopilot (0.68) for comparison, att 60 / 80 / 99 vs 78 ==');
for (const sc of ['counter', 'build'] as Scenario[]) {
  const row: string[] = [];
  for (const v of [60, 80, 99]) {
    let g = 0;
    for (let i = 0; i < N; i++) if (autoplayAttack(setupAttack(sc, squad(v), squad(78), 'ra' + sc + i, {}), 0.68, 'pa' + i).end?.kind === 'G') g++;
    row.push('att ' + v + ': ' + ((g / N) * 100).toFixed(1) + '%');
  }
  console.log(sc.padEnd(8), row.join('   '));
}
// frozen ball by scenario (autopilot 0.68, real-ish synthetic 75 v 75)
console.log('== attacks that end on the 120 s hard stop with a dead "shot" (autopilot 0.68, 75 v 75) ==');
for (const sc of ['build', 'counter', 'wide', 'corner', 'freekick'] as Scenario[]) {
  let stuck = 0;
  const M = N * 3;
  for (let i = 0; i < M; i++) {
    const a = autoplayAttack(setupAttack(sc, squad(75), squad(75), 'st' + sc + i, {}), 0.68, 'ps' + i);
    if (a.t > a.clock + 60 && a.ball.flight?.kind === 'shot') stuck++;
  }
  console.log(sc.padEnd(8), stuck + ' of ' + M, ((stuck / M) * 100).toFixed(2) + '%');
}
