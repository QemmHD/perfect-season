// Arcade football, Retro Bowl style: your offense against the rival's defense, eleven on eleven.
// Before the snap pick one of three play cards (its routes are drawn on the field) and SNAP. On a
// pass, drag back anywhere and let go to throw: the arc shows where it lands and who it's going to.
// With the ball in your hands, drag to steer; swipe across to juke, swipe up field to spin,
// double-tap to truck. Fourth down: go for it, kick on the meter, or punt.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lineup, Player } from '../../engine/types';
import { crowd, sfx, vibrate } from '../../lib/sound';
import { reducedMotion } from '../../ui/motion';
import { type Attrs, loadAttrs } from '../attrs';
import { luma, rgb } from '../pixel/color';
import type { FieldTheme } from '../pixel/field';
import type { Progress, RivalLive } from '../progress';
import { frameAt, Recorder, type Replay, REPLAY_AFTER, REPLAY_BEFORE, REPLAY_SPEED, replayTime, REPLAYS_IN_AUTOPLAY } from '../replay';
import { WaitLine } from '../Wait';
import { autoplay, decide, fourthDown, pilot } from './autopilot';
import { afterPlay, choices, downText, type DriveEnd, DRIVES, fgDistance, fgInRange, type Game, kick, kickWindow, newGame, type PlayChoice, punt, spotText, startChoice, startPlay } from './drive';
import { CONCEPT_NAMES, FIELD_W, maxThrow, moveWithBall, RUN_NAMES, scramble, snap, step, throwTo } from './engine';
import { type FbKit, FootballRenderer } from './render';
import { defenseOf, offenseOf } from './squad';
import type { Body, Defense, Offense, Play, Pt } from './types';

type Ui = 'loading' | 'pre' | 'fourth' | 'live' | 'after' | 'kick' | 'final';

/** What a replay needs to redraw a moment of a play. */
interface Snap {
  bodies: Body[];
  ball: Play['ball'];
  carrier: number | null;
  phase: Play['phase'];
}
const snapOf = (p: Play): Snap => ({ bodies: p.bodies.map((b) => ({ ...b, trail: [], route: b.route })), ball: p.ball ? { ...p.ball } : null, carrier: p.carrier ? p.carrier.id : null, phase: p.phase });
type Tone = 'good' | 'bad' | 'big' | 'plain' | 'green';

const DT = 1 / 60;
const MARK_TEXT: Record<DriveEnd, string> = { TD: 'TD', FG: 'FG', MISS: 'X', INT: 'INT', DOWNS: '–', PUNT: 'P', FUM: 'FUM', SAF: 'SAF' };

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

/** A home kit from a team's colors, and an away kit (white jerseys, the team's helmet). */
export function fbKitsFor(c1: string, c2: string): { home: FbKit; away: FbKit } {
  const light = luma(rgb(c2)) > 115;
  const pants = light ? c2 : '#ecebe4';
  return {
    home: { jersey: c1, trim: c2, pants, helmet: c1, stripe: c2, socks: c1, shoes: '#16161c', mask: light ? '#c9ccd2' : c2 },
    away: { jersey: '#f6f6f2', trim: c1, pants, helmet: c1, stripe: c2, socks: c1, shoes: '#16161c', mask: light ? '#c9ccd2' : c2 },
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
  rival,
  ourKit,
  theirKit,
  field,
  autoplayHook,
  timeScale = 1,
  onProgress,
  onDone,
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
  rival: RivalLive | null;
  ourKit: FbKit;
  theirKit: FbKit;
  /** your end zone (behind you) and theirs (the one you're going for) */
  field: FieldTheme;
  /** tests: let the autopilot play */
  autoplayHook?: boolean;
  /** the lab's slow motion, for filming the moves frame by frame (1 in the app) */
  timeScale?: number;
  onProgress: (p: Progress) => void;
  onDone: (p: Progress) => void;
}) {
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
  const game = useMemo<Game | null>(() => (attrs ? newGame(offense ?? offenseOf(lineup!, attrs, seed), rivalDefense ?? defenseOf(rivalLineup!, attrs, 'def:' + seed), seed, drives) : null), [attrs]);
  const renderer = useMemo(() => new FootballRenderer(field, [ourKit, theirKit]), []);
  const playRef = useRef<Play | null>(null);
  const pilotRef = useRef(pilot(0.75, seed));
  const fxRef = useRef({ shake: 0, flash: 0 });
  const slowUntil = useRef(0);
  // the slingshot: where the drag began and how far back it's pulled (css px)
  const dragRef = useRef<{ id: number; x0: number; y0: number; dx: number; dy: number } | null>(null);
  // steering: a stick that floats wherever the finger lands
  const stickRef = useRef<{ id: number; x0: number; y0: number; x: number; y: number } | null>(null);
  const kickRef = useRef<{ t0: number; stopped: number | null; dist: number; win: number } | null>(null);
  const [ui, setUi] = useState<Ui>('loading');
  const [, setTick] = useState(0);
  const [pop, setPop] = useState<{ id: number; text: string; tone: Tone; sub?: string } | null>(null);
  const popId = useRef(0);
  const [hint, setHint] = useState<string | null>(null);
  const hinted = useRef(new Set<string>());
  const [wide, setWide] = useState(false);
  const [float, setFloat] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const [phase, setPhase] = useState<Play['phase']>('pre');
  // the three play cards for this down, and the one lined up
  const [opts, setOpts] = useState<{ choice: PlayChoice; play: Play }[]>([]);
  const [picked, setPicked] = useState(0);
  // a swipe in progress (a fast flick reads as a move; a slow drag steers) and the last tap (double-tap)
  const gesture = useRef<{ id: number; t0: number; x0: number; y0: number; used: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const openRings = useMemo(() => gamesPlayed() < OPEN_RING_GAMES, []);
  const counted = useRef(false);
  // instant replay: the last seconds of play, the highlight to show, the replay running
  const rec = useRef(new Recorder<Snap>(6));
  const highlight = useRef<{ t: number; x: number; y: number; before: number } | null>(null);
  const replayRef = useRef<Replay<Snap> | null>(null);
  const [replaying, setReplaying] = useState(false);

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
  const progress = (g: Game): Progress => ({ score: g.score, drive: g.drive, done: g.over, ends: g.ends.slice(), plays: g.plays });
  const shake = (px: number) => {
    if (!reducedMotion()) fxRef.current.shake = Math.max(fxRef.current.shake, px);
  };

  /** Line up the next snap: three play cards, the first lined up with its routes until you pick another. */
  const lineUpNext = (g: Game) => {
    const cs = choices(g);
    const lined = cs.map((choice) => ({ choice, play: startChoice(g, choice) }));
    setOpts(lined);
    setPicked(0);
    playRef.current = startChoice(g, cs[0]);
    dragRef.current = null;
    stickRef.current = null;
    gesture.current = null;
    setFloat(null);
    setPhase('pre');
    setUi(g.down === 4 ? 'fourth' : 'pre');
    if (g.down !== 4) tip('call', 'Pick a play · its routes show on the field · SNAP');
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
    playRef.current = startChoice(game, opts[i].choice);
  };
  const snapNow = () => {
    if (!game || (ui !== 'pre' && ui !== 'fourth')) return;
    const p = playRef.current;
    if (!p || p.phase !== 'pre') return;
    sfx.click();
    pilotRef.current.readAt = 0;
    snap(p);
    setUi('live');
    setPhase(p.phase);
    if (p.call === 'pass') tip('pass', 'Drag back anywhere · let go to throw');
    else tip('run', 'Drag to steer · swipe ← → juke · swipe ↑ spin · double-tap truck');
  };

  const nextUp = (g: Game, driveOver: boolean, wait: number) => {
    onProgress(progress(g));
    window.setTimeout(() => {
      if (g.over) {
        setUi('final');
        if (!counted.current) {
          counted.current = true;
          countGame();
        }
        onDone(progress(g));
        return;
      }
      if (driveOver) say('DRIVE ' + (g.drive + 1) + ' OF ' + g.drives, 'plain', 1100);
      lineUpNext(g);
    }, wait);
  };

  const handleEvents = (p: Play) => {
    for (const e of p.events) {
      if (e === 'snap') sfx.hit(0.15);
      else if (e === 'handoff') sfx.catch();
      else if (e === 'pancake') sfx.hit(0.6);
      else if (e === 'throw' || e === 'throw-pressure' || e === 'scramble') sfx.whoosh();
      else if (e === 'catch') {
        sfx.catch();
        crowd.swell(0.3);
        tip('runafter', 'Drag to steer · swipe ← → juke · swipe ↑ spin · double-tap truck');
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
        if ((kind === 'truck' || kind === 'stiff') && p.carrier && !highlight.current) highlight.current = { t: p.t, x: p.carrier.x, y: p.carrier.y, before: REPLAY_BEFORE };
        vibrate([20, 30, 20]);
        crowd.swell(0.8);
        shake(kind === 'truck' ? 4 : 2);
        if (kind === 'truck') slowUntil.current = performance.now() + 450;
        say(kind === 'juke' ? 'JUKED!' : kind === 'spin' ? 'SPIN MOVE!' : kind === 'truck' ? 'TRUCKED!' : 'STIFF ARM!', 'big', 900);
      } else if (e === 'break') {
        sfx.hit(0.4);
        crowd.swell(0.5);
        say('BROKE A TACKLE', 'good', 800);
      } else if (e === 'bighit') {
        if (p.carrier) highlight.current = { t: p.t, x: p.carrier.x, y: p.carrier.y, before: REPLAY_BEFORE };
        // the hit lands in slow motion
        slowUntil.current = performance.now() + 750;
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

  const finish = (p: Play) => {
    if (!game) return;
    const e = p.end!;
    dragRef.current = null;
    stickRef.current = null;
    setFloat(null);
    setPhase('dead');
    const a = afterPlay(game, e);
    setUi('after');
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
    } else if (e.text.startsWith('BIG HIT')) {
      say('BIG HIT!', 'big', 1500, e.text.slice(4) + ' · ' + gain);
    } else if (a.driveOver === 'DOWNS') {
      sfx.groan(0.8);
      say('TURNOVER ON DOWNS', 'bad', 1600, e.kind === 'incomplete' ? e.text : gain);
    } else if (a.firstDown) {
      sfx.cheer(yds >= 20 ? 0.9 : 0.45);
      crowd.swell(yds >= 20 ? 0.9 : 0.45);
      say(yds >= 20 ? 'BIG PLAY · FIRST DOWN' : 'FIRST DOWN', yds >= 20 ? 'big' : 'good', 1300, gain);
    } else if (e.kind === 'incomplete') {
      sfx.groan(0.4);
      say(e.text, 'plain', 1100);
    } else if (e.kind === 'sack') say(e.text, 'bad', 1300, gain);
    else say(gain, yds > 0 ? 'good' : 'plain', 1000, e.kind === 'out' ? 'OUT OF BOUNDS' : undefined);
    if (a.points && yds >= 25 && !highlight.current) {
      const c = p.carrier ?? p.catcher;
      if (c) highlight.current = { t: p.t, x: c.x, y: c.y - 6, before: 2.4 };
    }
    // the whistle: the play's dead (a touchdown has its horn)
    if (!a.points) window.setTimeout(() => sfx.whistle(), 220);
    const hl = highlight.current;
    highlight.current = null;
    // (not the game's last play: it's reported done, and the results come next)
    if (hl && !game.over && (!autoplayHook || REPLAYS_IN_AUTOPLAY) && !reducedMotion()) {
      onProgress(progress(game));
      window.setTimeout(() => startReplay(hl, () => nextUp(game, !!a.driveOver, 250)), a.points ? 1500 : 1100);
    } else nextUp(game, !!a.driveOver, a.points ? 2300 : a.driveOver ? 1900 : 1350);
  };

  /** Play the highlight again, slower, from closer; then on with the drive. */
  const startReplay = (hl: { t: number; x: number; y: number; before: number }, done: () => void) => {
    const frames = rec.current.clip(hl.t - hl.before, hl.t + REPLAY_AFTER);
    if (frames.length < 10) {
      done();
      return;
    }
    replayRef.current = { frames, t0: frames[0].t, t1: frames[frames.length - 1].t, start: performance.now(), speed: REPLAY_SPEED, focus: { a: hl.x, b: hl.y }, done };
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
    kickRef.current = { t0: performance.now(), stopped: null, dist: fgDistance(game), win: kickWindow(game) };
    setUi('kick');
  };
  const kickNow = () => {
    const k = kickRef.current;
    const p = playRef.current;
    if (!game || !p || !k || k.stopped !== null) return;
    const ph = ((performance.now() - k.t0) / 1100) % 2;
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
    window.setTimeout(() => setUi('after'), 450);
    window.setTimeout(() => {
      kick(game, aim);
      if (good) {
        sfx.cheer(1);
        crowd.swell(0.9);
        say('IT’S GOOD! +3', 'good', 1600, k.dist + ' YARDS');
      } else {
        sfx.groan(1);
        say('NO GOOD', 'bad', 1500, side < 0 ? 'WIDE LEFT' : 'WIDE RIGHT');
      }
      nextUp(game, true, 1700);
    }, 1000);
    window.setTimeout(() => {
      kickRef.current = null;
      kickAnim.current = null;
      // the kick play is over: nothing steps it again (the game may be over and keep showing it)
      p.phase = 'dead';
    }, 2650);
  };
  const puntNow = () => {
    if (!game || ui !== 'fourth') return;
    sfx.kick();
    punt(game);
    say('PUNT', 'plain', 1100, 'DRIVE OVER');
    setUi('after');
    nextUp(game, true, 1300);
  };

  // the autopilot calls the plays in tests
  useEffect(() => {
    if (!autoplayHook || !game) return;
    const t = window.setTimeout(() => {
      if (ui === 'pre') {
        const i = pilotRef.current.rand() < 0.3 ? 2 : pilotRef.current.rand() < 0.5 ? 1 : 0;
        if (opts[i]) playRef.current = startChoice(game, opts[i].choice);
        snapNow();
      } else if (ui === 'fourth') {
        const d = fourthDown(game);
        if (d === 'kick') startKick();
        else if (d === 'punt') puntNow();
        else snapNow();
      } else if (ui === 'kick') kickNow();
    }, ui === 'kick' ? 700 : 450);
    return () => clearTimeout(t);
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

  /** Where the runner heads across the field, from the floating stick. */
  const steerNow = (p: Play): number | null => {
    const s = stickRef.current;
    const c = p.carrier;
    if (!s || !c) return null;
    const across = renderer.mode === 'side' ? -s.y : s.x;
    return Math.abs(across) < 0.12 ? c.x : c.x + across * 8;
  };

  // the loop: fixed steps for the play, a draw every frame
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
      renderer.resize(w, h);
      if (canvas.width !== renderer.W || canvas.height !== renderer.H) {
        canvas.width = renderer.W;
        canvas.height = renderer.H;
        canvas.style.width = renderer.W * renderer.zoom + 'px';
        canvas.style.height = renderer.H * renderer.zoom + 'px';
        setWide(w > h);
      }
      const p = playRef.current;
      const fx = fxRef.current;
      const elapsed = Math.min(0.1, (now - last) / 1000) * timeScale;
      last = now;
      acc += now < slowUntil.current ? elapsed * 0.4 : elapsed;
      if (p && p.end) {
        // after the whistle: the hit lands, the tackled man slides, the pile settles
        const vis = now < slowUntil.current ? elapsed * 0.4 : elapsed;
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
      fx.shake = Math.max(0, fx.shake - elapsed * 14);
      fx.flash = Math.max(0, fx.flash - elapsed * 1.8);
      const ctx = canvas.getContext('2d')!;
      const rp = replayRef.current;
      if (rp && p) {
        const rt = replayTime(rp, now);
        const sn = rt === null ? null : frameAt(rp.frames, rt);
        if (rt === null || !sn) endReplay();
        else {
          const at = (b: Body) => sn.bodies[b.id];
          const view: Play = { ...p, t: rt, bodies: sn.bodies, qb: at(p.qb), rb: at(p.rb), carrier: sn.carrier !== null ? sn.bodies[sn.carrier] : null, ball: sn.ball, phase: sn.phase };
          renderer.draw(ctx, view, p.los, { aim: null, toGain: null, routes: false, open: false, shake: 0, flash: 0 });
        }
      } else if (p) renderer.draw(ctx, p, p.los, { aim: aimNow(p), toGain: kickRef.current || p.end || game.ballOn + game.toGo > 100 ? null : p.los + game.toGo, routes: p.phase === 'pre' && p.call === 'pass', open: openRings && !autoplayHook, shake: fx.shake, flash: fx.flash });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  // ---- touch: the slingshot while he's back to throw; once someone's running (or the ball's in the
  // air on its way to him), a stick that floats where the finger lands, with flicks for moves ----
  const move3 = (p: Play, kind: 'juke' | 'spin' | 'power', dir = 0) => {
    const c = p.carrier;
    if (!c || p.phase !== 'run') return;
    if (kind === 'power') moveWithBall(p, (c.p.a.TRK ?? 50) >= (c.p.a.SFA ?? 50) ? 'truck' : 'stiff');
    else moveWithBall(p, kind, dir);
  };
  const down = (e: React.PointerEvent) => {
    const p = playRef.current;
    if (!p || ui !== 'live' || autoplayHook) return;
    // one finger drives at a time
    if (dragRef.current || stickRef.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (p.phase === 'drop' && p.call === 'pass' && p.carrier === p.qb) {
      dragRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    } else if (p.phase === 'run' || p.phase === 'air' || (p.phase === 'drop' && p.call === 'run')) {
      const now = performance.now();
      const t = lastTap.current;
      // a double-tap: lower the shoulder (a truck, or a stiff arm for the man who's better at it)
      if (t && now - t.t < 300 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 60) {
        move3(p, 'power');
        lastTap.current = null;
      } else lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      stickRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
      gesture.current = { id: e.pointerId, t0: now, x0: e.clientX, y0: e.clientY, used: false };
      setFloat({ x: e.clientX, y: e.clientY, kx: 0, ky: 0 });
    }
  };
  const move = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d && d.id === e.pointerId) {
      d.dx = e.clientX - d.x0;
      d.dy = e.clientY - d.y0;
      return;
    }
    const s = stickRef.current;
    if (!s || s.id !== e.pointerId) return;
    // a flick (far, fast) is a move: across the field a juke that way, up the field a spin
    const g = gesture.current;
    const p = playRef.current;
    if (g && p && !g.used && performance.now() - g.t0 < 240) {
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (Math.hypot(dx, dy) > 46) {
        g.used = true;
        const upField = renderer.mode === 'side' ? dx : -dy;
        const across = renderer.mode === 'side' ? -dy : dx;
        if (upField > Math.abs(across) * 1.2) move3(p, 'spin');
        else if (Math.abs(across) > Math.abs(upField)) move3(p, 'juke', Math.sign(across));
        // steer from here on, not from where the flick began
        s.x0 = e.clientX;
        s.y0 = e.clientY;
        s.x = 0;
        s.y = 0;
        setFloat({ x: s.x0, y: s.y0, kx: 0, ky: 0 });
        return;
      }
    }
    const R = 46;
    let x = (e.clientX - s.x0) / R;
    let y = (e.clientY - s.y0) / R;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    s.x = x;
    s.y = y;
    setFloat({ x: s.x0, y: s.y0, kx: x, ky: y });
  };
  const up = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const p = playRef.current;
    if (d && d.id === e.pointerId) {
      const aim = p ? aimNow(p) : null;
      dragRef.current = null;
      if (p && aim && throwTo(p, aim)) setPhase(p.phase);
      return;
    }
    const s = stickRef.current;
    if (s && s.id === e.pointerId) {
      stickRef.current = null;
      gesture.current = null;
      setFloat(null);
    }
  };
  /** The touch taken away (a system swipe from an edge, a call): let go of everything, throw nothing. */
  const cancel = (e: React.PointerEvent) => {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
    const s = stickRef.current;
    if (s && s.id === e.pointerId) {
      stickRef.current = null;
      gesture.current = null;
      setFloat(null);
    }
  };
  const doScramble = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const p = playRef.current;
    if (p && scramble(p)) {
      dragRef.current = null;
      setPhase(p.phase);
    }
  };

  const g = game;
  const p = playRef.current;
  const fgOk = g ? fgInRange(g) : false;
  const passing = ui === 'live' && phase === 'drop' && p?.call === 'pass';
  return createPortal(
    <div className={'arcade-full hg2 fb2' + (wide ? ' wide' : '')} ref={wrapRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}>
      <canvas ref={canvasRef} className="hg2-canvas" />
      <div className="hg2-bug" aria-label="Score">
        <span className="us">
          <i>YOU</i>
          <b className="num">{g?.score ?? 0}</b>
        </span>
        <span className="mid">
          {g && !g.over ? (
            <>
              <b>{downText(g)}</b>
              <small>{spotText(g.ballOn)}</small>
            </>
          ) : (
            <b>FINAL</b>
          )}
        </span>
        <span className="them">
          <i>{(rival?.name ?? rivalName).toUpperCase().slice(0, 8)}</i>
          <b className="num">{rival ? rival.score : '–'}</b>
        </span>
      </div>
      {g && (
        <div className="hg2-marks" aria-label={'Drive ' + Math.min(g.drive + 1, g.drives) + ' of ' + g.drives}>
          {Array.from({ length: g.drives }, (_, i) => (
            <i key={i} className={g.ends[i] ? 'e-' + g.ends[i] : i === g.drive ? 'now' : ''}>
              {g.ends[i] ? MARK_TEXT[g.ends[i]] : i === g.drive ? 'D' + (i + 1) : ''}
            </i>
          ))}
        </div>
      )}
      {pop && (
        <div key={pop.id} className={'hg2-pop ' + pop.tone} role="status">
          {pop.text}
          {pop.sub && <small>{pop.sub}</small>}
        </div>
      )}
      {hint && <div className="hg2-hint">{hint}</div>}
      {replaying && (
        <button className="replay-banner" onPointerDown={(e) => (e.stopPropagation(), endReplay())} aria-label="Instant replay: tap to skip">
          <i />
          REPLAY
          <small>TAP TO SKIP</small>
        </button>
      )}
      {ui === 'loading' && <div className="fg-loading">Taking the field…</div>}
      {float && (
        <div className="fb2-float" style={{ left: float.x, top: float.y }} aria-hidden="true">
          <i style={{ transform: 'translate(' + float.kx * 30 + 'px,' + float.ky * 30 + 'px)' }} />
        </div>
      )}
      {(ui === 'pre' || ui === 'fourth') && g && p && !autoplayHook && (
        <div className="fb2-call" onPointerDown={(e) => e.stopPropagation()}>
          {ui === 'fourth' && (
            <span className="fb2-4th">
              {downText(g)} · {fgOk ? fgDistance(g) + ' YD FIELD GOAL IN RANGE' : 'OUT OF FIELD GOAL RANGE'}
            </span>
          )}
          <div className="fb2-cards" role="radiogroup" aria-label="Pick a play">
            {opts.map((o, i) => (
              <button key={i} className={'fb2-card ' + o.choice.call + (i === picked ? ' on' : '')} role="radio" aria-checked={i === picked} onClick={() => pick(i)}>
                <PlayArt play={o.play} />
                <small>{o.choice.call === 'pass' ? 'PASS' : 'RUN'}</small>
                <b>{o.choice.call === 'pass' ? CONCEPT_NAMES[o.choice.concept] : RUN_NAMES[o.choice.run]}</b>
              </button>
            ))}
          </div>
          <div className="fb2-btns">
            <button className="fb2-go snap" onClick={snapNow}>
              {ui === 'fourth' ? 'GO FOR IT' : 'SNAP'}
            </button>
            {ui === 'fourth' && fgOk && (
              <button className="fb2-go kick" onClick={startKick}>
                KICK
              </button>
            )}
            {ui === 'fourth' && (
              <button className="fb2-go punt" onClick={puntNow}>
                PUNT
              </button>
            )}
          </div>
        </div>
      )}
      {passing && !autoplayHook && (
        <div className="fb2-moves" onPointerDown={(e) => e.stopPropagation()}>
          <button className="fb2-mv scramble" onPointerDown={doScramble} aria-label="Scramble: the quarterback runs">
            RUN IT
          </button>
        </div>
      )}
      {ui === 'kick' && kickRef.current && <KickMeter window={kickRef.current.win} start={kickRef.current.t0} stopped={kickRef.current.stopped} distance={kickRef.current.dist} onKick={kickNow} />}
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

function KickMeter({ window: win, start, stopped, distance, onKick }: { window: number; start: number; stopped: number | null; distance: number; onKick: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (stopped !== null) return;
    let raf = 0;
    const loop = () => {
      force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stopped]);
  const ph = ((performance.now() - start) / 1100) % 2;
  const pos = stopped ?? (ph < 1 ? ph : 2 - ph);
  return (
    <button
      className="fb2-kick"
      onPointerDown={(e) => {
        e.stopPropagation();
        onKick();
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

const ART_COLOR: Record<string, string> = { X: '#ffd23a', SL: '#ff7aa8', Z: '#5cb8ff', TE: '#7cf08c', RB: '#c7a2ff' };

/** A play card's drawing: the line, the backs, and each route (or the run's path) in its color. */
function PlayArt({ play }: { play: Play }) {
  const { bx, los } = play;
  const X = (x: number) => 50 + (x - bx) * 2.3;
  const Y = (y: number) => 52 - (y - los) * 1.55;
  const paths: { color: string; pts: [number, number][] }[] = [];
  if (play.call === 'pass') {
    for (const b of play.bodies) {
      if (b.side !== 'O' || !b.route.length || !ART_COLOR[b.slot]) continue;
      paths.push({ color: ART_COLOR[b.slot], pts: [[X(b.x), Y(b.y)], ...b.route.map((w) => [X(w.x), Y(w.y)] as [number, number])] });
    }
  } else {
    // the back's path: up the middle, bounced outside, or off tackle behind a pulling guard
    const rb = play.rb;
    const side = rb.x < bx ? 1 : -1;
    const pts: [number, number][] =
      play.run === 'outside'
        ? [[X(rb.x), Y(rb.y)], [X(bx + side * 6), Y(los - 2)], [X(bx + side * 10), Y(los + 7)]]
        : play.run === 'power'
          ? [[X(rb.x), Y(rb.y)], [X(bx + side * 2.5), Y(los - 1)], [X(bx + side * 3.5), Y(los + 7)]]
          : [[X(rb.x), Y(rb.y)], [X(bx + 0.6), Y(los)], [X(bx + 0.6), Y(los + 8)]];
    paths.push({ color: ART_COLOR.RB, pts });
  }
  const end = (pts: [number, number][]) => {
    const [ax, ay] = pts[pts.length - 2];
    const [ex, ey] = pts[pts.length - 1];
    const a = Math.atan2(ey - ay, ex - ax);
    return [ex + Math.cos(a) * 3, ey + Math.sin(a) * 3, ex + Math.cos(a + 2.4) * 3, ey + Math.sin(a + 2.4) * 3, ex + Math.cos(a - 2.4) * 3, ey + Math.sin(a - 2.4) * 3].join(',');
  };
  return (
    <svg className="fb2-art" viewBox="0 0 100 64" aria-hidden="true">
      <line x1="0" y1={Y(los)} x2="100" y2={Y(los)} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      {play.bodies
        .filter((b) => b.side === 'O')
        .map((b) => (b.slot === 'LT' || b.slot === 'LG' || b.slot === 'C' || b.slot === 'RG' || b.slot === 'RT' ? <rect key={b.id} x={X(b.x) - 1.6} y={Y(b.y) - 1.6} width="3.2" height="3.2" fill="#d8dee8" /> : <circle key={b.id} cx={X(b.x)} cy={Y(b.y)} r="1.9" fill={ART_COLOR[b.slot] ?? '#ffffff'} />))}
      {paths.map((pa, i) => (
        <g key={i}>
          <polyline points={pa.pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={pa.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          <polygon points={end(pa.pts)} fill={pa.color} />
        </g>
      ))}
    </svg>
  );
}

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
export function aiDrives2(rivalLineup: Lineup, yourLineup: Lineup, seed: string, skill: number, attrs: (p: Player) => Attrs | null, drives = DRIVES): Progress {
  return aiDrivesOf(offenseOf(rivalLineup, attrs, 'ai:' + seed), defenseOf(yourLineup, attrs, 'aidef:' + seed), seed, skill, drives);
}

/** The same from the teams themselves (Ultimate Team): one side's offense against the other's defense. */
export function aiDrivesOf(offense: Offense, defense: Defense, seed: string, skill: number, drives = DRIVES): Progress {
  const g = newGame(offense, defense, 'ai:' + seed, drives);
  autoplay(g, skill, 'ai:' + seed);
  return { score: g.score, drive: g.drive, done: true, ends: g.ends.slice(), plays: g.plays };
}
