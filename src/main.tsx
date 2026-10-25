import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { NFL } from './engine/sport';
import { registerServiceWorker } from './lib/update';
import { Stage } from './stage';
import './styles.css';

// iOS Safari only shows :active press states when the page listens for touches
document.addEventListener('touchstart', () => {}, { passive: true });
// no pinch-zoom, like a native app (iOS ignores user-scalable=no, so stop its gesture events)
document.addEventListener('gesturestart', (e) => e.preventDefault());

/** Waits for the Archivo faces (the condensed display type has no good fallback), at most 2.2s. */
function fontsReady(): Promise<void> {
  const f = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!f?.load) return Promise.resolve();
  const loads = Promise.all([f.load('italic 900 48px Archivo'), f.load('800 14px Archivo'), f.load('700 14px Archivo')]).then(() => undefined);
  const timeout = new Promise<void>((r) => window.setTimeout(r, 2200));
  return Promise.race([loads, timeout]).catch(() => undefined);
}

function Splash({ leaving }: { leaving: boolean }) {
  return (
    <div className={'splash' + (leaving ? ' out' : '')} aria-hidden="true">
      {NFL ? (
        <svg width="96" height="96" viewBox="0 0 96 96">
          <path className="ball" d="M14 82 C8 62 14 38 30 26 S68 8 82 14 C88 34 82 58 66 70 S28 88 14 82 Z" />
          <path className="seam" d="M34 62 L62 34 M41 48 L48 55 M48 41 L55 48 M55 34 L62 41 M34 55 L41 62" />
        </svg>
      ) : (
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle className="ball" cx="48" cy="48" r="38" />
          <path className="seam" d="M10 48 H86 M48 10 V86 M21 21 Q48 48 21 75 M75 21 Q48 48 75 75" />
        </svg>
      )}
    </div>
  );
}

function Root() {
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);
  useEffect(() => {
    const t0 = performance.now();
    void fontsReady().then(() => {
      // let the ball finish its spin, even when the fonts were cached
      window.setTimeout(() => setReady(true), Math.max(0, 700 - (performance.now() - t0)));
    });
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setSplash(false), 450);
    return () => clearTimeout(t);
  }, [ready]);
  return (
    <Stage>
      {ready && <App />}
      {splash && <Splash leaving={ready} />}
    </Stage>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
window.addEventListener('load', registerServiceWorker);
