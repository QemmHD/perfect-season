// Arcade soccer, "Attacks": implemented by Claude (Anthropic), 2026-11-01, on the conventions of
// Football2.tsx (fixed-step loop, portal over the app, scoreboard, marks, pops, hints, replays).
// Your eleven attacks the rival's goal seven times (six attacks and one in stoppage time), each a
// dealt scenario with a 30-second clock: a build-up, a counter, a wide overload, a corner, a free
// kick (and a penalty when they foul you in the box). Joystick to run, SPRINT on stamina; PASS
// (tap along the grass, hold for a lofted ball or a cross), THRU into a runner's path; hold SHOOT
// and let go in the green, the stick aiming in the goal. Level with the rival at the end: penalties.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { crowd, loadSamples, sfx, vibrate } from '../../lib/sound';
import { reducedMotion } from '../../ui/motion';
import { screenRunInput } from '../football2/controls';
import { freeCanvas } from '../pixel/body';
import type { Progress, RivalLive } from '../progress';
import { frameAt, Recorder, type Replay, REPLAY_SPEED, replayTime, REPLAYS_IN_AUTOPLAY } from '../replay';
import { useInputInterrupt } from '../useInputInterrupt';
import { WaitLine } from '../Wait';
import { decide, pilot } from './autopilot';
import { cancelShoot, ctrlOf, kickOff, pass, passTarget, pressShoot, releaseShoot, setCurl, setSprint, settle, step } from './engine';
import type { SoccerKits } from './kits';
import { attackFor, ATTACKS, END_TEXT, minuteOf, newMatch, recordAttack, SCENARIO_HINTS, SCENARIO_NAMES, totalOf, type Match } from './match';
import { shotCone } from './ratings';
import { SoccerRenderer } from './render';
import { kickAttack, newShootout, nextKick, recordKick, score as soScore, type Shootout, type Side } from './shootout';
import type { Attack, AttackEnd, Body, Pt, Scenario, Squad } from './types';
import './soccer2.css';

type Ui = 'loading' | 'intro' | 'live' | 'after' | 'so-intro' | 'so-kick' | 'so-after' | 'final';
type Tone = 'good' | 'bad' | 'big' | 'plain' | 'green';

const DT = 1 / 60;
const RELEASE_LAG = 0.03;
/** PASS held this long (s) is a lofted ball, a cross */
const LOFT_HOLD = 0.22;

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
  onProgress,
  onDone,
  onShootout,
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
  /** the lab's QA hook: the live attack and match each frame */
  debug?: (a: Attack | null, m: Match, ui: string) => void;
  onProgress: (p: Progress) => void;
  onDone: (p: Progress) => void;
  onShootout?: (r: ShootoutResult) => void;
}) {
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
  const fxRef = useRef({ shake: 0, flash: 0 });
  const slowUntil = useRef(0);
  const stickRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const keys = useRef(new Set<string>());
  const passDown = useRef<{ id: number | 'key'; t: number } | null>(null);
  const shotPointer = useRef<number | 'key' | null>(null);
  const sprintPointer = useRef<number | 'key' | null>(null);
  const swipe = useRef<{ id: number; x0: number; y0: number; t0: number } | null>(null);
  const [ui, setUi] = useState<Ui>('loading');
  const uiRef = useRef<Ui>('loading');
  uiRef.current = ui;
  const [, setTick] = useState(0);
  const [pop, setPop] = useState<{ id: number; text: string; tone: Tone; sub?: string } | null>(null);
  const popId = useRef(0);
  const [hint, setHint] = useState<string | null>(null);
  const hinted = useRef(new Set<string>());
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [sprinting, setSprinting] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [wide, setWide] = useState(false);
  const clockRef = useRef<HTMLElement>(null);
  const rec = useRef(new Recorder<Snap>(5));
  const replayRef = useRef<Replay<Snap> | null>(null);
  const [replaying, setReplaying] = useState(false);
  const rivalRef = useRef(rival);
  rivalRef.current = rival;
  const [soView, setSoView] = useState<ReturnType<typeof soScore> & { marks: { side: Side; scored: boolean }[]; first: Side } | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  const finished = useRef(false);

  const say = (text: string, tone: Tone, ms = 1200, sub?: string) => {
    const id = ++popId.current;
    setPop({ id, text, tone, sub });
    window.setTimeout(() => setPop((p) => (p && p.id === id ? null : p)), ms);
  };
  const tip = (key: string, text: string) => {
    if (autoplayHook || hinted.current.has(key)) return;
    hinted.current.add(key);
    setHint(text);
    window.setTimeout(() => setHint((h) => (h === text ? null : h)), 4200);
  };
  const shake = (px: number) => {
    if (!reducedMotion()) fxRef.current.shake = Math.max(fxRef.current.shake, px);
  };
  const progress = (): Progress => ({ score: match.goals, drive: match.i, done: match.over, ends: match.ends.slice(), plays: match.i });
  const clearInput = () => {
    stickRef.current = null;
    keys.current.clear();
    passDown.current = null;
    shotPointer.current = null;
    sprintPointer.current = null;
    swipe.current = null;
    setKnob({ x: 0, y: 0 });
    setSprinting(false);
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
    atkRef.current = a;
    rec.current.clear();
    clearInput();
    pilotRef.current = pilot(0.75, seed + ':' + i);
    setUi('intro');
  };
  useEffect(() => {
    void loadSamples('stadium');
    crowd.start(0.24, 'stadium');
    if (forceShootout) startShootout();
    else lineUp(0);
    return () => crowd.stop(0.6);
  }, []);

  const kickOffNow = () => {
    const a = atkRef.current;
    if (!a || (uiRef.current !== 'intro' && uiRef.current !== 'so-intro')) return;
    kickOff(a);
    sfx.whistle();
    if (uiRef.current === 'so-intro') {
      setUi('so-kick');
      setGuess(null);
      if (usKicking.current) tip('pen', 'Aim with the stick · hold SHOOT, let go in the green');
      else tip('keep', 'Their kick · pick a way to dive, or trust your keeper');
      return;
    }
    setUi('live');
    const sc = a.scenario;
    if (sc === 'corner') tip('corner', 'Stick picks the man · hold PASS to whip it in');
    else if (sc === 'freekick') tip('fk', 'Swipe or BEND to curl it · hold SHOOT, let go in the green');
    else tip('move', 'Stick to run · SPRINT · PASS (hold: cross) · THRU · hold SHOOT');
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
      if (e === 'pass' || e === 'cross') sfx.kick();
      else if (e === 'shot' || e === 'header') {
        sfx.kick();
        crowd.swell(0.5);
      } else if (e === 'release-green') say('PERFECT!', 'green', 700);
      else if (e === 'control' || e === 'chest') sfx.catch();
      else if (e === 'save-catch' || e === 'claim' || e === 'smother') {
        sfx.catch();
        sfx.ooh();
        crowd.swell(0.7);
      } else if (e === 'save-parry') {
        sfx.hit(0.3);
        sfx.ooh();
        crowd.swell(0.8);
        if (!a.end) say('PARRIED!', 'plain', 900);
      } else if (e === 'post' || e === 'bar') {
        sfx.hit(0.6);
        sfx.ooh();
        shake(3);
        say(e === 'post' ? 'OFF THE POST!' : 'OFF THE BAR!', 'big', 1000);
      } else if (e === 'tackle') sfx.tackle(0.35);
      else if (e === 'beat') {
        crowd.swell(0.5);
        sfx.whoosh();
      } else if (e === 'block') sfx.hit(0.4);
      else if (e === 'intercept' || e === 'header-clear') sfx.kick();
      else if (e === 'foul') {
        sfx.whistle();
        sfx.tackle(0.6);
      } else if (e === 'penalty') {
        crowd.swell(1);
        say('PENALTY!', 'big', 1600, 'FOULED IN THE BOX');
        clearInput();
      } else if (e === 'freekick') {
        say('FREE KICK', 'good', 1300, 'FOULED');
        clearInput();
        tip('fk', 'Swipe or BEND to curl it · hold SHOOT, let go in the green');
      } else if (e === 'advantage') say('ADVANTAGE', 'plain', 800);
      else if (e === 'goal') {
        fxRef.current.flash = 0.45;
        slowUntil.current = performance.now() + 500;
        sfx.kick();
        sfx.roar();
        crowd.swell(1);
        vibrate([30, 40, 30]);
        shake(5);
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
    const e = recordAttack(match, a);
    clearInput();
    onProgress(progress());
    setUi('after');
    const text = a.end?.text ?? END_TEXT[e];
    const by = a.shotBy !== null ? a.bodies[a.shotBy].p.tag : '';
    if (e === 'G') say('GOAL!', 'big', 2200, by + (a.lastShot?.greened ? ' · PERFECT STRIKE' : ''));
    else if (e === 'S') say('SAVED', 'bad', 1500, text);
    else if (e === 'W') say(text === 'OVER THE BAR' ? 'OVER THE BAR' : 'WIDE', 'bad', 1400);
    else if (e === 'B') say('BLOCKED', 'bad', 1400, text);
    else if (e === 'O') say('OFFSIDE', 'bad', 1500, text.replace('OFFSIDE · ', ''));
    else if (e === 'T') say('TIME UP', 'plain', 1400, 'ATTACK OVER');
    else say('LOST IT', 'bad', 1400, text);
    if (e !== 'G') {
      window.setTimeout(() => sfx.whistle(), 200);
      if (e !== 'O') sfx.groan(e === 'S' || e === 'W' ? 0.8 : 0.5);
    }
    const replay = e === 'G' && !reducedMotion() && (!autoplayHook || REPLAYS_IN_AUTOPLAY) && !match.over;
    const next = () => {
      if (match.over) endMatch();
      else {
        if (match.i === Math.ceil(match.attacks / 2)) say('SECOND HALF', 'plain', 1300);
        else if (match.i === match.attacks) say('STOPPAGE TIME', 'big', 1500, 'ONE LAST ATTACK');
        lineUp(match.i);
      }
    };
    if (replay) window.setTimeout(() => startReplay(a, next), 1700);
    else window.setTimeout(next, e === 'G' ? 2500 : 1800);
  };

  const endMatch = () => {
    const r = rivalRef.current;
    sfx.fulltime();
    if (allowShootout && r && r.done && r.score === match.goals) {
      say('ALL SQUARE', 'big', 1700, 'PENALTIES');
      window.setTimeout(startShootout, 1500);
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
    if (ui !== 'final' || soRef.current || !allowShootout) return;
    if (rival && rival.done && rival.score === match.goals) {
      say('ALL SQUARE', 'big', 1700, 'PENALTIES');
      const t = window.setTimeout(startShootout, 1500);
      return () => clearTimeout(t);
    }
  }, [ui, rival?.done, rival?.score]);

  /* ---------- penalties ---------- */
  const startShootout = () => {
    if (soRef.current) return;
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
    window.setTimeout(() => revealPens(scored, i + 1), 1300);
  };
  const viewSo = () => {
    const so = soRef.current!;
    setSoView({ ...soScore(so), marks: so.kicks.map((k) => ({ side: k.side, scored: k.scored })), first: so.first });
  };
  const nextPen = () => {
    const so = soRef.current!;
    viewSo();
    if (so.done) {
      window.setTimeout(() => setUi('final'), 2300);
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
    window.setTimeout(nextPen, 1900);
  };

  /* ---------- replay ---------- */
  const startReplay = (a: Attack, done: () => void) => {
    const frames = rec.current.clip(a.t - 2.6, a.t + 0.9);
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
  /** the stick as an aim in the goal (null: centred, the game aims for you) */
  const aimNow = (): Pt | null => {
    const s = stickScreen();
    return Math.hypot(s.x, s.y) > 0.2 ? { x: Math.max(-1, Math.min(1, s.x)), y: Math.max(-1, Math.min(1, -s.y)) } : null;
  };
  const passDir = (): Pt | null => {
    const v = steerNow();
    return Math.hypot(v.x, v.y) > 0.1 ? v : null;
  };
  const live = () => (uiRef.current === 'live' || uiRef.current === 'so-kick') && !!atkRef.current && !atkRef.current.end && !(uiRef.current === 'so-kick' && !usKicking.current);

  const stickAt = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const R = r.width / 2 - 24;
    let x = (e.clientX - (r.left + r.width / 2)) / R;
    let y = (e.clientY - (r.top + r.height / 2)) / R;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    stickRef.current = { id: e.pointerId, x, y };
    setKnob({ x, y });
  };
  const stickDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (stickRef.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stickAt(e);
  };
  const stickMove = (e: React.PointerEvent) => {
    if (stickRef.current?.id === e.pointerId) stickAt(e);
  };
  const stickUp = (e: React.PointerEvent) => {
    if (stickRef.current?.id !== e.pointerId) return;
    stickRef.current = null;
    setKnob({ x: 0, y: 0 });
  };
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
    if (pass(a, held >= LOFT_HOLD ? 'lofted' : 'ground', passDir())) sfx.click();
  };
  const doThru = () => {
    const a = atkRef.current;
    if (a && live() && pass(a, 'through', passDir())) sfx.click();
  };
  const shootDown = (id: number | 'key') => {
    const a = atkRef.current;
    if (!a || !live() || shotPointer.current !== null) return false;
    if (!pressShoot(a)) return false;
    shotPointer.current = id;
    setShooting(true);
    return true;
  };
  const shootUp = (id: number | 'key') => {
    if (shotPointer.current !== id) return;
    shotPointer.current = null;
    setShooting(false);
    const a = atkRef.current;
    if (a && !a.end) releaseShoot(a, aimNow(), RELEASE_LAG);
  };
  const sprintOn = (id: number | 'key') => {
    const a = atkRef.current;
    if (!a || !live() || sprintPointer.current !== null) return;
    sprintPointer.current = id;
    setSprint(a, true);
    setSprinting(true);
  };
  const sprintOff = (id: number | 'key') => {
    if (sprintPointer.current !== id) return;
    sprintPointer.current = null;
    if (atkRef.current) setSprint(atkRef.current, false);
    setSprinting(false);
  };
  // keyboard: arrows/WASD run, Space shoot (hold), J pass (hold: cross), K through ball, Shift sprint
  useEffect(() => {
    if (autoplayHook) return;
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        keys.current.add(k);
        e.preventDefault();
      } else if (e.repeat) return;
      else if (k === ' ') {
        e.preventDefault();
        if (uiRef.current === 'intro' || uiRef.current === 'so-intro') kickOffNow();
        else shootDown('key');
      } else if (k === 'j') doPassDown('key');
      else if (k === 'k') doThru();
      else if (k === 'shift') sprintOn('key');
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.delete(k);
      if (k === ' ') shootUp('key');
      else if (k === 'j') doPassUp('key');
      else if (k === 'shift') sprintOff('key');
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  // the field: tap a teammate to pass to him; swipe across to bend a free kick
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
    if (Math.hypot(dx, dy) < 12 && ms < 350) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const id = renderer.bodyAt(a, ((e.clientX - r.left) * renderer.W) / r.width, ((e.clientY - r.top) * renderer.H) / r.height, 30);
      const c = a.ball.owner !== null ? a.bodies[a.ball.owner] : a.taker !== null ? a.bodies[a.taker] : null;
      if (id !== null && c && id !== c.id) {
        const to = a.bodies[id];
        if (pass(a, a.setPiece?.kind === 'corner' ? 'lofted' : 'ground', { x: to.x - c.x, y: to.y - c.y })) sfx.click();
      }
    }
  };

  /* ---------- the loop ---------- */
  useEffect(() => {
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
      renderer.resize(w, h);
      if (canvas.width !== renderer.W || canvas.height !== renderer.H) {
        canvas.width = renderer.W;
        canvas.height = renderer.H;
        canvas.style.width = renderer.W + 'px';
        canvas.style.height = renderer.H + 'px';
        setWide(w > h);
      }
      const a = atkRef.current;
      const elapsed = Math.min(0.1, (now - last) / 1000) * timeScale;
      last = now;
      const slow = now < slowUntil.current ? 0.35 : 1;
      const u = uiRef.current;
      if (a && (u === 'live' || u === 'so-kick') && !a.end && !replayRef.current) {
        acc += elapsed * slow;
        while (acc >= DT) {
          acc -= DT;
          const ai = autoplayHook || (u === 'so-kick' && !usKicking.current);
          step(a, DT, ai ? decide(a, pilotRef.current) : steerNow());
          handleEvents(a);
          if (a.end) {
            if (u === 'so-kick') finishPen(a);
            else finishAttack(a);
            break;
          }
        }
        rec.current.push(a.t, snapOf(a));
      } else if (a && a.end && !replayRef.current) {
        acc = 0;
        settle(a, elapsed * slow);
        handleEvents(a);
        rec.current.push(a.t, snapOf(a));
      } else acc = 0;
      debug?.(a, match, u);
      const ck = clockRef.current;
      if (ck && a) {
        const left = Math.max(0, Math.ceil(a.clock - a.used));
        ck.textContent = (left < 10 ? '0:0' : '0:') + left;
        ck.classList.toggle('low', left <= 5 && !a.end && u === 'live');
      }
      const fx = fxRef.current;
      fx.shake = Math.max(0, fx.shake - elapsed * 14);
      fx.flash = Math.max(0, fx.flash - elapsed * 1.8);
      const ctx = canvas.getContext('2d');
      if (!ctx || !a) return;
      const kitOf = (b: Body): 'us' | 'them' => ((b.side === 'A') === (u.startsWith('so') && !usKicking.current) ? 'them' : 'us');
      try {
        const rp = replayRef.current;
        if (rp) {
          const rt = replayTime(rp, now);
          const sn = rt === null ? null : frameAt(rp.frames, rt);
          if (rt === null || !sn) endReplay();
          else renderer.draw(ctx, { ...a, t: sn.t, bodies: sn.bodies, ball: sn.ball, meter: null, end: a.end }, { target: null, aim: null, shake: 0, flash: 0, names: false }, kitOf, 2);
        } else {
          const c = ctrlOf(a);
          const onBall = a.ball.owner === c.id || (a.setPiece && a.taker === c.id);
          const dir = passDir();
          const target = !autoplayHook && onBall && !a.meter && (dir || a.setPiece?.kind === 'corner') && a.setPiece?.kind !== 'penalty' ? (passTarget(a, dir, a.setPiece?.kind === 'corner' ? 'lofted' : 'ground')?.id ?? null) : null;
          renderer.draw(ctx, a, { target, aim: autoplayHook ? null : aimNow(), shake: fx.shake, flash: fx.flash, names: u === 'intro' }, kitOf, shotCone(c.p) * (a.meter ? 0.8 : 1));
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

  const a = atkRef.current;
  const total = totalOf(match);
  const inSo = ui.startsWith('so') || (ui === 'final' && !!soRef.current);
  const playing = ui === 'live' || (ui === 'so-kick' && usKicking.current);
  const sp = a?.setPiece?.kind ?? null;
  const theirKick = ui === 'so-kick' && !usKicking.current;
  const marks = match.ends;
  // between attacks the scoreboard still shows the one just played
  const shownI = ui === 'after' ? Math.max(0, match.i - 1) : Math.min(match.i, total - 1);
  return createPortal(
    <div className={'arcade-full hg2 sc2' + (wide ? ' wide' : '')} ref={wrapRef} onPointerDown={fieldDown} onPointerUp={fieldUp} onPointerCancel={() => (swipe.current = null)}>
      <canvas ref={canvasRef} className="hg2-canvas" />
      <div className="hg2-bug" aria-label="Score">
        <span className="us">
          <i>YOU</i>
          <b className="num">{match.goals}</b>
        </span>
        <span className="mid">
          {inSo && soView ? (
            <>
              <b>PENS</b>
              <small className="num">
                {soView.us}–{soView.them}
              </small>
            </>
          ) : match.over ? (
            <b>FULL TIME</b>
          ) : (
            <>
              <b>{minuteOf(match, shownI)}</b>
              <small>{SCENARIO_NAMES[match.deal[shownI]].toUpperCase()}</small>
              <em ref={clockRef} aria-label="Time left in the attack">
                0:30
              </em>
            </>
          )}
        </span>
        <span className="them">
          <i>{(rival?.name ?? rivalName).toUpperCase().slice(0, 8)}</i>
          <b className="num">{rival ? rival.score : '–'}</b>
        </span>
      </div>
      {!inSo && (
        <div className="hg2-marks sc2-marks" aria-label={'Attack ' + Math.min(match.i + 1, total) + ' of ' + total}>
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={(marks[i] ? 'e-' + marks[i] : i === match.i ? 'now' : '') + (i === Math.ceil(match.attacks / 2) ? ' half' : '') + (i === match.attacks ? ' stop' : '')}>
              {marks[i] ?? (i === match.attacks ? '+' : i === match.i ? i + 1 : '')}
            </i>
          ))}
        </div>
      )}
      {inSo && soView && <PenTally view={soView} rivalName={rival?.name ?? rivalName} />}
      {pop && (
        <div key={pop.id} className={'hg2-pop ' + pop.tone} role="status">
          {pop.text}
          {pop.sub && <small>{pop.sub}</small>}
        </div>
      )}
      {hint && <div className="hg2-hint sc2-hint">{hint}</div>}
      {replaying && (
        <button className="replay-banner" onPointerDown={(e) => (e.stopPropagation(), endReplay())} aria-label="Instant replay: tap to skip">
          <i />
          REPLAY
          <small>TAP TO SKIP</small>
        </button>
      )}
      {(ui === 'intro' || ui === 'so-intro') && a && !autoplayHook && (
        <div className="sc2-intro" onPointerDown={(e) => e.stopPropagation()}>
          {ui === 'intro' ? (
            <>
              <small>
                {match.i >= match.attacks ? 'STOPPAGE TIME' : 'ATTACK ' + (match.i + 1) + ' OF ' + match.attacks} · {minuteOf(match)}
              </small>
              <b>{SCENARIO_NAMES[a.scenario]}</b>
              <span>{SCENARIO_HINTS[a.scenario]}</span>
            </>
          ) : (
            <>
              <small>{usKicking.current ? 'YOUR KICK' : 'THEIR KICK'}</small>
              <b>{a.bodies[a.ctrl].p.name}</b>
              <span>{usKicking.current ? 'Aim with the stick · hold SHOOT, let go in the green' : 'Pick a way to dive before the kick'}</span>
            </>
          )}
          <button className="sc2-go" onClick={kickOffNow}>
            {ui === 'intro' ? 'KICK OFF' : usKicking.current ? 'STEP UP' : 'READY'}
          </button>
        </div>
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
      {playing && !autoplayHook && a && (
        <div className="hg2-pad sc2-pad">
          <div className="sc2-left">
            <div className="hg2-stick sc2-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp} onLostPointerCapture={stickUp} aria-label="Joystick: run, aim">
              <i style={{ transform: 'translate(' + knob.x * 30 + 'px,' + knob.y * 30 + 'px)' }} />
            </div>
          </div>
          <div className="hg2-btns sc2-btns" onPointerDown={(e) => e.stopPropagation()}>
            {sp !== 'penalty' && (
              <button
                className="hg2-pass"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  doPassDown(e.pointerId);
                }}
                onPointerUp={(e) => doPassUp(e.pointerId)}
                onPointerCancel={() => (passDown.current = null)}
                aria-label="Pass: tap along the grass, hold for a cross"
              >
                {sp === 'corner' ? 'CROSS' : 'PASS'}
                <small>{sp === 'corner' ? 'HOLD' : 'HOLD: LOB'}</small>
              </button>
            )}
            {!sp && (
              <button
                className="hg2-cross sc2-thru"
                onPointerDown={(e) => {
                  e.preventDefault();
                  doThru();
                }}
                aria-label="Through ball"
              >
                THRU
              </button>
            )}
            {!sp && (
              <button
                className={'fb2-burst sc2-sprint' + (sprinting ? ' held' : '')}
                aria-label="Sprint: hold"
                aria-pressed={sprinting}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  sprintOn(e.pointerId);
                }}
                onPointerUp={(e) => sprintOff(e.pointerId)}
                onPointerCancel={(e) => sprintOff(e.pointerId)}
                onLostPointerCapture={(e) => sprintOff(e.pointerId)}
              >
                SPRINT<small>HOLD</small>
              </button>
            )}
            {sp !== 'corner' && (
              <button
                className={'hg2-shoot' + (shooting ? ' held' : '')}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (shootDown(e.pointerId)) e.currentTarget.setPointerCapture?.(e.pointerId);
                }}
                onPointerUp={(e) => shootUp(e.pointerId)}
                onPointerCancel={() => {
                  shotPointer.current = null;
                  setShooting(false);
                  if (atkRef.current) cancelShoot(atkRef.current);
                }}
                aria-label="Shoot: hold, and let go in the green"
              >
                SHOOT
              </button>
            )}
          </div>
          {sp === 'freekick' && (
            <div className="sc2-bend" role="group" aria-label="Bend the free kick" onPointerDown={(e) => e.stopPropagation()}>
              {([-1, 0, 1] as const).map((k) => (
                <button
                  key={k}
                  aria-pressed={Math.sign(a.curl) === k && (k !== 0 || Math.abs(a.curl) < 0.05)}
                  onClick={() => {
                    setCurl(a, k * 0.75);
                    sfx.click();
                    setTick((n) => n + 1);
                  }}
                  aria-label={k === 0 ? 'No bend' : k < 0 ? 'Bend left' : 'Bend right'}
                >
                  {k === 0 ? 'STRAIGHT' : <Arrow dir={k} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {ui === 'final' && (
        <div className="fg-final hg2-final sc2-final" role="status">
          <span className="eyebrow">{soRef.current ? 'Penalties' : 'Your attacks'}</span>
          <b className="num">{soRef.current && soView ? soView.us + '–' + soView.them : match.goals}</b>
          {match.ends.length > 0 && <small>{match.ends.join(' · ')}</small>}
          {soRef.current && <small className="sc2-pens">{soRef.current.winner === 'us' ? 'YOU WIN THE SHOOTOUT' : 'YOU LOSE THE SHOOTOUT'}</small>}
          {rival && !rival.done && !soRef.current && <WaitLine rival={rival} unit="attack" total={total} />}
        </div>
      )}
      {ui === 'loading' && <div className="fg-loading">Walking out…</div>}
    </div>,
    document.body
  );
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
