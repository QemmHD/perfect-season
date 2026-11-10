// Audit (read-only): whole-match realism for arcade soccer. Runs the real engine/autopilot with an
// instrumented loop that logs every shot (distance, angle, kind, result) and every attack's end.
// Run from the repo: cd /home/user/ps-studio && npx vite-node <this file> [matches] [part]
import cardsRaw from '/home/user/ps-studio/src/data/cards-soccer.json';
import { decide, pilot } from '/home/user/ps-studio/src/game/soccer2/autopilot';
import { GX, kickOff, PL, setupAttack, step, CLOCK, STOPPAGE_CLOCK, inBox } from '/home/user/ps-studio/src/game/soccer2/engine';
import { dealOf, ATTACKS, STOPPAGE } from '/home/user/ps-studio/src/game/soccer2/match';
import { clubSquad, soccerLines, squadOvr, type SoccerCardsFile } from '/home/user/ps-studio/src/game/soccer2/ratings';
import type { Attack, Scenario, Squad } from '/home/user/ps-studio/src/game/soccer2/types';
import { rng, hashString } from '/home/user/ps-studio/src/engine/rng';
import { writeFileSync } from 'node:fs';

const M = Number(process.argv[2] ?? 200);
const PART = process.argv[3] ?? 'all';
const OUTDIR = '/tmp/claude-0/-home-user/8d80c188-0981-544b-8b2d-c9de04f0705c/scratchpad/overhaul/audit-scripts/';

interface ShotRec { d: number; ang: number; kind: string; greened: boolean; res: string; sc: Scenario; inBox: boolean; header: boolean }
interface AtkRec { sc: Scenario; end: string; used: number; shots: number; text: string; fouls: number; pen: boolean; passes: number; tackles: number }

/** Play one attack with the pilot, logging shots. */
function playAttack(a: Attack, skill: number, seed: string, shots: ShotRec[]): AtkRec {
  const pl = pilot(skill, seed);
  kickOff(a);
  let n = 0;
  let ei = 0;
  let open: ShotRec | null = null;
  let nShots = 0;
  let passes = 0;
  let tackles = 0;
  let pen = false;
  while (!a.end && n++ < 60 * 120) {
    step(a, 1 / 60, decide(a, pl));
    for (; ei < a.events.length; ei++) {
      const e = a.events[ei];
      if (e === 'pass' || e === 'cross') passes++;
      if (e === 'tackle') tackles++;
      if (e === 'penalty') pen = true;
      if (e === 'shot' || e === 'header') {
        if (open) shots.push({ ...open, res: open.res || 'other' });
        const s = a.lastShot!;
        const by = a.bodies[s.by];
        const d = Math.hypot(a.ball.x - GX, PL - a.ball.y);
        open = { d, ang: Math.abs(Math.atan2(a.ball.x - GX, PL - a.ball.y)) * 57.3, kind: s.kind, greened: s.greened, res: '', sc: a.scenario, inBox: inBox(a.ball), header: s.kind === 'header' };
        nShots++;
        void by;
      } else if (open && !open.res) {
        if (e === 'goal') open.res = 'G';
        else if (e === 'save-catch' || e === 'save-parry') open.res = 'S';
        else if (e === 'block') open.res = 'B';
        else if (e === 'post' || e === 'bar') open.res = 'P';
        else if (e === 'end:W') open.res = 'W';
        else if (e === 'end:S') open.res = 'S';
        else if (e === 'end:B') open.res = 'B';
      }
      if (open && open.res) {
        shots.push(open);
        open = null;
      }
    }
  }
  if (open) shots.push({ ...open, res: open.res || (a.end?.kind ?? 'T') });
  return { sc: a.scenario, end: a.end?.kind ?? 'T', used: a.used, shots: nShots, text: a.end?.text ?? '', fouls: a.fouls, pen, passes, tackles };
}

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

// all club-seasons with at least 11 lines
const { seasons } = soccerLines(cardsRaw as unknown as SoccerCardsFile);
const counts = new Map<string, number>();
for (const l of seasons) counts.set(l.fr + '|' + l.season, (counts.get(l.fr + '|' + l.season) ?? 0) + 1);
const keys = [...counts.entries()].filter(([, n]) => n >= 14).map(([k]) => k);
const squads: Squad[] = [];
for (const k of keys) {
  const [fr, s] = k.split('|');
  try {
    squads.push(clubSquad(seasons, fr, Number(s)));
  } catch {}
}
console.log('club-seasons usable:', squads.length);
const ovrs = squads.map(squadOvr).sort((a, b) => a - b);
console.log('squad ovr p10/p50/p90:', ovrs[Math.floor(ovrs.length * 0.1)].toFixed(1), ovrs[Math.floor(ovrs.length * 0.5)].toFixed(1), ovrs[Math.floor(ovrs.length * 0.9)].toFixed(1));

const LEVELS: [string, number, number][] = [
  ['rookie', 0.45, -0.5],
  ['pro', 0.68, 0],
  ['legend', 0.88, 1],
  ['sim0.6', 0.6, 0],
];
const out: Record<string, unknown> = {};
const r = rng(hashString('audit-pairs'));
const pairs: [Squad, Squad][] = [];
for (let i = 0; i < M; i++) pairs.push([squads[Math.floor(r() * squads.length)], squads[Math.floor(r() * squads.length)]]);

for (const [name, skill, dq] of LEVELS) {
  if (PART !== 'all' && PART !== name) continue;
  const t0 = Date.now();
  const shots: ShotRec[] = [];
  const atks: AtkRec[] = [];
  const results: { h: number; a: number; dOvr: number }[] = [];
  pairs.forEach(([h, aw], i) => {
    const gh = playMatch(h, aw, 'm' + name + i, skill, dq, shots, atks);
    const ga = playMatch(aw, h, 'n' + name + i, skill, dq, shots, atks);
    results.push({ h: gh, a: ga, dOvr: squadOvr(h) - squadOvr(aw) });
  });
  out[name] = { shots, atks, results, ms: Date.now() - t0 };
  console.log(name, 'done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
}
writeFileSync(OUTDIR + 'soccer_sim_out_' + PART + '.json', JSON.stringify(out));
