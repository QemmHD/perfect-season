// Game Design V2's shared pieces, as soccer uses them: the one door (Claude 2026-11-16, studio
// overhaul soccer-1; the contracts are in docs/studio-overhaul/soccer.md §5.0).
//
// Soccer code and soccer tests import the shared V2 pieces (F.1) only from here, so they run the same
// against a stand-in or the real thing. A piece that is in this branch is re-exported from its home.
// A piece another team is still writing is described below by the interface soccer writes against;
// the task that first needs it adds a stand-in file beside this one (stick.ts, perfect.ts, heat.ts,
// hud.tsx, haptics.ts, playtime.ts, geometry.ts, each headed "merge: replace with <team>'s <file>,
// then delete this file") and re-exports it here. At merge the lead points these exports at the
// shared files and deletes the stand-ins. Where another team publishes different names first, theirs
// win and only this folder changes.
//
// Nothing in here may be read by the engine, the AI's simulations or anything both phones compute:
// these are input, presentation and bookkeeping pieces (V2 F.3: no protocol bump on their own).

/* ---------- in this branch ---------- */

/** The PERFECT chime (`sfx.perfect(streak)`), the closing ring's tick (`sfx.ringTick(i)`) and the
 * woodwork's clang (`sfx.post()`): soccer's under V2 F.1, synthesized, silent with the sound off. */
export { PERFECT_MAX_STEP, perfectStep, sfx } from '../../../lib/sound';

/* ---------- stand-ins until the other teams' pieces are in this branch (soccer-2) ---------- */

/** nba's floating stick (`src/game/stick.ts` + `Stick.tsx`) and HUD kit (`src/game/hud/*`). */
export { DEAD_ZONE, FOLLOW_RING, inStickZone, SPRINT_OFF, SPRINT_RING, STICK_IDLE, stickDown, stickGeom, stickIdle, stickMove, stickOut, sprintEdge, stickUp, type StickGeom, type StickOut, type StickPointer, type StickState } from './stick';
export { PauseButton, ScoreBug, Stick, ToastLine } from './hud';
/** nba's controls-geometry tokens, as numbers (the CSS is ./geometry.css). */
export { type Circle, gapOf, type Geometry, geometryFor, type Insets, meets, type Rect, rectOf, safeBox } from './geometry';
/** ut's `src/lib/haptics.ts`. */
export { haptic, HAPTIC_PATTERN, hapticCount, heartbeat } from './haptics';
/** ut's `src/lib/playtime.ts`. */
export { playtimeState, usePlaytime } from './playtime';

/* ---------- written by other teams: the interfaces soccer relies on (§5.0.2) ---------- */

/** A point or a direction on screen or on the pitch. */
export interface Vec {
  x: number;
  y: number;
}

/** The floating stick (`src/game/Stick.tsx` + `stick.ts`, nba): its base floats to the first touch
 * in the zone; a thumb resting there before the whistle is live at it; release is `{0, 0}`; sprint is
 * on past 1.15× the ring's radius and off back under 1.0×; one pointer per stick. */
export interface StickProps {
  /** the stick's zone on screen (design px) */
  zone: { x: number; y: number; w: number; h: number };
  /** |v| ≤ 1, two axes, screen x right and y down */
  onVector: (v: Vec, sprint: boolean) => void;
  live?: boolean;
  /** the resting base drawn faintly where the stick last was */
  ghost?: boolean;
}

/** The gold ring (`src/game/perfect.ts`, nba). Pure: no Math.random, no Date.now. */
export type RingState = 'gold' | 'amber' | 'red';
/** What closed the gold window, for the toast line. */
export type RingDial = 'TIMING' | 'PRESSURE' | 'RANGE';
export interface RingWindowIn {
  baseHalfMs: number;
  /** the rating that sets it, 0..1 */
  rating01: number;
  contested: boolean;
  inRange: boolean;
  /** On Fire: the window ×1.25, and uncontested amber becomes gold */
  fire: boolean;
}
export interface RingWindow {
  state: RingState;
  /** never under 30 ms */
  goldHalfMs: number;
  dial?: RingDial;
}
export type JudgeWord = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE';
/** `judge(pressTs, releaseTs, targetMs, win, lagMs)`: from the touches' own timestamps. Soccer turns
 * `offMs` into the release time in game seconds that `releaseShoot` takes, so the engine never reads a
 * pointer timestamp. */
export interface Judgement {
  offMs: number;
  word: JudgeWord;
  gold: boolean;
}
/** `drawRing(ctx, …)`: the gold arc at least 8 px. */
export interface RingDraw {
  x: number;
  y: number;
  r: number;
  /** 0..1 */
  progress: number;
  goldFrom: number;
  goldTo: number;
  state: RingState;
}

/** Heat (`src/game/heat.ts`, nba): pure and deterministic. For soccer a goal is +40 and On Fire lasts
 * one attack; the state lives on the match (and inside `aiProgressFor` for the AI's sims). */
export type HeatEvent = 'perfect' | 'score' | 'stop' | 'clean' | 'turnover' | 'conceded' | 'half';
export interface HeatState {
  /** 0..100 */
  v: number;
  /** On Fire units left */
  fire: number;
  heating: boolean;
  best: number;
}

/** The HUD kit (`src/game/hud/*`, nba). */
export interface ScoreBugProps {
  you: number;
  rival: number;
  /** for soccer "67' · 5/7" */
  clock: string;
  heat: HeatState;
  rivalHeat?: HeatState;
  clutch: boolean;
  /** the 3 px progress line, 0..1 */
  progress: number;
}
export interface ToastProps {
  text: string;
  kind: 'perfect' | 'good' | 'bad' | 'plain';
}
export interface PauseButtonProps {
  onPress: () => void;
}

/** `haptic(kind)` (`src/lib/haptics.ts`, shell): gesture-gated on iOS, a no-op where unsupported. */
export type HapticKind = 'tick' | 'double' | 'long';

/** `usePlaytime('match', opts)` (`src/lib/playtime.ts`, shell). */
export interface PlaytimeOpts {
  paused: boolean;
  /** only Auto-defend or SIM is playing: that time alone never counts */
  auto: boolean;
  /** between phases: the only moment a break reminder may show */
  stoppage: boolean;
}
export interface PlaytimeInfo {
  /** "Today 27 min · next reward at 30", for the pause sheet */
  todayLine?: string;
}

/** The fixed action-safe box (V2 A.5) in design px, read through one function (`safeBox()`). */
export interface SafeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ---------- written by soccer for others (§5.0.1 b): the final Progress's grade ---------- */

/** `Progress.grade` (soccer-9; stripped before the wire like `box`). If nba publishes a different
 * shape in `src/game/progress.ts` first, soccer adopts nba's names. */
export interface MatchGrade {
  letter: 'S' | 'A' | 'B' | 'C';
  /** your gold releases: shots, tackles, tricks */
  perfects: number;
  /** 0..100 */
  bestHeat: number;
  /** times you went ON FIRE */
  fire: number;
  /** a win with no 'L' end in your attacks */
  flawless: boolean;
  /** your goals per attack, and the level's par */
  perAttack: number;
  par: number;
}
