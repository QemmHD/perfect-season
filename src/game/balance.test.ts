// Team-strength balance with real rated lineups (BAL=1 npx vitest run src/game/balance.test.ts, and
// PS_SPORT=nfl for football). Claude, 2026-11-01: AI-vs-AI win rate of a stronger lineup over a
// weaker one, both sides playing offense against the other's defense, Pro AI, fixed seeds.
import { CELLS } from '../engine/data';
import { NFL } from '../engine/sport';
import type { Lineup } from '../engine/types';
import { loadAttrs } from './attrs';
import { rankOf } from './football/model';
import { autoplay as nflAuto } from './football2/autopilot';
import { newGame } from './football2/drive';
import { defenseOf, offenseOf } from './football2/squad';
import { autoplay as nbaAuto } from './hoops2/autopilot';
import { newHoopsGame } from './hoops2/game';
import { hooper, lineOf, SPOTS } from './hoops2/ratings';
import type { Hooper } from './hoops2/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (globalThis as any).process?.env?.BAL ? it : it.skip;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const N = Number((globalThis as any).process?.env?.BAL_N ?? 40);

run('team strength: real lineups', async () => {
  const at = await loadAttrs();
  const all = CELLS.flatMap((c) => c.players);
  if (!NFL) {
    const sorted = all.slice().sort((a, b) => a.val - b.val);
    const five = (level: number): Hooper[] =>
      SPOTS.map((s, i) => {
        const list = sorted.filter((p) => p.pos.includes(s as never));
        const p = list[Math.min(list.length - 1, Math.floor((level - i * 0.004) * (list.length - 1)))];
        return hooper(lineOf(p, at(p)), s, null);
      });
    const avg = (f: Hooper[]) => f.reduce((n, h) => n + h.ovr, 0) / f.length;
    // find lineups whose average overall is near 90 / 82 / 75
    const near = (want: number) => {
      let best = 0.5,
        d = 99;
      for (let l = 0.05; l <= 0.995; l += 0.005) {
        const x = Math.abs(avg(five(l)) - want);
        if (x < d) {
          d = x;
          best = l;
        }
      }
      return five(best);
    };
    const t90 = near(90),
      t82 = near(82),
      t75 = near(75);
    for (const t of [t90, t82, t75]) console.log(t.map((h) => `${h.name} ${h.pos} o${h.ovr} 3:${h.thr} m:${h.mid} c:${h.cls} l:${h.lay} d:${h.ddk} h:${h.hnd} pd:${h.prd} id:${h.ind} b:${h.blk} s:${h.spd}`).join(' | '));
    for (const [A, B, lab] of [[t75, t75, '75v75'], [t90, t75, '90v75'], [t90, t82, '90v82'], [t82, t75, '82v75']] as const) {
      let w = 0,
        pa = 0,
        pb = 0,
        poss = 0;
      for (let i = 0; i < N; i++) {
        const ga = nbaAuto(newHoopsGame(A, B, 'balA' + i), 0.68, 'pa' + i);
        const gb = nbaAuto(newHoopsGame(B, A, 'balB' + i), 0.68, 'pb' + i);
        pa += ga.score;
        pb += gb.score;
        poss += ga.total;
        w += ga.score > gb.score ? 1 : ga.score === gb.score ? 0.5 : 0;
      }
      console.log('NBA', lab, 'ovr', avg(A).toFixed(1), 'v', avg(B).toFixed(1), 'win%', ((w / N) * 100).toFixed(1), 'pts', (pa / N).toFixed(1), '-', (pb / N).toFixed(1), 'PPP', (pa / poss).toFixed(2), (pb / poss).toFixed(2));
    }
    return;
  }
  const by = (pos: string) => all.filter((p) => p.pos[0] === pos).sort((a, b) => rankOf(a) - rankOf(b));
  const pick = (pos: string, l: number) => {
    const list = by(pos);
    return list[Math.min(list.length - 1, Math.floor(l * (list.length - 1)))];
  };
  const lineupAt = (l: number) => ({ QB: pick('QB', l), RB: pick('RB', l), WR: pick('WR', l), TE: pick('TE', l), FLEX: pick('WR', Math.max(0, l - 0.05)), DL: pick('DL', l), LB: pick('LB', l), DB: pick('DB', l) }) as unknown as Lineup;
  const side = (l: number) => ({ off: offenseOf(lineupAt(l), at, 'o' + l), def: defenseOf(lineupAt(l), at, 'd' + l) });
  const ovr = (s: ReturnType<typeof side>) => {
    const o = s.off,
      d = s.def;
    const xs = [o.qb, o.rb, ...o.wr, o.te, ...o.ol, ...d.dl, ...d.lb, ...d.cb, ...d.s];
    return xs.reduce((n, x) => n + x.ovr, 0) / xs.length;
  };
  const near = (want: number) => {
    let best = 0.5,
      d = 99;
    for (let l = 0.02; l <= 0.99; l += 0.02) {
      const x = Math.abs(ovr(side(l)) - want);
      if (x < d) {
        d = x;
        best = l;
      }
    }
    return side(best);
  };
  const t90 = near(90),
    t82 = near(82),
    t75 = near(75);
  for (const [A, B, lab] of [[t75, t75, '75v75'], [t90, t75, '90v75'], [t90, t82, '90v82'], [t82, t75, '82v75']] as const) {
    let w = 0,
      pa = 0,
      pb = 0;
    for (let i = 0; i < N; i++) {
      const sa = nflAuto(newGame(A.off, B.def, 'balA' + i), 0.68, 'pa' + i).score;
      const sb = nflAuto(newGame(B.off, A.def, 'balB' + i), 0.68, 'pb' + i).score;
      pa += sa;
      pb += sb;
      w += sa > sb ? 1 : sa === sb ? 0.5 : 0;
    }
    console.log('NFL', lab, 'ovr', ovr(A).toFixed(1), 'v', ovr(B).toFixed(1), 'win%', ((w / N) * 100).toFixed(1), 'pts', (pa / N).toFixed(1), '-', (pb / N).toFixed(1));
  }
}, 1800000);
