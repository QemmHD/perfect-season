// Scripted person strategies on the real engine (studio overhaul soccer-1, ported from the
// 2026-11-09 audit's soccer_human.ts, same seeds): the no-skill beelines (sprint at goal, SHOOT at
// 12-30 m, aim assist or a drag), a jog, a weave, against the Pro and Legend autopilot on the same
// attacks; then penalties and free kicks taken by a person. Finds dominant strategies and exploits.
//   bash O/heavy.sh npx vite-node scripts/soccer/human.ts [n=200]
import { autoplayAttack } from '../../src/game/soccer2/autopilot';
import { GX, setupAttack } from '../../src/game/soccer2/engine';
import { hashString, rng } from '../../src/engine/rng';
import type { Pt, Scenario } from '../../src/game/soccer2/types';
import { arg, beeline, pairsOf, realSquads, setPieceHuman, tally, type Strat } from './lib';

const N = Number(arg(0, '200'));
const pairs = pairsOf(realSquads(), N, 'human-pairs');

const STRATS: Strat[] = [
  { name: 'beeline sprint, shoot@12m assist', shootAt: 12, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@16m assist', shootAt: 16, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@20m assist', shootAt: 20, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@25m assist', shootAt: 25, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@30m assist', shootAt: 30, drag: false, sd: 0.06, sprint: true },
  { name: 'beeline sprint, shoot@20m drag', shootAt: 20, drag: true, sd: 0.06, sprint: true },
  { name: 'beeline jog, shoot@16m assist', shootAt: 16, drag: false, sd: 0.06, sprint: false },
  { name: 'weave sprint, shoot@16m assist', shootAt: 16, drag: false, sd: 0.06, sprint: true, weave: true },
];
for (const dq of [0, 1]) {
  console.log('\n=== defIQ ' + dq + ' (n=' + N + ' per row, random real club-season matchups) ===');
  for (const sc of ['build', 'counter', 'wide'] as Scenario[]) {
    for (const st of STRATS) tally(sc + ' | ' + st.name, N, (i) => beeline(setupAttack(sc, pairs[i][0], pairs[i][1], 'h' + sc + i, { defIQ: dq }), st, rng(hashString('hr' + i + st.name))));
    tally(sc + ' | autopilot 0.68 (Pro AI)', N, (i) => autoplayAttack(setupAttack(sc, pairs[i][0], pairs[i][1], 'h' + sc + i, { defIQ: dq }), 0.68, 'p' + i));
    tally(sc + ' | autopilot 0.88 (Legend AI)', N, (i) => autoplayAttack(setupAttack(sc, pairs[i][0], pairs[i][1], 'h' + sc + i, { defIQ: dq }), 0.88, 'p' + i));
  }
}
console.log('\n=== set pieces by a person (sd 0.06 s), defIQ 0 ===');
for (const [lab, aim] of [
  ['pen low corner', { x: 0.95, y: -0.85 }],
  ['pen high corner', { x: 0.95, y: 0.85 }],
  ['pen centre', { x: 0, y: 0 }],
] as [string, Pt][])
  tally('penalty | ' + lab, N, (i) => setPieceHuman(setupAttack('penalty', pairs[i][0], pairs[i][1], 'hp' + i, {}), aim, 0.06, rng(hashString('pp' + lab + i))));
tally('penalty | autopilot 0.75', N, (i) => autoplayAttack(setupAttack('penalty', pairs[i][0], pairs[i][1], 'hp' + i, {}), 0.75, 'pp' + i));
// a free kick at the far top corner, bent back in with the BEND button that points toward the goal
// (far post on the right: the left arrow, k = -1), as Soccer2.tsx's handler turns it into curl
/** the BEND buttons' curl, as Soccer2.tsx's handler sets it (setCurl(a, k * 0.75)) */
const bendButton = (k: number) => k * 0.75;
// (the seed keys are the audit's row names, so the rows replay its kicks)
for (const [lab, key, aim, bend] of [
  ['fk far top + BEND toward goal', 'fk far top + bend', { x: 0.9, y: 0.8 }, true],
  ['fk far top no bend', 'fk far top no bend', { x: 0.9, y: 0.8 }, false],
  ['fk near low', 'fk near low', { x: -0.9, y: -0.8 }, false],
] as [string, string, Pt, boolean][])
  tally('freekick | ' + lab, N, (i) => {
    const a = setupAttack('freekick', pairs[i][0], pairs[i][1], 'hf' + i, { side: 1 });
    const far = a.setPiece!.spot.x < GX ? 1 : -1;
    return setPieceHuman(a, { x: aim.x * far, y: aim.y }, 0.06, rng(hashString('ff' + key + i)), bend ? bendButton(-far) : 0);
  });
tally('freekick | autopilot 0.75', N, (i) => autoplayAttack(setupAttack('freekick', pairs[i][0], pairs[i][1], 'hf' + i, { side: 1 }), 0.75, 'pf' + i));
