// The nfl-5 measuring kit (tests and scripts/nfl_brain.ts only; imports.test.ts keeps every product
// file from importing it). Two experiments on the AI's football brain, through the real engine and
// autopilot:
//
// - conceptMatrix: every pass concept snapped against every defensive call (forced), many seeded
//   snaps a cell, the AI passer at Pro: how each call holds each concept (completion per dropback:
//   a sack, a throwaway or a scramble is no completion), and its sacks and 20+ yard plays.
// - coachTrial: snaps from real AI games; at each, the tray's three cards (choices) are each
//   replayed from that same snap (the same seed, so the same defensive call and the same breaks)
//   with several passer seeds, and Coach Pick's card is scored against the mean of the other two.
import { hashString, rng } from '../../engine/rng';
import { chooseCall, decide, fourthDown, pilot } from './autopilot';
import { CALL_IDS, CALLS, type Called, type DefCallId } from './calls';
import { afterPlay, choices, coachFor, DRIVES, type Game, kick, newGame, punt, startChoice, startPlay } from './drive';
import { CONCEPTS, FIELD_W, lineUp, snap, step } from './engine';
import { type Band, LEVELS, type Teams, wilson } from './sim-kit';
import type { Concept, Play, PlayEnd } from './types';

const DT = 1 / 60;
const clone = <T>(x: T): T => structuredClone(x);

/** Run a lined-up play to its whistle with the AI pilot. */
function runPlay(p: Play, g: Game, skill: number, seed: string): PlayEnd {
  const pl = pilot(skill, seed);
  snap(p);
  pl.readAt = 0;
  for (let i = 0; i < 60 * 25 && !p.end; i++) {
    const steer = decide(p, g, pl);
    step(p, DT, steer);
    p.events.length = 0;
  }
  return p.end!;
}

export interface Matrix {
  concepts: Concept[];
  calls: DefCallId[];
  reps: number;
  /** completion per dropback, sacks per dropback and yards per dropback, [concept][call] */
  cmp: Record<string, Record<string, number>>;
  sack: Record<string, Record<string, number>>;
  ypd: Record<string, Record<string, number>>;
  conceptAvg: Record<string, number>;
  callAvg: Record<string, number>;
  /** each call's best concept, and by how much it beats the call's average */
  callBeater: Record<string, { concept: Concept; by: number }>;
  /** each concept's best call against it, and by how much it holds it under the concept's average */
  conceptStopper: Record<string, { call: DefCallId; by: number }>;
  blitzSack: number;
  baseSack: number;
  blitz20: number;
  base20: number;
}

/** Every concept against every call, `reps` seeded snaps a cell (1st and 10 at the 35, the ball on a random spot between the hashes). */
export function conceptMatrix(teams: Teams, reps: number, seed: string, skill = LEVELS.pro.skill): Matrix {
  const cmp: Record<string, Record<string, number>> = {};
  const sack: Record<string, Record<string, number>> = {};
  const ypd: Record<string, Record<string, number>> = {};
  const n = { bz: { drop: 0, sack: 0, big: 0 }, base: { drop: 0, sack: 0, big: 0 } };
  for (const k of CONCEPTS) {
    cmp[k] = {};
    sack[k] = {};
    ypd[k] = {};
    for (const id of CALL_IDS) {
      let caught = 0;
      let sacks = 0;
      let yards = 0;
      for (let i = 0; i < reps; i++) {
        const s = seed + ':' + k + ':' + id + ':' + i;
        const t = clone(teams);
        const g = newGame(t.off, t.def, s, DRIVES, 0);
        const r = rng(hashString('mx:' + s));
        const x = FIELD_W / 2 + (r() * 2 - 1) * 3;
        const called: Called = { call: CALLS[id], shown: CALLS[id].shell, tell: false };
        const p = lineUp(t.off, t.def, 'pass', k, 'inside', 35, x, r, 0, called);
        const e = runPlay(p, g, skill, 'mxp:' + s);
        const fam = CALLS[id].family === 'BLITZ' ? n.bz : n.base;
        fam.drop++;
        if (e.kind === 'sack') fam.sack++;
        if (e.gain >= 20) fam.big++;
        if (e.caught) caught++;
        if (e.kind === 'sack') sacks++;
        if (e.kind !== 'int') yards += e.gain;
      }
      cmp[k][id] = caught / reps;
      sack[k][id] = sacks / reps;
      ypd[k][id] = yards / reps;
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const conceptAvg = Object.fromEntries(CONCEPTS.map((k) => [k, mean(CALL_IDS.map((c) => cmp[k][c]))]));
  const callAvg = Object.fromEntries(CALL_IDS.map((c) => [c, mean(CONCEPTS.map((k) => cmp[k][c]))]));
  const callBeater = Object.fromEntries(
    CALL_IDS.map((c) => {
      const best = CONCEPTS.reduce((a, b) => (cmp[b][c] > cmp[a][c] ? b : a));
      return [c, { concept: best, by: cmp[best][c] - callAvg[c] }];
    })
  );
  const conceptStopper = Object.fromEntries(
    CONCEPTS.map((k) => {
      const best = CALL_IDS.reduce((a, b) => (cmp[k][b] < cmp[k][a] ? b : a));
      return [k, { call: best, by: conceptAvg[k] - cmp[k][best] }];
    })
  );
  return {
    concepts: CONCEPTS,
    calls: CALL_IDS,
    reps,
    cmp,
    sack,
    ypd,
    conceptAvg,
    callAvg,
    callBeater,
    conceptStopper,
    blitzSack: n.bz.sack / n.bz.drop,
    baseSack: n.base.sack / n.base.drop,
    blitz20: n.bz.big / n.bz.drop,
    base20: n.base.big / n.base.drop
  };
}

/**
 * What a snap was worth to the offense, for comparing cards replayed from the same snap: a
 * successful play (40% of the distance on first down, 60% on second, all of it on third and
 * fourth) counts 1, plus a little for every yard (up to 40) and minus the yards lost, and a
 * turnover costs 1.5.
 */
export function snapValue(g: Pick<Game, 'down' | 'toGo'>, e: PlayEnd): number {
  const need = g.down === 1 ? 0.4 * g.toGo : g.down === 2 ? 0.6 * g.toGo : g.toGo;
  const turnover = e.kind === 'int' || e.kind === 'fumble';
  const success = !turnover && (e.gain >= need || e.kind === 'td') ? 1 : 0;
  return success + 0.03 * Math.max(-10, Math.min(40, e.gain)) - (turnover ? 1.5 : 0);
}

export interface CoachTrial {
  snaps: number;
  replays: number;
  beats: number;
  band: Band;
  pickValue: number;
  otherValue: number;
}

/**
 * Coach Pick against the other two cards: `snaps` snaps taken from seeded AI games (Pro, every
 * down but fourth), each card replayed `replays` times from that snap. Coach Pick "beats" the snap
 * when its card's mean value is above the mean of the other two cards' means.
 */
export function coachTrial(teams: Teams, snaps: number, replays: number, seed: string, level = LEVELS.pro): CoachTrial {
  let taken = 0;
  let beat = 0;
  let pickSum = 0;
  let otherSum = 0;
  for (let gameNo = 0; taken < snaps && gameNo < snaps * 4; gameNo++) {
    const t = clone(teams);
    const g = newGame(t.off, t.def, seed + ':' + gameNo, DRIVES, level.defIQ);
    const pl = pilot(level.skill, 'cp:' + seed + ':' + gameNo);
    for (let guard = 0; !g.over && guard < 300 && taken < snaps; guard++) {
      if (g.down === 4) {
        const d = fourthDown(g);
        if (d === 'kick') {
          kick(g, 0.05);
          continue;
        }
        if (d === 'punt') {
          punt(g);
          continue;
        }
      }
      if (g.down < 4) {
        const cards = choices(g);
        const pickIx = coachFor(g, cards).index;
        const v = cards.map((card, ci) => {
          let sum = 0;
          for (let j = 0; j < replays; j++) {
            const h = clone(g);
            const p = startChoice(h, card);
            sum += snapValue(g, runPlay(p, h, level.skill, 'cf:' + seed + ':' + gameNo + ':' + g.plays + ':' + ci + ':' + j));
          }
          return sum / replays;
        });
        const others = v.filter((_, i) => i !== pickIx);
        const rest = others.reduce((a, b) => a + b, 0) / others.length;
        pickSum += v[pickIx];
        otherSum += rest;
        if (v[pickIx] > rest) beat++;
        taken++;
      }
      // the game goes on with the AI's own call
      const p = startPlay(g, chooseCall(g, pl));
      const e = runPlay(p, g, level.skill, 'cpp:' + seed + ':' + gameNo + ':' + g.plays);
      afterPlay(g, e);
    }
  }
  return { snaps: taken, replays, beats: beat / Math.max(1, taken), band: wilson(beat, taken), pickValue: pickSum / Math.max(1, taken), otherValue: otherSum / Math.max(1, taken) };
}
