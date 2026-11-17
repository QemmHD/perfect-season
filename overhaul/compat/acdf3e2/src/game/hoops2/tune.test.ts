// Tuning numbers for arcade basketball v2 (TUNE=1 npx vitest run src/game/hoops2/tune.test.ts).
import { CELLS } from '../../engine/data';
import { loadAttrs } from '../attrs';
import { decide, pilot } from './autopilot';
import { step } from './engine';
import { afterPossession, newHoopsGame, startPossession } from './game';
import { hooper, lineOf, SPOTS } from './ratings';
import type { Hooper } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (globalThis as any).process?.env?.TUNE ? it : it.skip;
/** the autopilot's skill (TUNE_SKILL=0.45 a Rookie, 0.68 a Pro, 0.88 a Legend) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SKILL = Number((globalThis as any).process?.env?.TUNE_SKILL ?? 0.68);

run('basketball v2 numbers', async () => {
  const at = await loadAttrs();
  const all = CELLS.flatMap((c) => c.players).sort((a, b) => a.val - b.val);
  const five = (level: number): Hooper[] =>
    SPOTS.map((s, i) => {
      const list = all.filter((p) => p.pos.includes(s as never));
      const p = list[Math.min(list.length - 1, Math.floor((level - i * 0.004) * (list.length - 1)))];
      return hooper(lineOf(p, at(p)), s, null);
    });
  for (const [ol, olab] of [[0.97, 'elite O'], [0.75, 'good O'], [0.45, 'avg O']] as const)
    for (const [dl, dlab] of [[0.97, 'elite D'], [0.7, 'good D'], [0.4, 'avg D']] as const) {
      const O = five(ol);
      const D = five(dl);
      const N = 30;
      const c: Record<string, number> = {};
      const add = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
      let pts = 0, poss = 0, secs = 0;
      for (let i = 0; i < N; i++) {
        const g = newHoopsGame(O, D, 'tune' + i + olab + dlab);
        const pl = pilot(SKILL, 'p' + i);
        while (!g.over) {
          const p = startPossession(g);
          pl.letGo = null; pl.driving = false; pl.goal = null; pl.nextThink = 0; pl.crosses = 0;
          for (let k = 0; k < 60 * 40 && !p.end; k++) {
            step(p, 1 / 60, decide(p, pl));
            for (const e of p.events) {
              if (e === 'release-green') add('green');
              if (e === 'release' || e === 'release-green') add('jumpers');
              if (e.startsWith('finish:')) add(e.split(':').slice(0, 3).join(':'));
              if (e.startsWith('ankles')) add('ankles');
              if (e.startsWith('shook')) add('shook');
              if (e.startsWith('blocked')) add('blocks');
              if (e === 'lob') add('lobs');
              if (e.startsWith('orb')) add('orb');
            }
            p.events.length = 0;
          }
          if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
          secs += p.t;
          if (p.lastShot) { add('shot:' + p.lastShot.kind); if (p.lastShot.make) add('make:' + p.lastShot.kind); add('contest:' + p.lastShot.contest); if (p.lastShot.and1) add('and1'); }
          add('end:' + p.end.kind);
          afterPossession(g, p);
          poss++;
          if (g.fire >= 0) add('fire-poss');
        }
        pts += g.score;
      }
      const pct = (k: string) => ((c['make:' + k] ?? 0) / Math.max(1, c['shot:' + k] ?? 0)).toFixed(2) + '/' + (c['shot:' + k] ?? 0);
      console.log(olab.padEnd(8), dlab.padEnd(8), 'pts/g', (pts / N).toFixed(1), 'PPP', (pts / poss).toFixed(2), 'sec/poss', (secs / poss).toFixed(1),
        '3PT', pct('three'), 'MID', pct('mid'), 'CLS', pct('close'), 'LAY', pct('layup'), 'DNK', pct('dunk'), 'CON', pct('contact'), 'OOP', pct('oop'), 'SDK', pct('standdunk'));
      console.log('   green', ((c.green ?? 0) / Math.max(1, c.jumpers ?? 0)).toFixed(2), 'ends', ['make', 'miss', 'steal', 'int', 'clock', 'out'].map((k) => k + ':' + (c['end:' + k] ?? 0)).join(' '),
        'blocks', c.blocks ?? 0, 'ankles', c.ankles ?? 0, 'shook', c.shook ?? 0, 'lobs', c.lobs ?? 0, 'and1', c.and1 ?? 0, 'orb', c.orb ?? 0, 'fire', c['fire-poss'] ?? 0,
        'contest', ['open', 'light', 'heavy', 'smothered'].map((k) => c['contest:' + k] ?? 0).join('/'));
    }
});
