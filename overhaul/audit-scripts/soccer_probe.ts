// Audit probe (read-only): stuck balls (attacks that end on the 2-minute hard stop), parries that go
// into the net, and the step cost. Run: cd /home/user/ps-studio && npx vite-node <this file> [n]
import cardsRaw from '/home/user/ps-studio/src/data/cards-soccer.json';
import { decide, pilot } from '/home/user/ps-studio/src/game/soccer2/autopilot';
import { kickOff, setupAttack, step, CLOCK } from '/home/user/ps-studio/src/game/soccer2/engine';
import { clubSquad, soccerLines, type SoccerCardsFile } from '/home/user/ps-studio/src/game/soccer2/ratings';
import type { Scenario, Squad } from '/home/user/ps-studio/src/game/soccer2/types';
import { rng, hashString } from '/home/user/ps-studio/src/engine/rng';

const N = Number(process.argv[2] ?? 2000);
const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const counts = new Map<string, number>();
for (const l of seasons) counts.set(l.fr + '|' + l.season, (counts.get(l.fr + '|' + l.season) ?? 0) + 1);
const squads: Squad[] = [];
for (const [k, n] of counts) {
  if (n < 14) continue;
  const [fr, s] = k.split('|');
  try {
    squads.push(clubSquad(seasons, fr, Number(s)));
  } catch {}
}
const r0 = rng(hashString('probe'));
const SC: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick'];
let stuck = 0;
const stuckWhy: Record<string, number> = {};
let goals = 0;
let parryGoals = 0;
let parries = 0;
let longT = 0;
const tHist: number[] = [];
let steps = 0;
const t0 = process.hrtime.bigint();
const examples: string[] = [];
for (let i = 0; i < N; i++) {
  const sc = SC[i % SC.length];
  const a = setupAttack(sc, squads[Math.floor(r0() * squads.length)], squads[Math.floor(r0() * squads.length)], 'pr' + i, {});
  const pl = pilot(0.68, 'pp' + i);
  kickOff(a);
  let n = 0;
  let lastKey = '';
  let stillSince = -1;
  while (!a.end && n++ < 60 * 200) {
    step(a, 1 / 60, decide(a, pl));
    steps++;
    const sp = Math.hypot(a.ball.vx, a.ball.vy);
    if (a.ball.owner === null && sp < 0.3 && a.ball.h < 0.05) {
      if (stillSince < 0) stillSince = a.t;
    } else stillSince = -1;
  }
  tHist.push(a.t);
  if (a.t > a.clock + 25) {
    longT++;
    const f = a.ball.flight;
    const key = (a.end?.kind ?? '?') + ' flight=' + (f?.kind ?? 'none') + ' owner=' + a.ball.owner + ' sp=' + a.setPiece?.kind;
    stuckWhy[key] = (stuckWhy[key] ?? 0) + 1;
    if (examples.length < 6) examples.push(sc + ' seed pr' + i + ' t=' + a.t.toFixed(1) + ' used=' + a.used.toFixed(1) + ' ' + key + ' ball=(' + a.ball.x.toFixed(1) + ',' + a.ball.y.toFixed(1) + ') still since ' + stillSince.toFixed(1) + ' events: ' + a.events.slice(-6).join(','));
  }
  if (a.end?.kind === 'G') {
    goals++;
    // the last shot-ish event before the goal
    const ev = a.events.filter((e) => ['shot', 'header', 'save-parry', 'post', 'bar', 'block'].includes(e));
    if (ev[ev.length - 1] === 'save-parry') parryGoals++;
  }
  parries += a.events.filter((e) => e === 'save-parry').length;
  void lastKey;
}
const ns = Number(process.hrtime.bigint() - t0);
tHist.sort((a, b) => a - b);
console.log('attacks', N, 'mean step cost', (ns / steps / 1000).toFixed(1), 'us (autopilot+engine)');
console.log('attack length (game s) p50/p90/p99/max', tHist[Math.floor(N * 0.5)].toFixed(1), tHist[Math.floor(N * 0.9)].toFixed(1), tHist[Math.floor(N * 0.99)].toFixed(1), tHist[N - 1].toFixed(1), ' clock', CLOCK);
console.log('attacks longer than clock+25 s of game time:', longT, ((longT / N) * 100).toFixed(2) + '%', JSON.stringify(stuckWhy));
for (const e of examples) console.log('  ', e);
console.log('goals', goals, ' goals whose last shot event was a keeper parry (parried into his own net):', parryGoals, ((parryGoals / Math.max(1, goals)) * 100).toFixed(1) + '%', ' parries', parries);
