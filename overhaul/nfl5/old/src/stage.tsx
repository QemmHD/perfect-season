import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { DESIGN_W, portraitRotation, stageBox, visibleViewport, type Layout, type StageBox, type ViewportBox } from './stage-layout';
export { DESIGN_W } from './stage-layout';
export type { Fit, Rot, Layout } from './stage-layout';
import type { Rot } from './stage-layout';

/* The game is designed on a 390px-wide frame. On a phone the frame is scaled
   to the full screen width and its height follows the screen, so a 430x932
   iPhone 15 Pro Max gets the same layout as a 390-wide phone, 10% larger.
   The frame runs edge to edge; --sat/--sab carry the Dynamic Island / status
   bar and home-indicator insets (in frame px) so screens can keep their
   content clear of them while their backgrounds bleed underneath.

   The game is portrait only. Browsers can't lock rotation on iPhone, so when
   a phone is turned sideways the frame is turned back by 90 degrees: it stays
   upright relative to the phone, the way a portrait-locked app does, and the
   island stays at its top. */

const DEFAULT: Layout = { k: 1, h: 844, sat: 0, sab: 0, content: 844, fit: 'roomy', framed: false, rot: 0 };
const LayoutCtx = createContext<Layout>(DEFAULT);
export const useLayout = () => useContext(LayoutCtx);

declare global {
  interface Window {
    /** test hook: [top, right, bottom, left] safe-area insets in screen px */
    __psInsets?: [number, number, number, number];
  }
}

interface Box extends StageBox { viewport: ViewportBox; }

function readInsets(probe: HTMLElement | null): [number, number, number, number] {
  if (window.__psInsets) return window.__psInsets;
  if (!probe) return [0, 0, 0, 0];
  const cs = getComputedStyle(probe);
  return [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((v) => parseFloat(v) || 0) as [number, number, number, number];
}

function measure(root: HTMLElement, probe: HTMLElement | null): Box {
  const visual = window.visualViewport;
  const viewport = visibleViewport({
    width: window.innerWidth || root.clientWidth,
    height: window.innerHeight || root.clientHeight,
    visual: visual && { width: visual.width, height: visual.height, offsetLeft: visual.offsetLeft, offsetTop: visual.offsetTop, scale: visual.scale },
  });
  const legacy = (window as unknown as {orientation?:number}).orientation;
  const angle = typeof legacy === 'number' ? legacy : screen.orientation?.angle;
  const rot = portraitRotation(viewport.w, viewport.h, window.matchMedia?.('(pointer: coarse)').matches ?? false, angle);
  return { ...stageBox(viewport, readInsets(probe), rot), viewport };
}

const standaloneIOS = () => (navigator as Navigator & { standalone?: boolean }).standalone === true;

// The visible viewport, not the device's advertised screen size, controls layout. Older iOS
// recovery forced document height/scroll/re-layout; those guesses could also hide or shrink UI.
/** What the page and the screen report, for Settings (and for a bug report from a real phone). */
export function viewportInfo(): string {
  const doc = document.documentElement.clientHeight;
  const app = document.getElementById('root')?.clientHeight ?? 0;
  const sc = Math.min(screen.width, screen.height) + '×' + Math.max(screen.width, screen.height);
  const [t, , b] = readInsets(document.querySelector<HTMLElement>('.inset-probe'));
  const visual=window.visualViewport;
  const visible=visual?' · visible '+Math.round(visual.width)+'×'+Math.round(visual.height)+' @'+visual.scale.toFixed(2)+' offset '+Math.round(visual.offsetLeft)+'/'+Math.round(visual.offsetTop):'';
  return 'view ' + Math.round(innerWidth) + '×' + Math.round(innerHeight) + (doc !== innerHeight || app !== innerHeight ? ' (' + doc + '/' + app + ')' : '') + ' · screen ' + sc + ' · safe ' + Math.round(t) + '/' + Math.round(b) + visible + (standaloneIOS() ? ' · home screen' : '');
}

/** An element's box in frame px, whatever the frame's scale and rotation. */
export function frameRect(el: Element): { x: number; y: number; w: number; h: number } {
  const stage = el.closest('.stage');
  const r = el.getBoundingClientRect();
  if (!stage) return { x: r.left, y: r.top, w: r.width, h: r.height };
  const m = new DOMMatrix(getComputedStyle(stage).transform).inverse();
  const viewport = stage.closest('.viewport')?.getBoundingClientRect();
  const ox=viewport?.left??0, oy=viewport?.top??0;
  const pts = [
    [r.left, r.top],
    [r.right, r.top],
    [r.left, r.bottom],
    [r.right, r.bottom],
  ].map(([px, py]) => m.transformPoint(new DOMPoint(px-ox, py-oy)));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Converts a pointer position to frame px along the frame's vertical axis. */
export function frameY(e: { clientX: number; clientY: number }, l: Layout): number {
  if (l.rot === -90) return e.clientX / l.k;
  if (l.rot === 90) return -e.clientX / l.k;
  return e.clientY / l.k;
}

export function Stage({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastRot = useRef<Rot | null>(null);

  useLayoutEffect(() => {
    const root=rootRef.current!;
    let raf=0;
    const timers=new Set<number>();
    const apply=()=>{
      const next=measure(root,probeRef.current);
      setBox(old=>old&&old.transform===next.transform&&old.h===next.h&&old.sat===next.sat&&old.sab===next.sab&&old.viewport.w===next.viewport.w&&old.viewport.h===next.viewport.h&&old.viewport.x===next.viewport.x&&old.viewport.y===next.viewport.y?old:next);
    };
    const update=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(apply);};
    const later=(ms:number)=>{const id=window.setTimeout(()=>{timers.delete(id);update();},ms);timers.add(id);};
    // Some browsers report orientation, safe areas and keyboard dismissal in separate frames.
    // Remeasure only; never scroll the document, toggle the app or force a screen-height guess.
    const settle=()=>{update();later(100);later(350);};
    const onShow=()=>{if(document.visibilityState==='visible')settle();};
    apply();
    const ro=new ResizeObserver(update);ro.observe(root);
    if(probeRef.current)ro.observe(probeRef.current,{box:'border-box'});
    window.addEventListener('resize',update);
    window.addEventListener('orientationchange',settle);
    screen.orientation?.addEventListener?.('change',settle);
    window.visualViewport?.addEventListener('resize',update);
    window.visualViewport?.addEventListener('scroll',update);
    window.addEventListener('pageshow',onShow);
    document.addEventListener('visibilitychange',onShow);
    document.addEventListener('focusout',settle);
    return()=>{
      ro.disconnect();timers.forEach(clearTimeout);cancelAnimationFrame(raf);
      window.removeEventListener('resize',update);
      window.removeEventListener('orientationchange',settle);
      screen.orientation?.removeEventListener?.('change',settle);
      window.visualViewport?.removeEventListener('resize',update);
      window.visualViewport?.removeEventListener('scroll',update);
      window.removeEventListener('pageshow',onShow);
      document.removeEventListener('visibilitychange',onShow);
      document.removeEventListener('focusout',settle);
    };
  }, []);

  // after the phone turns, the frame fades back in instead of snapping into place
  useLayoutEffect(() => {
    if (!box) return;
    if (lastRot.current !== null && lastRot.current !== box.rot && stageRef.current?.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      stageRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    lastRot.current = box.rot;
  }, [box?.rot]);

  const style = box
    ? ({
        width: DESIGN_W,
        height: box.h,
        transform: box.transform,
        '--sat': box.sat + 'px',
        '--sab': box.sab + 'px',
      } as React.CSSProperties)
    : undefined;

  return (
    <div className={'viewport' + (box?.framed ? ' wide' : '')} ref={rootRef} style={box?{left:box.viewport.x,top:box.viewport.y,width:box.viewport.w,height:box.viewport.h,right:'auto',bottom:'auto'}:undefined}>
      <div className="inset-probe" ref={probeRef} aria-hidden="true" />
      {box && (
        <div className={'stage fit-' + box.fit + (box.framed ? ' framed' : '')} style={style} data-rot={box.rot} ref={stageRef}>
          <LayoutCtx.Provider value={box}>{children}</LayoutCtx.Provider>
        </div>
      )}
    </div>
  );
}
