// Tuning numbers for arcade basketball (TUNE=1 npx vitest run src/game/hoops/tune.test.ts).
import { CELLS } from '../../engine/data';
import { NFL } from '../../engine/sport';
import type { Lineup, Player } from '../../engine/types';
import { hoopDecide, hoopPilot } from './autopilot';
import { afterPoss, newHoopGame, startPoss } from './game';
import { baller, SPOTS } from './model';
import { step } from './play';
import { loadAttrs } from '../attrs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = !NFL && (globalThis as any).process?.env?.TUNE ? it : it.skip;

function five(level: number): Lineup {
  const all = CELLS.flatMap((c) => c.players).sort((a, b) => a.val - b.val);
  const out: Record<string, Player> = {};
  for (const s of SPOTS) {
    const list = all.filter((p) => p.pos.includes(s));
    out[s] = list[Math.min(list.length - 1, Math.floor(level * (list.length - 1)))];
  }
  return out as Lineup;
}

run('basketball numbers', async () => {
  const attrs = await loadAttrs();
  for (const [ol, label] of [[0.98, 'elite O'], [0.7, 'avg O'], [0.3, 'weak O']] as const) {
    for (const [dl, dlabel] of [[0.98, 'elite D'], [0.7, 'avg D'], [0.3, 'weak D']] as const) {
      const ours = SPOTS.map((s) => baller(five(ol)[s] as Player, s, attrs(five(ol)[s] as Player)));
      const theirs = SPOTS.map((s) => baller(five(dl)[s] as Player, s, attrs(five(dl)[s] as Player)));
      const ends: Record<string, number> = {};
      const by: Record<string, { n: number; m: number; p: number; room: number }> = {};
      let pts = 0, rim = 0, passes = 0, dur = 0;
      const N = 30;
      for (let i = 0; i < N; i++) {
        const g = newHoopGame(ours, theirs, 'tune' + i + label + dlabel);
        const pl = hoopPilot(0.7, 'p' + i);
        while (!g.over) {
          const p = startPoss(g);
          pl.letGo = null; pl.nextLook = 0;
          for (let k = 0; k < 1800 && !p.end; k++) {
            const s = hoopDecide(p, pl);
            step(p, 1 / 60, s);
            for (const e of p.events) if (e === 'layup' || e === 'dunk') rim++;
            p.events.length = 0;
          }
          const e = p.end ?? { kind: 'clock' as const, points: 0, text: '' };
          ends[e.kind] = (ends[e.kind] ?? 0) + 1;
          for (const s of p.shots) { const b = (by[s.kind] ??= { n: 0, m: 0, p: 0, room: 0 }); b.n++; b.m += s.make ? 1 : 0; b.p += s.p; b.room += s.room; }
          passes += p.passes; dur += p.t;
          afterPoss(g, e);
        }
        pts += g.score;
      }
      console.log('   shots', Object.entries(by).map(([k, v]) => k + ' ' + v.n + ' ' + (v.m / v.n).toFixed(2) + ' (p ' + (v.p / v.n).toFixed(2) + ', room ' + (v.room / v.n).toFixed(1) + ')').join(' | '));
      console.log(label.padEnd(8), dlabel.padEnd(8), 'pts/game', (pts / N).toFixed(1), 'PPP', (pts / (N * 12)).toFixed(2), 'secs/poss', (dur / (N * 12)).toFixed(1), 'passes', (passes / (N * 12)).toFixed(1), 'at rim', (rim / (N * 12)).toFixed(2), JSON.stringify(ends));
    }
  }
});
