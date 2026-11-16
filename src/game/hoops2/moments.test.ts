// Moments and Training drills under the median person (Claude 2026-11-16; opt-in, plan §3.11):
//   NBA_MOMENTS=1 npx vitest run src/game/hoops2/moments.test.ts
// Every NBA Moment (ut/moments.ts) and every Training Camp drill at its three pressures, played
// NBA_MOMENTS_RUNS times (default 200) the way the screens set them up: an even-78 Squad Battles five
// against itself, the drill's start on every possession (practiceStart), the Moment's defense, and a
// person with a σ 50 ms release (HUMAN_SD to change it) playing the drill's natural strategy. An
// attempt succeeds as Hoops2 books it (a make; the passing drill needs a pass first), a green
// counts for a PERFECT Moment. Prints each completion rate (the §3.11 baseline; ut gets the
// before/after) and writes JSON to $NBA_MOMENTS_OUT.
import type { Drill } from '../../evolution/training';
import { HOOPS_DRILLS } from '../../evolution/training';
import { momentsFor } from '../../ut/moments';
import { getPool } from '../../ut/pool';
import { env, humanPossession, MEDIAN_SD, outPath, squadRaw, type Strategy, writeOut } from './harness';
import { hashString } from '../../engine/rng';
import { afterPossession, newHoopsGame, practiceStart, startPossession } from './game';
import { target, within } from './targets';

const run = env.NBA_MOMENTS ? it : it.skip;
const RUNS = Number(env.NBA_MOMENTS_RUNS ?? 200);
const SD = Number(env.HUMAN_SD ?? MEDIAN_SD);

/** The strategy a person plays in each drill: spot up and shoot, attack the rim, move it then score. */
const PLAN: Record<'shoot' | 'finish' | 'pass', Strategy> = { shoot: 'three', finish: 'drive', pass: 'kick' };

interface Spec {
  id: string;
  drill: Drill;
  attempts: number;
  target: number;
  measure: 'success' | 'green';
  defIQ: number;
  /** possessions the screen gives the game (Moments 12, Training 10) */
  possessions: number;
}

run('every NBA Moment and drill, under the median person', async () => {
  const pool = await getPool();
  const specs: Spec[] = [
    ...momentsFor('nba').map((m) => ({ id: m.id, drill: m.drill, attempts: m.attempts, target: m.target, measure: m.measure === 'green' ? ('green' as const) : ('success' as const), defIQ: m.difficulty, possessions: 12 })),
    ...HOOPS_DRILLS.flatMap((d) => [-0.6, 0, 0.8].map((pressure) => ({ id: `camp:${d.id}@${pressure}`, drill: d.id, attempts: 10, target: d.target, measure: 'success' as const, defIQ: pressure, possessions: 10 }))),
  ];
  const out: Record<string, { completion: number; perAttempt: number; greensPerAttempt: number }> = {};
  const lines: string[] = [`σ ${SD * 1000} ms, ${RUNS} runs each`];
  for (const s of specs) {
    if (s.drill !== 'shoot' && s.drill !== 'finish' && s.drill !== 'pass') continue;
    let done = 0;
    let hits = 0;
    let greens = 0;
    for (let i = 0; i < RUNS; i++) {
      const sq = squadRaw(pool, 78, 'moment:' + (i % 10));
      const g = newHoopsGame(sq.five, sq.five, s.id + ':' + i, s.possessions, sq.bench, s.defIQ);
      let score = 0;
      for (let a = 0; a < s.attempts && !g.over; a++) {
        const p = startPossession(g);
        practiceStart(p, s.drill);
        humanPossession(p, { strategy: PLAN[s.drill], sd: SD }, hashString(s.id + ':' + i + ':' + a));
        const success = p.end!.kind === 'make' && (s.drill !== 'pass' || p.passes > 0);
        const green = !!p.lastShot?.greened;
        hits += success ? 1 : 0;
        greens += green ? 1 : 0;
        score += s.measure === 'green' ? (green ? 1 : 0) : success ? 1 : 0;
        afterPossession(g, p);
      }
      if (score >= s.target) done++;
    }
    out[s.id] = { completion: done / RUNS, perAttempt: hits / (RUNS * s.attempts), greensPerAttempt: greens / (RUNS * s.attempts) };
    lines.push(`${s.id.padEnd(22)} ${s.measure.padEnd(7)} ${s.target}/${s.attempts} def ${String(s.defIQ).padEnd(4)}  completes ${(done / RUNS).toFixed(3)}  per attempt ${(hits / (RUNS * s.attempts)).toFixed(3)}  greens ${(greens / (RUNS * s.attempts)).toFixed(3)}`);
  }
  const green = out['nba:green-room'];
  if (green) {
    const row = target('moment.greenRoom');
    lines.push(`${within(row, green.completion) ? '  ' : '!!'} ${row.label}: ${green.completion.toFixed(3)} (band ${row.lo}-${row.hi})`);
  }
  const file = outPath(env.NBA_MOMENTS_OUT, 'nba-moments.json');
  await writeOut(file, JSON.stringify({ sd: SD, runs: RUNS, out }, null, 1));
  console.log(lines.join('\n') + `\n\nJSON: ${file}`);
}, 3_600_000);
