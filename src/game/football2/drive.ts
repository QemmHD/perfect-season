// A game of arcade football: a set number of drives from your own 25, four downs to make ten,
// a touchdown worth seven, a field goal three. Fourth down: go for it, kick (in your kicker's range)
// or punt it away (the drive ends). The last drive is a two-minute drill: the clock runs through
// each play and between plays that end in bounds; incompletions and out of bounds stop it. When it
// hits zero there's one last kick in range, or the drive's over. Only your own points count; the other side plays its drives on
// its own phone (or the autopilot plays the AI's).
import { hashString, rng } from '../../engine/rng';
import { CONCEPTS, lineUp, rt } from './engine';
import type { Call, Concept, Defense, Flag, Offense, Play, PlayEnd, RunPlay } from './types';

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
/** a Heat Check card in the offense gets the quarterback hot a completion sooner */
export function fireAtFor(g: Game): number {
  const o = g.off;
  return [o.qb, o.rb, o.te, ...o.wr].some((x) => x.abil.includes('heat-check')) ? FIRE_AT - 1 : FIRE_AT;
}

/** Icon cards on the last drive (the clutch): every attribute +3 (finite above 99). */
function clutchPlayer<T extends { abil: string[]; a: Record<string, number> }>(x: T): T {
  if (!x.abil.includes('icon')) return x;
  const a: Record<string, number> = {};
  for (const [k, v] of Object.entries(x.a)) a[k] = v + 3;
  return { ...x, a };
}
export function clutchSides(off: Offense, def: Defense): { off: Offense; def: Defense } {
  const c = clutchPlayer;
  return {
    off: { qb: c(off.qb), rb: c(off.rb), wr: [c(off.wr[0]), c(off.wr[1]), c(off.wr[2])], te: c(off.te), ol: [c(off.ol[0]), c(off.ol[1]), c(off.ol[2]), c(off.ol[3]), c(off.ol[4])], k: c(off.k) },
    def: { dl: [c(def.dl[0]), c(def.dl[1]), c(def.dl[2]), c(def.dl[3])], lb: [c(def.lb[0]), c(def.lb[1]), c(def.lb[2])], cb: [c(def.cb[0]), c(def.cb[1])], s: [c(def.s[0]), c(def.s[1])] }
  };
}

const RUNS: RunPlay[] = ['inside', 'outside', 'power'];

/**
 * Where a drive starts (Claude 2026-11-01): the kickoff (or the punt before it). About 45% are
 * touchbacks at the 25; the rest are returned to around the 25 (a spread of about five yards each
 * way, a little farther for a fast returner against slow coverage), and about one in twelve is a
 * big return out near midfield. Seeded by the game and the drive, so both phones agree.
 * Real drives start all over the field (NFL average start ~own 28-30); a fixed 25 left the four
 * drives no field-position luck at all.
 */
export function startSpot(g: Pick<Game, 'seed' | 'off' | 'def'>, drive: number): number {
  const r = rng(hashString('start:' + g.seed + ':' + drive));
  const u = r();
  if (u < 0.45) return START;
  const ret = Math.max(g.off.rb.a.SPD ?? 80, ...g.off.wr.map((w) => w.a.SPD ?? 80));
  const cov = [...g.def.lb, ...g.def.s].reduce((n, x) => n + (x.a.SPD ?? 80), 0) / (g.def.lb.length + g.def.s.length);
  const edge = Math.max(-3, Math.min(3, (ret - cov) * 0.25));
  if (u > 0.92) return Math.round(38 + r() * 14 + edge);
  const gauss = (r() + r() + r() - 1.5) * 10;
  return Math.round(Math.max(10, Math.min(40, START + gauss + edge)));
}

export function newGame(off: Offense, def: Defense, seed: string, drives = DRIVES, defIQ = 0): Game {
  const g: Game = { off, def, seed, drives, drive: 0, playNo: 0, down: 1, toGo: 10, ballOn: START, ballX: 26.67, score: 0, ends: [], over: false, concept: 'slants', conceptNo: 0, run: 'inside', plays: 0, streak: 0, fire: false, clock: drives <= 1 ? CLOCK : null, defIQ };
  g.ballOn = startSpot(g, 0);
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
  const last = g.drive === g.drives - 1;
  const sides = last ? clutchSides(g.off, g.def) : { off: g.off, def: g.def };
  const p = lineUp(sides.off, sides.def, call, g.concept, g.run, g.ballOn, g.ballX, r, g.defIQ);
  p.fire = g.fire;
  return p;
}

export function fgDistance(g: Game) {
  return Math.round(100 - g.ballOn + 17);
}

/** the kicker's longest try: 46 yards for a weak leg, 60 for a big one */
export function fgMax(g: Game) {
  // Big Leg: four more yards (always on: the range has to show before the kick)
  return Math.round(46 + 14 * rt(g.off.k.a.KPW, 55, 99) + (g.off.k.abil.includes('big-leg') ? 4 : 0));
}

export function fgInRange(g: Game) {
  return fgDistance(g) <= fgMax(g);
}

/** How wide the kick window is at this distance (0-1): wider for an accurate kicker, narrower long. */
export function kickWindow(g: Game) {
  const d = fgDistance(g);
  // smooth in accuracy from 40 (it flattened out below 55), still narrower the longer the kick
  const acc = rt(g.off.k.a.KAC, 40, 99);
  return Math.max(0.12, 0.36 + 0.3 * acc - Math.max(0, d - 20) * 0.014);
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
  /** an accepted flag (the play didn't count, or it was enforced instead) */
  flag?: Flag;
}

function endDrive(g: Game, e: DriveEnd) {
  g.ends.push(e);
  g.drive++;
  g.down = 1;
  g.toGo = 10;
  g.ballOn = startSpot(g, g.drive);
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

/** a rough value of a down, distance and spot for the offense (to decide on a flag) */
function worth(down: number, toGo: number, ballOn: number): number {
  return down > 4 ? -100 : ballOn - toGo * 1.2 - (down - 1) * 5;
}

/** What the play's result is worth to the offense, before any flag. */
function resultWorth(g: Game, end: PlayEnd): number {
  if (end.kind === 'td') return 1000;
  if (end.kind === 'int' || end.kind === 'fumble') return -1000;
  if (end.kind !== 'incomplete' && end.y <= 0) return -1000;
  const line = g.ballOn + g.toGo;
  const y = end.kind === 'incomplete' ? g.ballOn : Math.max(1, Math.min(99, end.y));
  if (line < 100 && y >= line) return worth(1, Math.min(10, 100 - y), y);
  return worth(g.down + 1, line >= 100 ? 100 - y : line - y, y);
}

/** Where a flag puts the ball (half the distance to the goal when it's closer than the yardage). */
function enforce(g: Game, f: Flag): { down: number; toGo: number; ballOn: number; first: boolean; yards: number } {
  const los = g.ballOn;
  if (f.by === 'O') {
    const yards = Math.min(10, Math.floor(los / 2));
    return { down: g.down, toGo: g.toGo + yards, ballOn: los - yards, first: false, yards };
  }
  if (f.kind === 'dpi') {
    const at = Math.max(los + 1, Math.min(99, Math.round(f.spot ?? los + 15)));
    return { down: 1, toGo: Math.min(10, 100 - at), ballOn: at, first: true, yards: at - los };
  }
  const yards = Math.min(5, Math.floor((100 - los) / 2));
  const at = los + yards;
  const auto = f.kind === 'def-holding' || yards >= g.toGo;
  return auto ? { down: 1, toGo: Math.min(10, 100 - at), ballOn: at, first: true, yards } : { down: g.down, toGo: g.toGo - yards, ballOn: at, first: false, yards };
}

const FLAG_NAMES: Record<Flag['kind'], string> = { holding: 'HOLDING, OFFENSE', 'def-holding': 'HOLDING, DEFENSE', offside: 'OFFSIDE, DEFENSE', dpi: 'PASS INTERFERENCE' };

/** A flag on the play, if the side that didn't foul takes it: the play doesn't count. */
function flagged(g: Game, end: PlayEnd): After | null {
  const f = end.flag;
  if (!f || end.kind === 'td') return null;
  const e = enforce(g, f);
  const pen = worth(e.down, e.toGo, e.ballOn) + (e.first ? 10 : 0);
  const res = resultWorth(g, end);
  // the defense declines the offense's flag when the play was worse for the offense (a sack, a
  // pick, a stop on fourth down); the offense declines the defense's when the play was better
  if (f.by === 'O' ? res <= pen : res >= pen) return null;
  g.playNo++;
  g.plays++;
  g.conceptNo = 0;
  g.concept = conceptFor(g, 0);
  g.run = runFor(g);
  g.down = e.down;
  g.toGo = Math.max(0.3, e.toGo);
  g.ballOn = e.ballOn;
  const n = ['1ST', '2ND', '3RD', '4TH'][g.down - 1];
  const text = 'FLAG · ' + FLAG_NAMES[f.kind] + ' · ' + f.tag + ' · ' + e.yards + ' YDS' + (e.first ? ' · FIRST DOWN' : ' · REPEAT ' + n + ' DOWN');
  return { text, firstDown: e.first, points: 0, driveOver: null, fourth: !e.first && g.down === 4, fire: null, timeUp: false, flag: f };
}

function settle(g: Game, end: PlayEnd): After {
  const fl = flagged(g, end);
  if (fl) return fl;
  // On Fire: three completions in a row; an incompletion, a sack or a pick puts it out
  const was = g.fire;
  if (end.caught) {
    g.streak++;
    if (g.streak >= fireAtFor(g)) g.fire = true;
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
