// The AI's games, pinned to the engine as it was before the studio overhaul (Claude 2026-11-16).
//
// The determinism test compares runs of the same engine, so it can't see an outcome change. This one
// holds fingerprints of seeded AI games recorded from the base commit 78a1c86 (the last commit before
// nba-1 touched src/game/hoops2) and asserts the current engine plays them identically:
//  - `aiPossessionsOf` (the rival's offense in every solo match, and both sides of a sim): its exact
//    body, run on made-up fives with a bench at four skills and four defensive IQs;
//  - the same autoplay loop step by step, also recording each possession's end (kind, points,
//    who, text) and its final clock, so a change in timing shows even when the score doesn't.
// If a deliberate gameplay change moves these (a calibration task), re-record them from that
// commit with NBA_GOLDEN_RECORD=1 and write "Protocol bump needed: NBA draft + UT" in the team doc.
/// <reference types="vite/client" />
import { hashString, rng } from '../../engine/rng';
import { autoplay, decide, pilot } from './autopilot';
import { step } from './engine';
import { afterPossession, newHoopsGame, POSSESSIONS, startPossession } from './game';
import type { Hooper } from './types';

const SPOTS = ['PG', 'SG', 'SF', 'PF', 'C'];
const HT: Record<string, number> = { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 };
const BADGES = ['posterizer', 'deadeye', 'limitless', 'clamps', 'rim-protector', 'ankle-breaker', 'dimer', 'lob-city', 'heat-check', 'icon'];

/** A made-up five and bench (only fields the base engine already had, so the base can run it too). */
function squad(seed: string): { five: Hooper[]; bench: Hooper[] } {
  const r = rng(hashString('golden:' + seed));
  const v = (lo: number, hi: number) => Math.round(lo + (hi - lo) * r());
  const man = (spot: string, k: number): Hooper => {
    const big = spot === 'PF' || spot === 'C' ? 1 : 0;
    return {
      id: seed + ':' + spot + ':' + k,
      name: 'Golden ' + spot + k,
      tag: spot + k,
      num: k,
      ht: HT[spot] + v(-2, 2),
      wt: 190 + big * 50 + v(-10, 25),
      pos: spot,
      ovr: v(58, 92),
      spd: v(55, 95) - big * 8,
      acc: v(55, 95) - big * 8,
      hnd: v(45, 95) - big * 15,
      pas: v(45, 95) - big * 10,
      thr: v(40, 97) - big * 12,
      mid: v(50, 95),
      cls: v(50, 95),
      lay: v(50, 95),
      ft: v(45, 95),
      ddk: v(40, 97) + big * 5,
      sdk: v(30, 70) + big * 25,
      str: v(40, 75) + big * 20,
      vrt: v(50, 95),
      sta: v(60, 99),
      prd: v(45, 95),
      ind: v(40, 75) + big * 20,
      stl: v(35, 95),
      blk: v(30, 70) + big * 25,
      reb: v(40, 70) + big * 25,
      abil: BADGES.filter(() => r() < 0.2),
    };
  };
  return { five: SPOTS.map((s) => man(s, 0)), bench: [man('SG', 1), man('SF', 1), man('C', 1)] };
}

const GAMES = [
  { a: 'g1', b: 'g2', skill: 0.3, def: -0.5 },
  { a: 'g3', b: 'g4', skill: 0.55, def: 0 },
  { a: 'g5', b: 'g6', skill: 0.75, def: 0.5 },
  { a: 'g7', b: 'g8', skill: 0.95, def: 1 },
  { a: 'g2', b: 'g7', skill: 0.68, def: 0 },
  { a: 'g8', b: 'g3', skill: 0.88, def: -0.5 },
];

/** aiPossessionsOf (Hoops2.tsx) exactly: its game and its autoplay, seeded 'ai:' + seed. */
function aiGame(i: number): string {
  const G = GAMES[i];
  const A = squad(G.a);
  const B = squad(G.b);
  const seed = 'golden' + i;
  const g = newHoopsGame(A.five, B.five, 'ai:' + seed, POSSESSIONS, A.bench, G.def);
  autoplay(g, G.skill, 'ai:' + seed);
  return g.score + '|' + g.marks.join(',');
}

/** autoplay's own loop, step by step, with each possession's end and final clock. */
function stepped(i: number): string {
  const G = GAMES[i];
  const A = squad(G.a);
  const B = squad(G.b);
  const seed = 'golden-step' + i;
  const g = newHoopsGame(A.five, B.five, seed, POSSESSIONS, A.bench, G.def);
  const pl = pilot(G.skill, seed);
  const ends: string[] = [];
  while (!g.over) {
    const p = startPossession(g);
    pl.letGo = null;
    pl.driving = false;
    pl.goal = null;
    pl.nextThink = 0;
    pl.crosses = 0;
    for (let k = 0; k < 60 * 40 && !p.end; k++) {
      step(p, 1 / 60, decide(p, pl));
      p.events.length = 0;
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: 'SHOT CLOCK', who: -1 };
    ends.push(`${p.end.kind}:${p.end.points}:${p.end.who}:${p.end.text}@${p.t.toFixed(6)}`);
    afterPossession(g, p);
  }
  return g.score + '|' + g.marks.join(',') + '|' + ends.join(';');
}

/** Recorded from 78a1c86 (NBA_GOLDEN_RECORD=1 npx vitest run src/game/hoops2/golden.test.ts), then re-recorded at
 * nba-4 (the gold ring: gold is a make, the off-gold fall-off, the ring states, the range gate, the AI reading
 * the ring at its release, Heat in place of the per-player fire; protocol bump needed: NBA draft + UT). */
const GOLDEN_AI: string[] = [
  '20|X,2,TO,2,2,2,2,X,2,2,X,2,2,2,X,X',
  '17|X,2,X,X,X,X,2,X,2,2,2,3,2,X,2,X',
  '18|X,2,X,2,TO,A,X,TO,2,A,TO,X,2,TO,2,2',
  '8|TO,X,TO,TO,TO,2,2,TO,X,2,TO,TO,X,2,X,TO',
  '19|2,3,TO,2,2,X,2,2,X,TO,X,2,2,TO,2,X',
  '19|2,X,2,X,2,X,A,2,X,X,X,2,2,X,2,2',
];
const GOLDEN_STEPPED: string[] = [
  '22|X,2,2,2,2,2,2,2,2,X,X,X,X,2,2,2|miss:0:-1:REBOUND PF0@4.366667;make:2:4:SLAM!@4.666667;make:2:3:POSTERIZED!@6.033333;make:2:4:ALLEY-OOP!@3.933333;make:2:4:BUCKET@4.433333;make:2:0:BUCKET@4.983333;make:2:4:BUCKET@5.050000;make:2:4:SLAM!@4.266667;make:2:4:SLAM!@5.033333;miss:0:-1:REBOUND PG0@3.733333;miss:0:-1:REBOUND C0@7.000000;miss:0:-1:REBOUND SG0@9.250000;miss:0:-1:REBOUND PG0@4.166667;make:2:4:SLAM!@4.533333;make:2:0:BUCKET@4.800000;make:2:4:ALLEY-OOP!@5.933333',
  '21|X,2,2,2,X,2,TO,2,X,2,2,2,3,2,X,TO|miss:0:-1:REBOUND SF0@10.416667;make:2:4:ALLEY-OOP!@5.233333;make:2:4:BUCKET@7.000000;make:2:3:BUCKET@4.716667;miss:0:-1:REBOUND C0@3.700000;make:2:4:BUCKET@11.000000;steal:0:0:STRIPPED BY PG0@4.316667;make:2:4:BUCKET@7.150000;miss:0:-1:REBOUND C0@6.166667;make:2:4:SLAM!@7.950000;make:2:3:BUCKET@6.883333;make:2:4:BUCKET@8.216667;make:3:0:SPLASH!@7.283333;make:2:4:BUCKET@7.166667;miss:0:-1:REBOUND C0@12.133333;int:0:1:PICKED OFF BY SG0@2.333333',
  '17|2,3,2,X,TO,X,2,2,2,X,2,2,TO,X,X,X|make:2:0:SLAM!@10.433333;make:3:0:SPLASH!@7.400000;make:2:4:BUCKET@10.300000;miss:0:-1:REBOUND PF0@3.116667;steal:0:3:STRIPPED BY PF0@4.150000;miss:0:-1:REBOUND C0@11.066667;make:2:4:SLAM!@6.050000;make:2:4:BUCKET@10.550000;make:2:4:BUCKET@19.766667;miss:0:-1:REBOUND C0@10.800000;make:2:0:BUCKET@10.650000;make:2:4:ALLEY-OOP!@5.616667;steal:0:0:STRIPPED BY PG0@0.000000;miss:0:-1:REBOUND C0@5.900000;miss:0:-1:REBOUND C0@14.083333;miss:0:-1:REBOUND PF0@11.166667',
  '10|TO,X,TO,TO,2,X,X,X,TO,TO,2,2,2,TO,2,X|steal:0:0:STRIPPED BY PG0@1.266667;miss:0:-1:REBOUND C0@10.833333;steal:0:3:STRIPPED BY PF0@13.616667;steal:0:0:STRIPPED BY PG0@2.216667;make:2:4:BUCKET@10.483333;miss:0:-1:REBOUND SF0@11.350000;miss:0:-1:REBOUND C0@10.733333;miss:0:-1:REBOUND C0@11.816667;int:0:4:PICKED OFF BY PG0@9.200000;steal:0:0:STRIPPED BY PG0@8.983333;make:2:3:SLAM!@10.266667;make:2:4:BUCKET@10.433333;make:2:4:BUCKET@10.700000;steal:0:4:STRIPPED BY C0@11.733333;make:2:3:BUCKET@11.816667;miss:0:-1:REBOUND C0@7.033333',
  '18|2,X,2,X,TO,2,X,2,X,TO,2,X,2,2,2,2|make:2:4:SLAM!@9.633333;miss:0:-1:REBOUND PF0@11.033333;make:2:4:SLAM!@8.350000;miss:0:-1:REBOUND PF0@7.366667;steal:0:0:STRIPPED BY PG0@4.450000;make:2:4:SLAM!@7.433333;miss:0:-1:REBOUND C0@6.150000;make:2:4:BUCKET@6.783333;miss:0:-1:REBOUND PF0@6.566667;steal:0:0:STRIPPED BY PG0@0.916667;make:2:4:SLAM!@6.483333;miss:0:-1:REBOUND C0@10.833333;make:2:1:ALLEY-OOP!@7.650000;make:2:4:BUCKET@10.050000;make:2:4:BUCKET@5.016667;make:2:3:BUCKET@10.433333',
  '22|2,2,2,2,X,X,X,2,2,2,TO,2,2,TO,2,2|make:2:1:BUCKET@8.266667;make:2:3:BUCKET@5.200000;make:2:4:BUCKET@5.400000;make:2:1:BUCKET@6.250000;miss:0:-1:REBOUND C0@10.366667;miss:0:-1:REBOUND C0@13.766667;miss:0:-1:REBOUND SG0@4.566667;make:2:1:BUCKET@4.766667;make:2:4:SLAM!@9.266667;make:2:4:BUCKET@9.866667;steal:0:0:STRIPPED BY PG0@1.300000;make:2:1:BUCKET@6.233333;make:2:1:BUCKET@7.650000;steal:0:0:STRIPPED BY PG0@0.266667;make:2:1:BUCKET@8.133333;make:2:3:BUCKET@5.350000',
];

const SOURCES = import.meta.glob<string>(['./Hoops2.tsx'], { query: '?raw', import: 'default', eager: true });

describe('hoops2 golden AI games (base 78a1c86)', () => {
  if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.NBA_GOLDEN_RECORD === '1') {
    it('records', () => {
      console.log('GOLDEN ' + JSON.stringify({ ai: GAMES.map((_, i) => aiGame(i)), stepped: GAMES.map((_, i) => stepped(i)) }));
    }, 120_000);
    return;
  }

  it('aiPossessionsOf still plays exactly newHoopsGame + autoplay, seeded ai:<seed>', () => {
    const src = SOURCES['./Hoops2.tsx'].replace(/\s+/g, ' ');
    expect(src).toContain("const g = newHoopsGame(offense, defense, 'ai:' + seed, possessions, bench, defIQ); autoplay(g, skill, 'ai:' + seed);");
  });

  it('seeded AI games score and end exactly as on the base engine', () => {
    expect(GOLDEN_AI.length).toBe(GAMES.length);
    expect(GAMES.map((_, i) => aiGame(i))).toEqual(GOLDEN_AI);
  }, 120_000);

  it('the autoplay loop ends every possession at the same clock as on the base engine', () => {
    expect(GOLDEN_STEPPED.length).toBe(GAMES.length);
    expect(GAMES.map((_, i) => stepped(i))).toEqual(GOLDEN_STEPPED);
  }, 120_000);
});
