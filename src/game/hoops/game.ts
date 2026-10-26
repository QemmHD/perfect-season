// A game of arcade basketball: a set number of possessions on offense, your five against the
// rival's. Only your points count here; the other side plays its own possessions on its phone (or,
// against the AI, the autopilot plays them).
import { hashString, rng } from '../../engine/rng';
import type { Baller } from './model';
import { type PossEnd, type Poss, setUp } from './play';

export const POSSESSIONS = 12;

/** how a possession ended, for the strip of results: 2, 3, a miss or a turnover */
export type PossMark = '2' | '3' | 'X' | 'TO';

export interface HoopGame {
  ours: Baller[];
  theirs: Baller[];
  seed: string;
  total: number;
  done: number;
  score: number;
  marks: PossMark[];
  over: boolean;
}

export function newHoopGame(ours: Baller[], theirs: Baller[], seed: string, total = POSSESSIONS): HoopGame {
  return { ours, theirs, seed, total, done: 0, score: 0, marks: [], over: false };
}

export function startPoss(g: HoopGame): Poss {
  return setUp(g.ours, g.theirs, rng(hashString('poss:' + g.seed + ':' + g.done)));
}

export function afterPoss(g: HoopGame, e: PossEnd): PossMark {
  const mark: PossMark = e.kind === 'make' ? (e.points === 3 ? '3' : '2') : e.kind === 'miss' || e.kind === 'block' ? 'X' : 'TO';
  g.score += e.points;
  g.marks.push(mark);
  g.done++;
  if (g.done >= g.total) g.over = true;
  return mark;
}
