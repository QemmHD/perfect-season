// Rule probe (studio overhaul soccer-1, ported from the 2026-11-09 audit's soccer_probe.ts, same
// seeds): over n real-squad autopilot attacks (build, counter, wide, corner, free kick in turn) it
// counts frozen balls (an attack on the 120 s hard stop, or a dead loose ball nobody plays for 5 s
// of game time), attacks still going past the clock + 15 s, goals straight from a keeper's parry,
// goals from a rebound (a parry, the woodwork or a block earlier in the attack), and the step cost.
//   bash O/heavy.sh npx vite-node scripts/soccer/probe.ts [n=3000]
import { decide, pilot } from '../../src/game/soccer2/autopilot';
import { CLOCK, kickOff, setupAttack, step } from '../../src/game/soccer2/engine';
import { hashString, rng } from '../../src/engine/rng';
import type { Scenario } from '../../src/game/soccer2/types';
import { arg, realSquads } from './lib';

const N = Number(arg(0, '3000'));
const squads = realSquads();
const r0 = rng(hashString('probe'));
const SC: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick'];
const HARD = (clock: number) => clock * 3 + 30;
let hardStops = 0;
let deadBalls = 0;
let overClock = 0;
const why: Record<string, number> = {};
let goals = 0;
let parryGoals = 0;
let reboundGoals = 0;
let parries = 0;
const tHist: number[] = [];
let steps = 0;
const examples: string[] = [];
const t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) {
  const sc = SC[i % SC.length];
  const a = setupAttack(sc, squads[Math.floor(r0() * squads.length)], squads[Math.floor(r0() * squads.length)], 'pr' + i, {});
  const pl = pilot(0.68, 'pp' + i);
  kickOff(a);
  let n = 0;
  let stillSince = -1;
  let longestStill = 0;
  while (!a.end && n++ < 60 * 200) {
    step(a, 1 / 60, decide(a, pl));
    steps++;
    const b = a.ball;
    if (b.owner === null && !a.setPiece && Math.hypot(b.vx, b.vy) < 0.3 && b.h < 0.05) {
      if (stillSince < 0) stillSince = a.t;
      longestStill = Math.max(longestStill, a.t - stillSince);
    } else stillSince = -1;
  }
  tHist.push(a.t);
  const hard = a.t >= HARD(a.clock) - 1e-9;
  if (hard) hardStops++;
  if (longestStill >= 5) deadBalls++;
  if (a.t > a.clock + 15) {
    overClock++;
    const f = a.ball.flight;
    const key = (a.end?.kind ?? '?') + ' flight=' + (f?.kind ?? 'none') + ' owner=' + a.ball.owner;
    why[key] = (why[key] ?? 0) + 1;
    if (examples.length < 6) examples.push(sc + ' seed pr' + i + ' t=' + a.t.toFixed(1) + ' used=' + a.used.toFixed(1) + ' ' + key + ' ball=(' + a.ball.x.toFixed(1) + ',' + a.ball.y.toFixed(1) + ') still ' + longestStill.toFixed(1) + 's, events: ' + a.events.slice(-6).join(','));
  }
  const shotish = a.events.filter((e) => ['shot', 'header', 'save-parry', 'post', 'bar', 'block'].includes(e));
  if (a.end?.kind === 'G') {
    goals++;
    if (shotish[shotish.length - 1] === 'save-parry') parryGoals++;
    if (shotish.slice(0, -1).some((e) => e === 'save-parry' || e === 'post' || e === 'bar' || e === 'block')) reboundGoals++;
  }
  parries += a.events.filter((e) => e === 'save-parry').length;
}
const ns = Number(process.hrtime.bigint() - t0);
tHist.sort((p, q) => p - q);
const pc = (a: number, b: number) => ((a / Math.max(1, b)) * 100).toFixed(2) + '%';
console.log('attacks', N, ' mean step cost', (ns / steps / 1000).toFixed(1), 'us (autopilot + engine)');
console.log('attack length (game s) p50/p90/p99/max', [0.5, 0.9, 0.99].map((q) => tHist[Math.floor(N * q)].toFixed(1)).join(' / '), '/', tHist[N - 1].toFixed(1), ' clock', CLOCK);
console.log('frozen balls: on the 120 s hard stop', hardStops, pc(hardStops, N), ' | a dead loose ball for 5 s+', deadBalls, pc(deadBalls, N));
console.log('attacks over clock + 15 s of game time:', overClock, pc(overClock, N), JSON.stringify(why));
for (const e of examples) console.log('  ', e);
console.log('goals', goals, ' straight from a keeper parry (into his own net):', parryGoals, pc(parryGoals, goals), ' after a rebound (parry, woodwork, block):', reboundGoals, pc(reboundGoals, goals), ' parries', parries);
