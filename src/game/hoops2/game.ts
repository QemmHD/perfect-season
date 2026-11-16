// A game of arcade basketball: two halves of possessions on offense against the rival's five.
// Players tire as they go (less by stamina, back up at the half). The team's Heat bar (heat.ts)
// fills with PERFECT releases, baskets and clean possessions and drains with turnovers; at 100 the
// side is ON FIRE for its next two possessions (gold ×1.25), and the bar resets at half-time.
import { hashString, rng } from '../../engine/rng';
import type { Drill } from '../../evolution/training';
import { heatAfter, heatHalf, heatStage, heatStart, heatUnitEnd, type HeatState } from '../heat';
import { has, newPossession, RIM } from './engine';
import type { Hooper, Possession } from './types';

export const PER_HALF = 8;
export const POSSESSIONS = PER_HALF * 2;

/** how each possession ended, for the strip and the wire: '2', '3', 'A' (and-one, 3), 'X' miss, 'TO' turnover */
export type Mark = '2' | '3' | 'A' | 'X' | 'TO';
export const MARK_POINTS: Record<Mark, number> = { '2': 2, '3': 3, A: 3, X: 0, TO: 0 };

export interface HoopsGame {
  ours: Hooper[];
  theirs: Hooper[];
  seed: string;
  total: number;
  done: number;
  score: number;
  marks: Mark[];
  energy: number[];
  /** the team Heat bars (heat.ts): yours, and the side you face (its stops and your conceding: nba-6) */
  heat: { us: HeatState; them: HeatState };
  /** for the match grade: PERFECT moments, gold rings taken, turnovers */
  perfects: number;
  moments: number;
  turnovers: number;
  /** points by player */
  box: number[];
  over: boolean;
  /** Ultimate Team: the bench, and how fresh each man on it is; a tired starter comes off for one */
  bench: Hooper[];
  benchEnergy: number[];
  /** how well the other side defends beyond its ratings (Squad Battles' difficulty; 0 standard) */
  defIQ: number;
  /** how fresh the five defending are (they tire too, by their stamina); optional for old saves */
  theirEnergy?: number[];
}

/** the last possessions of a game: Icon cards play their best (+3 on every rating) */
export const CLUTCH = 4;
const RATING_KEYS = ['spd', 'acc', 'hnd', 'pas', 'thr', 'mid', 'cls', 'lay', 'ft', 'ddk', 'sdk', 'str', 'vrt', 'sta', 'prd', 'ind', 'stl', 'blk', 'reb'] as const;
/** An Icon in the clutch: every rating +3 (above 99 stays finite: the engine caps the extra). */
export function clutchOf(h: Hooper): Hooper {
  if (!h.abil.includes('icon')) return h;
  const out = { ...h };
  for (const k of RATING_KEYS) out[k] = h[k] + 3;
  return out;
}
/** A Heat Check card's PERFECT adds this much more Heat (+16 in all, against +12). */
export const HEAT_CHECK_EXTRA = 4;

/** a starter this tired comes off, when someone on the bench is fresh */
export const SUB_AT = 0.65;
const FRESH = 0.85;

export function newHoopsGame(ours: Hooper[], theirs: Hooper[], seed: string, total = POSSESSIONS, bench: Hooper[] = [], defIQ = 0): HoopsGame {
  return { ours: ours.slice(), theirs, seed, total, done: 0, score: 0, marks: [], energy: ours.map(() => 1), heat: { us: heatStart, them: heatStart }, perfects: 0, moments: 0, turnovers: 0, box: ours.map(() => 0), over: false, bench: bench.slice(), benchEnergy: bench.map(() => 1), defIQ, theirEnergy: theirs.map(() => 1) };
}

/**
 * Subs: a starter under SUB_AT comes off for the best rested man on the bench (one at his position
 * first), who takes his spot on the floor. The bench gets its legs back while it sits.
 */
function substitute(g: HoopsGame): void {
  for (let j = 0; j < g.bench.length; j++) g.benchEnergy[j] = Math.min(1, g.benchEnergy[j] + 0.05);
  for (let i = 0; i < g.ours.length; i++) {
    if (g.energy[i] >= SUB_AT) continue;
    let best = -1;
    for (let j = 0; j < g.bench.length; j++) {
      if (g.benchEnergy[j] < FRESH) continue;
      const fits = (k: number) => (g.bench[k].pos === g.ours[i].pos ? 1 : 0);
      if (best < 0 || fits(j) > fits(best) || (fits(j) === fits(best) && g.bench[j].ovr > g.bench[best].ovr)) best = j;
    }
    if (best < 0) continue;
    const off = g.ours[i];
    g.ours[i] = { ...g.bench[best], pos: off.pos };
    g.bench[best] = off;
    [g.energy[i], g.benchEnergy[best]] = [g.benchEnergy[best], g.energy[i]];
  }
}

export function startPossession(g: HoopsGame): Possession {
  const clutch = g.done >= g.total - CLUTCH;
  const ours = clutch ? g.ours.map(clutchOf) : g.ours;
  const theirs = clutch ? g.theirs.map(clutchOf) : g.theirs;
  const p = newPossession(ours, theirs, g.energy, rng(hashString('h2:' + g.seed + ':' + g.done)), g.defIQ, g.theirEnergy);
  if (clutch && [...ours, ...theirs].some((h) => h.abil.includes('icon'))) p.events.push('clutch:icon');
  p.heat = heatStage(g.heat.us);
  return p;
}

/**
 * A practice drill's set-up (Training Camp and Moments): the handler on his spot (the top of the
 * arc, or the elbow extended to finish), his man a step off; the passing drill faces a trap.
 */
export function practiceStart(p: Possession, drill: Drill): void {
  const h = p.bodies[0];
  const at = drill === 'finish' ? { cx: RIM.cx - 13, cz: 0 } : { cx: RIM.cx - 24.5, cz: 0 };
  Object.assign(h, at);
  h.home = { ...at };
  Object.assign(p.bodies[5], { cx: at.cx + 7, cz: at.cz + 2 });
  if (drill === 'pass') {
    p.scheme = 'trap';
    p.events = ['scheme:trap'];
  }
}

export function half(g: HoopsGame): 1 | 2 {
  return g.done < g.total / 2 ? 1 : 2;
}

/** Book a finished possession. Returns the mark it left. */
export function afterPossession(g: HoopsGame, p: Possession): Mark {
  const e = p.end ?? { kind: 'clock' as const, points: 0, text: '', who: -1 };
  let mark: Mark;
  if (e.kind === 'make') mark = e.points >= 3 ? (p.lastShot?.and1 ? 'A' : '3') : '2';
  else if (e.kind === 'miss') mark = 'X';
  else mark = 'TO';
  g.score += MARK_POINTS[mark];
  g.marks.push(mark);
  if (e.kind === 'make' && e.who >= 0 && e.who < 5) g.box[e.who] += MARK_POINTS[mark];
  // Heat (heat.ts): every PERFECT (+16 for a Heat Check card's), a basket, a clean possession (a shot
  // after two passes or more), a turnover; a possession played On Fire uses up one of its spell
  const wasFire = g.heat.us.fire > 0;
  let h = g.heat.us;
  for (const who of p.perfects) h = heatAfter(h, 'perfect', 'nba', p.bodies[who] && has(p.bodies[who].p, 'heat-check') ? HEAT_CHECK_EXTRA : 0);
  if (e.kind === 'make') h = heatAfter(h, 'score', 'nba');
  const turnover = e.kind !== 'make' && e.kind !== 'miss';
  if (turnover) h = heatAfter(h, 'turnover', 'nba');
  else if (p.passes >= 2) h = heatAfter(h, 'clean', 'nba');
  if (wasFire) h = heatUnitEnd(h);
  g.heat = { ...g.heat, us: h };
  g.perfects += p.perfects.length;
  g.moments += p.moments;
  if (turnover) g.turnovers++;
  // tiring: everyone a little, the ball handler and the scorer more, much less for great stamina
  // (a 50 drains about 2.7 times a 99); the defense tires by its own stamina too
  for (let i = 0; i < 5; i++) {
    const drain = 0.03 * (1.6 - g.ours[i].sta / 80) * (i === e.who ? 1.4 : 1);
    g.energy[i] = Math.max(0.55, g.energy[i] - Math.max(0.004, drain));
  }
  g.theirEnergy ??= g.theirs.map(() => 1);
  for (let i = 0; i < g.theirs.length; i++) g.theirEnergy[i] = Math.max(0.55, g.theirEnergy[i] - Math.max(0.004, 0.03 * (1.6 - g.theirs[i].sta / 80) * 0.9));
  g.done++;
  if (g.done === g.total / 2) {
    g.heat = { us: heatHalf(g.heat.us), them: heatHalf(g.heat.them) };
    for (let i = 0; i < 5; i++) g.energy[i] = Math.min(1, g.energy[i] + 0.3);
    for (let i = 0; i < g.theirEnergy.length; i++) g.theirEnergy[i] = Math.min(1, g.theirEnergy[i] + 0.3);
    for (let j = 0; j < g.bench.length; j++) g.benchEnergy[j] = Math.min(1, g.benchEnergy[j] + 0.3);
  }
  if (g.bench.length) substitute(g);
  if (g.done >= g.total) g.over = true;
  return mark;
}
