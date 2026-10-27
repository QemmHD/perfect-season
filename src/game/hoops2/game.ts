// A game of arcade basketball: two halves of possessions on offense against the rival's five.
// Players tire as they go (less by stamina, back up at the half); three straight buckets put a man
// on fire (a wider green window until he misses).
import { hashString, rng } from '../../engine/rng';
import { newPossession } from './engine';
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
  streak: number[];
  fire: number;
  /** points by player */
  box: number[];
  over: boolean;
}

export function newHoopsGame(ours: Hooper[], theirs: Hooper[], seed: string, total = POSSESSIONS): HoopsGame {
  return { ours, theirs, seed, total, done: 0, score: 0, marks: [], energy: ours.map(() => 1), streak: ours.map(() => 0), fire: -1, box: ours.map(() => 0), over: false };
}

export function startPossession(g: HoopsGame): Possession {
  const p = newPossession(g.ours, g.theirs, g.energy, rng(hashString('h2:' + g.seed + ':' + g.done)));
  p.fire = g.fire;
  return p;
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
  if (e.kind === 'make' && e.who >= 0 && e.who < 5) {
    g.box[e.who] += MARK_POINTS[mark];
    g.streak[e.who]++;
    if (g.streak[e.who] >= 3) g.fire = e.who;
  }
  const shooter = p.lastShot && !p.lastShot.make ? p.bodies.find((b) => b.side === 'O' && p.events.includes('release')) : null;
  void shooter;
  if (e.kind !== 'make') {
    // a miss or a turnover cools whoever was on fire
    for (let i = 0; i < 5; i++) if (i === e.who || e.kind === 'miss') g.streak[i] = Math.min(g.streak[i], 0);
    if (g.fire >= 0 && (e.kind === 'miss' || e.who === g.fire)) g.fire = -1;
  }
  // tiring: everyone a little, the ball handler and the scorer more, less for great stamina
  for (let i = 0; i < 5; i++) {
    const drain = 0.03 * (1.25 - g.ours[i].sta / 140) * (i === e.who ? 1.4 : 1);
    g.energy[i] = Math.max(0.55, g.energy[i] - drain);
  }
  g.done++;
  if (g.done === g.total / 2) for (let i = 0; i < 5; i++) g.energy[i] = Math.min(1, g.energy[i] + 0.3);
  if (g.done >= g.total) g.over = true;
  return mark;
}
