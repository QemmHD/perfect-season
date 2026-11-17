import { PlayReadout } from '../PlayReadout';
import { basketballFeedback, type PlayFeedback } from '../play-feedback';
import type { Practice } from '../../evolution/training';
// Arcade basketball, the way it's played: your five on offense against the rival's five. The left
// thumb lands anywhere low on the left and the stick is born under it (past the ring: sprint); SHOOT
// (A, gold) starts the gather on touch-down: hold and let go at the top, tap it for a pump fake, swipe
// off it for a crossover, step-back, spin or (driving) a euro-step; PASS (B, teal) goes to the man you
// aim at, held it's a lob; CALL (C) opens SCREEN / CUT / ISO; tap a teammate to pass to him. Everything
// the game says goes in the one toast line above the controls (plan §5, V2 A.5).
// Held upright the camera looks up the floor; sideways it's the sideline view.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lineup, Player } from '../../engine/types';
import { logError } from '../../lib/errlog';
import { crowd, sfx } from '../../lib/sound';
import { radialAt, type ClusterInput } from '../hud/Cluster';
import { chime, feelCount, haptic, ringTick } from '../hud/feel';
import { makeGrade, parFor } from '../hud/grade';
import { heatStage, HEAT } from '../heat';
import { gameTimeAt, judge, touchClock } from '../perfect';
import { PERFECT_EVENTS, playFeel } from './feel-events';
import { TimingCalibrator } from './TimingCalibrator';
import { TAP_PX } from '../hud/gestures';
import { readGeometry } from '../hud/geometry';
import { HeatBar } from '../hud/HeatBar';
import { PauseButton } from '../hud/PauseButton';
import { PauseSheet, SheetToggle } from '../hud/PauseSheet';
import { firstTime, loadPrefs, savePrefs, type TouchPrefs } from '../hud/prefs';
import { ScoreBug } from '../hud/ScoreBug';
import { PausableTimers } from '../hud/timers';
import { ToastLine, ToastProvider, type Toast } from '../hud/ToastLine';
import '../hud';
import type { StickOut } from '../stick';
import { HoopsControls, type HoopsCtx, liftShoot, offOf } from './HoopsControls';
import './match.css';
import { Juice } from '../juice';
import { BADGE_LABEL, tierLabel } from './badges';
import { BoxTracker } from './box';
import { uniqueTags } from './labels';
import './held.css';
import { reducedMotion } from '../../ui/motion';
import { type Attrs, loadAttrs } from '../attrs';
import { freeCanvas } from '../pixel/body';
import type { CourtTheme } from '../pixel/court';
import type { Progress, RivalLive } from '../progress';
import { frameAt, Recorder, type Replay, REPLAY_AFTER, REPLAY_BEFORE, REPLAY_SPEED, replayTime, REPLAYS_IN_AUTOPLAY } from '../replay';
import { WaitLine } from '../Wait';
import { autoplay, decide, pilot } from './autopilot';
import { aimPass, callPlay, cancelGather, cancelShoot, contestOf, crossover, driving, euroStep, jumpRebound, pass, pressShoot, releaseShoot, RIM, RIM_H, spin, step, stepback } from './engine';
import { afterPossession, CLUTCH, half, type HoopsGame, type Mark, newHoopsGame, POSSESSIONS, practiceStart, startPossession } from './game';
import { hooper, lineOf, SPOTS } from './ratings';
import { type Fx, HoopsRenderer, type Kit } from './render';
import type { Body, Hooper, Possession, Pt, Scheme, ShotKind } from './types';
import type { Dial, RingState } from '../perfect';
import './coach-controls.css';
import { useInputInterrupt } from '../useInputInterrupt';

const DT = 1 / 60;
/** what a phone's screen and touch add between what you saw and the release it hears (ms), until the
 * player calibrates (TimingCalibrator: the touch prefs' offsetMs) */
const RELEASE_LAG_MS = 25;
/** The calibration's once-per-device offer (prefs hints.nba bit). */
const CALIBRATE_HINT = 5;
/** The ring-fill tick: this long before the ideal (s). */
const RING_TICK_S = 0.2;

/** What the dev server lets the QA probes read (window.__hg2): never part of a build. */
interface QaProbe {
  possession(): Possession | null;
  game(): HoopsGame | null;
  /** a court point on the canvas (canvas pixels) and the pixels a foot there */
  screenOf(cx: number, cz: number, h?: number): { x: number; y: number; s: number } | null;
  canvas(): HTMLCanvasElement | null;
  /** canvas pixels to CSS pixels */
  zoom(): number;
  /** engine steps run so far, whether the match is frozen, the delayed jobs waiting, haptics fired */
  steps(): number;
  paused(): boolean;
  timers(): { pending: number; fired: number };
  feel(): Record<string, number>;
  /** the stick as the game last heard it */
  stick(): StickOut | null;
  /** the held arena (plan §3.10): when the last possession ended (performance.now), the renderer
   * object (its identity must survive a rematch), the floor casts made and reused (NBA-29) */
  whistleAt(): number | null;
  /** when the latest possession tipped off (performance.now): the next game's first live frame */
  tipAt(): number | null;
  renderer(): HoopsRenderer;
  floor(): { cast: number; reused: number };
  /** the safe box the camera frames inside (hud/geometry.ts) */
  geometry(): { safeTop: number; safeBottom: number; land: boolean; hudBottom: number } | null;
  /** the flow probe's fast-forward: the possessions before `n` count as played misses, so the next
   * one up is possession n (the held-arena loop runs in seconds instead of minutes) */
  skipTo(n: number): void;
  /** the score bug's phase forced, for the captures of phases the format doesn't reach yet (OT: nba-6) */
  phase(ph: 'normal' | 'clutch' | 'ot' | null): void;
  /** your side's points in this game's box score (the scorer plate reads it; a rematch starts at 0) */
  boxPoints(): number;
}

/** The toast line's colours for what the game says. */
const TONE = { good: 'teal', bad: 'red', big: 'gold', green: 'gold', plain: 'plain' } as const;
type Tone = keyof typeof TONE;
/** The one-line hints, once per device (prefs hints.nba bits). */
const HINTS: [number, string][] = [
  [0, 'Left thumb: move · past the ring: sprint'],
  [1, 'SHOOT: hold · tap: pump fake · swipe: moves'],
  [2, 'PASS: hold for a lob · or tap a teammate'],
  [3, 'CALL: slide to SCREEN, CUT or ISO']
];
const BOARD_HINT = 4;

/** What a replay needs to redraw a moment of a possession. */
interface Snap {
  bodies: Body[];
  ball: Possession['ball'];
  handler: number | null;
  heat: Possession['heat'];
  lastShot: Possession['lastShot'];
}
const snapOf = (p: Possession): Snap => ({
  bodies: p.bodies.map((b) => ({ ...b, trail: [] })),
  ball: p.ball ? { ...p.ball } : null,
  handler: p.handler,
  heat: p.heat,
  lastShot: p.lastShot
});
const MARK_TEXT: Record<Mark, string> = { '2': '2', '3': '3', A: '3', X: '–', TO: 'TO' };
/** The defense's looks, and what beats each. */
const LOOK_TEXT: Record<Scheme, string> = { man: 'MAN-TO-MAN', sag: 'SAGGING OFF', switch: 'SWITCHING', trap: 'TRAPPING' };
const LOOK_TIP: Record<Scheme, string> = { man: 'beat your man', sag: 'shoot over it', switch: 'attack the mismatch', trap: 'move it early' };
/** The scorer plate's shot word ("CURRY · 3PT · 11 PTS", V2 B.1.7). */
const SHOT_WORD: Record<ShotKind, string> = { three: '3PT', mid: 'JUMPER', close: 'FLOATER', layup: 'LAYUP', dunk: 'DUNK', contact: 'AND-ONE SLAM', standdunk: 'DUNK', oop: 'ALLEY-OOP' };
/** the held arena's opponent curtain (plan §4.8): up this long from the rematch call: 1.2 s, leaving 0.3 s of V2's 1.5 s for the tip-off on a slow phone (nba-3 review), skippable */
const CURTAIN_MS = 1200;
/** A kit's colour for the score bug: the jersey, or its trim when the jersey is white (an away kit). */
function teamColor(k: Kit): string {
  const hex = /^#[0-9a-f]{3}$/i.test(k.jersey) ? '#' + [...k.jersey.slice(1)].map((c) => c + c).join('') : k.jersey;
  if (!/^#[0-9a-f]{6}/i.test(hex)) return k.jersey;
  const n = parseInt(hex.slice(1, 7), 16);
  const light = ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 200;
  return light ? k.trim : k.jersey;
}
/** The coverage word as a shooter rises (V2 B.1.7): what the ring is, and why when it isn't gold. */
function coverageWord(state: RingState, dial: Dial | undefined, p: Possession): string {
  const c = p.handler !== null ? contestOf(p, p.bodies[p.handler]) : 'open';
  if (state === 'gold') return (c === 'light' ? 'LIGHT' : 'OPEN') + ' · RELEASE ON GOLD';
  if (dial === 'RANGE') return state === 'red' ? 'TOO FAR · RANGE' : 'DEEP · RANGE';
  return state === 'red' ? 'SMOTHERED · PRESSURE' : (c === 'light' ? 'LIGHT' : 'HEAVY') + ' · PRESSURE';
}

/** A release that wasn't PERFECT, in one line: the timing word and the dial it failed on. */
export function releaseWord(ls: NonNullable<Possession['lastShot']>): string {
  const spec = { idealMs: 0, goldMs: ls.goldMs ?? 0, state: ls.state ?? 'gold', ...(ls.dial ? { dial: ls.dial } : {}) } as const;
  const j = judge(spec, ls.offMs ?? ls.off * 250);
  if (spec.state === 'red') return spec.dial === 'RANGE' ? 'TOO FAR · RANGE' : 'SMOTHERED · PRESSURE';
  if (spec.state === 'amber') return (j.step === 0 ? 'ON TIME' : j.word) + ' · ' + (spec.dial ?? 'PRESSURE');
  return j.word + ' · TIMING';
}

/** Who took the possession's last shot (the scorer, on a make). */
function shooterOf(p: Possession): Body | undefined {
  return p.end && p.end.who >= 0 ? p.bodies[p.end.who] : undefined;
}

/** both fives (and the bench) with on-court tags no two men share (labels.ts) */
function tagged(lists: Hooper[][]): Hooper[][] {
  const all = lists.flat();
  const tags = uniqueTags(all);
  let k = 0;
  return lists.map((l) => l.map((h) => ({ ...h, tag: tags[k++] })));
}

/** The five from a drafted lineup, rated. */
export function fiveOf(lineup: Lineup, attrs: (p: Player) => Attrs | null): Hooper[] {
  return SPOTS.map((s) => {
    const p = lineup[s] as Player;
    const a = attrs(p);
    return hooper(lineOf(p, a), s, (a as { num?: number | null } | null)?.num ?? null);
  });
}

/** A home kit from a team's colors, and an away kit (white with the team's color as trim). */
export function kitsFor(c1: string, c2: string): { home: Kit; away: Kit } {
  return {
    home: { jersey: c1, trim: c2, shorts: c1, socks: '#f4f4f4', shoes: '#16161c' },
    away: { jersey: '#f6f6f2', trim: c1, shorts: '#f6f6f2', socks: '#f4f4f4', shoes: '#f4f4f4' }
  };
}

export function Hoops2({
  lineup,
  rivalLineup,
  five,
  rivalFive,
  bench,
  rivalName,
  seed,
  possessions = POSSESSIONS,
  practice,
  defIQ = 0,
  rival,
  ourKit,
  theirKit,
  court,
  autoplayHook,
  timeScale = 1,
  online = false,
  hold = false,
  round = 0,
  roundAt = 0,
  onQuit,
  onProgress,
  onDone
}: {
  /** the drafted lineups; or the teams themselves (Ultimate Team), `five` and `rivalFive` */
  lineup?: Lineup;
  rivalLineup?: Lineup;
  five?: Hooper[];
  rivalFive?: Hooper[];
  /** subs for tired starters */
  bench?: Hooper[];
  rivalName: string;
  seed: string;
  possessions?: number;
  practice?: Practice;
  /** how well the rival defends beyond its ratings (Squad Battles' difficulty; 0 standard) */
  defIQ?: number;
  rival: RivalLive | null;
  ourKit: Kit;
  theirKit: Kit;
  /** the home court: the defending team's colors and letters */
  court: CourtTheme;
  autoplayHook?: boolean;
  /** the lab's slow motion, for filming the moves frame by frame (1 in the app) */
  timeScale?: number;
  /** online the match can't stop: pause opens the sheet but the game keeps going */
  online?: boolean;
  /** offline Quit (after its confirm): the host settles the game as a loss */
  onQuit?: () => void;
  /**
   * The held arena (plan §4.8): the game reports done the moment the last possession ends, dims and
   * stays mounted under the host's result sheet; each new `round` (with a new `seed`, maybe a new
   * rival) re-seeds the same renderer and its drawings behind the opponent curtain.
   */
  hold?: boolean;
  round?: number;
  /** when the rematch was asked for (performance.now): the curtain's 1.5 s counts from there */
  roundAt?: number;
  onProgress: (p: Progress) => void;
  onDone: (p: Progress) => void;
}) {
  const [lastReadout,setLastReadout] = useState<PlayFeedback|null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [attrs, setAttrs] = useState<((p: Player) => Attrs | null) | null>(null);
  useEffect(() => {
    let live = true;
    loadAttrs().then((f) => live && setAttrs(() => f));
    return () => {
      live = false;
    };
  }, []);
  const game = useMemo<HoopsGame | null>(() => {
    if (!attrs) return null;
    // on-court tags no two men share (J.JOHNSON / M.JOHNSON): the names the chips print, never the
    // engine's numbers (the AI's race, aiPossessionsOf, plays from the untouched lists)
    const [us, them, subs] = tagged([five ?? fiveOf(lineup!, attrs), rivalFive ?? fiveOf(rivalLineup!, attrs), bench ?? []]);
    return newHoopsGame(us, them, seed, possessions, subs, defIQ);
  }, [attrs, round]);
  const renderer = useMemo(() => {
    const r = new HoopsRenderer(court, [ourKit, theirKit]);
    r.reduced = reducedMotion();
    return r;
  }, []);
  // the game's drawings and its canvas let go of their memory as it closes (Safari counts a dropped
  // canvas against the page's cap until it's collected, which can be a while)
  useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      renderer.dispose();
      freeCanvas(canvas);
    };
  }, []);
  const possRef = useRef<Possession | null>(null);
  /** when the last possession ended (the held arena's whistle), for the flow probe */
  const whistleAt = useRef<number | null>(null);
  const tipAt = useRef<number | null>(null);
  /** the box score from the engine's own events (box.ts): the scorer plate reads it */
  const boxRef = useRef(new BoxTracker());
  /** the score bug's shot clock, written from the loop whenever its second changes (NBA-08) */
  const clockRef = useRef<HTMLElement | null>(null);
  const clockShown = useRef<{ v: string; low: boolean }>({ v: '', low: false });
  /** the safe box (hud/geometry.ts), read again whenever the game's size or orientation changes */
  const geoRef = useRef<{ w: number; h: number; land: boolean; box: { safeTop: number; safeBottom: number; land: boolean; hudBottom: number } } | null>(null);
  /** a badge already popped this possession (one per possession, V2 B.1.8) */
  const badgeShown = useRef(false);
  /** the held arena's opponent curtain before a rematch's tip-off */
  const [curtain, setCurtain] = useState(false);
  /** the dev probe's forced bug phase (never set outside the dev server) */
  const [qaPhase, setQaPhase] = useState<'normal' | 'clutch' | 'ot' | null>(null);
  // The studio QA probes (scripts/audit/nba-geo.mjs, nba-rematch.mjs) read the camera and the live
  // possession through this. Dev server only: Vite drops the block from the production build.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __hg2?: QaProbe };
    const probe: QaProbe = {
      possession: () => possRef.current,
      game: () => game,
      screenOf: (cx, cz, h) => renderer.screenOf(cx, cz, h),
      canvas: () => canvasRef.current,
      zoom: () => renderer.zoom,
      steps: () => stepsRun.current,
      paused: () => pausedRef.current,
      timers: () => ({ pending: timers.current.pending, fired: timers.current.fired }),
      feel: () => ({ ...feelCount }),
      stick: () => stickRef.current,
      whistleAt: () => whistleAt.current,
      tipAt: () => tipAt.current,
      renderer: () => renderer,
      floor: () => ({ ...renderer.floorStats }),
      geometry: () => geoRef.current?.box ?? null,
      skipTo: (n) => {
        if (!game) return;
        while (game.marks.length < Math.min(n, game.total - 1)) game.marks.push('X');
        game.done = game.marks.length;
      },
      phase: (ph) => setQaPhase(ph),
      boxPoints: () => boxRef.current.lines('us').reduce((a, l) => a + l.pts, 0)
    };
    w.__hg2 = probe;
    return () => {
      if (w.__hg2 === probe) delete w.__hg2;
    };
  }, [game]);
  /** the stick as the thumb last left it (kept between possessions: a held thumb plays at the whistle) */
  const stickRef = useRef<StickOut | null>(null);
  /** every delayed step of the match (next possession, replays, the buzzer): they stop with a pause */
  const timers = useRef(new PausableTimers());
  /** offline pause: no steps, no timers; online the sheet opens and the game goes on */
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState(false);
  const stepsRun = useRef(0);
  const toastApi = useRef<{ show(t: Toast): void; clear(): void } | null>(null);
  const [prefs, setPrefs] = useState<TouchPrefs>(() => loadPrefs());
  const [callOpen, setCallOpen] = useState(false);
  const ctlRef = useRef<HTMLDivElement>(null);
  /** PASS pressed: it leaves after the 120 ms wind-up (game time), as a lob if B is still held */
  const passPend = useRef<{ at: number; held: boolean } | null>(null);
  const pilotRef = useRef(pilot(0.75, seed));
  const fxRef = useRef<Fx>({ swish: 0, shake: 0, crowd: 0, flash: 0, juice: new Juice({ reducedMotion: reducedMotion() }) });
  const slowUntil = useRef(0);
  const [between, setBetween] = useState(true);
  const [boarding, setBoarding] = useState(false);
  const [, setTick] = useState(0);
  const [wide, setWide] = useState(false);
  // instant replay: the last seconds of play, the highlight to show, the replay running
  const rec = useRef(new Recorder<Snap>(5));
  const highlight = useRef<{ t: number; cx: number; cz: number } | null>(null);
  const replayRef = useRef<Replay<Snap> | null>(null);
  /** where the dribble was in its beat last frame (the bounce sounds as it hits the floor) */
  const lastBeat = useRef(1);
  /** game time at a touch (perfect.ts TouchClock), updated every frame, and the possession it's for */
  const clock = useRef({ c: touchClock(), p: null as Possession | null });
  /** PERFECTs in a row (the chime climbs a semitone each, up to 5) */
  const perfectRun = useRef(0);
  /** a release's PERFECT already played its double inside the touch (the event mustn't play it again) */
  const doubleInTouch = useRef(false);
  /** the meter the ring-fill tick has played for (its t0) */
  const ringTicked = useRef<number | null>(null);
  /** the first On Fire basket of the game gets the slow-motion replay */
  const fireReplayed = useRef(false);
  /** the 4-tap calibration: offered once before the first match on the phone, and from the pause sheet */
  const [calib, setCalib] = useState(false);
  const [replaying, setReplaying] = useState(false);

  /** Everything the game says goes in the toast line: hints 0, calls and banners 1, results 2. */
  const say = (text: string, tone: Tone, ms = 1200, priority = 1) => toastApi.current?.show({ text, tone: TONE[tone], ms, priority, pop: tone === 'green' || tone === 'big' });
  const later = (fn: () => void, ms: number) => timers.current.set(fn, ms);
  const progress = (g: HoopsGame): Progress => {
    const base: Progress = { score: g.score, drive: g.done, done: g.over, ends: g.marks.slice(), plays: g.done };
    if (!g.over || practice) return base;
    // the final whistle: this phone's box score and match grade (plan §4.8; never on the wire)
    const us = boxRef.current.lines('us');
    const pog = us.reduce<(typeof us)[number] | null>((a, l) => (!a || l.pts > a.pts ? l : a), null);
    return {
      ...base,
      box: { us, them: [], ...(pog && pog.pts > 0 ? { pog: pog.name } : {}) },
      grade: makeGrade({ points: g.score, units: g.done, par: parFor(defIQ, online), turnovers: g.turnovers, perfects: g.perfects, moments: g.moments, bestHeat: g.heat.us.peak, fires: g.heat.us.fires })
    };
  };
  const shake = (px: number) => {
    if (!reducedMotion()) fxRef.current.shake = Math.max(fxRef.current.shake, px);
  };

  const next = (g: HoopsGame) => {
    passPend.current = null;
    setCallOpen(false);
    possRef.current = startPossession(g);
    // a person's possession: the difficulty's and meter Off's window parts are theirs (perfect.ts)
    possRef.current.person = !autoplayHook;
    possRef.current.meterOff = !autoplayHook && loadPrefs().meter === 'off';
    renderer.hud.meterOff = possRef.current.meterOff;
    ringTicked.current = null;
    tipAt.current = performance.now();
    // the Clutch possessions: the camera sits 6% tighter (V2 B.0.4; not with reduced motion)
    renderer.clutch = g.done >= g.total - CLUTCH;
    if (practice) practiceStart(possRef.current, practice.drill);
    boxRef.current.begin(possRef.current, 'us');
    badgeShown.current = false;
    const pl = pilotRef.current;
    pl.letGo = null;
    pl.driving = false;
    pl.goal = null;
    pl.nextThink = 0;
    pl.crosses = 0;
    setBetween(false);
    setBoarding(false);
    setTick((n) => n + 1);
    if (g.done === g.total / 2) say('SECOND HALF', 'plain', 1300);
    // the one-line hints, once per device, through the first possession
    if (g.done === 0 && !autoplayHook) {
      const seen = loadPrefs().hints?.nba ?? 0;
      let k = 0;
      for (const [bit, text] of HINTS) if (!(seen & (1 << bit))) later(() => firstTime('nba', bit) && say(text, 'plain', 2700, 0), 300 + 2900 * k++);
    }
  };

  useEffect(() => {
    if (!game) return;
    crowd.start(0.24);
    const all = timers.current;
    if (round > 0) {
      // a rematch in the held arena: the same renderer and drawings, a clean slate for the play
      renderer.reset(court, [ourKit, theirKit]);
      // a new game's box score: the scorer plate's points and the final box start again at 0
      boxRef.current = new BoxTracker();
      possRef.current = null;
      booked.current = null;
      rescued.current = null;
      highlight.current = null;
      replayRef.current = null;
      fireReplayed.current = false;
      perfectRun.current = 0;
      ringTicked.current = null;
      rec.current.clear();
      passPend.current = null;
      slowUntil.current = 0;
      whistleAt.current = null;
      pilotRef.current = pilot(0.75, seed);
      clockShown.current = { v: '', low: false };
      setReplaying(false);
      setBetween(true);
      setLastReadout(null);
      toastApi.current?.clear();
      // the opponent curtain, then the tip-off (a tap skips it)
      setCurtain(true);
      all.set(() => tipOff(game), Math.max(0, Math.min(CURTAIN_MS, CURTAIN_MS - (performance.now() - roundAt))));
    } else {
      all.set(() => next(game), 700);
      // the timing calibration, once on this phone before its first match (skippable; offline only)
      if (!autoplayHook && !practice && !online && loadPrefs().offsetMs === undefined && firstTime('nba', CALIBRATE_HINT)) openCalib();
    }
    return () => {
      all.clear();
      crowd.stop(0.6);
    };
  }, [game]);
  /** the curtain's done (or tapped): tip off */
  const tipOff = (g: HoopsGame) => {
    setCurtain(false);
    if (possRef.current === null && g === game) next(g);
  };
  const skipCurtain = () => {
    if (!curtain || !game) return;
    timers.current.clear();
    tipOff(game);
  };

  /** The stick as a direction on the court (the two cameras turn it differently); null when centred. */
  const stickOnCourt = (): Pt | null => {
    const s = stickRef.current;
    if (!s || !s.active || s.mag === 0) return null;
    // up the screen is the camera's forward (it's yawed 12°: camera.ts)
    return renderer.stickToCourt(s.x, s.y, stickYaw.current ?? undefined);
  };

  /** Juice (render only): sweat at the rim, confetti, the camera's kick and hit-stop. */
  const juiceAt = (cx: number, cz: number, h: number) => renderer.screenOf(cx, cz, h);
  const handleEvents = (p: Possession) => {
    const fx = fxRef.current;
    const J = fx.juice!;
    const nowMs = performance.now();
    // the haptics (feel-events.ts): a double on every PERFECT, a long on a score, a block or a turnover
    // (none in a watched sim: the autopilot's game isn't the player's hands)
    playFeel(p.events, { paused: pausedRef.current || !!autoplayHook, doubleDone: doubleInTouch.current });
    doubleInTouch.current = false;
    for (const e of p.events) {
      if (PERFECT_EVENTS.has(e)) {
        // PERFECT: a one-frame hit-stop and a nudge of the camera (none with reduced motion: the
        // ring's gold flash and the chime carry it)
        if (!reducedMotion()) {
          J.hitStop('perfect', nowMs);
          J.addTrauma(0.1);
          J.punch(0.012);
        }
      } else if (e.startsWith('finish:') && e.endsWith(':make') && !e.includes(':layup')) {
        J.hitStop('dunk', nowMs);
        J.addTrauma(e.includes('contact') ? 0.5 : 0.36);
        J.kick(0, 1, 5);
        J.punch(0.035);
        const q = juiceAt(RIM.cx, RIM.cz, RIM_H - 1);
        if (q) J.burst('sweat', q.x, q.y, 12, ['#ffffff', '#d8f0ff', '#a8d8ff'], { speed: 80, size: Math.max(1, q.s * 0.12) });
      } else if (e.startsWith('posterized:')) {
        J.hitStop('posterize', nowMs);
        J.addTrauma(0.6);
        J.punch(0.05);
        const d = p.bodies[Number(e.slice(11))];
        const q = d && juiceAt(d.cx, d.cz, 5);
        if (q) J.burst('sweat', q.x, q.y, 18, ['#ffffff', '#d8f0ff'], { speed: 110, size: Math.max(1, q.s * 0.14) });
      } else if (e.startsWith('blocked:')) {
        J.hitStop('block', nowMs);
        J.addTrauma(0.32);
        const d = p.bodies[Number(e.slice(8))];
        const sh = p.lastShot ? p.bodies.find((b) => b.side === 'O' && b.bumped) : null;
        if (d && sh) {
          const a = juiceAt(d.cx, d.cz, 8),
            b = juiceAt(sh.cx, sh.cz, 8);
          if (a && b) J.kick(b.x - a.x, b.y - a.y, 4);
          if (a) J.burst('spark', a.x, a.y - 4, 8, ['#ffe9a8', '#ffffff'], { speed: 90 });
        }
      } else if (e.startsWith('bump-through:')) {
        J.addTrauma(0.14);
        J.kick(0, -1, 2);
      } else if (e.startsWith('badge:')) {
        // one badge a possession, in the toast line (never over the rim): its name and tier
        if (badgeShown.current) continue;
        badgeShown.current = true;
        const [, id, idx, tier] = e.split(':');
        const who = p.bodies[Number(idx)];
        const name = (BADGE_LABEL[id] ?? id).toUpperCase();
        say((who ? who.p.tag + ' · ' : '') + name + ' · ' + tierLabel(Number(tier)).toUpperCase(), 'big', 1100, 1);
      } else if (e === 'clutch:icon') say('ICON TIME · CLUTCH', 'big', 1300);
      else if (e === 'ft:miss') say('MISSED THE FREE THROW', 'plain', 900);
    }
    for (const e of p.events) {
      if (e.startsWith('scheme:')) {
        // the defense's look and what beats it, read once at the start of the possession
        const sc = e.slice(7) as Scheme;
        // (at the hints' priority: a first-run hint replaces it rather than being lost behind it)
        if (!autoplayHook) say(LOOK_TEXT[sc] + ' · ' + LOOK_TIP[sc], 'plain', 1500, 0);
      } else if (e.startsWith('trap:')) {
        sfx.squeak();
        haptic('tick');
        say('DOUBLE TEAM! · ' + LOOK_TIP.trap, 'plain', 900);
      } else if (e.startsWith('call:')) {
        sfx.squeak();
        const star = e === 'call:iso' && p.playCall ? p.bodies[p.playCall.actor] : null;
        say(e === 'call:screen' ? 'SCREEN & ROLL' : e === 'call:cut' ? 'CUT TO THE RIM' : star ? 'ISO · CLEAR OUT FOR ' + star.p.tag : 'SPREAD THE FLOOR', 'plain', 1100);
      } else if (e.startsWith('pump:bit:')) {
        sfx.squeak();
        say('BIT ON THE FAKE · ' + p.bodies[Number(e.slice(9))].p.tag + ' IS IN THE AIR', 'good', 900);
      } else if (e === 'rim' || e === 'loose') {
        setBoarding(true);
        if (!autoplayHook && firstTime('nba', BOARD_HINT)) say('Move to the ball · tap BOARD to jump', 'plain', 1600, 0);
        if (e === 'rim') sfx.rim();
        else sfx.squeak();
      } else if (e === 'board-jump') sfx.squeak();
      else if (e === 'pass') sfx.whoosh();
      else if (e === 'lob') {
        sfx.whoosh();
        say('LOB!', 'plain', 600);
      } else if (e === 'catch' || e === 'oop-catch') sfx.catch();
      else if (e === 'rise') {
        sfx.squeak();
        // the coverage word as he rises: what the ring is and why
        const m = p.meter;
        if (m && !autoplayHook) say(coverageWord(m.state, m.dial, p), m.state === 'gold' ? 'green' : m.state === 'red' ? 'bad' : 'plain', 650, 0);
      } else if (e.startsWith('cut:')) sfx.squeak();
      else if (PERFECT_EVENTS.has(e)) {
        // the chime climbs a semitone for each PERFECT in a row (up to 5)
        perfectRun.current = Math.min(5, perfectRun.current + 1);
        chime(perfectRun.current);
        say(perfectRun.current > 1 ? 'PERFECT ×' + perfectRun.current : 'PERFECT', 'green', 900, 2);
      } else if (e === 'release' || e === 'finish:layup:miss') {
        // the timing word and the dial a miss failed on: TIMING, PRESSURE or RANGE
        const ls = p.lastShot;
        perfectRun.current = 0;
        if (ls) say(releaseWord(ls), ls.state === 'red' ? 'bad' : 'plain', 900, 1);
      } else if (e.startsWith('gather:')) {
        const kind = e.slice(7);
        if (kind === 'contact') {
          slowUntil.current = performance.now() + 900;
          crowd.swell(0.8);
        }
      } else if (e.startsWith('finish:')) {
        const [, kind, res] = e.split(':');
        if (p.lastShot?.and1) slowUntil.current = Math.max(slowUntil.current, performance.now() + 700);
        if (res === 'make' && (kind === 'dunk' || kind === 'contact' || kind === 'standdunk' || kind === 'oop')) {
          shake(kind === 'contact' ? 5 : 3);
          if (kind === 'contact') fx.flash = 0.7;
        }
      } else if (e.startsWith('posterized:') || e.startsWith('ankles:') || e.startsWith('blocked:')) {
        // a highlight: worth a replay once the possession's over
        const b = p.bodies[Number(e.slice(e.indexOf(':') + 1))];
        if (b && (!highlight.current || e.startsWith('posterized:'))) highlight.current = { t: p.t, cx: b.cx, cz: b.cz };
      }
      if (e.startsWith('posterized:')) {
        // the posterizer: the crowd comes out of its seats, the hit in slow motion
        slowUntil.current = Math.max(slowUntil.current, performance.now() + 1100);
        sfx.roar();
        sfx.thud(0.35);
        crowd.swell(1);
        fx.crowd = 1;
        shake(6);
      } else if (e.startsWith('ankles:')) {
        slowUntil.current = Math.max(slowUntil.current, performance.now() + 650);
        sfx.squeak();
        sfx.ooh();
        crowd.swell(0.9);
        fx.crowd = 1;
        say('ANKLES BROKEN!', 'big', 1100);
      } else if (e.startsWith('shook:')) {
        sfx.squeak();
        say('SHOOK HIM', 'good', 700);
      } else if (e.startsWith('blocked:')) {
        slowUntil.current = Math.max(slowUntil.current, performance.now() + 500);
        crowd.swell(0.8);
        sfx.block();
        shake(3);
        const d = p.bodies[Number(e.slice(8))];
        say('REJECTED BY ' + d.p.tag, 'bad', 1100);
      } else if (e.startsWith('orb:')) {
        setBoarding(false);
        sfx.catch();
        say('OFFENSIVE BOARD', 'good', 800);
        crowd.swell(0.4);
      }
    }
    p.events.length = 0;
  };

  /** the possession last booked: each is booked once, however it ended */
  const booked = useRef<Possession | null>(null);
  const finish = (p: Possession) => {
    if (!game || booked.current === p) return;
    booked.current = p;
    setLastReadout(basketballFeedback(p));
    const e = p.end!;
    const stageBefore = heatStage(game.heat.us);
    const mark = afterPossession(game, p);
    const stage = heatStage(game.heat.us);
    if (practice) {
      const ls = p.lastShot;
      practice.onAttempt({
        points: e.points,
        success: e.kind === 'make' && (practice.drill !== 'pass' || p.passes > 0),
        green: ls?.greened,
        offset: ls ? Math.round(ls.offMs ?? ls.off * 250) : undefined,
        contest: ls?.contest,
        detail: practice.drill === 'pass' && !p.passes ? 'MOVE THE BALL FIRST' : e.text
      });
    }
    boxRef.current.onEnd(p);
    const fx = fxRef.current;
    const shooter = e.kind === 'make' ? p.bodies[e.who] : undefined;
    if (e.kind === 'make') {
      fx.swish = 1;
      // the net snaps down for three frames
      renderer.netSnapUntil = performance.now() / 1000 + 0.05;
      // the first On Fire basket of the game: the slow-motion replay
      if (p.heat === 'fire' && !fireReplayed.current && shooterOf(p)) {
        fireReplayed.current = true;
        const b = shooterOf(p)!;
        highlight.current = { t: Math.max(0, p.t - 0.6), cx: b.cx, cz: b.cz };
      }
      const ls = p.lastShot;
      const big = ls?.kind === 'three' || ls?.kind === 'dunk' || ls?.kind === 'contact' || ls?.kind === 'oop' || ls?.kind === 'standdunk';
      if (big) {
        const q = renderer.screenOf(RIM.cx, RIM.cz, RIM_H + 2);
        if (q) fx.juice?.burst('confetti', q.x, q.y, ls?.kind === 'contact' ? 34 : 22, [ourKit.jersey, ourKit.trim, '#ffffff'], { speed: 120, size: Math.max(2, q.s * 0.16) });
      }
      sfx.bucket(ls?.kind, !!big);
      crowd.swell(big ? 1 : 0.55);
      fx.crowd = big ? 1 : 0.5;
      if (shooter) {
        shooter.act = 'celebrate';
        shooter.actAt = p.t;
      }
      // the scorer plate: "CURRY · 3PT · 11 PTS" (his points from the box score)
      const and1 = ls?.and1 ? ' AND ONE' : '';
      const pts = shooter ? boxRef.current.lines('us').find((l) => l.id === shooter.p.id)?.pts : undefined;
      const word = ls ? SHOT_WORD[ls.kind] : 'BUCKET';
      say((shooter ? shooter.p.tag + ' · ' : '') + word + and1 + (pts !== undefined ? ' · ' + pts + ' PTS' : ' +' + (mark === 'A' ? 3 : e.points)), big || and1 ? 'big' : 'good', 1400, 2);
    } else if (e.kind === 'miss') {
      sfx.groan(0.6);
      say(e.text, 'plain', 1000, 2);
    } else {
      if (e.kind === 'clock') sfx.buzzer();
      sfx.groan();
      say(e.text, 'bad', 1300, 2);
    }
    // Heat: the stage changes in the toast line (and the crowd), after the play's own line
    if (stage !== stageBefore && !game.over) {
      if (stage === 'fire') later(() => (say('ON FIRE · NEXT ' + HEAT.spell + ' POSSESSIONS', 'big', 1500, 2), crowd.swell(1)), 900);
      else if (stage === 'heating') later(() => (say('HEATING UP', 'big', 1200, 2), crowd.swell(0.6)), 900);
      else if (stageBefore === 'fire') later(() => say('COOLED OFF', 'plain', 900, 2), 900);
    }
    onProgress(progress(game));
    setBetween(true);
    setBoarding(false);
    // the final buzzer; the held arena reports the result at the whistle itself (the host's sheet
    // comes up over the dimmed court)
    if (game.over) {
      whistleAt.current = performance.now();
      later(() => sfx.buzzer(), hold ? 0 : 500);
      if (hold) {
        onDone(progress(game));
        setTick((n) => n + 1);
        return;
      }
    }
    const proceed = () => {
      if (game.over) {
        onDone(progress(game));
        setTick((n) => n + 1);
        return;
      }
      next(game);
    };
    const hl = highlight.current;
    highlight.current = null;
    // (not the game's last play: it's reported done, and the results come next)
    if (hl && !game.over && (!autoplayHook || REPLAYS_IN_AUTOPLAY) && !reducedMotion()) later(() => startReplay(hl, proceed), e.kind === 'make' ? 1300 : 1000);
    else later(proceed, e.kind === 'make' ? 1600 : 1250);
  };

  /** Play the highlight again, slower, from closer; then on with the game. */
  const startReplay = (hl: { t: number; cx: number; cz: number }, done: () => void) => {
    const frames = rec.current.clip(hl.t - REPLAY_BEFORE, hl.t + REPLAY_AFTER);
    if (frames.length < 10) {
      done();
      return;
    }
    replayRef.current = { frames, t0: frames[0].t, t1: frames[frames.length - 1].t, start: performance.now(), speed: REPLAY_SPEED, focus: { a: hl.cx, b: hl.cz }, done };
    renderer.replay = { cx: hl.cx, cz: hl.cz };
    renderer.showOdds = false;
    setReplaying(true);
  };
  const endReplay = () => {
    const r = replayRef.current;
    if (!r) return;
    replayRef.current = null;
    renderer.replay = null;
    renderer.showOdds = true;
    setReplaying(false);
    r.done();
  };

  /**
   * A play the game can't go on with (it shouldn't happen) mustn't freeze the game: it ends as a dead
   * ball and the next one starts. Kept on the phone for Settings to show.
   */
  const rescued = useRef<Possession | null>(null);
  const rescue = (p: Possession, e: unknown) => {
    console.error('[play]', e);
    logError('hoops play', e);
    if (!game || rescued.current === p) return;
    rescued.current = p;
    if (!p.end) {
      p.end = { kind: 'out', points: 0, text: 'DEAD BALL', who: p.handler ?? 0 };
      try {
        finish(p);
        return;
      } catch (e2) {
        logError('hoops finish', e2);
      }
    }
    // the finish itself broke: straight on to the next play (or the result)
    later(() => {
      if (!game.over) next(game);
      else {
        onDone(progress(game));
        setTick((n) => n + 1);
      }
    }, 1200);
  };

  /** The bug's clock: the possession's own clock rounded up, written only when it changes. */
  const writeClock = (p: Possession | null, replay: boolean) => {
    const el = clockRef.current;
    if (!el) return;
    const live = !!p && !replay;
    const v = live ? String(Math.max(0, Math.ceil(p!.clock))) : '–';
    const low = live && !p!.end && p!.clock <= 5;
    const was = clockShown.current;
    if (v === was.v && low === was.low) return;
    // under 4 s a tick each new second (and none for the 0 of a violation: the buzzer has it)
    if (live && !p!.end && p!.clock < 4 && v !== was.v && v !== '0') sfx.tick();
    clockShown.current = { v, low };
    el.textContent = v;
    if (low) el.dataset.low = '1';
    else delete el.dataset.low;
  };

  // the loop: fixed steps for the game, a draw every frame
  useEffect(() => {
    if (!game) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      // the safe box the camera frames inside: read from the HUD's tokens when the size or the
      // orientation changes (a layout read, so never every frame)
      const land = wrap.classList.contains('land');
      let geo = geoRef.current;
      if (!geo || geo.w !== w || geo.h !== h || geo.land !== land) {
        const g0 = readGeometry(wrap);
        geo = geoRef.current = { w, h, land, box: { safeTop: g0.safeTop, safeBottom: g0.safeBottom, land: g0.land, hudBottom: g0.hudBottom } };
      }
      renderer.resize(w, h, geo.box);
      let resized = false;
      if (canvas.width !== renderer.W || canvas.height !== renderer.H) {
        canvas.width = renderer.W;
        canvas.height = renderer.H;
        canvas.style.width = renderer.W * renderer.zoom + 'px';
        canvas.style.height = renderer.H * renderer.zoom + 'px';
        setWide(w > h);
        resized = true;
      }
      const p = possRef.current;
      // paused: the game is frozen (no steps, no juice, the clock held); only a turned phone redraws
      if (pausedRef.current) {
        last = now;
        const c = resized && p ? canvas.getContext('2d') : null;
        if (c && p) renderer.draw(c, p, now / 1000, fxRef.current);
        return;
      }
      const real = now / 1000;
      const fx = fxRef.current;
      const elapsed = Math.min(0.1, (now - last) / 1000) * timeScale;
      last = now;
      // the posterizer in slow motion; a hit-stop holds the steps back (render only: the same steps
      // still run with the same inputs, just a beat later)
      const J = fx.juice!;
      J.update(elapsed);
      acc += J.gameTime(now, now < slowUntil.current ? elapsed * 0.35 : elapsed);
      // a play can end between the steps too: a crossover, a spin or a step-back stripped as you
      // swipe it ends the possession in the swipe itself, and unbooked the game would wait on it
      // forever (the court still drawn, the clock stopped)
      if (p && p.end && booked.current !== p) {
        try {
          finish(p);
        } catch (e) {
          rescue(p, e);
        }
      }
      if (p && p.end) {
        // after the play: a posterized man still falls, the net still swings, the shooter lands
        const vis = J.gameTime(now, now < slowUntil.current ? elapsed * 0.35 : elapsed);
        p.t += vis;
        for (const b of p.bodies) {
          if (b.h > 0 || b.vh > 0) {
            b.h = Math.max(0, b.h + b.vh * vis);
            b.vh = b.h > 0 ? b.vh - 34 * vis : 0;
            if (b.h === 0 && b.bumped) {
              b.bumped = false;
              b.act = 'stumble';
              b.actAt = p.t;
            }
          }
          if (Math.abs(b.vx) + Math.abs(b.vz) < 0.05) continue;
          b.cx += b.vx * vis;
          b.cz += b.vz * vis;
          b.vx *= Math.pow(0.05, vis);
          b.vz *= Math.pow(0.05, vis);
        }
        acc = 0;
      } else if (p) {
        try {
          while (acc >= DT) {
            acc -= DT;
            if (p.end) break;
            if (p.handler !== null && !p.ball && !p.meter && !p.finish) p.target = aimPass(p, stickOnCourt());
            // PASS's wind-up is over: it goes, a lob if B is still down
            const pp = passPend.current;
            if (pp && p.t >= pp.at) {
              passPend.current = null;
              pass(p, null, pp.held);
            }
            const stick = autoplayHook ? decide(p, pilotRef.current) : stickOnCourt();
            const before = p.handler;
            step(p, DT, stick, autoplayHook ? undefined : !!stickRef.current?.sprint);
            stepsRun.current++;
            boxRef.current.onStep(p, before);
            handleEvents(p);
            if (p.end) {
              finish(p);
              break;
            }
          }
        } catch (e) {
          rescue(p, e);
        }
      } else acc = 0;
      // the touch clock: a touch's timestamp becomes game time against this frame (perfect.ts)
      if (p) {
        const c = clock.current.c;
        c.real = now;
        c.game = p.t;
        c.acc = acc;
        c.rate = J.frozen(now) ? 0 : timeScale * (now < slowUntil.current ? 0.35 : 1);
        clock.current.p = p;
        // the ring-fill tick, once, in the last 200 ms before the ideal
        const m = p.meter;
        if (m && m.off === undefined && !m.gather && ringTicked.current !== m.t0 && m.top - (p.t - m.t0) <= RING_TICK_S && !autoplayHook) {
          ringTicked.current = m.t0;
          ringTick();
        }
      }
      if (p && !replayRef.current) {
        rec.current.push(p.t, snapOf(p));
        // the dribble on the floor: on the same beat the drawing bounces the ball
        const h = p.handler !== null ? p.bodies[p.handler] : null;
        if (h && h.act === 'dribble' && !p.ball && !p.meter && !p.finish && !p.end) {
          const sp = Math.hypot(h.vx, h.vz);
          const beat = (((((p.t * (sp > 1.8 ? 1.5 + sp / 18 : 1.6)) % 1) * (sp > 1.8 ? 2 : 1.6)) % 1) + 1) % 1;
          if (lastBeat.current < 0.45 && beat >= 0.45) sfx.dribble(sp > 12);
          lastBeat.current = beat;
        } else lastBeat.current = 1;
      }
      // the cluster's dimmed state follows the play itself, every frame (NBA-18)
      const ctl = ctlRef.current;
      if (ctl) {
        const off = offOf(p, !!replayRef.current);
        if (ctl.dataset.off !== off) ctl.dataset.off = off;
      }
      // the shot clock, from the possession itself every frame (NBA-08): a warning at 5, a tick each
      // second under 4, and a violation reads 0 before the toast says so
      writeClock(p, !!replayRef.current);
      fx.swish = Math.max(0, fx.swish - elapsed * 1.3);
      fx.shake = Math.max(0, fx.shake - elapsed * 14);
      fx.crowd = Math.max(0, fx.crowd - elapsed * 0.45);
      fx.flash = Math.max(0, fx.flash - elapsed * 2.2);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const r = replayRef.current;
      // a frame that can't be drawn (a phone short of memory) mustn't stop the game: let go of the
      // old drawings and carry on
      try {
        if (r && p) {
          const rt = replayTime(r, now);
          const snap = rt === null ? null : frameAt(r.frames, rt);
          if (rt === null || !snap) endReplay();
          else
            renderer.draw(
              ctx,
              { ...p, t: rt, bodies: snap.bodies, ball: snap.ball, handler: snap.handler, heat: snap.heat, lastShot: snap.lastShot, meter: null, finish: null, target: null },
              real,
              fx
            );
        } else if (p) renderer.draw(ctx, p, real, fx);
      } catch (e) {
        console.error('[draw]', e);
        logError('hoops draw', e);
        renderer.dispose();
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  // ---- the controls (plan §5): the stick, A / B / C, the CALL radial, taps on teammates ----
  /** an input's PointerEvent.timeStamp as the possession's game time (what the touch saw) */
  const gameAt = (ts: number) => {
    const p = possRef.current;
    if (!p) return 0;
    return clock.current.p === p ? gameTimeAt(clock.current.c, ts, performance.now()) : p.t;
  };
  /** SHOOT let go: the release, timed from the lift's own timestamp, less the phone's calibrated lag */
  const release = (p: Possession, ts: number) => {
    const lag = (loadPrefs().offsetMs ?? RELEASE_LAG_MS) / 1000;
    const before = p.handler;
    const m = p.meter;
    releaseShoot(p, lag, gameAt(ts));
    // the haptic inside the touch itself (iOS plays it only there): a jumper's PERFECT is its double
    // (the event's own is then skipped); a finish's PERFECT plays when it goes up
    if (m && m.kind !== 'layup' && m.greened) {
      haptic('double', true);
      doubleInTouch.current = true;
    } else if (m) haptic('tick', true);
    boxRef.current.onStep(p, before);
    handleEvents(p);
  };
  /** a move off a swipe on SHOOT (or a Buttons-only button): screen right is +cz from behind */
  const moveBy = (kind: 'cross' | 'step' | 'spin', side: number) => {
    const p = possRef.current;
    if (!p || p.end || p.handler === null || replayRef.current) return;
    if (p.meter && !p.meter.gather) return; // already in the air
    const drive = driving(p);
    cancelGather(p);
    if (p.meter || p.finish || p.ball) return;
    const h = p.bodies[p.handler];
    const before = h.lastMoveAt;
    const toRimCx = Math.sign(RIM.cx - h.cx) || 1;
    if (kind === 'cross') (drive ? euroStep : crossover)(p, side * toRimCx);
    else if (kind === 'step') stepback(p);
    else spin(p, side * toRimCx);
    boxRef.current.onStep(p, p.handler);
    handleEvents(p);
    if (before === h.lastMoveAt && !p.end) say('MOVE RECHARGING · KEEP YOUR DRIBBLE', 'plain', 650);
  };
  const stickSide = () => (stickRef.current && Math.abs(stickRef.current.x) > 0.2 ? Math.sign(stickRef.current.x) : 1);
  const onA = (e: ClusterInput, p: Possession | null) => {
    if (e.phase === 'down') {
      if (replayRef.current) return endReplay();
      if (!p || p.end || pausedRef.current) return;
      if (p.ball?.kind === 'loose') {
        if (jumpRebound(p)) haptic('tick', true);
        return;
      }
      if (p.handler === null || p.bodies[p.handler].h > 0.15) return;
      setCallOpen(false);
      // the gather starts on touch-down, timed from the touch; it leaves the floor at 125 ms
      pressShoot(p, { at: gameAt(e.t), provisional: true });
      return;
    }
    if (!p || p.end || pausedRef.current) return;
    if (e.phase === 'move') {
      if (e.gesture?.kind === 'swipe') {
        const d = e.gesture.dir;
        moveBy(d === 'D' ? 'step' : d === 'U' ? 'spin' : 'cross', d === 'L' ? -1 : d === 'R' ? 1 : stickSide());
      } else if ((e.dist ?? 0) >= TAP_PX && p.meter?.gather) cancelGather(p); // drifting: not a tap, not yet a swipe
      return;
    }
    if (e.phase === 'cancel') {
      cancelShoot(p);
      return;
    }
    // up: the gesture decides (a tap is a pump fake, even when its lift got here a frame or three
    // after the gather rose); otherwise the shot goes, timed from the lift
    const out = liftShoot(p, e.gesture?.kind === 'tap');
    if (out === 'release') release(p, e.t);
    else {
      if (out === 'wait') say('ONE FAKE AT A TIME', 'plain', 600);
      boxRef.current.onStep(p, p.handler);
      handleEvents(p);
    }
  };
  const onB = (e: ClusterInput, p: Possession | null) => {
    if (e.phase === 'down') {
      if (!p || p.end || p.handler === null || p.ball || pausedRef.current || replayRef.current) return;
      setCallOpen(false);
      passPend.current = { at: p.t + 0.12, held: true };
      haptic('tick', true);
    } else if (e.phase === 'up') {
      if (passPend.current) passPend.current.held = false;
    } else if (e.phase === 'cancel') passPend.current = null;
  };
  const pickCall = (id: string) => {
    setCallOpen(false);
    const p = possRef.current;
    if (!p || p.end || replayRef.current || pausedRef.current) return;
    if (callPlay(p, id as 'screen' | 'cut' | 'iso')) {
      haptic('tick', true);
      boxRef.current.onStep(p, p.handler);
      handleEvents(p);
    } else {
      const wait = Math.ceil(Math.max(0, (p.callReadyAt ?? 0) - p.t));
      say(wait ? 'CALL READY IN ' + wait + 's' : 'CALL WHEN THE BALL IS IN HAND', 'plain', 800);
    }
  };
  const onC = (e: ClusterInput) => {
    if (e.phase === 'down') setCallOpen((o) => !o);
    else if (e.phase === 'up' && e.x !== undefined && e.y !== undefined && ((e.dist ?? 0) >= TAP_PX || e.gesture?.kind !== 'tap')) {
      // slid from CALL onto an item and lifted there (a plain tap on CALL only opens the menu: its items
      // still sit on CALL while they fan out, and a quick tap's lift would land on one)
      const id = radialAt(e.x, e.y);
      if (id) pickCall(id);
    }
  };
  const onCluster = (e: ClusterInput) => {
    const p = possRef.current;
    if (e.slot === 'A') onA(e, p);
    else if (e.slot === 'B') onB(e, p);
    else if (e.slot === 'C') onC(e);
  };
  /** a tap on the court: a teammate there gets the ball (a ≥ 44 px target round each man) */
  const courtTap = (x: number, y: number) => {
    setCallOpen(false);
    if (replayRef.current) return endReplay();
    const p = possRef.current;
    const canvas = canvasRef.current;
    if (!p || !canvas || p.end || p.handler === null || p.ball || pausedRef.current) return;
    const r = canvas.getBoundingClientRect();
    const target = renderer.teammateAt(p, ((x - r.left) * renderer.W) / r.width, ((y - r.top) * renderer.H) / r.height, 26 / renderer.zoom);
    if (target !== null) pass(p, target);
  };
  const courtPtr = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  /** the camera's yaw when the thumb went down on the stick: the stick keeps that mapping for the
   * whole touch, so a turn of the camera never turns the court under a held thumb (nba-3 review) */
  const stickYaw = useRef<number | null>(null);
  const onStick = (o: StickOut) => {
    if (!o.active) stickYaw.current = null;
    else if (stickYaw.current === null) stickYaw.current = renderer.yaw;
    stickRef.current = o;
  };
  useInputInterrupt(() => {
    stickRef.current = null;
    stickYaw.current = null;
    passPend.current = null;
    courtPtr.current = null;
    setCallOpen(false);
    const p = possRef.current;
    if (p) cancelShoot(p);
  });

  // ---- pause (offline: everything stops; online: the sheet, and the game goes on) ----
  const pause = () => {
    if (!game || game.over) return;
    setCallOpen(false);
    setSheet(true);
    if (online || pausedRef.current) return;
    pausedRef.current = true;
    timers.current.pause();
    passPend.current = null;
    const p = possRef.current;
    // a shot held as it pauses is taken back (a system-cancelled hold is never a release)
    if (p && !p.end) cancelShoot(p);
    crowd.stop(0.3);
    setPaused(true);
  };
  // the calibration freezes an offline game the way a pause does, and lets it go when it closes
  const calibFromSheet = useRef(false);
  const openCalib = (fromSheet = false) => {
    calibFromSheet.current = fromSheet;
    setSheet(false);
    setCalib(true);
    if (online || pausedRef.current) return;
    pausedRef.current = true;
    timers.current.pause();
    passPend.current = null;
    const p = possRef.current;
    if (p && !p.end) cancelShoot(p);
    setPaused(true);
  };
  const closeCalib = () => {
    setCalib(false);
    // from the pause sheet: back to it (still paused); before the first match: play
    if (calibFromSheet.current) setSheet(true);
    else resume();
  };
  const resume = () => {
    setSheet(false);
    if (!pausedRef.current) return;
    const span = timers.current.resume();
    pausedRef.current = false;
    slowUntil.current += span;
    if (replayRef.current) replayRef.current.start += span;
    crowd.start(0.24);
    setPaused(false);
  };
  const quit = () => {
    timers.current.clear();
    pausedRef.current = true;
    setSheet(false);
    crowd.stop(0.3);
    onQuit?.();
  };
  // a phone that's put away (the app switcher, a call, the lock button) pauses an offline game
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(() => {
    if (online || autoplayHook) return;
    const hide = () => document.hidden && pauseRef.current();
    const gone = () => pauseRef.current();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', gone);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', gone);
    };
  }, [online, autoplayHook]);
  const setControls = (controls: 'gestures' | 'buttons') => {
    savePrefs({ controls });
    setPrefs(loadPrefs());
  };
  /** meter Off (×1.10 gold): only the ring's colour at his feet; from the next possession */
  const setMeter = (meter: 'on' | 'off') => {
    savePrefs({ meter });
    setPrefs(loadPrefs());
  };

  const g = game;
  const ctx: HoopsCtx = boarding ? 'board' : between || replaying ? 'dead' : 'offense';
  const playing = !!g && !g.over && !autoplayHook;
  // the game fills the real screen, above the app's portrait frame, so it can be played either way up
  return createPortal(
    <div className={'arcade-full hg2 hg2-nba ps-geo' + (wide ? ' wide land' : '') + (paused ? ' paused' : '') + (prefs.controls === 'buttons' ? ' buttons' : '') + (hold && g?.over ? ' held' : '')} ref={wrapRef}>
      <ToastProvider paused={paused} apiRef={toastApi}>
        <canvas ref={canvasRef} className="hg2-canvas" />
        {playing && (
          <div
            className="hg2-court"
            aria-hidden="true"
            onPointerDown={(e) => {
              if (!courtPtr.current) courtPtr.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
            }}
            onPointerUp={(e) => {
              const c = courtPtr.current;
              if (!c || c.id !== e.pointerId) return;
              courtPtr.current = null;
              if (e.timeStamp - c.t < 250 && Math.hypot(e.clientX - c.x, e.clientY - c.y) < TAP_PX) courtTap(e.clientX, e.clientY);
            }}
            onPointerCancel={() => (courtPtr.current = null)}
          />
        )}
        {g && (
          <>
            {/* LAST PLAY stays out of practice (Training Camp, Moments): their own overlays sit right under
                the bug with Leave and Restart buttons the opened card would cover, and they report each
                attempt themselves */}
            <ScoreBug
              you={g.score}
              rival={rival?.score ?? 0}
              youName="YOU"
              rivalName={(rival?.name ?? rivalName).slice(0, 10)}
              period={g.over ? 'FINAL' : half(g) === 1 ? '1ST' : '2ND'}
              sub={g.over ? undefined : Math.min(g.done + 1, g.total) + '/' + g.total}
              clockRef={clockRef}
              progress={g.done / g.total}
              phase={qaPhase ?? (!g.over && g.done >= g.total - CLUTCH ? 'clutch' : 'normal')}
              youColor={teamColor(ourKit)}
              rivalColor={teamColor(theirKit)}
              aside={!autoplayHook && !practice && <PlayReadout readout={lastReadout} live={!between && !g.over} resetKey={g.done} icon />}
            />
            <HeatBar you={{ v: g.heat.us.v, stage: heatStage(g.heat.us) }} />
          </>
        )}
        {replaying && (
          <button className="replay-banner" onPointerDown={(e) => (e.stopPropagation(), endReplay())} aria-label="Instant replay: tap to skip">
            <i />
            REPLAY
            <small>TAP TO SKIP</small>
          </button>
        )}
        {!attrs && <div className="fg-loading">Taking the floor…</div>}
        {playing && (
          <HoopsControls
            ctx={ctx}
            buttonsOnly={prefs.controls === 'buttons'}
            callOpen={callOpen}
            rootRef={ctlRef}
            onStick={onStick}
            onSprintEdge={() => haptic('tick')}
            onCourtTap={courtTap}
            onInput={onCluster}
            onArc={(id) => moveBy(id as 'cross' | 'step' | 'spin', stickSide())}
            onCall={(id) => pickCall(id)}
            onCallClose={() => setCallOpen(false)}
          />
        )}
        <ToastLine />
        {g && !g.over && <PauseButton onPause={pause} label={online ? 'Match menu' : 'Pause'} />}
        <PauseSheet open={sheet} online={online} onResume={resume} onQuit={!online && onQuit ? quit : undefined} quitNote="It counts as a loss. Possessions you haven’t played score nothing.">
          <SheetToggle
            label="Controls"
            value={prefs.controls ?? 'gestures'}
            options={[
              { id: 'gestures', label: 'GESTURES' },
              { id: 'buttons', label: 'BUTTONS' }
            ]}
            onChange={setControls}
          />
          <SheetToggle
            label="Meter"
            value={prefs.meter ?? 'on'}
            options={[
              { id: 'on', label: 'ON' },
              { id: 'off', label: 'OFF +10%' }
            ]}
            onChange={setMeter}
          />
          <button type="button" className="ps-hud-sheet-btn" onClick={() => openCalib(true)}>
            CALIBRATE TIMING
          </button>
          <ul className="ps-hud-help">
            <li>
              <b>LEFT THUMB</b> anywhere low: move · past the ring: sprint
            </li>
            <li>
              <b>SHOOT</b> hold, let go at the top · tap: pump fake · swipe: cross, step-back, spin (euro-step on a drive)
            </li>
            <li>
              <b>PASS</b> to the man you aim at · hold: lob · or tap a teammate
            </li>
            <li>
              <b>CALL</b> SCREEN · CUT · ISO (clears out for your star)
            </li>
            <li>
              <b>GOLD RING</b> let go as it closes on the gold: a PERFECT goes in. Amber: contested or deep. Red: smothered or too far
            </li>
            <li>
              <b>HEAT</b> PERFECT +{HEAT.gain.perfect} · basket +{HEAT.gain.score} · 2+ passes +{HEAT.gain.clean} · turnover {HEAT.gain.turnover}. HEATING UP at {HEAT.up}; ON FIRE at {HEAT.fire} for {HEAT.spell} possessions: gold ×{HEAT.windowMult}
            </li>
          </ul>
        </PauseSheet>
        {calib && <TimingCalibrator reduced={reducedMotion()} onClose={closeCalib} />}
        {curtain && g && (
          <button type="button" className="hg2-curtain" onPointerDown={(e) => (e.stopPropagation(), skipCurtain())} aria-label={'Next game against ' + rivalName + ': tap to tip off'}>
            <span className="eyebrow">Next game</span>
            <b className="disp">VS {(rival?.name ?? rivalName).toUpperCase()}</b>
            <span className="hg2-curtain-five">
              {g.theirs.map((h) => (
                <span key={h.id}>
                  <i>{h.pos}</i>
                  <em>{h.tag}</em>
                  <small className="num">{h.ovr}</small>
                </span>
              ))}
            </span>
            <small>TAP TO TIP OFF</small>
          </button>
        )}
        {g?.over && !hold && (
          <div className="fg-final hg2-final" role="status">
            <span className="eyebrow">Your possessions</span>
            <b className="num">{g.score}</b>
            <small>{g.marks.map((m) => MARK_TEXT[m]).join(' ')}</small>
            {rival && !rival.done && <WaitLine rival={rival} unit="possession" total={possessions} />}
          </div>
        )}
      </ToastProvider>
    </div>,
    document.body
  );
}

/** The AI's possessions, played by the autopilot against your five. */
export function aiPossessions2(
  rivalLineup: Lineup,
  yourLineup: Lineup,
  seed: string,
  skill: number,
  attrs: (p: Player) => Attrs | null,
  possessions = POSSESSIONS,
  defIQ = 0
): Progress {
  return aiPossessionsOf(fiveOf(rivalLineup, attrs), fiveOf(yourLineup, attrs), seed, skill, possessions, [], defIQ);
}

/** The same from the teams themselves (Ultimate Team): one five on offense, with its bench, against the other. */
export function aiPossessionsOf(offense: Hooper[], defense: Hooper[], seed: string, skill: number, possessions = POSSESSIONS, bench: Hooper[] = [], defIQ = 0): Progress {
  const g = newHoopsGame(offense, defense, 'ai:' + seed, possessions, bench, defIQ);
  autoplay(g, skill, 'ai:' + seed);
  return { score: g.score, drive: g.done, done: true, ends: g.marks.slice(), plays: g.done };
}

