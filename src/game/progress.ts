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

/** a rival's final record that says it forfeited: done, with an explicit 'FF' end (never inferred) */
export const forfeitedBy = (p: Progress | null | undefined) => !!p?.done && p.ends.includes('FF');

/**
 * What `Arcade` settles on (soccer-2 re-review fix), worked out in the same render as the progress
 * it reads, so a forfeit can never miss the commit that finishes the match. `forfeit` is the side
 * that has already forfeited on this phone (state); otherwise this phone's own padded record
 * (`mine.forfeit`) or, when `watchFF` (soccer online), the rival's explicit 'FF' ends say it.
 * `us`/`them` are null until that side is settled; `final` is the pair to report (a forfeit's 3-0
 * award applied), or null while the match is still on or a level match waits for penalties.
 */
export function settleInputs(a: {
  mine: Progress | null | undefined;
  rivalLive: Progress | null | undefined;
  forfeit: 'us' | 'them' | null;
  watchFF: boolean;
  online: boolean;
  /** the other phone gave up on this one: the AI finished your attacks */
  taken?: Progress | null;
  /** this phone gave up on the rival: the AI finished theirs */
  takeover?: Progress | null;
  /** solo: the AI's whole match */
  ai?: Progress | null;
  /** soccer: a level score goes to penalties */
  soccer: boolean;
  /** the agreed or played shootout, once there is one */
  pens?: unknown;
}): { ff: 'us' | 'them' | null; us: Progress | null; them: Progress | null; level: boolean; final: [Progress, Progress] | null } {
  const ff = a.forfeit ?? (a.mine?.forfeit ? 'us' : a.watchFF && forfeitedBy(a.rivalLive) ? 'them' : null);
  const soFar = (p: Progress | null | undefined): Progress => p ?? { score: 0, drive: 0, done: false, ends: [] };
  const us = a.taken ?? (a.mine?.done ? a.mine : ff === 'them' ? soFar(a.mine) : null);
  const them = a.online ? (a.takeover ?? (a.rivalLive?.done ? a.rivalLive : ff === 'us' ? soFar(a.rivalLive) : null)) : (a.ai ?? null);
  const level = a.soccer && !ff && !!us && !!them && us.score === them.score;
  const final = !us || !them || (level && !a.pens) ? null : ff ? awarded(us, them, ff) : ([us, them] as [Progress, Progress]);
  return { ff, us, them, level, final };
}
