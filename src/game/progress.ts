// What each side of a played-out head to head knows about itself and the other: points so far,
// drives (football) or possessions (basketball) done, and how each ended.
export interface Progress {
  score: number;
  drive: number;
  done: boolean;
  ends: string[];
  /** plays run (or possessions, in basketball): moves on while the drive's still going */
  plays?: number;
  /**
   * merge: nba-7 / nfl contract C1 publish this field; keep theirs. This side forfeited online (its
   * `ends` are padded with 'FF' up to the match's total). The wire never carries it: the 'FF' ends do.
   */
  forfeit?: boolean;
}

/**
 * merge: nba's strip in `Arcade.progress()` does the same; keep one. What of a Progress goes on the
 * wire to the other phone: the five shared fields only, so local extras (`forfeit`, and the box score
 * and grade ut contract A adds to the final Progress) never leave this phone.
 */
export function wireOf(p: Progress): Progress {
  return { score: p.score, drive: p.drive, done: p.done, ends: p.ends.slice(), plays: p.plays };
}

/** the rival as the scoreboard shows them */
export interface RivalLive {
  name: string;
  score: number;
  drive: number;
  done: boolean;
  /** online, once you're done: when the AI finishes for them if they don't run another play */
  deadline?: number | null;
  /** soccer, online: they forfeited (an explicit 'FF' on their record): no penalties, the match is yours */
  forfeit?: boolean;
}

/**
 * Soccer's forfeit (soccer-2 fix): football's rule. The side that forfeits loses 3-0, or by the
 * score as played when that was already worse for it. Both phones get the same winner, whatever
 * the score was when the forfeit came, and a forfeit can never be a win for the side that left.
 */
export function awarded(us: Progress, them: Progress, by: 'us' | 'them'): [Progress, Progress] {
  const [loser, winner] = by === 'us' ? [us, them] : [them, us];
  const kept = winner.score - loser.score >= 3;
  const l = kept ? loser : { ...loser, score: 0 };
  const w = kept ? winner : { ...winner, score: 3 };
  return by === 'us' ? [l, w] : [w, l];
}

/**
 * Can this side still forfeit online? Only while attacks are left to pad with 'FF': once every one is
 * in (the result, or an agreed shootout, is settled on both phones) a forfeit could never reach the
 * other phone, so it is refused (soccer-2 fix).
 */
export const canForfeit = (p: Progress | null | undefined, total: number) => !p?.done && (p?.ends.length ?? 0) < total;
