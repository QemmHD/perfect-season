// Arcade basketball, the way it's played: your five on offense against the rival's five. Left thumb
// on the stick moves the man with the ball; PASS throws to the man the stick points at (a lob to a
// dunker on the cut); CROSS breaks down your man; hold SHOOT to rise and let go in the green.
// Held upright the camera looks up the floor; sideways it's the sideline view.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lineup, Player } from '../../engine/types';
import { crowd, sfx, vibrate } from '../../lib/sound';
import { reducedMotion } from '../../ui/motion';
import { type Attrs, loadAttrs } from '../attrs';
import type { CourtTheme } from '../pixel/court';
import type { Progress, RivalLive } from '../progress';
import { frameAt, Recorder, type Replay, REPLAY_AFTER, REPLAY_BEFORE, REPLAY_SPEED, replayTime, REPLAYS_IN_AUTOPLAY } from '../replay';
import { WaitLine } from '../Wait';
import { autoplay, decide, pilot } from './autopilot';
import { aimPass, crossover, pass, pressShoot, releaseShoot, RIM, spin, step, stepback } from './engine';
import { afterPossession, half, type HoopsGame, type Mark, newHoopsGame, POSSESSIONS, startPossession } from './game';
import { hooper, lineOf, SPOTS } from './ratings';
import { type Fx, HoopsRenderer, type Kit } from './render';
import type { Body, Hooper, Possession, Pt, Scheme } from './types';

const DT = 1 / 60;
/** what a phone's screen and touch add between what you saw and the release it hears (seconds) */
const RELEASE_LAG = 0.03;

/** What a replay needs to redraw a moment of a possession. */
interface Snap {
  bodies: Body[];
  ball: Possession['ball'];
  handler: number | null;
  fire: number;
  lastShot: Possession['lastShot'];
}
const snapOf = (p: Possession): Snap => ({ bodies: p.bodies.map((b) => ({ ...b, trail: [] })), ball: p.ball ? { ...p.ball } : null, handler: p.handler, fire: p.fire, lastShot: p.lastShot });
const MARK_TEXT: Record<Mark, string> = { '2': '2', '3': '3', A: '3', X: '–', TO: 'TO' };
/** The defense's looks, and what beats each. */
const LOOK_TEXT: Record<Scheme, string> = { man: 'MAN-TO-MAN', sag: 'SAGGING OFF', switch: 'SWITCHING', trap: 'TRAPPING' };
const LOOK_TIP: Record<Scheme, string> = { man: 'beat your man', sag: 'shoot over it', switch: 'attack the mismatch', trap: 'move it early' };

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
    away: { jersey: '#f6f6f2', trim: c1, shorts: '#f6f6f2', socks: '#f4f4f4', shoes: '#f4f4f4' },
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
  rival,
  ourKit,
  theirKit,
  court,
  autoplayHook,
  timeScale = 1,
  onProgress,
  onDone,
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
  rival: RivalLive | null;
  ourKit: Kit;
  theirKit: Kit;
  /** the home court: the defending team's colors and letters */
  court: CourtTheme;
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
  const game = useMemo<HoopsGame | null>(() => (attrs ? newHoopsGame(five ?? fiveOf(lineup!, attrs), rivalFive ?? fiveOf(rivalLineup!, attrs), seed, possessions, bench) : null), [attrs]);
  const renderer = useMemo(() => new HoopsRenderer(court, [ourKit, theirKit]), []);
  const possRef = useRef<Possession | null>(null);
  const stickRef = useRef<{ x: number; y: number } | null>(null);
  const pilotRef = useRef(pilot(0.75, seed));
  const fxRef = useRef<Fx>({ swish: 0, shake: 0, crowd: 0, flash: 0 });
  const slowUntil = useRef(0);
  const [between, setBetween] = useState(true);
  const [, setTick] = useState(0);
  const [pop, setPop] = useState<{ id: number; text: string; tone: 'good' | 'bad' | 'big' | 'plain' | 'green' } | null>(null);
  /** the defense's look this possession, named under the scoreboard */
  const [look, setLook] = useState<{ scheme: Scheme; trapped: boolean } | null>(null);
  const popId = useRef(0);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [hint, setHint] = useState<string | null>('Stick: move, push it to the edge to sprint · flick ← → crossover · flick ↓ step-back · flick ↑ spin · hold SHOOT, let go in the green');
  const [wide, setWide] = useState(false);
  // instant replay: the last seconds of play, the highlight to show, the replay running
  const rec = useRef(new Recorder<Snap>(5));
  const highlight = useRef<{ t: number; cx: number; cz: number } | null>(null);
  const replayRef = useRef<Replay<Snap> | null>(null);
  /** where the dribble was in its beat last frame (the bounce sounds as it hits the floor) */
  const lastBeat = useRef(1);
  const [replaying, setReplaying] = useState(false);

  const say = (text: string, tone: 'good' | 'bad' | 'big' | 'plain' | 'green', ms = 1200) => {
    const id = ++popId.current;
    setPop({ id, text, tone });
    window.setTimeout(() => setPop((p) => (p && p.id === id ? null : p)), ms);
  };
  const progress = (g: HoopsGame): Progress => ({ score: g.score, drive: g.done, done: g.over, ends: g.marks.slice(), plays: g.done });
  const shake = (px: number) => {
    if (!reducedMotion()) fxRef.current.shake = Math.max(fxRef.current.shake, px);
  };

  const next = (g: HoopsGame) => {
    possRef.current = startPossession(g);
    const pl = pilotRef.current;
    pl.letGo = null;
    pl.driving = false;
    pl.goal = null;
    pl.nextThink = 0;
    pl.crosses = 0;
    setBetween(false);
    setTick((n) => n + 1);
    if (g.done === g.total / 2) say('SECOND HALF', 'plain', 1300);
  };

  useEffect(() => {
    if (!game) return;
    crowd.start(0.24);
    const t = window.setTimeout(() => next(game), 700);
    const h = window.setTimeout(() => setHint(null), 7000);
    return () => {
      clearTimeout(t);
      clearTimeout(h);
      crowd.stop(0.6);
    };
  }, [game]);

  /** The stick as a direction on the court (the two cameras turn it differently). */
  const stickOnCourt = (): Pt | null => {
    const s = stickRef.current;
    if (!s) return null;
    return renderer.cam?.mode === 'end' ? { cx: -s.y, cz: s.x } : { cx: s.x, cz: s.y };
  };

  const handleEvents = (p: Possession) => {
    const fx = fxRef.current;
    for (const e of p.events) {
      if (e.startsWith('scheme:')) setLook({ scheme: e.slice(7) as Scheme, trapped: false });
      else if (e.startsWith('trap:')) {
        setLook({ scheme: 'trap', trapped: true });
        sfx.squeak();
        vibrate(12);
        say('DOUBLE TEAM!', 'plain', 800);
      } else if (e === 'pass') sfx.whoosh();
      else if (e === 'lob') {
        sfx.whoosh();
        say('LOB!', 'plain', 600);
      } else if (e === 'catch' || e === 'oop-catch') sfx.catch();
      else if (e === 'rise' || e.startsWith('cut:')) sfx.squeak();
      else if (e === 'release-green') {
        sfx.coin();
        vibrate(15);
        say('GREEN!', 'green', 800);
      } else if (e === 'release') {
        const ls = p.lastShot;
        if (ls) {
          const o = ls.off;
          // off is a share of a quarter second: under 80 ms is close
          say(Math.abs(o) < 0.32 ? (o < 0 ? 'SLIGHTLY EARLY' : 'SLIGHTLY LATE') : o < 0 ? 'VERY EARLY' : 'VERY LATE', 'plain', 700);
        }
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
          vibrate([25, 40, 25]);
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
        vibrate(30);
        shake(3);
        const d = p.bodies[Number(e.slice(8))];
        say('REJECTED BY ' + d.p.tag, 'bad', 1100);
      } else if (e === 'rim') sfx.rim();
      else if (e.startsWith('orb:')) {
        sfx.catch();
        say('OFFENSIVE BOARD', 'good', 800);
        crowd.swell(0.4);
      }
    }
    p.events.length = 0;
  };

  const finish = (p: Possession) => {
    if (!game) return;
    const e = p.end!;
    const wasFire = game.fire;
    const mark = afterPossession(game, p);
    const fx = fxRef.current;
    if (e.kind === 'make') {
      fx.swish = 1;
      const ls = p.lastShot;
      const big = ls?.kind === 'three' || ls?.kind === 'dunk' || ls?.kind === 'contact' || ls?.kind === 'oop' || ls?.kind === 'standdunk';
      sfx.bucket(ls?.kind, !!big);
      crowd.swell(big ? 1 : 0.55);
      fx.crowd = big ? 1 : 0.5;
      const shooter = p.bodies[e.who];
      if (shooter) {
        shooter.act = 'celebrate';
        shooter.actAt = p.t;
      }
      const and1 = ls?.and1 ? ' AND ONE!' : '';
      say(e.text + and1 + ' +' + (mark === 'A' ? 3 : e.points), big || and1 ? 'big' : 'good', 1400);
      if (game.fire >= 0 && game.fire !== wasFire) window.setTimeout(() => say(game.ours[game.fire].tag + ' IS ON FIRE!', 'big', 1400), 900);
    } else if (e.kind === 'miss') {
      sfx.groan(0.6);
      say(e.text, 'plain', 1000);
    } else {
      if (e.kind === 'clock') sfx.buzzer();
      sfx.groan();
      vibrate(40);
      say(e.text, 'bad', 1300);
    }
    if (wasFire >= 0 && game.fire < 0) window.setTimeout(() => say('FIRE PUT OUT', 'plain', 900), 1000);
    onProgress(progress(game));
    setBetween(true);
    // the final buzzer
    if (game.over) window.setTimeout(() => sfx.buzzer(), 500);
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
    if (hl && !game.over && (!autoplayHook || REPLAYS_IN_AUTOPLAY) && !reducedMotion()) window.setTimeout(() => startReplay(hl, proceed), e.kind === 'make' ? 1300 : 1000);
    else window.setTimeout(proceed, e.kind === 'make' ? 1600 : 1250);
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
      renderer.resize(w, h);
      if (canvas.width !== renderer.W || canvas.height !== renderer.H) {
        canvas.width = renderer.W;
        canvas.height = renderer.H;
        canvas.style.width = renderer.W * renderer.zoom + 'px';
        canvas.style.height = renderer.H * renderer.zoom + 'px';
        setWide(w > h);
      }
      const p = possRef.current;
      const real = now / 1000;
      const fx = fxRef.current;
      const elapsed = Math.min(0.1, (now - last) / 1000) * timeScale;
      last = now;
      // the posterizer in slow motion
      acc += now < slowUntil.current ? elapsed * 0.35 : elapsed;
      if (p && p.end) {
        // after the play: a posterized man still falls, the net still swings, the shooter lands
        const vis = now < slowUntil.current ? elapsed * 0.35 : elapsed;
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
        while (acc >= DT) {
          acc -= DT;
          if (p.end) break;
          if (p.handler !== null && !p.ball && !p.meter && !p.finish) p.target = aimPass(p, stickOnCourt());
          const stick = autoplayHook ? decide(p, pilotRef.current) : stickOnCourt();
          step(p, DT, stick);
          handleEvents(p);
          if (p.end) {
            finish(p);
            break;
          }
        }
      } else acc = 0;
      if (p && !replayRef.current) {
        rec.current.push(p.t, snapOf(p));
        // the dribble on the floor: on the same beat the drawing bounces the ball
        const h = p.handler !== null ? p.bodies[p.handler] : null;
        if (h && h.act === 'dribble' && !p.ball && !p.meter && !p.finish && !p.end) {
          const sp = Math.hypot(h.vx, h.vz);
          const beat = ((((p.t * (sp > 1.8 ? 1.5 + sp / 18 : 1.6)) % 1) * (sp > 1.8 ? 2 : 1.6)) % 1 + 1) % 1;
          if (lastBeat.current < 0.45 && beat >= 0.45) sfx.dribble(sp > 12);
          lastBeat.current = beat;
        } else lastBeat.current = 1;
      }
      fx.swish = Math.max(0, fx.swish - elapsed * 1.3);
      fx.shake = Math.max(0, fx.shake - elapsed * 14);
      fx.crowd = Math.max(0, fx.crowd - elapsed * 0.45);
      fx.flash = Math.max(0, fx.flash - elapsed * 2.2);
      const ctx = canvas.getContext('2d')!;
      const r = replayRef.current;
      if (r && p) {
        const rt = replayTime(r, now);
        const snap = rt === null ? null : frameAt(r.frames, rt);
        if (rt === null || !snap) endReplay();
        else renderer.draw(ctx, { ...p, t: rt, bodies: snap.bodies, ball: snap.ball, handler: snap.handler, fire: snap.fire, lastShot: snap.lastShot, meter: null, finish: null, target: null }, real, fx);
      } else if (p) renderer.draw(ctx, p, real, fx);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  // ---- the controls ----
  const stickEl = useRef<HTMLDivElement>(null);
  const stickAt = (e: React.PointerEvent) => {
    const r = stickEl.current!.getBoundingClientRect();
    const rad = r.width / 2;
    let x = (e.clientX - (r.left + rad)) / rad;
    let y = (e.clientY - (r.top + rad)) / rad;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    stickRef.current = { x, y };
    setKnob({ x, y });
  };
  const stickDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    stickAt(e);
  };
  const stickUp = () => {
    stickRef.current = null;
    setKnob({ x: 0, y: 0 });
  };
  const shootDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const p = possRef.current;
    if (p && !p.end) pressShoot(p);
  };
  const shootUp = () => {
    const p = possRef.current;
    if (p && !p.end) releaseShoot(p, RELEASE_LAG);
  };
  const doPass = (e: React.PointerEvent) => {
    e.preventDefault();
    const p = possRef.current;
    if (p && !p.end) pass(p, null);
  };
  // moves by swipe, anywhere off the stick and the buttons: a flick across crosses over that way, a
  // flick back (down the screen) steps back, a flick up or a circle spins
  const swipe = useRef<{ id: number; pts: { x: number; y: number; t: number }[]; done: boolean } | null>(null);
  const turning = (pts: { x: number; y: number }[]) => {
    let sum = 0;
    let prev: number | null = null;
    let last = pts[0];
    for (const q of pts) {
      if (Math.hypot(q.x - last.x, q.y - last.y) < 6) continue;
      const a = Math.atan2(q.y - last.y, q.x - last.x);
      if (prev !== null) {
        let d = a - prev;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        sum += d;
      }
      prev = a;
      last = q;
    }
    return sum;
  };
  const moveBy = (kind: 'cross' | 'back' | 'spin', dir: number) => {
    const p = possRef.current;
    if (!p || p.end || p.handler === null) return;
    const h = p.bodies[p.handler];
    // screen right is +cz from behind the shooter; the engine's side is measured from his line to the rim
    const toRimCx = Math.sign(RIM.cx - h.cx) || 1;
    if (kind === 'cross') crossover(p, dir * toRimCx);
    else if (kind === 'back') stepback(p);
    else spin(p, dir * toRimCx);
  };
  const swipeDown = (e: React.PointerEvent) => {
    if (swipe.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    swipe.current = { id: e.pointerId, pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }], done: false };
  };
  const swipeMove = (e: React.PointerEvent) => {
    const sw = swipe.current;
    if (!sw || sw.id !== e.pointerId || sw.done) return;
    const now = performance.now();
    sw.pts.push({ x: e.clientX, y: e.clientY, t: now });
    const a = sw.pts[0];
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    const turn = turning(sw.pts);
    let len = 0;
    for (let i = 1; i < sw.pts.length; i++) len += Math.hypot(sw.pts[i].x - sw.pts[i - 1].x, sw.pts[i].y - sw.pts[i - 1].y);
    if (Math.abs(turn) > 4.2 && len > 110) {
      sw.done = true;
      moveBy('spin', turn > 0 ? 1 : -1);
    } else if (now - a.t < 230 && Math.hypot(dx, dy) > 48 && Math.abs(turn) < 0.9) {
      sw.done = true;
      if (Math.abs(dx) > Math.abs(dy)) moveBy('cross', Math.sign(dx));
      else if (dy > 0) moveBy('back', 0);
      else moveBy('spin', stickRef.current && Math.abs(stickRef.current.x) > 0.2 ? Math.sign(stickRef.current.x) : 1);
    }
  };
  const swipeUp = (e: React.PointerEvent) => {
    if (swipe.current?.id === e.pointerId) swipe.current = null;
  };

  const g = game;
  const p = possRef.current;
  // the game fills the real screen, above the app's portrait frame, so it can be played either way up
  return createPortal(
    <div className={'arcade-full hg2' + (wide ? ' wide' : '')} ref={wrapRef}>
      <canvas ref={canvasRef} className="hg2-canvas" />
      <div className="hg2-bug" aria-label="Score">
        <span className="us">
          <i>YOU</i>
          <b className="num">{g?.score ?? 0}</b>
        </span>
        <span className="mid">
          {g && !g.over ? (
            <>
              <b>{half(g) === 1 ? '1ST' : '2ND'}</b>
              <small className="num">
                {Math.min(g.done + 1, g.total)}/{g.total}
              </small>
              <em className={'num' + (p && !between && p.clock < 5 ? ' low' : '')}>{p && !between ? Math.max(0, Math.ceil(p.clock)) : '–'}</em>
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
        <div className="hg2-marks" aria-hidden="true">
          {Array.from({ length: g.total }, (_, i) => (
            <i key={i} className={(g.marks[i] ? 'm-' + g.marks[i] : i === g.done ? 'now' : '') + (i === g.total / 2 ? ' half' : '')}>
              {g.marks[i] ? MARK_TEXT[g.marks[i]] : ''}
            </i>
          ))}
        </div>
      )}
      {look && g && !g.over && (
        <div key={look.scheme + look.trapped} className={'hg2-look l-' + look.scheme + (look.trapped ? ' on' : '')} role="status">
          {LOOK_TEXT[look.scheme]}
          <small>{look.trapped ? 'find the open man' : LOOK_TIP[look.scheme]}</small>
        </div>
      )}
      {pop && (
        <div key={pop.id} className={'hg2-pop ' + pop.tone} role="status">
          {pop.text}
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
      {!attrs && <div className="fg-loading">Taking the floor…</div>}
      {g && !g.over && !autoplayHook && <div className="hg2-swipe" onPointerDown={swipeDown} onPointerMove={swipeMove} onPointerUp={swipeUp} onPointerCancel={swipeUp} aria-hidden="true" />}
      {g && !g.over && !autoplayHook && (
        <div className="hg2-pad">
          <div className="hg2-stick" ref={stickEl} onPointerDown={stickDown} onPointerMove={(e) => stickRef.current && stickAt(e)} onPointerUp={stickUp} onPointerCancel={stickUp} aria-label="Move">
            <i style={{ transform: 'translate(' + knob.x * 30 + 'px,' + knob.y * 30 + 'px)' }} />
          </div>
          <div className="hg2-btns">
            <button className="hg2-pass" onPointerDown={doPass} aria-label="Pass">
              PASS
            </button>
            <button className="hg2-shoot" onPointerDown={shootDown} onPointerUp={shootUp} onPointerCancel={shootUp} aria-label="Shoot: hold, and let go in the green">
              SHOOT
            </button>
          </div>
        </div>
      )}
      {g?.over && (
        <div className="fg-final hg2-final" role="status">
          <span className="eyebrow">Your possessions</span>
          <b className="num">{g.score}</b>
          <small>{g.marks.map((m) => MARK_TEXT[m]).join(' ')}</small>
          {rival && !rival.done && <WaitLine rival={rival} unit="possession" total={possessions} />}
        </div>
      )}
    </div>,
    document.body
  );
}

/** The AI's possessions, played by the autopilot against your five. */
export function aiPossessions2(rivalLineup: Lineup, yourLineup: Lineup, seed: string, skill: number, attrs: (p: Player) => Attrs | null, possessions = POSSESSIONS): Progress {
  return aiPossessionsOf(fiveOf(rivalLineup, attrs), fiveOf(yourLineup, attrs), seed, skill, possessions);
}

/** The same from the teams themselves (Ultimate Team): one five on offense, with its bench, against the other. */
export function aiPossessionsOf(offense: Hooper[], defense: Hooper[], seed: string, skill: number, possessions = POSSESSIONS, bench: Hooper[] = []): Progress {
  const g = newHoopsGame(offense, defense, 'ai:' + seed, possessions, bench);
  autoplay(g, skill, 'ai:' + seed);
  return { score: g.score, drive: g.done, done: true, ends: g.marks.slice(), plays: g.done };
}
