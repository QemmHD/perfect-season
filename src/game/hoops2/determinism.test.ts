// Both phones replay the same match, so a seeded game must come out the same however it is run
// (Claude 2026-11-10). Always on, a few seconds:
//  - seeded autopilot games give identical marks, scores and each possession's final p.t with a
//    plain loop, an app-like loop of uneven frames, the render-only juice holding steps back, and
//    the box tracker watching;
//  - a person's inputs, recorded by step, replay to the same game (over uneven frames too);
//  - the simulation code adds no transcendental math (exp/pow/log and friends are not guaranteed
//    bit-identical between the iPhone's engine and V8; new sim math uses + - × ÷, sqrt, min, max
//    and tables) and never reads the clock or Math.random.
/// <reference types="vite/client" />
import { Juice } from '../juice';
import { decide, pilot } from './autopilot';
import { BoxTracker } from './box';
import { crossover, pass, pressShoot, releaseShoot, spin, step, stepback } from './engine';
import { afterPossession, newHoopsGame, POSSESSIONS, startPossession } from './game';
import { DT, humanStep, humanStateFor, type Inputs, MAX_STEPS, MEDIAN_SD, playSide, resetPilot, synthSquad } from './harness';
import type { Possession, Pt } from './types';

/** An app-like frame clock: uneven frames of 8-34 ms. */
function frames(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1103515245 + 12345) >>> 0;
    return 8 + (a % 27);
  };
}

interface Out {
  score: number;
  marks: string[];
  ts: number[];
}

const GAMES = [
  { a: 'det-a', b: 'det-b', skill: 0.45, def: -0.5 },
  { a: 'det-c', b: 'det-d', skill: 0.68, def: 0 },
  { a: 'det-e', b: 'det-f', skill: 0.88, def: 1 },
];

/** The plain loop: one step after another. */
function plain(i: number, box = false): Out {
  const G = GAMES[i];
  const A = synthSquad(G.a);
  const B = synthSquad(G.b);
  const g = newHoopsGame(A.five, B.five, 'det' + i, POSSESSIONS, A.bench, G.def);
  const r = playSide(g, { skill: G.skill, seed: 'det' + i, box: box ? new BoxTracker() : undefined });
  return { score: g.score, marks: r.marks, ts: r.ts };
}

/** The app's loop: frames of uneven length feed an accumulator; the juice's hit-stop holds steps back. */
function appLike(i: number, juice: boolean): Out {
  const G = GAMES[i];
  const A = synthSquad(G.a);
  const B = synthSquad(G.b);
  const g = newHoopsGame(A.five, B.five, 'det' + i, POSSESSIONS, A.bench, G.def);
  const pl = pilot(G.skill, 'det' + i);
  const J = new Juice({ seed: 11 });
  const next = frames(17 + i);
  let now = 0;
  const ts: number[] = [];
  while (!g.over) {
    const p = startPossession(g);
    resetPilot(pl);
    let acc = 0;
    let n = 0;
    for (let f = 0; f < 60 * 120 && !p.end && n < MAX_STEPS; f++) {
      const ms = next();
      now += ms;
      if (juice) J.update(ms / 1000);
      acc += juice ? J.gameTime(now, ms / 1000) : ms / 1000;
      while (acc >= DT && !p.end && n < MAX_STEPS) {
        acc -= DT;
        n++;
        step(p, DT, decide(p, pl));
        if (juice)
          for (const e of p.events) {
            if (e === 'release-green') J.hitStop('green', now);
            if (e.startsWith('finish:')) J.hitStop('dunk', now);
            if (e.startsWith('blocked:')) J.hitStop('block', now);
          }
        p.events.length = 0;
      }
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: 'SHOT CLOCK', who: -1 };
    ts.push(p.t);
    afterPossession(g, p);
  }
  return { score: g.score, marks: g.marks.slice(), ts };
}

/** A person's game, recorded input by input (keyed by the step it came before) or replayed. */
type Op = { k: number; op: 'press' | 'release' | 'pass' | 'cross' | 'stepback' | 'spin'; a: number };
function personGame(script: { ops: Op[]; sticks: (Pt | null)[] } | null, unevenSeed = 0): { out: Out; ops: Op[]; sticks: (Pt | null)[]; shotP: number[] } {
  const A = synthSquad('person-a');
  const B = synthSquad('person-b');
  const g = newHoopsGame(A.five, B.five, 'person', POSSESSIONS, A.bench, 0);
  const ops: Op[] = [];
  const sticks: (Pt | null)[] = [];
  const ts: number[] = [];
  const shotP: number[] = [];
  let k = 0;
  const rec: Inputs = {
    press: (p) => (ops.push({ k, op: 'press', a: 0 }), pressShoot(p)),
    release: (p, late) => (ops.push({ k, op: 'release', a: late }), releaseShoot(p, late)),
    pass: (p, to) => (ops.push({ k, op: 'pass', a: to ?? -1 }), pass(p, to)),
    cross: (p, dir) => (ops.push({ k, op: 'cross', a: dir }), crossover(p, dir)),
    stepback: (p) => (ops.push({ k, op: 'stepback', a: 0 }), stepback(p)),
    spin: (p, dir) => (ops.push({ k, op: 'spin', a: dir }), spin(p, dir)),
  };
  const replay = (p: Possession, o: Op) => {
    if (o.op === 'press') pressShoot(p);
    else if (o.op === 'release') releaseShoot(p, o.a);
    else if (o.op === 'pass') pass(p, o.a < 0 ? null : o.a);
    else if (o.op === 'cross') crossover(p, o.a);
    else if (o.op === 'stepback') stepback(p);
    else spin(p, o.a);
  };
  const next = frames(unevenSeed || 1);
  let cursor = 0;
  while (!g.over) {
    const p = startPossession(g);
    const hs = humanStateFor({ strategy: 'mixed', sd: MEDIAN_SD }, 'person:' + g.done);
    let n = 0;
    // uneven frames decide how many steps run at a time; the inputs stay keyed by step
    while (!p.end && n < MAX_STEPS) {
      const batch = unevenSeed ? Math.max(0, Math.round(next() / 1000 / DT)) : 1;
      for (let s = 0; s < batch && !p.end && n < MAX_STEPS; s++, n++, k++) {
        let stick: Pt | null;
        if (script) {
          while (cursor < script.ops.length && script.ops[cursor].k === k) replay(p, script.ops[cursor++]);
          stick = script.sticks[k];
        } else {
          stick = humanStep(p, hs, rec);
          sticks[k] = stick;
        }
        step(p, DT, stick);
        p.events.length = 0;
      }
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: 'SHOT CLOCK', who: -1 };
    ts.push(p.t);
    shotP.push(p.lastShot?.p ?? -1);
    afterPossession(g, p);
  }
  return { out: { score: g.score, marks: g.marks.slice(), ts }, ops, sticks, shotP };
}

// ---------- the source scan ----------

/** This folder's sources (tests left out), read as text. */
const SOURCES = import.meta.glob<string>(['./*.ts', '!./*.test.ts'], { query: '?raw', import: 'default', eager: true });
/** Drawing and test support: free to use any math (they never decide an outcome). */
const NOT_SIM = new Set(['render.ts', 'hud-draw.ts', 'harness.ts', 'targets.ts']);
const TRANSCENDENTAL = /\bMath\.(exp|expm1|pow|log|log1p|log2|log10|cbrt|sinh|cosh|tanh|asinh|acosh|atanh)\b|\*\*/g;
const CLOCKS = /\bMath\.random\b|\bDate\.now\b|\bperformance\.now\b|\bnew Date\b/g;
/**
 * The transcendental calls the simulation already had on 2026-11-10, by file and top-level
 * declaration. They stay (changing them changes every match), but nothing new may join them.
 */
const GRANDFATHERED: Record<string, Record<string, number>> = {
  'engine.ts': { greenWindow: 2, releaseProbability: 2, normTail: 1, finishNow: 1 },
  'autopilot.ts': { attackValue: 1 },
  'ratings.ts': { overallFromRank: 1, hooper: 8 },
};

/** Source with comments and string contents blanked out (so a word in a comment doesn't count). */
function code(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) out += src[i++] === '\n' ? '\n' : ' ';
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      out += c;
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') i++;
        i++;
        out += ' ';
      }
      out += c;
      i++;
    } else out += src[i++];
  }
  return out;
}

/** Each top-level declaration's name and its code. */
function declarations(src: string): { name: string; body: string }[] {
  const s = code(src);
  const out: { name: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    if (depth === 0 && (c === ';' || c === '}' || c === '\n')) {
      const body = s.slice(start, i + 1);
      const m = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*(\w+)|(?:const|let|var)\s+(\w+)|class\s+(\w+)|(?:interface|type|enum)\s+(\w+))/.exec(body);
      if (m) out.push({ name: m[1] ?? m[2] ?? m[3] ?? m[4], body });
      else if (body.trim() && out.length) out[out.length - 1].body += body;
      start = i + 1;
    }
  }
  return out;
}

describe('hoops2 determinism', () => {
  it('seeded autopilot games are identical across loops, uneven frames, juice and the box tracker', () => {
    for (let i = 0; i < GAMES.length; i++) {
      const base = plain(i);
      expect(base.marks.length).toBe(POSSESSIONS);
      expect(plain(i, true)).toEqual(base);
      expect(appLike(i, false)).toEqual(base);
      expect(appLike(i, true)).toEqual(base);
    }
  }, 60_000);

  it('a recorded person replays to the same game, frame batching aside', () => {
    const live = personGame(null);
    expect(live.ops.filter((o) => o.op === 'press').length).toBeGreaterThan(8);
    const again = personGame({ ops: live.ops, sticks: live.sticks });
    expect(again.out).toEqual(live.out);
    expect(again.shotP).toEqual(live.shotP);
    const uneven = personGame({ ops: live.ops, sticks: live.sticks }, 23);
    expect(uneven.out).toEqual(live.out);
    expect(uneven.shotP).toEqual(live.shotP);
  }, 60_000);

  it('the simulation adds no transcendental math and never reads the clock or Math.random', () => {
    const files = Object.keys(SOURCES)
      .map((k) => k.replace('./', ''))
      .filter((f) => !NOT_SIM.has(f));
    expect(files).toContain('engine.ts');
    expect(files).toContain('box.ts');
    const found: string[] = [];
    for (const f of files) {
      const src = SOURCES['./' + f];
      const clocks = code(src).match(CLOCKS);
      if (clocks) found.push(`${f}: ${clocks.join(', ')}`);
      const allowed = GRANDFATHERED[f] ?? {};
      for (const d of declarations(src)) {
        const n = d.body.match(TRANSCENDENTAL)?.length ?? 0;
        if (n > (allowed[d.name] ?? 0)) found.push(`${f} ${d.name}: ${n} transcendental call(s), ${allowed[d.name] ?? 0} allowed`);
      }
    }
    expect(found).toEqual([]);
  });

  it('the scan sees through comments and strings, and finds new calls', () => {
    const src = [
      "// Math.pow(2, 3) in a comment doesn't count",
      "const label = 'Math.exp(x)';",
      'export function fresh(x: number): number {',
      '  return Math.pow(x, 1.5) + x ** 2;',
      '}',
      'function clean(x: number) {',
      '  return Math.sqrt(x) * Math.min(1, x);',
      '}',
    ].join('\n');
    const ds = declarations(src);
    const n = (name: string) => ds.find((d) => d.name === name)?.body.match(TRANSCENDENTAL)?.length ?? 0;
    expect(ds.map((d) => d.name)).toEqual(['label', 'fresh', 'clean']);
    expect(n('label')).toBe(0);
    expect(n('fresh')).toBe(2);
    expect(n('clean')).toBe(0);
  });
});
