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
export type Act = 'stance' | 'run' | 'block' | 'throw' | 'catch' | 'carry' | 'juke' | 'spin' | 'stiff' | 'truck' | 'tackle' | 'down' | 'rush' | 'backpedal' | 'celebrate' | 'kick';

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
  heldUntil: number;
  stunUntil: number;
  breakAt: number;
  /** a pass rusher beats his man then */
  winAt: number;
  trail: Pt[];
}

export type Call = 'pass' | 'run';
export type Concept = 'verts' | 'slants' | 'smash' | 'flood' | 'dagger' | 'mesh' | 'curls' | 'posts';
export type RunPlay = 'inside' | 'outside' | 'power';

export interface Ball {
  from: Pt;
  to: Pt;
  t0: number;
  t1: number;
  peak: number;
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
  /** a move under way (juke, spin, stiff arm, truck) and when the next can start */
  move: { kind: 'juke' | 'spin' | 'stiff' | 'truck'; until: number; dir: number } | null;
  moveReady: number;
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
