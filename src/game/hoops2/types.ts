// The players and the game state for arcade basketball. Ratings are 0-99, 2K style; what a player can
// do comes from them (a 40 three-point shooter has a sliver of a green window; only a real dunker
// throws it down; only a posterizer dunks through contact).

export interface Hooper {
  id: string;
  name: string;
  /** short name for labels */
  tag: string;
  num: number | null;
  /** inches, pounds */
  ht: number;
  wt: number;
  /** PG, SG, SF, PF, C */
  pos: string;
  ovr: number;
  /** speed and acceleration */
  spd: number;
  acc: number;
  /** ball handle, pass accuracy */
  hnd: number;
  pas: number;
  /** three, mid-range, close shot, driving layup, free throw */
  thr: number;
  mid: number;
  cls: number;
  lay: number;
  ft: number;
  /** driving dunk, standing dunk */
  ddk: number;
  sdk: number;
  /** strength, vertical, stamina */
  str: number;
  vrt: number;
  sta: number;
  /** perimeter defense, interior defense, steal, block, rebounding */
  prd: number;
  ind: number;
  stl: number;
  blk: number;
  reb: number;
  /** special abilities (badges), e.g. 'posterizer', 'deadeye', 'limitless', 'clamps', 'rim-protector', 'ankle-breaker', 'dimer', 'lob-city' */
  abil: string[];
}

export interface Pt {
  cx: number;
  cz: number;
}

/** What a body is doing, for the animation. */
export type Act =
  | 'idle'
  | 'screen'
  | 'run'
  | 'dribble'
  | 'shoot'
  | 'layup'
  | 'dunk'
  | 'contact'
  | 'standdunk'
  | 'pass'
  | 'catch'
  | 'defend'
  | 'contest'
  | 'block'
  | 'cross'
  | 'stepback'
  | 'spin'
  | 'stumble'
  | 'fall'
  | 'land'
  | 'celebrate'
  | 'rebound';

export interface Body {
  idx: number;
  side: 'O' | 'D';
  p: Hooper;
  cx: number;
  cz: number;
  vx: number;
  vz: number;
  /** off the floor (feet) and rising speed */
  h: number;
  vh: number;
  /** the way he faces on the court (radians, 0 toward the hoop) */
  face: number;
  act: Act;
  actAt: number;
  /** offense: his spot; defense: whom he guards */
  home: Pt;
  mark: number;
  cutUntil: number;
  /** lost his man (a crossover, a screen) until then */
  stunUntil: number;
  /** bumped in the air (an and-one): he stumbles when he lands */
  bumped?: boolean;
  /** how his last fall went down: knocked flat by a dunk, or his ankles gone (for the drawing) */
  fallKind?: 'posterized' | 'ankles';
  /** 0-1, drains as he plays */
  energy: number;
  /** 0-1, the sprint's stamina: drains while he bursts (the stick at its edge), refills after */
  burst: number;
  /** a defender beaten off the dribble (the man got past him): turning to chase, slower a moment */
  beatenAt?: number;
  /** Persistent across animation changes, so a dribble animation cannot reset a move's cooldown. */
  lastMoveAt?: number;
  /** Brief planted-contact response, separate from a turnover or a stun. */
  contactAt?: number;
  trail: Pt[];
}

/** How the defense plays a possession: it picks one and says so, and the offense reads it. */
export type Scheme = 'man' | 'sag' | 'switch' | 'trap';

export type ShotKind = 'three' | 'mid' | 'close' | 'layup' | 'dunk' | 'contact' | 'standdunk' | 'oop';

/** How well a shooter is guarded at the release, as the meter shows it. */
export type Contest = 'open' | 'light' | 'heavy' | 'smothered';

export interface Meter {
  /** when the button went down */
  t0: number;
  /** seconds from press to the perfect release */
  top: number;
  /** half the green window, seconds */
  green: number;
  kind: ShotKind;
  /** the nearest defender's room at the press: a man that far off can only close out so well */
  room?: number;
  /** the result once released: -1 very early .. 1 very late, and whether it was green */
  off?: number;
  greened?: boolean;
}

export interface BallFlight {
  kind: 'pass' | 'shot' | 'loose' | 'lob';
  from: { cx: number; cz: number; h: number };
  to: { cx: number; cz: number; h: number };
  t0: number;
  t1: number;
  arc: number;
  who: number;
  make?: boolean;
  points?: number;
  shot?: ShotKind;
  /** a miss: does the offense get it back */
  orb?: boolean;
  tried?: number[];
}

export type EndKind = 'make' | 'miss' | 'steal' | 'int' | 'block' | 'clock' | 'out';

export interface PossEnd {
  kind: EndKind;
  points: number;
  text: string;
  /** who scored or lost it */
  who: number;
}

export interface Possession {
  t: number;
  clock: number;
  bodies: Body[];
  handler: number | null;
  ball: BallFlight | null;
  meter: Meter | null;
  /** a finish at the rim under way (gather, then up) */
  finish: { kind: ShotKind; t0: number; tUp: number; target: number | null } | null;
  end: PossEnd | null;
  /**
   * How well the defense plays, beyond its ratings (Squad Battles' difficulty): 0 the standard, up
   * to 1 (reads sooner, stays closer, recovers and helps faster, jumps more passes), below 0 looser.
   */
  defIQ: number;
  events: string[];
  rand: () => number;
  /** the last shot: for the HUD (contest grade, release, result) */
  lastShot: { kind: ShotKind; contest: Contest; greened: boolean; off: number; make: boolean; p: number; and1: boolean } | null;
  passes: number;
  /** the player on fire (three straight makes) or -1 */
  fire: number;
  /** the next pass target the stick is pointing at */
  target: number | null;
  /** the defense's look this possession, and the defender doubling the ball in a trap */
  scheme: Scheme;
  trapper: number | null;
  /** the double team came this possession already (once: the pass out beats it) */
  trapped: boolean;
  /** the handler is sprinting (the stick at its edge) */
  sprinting: boolean;
  /** A coach call moves real teammates; it never changes ratings or shot odds. */
  playCall?: { kind: 'screen' | 'cut' | 'space'; actor: number; target: Pt; until: number; plantedAt?: number; rolling?: boolean; sides: Record<number, number> };
  callReadyAt?: number;
}
