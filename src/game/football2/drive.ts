// A game of arcade football: a set number of drives from your own 25, four downs to make ten,
// a touchdown worth seven, a field goal three. Fourth down: go for it, kick (in your kicker's range)
// or punt it away (the drive ends). Only your own points count; the other side plays its drives on
// its own phone (or the autopilot plays the AI's).
import { hashString, rng } from '../../engine/rng';
import { CONCEPTS, lineUp, rt } from './engine';
import type { Call, Concept, Defense, Offense, Play, PlayEnd, RunPlay } from './types';

export const DRIVES = 4;
export const START = 25;

export type DriveEnd = 'TD' | 'FG' | 'MISS' | 'INT' | 'DOWNS' | 'PUNT' | 'FUM';
export const END_POINTS: Record<DriveEnd, number> = { TD: 7, FG: 3, MISS: 0, INT: 0, DOWNS: 0, PUNT: 0, FUM: 0 };

export interface Game {
  off: Offense;
  def: Defense;
  seed: string;
  drives: number;
  drive: number;
  playNo: number;
  down: number;
  toGo: number;
  ballOn: number;
  ballX: number;
  score: number;
  ends: DriveEnd[];
  over: boolean;
  concept: Concept;
  conceptNo: number;
  run: RunPlay;
  /** plays run, for the activity the rival's phone sees */
  plays: number;
}

const RUNS: RunPlay[] = ['inside', 'outside', 'power'];

export function newGame(off: Offense, def: Defense, seed: string, drives = DRIVES): Game {
  const g: Game = { off, def, seed, drives, drive: 0, playNo: 0, down: 1, toGo: 10, ballOn: START, ballX: 26.67, score: 0, ends: [], over: false, concept: 'slants', conceptNo: 0, run: 'inside', plays: 0 };
  g.concept = conceptFor(g, 0);
  g.run = runFor(g);
  return g;
}

function conceptFor(g: Game, n: number): Concept {
  const r = rng(hashString('concept:' + g.seed + ':' + g.drive + ':' + g.playNo + ':' + n));
  return CONCEPTS[Math.floor(r() * CONCEPTS.length)];
}

function runFor(g: Game): RunPlay {
  const r = rng(hashString('run:' + g.seed + ':' + g.drive + ':' + g.playNo));
  return RUNS[Math.floor(r() * RUNS.length)];
}

/** Another pass play, before the snap. */
export function nextConcept(g: Game) {
  const was = g.concept;
  for (let i = 1; i < 8 && g.concept === was; i++) g.concept = conceptFor(g, ++g.conceptNo);
  if (g.concept === was) g.concept = CONCEPTS[(CONCEPTS.indexOf(was) + 1) % CONCEPTS.length];
}

export function startPlay(g: Game, call: Call): Play {
  const r = rng(hashString('play:' + g.seed + ':' + g.drive + ':' + g.playNo));
  return lineUp(g.off, g.def, call, g.concept, g.run, g.ballOn, g.ballX, r);
}

export function fgDistance(g: Game) {
  return Math.round(100 - g.ballOn + 17);
}

/** the kicker's longest try: 46 yards for a weak leg, 60 for a big one */
export function fgMax(g: Game) {
  return Math.round(46 + 14 * rt(g.off.k.a.KPW, 55, 99));
}

export function fgInRange(g: Game) {
  return fgDistance(g) <= fgMax(g);
}

/** How wide the kick window is at this distance (0-1): wider for an accurate kicker, narrower long. */
export function kickWindow(g: Game) {
  const d = fgDistance(g);
  const acc = rt(g.off.k.a.KAC, 55, 99);
  return Math.max(0.12, 0.5 + 0.32 * acc - Math.max(0, d - 20) * 0.014);
}

export interface After {
  text: string;
  firstDown: boolean;
  points: number;
  driveOver: DriveEnd | null;
  fourth: boolean;
}

function endDrive(g: Game, e: DriveEnd) {
  g.ends.push(e);
  g.drive++;
  g.down = 1;
  g.toGo = 10;
  g.ballOn = START;
  g.ballX = 26.67;
  if (g.drive >= g.drives) g.over = true;
}

/** Apply a finished play to the drive. */
export function afterPlay(g: Game, end: PlayEnd): After {
  g.playNo++;
  g.plays++;
  g.conceptNo = 0;
  g.concept = conceptFor(g, 0);
  g.run = runFor(g);
  if (end.kind === 'td') {
    g.score += 7;
    endDrive(g, 'TD');
    return { text: 'TOUCHDOWN', firstDown: false, points: 7, driveOver: 'TD', fourth: false };
  }
  if (end.kind === 'int') {
    endDrive(g, 'INT');
    return { text: end.text, firstDown: false, points: 0, driveOver: 'INT', fourth: false };
  }
  if (end.kind === 'fumble') {
    endDrive(g, 'FUM');
    return { text: end.text, firstDown: false, points: 0, driveOver: 'FUM', fourth: false };
  }
  const gain = end.kind === 'incomplete' ? 0 : end.y - g.ballOn;
  if (end.kind !== 'incomplete') {
    g.ballOn = Math.max(1, Math.min(99, end.y));
    g.ballX = end.x;
  }
  if (gain >= g.toGo) {
    g.down = 1;
    g.toGo = Math.min(10, 100 - g.ballOn);
    return { text: 'FIRST DOWN', firstDown: true, points: 0, driveOver: null, fourth: false };
  }
  g.toGo = Math.max(0.5, g.toGo - gain);
  if (g.down === 4) {
    endDrive(g, 'DOWNS');
    return { text: 'TURNOVER ON DOWNS', firstDown: false, points: 0, driveOver: 'DOWNS', fourth: false };
  }
  g.down++;
  return { text: end.text, firstDown: false, points: 0, driveOver: null, fourth: g.down === 4 };
}

/** A field goal try: `aim` is how far from center the meter stopped (0 dead center to 1 the edge). */
export function kick(g: Game, aim: number): After {
  const good = aim <= kickWindow(g) && fgInRange(g);
  g.playNo++;
  g.plays++;
  if (good) g.score += 3;
  endDrive(g, good ? 'FG' : 'MISS');
  return { text: good ? 'FIELD GOAL IS GOOD' : 'NO GOOD', firstDown: false, points: good ? 3 : 0, driveOver: good ? 'FG' : 'MISS', fourth: false };
}

/** Punt it away on fourth down: the drive's over, no points. */
export function punt(g: Game): After {
  g.playNo++;
  g.plays++;
  endDrive(g, 'PUNT');
  return { text: 'PUNT', firstDown: false, points: 0, driveOver: 'PUNT', fourth: false };
}

export function downText(g: Game) {
  const n = ['1ST', '2ND', '3RD', '4TH'][g.down - 1];
  const togo = g.ballOn + g.toGo >= 100 ? 'GOAL' : g.toGo < 1 ? 'INCHES' : String(Math.round(g.toGo));
  return n + ' & ' + togo;
}

export function spotText(ballOn: number) {
  const y = Math.round(ballOn);
  if (y === 50) return 'MIDFIELD';
  return y < 50 ? 'OWN ' + y : 'OPP ' + (100 - y);
}
