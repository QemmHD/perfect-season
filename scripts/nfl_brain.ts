// The NFL AI's football brain, measured (Claude, studio overhaul nfl-5). Read-only: seeded games and
// plays through the real drive, engine and autopilot with the calibration kit's pinned fixtures; it
// never reads or writes a profile, a relay or the registry. Writes
// docs/studio-overhaul/nfl-calibration/<LABEL>.json and prints a summary.
//
//   PARTS=games,matrix,coach  LABEL=<name>  GAMES=<n>  REPS=<n>  npx vite-node scripts/nfl_brain.ts
//
// games:  AI v AI, gold v gold, 11-drive games at Pro and Legend: pass share by down, time to throw,
//         scrambles, 4th-down tries a game, the defense's call mix and situational shares, blitz
//         risk and reward, and the FREE RUSHER flame (how often it shows, and that it never lies)
// matrix: every pass concept against every call (forced), the AI passer at Pro: completion per
//         dropback, and the beaters both ways
// coach:  Coach Pick against the other two cards on snaps from real games, each card replayed from
//         the same snap with the same defensive call
import { mkdirSync, writeFileSync } from 'node:fs';
import * as brain from '../src/game/football2/brain-kit';
import { fixtureTeams, LEVELS, runCase } from '../src/game/football2/sim-kit';

const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
const PARTS = (env.PARTS ?? 'games,matrix,coach').split(',');
const LABEL = env.LABEL ?? 'nfl5-brain';
const GAMES = Number(env.GAMES ?? 100);
const REPS = Number(env.REPS ?? 60);
const OUT = 'docs/studio-overhaul/nfl-calibration';
mkdirSync(OUT, { recursive: true });
const pct = (b: { v: number }) => (b.v * 100).toFixed(1);
const out: Record<string, unknown> = { label: LABEL };
const t0 = Date.now();

if (PARTS.includes('games')) {
  for (const level of ['pro', 'legend'] as const) {
    const r = runCase(() => fixtureTeams('gold'), { kind: 'ai', ...LEVELS[level] }, 'brain-' + level, GAMES, undefined, 11);
    out['games-' + level] = r;
    const c = r.calls;
    console.log(`\n== AI ${level} gold v gold, ${GAMES} games x 11 drives (${r.plays} plays)`);
    console.log('pass share by down', [1, 2, 3, 4].map((d) => pct(r.passShareByDown[d]) + '% (n ' + r.passShareByDown[d].n + ')').join(' / '));
    console.log('time to throw', r.timeToThrow.v.toFixed(2), 's; scrambles', pct(r.scrambleRate) + '%; 4th-down tries / game', r.fourthDownTries.v);
    console.log('cmp', pct(r.completion), 'INT', pct(r.intRate), 'sack', pct(r.sackRate), 'YPC', r.runs.ypc.v.toFixed(2), 'pts/drive', r.ptsPerDrive.v.toFixed(2));
    console.log('calls', c.snaps, 'snaps,', c.distinct, 'distinct:', Object.entries(c.mix).map(([k, b]) => k + ' ' + pct(b)).join(', '));
    console.log('rotated', pct(c.rotated) + '%; 3rd & 7+: two-high or blitz', pct(c.thirdLongTwoHighOrBlitz) + '%; red zone man/C0/C1/GL', pct(c.redZoneManOrGoal) + '%');
    console.log('sacks blitz', pct(c.blitzSack), 'base', pct(c.baseSack), '(x' + (c.blitzSack.v / c.baseSack.v).toFixed(2) + '); 20+ blitz', pct(c.blitz20), 'base', pct(c.base20), '(x' + (c.blitz20.v / c.base20.v).toFixed(2) + ')');
    console.log('FREE RUSHER shows on', pct(c.flameOnFreeBlitz) + '% of unblocked blitzes (n ' + c.flameOnFreeBlitz.n + '); truly free when shown', pct(c.flameTrulyFree) + '% (n ' + c.flameTrulyFree.n + ')');
  }
}

if (PARTS.includes('matrix')) {
  const m = brain.conceptMatrix(fixtureTeams('gold'), REPS, 'matrix');
  out.matrix = m;
  console.log(`\n== concept x call, completion per dropback, ${REPS} snaps a cell (AI passer at Pro, gold v gold)`);
  console.log('concept'.padEnd(8), m.calls.map((c) => c.padStart(7)).join(''), '   avg');
  for (const k of m.concepts) console.log(k.padEnd(8), m.calls.map((c) => (m.cmp[k][c] * 100).toFixed(0).padStart(7)).join(''), (m.conceptAvg[k] * 100).toFixed(1).padStart(7));
  console.log('avg'.padEnd(8), m.calls.map((c) => (m.callAvg[c] * 100).toFixed(0).padStart(7)).join(''));
  console.log('sacks % / yards per dropback');
  for (const k of m.concepts) console.log(k.padEnd(8), m.calls.map((c) => ((m.sack[k][c] * 100).toFixed(0) + '/' + m.ypd[k][c].toFixed(0)).padStart(7)).join(''));
  console.log('each call\'s best concept (pts over the call\'s average):', m.calls.map((c) => c + ' ' + m.callBeater[c].concept + ' +' + (m.callBeater[c].by * 100).toFixed(0)).join(', '));
  console.log('each concept\'s best call (pts under the concept\'s average):', m.concepts.map((k) => k + ' ' + m.conceptStopper[k].call + ' -' + (m.conceptStopper[k].by * 100).toFixed(0)).join(', '));
  console.log('sacks blitz', (m.blitzSack * 100).toFixed(1), 'base', (m.baseSack * 100).toFixed(1), '; 20+ blitz', (m.blitz20 * 100).toFixed(1), 'base', (m.base20 * 100).toFixed(1));
}

if (PARTS.includes('coach')) {
  const r = brain.coachTrial(fixtureTeams('gold'), Number(env.SNAPS ?? 400), Number(env.CF ?? 8), 'coach');
  out.coach = r;
  console.log(`\n== Coach Pick, ${r.snaps} snaps, each card replayed ${r.replays} times from the same snap`);
  console.log('Coach Pick beats the mean of the other two on', (r.beats * 100).toFixed(1) + '% [' + (r.band.lo * 100).toFixed(1) + '-' + (r.band.hi * 100).toFixed(1) + ']', '; value pick', r.pickValue.toFixed(3), 'others', r.otherValue.toFixed(3));
}

out.seconds = (Date.now() - t0) / 1000;
writeFileSync(OUT + '/' + LABEL + '.json', JSON.stringify(out, null, 1) + '\n');
console.log('\ndone in', (out.seconds as number).toFixed(0) + 's ->', OUT + '/' + LABEL + '.json');
