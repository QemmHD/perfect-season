// How the game answers a person playing simple, honest strategies (HUMAN=1 npx vitest run
// src/game/hoops2/human.test.ts): drive at the rim, cross over then drive, spot up for a three,
// pull up from the elbow, step back into a three, kick it to the open man. Inputs carry a person's timing error (the release off the top by a few
// dozen milliseconds), so this measures what playing feels like, not what a perfect bot gets.
//
// The second test (Claude 2026-11-16) is the studio plan's ladder harness (plan §3.2, §3.3, §3.6):
// real even-78 Squad Battles fives, the harness's person with a Gaussian release error (σ HUMAN_SD,
// default 50 ms, and the skilled σ 35 ms), every strategy plus the `mixed` median person, on each UT
// rung (HUMAN_LEVELS=rookie,pro,allstar,legend), against the AI's own possessions at that rung
// (skill and defense as Squad Battles sets them) for a win %. The six defender policies run beside
// the AI's possessions and count what they would press; the engine has no defensive input until
// nba-6/7, so their PPP must equal the idle one (checked). HUMAN_GAMES games each (default 20);
// JSON to $HUMAN_OUT (default: the OS temp dir).
import { CELLS } from '../../engine/data';
import { hashString, rng } from '../../engine/rng';
import { loadAttrs } from '../attrs';
import { aimPass, crossover, dist, isThree, pass, pressShoot, releaseShoot, RIM, step, stepback } from './engine';
import { afterPossession, newHoopsGame, startPossession } from './game';
import { hooper, lineOf, SPOTS } from './ratings';
import type { Hooper, Possession, Pt } from './types';
import { LEVEL, LEVELS, type Level } from '../../ut/battles';
import { getPool } from '../../ut/pool';
import { type BoxTeam, BoxTracker } from './box';
import { DEF_POLICIES, defenderInput, defState, MEDIAN_SD, newTally, outPath, playSide, SKILLED_SD, squadRaw, STRATEGIES, summary, writeOut, type Strategy as HarnessStrategy } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testEnv = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
const run = (globalThis as any).process?.env?.HUMAN ? it : it.skip;

type Strategy = 'drive' | 'cross-drive' | 'three' | 'elbow' | 'stepback' | 'kick';

/** The stick toward a spot from the handler (null when there). */
function toward(p: Possession, at: Pt): Pt | null {
  const h = p.bodies[p.handler!];
  const dx = at.cx - h.cx;
  const dz = at.cz - h.cz;
  const l = Math.hypot(dx, dz);
  return l < 0.6 ? null : { cx: dx / l, cz: dz / l };
}

/** The same at a jog (the stick short of its edge: no sprint). */
function jog(p: Possession, at: Pt): Pt | null {
  const s = toward(p, at);
  return s && { cx: s.cx * 0.8, cz: s.cz * 0.8 };
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
  for (const strat of ['drive', 'cross-drive', 'three', 'elbow', 'stepback', 'kick'] as Strategy[])
    for (const [ol, dl, lab] of [[0.85, 0.75, 'good O vs good D'], [0.6, 0.6, 'avg O vs avg D']] as const) {
      const O = five(ol);
      const D = five(dl);
      const c: Record<string, number> = {};
      const add = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
      let pts = 0;
      let poss = 0;
      for (let gi = 0; gi < Number(testEnv.HUMAN_GAMES ?? 20); gi++) {
        const g = newHoopsGame(O, D, 'human' + gi + strat + lab, undefined, [], Number(testEnv.HUMAN_DEF_IQ ?? 0));
        const r = rng(hashString('hand' + gi + strat));
        while (!g.over) {
          const p = startPossession(g);
          let pressedAt = -1;
          let crossed = false;
          let stepped = -1;
          let passed = false;
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
              } else if (strat === 'stepback') {
                // jog to just inside the arc, step back behind it, rise
                const spot = { cx: RIM.cx - 21, cz: h.cz > 0 ? 6 : -6 };
                if (stepped < 0) {
                  stick = jog(p, spot);
                  if (!stick || p.t > 3) {
                    stepback(p);
                    stepped = p.t;
                  }
                } else if (p.t - stepped > 0.2 || p.t > 6) {
                  pressShoot(p);
                  pressedAt = p.t;
                }
              } else if (strat === 'kick') {
                // the first handler drives a beat then kicks it to the open man; whoever catches it shoots
                if (!passed) {
                  stick = toward(p, RIM);
                  if (p.t > 1.2) {
                    pass(p, aimPass(p, null));
                    passed = true;
                  }
                } else if (p.t - p.bodies[p.handler].actAt > 0.25 || p.t > 6) {
                  pressShoot(p);
                  pressedAt = p.t;
                }
              } else if (strat === 'three') {
                // out to the arc, square up, shoot
                const spot = { cx: RIM.cx - 24.5, cz: h.cz > 0 ? 6 : -6 };
                stick = jog(p, spot);
                if ((isThree(h) && !stick) || p.t > 5) {
                  pressShoot(p);
                  pressedAt = p.t;
                }
              } else {
                const spot = { cx: RIM.cx - 15, cz: h.cz > 0 ? 8 : -8 };
                stick = jog(p, spot);
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

/** Teams' totals summed over games. */
function sumTeams(parts: BoxTeam[]): BoxTeam {
  const out = { ...parts[0] };
  for (const p of parts.slice(1)) for (const k of Object.keys(out) as (keyof BoxTeam)[]) out[k] += p[k];
  return out;
}

run('the ladder: the median and skilled person on each rung, against the AI at that rung', async () => {
  const pool = await getPool();
  const games = Number(testEnv.HUMAN_GAMES ?? 20);
  const levels = (testEnv.HUMAN_LEVELS?.split(',').map((x) => x.trim()) ?? LEVELS) as Level[];
  const sds = testEnv.HUMAN_SD ? [Number(testEnv.HUMAN_SD)] : [MEDIAN_SD, SKILLED_SD];
  const PRO = 0.68;
  const out: Record<string, unknown> = { games, levels, sds };
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const lines: string[] = [];
  for (const lv of levels) {
    const { skill, def } = { skill: PRO + LEVEL[lv].skill, def: LEVEL[lv].def };
    const us = (i: number) => squadRaw(pool, 78, 'H78:' + (i % 10));
    const them = (i: number) => squadRaw(pool, 78, 'R78:' + (i % 10));
    // the AI's possessions at this rung, against your five (as aiPossessionsOf plays them), and the
    // six defender policies counting what they'd press on the same possessions
    const aiScores: number[] = [];
    const aiT = newTally();
    const aiBox: { t: BoxTeam[]; d: BoxTeam[] } = { t: [], d: [] };
    const policy: Record<string, { pts: number; contests: number; steals: number; switches: number }> = {};
    for (const pol of DEF_POLICIES) {
      let pts = 0;
      const counts = { contests: 0, steals: 0, switches: 0 };
      for (let i = 0; i < games; i++) {
        const A = them(i);
        const B = us(i);
        const g = newHoopsGame(A.five, B.five, 'ai:ladder:' + lv + i, undefined, A.bench, def);
        const ds = defState(pol, hashString('def:' + pol + i));
        const box = pol === 'idle' ? new BoxTracker() : undefined;
        playSide(g, { skill, seed: 'ai:ladder:' + lv + i, box, side: 'us', tally: pol === 'idle' ? aiT : undefined, each: (p) => void defenderInput(p, ds) });
        pts += g.score;
        if (pol === 'idle') {
          aiScores.push(g.score);
          aiBox.t.push(box!.team('us'));
          aiBox.d.push(box!.team('them'));
        }
        counts.contests += ds.counts.contests;
        counts.steals += ds.counts.steals;
        counts.switches += ds.counts.switches;
      }
      policy[pol] = { pts, ...counts };
    }
    const ai = summary(sumTeams(aiBox.t), sumTeams(aiBox.d), aiT);
    for (const pol of DEF_POLICIES) expect(policy[pol].pts, `${lv} ${pol}: defender inputs aren't wired yet, so PPP must equal idle`).toBe(policy.idle.pts);
    lines.push(`\n${lv}: AI offense PPP ${r3(ai.ppp)} TOV ${r3(ai.tovPct)} (skill ${r3(skill)}, def ${def})  policies: ${DEF_POLICIES.map((p) => `${p} c${policy[p].contests}/s${policy[p].steals}/w${policy[p].switches}`).join(' ')}`);
    const rung: Record<string, unknown> = { ai: { ppp: r3(ai.ppp), tovPct: r3(ai.tovPct), scores: aiScores }, policy };
    for (const sd of sds) {
      for (const strat of STRATEGIES as HarnessStrategy[]) {
        const t = newTally();
        const ts: BoxTeam[] = [];
        const ds: BoxTeam[] = [];
        let wins = 0;
        for (let i = 0; i < games; i++) {
          const A = us(i);
          const B = them(i);
          const g = newHoopsGame(A.five, B.five, 'human:' + lv + strat + i, undefined, A.bench, def);
          const box = new BoxTracker();
          playSide(g, { skill, seed: 'human:' + lv + strat + sd + i, human: { strategy: strat, sd }, box, side: 'us', tally: t });
          ts.push(box.team('us'));
          ds.push(box.team('them'));
          wins += g.score > aiScores[i] ? 1 : g.score === aiScores[i] ? 0.5 : 0;
        }
        const h = summary(sumTeams(ts), sumTeams(ds), t);
        const row = { ppp: r3(h.ppp), win: r3(wins / games), green: r3(h.greenRate), tov: r3(h.tovPct), fga16: r3(h.fga16), tpaRate: r3(h.tpaRate), secPerPoss: r3(h.secPerPoss) };
        rung[`sd${sd * 1000}.${strat}`] = row;
        lines.push(`  σ ${sd * 1000} ${strat.padEnd(11)} PPP ${row.ppp} win ${row.win} green ${row.green} TOV ${row.tov} FGA/16 ${row.fga16} 3PA ${row.tpaRate} sec ${row.secPerPoss}`);
      }
    }
    out[lv] = rung;
  }
  const file = outPath(testEnv.HUMAN_OUT, 'nba-human.json');
  await writeOut(file, JSON.stringify(out, null, 1));
  console.log(lines.join('\n') + `\n\nJSON: ${file}`);
}, 3_600_000);
