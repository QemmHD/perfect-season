// What each side of a played-out head to head knows about itself and the other: points so far,
// drives (football) or possessions (basketball) done, and how each ended.
import type { BoxData, MatchGrade } from './hud/grade';
export interface Progress {
  score: number;
  drive: number;
  done: boolean;
  ends: string[];
  /** plays run (or possessions, in basketball): moves on while the drive's still going */
  plays?: number;
  /** this phone's box score and match grade at the final (plan §4.8): kept off the wire (wireProgress) */
  box?: BoxData;
  grade?: MatchGrade;
}

/** the rival as the scoreboard shows them */
export interface RivalLive {
  name: string;
  score: number;
  drive: number;
  done: boolean;
  /** online, once you're done: when the AI finishes for them if they don't run another play */
  deadline?: number | null;
}
