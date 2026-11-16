// The match grade (plan §3.14 and §4.8, V2 B.0.3): one letter for how a match was played, plus the
// numbers ut reads for objectives, the Touch rating and card mastery. Every sport fills it at the
// final whistle and puts it on `Progress.grade`; it never changes coin pay, and it never goes over
// the wire (`wireProgress` strips it, with the box).
//
// Dependency-free on purpose: it lands in the UT chunk (type-only imports only).

export interface MatchGrade {
  v: 1;
  letter: 'S' | 'A' | 'B' | 'C';
  /** a win with no turnovers */
  flawless: boolean;
  /** PERFECT skill moments: releases, finishes, boards */
  perfects: number;
  /** gold chances taken: rings offered gold and attempted (ut's Touch rating = perfects / moments) */
  moments: number;
  /** the highest the Heat bar reached */
  bestHeat: number;
  /** On Fire spells */
  fires: number;
  /** points per possession / drive / attack */
  ppu: number;
  /** the par it was graded against */
  par: number;
}

/** A sport's box score, as the host carries it (NBA's lines are hoops2/box.ts `BoxLine`). */
export interface BoxData<L = object> {
  us: L[];
  them: L[];
  /** player of the game, by name */
  pog?: string;
}

/** The par (offense points per unit) for each difficulty rung, and online. */
export const GRADE_PAR = { rookie: 1.2, pro: 1.1, allstar: 1.05, legend: 0.97, online: 1.1 } as const;
/** S at ≥ 1.25 × par, A at ≥ 1.10 ×, B at ≥ 0.90 ×, otherwise C. */
export const GRADE_AT = { S: 1.25, A: 1.1, B: 0.9 } as const;

export function gradeLetter(ppu: number, par: number): MatchGrade['letter'] {
  return ppu >= GRADE_AT.S * par ? 'S' : ppu >= GRADE_AT.A * par ? 'A' : ppu >= GRADE_AT.B * par ? 'B' : 'C';
}

/**
 * The par for the defense a match was played against (difficulty.ts levels: Rookie −0.5, Pro 0,
 * All-Star 0.5, Legend 1), or online.
 */
export function parFor(def: number, online: boolean): number {
  if (online) return GRADE_PAR.online;
  return def <= -0.25 ? GRADE_PAR.rookie : def < 0.25 ? GRADE_PAR.pro : def < 0.75 ? GRADE_PAR.allstar : GRADE_PAR.legend;
}

/**
 * A grade at the whistle. `turnovers` sets FLAWLESS provisionally (0 turnovers); the host, which
 * knows the result, confirms it with `settleGrade`.
 */
export function makeGrade(g: { points: number; units: number; par: number; turnovers: number; perfects: number; moments: number; bestHeat: number; fires: number }): MatchGrade {
  const ppu = g.units > 0 ? g.points / g.units : 0;
  return {
    v: 1,
    letter: gradeLetter(ppu, g.par),
    flawless: g.turnovers === 0,
    perfects: g.perfects,
    moments: g.moments,
    bestHeat: g.bestHeat,
    fires: g.fires,
    ppu: Math.round(ppu * 1000) / 1000,
    par: g.par
  };
}

/** FLAWLESS needs the win: the host settles it once both scores are in. */
export function settleGrade<P extends { grade?: MatchGrade }>(p: P, won: boolean): P {
  return p.grade && p.grade.flawless && !won ? { ...p, grade: { ...p.grade, flawless: false } } : p;
}

/** What goes on the wire: the progress without the grade and the box (they stay on this phone). */
export function wireProgress<P extends { grade?: unknown; box?: unknown }>(p: P): Omit<P, 'grade' | 'box'> {
  if (p.grade === undefined && p.box === undefined) return p;
  const { grade: _g, box: _b, ...rest } = p;
  void _g;
  void _b;
  return rest;
}
