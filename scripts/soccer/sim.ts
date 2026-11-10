// Whole matches, AI against AI (studio overhaul soccer-1, ported from the 2026-11-09 audit's
// soccer_sim.ts + soccer_table.cjs, same seeds): the real engine and autopilot on random pairs of
// the 1,714 real club-season elevens, every shot logged (distance, kind, result) and every attack's
// end. Prints the plan's §2 table per level, a summary across levels, and with `gap` the autopilot's
// per-attack goal rate against a rating gap. JSON only when SOCCER_OUT=<path> is set.
//   bash O/heavy.sh npx vite-node scripts/soccer/sim.ts [matches=400] [rookie|pro|legend|sim0.6|all|gap]
import { writeFileSync } from 'node:fs';
import { decide, pilot } from '../../src/game/soccer2/autopilot';
import { CLOCK, GX, inBox, kickOff, PL, setupAttack, step, STOPPAGE_CLOCK } from '../../src/game/soccer2/engine';
import { ATTACKS, dealOf, STOPPAGE } from '../../src/game/soccer2/match';
import { squadOvr } from '../../src/game/soccer2/ratings';
import type { Attack, Scenario, Squad } from '../../src/game/soccer2/types';
import { arg, pairsOf, pct, realSquads, squad } from './lib';

const M = Number(arg(0, '400'));
const PART = arg(1, 'all');

interface ShotRec {
  d: number;
  kind: string;
  greened: boolean;
  res: string;
  inBox: boolean;
}
interface AtkRec {
  sc: Scenario;
  end: string;
  used: number;
  shots: number;
  text: string;
  pen: boolean;
  passes: number;
}
interface LevelOut {
  shots: ShotRec[];
  atks: AtkRec[];
  results: { h: number; a: number; dOvr: number }[];
}

/** Play one attack with the pilot, logging its shots (the result of each: G S W B P, else the end). */
function playAttack(a: Attack, skill: number, seed: string, shots: ShotRec[]): AtkRec {
  const pl = pilot(skill, seed);
  kickOff(a);
  let n = 0;
  let ei = 0;
  let open: ShotRec | null = null;
  let nShots = 0;
  let passes = 0;
  let pen = false;
  while (!a.end && n++ < 60 * 120) {
    step(a, 1 / 60, decide(a, pl));
    for (; ei < a.events.length; ei++) {
      const e = a.events[ei];
      if (e === 'pass' || e === 'cross') passes++;
      if (e === 'penalty') pen = true;
      if (e === 'shot' || e === 'header') {
        if (open) shots.push({ ...open, res: open.res || 'other' });
        const s = a.lastShot!;
        open = { d: Math.hypot(a.ball.x - GX, PL - a.ball.y), kind: s.kind, greened: s.greened, res: '', inBox: inBox(a.ball) };
        nShots++;
      } else if (open && !open.res) {
        if (e === 'goal') open.res = 'G';
        else if (e === 'save-catch' || e === 'save-parry' || e === 'end:S') open.res = 'S';
        else if (e === 'block' || e === 'end:B') open.res = 'B';
        else if (e === 'post' || e === 'bar') open.res = 'P';
        else if (e === 'end:W') open.res = 'W';
      }
      if (open && open.res) {
        shots.push(open);
        open = null;
      }
    }
  }
  if (open) shots.push({ ...open, res: open.res || (a.end?.kind ?? 'T') });
  return { sc: a.scenario, end: a.end?.kind ?? 'T', used: a.used, shots: nShots, text: a.end?.text ?? '', pen, passes };
}

/** A side's match of attacks (the deal, stoppage time), as aiAttacksOf plays it. */
function playMatch(att: Squad, def: Squad, seed: string, skill: number, defIQ: number, shots: ShotRec[], atks: AtkRec[]): number {
  const deal = dealOf(seed, ATTACKS);
  let g = 0;
  for (let i = 0; i < ATTACKS + STOPPAGE; i++) {
    const stoppage = i >= ATTACKS;
    const a = setupAttack(deal[i], att, def, seed + ':' + i, { clock: stoppage ? STOPPAGE_CLOCK : CLOCK, stoppage, defIQ });
    const r = playAttack(a, skill, seed + ':ai:' + i, shots);
    atks.push(r);
    if (r.end === 'G') g++;
  }
  return g;
}

const LEVELS: [string, number, number][] = [
  ['rookie', 0.45, -0.5],
  ['pro', 0.68, 0],
  ['legend', 0.88, 1],
  ['sim0.6', 0.6, 0],
];

function table(lvl: string, v: LevelOut) {
  const { shots, atks, results } = v;
  console.log('\n===== ' + lvl + ' (' + results.length + ' matches, ' + atks.length + ' attacks, ' + shots.length + ' shots) =====');
  const goals = results.map((r) => r.h + r.a);
  const mean = goals.reduce((a, b) => a + b, 0) / results.length;
  const draws = results.filter((r) => r.h === r.a).length;
  const nil = results.filter((r) => r.h + r.a === 0).length;
  const dist: Record<number, number> = {};
  for (const r of results) for (const g of [r.h, r.a]) dist[g] = (dist[g] || 0) + 1;
  console.log('goals/match total', mean.toFixed(2), ' per side', (mean / 2).toFixed(2), ' draws', pct(draws, results.length), ' 0-0', pct(nil, results.length));
  console.log('per-side goal distribution', JSON.stringify(dist));
  for (const gap of [4, 8]) {
    let better = 0;
    let level = 0;
    let worse = 0;
    let nb = 0;
    for (const r of results) {
      if (Math.abs(r.dOvr) < gap) continue;
      nb++;
      if (r.h === r.a) level++;
      else if (r.h > r.a === r.dOvr > 0) better++;
      else worse++;
    }
    console.log('|dOvr|>=' + gap + ': better wins', pct(better, nb), ' draw', pct(level, nb), ' worse wins', pct(worse, nb), ' n', nb);
  }
  const ends: Record<string, number> = {};
  for (const a of atks) ends[a.end] = (ends[a.end] || 0) + 1;
  console.log('attack ends', ['G', 'S', 'W', 'B', 'L', 'O', 'T'].map((k) => k + ' ' + pct(ends[k] ?? 0, atks.length, 0)).join('  '));
  const bySc: Record<string, { n: number; G: number; shots: number; withShot: number; used: number; pen: number; passes: number; T: number; L: number; O: number }> = {};
  for (const a of atks) {
    const s = (bySc[a.sc] ??= { n: 0, G: 0, shots: 0, withShot: 0, used: 0, pen: 0, passes: 0, T: 0, L: 0, O: 0 });
    s.n++;
    if (a.end === 'G') s.G++;
    if (a.end === 'T') s.T++;
    if (a.end === 'L') s.L++;
    if (a.end === 'O') s.O++;
    s.shots += a.shots;
    if (a.shots) s.withShot++;
    s.used += a.used;
    if (a.pen) s.pen++;
    s.passes += a.passes;
  }
  for (const k of ['build', 'counter', 'wide', 'corner', 'freekick']) {
    const s = bySc[k];
    if (!s) continue;
    console.log(('  ' + k).padEnd(12), 'goal', pct(s.G, s.n), ' shot in', pct(s.withShot, s.n), ' shots/att', (s.shots / s.n).toFixed(2), ' clock used', (s.used / s.n).toFixed(1) + 's', ' pens won', pct(s.pen, s.n), ' passes/att', (s.passes / s.n).toFixed(2), ' lost', pct(s.L, s.n), ' offside', pct(s.O, s.n), ' time', pct(s.T, s.n));
  }
  const n = shots.length;
  console.log('shots per side per match', (n / (results.length * 2)).toFixed(2));
  const res: Record<string, number> = {};
  for (const s of shots) res[s.res] = (res[s.res] || 0) + 1;
  console.log('shot results', Object.entries(res).map(([k, m]) => k + ' ' + pct(m, n, 0)).join('  '), ' on target (G+S)', pct((res.G || 0) + (res.S || 0), n, 0), ' save% of on-target', pct(res.S || 0, (res.G || 0) + (res.S || 0), 0));
  for (const [lo, hi] of [[0, 6], [6, 11], [11, 16.5], [16.5, 22], [22, 30], [30, 99]]) {
    const ss = shots.filter((s) => s.d >= lo && s.d < hi && s.kind !== 'pen' && s.kind !== 'fk');
    console.log(('  open-play ' + lo + '-' + hi + ' m').padEnd(22), 'shots', String(ss.length).padStart(5), ' share', pct(ss.length, n), ' goal', pct(ss.filter((s) => s.res === 'G').length, ss.length), ' green', pct(ss.filter((s) => s.greened).length, ss.length));
  }
  for (const k of ['shot', 'header', 'volley', 'fk', 'pen']) {
    const ss = shots.filter((s) => s.kind === k);
    console.log(('  kind ' + k).padEnd(22), 'shots', String(ss.length).padStart(5), ' goal', pct(ss.filter((s) => s.res === 'G').length, ss.length), ' mean dist', (ss.reduce((a, s) => a + s.d, 0) / Math.max(1, ss.length)).toFixed(1));
  }
  console.log('  share of non-pen shots in box', pct(shots.filter((s) => s.inBox && s.kind !== 'pen').length, shots.filter((s) => s.kind !== 'pen').length));
  const tx: Record<string, number> = {};
  for (const a of atks) {
    const t = a.text.replace(/ BY .*/, ' BY x').replace(/ · .*/, ' · x');
    tx[t] = (tx[t] || 0) + 1;
  }
  console.log('  end texts', Object.entries(tx).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, m]) => k + ' ' + pct(m, atks.length, 0)).join(' | '));
}

/** One row of the summary: the §2 headline numbers. */
function summary(lvl: string, v: LevelOut): string {
  const { shots, atks, results } = v;
  const goals = results.reduce((a, r) => a + r.h + r.a, 0);
  const res: Record<string, number> = {};
  for (const s of shots) res[s.res] = (res[s.res] || 0) + 1;
  const n = shots.length;
  const onT = (res.G || 0) + (res.S || 0);
  const ends: Record<string, number> = {};
  for (const a of atks) ends[a.end] = (ends[a.end] || 0) + 1;
  const pens = shots.filter((s) => s.kind === 'pen');
  const fks = shots.filter((s) => s.kind === 'fk');
  return [
    lvl.padEnd(7),
    (goals / results.length).toFixed(2).padStart(6),
    pct(results.filter((r) => r.h === r.a).length, results.length),
    pct(results.filter((r) => r.h + r.a === 0).length, results.length),
    (n / (results.length * 2)).toFixed(2).padStart(6),
    pct(onT, n),
    pct(res.G || 0, n),
    pct(res.S || 0, onT),
    pct(res.B || 0, n),
    pct(res.P || 0, n),
    pct(pens.filter((s) => s.res === 'G').length, pens.length) + ' (n=' + pens.length + ')',
    pct(fks.filter((s) => s.res === 'G').length, fks.length),
    '  ' + ['G', 'S', 'W', 'B', 'L', 'O', 'T'].map((k) => k + pct(ends[k] ?? 0, atks.length, 0)).join(' '),
  ].join(' ');
}

const out: Record<string, LevelOut> = {};
if (PART !== 'gap') {
  const squads = realSquads();
  console.log('club-seasons usable:', squads.length);
  const ovrs = squads.map(squadOvr).sort((a, b) => a - b);
  console.log('squad ovr p10/p50/p90:', [0.1, 0.5, 0.9].map((q) => ovrs[Math.floor(ovrs.length * q)].toFixed(1)).join(' / '));
  const pairs = pairsOf(squads, M, 'audit-pairs');
  for (const [name, skill, dq] of LEVELS) {
    if (PART !== 'all' && PART !== name) continue;
    const t0 = Date.now();
    const v: LevelOut = { shots: [], atks: [], results: [] };
    pairs.forEach(([h, aw], i) => {
      const gh = playMatch(h, aw, 'm' + name + i, skill, dq, v.shots, v.atks);
      const ga = playMatch(aw, h, 'n' + name + i, skill, dq, v.shots, v.atks);
      v.results.push({ h: gh, a: ga, dOvr: squadOvr(h) - squadOvr(aw) });
    });
    out[name] = v;
    table(name, v);
    console.log(name, 'done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  }
  console.log('\n===== summary =====');
  console.log('level   goals/m  draws    0-0  shots/s  onTgt goals/sh  save%  blocked  wood  pens (n)        dirFK   attack ends');
  for (const [k, v] of Object.entries(out)) console.log(summary(k, v));
}

if (PART === 'gap') {
  // the autopilot's per-attack goal rate against a rating gap, everything else equal: synthetic
  // elevens, the attacking side (or the defending side) Δ above a 75 reference, Pro (0.68 / defIQ 0)
  console.log('===== rating gap: per-attack goal rate, Pro autopilot, ' + M + ' matches per row (' + M * (ATTACKS + STOPPAGE) + ' attacks) =====');
  for (const who of ['attack', 'defence'] as const) {
    const row: string[] = [];
    for (const d of [0, 5, 10, 15]) {
      const att = squad(who === 'attack' ? 75 + d : 75);
      const def = squad(who === 'defence' ? 75 + d : 75);
      const shots: ShotRec[] = [];
      const atks: AtkRec[] = [];
      let goals = 0;
      for (let i = 0; i < M; i++) goals += playMatch(att, def, 'gap' + who + d + ':' + i, 0.68, 0, shots, atks);
      row.push('Δ' + d + ': ' + pct(goals, atks.length, 0) + ' (' + (goals / M).toFixed(2) + '/m)');
    }
    console.log((who + ' +Δ').padEnd(12), row.join('   '));
  }
}

if (process.env.SOCCER_OUT) writeFileSync(process.env.SOCCER_OUT, JSON.stringify(out));
