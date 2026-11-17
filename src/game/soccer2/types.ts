// Soccer v2 ("Attacks"): the players and one attack's state. Implemented by Claude (Anthropic),
// 2026-11-01. Pitch metres: x across (0 to 68, the touchlines), y up the pitch from your own goal
// line (0) to the goal you attack (105). h is height off the grass. Your side always attacks up.
import type { RingDial, RingState } from './v2';

/** A player rated from his card's face: PAC SHO PAS DRI DEF PHY, or a keeper's DIV HAN KIC REF SPD POS. */
export interface SoccerPlayer {
  id: string;
  name: string;
  /** the short name on the tag over his head */
  tag: string;
  num: number | null;
  /** centimetres */
  ht: number;
  /** GK CB FB DM CM AM W ST (the first listed on his card) */
  pos: SoccerPos;
  /** every position on his card */
  pos2: SoccerPos[];
  ovr: number;
  /** face stats, 0-99 (a promo can go above 99: kept finite, with bounded extra effect) */
  a: Record<string, number>;
  keeper: boolean;
}

export type SoccerPos = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST';

/** A starting eleven in a 4-3-3: the keeper, the back four (LB LCB RCB RB), three in midfield
 * (LCM, the holder, RCM) and three up front (LW ST RW). */
export interface Squad {
  name: string;
  abbr: string;
  c1: string;
  c2: string;
  gk: SoccerPlayer;
  def: [SoccerPlayer, SoccerPlayer, SoccerPlayer, SoccerPlayer];
  mid: [SoccerPlayer, SoccerPlayer, SoccerPlayer];
  fwd: [SoccerPlayer, SoccerPlayer, SoccerPlayer];
}

export interface Pt {
  x: number;
  y: number;
}

/** The kinds of attack a match deals: patient build-up, a counter, a wide overload, set pieces. */
export type Scenario = 'build' | 'counter' | 'wide' | 'corner' | 'freekick' | 'penalty';

/** How an attack ends: Goal, Saved, Wide (or over), Blocked, Lost, Offside, Time. */
export type AttackEnd = 'G' | 'S' | 'W' | 'B' | 'L' | 'O' | 'T';

export type Act =
  | 'idle'
  | 'run'
  | 'dribble'
  | 'kick'
  | 'tackle'
  | 'down'
  | 'dive'
  | 'catch'
  | 'header'
  | 'celebrate'
  | 'set'
  | 'wall'
  /* soccer-5 (§5.5 acts): a defender containing goal-side, facing the ball; his visible wind-up before a
     poke at a ball exposed between touches; a man on the ball with his back to a defender */
  | 'jockey'
  | 'poke'
  | 'shield';

export type Role = 'att' | 'def' | 'gk';

export interface Body {
  id: number;
  side: 'A' | 'D';
  role: Role;
  p: SoccerPlayer;
  /** formation slot (LW ST RW LCM CM RCM LB LCB RCB RB GK) */
  slot: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** a keeper's dive: his height off the grass and its rate */
  h: number;
  vh: number;
  act: Act;
  actAt: number;
  /** where his shape wants him (the zonal block's landmark, an attacker's lane) */
  home: Pt;
  /** the attacker a defender is marking */
  mark: number | null;
  /** can't act until then (beaten, on the floor, recovering from a dive) */
  stunUntil: number;
  /** next tackle he may try */
  tackleReady: number;
  /** an attacker's run in behind: where to, and when it was started */
  run: Pt | null;
  /** a tackle he's gathering for (Infinity: none) */
  commit: number;
  /** his one try at the ball in flight: -1 not yet, 0 missed it, 1 used on a shot */
  tried: number;
  /** the way he faces (unit), for the drawing and the first touch */
  fx: number;
  fy: number;
  /** render only (the players' action contract, docs/studio-overhaul/soccer.md §5.5): what his last
   * kick or throw was. The engine writes it and never reads it. */
  passKind?: PassKind | 'cross' | 'throw' | 'loftedThrough' | 'shot' | 'header' | 'pen' | 'fk' | 'clear';
  /* ---- render only, written by the engine from deterministic geometry and never read by it, and no
     random number is drawn for them (§5.5; soccer-4). A test randomises them every step. ---- */
  /** the foot his last kick was struck with: the ball's side of his body across the strike */
  kickFoot?: 'L' | 'R';
  /** his last shot: placed, or a power shot (held past the gold); `power` 0..1 sets the backlift */
  shotKind?: 'placed' | 'power';
  power?: number;
  /** how he struck it: a header (crouch, rise, neck snap), a volley (side-on swing) or on the floor */
  contact?: 'foot' | 'head' | 'volley';
  /** a keeper's dive: low, mid or high */
  diveHeight?: 'low' | 'mid' | 'high';
  /** a keeper's split step: when it landed (attack time), at least 4 frames before every strike */
  keeperSet?: number;
  /** a block lunge (and, from soccer-8, a slide tackle): when, and which way (unit, pitch metres) */
  slide?: { at: number; dx: number; dy: number };
  /** the time of his last dribble touch (attack time; soccer-5: a real knock-on) */
  touchAt?: number;
  /** where he looks while he jockeys: the ball (pitch metres; sim facing fx/fy stays velocity-based) */
  look?: Pt;
  /* ---- engine state (soccer-5) ---- */
  /** a defender's read of the man on the ball: when he may go in (Infinity: not reading) */
  readAt?: number;
  /** the touch (its time) a knock last ran into him on: one go at it a touch */
  blockAt?: number;
}

/**
 * The ball at a dribbler's feet between touches (soccer-5, V2 B.3.4): when the last touch was, when
 * the next is due, how far it was knocked out beyond the foot (m), and how hard the ball slows while it
 * rolls (m/s²: the knock is solved so he catches it on the beat). `turnAt`: a touch that turned it more
 * than 60° (the ball is exposed for a moment after it).
 */
export interface Touch {
  /** the man it's at the feet of */
  by: number;
  at: number;
  next: number;
  out: number;
  k: number;
  turnAt?: number;
  /** the run he wants (the stick, or the brain's): unit way and how hard (0..1), and on the sprint */
  want?: { x: number; y: number; mag: number; sprint: boolean };
  /** a close-control touch (the stick part-way) */
  close?: boolean;
}

export type PassKind = 'ground' | 'lofted' | 'through';

/** The ball in 2.5D: on the grass or in the air, with spin bending its path. */
export interface Ball {
  x: number;
  y: number;
  h: number;
  vx: number;
  vy: number;
  vh: number;
  /** sideways bend (m/s² per m/s of speed, + to the ball's left), decays in flight */
  curl: number;
  /** topspin: extra downward pull (m/s²) on a dipping free kick */
  dip: number;
  /** the body at his feet (null: loose or in flight) */
  owner: number | null;
  /** who touched it last, and how */
  last: number | null;
  /** what it is doing in flight; `bounces`: how often it has bounced since (a shot or parry that has
   * bounced twice is a loose ball again: engine.ts deadShot) */
  flight: null | { kind: PassKind | 'shot' | 'cross' | 'parry' | 'clear' | 'throw'; from: number; to: number | null; at: number; bounces?: number };
}

/** Why a ring is amber or red (soccer-4): a defender within 2 m, a first-time hit turning the ball
 * more than 90° across the body, a header from beyond 8 m, a tight angle inside 12 m, or out of range;
 * soccer-5: a sprint with the ball knocked out ahead (`stride`). */
export type RingWhy = 'pressure' | 'first' | 'header' | 'angle' | 'range' | 'stride';

/** SHOOT held: the gold ring (V2 B.0.1; the power meter before soccer-4). top is where the gold sits
 * (seconds after the press: the wind-up, 0.35 s at 11 m to 0.62 s at 25 m). */
export interface Meter {
  t0: number;
  top: number;
  /** half-width of the gold window, seconds (never under 30 ms) */
  green: number;
  /** the ring's state now (recomputed every step while SHOOT is held): gold only when a release in
   * the window places the ball exactly on the reticle */
  ring: RingState;
  /** why it isn't gold, and the dial the toast names */
  why?: RingWhy;
  dial?: RingDial;
  /** a first-time shot or header on an arriving ball */
  first: boolean;
  /** aim assist's target while SHOOT is held (aim space: x -1..1 across, y -1 low..1 high) */
  assist?: Pt;
  /** the person's aim while SHOOT is held (the drag on SHOOT; null: assist) */
  aim?: Pt | null;
}

/** The last shot, for the HUD and the replay. */
export interface ShotInfo {
  by: number;
  /** a gold release (PERFECT): in the window on a gold ring, so the ball went exactly on the reticle */
  greened: boolean;
  /** the release was inside the window (on any ring) */
  inWindow?: boolean;
  /** the ring at the release, and why it wasn't gold */
  ring?: RingState;
  why?: RingWhy;
  /** how far out it was struck (m to the goal's centre), and how wide (rad off the centre line) */
  d?: number;
  ang?: number;
  /** a keeper's parry: pushed out wide, back out in front, or round the post (bookkeeping only) */
  parried?: 'wide' | 'front' | 'post';
  /** the shot's xG (xg.ts), filled in by the match screen for the read-out; never read by the engine */
  xg?: number;
  /** a first-time hit: how far it turned the ball (degrees; 0 straight on, 180 back the way it came) */
  turn?: number;
  /** timing: negative early, positive late (seconds off the top) */
  off: number;
  power: number;
  speed: number;
  /** the aimed point in the goal mouth (x across, h up) */
  aim: { x: number; h: number };
  /** where it actually crosses the goal line (x, h), when it gets there */
  cross: { x: number; h: number } | null;
  /** the error cone's half angle (degrees, 1 sd) */
  cone: number;
  kind: 'shot' | 'header' | 'volley' | 'pen' | 'fk';
  /** the green's half-width at the release (s), for the timing read-out */
  green?: number;
  /** aim assist chose the target (no drag) */
  assisted?: boolean;
  /** where the keeper stood (x across) when it was struck, for the miss read-out */
  gkX?: number;
}

export interface Attack {
  t: number;
  /** seconds of open play used (set pieces and shots in the air don't count) */
  used: number;
  scenario: Scenario;
  /** the attack's clock (seconds of play allowed), and the stoppage-time flag */
  clock: number;
  stoppage: boolean;
  bodies: Body[];
  ball: Ball;
  /** the attacker the stick controls */
  ctrl: number;
  phase: 'pre' | 'live' | 'dead';
  /** a set piece waiting to be taken (corner, free kick, penalty): the taker stands over it */
  setPiece: null | { kind: 'corner' | 'freekick' | 'penalty'; spot: Pt; side: number };
  end: null | { kind: AttackEnd; text: string; x: number; y: number; t: number };
  rand: () => number;
  /** shared stamina for sprinting (0-1) */
  stamina: number;
  sprinting: boolean;
  meter: Meter | null;
  lastShot: ShotInfo | null;
  /** sideways bend for the next set-piece kick (-1 to 1) */
  curl: number;
  /** a penalty awarded in this attack: the foul that won it */
  penaltyFrom?: string;
  /** the defense's sharpness beyond its ratings: -0.5 to 1 (difficulty) */
  defIQ: number;
  events: string[];
  /** fouls won (a free kick or penalty comes from them) */
  fouls: number;
  /** a shot waiting to be struck: the leg swings, the ball goes at `at`; `exact`: a gold release,
   * re-solved from where the ball is at the strike so it crosses the line on the reticle */
  strike: null | { at: number; by: number; vx: number; vy: number; vh: number; curl: number; dip: number; info: ShotInfo; exact?: { x: number; h: number; speed: number } };
  /** a pass waiting to be struck */
  kick: null | { at: number; by: number; to: number | null; kind: PassKind | 'cross' | 'throw'; vx: number; vy: number; vh: number; curl: number; /** a person's lofted through ball (THRU held; render only) */ loftedThrough?: true };
  /** the free ball's predicted path (a point every 1/30 s), for runs onto it and the keeper */
  path: { t: number; x: number; y: number; h: number; v: number }[] | null;
  /** when that path starts (attack time) */
  pathAt: number;
  /** the defender going for the pass in flight */
  chaser: number | null;
  /** attackers in an offside position when the last pass was played */
  offIds: number[];
  /** the keeper's read of a shot: when he goes, from where, to where */
  gkPlan: null | { react: number; x0: number; tx: number; th: number; at: number; y0?: number; ty?: number; far?: boolean };
  /** a first-time hit let go before the ball arrived */
  first: null | ShotRelease;
  /** the set-piece taker */
  taker: number | null;
  /** who struck the last shot */
  shotBy: number | null;
  /** the last release of SHOOT, for the ring's read-out after the strike */
  release?: { at: number; off: number; green: number; top: number; ring: RingState; gold: boolean; why?: RingWhy };
  /** gold releases in this attack (the person's and the autopilot's: Heat reads them from soccer-7) */
  perfects?: number;
  /** the last pass or loose ball someone brought under control: who, when and the way it was going
   * (a pass he plays straight away is a first-time pass: harder the more it turns the ball) */
  recv?: { by: number; at: number; dx: number; dy: number };
  /** the keeper has come off his line in this attack to race for the ball (once an attack) */
  rushAt?: number;
  /** the ball in the air the keeper has called for (its flight's start): his defenders leave it to him */
  claimFor?: number;
  /** a pass the person played: the stick's way when it went (the receiver runs onto the ball until
   * the stick moves off it) */
  passStick?: Pt | null;
  /** a penalty's keeper told which way to go (a person keeping in a shootout): -1 left, 0 stay, 1 right */
  guess?: number;
  /** restarts earned in this attack (R-2: a corner off a defender or a parry, a quick throw-in), at
   * most RESTARTS.max; and the latest one's kind (a corner's marking and headers apply after it) */
  restarts?: number;
  restart?: 'corner' | 'throw';
  /** the dribble (soccer-5): the ball knocked ahead on touch beats, rolling between them */
  touch?: Touch | null;
  /** a pass or shot asked for while the ball was out of his reach: he plays it when he gets to it */
  pending?: null | { kind: 'pass'; how: PassKind | 'loftedThrough'; dir: Pt | null; free: boolean; at: number; to?: number } | { kind: 'shot'; r: ShotRelease; assisted: boolean; at: number };
  /** the ball won off the man on it (soccer-5): by whom, and how far the ball was from his feet (m) */
  tackled?: { by: number; gap: number; poke: boolean };
  /** yellow cards shown in this attack (players' ids; R-3: a foul from behind on a breakaway) */
  yellows?: string[];
  /** a touch he couldn't keep (a loose ball off his own heavy touch), and pokes his shield held off */
  lostTouch?: boolean;
  shielded?: number;
}

/** A release of SHOOT, judged: the offset from the gold (s), whether it was in the window, the power,
 * the aim (null: assist), the window and the ring it was let go on. */
export interface ShotRelease {
  off: number;
  inWin: boolean;
  power: number;
  aim: Pt | null;
  green: number;
  ring: RingState;
  why?: RingWhy;
}
