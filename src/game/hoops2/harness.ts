// Test-only support for the hoops2 harnesses (box, determinism, calibration, human, curve and
// Moments tests, Claude 2026-11-10). The app never imports it. It builds squads the way Squad
// Battles does, plays seeded possessions with the autopilot or a modelled person, and counts what
// the box score and the calibration tables need from the engine's own events.
import { hashString, rng } from '../../engine/rng';
import type { Drill } from '../../evolution/training';
import { aiOpponent } from '../../ut/battles';
import type { Pool } from '../../ut/pool';
import { nbaLineOf, rateCard } from '../../ut/rate';
import { fiveOfSquad, squadFromWire } from '../../ut/teams';
import { toDisplay } from '../../ut/ut-scale';
import { decide, pilot, type Pilot } from './autopilot';
import { BoxTracker, type BoxSide, type BoxTeam } from './box';
import { aimPass, crossover, dist, isThree, pass, pressShoot, releaseShoot, RIM, spin, step, stepback } from './engine';
import { afterPossession, type HoopsGame, type Mark, newHoopsGame, POSSESSIONS, practiceStart, startPossession } from './game';
import { hooper } from './ratings';
import type { Contest, Hooper, Possession, Pt, ShotKind } from './types';

/** The test run's environment variables (the app's TypeScript has no node types). */
export const env: Record<string, string | undefined> = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** Where a harness writes its JSON: `name` in the OS temp dir unless a path is given. */
export const outPath = (given: string | undefined, name: string): string => given ?? (env.TMPDIR ?? '/tmp').replace(/\/$/, '') + '/' + name;

/** Write a harness's output file (never committed). */
export async function writeOut(path: string, text: string): Promise<void> {
  const fs = (await import('node:fs' as string)) as { writeFileSync(p: string, d: string): void };
  fs.writeFileSync(path, text);
}

export const DT = 1 / 60;
/** the most steps a possession may take before the harness calls it (40 s of play) */
export const MAX_STEPS = 60 * 40;
export const CONTESTS: Contest[] = ['open', 'light', 'heavy', 'smothered'];
const RIM_KINDS: ShotKind[] = ['layup', 'dunk', 'contact', 'standdunk', 'oop'];

/** Where a shot was taken, as the calibration tables split them. */
export type Zone = 'rim' | 'close' | 'mid' | 'three';
export const ZONES: Zone[] = ['rim', 'close', 'mid', 'three'];
export const zoneOf = (kind: ShotKind): Zone => (RIM_KINDS.includes(kind) ? 'rim' : kind === 'close' ? 'close' : kind === 'mid' ? 'mid' : 'three');

/** A standard normal draw from a seeded stream, by sums of uniforms (no transcendental math). */
export function gauss(r: () => number): number {
  let s = 0;
  for (let i = 0; i < 12; i++) s += r();
  return s - 6;
}

/** The autopilot's per-possession reset (what `autoplay` does before each possession). */
export function resetPilot(pl: Pilot): void {
  pl.letGo = null;
  pl.driving = false;
  pl.goal = null;
  pl.nextThink = 0;
  pl.crosses = 0;
}

// ---------- squads ----------

export interface Squad {
  five: Hooper[];
  bench: Hooper[];
  decade: number;
  title: string;
  /** the starting five's mean rating-scale overall (RatedCard.rawOvr) and displayed overall */
  raw: number;
  shown: number;
  /** the squad's team overall, as Squad Battles shows it (displayed scale, chemistry in) */
  team: number;
  /** the median season of the starting five (NBA: the year a season ends) */
  season: number;
}

const squadCache = new Map<string, Squad>();

/** A Squad Battles AI squad for a displayed team-overall target (aiOpponent), with its means. */
export function squadShown(pool: Pool, target: number, seed: string): Squad {
  const k = 'shown:' + target + ':' + seed;
  const hit = squadCache.get(k);
  if (hit) return hit;
  const rung = aiOpponent(pool, target, seed);
  const sq = squadFromWire(pool, rung.squad);
  const { five, bench } = fiveOfSquad(sq);
  const cards = Object.values(sq);
  const rated = five.map((h) => {
    const c = cards.find((x) => x.line.id === h.id);
    return c ? rateCard(c.line, c.level, h.pos) : null;
  });
  const mean = (f: (i: number) => number) => rated.reduce((a, rc, i) => a + (rc ? f(i) : five[i].ovr), 0) / five.length;
  const seasons = rated.map((rc) => rc?.line.season ?? rung.decade + 5).sort((x, y) => x - y);
  const s: Squad = { five, bench, decade: rung.decade, title: rung.title, raw: mean((i) => rated[i]!.rawOvr ?? rated[i]!.ovr), shown: mean((i) => rated[i]!.ovr), team: rung.ovr, season: seasons[2] };
  squadCache.set(k, s);
  return s;
}

/**
 * A squad whose starting five averages `raw` on the rating scale (the plan's "even 78"): the
 * displayed team target is walked until the five lands within a point (closest kept).
 */
export function squadRaw(pool: Pool, raw: number, seed: string): Squad {
  let target = Math.round(toDisplay('nba', raw));
  let best = squadShown(pool, target, seed);
  for (let k = 0; k < 4 && Math.abs(best.raw - raw) > 1; k++) {
    target += best.raw < raw ? 1 : -1;
    const s = squadShown(pool, target, seed);
    if (Math.abs(s.raw - raw) < Math.abs(best.raw - raw)) best = s;
  }
  return best;
}

const SPOTS = ['PG', 'SG', 'SF', 'PF', 'C'];
const HT: Record<string, number> = { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 };
const BADGES = ['posterizer', 'deadeye', 'limitless', 'clamps', 'rim-protector', 'ankle-breaker', 'dimer', 'lob-city', 'heat-check', 'icon'];

/**
 * A made-up five and three on the bench, varied by `seed` (ratings 50-97, sizes by position, a few
 * badges each): no card data to load, for the always-on tests.
 */
export function synthSquad(seed: string): Pick<Squad, 'five' | 'bench'> {
  const r = rng(hashString('synth:' + seed));
  const v = (lo: number, hi: number) => Math.round(lo + (hi - lo) * r());
  const man = (spot: string, k: number): Hooper => {
    const big = spot === 'PF' || spot === 'C' ? 1 : 0;
    const base = v(58, 92);
    return {
      id: seed + ':' + spot + ':' + k,
      name: 'Synth ' + spot + k,
      tag: spot + k,
      num: k,
      ht: HT[spot] + v(-2, 2),
      wt: 190 + big * 50 + v(-10, 25),
      pos: spot,
      ovr: base,
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
      abil: BADGES.filter(() => r() < 0.18),
    };
  };
  return { five: SPOTS.map((s) => man(s, 0)), bench: [man('SG', 1), man('SF', 1), man('C', 1)] };
}

// ---------- counting ----------

/** What the calibration tables need beyond the box score, counted from the same events. */
export interface Tally {
  games: number;
  poss: number;
  pts: number;
  secs: number;
  passes: number;
  /** attempts and makes by zone; jumpers by contest at the release */
  zoneA: Record<Zone, number>;
  zoneM: Record<Zone, number>;
  contest: Record<Contest, number>;
  jumpers: number;
  greens: number;
  ends: Record<string, number>;
  /** seconds the ball spent in each lineup slot's hands, and the C slot's threes */
  slotHold: number[];
  slotTpa: number[];
  /** per game: the top scorer's share, how many scored, the top-overall card's FGA share */
  topShare: number;
  scorers: number;
  starFgaShare: number;
  topFgaShare: number;
  scores: number[];
}

export const newTally = (): Tally => ({
  games: 0,
  poss: 0,
  pts: 0,
  secs: 0,
  passes: 0,
  zoneA: { rim: 0, close: 0, mid: 0, three: 0 },
  zoneM: { rim: 0, close: 0, mid: 0, three: 0 },
  contest: { open: 0, light: 0, heavy: 0, smothered: 0 },
  jumpers: 0,
  greens: 0,
  ends: {},
  slotHold: [0, 0, 0, 0, 0],
  slotTpa: [0, 0, 0, 0, 0],
  topShare: 0,
  scorers: 0,
  starFgaShare: 0,
  topFgaShare: 0,
  scores: [],
});

/** Count one step's events into a tally (call before the events are cleared). */
function countStep(t: Tally, p: Possession, shot: { zone: Zone | null }, holder: number | null): void {
  if (holder !== null && holder < 5) t.slotHold[holder] += DT;
  for (const e of p.events) {
    if (e === 'pass' || e === 'lob') t.passes++;
    else if (e.startsWith('fga:')) {
      const [, who, kind, pts] = e.split(':');
      const z = zoneOf(kind as ShotKind);
      shot.zone = z;
      t.zoneA[z]++;
      if (pts === '3') t.slotTpa[Number(who)]++;
      if (z !== 'rim') {
        t.jumpers++;
        const c = p.lastShot?.contest ?? 'open';
        t.contest[c]++;
        if (p.lastShot?.greened) t.greens++;
      }
    }
  }
}

/** A seeded side's game played to the end, with an optional box tracker and tally. */
export interface Played {
  g: HoopsGame;
  marks: Mark[];
  /** each possession's final p.t (determinism checks) */
  ts: number[];
}

export interface SideOptions {
  skill: number;
  seed: string;
  /** the possessions' starting state is the game's; `practice` sets a drill up on each */
  practice?: Drill;
  box?: BoxTracker;
  side?: BoxSide;
  tally?: Tally;
  /** who plays the offense: the autopilot (default) or a modelled person */
  human?: HumanModel;
  /** a look at every step's events before they're cleared */
  each?: (p: Possession) => void;
}

/** Play `g` to the end. */
export function playSide(g: HoopsGame, o: SideOptions): Played {
  const pl = pilot(o.skill, o.seed);
  const ts: number[] = [];
  const side = o.side ?? 'us';
  const star = g.ours.reduce((b, h, i) => (h.ovr > g.ours[b].ovr ? i : b), 0);
  const starId = g.ours[star].id;
  const ptsBy = new Map<string, number>();
  const fgaBy = new Map<string, number>();
  let fga = 0;
  while (!g.over) {
    const p = startPossession(g);
    if (o.practice) practiceStart(p, o.practice);
    resetPilot(pl);
    o.box?.begin(p, side);
    const shot = { zone: null as Zone | null };
    const hs = o.human ? humanState(o.human, hashString(o.seed + ':' + g.done)) : null;
    for (let k = 0; k < MAX_STEPS && !p.end; k++) {
      const before = p.handler;
      const stick = hs ? humanStep(p, hs, applyInput) : decide(p, pl);
      step(p, DT, stick);
      o.box?.onStep(p, before);
      o.each?.(p);
      if (o.tally) countStep(o.tally, p, shot, before);
      for (const e of p.events)
        if (e.startsWith('fga:')) {
          const id = p.bodies[Number(e.split(':')[1])].p.id;
          fgaBy.set(id, (fgaBy.get(id) ?? 0) + 1);
          fga++;
        }
      p.events.length = 0;
    }
    if (!p.end) p.end = { kind: 'clock', points: 0, text: 'SHOT CLOCK', who: -1 };
    o.box?.onEnd(p);
    const t = o.tally;
    if (t) {
      t.poss++;
      t.secs += p.t;
      t.ends[p.end.kind] = (t.ends[p.end.kind] ?? 0) + 1;
      if (p.end.kind === 'make' && shot.zone) t.zoneM[shot.zone]++;
    }
    if (p.end.kind === 'make' && p.end.who >= 0) {
      const id = p.bodies[p.end.who].p.id;
      ptsBy.set(id, (ptsBy.get(id) ?? 0) + p.end.points);
    }
    ts.push(p.t);
    afterPossession(g, p);
  }
  const t = o.tally;
  if (t) {
    t.games++;
    t.pts += g.score;
    t.scores.push(g.score);
    const top = Math.max(0, ...ptsBy.values());
    t.topShare += g.score ? top / g.score : 0;
    t.scorers += [...ptsBy.values()].filter((x) => x > 0).length;
    t.starFgaShare += fga ? (fgaBy.get(starId) ?? 0) / fga : 0;
    t.topFgaShare += fga ? Math.max(0, ...fgaBy.values()) / fga : 0;
  }
  return { g, marks: g.marks.slice(), ts };
}

/**
 * A whole match the way the current format plays it: each side's 16 possessions on offense against
 * the other's five (the same defense difficulty both ways), one box tracker for both teams.
 */
export function playMatch(
  a: Pick<Squad, 'five' | 'bench'>,
  b: Pick<Squad, 'five' | 'bench'>,
  seed: string,
  skill: number,
  defIQ: number,
  o: { box?: BoxTracker; ta?: Tally; tb?: Tally; each?: (p: Possession, side: BoxSide) => void } = {}
): { us: Played; them: Played } {
  const us = playSide(newHoopsGame(a.five, b.five, 'g' + seed, POSSESSIONS, a.bench, defIQ), { skill, seed: 'g' + seed, box: o.box, side: 'us', tally: o.ta, each: o.each && ((p) => o.each!(p, 'us')) });
  const them = playSide(newHoopsGame(b.five, a.five, 'h' + seed, POSSESSIONS, b.bench, defIQ), { skill, seed: 'h' + seed, box: o.box, side: 'them', tally: o.tb, each: o.each && ((p) => o.each!(p, 'them')) });
  return { us, them };
}

// ---------- a person playing ----------

/**
 * Simple honest strategies a person plays (drive, cross then drive, spot up for three, the elbow
 * pull-up, the step-back three, drive and kick), and `mixed`: a median person picks one of them each
 * possession (a third of the time a drive, often a three or a kick-out).
 */
export type Strategy = 'drive' | 'cross-drive' | 'three' | 'elbow' | 'stepback' | 'kick' | 'mixed';
export const STRATEGIES: Strategy[] = ['drive', 'cross-drive', 'three', 'elbow', 'stepback', 'kick', 'mixed'];
const MIX: [Exclude<Strategy, 'mixed'>, number][] = [
  ['drive', 0.22],
  ['cross-drive', 0.12],
  ['three', 0.2],
  ['elbow', 0.1],
  ['stepback', 0.1],
  ['kick', 0.26],
];

/** The median person's release spread (seconds), and the skilled one's (plan §3.3). */
export const MEDIAN_SD = 0.05;
export const SKILLED_SD = 0.035;

export interface HumanModel {
  strategy: Strategy;
  /** the release's spread around the window centre (seconds) */
  sd: number;
}

export interface HumanState {
  m: HumanModel;
  r: () => number;
  plan: Exclude<Strategy, 'mixed'>;
  err: number;
  pressedAt: number;
  crossed: boolean;
  stepped: number;
  passed: boolean;
}

function humanState(m: HumanModel, seed: number): HumanState {
  const r = rng(seed);
  let plan: Exclude<Strategy, 'mixed'> = 'drive';
  if (m.strategy === 'mixed') {
    let x = r();
    for (const [s, w] of MIX) {
      plan = s;
      x -= w;
      if (x <= 0) break;
    }
  } else plan = m.strategy;
  return { m, r, plan, err: gauss(r) * m.sd, pressedAt: -1, crossed: false, stepped: -1, passed: false };
}

/** A person's plan and release error for one possession, seeded by name. */
export const humanStateFor = (m: HumanModel, seed: string): HumanState => humanState(m, hashString(seed));

/** Every input a person (or a recording of one) can make, so a replay can stand in for him. */
export interface Inputs {
  press(p: Possession): void;
  /** let go, `late` seconds after the moment it was meant for (the harness's sub-step timing) */
  release(p: Possession, late: number): void;
  pass(p: Possession, to: number | null): void;
  cross(p: Possession, dir: number): void;
  stepback(p: Possession): void;
  spin(p: Possession, dir: number): void;
}

export const applyInput: Inputs = {
  press: (p) => pressShoot(p),
  release: (p, late) => releaseShoot(p, late),
  pass: (p, to) => pass(p, to),
  cross: (p, dir) => crossover(p, dir),
  stepback: (p) => stepback(p),
  spin: (p, dir) => spin(p, dir),
};

/** The stick toward a spot from the handler (null when there), and the same at a jog. */
function toward(p: Possession, at: Pt, mag = 1): Pt | null {
  const h = p.bodies[p.handler!];
  const dx = at.cx - h.cx;
  const dz = at.cz - h.cz;
  const l = Math.sqrt(dx * dx + dz * dz);
  return l < 0.6 ? null : { cx: (dx / l) * mag, cz: (dz / l) * mag };
}

/**
 * One step of a person's play: the stick, plus the inputs he makes. His release lands `err` off
 * the window's centre (a fresh normal draw each possession); the release is placed inside the step
 * exactly, so the harness measures his timing, not the 60 Hz step (today's game adds a ±1 step
 * triangular error on top, σ ≈ 7 ms: small against σ 50).
 */
export function humanStep(p: Possession, s: HumanState, io: Inputs): Pt | null {
  const m = p.meter;
  if (m && m.off === undefined && s.pressedAt >= 0) {
    const want = m.top + s.err;
    const held = p.t - m.t0;
    if (held >= want) io.release(p, held - want);
    return null;
  }
  if (p.handler === null || p.ball || p.meter || p.finish || p.end) return null;
  const h = p.bodies[p.handler];
  const dRim = dist(h, RIM);
  const shoot = () => {
    io.press(p);
    if (p.meter || p.finish) s.pressedAt = p.t;
  };
  let stick: Pt | null = null;
  if (s.plan === 'drive' || s.plan === 'cross-drive') {
    if (s.plan === 'cross-drive' && !s.crossed && p.t > 0.4) {
      io.cross(p, s.r() < 0.5 ? 1 : -1);
      s.crossed = true;
      if (p.end) return null;
    }
    stick = toward(p, RIM);
    if (dRim < 7 || p.t > 6) shoot();
  } else if (s.plan === 'stepback') {
    const spot = { cx: RIM.cx - 21, cz: h.cz > 0 ? 6 : -6 };
    if (s.stepped < 0) {
      stick = toward(p, spot, 0.8);
      if (!stick || p.t > 3) {
        io.stepback(p);
        s.stepped = p.t;
      }
    } else if (p.t - s.stepped > 0.2 || p.t > 6) shoot();
  } else if (s.plan === 'kick') {
    if (!s.passed) {
      stick = toward(p, RIM);
      if (p.t > 1.2) {
        io.pass(p, aimPass(p, null));
        s.passed = true;
      }
    } else if (p.t - h.actAt > 0.25 || p.t > 6) shoot();
  } else if (s.plan === 'three') {
    const spot = { cx: RIM.cx - 24.5, cz: h.cz > 0 ? 6 : -6 };
    stick = toward(p, spot, 0.8);
    if ((isThree(h) && !stick) || p.t > 5) shoot();
  } else {
    const spot = { cx: RIM.cx - 15, cz: h.cz > 0 ? 8 : -8 };
    stick = toward(p, spot, 0.8);
    if (!stick || p.t > 4) shoot();
  }
  return p.meter || p.finish ? null : stick;
}

/** A person's possession, played to the end (for a single run outside `playSide`). */
export function humanPossession(p: Possession, m: HumanModel, seed: number, io: Inputs = applyInput, each?: (p: Possession) => void): void {
  const s = humanState(m, seed);
  for (let k = 0; k < MAX_STEPS && !p.end; k++) {
    step(p, DT, humanStep(p, s, io));
    each?.(p);
    p.events.length = 0;
  }
  if (!p.end) p.end = { kind: 'clock', points: 0, text: 'SHOT CLOCK', who: -1 };
}

// ---------- a person on defense (plan §3.6) ----------

/**
 * How a person defends when the game lets him (nba-6 brings the stick, nba-7 SWITCH / STEAL /
 * CONTEST). Until then the engine has no defensive input: the harness computes what each policy
 * would press, counts it, and the five defends on its own (Auto-defend). The policies:
 *  - median: stays between his man and the rim, contests within ±100 ms of the release (σ 50 ms),
 *    switches when beaten
 *  - poor: a random stick, no contests
 *  - idle: no input at all (the Auto-defend reference)
 *  - contester: a good contester (σ 25 ms)
 *  - early: jumps 200 ms before the release
 *  - thief: reaches for a steal every half second
 */
export type DefPolicy = 'median' | 'poor' | 'idle' | 'contester' | 'early' | 'thief';
export const DEF_POLICIES: DefPolicy[] = ['median', 'poor', 'idle', 'contester', 'early', 'thief'];

export interface DefInput {
  stick: Pt | null;
  contest: boolean;
  steal: boolean;
  switchMan: boolean;
}

export interface DefState {
  policy: DefPolicy;
  r: () => number;
  /** the defender he controls (a body index 5-9) */
  me: number;
  /** when he means to jump, relative to the shooter's rise */
  jumpAt: number | null;
  lastReach: number;
  counts: { contests: number; steals: number; switches: number };
}

export function defState(policy: DefPolicy, seed: number, me = 5): DefState {
  return { policy, r: rng(seed), me, jumpAt: null, lastReach: -9, counts: { contests: 0, steals: 0, switches: 0 } };
}

/** What the policy presses this step. */
export function defenderInput(p: Possession, s: DefState): DefInput {
  const out: DefInput = { stick: null, contest: false, steal: false, switchMan: false };
  if (s.policy === 'idle' || p.end) return out;
  const me = p.bodies[s.me];
  const man = p.bodies[me.mark];
  if (s.policy === 'poor') {
    out.stick = { cx: s.r() * 2 - 1, cz: s.r() * 2 - 1 };
    return out;
  }
  // stay between his man and the rim, a step off
  const gx = man.cx + (RIM.cx - man.cx) * 0.15 - me.cx;
  const gz = man.cz + (RIM.cz - man.cz) * 0.15 - me.cz;
  const gl = Math.sqrt(gx * gx + gz * gz);
  out.stick = gl < 0.5 ? null : { cx: gx / gl, cz: gz / gl };
  const m = p.meter;
  if (m && m.off === undefined && p.handler === me.mark) {
    if (s.jumpAt === null) {
      const sd = s.policy === 'contester' ? 0.025 : 0.05;
      s.jumpAt = s.policy === 'early' ? m.top - 0.2 : m.top + gauss(s.r) * sd;
    }
    if (p.t - m.t0 >= s.jumpAt) {
      out.contest = true;
      s.counts.contests++;
      s.jumpAt = Infinity;
    }
  } else if (!m) s.jumpAt = null;
  if (s.policy === 'thief' && p.handler === me.mark && p.t - s.lastReach >= 0.5) {
    s.lastReach = p.t;
    out.steal = true;
    s.counts.steals++;
  }
  if (s.policy === 'median' && p.handler !== null && me.beatenAt !== undefined && p.t - me.beatenAt < DT * 1.5) {
    out.switchMan = true;
    s.counts.switches++;
  }
  return out;
}

// ---------- the calibration summary ----------

/**
 * One side's numbers as the targets name them (targets.ts §3.1), from its box (`t`), the box of the
 * five that defended it (`d`: its steals, blocks, fouls and rebounds happened on these possessions)
 * and the tally. Rates per possession, counts per 16 possessions.
 */
export function summary(t: BoxTeam, d: BoxTeam, y: Tally): Record<string, number> {
  const per16 = (n: number) => (16 * n) / Math.max(1, t.poss);
  const ratio = (a: number, b: number) => (b ? a / b : NaN);
  const zones = ZONES.reduce((a, z) => a + y.zoneA[z], 0);
  const holds = y.slotHold.reduce((a, x) => a + x, 0);
  const threes = y.slotTpa.reduce((a, x) => a + x, 0);
  const oppReb = d.drb + d.teamReb;
  return {
    games: y.games,
    poss: t.poss,
    ppg: ratio(t.pts, y.games),
    ppp: ratio(t.pts, t.poss),
    fga16: per16(t.fga),
    tpaRate: ratio(t.tpa, t.fga),
    ftaRate: ratio(t.fta, t.fga),
    tovPct: ratio(t.tov + t.teamTov, t.poss),
    stl16: per16(d.stl),
    blk16: per16(d.blk),
    pf16: per16(d.pf),
    orbPct: ratio(t.orb, t.orb + oppReb),
    astRate: ratio(t.ast, t.fgm),
    fgPct: ratio(t.fgm, t.fga),
    tpPct: ratio(t.tpm, t.tpa),
    efg: ratio(t.fgm + 0.5 * t.tpm, t.fga),
    rimPct: ratio(y.zoneM.rim, y.zoneA.rim),
    closePct: ratio(y.zoneM.close, y.zoneA.close),
    midPct: ratio(y.zoneM.mid, y.zoneA.mid),
    ftPct: ratio(t.ftm, t.fta),
    mixRim: ratio(y.zoneA.rim, zones),
    mixClose: ratio(y.zoneA.close, zones),
    mixMid: ratio(y.zoneA.mid, zones),
    mixThree: ratio(y.zoneA.three, zones),
    heavyShare: ratio(y.contest.heavy + y.contest.smothered, y.jumpers),
    greenRate: ratio(y.greens, y.jumpers),
    passesPerPoss: ratio(y.passes, t.poss),
    secPerPoss: ratio(y.secs, t.poss),
    // (the highest-overall card until nba-8 gives cards their real usage)
    topUsageFgaShare: ratio(y.starFgaShare, y.games),
    topFgaShare: ratio(y.topFgaShare, y.games),
    topScorerShare: ratio(y.topShare, y.games),
    scorers: ratio(y.scorers, y.games),
    pgHoldShare: ratio(y.slotHold[0], holds),
    cTpaShare: ratio(y.slotTpa[4], threes),
    transitionShare: 0,
    tov16: per16(t.tov + t.teamTov),
    orb16: per16(t.orb),
    stealPct: ratio(d.stl, t.poss),
    clockPct: ratio(y.ends.clock ?? 0, t.poss),
    pure: per16(t.pure),
  };
}

// ---------- the league-average shooter (plan §3.3) ----------

/**
 * THR_avg: the three-point rating a 2024-25 player who shot 36.0% on at least 3 attempts a game gets,
 * as the median over that season's cards within ±1.0% of 36.0% (from the card's own ratings, `ut`,
 * which UT matches play with, and from `ratings.ts` alone, `engine`, which the draft modes use).
 */
export function thrAvg(pool: Pool): { ut: number; engine: number; n: number } {
  const ut: number[] = [];
  const engine: number[] = [];
  for (const rc of pool.base.values()) {
    const l = rc.line;
    const fg3 = l.stats.fg3 ?? null;
    const a3 = l.stats.a3 ?? 0;
    if (l.kind !== 'season' || l.season !== 2025 || fg3 === null || a3 < 3 || Math.abs(fg3 - 0.36) > 0.01) continue;
    ut.push(rc.attrs['3PT']);
    engine.push(hooper(nbaLineOf(l), rc.pos, l.num).thr);
  }
  const median = (xs: number[]) => {
    const s = xs.slice().sort((a, b) => a - b);
    return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN;
  };
  return { ut: median(ut), engine: median(engine), n: ut.length };
}
