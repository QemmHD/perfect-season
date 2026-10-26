import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Lineup, Player } from '../../engine/types';
import { crowd, sfx, vibrate } from '../../lib/sound';
import { reducedMotion } from '../../ui/motion';
import { type Attrs, loadAttrs } from '../attrs';
import { afterPlay, downText, type DriveEnd, DRIVES, fgDistance, fgInRange, type Game, kick, kickWindow, newGame, nextConcept, spotText, startPlay } from './drive';
import { squadOf } from './model';
import { CONCEPT_NAMES, juke, type Play, type Pt, snap, step, throwTo } from './play';
import { type Camera, cameraTarget, draw, toScreen, toWorld } from './render';
import { autoplay, decide, pilot } from './autopilot';
import type { Progress, RivalLive } from '../progress';
import { WaitLine } from '../Wait';

export type { Progress, RivalLive };

type Ui = 'loading' | 'pre' | 'fourth' | 'kick' | 'live' | 'after' | 'final';

const DT = 1 / 60;
const END_TEXT: Record<DriveEnd, string> = { TD: 'TD', FG: 'FG', MISS: 'MISSED FG', INT: 'INT', DOWNS: 'DOWNS' };

/**
 * Arcade football: your drafted offense against the rival's drafted defense. Hold and drag to aim
 * a pass, let go to throw; drag to steer a runner, tap to juke. A set number of drives, then the
 * score goes to the head to head.
 */
export function Football({
  lineup,
  rivalDef,
  rivalName,
  seed,
  drives = DRIVES,
  rival,
  autoplayHook,
  onProgress,
  onDone,
}: {
  lineup: Lineup;
  rivalDef: Player | null;
  rivalName: string;
  seed: string;
  drives?: number;
  rival: RivalLive | null;
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
  const game = useMemo<Game | null>(() => (attrs ? newGame(squadOf(lineup, rivalDef, attrs), seed, drives) : null), [attrs]);
  const playRef = useRef<Play | null>(null);
  const camRef = useRef<Camera>({ x: 26.67, y: 34, z: 11, w: 390, h: 700 });
  const aimRef = useRef<Pt | null>(null);
  const steerRef = useRef<number | null>(null);
  const downAt = useRef<{ t: number; x: number; y: number } | null>(null);
  const [ui, setUi] = useState<Ui>('loading');
  const [, setTick] = useState(0);
  const [pop, setPop] = useState<{ id: number; text: string; tone: 'good' | 'bad' | 'big' | 'plain' } | null>(null);
  const popId = useRef(0);
  const [hint, setHint] = useState<string | null>(null);
  const plays = useRef(0);
  const pilotRef = useRef(pilot(0.75, seed));
  const kickRef = useRef<{ t0: number; stopped: number | null } | null>(null);

  const say = (text: string, tone: 'good' | 'bad' | 'big' | 'plain', ms = 1200) => {
    const id = ++popId.current;
    setPop({ id, text, tone });
    window.setTimeout(() => setPop((p) => (p && p.id === id ? null : p)), ms);
  };

  const progress = (g: Game): Progress => ({ score: g.score, drive: g.drive, done: g.over, ends: g.ends.slice(), plays: plays.current });

  // a fresh play on the line, routes showing
  const lineUpNext = (g: Game) => {
    playRef.current = startPlay(g, 'pass');
    setUi(g.down === 4 ? 'fourth' : 'pre');
    setTick((n) => n + 1);
  };

  useEffect(() => {
    if (!game) return;
    crowd.start(0.22);
    lineUpNext(game);
    return () => crowd.stop(0.6);
  }, [game]);

  // the loop: fixed steps, the camera easing after the ball
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
      const cam = camRef.current;
      cam.w = w;
      cam.h = h;
      // the whole formation across the screen, sideline to sideline nearly
      cam.z = Math.max(7, Math.min(14, w / 46));
      const p = playRef.current;
      if (!p) return;
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      while (acc >= DT) {
        acc -= DT;
        if (p.phase === 'drop' || p.phase === 'air' || p.phase === 'run') {
          let steer = steerRef.current;
          if (autoplayHook) steer = decide(p, game, pilotRef.current);
          step(p, DT, steer);
          handleEvents(p);
          if (p.end) {
            finishPlay(p);
            break;
          }
        }
      }
      const tgt = cameraTarget(p, cam);
      const k = p.phase === 'pre' ? 0.12 : 0.08;
      cam.x += (tgt.x - cam.x) * k;
      cam.y += (tgt.y - cam.y) * k;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, cam, p, { ourColor: '#0f3a44', rivalColor: rivalDef?.c1 ?? '#333', rivalTrim: rivalDef?.c2 ?? '#fff', rivalAbbr: rivalDef?.abbr ?? 'OPP', toGain: game.ballOn + game.toGo }, {
        aim: aimRef.current,
        showRoutes: p.phase === 'pre' && p.call === 'pass',
        tags: p.phase === 'pre',
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  const handleEvents = (p: Play) => {
    for (const e of p.events) {
      if (e === 'snap' || e === 'handoff') sfx.click();
      else if (e.startsWith('throw')) sfx.whoosh();
      else if (e.startsWith('catch')) {
        sfx.place();
        vibrate(12);
        if (p.catcher) say(p.catcher.a.tag + (e === 'catch-contested' ? ' HAULS IT IN' : ''), 'plain', 800);
      } else if (e === 'juke') sfx.select();
      else if (e === 'juke-beat') {
        sfx.stamp();
        say('JUKED HIM', 'good', 700);
        crowd.swell(0.5);
      } else if (e === 'break') {
        sfx.stamp();
        say('BROKE A TACKLE', 'good', 700);
        crowd.swell(0.5);
      }
    }
    p.events.length = 0;
  };

  const finishPlay = (p: Play) => {
    if (!game) return;
    const end = p.end!;
    plays.current++;
    setHint(null);
    aimRef.current = null;
    steerRef.current = null;
    const wasDrive = game.drive;
    const a = afterPlay(game, end);
    // sounds and the call
    if (end.kind === 'td') {
      sfx.scoreUs(true);
      window.setTimeout(() => sfx.roar(), 200);
      crowd.swell(1.2);
      vibrate([30, 50, 30]);
      if (!reducedMotion()) wrapRef.current?.animate?.([{ transform: 'none' }, { transform: 'translate(-5px,3px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'none' }], { duration: 320 });
      say('TOUCHDOWN!', 'big', 1700);
    } else if (end.kind === 'int') {
      sfx.seriesLoss();
      vibrate(60);
      say('INTERCEPTED', 'bad', 1600);
    } else if (end.kind === 'sack') {
      sfx.scoreThem();
      vibrate(40);
      say('SACKED · ' + Math.abs(Math.round(end.gain)) + ' YD LOSS', 'bad', 1300);
    } else if (end.kind === 'incomplete') {
      sfx.nope();
      say(end.text, 'plain', 1000);
    } else {
      sfx.stop();
      const yd = Math.round(end.gain);
      if (a.text === 'TURNOVER ON DOWNS') say('TURNOVER ON DOWNS', 'bad', 1500);
      else if (a.firstDown) {
        sfx.coin();
        say('FIRST DOWN · +' + yd, 'good', 1100);
        if (yd >= 20) crowd.swell(0.9);
      } else say((yd >= 0 ? '+' : '') + yd + ' YARDS', 'plain', 900);
    }
    if (game.ballOn > 80) crowd.level(0.45);
    else crowd.level(0.22);
    onProgress(progress(game));
    setUi('after');
    const wait = end.kind === 'td' || end.kind === 'int' || a.driveOver ? 1800 : 1100;
    window.setTimeout(() => {
      if (game.over) {
        setUi('final');
        crowd.swell(0.6);
        onDone(progress(game));
        return;
      }
      if (game.drive !== wasDrive) say('DRIVE ' + (game.drive + 1) + ' OF ' + game.drives, 'plain', 1100);
      lineUpNext(game);
    }, wait);
  };

  // the snap: a pass with the routes on screen, or a run
  const go = (call: 'pass' | 'run') => {
    if (!game || (ui !== 'pre' && ui !== 'fourth')) return;
    if (call === 'run') playRef.current = startPlay(game, 'run');
    const p = playRef.current!;
    snap(p);
    pilotRef.current.readAt = 0;
    setUi('live');
    if (plays.current < 3) setHint(call === 'pass' ? 'Hold and drag to aim · let go to throw' : 'Drag to steer · tap to juke');
  };

  const reroll = () => {
    if (!game || ui !== 'pre') return;
    sfx.click();
    nextConcept(game);
    playRef.current = startPlay(game, 'pass');
    setTick((n) => n + 1);
  };

  // the kick meter: a needle swinging across, the window in the middle
  const startKick = () => {
    if (!game) return;
    sfx.click();
    kickRef.current = { t0: performance.now(), stopped: null };
    setUi('kick');
  };
  const kickNow = () => {
    const k = kickRef.current;
    if (!game || !k || k.stopped !== null) return;
    const phase = ((performance.now() - k.t0) / 1100) % 2;
    const pos = phase < 1 ? phase : 2 - phase; // 0..1..0
    k.stopped = pos;
    const aim = Math.abs(pos - 0.5) * 2;
    const a = kick(game, aim);
    if (a.points) {
      sfx.seriesWin();
      crowd.swell(0.9);
      say('IT’S GOOD! +3', 'good', 1600);
    } else {
      sfx.seriesLoss();
      say('NO GOOD', 'bad', 1500);
    }
    onProgress(progress(game));
    window.setTimeout(() => {
      kickRef.current = null;
      if (game.over) {
        setUi('final');
        onDone(progress(game));
      } else {
        say('DRIVE ' + (game.drive + 1) + ' OF ' + game.drives, 'plain', 1100);
        lineUpNext(game);
      }
    }, 1500);
  };

  // tests: the autopilot calls the plays too
  useEffect(() => {
    if (!autoplayHook || !game) return;
    const t = window.setTimeout(() => {
      if (ui === 'pre') go(pilotRef.current.rand() < 0.3 ? 'run' : 'pass');
      else if (ui === 'fourth') fgInRange(game) && game.toGo > 1.5 ? startKick() : go('pass');
      else if (ui === 'kick') kickNow();
    }, 500);
    return () => clearTimeout(t);
  }, [ui, autoplayHook, game]);

  // touches: aim and throw, steer and juke
  const local = (e: React.PointerEvent): Pt => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: React.PointerEvent) => {
    const p = playRef.current;
    if (!p || ui !== 'live') return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = local(e);
    downAt.current = { t: performance.now(), x: s.x, y: s.y };
    onMove(e);
  };
  const onMove = (e: React.PointerEvent) => {
    const p = playRef.current;
    if (!p || !downAt.current) return;
    const s = local(e);
    const cam = camRef.current;
    if (p.phase === 'drop' && p.call === 'pass') {
      // the ring sits above the finger, so the finger doesn't hide it
      aimRef.current = toWorld(cam, { x: s.x, y: s.y - 64 });
    } else if (p.phase === 'run') steerRef.current = toWorld(cam, s).x;
  };
  const onUp = (e: React.PointerEvent) => {
    const p = playRef.current;
    const d = downAt.current;
    downAt.current = null;
    if (!p || !d) return;
    const s = local(e);
    if (p.phase === 'drop' && p.call === 'pass' && aimRef.current) {
      throwTo(p, aimRef.current);
      aimRef.current = null;
      setHint(null);
    } else if (p.phase === 'run') {
      const quick = performance.now() - d.t < 220 && Math.hypot(s.x - d.x, s.y - d.y) < 14;
      if (quick && p.carrier) {
        const cs = toScreen(camRef.current, p.carrier);
        juke(p, Math.sign(s.x - cs.x) || 1);
      }
      steerRef.current = null;
    }
  };
  // the system took the touch (a call, a swipe from the edge): nothing's thrown, the aim's off
  const onCancel = () => {
    downAt.current = null;
    aimRef.current = null;
    steerRef.current = null;
  };

  const g = game;
  const p = playRef.current;
  const fgOk = g ? fgInRange(g) : false;
  return (
    <div className="fgame" ref={wrapRef}>
      <canvas ref={canvasRef} className="fg-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} />
      <div className="fg-hud">
        <span className="fg-score us">
          <i>YOU</i>
          <b className="num">{g?.score ?? 0}</b>
        </span>
        <span className="fg-mid">
          {g && !g.over ? (
            <>
              <b>
                DRIVE {Math.min(g.drive + 1, g.drives)}/{g.drives}
              </b>
              <small>
                {downText(g)} · {spotText(g.ballOn)}
              </small>
            </>
          ) : (
            <b>FINAL</b>
          )}
        </span>
        <span className="fg-score them">
          <i>{rival ? rival.name.toUpperCase().slice(0, 8) : rivalName.toUpperCase().slice(0, 8)}</i>
          <b className="num">{rival ? rival.score : '–'}</b>
          {rival && <small>{rival.done ? 'FINAL' : 'DRIVE ' + Math.min(rival.drive + 1, drives) + '/' + drives}</small>}
        </span>
      </div>
      {g && (
        <div className="fg-ends" aria-hidden="true">
          {Array.from({ length: g.drives }, (_, i) => (
            <i key={i} className={g.ends[i] ? 'e-' + g.ends[i] : i === g.drive ? 'now' : ''}>
              {g.ends[i] ? END_TEXT[g.ends[i]] : i + 1}
            </i>
          ))}
        </div>
      )}
      {pop && (
        <div key={pop.id} className={'fg-pop ' + pop.tone} role="status">
          {pop.text}
        </div>
      )}
      {hint && <div className="fg-hint">{hint}</div>}
      {ui === 'loading' && <div className="fg-loading">Taking the field…</div>}
      {(ui === 'pre' || ui === 'fourth') && g && p && (
        <div className="fg-call">
          {ui === 'fourth' && (
            <span className="fg-4th">
              4TH & {g.toGo < 1 ? 'INCHES' : Math.round(g.toGo)} · {fgOk ? fgDistance(g) + ' YD FIELD GOAL IN RANGE' : 'OUT OF FIELD GOAL RANGE'}
            </span>
          )}
          <div className="fg-play">
            <button className="btn ghost small" onClick={reroll} disabled={ui !== 'pre'} aria-label="Another pass play">
              ↻
            </button>
            <span>
              <small>PASS PLAY</small>
              <b>{CONCEPT_NAMES[p.concept]}</b>
            </span>
          </div>
          <div className="fg-btns">
            <button className="big shine" onClick={() => go('pass')}>
              <span>PASS</span>
            </button>
            <button className="big ghost" onClick={() => go('run')}>
              <span>RUN</span>
            </button>
            {ui === 'fourth' && fgOk && (
              <button className="big gold" onClick={startKick}>
                <span>KICK</span>
              </button>
            )}
          </div>
        </div>
      )}
      {ui === 'kick' && g && <KickMeter window={kickWindow(g)} start={kickRef.current?.t0 ?? 0} stopped={kickRef.current?.stopped ?? null} distance={fgDistance(g)} onKick={kickNow} />}
      {ui === 'final' && g && (
        <div className="fg-final" role="status">
          <span className="eyebrow">Your drives</span>
          <b className="num">{g.score}</b>
          <small>{g.ends.map((e) => END_TEXT[e]).join(' · ')}</small>
          {rival && !rival.done && <WaitLine rival={rival} unit="drive" total={drives} />}
        </div>
      )}
    </div>
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
  const phase = ((performance.now() - start) / 1100) % 2;
  const pos = stopped ?? (phase < 1 ? phase : 2 - phase);
  return (
    <button className="fg-kick" onClick={onKick} aria-label={'Kick the ' + distance + ' yard field goal: tap when the needle is in the window'}>
      <span className="eyebrow">{distance} YD FIELD GOAL · TAP IN THE WINDOW</span>
      <span className="fg-meter">
        <i className="win" style={{ left: (50 - win * 50) + '%', width: win * 100 + '%' }} />
        <i className="needle" style={{ left: pos * 100 + '%' }} />
      </span>
    </button>
  );
}

/** The AI's drives, played by the autopilot against your defense, for a head to head with the AI. */
export function aiDrives(lineup: Lineup, yourDef: Player | null, seed: string, skill: number, attrs: (p: Player) => Attrs | null, drives = DRIVES): Progress {
  const g = newGame(squadOf(lineup, yourDef, attrs), 'ai:' + seed, drives);
  autoplay(g, skill, 'ai:' + seed);
  return { score: g.score, drive: g.drive, done: true, ends: g.ends.slice() };
}
