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
   * The match grade (V2 §B.0.3, contract C22; football since nfl-4). Only on a FINISHED match's
   * Progress, from the game screen's onDone; never in onProgress, and never on the wire (Arcade
   * sends `wireProgress`, and the receiver's arcadeOf keeps only score, drive, done, ends, plays).
   */
  grade?: MatchGrade;
}

/** How a match was played, for objectives, mastery and the Touch rating (never pays coins directly). */
export interface MatchGrade {
  /** your points a drive (possession, attack) against par for the difficulty */
  letter: 'S' | 'A' | 'B' | 'C';
  /** your PERFECT moments */
  perfects: number;
  /** the gold rings you were offered */
  chances: number;
  /** the best Heat you reached (0-100) */
  heatBest: number;
  /** how many times you went ON FIRE */
  lit: number;
  /** you won with no turnovers (settled by gradeResult once the rival's score is final) */
  flawless: boolean;
  /** your turnovers (what flawless reads) */
  turnovers: number;
}

/** What goes to the other phone: never the grade (local, and finished-only). */
export function wireProgress(p: Progress): Progress {
  if (!p.grade) return p;
  const { grade, ...rest } = p;
  void grade;
  return rest;
}

/** The grade once the result is known: FLAWLESS is a win with no turnovers. */
export function gradeResult(us: Progress, them: Pick<Progress, 'score'>): Progress {
  if (!us.grade) return us;
  return { ...us, grade: { ...us.grade, flawless: us.grade.turnovers === 0 && us.score > them.score } };
}

/** the rival as the scoreboard shows them */
export interface RivalLive {
  name: string;
  score: number;
  drive: number;
  done: boolean;
  /** online, once you're done: when the AI finishes for them if they don't run another play */
  deadline?: number | null;
  /** how their drives (possessions) have ended so far, as the wire carries them (nfl-4: football's
   * rival Heat bar is worked out from these alone) */
  ends?: string[];
}
