// How the game answers a person playing simple, honest strategies (HUMAN=1 npx vitest run
// src/game/hoops2/human.test.ts): drive at the rim, cross over then drive, spot up for a three,
// pull up from the elbow. Inputs carry a person's timing error (the release off the top by a few
// dozen milliseconds), so this measures what playing feels like, not what a perfect bot gets.
import { CELLS } from '../../engine/data';
import { rng } from '../../engine/rng';
import { loadAttrs } from '../attrs';
import { crossover, dist, isThree, pressShoot, releaseShoot, RIM, step } from './engine';
import { afterPossession, newHoopsGame, startPossession } from './game';
import { hooper, lineOf, SPOTS } from './ratings';
import type { Hooper, Possession, Pt } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (globalThis as any).process?.env?.HUMAN ? it : it.skip;

type Strategy = 'drive' | 'cross-drive' | 'three' | 'elbow';

/** The stick toward a spot from the handler (null when there). */
function toward(p: Possession, at: Pt): Pt | null {
  const h = p.bodies[p.handler!];
  const dx = at.cx - h.cx;
  const dz = at.cz - h.cz;
  const l = Math.hypot(dx, dz);
  return l < 0.6 ? null : { cx: dx / l, cz: dz / l };
}

run('a person playing simple strategies', async () => {
  const at = await loadAttrs();
  const all = CELLS.flatMap((c) => c.players).sort((a, b) => a.val - b.val);
  const five = (level: number): Hooper[] =>
    SPOTS.map((s, i) => {
      const list = all.filter((p) => p.pos.includes(s as never));
      const p = list[Math.min(list.length - 1, Math.floor((level - i * 0.004) * (list.length - 1)))];
      return hooper(lineOf(p, at(p)), s, null);
    });
  for (const strat of ['drive', 'cross-drive', 'three', 'elbow'] as Strategy[])
    for (const [ol, dl, lab] of [[0.85, 0.75, 'good O vs good D'], [0.6, 0.6, 'avg O vs avg D']] as const) {
      const O = five(ol);
      const D = five(dl);
      const c: Record<string, number> = {};
      const add = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
      let pts = 0;
      let poss = 0;
      for (let gi = 0; gi < 20; gi++) {
        const g = newHoopsGame(O, D, 'human' + gi + strat + lab);
        const r = rng('hand' + gi + strat);
        while (!g.over) {
          const p = startPossession(g);
          let pressedAt = -1;
          let crossed = false;
          // a person's release: off the top by up to ~70 ms either way
          const err = (r() - 0.5) * 0.14;
          for (let k = 0; k < 60 * 30 && !p.end; k++) {
            let stick: Pt | null = null;
            if (p.handler !== null && !p.ball && !p.meter && !p.finish) {
              const h = p.bodies[p.handler];
              const dRim = dist(h, RIM);
              if (strat === 'cross-drive' && !crossed && p.t > 0.4) {
                crossover(p, r() < 0.5 ? 1 : -1);
                crossed = true;
              }
              if (strat === 'drive' || strat === 'cross-drive') {
                stick = toward(p, RIM);
                if (dRim < 7 || p.t > 6) {
                  pressShoot(p);
                  pressedAt = p.t;
                  add('shootFrom:' + (dRim < 7 ? 'rim' : 'out'));
                }
              } else if (strat === 'three') {
                // out to the arc, square up, shoot
                const spot = { cx: RIM.cx - 24.5, cz: h.cz > 0 ? 6 : -6 };
                stick = toward(p, spot);
                if ((isThree(h) && !stick) || p.t > 5) {
                  pressShoot(p);
                  pressedAt = p.t;
                }
              } else {
                const spot = { cx: RIM.cx - 15, cz: h.cz > 0 ? 8 : -8 };
                stick = toward(p, spot);
                if (!stick || p.t > 4) {
                  pressShoot(p);
                  pressedAt = p.t;
                }
              }
            }
            if (p.meter && p.meter.off === undefined && pressedAt >= 0 && p.t - p.meter.t0 >= p.meter.top + err) releaseShoot(p);
            step(p, 1 / 60, stick);
            for (const e of p.events) {
              if (e === 'release-green') add('green');
              if (e === 'release' || e === 'release-green') add('jumpers');
              if (e.startsWith('blocked')) add('blocked');
              if (e.startsWith('posterized')) add('posterized');
              if (e.startsWith('ankles')) add('ankles');
              if (e.startsWith('shook')) add('shook');
            }
            p.events.length = 0;
          }
          if (!p.end) p.end = { kind: 'clock', points: 0, text: '', who: -1 };
          if (p.lastShot) {
            add('shot:' + p.lastShot.kind);
            if (p.lastShot.make) add('make:' + p.lastShot.kind);
            if (p.lastShot.greened) {
              add('greenShot');
              if (p.lastShot.make) add('greenMake');
            }
            add('contest:' + p.lastShot.contest);
          }
          add('end:' + p.end.kind);
          add('secs', p.t);
          afterPossession(g, p);
          poss++;
        }
        pts += g.score;
      }
      const pct = (k: string) => ((c['make:' + k] ?? 0) / Math.max(1, c['shot:' + k] ?? 0)).toFixed(2) + '/' + (c['shot:' + k] ?? 0);
      console.log(
        strat.padEnd(11),
        lab.padEnd(17),
        'PPP',
        (pts / poss).toFixed(2),
        'sec',
        ((c.secs ?? 0) / poss).toFixed(1),
        'reached rim',
        (c['shootFrom:rim'] ?? 0) + '/' + ((c['shootFrom:rim'] ?? 0) + (c['shootFrom:out'] ?? 0)),
        '3PT',
        pct('three'),
        'MID',
        pct('mid'),
        'CLS',
        pct('close'),
        'LAY',
        pct('layup'),
        'DNK',
        pct('dunk'),
        'CON',
        pct('contact'),
        'SDK',
        pct('standdunk')
      );
      console.log(
        '   greens',
        (c.green ?? 0) + '/' + (c.jumpers ?? 0),
        'green makes',
        (c.greenMake ?? 0) + '/' + (c.greenShot ?? 0),
        'blocked',
        c.blocked ?? 0,
        'posterized',
        c.posterized ?? 0,
        'ankles',
        c.ankles ?? 0,
        'shook',
        c.shook ?? 0,
        'ends',
        ['make', 'miss', 'steal', 'clock', 'out'].map((k) => k + ':' + (c['end:' + k] ?? 0)).join(' '),
        'contest',
        ['open', 'light', 'heavy', 'smothered'].map((k) => c['contest:' + k] ?? 0).join('/')
      );
    }
});
