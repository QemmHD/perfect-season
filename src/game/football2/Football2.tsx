// Arcade football, Retro Bowl style: your offense against the rival's defense, eleven on eleven.
// Before the snap pick PASS (the play's routes are drawn) or RUN. On a pass, drag back anywhere and
// let go to throw: the arc shows where it lands and who it's going to. With the ball in your hands,
// drag anywhere to steer and hit JUKE, SPIN or POWER at a tackler. Fourth down: go, kick or punt.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lineup, Player } from '../../engine/types';
import { crowd, sfx, vibrate } from '../../lib/sound';
import { reducedMotion } from '../../ui/motion';
import { type Attrs, loadAttrs } from '../attrs';
import { luma, rgb } from '../pixel/color';
import type { FieldTheme } from '../pixel/field';
import type { Progress, RivalLive } from '../progress';
import { WaitLine } from '../Wait';
import { autoplay, decide, fourthDown, pilot } from './autopilot';
import { afterPlay, downText, type DriveEnd, DRIVES, fgDistance, fgInRange, type Game, kick, kickWindow, newGame, nextConcept, punt, spotText, startPlay } from './drive';
import { CONCEPT_NAMES, FIELD_W, maxThrow, moveWithBall, RUN_NAMES, scramble, snap, step, throwTo } from './engine';
import { type FbKit, FootballRenderer } from './render';
import { defenseOf, offenseOf } from './squad';
import type { Defense, Offense, Play, Pt } from './types';

type Ui = 'loading' | 'pre' | 'fourth' | 'live' | 'after' | 'kick' | 'final';
type Tone = 'good' | 'bad' | 'big' | 'plain' | 'green';

const DT = 1 / 60;
const MARK_TEXT: Record<DriveEnd, string> = { TD: 'TD', FG: 'FG', MISS: 'X', INT: 'INT', DOWNS: '–', PUNT: 'P', FUM: 'FUM' };

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

  /** Line up the next snap: a pass play shown with its routes until you call it. */
  const lineUpNext = (g: Game) => {
    playRef.current = startPlay(g, 'pass');
    dragRef.current = null;
    stickRef.current = null;
    setFloat(null);
    setPhase('pre');
    setUi(g.down === 4 ? 'fourth' : 'pre');
    if (g.down !== 4) tip('call', 'PASS runs the routes drawn · RUN hands it off · ↻ another play');
  };

  useEffect(() => {
    if (!game) return;
    crowd.start(0.22);
    lineUpNext(game);
    return () => crowd.stop(0.6);
  }, [game]);

  const go = (call: 'pass' | 'run') => {
    if (!game || (ui !== 'pre' && ui !== 'fourth')) return;
    sfx.click();
    const p = call === 'pass' ? (playRef.current ?? startPlay(game, 'pass')) : startPlay(game, 'run');
    playRef.current = p;
    pilotRef.current.readAt = 0;
    snap(p);
    setUi('live');
    setPhase(p.phase);
    if (call === 'pass') tip('pass', 'Drag back anywhere · let go to throw');
    else tip('run', 'Drag to steer · JUKE, SPIN or POWER at a tackler');
  };
  const reroll = () => {
    if (!game || ui !== 'pre') return;
    sfx.click();
    nextConcept(game);
    playRef.current = startPlay(game, 'pass');
    setTick((n) => n + 1);
  };

  const nextUp = (g: Game, driveOver: boolean, wait: number) => {
    onProgress(progress(g));
    window.setTimeout(() => {
      if (g.over) {
        setUi('final');
        onDone(progress(g));
        return;
      }
      if (driveOver) say('DRIVE ' + (g.drive + 1) + ' OF ' + g.drives, 'plain', 1100);
      lineUpNext(g);
    }, wait);
  };

  const handleEvents = (p: Play) => {
    for (const e of p.events) {
      if (e === 'snap') sfx.click();
      else if (e === 'handoff') sfx.tick();
      else if (e === 'throw' || e === 'throw-pressure' || e === 'scramble') sfx.whoosh();
      else if (e === 'catch') {
        sfx.catch();
        crowd.swell(0.3);
        tip('runafter', 'Drag to steer · JUKE, SPIN or POWER at a tackler');
      } else if (e === 'catch-contested') {
        sfx.catch();
        crowd.swell(0.7);
        say('CONTESTED CATCH!', 'good', 900);
      } else if (e.startsWith('move:')) sfx.select();
      else if (e.startsWith('beat:')) {
        const kind = e.slice(5);
        vibrate([20, 30, 20]);
        crowd.swell(0.8);
        shake(kind === 'truck' ? 4 : 2);
        if (kind === 'truck') slowUntil.current = performance.now() + 450;
        say(kind === 'juke' ? 'JUKED!' : kind === 'spin' ? 'SPIN MOVE!' : kind === 'truck' ? 'TRUCKED!' : 'STIFF ARM!', 'big', 900);
      } else if (e === 'break') {
        crowd.swell(0.5);
        say('BROKE A TACKLE', 'good', 800);
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
    } else if (a.driveOver === 'DOWNS') {
      sfx.groan(0.8);
      say('TURNOVER ON DOWNS', 'bad', 1600, e.kind === 'incomplete' ? e.text : gain);
    } else if (a.firstDown) {
      sfx.coin();
      crowd.swell(yds >= 20 ? 0.9 : 0.45);
      say(yds >= 20 ? 'BIG PLAY · FIRST DOWN' : 'FIRST DOWN', yds >= 20 ? 'big' : 'good', 1300, gain);
    } else if (e.kind === 'incomplete') {
      sfx.nope();
      say(e.text, 'plain', 1100);
    } else if (e.kind === 'sack') say(e.text, 'bad', 1300, gain);
    else say(gain, yds > 0 ? 'good' : 'plain', 1000, e.kind === 'out' ? 'OUT OF BOUNDS' : undefined);
    nextUp(game, !!a.driveOver, a.points ? 2300 : a.driveOver ? 1900 : 1350);
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
    const a = kick(game, Math.abs(pos - 0.5) * 2);
    const good = a.points > 0;
    // the kick: the leg swings, the ball's away a beat later; wide by the side the needle missed on
    const kicker = p.rb;
    kicker.act = 'kick';
    kicker.actAt = p.t;
    const from = { x: p.bx, y: p.los - 7 };
    const side = pos < 0.5 ? -1 : 1;
    const toX = FIELD_W / 2 + (good ? side * Math.random() * 1.6 : side * (4.2 + Math.random() * 2.5));
    // aimed long, so it's still climbing over the crossbar; stopped when it reaches the stands
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
      if (good) {
        sfx.seriesWin();
        crowd.swell(0.9);
        say('IT’S GOOD! +3', 'good', 1600, k.dist + ' YARDS');
      } else {
        sfx.seriesLoss();
        say('NO GOOD', 'bad', 1500, (side < 0 ? 'WIDE LEFT' : 'WIDE RIGHT'));
      }
    }, 1000);
    window.setTimeout(() => {
      kickRef.current = null;
      kickAnim.current = null;
    }, 2800);
    nextUp(game, true, 2700);
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
      if (ui === 'pre') go(pilotRef.current.rand() < 0.3 ? 'run' : 'pass');
      else if (ui === 'fourth') {
        const d = fourthDown(game);
        if (d === 'kick') startKick();
        else if (d === 'punt') puntNow();
        else go('pass');
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
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += now < slowUntil.current ? elapsed * 0.4 : elapsed;
      if (p && kickAnim.current) {
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
          const steer = autoplayHook ? decide(p, game, pilotRef.current) : steerNow(p);
          const was: Play['phase'] = p.phase;
          step(p, DT, steer);
          handleEvents(p);
          if (p.phase !== was) setPhase(p.phase);
          if (p.end) {
            finish(p);
            break;
          }
        }
      } else acc = 0;
      fx.shake = Math.max(0, fx.shake - elapsed * 14);
      fx.flash = Math.max(0, fx.flash - elapsed * 1.8);
      const ctx = canvas.getContext('2d')!;
      if (p) renderer.draw(ctx, p, p.los, { aim: aimNow(p), toGain: kickRef.current || p.end || game.ballOn + game.toGo > 100 ? null : p.los + game.toGo, routes: p.phase === 'pre' && p.call === 'pass', shake: fx.shake, flash: fx.flash });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  // ---- touch: the slingshot while he's back to throw, the floating stick once someone's running ----
  const down = (e: React.PointerEvent) => {
    const p = playRef.current;
    if (!p || ui !== 'live' || autoplayHook) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (p.phase === 'drop' && p.call === 'pass' && p.carrier === p.qb) {
      dragRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    } else if (p.phase === 'run' || (p.phase === 'drop' && p.call === 'run')) {
      stickRef.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 };
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
    if (s && s.id === e.pointerId) {
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
    }
  };
  const up = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const p = playRef.current;
    if (d && d.id === e.pointerId) {
      const aim = p ? aimNow(p) : null;
      dragRef.current = null;
      if (p && aim) throwTo(p, aim);
      return;
    }
    const s = stickRef.current;
    if (s && s.id === e.pointerId) {
      stickRef.current = null;
      setFloat(null);
    }
  };
  const doMove = (kind: 'juke' | 'spin' | 'power') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const p = playRef.current;
    const c = p?.carrier;
    if (!p || !c || p.phase !== 'run') return;
    if (kind === 'power') {
      moveWithBall(p, (c.p.a.TRK ?? 50) >= (c.p.a.SFA ?? 50) ? 'truck' : 'stiff');
      return;
    }
    const s = stickRef.current;
    const across = s ? (renderer.mode === 'side' ? -s.y : s.x) : 0;
    moveWithBall(p, kind, Math.abs(across) > 0.2 ? Math.sign(across) : 0);
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
  const running = ui === 'live' && phase === 'run';
  const passing = ui === 'live' && phase === 'drop' && p?.call === 'pass';
  return createPortal(
    <div className={'arcade-full hg2 fb2' + (wide ? ' wide' : '')} ref={wrapRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
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
              4TH & {g.toGo < 1 ? 'INCHES' : Math.round(g.toGo)} · {fgOk ? fgDistance(g) + ' YD FIELD GOAL IN RANGE' : 'OUT OF FIELD GOAL RANGE'}
            </span>
          )}
          <div className="fb2-play">
            <button className="fb2-reroll" onClick={reroll} disabled={ui !== 'pre'} aria-label="Another pass play">
              ↻
            </button>
            <span>
              <small>PASS PLAY · RUN: {RUN_NAMES[p.run].toUpperCase()}</small>
              <b>{CONCEPT_NAMES[p.concept]}</b>
            </span>
          </div>
          <div className="fb2-btns">
            <button className="fb2-go pass" onClick={() => go('pass')}>
              PASS
            </button>
            <button className="fb2-go run" onClick={() => go('run')}>
              RUN
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
      {running && !autoplayHook && (
        <div className="fb2-moves" onPointerDown={(e) => e.stopPropagation()}>
          <button className="fb2-mv juke" onPointerDown={doMove('juke')} aria-label="Juke">
            JUKE
          </button>
          <button className="fb2-mv spin" onPointerDown={doMove('spin')} aria-label="Spin">
            SPIN
          </button>
          <button className="fb2-mv power" onPointerDown={doMove('power')} aria-label="Power: truck or stiff arm">
            POWER
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
