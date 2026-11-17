// A game of arcade football: a set number of drives from your own 25, four downs to make ten,
// a touchdown worth seven, a field goal three. Fourth down: go for it, kick (in your kicker's range)
// or punt it away (the drive ends). The last drive is a two-minute drill: the clock runs through
// each play and between plays that end in bounds; incompletions and out of bounds stop it. When it
// hits zero there's one last kick in range, or the drive's over. Only your own points count; the other side plays its drives on
// its own phone (or the autopilot plays the AI's).
//
// Heat (Claude, studio overhaul nfl-4; V2 §B.0.2, contract C18) is the game's own integer state: a
// PERFECT moment +12, a touchdown +25, a stop or takeaway by your defense +15, a clean first down +5, a
// turnover -20, points conceded -10 (solo). HEATING UP at 66; ON FIRE at 100 for your next 3 snaps
// (4 with a Heat Check card), when every gold window is 1.25x wide and an uncontested amber sling
// is gold. The bar empties after drive 2. It replaced the quarterback's three-completion On Fire.
import { hashString, rng } from '../../engine/rng';
import { callFor, levelOfIQ, NO_TENDENCY, noteTendency, type Situation, type Tendency } from './calls';
import { coachPick, dealConcepts, dealRuns, passCards } from './coach';
import { CONCEPTS, lineUp, rt } from './engine';
import { addHeat, COLD, FIRE_UNITS, type Heat, type HeatEv, spendFire } from './shared-v2';
import type { MatchGrade } from '../progress';
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
  /** Heat (nfl-4): the bar, On Fire snaps left, the match's best and how often it lit */
  heat: Heat;
  /** this set of downs has had a sack (its first down isn't clean) */
  seriesSacked: boolean;
  /** the match grade's counts (nfl-4, C22): PERFECT moments, gold rings offered, turnovers; and
   * each player's PERFECT moments (FbPlayer id), for the box score's `pf` (nfl-9) */
  perfects: number;
  chances: number;
  turnovers: number;
  pf: Record<string, number>;
  /** the two-minute clock on the last drive (seconds left; null before it) */
  clock: number | null;
  /** nfl-5: the offense's habits this game as the defense sees them (Legend's counters), and the
   * call lined up last (the snapped one: startPlay sets it, settle counts it) */
  tend: Tendency;
  snapCall?: { call: Call; down: number };
}

/** The down, distance, spot and clock a call is made for (nfl-5). */
export const situation = (g: Pick<Game, 'down' | 'toGo' | 'ballOn' | 'clock'>): Situation => ({ down: g.down, toGo: g.toGo, ballOn: g.ballOn, clock: g.clock });

/** ON FIRE's snaps: three, and four with a Heat Check card in the offense (it used to light the
 * old On Fire a completion sooner) */
export function fireSnapsFor(g: Pick<Game, 'off'>): number {
  const o = g.off;
  return FIRE_UNITS.nfl + ([o.qb, o.rb, o.te, ...o.wr].some((x) => x.abil.includes('heat-check')) ? 1 : 0);
}

/** The offense is ON FIRE for its next snap. */
export const onFire = (g: Pick<Game, 'heat'>): boolean => g.heat.fire > 0;

/** What a Heat event did: crossed 66 (HEATING UP), lit ON FIRE, or put it out. */
export interface HeatNews {
  heating: boolean;
  lit: boolean;
  out: boolean;
}
const NO_NEWS: HeatNews = { heating: false, lit: false, out: false };

/** One Heat event on the game (pure arithmetic on its integer state); what it did is added to `news`. */
export function heatEvent(g: Game, ev: HeatEv, news: HeatNews = { ...NO_NEWS }): HeatNews {
  const was = g.heat.fire > 0;
  const r = addHeat(g.heat, ev, 'nfl', fireSnapsFor(g));
  g.heat = r.h;
  news.heating = news.heating || r.heating;
  news.lit = news.lit || r.lit;
  news.out = news.out || (was && r.h.fire === 0);
  return news;
}

/** The rival's drive ends your defense earns Heat for: a takeaway, a stop (a punt, a turnover on
 * downs, a missed kick) or a safety. A drive the clock ran out on is neither. */
const STOPS = new Set(['INT', 'FUM', 'PUNT', 'DOWNS', 'MISS', 'SAF']);
const CONCEDED = new Set(['TD', 'FG', 'TD6', 'TD8']);

/** An end of the rival's drive, as your game hears it (solo only; online Heat is your offense's
 * alone, as the rival's timing is the network's): points conceded -10; a stop or a takeaway +15. */
export function rivalDriveEnd(g: Game, end: string): HeatNews {
  if (CONCEDED.has(end)) return heatEvent(g, 'conceded');
  if (STOPS.has(end)) return heatEvent(g, 'stop');
  return { ...NO_NEWS };
}

/**
 * The rival's Heat bar, from their wire ends only (online and solo; display only): a touchdown +25,
 * a turnover -20, emptied after their drive 2. Their On Fire shows until their next drive ends.
 */
export function heatFromEnds(ends: readonly string[]): Heat {
  let h = COLD;
  for (let i = 0; i < ends.length; i++) {
    const e = ends[i];
    const wasFire = h.fire > 0;
    if (e === 'TD' || e === 'TD6' || e === 'TD8') h = addHeat(h, 'score', 'nfl', 1).h;
    else if (e === 'INT' || e === 'FUM') h = addHeat(h, 'turnover', 'nfl', 1).h;
    if (wasFire && h.fire > 0) h = spendFire(h);
    if (i === 1) h = addHeat(h, 'half', 'nfl').h;
  }
  return h;
}

/**
 * The match grade (C22): your points a drive against par for the difficulty. PAR is provisional
 * (the human proxy's points a drive at nfl-1's baseline, a little under: Rookie 4.28, Pro 3.66,
 * Legend 2.20); nfl-10 fits it.
 */
export const PAR = { rookie: 4.0, pro: 3.4, legend: 2.1 } as const;
export type GradeLevel = keyof typeof PAR;
/** The par level for a defense's difficulty (defIQ: Rookie -0.5, Pro 0, Legend 1). */
export const gradeLevel = (defIQ: number): GradeLevel => (defIQ <= -0.25 ? 'rookie' : defIQ < 0.5 ? 'pro' : 'legend');
export function gradeLetter(ppd: number, par: number): 'S' | 'A' | 'B' | 'C' {
  return ppd >= par + 1.5 ? 'S' : ppd >= par + 0.5 ? 'A' : ppd >= par - 0.5 ? 'B' : 'C';
}

/** A finished game's grade (flawless is settled with the rival's score: progress.ts gradeResult). */
export function gradeOf(g: Game, level: GradeLevel, won = false): MatchGrade {
  const ppd = g.score / Math.max(1, g.ends.length);
  return { letter: gradeLetter(ppd, PAR[level]), perfects: g.perfects, chances: g.chances, heatBest: g.heat.best, lit: g.heat.lit, flawless: won && g.turnovers === 0, turnovers: g.turnovers };
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
  const g: Game = {
    off,
    def,
    seed,
    drives,
    drive: 0,
    playNo: 0,
    down: 1,
    toGo: 10,
    ballOn: START,
    ballX: 26.67,
    score: 0,
    ends: [],
    over: false,
    concept: 'slants',
    conceptNo: 0,
    run: 'inside',
    plays: 0,
    heat: COLD,
    seriesSacked: false,
    perfects: 0,
    chances: 0,
    turnovers: 0,
    pf: {},
    clock: drives <= 1 ? CLOCK : null,
    defIQ,
    tend: NO_TENDENCY
  };
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

/** The seed of the snap about to be called (the deal and the AI's call draw from it). */
export const snapSeed = (g: Pick<Game, 'seed' | 'drive' | 'playNo'>) => g.seed + ':' + g.drive + ':' + g.playNo;

/**
 * The tray's three cards (nfl-5, coach.ts): as many passes as the down and distance call for (the
 * AI's own run/pass table: three on third and long, one on third and short), the concepts that fit
 * the distance and the runs after them, all from the snap's seed. `only` deals a drill's kind alone.
 */
export function choices(g: Game, only?: Call): PlayChoice[] {
  const s = situation(g);
  // (a run or throw drill deals three of its own kind)
  const passes = only === 'run' ? 0 : only === 'pass' ? 3 : passCards(s);
  return [
    ...dealConcepts(snapSeed(g), s, passes).map((concept) => ({ call: 'pass' as const, concept, run: g.run })),
    ...dealRuns(snapSeed(g), s, 3 - passes).map((run) => ({ call: 'run' as const, concept: g.concept, run }))
  ];
}

/** Coach Pick among the cards for this snap (nfl-5): from the situation and the shell the defense shows, never its real call. */
export function coachFor(g: Game, cards: readonly PlayChoice[]) {
  return coachPick(cards, situation(g), defenseCall(g).shown);
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
  const p = lineUp(sides.off, sides.def, call, g.concept, g.run, g.ballOn, g.ballX, r, g.defIQ, defenseCall(g));
  p.fire = onFire(g);
  g.snapCall = { call, down: g.down };
  return p;
}

/**
 * The defense's call for this snap (nfl-5, calls.ts): from its own seeded stream, so whatever the
 * offense lines up (another card, an AUDIBLE, a flip) the defense keeps its call. Its sheet is its
 * difficulty's (Rookie, Pro or Legend by defIQ).
 */
export function defenseCall(g: Game) {
  const r = rng(hashString('dcall:' + g.seed + ':' + g.drive + ':' + g.playNo));
  return callFor(situation(g), levelOfIQ(g.defIQ), r, g.tend);
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
  /** Heat (nfl-4): the offense just went ON FIRE, or the fire just went out */
  fire: 'lit' | 'out' | null;
  /** the bar just crossed HEATING UP (66) */
  heating?: boolean;
  /** the clock ran out with the ball in field goal range: one last kick */
  timeUp: boolean;
  /** an accepted flag (the play didn't count, or it was enforced instead) */
  flag?: Flag;
}

function endDrive(g: Game, e: DriveEnd, news?: HeatNews) {
  g.ends.push(e);
  g.drive++;
  g.seriesSacked = false;
  // the bar empties after drive 2 (V2's "each half"), On Fire with it
  if (g.drive === 2 && g.drives > 2) {
    const was = g.heat.fire > 0;
    g.heat = addHeat(g.heat, 'half', 'nfl').h;
    if (news && was) news.out = true;
  }
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

/** What the Heat news says for After. */
const fireOf = (n: HeatNews): After['fire'] => (n.lit ? 'lit' : n.out ? 'out' : null);

function settle(g: Game, end: PlayEnd): After {
  // Heat: a snap played On Fire uses one of its snaps; the play's PERFECT moments count (+12 each)
  // whatever becomes of the play (a flag takes back the yards, not the moment)
  const news: HeatNews = { ...NO_NEWS };
  if (g.heat.fire > 0) {
    g.heat = spendFire(g.heat);
    if (g.heat.fire === 0) news.out = true;
  }
  for (const id of end.perfects ?? []) {
    g.perfects++;
    g.pf[id] = (g.pf[id] ?? 0) + 1;
    heatEvent(g, 'perfect', news);
  }
  g.chances += end.chances ?? 0;
  // the defense remembers what the offense called (Legend's counters), flags and all
  if (g.snapCall) g.tend = noteTendency(g.tend, g.snapCall.down, g.snapCall.call, end.caught && end.gain >= 15);
  g.snapCall = undefined;
  const fl = flagged(g, end);
  if (fl) return { ...fl, fire: fireOf(news), heating: news.heating };
  const a = settlePlay(g, end, news);
  return { ...a, fire: fireOf(news), heating: news.heating };
}

function settlePlay(g: Game, end: PlayEnd, news: HeatNews): After {
  const fire = null;
  if (end.kind === 'sack') g.seriesSacked = true;
  g.playNo++;
  g.plays++;
  g.conceptNo = 0;
  g.concept = conceptFor(g, 0);
  g.run = runFor(g);
  if (end.kind === 'td') {
    g.score += 7;
    heatEvent(g, 'score', news);
    endDrive(g, 'TD', news);
    return { text: 'TOUCHDOWN', firstDown: false, points: 7, driveOver: 'TD', fourth: false, fire, timeUp: false };
  }
  if (end.kind === 'int') {
    g.turnovers++;
    heatEvent(g, 'turnover', news);
    endDrive(g, 'INT', news);
    return { text: end.text, firstDown: false, points: 0, driveOver: 'INT', fourth: false, fire, timeUp: false };
  }
  if (end.kind === 'fumble') {
    g.turnovers++;
    heatEvent(g, 'turnover', news);
    endDrive(g, 'FUM', news);
    return { text: end.text, firstDown: false, points: 0, driveOver: 'FUM', fourth: false, fire, timeUp: false };
  }
  // the line to gain is fixed before the snap; at or past the goal line it's goal to go (only a
  // touchdown moves the chains)
  const line = g.ballOn + g.toGo;
  const goalToGo = line >= 100;
  if (end.kind !== 'incomplete' && end.y <= 0) {
    // brought down in his own end zone: a safety ends the drive
    endDrive(g, 'SAF', news);
    return { text: 'SAFETY', firstDown: false, points: 0, driveOver: 'SAF', fourth: false, fire, timeUp: false };
  }
  if (end.kind !== 'incomplete') {
    g.ballOn = Math.max(1, Math.min(99, end.y));
    g.ballX = end.x;
  }
  if (!goalToGo && end.kind !== 'incomplete' && end.y >= line) {
    g.down = 1;
    g.toGo = Math.min(10, 100 - g.ballOn);
    // a clean first down: a set of downs moved on with no sack and no flag (a flagged play never
    // reaches here). C18's NFL reading of V2's "a clean possession", per series, as a drive is
    // several possessions' worth of plays; nfl-10 fits it
    if (!g.seriesSacked) heatEvent(g, 'clean', news);
    g.seriesSacked = false;
    return { text: 'FIRST DOWN', firstDown: true, points: 0, driveOver: null, fourth: false, fire, timeUp: false };
  }
  g.toGo = goalToGo ? 100 - g.ballOn : Math.max(0.3, line - g.ballOn);
  if (g.down === 4) {
    endDrive(g, 'DOWNS', news);
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
