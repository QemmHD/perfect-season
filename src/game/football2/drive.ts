// A game of arcade football: a set number of drives from your own 25, four downs to make ten,
// a touchdown worth seven, a field goal three. Fourth down: go for it, kick (in your kicker's range)
// or punt it away (the drive ends). The last drive is a two-minute drill: the clock runs through
// each play and between plays that end in bounds; incompletions and out of bounds stop it. When it
// hits zero there's one last kick in range, or the drive's over. Only your own points count; the other side plays its drives on
// its own phone (or the autopilot plays the AI's).
import { hashString, rng } from '../../engine/rng';
import { CONCEPTS, lineUp, rt } from './engine';
import type { Call, Concept, Defense, Offense, Play, PlayEnd, RunPlay } from './types';

export const DRIVES = 4;
export const START = 25;

export type DriveEnd = 'TD' | 'FG' | 'MISS' | 'INT' | 'DOWNS' | 'PUNT' | 'FUM' | 'SAF' | 'TIME';
export const END_POINTS: Record<DriveEnd, number> = { TD: 7, FG: 3, MISS: 0, INT: 0, DOWNS: 0, PUNT: 0, FUM: 0, SAF: 0, TIME: 0 };

/** the last drive's clock (seconds), and what comes off it between plays when it keeps running */
export const CLOCK = 120;
export const RUNOFF = 20;

export interface Game {
  off: Offense;
  def: Defense;
  seed: string;
  drives: number;
  /** how well the defense plays beyond its ratings (Squad Battles' difficulty; 0 standard) */
  defIQ: number;
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
  /** completions in a row, and whether that has the quarterback On Fire */
  streak: number;
  fire: boolean;
  /** the two-minute clock on the last drive (seconds left; null before it) */
  clock: number | null;
}

/** completions in a row that put the quarterback On Fire */
export const FIRE_AT = 3;

const RUNS: RunPlay[] = ['inside', 'outside', 'power'];

export function newGame(off: Offense, def: Defense, seed: string, drives = DRIVES, defIQ = 0): Game {
  const g: Game = { off, def, seed, drives, drive: 0, playNo: 0, down: 1, toGo: 10, ballOn: START, ballX: 26.67, score: 0, ends: [], over: false, concept: 'slants', conceptNo: 0, run: 'inside', plays: 0, streak: 0, fire: false, clock: drives <= 1 ? CLOCK : null, defIQ };
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

export interface PlayChoice {
  call: Call;
  concept: Concept;
  run: RunPlay;
}

/** The three plays offered before a snap: two different pass plays and the down's run play. */
export function choices(g: Game): PlayChoice[] {
  const a = conceptFor(g, 0);
  let b = a;
  for (let i = 1; i < 10 && b === a; i++) b = conceptFor(g, i);
  if (b === a) b = CONCEPTS[(CONCEPTS.indexOf(a) + 3) % CONCEPTS.length];
  return [
    { call: 'pass', concept: a, run: g.run },
    { call: 'pass', concept: b, run: g.run },
    { call: 'run', concept: a, run: g.run },
  ];
}

/** Line up one of the offered plays. */
export function startChoice(g: Game, c: PlayChoice): Play {
  g.concept = c.concept;
  g.run = c.run;
  return startPlay(g, c.call);
}

export function startPlay(g: Game, call: Call): Play {
  const r = rng(hashString('play:' + g.seed + ':' + g.drive + ':' + g.playNo));
  const p = lineUp(g.off, g.def, call, g.concept, g.run, g.ballOn, g.ballX, r, g.defIQ);
  p.fire = g.fire;
  return p;
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
  /** the quarterback just caught fire, or the fire just went out */
  fire: 'lit' | 'out' | null;
  /** the clock ran out with the ball in field goal range: one last kick */
  timeUp: boolean;
}

function endDrive(g: Game, e: DriveEnd) {
  g.ends.push(e);
  g.drive++;
  g.down = 1;
  g.toGo = 10;
  g.ballOn = START;
  g.ballX = 26.67;
  g.clock = g.drive === g.drives - 1 ? CLOCK : null;
  if (g.drive >= g.drives) g.over = true;
}

/** Apply a finished play to the drive (and, on the last drive, to the clock). */
export function afterPlay(g: Game, end: PlayEnd): After {
  const a = settle(g, end);
  if (g.clock === null || a.driveOver) return a;
  // the clock ran through the play, and between plays unless it stopped (an incompletion, out of bounds)
  const stops = end.kind === 'incomplete' || end.kind === 'out';
  g.clock = Math.max(0, g.clock - end.secs - (stops ? 0 : RUNOFF));
  if (g.clock > 0) return a;
  if (fgInRange(g)) {
    g.down = 4;
    return { ...a, fourth: true, timeUp: true };
  }
  endDrive(g, 'TIME');
  return { ...a, text: 'TIME’S UP', firstDown: false, driveOver: 'TIME', fourth: false };
}

function settle(g: Game, end: PlayEnd): After {
  // On Fire: three completions in a row; an incompletion, a sack or a pick puts it out
  const was = g.fire;
  if (end.caught) {
    g.streak++;
    if (g.streak >= FIRE_AT) g.fire = true;
  } else if (end.kind === 'incomplete' || end.kind === 'sack' || end.kind === 'int') {
    g.streak = 0;
    g.fire = false;
  }
  const fire = !was && g.fire ? 'lit' : was && !g.fire ? 'out' : null;
  g.playNo++;
  g.plays++;
  g.conceptNo = 0;
  g.concept = conceptFor(g, 0);
  g.run = runFor(g);
  if (end.kind === 'td') {
    g.score += 7;
    endDrive(g, 'TD');
    return { text: 'TOUCHDOWN', firstDown: false, points: 7, driveOver: 'TD', fourth: false, fire, timeUp: false };
  }
  if (end.kind === 'int') {
    endDrive(g, 'INT');
    return { text: end.text, firstDown: false, points: 0, driveOver: 'INT', fourth: false, fire, timeUp: false };
  }
  if (end.kind === 'fumble') {
    endDrive(g, 'FUM');
    return { text: end.text, firstDown: false, points: 0, driveOver: 'FUM', fourth: false, fire, timeUp: false };
  }
  // the line to gain is fixed before the snap; at or past the goal line it's goal to go (only a
  // touchdown moves the chains)
  const line = g.ballOn + g.toGo;
  const goalToGo = line >= 100;
  if (end.kind !== 'incomplete' && end.y <= 0) {
    // brought down in his own end zone: a safety ends the drive
    endDrive(g, 'SAF');
    return { text: 'SAFETY', firstDown: false, points: 0, driveOver: 'SAF', fourth: false, fire, timeUp: false };
  }
  if (end.kind !== 'incomplete') {
    g.ballOn = Math.max(1, Math.min(99, end.y));
    g.ballX = end.x;
  }
  if (!goalToGo && end.kind !== 'incomplete' && end.y >= line) {
    g.down = 1;
    g.toGo = Math.min(10, 100 - g.ballOn);
    return { text: 'FIRST DOWN', firstDown: true, points: 0, driveOver: null, fourth: false, fire, timeUp: false };
  }
  g.toGo = goalToGo ? 100 - g.ballOn : Math.max(0.3, line - g.ballOn);
  if (g.down === 4) {
    endDrive(g, 'DOWNS');
    return { text: 'TURNOVER ON DOWNS', firstDown: false, points: 0, driveOver: 'DOWNS', fourth: false, fire, timeUp: false };
  }
  g.down++;
  return { text: end.text, firstDown: false, points: 0, driveOver: null, fourth: g.down === 4, fire, timeUp: false };
}

/** A field goal try: `aim` is how far from center the meter stopped (0 dead center to 1 the edge). */
export function kick(g: Game, aim: number): After {
  const good = aim <= kickWindow(g) && fgInRange(g);
  g.playNo++;
  g.plays++;
  if (good) g.score += 3;
  endDrive(g, good ? 'FG' : 'MISS');
  return { text: good ? 'FIELD GOAL IS GOOD' : 'NO GOOD', firstDown: false, points: good ? 3 : 0, driveOver: good ? 'FG' : 'MISS', fourth: false, fire: null, timeUp: false };
}

/** Punt it away on fourth down: the drive's over, no points. */
export function punt(g: Game): After {
  g.playNo++;
  g.plays++;
  endDrive(g, 'PUNT');
  return { text: 'PUNT', firstDown: false, points: 0, driveOver: 'PUNT', fourth: false, fire: null, timeUp: false };
}

/** The clock as the scoreboard shows it: 1:42, or 0:07. */
export function clockText(secs: number) {
  const s = Math.max(0, Math.ceil(secs));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
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
