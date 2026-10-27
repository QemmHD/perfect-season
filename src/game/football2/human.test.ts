// How football answers a person (PS_SPORT=nfl HUMAN=1 npx vitest run src/game/football2/human.test.ts):
// the autopilot's reads and throws, but a person's pace and aim: the read comes later (1.3-2.5 s)
// and the throw is less precise (skill 0.35), against average and good defenses.
import { CELLS } from '../../engine/data';
import { NFL } from '../../engine/sport';
import type { Lineup } from '../../engine/types';
import { loadAttrs } from '../attrs';
import { rankOf } from '../football/model';
import { chooseCall, decide, fourthDown, pilot } from './autopilot';
import { afterPlay, kick, newGame, punt, startPlay } from './drive';
import { snap, step } from './engine';
import { defenseOf, offenseOf } from './squad';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = NFL && (globalThis as any).process?.env?.HUMAN ? it : it.skip;

run('a person playing football', async () => {
  const at = await loadAttrs();
  const all = CELLS.flatMap((c) => c.players);
  const by = (pos: string) => all.filter((p) => p.pos[0] === pos).sort((a, b) => rankOf(a) - rankOf(b));
  const pick = (pos: string, l: number) => { const list = by(pos); return list[Math.min(list.length - 1, Math.floor(l * (list.length - 1)))]; };
  const lineupAt = (l: number) => ({ QB: pick('QB', l), RB: pick('RB', l), WR: pick('WR', l), TE: pick('TE', l), FLEX: pick('WR', Math.max(0, l - 0.05)), DL: pick('DL', l), LB: pick('LB', l), DB: pick('DB', l) }) as unknown as Lineup;
  for (const [ol, olab] of [[0.85, 'good O'], [0.6, 'avg O']] as const)
    for (const [dl, dlab] of [[0.75, 'good D'], [0.5, 'avg D']] as const) {
      const off = offenseOf(lineupAt(ol), at, 'o');
      const def = defenseOf(lineupAt(dl), at, 'd');
      const c: Record<string, number> = {};
      const add = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
      let pts = 0, drives = 0;
      const N = 40;
      for (let i = 0; i < N; i++) {
        const g = newGame(off, def, 'tune' + i + olab + dlab);
        const pl = pilot(0.35, 'p' + i);
        let guard = 0;
        while (!g.over && guard++ < 300) {
          if (g.down === 4) {
            const d = fourthDown(g);
            if (d === 'kick') { kick(g, Math.abs((pl.rand() - 0.5)) * 0.4); add('fg-try'); continue; }
            if (d === 'punt') { punt(g); continue; }
          }
          const p = startPlay(g, chooseCall(g, pl));
          snap(p); pl.readAt = 1.3 + pl.rand() * 1.2;
          let thrown = false;
          for (let k = 0; k < 1500 && !p.end; k++) {
            step(p, 1 / 60, decide(p, g, pl));
            for (const e of p.events) { if (e.startsWith('throw')) thrown = true; if (e.startsWith('beat:') || e === 'break') add('broken'); if (e === 'pancake') add('pancake'); }
            p.events.length = 0;
          }
          const e = p.end!;
          add('plays');
          if (p.caughtAt && e.kind !== 'int') { add('air', p.caughtAt.y - p.los); add('yac', e.y - p.caughtAt.y); add('nc'); if (p.catcher) add('to:' + p.catcher.slot); }
          if (p.call === 'pass') add('cov:' + p.coverage);
          if (p.call === 'pass') {
            if (thrown) add('att');
            if (e.kind === 'sack') add('sack');
            if (thrown && e.kind !== 'incomplete' && e.kind !== 'int') { add('cmp'); add('pyds', e.gain); }
            if (e.kind === 'int') add('int');
          } else { add('runs'); add('ryds', e.gain); }
          if (e.kind === 'fumble') add('fum');
          afterPlay(g, e);
        }
        pts += g.score; drives += g.drives;
        for (const e of g.ends) add('end:' + e);
      }
      console.log(olab.padEnd(8), dlab.padEnd(8), 'pts/g', (pts / N).toFixed(1), 'cmp%', ((c.cmp ?? 0) / Math.max(1, c.att ?? 0)).toFixed(2), 'Y/C', ((c.pyds ?? 0) / Math.max(1, c.cmp ?? 0)).toFixed(1), 'INT/att', ((c.int ?? 0) / Math.max(1, c.att ?? 0)).toFixed(3), 'sack/db', ((c.sack ?? 0) / Math.max(1, (c.att ?? 0) + (c.sack ?? 0))).toFixed(3), 'Y/run', ((c.ryds ?? 0) / Math.max(1, c.runs ?? 0)).toFixed(1), 'plays/dr', ((c.plays ?? 0) / drives).toFixed(1));
      console.log('   air', ((c.air ?? 0) / Math.max(1, c.nc ?? 0)).toFixed(1), 'yac', ((c.yac ?? 0) / Math.max(1, c.nc ?? 0)).toFixed(1), 'targets', ['X', 'Z', 'SL', 'TE', 'RB'].map((k) => k + ':' + (c['to:' + k] ?? 0)).join(' '));
      console.log('   ends', ['TD', 'FG', 'MISS', 'INT', 'DOWNS', 'PUNT', 'FUM'].map((k) => k + ':' + (c['end:' + k] ?? 0)).join(' '), 'broken', c.broken ?? 0, 'pancake', c.pancake ?? 0, 'O ovr', [off.qb, off.rb, ...off.wr, off.te].map((x) => x.ovr).join('/'), 'D ovr', [...def.dl, ...def.lb, ...def.cb, ...def.s].map((x) => x.ovr).join('/'));
    }
});
