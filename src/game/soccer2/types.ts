// Soccer v2 ("Attacks"): the players and one attack's state. Implemented by Claude (Anthropic),
// 2026-11-01. Pitch metres: x across (0 to 68, the touchlines), y up the pitch from your own goal
// line (0) to the goal you attack (105). h is height off the grass. Your side always attacks up.

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
  | 'wall';

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
  flight: null | { kind: PassKind | 'shot' | 'cross' | 'parry' | 'clear'; from: number; to: number | null; at: number; bounces?: number };
}

/** SHOOT held: the power meter. top is where the green slice sits (seconds after the press). */
export interface Meter {
  t0: number;
  top: number;
  /** half-width of the green, seconds */
  green: number;
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
  greened: boolean;
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
  /** a shot waiting to be struck: the leg swings, the ball goes at `at` */
  strike: null | { at: number; by: number; vx: number; vy: number; vh: number; curl: number; dip: number; info: ShotInfo };
  /** a pass waiting to be struck */
  kick: null | { at: number; by: number; to: number | null; kind: PassKind | 'cross'; vx: number; vy: number; vh: number; curl: number };
  /** the free ball's predicted path (a point every 1/30 s), for runs onto it and the keeper */
  path: { t: number; x: number; y: number; h: number; v: number }[] | null;
  /** when that path starts (attack time) */
  pathAt: number;
  /** the defender going for the pass in flight */
  chaser: number | null;
  /** attackers in an offside position when the last pass was played */
  offIds: number[];
  /** the keeper's read of a shot: when he goes, from where, to where */
  gkPlan: null | { react: number; x0: number; tx: number; th: number; at: number; y0?: number; ty?: number };
  /** a first-time hit let go before the ball arrived */
  first: null | { off: number; greened: boolean; power: number; aim: Pt | null; green: number };
  /** the set-piece taker */
  taker: number | null;
  /** who struck the last shot */
  shotBy: number | null;
  /** the last release of SHOOT, for the meter's read-out after the strike */
  release?: { at: number; off: number; green: number; top: number };
  /** a pass the person played: the stick's way when it went (the receiver runs onto the ball until
   * the stick moves off it) */
  passStick?: Pt | null;
  /** a penalty's keeper told which way to go (a person keeping in a shootout): -1 left, 0 stay, 1 right */
  guess?: number;
}
