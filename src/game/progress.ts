// What each side of a played-out head to head knows about itself and the other: points so far,
// drives (football) or possessions (basketball) done, and how each ended.
export interface Progress {
  score: number;
  drive: number;
  done: boolean;
  ends: string[];
}

/** the rival as the scoreboard shows them */
export interface RivalLive {
  name: string;
  score: number;
  drive: number;
  done: boolean;
}
