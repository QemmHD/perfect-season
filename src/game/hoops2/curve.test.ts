// How ratings, timing, contest and difficulty map to make chances (Claude 2026-11-16; opt-in):
//   NBA_CURVE=1 npx vitest run src/game/hoops2/curve.test.ts
// Ported from the audit's nba-curve harness, plus the numbers plan §3.3 (the V2 gold ring) is
// measured against: today's green half-width for an open set shot by three-point rating, and the
// green ("gold") rate and make rate a person gets at a release spread of σ 50 ms (the median human)
// and σ 35 ms (a skilled one), by contest. Writes JSON to $NBA_CURVE_OUT (default: the OS temp dir;
// never committed) and prints the §3.3 rows against targets.ts. Reports only: nba-4 asserts.
import { rng } from '../../engine/rng';
import { contestOf, freeThrow, greenWindow, newPossession, pressShoot, releaseProbability, releaseShoot, RIM, shotChance, step } from './engine';
import { env, MEDIAN_SD, outPath, SKILLED_SD, writeOut } from './harness';
import { THR_AVG, TARGETS, within } from './targets';
import type { Body, Contest, Hooper, Possession } from './types';

const run = env.NBA_CURVE ? it : it.skip;
const OUT = outPath(env.NBA_CURVE_OUT, 'nba-curve.json');

function man(v: number, extra: Partial<Hooper> = {}): Hooper {
  return { id: 'x' + v, name: 'X ' + v, tag: 'X', num: 1, ht: 78, wt: 215, pos: 'SG', ovr: v, spd: 75, acc: 75, hnd: 75, pas: 75, thr: v, mid: v, cls: v, lay: v, ft: v, ddk: 70, sdk: 60, str: 70, vrt: 70, sta: 80, prd: 75, ind: 70, stl: 70, blk: 60, reb: 60, abil: [], ...extra };
}
const five = (h: Hooper) => [h, man(75), man(75), man(75), man(75)];

/** An open shooter at the top of the arc (24.5 ft), the defense parked far away. */
function poss(shooter: Hooper, defIQ: number): Possession {
  const p = newPossession(five(shooter), five(man(75)), [1, 1, 1, 1, 1], rng(1), defIQ);
  const b = p.bodies[0];
  b.cx = RIM.cx - 24.5;
  b.cz = 0;
  b.vx = b.vz = 0;
  for (const d of p.bodies) if (d.side === 'D') Object.assign(d, { cx: -5, cz: 20 });
  for (const o of p.bodies) if (o.side === 'O' && o !== b) Object.assign(o, { cx: 5, cz: -20 });
  return p;
}

/** The shooter's situation: a set shot, a rhythm catch (shot right off the catch), or a pull-up on the move. */
type Look = 'set' | 'rhythm' | 'pullup';
function setLook(p: Possession, b: Body, look: Look) {
  b.lastCatchAt = look === 'rhythm' ? p.t : undefined;
  b.vx = look === 'pullup' ? 10 : 0;
  b.vz = 0;
}

/**
 * A person's numbers on one shot: the green (gold) rate, P(|error| ≤ half-width), and the make
 * rate, ∫ P(make | off) φ(off; σ) d off, on a 0.5 ms grid out to ±5σ.
 */
function expected(p: Possession, b: Body, contest: Contest, sd: number): { half: number; gold: number; make: number } {
  const half = greenWindow(p, b, 'three', contest);
  let gold = 0;
  let make = 0;
  let mass = 0;
  const h = 0.0005;
  for (let off = -5 * sd; off <= 5 * sd + 1e-12; off += h) {
    const w = Math.exp(-(off * off) / (2 * sd * sd));
    mass += w;
    // a green release goes in at the contest's perfect cap; outside it, the timing curve
    make += w * releaseProbability(p, b, 'three', contest, off, half);
    if (Math.abs(off) <= half) gold += w;
  }
  return { half, gold: gold / mass, make: make / mass };
}

const ms = (s: number) => +(s * 1000).toFixed(1);
const pct = (x: number) => +x.toFixed(3);

run('rating, timing, contest and difficulty -> make chance', async () => {
  const out: Record<string, unknown> = {};
  const contests: Contest[] = ['open', 'light', 'heavy', 'smothered'];
  const offs = [0, 0.01, 0.02, 0.03, 0.04, 0.06, 0.08, 0.12, 0.2];
  // the audit's grid: half-width and P(make) at fixed offsets, by difficulty (the UT rungs' def IQ)
  const rows: string[] = [];
  const grid: Record<string, Record<string, unknown>> = {};
  for (const defIQ of [-0.5, 0, 0.5, 1]) {
    for (const r of [50, 60, 70, 75, 80, 85, 90, 95, 99]) {
      const p = poss(man(r), defIQ);
      const b = p.bodies[0];
      for (const c of contests) {
        const g = greenWindow(p, b, 'three', c);
        const probs = offs.map((o) => releaseProbability(p, b, 'three', c, o, g));
        rows.push(`def${defIQ} thr${r} ${c.padEnd(9)} greenHalf=${ms(g)}ms  P(off ms ${offs.map((o) => o * 1000).join('/')}) = ${probs.map((x) => (x * 100).toFixed(0)).join('/')}`);
        (grid[`def${defIQ}`] ??= {})[`thr${r}_${c}`] = { greenHalfMs: ms(g), p: probs.map(pct) };
      }
    }
  }
  out.grid = grid;

  // plan §3.3 today: gold half-widths (open set shot, Pro, fresh) and the person's numbers
  const v2: Record<string, number> = {};
  for (const thr of [55, THR_AVG, 85, 95, 99]) {
    const key = thr === THR_AVG ? 'thrAvg' : 'thr' + thr;
    const p = poss(man(thr), 0);
    const b = p.bodies[0];
    setLook(p, b, 'set');
    v2[`gold.${key}.half`] = ms(greenWindow(p, b, 'three', 'open'));
    setLook(p, b, 'rhythm');
    v2[`gold.${key}.rhythmHalf`] = ms(greenWindow(p, b, 'three', 'open'));
  }
  const person: Record<string, Record<string, number>> = {};
  const cases: [string, number, Contest, Look][] = [
    ['thr55.open', 55, 'open', 'set'],
    ['thrAvg.open', THR_AVG, 'open', 'set'],
    ['thr95.open', 95, 'open', 'set'],
    ['thrAvg.light', THR_AVG, 'light', 'set'],
    ['thrAvg.heavy', THR_AVG, 'heavy', 'set'],
    ['thrAvg.smothered', THR_AVG, 'smothered', 'set'],
    ['thrAvg.open.rhythm', THR_AVG, 'open', 'rhythm'],
    ['thrAvg.open.pullup', THR_AVG, 'open', 'pullup'],
  ];
  for (const [name, thr, c, look] of cases) {
    const p = poss(man(thr), 0);
    const b = p.bodies[0];
    setLook(p, b, look);
    const at50 = expected(p, b, c, MEDIAN_SD);
    const at35 = expected(p, b, c, SKILLED_SD);
    person[name] = { halfMs: ms(at50.half), gold50: pct(at50.gold), make50: pct(at50.make), gold35: pct(at35.gold), make35: pct(at35.make) };
    v2[`goldRate.${name}.sd50`] = pct(at50.gold);
    v2[`make.${name}.sd50`] = pct(at50.make);
    v2[`make.${name}.sd35`] = pct(at35.make);
    v2[`make.${name}.overGold`] = pct(at50.make - at50.gold);
  }
  v2['make.pullupRatio'] = pct(person['thrAvg.open.pullup'].make50 / person['thrAvg.open'].make50);
  out.v2 = v2;
  out.person = person;

  // the live % the HUD shows over an open shooter, and the contest it reads
  const live: string[] = [];
  for (const r of [50, 60, 70, 75, 80, 90, 99]) {
    const p = poss(man(r), 0);
    live.push(`thr${r}: live% shown=${(shotChance(p, p.bodies[0]) * 100).toFixed(0)} contest=${contestOf(p, p.bodies[0])}`);
  }
  out.live = live;

  // timing quantisation: a release exactly on the green's centre, pressed and let go between two
  // 60 Hz steps, as today's loop delivers it (the release lands on the next step)
  const quant: Record<string, number> = {};
  for (const r of [60, 75, 90]) {
    let greens = 0;
    let worst = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const p = poss(man(r), 0);
      step(p, 1 / 60, null);
      p.events.length = 0;
      const phase = (i + 0.5) / N;
      const truePress = p.t - phase / 60;
      pressShoot(p);
      const m = p.meter!;
      // a perfect person lets go exactly `top` after his real press; the loop sees it at the next step
      const trueRelease = truePress + m.top;
      while (p.t < trueRelease - 1e-9) step(p, 1 / 60, null);
      worst = Math.max(worst, Math.abs(p.t - m.t0 - m.top));
      releaseShoot(p);
      if (p.meter?.greened || p.lastShot?.greened) greens++;
    }
    quant[`thr${r}.greenPct`] = pct(greens / N);
    quant[`thr${r}.worstOffMs`] = ms(worst);
  }
  out.quant = quant;
  const ft = Object.fromEntries([40, 60, 75, 85, 95].map((v) => [`ft${v}`, pct(freeThrow(man(v, { ft: v })))]));
  out.ft = ft;

  const report = [rows.join('\n'), live.join('\n'), JSON.stringify(quant), JSON.stringify(ft), '\n§3.3 today (open set shot unless named, Pro, fresh; σ 50 / σ 35 ms):'];
  for (const [k, v] of Object.entries(person)) report.push(`  ${k.padEnd(22)} half ${String(v.halfMs).padStart(5)} ms  gold ${v.gold50} / ${v.gold35}  make ${v.make50} / ${v.make35}`);
  report.push(`  pull-up make ÷ set make (σ 50): ${v2['make.pullupRatio']}`);
  for (const row of TARGETS.filter((x) => x.section === '3.3')) {
    const v = v2[row.key];
    if (v === undefined) continue;
    report.push(`${within(row, v) ? '  ' : '!!'} ${row.label.padEnd(58)} ${String(v).padStart(7)}  band ${row.lo}–${row.hi}`);
  }
  await writeOut(OUT, JSON.stringify(out, null, 1));
  console.log(report.join('\n') + `\n\nJSON: ${OUT}`);
});
