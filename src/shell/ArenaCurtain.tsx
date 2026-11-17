// Claude (studio overhaul, shell-6, 2026-11-16): the arena curtain (M9). Every match (draft and UT
// matches through Arcade, Training Camp, Moments, any new solo mount point) portals its `.arcade-full`
// into <body>; `ArenaCurtainHost`, mounted once in App, sees it arrive (arena.ts) and covers the
// seconds before its first real frame with a branded title card instead of a black court. The timing
// rules are in curtain.ts; Arcade.tsx, Training.tsx and Moments.tsx are not touched.
//
// The curtain is an overlay only: it never pauses, slows or feeds the match, adds no listener to the
// arena, and reads the arena's canvas through a 4-pixel copy (never the game canvas's own read-back).
import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { pick, SPORT, type SportId } from '../engine/sport';
import { useLayout } from '../stage';
import { Football, Hoop, SoccerBall } from '../ui/icons';
import { reducedMotion } from '../ui/motion';
import { arenaElement, onArenaChange } from './arena';
import { arenaTip } from './arena-tips';
import { arenaInfo, arenaSaidReady, CAP_MS, crestLetters, curtainPhase, FADE_MS, kitColor, onArenaInfo, setArenaInfo, SHOW_AFTER_MS, type ArenaInfo, type ArenaSide, type CurtainPhase } from './curtain';
import './arena-curtain.css';

// ---------- QA record (window.__psCurtain): one entry per arena, times in performance.now() ms ----------
interface CurtainRun {
  /** the arena arrived */
  t0: number;
  handover: boolean;
  /** the canvas first held a picture; motion ready (event or clips); the title card first shown */
  drawnAt?: number;
  motionAt?: number;
  motionBy?: 'event' | 'mocapReady' | 'clip' | 'none';
  cardAt?: number;
  /** the cover first went up (backdrop or card) and finally went (start of the fade) */
  coverAt?: number;
  liftAt?: number;
  /** why it lifted: the arena was ready, or the 2.5 s cap */
  reason?: 'ready' | 'cap' | 'left';
}
const qa = (): CurtainRun[] => {
  const w = window as unknown as { __psCurtain?: CurtainRun[] };
  return (w.__psCurtain ??= []);
};

// ---------- the standalone curtain (Suspense fallback while a match's files download) ----------
let standaloneUp = 0;
let standaloneDownAt = -Infinity;

// ---------- motion clips: players' mocapReady() when it exists, else the shared 'ready' clip ----------
type MocapModule = { mocapReady?: () => boolean; getClip?: (name: string) => unknown; loadClip?: (name: string) => Promise<unknown> };
/** The mocap module, once the first match has loaded it (its chunk comes with the engines). */
let mocap: MocapModule | null = null;
function watchMotion(onReady: (by: 'mocapReady' | 'clip' | 'none') => void): () => void {
  let live = true;
  let poll = 0;
  const use = (m: MocapModule) => {
    if (!live) return;
    if (typeof m.mocapReady === 'function') {
      const check = () => {
        if (!live) return;
        if (m.mocapReady!()) onReady('mocapReady');
        else poll = requestAnimationFrame(check);
      };
      check();
    } else if (typeof m.getClip === 'function' && m.getClip('ready')) onReady('clip');
    else if (typeof m.loadClip === 'function') {
      // the renderers already asked for 'ready' (every sport's set has it): this joins that download
      m.loadClip('ready').then(
        () => live && onReady('clip'),
        () => live && onReady('none')
      );
    } else onReady('none');
  };
  // a second match reads the clips at once (no import to wait for behind the engine's first draw)
  if (mocap) use(mocap);
  else
    import('../game/pixel/mocap')
      .then((m: MocapModule) => use((mocap = m)))
      .catch(() => live && onReady('none'));
  return () => {
    live = false;
    cancelAnimationFrame(poll);
  };
}

/** Does the arena's (largest) canvas hold a picture? Four pixels copied into a scratch canvas. */
let probe: CanvasRenderingContext2D | null | undefined;
function canvasDrawn(arena: HTMLElement): boolean {
  let best: HTMLCanvasElement | null = null;
  arena.querySelectorAll('canvas').forEach((c) => {
    if (c.width * c.height > (best ? best.width * best.height : 0)) best = c;
  });
  const c = best as HTMLCanvasElement | null;
  if (!c || c.width < 4 || c.height < 4) return false;
  if (probe === undefined) {
    const s = document.createElement('canvas');
    s.width = 4;
    s.height = 1;
    probe = s.getContext('2d', { willReadFrequently: true });
  }
  if (!probe) return true;
  try {
    probe.clearRect(0, 0, 4, 1);
    const pts = [
      [0.5, 0.5],
      [0.3, 0.62],
      [0.7, 0.62],
      [0.5, 0.8],
    ];
    pts.forEach(([x, y], i) => probe!.drawImage(c, Math.floor(c.width * x), Math.floor(c.height * y), 1, 1, i, 0, 1, 1));
    const d = probe.getImageData(0, 0, 4, 1).data;
    return d[3] > 0 || d[7] > 0 || d[11] > 0 || d[15] > 0;
  } catch {
    // a canvas that can't be read (it never should be): don't hold the match back on it
    return true;
  }
}

/** Mounted once in App: covers each arena from its arrival to its first real frame. */
export function ArenaCurtainHost({ info, seed }: { info?: ArenaInfo | null; seed?: string }) {
  const [phase, setPhase] = useState<CurtainPhase>('off');
  const [run, setRun] = useState(0);
  const stored = useSyncExternalStore(onArenaInfo, arenaInfo, () => null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    const begin = (sync: boolean) => {
      stop?.();
      // QA on the dev server only: the same app with no curtain, the "before" of frames.mjs
      if (import.meta.env.DEV && (window as unknown as { __psCurtainOff?: boolean }).__psCurtainOff) return;
      const t0 = performance.now();
      const rec: CurtainRun = { t0, handover: standaloneUp > 0 || t0 - standaloneDownAt < 100 };
      const log = qa();
      log.push(rec);
      if (log.length > 20) log.shift();
      let motion = false;
      let drawn = false;
      let settled = 0;
      let shown = false;
      let raf = 0;
      let fade = 0;
      let last: CurtainPhase = 'off';
      let done = false;
      const stopMotion = watchMotion((by) => {
        if (motion) return;
        motion = true;
        rec.motionAt = performance.now() - t0;
        rec.motionBy = by;
      });
      const finish = (reason: CurtainRun['reason']) => {
        done = true;
        cancelAnimationFrame(raf);
        stopMotion();
        rec.reason ??= reason;
      };
      const tick = () => {
        if (done) return;
        const now = performance.now();
        const arena = arenaElement();
        if (!arena) return finish('left');
        if (!drawn && canvasDrawn(arena)) {
          drawn = true;
          rec.drawnAt = now - t0;
        }
        if (!motion && arenaSaidReady(t0)) {
          motion = true;
          rec.motionAt = now - t0;
          rec.motionBy = 'event';
        }
        if (drawn && motion) settled++;
        const elapsed = now - t0;
        const next = curtainPhase({ elapsed, drawn, motion, settled, handover: rec.handover, drawnMs: drawn ? elapsed - rec.drawnAt! : 0 }, shown);
        if (next === 'card' && !shown) {
          shown = true;
          rec.cardAt = elapsed;
        }
        if ((next === 'cover' || next === 'card') && rec.coverAt === undefined) rec.coverAt = elapsed;
        // reduced motion: no fade, the curtain simply goes
        const shownNext = next === 'lifting' && reducedMotion() ? 'off' : next;
        if (shownNext !== last) {
          last = shownNext;
          // the first look runs in the observer's microtask, before the arena's first paint: commit
          // the cover now so that paint already has it (a scheduled render would land a frame late).
          // The lift commits at once too, in this frame, so the game shows in the frame it is ready.
          if (first || shownNext === 'off' || shownNext === 'lifting') flushSync(() => setPhase(shownNext));
          else setPhase(shownNext);
        }
        if (next === 'off' || next === 'lifting') {
          rec.liftAt = elapsed;
          finish(elapsed >= CAP_MS && !(drawn && motion) ? 'cap' : 'ready');
          if (shownNext === 'lifting') fade = window.setTimeout(() => setPhase('off'), FADE_MS);
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      // first look in this same task (the observer runs before the arena's first paint)
      let first = sync;
      tick();
      first = false;
      stop = () => {
        finish('left');
        clearTimeout(fade);
      };
      setRun((n) => n + 1);
    };
    const off = onArenaChange((active) => {
      if (active) begin(true);
      else {
        stop?.();
        stop = null;
        setPhase('off');
        setArenaInfo(null);
      }
    });
    if (arenaElement()) begin(false);
    return () => {
      off();
      stop?.();
    };
  }, []);

  if (phase === 'off') return null;
  return <ArenaCurtain phase={phase} info={info ?? stored} seed={(seed ?? '') + ':' + run} />;
}

/**
 * The curtain itself. `standalone`: the Suspense fallback while a match's files download (it follows
 * the same rule: the backdrop at once, the title card after 150 ms).
 */
export function ArenaCurtain({ phase, info, seed = '', standalone = false }: { phase?: CurtainPhase; info?: ArenaInfo | null; seed?: string; standalone?: boolean }) {
  const layout = useLayout();
  const [late, setLate] = useState(!standalone);
  const seedRef = useRef(seed || String(Math.floor(performance.now())));
  useEffect(() => {
    if (!standalone) return;
    standaloneUp++;
    const t = window.setTimeout(() => setLate(true), SHOW_AFTER_MS);
    return () => {
      clearTimeout(t);
      standaloneUp--;
      standaloneDownAt = performance.now();
    };
  }, [standalone]);
  const shown: CurtainPhase = standalone ? (late ? 'card' : 'cover') : (phase ?? 'card');
  const sport: SportId = SPORT;
  const tip = arenaTip(sport, seed || seedRef.current);
  const title = pick({ nba: 'TIP-OFF', nfl: 'KICKOFF', soccer: 'KICK-OFF' });
  const k = layout.k || 1;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
  const style = {
    '--ac-k': k,
    '--ac-w': vw / k + 'px',
    '--ac-h': vh / k + 'px',
    '--ac-top': layout.sat + layout.edge + 'px',
    '--ac-bot': layout.sab + 'px',
  } as React.CSSProperties;
  const mark = pick({ nba: <Hoop size={34} />, nfl: <Football size={34} />, soccer: <SoccerBall size={34} /> });
  const node = (
    <div
      className={'arena-curtain ac-' + sport + ' ac-is-' + shown + (standalone ? ' ac-standalone' : '')}
      style={style}
      role="status"
      aria-live="polite"
      aria-label={shown === 'cover' ? 'Loading the match' : title + (info ? ': ' + info.us.name + ' against ' + info.them.name : '')}
    >
      <div className="ac-frame">
        <div className="ac-lights" aria-hidden="true" />
        <div className="ac-floor" aria-hidden="true" />
        <div className="ac-mark" aria-hidden="true">
          {mark}
        </div>
        {shown !== 'cover' && (
          <div className="ac-card">
            <span className="ac-eyebrow">{info?.mode ?? 'Get ready'}</span>
            <h2 className="ac-title disp">{title}</h2>
            {info && (
              <div className="ac-matchup">
                <Crest side={info.us} fallback={['#19e3c9', '#0b2631']} />
                <span className="ac-vs disp" aria-hidden="true">
                  VS
                </span>
                <Crest side={info.them} fallback={['#9b7bff', '#5b3fd1']} />
              </div>
            )}
            <div className="ac-tip">
              <b>{tip.head}</b>
              <p>{tip.text}</p>
            </div>
            <div className="ac-bar" aria-hidden="true">
              <i />
            </div>
          </div>
        )}
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
}

/** A crest drawn from kit colours only: a shield in the two colours, a bevel, the side's letters. */
function Crest({ side, fallback }: { side: ArenaSide; fallback: [string, string] }) {
  const c1 = kitColor(side.c1, fallback[0]);
  const c2 = kitColor(side.c2, fallback[1]);
  const id = 'acg' + useId().replace(/[^A-Za-z0-9]/g, '');
  const letters = crestLetters(side);
  return (
    <div className="ac-side">
      <svg className="ac-crest" viewBox="0 0 64 72" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
        </defs>
        <path d="M32 3 L59 12 V36 C59 52 47 63 32 69 C17 63 5 52 5 36 V12 Z" fill={`url(#${id})`} stroke="rgba(255,255,255,.55)" strokeWidth="2" />
        <path d="M32 8 L54 15.5 V36 C54 49 44.5 58 32 63.5" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
        <path d="M9 14 L32 6.5 L55 14 V22 C40 18 24 18 9 22 Z" fill="rgba(255,255,255,.16)" />
        <text x="32" y={letters.length > 3 ? 44 : 45} textAnchor="middle" fontSize={letters.length > 3 ? 15 : letters.length > 2 ? 17 : 21} fontWeight="900" fill="#fff" stroke="rgba(0,0,0,.45)" strokeWidth="2.5" paintOrder="stroke" fontFamily="var(--display)">
          {letters}
        </text>
      </svg>
      <span className="ac-name">{side.name}</span>
    </div>
  );
}
