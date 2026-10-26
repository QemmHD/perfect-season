import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Lineup, Player } from '../../engine/types';
import { crowd, sfx, vibrate } from '../../lib/sound';
import { reducedMotion } from '../../ui/motion';
import { type Attrs, loadAttrs } from '../attrs';
import type { Progress, RivalLive } from '../progress';
import { hoopDecide, hoopPilot, hoopsAutoplay } from './autopilot';
import { afterPoss, type HoopGame, newHoopGame, POSSESSIONS, type PossMark, startPoss } from './game';
import { fiveOf } from './model';
import { type Poss, type Pt, passTarget, passTo, release, rise, step } from './play';
import { drawHoops, viewFor } from './render';

const DT = 1 / 60;
const MARK_TEXT: Record<PossMark, string> = { '2': '2', '3': '3', X: '–', TO: 'TO' };

/**
 * Arcade basketball: your five against the rival's five, on offense. The stick moves the man with
 * the ball; PASS throws to the teammate you point at (or the most open one); hold SHOOT to rise and
 * let go at the top of the jump. Near the rim it's a layup, or a dunk for a man who dunks.
 */
export function Hoops({
  lineup,
  rivalLineup,
  rivalName,
  seed,
  possessions = POSSESSIONS,
  rival,
  autoplayHook,
  onProgress,
  onDone,
}: {
  lineup: Lineup;
  rivalLineup: Lineup;
  rivalName: string;
  seed: string;
  possessions?: number;
  rival: RivalLive | null;
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
  const game = useMemo<HoopGame | null>(() => (attrs ? newHoopGame(fiveOf(lineup, attrs), fiveOf(rivalLineup, attrs), seed, possessions) : null), [attrs]);
  const possRef = useRef<Poss | null>(null);
  const stickRef = useRef<Pt | null>(null);
  const pilotRef = useRef(hoopPilot(0.75, seed));
  const swishAt = useRef(-9);
  const [between, setBetween] = useState(true);
  const [, setTick] = useState(0);
  const [pop, setPop] = useState<{ id: number; text: string; tone: 'good' | 'bad' | 'big' | 'plain' } | null>(null);
  const popId = useRef(0);
  const [knob, setKnob] = useState<Pt>({ x: 0, y: 0 });
  const [hint, setHint] = useState<string | null>('Stick: move · PASS · hold SHOOT, let go at the top');

  const say = (text: string, tone: 'good' | 'bad' | 'big' | 'plain', ms = 1200) => {
    const id = ++popId.current;
    setPop({ id, text, tone });
    window.setTimeout(() => setPop((p) => (p && p.id === id ? null : p)), ms);
  };
  const progress = (g: HoopGame): Progress => ({ score: g.score, drive: g.done, done: g.over, ends: g.marks.slice() });

  const next = (g: HoopGame) => {
    possRef.current = startPoss(g);
    pilotRef.current.letGo = null;
    pilotRef.current.nextLook = 0;
    setBetween(false);
    setTick((n) => n + 1);
  };

  useEffect(() => {
    if (!game) return;
    crowd.start(0.24);
    const t = window.setTimeout(() => next(game), 600);
    window.setTimeout(() => setHint(null), 6000);
    return () => {
      clearTimeout(t);
      crowd.stop(0.6);
    };
  }, [game]);

  const handleEvents = (p: Poss) => {
    for (const e of p.events) {
      if (e === 'pass') sfx.whoosh();
      else if (e === 'catch') sfx.tick();
      else if (e === 'rise') sfx.click();
      else if (e === 'release-perfect') {
        sfx.coin();
        say('PERFECT RELEASE', 'good', 700);
      } else if (e === 'dunk') {
        vibrate(20);
      } else if (e === 'block') {
        sfx.stamp();
        vibrate(30);
      } else if (e === 'rim') sfx.stop();
      else if (e === 'orb') {
        sfx.select();
        say('OFFENSIVE BOARD', 'good', 800);
        crowd.swell(0.4);
      } else if (e.startsWith('say:')) say(e.slice(4), 'bad', 1000);
    }
    p.events.length = 0;
  };

  const finish = (p: Poss) => {
    if (!game) return;
    const e = p.end!;
    afterPoss(game, e);
    if (e.kind === 'make') {
      swishAt.current = p.t;
      const three = e.points === 3;
      const dunk = e.text === 'SLAM';
      sfx.scoreUs(three || dunk);
      crowd.swell(three || dunk ? 1 : 0.55);
      if (three || dunk) {
        vibrate([20, 40, 20]);
        if (!reducedMotion()) wrapRef.current?.animate?.([{ transform: 'none' }, { transform: 'translate(-4px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'none' }], { duration: 300 });
      }
      say(dunk ? 'SLAM!' : three ? 'SPLASH! +3' : 'BUCKET +2', three || dunk ? 'big' : 'good', 1300);
    } else if (e.kind === 'miss') {
      sfx.nope();
      say(e.text, 'plain', 1000);
    } else {
      sfx.scoreThem();
      vibrate(40);
      say(e.text, 'bad', 1300);
    }
    onProgress(progress(game));
    setBetween(true);
    window.setTimeout(() => {
      if (game.over) {
        onDone(progress(game));
        setTick((n) => n + 1);
        return;
      }
      next(game);
    }, e.kind === 'make' ? 1500 : 1200);
  };

  // the loop
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
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const p = possRef.current;
      if (!p) return;
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      while (acc >= DT) {
        acc -= DT;
        if (p.end) break;
        const stick = autoplayHook ? hoopDecide(p, pilotRef.current) : stickRef.current;
        step(p, DT, stick);
        handleEvents(p);
        if (p.end) {
          finish(p);
          break;
        }
      }
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the baseline sits low enough for the backboard to clear the scoreboard
      const top = parseFloat(getComputedStyle(wrap).getPropertyValue('--sat') || '0') + 168;
      const view = viewFor(w, h, top);
      const rival0 = rivalLineup.C as Player | null;
      drawHoops(ctx, view, p, { paint: rival0?.c1 ?? '#333', trim: rival0?.c2 ?? '#fff', abbr: rival0?.abbr ?? 'OPP' }, {
        tagHandler: true,
        swish: Math.max(0, 1 - (p.t - swishAt.current)),
        passTo: p.handler && !p.ball && p.jumpAt === null ? passTarget(p, stickRef.current) : null,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  // the stick
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
    if (p && !p.end) rise(p);
  };
  const shootUp = () => {
    const p = possRef.current;
    if (p && !p.end) release(p);
  };
  const pass = () => {
    const p = possRef.current;
    if (!p || p.end) return;
    const to = passTarget(p, stickRef.current);
    if (to) passTo(p, to);
  };

  const g = game;
  const p = possRef.current;
  return (
    <div className="hgame fgame" ref={wrapRef}>
      <canvas ref={canvasRef} className="fg-canvas" />
      <div className="fg-hud">
        <span className="fg-score us">
          <i>YOU</i>
          <b className="num">{g?.score ?? 0}</b>
        </span>
        <span className="fg-mid">
          {g && !g.over ? (
            <>
              <b>
                POSSESSION {Math.min(g.done + 1, g.total)}/{g.total}
              </b>
              <small className={'num hp-clock' + (p && !between && p.clock < 5 ? ' low' : '')}>{p && !between ? Math.max(0, Math.ceil(p.clock)) : '–'}</small>
            </>
          ) : (
            <b>FINAL</b>
          )}
        </span>
        <span className="fg-score them">
          <i>{(rival?.name ?? rivalName).toUpperCase().slice(0, 8)}</i>
          <b className="num">{rival ? rival.score : '–'}</b>
          {rival && <small>{rival.done ? 'FINAL' : 'POSS ' + Math.min(rival.drive + 1, possessions) + '/' + possessions}</small>}
        </span>
      </div>
      {g && (
        <div className="fg-ends hp-ends" aria-hidden="true">
          {Array.from({ length: g.total }, (_, i) => (
            <i key={i} className={g.marks[i] ? 'm-' + g.marks[i] : i === g.done ? 'now' : ''}>
              {g.marks[i] ? MARK_TEXT[g.marks[i]] : ''}
            </i>
          ))}
        </div>
      )}
      {pop && (
        <div key={pop.id} className={'fg-pop hp-pop ' + pop.tone} role="status">
          {pop.text}
        </div>
      )}
      {hint && <div className="fg-hint hp-hint">{hint}</div>}
      {!attrs && <div className="fg-loading">Taking the floor…</div>}
      {g && !g.over && (
        <div className="hp-pad">
          <div className="hp-stick" ref={stickEl} onPointerDown={stickDown} onPointerMove={(e) => stickRef.current && stickAt(e)} onPointerUp={stickUp} onPointerCancel={stickUp} aria-label="Move">
            <i style={{ transform: 'translate(' + knob.x * 34 + 'px,' + knob.y * 34 + 'px)' }} />
          </div>
          <div className="hp-btns">
            <button className="hp-pass" onPointerDown={(e) => (e.preventDefault(), pass())} aria-label="Pass">
              PASS
            </button>
            <button className="hp-shoot" onPointerDown={shootDown} onPointerUp={shootUp} onPointerCancel={shootUp} aria-label="Shoot: hold, and let go at the top of the jump">
              SHOOT
            </button>
          </div>
        </div>
      )}
      {g?.over && (
        <div className="fg-final" role="status">
          <span className="eyebrow">Your possessions</span>
          <b className="num">{g.score}</b>
          <small>{g.marks.map((m) => MARK_TEXT[m]).join(' ')}</small>
          {rival && !rival.done && <small className="fg-wait">Waiting for {rival.name}: possession {Math.min(rival.drive + 1, possessions)} of {possessions}</small>}
        </div>
      )}
    </div>
  );
}

/** The AI's possessions, played by the autopilot against your five. */
export function aiPossessions(rivalLineup: Lineup, yourLineup: Lineup, seed: string, skill: number, attrs: (p: Player) => Attrs | null, possessions = POSSESSIONS): Progress {
  const g = newHoopGame(fiveOf(rivalLineup, attrs), fiveOf(yourLineup, attrs), 'ai:' + seed, possessions);
  hoopsAutoplay(g, skill, 'ai:' + seed);
  return { score: g.score, drive: g.done, done: true, ends: g.marks.slice() };
}
