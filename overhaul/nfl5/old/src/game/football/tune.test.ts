// Tuning numbers for arcade football (PS_SPORT=nfl TUNE=1 npx vitest run src/game/football/tune.test.ts).
import { CELLS } from '../../engine/data';
import { NFL } from '../../engine/sport';
import type { Lineup, Player } from '../../engine/types';
import { autoplay, chooseCall, decide, pilot } from './autopilot';
import { afterPlay, kick, newGame, startPlay } from './drive';
import { rankOf, squadOf } from './model';
import { snap, step } from './play';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = NFL && (globalThis as any).process?.env?.TUNE ? it : it.skip;

function lineupAt(level: number): { lineup: Lineup; def: Player[] } {
  const by = (pos: string) => CELLS.flatMap((c) => c.players).filter((p) => p.pos[0] === pos).sort((a, b) => rankOf(a) - rankOf(b));
  const at = (pos: string, l: number) => { const list = by(pos); return list[Math.min(list.length - 1, Math.floor(l * (list.length - 1)))]; };
  const def = ['DL', 'LB', 'DB'].map((k) => at(k, level));
  return { lineup: { QB: at('QB', level), RB: at('RB', level), WR: at('WR', level), TE: at('TE', level), FLEX: at('WR', Math.max(0, level - 0.05)), DL: def[0], LB: def[1], DB: def[2] } as Lineup, def };
}

run('football numbers', () => {
  for (const [ol, label] of [[0.97, 'elite O'], [0.6, 'avg O'], [0.2, 'weak O']] as const) {
    for (const [dl, dlabel] of [[0.95, 'elite D'], [0.5, 'avg D'], [0.1, 'weak D']] as const) {
      const off = lineupAt(ol).lineup;
      const def = lineupAt(dl).def;
      const reasons: Record<string, number> = {};
      let airY = 0, yac = 0, nc = 0;
      let pts = 0, tds = 0, ints = 0, drives = 0, att = 0, cmp = 0, sacks = 0, runs = 0, runYds = 0, passYds = 0, plays = 0;
      const N = 40;
      for (let i = 0; i < N; i++) {
        const g = newGame(squadOf(off, def, () => null), 'tune' + i + label + dlabel);
        const pl = pilot(0.7, 'p' + i);
        while (!g.over && plays < 100000) {
          if (g.down === 4 && g.toGo > 1.5 && 117 - g.ballOn <= 50) { kick(g, 0.2); continue; }
          const p = startPlay(g, chooseCall(g, pl));
          snap(p); pl.readAt = 0;
          let thrown = false;
          for (let k = 0; k < 1500 && !p.end; k++) { const s = decide(p, g, pl); step(p, 1 / 60, s); if (p.events.some((e) => e.startsWith('throw'))) thrown = true; p.events.length = 0; }
          const e = p.end!;
          plays++;
          if (p.call === 'pass' && thrown) reasons[e.text] = (reasons[e.text] ?? 0) + 1;
          if (p.caughtAt) { airY += p.caughtAt.y - p.los; yac += e.y - p.caughtAt.y; nc++; }
          if (p.call === 'pass') { if (thrown) att++; if (e.kind === 'sack') sacks++; if (thrown && e.kind !== 'incomplete' && e.kind !== 'int') { cmp++; passYds += e.gain; } if (e.kind === 'int') ints++; }
          else { runs++; runYds += e.gain; }
          if (e.kind === 'td') tds++;
          afterPlay(g, e);
        }
        pts += g.score; drives += g.drives;
      }
      console.log(label.padEnd(8), dlabel.padEnd(8), 'pts/game', (pts / N).toFixed(1), 'TD/drive', (tds / drives).toFixed(2), 'cmp%', (cmp / Math.max(1, att)).toFixed(2), 'Y/C', (passYds / Math.max(1, cmp)).toFixed(1), 'INT/att', (ints / Math.max(1, att)).toFixed(3), 'sack/dropback', (sacks / Math.max(1, att + sacks)).toFixed(3), 'Y/run', (runYds / Math.max(1, runs)).toFixed(1), 'plays/drive', (plays / drives).toFixed(1));
      plays = 0;
      console.log('   air yds/catch', (airY / Math.max(1, nc)).toFixed(1), 'YAC', (yac / Math.max(1, nc)).toFixed(1), label === 'avg O' ? JSON.stringify(reasons) : '');
    }
  }
  // the autoplay helper end to end
  const { lineup, def } = lineupAt(0.6);
  console.log('autoplay', JSON.stringify(autoplay(newGame(squadOf(lineup, def, () => null), 'x'), 0.7, 'x')));
});
