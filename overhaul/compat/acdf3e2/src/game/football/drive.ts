// A game of arcade football: a set number of drives, each from your own 25, four downs to make ten
// yards, a touchdown worth seven, a field goal three. Only your own points count; the other side
// plays its drives on its own phone (or, against the AI, the autopilot plays them).
import { hashString, rng } from '../../engine/rng';
import type { Squad } from './model';
import { type Call, type Concept, CONCEPTS, lineUp, type Play, type PlayEnd } from './play';

export const DRIVES = 4;
export const START = 25;
/** the longest field goal on offer */
export const FG_MAX = 55;

export type DriveEnd = 'TD' | 'FG' | 'MISS' | 'INT' | 'DOWNS';

export interface Game {
  sq: Squad;
  seed: string;
  drives: number;
  drive: number;
  playNo: number;
  down: number;
  toGo: number;
  /** the line of scrimmage, yards from your own goal */
  ballOn: number;
  ballX: number;
  score: number;
  ends: DriveEnd[];
  over: boolean;
  /** the next pass play's concept, shown before the snap */
  concept: Concept;
  conceptNo: number;
}

export function newGame(sq: Squad, seed: string, drives = DRIVES): Game {
  const g: Game = { sq, seed, drives, drive: 0, playNo: 0, down: 1, toGo: 10, ballOn: START, ballX: 26.67, score: 0, ends: [], over: false, concept: 'slants', conceptNo: 0 };
  g.concept = conceptFor(g, 0);
  return g;
}

function conceptFor(g: Game, n: number): Concept {
  const r = rng(hashString('concept:' + g.seed + ':' + g.drive + ':' + g.playNo + ':' + n));
  return CONCEPTS[Math.floor(r() * CONCEPTS.length)];
}

/** Another pass play, before the snap. */
export function nextConcept(g: Game) {
  const was = g.concept;
  for (let i = 1; i < 6 && g.concept === was; i++) g.concept = conceptFor(g, ++g.conceptNo);
  if (g.concept === was) g.concept = CONCEPTS[(CONCEPTS.indexOf(was) + 1) % CONCEPTS.length];
}

/** The play the next snap runs. Each play has its own dice, from the game's seed. */
export function startPlay(g: Game, call: Call): Play {
  const r = rng(hashString('play:' + g.seed + ':' + g.drive + ':' + g.playNo));
  return lineUp(g.sq, call, g.concept, g.ballOn, g.ballX, r);
}

export function fgDistance(g: Game) {
  return Math.round(100 - g.ballOn + 17);
}

export function fgInRange(g: Game) {
  return fgDistance(g) <= FG_MAX;
}

export interface After {
  /** a pop-up: FIRST DOWN, TOUCHDOWN, 4TH DOWN… */
  text: string;
  firstDown: boolean;
  /** points just scored */
  points: number;
  driveOver: DriveEnd | null;
  /** fourth down is next: go for it or kick */
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
  g.conceptNo = 0;
  g.concept = conceptFor(g, 0);
  if (end.kind === 'td') {
    g.score += 7;
    endDrive(g, 'TD');
    return { text: 'TOUCHDOWN', firstDown: false, points: 7, driveOver: 'TD', fourth: false };
  }
  if (end.kind === 'int') {
    endDrive(g, 'INT');
    return { text: 'INTERCEPTED', firstDown: false, points: 0, driveOver: 'INT', fourth: false };
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

/**
 * A field goal try. `aim` is how close to center the kick meter stopped, 0 (dead center) to 1 (the
 * edge): the window narrows with the distance.
 */
export function kick(g: Game, aim: number): After {
  const d = fgDistance(g);
  const window = Math.max(0.16, 0.72 - (d - 20) * 0.016);
  const good = aim <= window;
  g.playNo++;
  if (good) g.score += 3;
  endDrive(g, good ? 'FG' : 'MISS');
  return { text: good ? 'FIELD GOAL IS GOOD' : 'NO GOOD', firstDown: false, points: good ? 3 : 0, driveOver: good ? 'FG' : 'MISS', fourth: false };
}

/** How wide the kick window is at this distance (0-1), for drawing the meter. */
export function kickWindow(g: Game) {
  return Math.max(0.16, 0.72 - (fgDistance(g) - 20) * 0.016);
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
