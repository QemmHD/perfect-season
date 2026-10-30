// Football v2: the players and a play's state. Field yards: x across (0 to 53.3, the sidelines),
// y up the field from your own goal line (the far end zone is 100 to 110). Your offense goes up.

/** A player rated Madden-style: attributes 0-99 keyed by their short names (SPD, THP, CTH, MCV...). */
export interface FbPlayer {
  id: string;
  name: string;
  tag: string;
  num: number | null;
  ht: number;
  wt: number;
  /** QB RB WR TE OT OG C DE DT LB CB S K */
  pos: string;
  ovr: number;
  a: Record<string, number>;
  abil: string[];
}

/** Eleven on offense (and a kicker), eleven on defense. */
export interface Offense {
  qb: FbPlayer;
  rb: FbPlayer;
  /** X (wide left), Z (wide right), slot */
  wr: [FbPlayer, FbPlayer, FbPlayer];
  te: FbPlayer;
  /** LT LG C RG RT */
  ol: [FbPlayer, FbPlayer, FbPlayer, FbPlayer, FbPlayer];
  k: FbPlayer;
}

export interface Defense {
  /** LE, LDT, RDT, RE */
  dl: [FbPlayer, FbPlayer, FbPlayer, FbPlayer];
  /** WLB, MLB, SLB */
  lb: [FbPlayer, FbPlayer, FbPlayer];
  cb: [FbPlayer, FbPlayer];
  /** free (deep), strong */
  s: [FbPlayer, FbPlayer];
}

export interface Pt {
  x: number;
  y: number;
}

export type Job = 'block' | 'route' | 'rush' | 'man' | 'zone' | 'spy' | 'carry' | 'pursue' | 'qb' | 'idle' | 'track' | 'handoff';

/** what a body is doing, for the animation */
export type Act = 'stance' | 'run' | 'block' | 'throw' | 'catch' | 'carry' | 'juke' | 'spin' | 'stiff' | 'truck' | 'windup' | 'tackle' | 'down' | 'rush' | 'backpedal' | 'celebrate' | 'kick';

export type Move = 'juke' | 'spin' | 'stiff' | 'truck';

export interface Body {
  id: number;
  side: 'O' | 'D';
  p: FbPlayer;
  /** the slot he lines up in (X, Z, SL, TE, RB, QB, LT..., LE..., WLB..., CB1, FS...) */
  slot: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  job: Job;
  act: Act;
  actAt: number;
  route: Pt[];
  sit: boolean;
  mark: number | null;
  /** zone landmark for zone coverage */
  zone: Pt | null;
  /** locked up with a blocker until then */
  heldUntil: number;
  blocker?: number;
  /** a linebacker reading the run (his keys) until then, and whether he bit the wrong way */
  readUntil: number;
  misread: boolean;
  stunUntil: number;
  breakAt: number;
  /** a pass rusher beats his man then */
  winAt: number;
  /** a tackler gathering to dive at the runner since then (Infinity when he isn't), when his last
   * dive left the ground, and the dive in flight (committed: where he aimed it) */
  windAt: number;
  diveAt: number;
  dive: { vx: number; vy: number; until: number } | null;
  trail: Pt[];
}

export type Call = 'pass' | 'run';
export type Concept = 'verts' | 'slants' | 'smash' | 'flood' | 'dagger' | 'mesh' | 'curls' | 'posts';
export type RunPlay = 'inside' | 'outside' | 'power';
export type PassType = 'bullet' | 'touch' | 'lob';

export interface Ball {
  from: Pt;
  to: Pt;
  t0: number;
  t1: number;
  peak: number;
  type?: PassType;
  /** Each defender gets one physical play on this pass, rather than a fresh lottery every frame. */
  tried?: number[];
}

export type EndKind = 'tackle' | 'incomplete' | 'td' | 'int' | 'sack' | 'out' | 'fumble';

export interface PlayEnd {
  kind: EndKind;
  x: number;
  y: number;
  gain: number;
  text: string;
  /** a completed pass (the On Fire streak counts these) */
  caught: boolean;
  /** how long the play ran (seconds, for the two-minute clock) */
  secs: number;
}

export interface Play {
  t: number;
  call: Call;
  concept: Concept;
  run: RunPlay;
  coverage: 'man' | 'zone';
  los: number;
  bx: number;
  bodies: Body[];
  qb: Body;
  rb: Body;
  carrier: Body | null;
  ball: Ball | null;
  phase: 'pre' | 'drop' | 'air' | 'run' | 'dead';
  end: PlayEnd | null;
  rand: () => number;
  /** a move under way (juke, spin, stiff arm, truck): when it started, how well it works (by the
   * runner's stamina and how often he's used it), where he was and how he was heading as it began */
  move: { kind: Move; at: number; until: number; dir: number; eff: number; x: number; y: number; vx: number; vy: number } | null;
  moveReady: number;
  /** the runner's stamina (0-1): moves drain it, it comes back as he runs */
  stamina: number;
  /** Held by the player; transient, never saved to a profile. */
  bursting?: boolean;
  passType?: PassType;
  /** the moves he's made this play (the same one again works less) */
  used: Partial<Record<Move, number>>;
  /** across the field, the hole a run is blocked for */
  hole: number;
  /** Formation handedness; a pre-snap flip mirrors assignments and run landmarks together. */
  direction?: 1 | -1;
  /**
   * How well the defense plays, beyond its ratings (Squad Battles' difficulty): 0 the standard, up
   * to 1 (reads and breaks on the ball sooner, covers tighter, gets home faster, misreads runs less),
   * below 0 looser.
   */
  defIQ: number;
  slowUntil: number;
  /** pressure on the quarterback right now (0-1), for the HUD and the throw */
  pressure: number;
  events: string[];
  catcher: Body | null;
  caughtAt: Pt | null;
  /** where the throw lands (the slingshot's aim), for the HUD */
  aim: Pt | null;
  /** the quarterback is On Fire: he sees the whole arc and throws it quicker */
  fire: boolean;
}
