// AUDIT ONLY. How ratings, timing, contest and difficulty map to make chances in hoops2.
import { writeFileSync } from 'node:fs';
import { greenWindow, releaseProbability, newPossession, contestOf, shotChance, freeThrow, RIM, step, pressShoot, releaseShoot } from '/home/user/ps-studio/src/game/hoops2/engine';
import type { Contest, Hooper, Possession } from '/home/user/ps-studio/src/game/hoops2/types';
import { rng } from '/home/user/ps-studio/src/engine/rng';

const OUT = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/nba-curve.json';

function man(v: number, extra: Partial<Hooper> = {}): Hooper {
  return { id: 'x' + v, name: 'X ' + v, tag: 'X', num: 1, ht: 78, wt: 215, pos: 'SG', ovr: v, spd: 75, acc: 75, hnd: 75, pas: 75, thr: v, mid: v, cls: v, lay: v, ft: v, ddk: 70, sdk: 60, str: 70, vrt: 70, sta: 80, prd: 75, ind: 70, stl: 70, blk: 60, reb: 60, abil: [], ...extra };
}
const five = (h: Hooper) => [h, man(75), man(75), man(75), man(75)];

function poss(shooter: Hooper, defIQ: number): Possession {
  const p = newPossession(five(shooter), five(man(75)), [1, 1, 1, 1, 1], rng(1), defIQ);
  const b = p.bodies[0];
  b.cx = RIM.cx - 24.5;
  b.cz = 0;
  b.vx = b.vz = 0;
  // park the defenders far away
  for (const d of p.bodies) if (d.side === 'D') { d.cx = -5; d.cz = 20; }
  for (const o of p.bodies) if (o.side === 'O' && o !== b) { o.cx = 5; o.cz = -20; }
  return p;
}

it('rating -> outcome curve', () => {
  const out: Record<string, unknown> = {};
  const contests: Contest[] = ['open', 'light', 'heavy', 'smothered'];
  const offs = [0, 0.01, 0.02, 0.03, 0.04, 0.06, 0.08, 0.12, 0.2];
  const rows: string[] = [];
  for (const defIQ of [-0.5, 0, 1]) {
    for (const r of [50, 60, 70, 75, 80, 85, 90, 95, 99]) {
      const p = poss(man(r), defIQ);
      const b = p.bodies[0];
      for (const c of contests) {
        const g = greenWindow(p, b, 'three', c);
        const probs = offs.map((o) => releaseProbability(p, b, 'three', c, o, g));
        rows.push(`def${defIQ} thr${r} ${c.padEnd(9)} greenHalf=${(g * 1000).toFixed(1)}ms  P(off ms ${offs.map((o) => o * 1000).join('/')}) = ${probs.map((x) => (x * 100).toFixed(0)).join('/')}`);
        (out[`def${defIQ}`] ??= {} as Record<string, unknown>) as Record<string, unknown>;
        ((out[`def${defIQ}`] as Record<string, unknown>)[`thr${r}_${c}`] = { greenHalfMs: +(g * 1000).toFixed(1), p: probs.map((x) => +x.toFixed(3)) });
      }
    }
  }
  // live % shown vs what a perfect release gets (open three, def 0)
  const live: string[] = [];
  for (const r of [50, 60, 70, 75, 80, 90, 99]) {
    const p = poss(man(r), 0);
    live.push(`thr${r}: live% shown=${(shotChance(p, p.bodies[0]) * 100).toFixed(0)} contest=${contestOf(p, p.bodies[0])}`);
  }
  // timing quantisation: a human release exactly 0 ms off, but the press/release land between 60 Hz steps
  const quant: string[] = [];
  for (const r of [60, 75, 90]) {
    let greens = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const p = poss(man(r), 0);
      // step once so the meter can start
      step(p, 1 / 60, null);
      p.events.length = 0;
      // phase of the press inside the frame (0..1 of a step): the sim time used is the last step's
      const phase = (i + 0.5) / N;
      const truePress = p.t + phase / 60;
      pressShoot(p);
      const top = p.meter!.top;
      const trueRelease = truePress + top + 0.03; // a perfect human release, plus the 30 ms the game subtracts
      while (p.t + 1 / 60 <= trueRelease) step(p, 1 / 60, null);
      releaseShoot(p, 0.03);
      if (p.lastShot?.greened || p.meter?.greened) greens++;
    }
    quant.push(`thr${r}: perfectly timed human release greens ${((greens / N) * 100).toFixed(0)}% of the time (60 Hz step quantisation)`);
  }
  const ft = [40, 60, 75, 85, 95].map((v) => `FT${v}=${(freeThrow(man(v, { ft: v })) * 100).toFixed(0)}%`);
  console.log(rows.join('\n'));
  console.log(live.join('\n'));
  console.log(quant.join('\n'));
  console.log(ft.join(' '));
  out.live = live;
  out.quant = quant;
  out.ft = ft;
  writeFileSync(OUT, JSON.stringify(out, null, 1));
});
