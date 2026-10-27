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
import { WaitLine } from '../Wait';
import { autoplay, decide, pilot } from './autopilot';
import { aimPass, crossover, pass, pressShoot, releaseShoot, RIM, step } from './engine';
import { afterPossession, half, type HoopsGame, type Mark, newHoopsGame, POSSESSIONS, startPossession } from './game';
import { hooper, lineOf, SPOTS } from './ratings';
import { type Fx, HoopsRenderer, type Kit } from './render';
import type { Hooper, Possession, Pt } from './types';

const DT = 1 / 60;
const MARK_TEXT: Record<Mark, string> = { '2': '2', '3': '3', A: '3', X: '–', TO: 'TO' };

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
  const popId = useRef(0);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [hint, setHint] = useState<string | null>('Stick: move · hold SHOOT, let go in the green · PASS · CROSS');
  const [wide, setWide] = useState(false);

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
      if (e === 'pass') sfx.whoosh();
      else if (e === 'lob') {
        sfx.whoosh();
        say('LOB!', 'plain', 600);
      } else if (e === 'catch') sfx.catch();
      else if (e === 'rise') sfx.click();
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
        if (res === 'make' && (kind === 'dunk' || kind === 'contact' || kind === 'standdunk' || kind === 'oop')) {
          vibrate([25, 40, 25]);
          shake(kind === 'contact' ? 5 : 3);
          if (kind === 'contact') fx.flash = 0.7;
        }
      } else if (e.startsWith('ankles:')) {
        sfx.ooh();
        crowd.swell(0.9);
        fx.crowd = 1;
        say('ANKLES BROKEN!', 'big', 1100);
      } else if (e.startsWith('shook:')) {
        sfx.squeak();
        say('SHOOK HIM', 'good', 700);
      } else if (e.startsWith('blocked:')) {
        sfx.block();
        vibrate(30);
        shake(3);
        const d = p.bodies[Number(e.slice(8))];
        say('REJECTED BY ' + d.p.tag, 'bad', 1100);
      } else if (e === 'rim') sfx.rim();
      else if (e.startsWith('orb:')) {
        sfx.select();
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
      sfx.groan();
      vibrate(40);
      say(e.text, 'bad', 1300);
    }
    if (wasFire >= 0 && game.fire < 0) window.setTimeout(() => say('FIRE PUT OUT', 'plain', 900), 1000);
    onProgress(progress(game));
    setBetween(true);
    window.setTimeout(() => {
      if (game.over) {
        onDone(progress(game));
        setTick((n) => n + 1);
        return;
      }
      next(game);
    }, e.kind === 'make' ? 1600 : 1250);
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
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      // the posterizer in slow motion
      acc += now < slowUntil.current ? elapsed * 0.35 : elapsed;
      if (p) {
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
      }
      fx.swish = Math.max(0, fx.swish - elapsed * 1.3);
      fx.shake = Math.max(0, fx.shake - elapsed * 14);
      fx.crowd = Math.max(0, fx.crowd - elapsed * 0.45);
      fx.flash = Math.max(0, fx.flash - elapsed * 2.2);
      const ctx = canvas.getContext('2d')!;
      if (p) renderer.draw(ctx, p, real, fx);
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
    if (p && !p.end) releaseShoot(p);
  };
  const doPass = (e: React.PointerEvent) => {
    e.preventDefault();
    const p = possRef.current;
    if (p && !p.end) pass(p, null);
  };
  const doCross = (e: React.PointerEvent) => {
    e.preventDefault();
    const p = possRef.current;
    if (!p || p.end || p.handler === null) return;
    // cross toward the side the stick leans, else back the other way
    const s = stickOnCourt();
    const h = p.bodies[p.handler];
    const toRim = { cx: RIM.cx - h.cx, cz: RIM.cz - h.cz };
    const side = s ? Math.sign(-toRim.cz * s.cx + toRim.cx * s.cz) || 1 : h.cz > 0 ? -1 : 1;
    crossover(p, side);
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
      {pop && (
        <div key={pop.id} className={'hg2-pop ' + pop.tone} role="status">
          {pop.text}
        </div>
      )}
      {hint && <div className="hg2-hint">{hint}</div>}
      {!attrs && <div className="fg-loading">Taking the floor…</div>}
      {g && !g.over && !autoplayHook && (
        <div className="hg2-pad">
          <div className="hg2-stick" ref={stickEl} onPointerDown={stickDown} onPointerMove={(e) => stickRef.current && stickAt(e)} onPointerUp={stickUp} onPointerCancel={stickUp} aria-label="Move">
            <i style={{ transform: 'translate(' + knob.x * 30 + 'px,' + knob.y * 30 + 'px)' }} />
          </div>
          <div className="hg2-btns">
            <button className="hg2-cross" onPointerDown={doCross} aria-label="Crossover">
              CROSS
            </button>
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
