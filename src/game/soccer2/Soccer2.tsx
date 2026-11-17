import { PlayReadout } from '../PlayReadout';
import { soccerFeedback, type PlayFeedback } from '../play-feedback';
// Arcade soccer, "Attacks": implemented by Claude (Anthropic), 2026-11-01, on the conventions of
// Football2.tsx (fixed-step loop, portal over the app, scoreboard, marks, pops, hints, replays).
// Your eleven attacks the rival's goal seven times (six attacks and one in stoppage time), each a
// dealt scenario with a 30-second clock: a build-up, a counter, a wide overload, a corner, a free
// kick (and a penalty when they foul you in the box). Joystick to run, SPRINT on stamina; PASS
// (tap along the grass, hold for a lofted ball or a cross), THRU into a runner's path; hold SHOOT
// and let go in the green. Level with the rival at the end: penalties. Claude 2026-11-02: the stick
// only runs; drag your thumb on SHOOT to aim (no drag: aim assist picks the open side, low), passes
// go where the stick points with a gentle pull toward a teammate there, and every release and miss
// says why. Claude 2026-11-16 (studio overhaul soccer-2, Game Design V2 A.5): the shared control
// grammar. A floating stick under the left thumb (push past its ring to sprint, so SPRINT leaves the
// right thumb), the A/B/C/D cluster on the V2 geometry (A SHOOT, B PASS, C THRU with a lofted hold, D
// for set pieces now and TRICK later), tap a teammate to pass, the score bug "YOU 1 · 67' · 5/7 · 1
// RIV" with its clock line, the toast line in place of the hint over the goal, and the pause sheet
// with QUIT (solo) and FORFEIT (online). Claude 2026-11-16 (soccer-3, V2 B.3.3, B.3.7, B.0.4): the camera
// frames the V2 action-safe box (read from the page), the juice goes through fx.ts (hit-stop, trauma,
// slow motion; render only), goal moments for both sides (a scorer plate in the toast line; the
// rival's goals pop the moment the score changes), the stoppage attack is staged as CLUTCH, and
// `ps:arena-ready` fires after the first frame with the pitch and the players.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { crowd, loadSamples, sfx, vibrate } from '../../lib/sound';
import { GameClock, holdOnClock, LOFT_HOLD, nextBend, type ControlPhase, type Slot, type SlotId, slotsFor, type Slots, targetsOf } from './controls';
import { PauseSheet } from './PauseSheet';
import { PausableTimers } from './timers';
import { deviceLagMs, haptic, heartbeat, PauseButton, ScoreBug, Stick, type StickOut, ToastLine, usePlaytime } from './v2';
import { momentOf, SoccerFx } from './fx';
import { reducedMotion } from '../../ui/motion';
import { screenRunInput } from '../football2/controls';
import { freeCanvas } from '../pixel/body';
import type { Progress, RivalLive } from '../progress';
import { frameAt, Recorder, type Replay, REPLAY_SPEED, replayTime, REPLAYS_IN_AUTOPLAY } from '../replay';
import { useInputInterrupt } from '../useInputInterrupt';
import { WaitLine } from '../Wait';
import { decide, pilot } from './autopilot';
import { bendCurl, cancelShoot, ctrlOf, GX, kickOff, pass, passPlan, passTarget, PL, PW, pressShoot, releaseShoot, releaseWord, setAim, setCurl, setSprint, settle, shotVerdict, snapAim, step } from './engine';
import type { SoccerKits } from './kits';
import { attackFor, ATTACKS, END_TEXT, isStoppage, minuteOf, newMatch, recordAttack, SCENARIO_HINTS, SCENARIO_NAMES, scenarioToast, SET_PIECE_WAIT, setPieceCountdown, totalOf, type Match } from './match';
import { SoccerRenderer } from './render';
import { xgOf } from './xg';
import { kickAttack, newShootout, nextKick, recordKick, score as soScore, type Shootout, type Side } from './shootout';
import type { Attack, AttackEnd, Body, Pt, RingWhy, Scenario, Squad } from './types';
import './soccer2.css';
import './v2/geometry.css';
import './soccer2-controls.css';
import './soccer2-moments.css';
import './soccer2-ring.css';

type Ui = 'loading' | 'intro' | 'live' | 'after' | 'so-intro' | 'so-kick' | 'so-after' | 'final';
type Tone = 'good' | 'bad' | 'big' | 'plain' | 'green';

const DT = 1 / 60;
/** how far (CSS px) a drag on SHOOT goes for full aim across or up */
const AIM_DRAG = 46;
/** a drag shorter than this (of AIM_DRAG) is no aim: the assist */
const AIM_DEAD = 0.28;
/** The crowd builds as the ball nears goal (J-1, Claude 2026-11-10): its level, from QUIET at FAR m
 * or more to LOUD at NEAR m or less, set through crowd.level at most every CROWD_MS (in steps of
 * 0.02, so it rarely needs setting), and never while a swell is still settling. */
const CROWD = { QUIET: 0.24, LOUD: 0.5, FAR: 35, NEAR: 12, MS: 250 };
/** Clutch (V2 B.0.4): the crowd bed sits this much higher; the heartbeat haptic every BEAT_MS while the
 * margin is one goal or none (played inside the player's own touches: iOS allows nothing else). */
const CLUTCH = { CROWD: 0.1, BEAT_MS: 1200 };
/** "2ND OF THE MATCH" */
const ORDINAL = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH'];
/** The toast line's tips (one line at 320 px; the keyword first, one name per control). */
const TIPS = {
  move: 'PASS · it goes where the stick points',
  corner: 'CROSS · the stick picks your man',
  fk: 'BEND · swipe the pitch, then SHOOT',
  pen: 'SHOOT · drag to aim, let go in the green',
  keep: 'THEIR KICK · pick a way to dive',
} as const;

/** The gold ring in the toast line (soccer-4, V2 B.0.1): why a ring is amber or red while SHOOT is
 * held (the dial), and the name for it in a release's word ("GOOD · PRESSURE"). */
const RING_LINE: Record<RingWhy, string> = {
  range: 'TOO FAR · get closer for gold',
  pressure: 'PRESSURE · no gold with a man on you',
  first: 'FIRST TIME · across your body',
  header: 'HEADER · too far out for gold',
  angle: 'TIGHT ANGLE · no gold from here',
  stride: 'ON THE RUN · ball at your feet for gold',
};
const RING_WORD: Record<RingWhy, string> = { range: 'TOO FAR', pressure: 'PRESSURE', first: 'ACROSS YOUR BODY', header: 'TOO FAR OUT', angle: 'TIGHT ANGLE', stride: 'ON THE RUN' };
/** How long a release's word stays in the toast line (ms); the ring's closing ticks (s before the gold). */
const RELEASE_MS = 950;
const TICKS = { from: 0.2, every: 0.05, n: 4 };

/** What a replay needs to redraw a moment. */
interface Snap {
  bodies: Body[];
  ball: Attack['ball'];
  t: number;
}
const snapOf = (a: Attack): Snap => ({ bodies: a.bodies.map((b) => ({ ...b })), ball: { ...a.ball }, t: a.t });

export interface ShootoutResult {
  us: number;
  them: number;
  winner: Side;
  kicks: { side: Side; scored: boolean; taker: string }[];
}

export function Soccer2({
  us,
  them,
  rivalName,
  seed,
  attacks = ATTACKS,
  deal,
  defIQ = 0,
  rival,
  kits,
  autoplayHook,
  timeScale = 1,
  shootout: allowShootout = true,
  forceShootout = false,
  fixedShootout,
  debug,
  start,
  online = false,
  quitNote,
  onProgress,
  onDone,
  onShootout,
  onQuit,
  onForfeit,
}: {
  us: Squad;
  them: Squad;
  rivalName: string;
  seed: string;
  attacks?: number;
  /** the scenarios to deal instead of the seed's (the lab) */
  deal?: Scenario[];
  defIQ?: number;
  rival: RivalLive | null;
  kits: SoccerKits;
  autoplayHook?: boolean;
  timeScale?: number;
  /** settle a level match on penalties once the rival's score is final */
  shootout?: boolean;
  /** the lab: go straight to penalties */
  forceShootout?: boolean;
  /**
   * Online (Claude 2026-11-01): the shootout both phones agree on (arcade.ts agreedShootout), shown
   * kick by kick instead of played, so the two phones can't settle a level match differently.
   */
  fixedShootout?: { first: Side; scored: boolean[] };
  /** the lab's QA hook: the live attack and match each frame, the goal mouth on screen, and the pause */
  debug?: (a: Attack | null, m: Match, ui: string, view: { goal: { x: number; y: number; w: number; h: number } | null; paused: boolean; stats: SoccerRenderer['stats']; arrows: SoccerRenderer['arrows']; safe: { x: number; y: number; w: number; h: number } | null; clutch: boolean; fx: { granted: number }; /** the label pass's keep-outs, canvas px */ keep: { x: number; y: number; w: number; h: number }[] }) => void;
  /** the lab's drills and screenshots: the man on the ball starts here (pitch metres; open play only) */
  start?: Pt;
  /** a head to head against another phone: the pause sheet offers FORFEIT instead of QUIT */
  online?: boolean;
  /** the host's line under QUIT? (ut contract B; default "It counts as a loss.") */
  quitNote?: string;
  onProgress: (p: Progress) => void;
  onDone: (p: Progress) => void;
  onShootout?: (r: ShootoutResult) => void;
  /** solo QUIT, confirmed: the attacks played so far (the host decides what a quit means); `false` = refused, play on */
  onQuit?: (p: Progress) => boolean | void;
  /** online FORFEIT, confirmed: the attacks played so far (the host pads them with 'FF' and ends the match); `false` = refused */
  onForfeit?: (p: Progress) => boolean | void;
}) {
  const [lastReadout,setLastReadout] = useState<PlayFeedback|null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const match = useMemo(() => {
    const m = newMatch(us, them, seed, attacks, defIQ);
    if (deal) m.deal = Array.from({ length: totalOf(m) }, (_, i) => deal[i % deal.length]);
    return m;
  }, []);
  const renderer = useMemo(() => new SoccerRenderer(kits.pitch, { us: kits.us, them: kits.them, usGk: kits.usGk, themGk: kits.themGk }), []);
  useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      renderer.dispose();
      freeCanvas(canvas);
    };
  }, []);
  const atkRef = useRef<Attack | null>(null);
  const soRef = useRef<Shootout | null>(null);
  /** in a shootout kick: whether we're the side kicking */
  const usKicking = useRef(true);
  const pilotRef = useRef(pilot(0.75, seed));
  /** the screen flash (a goal) */
  const fxRef = useRef({ flash: 0 });
  /** hit-stop, trauma shake and slow motion (fx.ts; render only) */
  const juice = useMemo(() => new SoccerFx({ reduced: reducedMotion() }), []);
  /** the goal plates in the toast line: ours (teal) and theirs (violet); when both land together
   * (the rival's attack is revealed as yours ends) the newer sits on the line and the other above it */
  const [plates, setPlates] = useState<{ id: number; side: 'us' | 'them'; text: string }[]>([]);
  const scorers = useRef(new Map<string, number>());
  /** the bug's pulse on the rival's goal */
  const [bugPulse, setBugPulse] = useState(0);
  const lastBeat = useRef(0);
  const clutchRef = useRef({ on: false, close: false });
  const arenaReady = useRef(false);
  /** the left thumb's stick, as it last reported (null: no thumb on it) */
  const stickRef = useRef<{ x: number; y: number } | null>(null);
  const stickSprint = useRef(false);
  const keys = useRef(new Set<string>());
  const passDown = useRef<{ id: number | 'key'; t: number } | null>(null);
  const shotPointer = useRef<number | 'key' | null>(null);
  const thruDown = useRef<{ id: number | 'key'; t: number } | null>(null);
  /** the drag on SHOOT: where the thumb went down, and the aim it gives (null: assist) */
  const shotDrag = useRef<{ x0: number; y0: number; aim: Pt | null } | null>(null);
  const [aimDot, setAimDot] = useState<Pt | null>(null);
  /** SHOOT's touch-down: its own timestamp (PointerEvent.timeStamp, or the key's), for the release's judging */
  const shotPress = useRef<number | null>(null);
  /** the match's game clock against real time, so a hold is judged on the clock the ring moves on */
  const gameClock = useMemo(() => new GameClock(), []);
  /** consecutive PERFECT releases (the chime climbs a semitone each, to +4) */
  const perfectStreak = useRef(0);
  /** the closing ring's ticks played for this hold, and the release last given its word */
  const ringTicked = useRef(-1);
  const lastFed = useRef<Attack['release'] | null>(null);
  /** the held ring's state and why (for the toast's dial line), and a release's word in the toast */
  const [ringLine, setRingLine] = useState('');
  const ringKey = useRef('');
  const [releaseToast, setReleaseToast] = useState<{ id: number; text: string; kind: 'perfect' | 'good' | 'bad' } | null>(null);
  const sprintPointer = useRef<number | 'key' | null>(null);
  const swipe = useRef<{ id: number; x0: number; y0: number; t0: number } | null>(null);
  const [ui, setUi] = useState<Ui>('loading');
  const uiRef = useRef<Ui>('loading');
  uiRef.current = ui;
  const [, setTick] = useState(0);
  const [pop, setPop] = useState<{ id: number; text: string; tone: Tone; sub?: string } | null>(null);
  const popId = useRef(0);
  /** the toast line: a tip or a call, one line above the controls (V-3: never over the goal) */
  const [hint, setHint] = useState<string | null>(null);
  const hinted = useRef(new Set<string>());
  const [shooting, setShooting] = useState(false);
  /** the buttons held down now (their pressed look) */
  const [held, setHeld] = useState<Partial<Record<SlotId, boolean>>>({});
  const [wide, setWide] = useState(false);
  const [compact, setCompact] = useState(false);
  /** the score bug's clock line (the attack's time left), written each frame without a render */
  const lineRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  /** the beats between whistles, held while paused */
  const timers = useMemo(() => new PausableTimers(), []);
  const rec = useRef(new Recorder<Snap>(5));
  const replayRef = useRef<Replay<Snap> | null>(null);
  const [replaying, setReplaying] = useState(false);
  const rivalRef = useRef(rival);
  rivalRef.current = rival;
  /** the rival's score last shown: a rise is their goal, popped in the same paint as the bug's number (F5) */
  const rivalSeen = useRef(rival?.score ?? 0);
  const [soView, setSoView] = useState<ReturnType<typeof soScore> & { marks: { side: Side; scored: boolean }[]; first: Side } | null>(null);
  /** the set piece waiting for a person: since when (match time), and whether the autopilot has it */
  const spWait = useRef<{ sp: NonNullable<Attack['setPiece']>; at: number; auto: boolean } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  /** the crowd: the level last set, when, and until when a swell is still settling */
  const crowdRef = useRef({ level: CROWD.QUIET, at: 0, swellTill: 0 });
  const [guess, setGuess] = useState<number | null>(null);
  const finished = useRef(false);
  /** the match was left from the pause sheet (a quit or a forfeit), or the rival forfeited: no penalties after it (soccer-2 fix) */
  const left = useRef<'quit' | 'forfeit' | 'them' | null>(null);

  const say = (text: string, tone: Tone, ms = 1200, sub?: string) => {
    const id = ++popId.current;
    setPop({ id, text, tone, sub });
    timers.later(() => setPop((p) => (p && p.id === id ? null : p)), ms);
  };
  /**
   * A person's release, the moment it is judged (V2 B.0.1, plan G6): on gold the word PERFECT in the
   * toast line, the chime a semitone higher for each PERFECT in a row (to +4) and the double haptic, all
   * from the same input handler, so they land in the same frame; else the word, and on an amber or red
   * ring what kept it from gold. Each release once.
   */
  const feedRelease = (a: Attack) => {
    const r = a.release;
    if (!r || lastFed.current === r) return;
    lastFed.current = r;
    const id = ++popId.current;
    if (r.gold) {
      perfectStreak.current++;
      sfx.perfect(perfectStreak.current);
      haptic('double');
      performance.mark?.('sc2-perfect');
      renderer.perfectBurst(a);
      setReleaseToast({ id, text: 'PERFECT' + (perfectStreak.current > 1 ? ' · ' + perfectStreak.current + ' IN A ROW' : ' · on the gold'), kind: 'perfect' });
    } else {
      perfectStreak.current = 0;
      const w = releaseWord(r.off, r.green, r.ring);
      const why = r.ring !== 'gold' && r.why ? ' · ' + RING_WORD[r.why] : '';
      setReleaseToast({ id, text: w + why, kind: w === 'GOOD' ? 'good' : 'bad' });
    }
    timers.later(() => setReleaseToast((t) => (t && t.id === id ? null : t)), RELEASE_MS);
  };
  /** a line in the toast line for a while (once per kind of tip a match) */
  const tip = (key: string, text: string) => {
    if (autoplayHook || hinted.current.has(key)) return;
    hinted.current.add(key);
    setHint(text);
    timers.later(() => setHint((h) => (h === text ? null : h)), 4200);
  };
  /** a play lifts the crowd (crowd.swell); the level by distance waits until it has settled */
  const swell = (x: number) => {
    crowd.swell(x);
    crowdRef.current.swellTill = performance.now() + 500 + x * 600 + 1200;
  };
  /** the crowd's level for where the ball is (J-1): quiet in midfield, louder near the goal */
  const crowdFor = (a: Attack | null, now: number) => {
    const c = crowdRef.current;
    if (now - c.at < CROWD.MS || now < c.swellTill) return;
    const playing = !!a && !a.end && (uiRef.current === 'live' || uiRef.current === 'so-kick');
    const d = a ? Math.hypot(a.ball.x - GX, PL - a.ball.y) : CROWD.FAR;
    const k = playing ? Math.max(0, Math.min(1, (CROWD.FAR - d) / (CROWD.FAR - CROWD.NEAR))) : 0;
    const level = Math.round((CROWD.QUIET + (CROWD.LOUD - CROWD.QUIET) * k + (clutchRef.current.on ? CLUTCH.CROWD : 0)) * 50) / 50;
    c.at = now;
    if (Math.abs(level - c.level) < 0.019) return;
    c.level = level;
    crowd.level(level);
  };
  /**
   * A goal plate for a while, stacked just above the toast line (soccer-3 review fix: it used to replace
   * the line, hiding a set piece's AUTO KICK countdown when the rival scored, and ours outlived the
   * 2.5 s gap to the next attack's intro). Ours is up 2.4 s.
   */
  const showPlate = (side: 'us' | 'them', text: string, ms = 2400) => {
    const id = ++popId.current;
    setPlates((ps) => [...ps.slice(-1), { id, side, text }]);
    timers.later(() => setPlates((ps) => ps.filter((q) => q.id !== id)), ms);
  };
  /** Clutch's heartbeat: called from the player's own touches (the stick, the buttons) */
  const beat = () => {
    const c = clutchRef.current;
    if (!c.on || !c.close) return;
    const now = performance.now();
    if (now - lastBeat.current < CLUTCH.BEAT_MS) return;
    lastBeat.current = now;
    heartbeat();
  };
  const progress = (): Progress => ({ score: match.goals, drive: match.i, done: match.over, ends: match.ends.slice(), plays: match.i });
  const clearInput = () => {
    stickRef.current = null;
    stickSprint.current = false;
    keys.current.clear();
    passDown.current = null;
    thruDown.current = null;
    shotPointer.current = null;
    shotPress.current = null;
    shotDrag.current = null;
    setAimDot(null);
    sprintPointer.current = null;
    swipe.current = null;
    setHeld({});
    setShooting(false);
    const a = atkRef.current;
    if (a) {
      setSprint(a, false);
      cancelShoot(a);
    }
  };
  useInputInterrupt(clearInput);

  /** Line up attack i (the whistle hasn't gone). */
  const lineUp = (i: number) => {
    const a = attackFor(match, i);
    if (start && !a.setPiece) placeCarrier(a, start);
    atkRef.current = a;
    rec.current.clear();
    clearInput();
    pilotRef.current = pilot(0.75, seed + ':' + i);
    juice.newAttack();
    setUi('intro');
  };
  useEffect(() => {
    // soccer's own ground (sound.ts 'pitch': its chant, roar, kicks, bounce and whistle), loaded up front
    void loadSamples('pitch');
    crowd.start(CROWD.QUIET, 'pitch');
    if (forceShootout) startShootout();
    else lineUp(0);
    return () => {
      crowd.stop(0.6);
      timers.dispose();
    };
  }, []);

  const kickOffNow = () => {
    const a = atkRef.current;
    if (!a || (uiRef.current !== 'intro' && uiRef.current !== 'so-intro')) return;
    kickOff(a);
    sfx.whistle();
    // a thumb already resting on the stick drives the carrier from the whistle's own frame (C5, soccer-2
    // re-review): the first step after it reads the held push, not the stick's enable a commit later
    const h = heldStick.current;
    if (h?.active && !pausedRef.current) {
      stickRef.current = { x: h.x, y: h.y };
      stickSprint.current = h.sprint;
      if (sprintPointer.current === null) setSprint(a, h.sprint);
    }
    if (uiRef.current === 'so-intro') {
      setUi('so-kick');
      setGuess(null);
      if (usKicking.current) tip('pen', TIPS.pen);
      else tip('keep', TIPS.keep);
      return;
    }
    setUi('live');
    const sc = a.scenario;
    if (sc === 'corner') tip('corner', TIPS.corner);
    else if (sc === 'freekick') tip('fk', TIPS.fk);
    else tip('move', TIPS.move);
  };

  // the autopilot kicks off in tests
  useEffect(() => {
    if (!autoplayHook) return;
    if (ui !== 'intro' && ui !== 'so-intro') return;
    const t = window.setTimeout(kickOffNow, 450);
    return () => clearTimeout(t);
  }, [ui, autoplayHook]);

  const handleEvents = (a: Attack) => {
    for (const e of a.events) {
      // the juice first (hit-stop, shake, slow motion): render only, it reads the attack
      const m = momentOf(e, a);
      if (m) {
        juice.apply(m, performance.now());
        if (m.post) renderer.postHit();
      }
      if (e === 'pass' || e === 'cross') sfx.kick();
      else if (e === 'shot' || e === 'header') {
        // the read-out's xG (display only: xg.ts; the engine never reads it)
        const ls = a.lastShot;
        if (ls && ls.d !== undefined) ls.xg = xgOf({ d: ls.d, ang: ls.ang ?? 0, kind: ls.kind });
        sfx.kick();
        swell(0.5);
      } else if (e === 'shot-dropped') {
        // a shot wound up with the ball knocked too far ahead to catch in time (soccer-4 review fix)
        if (!autoplayHook) say('TOO FAR AHEAD', 'plain', 1000, 'catch the ball first');
      } else if (e === 'gold-lost') {
        // a first-time hit let go on gold lost it at the strike (a defender closed, the ball came across
        // him, or he met it out of range: G2b at the contact): the toast says why
        if (lastFed.current && a.release && lastFed.current.at === a.release.at) feedRelease(a);
      } else if (e === 'release-green' || e === 'release') {
        // a person's first-time hit still held as the ball arrived is judged by the engine (the word
        // and the chime here; the haptic needs the touch's own handler, so it plays only on a release)
        if (shotPointer.current !== null) feedRelease(a);
      } else if (e === 'control' || e === 'chest') sfx.catch();
      else if (e === 'bounce') sfx.bounce();
      else if (e === 'save-catch' || e === 'claim' || e === 'smother') {
        sfx.catch();
        sfx.ooh();
        swell(0.7);
      } else if (e === 'save-parry') {
        sfx.hit(0.3);
        sfx.ooh();
        swell(0.8);
        if (!a.end) say('PARRIED!', 'plain', 900);
      } else if (e === 'post' || e === 'bar') {
        // the woodwork's clang and the crowd's ooh (sound.ts, V2 F.1: the three sports share it)
        sfx.post();
        say(e === 'post' ? 'OFF THE POST!' : 'OFF THE BAR!', 'big', 1000);
      } else if (e === 'tackle') sfx.tackle(0.35);
      else if (e === 'beat') {
        swell(0.5);
        sfx.whoosh();
      } else if (e === 'block') sfx.hit(0.4);
      else if (e === 'intercept' || e === 'header-clear') sfx.kick();
      else if (e === 'foul') {
        sfx.whistle();
        sfx.tackle(0.6);
      } else if (e === 'penalty') {
        swell(1);
        say('PENALTY!', 'big', 1600, a.events.includes('yellow') ? 'YELLOW CARD' : 'FOULED IN THE BOX');
        clearInput();
      } else if (e === 'freekick') {
        say('FREE KICK', 'good', 1300, a.events.includes('yellow') ? 'YELLOW CARD' : 'FOULED');
        clearInput();
        tip('fk', TIPS.fk);
      } else if (e === 'advantage') say(a.events.includes('yellow') ? 'YELLOW CARD' : 'ADVANTAGE', 'plain', a.events.includes('yellow') ? 1300 : 800, a.events.includes('yellow') ? 'ADVANTAGE PLAYED' : undefined);
      // the dribble (soccer-5): a shield that held, a touch too heavy to keep
      else if (e === 'shielded') say('SHIELDED', 'good', 900);
      else if (e === 'lost-touch' || e === 'heavy-first') say('HEAVY TOUCH', 'plain', 900);
      // restarts earned in play (R-2): a corner off a defender or the keeper, a quick throw-in
      else if (e === 'corner-won') {
        sfx.whistle();
        swell(0.6);
        say('CORNER!', 'good', 1300, a.restarts && a.restarts > 1 ? 'ANOTHER ONE' : 'WON IT');
        clearInput();
        tip('corner', TIPS.corner);
      } else if (e === 'throw-in') say('THROW-IN', 'plain', 900, 'QUICK ONE');
      else if (e === 'goal') {
        fxRef.current.flash = 0.45;
        sfx.kick();
        sfx.roar();
        swell(1);
        vibrate([30, 40, 30]);
        renderer.goalScored(a.t);
      } else if (e === 'offside') sfx.whistle();
      else if (e === 'run') {
        // a runner going in behind
      }
    }
    a.events.length = 0;
  };

  /** An attack's whistle: count it, show it, then the next (or the end). */
  const finishAttack = (a: Attack) => {
    setLastReadout(soccerFeedback(a));
    const e = recordAttack(match, a);
    clearInput();
    onProgress(progress());
    setUi('after');
    const text = a.end?.text ?? END_TEXT[e];
    const by = a.shotBy !== null ? a.bodies[a.shotBy].p.tag : '';
    // why it didn't go in (late, early, straight at him...), else what happened
    const why = shotVerdict(a);
    const clutch = isStoppage(match, match.i - 1);
    if (e === 'G') {
      say('GOAL!', 'big', 2200, by + (a.lastShot?.greened ? ' · PERFECT STRIKE' : ''));
      // the scorer's plate in the toast line: "HAALAND 67' · 2ND OF THE MATCH" (V2 B.3.7)
      const sc = a.shotBy !== null ? a.bodies[a.shotBy].p : null;
      if (sc) {
        const n = (scorers.current.get(sc.id) ?? 0) + 1;
        scorers.current.set(sc.id, n);
        showPlate('us', sc.tag + ' ' + minuteOf(match, match.i - 1) + ' · ' + (ORDINAL[n] ?? n + 'TH') + ' OF THE MATCH');
      }
    }
    else if (e === 'S') say('SAVED', 'bad', 1700, why ?? text);
    else if (e === 'W') {
      // a shot off target ("WIDE · GOAL KICK"), or a ball we put over their line ("GOAL KICK")
      const head = text.startsWith('OVER THE BAR') ? 'OVER THE BAR' : text.startsWith('WIDE') ? 'WIDE' : 'GOAL KICK';
      say(head, 'bad', 1700, why ?? (head === 'GOAL KICK' ? undefined : 'GOAL KICK'));
    }
    else if (e === 'B') say('BLOCKED', 'bad', 1500, why ?? text);
    else if (e === 'O') say('OFFSIDE', 'bad', 1500, text.replace('OFFSIDE · ', ''));
    else if (e === 'T') say('TIME UP', 'plain', 1400, 'ATTACK OVER');
    else say('LOST IT', 'bad', 1400, text);
    if (e !== 'G') {
      timers.later(() => sfx.whistle(), 200);
      if (e !== 'O') sfx.groan(e === 'S' || e === 'W' ? 0.8 : 0.5);
    }
    // a goal replays; in Clutch always, the last attack's included (V2 B.0.4; skipped under reduced motion)
    const replay = e === 'G' && !reducedMotion() && (!autoplayHook || REPLAYS_IN_AUTOPLAY) && (!match.over || clutch);
    const next = () => {
      if (match.over) endMatch();
      else {
        if (match.i === Math.ceil(match.attacks / 2)) say('SECOND HALF', 'plain', 1300);
        else if (match.i === match.attacks) say('STOPPAGE TIME', 'big', 1500, 'ONE LAST ATTACK');
        lineUp(match.i);
      }
    };
    if (replay) timers.later(() => startReplay(a, next, clutch && match.over), clutch && match.over ? 700 : 1700);
    else timers.later(next, e === 'G' ? 2500 : 1800);
  };

  const endMatch = () => {
    const r = rivalRef.current;
    sfx.fulltime();
    if (allowShootout && !left.current && r && r.done && !r.forfeit && r.score === match.goals) {
      say('ALL SQUARE', 'big', 1700, 'PENALTIES');
      timers.later(startShootout, 1500);
      return;
    }
    setUi('final');
    if (!finished.current) {
      finished.current = true;
      onDone(progress());
    }
  };
  // finished level and the rival's score arrives later (online): penalties then
  useEffect(() => {
    if (ui !== 'final' || soRef.current || !allowShootout || left.current) return;
    if (rival && rival.done && !rival.forfeit && rival.score === match.goals) {
      say('ALL SQUARE', 'big', 1700, 'PENALTIES');
      const t = window.setTimeout(startShootout, 1500);
      return () => clearTimeout(t);
    }
  }, [ui, rival?.done, rival?.score, rival?.forfeit]);
  // the rival forfeited (online): the match is yours, at once (no penalties, no more attacks)
  useEffect(() => {
    if (!rival?.forfeit || left.current) return;
    left.current = 'them';
    pausedRef.current = false;
    setPaused(false);
    if (!finished.current) {
      finished.current = true;
      timers.dispose();
      clearInput();
      setUi('final');
    }
    sfx.roar();
    say('THEY FORFEIT', 'big', 2600, 'YOU WIN');
  }, [rival?.forfeit]);

  /* ---------- penalties ---------- */
  const startShootout = () => {
    if (soRef.current || left.current) return;
    const first: Side = fixedShootout ? fixedShootout.first : (seed.length + match.goals) % 2 ? 'them' : 'us';
    soRef.current = newShootout(us, them, seed + ':so', first);
    if (!finished.current && match.over) {
      finished.current = true;
      onDone(progress());
    }
    if (fixedShootout) revealPens(fixedShootout.scored, 0);
    else nextPen();
  };
  /** the agreed shootout, one kick at a time */
  const revealPens = (scored: boolean[], i: number) => {
    const so = soRef.current!;
    if (so.done || i >= scored.length) {
      nextPen();
      return;
    }
    setUi('so-after');
    const mine = nextKick(so).side === 'us';
    const taker = nextKick(so).taker.tag;
    recordKick(so, scored[i]);
    viewSo();
    if (scored[i]) {
      (mine ? sfx.cheer : sfx.groan)(mine ? 0.9 : 0.6);
      say(mine ? 'SCORED!' : 'THEY SCORE', mine ? 'good' : 'bad', 1000, taker);
    } else {
      (mine ? sfx.groan : sfx.roar)(0.9);
      say(mine ? 'SAVED' : 'YOUR KEEPER SAVES!', mine ? 'bad' : 'big', 1000, taker);
    }
    timers.later(() => revealPens(scored, i + 1), 1300);
  };
  const viewSo = () => {
    const so = soRef.current!;
    setSoView({ ...soScore(so), marks: so.kicks.map((k) => ({ side: k.side, scored: k.scored })), first: so.first });
  };
  const nextPen = () => {
    const so = soRef.current!;
    viewSo();
    if (so.done) {
      timers.later(() => setUi('final'), 2300);
      const s = soScore(so);
      onShootout?.({ us: s.us, them: s.them, winner: so.winner!, kicks: so.kicks.map((k) => ({ side: k.side, scored: k.scored, taker: k.taker.name })) });
      if (so.winner === 'us') {
        sfx.roar();
        say('YOU WIN ON PENALTIES', 'big', 2600, s.us + '–' + s.them);
      } else {
        sfx.groan(1);
        say('LOST ON PENALTIES', 'bad', 2600, s.us + '–' + s.them);
      }
      return;
    }
    const nk = nextKick(so);
    usKicking.current = nk.side === 'us';
    atkRef.current = kickAttack(so);
    pilotRef.current = pilot(nk.side === 'us' ? 0.75 : 0.8, seed + ':so:' + so.kicks.length);
    clearInput();
    setUi('so-intro');
  };
  const finishPen = (a: Attack) => {
    const so = soRef.current!;
    const scored = a.end?.kind === 'G';
    const mine = usKicking.current;
    recordKick(so, scored);
    setUi('so-after');
    viewSo();
    if (scored) {
      if (mine) sfx.cheer(0.9);
      else sfx.groan(0.6);
      say(mine ? 'SCORED!' : 'THEY SCORE', mine ? 'good' : 'bad', 1300, a.bodies[a.shotBy ?? 0]?.p.tag);
    } else {
      if (mine) sfx.groan(0.9);
      else sfx.roar();
      say(mine ? (a.end?.kind === 'S' ? 'SAVED' : 'MISSED') : a.end?.kind === 'S' ? 'YOUR KEEPER SAVES!' : 'THEY MISS!', mine ? 'bad' : 'big', 1400);
    }
    timers.later(nextPen, 1900);
  };

  /* ---------- replay ---------- */
  const startReplay = (a: Attack, done: () => void, short = false) => {
    // the final whistle's replay is shorter: the result is already on its way to the host
    const frames = short ? rec.current.clip(a.t - 1.8, a.t + 0.5) : rec.current.clip(a.t - 2.6, a.t + 0.9);
    if (frames.length < 10) {
      done();
      return;
    }
    const bx = a.ball.x;
    const by = Math.min(a.ball.y, 100);
    replayRef.current = { frames, t0: frames[0].t, t1: frames[frames.length - 1].t, start: performance.now(), speed: REPLAY_SPEED, focus: { a: bx, b: by }, done };
    renderer.replay = { x: bx, y: by };
    setReplaying(true);
  };
  const endReplay = () => {
    const r = replayRef.current;
    if (!r) return;
    replayRef.current = null;
    renderer.replay = null;
    setReplaying(false);
    r.done();
  };

  /** A set piece the person has left for SET_PIECE_WAIT s: the autopilot's taker has it from then
   * until it's taken (R-1; the countdown shows over its last 5 s). */
  const setPieceAuto = (a: Attack): boolean => {
    const sp = a.setPiece;
    if (!sp) {
      spWait.current = null;
      return false;
    }
    let w = spWait.current;
    if (!w || w.sp !== sp) w = spWait.current = { sp, at: a.t, auto: false };
    if (!w.auto && !autoplayHook && a.taker === a.ctrl && a.t - w.at >= SET_PIECE_WAIT && !a.meter && !a.strike && !a.kick) {
      w.auto = true;
      clearInput();
      say('TAKEN FOR YOU', 'plain', 1100);
    }
    return w.auto;
  };

  /* ---------- input ---------- */
  /** the stick on screen (x right, y down), from the pointer or the keys */
  const stickScreen = (): Pt => {
    const s = stickRef.current;
    if (s) return { x: s.x, y: s.y };
    const k = keys.current;
    return { x: Number(k.has('arrowright') || k.has('d')) - Number(k.has('arrowleft') || k.has('a')), y: Number(k.has('arrowdown') || k.has('s')) - Number(k.has('arrowup') || k.has('w')) };
  };
  /** the stick as a run on the pitch (portrait and landscape both look up the pitch) */
  const steerNow = (): Pt => {
    const s = stickScreen();
    return screenRunInput(s.x, s.y, 'end');
  };
  /** the stick (or the keys) as an aim in the goal: a set-piece taker aims with it, and the keyboard
   * (no drag) aims with the arrows while Space is held. null: centred (aim assist). */
  const stickAim = (): Pt | null => {
    const s = stickScreen();
    return Math.hypot(s.x, s.y) > 0.2 ? snapAim({ x: Math.max(-1, Math.min(1, s.x)), y: Math.max(-1, Math.min(1, -s.y)) }) : null;
  };
  const passDir = (): Pt | null => {
    const v = steerNow();
    return Math.hypot(v.x, v.y) > 0.1 ? v : null;
  };
  const live = () => (uiRef.current === 'live' || uiRef.current === 'so-kick') && !!atkRef.current && !atkRef.current.end && !(uiRef.current === 'so-kick' && !usKicking.current) && !spWait.current?.auto;

  /** The left thumb's stick reports (V2 A.5): its push, and sprint past the ring (the tick is the stick's). */
  /** the stick's latest output, enabled or not (onHeld before the whistle, onStick after) */
  const heldStick = useRef<StickOut | null>(null);
  const onStick = (o: StickOut) => {
    heldStick.current = o;
    if (o.active) beat();
    stickRef.current = o.active ? { x: o.x, y: o.y } : null;
    stickSprint.current = o.sprint;
    const a = atkRef.current;
    if (a && sprintPointer.current === null) setSprint(a, o.sprint && live());
  };
  /** A pass to the teammate under a tap (on the pitch or in the stick's zone). */
  const tapPass = (cx: number, cy: number) => {
    const a = atkRef.current;
    const canvas = canvasRef.current;
    if (!a || !canvas || !live()) return;
    const r = canvas.getBoundingClientRect();
    const id = renderer.bodyAt(a, ((cx - r.left) * renderer.W) / r.width, ((cy - r.top) * renderer.H) / r.height);
    const c = a.ball.owner !== null ? a.bodies[a.ball.owner] : a.taker !== null ? a.bodies[a.taker] : null;
    if (id === null || !c || id === c.id) return;
    const to = a.bodies[id];
    const corner = a.setPiece?.kind === 'corner';
    if (pass(a, corner ? 'lofted' : 'ground', { x: to.x - c.x, y: to.y - c.y }, !corner)) {
      sfx.click();
      haptic('tick');
    }
  };
  const press = (id: SlotId, on: boolean) => setHeld((h) => (!!h[id] === on ? h : { ...h, [id]: on }));
  const doPassDown = (id: number | 'key') => {
    if (!live() || passDown.current) return;
    passDown.current = { id, t: performance.now() };
  };
  const doPassUp = (id: number | 'key') => {
    const d = passDown.current;
    if (!d || d.id !== id) return;
    passDown.current = null;
    const a = atkRef.current;
    if (!a || !live()) return;
    const held = (performance.now() - d.t) / 1000;
    // a person's pass is free: the stick's way, a gentle pull toward a teammate there
    if (pass(a, held >= LOFT_HOLD ? 'lofted' : 'ground', passDir(), true)) sfx.click();
  };
  /** A set piece's CROSS (lofted, to the man the stick picks) or SHORT (along the grass): on touch-down. */
  const setPiecePass = (lofted: boolean) => {
    const a = atkRef.current;
    if (!a || !live()) return false;
    const corner = a.setPiece?.kind === 'corner';
    if (!pass(a, lofted ? 'lofted' : 'ground', passDir(), !corner)) return false;
    sfx.click();
    return true;
  };
  const doThruDown = (id: number | 'key') => {
    if (!live() || thruDown.current) return;
    thruDown.current = { id, t: performance.now() };
  };
  /** THRU let go: a tap is the ground through ball, a hold (LOFT_HOLD) the lofted one over the line. */
  const doThruUp = (id: number | 'key') => {
    const d = thruDown.current;
    if (!d || d.id !== id) return;
    thruDown.current = null;
    const a = atkRef.current;
    if (!a || !live()) return;
    const held = (performance.now() - d.t) / 1000;
    if (pass(a, held >= LOFT_HOLD ? 'loftedThrough' : 'through', passDir(), true)) sfx.click();
  };
  /** D at a free kick: the bend, cycled straight → the left arrow → the right arrow (bendCurl). */
  const cycleBend = () => {
    const a = atkRef.current;
    if (!a || !live() || a.setPiece?.kind !== 'freekick') return;
    const k = Math.abs(a.curl) < 0.05 ? 0 : (Math.sign(a.curl) === Math.sign(bendCurl(-1)) ? -1 : 1);
    setCurl(a, bendCurl(nextBend(k)));
    sfx.click();
    setTick((n) => n + 1);
  };
  const shootDown = (id: number | 'key', x = 0, y = 0, ts = performance.now()) => {
    const a = atkRef.current;
    if (!a || !live() || shotPointer.current !== null) return false;
    if (!pressShoot(a)) return false;
    shotPress.current = ts;
    ringTicked.current = -1;
    shotPointer.current = id;
    shotDrag.current = { x0: x, y0: y, aim: null };
    setAimDot(null);
    setShooting(true);
    return true;
  };
  /** the thumb slides on SHOOT: aim (left/right across the goal, up high, down low), snapped toward the corners */
  const shootDrag = (id: number, x: number, y: number) => {
    const d = shotDrag.current;
    const a = atkRef.current;
    if (shotPointer.current !== id || !d || !a) return;
    const v = { x: (x - d.x0) / AIM_DRAG, y: -(y - d.y0) / AIM_DRAG };
    const l = Math.hypot(v.x, v.y);
    const aim = l < AIM_DEAD ? null : snapAim(l > 1 ? { x: v.x / l, y: v.y / l } : v);
    d.aim = aim;
    setAim(a, aim);
    setAimDot(l < AIM_DEAD ? null : { x: Math.max(-1, Math.min(1, v.x)), y: Math.max(-1, Math.min(1, -v.y)) });
  };
  /**
   * Let go of SHOOT. The release is judged from the two touches' own timestamps less the device's
   * display lag (v2/perfect.ts deviceLagMs), so it isn't rounded to the frame it lands in (plan G5),
   * and handed to the engine as a hold in game seconds: the engine never reads a timestamp.
   */
  const shootUp = (id: number | 'key', ts = performance.now()) => {
    if (shotPointer.current !== id) return;
    shotPointer.current = null;
    shotDrag.current = null;
    setAimDot(null);
    setShooting(false);
    const a = atkRef.current;
    const t0 = shotPress.current;
    shotPress.current = null;
    // the aim is already on the meter (the drag, the stick at a set piece, the keys); none: assist
    // (on the game clock: slow motion, hit-stops and clamped frames inside the hold count as the ring did)
    const rate = pausedRef.current ? 0 : juice.gameTime(ts, timeScale);
    if (a && !a.end && t0 !== null && releaseShoot(a, null, 0, holdOnClock(gameClock, t0, ts, deviceLagMs(), rate))) feedRelease(a);
  };
  const shootCancel = () => {
    shotPointer.current = null;
    shotDrag.current = null;
    setAimDot(null);
    setShooting(false);
    if (atkRef.current) cancelShoot(atkRef.current);
  };
  // the keyboard's sprint (Shift); the touch sprint is the stick's ring
  const sprintOn = (id: number | 'key') => {
    const a = atkRef.current;
    if (!a || !live() || sprintPointer.current !== null) return;
    sprintPointer.current = id;
    setSprint(a, true);
  };
  const sprintOff = (id: number | 'key') => {
    if (sprintPointer.current !== id) return;
    sprintPointer.current = null;
    if (atkRef.current) setSprint(atkRef.current, stickSprint.current && live());
  };

  /* ---------- pause (C-5) ---------- */
  const pausable = () => !finished.current && uiRef.current !== 'final' && uiRef.current !== 'loading';
  const pauseAt = useRef(0);
  const pause = () => {
    if (pausedRef.current || !pausable()) return;
    pausedRef.current = true;
    pauseAt.current = performance.now();
    clearInput();
    timers.pause();
    setPaused(true);
  };
  const resume = () => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    // a replay picks up where it stopped
    const rp = replayRef.current;
    if (rp) rp.start += performance.now() - pauseAt.current;
    juice.shift(performance.now() - pauseAt.current);
    timers.resume();
    setPaused(false);
  };
  // the phone locks or the app goes to the background: pause (never play on unseen)
  useEffect(() => {
    if (autoplayHook) return;
    const hide = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', pause);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', pause);
    };
  }, []);
  const leave = (how: 'quit' | 'forfeit') => {
    // never once every attack is in (a shootout is agreed or under way): QUIT and FORFEIT are not offered then
    if (finished.current || left.current || match.over || soRef.current) return;
    // the host goes first: only a quit or forfeit it accepted ends the match here (soccer-2 re-review:
    // one it refuses, say while the AI's attacks still load, leaves the sheet open and the match on)
    const host = how === 'quit' ? onQuit : onForfeit;
    if (!host || host(progress()) === false) return;
    finished.current = true;
    left.current = how;
    pausedRef.current = false;
    timers.dispose();
    setPaused(false);
    setUi('final');
    sfx.click();
  };

  // keyboard: arrows/WASD run, Space shoot (hold), J pass (hold: lob), K through ball (hold: lofted), Shift sprint, Esc pause
  useEffect(() => {
    if (autoplayHook) return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (pausedRef.current) return;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        keys.current.add(k);
        e.preventDefault();
      } else if (e.repeat) return;
      else if (k === 'escape' || k === 'p') {
        e.preventDefault();
        pause();
      } else if (k === ' ') {
        e.preventDefault();
        if (uiRef.current === 'intro' || uiRef.current === 'so-intro') kickOffNow();
        else shootDown('key', 0, 0, e.timeStamp);
      } else if (k === 'j') doPassDown('key');
      else if (k === 'k') doThruDown('key');
      else if (k === 'shift') sprintOn('key');
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.delete(k);
      if (k === ' ') shootUp('key', e.timeStamp);
      else if (k === 'j') doPassUp('key');
      else if (k === 'k') doThruUp('key');
      else if (k === 'shift') sprintOff('key');
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  // the pitch: tap a teammate to pass to him; swipe across to bend a free kick
  const fieldDown = (e: React.PointerEvent) => {
    if (!live() || swipe.current) return;
    swipe.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now() };
  };
  const fieldUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    swipe.current = null;
    const a = atkRef.current;
    if (!a || !live()) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    const ms = performance.now() - s.t0;
    if (a.setPiece?.kind === 'freekick' && Math.abs(dx) > 36 && ms < 700) {
      setCurl(a, Math.max(-1, Math.min(1, -dx / 140)));
      sfx.click();
      setTick((n) => n + 1);
      return;
    }
    if (Math.hypot(dx, dy) < 12 && ms < 350) tapPass(e.clientX, e.clientY);
  };

  /* ---------- the loop ---------- */
  /** The action-safe box and the controls' rects, from the page, in canvas px. */
  const readFrame = (wrap: HTMLElement, canvas: HTMLCanvasElement) => {
    const cr = canvas.getBoundingClientRect();
    if (cr.width < 1) return;
    const k = renderer.W / cr.width;
    const box = (r: { left: number; top: number; width: number; height: number }) => ({ x: (r.left - cr.left) * k, y: (r.top - cr.top) * k, w: r.width * k, h: r.height * k });
    const safe = wrap.querySelector('.sc2-safe');
    renderer.frameInfo.safe = safe ? box(safe.getBoundingClientRect()) : null;
    // the stick: its live ring while a thumb is down (it lands and follows under the thumb), else the ghost
    const sb = stickBase.current;
    const stick = sb ? [box({ left: sb.x - sb.r, top: sb.y - sb.r, width: sb.r * 2, height: sb.r * 2 })] : Array.from(wrap.querySelectorAll('.ps-stick-ghost')).map((el) => box(el.getBoundingClientRect()));
    renderer.frameInfo.controls = [...Array.from(wrap.querySelectorAll('.sc2-ctl, .sc2-bug, .sc2-pause')).map((el) => box(el.getBoundingClientRect())), ...stick];
    // the label pass's keep-outs (V-3; soccer-2 fix): the toast line (and the plates above it) and every
    // control, so no tag prints under a DOM button. Read here, never per frame.
    keepRef.current = [...Array.from(wrap.querySelectorAll('.sc2-toast, .sc2-plates')).map((el) => box(el.getBoundingClientRect())), ...renderer.frameInfo.controls];
  };
  const keepRef = useRef<{ x: number; y: number; w: number; h: number }[]>([]);
  const stickBase = useRef<{ x: number; y: number; r: number } | null>(null);
  // the stick's ring landed, moved 8+ px under the thumb or went: the keep-outs follow at once (soccer-2 re-review)
  const onStickBase = (b: { x: number; y: number; r: number } | null) => {
    stickBase.current = b;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (wrap && canvas) readFrame(wrap, canvas);
  };
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frameN = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      renderer.resize(w, h);
      if (canvas.width !== renderer.W || canvas.height !== renderer.H) {
        canvas.width = renderer.W;
        canvas.height = renderer.H;
        canvas.style.width = renderer.W + 'px';
        canvas.style.height = renderer.H + 'px';
        setWide(w > h);
        // the small-phone layout, from the measured frame (not a width media query)
        setCompact(w < 351 || h < 601);
      }
      const a = atkRef.current;
      const elapsed = Math.min(0.1, (now - last) / 1000) * timeScale;
      last = now;
      if (!pausedRef.current) juice.update(elapsed);
      // the juice's real time: none while a hit-stop holds, slower in slow motion (render only)
      const gameDt = juice.gameTime(now, elapsed);
      const u = uiRef.current;
      // paused: nothing moves (the accumulator is dropped, so resuming never catches up); the frame stays drawn
      const running = !pausedRef.current && !!a && (u === 'live' || u === 'so-kick') && !a.end && !replayRef.current;
      gameClock.tick(now, running ? gameDt : 0);
      if (pausedRef.current) acc = 0;
      else if (running && a) {
        acc += gameDt;
        while (acc >= DT) {
          acc -= DT;
          const auto = setPieceAuto(a);
          const ai = autoplayHook || (u === 'so-kick' && !usKicking.current) || auto;
          // no drag on SHOOT: a set-piece taker aims with the stick, the keyboard with the arrows
          if (!ai && a.meter && shotPointer.current !== null && !shotDrag.current?.aim && (shotPointer.current === 'key' || (a.setPiece && a.taker === a.ctrl))) setAim(a, stickAim());
          step(a, DT, ai ? decide(a, pilotRef.current) : steerNow());
          handleEvents(a);
          if (a.end) {
            if (u === 'so-kick') finishPen(a);
            else finishAttack(a);
            break;
          }
        }
        rec.current.push(a.t, snapOf(a));
        // the person's ring: its closing ticks over the last 200 ms before the gold, and its state for
        // the toast's dial line (set only when it changes)
        const m = a.meter;
        if (m && shotPointer.current !== null && !autoplayHook) {
          const i = Math.floor((a.t - m.t0 - (m.top - TICKS.from)) / TICKS.every);
          if (i >= 0 && i < TICKS.n && i > ringTicked.current) {
            ringTicked.current = i;
            sfx.ringTick(i);
          }
        }
        const rk = m && shotPointer.current !== null ? m.ring + ':' + (m.why ?? '') : '';
        if (rk !== ringKey.current) {
          ringKey.current = rk;
          setRingLine(rk);
        }
        // an untaken set piece: the countdown to the autopilot taking it (whole seconds, set on change)
        const sw = spWait.current;
        const cd = sw && !sw.auto && !autoplayHook ? setPieceCountdown(a.t - sw.at) : null;
        if (cd !== countdownRef.current) {
          countdownRef.current = cd;
          setCountdown(cd);
        }
      } else if (a && a.end && !replayRef.current) {
        acc = 0;
        settle(a, gameDt);
        handleEvents(a);
        rec.current.push(a.t, snapOf(a));
      } else acc = 0;
      if (countdownRef.current !== null && (!a || a.end || !a.setPiece || (u !== 'live' && u !== 'so-kick'))) {
        countdownRef.current = null;
        setCountdown(null);
      }
      // the camera's frame: the action-safe box and the rects a name tag must keep off (from the page,
      // re-read every half second and on a resize), and Clutch
      if (frameN++ % 30 === 0 || renderer.frameInfo.safe === null) readFrame(wrap, canvas);
      const clutchNow = !!a && !soRef.current && isStoppage(match, uiRef.current === 'after' ? match.i - 1 : match.i) && (u === 'intro' || u === 'live' || u === 'after');
      renderer.frameInfo.clutch = clutchNow;
      clutchRef.current.on = clutchNow;
      crowdFor(a, now);
      debug?.(a, match, u, { goal: renderer.goalMouth(), paused: pausedRef.current, stats: renderer.stats, arrows: renderer.arrows, safe: renderer.frameInfo.safe, clutch: clutchNow, fx: { granted: juice.granted }, keep: keepRef.current });
      // the score bug's clock line: the attack's time left, red in its last 5 s
      const line = lineRef.current;
      if (line && a) {
        const left = Math.max(0, a.clock - a.used);
        const k = u === 'live' || u === 'after' ? left / a.clock : 1;
        line.style.transform = 'scaleX(' + k.toFixed(3) + ')';
        line.classList.toggle('low', left <= 5 && !a.end && u === 'live');
      }
      const fx = fxRef.current;
      fx.flash = Math.max(0, fx.flash - elapsed * 1.8);
      const ctx = canvas.getContext('2d');
      if (!ctx || !a) return;
      const kitOf = (b: Body): 'us' | 'them' => ((b.side === 'A') === (u.startsWith('so') && !usKicking.current) ? 'them' : 'us');
      try {
        const rp = replayRef.current;
        if (rp) {
          const rt = replayTime(rp, pausedRef.current ? pauseAt.current : now);
          const sn = rt === null ? null : frameAt(rp.frames, rt);
          if (rt === null || !sn) endReplay();
          else renderer.draw(ctx, { ...a, t: sn.t, bodies: sn.bodies, ball: sn.ball, meter: null, release: undefined, end: a.end }, { target: null, flash: 0, names: false }, kitOf);
        } else {
          const c = ctrlOf(a);
          const onBall = a.ball.owner === c.id || (a.setPiece && a.taker === c.id);
          const dir = passDir();
          const corner = a.setPiece?.kind === 'corner';
          const show = !autoplayHook && onBall && !a.meter && a.setPiece?.kind !== 'penalty';
          // the pass the stick would play: its line, and the man the gentle assist would find (a corner: the man the stick picks)
          const heldFor = (d: { t: number } | null) => (d ? (performance.now() - d.t) / 1000 : 0);
          const kind = thruDown.current ? 'through' : heldFor(passDown.current) >= LOFT_HOLD ? 'lofted' : 'ground';
          const plan = show && dir && !corner ? passPlan(a, kind, dir) : null;
          const target = show && corner ? (passTarget(a, dir, 'lofted')?.id ?? null) : (plan?.to?.id ?? null);
          // the man in control is the rival's in a shootout's their-kick: a violet ring and tag, never our gold (V-3)
          const ours = !(u.startsWith('so') && !usKicking.current);
          // the toast line and the controls, as last measured: no tag prints under them (V-3)
          renderer.draw(ctx, a, { target, pass: plan, jolt: juice.view(), flash: fx.flash, names: u === 'intro', ours, keepOut: keepRef.current }, kitOf);
        }
        // shell's arena-ready: once, after the first frame with the pitch and the players
        if (!arenaReady.current && renderer.firstFrame) {
          arenaReady.current = true;
          window.dispatchEvent(new CustomEvent('ps:arena-ready', { detail: { sport: 'soccer' } }));
        }
      } catch (err) {
        console.error('[soccer draw]', err);
        renderer.dispose();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // the rival's goal (V2 B.3.7, plan F5): the plate, their sound and the bug's pulse, in the same paint
  // as the new score (a layout effect, before the browser draws)
  useLayoutEffect(() => {
    const now = rival?.score ?? 0;
    const was = rivalSeen.current;
    rivalSeen.current = now;
    if (now <= was || soRef.current || finished.current) return;
    sfx.scoreThem();
    setBugPulse((n) => n + 1);
    const at = Math.max(0, Math.min(totalOf(match) - 1, (rival?.drive ?? 1) - 1));
    showPlate('them', (rival?.name ?? rivalName).toUpperCase().slice(0, 12) + ' SCORE ' + minuteOf(match, at) + ' · ' + match.goals + '–' + now, 2200);
  }, [rival?.score]);

  const a = atkRef.current;
  const total = totalOf(match);
  const inSo = ui.startsWith('so') || (ui === 'final' && !!soRef.current);
  // QUIT / FORFEIT only while attacks are still to play: once all are in, the result (or the agreed shootout) stands
  const canLeave = !match.over && !soRef.current && !left.current;
  const playing = ui === 'live' || (ui === 'so-kick' && usKicking.current);
  const intro = ui === 'intro' || ui === 'so-intro';
  const sp = a?.setPiece?.kind ?? null;
  const theirKick = ui === 'so-kick' && !usKicking.current;
  // between attacks the scoreboard still shows the one just played
  const shownI = ui === 'after' ? Math.max(0, match.i - 1) : Math.min(match.i, total - 1);
  const rivalShown = rival?.name ?? rivalName;
  const rivalTag = rivalShown.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3) || 'RIV';
  usePlaytime('match', { paused, auto: !!autoplayHook, stoppage: !playing && !theirKick });
  // Clutch (V2 B.0.4): the stoppage attack is staged. Rules unchanged; the camera, the bug, the crowd,
  // the heartbeat and the line in the toast line change.
  const clutch = !inSo && !match.over && isStoppage(match, shownI) && (ui === 'intro' || ui === 'live' || ui === 'after');
  const margin = (rival?.score ?? 0) - match.goals;
  clutchRef.current.close = clutch && Math.abs(margin) <= 1;
  const clutchLine = clutch && ui !== 'after' ? (margin === 0 ? 'FOR THE WIN' : margin === 1 ? 'TO TIE IT' : null) : null;

  // the cluster: before the whistle A is the whistle itself; then the phase's four slots (controls.ts)
  const phase: ControlPhase = sp === 'penalty' || ui === 'so-kick' ? 'penalty' : sp === 'corner' ? 'corner' : sp === 'freekick' ? 'freekick' : 'attack';
  const go: Slot = { act: 'shoot', label: ui === 'intro' ? 'KICK OFF' : usKicking.current ? 'STEP UP' : 'READY' };
  const slots: Slots | null = autoplayHook || !a || ui === 'loading' ? null : intro ? { A: go, B: null, C: null, D: null } : playing ? slotsFor(phase) : null;
  const bendK: -1 | 0 | 1 = !a || Math.abs(a.curl) < 0.05 ? 0 : Math.sign(a.curl) === Math.sign(bendCurl(-1)) ? -1 : 1;

  // the toast line (V-3: it replaces the hint over the goal): the countdown, a tip, the attack's line
  // before the whistle; nothing while SHOOT is held or a meter is up
  // while SHOOT is held: only the ring's dial, when it can't be gold; just after a release: its word
  const heldWhy = shooting && ringLine && !ringLine.startsWith('gold') ? (ringLine.split(':')[1] as RingWhy | '') : '';
  const toast: { text: string; kind: 'plain' | 'good' | 'bad' | 'perfect'; timer?: boolean } | null =
    autoplayHook || !a || paused
      ? null
      : heldWhy
        ? { text: RING_LINE[heldWhy], kind: heldWhy === 'range' ? 'bad' : 'good' }
      : shooting || a.meter
      ? null
      : releaseToast
        ? { text: releaseToast.text, kind: releaseToast.kind }
      : countdown !== null && playing
        ? { text: 'AUTO KICK · in ' + countdown, kind: 'bad', timer: true }
        : ui === 'intro'
          ? { text: clutchLine ? clutchLine + ' · ' + SCENARIO_HINTS[a.scenario] : scenarioToast(a.scenario), kind: 'good' }
          : ui === 'so-intro'
            ? { text: usKicking.current ? 'YOUR KICK · ' + a.bodies[a.ctrl].p.name : TIPS.keep, kind: usKicking.current ? 'good' : 'plain' }
            : hint && (playing || theirKick)
              ? { text: hint, kind: 'plain' }
              : clutchLine && playing
                ? { text: clutchLine + " · 90+'", kind: 'good' }
                : null;

  /** when a cluster button last had a pointer down or up: the click after it is the same press, not a second one */
  const slotPointerAt = useRef(0);
  const slotDown = (id: SlotId, sl: Slot, e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    slotPointerAt.current = performance.now();
    beat();
    if (intro) {
      haptic('tick');
      kickOffNow();
      return;
    }
    let took = false;
    if (sl.act === 'shoot') took = shootDown(e.pointerId, e.clientX, e.clientY, e.timeStamp);
    else if (sl.act === 'pass') {
      doPassDown(e.pointerId);
      took = passDown.current?.id === e.pointerId;
    } else if (sl.act === 'thru') {
      doThruDown(e.pointerId);
      took = thruDown.current?.id === e.pointerId;
    } else if (sl.act === 'cross' || sl.act === 'short') took = setPiecePass(sl.act === 'cross');
    else if (sl.act === 'bend') {
      cycleBend();
      took = true;
    }
    if (!took) return;
    haptic('tick');
    press(id, true);
    if (sl.act === 'shoot' || sl.act === 'pass' || sl.act === 'thru') e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const slotUp = (id: SlotId, sl: Slot, e: React.PointerEvent<HTMLButtonElement>) => {
    slotPointerAt.current = performance.now();
    press(id, false);
    if (sl.act === 'shoot') shootUp(e.pointerId, e.timeStamp);
    else if (sl.act === 'pass') doPassUp(e.pointerId);
    else if (sl.act === 'thru') doThruUp(e.pointerId);
  };
  /**
   * A click with no pointer down before it (VoiceOver, Switch Control, a keyboard's Enter on a focused
   * button): the button's tap, so assistive tech can kick off, pass, play it through, cross and bend.
   * SHOOT needs the meter (a hold), so its keyboard way is Space.
   */
  const slotClick = (sl: Slot) => {
    if (performance.now() - slotPointerAt.current < 1000) return;
    if (intro) {
      kickOffNow();
      return;
    }
    if (sl.act === 'pass') {
      doPassDown('key');
      doPassUp('key');
    } else if (sl.act === 'thru') {
      doThruDown('key');
      doThruUp('key');
    } else if (sl.act === 'cross' || sl.act === 'short') setPiecePass(sl.act === 'cross');
    else if (sl.act === 'bend') cycleBend();
  };
  const slotCancel = (id: SlotId, sl: Slot) => {
    press(id, false);
    if (sl.act === 'shoot') shootCancel();
    else if (sl.act === 'pass') passDown.current = null;
    else if (sl.act === 'thru') thruDown.current = null;
  };

  // the keep-outs move only when the toast, the plates, the cluster or the frame change: measure then,
  // and again once the toast's slide-in has settled (soccer-2 fix: no layout reads every frame)
  const keepKey = (toast?.text ?? '') + '|' + plates.length + (toast ? 'o' : '') + '|' + (slots ? targetsOf(slots).join('') : '') + '|' + compact + wide + ui;
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    readFrame(wrap, canvas);
    const settle = () => readFrame(wrap, canvas);
    wrap.addEventListener('animationend', settle);
    return () => wrap.removeEventListener('animationend', settle);
  }, [keepKey]);

  return createPortal(
    <div className={'arcade-full hg2 sc2 ps-geo' + (wide ? ' wide land' : '') + (compact ? ' compact' : '')} ref={wrapRef} onPointerDown={fieldDown} onPointerUp={fieldUp} onPointerCancel={() => (swipe.current = null)}>
      <canvas ref={canvasRef} className="hg2-canvas" />
      {/* the V2 action-safe box, read by the camera (never drawn) */}
      <i className="sc2-safe" aria-hidden="true" />
      {/* the last play's read-out, between attacks only: in play the field's only text is the toast line, the tags and the bug (V2 C.5) */}
      {!autoplayHook && !playing && <PlayReadout readout={lastReadout} live={playing} resetKey={match.i} />}
      {slots && <div className="ps-scrim" aria-hidden="true" />}

      <ScoreBug
        you={match.goals}
        rival={rival ? rival.score : null}
        rivalTag={rivalTag}
        minute={minuteOf(match, shownI)}
        count={match.over ? null : shownI + 1 + '/' + total}
        mid={inSo && soView ? <><b>PENS</b><small className="num">{soView.us}–{soView.them}</small></> : match.over ? <b>FULL TIME</b> : clutch ? <b>CLUTCH</b> : undefined}
        heat={null}
        clutch={clutch}
        pulse={bugPulse}
        lineRef={lineRef}
        label={'You ' + match.goals + ', ' + rivalShown + ' ' + (rival ? rival.score : 'to come') + (match.over ? ', full time' : ', ' + minuteOf(match, shownI) + ', attack ' + (shownI + 1) + ' of ' + total + ', ' + SCENARIO_NAMES[match.deal[shownI]])}
      />
      {!autoplayHook && ui !== 'final' && ui !== 'loading' && <PauseButton onPress={pause} />}
      {inSo && soView && <PenTally view={soView} rivalName={rivalShown} />}
      {pop && (
        <div key={pop.id} className={'hg2-pop ' + pop.tone} role="status">
          {pop.text}
          {pop.sub && <small>{pop.sub}</small>}
        </div>
      )}
      {plates.length > 0 && (
        <div className={'sc2-plates' + (toast ? ' over' : '')} role="status" aria-live="polite">
          {plates.map((q) => (
            <div key={q.id} className={'sc2-plate ' + q.side}>
              <i aria-hidden="true" />
              {q.text}
            </div>
          ))}
        </div>
      )}
      {toast && <ToastLine text={toast.text} kind={toast.kind} timer={toast.timer} />}
      {replaying && (
        <button className="replay-banner" onPointerDown={(e) => (e.stopPropagation(), endReplay())} aria-label="Instant replay: tap to skip">
          <i />
          REPLAY
          <small>TAP TO SKIP</small>
        </button>
      )}
      {theirKick && !autoplayHook && (
        <div className="sc2-dive" role="group" aria-label="Dive" onPointerDown={(e) => e.stopPropagation()}>
          {([-1, 0, 1] as const).map((g) => (
            <button
              key={g}
              aria-pressed={guess === g}
              onClick={() => {
                const live = atkRef.current;
                if (!live || live.lastShot) return;
                live.guess = g;
                setGuess(g);
                sfx.click();
              }}
            >
              <Arrow dir={g} />
              {g === 0 ? 'STAY' : 'DIVE'}
            </button>
          ))}
        </div>
      )}
      {!autoplayHook && a && !theirKick && ui !== 'loading' && ui !== 'final' && <Stick disabled={!playing || paused} onChange={onStick} onTap={tapPass} onBase={onStickBase} onHeld={(o) => (heldStick.current = o)} />}
      {slots && (
        <div className="sc2-cluster" role="group" aria-label="Actions">
          {targetsOf(slots).map((id) => {
            const sl = slots[id]!;
            const bend = sl.act === 'bend';
            const tone = id === 'A' ? 'gold' : id === 'B' ? 'teal' : 'glass';
            return (
              <button
                key={id + sl.act + sl.label}
                type="button"
                className={'sc2-ctl sc2-ctl-' + id.toLowerCase() + ' tone-' + tone + (held[id] || (sl.act === 'shoot' && shooting) ? ' down' : '') + (intro ? ' go' : '')}
                data-slot={id}
                data-act={sl.act}
                aria-label={bend ? 'Bend: ' + (bendK === 0 ? 'straight' : bendK < 0 ? 'left' : 'right') + '. Tap to change' : sl.label + (sl.sub ? ' (' + (sl.hold ? 'hold: ' : '') + sl.sub.toLowerCase() + ')' : '')}
                onPointerDown={(e) => slotDown(id, sl, e)}
                onPointerMove={sl.act === 'shoot' ? (e) => shootDrag(e.pointerId, e.clientX, e.clientY) : undefined}
                onPointerUp={(e) => slotUp(id, sl, e)}
                onPointerCancel={() => slotCancel(id, sl)}
                onClick={() => slotClick(sl)}
                onLostPointerCapture={(e) => slotUp(id, sl, e)}
              >
                <span className="sc2-ctl-label">{bend ? <Arrow dir={bendK} /> : sl.label}</span>
                {bend && <span className="sc2-ctl-sub">BEND</span>}
                {sl.sub && (
                  <span className={'sc2-ctl-sub' + (sl.hold ? ' hold' : '')}>
                    {sl.hold && (
                      <svg viewBox="0 0 10 10" aria-hidden="true">
                        <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.4" />
                        <circle cx="5" cy="5" r="1.9" fill="currentColor" />
                      </svg>
                    )}
                    {sl.sub}
                  </span>
                )}
                {sl.act === 'shoot' && shooting && (
                  <span className="sc2-aimpad" aria-hidden="true">
                    <i className="u" />
                    <i className="d" />
                    <i className="l" />
                    <i className="r" />
                    <b style={aimDot ? { transform: 'translate(' + Math.round(aimDot.x * 26) + 'px,' + Math.round(aimDot.y * 26) + 'px)' } : undefined} className={aimDot ? 'on' : ''} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {ui === 'final' && (
        <div className="fg-final hg2-final sc2-final" role="status">
          <span className="eyebrow">{left.current === 'forfeit' || left.current === 'quit' ? 'Forfeit · ' + rivalShown + ' wins' : left.current === 'them' ? rivalShown + ' forfeits · you win' : soRef.current ? 'Penalties' : 'Your attacks'}</span>
          <b className="num">{soRef.current && soView ? soView.us + '–' + soView.them : match.goals}</b>
          {match.ends.length > 0 && <small>{match.ends.join(' · ')}</small>}
          {soRef.current && <small className="sc2-pens">{soRef.current.winner === 'us' ? 'YOU WIN THE SHOOTOUT' : 'YOU LOSE THE SHOOTOUT'}</small>}
          {rival && !rival.done && !soRef.current && <WaitLine rival={rival} unit="attack" total={total} />}
        </div>
      )}
      {paused && <PauseSheet online={online} rivalName={rivalShown} quitNote={quitNote} onResume={resume} onQuit={onQuit && canLeave ? () => leave('quit') : undefined} onForfeit={onForfeit && canLeave ? () => leave('forfeit') : undefined} />}
      {ui === 'loading' && <div className="fg-loading">Walking out…</div>}
    </div>,
    document.body
  );
}

/** The lab's start=x,y: the man on the ball (and the ball) moved to a spot before the whistle. */
function placeCarrier(a: Attack, at: Pt) {
  const c = a.bodies[a.ctrl];
  c.x = Math.max(1, Math.min(PW - 1, at.x));
  c.y = Math.max(31, Math.min(PL - 1, at.y));
  c.home = { x: c.x, y: c.y };
  a.ball.x = c.x;
  a.ball.y = c.y + 0.5;
}

function Arrow({ dir }: { dir: number }) {
  if (dir === 0)
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="4" fill="currentColor" />
      </svg>
    );
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" style={{ transform: dir > 0 ? 'scaleX(-1)' : undefined }}>
      <path d="M7 1 1 7l6 6M1 7h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PenTally({ view, rivalName }: { view: { marks: { side: Side; scored: boolean }[]; first: Side }; rivalName: string }) {
  const row = (side: Side) => {
    const ks = view.marks.filter((m) => m.side === side);
    const n = Math.max(5, ks.length + (ks.length >= 5 ? 1 : 0));
    return Array.from({ length: n }, (_, i) => <i key={i} className={i < ks.length ? (ks[i].scored ? 'in' : 'out') : ''} />);
  };
  return (
    <div className="sc2-pentally" aria-label="Penalties">
      <span>
        <small>YOU</small>
        {row('us')}
      </span>
      <span className="them">
        <small>{rivalName.toUpperCase().slice(0, 8)}</small>
        {row('them')}
      </span>
    </div>
  );
}

export type { AttackEnd };
