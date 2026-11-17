// The defense's call table (Claude, studio overhaul nfl-5; audit D-1, plan §8 nfl-5). Eleven real
// calls, each with the shell it plays after the snap, every defender's job, its rushers and a
// family (BLITZ / MAN / ZONE) that nfl-8's defensive tray groups by. Who calls what:
//
// - Rookie calls at random among four plain coverages (Cover 1, 2, 3 and 4) and never disguises.
// - Pro calls by the situation: down and distance, the field zone and the two-minute clock.
// - Legend calls like Pro, then leans toward what holds the offense's own habits this game (its run
//   and pass mix on early and late downs) and disguises more.
//
// Disguise: before the snap the defense shows a shell (no safety, one high, two high). On a share of
// snaps it shows another shell than the one it plays and rotates once the ball is snapped: 0% of
// snaps on Rookie, 10-15% on Pro, 25-35% on Legend. The coach (coach.ts) reads the shell shown,
// never the call, so a rotation can fool him.
//
// FREE RUSHER: the engine (lineUp) works out the protection for the play that's lined up. When a
// rusher is left with nobody to block him, the defense may tip it before the snap (a flame over him):
// on half the snaps with a free rusher on Pro, a quarter on Legend. It shows only over a rusher who
// really is unblocked, so it never lies.
//
// Everything here is pure and seeded by the caller: both phones replay the same calls.
import type { Call, Pt } from './types';

export type DefCallId = 'c0' | 'c1' | 'c1r' | 'c2' | 't2' | 'c3' | 'c4' | 'fire' | 'sim' | 'goal' | 'prevent';
export type Family = 'BLITZ' | 'MAN' | 'ZONE';
/** the look: no deep safety, one deep safety in the middle, two deep safeties on the hashes */
export type Shell = 'zero' | 'one' | 'two';
export type Level = 'rookie' | 'pro' | 'legend';
export type DefSlot = 'LE' | 'LDT' | 'RDT' | 'RE' | 'WLB' | 'MLB' | 'SLB' | 'CB1' | 'CB2' | 'FS' | 'SS';
export type OffSlot = 'X' | 'Z' | 'SL' | 'TE' | 'RB';
export type Landmark =
  | 'deepL3'
  | 'deepM3'
  | 'deepR3'
  | 'halfL'
  | 'halfR'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'flatL'
  | 'flatR'
  | 'curlL'
  | 'curlR'
  | 'hookL'
  | 'hookM'
  | 'hookR'
  | 'robber'
  | 'tampa'
  | 'prevL'
  | 'prevM'
  | 'prevR';

/** One defender's job on a call: rush (from his spot, or a gap to blitz), man on a receiver, a zone, or spy the back. */
export type DefJob = { kind: 'rush' } | { kind: 'man'; on: OffSlot } | { kind: 'zone'; at: Landmark } | { kind: 'spy' };

export interface DefCall {
  id: DefCallId;
  name: string;
  /** the tray's short label */
  short: string;
  family: Family;
  /** the shell it plays after the snap (and shows, unless it disguises) */
  shell: Shell;
  /** the coverage the old two-way readers know it as */
  coverage: 'man' | 'zone';
  jobs: Record<DefSlot, DefJob>;
}

const R: DefJob = { kind: 'rush' };
const man = (on: OffSlot): DefJob => ({ kind: 'man', on });
const zone = (at: Landmark): DefJob => ({ kind: 'zone', at });
const SPY: DefJob = { kind: 'spy' };
const FRONT = { LE: R, LDT: R, RDT: R, RE: R };

export const CALLS: Record<DefCallId, DefCall> = {
  c0: {
    id: 'c0',
    name: 'Cover 0',
    short: 'C0 BLITZ',
    family: 'BLITZ',
    shell: 'zero',
    coverage: 'man',
    jobs: { ...FRONT, MLB: R, SS: R, WLB: man('RB'), SLB: man('TE'), CB1: man('X'), CB2: man('Z'), FS: man('SL') }
  },
  c1: {
    id: 'c1',
    name: 'Cover 1',
    short: 'COVER 1',
    family: 'MAN',
    shell: 'one',
    coverage: 'man',
    jobs: { ...FRONT, MLB: SPY, WLB: man('RB'), SLB: man('TE'), CB1: man('X'), CB2: man('Z'), SS: man('SL'), FS: zone('deepM3') }
  },
  c1r: {
    id: 'c1r',
    name: 'Cover 1 Robber',
    short: '1 ROBBER',
    family: 'MAN',
    shell: 'one',
    coverage: 'man',
    jobs: { ...FRONT, MLB: man('RB'), WLB: man('SL'), SLB: man('TE'), CB1: man('X'), CB2: man('Z'), SS: zone('robber'), FS: zone('deepM3') }
  },
  c2: {
    id: 'c2',
    name: 'Cover 2',
    short: 'COVER 2',
    family: 'ZONE',
    shell: 'two',
    coverage: 'zone',
    jobs: { ...FRONT, CB1: zone('flatL'), CB2: zone('flatR'), FS: zone('halfL'), SS: zone('halfR'), WLB: zone('curlL'), MLB: zone('hookM'), SLB: zone('curlR') }
  },
  t2: {
    id: 't2',
    name: 'Tampa 2',
    short: 'TAMPA 2',
    family: 'ZONE',
    shell: 'two',
    coverage: 'zone',
    jobs: { ...FRONT, CB1: zone('flatL'), CB2: zone('flatR'), FS: zone('halfL'), SS: zone('halfR'), WLB: zone('hookL'), MLB: zone('tampa'), SLB: zone('hookR') }
  },
  c3: {
    id: 'c3',
    name: 'Cover 3',
    short: 'COVER 3',
    family: 'ZONE',
    shell: 'one',
    coverage: 'zone',
    jobs: { ...FRONT, CB1: zone('deepL3'), CB2: zone('deepR3'), FS: zone('deepM3'), SS: zone('curlL'), WLB: zone('hookL'), MLB: zone('hookR'), SLB: zone('curlR') }
  },
  c4: {
    id: 'c4',
    name: 'Cover 4',
    short: 'COVER 4',
    family: 'ZONE',
    shell: 'two',
    coverage: 'zone',
    jobs: { ...FRONT, CB1: zone('q1'), FS: zone('q2'), SS: zone('q3'), CB2: zone('q4'), WLB: zone('flatL'), MLB: zone('hookM'), SLB: zone('flatR') }
  },
  fire: {
    id: 'fire',
    name: 'Fire Zone',
    short: 'FIRE ZONE',
    family: 'BLITZ',
    shell: 'one',
    coverage: 'zone',
    // the end drops into the hook and the strong safety comes off the edge behind him
    jobs: { LE: zone('hookL'), LDT: R, RDT: R, RE: R, MLB: R, SS: R, CB1: zone('deepL3'), CB2: zone('deepR3'), FS: zone('deepM3'), WLB: zone('curlL'), SLB: zone('curlR') }
  },
  sim: {
    id: 'sim',
    name: 'Sim Pressure',
    short: 'SIM PRESS',
    family: 'BLITZ',
    shell: 'one',
    coverage: 'zone',
    // four rush, but not the four he expects: the right end drops and the weak backer comes
    jobs: { LE: R, LDT: R, RDT: R, RE: zone('hookR'), WLB: R, CB1: zone('deepL3'), CB2: zone('deepR3'), FS: zone('deepM3'), SS: zone('curlL'), MLB: zone('hookM'), SLB: zone('curlR') }
  },
  goal: {
    id: 'goal',
    name: 'Goal Line',
    short: 'GOAL LINE',
    family: 'MAN',
    shell: 'one',
    coverage: 'man',
    jobs: { ...FRONT, MLB: R, WLB: man('RB'), SLB: man('TE'), CB1: man('X'), CB2: man('Z'), SS: man('SL'), FS: zone('robber') }
  },
  prevent: {
    id: 'prevent',
    name: 'Prevent',
    short: 'PREVENT',
    family: 'ZONE',
    shell: 'two',
    coverage: 'zone',
    // three rush, everyone else deep: they give the short stuff and keep everything in front
    jobs: { LE: R, LDT: zone('hookM'), RDT: R, RE: R, CB1: zone('prevL'), FS: zone('prevM'), CB2: zone('prevR'), SS: zone('tampa'), WLB: zone('curlL'), MLB: zone('hookL'), SLB: zone('curlR') }
  }
};
export const CALL_IDS = Object.keys(CALLS) as DefCallId[];

/** what the user's tray groups the calls by (nfl-8's defensive tray) */
export const FAMILIES: Record<Family, DefCallId[]> = {
  BLITZ: CALL_IDS.filter((c) => CALLS[c].family === 'BLITZ'),
  MAN: CALL_IDS.filter((c) => CALLS[c].family === 'MAN'),
  ZONE: CALL_IDS.filter((c) => CALLS[c].family === 'ZONE')
};

/** How many rush the passer on a call. */
export const rushersOf = (c: DefCall) => Object.values(c.jobs).filter((j) => j.kind === 'rush').length;
/** A call that sends more than the four down linemen' worth (or brings them from somewhere else). */
export const isBlitz = (c: DefCall) => c.family === 'BLITZ';

export const SHELL_TEXT: Record<Shell, string> = { zero: 'No safety', one: 'One high', two: 'Two deep' };

// ---------- the situation ----------

export interface Situation {
  down: number;
  toGo: number;
  /** the ball's yard line (0 own goal, 100 theirs) */
  ballOn: number;
  /** the two-minute clock (seconds) on the last drive, else null */
  clock: number | null;
}

export type Zone = 'own' | 'mid' | 'red' | 'goal';
export const zoneOf = (s: Pick<Situation, 'ballOn' | 'toGo'>): Zone => (s.ballOn >= 92 || (s.ballOn >= 88 && s.ballOn + s.toGo >= 100) ? 'goal' : s.ballOn >= 80 ? 'red' : s.ballOn < 20 ? 'own' : 'mid');

/** The offense's habits so far this game, as the defense sees them (Legend's counters). */
export interface Tendency {
  /** early downs (1st, 2nd): passes and runs called */
  earlyPass: number;
  earlyRun: number;
  /** late downs (3rd, 4th) */
  latePass: number;
  lateRun: number;
  /** completions caught 15+ yards past the line, and the passes thrown */
  deep: number;
  passes: number;
}
export const NO_TENDENCY: Tendency = { earlyPass: 0, earlyRun: 0, latePass: 0, lateRun: 0, deep: 0, passes: 0 };

/** A tendency after one more play by the offense. */
export function noteTendency(t: Tendency, down: number, call: Call, deepCatch: boolean): Tendency {
  const late = down >= 3;
  return {
    earlyPass: t.earlyPass + (!late && call === 'pass' ? 1 : 0),
    earlyRun: t.earlyRun + (!late && call === 'run' ? 1 : 0),
    latePass: t.latePass + (late && call === 'pass' ? 1 : 0),
    lateRun: t.lateRun + (late && call === 'run' ? 1 : 0),
    deep: t.deep + (deepCatch ? 1 : 0),
    passes: t.passes + (call === 'pass' ? 1 : 0)
  };
}

// ---------- who calls what ----------

/** Rookie's four plain coverages. */
const ROOKIE: DefCallId[] = ['c1', 'c2', 'c3', 'c4'];

type Weights = Partial<Record<DefCallId, number>>;

/**
 * Pro's call sheet: weights for the situation. Long yardage plays two deep or brings pressure;
 * short yardage and the red zone play man and load the box; the goal line calls Goal Line; the end
 * of the two-minute drill with a long way to go plays Prevent.
 */
export function sheet(s: Situation): Weights {
  const z = zoneOf(s);
  const late = s.down >= 3;
  const long = s.toGo >= 7;
  const short = s.toGo <= 3;
  if (z === 'goal') return { goal: 34, c0: 14, c1: 20, c1r: 8, fire: 8, c2: 6, c3: 6, sim: 4 };
  if (s.clock !== null && s.clock <= 30 && s.ballOn < 70 && (long || s.clock <= 12)) return { prevent: 46, c4: 18, t2: 14, c2: 12, c3: 10 };
  if (z === 'red') return late ? { c1: 18, c0: 14, c1r: 12, fire: 12, goal: 6, c2: 10, t2: 6, c3: 10, c4: 6, sim: 6 } : { c1: 16, c1r: 10, c0: 6, goal: 4, c3: 18, c2: 12, t2: 8, c4: 10, fire: 8, sim: 8 };
  if (late && long) return { c2: 13, t2: 11, c4: 14, c3: 16, c1: 12, c1r: 6, c0: 6, fire: 12, sim: 10, prevent: s.toGo >= 15 ? 6 : 0 };
  if (late && short) return { c1: 22, c0: 14, c1r: 14, fire: 12, goal: s.toGo <= 1 ? 10 : 4, c3: 14, c2: 6, sim: 8, c4: 4 };
  if (late) return { c1: 18, c1r: 10, c3: 18, c2: 12, t2: 8, c4: 10, fire: 10, sim: 10, c0: 6 };
  if (s.down === 2 && long) return { c2: 16, t2: 10, c4: 16, c3: 20, c1: 14, c1r: 6, fire: 8, sim: 8, c0: 2 };
  if (s.down === 2 && short) return { c1: 20, c1r: 12, c3: 20, c0: 8, fire: 12, sim: 8, c2: 8, c4: 6, goal: 2 };
  // first down (and second and medium): the base mix
  return { c3: 24, c1: 18, c2: 12, c4: 12, t2: 8, c1r: 8, fire: 7, sim: 7, c0: 3 };
}

/**
 * Legend's counters: lean the sheet toward what holds the offense's own mix. A run-heavy offense
 * on these downs sees more single-high and loaded boxes; a pass-heavy one more two-deep and more
 * pressure; one that keeps hitting it deep more two-deep and quarters. Needs a few plays of
 * evidence before it moves (none on the first snaps of the game).
 */
export function counter(w: Weights, s: Situation, t: Tendency): Weights {
  const late = s.down >= 3;
  const pass = late ? t.latePass : t.earlyPass;
  const run = late ? t.lateRun : t.earlyRun;
  const n = pass + run;
  const out: Weights = { ...w };
  const bump = (ids: DefCallId[], k: number) => {
    for (const id of ids) if (out[id] !== undefined || k > 0) out[id] = Math.max(0, (out[id] ?? 0) * (1 + k) + (k > 0 ? 2 * k : 0));
  };
  if (n >= 4) {
    const passShare = pass / n;
    // how far from an even mix (0.55 pass) they are, up to +/-1
    const lean = Math.max(-1, Math.min(1, (passShare - 0.55) / 0.3));
    if (lean > 0) {
      bump(['c2', 't2', 'c4', 'fire', 'sim'], 0.8 * lean);
      bump(['goal'], -0.6 * lean);
    } else if (lean < 0) {
      bump(['c1', 'c1r', 'c0', 'c3', 'goal'], 0.8 * -lean);
      bump(['c4', 't2', 'prevent'], -0.6 * -lean);
    }
  }
  if (t.passes >= 5 && t.deep / t.passes >= 0.15) bump(['c4', 'c2', 'c3'], 0.5);
  return out;
}

/** Draw a call from weights with one seeded number. */
export function drawCall(w: Weights, u: number): DefCallId {
  const ids = CALL_IDS.filter((id) => (w[id] ?? 0) > 0);
  const total = ids.reduce((n, id) => n + (w[id] ?? 0), 0);
  let x = u * total;
  for (const id of ids) if ((x -= w[id] ?? 0) < 0) return id;
  return ids[ids.length - 1] ?? 'c3';
}

/** How often the defense shows one shell and plays another (rotates after the snap). */
export const DISGUISE: Record<Level, number> = { rookie: 0, pro: 0.125, legend: 0.3 };
/** How often a free rusher is tipped before the snap (the FREE RUSHER flame). */
export const TELL: Record<Level, number> = { rookie: 0.75, pro: 0.5, legend: 0.27 };

/** The shell a disguise shows instead of the real one. */
export function disguiseOf(shell: Shell, u: number): Shell {
  if (shell === 'one') return u < 0.5 ? 'two' : 'zero';
  if (shell === 'two') return 'one';
  return 'one';
}

/** The defense's call for one snap, all from its own seeded rng (never the offense's). */
export interface Called {
  call: DefCall;
  /** the shell shown before the snap */
  shown: Shell;
  /** a free rusher, if there is one, is tipped by the flame */
  tell: boolean;
}

/** The call for a situation at a level (`rand` is the defense's own stream). */
export function callFor(s: Situation, level: Level, rand: () => number, t: Tendency = NO_TENDENCY): Called {
  const u = rand();
  let id: DefCallId;
  if (level === 'rookie') id = ROOKIE[Math.min(ROOKIE.length - 1, Math.floor(u * ROOKIE.length))];
  else {
    const w = sheet(s);
    id = drawCall(level === 'legend' ? counter(w, s, t) : w, u);
  }
  const call = CALLS[id];
  const shown = rand() < DISGUISE[level] ? disguiseOf(call.shell, rand()) : call.shell;
  const tell = rand() < TELL[level];
  return { call, shown, tell };
}

/** The level whose call sheet a defense uses, from its difficulty (defIQ: Rookie -0.5, Pro 0, Legend 1). */
export const levelOfIQ = (defIQ: number): Level => (defIQ <= -0.25 ? 'rookie' : defIQ < 0.5 ? 'pro' : 'legend');

// ---------- where they line up ----------

const FIELD_W = 53.33;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Where the offense's eligible men line up (for man and zone landmarks). */
export interface Spots {
  bx: number;
  los: number;
  X: Pt;
  Z: Pt;
  SL: Pt;
  TE: Pt;
  RB: Pt;
}

/** A zone's landmark on the field for this formation. */
export function landmark(at: Landmark, o: Spots): Pt {
  const { bx, los } = o;
  const deep = (dy: number) => Math.min(108, los + dy);
  switch (at) {
    case 'deepL3':
      return { x: clamp(o.X.x - 1, 6, FIELD_W - 6), y: deep(18) };
    case 'deepR3':
      return { x: clamp(o.Z.x + 1, 6, FIELD_W - 6), y: deep(18) };
    case 'deepM3':
      return { x: FIELD_W / 2 + (bx - FIELD_W / 2) * 0.4, y: deep(19) };
    case 'halfL':
      return { x: clamp(bx - 10.5, 8, FIELD_W - 8), y: deep(17) };
    case 'halfR':
      return { x: clamp(bx + 10.5, 8, FIELD_W - 8), y: deep(17) };
    case 'q1':
      return { x: clamp(o.X.x + 1, 5, FIELD_W - 5), y: deep(15) };
    case 'q2':
      return { x: clamp(bx - 5, 5, FIELD_W - 5), y: deep(16) };
    case 'q3':
      return { x: clamp(bx + 5, 5, FIELD_W - 5), y: deep(16) };
    case 'q4':
      return { x: clamp(o.Z.x - 1, 5, FIELD_W - 5), y: deep(15) };
    case 'flatL':
      return { x: clamp(bx - 11, 4, FIELD_W - 4), y: deep(5) };
    case 'flatR':
      return { x: clamp(bx + 11, 4, FIELD_W - 4), y: deep(5) };
    case 'curlL':
      return { x: clamp(o.SL.x, 4, FIELD_W - 4), y: deep(9) };
    case 'curlR':
      return { x: clamp(bx + 8, 4, FIELD_W - 4), y: deep(9) };
    case 'hookL':
      return { x: bx - 4, y: deep(7.5) };
    case 'hookR':
      return { x: bx + 4, y: deep(7.5) };
    case 'hookM':
      return { x: bx, y: deep(8) };
    case 'robber':
      return { x: bx - 1, y: deep(11) };
    case 'tampa':
      return { x: bx, y: deep(15.5) };
    case 'prevL':
      return { x: clamp(o.X.x + 2, 6, FIELD_W - 6), y: deep(24) };
    case 'prevM':
      return { x: FIELD_W / 2 + (bx - FIELD_W / 2) * 0.4, y: deep(28) };
    case 'prevR':
      return { x: clamp(o.Z.x - 2, 6, FIELD_W - 6), y: deep(24) };
  }
}

/**
 * Where each defender stands at the snap: the front and the backers by their jobs, the corners and
 * the safeties by the shell shown (the disguise). Rushers from the second level stand at their
 * normal depth (the blitz isn't given away by where they stand: the flame tips it, or nothing does).
 */
export function alignment(c: DefCall, shown: Shell, o: Spots, press: (slot: 'CB1' | 'CB2') => number): Record<DefSlot, Pt> {
  const { bx, los } = o;
  const at: Record<DefSlot, Pt> = {
    LE: { x: bx - 3.9, y: los + 1 },
    LDT: { x: bx - 0.9, y: los + 1 },
    RDT: { x: bx + 0.9, y: los + 1 },
    RE: { x: bx + 4.6, y: los + 1 },
    WLB: { x: bx - 4.2, y: los + 4.8 },
    MLB: { x: bx + 0.3, y: los + 5.2 },
    SLB: { x: bx + 4.6, y: los + 4.6 },
    CB1: { x: o.X.x, y: los + 7 },
    CB2: { x: o.Z.x, y: los + 7 },
    FS: { x: bx, y: los + 14 },
    SS: { x: o.SL.x + 1, y: los + 8 }
  };
  // the corners: pressed in man (by how good they are at it), squatting at five in two deep, off in one high
  for (const cb of ['CB1', 'CB2'] as const) {
    const j = c.jobs[cb];
    if (shown === 'two') at[cb].y = los + 5;
    else if (j.kind === 'man' || shown === 'zero') at[cb].y = los + press(cb);
    else at[cb].y = los + 7.5;
  }
  if (shown === 'two') {
    at.FS = { x: bx - 9.5, y: los + 13 };
    at.SS = { x: bx + 9.5, y: los + 13 };
  } else if (shown === 'zero') {
    at.FS = { x: o.SL.x + 1, y: los + 6 };
    at.SS = { x: bx - 6.5, y: los + 4 };
  }
  // a goal-line front tightens up
  if (c.id === 'goal') {
    at.WLB.y = los + 3.4;
    at.MLB.y = los + 3.6;
    at.SLB.y = los + 3.4;
  }
  // nobody stands in the stands or past the back of the end zone
  for (const k of Object.keys(at) as DefSlot[]) at[k] = { x: clamp(at[k].x, 1, FIELD_W - 1), y: Math.min(109, at[k].y) };
  return at;
}

/** The shell the play actually rotated into, and whether that's a rotation from what was shown. */
export const rotated = (c: DefCall, shown: Shell) => c.shell !== shown;
