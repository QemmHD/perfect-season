import { footballFeedback, type PlayFeedback } from '../play-feedback';
import type { Practice } from '../../evolution/training';
// Arcade football, Retro Bowl style: your offense against the rival's defense, eleven on eleven.
// The V2 control grammar (Claude, studio overhaul nfl-2): the left thumb is a floating stick, the
// right thumb has A/B/C/D (their jobs change with the moment; gestures.ts and the map in
// PauseMenu.tsx). Before the snap pick a play from the 124 px tray (PlayTray.tsx; its routes, or the
// run's lane, are drawn on the field) and SNAP on A. In the pocket the stick moves the quarterback; drag back anywhere on the right and let go to
// throw, or tap a receiver's name chip. With the ball, the stick steers and bursts past its ring;
// JUKE, SPIN, POWER and DIVE/SLIDE are A to D. Fourth down: go for it, kick on the meter, or punt.
// Pause any time; real time between plays runs on the pause-aware clock.ts. The screen (nfl-3): the
// broadcast camera (camera.ts), the turf overlays (overlay.ts), and the HUD kit: one score bug with
// the Heat bar under it and one toast line, whose queue is hud.ts.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lineup, Player } from '../../engine/types';
import { logError } from '../../lib/errlog';
import { crowd, setFeedback, sfx, tapHaptic, vibrate } from '../../lib/sound';
import { Juice } from '../juice';
import { reducedMotion } from '../../ui/motion';
import { type Attrs, loadAttrs } from '../attrs';
import { freeCanvas } from '../pixel/body';
import { luma, rgb } from '../pixel/color';
import type { FieldTheme } from '../pixel/field';
import type { Progress, RivalLive } from '../progress';
import { frameAt, Recorder, type Replay, REPLAY_AFTER, REPLAY_SPEED, replayTime, REPLAYS_IN_AUTOPLAY } from '../replay';
import { WaitLine } from '../Wait';
import { autoplay, decide, fourthDown, pilot } from './autopilot';
import {
  afterPlay,
  choices,
  clockText,
  downText,
  fireAtFor,
  type DriveEnd,
  DRIVES,
  fgDistance,
  fgInRange,
  type Game,
  kick,
  kickWindow,
  newGame,
  type PlayChoice,
  punt,
  spotText,
  startChoice,
  startPlay
} from './drive';
import { CONCEPTS, coverBall, dist, FIELD_W, flipPlay, giveUp, isLine, maxThrow, moveEdge, moveWithBall, outsideBox, receiverLead, scramble, setBurst, snap, step, throwAway, throwTo, throwToReceiver } from './engine';
import { type FbKit, FootballRenderer } from './render';
import { defenseOf, offenseOf } from './squad';
import type { Body, Defense, Offense, PassType, Play, Pt, RunInput } from './types';
import './rushing-controls.css';
import { CarryGate, screenRunInput } from './controls';
import { GameClock } from './clock';
import { burstHeld, type Gesture, type GestureState, Gestures, nextPassType, stickZone } from './gestures';
import { PauseMenu } from './PauseMenu';
import { BURST_BUTTON, readPref, writePref } from './prefs';
import { type IconsHandle, ReceiverIcons } from './ReceiverIcons';
import { controlGeometry, haptic, type Insets, PauseButton, ScoreBug, Stick, type StickHandle, ToastLine, type ToastView, usePlaytime, type Vec } from './shared-v2';
import { AUTO_KICK_AIM, AUTO_PICK, KICK_RESULT, KICK_TO_TRAY, LONG_TD_REPLAY, PUNT_TO_TRAY, REPLAY_LEAD, REPLAY_TAIL, SLOWMO, SLOWMO_RATE, TAP_SKIP, WHISTLE_TO_TRAY } from './pacing';
import { ABILITY_TEXT, abilityToPop, bugModel, PRIO, type Tone, type ToastIn, ToastQueue } from './hud';
import { FRAME } from './camera';
import { type Fourth, kindOf, keyOf, nameOf, PlayArt, PlayTray, type TrayEntry } from './PlayTray';
import './hud.css';
import './playbook.css';
import './pass-controls.css';
import './pause.css';
import { PlaybookDialog } from './PlaybookDialog';
import { useInputInterrupt } from '../useInputInterrupt';

type Ui = 'loading' | 'pre' | 'fourth' | 'live' | 'after' | 'kick' | 'final';

/** What a replay needs to redraw a moment of a play. */
interface Snap {
  bodies: Body[];
  ball: Play['ball'];
  carrier: number | null;
  phase: Play['phase'];
}
const snapOf = (p: Play): Snap => ({
  bodies: p.bodies.map((b) => ({ ...b, trail: [], route: b.route })),
  ball: p.ball ? { ...p.ball } : null,
  carrier: p.carrier ? p.carrier.id : null,
  phase: p.phase
});

const DT = 1 / 60;
const MARK_TEXT: Record<DriveEnd, string> = { TD: 'TD', FG: 'FG', MISS: 'X', INT: 'INT', DOWNS: '–', PUNT: 'P', FUM: 'FUM', SAF: 'SAF', TIME: '0:00' };
/** A UT match brings its own rated teams: no attribute file to wait for (nfl-3: 0 bytes of nfl-attrs). */
const NO_ATTRS = (): Attrs | null => null;

/** A game's drive ends as the other phone hears them: the clock running out goes as a turnover on
 * downs (worth the same nothing), which phones from before the two-minute drill understand. */
const wireEnds = (g: Game): string[] => g.ends.map((e) => (e === 'TIME' ? 'DOWNS' : e));

/** Who's open (rings on the receivers while you aim) shows only in a player's first games. */
const PLAYED_KEY = 'perfect-season:fb2-played';
const OPEN_RING_GAMES = 3;
function gamesPlayed(): number {
  try {
    return Number(localStorage.getItem(PLAYED_KEY)) || 0;
  } catch {
    return OPEN_RING_GAMES;
  }
}
function countGame() {
  try {
    localStorage.setItem(PLAYED_KEY, String(gamesPlayed() + 1));
  } catch {
    // storage blocked: the rings just keep showing
  }
}

/** The pocket's first-time tip, and the one that replaces it once the ball is in the air. */
const PASS_TIP = 'Tap a name or drag back to throw';
const AIR_TIP = 'Momentum carries · steer when ready';

/** The stick's vector (y up, after its dead zone) as a field direction: up the screen is up the field. */
function fieldOf(v: Vec, view: 'end' | 'side'): Pt {
  return view === 'side' ? { x: v.y, y: v.x } : { x: v.x, y: v.y };
}

/** What the touches mean right now (gestures.ts). */
function gestureState(ui: Ui, p: Play | null): GestureState {
  if (!p) return 'idle';
  if (ui === 'pre' || ui === 'fourth') return 'pre';
  if (ui !== 'live') return 'idle';
  if (p.phase === 'drop' && p.call === 'pass' && p.carrier === p.qb) return 'pocket';
  if (p.phase === 'air') return 'air';
  if (p.phase === 'run' || (p.phase === 'drop' && p.call === 'run')) return 'carrier';
  return 'idle';
}

/** The safe-area insets: the test hook if there is one (as the stage reads it), else the probe's env() padding. */
function readInsets(probe: HTMLElement | null): Insets {
  const hook = (window as { __psInsets?: [number, number, number, number] }).__psInsets;
  if (hook) return { top: hook[0], right: hook[1], bottom: hook[2], left: hook[3] };
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(probe);
  const n = (v: string) => parseFloat(v) || 0;
  return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
}

/** A home kit from a team's colors, and an away kit (white jerseys, the team's helmet). */
export function fbKitsFor(c1: string, c2: string): { home: FbKit; away: FbKit } {
  const light = luma(rgb(c2)) > 115;
  const pants = light ? c2 : '#ecebe4';
  return {
    home: { jersey: c1, trim: c2, pants, helmet: c1, stripe: c2, socks: c1, shoes: '#16161c', mask: light ? '#c9ccd2' : c2 },
    away: { jersey: '#f6f6f2', trim: c1, pants, helmet: c1, stripe: c2, socks: c1, shoes: '#16161c', mask: light ? '#c9ccd2' : c2 }
  };
}

export function Football2({
  lineup,
  rivalLineup,
  offense,
  rivalDefense,
  rivalName,
  seed,
  drives = DRIVES,
  practice,
  defIQ = 0,
  rival,
  ourKit,
  theirKit,
  field,
  autoplayHook,
  timeScale = 1,
  online = false,
  quitText,
  onQuit,
  feedback,
  onFeedback,
  onProgress,
  onDone
}: {
  lineup?: Lineup;
  /** the rival's draft: their defense lines up against you */
  rivalLineup?: Lineup;
  /** or the teams themselves (Ultimate Team): your offense and the rival's defense */
  offense?: Offense;
  rivalDefense?: Defense;
  rivalName: string;
  seed: string;
  drives?: number;
  practice?: Practice;
  /** how well the rival defends beyond its ratings (Squad Battles' difficulty; 0 standard) */
  defIQ?: number;
  rival: RivalLive | null;
  ourKit: FbKit;
  theirKit: FbKit;
  /** your end zone (behind you) and theirs (the one you're going for) */
  field: FieldTheme;
  /** tests: let the autopilot play */
  autoplayHook?: boolean;
  /** the lab's slow motion, for filming the moves frame by frame (1 in the app) */
  timeScale?: number;
  /** an online match: pausing stops only this phone's game (the menu says so), and there's no Quit here */
  online?: boolean;
  /** offline quit (contract C4): what the confirm says, and what leaving means (the host decides) */
  quitText?: string;
  onQuit?: (p: Progress) => void;
  /** sound and haptics as the profile has them, and how to change them (the pause menu's switches) */
  feedback?: { sound: boolean; haptics: boolean };
  onFeedback?: (key: 'sound' | 'haptics', on: boolean) => void;
  onProgress: (p: Progress) => void;
  onDone: (p: Progress) => void;
}) {
  const [lastReadout, setLastReadout] = useState<PlayFeedback | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // the draft's lineups need the attribute file; a UT match's teams are already rated
  const [attrs, setAttrs] = useState<((p: Player) => Attrs | null) | null>(() => (offense && rivalDefense ? NO_ATTRS : null));
  useEffect(() => {
    if (attrs) return;
    let live = true;
    loadAttrs().then((f) => live && setAttrs(() => f));
    return () => {
      live = false;
    };
  }, []);
  const game = useMemo<Game | null>(
    () => (attrs ? newGame(offense ?? offenseOf(lineup!, attrs, seed), rivalDefense ?? defenseOf(rivalLineup!, attrs, 'def:' + seed), seed, drives, defIQ) : null),
    [attrs]
  );
  const renderer = useMemo(() => new FootballRenderer(field, [ourKit, theirKit]), []);
  // the game's drawings and its canvas let go of their memory as it closes (Safari counts a dropped
  // canvas against the page's cap until it's collected, which can be a while)
  useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      renderer.dispose();
      freeCanvas(canvas);
    };
  }, []);
  const playRef = useRef<Play | null>(null);
  const pilotRef = useRef(pilot(0.75, seed));
  const fxRef = useRef({ shake: 0, flash: 0, juice: new Juice({ reducedMotion: reducedMotion() }) });
  const slowUntil = useRef(0);
  // the slingshot: where the drag began and how far back it's pulled (css px)
  const dragRef = useRef<{ id: number; x0: number; y0: number; dx: number; dy: number } | null>(null);
  // the floating stick (C16, through shared-v2): read once a step, never through React state
  const stickRef = useRef<StickHandle>(null);
  // who owns each touch, and what it turned into (gestures.ts)
  const gestures = useRef(new Gestures());
  // real time that stops when the game is paused: the loop, replays, the kick needle, every wait
  const clock = useMemo(() => new GameClock(), []);
  useEffect(() => () => clock.dispose(), []);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const playtime = usePlaytime('match');
  const startedAt = useRef(clock.now());
  // the receivers' name chips and the reticle (placed by ref each frame)
  const iconsRef = useRef<IconsHandle>(null);
  // the Burst-button preference: hold D to burst instead of pushing past the stick's ring
  const [burstPref, setBurstPref] = useState(() => readPref(BURST_BUTTON));
  const burstPrefRef = useRef(burstPref);
  burstPrefRef.current = burstPref;
  const burstButton = useRef(false);
  // what A and D say right now (RUN IT or THROW AWAY; DIVE, SLIDE or nothing), from the loop
  const [aAway, setAAway] = useState(false);
  const [dMode, setDMode] = useState<'dive' | 'slide' | null>(null);
  const live = useRef({ aAway: false, dMode: null as 'dive' | 'slide' | null });
  // the C15 geometry for this screen and its insets, as CSS variables on the game
  const [geom, setGeom] = useState<Record<string, string>>({});
  const probeRef = useRef<HTMLDivElement>(null);
  const runKeys = useRef(new Set<string>());
  const kickRef = useRef<{ t0: number; stopped: number | null; dist: number; win: number } | null>(null);
  const [ui, setUi] = useState<Ui>('loading');
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const [, setTick] = useState(0);
  // the toast line (hud.ts): everything the screen says goes through one queue
  const toastQ = useRef(new ToastQueue());
  const toastTimer = useRef<ReturnType<typeof clock.after> | null>(null);
  const [toast, setToast] = useState<ToastView | null>(null);
  const hinted = useRef(new Set<string>());
  // the one-pop rule (V-4): this play has shown its ability already
  const popShown = useRef({ done: false });
  const [wide, setWide] = useState(false);
  // the play tray: collapsed while the field is dragged to look around (the view's shift in yards)
  const [trayDown, setTrayDown] = useState(false);
  const lookRef = useRef<Pt | null>(null);
  const lookFrom = useRef<Pt>({ x: 0, y: 0 });
  // fourth down: the tray's pick (go for it, kick, punt), A does it
  const [fourthPick, setFourthPick] = useState<Fourth['pick']>('go');
  // the camera's frame: the action-safe box (C15), reduced motion, and where the HUD leaves room for the chips
  const frameRef = useRef<{ safe: { top: number; bottom: number } | null; reduced: boolean; chips: { top: number; bottom: number } | null }>({ safe: null, reduced: reducedMotion(), chips: null });
  // a wait after the whistle that a tap may cut short (a celebration, a replay's lead-in)
  const skippable = useRef<{ timer: ReturnType<typeof clock.after>; run: () => void } | null>(null);
  const drawn = useRef(false);
  const ctx2d = useRef<CanvasRenderingContext2D | null>(null);
  // the momentum carry: a new carrier runs on until the player takes him (controls.ts)
  const gate = useRef(new CarryGate());
  const [phase, setPhase] = useState<Play['phase']>('pre');
  const [passType, setPassType] = useState<PassType>('touch');
  const passTypeRef = useRef<PassType>('touch');
  const [bursting, setBursting] = useState(false);
  const burstPointer = useRef<number | 'keyboard' | null>(null);
  // the three play cards for this down, and the one lined up
  const [opts, setOpts] = useState<{ choice: PlayChoice; play: Play }[]>([]);
  const [picked, setPicked] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [book, setBook] = useState<{ choice: PlayChoice; play: Play }[] | null>(null);
  const openRings = useMemo(() => gamesPlayed() < OPEN_RING_GAMES, []);
  const counted = useRef(false);
  // instant replay: the last seconds of play, the highlight to show, the replay running
  const rec = useRef(new Recorder<Snap>(6));
  const highlight = useRef<{ t: number; x: number; y: number; before: number } | null>(null);
  const replayRef = useRef<Replay<Snap> | null>(null);
  const [replaying, setReplaying] = useState(false);
  // On Fire (three completions in a row): the chip under the drive marks
  const [fire, setFire] = useState(false);
  // the two-minute clock on the last drive: written straight into the scoreboard each frame, and
  // run down to the new time between plays rather than jumping
  const clockRef = useRef<HTMLElement>(null);
  const shownClock = useRef<number | null>(null);

  /** Show what the queue says now, and come back when that runs out. */
  const syncToast = () => {
    const now = clock.now();
    const t = toastQ.current.current(now);
    setToast((was) => (was?.id === t?.id ? was : t ? { id: t.id, text: t.text, sub: t.sub, tone: t.tone } : null));
    clock.cancel(toastTimer.current);
    toastTimer.current = t ? clock.after(Math.max(30, t.until - now + 5), syncToast) : null;
  };
  const post = (t: ToastIn) => {
    if (autoplayHook) return;
    toastQ.current.push(t, clock.now());
    syncToast();
  };
  /** A result on the toast line: big and bad news outranks an ordinary result. */
  const say = (text: string, tone: Tone, ms = 1200, sub?: string) => post({ text, sub, tone, ms, prio: tone === 'big' || tone === 'bad' ? PRIO.big : PRIO.result, scope: 'play' });
  /** A first-time hint: it belongs to the moment it's given and goes when the play moves on (or, `timed`, after its 4.2 s). */
  const tip = (key: string, text: string, timed = false) => {
    if (practice || autoplayHook || hinted.current.has(key)) return;
    hinted.current.add(key);
    post({ text, tone: 'plain', prio: PRIO.hint, ms: 4200, key: 'hint', scope: timed ? 'time' : 'phase' });
  };
  /** The play moved on: hints from the moment before go (and, at a new play, the last play's results). */
  const moveOn = (phaseKey: string, newPlay = false) => {
    toastQ.current.clear(phaseKey, newPlay);
    syncToast();
  };
  const progress = (g: Game): Progress => ({ score: g.score, drive: g.drive, done: g.over, ends: wireEnds(g), plays: g.plays });
  const shake = (px: number) => {
    if (!reducedMotion()) fxRef.current.shake = Math.max(fxRef.current.shake, px);
  };

  /** Line up the next snap: three play cards, the first lined up with its routes until you pick another. */
  const lineUpNext = (g: Game) => {
    if (practice) {
      g.down = practice.drill === 'kick' ? 4 : 1;
      g.toGo = 10;
      g.ballOn = practice.drill === 'kick' ? Math.max(60, 80 - g.plays * 2) : 25;
      g.clock = null;
    }
    const cs = practice?.drill === 'run' ? choices(g).filter((c) => c.call === 'run') : practice?.drill === 'throw' ? choices(g).filter((c) => c.call === 'pass') : choices(g);
    const lined = cs.map((choice) => ({ choice, play: startChoice(g, choice) }));
    setOpts(lined);
    setPicked(0);
    setFlipped(false);
    setBook(null);
    playRef.current = startChoice(g, cs[0]);
    dragRef.current = null;
    // (a thumb resting on the stick stays down: it's live at the next snap)
    gate.current.reset();
    runKeys.current.clear();
    popShown.current = { done: false };
    lookRef.current = null;
    setTrayDown(false);
    // fourth down: the tray suggests the kick in range, a punt from deep with a long way to go
    setFourthPick(practice?.drill === 'kick' || g.clock === 0 ? 'fg' : fourthDown(g) === 'kick' ? 'fg' : g.toGo >= 4 && g.ballOn < 55 ? 'punt' : 'go');
    setPhase('pre');
    setUi(g.down === 4 ? 'fourth' : 'pre');
    moveOn('pre', true);
    if (g.down !== 4) tip('call', 'Pick a play, then SNAP');
  };

  useEffect(() => {
    if (!game) return;
    crowd.start(0.22);
    lineUpNext(game);
    return () => crowd.stop(0.6);
  }, [game]);

  /** Line up another of the three cards (before the snap). */
  const pick = (i: number) => {
    if (!game || (ui !== 'pre' && ui !== 'fourth') || !opts[i]) return;
    sfx.click();
    setPicked(i);
    if (ui === 'fourth') setFourthPick('go');
    playRef.current = startChoice(game, opts[i].choice);
    if (flipped) flipPlay(playRef.current);
  };
  /** Every call in the book (the drills keep to their own kind). */
  const bookCalls = (g: Game): PlayChoice[] =>
    [
      ...CONCEPTS.map((concept) => ({ call: 'pass' as const, concept, run: g.run })),
      ...(['inside', 'power', 'outside'] as const).map((run) => ({ call: 'run' as const, concept: g.concept, run }))
    ].filter((c) => !practice || (practice.drill === 'run' ? c.call === 'run' : practice.drill === 'throw' ? c.call === 'pass' : false));
  const openBook = () => {
    if (!game || playRef.current?.phase !== 'pre') return;
    setBook(
      bookCalls(game).map((choice) => {
        const play = startChoice({ ...game }, choice);
        if (flipped) flipPlay(play);
        return { choice, play };
      })
    );
    sfx.click();
  };
  const chooseBook = (choice: PlayChoice) => {
    if (!game || playRef.current?.phase !== 'pre') return;
    const remaining = opts.filter((o) => o.choice.call !== choice.call || (choice.call === 'run' ? o.choice.run !== choice.run : o.choice.concept !== choice.concept));
    setOpts(
      [choice, ...remaining.map((o) => o.choice)].slice(0, 3).map((c) => {
        const play = startChoice({ ...game }, c);
        if (flipped) flipPlay(play);
        return { choice: c, play };
      })
    );
    playRef.current = startChoice(game, choice);
    if (flipped) flipPlay(playRef.current);
    setPicked(0);
    setBook(null);
    if (ui === 'fourth') setFourthPick('go');
    sfx.click();
  };
  const flipFormation = () => {
    const play = playRef.current;
    if (!play || !flipPlay(play)) return;
    const next = !flipped;
    setFlipped(next);
    setOpts((old) =>
      old.map((o) => {
        const diagram = startChoice({ ...game! }, o.choice);
        if (next) flipPlay(diagram);
        return { choice: o.choice, play: diagram };
      })
    );
    sfx.click();
  };
  const snapNow = () => {
    if (!game || (ui !== 'pre' && ui !== 'fourth') || game.clock === 0) return;
    const p = playRef.current;
    if (!p || p.phase !== 'pre') return;
    sfx.click();
    pilotRef.current.readAt = 0;
    // the throw type starts every snap at TOUCH (C cycles it)
    passTypeRef.current = 'touch';
    setPassType('touch');
    p.passType = 'touch';
    snap(p);
    setBook(null);
    lookRef.current = null;
    popShown.current = { done: false };
    setUi('live');
    setPhase(p.phase);
    moveOn('live:' + p.phase);
    if (p.call === 'pass') tip('pass', PASS_TIP);
    else tip('run', burstPrefRef.current ? 'Stick steers · hold D to burst' : 'Stick steers · past the ring to burst');
  };

  /** AUDIBLE (B before the snap): flip the call between its run and its pass. */
  const audible = () => {
    if (!game || (ui !== 'pre' && ui !== 'fourth') || playRef.current?.phase !== 'pre' || !opts[picked]) return;
    const cur = opts[picked].choice;
    const i = opts.findIndex((o) => o.choice.call !== cur.call);
    if (i >= 0) pick(i);
    else chooseBook(cur.call === 'pass' ? { call: 'run', concept: cur.concept, run: game.run } : { call: 'pass', concept: game.concept, run: cur.run });
  };

  /**
   * Report the play, then line up the next one `wait` seconds later. A `skip`pable wait (a score's
   * celebration) ends TAP_SKIP after a tap on the screen.
   */
  const nextUp = (g: Game, driveOver: boolean, wait: number, skip = false) => {
    onProgress(progress(g));
    later(wait, () => {
      if (g.over) {
        setUi('final');
        if (!counted.current) {
          counted.current = true;
          if (!practice) countGame();
        }
        onDone(progress(g));
        return;
      }
      // (lined up first: a new play clears the last one's toasts)
      lineUpNext(g);
      if (driveOver && g.clock !== null) {
        post({ text: 'TWO-MINUTE DRILL', sub: 'LAST DRIVE · ' + clockText(g.clock) + ' ON THE CLOCK', tone: 'big', prio: PRIO.big, ms: 1700, scope: 'time' });
        tip('clock', 'Out of bounds stops the clock', true);
      } else if (driveOver) post({ text: 'DRIVE ' + (g.drive + 1) + ' OF ' + g.drives, tone: 'plain', prio: PRIO.result, ms: 1100, scope: 'time' });
    }, skip);
  };
  /**
   * Wait `secs`, then run. A skippable wait (`skip`: true, or what a tap should do instead) ends
   * TAP_SKIP after the next tap on the screen (tapToSkip).
   */
  const later = (secs: number, run: () => void, skip: boolean | (() => void) = false) => {
    const timer = clock.after(secs * 1000, () => {
      skippable.current = null;
      run();
    });
    skippable.current = skip ? { timer, run: typeof skip === 'function' ? skip : run } : null;
  };
  /** A tap during a celebration or a replay's lead-in: on to the next play. */
  const tapToSkip = () => {
    const w = skippable.current;
    if (!w) return;
    skippable.current = null;
    clock.cancel(w.timer);
    clock.after(TAP_SKIP * 1000, w.run);
  };

  const handleEvents = (p: Play) => {
    // the play moved on (the throw, the catch, the whistle): the last moment's hint goes first
    if (!autoplayHook && toastQ.current.phase !== 'live:' + p.phase) moveOn('live:' + p.phase);
    // juice (render only): hit-stop, the camera's kick, sweat and sparks
    const J = fxRef.current.juice;
    const nowMs = clock.now();
    const at = (b: { x: number; y: number } | null | undefined, h = 1) => (b ? renderer.screenOf(b.x, b.y, h) : null);
    for (const e of p.events) {
      if (e === 'beat:truck') {
        J.hitStop('truck', nowMs);
        J.addTrauma(0.45);
        J.punch(0.03);
        const q = at(p.carrier, 1.2);
        if (q) J.burst('sweat', q.x, q.y, 10, ['#ffffff', '#d8f0ff'], { speed: 90, size: Math.max(1, q.s * 0.1) });
        if (p.carrier) J.kick(p.carrier.vx, -p.carrier.vy, 4);
      } else if (e === 'beat:stiff') {
        J.addTrauma(0.22);
        J.kick(0, -1, 2);
      } else if (e === 'bighit') {
        J.hitStop('bighit', nowMs);
        J.addTrauma(0.6);
        J.punch(0.04);
        const q = at(p.carrier, 1.2);
        if (q) J.burst('sweat', q.x, q.y, 14, ['#ffffff', '#d8f0ff'], { speed: 110, size: Math.max(1, q.s * 0.1) });
      } else if (e === 'int' || e === 'lane-int') {
        J.hitStop('int', nowMs);
        J.addTrauma(0.25);
        const q = renderer.screenOf(p.end?.x ?? 0, p.end?.y ?? 0, 1.5);
        if (q) J.burst('spark', q.x, q.y, 10, ['#ffe9a8', '#ffffff'], { speed: 80 });
      } else if (e === 'catch-contested') {
        J.addTrauma(0.16);
        J.punch(0.015);
      } else if (e === 'sack') {
        J.addTrauma(0.35);
        J.kick(0, 1, 3);
      } else if (e === 'tackle') J.addTrauma(0.08);
    }
    // the ability that changed the play, on the toast line: one a play (V-4)
    const ab = abilityToPop(p.events, popShown.current);
    if (ab) {
      const b = p.bodies[ab.body];
      post({ text: ABILITY_TEXT[ab.id] ?? ab.id.toUpperCase(), sub: b ? b.p.tag : undefined, tone: 'ability', prio: PRIO.ability, ms: 1300, key: 'ability', scope: 'play' });
    }
    for (const e of p.events) {
      if (e === 'snap') sfx.hit(0.15);
      else if (e === 'handoff') sfx.catch();
      else if (e === 'pancake') sfx.hit(0.6);
      else if (e === 'throw' || e === 'throw-pressure' || e === 'scramble') {
        sfx.whoosh();
        // the ball's away: the pocket's tip goes with its moment (hud.ts), the air's takes over
        if (e !== 'scramble') tip('air', AIR_TIP);
      } else if (e === 'catch') {
        sfx.catch();
        crowd.swell(0.3);
        tip('runafter', 'JUKE · SPIN · POWER on the right');
      } else if (e === 'catch-contested') {
        sfx.catch();
        crowd.swell(0.7);
        say('CONTESTED CATCH!', 'good', 900);
      } else if (e.startsWith('beat:')) {
        const kind = e.slice(5);
        if (kind === 'truck') {
          sfx.hit(1);
          sfx.thud(0.2);
        } else if (kind === 'stiff') sfx.hit(0.6);
        vibrate([20, 30, 20]);
        crowd.swell(0.8);
        shake(kind === 'truck' ? 4 : 2);
        if (kind === 'truck') slowUntil.current = clock.now() + SLOWMO.truck * 1000;
        say(kind === 'juke' ? 'JUKED!' : kind === 'spin' ? 'SPIN MOVE!' : kind === 'truck' ? 'TRUCKED!' : 'STIFF ARM!', 'big', 900);
      } else if (e === 'whiff') {
        sfx.whoosh();
        crowd.swell(0.4);
      } else if (e === 'break') {
        sfx.hit(0.4);
        crowd.swell(0.5);
        say('BROKE A TACKLE', 'good', 800);
      } else if (e === 'bighit') {
        // the hit lands in slow motion (its replay went: only touchdowns get one, V2 §B.2.7)
        slowUntil.current = clock.now() + SLOWMO.bighit * 1000;
        sfx.hit(1);
        sfx.thud(0.12);
        shake(6);
        vibrate([40, 30, 60]);
        crowd.swell(1);
        fxRef.current.flash = 0.35;
      } else if (e === 'tackle') sfx.tackle(0.5);
      else if (e === 'sack') {
        sfx.tackle(1);
        shake(4);
        vibrate(40);
      }
    }
    p.events.length = 0;
  };

  /** ' · TACKLED BY <name>' for a plain tackle: the defender nearest the spot who brought him down (V2 §B.2.7). */
  const tackledBy = (p: Play, e: NonNullable<Play['end']>): string => {
    if (e.kind !== 'tackle' || e.text !== 'TACKLED') return '';
    let by: Body | null = null;
    let bd = 3;
    for (const b of p.bodies) {
      if (b.side !== 'D' || (b.act !== 'tackle' && b.act !== 'windup')) continue;
      const d = Math.hypot(b.x - e.x, b.y - e.y);
      if (d < bd) {
        bd = d;
        by = b;
      }
    }
    return by ? ' · TACKLED BY ' + by.p.tag : '';
  };

  const finish = (p: Play) => {
    if (!game) return;
    const e = p.end!;
    dragRef.current = null;
    runKeys.current.clear();
    setPhase('dead');
    // the line to gain as it was, to flash it on a conversion
    const line = game.ballOn + game.toGo;
    const a = afterPlay(game, e);
    setLastReadout(footballFeedback(p, a));
    practice?.onAttempt({ points: a.points, success: practice.drill === 'run' ? e.gain >= 5 : e.caught, yards: Math.round(e.gain), detail: e.text });
    setUi('after');
    if (a.fire === 'lit') {
      setFire(true);
      sfx.levelUp();
      crowd.swell(0.8);
      vibrate([20, 20, 40]);
      tip('fire', 'ON FIRE · full arc, quicker throws', true);
    } else if (a.fire === 'out') setFire(false);
    const yds = Math.round(e.gain);
    const gain = (yds >= 0 ? '+' : '') + yds + ' YDS';
    if (a.points) {
      const c = p.carrier ?? p.catcher;
      if (c) {
        c.act = 'celebrate';
        c.actAt = p.t;
      }
      fxRef.current.flash = 0.5;
      sfx.touchdown();
      crowd.swell(1);
      vibrate([30, 40, 30]);
      say('TOUCHDOWN! +7', 'big', 2000, c ? c.p.tag + (yds >= 20 ? ' · ' + yds + ' YDS' : '') : undefined);
    } else if (a.driveOver === 'INT' || a.driveOver === 'FUM') {
      sfx.groan();
      vibrate(50);
      say(a.driveOver === 'INT' ? 'INTERCEPTED' : 'FUMBLE', 'bad', 1700, e.text);
    } else if (a.driveOver === 'SAF') {
      sfx.groan();
      vibrate(50);
      say('SAFETY', 'bad', 1700, 'TACKLED IN YOUR END ZONE');
    } else if (a.driveOver === 'TIME') {
      sfx.buzzer();
      say('TIME’S UP', 'bad', 1700, 'OUT OF FIELD GOAL RANGE');
    } else if (a.timeUp) {
      sfx.buzzer();
      // (it carries into the tray's header: the kick is all that's left)
      post({ text: 'TIME’S UP', sub: 'ONE LAST KICK · ' + fgDistance(game) + ' YARDS', tone: 'plain', prio: PRIO.big, ms: 3000, scope: 'time' });
    } else if (a.flag) {
      // a flag on the play (the play doesn't count): what it was, on whom, and where it leaves you
      sfx.whistle();
      vibrate(30);
      say(a.flag.by === 'D' ? 'FLAG · DEFENSE' : 'FLAG · OFFENSE', a.flag.by === 'D' ? 'good' : 'bad', 1700, a.text.replace(/^FLAG · /, ''));
    } else if (e.text.startsWith('BIG HIT')) {
      say('BIG HIT!', 'big', 1500, e.text.slice(4) + ' · ' + gain);
    } else if (a.driveOver === 'DOWNS') {
      sfx.groan(0.8);
      say('TURNOVER ON DOWNS', 'bad', 1600, e.kind === 'incomplete' ? e.text : gain);
    } else if (a.firstDown) {
      sfx.cheer(yds >= 20 ? 0.9 : 0.45);
      crowd.swell(yds >= 20 ? 0.9 : 0.45);
      if (line < 100) renderer.flashLine(line);
      say(yds >= 20 ? 'BIG PLAY · FIRST DOWN' : 'FIRST DOWN', yds >= 20 ? 'big' : 'good', 1300, gain + tackledBy(p, e));
    } else if (e.kind === 'incomplete') {
      sfx.groan(0.4);
      say(e.text, 'plain', 1100);
    } else if (e.kind === 'sack') say(e.text, 'bad', 1300, gain);
    else say(gain, yds > 0 ? 'good' : 'plain', 1100, e.kind === 'out' ? 'OUT OF BOUNDS' : tackledBy(p, e).slice(3) || undefined);
    if (a.points && yds >= LONG_TD_REPLAY.yards && !highlight.current) {
      const c = p.carrier ?? p.catcher;
      if (c) highlight.current = { t: p.t, x: c.x, y: c.y - 6, before: LONG_TD_REPLAY.before };
    }
    // the whistle: the play's dead (a touchdown has its horn)
    if (!a.points) clock.after(220, () => sfx.whistle());
    const hl = highlight.current;
    highlight.current = null;
    // (not the game's last play: it's reported done, and the results come next)
    if (hl && !game.over && (!autoplayHook || REPLAYS_IN_AUTOPLAY) && !reducedMotion()) {
      onProgress(progress(game));
      // a tap during the lead-in skips the replay as well
      later(REPLAY_LEAD.score, () => startReplay(hl, () => nextUp(game, !!a.driveOver, REPLAY_TAIL)), () => nextUp(game, !!a.driveOver, 0));
    } else nextUp(game, !!a.driveOver, a.points ? WHISTLE_TO_TRAY.score : a.driveOver ? WHISTLE_TO_TRAY.drive : a.firstDown ? WHISTLE_TO_TRAY.first : WHISTLE_TO_TRAY.play, !!a.points);
  };

  /** Play the highlight again, slower, from closer; then on with the drive. */
  const startReplay = (hl: { t: number; x: number; y: number; before: number }, done: () => void) => {
    const frames = rec.current.clip(hl.t - hl.before, hl.t + REPLAY_AFTER);
    if (frames.length < 10) {
      done();
      return;
    }
    replayRef.current = { frames, t0: frames[0].t, t1: frames[frames.length - 1].t, start: clock.now(), speed: REPLAY_SPEED, focus: { a: hl.x, b: hl.y }, done };
    renderer.replay = { x: hl.x, y: hl.y };
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

  // fourth down: the field goal unit lines up, the meter decides it, the ball flies at the posts
  const kickAnim = useRef<{ good: boolean; at: number } | null>(null);
  const startKick = () => {
    if (!game || ui !== 'fourth') return;
    sfx.click();
    playRef.current = fieldGoalUnit(game);
    kickRef.current = { t0: clock.now(), stopped: null, dist: fgDistance(game), win: kickWindow(game) };
    setUi('kick');
  };
  const kickNow = () => {
    const k = kickRef.current;
    const p = playRef.current;
    if (!game || !p || !k || k.stopped !== null) return;
    const ph = ((clock.now() - k.t0) / 1100) % 2;
    const pos = ph < 1 ? ph : 2 - ph;
    k.stopped = pos;
    setTick((n) => n + 1);
    // the same test kick() makes; the drive itself is settled when the ball reaches the posts
    const aim = Math.abs(pos - 0.5) * 2;
    const good = aim <= kickWindow(game) && fgInRange(game);
    // the kick: the leg swings, the ball's away a beat later; wide by the side the needle missed on
    const kicker = p.rb;
    kicker.act = 'kick';
    kicker.actAt = p.t;
    const from = { x: p.bx, y: p.los - 7 };
    const side = pos < 0.5 ? -1 : 1;
    const toX = FIELD_W / 2 + (good ? side * Math.random() * 1.6 : side * (4.2 + Math.random() * 2.5));
    // aimed long, so it's still climbing over the crossbar; it disappears into the stands
    const to = { x: from.x + (toX - from.x) * ((150 - from.y) / (110 - from.y)), y: 150 };
    const t0 = p.t + 0.22;
    const t1 = t0 + 1.25 + (150 - from.y) * 0.004;
    p.ball = { from, to, t0, t1, peak: 7 + (110 - from.y) * 0.04 };
    p.carrier = null;
    p.phase = 'air';
    kickAnim.current = { good, at: t0 + ((110 - from.y) / (150 - from.y)) * (t1 - t0) };
    sfx.kick(0.22);
    clock.after(450, () => setUi('after'));
    clock.after(KICK_RESULT * 1000, () => {
      kick(game, aim);
      practice?.onAttempt({ points: good ? 3 : 0, success: good, detail: (good ? 'GOOD FROM ' : 'WIDE FROM ') + k.dist + ' YARDS' });
      if (good) {
        sfx.cheer(1);
        crowd.swell(0.9);
        say('IT’S GOOD! +3', 'good', 1600, k.dist + ' YARDS');
      } else {
        sfx.groan(1);
        say('NO GOOD', 'bad', 1500, side < 0 ? 'WIDE LEFT' : 'WIDE RIGHT');
      }
      nextUp(game, true, KICK_TO_TRAY);
    });
    clock.after(2650, () => {
      kickRef.current = null;
      kickAnim.current = null;
      // the kick play is over: nothing steps it again (the game may be over and keep showing it)
      p.phase = 'dead';
    });
  };
  const puntNow = () => {
    if (!game || ui !== 'fourth' || game.clock === 0) return;
    sfx.kick();
    punt(game);
    say('PUNT', 'plain', 1100, 'DRIVE OVER');
    setUi('after');
    nextUp(game, true, PUNT_TO_TRAY);
  };

  // the autopilot calls the plays in tests
  useEffect(() => {
    if (!autoplayHook || !game) return;
    const t = clock.after(
      (ui === 'kick' ? AUTO_KICK_AIM : AUTO_PICK) * 1000,
      () => {
        if (ui === 'pre') {
          const i = pilotRef.current.rand() < 0.3 ? 2 : pilotRef.current.rand() < 0.5 ? 1 : 0;
          if (opts[i]) playRef.current = startChoice(game, opts[i].choice);
          snapNow();
        } else if (ui === 'fourth') {
          const d = fourthDown(game);
          if (practice?.drill === 'kick' || d === 'kick') startKick();
          else if (d === 'punt') puntNow();
          else snapNow();
        } else if (ui === 'kick') kickNow();
      }
    );
    return () => clock.cancel(t);
  }, [ui, autoplayHook, game]);

  /** The slingshot's landing spot right now: pulled back, it flies the other way. */
  const aimNow = (p: Play): Pt | null => {
    const d = dragRef.current;
    const wrap = wrapRef.current;
    if (!d || !wrap || p.phase !== 'drop' || p.carrier !== p.qb) return null;
    const len = Math.hypot(d.dx, d.dy);
    if (len < 16) return null;
    const max = maxThrow(p);
    const per = max / (Math.min(wrap.clientWidth, wrap.clientHeight) * 0.62);
    const v = renderer.mode === 'side' ? { x: d.dy, y: -d.dx } : { x: -d.dx, y: d.dy };
    let k = per;
    if (len * per > max) k = max / len;
    return { x: p.qb.x + v.x * k, y: p.qb.y + v.y * k };
  };

  /**
   * Both screen axes reach the simulation. A touched stick is direct control (centred or let go, it
   * stops the runner); a new carrier the player hasn't touched the stick for runs on his momentum.
   */
  const steerNow = (p: Play): RunInput => {
    const vec = stickRef.current?.read().vec ?? null;
    const keys = runKeys.current;
    let field: Pt | null = null;
    if (vec) field = fieldOf(vec, renderer.mode);
    else if (keys.size) {
      const x = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
      const y = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
      field = screenRunInput(x, y, renderer.mode);
    }
    const carrier = p.phase === 'run' ? p.carrier : null;
    return gate.current.input(carrier ? carrier.id : null, p.call === 'run' && carrier === p.rb, field);
  };

  // the loop: fixed steps for the play, a draw every frame
  useEffect(() => {
    if (!game) return;
    let raf = 0;
    let last = clock.now();
    let acc = 0;
    let geomKey = '';
    let insetTick = 0;
    let lastW = -1;
    let lastH = -1;
    let burstShown = false;
    const loop = () => {
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
        canvas.style.width = renderer.W * renderer.zoom + 'px';
        canvas.style.height = renderer.H * renderer.zoom + 'px';
        setWide(w > h);
      }
      // the control geometry (C15) for this screen and its insets (read when the size changes, and
      // about once a second in case the insets alone did: a style read every frame costs a layout)
      if (++insetTick >= 60 || w !== lastW || h !== lastH) {
        insetTick = 0;
        lastW = w;
        lastH = h;
        const ins = readInsets(probeRef.current);
        const key = [w, h, ins.top, ins.right, ins.bottom, ins.left].join(',');
        frameRef.current.reduced = reducedMotion();
        if (key !== geomKey) {
          geomKey = key;
          const gm = controlGeometry(w, h, ins);
          const n = (k: string) => parseFloat(gm[k]) || 0;
          // the tray: 124 px on the 393 column, 112 on the 320 one (by the bug's own blend)
          const trayH = Math.round(Math.max(112, Math.min(124, 112 + ((n('--bug-w') - 200) / 32) * 12)));
          frameRef.current.safe = w > h ? null : { top: n('--safe-top'), bottom: h - n('--safe-bottom') };
          // the receivers' chips stay between the Heat bar and the toast line
          // (sideways the toast sits under the Heat bar and the cluster owns the lower right: the chips keep above D)
          const below = n('--bug-top') + n('--bug-h') + n('--heat-h');
          frameRef.current.chips = w > h ? { top: below + 10 + 28 + 6, bottom: h - n('--ctl-d-bottom') - n('--ctl-d-d') / 2 - 6 } : { top: below + 8, bottom: h - n('--toast-bottom') - 28 - 6 };
          setGeom({ ...gm, '--tray-h': trayH + 'px', '--sat': ins.top + 'px', '--sar': ins.right + 'px', '--sab': ins.bottom + 'px', '--sal': ins.left + 'px' });
        }
      }
      // paused: the clock stands still and so does everything on it (the frame stays as it was)
      if (pausedRef.current) return;
      const now = clock.now();
      const p = playRef.current;
      const fx = fxRef.current;
      const elapsed = Math.min(0.1, (now - last) / 1000) * timeScale;
      last = now;
      if (!autoplayHook) applyGestures(gestures.current.tick(performance.now()));
      // slow motion and hit-stop only hold back real time: the same fixed steps run, a beat later
      fx.juice.update(elapsed);
      acc += fx.juice.gameTime(now, now < slowUntil.current ? elapsed * SLOWMO_RATE : elapsed);
      if (p && p.end) {
        // after the whistle: the hit lands, the tackled man slides, the pile settles
        const vis = fx.juice.gameTime(now, now < slowUntil.current ? elapsed * SLOWMO_RATE : elapsed);
        p.t += vis;
        for (const b of p.bodies) {
          if (Math.abs(b.vx) + Math.abs(b.vy) < 0.05) continue;
          b.x += b.vx * vis;
          b.y += b.vy * vis;
          b.vx *= Math.pow(0.08, vis);
          b.vy *= Math.pow(0.08, vis);
        }
        acc = 0;
      } else if (p && kickAnim.current) {
        p.t += elapsed;
        // the ball disappears into the stands (left in the air it would read as a man by the posts)
        if (p.ball && p.t > p.ball.t0) {
          const k = (p.t - p.ball.t0) / (p.ball.t1 - p.ball.t0);
          if (k >= 1 || p.ball.from.y + (p.ball.to.y - p.ball.from.y) * k > 117) p.ball = null;
        }
        acc = 0;
      } else if (p && p.phase !== 'pre' && !p.end) {
        while (acc >= DT) {
          acc -= DT;
          const was: Play['phase'] = p.phase;
          const steer = autoplayHook ? decide(p, game, pilotRef.current) : steerNow(p);
          // burst: past the stick's ring, or D held with the Burst-button preference (one source counts)
          if (!autoplayHook) {
            const held = burstHeld({ ring: !!stickRef.current?.read().sprint, button: burstButton.current, buttonPref: burstPrefRef.current });
            const on = setBurst(p, held);
            if (on !== burstShown) setBursting((burstShown = on));
          }
          step(p, DT, steer);
          handleEvents(p);
          if (p.phase !== was) setPhase(p.phase);
          if (p.end) {
            finish(p);
            break;
          }
        }
      } else acc = 0;
      if (p && p.phase !== 'pre' && !replayRef.current) rec.current.push(p.t, snapOf(p));
      const ck = clockRef.current;
      if (game.clock !== null && ck) {
        const want = Math.max(0, game.clock - (p && !p.end && p.phase !== 'pre' && !kickRef.current ? p.t : 0));
        const was = shownClock.current;
        const shown = was === null || want > was ? want : Math.max(want, was - 14 * elapsed);
        shownClock.current = shown;
        ck.textContent = clockText(shown);
        ck.classList.toggle('low', shown < 30);
      } else shownClock.current = null;
      fx.shake = Math.max(0, fx.shake - elapsed * 14);
      fx.flash = Math.max(0, fx.flash - elapsed * 1.8);
      // (the context is the canvas's own for its lifetime: read it once)
      const ctx = (ctx2d.current ??= canvas.getContext('2d'));
      if (!ctx) return;
      const rp = replayRef.current;
      // a frame that can't be drawn (a phone short of memory) mustn't stop the game: let go of the
      // old drawings and carry on
      try {
        if (rp && p) {
          const rt = replayTime(rp, now);
          const sn = rt === null ? null : frameAt(rp.frames, rt);
          if (rt === null || !sn) endReplay();
          else {
            const at = (b: Body) => sn.bodies[b.id];
            const view: Play = {
              ...p,
              t: rt,
              bodies: sn.bodies,
              qb: at(p.qb),
              rb: at(p.rb),
              carrier: sn.carrier !== null ? sn.bodies[sn.carrier] : null,
              ball: sn.ball,
              phase: sn.phase
            };
            renderer.draw(ctx, view, p.los, { aim: null, toGain: null, routes: false, open: false, shake: 0, flash: 0, frame: { safe: null, reduced: frameRef.current.reduced } });
          }
        } else if (p)
          renderer.draw(ctx, p, p.los, {
            aim: aimNow(p),
            toGain: kickRef.current || p.end || game.ballOn + game.toGo > 100 ? null : p.los + game.toGo,
            routes: p.phase === 'pre' && p.call === 'pass',
            open: openRings && !autoplayHook,
            shake: fx.shake,
            flash: fx.flash,
            juice: fx.juice,
            chips: !autoplayHook,
            frame: { safe: frameRef.current.safe, reduced: frameRef.current.reduced, look: lookRef.current }
          });
        if (p && !autoplayHook) frameControls(p);
        // the first frame is on the screen: the shell's curtain can lift (C11)
        if (p && !drawn.current) {
          drawn.current = true;
          window.dispatchEvent(new Event('ps:arena-ready'));
        }
      } catch (e) {
        console.error('[draw]', e);
        logError('football draw', e);
        renderer.dispose();
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  // ---- touch: slingshot passing, then direct two-axis running; skills stay on their buttons ----
  const move3 = (p: Play, kind: 'juke' | 'spin' | 'power', dir = 0) => {
    const c = p.carrier;
    if (!c || p.phase !== 'run') return;
    // POWER: a truck or a stiff arm, whichever beats the nearest man (by the same ratings the
    // tackle reads: trucking and weight against hit power, the stiff arm against tackling)
    if (kind === 'power') {
      const near = p.bodies.filter((b) => b.side === 'D').sort((a, b) => dist(a, c) - dist(b, c))[0];
      moveWithBall(p, near ? (moveEdge('truck', c, near) >= moveEdge('stiff', c, near) ? 'truck' : 'stiff') : (c.p.a.TRK ?? 50) >= (c.p.a.SFA ?? 50) ? 'truck' : 'stiff');
    } else moveWithBall(p, kind, dir);
    tapHaptic(10);
  };
  /** A juke toward a field side (-1 left, 1 right), or 0 to cut away from the nearest man. */
  const juke = (dir: -1 | 0 | 1) => {
    const p = playRef.current;
    if (p) move3(p, 'juke', dir);
  };
  /** The stick's side across the field, if it's pushed clearly one way (a juke goes that way). */
  const stickSide = (): -1 | 0 | 1 => {
    const v = stickRef.current?.read().vec;
    if (!v) return 0;
    const f = fieldOf(v, renderer.mode);
    return Math.abs(f.x) >= 0.25 ? (f.x < 0 ? -1 : 1) : 0;
  };
  /** A sideways swipe as a side across the field (upright, the screen's across is the field's; held
   * sideways the field runs across the screen, so a swipe there just cuts away from the nearest man). */
  const screenSide = (dir: -1 | 1): -1 | 0 | 1 => (renderer.mode === 'end' ? dir : 0);
  const cycleType = () => {
    const next = nextPassType(passTypeRef.current);
    passTypeRef.current = next;
    setPassType(next);
    if (playRef.current) playRef.current.passType = next;
    tapHaptic(8);
  };
  const throwIcon = (id: number) => {
    const p = playRef.current;
    if (!p || gestureState(uiRef.current, p) !== 'pocket') return;
    p.passType = passTypeRef.current;
    if (throwToReceiver(p, id)) {
      tapHaptic(10);
      dragRef.current = null;
      setPhase(p.phase);
    }
  };
  /** Act on what the touches turned into (gestures.ts). Reads refs only: the frame loop calls it too. */
  const applyGestures = (out: Gesture[]) => {
    for (const g of out) {
      const p = playRef.current;
      if (g.kind === 'stick-down') {
        runKeys.current.clear();
        // a thumb that lands while the ball is in the air is for the catch: it steers him at once
        gate.current.touch(p?.phase === 'air');
      } else if (g.kind === 'sling-start') dragRef.current = { id: g.id, x0: g.x0, y0: g.y0, dx: 0, dy: 0 };
      else if (g.kind === 'sling-release') {
        const aim = p ? aimNow(p) : null;
        dragRef.current = null;
        if (p && aim) {
          p.passType = passTypeRef.current;
          if (throwTo(p, aim)) {
            tapHaptic(10);
            setPhase(p.phase);
          }
        }
      } else if (g.kind === 'sling-cancel') dragRef.current = null;
      else if (g.kind === 'icon-throw') throwIcon(g.icon);
      else if (g.kind === 'cycle') cycleType();
      else if (g.kind === 'cover') {
        if (p) coverBall(p, g.on);
      } else if (g.kind === 'swipe') juke(screenSide(g.dir));
      else if (g.kind === 'a-tap') juke(0);
      else if (g.kind === 'look') {
        // drag the field to look around before the snap: the tray gets out of the way
        const wrap = wrapRef.current;
        const ypx = FRAME.scale * (wrap?.clientWidth ?? innerWidth);
        if (!lookRef.current) setTrayDown(true);
        const base = lookFrom.current;
        lookRef.current = { x: base.x - g.dx / ypx, y: base.y + g.dy / (ypx * 1.1) };
      } else if (g.kind === 'look-end') lookFrom.current = lookRef.current ?? { x: 0, y: 0 };
    }
  };
  const ctxNow = () => ({ w: wrapRef.current?.clientWidth ?? innerWidth, state: gestureState(uiRef.current, playRef.current), zone: stickZone(wrapRef.current?.clientWidth ?? innerWidth, wrapRef.current?.clientHeight ?? innerHeight) });
  const down = (e: React.PointerEvent) => {
    if (autoplayHook || pausedRef.current) return;
    playtime.input();
    // a tap during a celebration or a replay's lead-in: on to the next play
    if (uiRef.current === 'after') tapToSkip();
    const p = playRef.current;
    const ctx = ctxNow();
    let icon: number | null = null;
    if (ctx.state === 'pocket' && p) {
      const hits = iconsRef.current?.hits(e.clientX, e.clientY) ?? [];
      // two chips' touch areas overlap here: fan them out and throw to nobody
      if (hits.length > 1) {
        iconsRef.current?.fan(clock.now());
        haptic('tick');
        return;
      }
      icon = hits[0] ?? null;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    applyGestures(gestures.current.down({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, icon }, ctx));
  };
  const move = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d && d.id === e.pointerId) {
      d.dx = e.clientX - d.x0;
      d.dy = e.clientY - d.y0;
    }
    applyGestures(gestures.current.move(e.pointerId, e.clientX, e.clientY, e.timeStamp));
  };
  const up = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d && d.id === e.pointerId) {
      d.dx = e.clientX - d.x0;
      d.dy = e.clientY - d.y0;
    }
    applyGestures(gestures.current.up(e.pointerId, e.clientX, e.clientY, e.timeStamp));
  };
  /** The touch taken away (a system swipe from an edge, a call): let go of it, throw nothing. */
  const cancel = (e: React.PointerEvent) => applyGestures(gestures.current.cancel(e.pointerId));
  const keyRun = (e: React.KeyboardEvent, held: boolean) => {
    const key = e.key.toLowerCase();
    if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) return;
    e.preventDefault();
    if (held) playtime.input();
    if (held && !e.repeat) gate.current.touch(playRef.current?.phase === 'air');
    if (held) runKeys.current.add(key);
    else runKeys.current.delete(key);
  };
  /** Let go of every touch, key and hold (an interruption, a pause). */
  const letGo = () => {
    dragRef.current = null;
    stickRef.current?.release();
    applyGestures(gestures.current.clear());
    runKeys.current.clear();
    burstButton.current = false;
    stopBurst();
  };
  useInputInterrupt(letGo);
  const stopBurst = () => {
    burstPointer.current = null;
    burstButton.current = false;
    if (playRef.current) setBurst(playRef.current, false);
    setBursting(false);
  };
  const doScramble = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const p = playRef.current;
    if (p && scramble(p)) {
      dragRef.current = null;
      setPhase(p.phase);
    }
  };
  const doThrowAway = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const p = playRef.current;
    if (p && throwAway(p)) {
      tapHaptic(10);
      dragRef.current = null;
      setPhase(p.phase);
    }
  };

  /**
   * Once a frame (live, not autoplay): the chips over the receivers and the reticle, what A and D
   * say (THROW AWAY outside the tackle box; DIVE near the sticks or the goal line, SLIDE for a
   * quarterback past the line). React state changes only when a label does.
   */
  const frameControls = (p: Play) => {
    const g0 = game;
    const st = gestureState(uiRef.current, p);
    const pocket = st === 'pocket';
    let pick: number | null = null;
    let reticle: { x: number; y: number; rx: number; ry: number } | null = null;
    if (pocket) {
      // the most open receiver: the reticle shows where a tap on him lands
      let best = -1;
      for (const b of p.bodies) {
        if (b.side !== 'O' || b === p.qb || isLine(b)) continue;
        let open = 99;
        for (const d of p.bodies) if (d.side === 'D' && d.job !== 'rush') open = Math.min(open, dist(d, b));
        if (open > best) {
          best = open;
          pick = b.id;
        }
      }
      if (pick !== null && !dragRef.current) {
        const at = receiverLead(p, p.bodies[pick], passTypeRef.current);
        const q = renderer.screenOf(at.x, at.y);
        if (q) reticle = { x: q.x, y: q.y, rx: Math.max(12, q.s * 1.1), ry: Math.max(6, q.s * 0.5) };
      }
    }
    iconsRef.current?.place({ heads: pocket ? renderer.heads : {}, pick, reticle, now: clock.now(), bounds: frameRef.current.chips });
    const away = pocket && outsideBox(p);
    let dm: 'dive' | 'slide' | null = null;
    const c = p.carrier;
    if (st === 'carrier' && p.phase === 'run' && c && !p.down && g0) {
      if (c === p.qb && c.y > p.los) dm = 'slide';
      else {
        const line = g0.ballOn + g0.toGo;
        if ((line - c.y > 0 && line - c.y <= 3) || (100 - c.y > 0 && 100 - c.y <= 3)) dm = 'dive';
      }
    }
    if (away !== live.current.aAway) setAAway((live.current.aAway = away));
    if (dm !== live.current.dMode) setDMode((live.current.dMode = dm));
  };

  // ---- pause: the button, the menu, and an automatic pause when the page is hidden ----
  const canPause = !autoplayHook && !practice && (ui === 'pre' || ui === 'fourth' || ui === 'live' || ui === 'after' || ui === 'kick');
  const canPauseRef = useRef(canPause);
  canPauseRef.current = canPause;
  const pause = () => {
    if (pausedRef.current || !canPauseRef.current) return;
    if (!clock.pause()) return;
    pausedRef.current = true;
    letGo();
    playtime.pause(true);
    crowd.stop(0.3);
    setPaused(true);
  };
  const resume = () => {
    if (!pausedRef.current) return;
    clock.resume();
    pausedRef.current = false;
    playtime.pause(false);
    crowd.start(0.22);
    setPaused(false);
  };
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    const gone = () => pause();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', gone);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', gone);
    };
  }, []);
  const quit = () => {
    if (!game || !onQuit) return;
    playtime.abandon(clock.now() - startedAt.current);
    clock.dispose();
    onQuit(progress(game));
  };
  const setBurstLayout = (on: boolean) => {
    writePref(BURST_BUTTON, on);
    setBurstPref(on);
  };

  const g = game;
  const p = playRef.current;
  const fgOk = g ? fgInRange(g) : false;
  const passing = ui === 'live' && phase === 'drop' && p?.call === 'pass';
  const running = ui === 'live' && phase === 'run';
  const rushing = running || (ui === 'live' && phase === 'drop' && p?.call === 'run');
  const steering = rushing || (ui === 'live' && phase === 'air');
  const calling = (ui === 'pre' || ui === 'fourth') && !!g && !!p;
  const canCall = calling && g!.clock !== 0 && practice?.drill !== 'kick';
  const receivers = useMemo(() => (p ? p.bodies.filter((b) => b.side === 'O' && b !== p.qb && !isLine(b)) : []), [p]);
  const trayUp = calling && !autoplayHook;
  // the tray's strip: the three suggested cards, then the rest of the book after the seam
  const tray = useMemo(() => {
    if (!g || !trayUp) return { suggested: [] as TrayEntry[], rest: [] as TrayEntry[] };
    const taken = new Set(opts.map((o) => keyOf(o.choice)));
    const rest = bookCalls(g)
      .filter((c) => !taken.has(keyOf(c)))
      .map((choice) => {
        const play = startChoice({ ...g }, choice);
        if (flipped) flipPlay(play);
        return { choice, play };
      });
    // fourth down shows only the picked play up front: the other two suggestions lead the book
    const others = ui === 'fourth' ? opts.filter((_, i) => i !== picked) : [];
    return { suggested: opts, rest: [...others, ...rest] };
  }, [opts, flipped, trayUp, ui, picked]);
  const fourth: Fourth | null = ui === 'fourth' && g ? { pick: fourthPick, fg: { ok: fgOk, yards: fgDistance(g) }, punt: canCall, kickOnly: !canCall } : null;
  const bug = g ? bugModel(g, downText(g)) : null;
  useEffect(() => {
    if (!rushing) stopBurst();
  }, [rushing]);
  /** A, B, C or D: fires on touch-down; Enter or Space for a keyboard. */
  const ctl = (slot: 'a' | 'b' | 'c' | 'd', label: React.ReactNode, act: (e: React.PointerEvent | React.KeyboardEvent) => void, opts: { cls?: string; aria: string; icon?: React.ReactNode; small?: string; pressed?: boolean; extra?: Partial<React.ButtonHTMLAttributes<HTMLButtonElement>> } = { aria: '' }) => (
    <button
      type="button"
      className={'fb2-ctl ' + slot + (opts.cls ? ' ' + opts.cls : '')}
      data-ctl={slot.toUpperCase()}
      aria-label={opts.aria}
      aria-pressed={opts.pressed}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pausedRef.current) return;
        playtime.input();
        act(e);
      }}
      onKeyDown={(e) => {
        if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          playtime.input();
          act(e);
        }
      }}
      {...opts.extra}
    >
      {opts.icon}
      {slot === 'a' || slot === 'b' ? label : <em>{label}</em>}
      {opts.small && <small>{opts.small}</small>}
    </button>
  );
  return createPortal(
    <div
      className={'arcade-full hg2 fb2' + (wide ? ' wide' : '')}
      ref={wrapRef}
      style={geom as React.CSSProperties}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    >
      <canvas ref={canvasRef} className="hg2-canvas" />
      {g && (
        <ScoreBug
          us={g.score}
          them={rival ? rival.score : 0}
          themBlank={!rival}
          usName="YOU"
          themName={(rival?.name ?? rivalName).toUpperCase().slice(0, 6)}
          label={bug!.label}
          sub={bug!.sub || undefined}
          clock={g.clock !== null && !g.over ? clockText(g.clock) : undefined}
          clockRef={clockRef}
          pips={bug!.pips}
          progress={bug!.progress}
          heatUs={fire ? 100 : Math.round(100 * Math.min(1, g.streak / fireAtFor(g)))}
          heatThem={0}
          fireUs={fire}
          fireThem={false}
        />
      )}
      {!trayUp && !autoplayHook && <ToastLine toast={toast} />}
      {replaying && (
        <button className="replay-banner" onPointerDown={(e) => (e.stopPropagation(), endReplay())} aria-label="Instant replay: tap to skip">
          <i />
          REPLAY
          <small>TAP TO SKIP</small>
        </button>
      )}
      {ui === 'loading' && <div className="fg-loading">Taking the field…</div>}
      {g && !autoplayHook && (
        <Stick
          ref={stickRef}
          active={!paused && (calling || ui === 'live')}
          quiet={!steering && !passing}
          ghost={phase === 'air' && ui === 'live'}
          label={phase === 'air' && ui === 'live' ? 'HOLD TO RUN' : undefined}
          onDown={(e) => {
            playtime.input();
            applyGestures(gestures.current.down({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp }, ctxNow()));
          }}
          onMove={(_, sprint) => {
            // the ring takes effect at the touch, not at the next fixed step
            const live = playRef.current;
            if (live && !burstPrefRef.current && !autoplayHook) setBurst(live, sprint);
          }}
          onUp={(e) => e && applyGestures(gestures.current.up(e.pointerId, e.clientX, e.clientY, e.timeStamp))}
          onKeyDown={(e) => keyRun(e, true)}
          onKeyUp={(e) => keyRun(e, false)}
        />
      )}
      {passing && !autoplayHook && <ReceiverIcons ref={iconsRef} receivers={receivers} show={passing} onThrow={throwIcon} />}
      {trayUp && g && (
        <PlayTray
          suggested={tray.suggested}
          book={tray.rest}
          picked={opts[picked] ? keyOf(opts[picked].choice) : null}
          fourth={fourth}
          down={downText(g) + ' · ' + spotText(g.ballOn)}
          notice={toast}
          last={lastReadout}
          flipped={flipped}
          collapsed={trayDown}
          onPick={pick}
          onBook={chooseBook}
          onFourth={(k) => {
            if (k === 'fg' && !fgOk) return;
            sfx.click();
            setFourthPick(k);
          }}
          onFlip={flipFormation}
          onPlaybook={openBook}
          onExpand={() => {
            lookRef.current = null;
            lookFrom.current = { x: 0, y: 0 };
            setTrayDown(false);
          }}
          onInput={playtime.input}
        />
      )}
      {book && (ui === 'pre' || ui === 'fourth') && (
        <PlaybookDialog onClose={() => setBook(null)}>
          <header>
            <span>
              <small>YOUR OFFENSE. YOUR CALL.</small>
              <b>THE PLAYBOOK</b>
            </span>
            <button autoFocus onClick={() => setBook(null)} aria-label="Close playbook">
              ×
            </button>
          </header>
          <p>Pick your concept. Flip the formation before the snap to attack either side.</p>
          <div className="fb2-book-grid">
            {book.map((o) => (
              <button
                className={'fb2-card ' + o.choice.call}
                key={o.choice.call + ':' + (o.choice.call === 'pass' ? o.choice.concept : o.choice.run)}
                onClick={() => chooseBook(o.choice)}
              >
                <PlayArt play={o.play} />
                <small>{kindOf(o.choice)}</small>
                <b>{nameOf(o.choice)}</b>
              </button>
            ))}
          </div>
        </PlaybookDialog>
      )}
      {!autoplayHook && !paused && (
        <>
          {/* A: the timed thing, always in the same place */}
          {calling && ui === 'pre' && canCall && ctl('a', 'SNAP', () => snapNow(), { aria: 'SNAP', icon: ICONS.snap })}
          {/* fourth down: A does what the tray's pick says */}
          {ui === 'fourth' && fourth && (fourth.pick === 'fg' ? fgOk : canCall) &&
            ctl('a', fourth.pick === 'fg' ? 'KICK' : fourth.pick === 'punt' ? 'PUNT' : 'GO', () => (fourth.pick === 'fg' ? startKick() : fourth.pick === 'punt' ? puntNow() : snapNow()), {
              cls: fourth.pick === 'go' ? undefined : 'kick',
              aria: fourth.pick === 'fg' ? 'Kick the ' + fourth.fg.yards + ' yard field goal' : fourth.pick === 'punt' ? 'Punt' : 'Go for it',
              icon: fourth.pick === 'fg' ? ICONS.kick : fourth.pick === 'punt' ? ICONS.punt : ICONS.snap,
              small: fourth.pick === 'go' ? 'FOR IT' : undefined
            })}
          {passing && (aAway ? ctl('a', 'AWAY', doThrowAway, { cls: 'away', aria: 'Throw it away out of bounds', icon: ICONS.away, small: 'THROW' }) : ctl('a', 'RUN IT', doScramble, { aria: 'Run it: the quarterback tucks it and runs', icon: ICONS.run }))}
          {running &&
            ctl(
              'a',
              'JUKE',
              (e) => {
                // toward the stick's side; with the stick centred, a swipe off A picks the side (or he cuts away on lift)
                const side = stickSide();
                if (side || !('pointerId' in e)) juke(side);
                else {
                  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                  applyGestures(gestures.current.down({ id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, ctl: 'A' }, ctxNow(), { pendingA: true }));
                }
              },
              {
                aria: 'Juke toward the stick, or swipe left or right off this button',
                icon: ICONS.juke,
                extra: {
                  onPointerMove: (e) => applyGestures(gestures.current.move(e.pointerId, e.clientX, e.clientY, e.timeStamp)),
                  onPointerUp: (e) => applyGestures(gestures.current.up(e.pointerId, e.clientX, e.clientY, e.timeStamp)),
                  onPointerCancel: (e) => applyGestures(gestures.current.cancel(e.pointerId))
                }
              }
            )}
          {/* B */}
          {calling && canCall && ctl('b', 'AUDIBLE', audible, { aria: 'Audible: switch the call between run and pass', icon: ICONS.audible })}
          {running && ctl('b', 'SPIN', () => p && move3(p, 'spin'), { aria: 'Spin: evade a tackle', icon: ICONS.spin })}
          {/* C */}
          {passing && ctl('c', passType.toUpperCase(), cycleType, { cls: 'chip', aria: 'Throw type: ' + passType + '. Tap for the next (touch, bullet, lob)', icon: ICONS[passType], extra: { 'data-type': passType } as Partial<React.ButtonHTMLAttributes<HTMLButtonElement>> })}
          {running && ctl('c', 'POWER', () => p && move3(p, 'power'), { aria: 'Power: a truck or a stiff arm', icon: ICONS.power })}
          {/* D */}
          {running && dMode && ctl('d', dMode === 'slide' ? 'SLIDE' : 'DIVE', () => {
              const live = playRef.current;
              if (live && giveUp(live, dMode)) tapHaptic(12);
            }, { aria: dMode === 'slide' ? 'Slide: the quarterback gives himself up' : 'Dive forward for the line', icon: ICONS.dive })}
          {rushing && burstPref && !(running && dMode) &&
            ctl(
              'd',
              'BURST',
              (e) => {
                burstButton.current = true;
                burstPointer.current = 'pointerId' in e ? e.pointerId : 'keyboard';
                if ('pointerId' in e) (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              },
              {
                cls: 'burst' + (bursting ? ' held' : ''),
                aria: 'Burst: hold to sprint',
                icon: ICONS.burst,
                pressed: bursting,
                extra: {
                  onPointerUp: (e) => burstPointer.current === e.pointerId && stopBurst(),
                  onPointerCancel: (e) => burstPointer.current === e.pointerId && stopBurst(),
                  onLostPointerCapture: (e) => burstPointer.current === e.pointerId && stopBurst(),
                  onKeyUp: (e) => (e.key === ' ' || e.key === 'Enter') && burstPointer.current === 'keyboard' && stopBurst(),
                  onBlur: stopBurst
                }
              }
            )}
        </>
      )}
      {canPause && !replaying && !paused && <PauseButton onPause={pause} />}
      {paused && (
        <PauseMenu
          online={online}
          burstButton={burstPref}
          onBurstButton={setBurstLayout}
          feedback={feedback}
          onFeedback={
            onFeedback &&
            ((key, on) => {
              const next = { sound: feedback?.sound ?? true, haptics: feedback?.haptics ?? true, [key]: on };
              setFeedback(next.sound, next.haptics);
              onFeedback(key, on);
            })
          }
          quitText={quitText}
          onQuit={onQuit && !online ? quit : undefined}
          onResume={resume}
        />
      )}
      <div ref={probeRef} className="fb2-inset-probe" aria-hidden="true" />
      {ui === 'kick' && kickRef.current && (
        <KickMeter window={kickRef.current.win} start={kickRef.current.t0} stopped={kickRef.current.stopped} distance={kickRef.current.dist} now={() => clock.now()} paused={paused} onKick={() => (playtime.input(), kickNow())} />
      )}
      {ui === 'final' && g && (
        <div className="fg-final hg2-final" role="status">
          <span className="eyebrow">Your drives</span>
          <b className="num">{g.score}</b>
          <small>{g.ends.map((e) => MARK_TEXT[e]).join(' · ')}</small>
          {rival && !rival.done && <WaitLine rival={rival} unit="drive" total={drives} />}
        </div>
      )}
    </div>,
    document.body
  );
}

function KickMeter({ window: win, start, stopped, distance, now, paused, onKick }: { window: number; start: number; stopped: number | null; distance: number; now: () => number; paused: boolean; onKick: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (stopped !== null || paused) return;
    let raf = 0;
    const loop = () => {
      force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stopped, paused]);
  const ph = ((now() - start) / 1100) % 2;
  const pos = stopped ?? (ph < 1 ? ph : 2 - ph);
  return (
    <button
      className="fb2-kick"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!paused) onKick();
      }}
      aria-label={'Kick the ' + distance + ' yard field goal: tap when the needle is in the window'}
    >
      <span className="eyebrow">{distance} YD FIELD GOAL · TAP IN THE WINDOW</span>
      <span className="fg-meter">
        <i className="win" style={{ left: 50 - win * 50 + '%', width: win * 100 + '%' }} />
        <i className="needle" style={{ left: pos * 100 + '%' }} />
      </span>
    </button>
  );
}

/** The control buttons' symbols (SVG, drawn in the button's ink). */
const svg = (d: string, fill = false) => (
  <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS: Record<string, React.ReactNode> = {
  snap: svg('M12 4c4.5 0 8 3.6 8 8s-3.5 8-8 8-8-3.6-8-8 3.5-8 8-8zM9 10l6 4M9 14l6-4'),
  audible: svg('M4 8h13l-3-3M20 16H7l3 3'),
  run: svg('M6 18 18 6M9 6h9v9'),
  away: svg('M5 19 19 5M19 5h-7M19 5v7M4 9v10h10'),
  juke: svg('M6 20l5-6-4-4 6-6M15 4h4v4'),
  spin: svg('M20 12a8 8 0 1 1-3-6.2M20 4v5h-5'),
  power: svg('M5 12h9M10 6l6 6-6 6M19 5v14'),
  dive: svg('M4 6l8 8M12 14h7M4 19h16'),
  burst: svg('M13 2 4 14h7l-2 8 9-12h-7z', true),
  kick: svg('M6 3v9h12V3M12 12v9'),
  punt: svg('M4 18c4-10 12-10 16 0M16 18h4v-4'),
  touch: svg('M3 17c5-9 13-9 18 0'),
  bullet: svg('M3 13h15M14 9l4 4-4 4'),
  lob: svg('M3 19c3-14 15-14 18 0')
};

/** The field goal unit: the holder down seven yards back, the kicker behind him, the line tight. */
function fieldGoalUnit(g: Game): Play {
  const p = startPlay(g, 'run');
  const { bx, los } = p;
  p.qb.x = bx;
  p.qb.y = los - 7;
  p.rb.p = g.off.k;
  p.rb.x = bx - 1.2;
  p.rb.y = los - 9.6;
  p.rb.route = [];
  const wings: Record<string, number> = { X: -4.1, SL: -5.3, Z: 4.1, TE: 5.3 };
  for (const b of p.bodies) {
    if (b.side === 'O' && b.slot in wings) {
      b.x = bx + wings[b.slot];
      b.y = los - 0.9;
      b.route = [];
    }
    b.vx = 0;
    b.vy = 0;
  }
  p.call = 'run';
  return p;
}

/** The AI's drives, played by the autopilot against your defense. */
export function aiDrives2(rivalLineup: Lineup, yourLineup: Lineup, seed: string, skill: number, attrs: (p: Player) => Attrs | null, drives = DRIVES, defIQ = 0): Progress {
  return aiDrivesOf(offenseOf(rivalLineup, attrs, 'ai:' + seed), defenseOf(yourLineup, attrs, 'aidef:' + seed), seed, skill, drives, defIQ);
}

/** The same from the teams themselves (Ultimate Team): one side's offense against the other's defense. */
export function aiDrivesOf(offense: Offense, defense: Defense, seed: string, skill: number, drives = DRIVES, defIQ = 0): Progress {
  const g = newGame(offense, defense, 'ai:' + seed, drives, defIQ);
  autoplay(g, skill, 'ai:' + seed);
  return { score: g.score, drive: g.drive, done: true, ends: wireEnds(g), plays: g.plays };
}
